import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { deleteFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

// DELETE — eliminar carga (admin o jefe de la sucursal del vehículo)
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

  const carga = await prisma.cargaCombustible.findUnique({
    where: { id },
    include: { vehiculo: { select: { sucursalId: true } } },
  });

  if (!carga) return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 });

  if (
    profile.rol === "jefe_sucursal" &&
    carga.vehiculo.sucursalId !== profile.sucursalId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Eliminar archivos de Wasabi si existen
  if (carga.comprobanteKey) {
    try { await deleteFile(carga.comprobanteKey); } catch { /* continuar si falla */ }
  }
  if (carga.odometroFotoKey) {
    try { await deleteFile(carga.odometroFotoKey); } catch { /* continuar si falla */ }
  }

  await prisma.cargaCombustible.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
