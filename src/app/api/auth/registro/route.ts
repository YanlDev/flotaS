import { supabaseAdmin } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    nombre: string;
    email: string;
    password: string;
    token?: string;
  };
  const { nombre, email, password, token } = body;

  if (!nombre || !email || !password) {
    return NextResponse.json(
      { error: "Todos los campos son requeridos" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  // Verificar si ya existe un admin (primera vez = setup inicial)
  const totalAdmins = await prisma.profile.count({
    where: { rol: "admin" },
  });

  const esPrimerAdmin = totalAdmins === 0;

  if (!esPrimerAdmin && !token) {
    return NextResponse.json(
      { error: "El registro requiere una invitación válida" },
      { status: 403 }
    );
  }

  // Validar token si no es el primer admin
  let invitacion = null;
  if (!esPrimerAdmin && token) {
    invitacion = await prisma.invitacion.findFirst({
      where: {
        token,
        usado: false,
        expiraEn: { gt: new Date() },
      },
    });

    if (!invitacion) {
      return NextResponse.json(
        { error: "Invitación inválida o expirada" },
        { status: 400 }
      );
    }

    if (invitacion.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "El correo no coincide con la invitación" },
        { status: 400 }
      );
    }
  }

  // Crear usuario en Supabase Auth (sin confirmación de email)
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    const msg = authError?.message ?? "Error al crear el usuario";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = authData.user.id;

  // Crear profile
  await prisma.profile.create({
    data: {
      id: userId,
      nombreCompleto: nombre,
      email,
      rol: esPrimerAdmin ? "admin" : invitacion!.rol,
      sucursalId: esPrimerAdmin ? null : invitacion!.sucursalId,
    },
  });

  // Marcar invitación como usada
  if (invitacion) {
    await prisma.invitacion.update({
      where: { id: invitacion.id },
      data: { usado: true },
    });
  }

  return NextResponse.json(
    {
      success: true,
      message: esPrimerAdmin
        ? "Cuenta de administrador creada exitosamente"
        : "Cuenta creada exitosamente",
    },
    { status: 201 }
  );
}
