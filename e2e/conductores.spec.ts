import { test, expect, Page } from '@playwright/test';

/**
 * Tests E2E — CRUD de Conductores
 *
 * Cubre:
 *  - CREATE : Admin abre modal de 2 pasos y registra un conductor
 *  - READ   : Lista, búsqueda y detalle del conductor creado
 *  - UPDATE : Admin edita campos en /conductores/[id]/editar
 *  - DELETE : Admin elimina confirmando en el diálogo
 *  - API    : Validaciones de error (400, 403, 404, 409) vía fetch en contexto autenticado
 *  - RBAC   : Jefe y Visor no ven botón de registro ni pueden editar/eliminar
 *
 * Usuarios de prueba (seed: scripts/seed-test-users.sql):
 *  admin@selcosi.test           / Test1234!  — rol: admin
 *  jefe.juliaca@selcosi.test    / Test1234!  — rol: jefe_sucursal
 *  visor@selcosi.test           / Test1234!  — rol: visor
 */

// ── Credenciales ──────────────────────────────────────────────────────────────

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL      || 'admin@selcosi.test',
  password: process.env.TEST_ADMIN_PASSWORD  || 'Test1234!',
};
const JEFE = {
  email: process.env.TEST_JEFE_EMAIL       || 'jefe.juliaca@selcosi.test',
  password: process.env.TEST_JEFE_PASSWORD   || 'Test1234!',
};
const VISOR = {
  email: process.env.TEST_VISOR_EMAIL      || 'visor@selcosi.test',
  password: process.env.TEST_VISOR_PASSWORD  || 'Test1234!',
};

// DNI único por ejecución (8 dígitos) para evitar conflictos de unique-constraint
const RUN_ID = Date.now().toString().slice(-6);
const DNI    = `7${RUN_ID}0`; // 8 chars

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }).catch(() => {});
  await page.goto('/login');

  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15_000 });
}

/**
 * Abre el modal de 2 pasos y registra un conductor de prueba.
 * El admin debe estar ya logueado. Devuelve la URL del detalle.
 */
async function crearConductor(page: Page, dni = DNI): Promise<string> {
  await page.goto('/conductores');

  // Abrir modal
  await page.click('text=Registrar conductor');

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 8_000 });
  await expect(dialog.locator('text=Paso 1 de 2')).toBeVisible();

  // ── Paso 1: Datos Personales ──────────────────────────────────────────────

  // Sucursal (1er combobox del dialog — solo admin lo tiene)
  const comboboxes = dialog.locator('button[role="combobox"]');
  await comboboxes.nth(0).click();
  await page.locator('[role="option"]').first().click();

  await dialog.locator('input[name="dni"]').fill(dni);
  await dialog.locator('input[name="nombreCompleto"]').fill(`TEST CONDUCTOR ${RUN_ID}`);
  await dialog.locator('input[name="telefono"]').fill('999888777');
  await dialog.locator('input[name="email"]').fill(`test${RUN_ID}@selcosi.test`);

  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect(dialog.locator('text=Paso 2 de 2')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);

  // ── Paso 2: Licencia y Asignación ────────────────────────────────────────

  // Categoría de Licencia (1er combobox de este paso)
  await dialog.locator('button:has-text("Selecciona")').first().click();
  await page.locator('[role="option"]:has-text("A2b")').first().click();

  await dialog.locator('input[name="licenciaNumero"]').fill(`Q${RUN_ID}`);

  // Finalizar
  await dialog.getByRole('button', { name: /Finalizar Registro/i }).click();

  // Debe redirigir al detalle /conductores/<uuid>
  await expect(page).toHaveURL(/\/conductores\/[0-9a-f-]{36}/, { timeout: 15_000 });
  await expect(dialog).toBeHidden();

  return page.url();
}

// ── Suite CRUD (serial: comparten conductorUrl entre tests) ───────────────────

test.describe.serial('Conductores — CRUD completo (Admin)', () => {
  let conductorUrl = '';

  // ── CREATE ─────────────────────────────────────────────────────────────────

  test('CREATE — Admin registra conductor en modal de 2 pasos', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    conductorUrl = await crearConductor(page, DNI);

    // Confirmar que el nombre aparece en la página de detalle
    await expect(page.locator(`text=TEST CONDUCTOR ${RUN_ID}`).first()).toBeVisible({ timeout: 8_000 });
    expect(conductorUrl).toMatch(/\/conductores\/[0-9a-f-]{36}/);
  });

  // ── READ: detalle ──────────────────────────────────────────────────────────

  test('READ — Detalle muestra nombre, DNI y estado del conductor', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!conductorUrl) conductorUrl = await crearConductor(page, `${DNI}A`);

    await page.goto(conductorUrl);

    await expect(page.locator(`text=TEST CONDUCTOR ${RUN_ID}`).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(`text=${DNI}`).first()).toBeVisible();
    // El badge de estado "Activo" debe estar visible
    await expect(page.locator('text=Activo').first()).toBeVisible();
  });

  // ── READ: lista ────────────────────────────────────────────────────────────

  test('READ — Lista muestra el conductor recién creado', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!conductorUrl) conductorUrl = await crearConductor(page, `${DNI}A`);

    await page.goto('/conductores');

    await expect(page.locator(`text=TEST CONDUCTOR ${RUN_ID}`)).toBeVisible({ timeout: 10_000 });
  });

  // ── READ: búsqueda ─────────────────────────────────────────────────────────

  test('READ — Búsqueda por DNI filtra y muestra el conductor', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!conductorUrl) conductorUrl = await crearConductor(page, `${DNI}A`);

    await page.goto('/conductores');
    await page.fill('input[name="q"]', DNI);
    await page.click('button:has-text("Buscar")');

    await expect(page.locator(`text=TEST CONDUCTOR ${RUN_ID}`)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=No se encontraron conductores')).not.toBeVisible();
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  test('UPDATE — Admin edita el nombre y guarda los cambios', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!conductorUrl) conductorUrl = await crearConductor(page, `${DNI}A`);

    await page.goto(`${conductorUrl}/editar`);

    // Cambiar nombre
    const inputNombre = page.locator('input[name="nombreCompleto"]');
    await inputNombre.clear();
    await inputNombre.fill(`MODIFICADO TEST ${RUN_ID}`);

    // Guardar
    await page.getByRole('button', { name: /Guardar cambios/i }).click();

    // Redirige al detalle con el cambio aplicado
    await expect(page).toHaveURL(conductorUrl, { timeout: 15_000 });
    await expect(page.locator(`text=MODIFICADO TEST ${RUN_ID}`).first()).toBeVisible({ timeout: 8_000 });
  });

  // ── UPDATE: toggle estado ──────────────────────────────────────────────────

  test('UPDATE — Admin cambia estado del conductor (switch Activo/Inactivo)', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (!conductorUrl) conductorUrl = await crearConductor(page, `${DNI}A`);

    // Leer el estado actual desde el detalle antes de editar
    await page.goto(conductorUrl);
    const badgeEstado = page.locator('[data-slot="badge"]').filter({ hasText: /^(Activo|Inactivo)$/ }).first();
    await expect(badgeEstado).toBeVisible({ timeout: 8_000 });
    const textoAntes = (await badgeEstado.textContent())?.trim() ?? 'Activo';

    // Ir al formulario de edición y hacer click en el switch
    await page.goto(`${conductorUrl}/editar`);
    const switchEl = page.locator('[data-slot="switch"]');
    await expect(switchEl).toBeVisible({ timeout: 8_000 });
    await switchEl.click();

    // Guardar y esperar redirección al detalle
    await page.getByRole('button', { name: /Guardar cambios/i }).click();
    await expect(page).toHaveURL(conductorUrl, { timeout: 15_000 });

    // El badge debe mostrar el estado contrario al que había antes
    const textoEsperado = textoAntes === 'Activo' ? 'Inactivo' : 'Activo';
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: textoEsperado }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  test('DELETE — Admin elimina conductor confirmando en el diálogo', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    // Crear un conductor exclusivo para borrar con DNI distinto
    const urlBorrar = await crearConductor(page, `${DNI.slice(0, 7)}9`);

    await page.goto(urlBorrar);

    // Clic en botón "Eliminar"
    await page.getByRole('button', { name: 'Eliminar' }).first().click();

    // Confirmar en el diálogo de confirmación
    const confirmDialog = page.locator('[role="dialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    await confirmDialog.getByRole('button', { name: /Sí, eliminar/i }).click();

    // Redirige a /conductores
    await expect(page).toHaveURL(/\/conductores$/, { timeout: 15_000 });

    // La URL del detalle ya da 404
    const res = await page.goto(urlBorrar);
    expect(res?.status()).toBe(404);

    conductorUrl = ''; // Resetear para evitar que tests siguientes usen una URL eliminada
  });
});

// ── Validaciones de API ───────────────────────────────────────────────────────

test.describe('Conductores — Validación API', () => {

  test('POST /api/conductores sin campos requeridos → 400', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    const r = await page.evaluate(async () => {
      const res = await fetch('/api/conductores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(r.status).toBe(400);
    expect(r.body).toHaveProperty('error');
  });

  test('POST /api/conductores con DNI duplicado → 409', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    // Obtener el DNI de un conductor existente
    const existing = await page.evaluate(async () => {
      const res = await fetch('/api/conductores');
      const list = await res.json() as Array<{ id: string; dni: string; sucursal: { id: string } | null }>;
      return list.find(c => c.sucursal) ?? list[0] ?? null;
    });

    if (!existing) { test.skip(); return; }

    const r = await page.evaluate(async (data) => {
      const res = await fetch('/api/conductores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return { status: res.status, body: await res.json() };
    }, {
      dni: existing.dni,
      nombreCompleto: 'Duplicado Test',
      licenciaCategoria: 'B',
      sucursalId: existing.sucursal?.id ?? null,
    });

    expect(r.status).toBe(409);
    expect((r.body as { error: string }).error).toMatch(/DNI/i);
  });

  test('DELETE /api/conductores/:id con ID inexistente → 404', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    const r = await page.evaluate(async () => {
      // UUID con formato válido pero inexistente
      const res = await fetch('/api/conductores/00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
      return { status: res.status };
    });

    expect(r.status).toBe(404);
  });

  test('POST /api/conductores como Visor → 403', async ({ page }) => {
    await login(page, VISOR.email, VISOR.password);

    const r = await page.evaluate(async () => {
      const res = await fetch('/api/conductores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: '99999999',
          nombreCompleto: 'Intento No Autorizado',
          licenciaCategoria: 'B',
        }),
      });
      return { status: res.status };
    });

    expect(r.status).toBe(403);
  });

  test('PUT /api/conductores/:id como Visor → 403', async ({ page }) => {
    // Obtener un ID real con admin
    await login(page, ADMIN.email, ADMIN.password);
    const conductorId = await page.evaluate(async () => {
      const res = await fetch('/api/conductores');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!conductorId) { test.skip(); return; }

    // Intentar editar como Visor
    await login(page, VISOR.email, VISOR.password);
    const r = await page.evaluate(async (id) => {
      const res = await fetch(`/api/conductores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: '000000000' }),
      });
      return { status: res.status };
    }, conductorId);

    expect(r.status).toBe(403);
  });

  test('DELETE /api/conductores/:id como Jefe de sucursal → 403', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const conductorId = await page.evaluate(async () => {
      const res = await fetch('/api/conductores');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!conductorId) { test.skip(); return; }

    await login(page, JEFE.email, JEFE.password);
    const r = await page.evaluate(async (id) => {
      const res = await fetch(`/api/conductores/${id}`, { method: 'DELETE' });
      return { status: res.status };
    }, conductorId);

    expect(r.status).toBe(403);
  });

  test('GET /api/conductores/:id con ID de formato inválido → 404', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    const r = await page.evaluate(async () => {
      const res = await fetch('/api/conductores/id-no-es-uuid');
      return { status: res.status };
    });

    expect(r.status).toBe(404);
  });
});

// ── RBAC — Controles de interfaz por rol ─────────────────────────────────────

test.describe('Conductores — RBAC (Interfaz)', () => {

  test('Visor: ve la lista pero NO tiene botón "Registrar conductor"', async ({ page }) => {
    await login(page, VISOR.email, VISOR.password);
    await page.goto('/conductores');

    await expect(page.locator('h1:has-text("Conductores")')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=Registrar conductor')).not.toBeVisible();
  });

  test('Jefe de sucursal: ve la lista pero NO tiene botón "Registrar conductor"', async ({ page }) => {
    await login(page, JEFE.email, JEFE.password);
    await page.goto('/conductores');

    await expect(page.locator('h1:has-text("Conductores")')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=Registrar conductor')).not.toBeVisible();
  });

  test('Admin: ve el filtro de sucursal; Jefe y Visor NO lo ven', async ({ page }) => {
    // Admin sí debe ver el select de sucursales
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/conductores');
    await expect(page.locator('select[name="sucursalId"]')).toBeVisible({ timeout: 8_000 });

    // Jefe NO lo ve
    await login(page, JEFE.email, JEFE.password);
    await page.goto('/conductores');
    await expect(page.locator('select[name="sucursalId"]')).not.toBeVisible();

    // Visor NO lo ve
    await login(page, VISOR.email, VISOR.password);
    await page.goto('/conductores');
    await expect(page.locator('select[name="sucursalId"]')).not.toBeVisible();
  });

  test('Visor: página de detalle NO muestra botones "Editar" ni "Eliminar"', async ({ page }) => {
    // Obtener un ID real con admin
    await login(page, ADMIN.email, ADMIN.password);
    const conductorId = await page.evaluate(async () => {
      const res = await fetch('/api/conductores');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!conductorId) { test.skip(); return; }

    await login(page, VISOR.email, VISOR.password);
    await page.goto(`/conductores/${conductorId}`);

    await expect(page.locator('a:has-text("Editar")')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('button:has-text("Eliminar")')).not.toBeVisible();
  });

  test('Jefe de sucursal: página de detalle NO muestra botones "Editar" ni "Eliminar"', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const conductorId = await page.evaluate(async () => {
      const res = await fetch('/api/conductores');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!conductorId) { test.skip(); return; }

    await login(page, JEFE.email, JEFE.password);
    await page.goto(`/conductores/${conductorId}`);

    await expect(page.locator('a:has-text("Editar")')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('button:has-text("Eliminar")')).not.toBeVisible();
  });

  test('Visor: acceso directo a /editar redirige fuera de esa ruta', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const conductorId = await page.evaluate(async () => {
      const res = await fetch('/api/conductores');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!conductorId) { test.skip(); return; }

    await login(page, VISOR.email, VISOR.password);
    await page.goto(`/conductores/${conductorId}/editar`);

    // El servidor redirige porque el rol no es admin
    await expect(page).not.toHaveURL(/\/editar$/, { timeout: 8_000 });
  });

  test('Jefe: acceso directo a /editar redirige fuera de esa ruta', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const conductorId = await page.evaluate(async () => {
      const res = await fetch('/api/conductores');
      const list = await res.json() as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });

    if (!conductorId) { test.skip(); return; }

    await login(page, JEFE.email, JEFE.password);
    await page.goto(`/conductores/${conductorId}/editar`);

    await expect(page).not.toHaveURL(/\/editar$/, { timeout: 8_000 });
  });
});
