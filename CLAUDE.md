@AGENTS.md

# selcosiflota — Reglas del proyecto

## TypeScript
- **Prohibido usar `any`**. Usar tipos explícitos, `unknown` con narrowing, o generics.

## Arquitectura backend
- **No usar Server Actions** para lógica de negocio o mutaciones de datos.
- Toda la lógica de backend va en **API Routes** (`src/app/api/**`).
- Las Server Actions solo están permitidas para operaciones triviales de UI (ej. revalidar caché).

## Fetching de datos en páginas
- Las páginas deben obtener datos usando **Server Components** (async page/layout).
- No hacer fetch en el cliente para datos iniciales de página; usar Server Components y pasar los datos como props.
- Los Client Components (`"use client"`) solo se usan para interactividad y estado local.

## Stack
- ORM: Prisma (`src/lib/prisma.ts`)
- Base de datos: Supabase (PostgreSQL)
- Storage: Wasabi S3-compatible (`src/lib/wasabi.ts`)
- UI: shadcn/ui (tema emerald)
