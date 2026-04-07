import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { deleteFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";
import { CombustibleTipo } from "@/generated/prisma/client";

const TIPOS_VALIDOS: CombustibleTipo[] = ["gasolina", "diesel", "glp", "gnv", "electrico", "hibrido"];

// PATCH — revisar y completar datos de una carga pendiente
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (profile.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede revisar cargas" }, { status: 403 });
  }

  const { id } = await params;

  const carga = await prisma.cargaCombustible.findUnique({
    where: { id },
    include: { vehiculo: { select: { sucursalId: true, id: true, kmActuales: true } } },
  });

  if (!carga) return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 });

  if (carga.estado !== "pendiente") {
    return NextResponse.json({ error: "Esta carga ya fue revisada" }, { status: 409 });
  }

  const body = await req.json() as {
    odometroKm?: unknown;
    galones?: unknown;
    precioPorGalon?: unknown;
    tipoCombustible?: unknown;
    notas?: unknown;
  };

  const odometroKm = Number(body.odometroKm);
  const galones = Number(body.galones);
  const precioPorGalon = Number(body.precioPorGalon);
  const tipoCombustible = body.tipoCombustible as string | undefined;

  if (!body.odometroKm || isNaN(odometroKm) || odometroKm < 0) {
    return NextResponse.json({ error: "El odómetro es requerido" }, { status: 400 });
  }
  if (!body.galones || isNaN(galones) || galones <= 0) {
    return NextResponse.json({ error: "Los galones deben ser mayores a 0" }, { status: 400 });
  }
  if (!body.precioPorGalon || isNaN(precioPorGalon) || precioPorGalon <= 0) {
    return NextResponse.json({ error: "El precio por galón es requerido" }, { status: 400 });
  }
  if (!tipoCombustible || !TIPOS_VALIDOS.includes(tipoCombustible as CombustibleTipo)) {
    return NextResponse.json({ error: "Tipo de combustible inválido" }, { status: 400 });
  }

  // Validar odómetro no sea menor al de la última carga revisada
  const ultimaRevisada = await prisma.cargaCombustible.findFirst({
    where: { vehiculoId: carga.vehiculoId, estado: "revisado", id: { not: id } },
    orderBy: { odometroKm: "desc" },
  });
  if (ultimaRevisada && ultimaRevisada.odometroKm && odometroKm < ultimaRevisada.odometroKm) {
    return NextResponse.json(
      { error: `El odómetro no puede ser menor al de la última carga revisada (${ultimaRevisada.odometroKm} km)` },
      { status: 400 }
    );
  }

  const totalSoles = galones * precioPorGalon;

  await prisma.cargaCombustible.update({
    where: { id },
    data: {
      odometroKm,
      galones: galones.toString(),
      precioPorGalon: precioPorGalon.toString(),
      totalSoles: totalSoles.toFixed(2),
      tipoCombustible: tipoCombustible as CombustibleTipo,
      notas: typeof body.notas === "string" ? body.notas || null : null,
      estado: "revisado",
      revisadoPor: profile.id,
      revisadoAt: new Date(),
    },
  });

  // Actualizar kmActuales del vehículo si corresponde
  if (!carga.vehiculo.kmActuales || odometroKm > carga.vehiculo.kmActuales) {
    await prisma.vehiculo.update({
      where: { id: carga.vehiculo.id },
      data: { kmActuales: odometroKm },
    });
  }

  return NextResponse.json({ success: true });
}

// DELETE — eliminar carga (admin o jefe de la sucursal del vehículo)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (profile.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede eliminar cargas" }, { status: 403 });
  }

  const { id } = await params;

  const carga = await prisma.cargaCombustible.findUnique({
    where: { id },
    include: { vehiculo: { select: { sucursalId: true } } },
  });

  if (!carga) return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 });

  if (carga.comprobanteKey) {
    try { await deleteFile(carga.comprobanteKey); } catch { /* continuar si falla */ }
  }
  if (carga.odometroFotoKey) {
    try { await deleteFile(carga.odometroFotoKey); } catch { /* continuar si falla */ }
  }

  await prisma.cargaCombustible.deleteMany({ where: { id } });

  return NextResponse.json({ success: true });
}
