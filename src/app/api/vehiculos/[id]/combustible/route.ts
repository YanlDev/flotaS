import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { uploadFile, getSignedDownloadUrl } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";
import { CombustibleTipo } from "@/generated/prisma/client";

const TIPOS_VALIDOS: CombustibleTipo[] = ["gasolina", "diesel", "glp", "gnv", "electrico", "hibrido"];
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
    },
  });

  // Calcular rendimiento: para cada carga buscar la carga anterior por odómetro
  const cargasOrdenadas = [...cargas].sort((a, b) => a.odometroKm - b.odometroKm);

  const rendimientoMap = new Map<string, number | null>();
  for (let i = 0; i < cargasOrdenadas.length; i++) {
    if (i === 0) {
      rendimientoMap.set(cargasOrdenadas[i].id, null); // primera carga, sin referencia anterior
    } else {
      const anterior = cargasOrdenadas[i - 1];
      const actual = cargasOrdenadas[i];
      const kmRecorridos = actual.odometroKm - anterior.odometroKm;
      if (kmRecorridos > 0 && Number(actual.galones) > 0) {
        rendimientoMap.set(actual.id, kmRecorridos / Number(actual.galones));
      } else {
        rendimientoMap.set(actual.id, null);
      }
    }
  }

  // Generar signed URLs para fotos
  const resultado = await Promise.all(
    cargas.map(async (c) => {
      const kmRecorridos = (() => {
        const idx = cargasOrdenadas.findIndex((x) => x.id === c.id);
        if (idx <= 0) return null;
        return c.odometroKm - cargasOrdenadas[idx - 1].odometroKm;
      })();

      return {
        id: c.id,
        fecha: c.fecha.toISOString().split("T")[0],
        odometroKm: c.odometroKm,
        galones: Number(c.galones),
        precioPorGalon: Number(c.precioPorGalon),
        totalSoles: Number(c.totalSoles),
        tipoCombustible: c.tipoCombustible,
        estacion: c.estacion,
        ciudad: c.ciudad,
        notas: c.notas,
        conductorNombre: c.conductor?.nombreCompleto ?? null,
        registradorNombre: c.registrador?.nombreCompleto ?? null,
        kmRecorridos,
        rendimientoKmGalon: rendimientoMap.get(c.id) ?? null,
        costoPorKm: kmRecorridos && kmRecorridos > 0
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

// POST — registrar nueva carga
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

  const fecha = formData.get("fecha") as string | null;
  const galonesRaw = formData.get("galones") as string | null;
  const precioPorGalonRaw = formData.get("precioPorGalon") as string | null;
  const totalSolesRaw = formData.get("totalSoles") as string | null;
  const tipoCombustible = formData.get("tipoCombustible") as string | null;
  const odometroKmRaw = formData.get("odometroKm") as string | null;
  const estacion = formData.get("estacion") as string | null;
  const ciudad = formData.get("ciudad") as string | null;
  const conductorId = formData.get("conductorId") as string | null;
  const notas = formData.get("notas") as string | null;
  const comprobanteFile = formData.get("comprobante") as File | null;
  const odometroFotoFile = formData.get("odometroFoto") as File | null;

  // Validaciones
  if (!fecha) return NextResponse.json({ error: "La fecha es requerida" }, { status: 400 });
  if (!galonesRaw || isNaN(Number(galonesRaw)) || Number(galonesRaw) <= 0)
    return NextResponse.json({ error: "Los galones deben ser un número mayor a 0" }, { status: 400 });
  if (!precioPorGalonRaw || isNaN(Number(precioPorGalonRaw)) || Number(precioPorGalonRaw) <= 0)
    return NextResponse.json({ error: "El precio por galón es requerido" }, { status: 400 });
  if (!totalSolesRaw || isNaN(Number(totalSolesRaw)) || Number(totalSolesRaw) <= 0)
    return NextResponse.json({ error: "El total en soles es requerido" }, { status: 400 });
  if (!tipoCombustible || !TIPOS_VALIDOS.includes(tipoCombustible as CombustibleTipo))
    return NextResponse.json({ error: "Tipo de combustible inválido" }, { status: 400 });
  if (!odometroKmRaw || isNaN(Number(odometroKmRaw)) || Number(odometroKmRaw) < 0)
    return NextResponse.json({ error: "El odómetro es requerido" }, { status: 400 });

  // Validar que odómetro no sea menor al de la última carga
  const ultimaCarga = await prisma.cargaCombustible.findFirst({
    where: { vehiculoId },
    orderBy: { odometroKm: "desc" },
  });
  if (ultimaCarga && Number(odometroKmRaw) < ultimaCarga.odometroKm) {
    return NextResponse.json(
      { error: `El odómetro no puede ser menor al de la última carga (${ultimaCarga.odometroKm} km)` },
      { status: 400 }
    );
  }

  // Subir archivos opcionales
  let comprobanteKey: string | null = null;
  let odometroFotoKey: string | null = null;

  if (comprobanteFile && comprobanteFile.size > 0) {
    if (!MIME_PERMITIDOS.includes(comprobanteFile.type))
      return NextResponse.json({ error: "Comprobante: solo JPG, PNG, WEBP o PDF" }, { status: 400 });
    if (comprobanteFile.size > MAX_BYTES)
      return NextResponse.json({ error: "Comprobante: máximo 10 MB" }, { status: 400 });
    const ext = comprobanteFile.name.split(".").pop() ?? "jpg";
    comprobanteKey = `vehiculos/${vehiculoId}/combustible/${crypto.randomUUID()}-comprobante.${ext}`;
    await uploadFile(comprobanteKey, Buffer.from(await comprobanteFile.arrayBuffer()), comprobanteFile.type);
  }

  if (odometroFotoFile && odometroFotoFile.size > 0) {
    if (!MIME_PERMITIDOS.includes(odometroFotoFile.type))
      return NextResponse.json({ error: "Foto odómetro: solo JPG, PNG o WEBP" }, { status: 400 });
    if (odometroFotoFile.size > MAX_BYTES)
      return NextResponse.json({ error: "Foto odómetro: máximo 10 MB" }, { status: 400 });
    const ext = odometroFotoFile.name.split(".").pop() ?? "jpg";
    odometroFotoKey = `vehiculos/${vehiculoId}/combustible/${crypto.randomUUID()}-odometro.${ext}`;
    await uploadFile(odometroFotoKey, Buffer.from(await odometroFotoFile.arrayBuffer()), odometroFotoFile.type);
  }

  const carga = await prisma.cargaCombustible.create({
    data: {
      vehiculoId,
      conductorId: conductorId || null,
      fecha: new Date(fecha),
      galones: galonesRaw,
      precioPorGalon: precioPorGalonRaw,
      totalSoles: totalSolesRaw,
      tipoCombustible: tipoCombustible as CombustibleTipo,
      odometroKm: Number(odometroKmRaw),
      estacion: estacion || null,
      ciudad: ciudad || null,
      comprobanteKey,
      odometroFotoKey,
      registradoPor: profile.id,
      notas: notas || null,
    },
  });

  // Actualizar kmActuales del vehículo si el odómetro es mayor al actual
  if (!vehiculo.kmActuales || Number(odometroKmRaw) > vehiculo.kmActuales) {
    await prisma.vehiculo.update({
      where: { id: vehiculoId },
      data: { kmActuales: Number(odometroKmRaw) },
    });
  }

  return NextResponse.json({ id: carga.id }, { status: 201 });
}
