import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Valida que el string tenga formato UUID válido para PostgreSQL
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.profile.findUnique({ where: { id: user.id } });
}

// GET — detalle de vehículo
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
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id, deletedAt: null },
    include: {
      sucursal: { select: { id: true, nombre: true, ciudad: true } },
      creador: { select: { nombreCompleto: true } },
    },
  });

  if (!vehiculo) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  // Jefe solo puede ver su sucursal
  if (
    profile.rol === "jefe_sucursal" &&
    vehiculo.sucursalId !== profile.sucursalId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return NextResponse.json(vehiculo);
}

// PUT — actualizar vehículo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (profile.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede editar vehículos" }, { status: 403 });
  }

  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id, deletedAt: null } });

  if (!vehiculo) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  const body = await request.json() as Record<string, unknown>;

  // Extraer campos con lógica especial fuera de prisma update
  const { id: _id, createdAt: _c, createdBy: _cb, conductorId, sucursalId: sucursalIdBody, ...updateData } = body;
  void _id; void _c; void _cb;

  // Permitir cambio de sucursal (solo admin, ya validado arriba)
  if (sucursalIdBody !== undefined) {
    if (sucursalIdBody) {
      const sucursal = await prisma.sucursal.findUnique({ where: { id: sucursalIdBody as string } });
      if (!sucursal || !sucursal.activa) {
        return NextResponse.json({ error: "Sucursal no encontrada o inactiva" }, { status: 400 });
      }
    }
    updateData.sucursalId = sucursalIdBody ?? null;
  }

  if (typeof updateData.placa === "string") {
    updateData.placa = updateData.placa.toUpperCase().trim();
  }
  if (typeof updateData.fechaAdquisicion === "string") {
    updateData.fechaAdquisicion = updateData.fechaAdquisicion ? new Date(updateData.fechaAdquisicion as string) : null;
  }

  try {
    const actualizado = await prisma.vehiculo.update({
      where: { id },
      data: updateData,
      include: {
        sucursal: { select: { nombre: true, ciudad: true } },
      },
    });

    // Manejar reasignación de conductor
    if (conductorId !== undefined) {
      const newConductorId = (conductorId as string) || null;
      const conductorActual = await prisma.conductor.findFirst({ where: { vehiculoId: id } });

      if (conductorActual?.id !== newConductorId) {
        if (conductorActual) {
          await prisma.conductor.update({ where: { id: conductorActual.id }, data: { vehiculoId: null } });
        }
        if (newConductorId) {
          await prisma.conductor.update({ where: { id: newConductorId }, data: { vehiculoId: id } });
        }
      }
    }

    return NextResponse.json(actualizado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
      return NextResponse.json({ error: "Ya existe un vehículo con esa placa" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al actualizar el vehículo" }, { status: 500 });
  }
}

// DELETE — soft delete de vehículo (solo admin)
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
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id, deletedAt: null } });
  if (!vehiculo) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  // Soft delete: marcar como eliminado sin borrar el historial
  await prisma.vehiculo.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
