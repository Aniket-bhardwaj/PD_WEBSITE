import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const baseURL = new URL(process.argv[2] || 'http://127.0.0.1:4323');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(baseURL.hostname))
  throw new Error('Performance measurements are restricted to localhost.');
const response = await fetch(baseURL);
if (!response.ok)
  throw new Error(`Start the compiled local preview first: HTTP ${response.status}`);
const edge = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await launch({
  ...(process.env.CHROME_PATH || edge ? { chromePath: process.env.CHROME_PATH || edge } : {}),
  chromeFlags: ['--headless=new', '--disable-gpu'],
});
const outputDirectory = 'reports/lighthouse';
await mkdir(outputDirectory, { recursive: true });
const runs = [];
try {
  for (const route of ['/', '/work/zero-trust-cloud/', '/work/microsoft-365-identity/']) {
    const url = new URL(route, baseURL).href;
    const result = await lighthouse(url, {
      port: browser.port,
      output: 'html',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    if (!result || result.lhr.runtimeError)
      throw new Error(
        `Lighthouse failed for ${route}: ${result?.lhr.runtimeError?.message || 'no result'}`,
      );
    const slug = route === '/' ? 'home' : route.split('/').filter(Boolean).at(-1);
    const { lhr } = result;
    await writeFile(`${outputDirectory}/${slug}.html`, result.report);
    await writeFile(`${outputDirectory}/${slug}.json`, JSON.stringify(lhr, null, 2));
    const run = {
      route,
      fetchedAt: lhr.fetchTime,
      lighthouseVersion: lhr.lighthouseVersion,
      userAgent: lhr.userAgent,
      settings: lhr.configSettings,
      scores: Object.fromEntries(
        Object.entries(lhr.categories).map(([key, category]) => [
          key,
          category.score === null ? null : Math.round(category.score * 100),
        ]),
      ),
      metrics: Object.fromEntries(
        [
          'largest-contentful-paint',
          'total-blocking-time',
          'cumulative-layout-shift',
          'first-contentful-paint',
          'speed-index',
        ].map((key) => [
          key,
          { value: lhr.audits[key]?.numericValue, unit: lhr.audits[key]?.numericUnit },
        ]),
      ),
      warnings: lhr.runWarnings,
    };
    runs.push(run);
    console.log(JSON.stringify({ route, scores: run.scores, metrics: run.metrics }));
  }
  await writeFile(
    `${outputDirectory}/summary.json`,
    JSON.stringify(
      {
        conditions:
          'One default Lighthouse mobile simulated-throttling lab navigation per route against a compiled localhost preview; no field traffic. TBT is a lab metric and does not establish INP or 75th-percentile Core Web Vitals.',
        runs,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.kill();
}
