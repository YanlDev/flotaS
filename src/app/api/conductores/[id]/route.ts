import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { NextRequest, NextResponse } from "next/server";
import { CategoriaLicencia } from "@/generated/prisma/client";

const CATEGORIAS: CategoriaLicencia[] = ["A1","A2a","A2b","A3a","A3b","A3c","B","B2C","C","D","E"];

// PATCH — actualizar conductor
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || profile.rol === "visor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const conductor = await prisma.conductor.findUnique({ where: { id } });
  if (!conductor) return NextResponse.json({ error: "Conductor no encontrado" }, { status: 404 });

  if (profile.rol === "jefe_sucursal" && conductor.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.nombreCompleto === "string") data.nombreCompleto = body.nombreCompleto.trim();
  if (typeof body.dni === "string") data.dni = body.dni.trim();
  if (typeof body.telefono === "string") data.telefono = body.telefono.trim() || null;
  if (typeof body.email === "string") data.email = body.email.trim() || null;
  if (typeof body.licenciaCategoria === "string") {
    if (!CATEGORIAS.includes(body.licenciaCategoria as CategoriaLicencia))
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    data.licenciaCategoria = body.licenciaCategoria;
  }
  if (typeof body.licenciaNumero === "string") data.licenciaNumero = body.licenciaNumero.trim() || null;
  if (body.sucursalId !== undefined) data.sucursalId = (body.sucursalId as string) || null;
  if (typeof body.licenciaVencimiento === "string") {
    data.licenciaVencimiento = body.licenciaVencimiento ? new Date(body.licenciaVencimiento) : null;
  }
  if (body.vehiculoId !== undefined) {
    const newVehicleId = (body.vehiculoId as string) || null;
    data.vehiculoId = newVehicleId;

    // Si se asigna un vehículo, limpiar ese vehículo de cualquier otro conductor
    if (newVehicleId) {
      await prisma.conductor.updateMany({
        where: { vehiculoId: newVehicleId, id: { not: id } },
        data: { vehiculoId: null },
      });
    }
  }
  if (typeof body.activo === "boolean") data.activo = body.activo;

  const updated = await prisma.conductor.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id });
}

// DELETE — eliminar conductor
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const conductor = await prisma.conductor.findUnique({ where: { id } });
  if (!conductor) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.conductor.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
