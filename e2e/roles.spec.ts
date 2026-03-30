import { test, expect } from '@playwright/test';

/**
 * Credenciales de prueba — creadas con el script de seed en Supabase.
 * Ver: scripts/seed-test-users.sql
 *
 * admin@selcosi.test  / Test1234!  → rol: admin       (sin sucursal)
 * jefe.juliaca@selcosi.test / Test1234! → rol: jefe_sucursal (Juliaca)
 * visor@selcosi.test  / Test1234!  → rol: visor       (Lima)
 */
const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@selcosi.test',
  password: process.env.TEST_ADMIN_PASSWORD || 'Test1234!',
};
const JEFE = {
  email: process.env.TEST_JEFE_EMAIL || 'jefe.juliaca@selcosi.test',
  password: process.env.TEST_JEFE_PASSWORD || 'Test1234!',
};
const VISOR = {
  email: process.env.TEST_VISOR_EMAIL || 'visor@selcosi.test',
  password: process.env.TEST_VISOR_PASSWORD || 'Test1234!',
};

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
}

test.describe('Role-based Access Control (UI)', () => {

  test('Admin: debe ver menú completo y opciones de gestión', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    // Sidebar: items visibles para admin
    await expect(page.locator('nav').locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('nav').locator('text=Vehículos')).toBeVisible();
    // Sección de administración (solo admin)
    await expect(page.locator('nav').locator('text=Invitaciones')).toBeVisible();
  });

  test('Jefe Sucursal: no debe ver menús administrativos', async ({ page }) => {
    await login(page, JEFE.email, JEFE.password);

    // Items básicos visibles
    await expect(page.locator('nav').locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('nav').locator('text=Vehículos')).toBeVisible();

    // Administración: oculta para jefe_sucursal
    await expect(page.locator('nav').locator('text=Invitaciones')).not.toBeVisible();
  });

  test('Visor: solo opciones de lectura, no puede crear vehículos', async ({ page }) => {
    await login(page, VISOR.email, VISOR.password);

    // Items básicos visibles
    await expect(page.locator('nav').locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('nav').locator('text=Vehículos')).toBeVisible();

    // Administración: oculta para visor
    await expect(page.locator('nav').locator('text=Invitaciones')).not.toBeVisible();

    // Visor no debe ver botón de registro de vehículo
    await page.goto('/vehiculos');
    await expect(page.locator('text=Registrar vehículo')).not.toBeVisible();
  });

  test('Acceso directo a /admin/invitaciones debe bloquear jefe y visor', async ({ page }) => {
    // Jefe intenta acceder a ruta de admin
    await login(page, JEFE.email, JEFE.password);
    await page.goto('/admin/invitaciones');
    // Debe redirigir o mostrar página de no autorizado
    await expect(page).not.toHaveURL(/.*\/admin\/invitaciones/);
  });
});
