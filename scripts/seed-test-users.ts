/**
 * Crea los usuarios de prueba para los tests E2E.
 * Ejecutar UNA SOLA VEZ: npx tsx scripts/seed-test-users.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Sucursal Juliaca para el jefe de sucursal
const SUCURSAL_JULIACA_ID = "7a526585-31b1-4d64-950c-7382e6b328ea";

const USUARIOS = [
  {
    email: "admin@selcosi.test",
    password: "Test1234!",
    rol: "admin",
    nombre: "Admin Test",
    sucursalId: null as string | null,
  },
  {
    email: "jefe.juliaca@selcosi.test",
    password: "Test1234!",
    rol: "jefe_sucursal",
    nombre: "Jefe Juliaca Test",
    sucursalId: SUCURSAL_JULIACA_ID,
  },
  {
    email: "visor@selcosi.test",
    password: "Test1234!",
    rol: "visor",
    nombre: "Visor Test",
    sucursalId: null as string | null,
  },
];

async function seed() {
  console.log("Creando usuarios de prueba...\n");

  for (const u of USUARIOS) {
    // 1. Crear en auth
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        console.log(`⚠  ${u.email} ya existe, saltando.`);
        continue;
      }
      console.error(`✗  Error creando ${u.email}:`, error.message);
      continue;
    }

    const userId = data.user!.id;

    // 2. Insertar profile
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        nombre_completo: u.nombre,
        email: u.email,
        rol: u.rol,
        sucursal_id: u.sucursalId,
        activo: true,
      });

    if (profileError) {
      console.error(`✗  Error creando perfil de ${u.email}:`, profileError.message);
    } else {
      console.log(`✓  ${u.email} creado (rol: ${u.rol})`);
    }
  }

  console.log("\nListo. Ahora podés ejecutar: npx playwright test");
}

seed().catch(console.error);
