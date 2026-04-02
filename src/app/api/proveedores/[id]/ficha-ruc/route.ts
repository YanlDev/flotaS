import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { getSignedDownloadUrl } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

const ROLES_PERMITIDOS = ["admin", "comercial"] as const;

// GET — URL firmada para descargar la Ficha RUC
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const proveedor = await prisma.proveedor.findFirst({
    where: { id, deletedAt: null },
    select: { fichaRucKey: true, sucursalId: true },
  });

  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  if (profile.rol === "comercial" && proveedor.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!proveedor.fichaRucKey) {
    return NextResponse.json({ error: "No hay Ficha RUC registrada" }, { status: 404 });
  }

  const url = await getSignedDownloadUrl(proveedor.fichaRucKey, 3600);
  return NextResponse.json({ url });
}
