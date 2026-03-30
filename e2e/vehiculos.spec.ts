import { test, expect, Page } from '@playwright/test';

/**
 * Tests E2E — CRUD de Vehículos
 *
 * Cubre:
 *  - CREATE : Admin abre modal de 3 pasos y registra un vehículo
 *  - READ   : Lista y detalle del vehículo creado
 *  - UPDATE : Admin edita campos en /vehiculos/[id]/editar
 *  - DELETE : Admin elimina confirmando en el diálogo
 *  - API    : Validaciones de error (400, 403, 404, 409) vía fetch en contexto autenticado
 *  - RBAC   : Jefe y Visor no ven el botón de registro ni pueden editar/eliminar
 *
 * Usuarios de prueba (seed con scripts/seed-test-users.sql):
 *  admin@selcosi.test            / Test1234!  — rol: admin
 *  jefe.juliaca@selcosi.test     / Test1234!  — rol: jefe_sucursal
 *  visor@selcosi.test            / Test1234!  — rol: visor
 */

// ── Credenciales ──────────────────────────────────────────────────────────────

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL    || 'admin@selcosi.test',
  password: process.env.TEST_ADMIN_PASSWORD || 'Test1234!',
};
const JEFE = {
  email: process.env.TEST_JEFE_EMAIL    || 'jefe.juliaca@selcosi.test',
  password: process.env.TEST_JEFE_PASSWORD || 'Test1234!',
};
const VISOR = {
  email: process.env.TEST_VISOR_EMAIL    || 'visor@selcosi.test',
  password: process.env.TEST_VISOR_PASSWORD || 'Test1234!',
};

// Placa única por ejecución para evitar conflictos de unique-constraint
const RUN_ID  = Date.now().toString().slice(-6);
const PLACA   = `T${RUN_ID}`;   // ≤8 chars, sin guion

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  // Limpiamos el estado del navegador para evitar que una sesión anterior interfiera
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }).catch(() => {});
  await page.goto('/login'); // Refrescamos por si había un redirect asíncrono

  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
}

/**
 * Abre el modal de 3 pasos y registra un vehículo de prueba.
 * El admin debe estar ya logueado y en cualquier página.
 * Devuelve la URL del detalle del vehículo creado.
 */
async function crearVehiculo(page: Page, placa = PLACA): Promise<string> {
  await page.goto('/vehiculos');

  // Abrir modal
  await page.click('text=Registrar vehículo');

  // Esperar a que el dialog esté visible y muestre paso 1
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 8000 });
  await expect(dialog.locator('text=Paso 1 de 3')).toBeVisible();

  // ── Paso 1: Datos básicos ─────────────────────────────────────────────────
  // Sucursal: primer combobox del dialog
  const comboboxes = dialog.locator('button[role="combobox"]');
  await comboboxes.first().click();
  // Las opciones de Radix se renderizan en un portal fuera del dialog
  await page.locator('[role="option"]').first().click();

  // Placa, marca, modelo, año
  await dialog.locator('input[name="placa"]').fill(placa);
  await dialog.locator('input[name="marca"]').fill('Toyota');
  await dialog.locator('input[name="modelo"]').fill('Hilux E2E');
  await dialog.locator('input[name="anio"]').fill('2022');

  // Tipo: segundo combobox del dialog
  await comboboxes.nth(1).click();
  await page.locator('[role="option"]:has-text("Camioneta")').click();

  // Avanzar al paso 2
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect(dialog.locator('text=Paso 2 de 3')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(600); // Dar respiro a la UI / animaciones

  // ── Paso 2: Técnico — todo opcional, sólo avanzar ─────────────────────────
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect(dialog.locator('text=Paso 3 de 3')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(600); // Dar respiro a la UI / animaciones

  // ── Paso 3: Operación ─────────────────────────────────────────────────────
  await dialog.locator('input[name="kmActuales"]').fill('15000');

  // Asegurarse de que el botón de submit sea visible y hacer clic
  const finalizarBtn = dialog.locator('button', { hasText: 'Finalizar Registro' });
  await expect(finalizarBtn).toBeVisible({ timeout: 15000 });
  await finalizarBtn.click();

  // Redirige al detalle del vehículo (/vehiculos/<uuid>)
  await expect(page).toHaveURL(/\/vehiculos\/[a-z0-9-]+$/, { timeout: 20000 });
  return page.url();
}

// ── Suite CRUD (serial: comparten vehiculoUrl a través de los tests) ──────────

test.describe.serial('Vehículos — CRUD completo (Admin)', () => {
  let vehiculoUrl = '';

  // ── CREATE ────────────────────────────────────────────────────────────────

  test('CREATE — Admin registra vehículo en modal de 3 pasos', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    vehiculoUrl = await crearVehiculo(page);

    // Confirmar que la placa aparece en la página de detalle
    await expect(page.locator(`text=${PLACA}`).first()).toBeVisible({ timeout: 8000 });
  });

  // ── READ: detalle ─────────────────────────────────────────────────────────

  test('READ — Detalle muestra placa, marca y modelo correctos', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!vehiculoUrl) vehiculoUrl = await crearVehiculo(page);

    await page.goto(vehiculoUrl);
    await expect(page.locator(`text=${PLACA}`).first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Toyota').first()).toBeVisible();
    // La página muestra "Hilux E2E" en el subtítulo de la barra superior
    await expect(page.locator('text=Hilux E2E').first()).toBeVisible();
  });

  // ── READ: lista ───────────────────────────────────────────────────────────

  test('READ — Lista muestra la placa del vehículo creado', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!vehiculoUrl) vehiculoUrl = await crearVehiculo(page);

    await page.goto('/vehiculos');
    await expect(page.locator(`text=${PLACA}`)).toBeVisible({ timeout: 10000 });
  });

  // ── READ: búsqueda ────────────────────────────────────────────────────────

  test('READ — Búsqueda por placa filtra y muestra el resultado', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!vehiculoUrl) vehiculoUrl = await crearVehiculo(page);

    await page.goto('/vehiculos');
    await page.fill('input[name="q"]', PLACA);
    await page.click('button:has-text("Buscar")');

    await expect(page.locator(`text=${PLACA}`)).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=No se encontraron vehículos')).not.toBeVisible();
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────

  test('UPDATE — Admin edita el modelo y guarda cambios', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!vehiculoUrl) vehiculoUrl = await crearVehiculo(page);

    await page.goto(vehiculoUrl);

    // Clic en el botón "Editar" (link a /editar)
    await page.click('a:has-text("Editar")');
    await expect(page).toHaveURL(/\/editar$/, { timeout: 8000 });
    await expect(page.locator('h1:has-text("Editar vehículo")')).toBeVisible();

    // Cambiar el modelo
    const modeloInput = page.locator('input[name="modelo"]');
    await modeloInput.clear();
    await modeloInput.fill('Hilux E2E Editado');

    // Guardar
    await page.click('button:has-text("Guardar cambios")');

    // Debe volver al detalle con el modelo actualizado
    await expect(page).toHaveURL(/\/vehiculos\/[a-z0-9-]+$/, { timeout: 15000 });
    await expect(page.locator('text=Hilux E2E Editado').first()).toBeVisible({ timeout: 8000 });
  });

  // ── DELETE ────────────────────────────────────────────────────────────────

  test('DELETE — Admin elimina el vehículo confirmando en el diálogo', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!vehiculoUrl) vehiculoUrl = await crearVehiculo(page);

    await page.goto(vehiculoUrl);

    // Botón "Eliminar" (variant destructive)
    await page.click('button:has-text("Eliminar")');

    // Diálogo de confirmación: aparece "¿Eliminar vehículo…?"
    const confirmDialog = page.locator('[role="dialog"]');
    await expect(confirmDialog.locator('text=irreversible')).toBeVisible({ timeout: 5000 });

    // Confirmar eliminación
    await confirmDialog.locator('button:has-text("Sí, eliminar")').click();

    // Redirige a /vehiculos
    await expect(page).toHaveURL(/\/vehiculos$/, { timeout: 15000 });

    // El vehículo ya no aparece en la lista
    await expect(page.locator(`text=${PLACA}`)).not.toBeVisible({ timeout: 5000 });

    // Resetear para evitar que otros tests reingresen a una URL borrada
    vehiculoUrl = '';
  });
});

// ── Validaciones de API ───────────────────────────────────────────────────────

test.describe('Vehículos — Validación API', () => {

  test('POST /api/vehiculos sin campos requeridos → 400', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    const r = await page.evaluate(async () => {
      const res = await fetch('/api/vehiculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(r.status).toBe(400);
    expect(r.body).toHaveProperty('error');
  });

  test('POST /api/vehiculos con placa duplicada → 409', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    // Obtener el primer vehículo existente para usar su placa
    const existing = await page.evaluate(async () => {
      const res = await fetch('/api/vehiculos');
      const list = await res.json() as Array<{ id: string; placa: string; sucursal: { id: string } }>;
      return list[0] ?? null;
    });

    if (!existing) {
      test.skip();
      return;
    }

    const r = await page.evaluate(async (data) => {
      const res = await fetch('/api/vehiculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return { status: res.status, body: await res.json() };
    }, {
      placa: existing.placa,
      sucursalId: existing.sucursal.id,
      tipo: 'auto',
      marca: 'Dup',
      modelo: 'Test',
      anio: 2020,
    });

    expect(r.status).toBe(409);
    expect((r.body as { error: string }).error).toMatch(/placa/i);
  });

  test('DELETE /api/vehiculos/:id con ID inexistente → 404', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    const r = await page.evaluate(async () => {
      const res = await fetch('/api/vehiculos/id-no-existe-000000', { method: 'DELETE' });
      return { status: res.status };
    });

    expect(r.status).toBe(404);
  });

  test('PUT /api/vehiculos/:id como Visor → 403', async ({ page }) => {
    // Primero obtener un ID real con admin
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await page.evaluate(async () => {
      const res = await fetch('/api/vehiculos');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!vehiculoId) { test.skip(); return; }

    // Ahora re-loguearse como visor e intentar editar
    await login(page, VISOR.email, VISOR.password);
    const r = await page.evaluate(async (id) => {
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: 'Rojo intento' }),
      });
      return { status: res.status };
    }, vehiculoId);

    expect(r.status).toBe(403);
  });

  test('DELETE /api/vehiculos/:id como Jefe de sucursal → 403', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await page.evaluate(async () => {
      const res = await fetch('/api/vehiculos');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!vehiculoId) { test.skip(); return; }

    await login(page, JEFE.email, JEFE.password);
    const r = await page.evaluate(async (id) => {
      const res = await fetch(`/api/vehiculos/${id}`, { method: 'DELETE' });
      return { status: res.status };
    }, vehiculoId);

    expect(r.status).toBe(403);
  });
});

// ── RBAC — Controles de interfaz por rol ────────────────────────────────────

test.describe('Vehículos — RBAC (Interfaz)', () => {

  test('Visor: ve la lista pero NO tiene botón "Registrar vehículo"', async ({ page }) => {
    await login(page, VISOR.email, VISOR.password);
    await page.goto('/vehiculos');
    await expect(page.locator('h1:has-text("Flota vehicular")')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Registrar vehículo')).not.toBeVisible();
  });

  test('Jefe de sucursal: ve la lista pero NO tiene botón "Registrar vehículo"', async ({ page }) => {
    await login(page, JEFE.email, JEFE.password);
    await page.goto('/vehiculos');
    await expect(page.locator('h1:has-text("Flota vehicular")')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Registrar vehículo')).not.toBeVisible();
  });

  test('Admin: ve el filtro de sucursal; Jefe NO lo ve', async ({ page }) => {
    // Admin sí debe ver el select de sucursales
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/vehiculos');
    await expect(page.locator('select[name="sucursalId"]')).toBeVisible({ timeout: 8000 });

    // Jefe NO debe ver el selector de sucursales
    await login(page, JEFE.email, JEFE.password);
    await page.goto('/vehiculos');
    await expect(page.locator('select[name="sucursalId"]')).not.toBeVisible();
  });

  test('Visor: intento de acceder a /editar redirige fuera de la ruta', async ({ page }) => {
    // Obtener un ID real con admin
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await page.evaluate(async () => {
      const res = await fetch('/api/vehiculos');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!vehiculoId) { test.skip(); return; }

    // Intentar acceder directamente como visor
    await login(page, VISOR.email, VISOR.password);
    await page.goto(`/vehiculos/${vehiculoId}/editar`);

    // El server redirige a /vehiculos (rol !== admin → redirect)
    await expect(page).not.toHaveURL(/\/editar$/, { timeout: 8000 });
  });

  test('Visor: página de detalle NO muestra botones "Editar" ni "Eliminar"', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await page.evaluate(async () => {
      const res = await fetch('/api/vehiculos');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!vehiculoId) { test.skip(); return; }

    await login(page, VISOR.email, VISOR.password);
    await page.goto(`/vehiculos/${vehiculoId}`);

    await expect(page.locator('a:has-text("Editar")')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Eliminar")')).not.toBeVisible();
  });
});
