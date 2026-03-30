import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { uploadFile, getSignedDownloadUrl } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";
import { TipoDocumento } from "@/generated/prisma/client";

const TIPOS_VALIDOS: TipoDocumento[] = ["soat", "revision_tecnica", "tarjeta_propiedad", "otro"];
const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// GET — lista documentos del vehículo con signed URLs de descarga
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: vehiculoId } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const documentos = await prisma.documentoVehicular.findMany({
    where: { vehiculoId },
    orderBy: { createdAt: "desc" },
    include: { subidor: { select: { nombreCompleto: true } } },
  });

  // Generar signed URLs (1 hora cada una)
  const docsConUrl = await Promise.all(
    documentos.map(async (doc) => ({
      id: doc.id,
      tipo: doc.tipo,
      nombre: doc.nombre,
      mimeType: doc.mimeType,
      tamanoBytes: doc.tamanoBytes,
      vencimiento: doc.vencimiento ? doc.vencimiento.toISOString().split("T")[0] : null,
      subidoPor: doc.subidor?.nombreCompleto ?? null,
      createdAt: doc.createdAt.toISOString(),
      downloadUrl: await getSignedDownloadUrl(doc.archivoKey, 3600),
    }))
  );

  return NextResponse.json(docsConUrl);
}

// POST — subir nuevo documento
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (profile.rol === "visor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: vehiculoId } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const formData = await req.formData();
  const tipo = formData.get("tipo") as string | null;
  const nombre = formData.get("nombre") as string | null;
  const vencimiento = formData.get("vencimiento") as string | null;
  const archivo = formData.get("archivo") as File | null;

  if (!tipo || !TIPOS_VALIDOS.includes(tipo as TipoDocumento)) {
    return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }
  if (!nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!archivo) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (!MIME_PERMITIDOS.includes(archivo.type)) {
    return NextResponse.json({ error: "Solo se permiten PDF, JPG, PNG o WEBP" }, { status: 400 });
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo no puede superar 10 MB" }, { status: 400 });
  }

  const ext = archivo.name.split(".").pop() ?? "bin";
  const key = `vehiculos/${vehiculoId}/documentos/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await archivo.arrayBuffer());
  await uploadFile(key, buffer, archivo.type);

  const doc = await prisma.documentoVehicular.create({
    data: {
      vehiculoId,
      tipo: tipo as TipoDocumento,
      nombre: nombre.trim(),
      archivoKey: key,
      mimeType: archivo.type,
      tamanoBytes: archivo.size,
      vencimiento: vencimiento ? new Date(vencimiento) : null,
      subidoPor: profile.id,
    },
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
