import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { NextRequest, NextResponse } from "next/server";
import { CategoriaLicencia } from "@/generated/prisma/client";

const CATEGORIAS: CategoriaLicencia[] = ["A1","A2a","A2b","A3a","A3b","A3c","B","B2C","C","D","E"];

// GET — lista conductores
export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sucursalFiltro =
    profile.rol === "jefe_sucursal" ? profile.sucursalId ?? undefined : undefined;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const sucursalId = searchParams.get("sucursalId") ?? undefined;

  const conductores = await prisma.conductor.findMany({
    where: {
      ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
      ...(!sucursalFiltro && sucursalId && { sucursalId }),
      ...(q && {
        OR: [
          { nombreCompleto: { contains: q, mode: "insensitive" } },
          { dni: { contains: q, mode: "insensitive" } },
          { telefono: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ activo: "desc" }, { nombreCompleto: "asc" }],
    include: {
      sucursal: { select: { nombre: true } },
      vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
    },
  });

  return NextResponse.json(
    conductores.map((c) => ({
      id: c.id,
      nombreCompleto: c.nombreCompleto,
      dni: c.dni,
      telefono: c.telefono,
      email: c.email,
      licenciaCategoria: c.licenciaCategoria,
      licenciaNumero: c.licenciaNumero,
      licenciaVencimiento: c.licenciaVencimiento
        ? c.licenciaVencimiento.toISOString().split("T")[0]
        : null,
      activo: c.activo,
      sucursalId: c.sucursalId,
      sucursalNombre: c.sucursal?.nombre ?? null,
      vehiculoId: c.vehiculoId,
      vehiculoPlaca: c.vehiculo?.placa ?? null,
      vehiculoDesc: c.vehiculo ? `${c.vehiculo.marca} ${c.vehiculo.modelo}` : null,
    }))
  );
}

// POST — crear conductor
export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.rol === "visor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json() as {
    nombreCompleto?: string;
    dni?: string;
    telefono?: string;
    email?: string;
    licenciaCategoria?: string;
    licenciaNumero?: string;
    licenciaVencimiento?: string;
    sucursalId?: string;
    vehiculoId?: string;
  };

  if (!body.nombreCompleto?.trim() || !body.dni?.trim() || !body.licenciaCategoria) {
    return NextResponse.json({ error: "Nombre, DNI y categoría de licencia son requeridos" }, { status: 400 });
  }
  if (!CATEGORIAS.includes(body.licenciaCategoria as CategoriaLicencia)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }

  // Jefe solo puede agregar a su sucursal
  const sucursalId =
    profile.rol === "jefe_sucursal" ? (profile.sucursalId ?? undefined) : body.sucursalId;

  try {
    const conductor = await prisma.conductor.create({
      data: {
        nombreCompleto: body.nombreCompleto.trim(),
        dni: body.dni.trim(),
        telefono: body.telefono?.trim() || null,
        email: body.email?.trim() || null,
        licenciaCategoria: body.licenciaCategoria as CategoriaLicencia,
        licenciaNumero: body.licenciaNumero?.trim() || null,
        licenciaVencimiento: body.licenciaVencimiento ? new Date(body.licenciaVencimiento) : null,
        sucursalId: sucursalId ?? null,
        vehiculoId: body.vehiculoId ?? null,
        createdBy: profile.id,
      },
    });
    return NextResponse.json({ id: conductor.id }, { status: 201 });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe un conductor con ese DNI" }, { status: 409 });
    }
    throw e;
  }
}
