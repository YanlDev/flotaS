# SELCOSIFLOTA — Arquitectura y Contexto del Sistema

> Documento de referencia para agentes IA y colaboradores. Última actualización: 2026-03-29.

---

## 1. Contexto de negocio

**Empresa:** SELCOSI EXPORT S.A.C. — empresa peruana con operaciones en 6 sucursales:
Juliaca, Lima, Trujillo, Pucallpa, Puno, Cusco.

**Problema que resuelve:** Gestión centralizada de la flota vehicular dispersa entre sucursales.
Cada sucursal tiene un jefe responsable de registrar y mantener actualizados los datos
de sus vehículos. La gerencia (admin) tiene visibilidad total desde cualquier sucursal.

**Contexto legal peruano:** Los vehículos tienen datos de la Tarjeta de Propiedad SUNARP
(número de motor, número de chasis, VIN/serie, propietario registrado).

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.1 |
| Lenguaje | TypeScript | 5.x |
| UI | shadcn/ui + Tailwind CSS | tema emerald |
| Íconos | lucide-react | 1.7.x |
| ORM | Prisma 7 | 7.6.0 |
| Base de datos | Supabase (PostgreSQL) | — |
| Autenticación | Supabase Auth (SSR) | 0.9.x |
| Storage | Wasabi (S3-compatible) | AWS SDK v3 |
| Runtime | React 19 | 19.2.4 |

### Notas de versiones críticas

- **Prisma 7**: usa `generator client { provider = "prisma-client" }` (no `prisma-client-js`).
  El output está en `src/generated/prisma`. La URL de BD va en `prisma.config.ts`, no en el schema.
  El `PrismaClient` requiere un driver adapter obligatorio (`PrismaPg`).

- **Next.js 16**: el archivo de middleware se llama `src/proxy.ts` (no `middleware.ts`)
  y la función se llama `proxy` (no `middleware`).

- **shadcn/ui**: Los componentes Dialog, Sheet y otros usan `@base-ui/react` internamente.
  `asChild` **no funciona** en `DialogTrigger` ni `SheetTrigger` en esta versión.
  Solución: usar `onClick={() => setOpen(true)}` en un Button externo y controlar el estado manualmente.

---

## 3. Reglas del proyecto (CLAUDE.md)

1. **Prohibido usar `any`** en TypeScript. Usar tipos explícitos, `unknown` con narrowing, o generics.
2. **No usar Server Actions** para lógica de negocio. Toda mutación de datos va en API Routes (`src/app/api/`).
3. **Server Components para fetching inicial** de páginas. Los datos iniciales se pasan como props a Client Components.
4. Los Client Components (`"use client"`) solo se usan para interactividad y estado local.

---

## 4. Estructura de directorios

```
selcosiflota/
├── prisma/
│   └── schema.prisma           # Esquema de BD (sin URL — va en prisma.config.ts)
├── prisma.config.ts             # Config Prisma 7 con DATABASE_URL
├── src/
│   ├── proxy.ts                 # Protección de rutas (equivale a middleware.ts en Next.js <16)
│   ├── generated/
│   │   └── prisma/              # Tipos auto-generados por Prisma (no editar manualmente)
│   ├── lib/
│   │   ├── prisma.ts            # Singleton PrismaClient con adapter PrismaPg
│   │   ├── get-profile.ts       # cache() helper — obtiene profile del usuario autenticado
│   │   ├── wasabi.ts            # Cliente S3 para Wasabi (upload, download, delete)
│   │   ├── utils.ts             # cn() helper para Tailwind
│   │   └── supabase/
│   │       ├── server.ts        # createClient() para Server Components/API Routes
│   │       ├── client.ts        # createClient() para Browser/Client Components
│   │       └── admin.ts         # supabaseAdmin — service role, bypasa RLS (solo server-side)
│   ├── components/
│   │   ├── sidebar.tsx          # Navegación principal (desktop + mobile)
│   │   └── ui/                  # Componentes shadcn/ui (no editar manualmente)
│   └── app/
│       ├── layout.tsx           # Root layout (html, fonts, metadata)
│       ├── page.tsx             # Redirige a /dashboard
│       ├── globals.css          # Estilos globales + tema Tailwind
│       ├── login/               # Página pública de login
│       ├── registro/            # Página pública de registro (por invitación o primer admin)
│       ├── api/                 # API Routes (toda la lógica backend)
│       │   ├── auth/
│       │   │   ├── login/       # POST — autenticación con email/password
│       │   │   ├── logout/      # POST — cierre de sesión
│       │   │   ├── registro/    # POST — crear cuenta; GET check/ — verificar primer admin
│       │   │   └── invitacion/[token]/ # GET — validar token de invitación
│       │   ├── vehiculos/       # GET list / POST create; [id]: GET / PUT / DELETE
│       │   └── admin/
│       │       └── invitaciones/ # GET list / POST create (solo admin)
│       └── (app)/               # Grupo de rutas protegidas (requiere sesión)
│           ├── layout.tsx       # Guard de autenticación + Sidebar
│           ├── dashboard/       # KPIs globales o por sucursal
│           ├── vehiculos/       # Lista, detalle, nuevo, editar
│           └── admin/
│               └── invitaciones/ # Panel de gestión de invitaciones
```

---

## 5. Base de datos — Modelos Prisma

### Enums

| Enum | Valores |
|---|---|
| `RolUsuario` | `admin`, `jefe_sucursal`, `visor` |
| `EstadoVehiculo` | `operativo`, `parcialmente`, `fuera_de_servicio` |
| `TipoVehiculo` | `moto`, `auto`, `camioneta`, `minivan`, `furgon`, `bus`, `vehiculo_pesado` |
| `TransmisionTipo` | `manual`, `automatico` |
| `TraccionTipo` | `4x2`, `4x4` |
| `CombustibleTipo` | `gasolina`, `diesel`, `glp`, `gnv`, `electrico`, `hibrido` |

### Tabla `sucursales`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | gen_random_uuid() |
| `nombre` | String | Ej: "Juliaca" |
| `ciudad` | String | |
| `region` | String? | |
| `activa` | Boolean | default true |

### Tabla `profiles`

Sincronizada con Supabase Auth. El `id` es el UUID del usuario en `auth.users`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | = auth.users.id |
| `nombreCompleto` | String | |
| `email` | String | |
| `rol` | RolUsuario | default jefe_sucursal |
| `sucursalId` | UUID? FK | null para admin |
| `activo` | Boolean | default true |

### Tabla `invitaciones`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `token` | UUID UNIQUE | se envía en el link |
| `email` | String | email destino |
| `rol` | RolUsuario | rol que tendrá el invitado |
| `sucursalId` | UUID? FK | requerido si rol = jefe_sucursal |
| `usado` | Boolean | default false |
| `expiraEn` | Timestamptz | 7 días desde creación |

### Tabla `vehiculos`

Campos agrupados por sección:

**Identidad:** `placa` (unique), `sucursalId` (FK), `tipo`, `marca`, `modelo`, `anio`, `color`

**Tarjeta de Propiedad SUNARP:** `motor`, `numeroMotor`, `numeroChasis`, `numeroSerie`, `propietario`

**Técnico:** `transmision`, `traccion`, `combustible`, `numAsientos`, `capacidadCargaKg`

**Operación:** `kmActuales`, `zonaOperacion`, `fechaAdquisicion`, `gps`

**Conductor asignado** (temporal): `conductorNombre`, `conductorTel`

**Estado:** `estado` (EstadoVehiculo), `problemaActivo` (texto libre), `observaciones`

---

## 6. Autenticación y control de acceso

### Flujo de autenticación

```
Usuario → POST /api/auth/login
         → Supabase Auth verifica credenciales
         → Supabase setea cookie de sesión (httpOnly)
         → Client redirige a /dashboard
```

### Flujo de registro por invitación

```
Admin → POST /api/admin/invitaciones (crea token UUID, 7 días)
      → Copia link: /registro?token=<uuid>
Invitado → GET /api/auth/invitacion/[token] (valida token, devuelve email+rol)
         → Formulario pre-llenado con email
         → POST /api/auth/registro
           → supabaseAdmin.auth.admin.createUser() (sin email confirm)
           → prisma.profile.create()
           → invitacion.usado = true
```

### Excepción primer admin

Si `profiles` está vacío, el endpoint `/api/auth/registro/check` devuelve `{ esPrimerAdmin: true }`.
En ese caso se permite registro sin token para crear el primer admin del sistema.

### Protección de rutas (proxy.ts)

El proxy intercepta todas las rutas. Rutas públicas que no requieren sesión:
- `/login`, `/registro`, `/auth/**`, `/api/auth/**`

Todo lo demás redirige a `/login` si no hay sesión válida.

### Roles y permisos

| Acción | admin | jefe_sucursal | visor |
|---|:---:|:---:|:---:|
| Ver todos los vehículos | ✓ | Solo su sucursal | ✓ (todos) |
| Crear vehículos | ✓ | Solo su sucursal | ✗ |
| Editar vehículos | ✓ | Solo su sucursal | ✗ |
| Eliminar vehículos | ✓ | ✗ | ✗ |
| Gestionar invitaciones | ✓ | ✗ | ✗ |
| Ver dashboard global | ✓ | Solo su sucursal | ✓ |

---

## 7. Módulos actuales

### 7.1 Autenticación (`/login`, `/registro`)

Login con email/password. Registro por invitación con token UUID en URL.
El formulario de registro valida el token antes de mostrar el formulario completo.

### 7.2 Dashboard (`/dashboard`)

- Cards KPI: Total unidades, Operativas, Parciales, Fuera de servicio
- Tabla de sucursales con conteo de vehículos (visible solo para admin)
- Filtro automático por sucursal para jefe_sucursal

### 7.3 Vehículos (`/vehiculos`)

**Lista** con filtros:
- Búsqueda por placa, marca, conductor
- Filtro por sucursal (solo admin)
- Filtro por estado

**Nuevo vehículo** (`/vehiculos/nuevo`):
- Formulario completo con todas las secciones (básicos, SUNARP, técnico, operación, conductor)
- Client Component que hace POST a `/api/vehiculos`
- Visor no tiene acceso (redirige a lista)

**Detalle vehículo** (`/vehiculos/[id]`):
- Vista readonly con todas las secciones
- Jefe solo accede a vehículos de su sucursal
- Botón "Editar" visible para admin y jefe_sucursal (si es su sucursal)
- Botón "Eliminar" visible solo para admin (diálogo de confirmación)

**Editar vehículo** (`/vehiculos/[id]/editar`):
- Server Component carga el vehículo, verifica permisos (visor → redirect, jefe fuera de su sucursal → redirect)
- Serializa `fechaAdquisicion` a `YYYY-MM-DD` para el input date
- `VehiculoEditForm` — Client Component con campos pre-poblados; Select usan estado controlado; Input usan `defaultValue`
- Envía PUT a `/api/vehiculos/[id]` y redirige al detalle al guardar
- La sucursal se muestra como texto informativo (inmutable)

**Eliminar vehículo** (botón en detalle, solo admin):
- `EliminarVehiculoButton` — Client Component con diálogo de confirmación
- Llama DELETE a `/api/vehiculos/[id]` y redirige a `/vehiculos`
- Backend ya implementado en `src/app/api/vehiculos/[id]/route.ts`

### 7.5 Documentos vehiculares (`/vehiculos/[id]/documentos`)

Almacenamiento en **Wasabi S3** de documentos legales y operativos por vehículo.

**Tipos:** SOAT, Revisión Técnica, Tarjeta de Propiedad, Otro.

**Modelo BD:** `DocumentoVehicular` — campos: `tipo`, `nombre`, `archivoKey` (clave Wasabi), `mimeType`, `tamanoBytes`, `vencimiento`, `subidoPor`.

**Key Wasabi:** `vehiculos/{vehiculoId}/documentos/{uuid}.{ext}`

**API:**
- `GET /api/vehiculos/[id]/documentos` — lista con signed URLs (1h)
- `POST /api/vehiculos/[id]/documentos` — FormData upload (PDF/JPG/PNG ≤ 10 MB)
- `DELETE /api/vehiculos/[id]/documentos/[docId]` — elimina BD + Wasabi

**UI:**
- Lista agrupada por tipo con iconos de color
- Badge de vencimiento: verde (ok), ámbar (< 30 días), rojo (vencido)
- Botón de descarga (abre signed URL en nueva pestaña)
- Modal de subida con validación de tipo/tamaño
- Botón “Documentos” en detalle del vehículo con badge rojo si hay alertas
- Permisos: visor solo lectura; admin y jefe_sucursal pueden subir/eliminar

### 7.4 Invitaciones (`/admin/invitaciones`)

- Tabla de invitaciones con estado (Activo / Usado / Expirado)
- Modal para crear nueva invitación (email, rol, sucursal si es jefe_sucursal)
- Botón "Copiar link" para invitaciones activas
- Solo accesible para admin

---

## 8. Módulos planificados (próximos sprints)

### 8.1 Sucursales (`/admin/sucursales`)
CRUD de sucursales. Crear, editar nombre/ciudad/region, activar/desactivar.
Las sucursales desactivadas no aparecen en selects de invitaciones ni vehículos.

### 8.3 Usuarios (`/admin/usuarios`)
Lista de profiles activos con su rol y sucursal.
Acciones: cambiar rol, reasignar sucursal, desactivar cuenta.

### 8.4 Documentos vehiculares (`/vehiculos/[id]/documentos`)
Almacenamiento en **Wasabi** de:
- SOAT (vencimiento anual)
- Revisión técnica (vencimiento anual)
- Tarjeta de propiedad (PDF scan)
- Otros documentos ad-hoc

Alertas por vencimiento próximo (< 30 días).
El cliente de Wasabi ya está implementado en `src/lib/wasabi.ts`.

### 8.5 Mantenimientos (`/vehiculos/[id]/mantenimientos`)
Registro de mantenimientos preventivos y correctivos:
- Tipo (aceite, frenos, neumáticos, etc.)
- Fecha, km al momento, costo, taller
- Próximo mantenimiento programado (km o fecha)

### 8.6 Conductores (`/conductores`)
Tabla dedicada de conductores (actualmente el vehículo tiene campos `conductorNombre`/`conductorTel` temporales):
- Datos del conductor: nombre, DNI, licencia (categoría, vencimiento), teléfono
- Asignación a vehículo (relación many-to-one)
- Historial de asignaciones

### 8.7 Alertas y notificaciones
Panel de alertas para:
- Documentos próximos a vencer
- Mantenimientos pendientes
- Vehículos fuera de servicio con tiempo elevado

### 8.8 Reportes
- Exportación a PDF/Excel de listado de flota
- Reporte de mantenimientos por período
- Reporte de estado de flota por sucursal

---

## 9. Patrones y convenciones de código

### Server Components (páginas)

```tsx
// Patrón estándar de página protegida
export default async function MiPage() {
  const profile = await getProfile();          // React cache() — no duplica query
  if (!profile) redirect("/login");

  const datos = await prisma.modelo.findMany({ ... });  // Fetch directo desde página

  return <MiClientComponent datos={datos} />;           // Pasar como props
}
```

### API Routes

```ts
// Patrón estándar de API route
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return Response.json({ error: "No autenticado" }, { status: 401 });
  if (profile.rol !== "admin") return Response.json({ error: "Sin permiso" }, { status: 403 });

  const body = await request.json() as { campo: string };
  // lógica...
  return Response.json(resultado);
}
```

### Client Components con formularios

```tsx
"use client";
// Reciben datos iniciales como props desde Server Component
// Usan fetch() para POST/PUT/DELETE a API routes
// Nunca hacen fetch inicial de página (eso es del Server Component)
```

### Control de modales (workaround asChild)

```tsx
// NO funciona en esta versión:
// <DialogTrigger asChild><Button /></DialogTrigger>

// Usar en su lugar:
const [open, setOpen] = useState(false);
<Button onClick={() => setOpen(true)}>Abrir</Button>
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>...</DialogContent>
</Dialog>
```

---

## 10. Variables de entorno

```env
# Base de datos
DATABASE_URL=postgresql://...   # Con adapter PrismaPg

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Solo server-side, nunca exponer al cliente

# Wasabi S3
WASABI_REGION=us-east-1
WASABI_ENDPOINT=https://s3.wasabisys.com
WASABI_ACCESS_KEY_ID=...
WASABI_SECRET_ACCESS_KEY=...
WASABI_BUCKET_NAME=selcosiflota
```

---

## 11. Flujo de desarrollo

### Agregar un nuevo módulo

1. **Schema**: Agregar modelo en `prisma/schema.prisma`
2. **Migración**: `npx prisma migrate dev --name nombre_migracion`
3. **API Route**: Crear en `src/app/api/<modulo>/route.ts` con validación de rol
4. **Página**: Server Component en `src/app/(app)/<modulo>/page.tsx` que fetcha con Prisma y pasa props
5. **Client Component**: Si necesita interactividad, crear en `_components/` dentro de la página
6. **Navegación**: Agregar link en `src/components/sidebar.tsx` (con `adminOnly` si aplica)

### Comandos frecuentes

```bash
npm run dev          # Desarrollo
npm run build        # Verificar build de producción (TypeScript check incluido)
npx prisma studio    # GUI de base de datos
npx prisma migrate dev --name <nombre>   # Nueva migración
npx prisma generate  # Regenerar tipos (después de cambiar schema sin migrar)
```

---

## 12. Decisiones de arquitectura relevantes

| Decisión | Razón |
|---|---|
| API Routes en lugar de Server Actions | Regla del proyecto. Permite testing, uso desde cliente y consistencia |
| `React.cache()` en `getProfile` | Evita doble query cuando layout y página llaman a getProfile en el mismo request |
| `supabaseAdmin` solo en API Routes | Bypasa RLS — nunca debe llegar al browser |
| Prisma output en `src/generated/prisma` | Prisma 7 requiere path explícito; los tipos se importan desde ahí |
| `prisma.config.ts` separado del schema | Prisma 7 rompió el `url` en `datasource` — la URL va en config aparte |
| Campos de conductor en `vehiculos` (temporal) | El módulo de conductores se implementará después; no bloquea el flujo inicial |
| `expiraEn.toISOString()` al serializar invitaciones | Los Date de Prisma no son serializables como props de Server → Client Component |
