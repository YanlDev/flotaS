import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { uploadFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

const ROLES_PERMITIDOS = ["admin", "comercial"] as const;
const MIME_PERMITIDOS = ["application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// GET — listar proveedores
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const sucursalId = searchParams.get("sucursalId");
  const q = searchParams.get("q");

  const sucursalFiltro =
    profile.rol === "comercial"
      ? (profile.sucursalId ?? undefined)
      : (sucursalId ?? undefined);

  const proveedores = await prisma.proveedor.findMany({
    where: {
      deletedAt: null,
      ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
      ...(q && {
        OR: [
          { ruc: { contains: q, mode: "insensitive" } },
          { razonSocial: { contains: q, mode: "insensitive" } },
          { dni: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ruc: true,
      razonSocial: true,
      dni: true,
      direccionConcesion: true,
      fichaRucKey: true,
      createdAt: true,
      sucursal: { select: { id: true, nombre: true } },
      _count: { select: { placas: { where: { deletedAt: null } } } },
    },
  });

  return NextResponse.json(proveedores);
}

// POST — crear proveedor (multipart/form-data por la ficha RUC)
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const formData = await request.formData();
  const ruc = (formData.get("ruc") as string | null)?.trim();
  const razonSocial = (formData.get("razonSocial") as string | null)?.trim();
  const usuarioSunat = (formData.get("usuarioSunat") as string | null)?.trim();
  const sol = (formData.get("sol") as string | null)?.trim();
  const dni = (formData.get("dni") as string | null)?.trim();
  const direccionConcesion = (formData.get("direccionConcesion") as string | null)?.trim();
  const sucursalId = (formData.get("sucursalId") as string | null)?.trim() || null;
  const fichaRuc = formData.get("fichaRuc") as File | null;

  if (!ruc || !razonSocial || !usuarioSunat || !sol || !dni || !direccionConcesion) {
    return NextResponse.json({ error: "Todos los campos de texto son requeridos" }, { status: 400 });
  }

  if (!fichaRuc) {
    return NextResponse.json({ error: "La Ficha RUC (PDF) es requerida" }, { status: 400 });
  }
  if (!MIME_PERMITIDOS.includes(fichaRuc.type)) {
    return NextResponse.json({ error: "La Ficha RUC debe ser un PDF" }, { status: 400 });
  }
  if (fichaRuc.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo no puede superar 10 MB" }, { status: 400 });
  }

  // Sucursal: comercial usa la suya, admin usa la enviada
  const sucursalFinal =
    profile.rol === "comercial" ? (profile.sucursalId ?? null) : sucursalId;

  try {
    // Crear proveedor primero para obtener el ID
    const proveedor = await prisma.proveedor.create({
      data: {
        ruc,
        razonSocial,
        usuarioSunat,
        sol,
        dni,
        direccionConcesion,
        sucursalId: sucursalFinal,
        createdBy: profile.id,
      },
    });

    // Subir ficha RUC a Wasabi
    const ext = "pdf";
    const key = `proveedores/${proveedor.id}/ficha-ruc.${ext}`;
    const buffer = Buffer.from(await fichaRuc.arrayBuffer());
    await uploadFile(key, buffer, fichaRuc.type);

    // Actualizar con la key del archivo
    const actualizado = await prisma.proveedor.update({
      where: { id: proveedor.id },
      data: { fichaRucKey: key },
      include: { sucursal: { select: { nombre: true } } },
    });

    return NextResponse.json(actualizado, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
      return NextResponse.json({ error: "Ya existe un proveedor con ese RUC" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al registrar el proveedor" }, { status: 500 });
  }
}
