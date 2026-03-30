import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { uploadFile, getSignedDownloadUrl } from "@/lib/wasabi";
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

// GET — historial de mantenimientos del vehículo
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

  const mantenimientos = await prisma.mantenimiento.findMany({
    where: { vehiculoId },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    include: { registrador: { select: { nombreCompleto: true } } },
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const resultado = await Promise.all(
    mantenimientos.map(async (m) => {
      // Estado de alerta del próximo mantenimiento
      const alertaKm = (() => {
        if (!m.proximoKm || !vehiculo.kmActuales) return null;
        const diff = m.proximoKm - vehiculo.kmActuales;
        if (diff <= 0) return "vencido";
        if (diff <= 1000) return "proximo";
        return "ok";
      })();

      const alertaFecha = (() => {
        if (!m.proximaFecha) return null;
        const diff = Math.ceil((m.proximaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) return "vencido";
        if (diff <= 30) return "proximo";
        return "ok";
      })();

      return {
        id: m.id,
        categoria: m.categoria,
        tipo: m.tipo,
        descripcion: m.descripcion,
        fecha: m.fecha.toISOString().split("T")[0],
        odometroKm: m.odometroKm,
        costoSoles: m.costoSoles ? Number(m.costoSoles) : null,
        taller: m.taller,
        proximoKm: m.proximoKm,
        proximaFecha: m.proximaFecha ? m.proximaFecha.toISOString().split("T")[0] : null,
        alertaKm,
        alertaFecha,
        notas: m.notas,
        registradorNombre: m.registrador?.nombreCompleto ?? null,
        evidenciaUrl: m.evidenciaKey
          ? await getSignedDownloadUrl(m.evidenciaKey, 3600)
          : null,
        createdAt: m.createdAt.toISOString(),
      };
    })
  );

  return NextResponse.json(resultado);
}

// POST — registrar mantenimiento
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

  let evidenciaKey: string | null = null;
  if (evidenciaFile && evidenciaFile.size > 0) {
    if (!MIME_PERMITIDOS.includes(evidenciaFile.type))
      return NextResponse.json({ error: "Evidencia: solo JPG, PNG, WEBP o PDF" }, { status: 400 });
    if (evidenciaFile.size > MAX_BYTES)
      return NextResponse.json({ error: "Evidencia: máximo 10 MB" }, { status: 400 });
    const ext = evidenciaFile.name.split(".").pop() ?? "jpg";
    evidenciaKey = `vehiculos/${vehiculoId}/mantenimientos/${crypto.randomUUID()}.${ext}`;
    await uploadFile(evidenciaKey, Buffer.from(await evidenciaFile.arrayBuffer()), evidenciaFile.type);
  }

  const mant = await prisma.mantenimiento.create({
    data: {
      vehiculoId,
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
      registradoPor: profile.id,
      notas: notas?.trim() || null,
    },
  });

  // Actualizar kmActuales si el odómetro registrado es mayor
  if (!vehiculo.kmActuales || Number(odometroRaw) > vehiculo.kmActuales) {
    await prisma.vehiculo.update({
      where: { id: vehiculoId },
      data: { kmActuales: Number(odometroRaw) },
    });
  }

  return NextResponse.json({ id: mant.id }, { status: 201 });
}
