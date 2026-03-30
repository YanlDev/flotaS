import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('debería mostrar el formulario de login correctamente', async ({ page }) => {
    await expect(page.locator('text=Selcosi Flota')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Ingresar');
  });

  test('debería mostrar error con credenciales incorrectas', async ({ page }) => {
    await page.fill('input#email', 'noexiste@test.com');
    await page.fill('input#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Muestra "Error de conexión" o "Credenciales incorrectas"
    await expect(page.locator('.text-destructive')).toBeVisible();
    // Podemos verificar texto parcial
    await expect(page.locator('.text-destructive')).toContainText(/(Credenciales incorrectas|Error al iniciar sesión|Error de conexión)/);
  });

  test('debería iniciar sesión correctamente con credenciales válidas y redirigir al dashboard', async ({ page }) => {
    // Usamos credenciales reales de la BD sacadas de variables de entorno
    // Usuario semilla creado con: npm run seed:test
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@selcosi.test';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'Test1234!';
    
    await page.fill('input#email', adminEmail);
    await page.fill('input#password', adminPassword);
    await page.click('button[type="submit"]');

    // Debería redirigir al dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Verificamos elementos del dashboard (ej: texto "Dashboard")
    // asumiendo que el sidebar contenga el texto "Dashboard"
    await expect(page.locator('text=Dashboard').first()).toBeVisible();
  });
});
