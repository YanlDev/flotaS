import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { type Prisma, type CategoriaLicencia } from "@/generated/prisma/client";

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.profile.findUnique({ where: { id: user.id } });
}

// GET — lista conductores
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  // Rol admin ve todo, jefe solo su sucursal
  const sucursalFiltro =
    profile.rol === "jefe_sucursal"
      ? profile.sucursalId
      : searchParams.get("sucursalId");

  const where: Prisma.ConductorWhereInput = {
    deletedAt: null,
    ...(sucursalFiltro ? { sucursalId: sucursalFiltro } : {}),
  };

  if (q) {
    where.OR = [
      { dni: { contains: q, mode: "insensitive" } },
      { nombreCompleto: { contains: q, mode: "insensitive" } },
    ];
  }

  const conductores = await prisma.conductor.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      sucursal: { select: { id: true, nombre: true } },
      vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
    },
  });

  return NextResponse.json(conductores);
}

// POST — crear conductor (solo admin)
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (profile.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede registrar conductores" }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    // Validar requeridos básicos
    if (!body.nombreCompleto || typeof body.nombreCompleto !== "string") {
      return NextResponse.json({ error: "El nombre completo es obligatorio" }, { status: 400 });
    }
    if (!body.dni || typeof body.dni !== "string") {
      return NextResponse.json({ error: "El DNI es obligatorio" }, { status: 400 });
    }
    if (!body.licenciaCategoria || typeof body.licenciaCategoria !== "string") {
      return NextResponse.json({ error: "La categoría de licencia es obligatoria" }, { status: 400 });
    }
    
    // Preparar campos
    const { vehiculoId, ...restoBody } = body;
    
    const conductorData: Prisma.ConductorCreateInput = {
      nombreCompleto: body.nombreCompleto.trim().toUpperCase(),
      dni: body.dni.trim(),
      licenciaCategoria: body.licenciaCategoria as CategoriaLicencia,
      telefono: typeof body.telefono === "string" ? body.telefono : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      licenciaNumero: typeof body.licenciaNumero === "string" ? body.licenciaNumero : undefined,
      licenciaVencimiento: typeof body.licenciaVencimiento === "string" && body.licenciaVencimiento ? new Date(body.licenciaVencimiento) : undefined,
      creador: { connect: { id: profile.id } },
      ...(typeof body.sucursalId === "string" && body.sucursalId ? { sucursal: { connect: { id: body.sucursalId } } } : {}),
      ...(typeof vehiculoId === "string" && vehiculoId && vehiculoId !== "none" ? { vehiculo: { connect: { id: vehiculoId } } } : {}),
    };

    const nuevoConductor = await prisma.conductor.create({
      data: conductorData,
    });

    return NextResponse.json(nuevoConductor, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    if (msg.includes("Unique constraint") && msg.includes("dni")) {
      return NextResponse.json({ error: "Ya existe un conductor con ese DNI" }, { status: 409 });
    }
    if (msg.includes("Unique constraint") && msg.includes("vehiculoId")) {
      return NextResponse.json({ error: "Ese vehículo ya tiene un conductor asignado" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al registrar el conductor", msg }, { status: 500 });
  }
}
