[CmdletBinding()]
param(
    [ValidateSet('Install', 'Start')]
    [string]$Mode = 'Install',
    [ValidateRange(1024, 65535)]
    [int]$Port = 4323,
    [switch]$NoStart,
    [switch]$NoBrowser,
    [switch]$SkipBrowserTests,
    [switch]$PortableNode
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = $PSScriptRoot
$nodeVersion = '24.19.0'
$nodeHashes = @{
    'x64' = '57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73'
    'arm64' = '8502f4a50b458d4cc38ed8f2001556c2cd239d464920f74017926ccb1e1c157f'
}

function Test-UsableNode([string]$Executable) {
    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) { return $false }
    $versionOutput = & $Executable --version
    if ($LASTEXITCODE -ne 0) { return $false }
    return $versionOutput -match '^v(\d+)\.' -and [int]$Matches[1] -ge 24
}

function Resolve-Node {
    if (-not $PortableNode) {
        $installedNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
        if ($installedNode -and (Test-UsableNode $installedNode.Source)) {
            $installedNpm = Join-Path (Split-Path $installedNode.Source -Parent) 'node_modules\npm\bin\npm-cli.js'
            if (Test-Path -LiteralPath $installedNpm -PathType Leaf) { return $installedNode.Source }
        }
    }

    $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
    if (-not $nodeHashes.ContainsKey($architecture)) {
        throw 'This automatic installer supports Windows x64 and ARM64. Install Node.js 24+ manually on other systems and use npm ci, npm run build, and npm run preview.'
    }
    $toolsRoot = Join-Path $projectRoot '.tools'
    $runtimeName = "node-v$nodeVersion-win-$architecture"
    $runtimeFolder = Join-Path $toolsRoot $runtimeName
    $runtimeNode = Join-Path $runtimeFolder 'node.exe'
    $runtimeNpm = Join-Path $runtimeFolder 'node_modules\npm\bin\npm-cli.js'
    if ((Test-UsableNode $runtimeNode) -and (Test-Path -LiteralPath $runtimeNpm -PathType Leaf)) { return $runtimeNode }

    New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
    $archive = Join-Path $toolsRoot "$runtimeName.zip"
    $downloadURL = "https://nodejs.org/dist/v$nodeVersion/$runtimeName.zip"
    Write-Host "Downloading portable Node.js $nodeVersion from nodejs.org..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadURL -OutFile $archive -UseBasicParsing
    $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $nodeHashes[$architecture]) { throw 'Node.js archive checksum mismatch. Installation stopped.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsRoot -Force
    if (-not (Test-UsableNode $runtimeNode) -or -not (Test-Path -LiteralPath $runtimeNpm -PathType Leaf)) { throw 'The downloaded Node.js runtime or npm could not be started.' }
    return $runtimeNode
}

function Invoke-ProjectNpm([string[]]$CommandArguments) {
    & $script:nodeExecutable $script:npmCLI @CommandArguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($CommandArguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Assert-FreePort([int]$PortNumber, [switch]$BrowserTests) {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $PortNumber)
    try { $listener.Start() }
    catch {
        if ($BrowserTests) { throw 'Browser checks require local port 4323. Close the existing preview, or use -SkipBrowserTests. The -Port option changes only the final preview.' }
        throw "Local port $PortNumber is already in use. Close the existing preview or choose a different -Port."
    }
    finally { $listener.Stop() }
}

Push-Location -LiteralPath $projectRoot
try {
    foreach ($requiredFile in @('package.json', 'package-lock.json', 'astro.config.mjs')) {
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $requiredFile) -PathType Leaf)) {
            throw "Missing $requiredFile. Extract the complete downloaded folder before running setup."
        }
    }
    $script:nodeExecutable = Resolve-Node
    $nodeFolder = Split-Path $script:nodeExecutable -Parent
    $script:npmCLI = Join-Path $nodeFolder 'node_modules\npm\bin\npm-cli.js'
    $env:PATH = "$nodeFolder;$env:PATH"
    $env:ASTRO_TELEMETRY_DISABLED = '1'
    Write-Host "Using Node.js $(& $script:nodeExecutable --version)"

    if ($Mode -eq 'Install') {
        if (-not $SkipBrowserTests) { Assert-FreePort -PortNumber 4323 -BrowserTests }
        Write-Host 'Installing the locked dependencies...'
        Invoke-ProjectNpm -CommandArguments @('ci', '--no-fund')
        foreach ($check in @('check', 'lint', 'format:check', 'test', 'build')) {
            Write-Host "Running $check..."
            Invoke-ProjectNpm -CommandArguments @('run', $check)
        }
        if (-not $SkipBrowserTests) {
            $edgePaths = @(
                'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
            )
            $hasEdge = @($edgePaths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf }).Count -gt 0
            if (-not $hasEdge) {
                Write-Host 'Installing the Chromium browser used by the local tests...'
                Invoke-ProjectNpm -CommandArguments @('exec', '--', 'playwright', 'install', 'chromium')
            }
            Invoke-ProjectNpm -CommandArguments @('run', 'test:e2e')
        }
        Invoke-ProjectNpm -CommandArguments @('audit', '--audit-level=moderate')
        Write-Host 'Installation and checks completed successfully.' -ForegroundColor Green
    }

    if (-not (Test-Path -LiteralPath 'node_modules\astro\package.json' -PathType Leaf)) {
        throw 'Dependencies are missing. Run Setup.cmd first.'
    }
    if (-not (Test-Path -LiteralPath 'dist\index.html' -PathType Leaf)) {
        throw 'The website build is missing. Run Setup.cmd first.'
    }
    if (-not $NoStart) {
        Assert-FreePort $Port
        $siteURL = "http://127.0.0.1:$Port/"
        Write-Host "Starting $siteURL (press Ctrl+C to stop)..." -ForegroundColor Green
        $browserJob = $null
        if (-not $NoBrowser) {
            try {
                $browserJob = Start-Job -ArgumentList $siteURL -ScriptBlock {
                    param($URL)
                    for ($attempt = 0; $attempt -lt 120; $attempt++) {
                        try {
                            $response = Invoke-WebRequest -Uri $URL -UseBasicParsing -TimeoutSec 1
                            if ($response.StatusCode -eq 200) { Start-Process $URL; return }
                        } catch { }
                        Start-Sleep -Milliseconds 250
                    }
                }
            } catch { Write-Host "Open $siteURL in your browser after the Local address appears." }
        }
        try {
            & $script:nodeExecutable $script:npmCLI run preview -- --port "$Port"
            if ($LASTEXITCODE -notin @(0, 130, -1073741510)) { throw "Preview stopped with exit code $LASTEXITCODE." }
        } finally {
            if ($null -ne $browserJob) {
                Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
                Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
            }
        }
    }
} catch {
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
