import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json() as { email: string };
  const { email } = body;

  if (!email) {
    return NextResponse.json(
      { error: "El correo es requerido" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const redirectTo = `${request.nextUrl.origin}/actualizar-password`;

  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Siempre retornar éxito para evitar enumeración de emails
  return NextResponse.json({ success: true });
}
