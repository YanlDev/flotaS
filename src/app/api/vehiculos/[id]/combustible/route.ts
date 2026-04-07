import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { uploadFile, getSignedDownloadUrl } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// GET — historial de cargas del vehículo
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

  const cargas = await prisma.cargaCombustible.findMany({
    where: { vehiculoId },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    include: {
      conductor: { select: { nombreCompleto: true } },
      registrador: { select: { nombreCompleto: true } },
      revisor: { select: { nombreCompleto: true } },
    },
  });

  // Calcular rendimiento solo para cargas revisadas con odómetro
  const revisadas = [...cargas]
    .filter((c) => c.estado === "revisado" && c.odometroKm !== null)
    .sort((a, b) => (a.odometroKm ?? 0) - (b.odometroKm ?? 0));

  const rendimientoMap = new Map<string, number | null>();
  for (let i = 0; i < revisadas.length; i++) {
    if (i === 0) {
      rendimientoMap.set(revisadas[i].id, null);
    } else {
      const anterior = revisadas[i - 1];
      const actual = revisadas[i];
      const kmRecorridos = (actual.odometroKm ?? 0) - (anterior.odometroKm ?? 0);
      if (kmRecorridos > 0 && actual.galones && Number(actual.galones) > 0) {
        rendimientoMap.set(actual.id, kmRecorridos / Number(actual.galones));
      } else {
        rendimientoMap.set(actual.id, null);
      }
    }
  }

  const resultado = await Promise.all(
    cargas.map(async (c) => {
      const kmRecorridos = (() => {
        if (c.odometroKm === null) return null;
        const idx = revisadas.findIndex((x) => x.id === c.id);
        if (idx <= 0) return null;
        return (c.odometroKm ?? 0) - (revisadas[idx - 1].odometroKm ?? 0);
      })();

      return {
        id: c.id,
        fecha: c.fecha.toISOString().split("T")[0],
        estado: c.estado,
        odometroKm: c.odometroKm,
        galones: c.galones !== null ? Number(c.galones) : null,
        precioPorGalon: c.precioPorGalon !== null ? Number(c.precioPorGalon) : null,
        totalSoles: c.totalSoles !== null ? Number(c.totalSoles) : null,
        tipoCombustible: c.tipoCombustible,
        notas: c.notas,
        conductorNombre: c.conductor?.nombreCompleto ?? null,
        registradorNombre: c.registrador?.nombreCompleto ?? null,
        revisorNombre: c.revisor?.nombreCompleto ?? null,
        revisadoAt: c.revisadoAt?.toISOString() ?? null,
        kmRecorridos,
        rendimientoKmGalon: rendimientoMap.get(c.id) ?? null,
        costoPorKm:
          kmRecorridos && kmRecorridos > 0 && c.totalSoles
            ? Number(c.totalSoles) / kmRecorridos
            : null,
        comprobanteUrl: c.comprobanteKey
          ? await getSignedDownloadUrl(c.comprobanteKey, 3600)
          : null,
        odometroFotoUrl: c.odometroFotoKey
          ? await getSignedDownloadUrl(c.odometroFotoKey, 3600)
          : null,
        createdAt: c.createdAt.toISOString(),
      };
    })
  );

  return NextResponse.json(resultado);
}

// POST — registrar nueva carga (solo fotos + fecha)
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
  const fecha = (formData.get("fecha") as string | null) ?? new Date().toISOString().split("T")[0];
  const comprobanteFile = formData.get("comprobante") as File | null;
  const odometroFotoFile = formData.get("odometroFoto") as File | null;

  if (!comprobanteFile || comprobanteFile.size === 0) {
    return NextResponse.json({ error: "La foto del comprobante es requerida" }, { status: 400 });
  }
  if (!odometroFotoFile || odometroFotoFile.size === 0) {
    return NextResponse.json({ error: "La foto del odómetro es requerida" }, { status: 400 });
  }

  // Validar comprobante
  if (!MIME_PERMITIDOS.includes(comprobanteFile.type)) {
    return NextResponse.json({ error: "Comprobante: solo JPG, PNG, WEBP o PDF" }, { status: 400 });
  }
  if (comprobanteFile.size > MAX_BYTES) {
    return NextResponse.json({ error: "Comprobante: máximo 10 MB" }, { status: 400 });
  }

  // Validar foto odómetro
  if (!MIME_PERMITIDOS.includes(odometroFotoFile.type)) {
    return NextResponse.json({ error: "Foto odómetro: solo JPG, PNG o WEBP" }, { status: 400 });
  }
  if (odometroFotoFile.size > MAX_BYTES) {
    return NextResponse.json({ error: "Foto odómetro: máximo 10 MB" }, { status: 400 });
  }

  // Subir fotos a Wasabi
  const extComprobante = comprobanteFile.name.split(".").pop() ?? "jpg";
  const comprobanteKey = `vehiculos/${vehiculoId}/combustible/${crypto.randomUUID()}-comprobante.${extComprobante}`;
  await uploadFile(comprobanteKey, Buffer.from(await comprobanteFile.arrayBuffer()), comprobanteFile.type);

  const extOdometro = odometroFotoFile.name.split(".").pop() ?? "jpg";
  const odometroFotoKey = `vehiculos/${vehiculoId}/combustible/${crypto.randomUUID()}-odometro.${extOdometro}`;
  await uploadFile(odometroFotoKey, Buffer.from(await odometroFotoFile.arrayBuffer()), odometroFotoFile.type);

  const carga = await prisma.cargaCombustible.create({
    data: {
      vehiculoId,
      fecha: new Date(fecha),
      estado: "pendiente",
      comprobanteKey,
      odometroFotoKey,
      registradoPor: profile.id,
    },
  });

  return NextResponse.json({ id: carga.id }, { status: 201 });
}
