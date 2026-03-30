import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { NextRequest, NextResponse } from "next/server";

// GET — lista sucursales (con conteo de vehículos)
export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const sucursales = await prisma.sucursal.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { vehiculos: true, profiles: true } },
    },
  });

  return NextResponse.json(
    sucursales.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      ciudad: s.ciudad,
      region: s.region,
      activa: s.activa,
      totalVehiculos: s._count.vehiculos,
      totalUsuarios: s._count.profiles,
    }))
  );
}

// POST — crear nueva sucursal
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json() as { nombre?: string; ciudad?: string; region?: string };

  if (!body.nombre?.trim() || !body.ciudad?.trim()) {
    return NextResponse.json({ error: "Nombre y ciudad son requeridos" }, { status: 400 });
  }

  const sucursal = await prisma.sucursal.create({
    data: {
      nombre: body.nombre.trim(),
      ciudad: body.ciudad.trim(),
      region: body.region?.trim() || null,
    },
  });

  return NextResponse.json(sucursal, { status: 201 });
}
