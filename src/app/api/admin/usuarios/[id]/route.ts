import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { NextRequest, NextResponse } from "next/server";
import { RolUsuario } from "@/generated/prisma/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROLES_VALIDOS: RolUsuario[] = ["admin", "jefe_sucursal", "visor"];

// PATCH — cambiar rol, sucursal, o estado activo
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  // No permitir que el admin se modifique a sí mismo (evitar lockout)
  if (id === profile.id) {
    return NextResponse.json({ error: "No puedes modificar tu propio usuario" }, { status: 400 });
  }

  const target = await prisma.profile.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await request.json() as {
    rol?: string;
    sucursalId?: string | null;
    activo?: boolean;
  };

  const data: Record<string, unknown> = {};

  if (body.rol !== undefined) {
    if (!ROLES_VALIDOS.includes(body.rol as RolUsuario)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }
    data.rol = body.rol as RolUsuario;

    // Si cambia a admin o visor, limpiar sucursal
    if (body.rol === "admin" || body.rol === "visor") {
      data.sucursalId = null;
    }
  }

  if (body.sucursalId !== undefined) {
    data.sucursalId = body.sucursalId ?? null;
  }

  if (body.activo !== undefined) {
    data.activo = body.activo;
  }

  const updated = await prisma.profile.update({
    where: { id },
    data,
    include: { sucursal: { select: { nombre: true } } },
  });

  return NextResponse.json({
    id: updated.id,
    rol: updated.rol,
    activo: updated.activo,
    sucursalId: updated.sucursalId,
    sucursalNombre: updated.sucursal?.nombre ?? null,
  });
}

// DELETE — eliminar usuario del sistema conservando sus datos históricos
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  if (id === profile.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });
  }

  const target = await prisma.profile.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // 1. Eliminar de Supabase Auth → bloquea acceso y libera el email
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (authError) {
    return NextResponse.json({ error: "Error al eliminar sesión: " + authError.message }, { status: 500 });
  }

  // 2. Marcar el Profile como eliminado (activo=false, sin sucursal)
  //    NO se borra el registro para conservar FK references en vehiculos, documentos, etc.
  await prisma.profile.update({
    where: { id },
    data: { activo: false, sucursalId: null },
  });

  return NextResponse.json({ ok: true });
}
