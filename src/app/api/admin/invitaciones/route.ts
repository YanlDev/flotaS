import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { RolUsuario } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.profile.findUnique({ where: { id: user.id } });
}

// GET — listar invitaciones (admin)
export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const invitaciones = await prisma.invitacion.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      email: true,
      rol: true,
      usado: true,
      expiraEn: true,
      createdAt: true,
      sucursal: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json(invitaciones);
}

// POST — crear invitación (admin)
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json() as {
    email: string;
    rol: RolUsuario;
    sucursalId?: string;
  };
  const { email, rol, sucursalId } = body;

  if (!email || !rol) {
    return NextResponse.json(
      { error: "Email y rol son requeridos" },
      { status: 400 }
    );
  }

  const rolesValidos: RolUsuario[] = ["jefe_sucursal", "comercial", "visor"];
  if (!rolesValidos.includes(rol)) {
    return NextResponse.json(
      { error: "Rol inválido" },
      { status: 400 }
    );
  }

  if ((rol === "jefe_sucursal" || rol === "comercial") && !sucursalId) {
    return NextResponse.json(
      { error: "Este rol debe tener una sucursal asignada" },
      { status: 400 }
    );
  }

  // Invalidar invitaciones previas no usadas para el mismo email
  await prisma.invitacion.updateMany({
    where: { email, usado: false },
    data: { expiraEn: new Date() },
  });

  const invitacion = await prisma.invitacion.create({
    data: {
      email,
      rol,
      sucursalId: sucursalId ?? null,
      creadoPor: profile.id,
      expiraEn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    select: {
      id: true,
      token: true,
      email: true,
      rol: true,
      expiraEn: true,
      sucursal: { select: { nombre: true } },
    },
  });

  return NextResponse.json(invitacion, { status: 201 });
}
