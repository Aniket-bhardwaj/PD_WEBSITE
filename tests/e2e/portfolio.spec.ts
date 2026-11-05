import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/work/zero-trust-cloud/', '/work/microsoft-365-identity/'];
const widths = [320, 375, 390, 600, 768, 900, 1024, 1280, 1440, 1920];

for (const route of routes) {
  test(`${route} renders without browser errors and passes automated WCAG checks`, async ({
    page,
  }) => {
    const errors: string[] = [];
    const externalRequests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('request', (request) => {
      if (!request.url().startsWith('http://127.0.0.1:4323/') && !request.url().startsWith('data:'))
        externalRequests.push(request.url());
    });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      externalRequests,
      'normal page operation must not depend on remote services or telemetry',
    ).toEqual([]);
  });

  test(`${route} remains readable at all required and intermediate widths`, async ({ page }) => {
    await page.goto(route);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `page overflow at ${width}px`,
      ).toBe(true);
      await expect(page.locator('h1')).toBeVisible();
      const clipped = await page.locator('main h1, main h2, main p').evaluateAll((elements) =>
        elements
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
          })
          .map((element) => element.textContent?.slice(0, 80)),
      );
      expect(clipped, `text extends outside viewport at ${width}px`).toEqual([]);
    }
  });
}

test('visitors can reach both case studies, download the résumé, and contact the owner', async ({
  page,
  request,
}) => {
  await page.goto('/');
  for (const route of routes.slice(1)) {
    const link = page.locator(`a[href="${route}"]`).first();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await page.goto('/');
  }
  const resume = page.locator('main a[href="/resume/Pratik-Deshmukh.pdf"]').first();
  await expect(resume).toBeVisible();
  const response = await request.get('/resume/Pratik-Deshmukh.pdf');
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const email = page.locator('a[href^="mailto:"]').first();
  await expect(email).toBeVisible();
  expect(await email.getAttribute('href')).toMatch(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/);
});

test('keyboard users can skip navigation and operate the mobile navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.locator('details.mobile-nav');
  await menu.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('open', '');
  await expect(menu.locator('a').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(menu).not.toHaveAttribute('open', '');
});

test('reduced motion disables nonessential animated transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of ['/', '/work/zero-trust-cloud/']) {
    await page.goto(route);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
      true,
    );
    const moving = await page.locator('main *').evaluateAll((elements) =>
      elements
        .filter((element) => {
          const style = getComputedStyle(element);
          const durations = `${style.animationDuration},${style.transitionDuration}`
            .split(',')
            .map(parseFloat);
          return durations.some((duration) => duration > 0.01);
        })
        .map((element) => element.tagName),
    );
    expect(moving).toEqual([]);
  }
});

test('homepage access paths update and replay by keyboard', async ({ page }) => {
  await page.goto('/');
  const privateButton = page.getByRole('button', { name: 'Administration', exact: true });
  await privateButton.focus();
  await page.keyboard.press('Enter');
  await expect(privateButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-system-stage]')).toHaveAttribute('data-path', 'private');
  await expect(page.locator('[data-system-caption]')).toContainText(/private|administr/i);
  await page.getByRole('button', { name: /Replay/ }).click();
  await expect(page.locator('[data-system-stage]')).toHaveAttribute('data-path', 'private');
  await page.getByRole('button', { name: 'Public ingress', exact: true }).click();
  await expect(page.locator('[data-system-stage]')).toHaveAttribute('data-path', 'public');
});

test('unknown routes give a usable way back to the portfolio', async ({ page }) => {
  const response = await page.goto('/a-page-that-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/missing/i);
  await page.getByRole('link', { name: /Back to the work/i }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4323/');
});

test('all substantive content remains available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:4323${route}`);
    await expect(page.locator('h1')).toBeVisible();
    expect((await page.locator('main').innerText()).length).toBeGreaterThan(500);
  }
  await page.goto('http://127.0.0.1:4323/work/zero-trust-cloud/');
  for (const node of ['Monster', 'Phoenix', 'Wraith'])
    await expect(page.getByRole('heading', { name: new RegExp(node) }).first()).toBeVisible();
  await expect(page.locator('[data-explorer] .service-list summary')).toHaveCount(33);
  await expect(page.locator('[data-flow-panel]')).toHaveCount(4);
  for (const panel of await page.locator('[data-flow-panel]').all())
    await expect(panel).toBeVisible();
  await expect(page.locator('[data-explorer-controls]').first()).toBeHidden();
  for (const group of await page.locator('[data-secondary-services]').all())
    await expect(group).toHaveAttribute('open', '');
  await context.close();
});
