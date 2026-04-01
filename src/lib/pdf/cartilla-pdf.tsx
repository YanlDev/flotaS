import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Paleta (hex equivalentes del tema emerald) ───────────────────────────────

const C = {
  primary:     "#059669", // emerald-600
  primaryDark: "#047857", // emerald-700
  primaryDeep: "#064e3b", // emerald-900
  primaryLight:"#d1fae5", // emerald-100
  primaryPale: "#ecfdf5", // emerald-50
  text:        "#111827", // gray-900
  textMuted:   "#6b7280", // gray-500
  textLight:   "#9ca3af", // gray-400
  border:      "#e5e7eb", // gray-200
  borderLight: "#f3f4f6", // gray-100
  bg:          "#f9fafb", // gray-50
  white:       "#ffffff",
  amber:       "#d97706", // amber-600
  amberLight:  "#fef3c7", // amber-100
  amberDark:   "#92400e", // amber-800
  red:         "#dc2626", // red-600
  redLight:    "#fee2e2", // red-100
  redDark:     "#991b1b", // red-800
  green:       "#16a34a", // green-600
  greenLight:  "#dcfce7", // green-100
} as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CartillaData {
  logoDataUrl: string | null;
  placa: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string | null;
  estado: string;
  motor: string | null;
  numeroMotor: string | null;
  numeroChasis: string | null;
  propietario: string | null;
  rucPropietario: string | null;
  transmision: string | null;
  traccion: string | null;
  combustible: string | null;
  numAsientos: number | null;
  capacidadCargaKg: number | null;
  kmActuales: number | null;
  zonaOperacion: string | null;
  fechaAdquisicion: string | null;
  conductorNombre: string | null;
  conductorTel: string | null;
  gps: boolean;
  problemaActivo: string | null;
  observaciones: string | null;
  sucursalNombre: string;
  sucursalCiudad: string;
  fotos: { categoria: string; label: string; dataUrl: string }[];
  documentos: {
    tipo: string;
    nombre: string;
    vencimiento: string | null;
    estadoDoc: "vencido" | "proximo" | "vigente";
    downloadUrl: string;
  }[];
  mantenimientos: {
    id: string;
    categoria: string;
    tipo: string;
    descripcion: string;
    fecha: string;
    odometroKm: number;
    costoSoles: number | null;
    taller: string | null;
    proximoKm: number | null;
    proximaFecha: string | null;
    alertaKm: "vencido" | "proximo" | "ok" | null;
    alertaFecha: "vencido" | "proximo" | "ok" | null;
    alertaDetalle: string;
  }[];
  generadoPor: string;
  fechaReporte: string;
}

// ─── Mapas de etiquetas ───────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  operativo:         "OPERATIVO",
  parcialmente:      "PARCIAL",
  fuera_de_servicio: "FUERA DE SERVICIO",
};

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  operativo:         { bg: C.greenLight, text: C.green },
  parcialmente:      { bg: C.amberLight, text: C.amber },
  fuera_de_servicio: { bg: C.redLight,   text: C.red   },
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

const TIPO_DOC_LABEL: Record<string, string> = {
  soat: "SOAT", revision_tecnica: "Rev. Técnica",
  tarjeta_propiedad: "Tarj. Propiedad", otro: "Documento",
};

const CATEGORIA_LABEL: Record<string, string> = {
  aceite_filtros:      "Aceite + Filtros",
  llantas:             "Llantas",
  frenos:              "Frenos",
  liquidos:            "Líquidos",
  bateria:             "Batería",
  alineacion_balanceo: "Alineación",
  suspension:          "Suspensión",
  transmision:         "Transmisión",
  electricidad:        "Eléctrico",
  revision_general:    "Rev. General",
  otro:                "Otro",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtKm(n: number): string {
  return n.toLocaleString("es-PE") + " km";
}

function fmtCost(n: number): string {
  return (
    "S/. " +
    n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    paddingTop: 36,
    paddingBottom: 60,
    paddingLeft: 40,
    paddingRight: 40,
    backgroundColor: C.white,
    fontSize: 9,
    color: C.text,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },
  headerLogo: {
    height: 48,
    objectFit: "contain",
  },
  headerFallback: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  brandBar: {
    width: 4,
    height: 40,
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  brandName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
  },
  brandTagline: {
    fontSize: 7.5,
    color: C.textMuted,
    marginTop: 3,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  reportTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.primaryDark,
    letterSpacing: 0.5,
  },
  reportMeta: {
    fontSize: 7.5,
    color: C.textMuted,
    marginTop: 3,
  },

  // Dividers
  dividerPrimary: {
    height: 2,
    backgroundColor: C.primary,
    marginBottom: 14,
  },

  // Vehicle Identity
  identityBox: {
    backgroundColor: C.primaryPale,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderWidth: 0.5,
    borderColor: C.primaryLight,
  },
  // Placa estilo peruano
  placaBadge: {
    backgroundColor: C.white,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#94a3b8",  // slate-400 (marco metálico)
    alignItems: "center",
    minWidth: 90,
    overflow: "hidden",
  },
  placaTopBand: {
    backgroundColor: "#1e3a8a", // azul oscuro — color típico placa peruana
    width: "100%",
    paddingVertical: 2,
    alignItems: "center",
  },
  placaTopText: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 1.5,
  },
  placaBody: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  placaText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    color: "#0f172a",  // slate-900
    letterSpacing: 2,
  },
  placaLabel: {
    fontSize: 5.5,
    color: "#64748b", // slate-500
    letterSpacing: 0.6,
    marginTop: 1,
  },
  identityInfo: {
    flex: 1,
  },
  vehicleTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: C.primaryDark,
  },
  vehicleSub: {
    fontSize: 8.5,
    color: C.textMuted,
    marginTop: 3,
  },
  estadoBadge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  estadoBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.4,
  },
  ownerRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ownerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.primary,
  },
  ownerText: {
    fontSize: 8,
    color: C.textMuted,
  },

  // Alert boxes
  problemBox: {
    backgroundColor: C.redLight,
    borderRadius: 5,
    padding: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.red,
  },
  problemTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.red,
    marginBottom: 2,
  },
  problemText: {
    fontSize: 8,
    color: C.redDark,
  },

  // Photos grid
  photosGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  photoCell: {
    flex: 1,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: C.border,
  },
  photoImg: {
    width: "100%",
    height: 80,
    objectFit: "cover",
  },
  photoLabel: {
    fontSize: 6,
    color: C.textMuted,
    textAlign: "center",
    paddingVertical: 2,
    backgroundColor: C.bg,
  },

  // Two columns
  twoCol: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  col: {
    flex: 1,
  },

  // Info card
  card: {
    backgroundColor: C.bg,
    borderRadius: 5,
    padding: 9,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  cardTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    letterSpacing: 0.6,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.primaryLight,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 2.5,
    borderBottomWidth: 0.3,
    borderBottomColor: C.borderLight,
  },
  infoLabel: {
    fontSize: 7.5,
    color: C.textMuted,
    flex: 1,
  },
  infoValue: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    flex: 1.2,
    textAlign: "right",
  },
  infoValueMono: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    flex: 1.2,
    textAlign: "right",
  },

  // Section label
  sectionLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 2,
  },

  // Table
  table: {
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    marginBottom: 12,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: C.primary,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  tableHeadCell: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopWidth: 0.3,
    borderTopColor: C.border,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: C.bg,
  },
  tableCell: {
    fontSize: 7.5,
    color: C.text,
  },

  // Maintenance alert rows
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 4,
    padding: 7,
    marginBottom: 5,
    gap: 6,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 1.5,
  },
  alertText: {
    fontSize: 8,
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },

  // KPI row
  kpiRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 5,
    padding: 8,
    borderWidth: 0.5,
    borderColor: C.border,
    alignItems: "center",
  },
  kpiValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.primaryDark,
  },
  kpiLabel: {
    fontSize: 6.5,
    color: C.textMuted,
    marginTop: 1,
  },

  // Observations
  obsBox: {
    backgroundColor: C.bg,
    borderRadius: 5,
    padding: 9,
    borderWidth: 0.5,
    borderColor: C.border,
    marginBottom: 12,
  },
  obsText: {
    fontSize: 8,
    color: C.textMuted,
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerBrand: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
  },
  footerSep: {
    fontSize: 7,
    color: C.textLight,
  },
  footerText: {
    fontSize: 7,
    color: C.textLight,
  },
  footerRight: {
    fontSize: 7,
    color: C.textLight,
  },
});

// ─── Componente principal ─────────────────────────────────────────────────────

export function CartillaPDF({ data }: { data: CartillaData }) {
  const estadoColors = ESTADO_COLORS[data.estado] ?? { bg: C.bg, text: C.textMuted };

  // Calcular alertas y stats de mantenimiento
  const mantVencidos   = data.mantenimientos.filter(
    (m) => m.alertaKm === "vencido" || m.alertaFecha === "vencido"
  );
  const mantProximos   = data.mantenimientos.filter(
    (m) =>
      (m.alertaKm === "proximo" || m.alertaFecha === "proximo") &&
      m.alertaKm !== "vencido" &&
      m.alertaFecha !== "vencido"
  );
  const costoTotal     = data.mantenimientos.reduce((s, m) => s + (m.costoSoles ?? 0), 0);
  const totalAlertas   = mantVencidos.length + mantProximos.length;
  const ultimoMant     = data.mantenimientos[0];
  const recientes      = data.mantenimientos.slice(0, 6);

  return (
    <Document
      title={`Cartilla Técnica — ${data.placa}`}
      author="Selcosi Flota"
      subject="Cartilla técnica vehicular"
    >
      <Page size="A4" style={S.page}>

        {/* ── HEADER ────────────────────────────────────── */}
        <View style={S.header}>
          {data.logoDataUrl ? (
            <Image src={data.logoDataUrl} style={S.headerLogo} />
          ) : (
            <View style={S.headerFallback}>
              <View style={S.brandBar} />
              <View>
                <Text style={S.brandName}>SELCOSI FLOTA</Text>
                <Text style={S.brandTagline}>Gestión vehicular</Text>
              </View>
            </View>
          )}
          <View style={S.headerRight}>
            <Text style={S.reportTitle}>CARTILLA TÉCNICA VEHICULAR</Text>
            <Text style={S.reportMeta}>Generado: {data.fechaReporte}</Text>
            <Text style={S.reportMeta}>Por: {data.generadoPor}</Text>
          </View>
        </View>

        <View style={S.dividerPrimary} />

        {/* ── IDENTIDAD DEL VEHÍCULO ─────────────────────── */}
        <View style={S.identityBox}>
          <View style={S.placaBadge}>
            <View style={S.placaTopBand}>
              <Text style={S.placaTopText}>PERÚ</Text>
            </View>
            <View style={S.placaBody}>
              <Text style={S.placaText}>{data.placa}</Text>
              <Text style={S.placaLabel}>PLACA DE RODAJE</Text>
            </View>
          </View>

          <View style={S.identityInfo}>
            <Text style={S.vehicleTitle}>
              {data.marca} {data.modelo} {data.anio}
            </Text>
            <Text style={S.vehicleSub}>
              {TIPO_LABEL[data.tipo] ?? data.tipo}
              {data.traccion ? ` · ${TRACCION_LABEL[data.traccion] ?? data.traccion}` : ""}
              {data.combustible ? ` · ${COMBUSTIBLE_LABEL[data.combustible] ?? data.combustible}` : ""}
              {data.color ? ` · ${data.color}` : ""}
            </Text>

            <View style={[S.estadoBadge, { backgroundColor: estadoColors.bg }]}>
              <Text style={[S.estadoBadgeText, { color: estadoColors.text }]}>
                {ESTADO_LABEL[data.estado] ?? data.estado.toUpperCase()}
              </Text>
            </View>

            {(data.propietario || data.rucPropietario) && (
              <View style={S.ownerRow}>
                <View style={S.ownerDot} />
                <Text style={S.ownerText}>
                  {[
                    data.propietario,
                    data.rucPropietario ? `RUC ${data.rucPropietario}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── PROBLEMA ACTIVO ────────────────────────────── */}
        {data.problemaActivo && (
          <View style={S.problemBox}>
            <Text style={S.problemTitle}>PROBLEMA ACTIVO</Text>
            <Text style={S.problemText}>{data.problemaActivo}</Text>
          </View>
        )}

        {/* ── FOTOS: frontal, posterior, lateral_der, lateral_izq ─── */}
        {data.fotos.length > 0 && (
          <View style={S.photosGrid}>
            {data.fotos.map((f) => (
              <View key={f.categoria} style={S.photoCell}>
                <Image src={f.dataUrl} style={S.photoImg} />
                <Text style={S.photoLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── DOS COLUMNAS: TÉCNICO + OPERACIÓN ─────────── */}
        <View style={S.twoCol}>

          {/* COLUMNA IZQUIERDA */}
          <View style={S.col}>

            {/* SUNARP */}
            <View style={S.card}>
              <Text style={S.cardTitle}>TARJETA DE PROPIEDAD — SUNARP</Text>
              {data.numeroMotor && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Nro. Motor</Text>
                  <Text style={S.infoValueMono}>{data.numeroMotor}</Text>
                </View>
              )}
              {data.numeroChasis && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Nro. Chasis</Text>
                  <Text style={S.infoValueMono}>{data.numeroChasis}</Text>
                </View>
              )}
              {data.propietario && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Propietario</Text>
                  <Text style={S.infoValue}>{data.propietario}</Text>
                </View>
              )}
              {data.rucPropietario && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>RUC</Text>
                  <Text style={S.infoValueMono}>{data.rucPropietario}</Text>
                </View>
              )}
              {!data.numeroMotor && !data.numeroChasis && !data.propietario && !data.rucPropietario && (
                <Text style={[S.infoLabel, { fontStyle: "italic" }]}>Sin datos SUNARP registrados</Text>
              )}
            </View>

            {/* DATOS TÉCNICOS */}
            <View style={S.card}>
              <Text style={S.cardTitle}>DATOS TÉCNICOS</Text>
              {data.motor && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Motor</Text>
                  <Text style={S.infoValue}>{data.motor}</Text>
                </View>
              )}
              {data.transmision && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Transmisión</Text>
                  <Text style={S.infoValue}>
                    {data.transmision === "manual" ? "Manual" : "Automático"}
                  </Text>
                </View>
              )}
              {data.traccion && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Tracción</Text>
                  <Text style={S.infoValue}>
                    {TRACCION_LABEL[data.traccion] ?? data.traccion}
                  </Text>
                </View>
              )}
              {data.combustible && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Combustible</Text>
                  <Text style={S.infoValue}>
                    {COMBUSTIBLE_LABEL[data.combustible] ?? data.combustible}
                  </Text>
                </View>
              )}
              {data.numAsientos != null && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Asientos</Text>
                  <Text style={S.infoValue}>{data.numAsientos}</Text>
                </View>
              )}
              {data.capacidadCargaKg != null && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Cap. carga</Text>
                  <Text style={S.infoValue}>
                    {data.capacidadCargaKg.toLocaleString("es-PE")} kg
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* COLUMNA DERECHA */}
          <View style={S.col}>

            {/* OPERACIÓN */}
            <View style={S.card}>
              <Text style={S.cardTitle}>OPERACIÓN</Text>
              {data.kmActuales != null && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>KM actuales</Text>
                  <Text style={S.infoValue}>{fmtKm(data.kmActuales)}</Text>
                </View>
              )}
              {data.zonaOperacion && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Zona</Text>
                  <Text style={S.infoValue}>{data.zonaOperacion}</Text>
                </View>
              )}
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>Sucursal</Text>
                <Text style={S.infoValue}>{data.sucursalNombre}</Text>
              </View>
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>Ciudad</Text>
                <Text style={S.infoValue}>{data.sucursalCiudad}</Text>
              </View>
              {data.fechaAdquisicion && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Adquisición</Text>
                  <Text style={S.infoValue}>{fmtDate(data.fechaAdquisicion)}</Text>
                </View>
              )}
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>GPS</Text>
                <Text style={[S.infoValue, { color: data.gps ? C.green : C.textMuted }]}>
                  {data.gps ? "Activo" : "Sin GPS"}
                </Text>
              </View>
            </View>

            {/* CONDUCTOR */}
            {(data.conductorNombre || data.conductorTel) && (
              <View style={S.card}>
                <Text style={S.cardTitle}>CONDUCTOR ASIGNADO</Text>
                {data.conductorNombre && (
                  <View style={S.infoRow}>
                    <Text style={S.infoLabel}>Nombre</Text>
                    <Text style={S.infoValue}>{data.conductorNombre}</Text>
                  </View>
                )}
                {data.conductorTel && (
                  <View style={S.infoRow}>
                    <Text style={S.infoLabel}>Teléfono</Text>
                    <Text style={S.infoValue}>{data.conductorTel}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── DOCUMENTOS ─────────────────────────────────── */}
        {data.documentos.length > 0 && (
          <>
            <Text style={S.sectionLabel}>DOCUMENTOS VEHICULARES</Text>
            <View style={S.table}>
              <View style={S.tableHead}>
                <Text style={[S.tableHeadCell, { flex: 1.4 }]}>TIPO</Text>
                <Text style={[S.tableHeadCell, { flex: 2.8 }]}>NOMBRE</Text>
                <Text style={[S.tableHeadCell, { flex: 1.1 }]}>VENCIMIENTO</Text>
                <Text style={[S.tableHeadCell, { flex: 1 }]}>ESTADO</Text>
                <Text style={[S.tableHeadCell, { flex: 1 }]}>ENLACE</Text>
              </View>
              {data.documentos.map((doc, i) => {
                const statColor =
                  doc.estadoDoc === "vencido" ? C.red :
                  doc.estadoDoc === "proximo"  ? C.amber :
                  C.green;
                const statLabel =
                  doc.estadoDoc === "vencido" ? "Vencido" :
                  doc.estadoDoc === "proximo"  ? "Por vencer" :
                  "Vigente";
                return (
                  <View
                    key={i}
                    style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
                  >
                    <Text style={[S.tableCell, { flex: 1.4 }]}>
                      {TIPO_DOC_LABEL[doc.tipo] ?? doc.tipo}
                    </Text>
                    <Text style={[S.tableCell, { flex: 2.8 }]}>{doc.nombre}</Text>
                    <Text style={[S.tableCell, { flex: 1.1 }]}>
                      {doc.vencimiento ? fmtDate(doc.vencimiento) : "—"}
                    </Text>
                    <Text
                      style={[
                        S.tableCell,
                        { flex: 1, color: statColor, fontFamily: "Helvetica-Bold" },
                      ]}
                    >
                      {statLabel}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Link src={doc.downloadUrl} style={{ fontSize: 7, color: C.primary }}>
                        Ver archivo
                      </Link>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── MANTENIMIENTOS ─────────────────────────────── */}
        {data.mantenimientos.length > 0 && (
          <>
            <Text style={S.sectionLabel}>MANTENIMIENTOS</Text>

            {/* KPIs */}
            <View style={S.kpiRow}>
              <View style={S.kpiCard}>
                <Text style={S.kpiValue}>{data.mantenimientos.length}</Text>
                <Text style={S.kpiLabel}>Registros</Text>
              </View>
              <View style={S.kpiCard}>
                <Text style={S.kpiValue}>
                  {costoTotal > 0 ? fmtCost(costoTotal) : "—"}
                </Text>
                <Text style={S.kpiLabel}>Costo total</Text>
              </View>
              <View style={S.kpiCard}>
                <Text
                  style={[
                    S.kpiValue,
                    { color: totalAlertas > 0 ? (mantVencidos.length > 0 ? C.red : C.amber) : C.green },
                  ]}
                >
                  {totalAlertas}
                </Text>
                <Text style={S.kpiLabel}>Alertas</Text>
              </View>
              <View style={S.kpiCard}>
                <Text style={S.kpiValue}>
                  {ultimoMant ? fmtDate(ultimoMant.fecha) : "—"}
                </Text>
                <Text style={S.kpiLabel}>Último servicio</Text>
              </View>
            </View>

            {/* Alertas vencidas */}
            {mantVencidos.map((m, i) => (
              <View key={`v-${i}`} style={[S.alertRow, { backgroundColor: C.redLight }]}>
                <View style={[S.alertDot, { backgroundColor: C.red }]} />
                <Text style={[S.alertText, { color: C.redDark }]}>
                  {`VENCIDO: ${CATEGORIA_LABEL[m.categoria] ?? m.categoria}  —  ${m.alertaDetalle}`}
                </Text>
              </View>
            ))}

            {/* Alertas próximas */}
            {mantProximos.map((m, i) => (
              <View key={`p-${i}`} style={[S.alertRow, { backgroundColor: C.amberLight }]}>
                <View style={[S.alertDot, { backgroundColor: C.amber }]} />
                <Text style={[S.alertText, { color: C.amberDark }]}>
                  {`PRÓXIMO: ${CATEGORIA_LABEL[m.categoria] ?? m.categoria}  —  ${m.alertaDetalle}`}
                </Text>
              </View>
            ))}

            {/* Tabla historial */}
            <Text style={[S.sectionLabel, { fontSize: 7, marginTop: 4 }]}>
              {`HISTORIAL RECIENTE (${recientes.length} DE ${data.mantenimientos.length} REGISTROS)`}
            </Text>
            <View style={S.table}>
              <View style={S.tableHead}>
                <Text style={[S.tableHeadCell, { flex: 1.7 }]}>CATEGORÍA</Text>
                <Text style={[S.tableHeadCell, { flex: 0.8 }]}>TIPO</Text>
                <Text style={[S.tableHeadCell, { flex: 2.8 }]}>DESCRIPCIÓN</Text>
                <Text style={[S.tableHeadCell, { flex: 1 }]}>FECHA</Text>
                <Text style={[S.tableHeadCell, { flex: 1 }]}>ODÓMETRO</Text>
                <Text style={[S.tableHeadCell, { flex: 0.9 }]}>COSTO</Text>
              </View>
              {recientes.map((m, i) => {
                const isVencido = m.alertaKm === "vencido" || m.alertaFecha === "vencido";
                const isProximo = m.alertaKm === "proximo" || m.alertaFecha === "proximo";
                const dotColor  = isVencido ? C.red : isProximo ? C.amber : null;

                return (
                  <View
                    key={m.id}
                    style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
                  >
                    <View
                      style={{
                        flex: 1.7,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      {dotColor && (
                        <View
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: dotColor,
                          }}
                        />
                      )}
                      <Text style={[S.tableCell, { flex: 1 }]}>
                        {CATEGORIA_LABEL[m.categoria] ?? m.categoria}
                      </Text>
                    </View>
                    <Text style={[S.tableCell, { flex: 0.8 }]}>
                      {m.tipo === "preventivo" ? "Prev." : "Corr."}
                    </Text>
                    <Text style={[S.tableCell, { flex: 2.8 }]}>{m.descripcion}</Text>
                    <Text style={[S.tableCell, { flex: 1 }]}>{fmtDate(m.fecha)}</Text>
                    <Text style={[S.tableCell, { flex: 1 }]}>
                      {fmtKm(m.odometroKm)}
                    </Text>
                    <Text style={[S.tableCell, { flex: 0.9 }]}>
                      {m.costoSoles != null
                        ? `S/.${m.costoSoles.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`
                        : "—"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── OBSERVACIONES ──────────────────────────────── */}
        {data.observaciones && (
          <>
            <Text style={S.sectionLabel}>OBSERVACIONES</Text>
            <View style={S.obsBox}>
              <Text style={S.obsText}>{data.observaciones}</Text>
            </View>
          </>
        )}

        {/* ── FOOTER ─────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <View style={S.footerLeft}>
            <Text style={S.footerBrand}>Selcosi Flota</Text>
            <Text style={S.footerSep}> · </Text>
            <Text style={S.footerText}>Gestión vehicular</Text>
            <Text style={S.footerSep}> · </Text>
            <Text style={S.footerText}>Documento de uso interno</Text>
          </View>
          <Text style={S.footerRight}>{data.fechaReporte}</Text>
        </View>

      </Page>
    </Document>
  );
}
