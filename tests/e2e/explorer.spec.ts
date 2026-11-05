import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('node selection works by keyboard and exposes the corresponding services', async ({
  page,
}) => {
  await page.goto('/work/zero-trust-cloud/');
  const explorer = page.locator('[data-explorer]');
  for (const node of ['phoenix', 'wraith', 'monster']) {
    const button = explorer.locator(`[data-node="${node}"]`);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(explorer.locator('[data-node][aria-pressed="true"]')).toHaveCount(1);
    const panel = explorer.locator(`[data-node-panel="${node}"]`);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading').first()).toContainText(new RegExp(node, 'i'));
    const service = panel.locator('details').first();
    await service.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(service).toHaveAttribute('open', '');
    expect((await service.innerText()).length).toBeGreaterThan(20);
    const additional = panel.locator('[data-secondary-services]');
    await expect(additional).not.toHaveAttribute('open', '');
    await additional.locator(':scope > summary').focus();
    await page.keyboard.press('Enter');
    await expect(additional).toHaveAttribute('open', '');
    const secondaryService = additional.locator('.service-list details').first();
    await expect(secondaryService.locator('summary')).toBeVisible();
    await secondaryService.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(secondaryService).toHaveAttribute('open', '');
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations, `${node} selected with its first service expanded`).toEqual(
      [],
    );
  }
});

test('traffic modes expose different ordered paths and announce changes', async ({ page }) => {
  await page.goto('/work/zero-trust-cloud/');
  const explorer = page.locator('[data-explorer]');
  const descriptions = new Set<string>();
  for (const mode of ['public', 'private', 'observability', 'overview']) {
    const button = explorer.locator(`[data-mode="${mode}"]`);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(explorer.locator('[data-mode][aria-pressed="true"]')).toHaveCount(1);
    const flow = explorer.locator(`[data-flow-panel="${mode}"]`);
    await expect(flow).toBeVisible();
    descriptions.add(await flow.innerText());
    await expect(explorer.locator('[data-announcement]')).not.toBeEmpty();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, `${mode} traffic mode`).toEqual([]);
  }
  expect(descriptions.size).toBe(4);
});
