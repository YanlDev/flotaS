import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invitacion = await prisma.invitacion.findFirst({
    where: {
      token,
      usado: false,
      expiraEn: { gt: new Date() },
    },
    select: {
      email: true,
      rol: true,
      expiraEn: true,
      sucursal: {
        select: { id: true, nombre: true, ciudad: true },
      },
    },
  });

  if (!invitacion) {
    return NextResponse.json(
      { error: "Invitación inválida o expirada" },
      { status: 404 }
    );
  }

  return NextResponse.json(invitacion);
}
