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
  Fuel, Plus, Trash2, Image as ImageIcon, FileText,
  TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, ExternalLink,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Carga {
  id: string;
  fecha: string;
  estado: "pendiente" | "revisado";
  odometroKm: number | null;
  galones: number | null;
  precioPorGalon: number | null;
  totalSoles: number | null;
  tipoCombustible: string | null;
  notas: string | null;
  conductorNombre: string | null;
  registradorNombre: string | null;
  revisorNombre: string | null;
  revisadoAt: string | null;
  kmRecorridos: number | null;
  rendimientoKmGalon: number | null;
  costoPorKm: number | null;
  comprobanteUrl: string | null;
  odometroFotoUrl: string | null;
  createdAt: string;
}

interface Props {
  vehiculoId: string;
  tipoCombustibleVehiculo: string;
  puedeCargar: boolean;
  puedeRevisar: boolean;
  puedeEliminar: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  gasolina: "Gasolina", diesel: "Diesel", glp: "GLP",
  gnv: "GNV", electrico: "Eléctrico", hibrido: "Híbrido",
};

function fmt(n: number, dec = 2) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function RendBadge({ val }: { val: number | null }) {
  if (val === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (val >= 10) return <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><TrendingUp size={12} />{fmt(val, 2)} km/gal</span>;
  if (val >= 6) return <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><Minus size={12} />{fmt(val, 2)} km/gal</span>;
  return <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><TrendingDown size={12} />{fmt(val, 2)} km/gal</span>;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CombustiblePanel({
  vehiculoId, tipoCombustibleVehiculo, puedeCargar, puedeRevisar, puedeEliminar,
}: Props) {
  const router = useRouter();
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal nueva carga (solo fotos)
  const [modalCargaOpen, setModalCargaOpen] = useState(false);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [odometroFotoFile, setOdometroFotoFile] = useState<File | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [savingCarga, setSavingCarga] = useState(false);
  const [cargaError, setCargaError] = useState<string | null>(null);

  // Modal revisar carga
  const [revTarget, setRevTarget] = useState<Carga | null>(null);
  const [revKm, setRevKm] = useState("");
  const [revGalones, setRevGalones] = useState("");
  const [revPrecio, setRevPrecio] = useState("");
  const [revTipo, setRevTipo] = useState(tipoCombustibleVehiculo);
  const [revNotas, setRevNotas] = useState("");
  const [savingRev, setSavingRev] = useState(false);
  const [revError, setRevError] = useState<string | null>(null);

  // Modal eliminar
  const [deleteTarget, setDeleteTarget] = useState<Carga | null>(null);

  async function cargarDatos() {
    const data = await fetch(`/api/vehiculos/${vehiculoId}/combustible`).then((r) => r.json() as Promise<Carga[]>);
    setCargas(data);
  }

  useEffect(() => {
    cargarDatos().finally(() => setLoading(false));
  }, [vehiculoId]);

  // ── Submit nueva carga ──────────────────────────────────────────
  async function handleSubmitCarga(e: React.FormEvent) {
    e.preventDefault();
    setCargaError(null);
    setSavingCarga(true);
    const fd = new FormData();
    fd.append("fecha", fecha);
    if (comprobanteFile) fd.append("comprobante", comprobanteFile);
    if (odometroFotoFile) fd.append("odometroFoto", odometroFotoFile);
    try {
      const res = await fetch(`/api/vehiculos/${vehiculoId}/combustible`, { method: "POST", body: fd });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setCargaError(json.error ?? "Error al registrar"); return; }
      setModalCargaOpen(false);
      resetCarga();
      await cargarDatos();
      router.refresh();
    } catch {
      setCargaError("Error de conexión.");
    } finally {
      setSavingCarga(false);
    }
  }

  function resetCarga() {
    setFecha(new Date().toISOString().split("T")[0]);
    setComprobanteFile(null);
    setOdometroFotoFile(null);
    setCargaError(null);
  }

  // ── Submit revisión ─────────────────────────────────────────────
  async function handleSubmitRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!revTarget) return;
    setRevError(null);
    setSavingRev(true);
    try {
      const res = await fetch(`/api/combustible/${revTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odometroKm: Number(revKm),
          galones: Number(revGalones),
          precioPorGalon: Number(revPrecio),
          tipoCombustible: revTipo,
          notas: revNotas || null,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setRevError(json.error ?? "Error al revisar"); return; }
      setRevTarget(null);
      resetRev();
      await cargarDatos();
      router.refresh();
    } catch {
      setRevError("Error de conexión.");
    } finally {
      setSavingRev(false);
    }
  }

  function openRevision(c: Carga) {
    setRevTarget(c);
    setRevKm("");
    setRevGalones("");
    setRevPrecio("");
    setRevTipo(tipoCombustibleVehiculo);
    setRevNotas("");
    setRevError(null);
  }

  function resetRev() {
    setRevKm(""); setRevGalones(""); setRevPrecio("");
    setRevTipo(tipoCombustibleVehiculo); setRevNotas("");
    setRevError(null);
  }

  // ── Eliminar ────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/combustible/${deleteTarget.id}`, { method: "DELETE" });
    setCargas((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  // ── KPIs ────────────────────────────────────────────────────────
  const pendientes = cargas.filter((c) => c.estado === "pendiente");
  const revisadas = cargas.filter((c) => c.estado === "revisado");

  const totalGastoMes = (() => {
    const mes = new Date().toISOString().slice(0, 7);
    return revisadas.filter((c) => c.fecha.startsWith(mes)).reduce((s, c) => s + (c.totalSoles ?? 0), 0);
  })();

  const rendimientoPromedio = (() => {
    const vals = revisadas.map((c) => c.rendimientoKmGalon).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  })();

  const ultimaRevisada = revisadas[0] ?? null;

  // ── Total cálculo revisión ──────────────────────────────────────
  const revTotal = (() => {
    const g = parseFloat(revGalones);
    const p = parseFloat(revPrecio);
    if (!isNaN(g) && !isNaN(p) && g > 0 && p > 0) return g * p;
    return null;
  })();

  if (loading) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Cargando historial...</div>;
  }

  return (
    <>
      {/* ── KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Gasto este mes" value={`S/. ${fmt(totalGastoMes)}`} />
        <KpiCard label="Cargas revisadas" value={String(revisadas.length)} />
        <KpiCard
          label="Rendimiento promedio"
          value={rendimientoPromedio !== null ? `${fmt(rendimientoPromedio, 2)} km/gal` : "—"}
        />
        <KpiCard
          label="Último odómetro"
          value={ultimaRevisada?.odometroKm ? `${ultimaRevisada.odometroKm.toLocaleString("es-PE")} km` : "—"}
        />
      </div>

      {/* ── Bandeja de pendientes ───────────────────────────────── */}
      {pendientes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-amber-500" />
            <h2 className="font-semibold text-base">Por revisar</h2>
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
              {pendientes.length}
            </Badge>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 divide-y divide-amber-100">
            {pendientes.map((c) => (
              <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{formatFecha(c.fecha)}</p>
                  <p className="text-xs text-muted-foreground">
                    Registrado por {c.registradorNombre ?? "—"} · {new Date(c.createdAt).toLocaleString("es-PE")}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  {c.odometroFotoUrl && (
                    <a href={c.odometroFotoUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                        <ImageIcon size={12} />Odómetro
                      </Button>
                    </a>
                  )}
                  {c.comprobanteUrl && (
                    <a href={c.comprobanteUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                        <FileText size={12} />Factura
                      </Button>
                    </a>
                  )}
                  {puedeRevisar && (
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openRevision(c)}>
                      <CheckCircle2 size={12} />Revisar
                    </Button>
                  )}
                  {puedeEliminar && (
                    <Button
                      variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cabecera historial ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <h2 className="font-semibold text-base">Historial revisado</h2>
        </div>
        {puedeCargar && (
          <Button size="sm" onClick={() => { resetCarga(); setModalCargaOpen(true); }}>
            <Plus size={14} className="mr-1.5" />Nueva carga
          </Button>
        )}
      </div>

      {/* ── Tabla historial ─────────────────────────────────────── */}
      {revisadas.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Fuel size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay cargas revisadas aún.</p>
          {puedeCargar && (
            <Button size="sm" variant="outline" className="mt-4" onClick={() => { resetCarga(); setModalCargaOpen(true); }}>
              Registrar primera carga
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {/* Desktop */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Odómetro</th>
                <th className="text-right px-4 py-3 font-medium">Galones</th>
                <th className="text-right px-4 py-3 font-medium">Precio/gal</th>
                <th className="text-right px-4 py-3 font-medium">Total S/.</th>
                <th className="text-left px-4 py-3 font-medium">Rendimiento</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {revisadas.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatFecha(c.fecha)}</td>
                  <td className="px-4 py-3 font-mono">{c.odometroKm?.toLocaleString("es-PE") ?? "—"} km</td>
                  <td className="px-4 py-3 text-right font-mono">{c.galones !== null ? fmt(c.galones, 3) : "—"}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{c.precioPorGalon !== null ? fmt(c.precioPorGalon) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{c.totalSoles !== null ? fmt(c.totalSoles) : "—"}</td>
                  <td className="px-4 py-3"><RendBadge val={c.rendimientoKmGalon} /></td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{TIPO_LABELS[c.tipoCombustible ?? ""] ?? c.tipoCombustible ?? "—"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end items-center">
                      {c.comprobanteUrl && (
                        <a href={c.comprobanteUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" title="Ver comprobante"><FileText size={13} /></Button>
                        </a>
                      )}
                      {c.odometroFotoUrl && (
                        <a href={c.odometroFotoUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" title="Ver foto odómetro"><ImageIcon size={13} /></Button>
                        </a>
                      )}
                      {puedeEliminar && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile */}
          <div className="md:hidden divide-y">
            {revisadas.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{formatFecha(c.fecha)}</p>
                    <p className="text-xs text-muted-foreground font-mono">{c.odometroKm?.toLocaleString("es-PE") ?? "—"} km</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">S/. {c.totalSoles !== null ? fmt(c.totalSoles) : "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.galones !== null ? fmt(c.galones, 3) : "—"} gal · S/. {c.precioPorGalon !== null ? fmt(c.precioPorGalon) : "—"}/gal
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <RendBadge val={c.rendimientoKmGalon} />
                  <Badge variant="outline" className="text-xs">{TIPO_LABELS[c.tipoCombustible ?? ""] ?? c.tipoCombustible ?? "—"}</Badge>
                </div>
                <div className="flex gap-2 pt-1">
                  {c.comprobanteUrl && (
                    <a href={c.comprobanteUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm"><FileText size={12} className="mr-1" />Comprobante</Button>
                    </a>
                  )}
                  {c.odometroFotoUrl && (
                    <a href={c.odometroFotoUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm"><ImageIcon size={12} className="mr-1" />Odómetro</Button>
                    </a>
                  )}
                  {puedeEliminar && (
                    <Button variant="ghost" size="sm" className="text-destructive ml-auto" onClick={() => setDeleteTarget(c)}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal nueva carga (solo fotos) ──────────────────────── */}
      <Dialog open={modalCargaOpen} onOpenChange={(o) => { if (!o) { setModalCargaOpen(false); resetCarga(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar carga de combustible</DialogTitle>
            <DialogDescription>
              Sube las fotos del odómetro y del comprobante. Un encargado revisará y completará los datos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCarga} className="space-y-4">
            <Field label="Fecha">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </Field>

            <Field label="Foto del odómetro / tablero *">
              <div className="space-y-2">
                <label className={`flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${odometroFotoFile ? "border-emerald-400 bg-emerald-50" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"}`}>
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => setOdometroFotoFile(e.target.files?.[0] ?? null)}
                    required
                  />
                  {odometroFotoFile ? (
                    <div className="text-center">
                      <ImageIcon size={20} className="mx-auto text-emerald-600 mb-1" />
                      <p className="text-xs text-emerald-700 font-medium">{odometroFotoFile.name}</p>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon size={20} className="mx-auto mb-1 opacity-40" />
                      <p className="text-xs">Toca para seleccionar foto</p>
                    </div>
                  )}
                </label>
              </div>
            </Field>

            <Field label="Foto del comprobante / factura *">
              <label className={`flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${comprobanteFile ? "border-emerald-400 bg-emerald-50" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"}`}>
                <input
                  type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => setComprobanteFile(e.target.files?.[0] ?? null)}
                  required
                />
                {comprobanteFile ? (
                  <div className="text-center">
                    <FileText size={20} className="mx-auto text-emerald-600 mb-1" />
                    <p className="text-xs text-emerald-700 font-medium">{comprobanteFile.name}</p>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <FileText size={20} className="mx-auto mb-1 opacity-40" />
                    <p className="text-xs">Toca para seleccionar foto o PDF</p>
                  </div>
                )}
              </label>
            </Field>

            {cargaError && <p className="text-sm text-destructive">{cargaError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setModalCargaOpen(false); resetCarga(); }} disabled={savingCarga}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingCarga || !comprobanteFile || !odometroFotoFile}>
                {savingCarga ? "Enviando..." : "Enviar fotos"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal revisión ──────────────────────────────────────── */}
      <Dialog open={!!revTarget} onOpenChange={(o) => { if (!o) { setRevTarget(null); resetRev(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisar carga — {revTarget ? formatFecha(revTarget.fecha) : ""}</DialogTitle>
            <DialogDescription>
              Revisá las fotos y completá los datos de la carga.
            </DialogDescription>
          </DialogHeader>

          {/* Fotos */}
          {revTarget && (
            <div className="flex gap-3">
              {revTarget.odometroFotoUrl && (
                <a href={revTarget.odometroFotoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border bg-muted/30 hover:bg-muted/50 p-3 text-sm text-muted-foreground transition-colors">
                  <ImageIcon size={14} />Odómetro <ExternalLink size={11} />
                </a>
              )}
              {revTarget.comprobanteUrl && (
                <a href={revTarget.comprobanteUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border bg-muted/30 hover:bg-muted/50 p-3 text-sm text-muted-foreground transition-colors">
                  <FileText size={14} />Factura <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}

          <form onSubmit={handleSubmitRevision} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Odómetro actual (km) *" className="col-span-2">
                <Input
                  type="number" min={0} placeholder="Ej: 85400"
                  value={revKm} onChange={(e) => setRevKm(e.target.value)} required
                />
              </Field>

              <Field label="Galones cargados *">
                <Input
                  type="number" min={0.001} step={0.001} placeholder="Ej: 12.500"
                  value={revGalones} onChange={(e) => setRevGalones(e.target.value)} required
                />
              </Field>

              <Field label="Precio por galón (S/.) *">
                <Input
                  type="number" min={0.01} step={0.01} placeholder="Ej: 15.50"
                  value={revPrecio} onChange={(e) => setRevPrecio(e.target.value)} required
                />
              </Field>

              <Field label="Tipo de combustible *" className="col-span-2">
                <Select value={revTipo} onValueChange={(v) => setRevTipo(v ?? tipoCombustibleVehiculo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasolina">Gasolina</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="glp">GLP</SelectItem>
                    <SelectItem value="gnv">GNV</SelectItem>
                    <SelectItem value="electrico">Eléctrico</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {revTotal !== null && (
                <div className="col-span-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <p className="text-xs text-emerald-700 font-medium">Total calculado</p>
                  <p className="text-xl font-bold text-emerald-800">S/. {fmt(revTotal)}</p>
                </div>
              )}

              <Field label="Notas" className="col-span-2">
                <textarea
                  rows={2} placeholder="Observaciones opcionales..."
                  value={revNotas} onChange={(e) => setRevNotas(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                />
              </Field>
            </div>

            {revError && <p className="text-sm text-destructive">{revError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setRevTarget(null); resetRev(); }} disabled={savingRev}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingRev}>
                {savingRev ? "Guardando..." : "Confirmar revisión"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal confirmar eliminar ─────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta carga?</DialogTitle>
            <DialogDescription>
              Carga del {deleteTarget ? formatFecha(deleteTarget.fecha) : ""}. Esta acción no se puede deshacer.
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
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
