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

  const { id: conductorId, docId } = await params;

  const conductor = await prisma.conductor.findUnique({ where: { id: conductorId } });
  if (!conductor) return NextResponse.json({ error: "Conductor no encontrado" }, { status: 404 });

  if (profile.rol === "jefe_sucursal" && conductor.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const doc = await prisma.documentoConductor.findUnique({ where: { id: docId } });
  if (!doc || doc.conductorId !== conductorId) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  await deleteFile(doc.archivoKey);
  await prisma.documentoConductor.delete({ where: { id: docId } });

  return NextResponse.json({ success: true });
}
