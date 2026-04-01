import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { getSignedDownloadUrl } from "@/lib/wasabi";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { CartillaPDF, type CartillaData } from "@/lib/pdf/cartilla-pdf";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id },
    include: {
      sucursal: { select: { nombre: true, ciudad: true } },
      creador:  { select: { nombreCompleto: true } },
    },
  });

  if (!vehiculo) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // ── Obtener datos relacionados ──────────────────────────────────────────────

  const [documentosRaw, fotosRaw, mantenimientosRaw] = await Promise.all([
    prisma.documentoVehicular.findMany({
      where: { vehiculoId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.fotoVehiculo.findMany({
      where: { vehiculoId: id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mantenimiento.findMany({
      where: { vehiculoId: id },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // ── Documentos con URL firmada y estado de vencimiento ─────────────────────

  const documentos = await Promise.all(
    documentosRaw.map(async (doc) => {
      const downloadUrl = await getSignedDownloadUrl(doc.archivoKey, 7200);

      let estadoDoc: "vencido" | "proximo" | "vigente" = "vigente";
      if (doc.vencimiento) {
        const diff = Math.ceil(
          (doc.vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diff <= 0) estadoDoc = "vencido";
        else if (diff <= 30) estadoDoc = "proximo";
      }

      return {
        tipo:       doc.tipo,
        nombre:     doc.nombre,
        vencimiento: doc.vencimiento
          ? doc.vencimiento.toISOString().split("T")[0]
          : null,
        estadoDoc,
        downloadUrl,
      };
    })
  );

  // ── Mantenimientos con alertas calculadas ──────────────────────────────────

  const mantenimientos: CartillaData["mantenimientos"] = mantenimientosRaw.map((m) => {
    const alertaKm = (() => {
      if (!m.proximoKm || vehiculo.kmActuales == null) return null;
      const diff = m.proximoKm - vehiculo.kmActuales;
      if (diff <= 0) return "vencido" as const;
      if (diff <= 1000) return "proximo" as const;
      return "ok" as const;
    })();

    const alertaFecha = (() => {
      if (!m.proximaFecha) return null;
      const diff = Math.ceil(
        (m.proximaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diff <= 0) return "vencido" as const;
      if (diff <= 30) return "proximo" as const;
      return "ok" as const;
    })();

    // Construir detalle legible para alertas en el PDF
    const detalles: string[] = [];
    if (alertaKm === "vencido" && m.proximoKm) {
      detalles.push(`KM ${m.proximoKm.toLocaleString("es-PE")} superado`);
    } else if (alertaKm === "proximo" && m.proximoKm && vehiculo.kmActuales != null) {
      const restantes = m.proximoKm - vehiculo.kmActuales;
      detalles.push(`faltan ${restantes.toLocaleString("es-PE")} km`);
    }
    if (alertaFecha === "vencido" && m.proximaFecha) {
      const fechaStr = m.proximaFecha.toISOString().split("T")[0];
      const [y, mo, d] = fechaStr.split("-");
      detalles.push(`fecha ${d}/${mo}/${y} vencida`);
    } else if (alertaFecha === "proximo" && m.proximaFecha) {
      const diffDias = Math.ceil(
        (m.proximaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      );
      detalles.push(`en ${diffDias} días`);
    }

    return {
      id:           m.id,
      categoria:    m.categoria,
      tipo:         m.tipo,
      descripcion:  m.descripcion,
      fecha:        m.fecha.toISOString().split("T")[0],
      odometroKm:   m.odometroKm,
      costoSoles:   m.costoSoles ? Number(m.costoSoles) : null,
      taller:       m.taller,
      proximoKm:    m.proximoKm,
      proximaFecha: m.proximaFecha
        ? m.proximaFecha.toISOString().split("T")[0]
        : null,
      alertaKm,
      alertaFecha,
      alertaDetalle: detalles.join(" · "),
    };
  });

  // ── Fotos seleccionadas → data URL (base64) ────────────────────────────────

  const FOTOS_CARTILLA: { categoria: string; label: string }[] = [
    { categoria: "frontal",     label: "Frontal"       },
    { categoria: "posterior",   label: "Posterior"     },
    { categoria: "lateral_der", label: "Lateral der."  },
    { categoria: "lateral_izq", label: "Lateral izq."  },
  ];

  const fotos: CartillaData["fotos"] = [];

  for (const { categoria, label } of FOTOS_CARTILLA) {
    const fotoRaw = fotosRaw.find((f) => f.categoria === categoria);
    if (!fotoRaw) continue;
    try {
      const signedUrl = await getSignedDownloadUrl(fotoRaw.key, 3600);
      const imgRes    = await fetch(signedUrl);
      if (!imgRes.ok) continue;
      const buffer = await imgRes.arrayBuffer();
      const b64    = Buffer.from(buffer).toString("base64");
      const ct     = imgRes.headers.get("content-type") ?? "image/jpeg";
      fotos.push({ categoria, label, dataUrl: `data:${ct};base64,${b64}` });
    } catch {
      // Foto individual omitida si falla
    }
  }

  // ── Logo empresa → base64 ──────────────────────────────────────────────────

  let logoDataUrl: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "selcosilog.png");
    const logoBuffer = fs.readFileSync(logoPath);
    logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    // Continúa sin logo si no se encuentra el archivo
  }

  // ── Fecha del reporte ──────────────────────────────────────────────────────

  const ahora = new Date();
  const fechaReporte = ahora.toLocaleDateString("es-PE", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  }) + " " + ahora.toLocaleTimeString("es-PE", {
    hour:   "2-digit",
    minute: "2-digit",
  });

  // ── Construir data para el PDF ─────────────────────────────────────────────

  const data: CartillaData = {
    placa:            vehiculo.placa,
    tipo:             vehiculo.tipo,
    marca:            vehiculo.marca,
    modelo:           vehiculo.modelo,
    anio:             vehiculo.anio,
    color:            vehiculo.color,
    estado:           vehiculo.estado,
    motor:            vehiculo.motor,
    numeroMotor:      vehiculo.numeroMotor,
    numeroChasis:     vehiculo.numeroChasis,
    propietario:      vehiculo.propietario,
    rucPropietario:   vehiculo.rucPropietario,
    transmision:      vehiculo.transmision,
    traccion:         vehiculo.traccion,
    combustible:      vehiculo.combustible,
    numAsientos:      vehiculo.numAsientos,
    capacidadCargaKg: vehiculo.capacidadCargaKg,
    kmActuales:       vehiculo.kmActuales,
    zonaOperacion:    vehiculo.zonaOperacion,
    fechaAdquisicion: vehiculo.fechaAdquisicion
      ? vehiculo.fechaAdquisicion.toISOString().split("T")[0]
      : null,
    conductorNombre:  vehiculo.conductorNombre,
    conductorTel:     vehiculo.conductorTel,
    gps:              vehiculo.gps,
    problemaActivo:   vehiculo.problemaActivo,
    observaciones:    vehiculo.observaciones,
    sucursalNombre:   vehiculo.sucursal.nombre,
    sucursalCiudad:   vehiculo.sucursal.ciudad,
    logoDataUrl,
    fotos,
    documentos,
    mantenimientos,
    generadoPor:      profile.nombreCompleto,
    fechaReporte,
  };

  // ── Renderizar PDF ─────────────────────────────────────────────────────────

  const element = React.createElement(CartillaPDF, { data }) as React.ReactElement<DocumentProps>;
  const buffer  = await renderToBuffer(element);

  const nombreArchivo = `cartilla-${vehiculo.placa.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
