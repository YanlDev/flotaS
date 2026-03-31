"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Wrench, Plus, Trash2, ExternalLink, AlertTriangle,
  CheckCircle, Clock, Fuel, Zap, Settings, Disc,
  Battery, AlignCenter, ChevronDown, ChevronUp, Pencil, X,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Mantenimiento {
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
  notas: string | null;
  registradorNombre: string | null;
  evidenciaUrl: string | null;
  createdAt: string;
}

interface Props {
  vehiculoId: string;
  kmActuales: number | null;
  puedeEditar: boolean;
  esAdmin: boolean;
}

// ─── Configuración de categorías ──────────────────────────────────────────────

const CATEGORIA_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  aceite_filtros:     { label: "Aceite + Filtros",       icon: <Fuel size={13}/>,        color: "text-amber-600" },
  llantas:            { label: "Llantas",                icon: <Disc size={13}/>,         color: "text-slate-600" },
  frenos:             { label: "Frenos",                 icon: <Disc size={13}/>,         color: "text-red-600" },
  liquidos:           { label: "Líquidos",               icon: <Fuel size={13}/>,         color: "text-blue-600" },
  bateria:            { label: "Batería",                icon: <Battery size={13}/>,      color: "text-yellow-600" },
  alineacion_balanceo:{ label: "Alineación y balanceo",  icon: <AlignCenter size={13}/>,  color: "text-purple-600" },
  suspension:         { label: "Suspensión",             icon: <Settings size={13}/>,     color: "text-indigo-600" },
  transmision:        { label: "Transmisión",            icon: <Settings size={13}/>,     color: "text-emerald-700" },
  electricidad:       { label: "Sistema eléctrico",      icon: <Zap size={13}/>,          color: "text-yellow-500" },
  revision_general:   { label: "Revisión general",       icon: <Wrench size={13}/>,       color: "text-emerald-600" },
  otro:               { label: "Otro",                   icon: <Wrench size={13}/>,       color: "text-muted-foreground" },
};

function AlertaBadge({ km, fecha }: { km: Mantenimiento["alertaKm"]; fecha: Mantenimiento["alertaFecha"] }) {
  const peor = km === "vencido" || fecha === "vencido" ? "vencido"
    : km === "proximo" || fecha === "proximo" ? "proximo"
    : km === "ok" || fecha === "ok" ? "ok"
    : null;

  if (!peor) return null;
  if (peor === "vencido") return (
    <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
      <AlertTriangle size={11}/>Vencido
    </span>
  );
  if (peor === "proximo") return (
    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
      <Clock size={11}/>Próximo
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-600">
      <CheckCircle size={11}/>Al día
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatFecha(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function MantenimientoPanel({ vehiculoId, kmActuales, puedeEditar }: Props) {
  const router = useRouter();
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Mantenimiento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Mantenimiento | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [quitarEvidencia, setQuitarEvidencia] = useState(false);

  // Form fields
  const [categoria, setCategoria] = useState("aceite_filtros");
  const [tipo, setTipo] = useState("preventivo");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [odometroKm, setOdometroKm] = useState(kmActuales?.toString() ?? "");
  const [costoSoles, setCostoSoles] = useState("");
  const [taller, setTaller] = useState("");
  const [proximoKm, setProximoKm] = useState("");
  const [proximaFecha, setProximaFecha] = useState("");
  const [notas, setNotas] = useState("");
  const [evidenciaFile, setEvidenciaFile] = useState<File | null>(null);

  useEffect(() => {
    fetch(`/api/vehiculos/${vehiculoId}/mantenimientos`)
      .then((r) => r.json() as Promise<Mantenimiento[]>)
      .then(setMantenimientos)
      .finally(() => setLoading(false));
  }, [vehiculoId]);

  function resetForm() {
    setCategoria("aceite_filtros"); setTipo("preventivo");
    setDescripcion(""); setFecha(new Date().toISOString().split("T")[0]);
    setOdometroKm(kmActuales?.toString() ?? ""); setCostoSoles("");
    setTaller(""); setProximoKm(""); setProximaFecha("");
    setNotas(""); setEvidenciaFile(null); setFormError(null);
    setEditTarget(null); setQuitarEvidencia(false);
  }

  function openEdit(m: Mantenimiento) {
    setEditTarget(m);
    setCategoria(m.categoria);
    setTipo(m.tipo);
    setDescripcion(m.descripcion);
    setFecha(m.fecha);
    setOdometroKm(m.odometroKm.toString());
    setCostoSoles(m.costoSoles != null ? m.costoSoles.toString() : "");
    setTaller(m.taller ?? "");
    setProximoKm(m.proximoKm != null ? m.proximoKm.toString() : "");
    setProximaFecha(m.proximaFecha ?? "");
    setNotas(m.notas ?? "");
    setEvidenciaFile(null);
    setQuitarEvidencia(false);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    const fd = new FormData();
    fd.append("categoria", categoria);
    fd.append("tipo", tipo);
    fd.append("descripcion", descripcion);
    fd.append("fecha", fecha);
    fd.append("odometroKm", odometroKm);
    if (costoSoles) fd.append("costoSoles", costoSoles);
    if (taller) fd.append("taller", taller);
    if (proximoKm) fd.append("proximoKm", proximoKm);
    if (proximaFecha) fd.append("proximaFecha", proximaFecha);
    if (notas) fd.append("notas", notas);
    if (evidenciaFile) fd.append("evidencia", evidenciaFile);
    if (quitarEvidencia) fd.append("quitarEvidencia", "1");

    try {
      const isEdit = !!editTarget;
      const res = await fetch(
        isEdit ? `/api/mantenimientos/${editTarget.id}` : `/api/vehiculos/${vehiculoId}/mantenimientos`,
        { method: isEdit ? "PATCH" : "POST", body: fd }
      );
      const json = await res.json() as { error?: string };
      if (!res.ok) { setFormError(json.error ?? "Error al guardar"); return; }
      setModalOpen(false);
      resetForm();
      router.refresh();
      const updated = await fetch(`/api/vehiculos/${vehiculoId}/mantenimientos`).then((r) => r.json() as Promise<Mantenimiento[]>);
      setMantenimientos(updated);
    } catch {
      setFormError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/mantenimientos/${deleteTarget.id}`, { method: "DELETE" });
    setMantenimientos((p) => p.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  // KPIs
  const alertas = mantenimientos.filter(
    (m) => m.alertaKm === "vencido" || m.alertaFecha === "vencido" ||
            m.alertaKm === "proximo" || m.alertaFecha === "proximo"
  ).length;
  const costoTotal = mantenimientos.reduce((s, m) => s + (m.costoSoles ?? 0), 0);
  const ultimoMant = mantenimientos[0] ?? null;

  if (loading) return <div className="text-sm text-muted-foreground py-10 text-center">Cargando...</div>;

  return (
    <>
      {/* ── KPI cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total registros" value={String(mantenimientos.length)} />
        <KpiCard label="Costo acumulado" value={costoTotal > 0 ? `S/. ${fmt(costoTotal)}` : "—"} />
        <KpiCard
          label="Alertas activas"
          value={String(alertas)}
          valueClass={alertas > 0 ? "text-amber-600" : "text-emerald-600"}
        />
        <KpiCard
          label="Último servicio"
          value={ultimoMant ? formatFecha(ultimoMant.fecha) : "—"}
        />
      </div>

      {/* ── Cabecera ───────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Historial</h2>
        {puedeEditar && (
          <Button size="sm" onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus size={14} className="mr-1.5" />Registrar servicio
          </Button>
        )}
      </div>

      {/* ── Lista ──────────────────────────────────────── */}
      {mantenimientos.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Wrench size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay mantenimientos registrados.</p>
          {puedeEditar && (
            <Button size="sm" variant="outline" className="mt-4" onClick={() => { resetForm(); setModalOpen(true); }}>
              Registrar primer servicio
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {mantenimientos.map((m) => {
            const cfg = CATEGORIA_CONFIG[m.categoria] ?? CATEGORIA_CONFIG.otro;
            const isExpanded = expanded === m.id;

            return (
              <div key={m.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {/* Fila principal */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : m.id)}
                >
                  <div className={`shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{cfg.label}</span>
                      <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                        {m.tipo === "preventivo" ? "Preventivo" : "Correctivo"}
                      </Badge>
                      <AlertaBadge km={m.alertaKm} fecha={m.alertaFecha} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{m.descripcion}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-sm font-mono text-muted-foreground">{formatFecha(m.fecha)}</p>
                    <p className="text-xs text-muted-foreground">{m.odometroKm.toLocaleString("es-PE")} km</p>
                  </div>
                  {isExpanded ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                      <DetailRow label="Fecha" value={formatFecha(m.fecha)} />
                      <DetailRow label="Odómetro" value={`${m.odometroKm.toLocaleString("es-PE")} km`} />
                      {m.costoSoles != null && <DetailRow label="Costo" value={`S/. ${fmt(m.costoSoles)}`} />}
                      {m.taller && <DetailRow label="Taller" value={m.taller} />}
                      {m.proximoKm && (
                        <DetailRow
                          label="Próximo (km)"
                          value={`${m.proximoKm.toLocaleString("es-PE")} km`}
                          alert={m.alertaKm}
                        />
                      )}
                      {m.proximaFecha && (
                        <DetailRow
                          label="Próxima fecha"
                          value={formatFecha(m.proximaFecha)}
                          alert={m.alertaFecha}
                        />
                      )}
                      {m.registradorNombre && <DetailRow label="Registrado por" value={m.registradorNombre} />}
                    </div>
                    {m.notas && (
                      <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">{m.notas}</p>
                    )}
                    <div className="flex gap-2 items-center pt-1 flex-wrap">
                      {m.evidenciaUrl && (
                        <a href={m.evidenciaUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink size={12} className="mr-1.5" />Ver evidencia
                          </Button>
                        </a>
                      )}
                      {puedeEditar && (
                        <>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => openEdit(m)}
                          >
                            <Pencil size={12} className="mr-1.5" />Editar
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="text-destructive hover:text-destructive ml-auto"
                            onClick={() => setDeleteTarget(m)}
                          >
                            <Trash2 size={13} className="mr-1" />Eliminar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal registrar / editar servicio ──────────── */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar servicio" : "Registrar servicio"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">

              <Field label="Categoría *" className="col-span-2">
                <Select value={categoria} onValueChange={(v) => setCategoria(v ?? "otro")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>
                        <span className={cfg.color}>{cfg.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Tipo *">
                <Select value={tipo} onValueChange={(v) => setTipo(v ?? "preventivo")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventivo">Preventivo</SelectItem>
                    <SelectItem value="correctivo">Correctivo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Fecha *">
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              </Field>

              <Field label="Descripción *" className="col-span-2">
                <Input
                  placeholder="Ej: Cambio aceite 15W40 + filtro aceite y aire"
                  value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required
                />
              </Field>

              <Field label="Odómetro (km) *" className="col-span-2">
                <Input
                  type="number" min={0} placeholder="Km actuales al hacer el servicio"
                  value={odometroKm} onChange={(e) => setOdometroKm(e.target.value)} required
                />
              </Field>

              <Field label="Costo (S/.)">
                <Input
                  type="number" min={0} step={0.01} placeholder="Ej: 180.00"
                  value={costoSoles} onChange={(e) => setCostoSoles(e.target.value)}
                />
              </Field>

              <Field label="Taller / Mecánico">
                <Input placeholder="Ej: Taller ABC Juliaca" value={taller} onChange={(e) => setTaller(e.target.value)} />
              </Field>

              <div className="col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Próximo servicio programado (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="En km">
                    <Input
                      type="number" min={0} placeholder="Ej: 90000"
                      value={proximoKm} onChange={(e) => setProximoKm(e.target.value)}
                    />
                  </Field>
                  <Field label="En fecha">
                    <Input type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} />
                  </Field>
                </div>
              </div>

              <Field label="Evidencia (foto/PDF)" className="col-span-2">
                {editTarget?.evidenciaUrl && !quitarEvidencia ? (
                  <div className="flex items-center gap-2">
                    <a href={editTarget.evidenciaUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary underline flex items-center gap-1">
                      <ExternalLink size={11} />Ver evidencia actual
                    </a>
                    <Button type="button" variant="ghost" size="sm"
                      className="text-destructive h-6 px-2 text-xs"
                      onClick={() => setQuitarEvidencia(true)}>
                      <X size={11} className="mr-1" />Quitar
                    </Button>
                  </div>
                ) : (
                  <Input
                    type="file" accept="image/*,application/pdf"
                    onChange={(e) => setEvidenciaFile(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                )}
                {evidenciaFile && <p className="text-xs text-emerald-600 mt-1">{evidenciaFile.name}</p>}
                {quitarEvidencia && <p className="text-xs text-amber-600 mt-1">Se quitará la evidencia al guardar</p>}
              </Field>

              <Field label="Notas" className="col-span-2">
                <textarea
                  rows={2} placeholder="Observaciones adicionales..."
                  value={notas} onChange={(e) => setNotas(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                />
              </Field>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setModalOpen(false); resetForm(); }} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : editTarget ? "Guardar cambios" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal confirmar eliminar ────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este registro?</DialogTitle>
            <DialogDescription>
              {deleteTarget && CATEGORIA_CONFIG[deleteTarget.categoria]?.label} del{" "}
              {deleteTarget ? formatFecha(deleteTarget.fecha) : ""}. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function DetailRow({
  label, value, alert,
}: {
  label: string;
  value: string;
  alert?: "vencido" | "proximo" | "ok" | null;
}) {
  const colorClass = alert === "vencido" ? "text-red-600 font-semibold"
    : alert === "proximo" ? "text-amber-600 font-medium"
    : "";
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${colorClass}`}>{value}</p>
    </div>
  );
}
