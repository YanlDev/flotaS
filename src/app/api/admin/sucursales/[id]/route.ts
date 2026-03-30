import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { NextRequest, NextResponse } from "next/server";

// PATCH — editar nombre/ciudad/región o activar/desactivar
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const sucursal = await prisma.sucursal.findUnique({ where: { id } });
  if (!sucursal) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });

  const body = await request.json() as {
    nombre?: string;
    ciudad?: string;
    region?: string | null;
    activa?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (body.nombre !== undefined) data.nombre = body.nombre.trim();
  if (body.ciudad !== undefined) data.ciudad = body.ciudad.trim();
  if (body.region !== undefined) data.region = body.region?.trim() || null;
  if (body.activa !== undefined) data.activa = body.activa;

  const updated = await prisma.sucursal.update({ where: { id }, data });
  return NextResponse.json(updated);
}
