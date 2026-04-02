import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { EstadoVehiculo } from "@/generated/prisma/client";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

// ─── Colores ──────────────────────────────────────────────────────────────────

const COLOR_HEADER_BG   = "FF059669"; // emerald-600
const COLOR_HEADER_FG   = "FFFFFFFF"; // blanco
const COLOR_ROW_ALT     = "FFECFDF5"; // emerald-50
const COLOR_ROW_BASE    = "FFFFFFFF"; // blanco
const COLOR_OPERATIVO   = "FF059669"; // emerald-600
const COLOR_PARCIAL     = "FFD97706"; // amber-600
const COLOR_FUERA       = "FFDC2626"; // red-600
const COLOR_VENCIDO     = "FFDC2626"; // red
const COLOR_PROXIMO     = "FFD97706"; // amber
const COLOR_OK          = "FF059669"; // emerald

// ─── Etiquetas ────────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  operativo:         "Operativo",
  parcialmente:      "Parcial",
  fuera_de_servicio: "Fuera de servicio",
};

const TIPO_LABEL: Record<string, string> = {
  moto: "Moto", auto: "Auto", camioneta: "Camioneta",
  minivan: "Minivan", furgon: "Furgón", bus: "Bus",
  vehiculo_pesado: "Vehículo Pesado",
};

const COMBUSTIBLE_LABEL: Record<string, string> = {
  gasolina: "Gasolina", diesel: "Diesel", glp: "GLP",
  gnv: "GNV", electrico: "Eléctrico", hibrido: "Híbrido",
};

const TRACCION_LABEL: Record<string, string> = {
  fourbytwo: "4x2", fourbyfour: "4x4",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function docStatus(vencimiento: Date | null, hoy: Date): string {
  if (!vencimiento) return "";
  const diff = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0)  return "VENCIDO";
  if (diff <= 30) return "POR VENCER";
  return "Vigente";
}

function docStatusColor(status: string): string {
  if (status === "VENCIDO")    return COLOR_VENCIDO;
  if (status === "POR VENCER") return COLOR_PROXIMO;
  return COLOR_OK;
}

function alertaMantLabel(nivel: "vencido" | "proximo" | null): string {
  if (nivel === "vencido") return "VENCIDO";
  if (nivel === "proximo") return "PRÓXIMO";
  return "Al día";
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q          = searchParams.get("q") ?? undefined;
  const estado     = searchParams.get("estado") ?? undefined;
  const sucursalId = searchParams.get("sucursalId") ?? undefined;

  // Jefes de sucursal solo pueden exportar su sucursal
  const sucursalFiltro =
    profile.rol === "jefe_sucursal"
      ? (profile.sucursalId ?? undefined)
      : sucursalId;

  // ── Fetch vehículos con documentos incluidos ──────────────────────────────

  const vehiculos = await prisma.vehiculo.findMany({
    where: {
      ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
      ...(estado && { estado: estado as EstadoVehiculo }),
      ...(q && {
        OR: [
          { placa:           { contains: q, mode: "insensitive" } },
          { marca:           { contains: q, mode: "insensitive" } },
          { modelo:          { contains: q, mode: "insensitive" } },
          { conductorNombre: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ sucursal: { nombre: "asc" } }, { placa: "asc" }],
    include: {
      sucursal:  { select: { nombre: true, ciudad: true } },
      creador:   { select: { nombreCompleto: true } },
      documentos: {
        where: { tipo: { in: ["soat", "revision_tecnica", "tarjeta_propiedad"] } },
        select: { tipo: true, vencimiento: true },
        orderBy: { vencimiento: "asc" },
      },
    },
  });

  // ── Alertas de mantenimiento ──────────────────────────────────────────────

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const idsVehiculos = vehiculos.map((v) => v.id);
  const mantenimientos = idsVehiculos.length > 0
    ? await prisma.mantenimiento.findMany({
        where: {
          vehiculoId: { in: idsVehiculos },
          OR: [{ proximoKm: { not: null } }, { proximaFecha: { not: null } }],
        },
        select: { vehiculoId: true, proximoKm: true, proximaFecha: true },
      })
    : [];

  const alertaPorVehiculo = new Map<string, "vencido" | "proximo">();
  for (const m of mantenimientos) {
    const v = vehiculos.find((x) => x.id === m.vehiculoId);
    if (!v) continue;
    if (m.proximoKm && v.kmActuales != null) {
      const diff = m.proximoKm - v.kmActuales;
      if (diff <= 0) { alertaPorVehiculo.set(v.id, "vencido"); continue; }
      if (diff <= 1000 && alertaPorVehiculo.get(v.id) !== "vencido")
        alertaPorVehiculo.set(v.id, "proximo");
    }
    if (m.proximaFecha) {
      const diffDias = Math.ceil((m.proximaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias <= 0) { alertaPorVehiculo.set(v.id, "vencido"); continue; }
      if (diffDias <= 30 && alertaPorVehiculo.get(v.id) !== "vencido")
        alertaPorVehiculo.set(v.id, "proximo");
    }
  }

  // ── Construir Excel ───────────────────────────────────────────────────────

  const workbook  = new ExcelJS.Workbook();
  workbook.creator  = "Selcosi Flota";
  workbook.created  = new Date();

  const sheet = workbook.addWorksheet("Flota vehicular", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // ── Fila 1: Título del reporte ────────────────────────────────────────────

  const fechaReporte = new Date().toLocaleDateString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const tituloFiltros = [
    estado     ? `Estado: ${ESTADO_LABEL[estado] ?? estado}` : null,
    q          ? `Búsqueda: "${q}"` : null,
    sucursalId ? null : null, // si hay nombre de sucursal no lo tenemos aquí fácil
  ].filter(Boolean).join("  ·  ");

  sheet.mergeCells("A1:AG1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `SELCOSI FLOTA — Reporte de flota vehicular${tituloFiltros ? "  |  " + tituloFiltros : ""}  |  Generado: ${fechaReporte}`;
  titleCell.font  = { bold: true, size: 11, color: { argb: COLOR_HEADER_FG } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_BG } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(1).height = 22;

  // ── Fila 2: Cabeceras ─────────────────────────────────────────────────────

  const columns: { header: string; key: string; width: number }[] = [
    { header: "Placa",            key: "placa",       width: 14 },
    { header: "Estado",           key: "estado",      width: 16 },
    { header: "Tipo",             key: "tipo",        width: 14 },
    { header: "Marca",            key: "marca",       width: 14 },
    { header: "Modelo",           key: "modelo",      width: 16 },
    { header: "Año",              key: "anio",        width: 8  },
    { header: "Color",            key: "color",       width: 14 },
    { header: "KM Actuales",      key: "km",          width: 14 },
    { header: "Combustible",      key: "combustible", width: 13 },
    { header: "Transmisión",      key: "transmision", width: 13 },
    { header: "Tracción",         key: "traccion",    width: 11 },
    { header: "Motor",            key: "motor",       width: 14 },
    { header: "Nro. Motor",       key: "nroMotor",    width: 18 },
    { header: "Nro. Chasis",      key: "nroChasis",   width: 18 },
    { header: "Propietario",      key: "propietario", width: 22 },
    { header: "RUC Propietario",  key: "ruc",         width: 16 },
    { header: "Asientos",         key: "asientos",    width: 10 },
    { header: "Cap. Carga (kg)",  key: "carga",       width: 14 },
    { header: "Zona Operación",   key: "zona",        width: 16 },
    { header: "GPS",              key: "gps",         width: 9  },
    { header: "Sucursal",         key: "sucursal",    width: 16 },
    { header: "Ciudad",           key: "ciudad",      width: 14 },
    { header: "Conductor",        key: "conductor",   width: 20 },
    { header: "Tel. Conductor",   key: "telConductor",width: 15 },
    { header: "Alerta Mant.",     key: "alertaMant",  width: 14 },
    { header: "SOAT — Vence",     key: "soat",        width: 15 },
    { header: "Rev. Técnica — Vence", key: "revTec",  width: 20 },
    { header: "Tarj. Propiedad",  key: "tarjProp",    width: 18 },
    { header: "Fecha Adquisición",key: "adquisicion", width: 18 },
    { header: "Problema Activo",  key: "problema",    width: 24 },
    { header: "Observaciones",    key: "obs",         width: 28 },
    { header: "Registrado por",   key: "registrador", width: 22 },
    { header: "F. Registro",      key: "fRegistro",   width: 15 },
  ];

  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  // Fila 2 de cabeceras
  const headerRow = sheet.getRow(2);
  headerRow.values = columns.map((c) => c.header);
  headerRow.eachCell((cell) => {
    cell.font      = { bold: true, color: { argb: COLOR_HEADER_FG }, size: 9 };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_BG } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
    cell.border    = {
      bottom: { style: "thin", color: { argb: "FF047857" } },
    };
  });
  headerRow.height = 22;

  // ── Filas de datos ────────────────────────────────────────────────────────

  vehiculos.forEach((v, idx) => {
    const isAlt    = idx % 2 === 1;
    const bgColor  = isAlt ? COLOR_ROW_ALT : COLOR_ROW_BASE;
    const alertaMant = alertaPorVehiculo.get(v.id) ?? null;

    // Documentos
    const soat      = v.documentos.find((d) => d.tipo === "soat");
    const revTec    = v.documentos.find((d) => d.tipo === "revision_tecnica");
    const tarjProp  = v.documentos.find((d) => d.tipo === "tarjeta_propiedad");

    const soatStatus    = soat    ? docStatus(soat.vencimiento,    hoy) : "";
    const revTecStatus  = revTec  ? docStatus(revTec.vencimiento,  hoy) : "";

    const rowData: (string | number)[] = [
      v.placa,
      ESTADO_LABEL[v.estado]              ?? v.estado,
      TIPO_LABEL[v.tipo]                  ?? v.tipo,
      v.marca,
      v.modelo,
      v.anio,
      v.color                             ?? "",
      v.kmActuales                        ?? "",
      COMBUSTIBLE_LABEL[v.combustible ?? ""] ?? v.combustible ?? "",
      v.transmision === "manual" ? "Manual" : v.transmision === "automatico" ? "Automático" : "",
      TRACCION_LABEL[v.traccion ?? ""]    ?? v.traccion ?? "",
      v.motor                             ?? "",
      v.numeroMotor                       ?? "",
      v.numeroChasis                      ?? "",
      v.propietario                       ?? "",
      v.rucPropietario                    ?? "",
      v.numAsientos                       ?? "",
      v.capacidadCargaKg                  ?? "",
      v.zonaOperacion                     ?? "",
      v.gps ? "Sí" : "No",
      v.sucursal.nombre,
      v.sucursal.ciudad,
      v.conductorNombre                   ?? "",
      v.conductorTel                      ?? "",
      alertaMantLabel(alertaMant),
      soat    ? fmtDate(soat.vencimiento)    + (soatStatus   ? ` (${soatStatus})`   : "") : "",
      revTec  ? fmtDate(revTec.vencimiento)  + (revTecStatus ? ` (${revTecStatus})` : "") : "",
      tarjProp ? fmtDate(tarjProp.vencimiento) : "",
      v.fechaAdquisicion ? fmtDate(v.fechaAdquisicion) : "",
      v.problemaActivo                    ?? "",
      v.observaciones                     ?? "",
      v.creador?.nombreCompleto           ?? "",
      fmtDate(v.createdAt),
    ];

    const row = sheet.addRow(rowData);
    row.height = 16;

    row.eachCell((cell, colNum) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.font      = { size: 9 };
      cell.alignment = { vertical: "middle" };
      cell.border    = {
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
      };

      // Columna Estado (col 2) → color de texto según estado
      if (colNum === 2) {
        const stateColor =
          v.estado === "operativo"         ? COLOR_OPERATIVO :
          v.estado === "parcialmente"      ? COLOR_PARCIAL   :
          v.estado === "fuera_de_servicio" ? COLOR_FUERA     : "FF374151";
        cell.font = { bold: true, size: 9, color: { argb: stateColor } };
      }

      // Columna Placa (col 1) → bold + monospace effect
      if (colNum === 1) {
        cell.font = { bold: true, size: 9 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      // Columna Alerta Mant. (col 25) → color según alerta
      if (colNum === 25) {
        const alertColor =
          alertaMant === "vencido" ? COLOR_VENCIDO :
          alertaMant === "proximo" ? COLOR_PROXIMO : COLOR_OK;
        cell.font = { bold: alertaMant != null, size: 9, color: { argb: alertColor } };
      }

      // Columnas SOAT y Rev. Técnica (col 26, 27) → color según estado doc
      if (colNum === 26 && soatStatus) {
        cell.font = { size: 9, color: { argb: docStatusColor(soatStatus) } };
      }
      if (colNum === 27 && revTecStatus) {
        cell.font = { size: 9, color: { argb: docStatusColor(revTecStatus) } };
      }
    });
  });

  // ── Fila totalizadora ─────────────────────────────────────────────────────

  const totalRow = sheet.addRow([
    `Total: ${vehiculos.length} vehículos`,
    ...Array<string>(columns.length - 1).fill(""),
  ]);
  totalRow.getCell(1).font = { bold: true, italic: true, size: 9, color: { argb: "FF6B7280" } };
  totalRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

  // ── Auto filter en fila 2 ─────────────────────────────────────────────────

  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to:   { row: 2, column: columns.length },
  };

  // ── Generar buffer ────────────────────────────────────────────────────────

  const buffer = await workbook.xlsx.writeBuffer();

  const nombreArchivo = `flota-vehicular-${fechaReporte.replace(/\//g, "-")}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
