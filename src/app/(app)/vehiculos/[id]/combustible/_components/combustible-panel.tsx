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
  TrendingUp, TrendingDown, Minus, ExternalLink,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Carga {
  id: string;
  fecha: string;
  odometroKm: number;
  galones: number;
  precioPorGalon: number;
  totalSoles: number;
  tipoCombustible: string;
  estacion: string | null;
  ciudad: string | null;
  notas: string | null;
  conductorNombre: string | null;
  registradorNombre: string | null;
  kmRecorridos: number | null;
  rendimientoKmGalon: number | null;
  costoPorKm: number | null;
  comprobanteUrl: string | null;
  odometroFotoUrl: string | null;
  createdAt: string;
}

interface Conductor { id: string; nombreCompleto: string; }

interface Props {
  vehiculoId: string;
  tipoCombustibleVehiculo: string;
  conductores: Conductor[];
  puedeEditar: boolean;
  esAdmin: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  gasolina: "Gasolina", diesel: "Diesel", glp: "GLP",
  gnv: "GNV", electrico: "Eléctrico", hibrido: "Híbrido",
};

function fmt(n: number, dec = 2) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function RendBadge({ val }: { val: number | null }) {
  if (val === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (val >= 10) return <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><TrendingUp size={12}/>{fmt(val, 2)} km/gal</span>;
  if (val >= 6)  return <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><Minus size={12}/>{fmt(val, 2)} km/gal</span>;
  return <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><TrendingDown size={12}/>{fmt(val, 2)} km/gal</span>;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CombustiblePanel({
  vehiculoId, tipoCombustibleVehiculo, conductores, puedeEditar, esAdmin,
}: Props) {
  const router = useRouter();
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Carga | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Campos del formulario
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [galones, setGalones] = useState("");
  const [precioPorGalon, setPrecioPorGalon] = useState("");
  const [totalSoles, setTotalSoles] = useState("");
  const [tipoCombustible, setTipoCombustible] = useState(tipoCombustibleVehiculo);
  const [odometroKm, setOdometroKm] = useState("");
  const [estacion, setEstacion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [conductorId, setConductorId] = useState("");
  const [notas, setNotas] = useState("");
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [odometroFotoFile, setOdometroFotoFile] = useState<File | null>(null);

  useEffect(() => {
    fetch(`/api/vehiculos/${vehiculoId}/combustible`)
      .then((r) => r.json() as Promise<Carga[]>)
      .then(setCargas)
      .finally(() => setLoading(false));
  }, [vehiculoId]);

  // Auto-calcular total cuando cambian galones o precio
  useEffect(() => {
    const g = parseFloat(galones);
    const p = parseFloat(precioPorGalon);
    if (!isNaN(g) && !isNaN(p) && g > 0 && p > 0) {
      setTotalSoles((g * p).toFixed(2));
    }
  }, [galones, precioPorGalon]);

  function resetForm() {
    setFecha(new Date().toISOString().split("T")[0]);
    setGalones(""); setPrecioPorGalon(""); setTotalSoles("");
    setTipoCombustible(tipoCombustibleVehiculo);
    setOdometroKm(""); setEstacion(""); setCiudad("");
    setConductorId(""); setNotas("");
    setComprobanteFile(null); setOdometroFotoFile(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    const fd = new FormData();
    fd.append("fecha", fecha);
    fd.append("galones", galones);
    fd.append("precioPorGalon", precioPorGalon);
    fd.append("totalSoles", totalSoles);
    fd.append("tipoCombustible", tipoCombustible);
    fd.append("odometroKm", odometroKm);
    if (estacion) fd.append("estacion", estacion);
    if (ciudad) fd.append("ciudad", ciudad);
    if (conductorId) fd.append("conductorId", conductorId);
    if (notas) fd.append("notas", notas);
    if (comprobanteFile) fd.append("comprobante", comprobanteFile);
    if (odometroFotoFile) fd.append("odometroFoto", odometroFotoFile);

    try {
      const res = await fetch(`/api/vehiculos/${vehiculoId}/combustible`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setFormError(json.error ?? "Error al registrar"); return; }
      setModalOpen(false);
      resetForm();
      router.refresh();
      // Recargar cargas
      const updated = await fetch(`/api/vehiculos/${vehiculoId}/combustible`).then((r) => r.json() as Promise<Carga[]>);
      setCargas(updated);
    } catch {
      setFormError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/combustible/${deleteTarget.id}`, { method: "DELETE" });
    setCargas((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  // ── KPIs del encabezado ──────────────────────────────────────────
  const totalGastoMes = (() => {
    const mes = new Date().toISOString().slice(0, 7);
    return cargas.filter((c) => c.fecha.startsWith(mes)).reduce((s, c) => s + c.totalSoles, 0);
  })();
  const rendimientoPromedio = (() => {
    const vals = cargas.map((c) => c.rendimientoKmGalon).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  })();
  const ultimaCarga = cargas[0] ?? null;

  if (loading) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Cargando historial...</div>;
  }

  return (
    <>
      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Gasto este mes" value={`S/. ${fmt(totalGastoMes)}`} />
        <KpiCard label="Cargas totales" value={String(cargas.length)} />
        <KpiCard
          label="Rendimiento promedio"
          value={rendimientoPromedio !== null ? `${fmt(rendimientoPromedio, 2)} km/gal` : "—"}
        />
        <KpiCard
          label="Último odómetro"
          value={ultimaCarga ? `${ultimaCarga.odometroKm.toLocaleString("es-PE")} km` : "—"}
        />
      </div>

      {/* ── Cabecera tabla ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Historial de cargas</h2>
        {puedeEditar && (
          <Button size="sm" onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus size={14} className="mr-1.5" />Nueva carga
          </Button>
        )}
      </div>

      {/* ── Tabla ──────────────────────────────────────────── */}
      {cargas.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Fuel size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay cargas registradas.</p>
          {puedeEditar && (
            <Button size="sm" variant="outline" className="mt-4" onClick={() => { resetForm(); setModalOpen(true); }}>
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
                <th className="text-left px-4 py-3 font-medium">Grifo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {cargas.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatFecha(c.fecha)}</td>
                  <td className="px-4 py-3 font-mono">{c.odometroKm.toLocaleString("es-PE")} km</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(c.galones, 3)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{fmt(c.precioPorGalon)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(c.totalSoles)}</td>
                  <td className="px-4 py-3"><RendBadge val={c.rendimientoKmGalon} /></td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{c.estacion ?? <span className="text-muted-foreground">—</span>}</div>
                    {c.ciudad && <div className="text-xs text-muted-foreground">{c.ciudad}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end items-center">
                      {c.comprobanteUrl && (
                        <a href={c.comprobanteUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" title="Ver comprobante">
                            <FileText size={13} />
                          </Button>
                        </a>
                      )}
                      {c.odometroFotoUrl && (
                        <a href={c.odometroFotoUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" title="Ver foto odómetro">
                            <ImageIcon size={13} />
                          </Button>
                        </a>
                      )}
                      {(puedeEditar) && (
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

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {cargas.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{formatFecha(c.fecha)}</p>
                    <p className="text-xs text-muted-foreground font-mono">{c.odometroKm.toLocaleString("es-PE")} km</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">S/. {fmt(c.totalSoles)}</p>
                    <p className="text-xs text-muted-foreground">{fmt(c.galones, 3)} gal · S/. {fmt(c.precioPorGalon)}/gal</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <RendBadge val={c.rendimientoKmGalon} />
                  <Badge variant="outline" className="text-xs">{TIPO_LABELS[c.tipoCombustible] ?? c.tipoCombustible}</Badge>
                </div>
                {c.estacion && <p className="text-xs text-muted-foreground">{c.estacion}{c.ciudad ? ` · ${c.ciudad}` : ""}</p>}
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
                  {puedeEditar && (
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

      {/* ── Modal nueva carga ───────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar carga de combustible</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha *" className="col-span-2">
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              </Field>

              <Field label="Odómetro al cargar (km) *" className="col-span-2">
                <Input
                  type="number" min={0} placeholder="Ej: 85400"
                  value={odometroKm} onChange={(e) => setOdometroKm(e.target.value)} required
                />
              </Field>

              <Field label="Tipo de combustible *">
                <Select value={tipoCombustible} onValueChange={(v) => setTipoCombustible(v ?? tipoCombustibleVehiculo)} required>
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

              <Field label="Galones cargados *">
                <Input
                  type="number" min={0.001} step={0.001} placeholder="Ej: 12.500"
                  value={galones} onChange={(e) => setGalones(e.target.value)} required
                />
              </Field>

              <Field label="Precio por galón (S/.) *">
                <Input
                  type="number" min={0.01} step={0.01} placeholder="Ej: 15.50"
                  value={precioPorGalon} onChange={(e) => setPrecioPorGalon(e.target.value)} required
                />
              </Field>

              <Field label="Total pagado (S/.) *">
                <Input
                  type="number" min={0.01} step={0.01} placeholder="Se calcula automático"
                  value={totalSoles} onChange={(e) => setTotalSoles(e.target.value)} required
                />
              </Field>

              <Field label="Grifo / Estación">
                <Input placeholder="Ej: Primax Juliaca" value={estacion} onChange={(e) => setEstacion(e.target.value)} />
              </Field>

              <Field label="Ciudad">
                <Input placeholder="Ej: Juliaca" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
              </Field>

              {conductores.length > 0 && (
                <Field label="Conductor" className="col-span-2">
                  <Select value={conductorId} onValueChange={(v) => setConductorId(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Sin conductor asignado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin conductor</SelectItem>
                      {conductores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombreCompleto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label="Foto del comprobante" className="col-span-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="file" accept="image/*,application/pdf"
                    onChange={(e) => setComprobanteFile(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                  {comprobanteFile && <span className="text-xs text-emerald-600 shrink-0"><FileText size={12} className="inline mr-1"/>{comprobanteFile.name}</span>}
                </div>
              </Field>

              <Field label="Foto del odómetro" className="col-span-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="file" accept="image/*"
                    onChange={(e) => setOdometroFotoFile(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                  {odometroFotoFile && <span className="text-xs text-emerald-600 shrink-0"><ImageIcon size={12} className="inline mr-1"/>{odometroFotoFile.name}</span>}
                </div>
              </Field>

              <Field label="Notas" className="col-span-2">
                <textarea
                  rows={2} placeholder="Observaciones opcionales..."
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
                {saving ? "Guardando..." : "Registrar carga"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal confirmar eliminar ────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta carga?</DialogTitle>
            <DialogDescription>
              Carga del {deleteTarget ? formatFecha(deleteTarget.fecha) : ""} —{" "}
              {deleteTarget ? fmt(deleteTarget.galones, 3) : ""} gal · S/. {deleteTarget ? fmt(deleteTarget.totalSoles) : ""}. Esta acción no se puede deshacer.
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

function formatFecha(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
