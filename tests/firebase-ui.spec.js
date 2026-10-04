import { expect, test } from '@playwright/test';

test('el arranque de pruebas usa el respaldo local y ofrece restablecer la contraseña', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-backend', 'local');
  await expect(page.locator('.pet-card')).toHaveCount(6);
  await page.locator('#auth-trigger').click();
  await expect(page.locator('#forgot-password')).toBeVisible();
  await page.locator('#forgot-password').click();
  await expect(page.locator('#auth-feedback')).toContainText('cuenta es local');
  await expect(page.locator('#auth-dialog')).toBeVisible();
});
