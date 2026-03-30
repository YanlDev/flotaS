import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { NextResponse } from "next/server";

// GET — lista todos los profiles
export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const usuarios = await prisma.profile.findMany({
    orderBy: [{ activo: "desc" }, { nombreCompleto: "asc" }],
    include: { sucursal: { select: { id: true, nombre: true } } },
  });

  return NextResponse.json(
    usuarios.map((u) => ({
      id: u.id,
      nombreCompleto: u.nombreCompleto,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      sucursalId: u.sucursalId,
      sucursalNombre: u.sucursal?.nombre ?? null,
      createdAt: u.createdAt.toISOString(),
    }))
  );
}
