import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { deleteFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (profile.rol === "visor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: vehiculoId, docId } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const doc = await prisma.documentoVehicular.findUnique({ where: { id: docId } });
  if (!doc || doc.vehiculoId !== vehiculoId) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  // Eliminar de Wasabi primero (si falla, no eliminamos de BD)
  await deleteFile(doc.archivoKey);
  await prisma.documentoVehicular.delete({ where: { id: docId } });

  return NextResponse.json({ success: true });
}
