import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('full desktop and mobile journeys preserve section anchors and document flow', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const audit = [];
  await mkdir('reports/screenshots', { recursive: true });
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ['/', '/work/zero-trust-cloud/', '/work/microsoft-365-identity/']) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      const slug = route === '/' ? 'home' : route.split('/').filter(Boolean).at(-1);
      await page.screenshot({
        path: `reports/screenshots/${slug}-${viewport.name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      const dimensions = await page.evaluate(() => ({
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        viewportCount: Number((document.documentElement.scrollHeight / innerHeight).toFixed(2)),
        sections: [
          ...document.querySelectorAll(
            'main section[id], main section.studio-hero, main section.case-hero',
          ),
        ].map((section) => ({
          id: section.id,
          heading: section.querySelector('h1,h2')?.textContent?.trim(),
          height: Math.round(section.getBoundingClientRect().height),
          viewportCount: Number((section.getBoundingClientRect().height / innerHeight).toFixed(2)),
        })),
        overlays: [...document.querySelectorAll('body *')]
          .filter((element) => ['fixed', 'sticky'].includes(getComputedStyle(element).position))
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            width: Math.round(element.getBoundingClientRect().width),
            height: Math.round(element.getBoundingClientRect().height),
          })),
      }));
      const anchors = page.locator(route === '/' ? 'main a[href^="#"]' : '.case-toc a[href^="#"]');
      const destinations = [
        ...new Set(
          await anchors.evaluateAll((links) =>
            links.map((link) => link.getAttribute('href')).filter((href): href is string => !!href),
          ),
        ),
      ];
      const anchorResults = [];
      for (const href of destinations) {
        const link = anchors
          .filter({ hasText: /./ })
          .and(page.locator(`a[href="${href}"]`))
          .first();
        await link.click();
        const target = page.locator(href);
        await expect(target).toBeVisible();
        await expect
          .poll(
            async () =>
              target.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.top >= -1 && rect.top < innerHeight;
              }),
            { message: `${route}${href} should scroll its target into view` },
          )
          .toBe(true);
        const coveredHeadings = await target.evaluate((element) => {
          const heading = element.querySelector('h1,h2') || element;
          const rect = heading.getBoundingClientRect();
          return [...document.querySelectorAll('body *')]
            .filter((candidate) => {
              if (
                candidate === element ||
                candidate.contains(heading) ||
                element.contains(candidate)
              )
                return false;
              if (!['fixed', 'sticky'].includes(getComputedStyle(candidate).position)) return false;
              const overlay = candidate.getBoundingClientRect();
              return (
                overlay.width > 0 &&
                overlay.height > 0 &&
                overlay.left < rect.right &&
                overlay.right > rect.left &&
                overlay.top < rect.bottom &&
                overlay.bottom > rect.top
              );
            })
            .map((candidate) => candidate.className);
        });
        expect(coveredHeadings, `${route}${href} heading covered by fixed/sticky content`).toEqual(
          [],
        );
        anchorResults.push({ href, reached: true });
      }
      await page.getByRole('link', { name: /Back to top/i }).click();
      await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(150);
      audit.push({ route, viewport, ...dimensions, anchors: anchorResults });
    }
  }
  await writeFile('reports/scroll-audit.json', JSON.stringify(audit, null, 2));
});
