import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { uploadFile, getSignedDownloadUrl } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";
import { TenenciaVehiculo } from "@/generated/prisma/client";

const ROLES_PERMITIDOS = ["admin", "comercial"] as const;
const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

async function getProveedorAutorizado(proveedorId: string, rol: string, sucursalId: string | null) {
  const proveedor = await prisma.proveedor.findFirst({ where: { id: proveedorId, deletedAt: null } });
  if (!proveedor) return null;
  if (rol === "comercial" && proveedor.sucursalId !== sucursalId) return null;
  return proveedor;
}

// GET — listar placas del proveedor con URLs firmadas
export async function GET(_req: NextRequest, { params }: Params) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: proveedorId } = await params;
  const proveedor = await getProveedorAutorizado(proveedorId, profile.rol, profile.sucursalId ?? null);
  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });

  const placas = await prisma.placaProveedor.findMany({
    where: { proveedorId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { creador: { select: { nombreCompleto: true } } },
  });

  const placasConUrls = await Promise.all(
    placas.map(async (p) => ({
      id: p.id,
      placa: p.placa,
      tenencia: p.tenencia,
      fechaCaducidadContrato: p.fechaCaducidadContrato
        ? p.fechaCaducidadContrato.toISOString().split("T")[0]
        : null,
      nombrePropietario: p.nombrePropietario,
      nombreConductor: p.nombreConductor,
      numeroLicencia: p.numeroLicencia,
      enPlanilla: p.enPlanilla,
      createdAt: p.createdAt.toISOString(),
      registradoPor: p.creador?.nombreCompleto ?? null,
      licenciaConducirUrl: p.licenciaConducirKey
        ? await getSignedDownloadUrl(p.licenciaConducirKey, 3600)
        : null,
      tarjetaPropiedadUrl: p.tarjetaPropiedadKey
        ? await getSignedDownloadUrl(p.tarjetaPropiedadKey, 3600)
        : null,
      contratoArrendamientoUrl: p.contratoArrendamientoKey
        ? await getSignedDownloadUrl(p.contratoArrendamientoKey, 3600)
        : null,
    }))
  );

  return NextResponse.json(placasConUrls);
}

// POST — registrar placa de proveedor
export async function POST(req: NextRequest, { params }: Params) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: proveedorId } = await params;
  const proveedor = await getProveedorAutorizado(proveedorId, profile.rol, profile.sucursalId ?? null);
  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });

  const formData = await req.formData();
  const placa = (formData.get("placa") as string | null)?.trim().toUpperCase();
  const tenencia = formData.get("tenencia") as TenenciaVehiculo | null;
  const fechaCaducidadContrato = formData.get("fechaCaducidadContrato") as string | null;
  const nombrePropietario = (formData.get("nombrePropietario") as string | null)?.trim() || null;
  const nombreConductor = (formData.get("nombreConductor") as string | null)?.trim() || null;
  const numeroLicencia = (formData.get("numeroLicencia") as string | null)?.trim() || null;
  const enPlanilla = formData.get("enPlanilla") === "true";
  const licenciaConducir = formData.get("licenciaConducir") as File | null;
  const tarjetaPropiedad = formData.get("tarjetaPropiedad") as File | null;
  const contratoArrendamiento = formData.get("contratoArrendamiento") as File | null;

  if (!placa) return NextResponse.json({ error: "La placa es requerida" }, { status: 400 });
  if (!tenencia || !["propio", "arrendado"].includes(tenencia)) {
    return NextResponse.json({ error: "La tenencia debe ser 'propio' o 'arrendado'" }, { status: 400 });
  }
  if (!nombreConductor) return NextResponse.json({ error: "El nombre del conductor es requerido" }, { status: 400 });
  if (!numeroLicencia) return NextResponse.json({ error: "El número de licencia es requerido" }, { status: 400 });
  if (!licenciaConducir) {
    return NextResponse.json({ error: "La licencia de conducir es requerida" }, { status: 400 });
  }
  if (tenencia === "propio" && !tarjetaPropiedad) {
    return NextResponse.json({ error: "La tarjeta de propiedad es requerida para vehículo propio" }, { status: 400 });
  }
  if (tenencia === "arrendado") {
    if (!contratoArrendamiento) {
      return NextResponse.json({ error: "El contrato de arrendamiento es requerido" }, { status: 400 });
    }
    if (!fechaCaducidadContrato) {
      return NextResponse.json({ error: "La fecha de caducidad del contrato es requerida" }, { status: 400 });
    }
    if (!nombrePropietario) {
      return NextResponse.json({ error: "El nombre del propietario es requerido para vehículo arrendado" }, { status: 400 });
    }
  }

  // Validar archivos
  const archivos: { file: File; nombre: string }[] = [
    { file: licenciaConducir, nombre: "licencia de conducir" },
    ...(tarjetaPropiedad ? [{ file: tarjetaPropiedad, nombre: "tarjeta de propiedad" }] : []),
    ...(contratoArrendamiento ? [{ file: contratoArrendamiento, nombre: "contrato de arrendamiento" }] : []),
  ];
  for (const { file, nombre } of archivos) {
    if (!MIME_PERMITIDOS.includes(file.type)) {
      return NextResponse.json({ error: `El archivo de ${nombre} debe ser PDF, JPG o PNG` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `El archivo de ${nombre} no puede superar 10 MB` }, { status: 400 });
    }
  }

  try {
    // Crear registro para obtener el ID
    const registro = await prisma.placaProveedor.create({
      data: {
        proveedorId,
        placa,
        tenencia,
        fechaCaducidadContrato: fechaCaducidadContrato ? new Date(fechaCaducidadContrato) : null,
        nombrePropietario,
        nombreConductor,
        numeroLicencia,
        enPlanilla,
        createdBy: profile.id,
      },
    });

    // Subir documentos en paralelo
    const uploads: Promise<void>[] = [];
    const updates: Record<string, string> = {};

    const subirArchivo = async (file: File, campo: string, nombreArchivo: string) => {
      const ext = file.name.split(".").pop() ?? "pdf";
      const key = `proveedores/${proveedorId}/placas/${registro.id}/${nombreArchivo}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadFile(key, buffer, file.type);
      updates[campo] = key;
    };

    uploads.push(subirArchivo(licenciaConducir, "licenciaConducirKey", "licencia-conducir"));
    if (tarjetaPropiedad) {
      uploads.push(subirArchivo(tarjetaPropiedad, "tarjetaPropiedadKey", "tarjeta-propiedad"));
    }
    if (contratoArrendamiento) {
      uploads.push(subirArchivo(contratoArrendamiento, "contratoArrendamientoKey", "contrato-arrendamiento"));
    }
    await Promise.all(uploads);

    const actualizado = await prisma.placaProveedor.update({
      where: { id: registro.id },
      data: updates,
    });

    return NextResponse.json(actualizado, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
      return NextResponse.json({ error: "Ya existe una placa con ese número" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al registrar la placa" }, { status: 500 });
  }
}
