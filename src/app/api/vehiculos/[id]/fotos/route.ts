import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { uploadFile, getSignedDownloadUrl, deleteFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";
import { CategoriaFoto } from "@/generated/prisma/client";

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.profile.findUnique({ where: { id: user.id } });
}

const CATEGORIAS_VALIDAS: CategoriaFoto[] = [
  "frontal", "posterior", "lateral_der", "lateral_izq", "cabina", "odometro", "otro",
];

// GET — listar fotos del vehículo con URLs firmadas
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id },
    select: { id: true, sucursalId: true },
  });

  if (!vehiculo) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const fotos = await prisma.fotoVehiculo.findMany({
    where: { vehiculoId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      key: true,
      categoria: true,
      descripcion: true,
      createdAt: true,
      subidor: { select: { nombreCompleto: true } },
    },
  });

  const fotosConUrl = await Promise.all(
    fotos.map(async (f) => ({
      ...f,
      url: await getSignedDownloadUrl(f.key, 3600),
    }))
  );

  return NextResponse.json(fotosConUrl);
}

// POST — subir o reemplazar una foto del vehículo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (profile.rol === "visor") {
    return NextResponse.json({ error: "Sin permisos para subir fotos" }, { status: 403 });
  }

  const { id } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id },
    select: { id: true, sucursalId: true },
  });

  if (!vehiculo) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const formData = await request.formData();
  const archivo = formData.get("archivo") as File | null;
  const categoriaRaw = (formData.get("categoria") as string | null) ?? "otro";
  const descripcion = formData.get("descripcion") as string | null;

  if (!archivo) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return NextResponse.json(
      { error: "Solo se permiten imágenes JPG, PNG, WEBP o HEIC" },
      { status: 400 }
    );
  }

  if (archivo.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Tamaño máximo por foto: 15 MB" }, { status: 400 });
  }

  const categoria = CATEGORIAS_VALIDAS.includes(categoriaRaw as CategoriaFoto)
    ? (categoriaRaw as CategoriaFoto)
    : "otro";

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `fotos-vehiculos/${id}/${categoria}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());

  // Para categorías fijas (no "otro"): reemplazar foto existente
  if (categoria !== "otro") {
    const existente = await prisma.fotoVehiculo.findFirst({
      where: { vehiculoId: id, categoria },
      select: { id: true, key: true },
    });

    if (existente) {
      await deleteFile(existente.key).catch(() => null); // tolerar si ya no existe en Wasabi
      await uploadFile(key, buffer, archivo.type);
      const actualizada = await prisma.fotoVehiculo.update({
        where: { id: existente.id },
        data: { key, subidoPor: profile.id },
        select: { id: true, key: true, categoria: true, descripcion: true, createdAt: true },
      });
      const url = await getSignedDownloadUrl(key, 3600);
      return NextResponse.json({ ...actualizada, url });
    }
  }

  // Nueva foto
  await uploadFile(key, buffer, archivo.type);

  const foto = await prisma.fotoVehiculo.create({
    data: {
      vehiculoId: id,
      key,
      categoria,
      descripcion: categoria === "otro" ? (descripcion?.trim() || null) : null,
      subidoPor: profile.id,
    },
    select: { id: true, key: true, categoria: true, descripcion: true, createdAt: true },
  });

  const url = await getSignedDownloadUrl(key, 3600);
  return NextResponse.json({ ...foto, url }, { status: 201 });
}
