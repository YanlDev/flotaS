import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TipoVehiculo,
  TransmisionTipo,
  TraccionTipo,
  CombustibleTipo,
  EstadoVehiculo,
} from "@/generated/prisma/client";

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.profile.findUnique({ where: { id: user.id } });
}

// GET — listar vehículos (filtrado por RLS de rol)
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const sucursalId = searchParams.get("sucursalId");
  const estado = searchParams.get("estado") as EstadoVehiculo | null;
  const tipo = searchParams.get("tipo") as TipoVehiculo | null;
  const busqueda = searchParams.get("q");

  // El jefe de sucursal solo ve su sucursal
  const sucursalFiltro =
    profile.rol === "jefe_sucursal"
      ? profile.sucursalId ?? undefined
      : sucursalId ?? undefined;

  const vehiculos = await prisma.vehiculo.findMany({
    where: {
      deletedAt: null,
      ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
      ...(estado && { estado }),
      ...(tipo && { tipo }),
      ...(busqueda && {
        OR: [
          { placa: { contains: busqueda, mode: "insensitive" } },
          { marca: { contains: busqueda, mode: "insensitive" } },
          { modelo: { contains: busqueda, mode: "insensitive" } },
          { conductorNombre: { contains: busqueda, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      placa: true,
      tipo: true,
      marca: true,
      modelo: true,
      anio: true,
      color: true,
      estado: true,
      kmActuales: true,
      combustible: true,
      conductorNombre: true,
      conductorTel: true,
      problemaActivo: true,
      gps: true,
      createdAt: true,
      sucursal: { select: { id: true, nombre: true, ciudad: true } },
    },
  });

  return NextResponse.json(vehiculos);
}

// POST — registrar vehículo
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (profile.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede registrar vehículos" }, { status: 403 });
  }

  const body = await request.json() as {
    placa: string;
    sucursalId: string;
    tipo: TipoVehiculo;
    marca: string;
    modelo: string;
    anio: number;
    color?: string;
    motor?: string;
    numeroMotor?: string;
    numeroChasis?: string;
    rucPropietario?: string;
    transmision?: TransmisionTipo;
    traccion?: TraccionTipo;
    combustible?: CombustibleTipo;
    numAsientos?: number;
    capacidadCargaKg?: number;
    propietario?: string;
    kmActuales?: number;
    zonaOperacion?: string;
    fechaAdquisicion?: string;
    conductorId?: string;
    estado?: EstadoVehiculo;
    problemaActivo?: string;
    observaciones?: string;
    gps?: boolean;
  };

  if (!body.placa || !body.tipo || !body.marca || !body.modelo || !body.anio) {
    return NextResponse.json(
      { error: "Placa, tipo, marca, modelo y año son requeridos" },
      { status: 400 }
    );
  }

  const sucursalId = body.sucursalId;

  if (!sucursalId) {
    return NextResponse.json(
      { error: "Sucursal requerida" },
      { status: 400 }
    );
  }

  const placaNormalizada = body.placa.toUpperCase().trim();

  try {
    const vehiculo = await prisma.vehiculo.create({
      data: {
        placa: placaNormalizada,
        sucursalId,
        tipo: body.tipo,
        marca: body.marca.trim(),
        modelo: body.modelo.trim(),
        anio: body.anio,
        color: body.color?.trim() || null,
        motor: body.motor?.trim() || null,
        numeroMotor: body.numeroMotor?.trim() || null,
        numeroChasis: body.numeroChasis?.trim() || null,
        rucPropietario: body.rucPropietario?.trim() || null,
        transmision: body.transmision || null,
        traccion: body.traccion || null,
        combustible: body.combustible || null,
        numAsientos: body.numAsientos || null,
        capacidadCargaKg: body.capacidadCargaKg || null,
        propietario: body.propietario?.trim() || null,
        kmActuales: body.kmActuales || null,
        zonaOperacion: body.zonaOperacion?.trim() || null,
        fechaAdquisicion: body.fechaAdquisicion
          ? new Date(body.fechaAdquisicion)
          : null,
        estado: body.estado ?? "operativo",
        problemaActivo: body.problemaActivo?.trim() || null,
        observaciones: body.observaciones?.trim() || null,
        gps: body.gps ?? false,
        createdBy: profile.id,
      },
      include: {
        sucursal: { select: { nombre: true, ciudad: true } },
      },
    });

    // Asignar conductor si se especificó
    if (body.conductorId) {
      await prisma.conductor.update({
        where: { id: body.conductorId },
        data: { vehiculoId: vehiculo.id },
      });
    }

    return NextResponse.json(vehiculo, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
      return NextResponse.json({ error: "Ya existe un vehículo con esa placa" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al registrar el vehículo" }, { status: 500 });
  }
}
