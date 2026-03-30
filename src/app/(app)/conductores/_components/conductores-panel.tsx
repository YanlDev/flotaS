"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus, User, Phone, Mail, CreditCard, Car, Building2,
  Pencil, Trash2, AlertTriangle, CheckCircle, XCircle,
  Power, PowerOff, FileText,
} from "lucide-react";
import { DocumentosConductorModal } from "./documentos-conductor-modal";

// ─── Tipos ────────────────────────────────────────────────────────

interface Conductor {
  id: string;
  nombreCompleto: string;
  dni: string;
  telefono: string | null;
  email: string | null;
  licenciaCategoria: string;
  licenciaNumero: string | null;
  licenciaVencimiento: string | null;
  activo: boolean;
  sucursalId: string | null;
  sucursalNombre: string | null;
  vehiculoId: string | null;
  vehiculoPlaca: string | null;
  vehiculoDesc: string | null;
}

interface Sucursal { id: string; nombre: string; }
interface Vehiculo { id: string; placa: string; marca: string; modelo: string; }

interface Props {
  conductores: Conductor[];
  sucursales: Sucursal[];
  vehiculosDisponibles: Vehiculo[];
  esAdmin: boolean;
  puedeEditar: boolean;
  sucursalDefaultId: string | null;
}

const CATEGORIAS = ["A1","A2a","A2b","A3a","A3b","A3c","B","B2C","C","D","E"];

function diasHasta(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const vence = new Date(fecha + "T00:00:00");
  return Math.ceil((vence.getTime() - hoy.getTime()) / (1000*60*60*24));
}

function LicBadge({ vencimiento }: { vencimiento: string | null }) {
  if (!vencimiento) return null;
  const d = diasHasta(vencimiento);
  if (d < 0)  return <span className="flex items-center gap-1 text-xs text-red-600"><XCircle size={11} />Lic. vencida</span>;
  if (d <= 30) return <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={11} />Vence en {d}d</span>;
  return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle size={11} />{new Date(vencimiento+"T00:00:00").toLocaleDateString("es-PE")}</span>;
}

// ─── Formulario vacío ─────────────────────────────────────────────

const EMPTY = {
  nombreCompleto: "", dni: "", telefono: "", email: "",
  licenciaCategoria: "", licenciaNumero: "", licenciaVencimiento: "",
  sucursalId: "", vehiculoId: "",
};

// ─── Componente principal ─────────────────────────────────────────

export function ConductoresPanel({
  conductores: inicial, sucursales, vehiculosDisponibles, esAdmin, puedeEditar, sucursalDefaultId,
}: Props) {
  const router = useRouter();
  const [conductores, setConductores] = useState<Conductor[]>(inicial);
  const [q, setQ] = useState("");

  // Modal crear/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Conductor | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal delete / toggle / docs
  const [deleteTarget, setDeleteTarget] = useState<Conductor | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Conductor | null>(null);
  const [docsTarget, setDocsTarget] = useState<Conductor | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function openCrear() {
    setEditTarget(null);
    setForm({ ...EMPTY, sucursalId: sucursalDefaultId ?? "" });
    setError(null);
    setModalOpen(true);
  }

  function openEditar(c: Conductor) {
    setEditTarget(c);
    setForm({
      nombreCompleto: c.nombreCompleto,
      dni: c.dni,
      telefono: c.telefono ?? "",
      email: c.email ?? "",
      licenciaCategoria: c.licenciaCategoria,
      licenciaNumero: c.licenciaNumero ?? "",
      licenciaVencimiento: c.licenciaVencimiento ?? "",
      sucursalId: c.sucursalId ?? "",
      vehiculoId: c.vehiculoId ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.nombreCompleto.trim() || !form.dni.trim() || !form.licenciaCategoria) {
      setError("Nombre, DNI y categoría son requeridos."); return;
    }
    setSaving(true); setError(null);
    const body = {
      nombreCompleto: form.nombreCompleto,
      dni: form.dni,
      telefono: form.telefono || null,
      email: form.email || null,
      licenciaCategoria: form.licenciaCategoria,
      licenciaNumero: form.licenciaNumero || null,
      licenciaVencimiento: form.licenciaVencimiento || null,
      sucursalId: form.sucursalId || null,
      vehiculoId: form.vehiculoId || null,
    };
    try {
      const res = editTarget
        ? await fetch(`/api/conductores/${editTarget.id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) })
        : await fetch("/api/conductores", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(json.error ?? "Error"); return; }
      setModalOpen(false);
      router.refresh();
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/conductores/${deleteTarget.id}`, { method: "DELETE" });
    setConductores((p) => p.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function handleToggle() {
    if (!toggleTarget) return;
    const res = await fetch(`/api/conductores/${toggleTarget.id}`, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ activo: !toggleTarget.activo }),
    });
    if (res.ok) {
      setConductores((p) => p.map((c) => c.id === toggleTarget.id ? { ...c, activo: !c.activo } : c));
    }
    setToggleTarget(null);
  }

  const filtrados = conductores.filter((c) =>
    !q || c.nombreCompleto.toLowerCase().includes(q.toLowerCase()) ||
          c.dni.includes(q) || (c.vehiculoPlaca ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const activos = conductores.filter((c) => c.activo).length;

  // Vehículos disponibles para el select (incluir el actual en edición)
  const vehiculosSelect = editTarget?.vehiculoId
    ? [...vehiculosDisponibles.filter((v) => v.id !== editTarget.vehiculoId),
       ...(editTarget.vehiculoId ? [{ id: editTarget.vehiculoId, placa: editTarget.vehiculoPlaca ?? "", marca: editTarget.vehiculoDesc?.split(" ")[0] ?? "", modelo: editTarget.vehiculoDesc?.split(" ").slice(1).join(" ") ?? "" }] : [])]
    : vehiculosDisponibles;

  return (
    <>
      {/* ── Stats + búsqueda + botón ───────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"/>{ activos} activos</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300"/>{conductores.length - activos} inactivos</span>
        </div>
        <Input
          className="flex-1 min-w-[200px]"
          placeholder="Buscar por nombre, DNI o placa..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {puedeEditar && (
          <Button size="sm" onClick={openCrear}>
            <Plus size={14} className="mr-1.5" />Nuevo conductor
          </Button>
        )}
      </div>

      {/* ── Tabla desktop ─────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Conductor</th>
              <th className="text-left px-4 py-3 font-medium">Licencia</th>
              <th className="text-left px-4 py-3 font-medium">Vehículo asignado</th>
              {esAdmin && <th className="text-left px-4 py-3 font-medium">Sucursal</th>}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Sin resultados</td></tr>
            )}
            {filtrados.map((c) => (
              <tr key={c.id} className={`transition-colors ${c.activo ? "hover:bg-muted/30" : "opacity-50"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {c.nombreCompleto.split(" ").slice(0,2).map((n)=>n[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{c.nombreCompleto}</p>
                      <p className="text-xs text-muted-foreground">DNI {c.dni}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="font-mono text-xs">{c.licenciaCategoria}</Badge>
                  <div className="mt-0.5"><LicBadge vencimiento={c.licenciaVencimiento} /></div>
                </td>
                <td className="px-4 py-3">
                  {c.vehiculoPlaca
                    ? <span className="font-mono font-semibold text-primary text-sm">{c.vehiculoPlaca} <span className="font-normal text-muted-foreground font-sans">{c.vehiculoDesc}</span></span>
                    : <span className="text-muted-foreground text-xs">Sin asignar</span>}
                </td>
                {esAdmin && <td className="px-4 py-3 text-muted-foreground">{c.sucursalNombre ?? "—"}</td>}
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setDocsTarget(c)} title="Documentos">
                      <FileText size={13}/>
                    </Button>
                    {puedeEditar && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEditar(c)}><Pencil size={13} className="mr-1"/>Editar</Button>
                        <Button variant="ghost" size="sm"
                          className={c.activo ? "text-amber-500 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-800"}
                          onClick={() => setToggleTarget(c)}>
                          {c.activo ? <PowerOff size={13}/> : <Power size={13}/>}
                        </Button>
                        {esAdmin && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                            <Trash2 size={13}/>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Cards mobile ──────────────────────────────────── */}
        <div className="md:hidden divide-y">
          {filtrados.map((c) => (
            <div key={c.id} className={`p-4 space-y-3 ${!c.activo ? "opacity-50" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  {c.nombreCompleto.split(" ").slice(0,2).map((n)=>n[0]).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{c.nombreCompleto}</p>
                  <p className="text-xs text-muted-foreground">DNI {c.dni}</p>
                  {c.telefono && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10}/>{c.telefono}</p>}
                </div>
                <Badge variant="outline" className="font-mono text-xs shrink-0">{c.licenciaCategoria}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {c.vehiculoPlaca && <span className="flex items-center gap-1"><Car size={11}/><span className="font-mono font-semibold text-primary">{c.vehiculoPlaca}</span></span>}
                {c.sucursalNombre && <span className="flex items-center gap-1"><Building2 size={11}/>{c.sucursalNombre}</span>}
                <LicBadge vencimiento={c.licenciaVencimiento} />
              </div>
              <div className="flex gap-2 pt-1 border-t">
                <Button variant="ghost" size="sm" onClick={() => setDocsTarget(c)}>
                  <FileText size={13} className="mr-1"/>Docs
                </Button>
                {puedeEditar && (
                  <>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditar(c)}><Pencil size={12} className="mr-1"/>Editar</Button>
                    <Button variant="ghost" size="sm"
                      className={c.activo ? "text-amber-500" : "text-emerald-600"}
                      onClick={() => setToggleTarget(c)}>
                      {c.activo ? <PowerOff size={13}/> : <Power size={13}/>}
                    </Button>
                    {esAdmin && <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 size={13}/></Button>}
                  </>
                )}
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">Sin resultados</div>
          )}
        </div>
      </div>

      {/* ── Modal Crear/Editar ─────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar conductor" : "Nuevo conductor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cn"><User size={12} className="inline mr-1"/>Nombre completo *</Label>
                <Input id="cn" value={form.nombreCompleto} onChange={(e) => set("nombreCompleto", e.target.value)} placeholder="Juan Pérez Quispe"/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cdni"><CreditCard size={12} className="inline mr-1"/>DNI *</Label>
                <Input id="cdni" value={form.dni} onChange={(e) => set("dni", e.target.value)} placeholder="12345678" maxLength={8}/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctel"><Phone size={12} className="inline mr-1"/>Teléfono</Label>
                <Input id="ctel" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="999 000 111"/>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cemail"><Mail size={12} className="inline mr-1"/>Email</Label>
                <Input id="cemail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="conductor@email.com"/>
              </div>
              <div className="space-y-1.5">
                <Label>Categoría licencia *</Label>
                <Select value={form.licenciaCategoria} onValueChange={(v) => set("licenciaCategoria", v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clicnum">Nro. de licencia</Label>
                <Input id="clicnum" value={form.licenciaNumero} onChange={(e) => set("licenciaNumero", e.target.value)} placeholder="Q12345678"/>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="clicvenc">Vencimiento licencia</Label>
                <Input id="clicvenc" type="date" value={form.licenciaVencimiento} onChange={(e) => set("licenciaVencimiento", e.target.value)}/>
              </div>
              {esAdmin && (
                <div className="col-span-2 space-y-1.5">
                  <Label>Sucursal</Label>
                  <Select value={form.sucursalId} onValueChange={(v) => set("sucursalId", v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Selecciona sucursal"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin sucursal</SelectItem>
                      {sucursales.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2 space-y-1.5">
                <Label><Car size={12} className="inline mr-1"/>Vehículo asignado</Label>
                <Select value={form.vehiculoId} onValueChange={(v) => set("vehiculoId", v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Sin vehículo asignado"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin vehículo</SelectItem>
                    {vehiculosSelect.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : editTarget ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Toggle ──────────────────────────────────── */}
      <Dialog open={!!toggleTarget} onOpenChange={(o) => { if (!o) setToggleTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{toggleTarget?.activo ? "Desactivar" : "Activar"} conductor</DialogTitle>
            <DialogDescription>{toggleTarget?.nombreCompleto}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)}>Cancelar</Button>
            <Button variant={toggleTarget?.activo ? "destructive" : "default"} onClick={handleToggle}>
              {toggleTarget?.activo ? "Desactivar" : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Delete ──────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar conductor?</DialogTitle>
            <DialogDescription>
              Se eliminará permanentemente a <span className="font-semibold">{deleteTarget?.nombreCompleto}</span>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Documentos ──────────────────────────────── */}
      {docsTarget && (
        <DocumentosConductorModal
          conductorId={docsTarget.id}
          conductorNombre={docsTarget.nombreCompleto}
          open={!!docsTarget}
          onClose={() => setDocsTarget(null)}
          puedeGestionar={puedeEditar}
        />
      )}
    </>
  );
}
