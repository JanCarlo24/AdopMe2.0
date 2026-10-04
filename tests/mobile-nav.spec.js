import { test, expect } from '@playwright/test';

async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
}

async function expectNoHorizontalOverflow(page) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
}

test.describe('menú móvil', () => {
  test('se abre con teclado, se cierra y devuelve el foco', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto('/');
    const toggle = page.locator('#nav-toggle');
    const nav = page.locator('#main-nav');

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-controls', 'main-nav');
    await expect(toggle).toHaveAccessibleName('Abrir menú');
    await expect(nav).toBeHidden();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAccessibleName('Cerrar menú');
    await expect(nav).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(nav.locator('a').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();

    await page.keyboard.press(' ');
    await expect(nav).toBeVisible();
    await nav.locator('a[href="#catalogo"]').click();
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(page).toHaveURL(/#catalogo/);

    await toggle.click();
    await page.mouse.click(12, 680);
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('el panel no desborda en los anchos indicados y en escritorio sigue la barra', async ({ page }) => {
    for (const width of [320, 375, 414, 700]) {
      await page.setViewportSize({ width, height: 720 });
      await page.goto('/');
      await expectNoHorizontalOverflow(page);
      await page.locator('#nav-toggle').click();
      await expect(page.locator('#main-nav')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.keyboard.press('Escape');
    }

    await page.setViewportSize({ width: 768, height: 800 });
    await page.goto('/');
    await expect(page.locator('#nav-toggle')).toBeHidden();
    await expect(page.locator('#main-nav')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
