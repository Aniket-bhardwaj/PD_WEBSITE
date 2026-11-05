import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve('dist');
const origin = 'https://pratikdeshmukh.co.in';
const problems = [];
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    ),
  );
  return nested.flat();
}
const files = await walk(root);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const documents = new Map(
  await Promise.all(htmlFiles.map(async (file) => [file, await readFile(file, 'utf8')])),
);
const ids = (html) =>
  new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((match) => match[1]));
async function resolveLocal(urlPath) {
  const candidate = path.resolve(root, `.${decodeURIComponent(urlPath)}`);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  try {
    return (await stat(candidate)).isDirectory() ? path.join(candidate, 'index.html') : candidate;
  } catch {
    return null;
  }
}
for (const file of files) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (/(^|\/)(references|docs)(\/|$)|\.map$|\.env|studio(?:-oci|-m365)?\.html/.test(relative))
    problems.push(`Private or authoring file in output: ${relative}`);
}
for (const [file, html] of documents) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const pagePath = relative === 'index.html' ? '/' : `/${relative.replace(/index\.html$/, '')}`;
  const pageURL = new URL(pagePath, origin);
  const policy = html.match(
    /<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/i,
  )?.[1];
  if (!policy) problems.push(`Missing document content security policy: ${relative}`);
  if (policy?.includes("'unsafe-inline'") || policy?.includes("'unsafe-eval'"))
    problems.push(`Unsafe script policy in ${relative}`);
  for (const [, attributes, script] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attributes) || !script.trim()) continue;
    const hash = createHash('sha256').update(script).digest('base64');
    if (!policy?.includes(`'sha256-${hash}'`))
      problems.push(`Inline script missing matching CSP hash in ${relative}: sha256-${hash}`);
  }
  for (const pattern of [
    /\b(?:10|192\.168)\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?\b/,
    /\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/,
    /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
    /(?:[?&](?:token|secret|api_key)=)/i,
    /(?:href|src)=["'][^"']*(?:references\/|docs\/|studio\.html|index\.html#[^"']*)/i,
  ]) {
    if (pattern.test(html))
      problems.push(`Forbidden reference or sensitive pattern in ${relative}: ${pattern}`);
  }
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`Missing title: ${relative}`);
  if (!/<meta\b[^>]*name=["']description["'][^>]*content=["'][^"']+["']/i.test(html))
    problems.push(`Missing description: ${relative}`);
  if (
    !new RegExp(
      `<link\\b[^>]*rel=["']canonical["'][^>]*href=["']${pageURL.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
    ).test(html)
  )
    problems.push(`Incorrect canonical URL: ${relative}`);
  for (const property of ['og:title', 'og:description', 'og:image', 'og:url']) {
    if (!html.includes(`property="${property}"`)) problems.push(`Missing ${property}: ${relative}`);
  }
  const anchors = [...html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/g)];
  const socialImage = html.match(
    /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  );
  if (socialImage) anchors.push(socialImage);
  for (const [, value] of anchors) {
    if (/^(?:mailto:|tel:|data:)/i.test(value)) continue;
    let url;
    try {
      url = new URL(value.replaceAll('&amp;', '&'), pageURL);
    } catch {
      problems.push(`Invalid URL ${value} in ${relative}`);
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      problems.push(`Unsafe URL scheme in ${relative}: ${value}`);
      continue;
    }
    if (url.origin !== origin) continue;
    const target = await resolveLocal(url.pathname);
    if (!target || !files.includes(target)) {
      problems.push(`Missing local target in ${relative}: ${value}`);
      continue;
    }
    if (
      url.hash &&
      documents.has(target) &&
      !ids(documents.get(target)).has(decodeURIComponent(url.hash.slice(1)))
    )
      problems.push(`Missing fragment in ${relative}: ${value}`);
  }
}
for (const file of files.filter((file) => file.endsWith('.css'))) {
  const css = await readFile(file, 'utf8');
  const cssURL = new URL(`/${path.relative(root, file).replaceAll('\\', '/')}`, origin);
  for (const [, value] of css.matchAll(/url\(["']?([^\s)'";]+)["']?\)/g)) {
    if (value.startsWith('data:')) continue;
    const url = new URL(value, cssURL);
    const target = url.origin === origin ? await resolveLocal(url.pathname) : null;
    if (!target || !files.includes(target))
      problems.push(`Missing or external CSS asset in ${path.relative(root, file)}: ${value}`);
  }
}
for (const required of [
  'index.html',
  'work/zero-trust-cloud/index.html',
  'work/microsoft-365-identity/index.html',
  'resume/Pratik-Deshmukh.pdf',
  'robots.txt',
  'sitemap.xml',
]) {
  if (!files.includes(path.join(root, required)))
    problems.push(`Required output absent: ${required}`);
}
const resume = await readFile(path.join(root, 'resume/Pratik-Deshmukh.pdf'));
if (resume.subarray(0, 5).toString() !== '%PDF-') problems.push('Résumé is not a PDF');
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Build integrity passed: ${htmlFiles.length} HTML pages, ${files.length} files; local URLs/fragments, required assets, metadata and sensitive-file checks.`,
  );
