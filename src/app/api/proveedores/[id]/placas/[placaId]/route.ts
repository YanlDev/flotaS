import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { uploadFile, deleteFile, getSignedDownloadUrl } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

const ROLES_PERMITIDOS = ["admin", "comercial"] as const;
const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

type Params = { params: Promise<{ id: string; placaId: string }> };

async function getPlacaAutorizada(placaId: string, proveedorId: string, rol: string, sucursalId: string | null) {
  const placa = await prisma.placaProveedor.findFirst({
    where: { id: placaId, proveedorId, deletedAt: null },
    include: { proveedor: { select: { sucursalId: true } } },
  });
  if (!placa) return null;
  if (rol === "comercial" && placa.proveedor.sucursalId !== sucursalId) return null;
  return placa;
}

// GET — detalle de placa con URLs firmadas
export async function GET(_req: NextRequest, { params }: Params) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: proveedorId, placaId } = await params;
  const placa = await getPlacaAutorizada(placaId, proveedorId, profile.rol, profile.sucursalId ?? null);
  if (!placa) return NextResponse.json({ error: "Placa no encontrada" }, { status: 404 });

  return NextResponse.json({
    id: placa.id,
    placa: placa.placa,
    tenencia: placa.tenencia,
    fechaCaducidadContrato: placa.fechaCaducidadContrato
      ? placa.fechaCaducidadContrato.toISOString().split("T")[0]
      : null,
    nombreConductor: placa.nombreConductor,
    numeroLicencia: placa.numeroLicencia,
    enPlanilla: placa.enPlanilla,
    createdAt: placa.createdAt.toISOString(),
    licenciaConducirUrl: placa.licenciaConducirKey
      ? await getSignedDownloadUrl(placa.licenciaConducirKey, 3600)
      : null,
    tarjetaPropiedadUrl: placa.tarjetaPropiedadKey
      ? await getSignedDownloadUrl(placa.tarjetaPropiedadKey, 3600)
      : null,
    contratoArrendamientoUrl: placa.contratoArrendamientoKey
      ? await getSignedDownloadUrl(placa.contratoArrendamientoKey, 3600)
      : null,
  });
}

// PATCH — editar placa (fecha caducidad, reemplazar documentos)
export async function PATCH(req: NextRequest, { params }: Params) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: proveedorId, placaId } = await params;
  const placa = await getPlacaAutorizada(placaId, proveedorId, profile.rol, profile.sucursalId ?? null);
  if (!placa) return NextResponse.json({ error: "Placa no encontrada" }, { status: 404 });

  const formData = await req.formData();
  const fechaCaducidad = formData.get("fechaCaducidadContrato") as string | null;
  const nombreConductor = formData.get("nombreConductor") as string | null;
  const numeroLicencia = formData.get("numeroLicencia") as string | null;
  const enPlanillaRaw = formData.get("enPlanilla") as string | null;
  const licenciaConducir = formData.get("licenciaConducir") as File | null;
  const tarjetaPropiedad = formData.get("tarjetaPropiedad") as File | null;
  const contratoArrendamiento = formData.get("contratoArrendamiento") as File | null;

  const updates: Record<string, unknown> = {};
  if (fechaCaducidad !== null) {
    updates["fechaCaducidadContrato"] = fechaCaducidad ? new Date(fechaCaducidad) : null;
  }
  if (nombreConductor !== null) updates["nombreConductor"] = nombreConductor.trim() || null;
  if (numeroLicencia !== null) updates["numeroLicencia"] = numeroLicencia.trim() || null;
  if (enPlanillaRaw !== null) updates["enPlanilla"] = enPlanillaRaw === "true";

  const reemplazarDoc = async (file: File, keyActual: string | null, campo: string, nombreArchivo: string) => {
    if (!MIME_PERMITIDOS.includes(file.type)) throw new Error(`Tipo de archivo inválido para ${nombreArchivo}`);
    if (file.size > MAX_BYTES) throw new Error(`Archivo demasiado grande para ${nombreArchivo}`);
    if (keyActual) await deleteFile(keyActual).catch(() => null);
    const ext = file.name.split(".").pop() ?? "pdf";
    const key = `proveedores/${proveedorId}/placas/${placaId}/${nombreArchivo}.${ext}`;
    await uploadFile(key, Buffer.from(await file.arrayBuffer()), file.type);
    updates[campo] = key;
  };

  try {
    const tareas: Promise<void>[] = [];
    if (licenciaConducir) tareas.push(reemplazarDoc(licenciaConducir, placa.licenciaConducirKey, "licenciaConducirKey", "licencia-conducir"));
    if (tarjetaPropiedad) tareas.push(reemplazarDoc(tarjetaPropiedad, placa.tarjetaPropiedadKey, "tarjetaPropiedadKey", "tarjeta-propiedad"));
    if (contratoArrendamiento) tareas.push(reemplazarDoc(contratoArrendamiento, placa.contratoArrendamientoKey, "contratoArrendamientoKey", "contrato-arrendamiento"));
    await Promise.all(tareas);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al procesar archivos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No hay cambios que aplicar" }, { status: 400 });
  }

  const actualizado = await prisma.placaProveedor.update({
    where: { id: placaId },
    data: updates,
  });

  return NextResponse.json(actualizado);
}

// DELETE — soft delete placa (solo admin)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (profile.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede eliminar placas" }, { status: 403 });
  }

  const { id: proveedorId, placaId } = await params;
  const placa = await prisma.placaProveedor.findFirst({
    where: { id: placaId, proveedorId, deletedAt: null },
  });
  if (!placa) return NextResponse.json({ error: "Placa no encontrada" }, { status: 404 });

  await prisma.placaProveedor.update({
    where: { id: placaId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
