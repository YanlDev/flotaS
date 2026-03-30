import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { deleteFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (profile.rol === "visor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const mant = await prisma.mantenimiento.findUnique({
    where: { id },
    include: { vehiculo: { select: { sucursalId: true } } },
  });

  if (!mant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (profile.rol === "jefe_sucursal" && mant.vehiculo.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (mant.evidenciaKey) {
    try { await deleteFile(mant.evidenciaKey); } catch { /* continuar si falla */ }
  }

  await prisma.mantenimiento.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
