import { test, expect, Page } from '@playwright/test';

/**
 * Tests E2E — Módulo de Combustible
 *
 * Cubre:
 *  - CRUD  : Admin registra carga pendiente → revisa → elimina
 *  - API   : Validaciones de error (400, 403, 409) vía fetch en contexto autenticado
 *  - RBAC  : Jefe puede crear pero no revisar/eliminar; Visor solo lectura
 *
 * Usuarios de prueba (seed con scripts/seed-test-users.sql):
 *  admin@selcosi.test           / Test1234!  — rol: admin
 *  jefe.juliaca@selcosi.test    / Test1234!  — rol: jefe_sucursal
 *  visor@selcosi.test           / Test1234!  — rol: visor
 */

// ── Credenciales ──────────────────────────────────────────────────────────────

const ADMIN = {
  email:    process.env.TEST_ADMIN_EMAIL    || 'admin@selcosi.test',
  password: process.env.TEST_ADMIN_PASSWORD || 'Test1234!',
};
const JEFE = {
  email:    process.env.TEST_JEFE_EMAIL    || 'jefe.juliaca@selcosi.test',
  password: process.env.TEST_JEFE_PASSWORD || 'Test1234!',
};
const VISOR = {
  email:    process.env.TEST_VISOR_EMAIL    || 'visor@selcosi.test',
  password: process.env.TEST_VISOR_PASSWORD || 'Test1234!',
};

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
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
}

/** Devuelve el ID del primer vehículo disponible */
async function getVehiculoId(page: Page): Promise<string> {
  const id = await page.evaluate(async () => {
    const res = await fetch('/api/vehiculos');
    const lista = await res.json() as Array<{ id: string }>;
    return lista[0]?.id ?? null;
  });
  expect(id).toBeTruthy();
  return id as string;
}

/**
 * Crea una carga pendiente vía API y devuelve su ID.
 * Usa un PNG mínimo (1×1 px) codificado en base64 para simular las fotos.
 */
async function crearCargaPendiente(page: Page, vehiculoId: string): Promise<string> {
  // PNG 1×1 px transparente — mínimo válido para pasar validación de mime/size
  const MIN_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
    '+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const result = await page.evaluate(
    async ({ vehiculoId, pngB64 }: { vehiculoId: string; pngB64: string }) => {
      function b64ToBlob(b64: string, type: string): Blob {
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        return new Blob([arr], { type });
      }
      const blob = b64ToBlob(pngB64, 'image/png');
      const form = new FormData();
      form.append('fecha', new Date().toISOString().split('T')[0]);
      form.append('odometroFoto', blob, 'odometro.png');
      form.append('comprobante',  blob, 'factura.png');

      const res  = await fetch(`/api/vehiculos/${vehiculoId}/combustible`, { method: 'POST', body: form });
      const json = await res.json() as { id?: string };
      return { status: res.status, id: json.id ?? '' };
    },
    { vehiculoId, pngB64: MIN_PNG_B64 }
  );

  expect(result.status).toBe(201);
  return result.id;
}

/** Devuelve un valor de odómetro mayor al máximo ya registrado para el vehículo */
async function getNextKm(page: Page, vehiculoId: string): Promise<number> {
  const km = await page.evaluate(async (vehiculoId: string) => {
    const res    = await fetch(`/api/vehiculos/${vehiculoId}/combustible`);
    const cargas = await res.json() as Array<{ odometroKm: number | null }>;
    return cargas.reduce((max, c) => Math.max(max, c.odometroKm ?? 0), 0) + 1000;
  }, vehiculoId);
  return km;
}

// ── Flujo completo (serial: los tests comparten vehiculoId / cargaId) ─────────

test.describe.serial('Combustible — flujo completo (Admin)', () => {
  let vehiculoId = '';
  let cargaId    = '';

  test('setup: obtener vehículo de prueba', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    vehiculoId = await getVehiculoId(page);
  });

  test('CREATE — registra carga pendiente con fotos', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    cargaId = await crearCargaPendiente(page, vehiculoId);
    expect(cargaId).toBeTruthy();

    // La carga debe aparecer en el historial como "pendiente"
    const estado = await page.evaluate(
      async ({ vehiculoId, cargaId }: { vehiculoId: string; cargaId: string }) => {
        const res   = await fetch(`/api/vehiculos/${vehiculoId}/combustible`);
        const lista = await res.json() as Array<{ id: string; estado: string }>;
        return lista.find((c) => c.id === cargaId)?.estado ?? null;
      },
      { vehiculoId, cargaId }
    );
    expect(estado).toBe('pendiente');
  });

  test('REVISAR — admin completa revisión con datos de odómetro', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const km = await getNextKm(page, vehiculoId);

    const r = await page.evaluate(
      async ({ cargaId, km }: { cargaId: string; km: number }) => {
        const res = await fetch(`/api/combustible/${cargaId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            odometroKm:    km,
            galones:       12.5,
            precioPorGalon: 15.5,
            tipoCombustible: 'diesel',
            notas:         'Test automático E2E',
          }),
        });
        return { status: res.status };
      },
      { cargaId, km }
    );
    expect(r.status).toBe(200);

    // Verificar que quedó revisada con los datos correctos
    const carga = await page.evaluate(
      async ({ vehiculoId, cargaId }: { vehiculoId: string; cargaId: string }) => {
        const res   = await fetch(`/api/vehiculos/${vehiculoId}/combustible`);
        const lista = await res.json() as Array<{
          id: string; estado: string; galones: number; totalSoles: number;
        }>;
        return lista.find((c) => c.id === cargaId) ?? null;
      },
      { vehiculoId, cargaId }
    );
    expect(carga?.estado).toBe('revisado');
    expect(carga?.galones).toBe(12.5);
    expect(carga?.totalSoles).toBeCloseTo(12.5 * 15.5, 1);
  });

  test('DELETE — admin elimina la carga', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const r = await page.evaluate(async (cargaId: string) => {
      const res = await fetch(`/api/combustible/${cargaId}`, { method: 'DELETE' });
      return { status: res.status };
    }, cargaId);
    expect(r.status).toBe(200);

    // Ya no debe aparecer en el historial
    const existe = await page.evaluate(
      async ({ vehiculoId, cargaId }: { vehiculoId: string; cargaId: string }) => {
        const res   = await fetch(`/api/vehiculos/${vehiculoId}/combustible`);
        const lista = await res.json() as Array<{ id: string }>;
        return lista.some((c) => c.id === cargaId);
      },
      { vehiculoId, cargaId }
    );
    expect(existe).toBe(false);
  });
});

// ── Validación API ─────────────────────────────────────────────────────────────

test.describe('Combustible — Validación API', () => {

  test('PATCH → 409 si la carga ya está revisada', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await getVehiculoId(page);
    const km         = await getNextKm(page, vehiculoId);
    const cargaId    = await crearCargaPendiente(page, vehiculoId);

    const datos = { odometroKm: km, galones: 10, precioPorGalon: 14, tipoCombustible: 'gasolina' };

    // Primer PATCH — debe pasar
    const r1 = await page.evaluate(
      async ({ cargaId, datos }: { cargaId: string; datos: object }) => {
        const res = await fetch(`/api/combustible/${cargaId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
        });
        return { status: res.status };
      },
      { cargaId, datos }
    );
    expect(r1.status).toBe(200);

    // Segundo PATCH sobre carga ya revisada → 409
    const r2 = await page.evaluate(
      async ({ cargaId, datos }: { cargaId: string; datos: object }) => {
        const res = await fetch(`/api/combustible/${cargaId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
        });
        return { status: res.status };
      },
      { cargaId, datos }
    );
    expect(r2.status).toBe(409);

    // Limpieza
    await page.evaluate(async (cargaId: string) => {
      await fetch(`/api/combustible/${cargaId}`, { method: 'DELETE' });
    }, cargaId);
  });

  test('PATCH → 400 si faltan galones', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await getVehiculoId(page);
    const km         = await getNextKm(page, vehiculoId);
    const cargaId    = await crearCargaPendiente(page, vehiculoId);

    const r = await page.evaluate(
      async ({ cargaId, km }: { cargaId: string; km: number }) => {
        const res = await fetch(`/api/combustible/${cargaId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ odometroKm: km, precioPorGalon: 14, tipoCombustible: 'diesel' }),
          // falta galones
        });
        return { status: res.status };
      },
      { cargaId, km }
    );
    expect(r.status).toBe(400);

    // Limpieza
    await page.evaluate(async (cargaId: string) => {
      await fetch(`/api/combustible/${cargaId}`, { method: 'DELETE' });
    }, cargaId);
  });

  test('POST como visor → 403', async ({ page }) => {
    await login(page, VISOR.email, VISOR.password);
    const vehiculoId = await getVehiculoId(page);

    const MIN_PNG_B64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
      '+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const r = await page.evaluate(
      async ({ vehiculoId, pngB64 }: { vehiculoId: string; pngB64: string }) => {
        function b64ToBlob(b64: string, type: string): Blob {
          const bytes = atob(b64);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          return new Blob([arr], { type });
        }
        const blob = b64ToBlob(pngB64, 'image/png');
        const form = new FormData();
        form.append('fecha', new Date().toISOString().split('T')[0]);
        form.append('odometroFoto', blob, 'odometro.png');
        form.append('comprobante',  blob, 'factura.png');
        const res = await fetch(`/api/vehiculos/${vehiculoId}/combustible`, { method: 'POST', body: form });
        return { status: res.status };
      },
      { vehiculoId, pngB64: MIN_PNG_B64 }
    );
    expect(r.status).toBe(403);
  });

  test('PATCH como jefe_sucursal → 403', async ({ page }) => {
    // Crear carga como admin
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await getVehiculoId(page);
    const cargaId    = await crearCargaPendiente(page, vehiculoId);
    const km         = await getNextKm(page, vehiculoId);

    // Intentar revisar como jefe
    await login(page, JEFE.email, JEFE.password);
    const r = await page.evaluate(
      async ({ cargaId, km }: { cargaId: string; km: number }) => {
        const res = await fetch(`/api/combustible/${cargaId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ odometroKm: km, galones: 10, precioPorGalon: 15, tipoCombustible: 'diesel' }),
        });
        return { status: res.status };
      },
      { cargaId, km }
    );
    expect(r.status).toBe(403);

    // Limpieza como admin
    await login(page, ADMIN.email, ADMIN.password);
    await page.evaluate(async (cargaId: string) => {
      await fetch(`/api/combustible/${cargaId}`, { method: 'DELETE' });
    }, cargaId);
  });

  test('DELETE como jefe_sucursal → 403', async ({ page }) => {
    // Crear carga como admin
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await getVehiculoId(page);
    const cargaId    = await crearCargaPendiente(page, vehiculoId);

    // Intentar eliminar como jefe
    await login(page, JEFE.email, JEFE.password);
    const r = await page.evaluate(async (cargaId: string) => {
      const res = await fetch(`/api/combustible/${cargaId}`, { method: 'DELETE' });
      return { status: res.status };
    }, cargaId);
    expect(r.status).toBe(403);

    // Limpieza como admin
    await login(page, ADMIN.email, ADMIN.password);
    await page.evaluate(async (cargaId: string) => {
      await fetch(`/api/combustible/${cargaId}`, { method: 'DELETE' });
    }, cargaId);
  });
});

// ── RBAC — Controles de interfaz por rol ──────────────────────────────────────

test.describe('Combustible — RBAC (Interfaz)', () => {

  test('Visor: no ve botón "Nueva carga" ni "Revisar"', async ({ page }) => {
    await login(page, VISOR.email, VISOR.password);

    // Obtener un vehículo para navegar a su página de combustible
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await getVehiculoId(page);

    await login(page, VISOR.email, VISOR.password);
    await page.goto(`/vehiculos/${vehiculoId}/combustible`);

    await expect(page.getByRole('button', { name: 'Nueva carga' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar' })).not.toBeVisible();
  });

  test('Jefe: ve "Nueva carga" pero no "Revisar"', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await getVehiculoId(page);

    await login(page, JEFE.email, JEFE.password);
    await page.goto(`/vehiculos/${vehiculoId}/combustible`);

    await expect(page.getByRole('button', { name: 'Nueva carga' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar' })).not.toBeVisible();
  });

  test('Admin: ve "Nueva carga" y "Revisar" cuando hay cargas pendientes', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await getVehiculoId(page);
    const cargaId    = await crearCargaPendiente(page, vehiculoId);

    await page.goto(`/vehiculos/${vehiculoId}/combustible`);

    await expect(page.getByRole('button', { name: 'Nueva carga' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar' }).first()).toBeVisible();

    // Limpieza
    await page.evaluate(async (cargaId: string) => {
      await fetch(`/api/combustible/${cargaId}`, { method: 'DELETE' });
    }, cargaId);
  });

  test('Admin: puede completar revisión desde la UI', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    const vehiculoId = await getVehiculoId(page);
    const cargaId    = await crearCargaPendiente(page, vehiculoId);
    const km         = await getNextKm(page, vehiculoId);

    await page.goto(`/vehiculos/${vehiculoId}/combustible`);
    await page.getByRole('button', { name: 'Revisar' }).first().click();

    // Llenar formulario de revisión
    await page.getByPlaceholder('Ej: 85400').fill(String(km));
    await page.getByPlaceholder('Ej: 12.500').fill('12.5');
    await page.getByPlaceholder('Ej: 15.50').fill('15.5');

    await expect(page.getByText('Total calculado')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar revisión' }).click();

    // El km debe aparecer en la tabla del historial
    await expect(
      page.getByRole('cell', { name: new RegExp(km.toLocaleString('es-PE') + '\\s*km') })
    ).toBeVisible({ timeout: 10_000 });

    // Limpieza
    await page.evaluate(async (cargaId: string) => {
      await fetch(`/api/combustible/${cargaId}`, { method: 'DELETE' });
    }, cargaId);
  });
});
