import { test, expect } from '@playwright/test';

test('abre el test de compatibilidad y muestra resultados', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-open-quiz]').first().click();
  const quizForm = page.locator('#compatibility-form');

  await quizForm.locator('select[name="hogar"]').selectOption('departamento');
  await quizForm.locator('select[name="tiempo"]').selectOption('poco');
  await quizForm.locator('select[name="experiencia"]').selectOption('primera');
  await quizForm.locator('select[name="preferencia"]').selectOption('gato');
  await quizForm.locator('button[type="submit"]').click();

  await expect(page.locator('#quiz-result')).toBeVisible();
  await expect(page.locator('.quiz-result-item')).toHaveCount(3);
  await expect(page.locator('.quiz-result-item h3').first()).toHaveText('Luna');
});

test('muestra la sección de refugios', async ({ page }) => {
  await page.goto('/#refugios');
  await expect(page.locator('#refuges-title')).toBeVisible();
  await expect(page.locator('.refuge-list-item')).toHaveCount(4);
});

test('arranca sin errores de consola y sirve los estáticos', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.locator('#pet-grid .pet-card')).toHaveCount(6);
  await expect(page.locator('#stats-available')).toHaveText('6');
  await expect(page.locator('#pet-count')).toHaveText('6');

  for (const asset of ['/src/main.js', '/src/styles.css', '/src/styles/base.css', '/src/adopme-mark.svg', '/config/app.config.js']) {
    const response = await page.request.get(asset);
    expect(response.status(), asset).toBe(200);
  }

  expect(errors).toEqual([]);
});

test('busca, filtra favoritos y abre la ficha con el teclado', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pet-search').fill('zzz');
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#pet-grid')).toBeHidden();
  await page.locator('#reset-search').click();
  await expect(page.locator('.pet-card')).toHaveCount(6);

  await page.locator('[data-category="Gatos"]').click();
  await expect(page.locator('.pet-card')).toHaveCount(3);
  await page.locator('[data-age-filter="Cachorro"]').click();
  await expect(page.locator('.pet-card h3')).toHaveText(['Luna', 'Nala']);

  await page.locator('.pet-card').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#pet-detail-dialog')).toBeVisible();
  await expect(page.locator('#pet-detail-title')).toHaveText('Luna');
  await page.locator('#pet-detail-close').click();

  await page.locator('[data-favorite="2"]').click();
  await expect(page.locator('#saved-count')).toHaveText('1');
  await page.locator('#saved-filter').click();
  await expect(page.locator('.pet-card')).toHaveCount(1);
});

test('registra una cuenta, envía una solicitud y la sigue', async ({ page }) => {
  await page.goto('/');
  await page.locator('#auth-trigger').click();
  await page.locator('#auth-switch').click();
  await page.locator('#register-form input[name="nombre"]').fill('Ana Pérez');
  await page.locator('#register-form input[name="correo"]').fill('ana@correo.com');
  await page.locator('#register-form input[name="password"]').fill('Clave1234');
  await page.locator('#register-form button[type="submit"]').click();
  await expect(page.locator('#auth-trigger')).toHaveText('Salir');

  await page.locator('.pet-card [data-adopt="1"]').click();
  await expect(page.locator('#adoption-dialog')).toBeVisible();
  await expect(page.locator('#applicant-email')).toHaveValue('ana@correo.com');
  await page.locator('#adoption-form input[name="telefono"]').fill('4430000000');
  await page.locator('#application-next').click();
  await page.locator('#adoption-form select[name="tipoVivienda"]').selectOption('Casa');
  await page.locator('#adoption-form select[name="otrasMascotas"]').selectOption('No');
  await page.locator('#adoption-form select[name="experiencia"]').selectOption('Sí, actualmente');
  await page.locator('#application-next').click();
  await expect(page.locator('#application-summary')).toContainText('Milo');
  await page.locator('#adoption-form input[name="consentimiento"]').check();
  await page.locator('#application-submit').click();
  await expect(page.locator('#dialog-success')).toBeVisible();
  await page.locator('#view-my-requests').click();
  await expect(page.locator('.tracking-item h3')).toHaveText('Milo');
  await expect(page.locator('#stats-requests')).toHaveText('1');
});

test('el panel publica texto peligroso como texto y no como HTML', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', (dialog) => dialogs.push(dialog.type()));
  await page.goto('/');
  await page.locator('[data-open-refuge]').first().click();
  await page.locator('#pet-create-form input[name="nombre"]').fill('<img src=x onerror=alert(1)>');
  await page.locator('#pet-create-form select[name="especie"]').selectOption('Otro');
  await page.locator('#pet-create-form input[name="raza"]').fill('Mestizo');
  await page.locator('#pet-create-form input[name="edad"]').fill('1 año');
  await page.locator('#pet-create-form input[name="foto"]').fill('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=200&q=60');
  await page.locator('#pet-create-form textarea[name="descripcion"]').fill('Una descripción <script>alert(1)</script>');
  await page.locator('#pet-create-form button[type="submit"]').click();
  await expect(page.locator('#pet-form-feedback')).toContainText('Mascota publicada');
  await page.locator('#refuge-dialog .dialog-close').click();

  const card = page.locator('.pet-card').first();
  await expect(card.locator('h3')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(card.locator('script, img[onerror]')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('el tema y un localStorage corrupto no impiden el catálogo semilla', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('adopme-pets', '{malo');
    localStorage.setItem('adopme-favorites', 'no-json');
    localStorage.setItem('adopme-adoptions', '{malo');
    localStorage.setItem('adopme-compatibility', 'nope');
    localStorage.setItem('adopme-accounts', 'nope');
    localStorage.setItem('adopme-theme', 'dark');
  });
  await page.goto('/');
  await expect(page.locator('.pet-card')).toHaveCount(6);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('adopción sin sesión abre el acceso y el alta rechaza una foto insegura', async ({ page }) => {
  await page.goto('/');
  await page.locator('.pet-card [data-adopt="1"]').click();
  await expect(page.locator('#auth-dialog')).toBeVisible();
  await expect(page.locator('#auth-feedback')).toContainText('Inicia sesión');
  await page.locator('#auth-close').click();

  await page.locator('[data-open-refuge]').first().click();
  await page.locator('#pet-create-form input[name="nombre"]').fill('Canela');
  await page.locator('#pet-create-form input[name="raza"]').fill('Mestizo');
  await page.locator('#pet-create-form input[name="edad"]').fill('2 años');
  await page.locator('#pet-create-form input[name="foto"]').fill('http://example.com/foto.jpg');
  await page.locator('#pet-create-form textarea[name="descripcion"]').fill('Cariñosa');
  await page.locator('#pet-create-form button[type="submit"]').click();
  await expect(page.locator('#pet-form-feedback')).toContainText('https');
});
