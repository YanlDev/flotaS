import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { deleteFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.profile.findUnique({ where: { id: user.id } });
}

// DELETE — eliminar foto
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ fotoId: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (profile.rol === "visor") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { fotoId } = await params;

  const foto = await prisma.fotoVehiculo.findUnique({
    where: { id: fotoId },
    include: { vehiculo: { select: { sucursalId: true } } },
  });

  if (!foto) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  if (
    profile.rol === "jefe_sucursal" &&
    foto.vehiculo.sucursalId !== profile.sucursalId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await deleteFile(foto.key);
  await prisma.fotoVehiculo.delete({ where: { id: fotoId } });

  return NextResponse.json({ success: true });
}
