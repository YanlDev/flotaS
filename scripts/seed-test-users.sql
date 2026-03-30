-- =============================================================
-- SELCOSIFLOTA — Seed de usuarios de prueba
-- =============================================================
-- Ejecutar en: Supabase SQL Editor del proyecto selcosiflota2
-- NOTA: Ya ejecutado el 2026-03-30. Re-ejecutar solo si se
--       reinicia la BD o se necesita recrear los usuarios.
--
-- Credenciales creadas:
--   admin@selcosi.test          / Test1234!  → admin (sin sucursal)
--   jefe.juliaca@selcosi.test   / Test1234!  → jefe_sucursal (Juliaca)
--   visor@selcosi.test          / Test1234!  → visor (Lima)
-- =============================================================

DO $$
DECLARE
  admin_id UUID := 'a1000000-0000-0000-0000-000000000001';
  jefe_id  UUID := 'a2000000-0000-0000-0000-000000000002';
  visor_id UUID := 'a3000000-0000-0000-0000-000000000003';

  -- IDs de sucursales (ya existentes en la BD)
  juliaca_id UUID := '7a526585-31b1-4d64-950c-7382e6b328ea';
  lima_id    UUID := '26a37dc1-3194-498e-a87e-839d8e75003c';
BEGIN

  -- ==========================
  -- AUTH USERS
  -- ==========================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  ) VALUES
    (admin_id, '00000000-0000-0000-0000-000000000000',
     'admin@selcosi.test', crypt('Test1234!', gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     false, 'authenticated', 'authenticated'),

    (jefe_id,  '00000000-0000-0000-0000-000000000000',
     'jefe.juliaca@selcosi.test', crypt('Test1234!', gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     false, 'authenticated', 'authenticated'),

    (visor_id, '00000000-0000-0000-0000-000000000000',
     'visor@selcosi.test', crypt('Test1234!', gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     false, 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- ==========================
  -- AUTH IDENTITIES
  -- ==========================
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  VALUES
    (admin_id, admin_id, 'admin@selcosi.test', 'email',
     jsonb_build_object('sub', admin_id::text, 'email', 'admin@selcosi.test'),
     now(), now(), now()),

    (jefe_id, jefe_id, 'jefe.juliaca@selcosi.test', 'email',
     jsonb_build_object('sub', jefe_id::text, 'email', 'jefe.juliaca@selcosi.test'),
     now(), now(), now()),

    (visor_id, visor_id, 'visor@selcosi.test', 'email',
     jsonb_build_object('sub', visor_id::text, 'email', 'visor@selcosi.test'),
     now(), now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- ==========================
  -- PROFILES
  -- ==========================
  INSERT INTO profiles (id, nombre_completo, email, rol, sucursal_id, activo, created_at, updated_at)
  VALUES
    (admin_id, 'Admin Prueba',         'admin@selcosi.test',        'admin',         NULL,       true, now(), now()),
    (jefe_id,  'Jefe Juliaca Prueba',  'jefe.juliaca@selcosi.test', 'jefe_sucursal', juliaca_id, true, now(), now()),
    (visor_id, 'Visor Prueba',         'visor@selcosi.test',        'visor',         lima_id,    true, now(), now())
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Usuarios de prueba creados correctamente.';
END $$;
