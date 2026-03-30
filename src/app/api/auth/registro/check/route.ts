import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Endpoint público: indica si aún no existe ningún admin (primera configuración)
export async function GET() {
  const totalAdmins = await prisma.profile.count({
    where: { rol: "admin" },
  });

  return NextResponse.json({ esPrimerAdmin: totalAdmins === 0 });
}
