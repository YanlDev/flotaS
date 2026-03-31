import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { deleteFile, uploadFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";
import { CategoriaMantenimiento, TipoMantenimiento } from "@/generated/prisma/client";

const CATEGORIAS_VALIDAS: CategoriaMantenimiento[] = [
  "aceite_filtros","llantas","frenos","liquidos","bateria",
  "alineacion_balanceo","suspension","transmision","electricidad",
  "revision_general","otro",
];
const TIPOS_VALIDOS: TipoMantenimiento[] = ["preventivo", "correctivo"];
const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (profile.rol === "visor")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;

  const mant = await prisma.mantenimiento.findUnique({
    where: { id },
    include: { vehiculo: { select: { id: true, sucursalId: true, kmActuales: true } } },
  });
  if (!mant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (profile.rol === "jefe_sucursal" && mant.vehiculo.sucursalId !== profile.sucursalId)
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const formData = await req.formData();

  const categoria    = formData.get("categoria") as string | null;
  const tipo         = formData.get("tipo") as string | null;
  const descripcion  = formData.get("descripcion") as string | null;
  const fecha        = formData.get("fecha") as string | null;
  const odometroRaw  = formData.get("odometroKm") as string | null;
  const costoRaw     = formData.get("costoSoles") as string | null;
  const taller       = formData.get("taller") as string | null;
  const proximoKmRaw = formData.get("proximoKm") as string | null;
  const proximaFecha = formData.get("proximaFecha") as string | null;
  const notas        = formData.get("notas") as string | null;
  const evidenciaFile = formData.get("evidencia") as File | null;
  const quitarEvidencia = formData.get("quitarEvidencia") === "1";

  if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria as CategoriaMantenimiento))
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  if (!tipo || !TIPOS_VALIDOS.includes(tipo as TipoMantenimiento))
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  if (!descripcion?.trim())
    return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
  if (!fecha)
    return NextResponse.json({ error: "La fecha es requerida" }, { status: 400 });
  if (!odometroRaw || isNaN(Number(odometroRaw)) || Number(odometroRaw) < 0)
    return NextResponse.json({ error: "El odómetro es requerido" }, { status: 400 });

  let evidenciaKey = mant.evidenciaKey;

  if (quitarEvidencia && evidenciaKey) {
    try { await deleteFile(evidenciaKey); } catch { /* continuar */ }
    evidenciaKey = null;
  }

  if (evidenciaFile && evidenciaFile.size > 0) {
    if (!MIME_PERMITIDOS.includes(evidenciaFile.type))
      return NextResponse.json({ error: "Evidencia: solo JPG, PNG, WEBP o PDF" }, { status: 400 });
    if (evidenciaFile.size > MAX_BYTES)
      return NextResponse.json({ error: "Evidencia: máximo 10 MB" }, { status: 400 });
    if (evidenciaKey) {
      try { await deleteFile(evidenciaKey); } catch { /* continuar */ }
    }
    const ext = evidenciaFile.name.split(".").pop() ?? "jpg";
    evidenciaKey = `vehiculos/${mant.vehiculoId}/mantenimientos/${crypto.randomUUID()}.${ext}`;
    await uploadFile(evidenciaKey, Buffer.from(await evidenciaFile.arrayBuffer()), evidenciaFile.type);
  }

  await prisma.mantenimiento.update({
    where: { id },
    data: {
      categoria: categoria as CategoriaMantenimiento,
      tipo: tipo as TipoMantenimiento,
      descripcion: descripcion.trim(),
      fecha: new Date(fecha),
      odometroKm: Number(odometroRaw),
      costoSoles: costoRaw && !isNaN(Number(costoRaw)) ? costoRaw : null,
      taller: taller?.trim() || null,
      proximoKm: proximoKmRaw && !isNaN(Number(proximoKmRaw)) ? Number(proximoKmRaw) : null,
      proximaFecha: proximaFecha ? new Date(proximaFecha) : null,
      evidenciaKey,
      notas: notas?.trim() || null,
    },
  });

  // Actualizar kmActuales si corresponde
  const kmNuevo = Number(odometroRaw);
  if (!mant.vehiculo.kmActuales || kmNuevo > mant.vehiculo.kmActuales) {
    await prisma.vehiculo.update({
      where: { id: mant.vehiculoId },
      data: { kmActuales: kmNuevo },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (profile.rol === "visor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const mant = await prisma.mantenimiento.findUnique({
    where: { id },
    include: { vehiculo: { select: { sucursalId: true } } },
  });

  if (!mant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (profile.rol === "jefe_sucursal" && mant.vehiculo.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (mant.evidenciaKey) {
    try { await deleteFile(mant.evidenciaKey); } catch { /* continuar si falla */ }
  }

  await prisma.mantenimiento.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
