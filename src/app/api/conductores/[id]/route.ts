import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { type CategoriaLicencia } from "@/generated/prisma/client";

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.profile.findUnique({ where: { id: user.id } });
}

// GET — detalle de conductor
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Conductor no encontrado" }, { status: 404 });
  }

  const conductor = await prisma.conductor.findUnique({
    where: { id, deletedAt: null },
    include: {
      sucursal: { select: { id: true, nombre: true, ciudad: true } },
      vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
      creador: { select: { nombreCompleto: true } },
    },
  });

  if (!conductor) {
    return NextResponse.json({ error: "Conductor no encontrado" }, { status: 404 });
  }

  if (
    profile.rol === "jefe_sucursal" &&
    conductor.sucursalId !== profile.sucursalId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return NextResponse.json(conductor);
}

// Payload tipado para actualizar conductor
interface UpdateConductorBody {
  nombreCompleto?: string;
  dni?: string;
  telefono?: string | null;
  email?: string | null;
  licenciaCategoria?: CategoriaLicencia;
  licenciaNumero?: string | null;
  licenciaVencimiento?: string | null;
  sucursalId?: string | null;
  vehiculoId?: string | null;
  activo?: boolean;
}

// PUT — actualizar conductor (solo admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (profile.rol !== "admin") {
    return NextResponse.json(
      { error: "Solo el administrador puede editar conductores" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Conductor no encontrado" }, { status: 404 });
  }

  const conductor = await prisma.conductor.findUnique({ where: { id, deletedAt: null } });
  if (!conductor) {
    return NextResponse.json({ error: "Conductor no encontrado" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateConductorBody;

  try {
    // Construir el update con relaciones explícitas para Prisma
    const actualizado = await prisma.conductor.update({
      where: { id },
      data: {
        // Escalares directos
        ...(typeof body.nombreCompleto === "string" && {
          nombreCompleto: body.nombreCompleto.toUpperCase().trim(),
        }),
        ...(typeof body.dni === "string" && {
          dni: body.dni.trim(),
        }),
        ...(body.telefono !== undefined && { telefono: body.telefono || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.licenciaCategoria !== undefined && {
          licenciaCategoria: body.licenciaCategoria,
        }),
        ...(body.licenciaNumero !== undefined && {
          licenciaNumero: body.licenciaNumero || null,
        }),
        ...(body.licenciaVencimiento !== undefined && {
          licenciaVencimiento: body.licenciaVencimiento
            ? new Date(body.licenciaVencimiento)
            : null,
        }),
        ...(typeof body.activo === "boolean" && { activo: body.activo }),

        // Relación sucursal
        ...(body.sucursalId !== undefined && {
          sucursal: body.sucursalId
            ? { connect: { id: body.sucursalId } }
            : { disconnect: true },
        }),

        // Relación vehículo — manejar asignación/desasignación
        ...(body.vehiculoId !== undefined && {
          vehiculo: body.vehiculoId
            ? { connect: { id: body.vehiculoId } }
            : { disconnect: true },
        }),
      },
      include: {
        sucursal: { select: { nombre: true, ciudad: true } },
        vehiculo: { select: { id: true, placa: true } },
      },
    });

    return NextResponse.json(actualizado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    if (msg.includes("Unique constraint") && msg.includes("dni")) {
      return NextResponse.json(
        { error: "Ya existe un conductor con ese DNI" },
        { status: 409 }
      );
    }
    if (msg.includes("Unique constraint") && msg.includes("vehiculo_id")) {
      return NextResponse.json(
        { error: "Ese vehiculo ya esta asignado a otro conductor" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Error al actualizar el conductor", msg },
      { status: 500 }
    );
  }
}

// PATCH — alias de PUT para compatibilidad con conductores-panel
export { PUT as PATCH };

// DELETE — soft delete de conductor (solo admin)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Conductor no encontrado" }, { status: 404 });
  }

  const conductor = await prisma.conductor.findUnique({ where: { id, deletedAt: null } });
  if (!conductor) {
    return NextResponse.json({ error: "Conductor no encontrado" }, { status: 404 });
  }

  // Soft delete: desactivar, desasignar vehiculo y marcar como eliminado
  await prisma.conductor.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      activo: false,
      vehiculoId: null,
    },
  });

  return NextResponse.json({ success: true });
}
