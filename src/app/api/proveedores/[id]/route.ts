import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { uploadFile, deleteFile } from "@/lib/wasabi";
import { NextRequest, NextResponse } from "next/server";

const ROLES_PERMITIDOS = ["admin", "comercial"] as const;
const MAX_BYTES = 10 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

async function getProveedorAutorizado(id: string, profileId: string, rol: string, sucursalId: string | null) {
  const proveedor = await prisma.proveedor.findFirst({ where: { id, deletedAt: null } });
  if (!proveedor) return null;
  // comercial solo puede ver su sucursal
  if (rol === "comercial" && proveedor.sucursalId !== sucursalId) return null;
  return proveedor;
}

// GET — detalle proveedor
export async function GET(_req: NextRequest, { params }: Params) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const proveedor = await getProveedorAutorizado(id, profile.id, profile.rol, profile.sucursalId ?? null);
  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });

  const detalle = await prisma.proveedor.findUnique({
    where: { id },
    include: {
      sucursal: { select: { id: true, nombre: true, ciudad: true } },
      creador: { select: { nombreCompleto: true } },
      placas: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          placa: true,
          tenencia: true,
          licenciaConducirKey: true,
          tarjetaPropiedadKey: true,
          contratoArrendamientoKey: true,
          fechaCaducidadContrato: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json(detalle);
}

// PATCH — editar proveedor (acepta form-data o json)
export async function PATCH(req: NextRequest, { params }: Params) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_PERMITIDOS.includes(profile.rol as (typeof ROLES_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const proveedor = await getProveedorAutorizado(id, profile.id, profile.rol, profile.sucursalId ?? null);
  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";
  let fichaRucKey: string | undefined;

  let body: {
    razonSocial?: string;
    usuarioSunat?: string;
    sol?: string;
    dni?: string;
    direccionConcesion?: string;
    sucursalId?: string | null;
  };

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    body = {
      razonSocial: (formData.get("razonSocial") as string | null)?.trim() || undefined,
      usuarioSunat: (formData.get("usuarioSunat") as string | null)?.trim() || undefined,
      sol: (formData.get("sol") as string | null)?.trim() || undefined,
      dni: (formData.get("dni") as string | null)?.trim() || undefined,
      direccionConcesion: (formData.get("direccionConcesion") as string | null)?.trim() || undefined,
    };
    const nuevaFicha = formData.get("fichaRuc") as File | null;
    if (nuevaFicha) {
      if (nuevaFicha.type !== "application/pdf") {
        return NextResponse.json({ error: "La Ficha RUC debe ser un PDF" }, { status: 400 });
      }
      if (nuevaFicha.size > MAX_BYTES) {
        return NextResponse.json({ error: "El archivo no puede superar 10 MB" }, { status: 400 });
      }
      // Eliminar anterior si existe
      if (proveedor.fichaRucKey) await deleteFile(proveedor.fichaRucKey).catch(() => null);
      const key = `proveedores/${id}/ficha-ruc.pdf`;
      await uploadFile(key, Buffer.from(await nuevaFicha.arrayBuffer()), "application/pdf");
      fichaRucKey = key;
    }
  } else {
    body = await req.json() as typeof body;
  }

  const actualizado = await prisma.proveedor.update({
    where: { id },
    data: {
      ...(body.razonSocial && { razonSocial: body.razonSocial }),
      ...(body.usuarioSunat && { usuarioSunat: body.usuarioSunat }),
      ...(body.sol && { sol: body.sol }),
      ...(body.dni && { dni: body.dni }),
      ...(body.direccionConcesion && { direccionConcesion: body.direccionConcesion }),
      ...(fichaRucKey && { fichaRucKey }),
    },
    include: { sucursal: { select: { nombre: true } } },
  });

  return NextResponse.json(actualizado);
}

// DELETE — soft delete proveedor (solo admin)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (profile.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede eliminar proveedores" }, { status: 403 });
  }

  const { id } = await params;
  const proveedor = await prisma.proveedor.findFirst({ where: { id, deletedAt: null } });
  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });

  await prisma.proveedor.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
