"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Truck,
  Users,
  MapPin,
  Plus,
  Pencil,
  Power,
  PowerOff,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────

interface Sucursal {
  id: string;
  nombre: string;
  ciudad: string;
  region: string | null;
  activa: boolean;
  totalVehiculos: number;
  totalUsuarios: number;
}

// ─── Componente ───────────────────────────────────────────────────

export function SucursalesPanel({ sucursales: inicial }: { sucursales: Sucursal[] }) {
  const router = useRouter();
  const [sucursales, setSucursales] = useState<Sucursal[]>(inicial);

  // Modal crear/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Sucursal | null>(null);
  const [nombre, setNombre] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal toggle activa
  const [toggleTarget, setToggleTarget] = useState<Sucursal | null>(null);

  function openCrear() {
    setEditTarget(null);
    setNombre("");
    setCiudad("");
    setRegion("");
    setError(null);
    setModalOpen(true);
  }

  function openEditar(s: Sucursal) {
    setEditTarget(s);
    setNombre(s.nombre);
    setCiudad(s.ciudad);
    setRegion(s.region ?? "");
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!nombre.trim() || !ciudad.trim()) {
      setError("Nombre y ciudad son requeridos.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = editTarget
        ? await fetch(`/api/admin/sucursales/${editTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nombre.trim(), ciudad: ciudad.trim(), region: region.trim() || null }),
          })
        : await fetch("/api/admin/sucursales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nombre.trim(), ciudad: ciudad.trim(), region: region.trim() || null }),
          });

      const json = await res.json() as { error?: string; id?: string; nombre?: string; ciudad?: string; region?: string | null; activa?: boolean };

      if (!res.ok) { setError(json.error ?? "Error al guardar"); return; }

      if (editTarget) {
        setSucursales((prev) =>
          prev.map((s) => s.id === editTarget.id
            ? { ...s, nombre: json.nombre ?? s.nombre, ciudad: json.ciudad ?? s.ciudad, region: json.region ?? null }
            : s
          )
        );
      } else {
        // Sucursal nueva: refrescar desde servidor para obtener counts
        router.refresh();
      }
      setModalOpen(false);
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!toggleTarget) return;
    try {
      const res = await fetch(`/api/admin/sucursales/${toggleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: !toggleTarget.activa }),
      });
      if (res.ok) {
        setSucursales((prev) =>
          prev.map((s) => s.id === toggleTarget.id ? { ...s, activa: !s.activa } : s)
        );
      }
    } finally {
      setToggleTarget(null);
    }
  }

  const activas = sucursales.filter((s) => s.activa).length;

  return (
    <>
      {/* Stats + botón crear */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {activas} activas
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            {sucursales.length - activas} inactivas
          </span>
        </div>
        <Button size="sm" onClick={openCrear}>
          <Plus size={14} className="mr-1.5" />Nueva sucursal
        </Button>
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sucursales.map((s) => (
          <div
            key={s.id}
            className={`rounded-xl border bg-card shadow-sm overflow-hidden transition-opacity ${!s.activa ? "opacity-60" : ""}`}
          >
            {/* Franja de estado */}
            <div className={`h-1 ${s.activa ? "bg-emerald-500" : "bg-slate-300"}`} />

            <div className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.nombre}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin size={11} />
                    <span>{s.ciudad}{s.region ? ` · ${s.region}` : ""}</span>
                  </div>
                </div>
                <Badge className={s.activa
                  ? "bg-emerald-100 text-emerald-700 border-0 text-xs"
                  : "bg-slate-100 text-slate-500 border-0 text-xs"}>
                  {s.activa ? "Activa" : "Inactiva"}
                </Badge>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck size={14} />
                  <span>{s.totalVehiculos} vehículos</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users size={14} />
                  <span>{s.totalUsuarios} usuarios</span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-1 border-t">
                <Button variant="ghost" size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => openEditar(s)}>
                  <Pencil size={12} />Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex-1 gap-1.5 text-xs ${s.activa ? "text-red-500 hover:text-red-700" : "text-emerald-600 hover:text-emerald-800"}`}
                  onClick={() => setToggleTarget(s)}
                >
                  {s.activa
                    ? <><PowerOff size={12} />Desactivar</>
                    : <><Power size={12} />Activar</>}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal: Crear/Editar ──────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-nombre">Nombre *</Label>
              <Input id="s-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juliaca" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-ciudad">Ciudad *</Label>
              <Input id="s-ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Juliaca" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-region">Región</Label>
              <Input id="s-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Puno" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editTarget ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirmar toggle ──────────────────────── */}
      <Dialog open={!!toggleTarget} onOpenChange={(o) => { if (!o) setToggleTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.activa ? "Desactivar" : "Activar"} sucursal
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {toggleTarget?.activa
              ? `La sucursal "${toggleTarget.nombre}" no aparecerá en selects de vehículos ni invitaciones.`
              : `La sucursal "${toggleTarget?.nombre}" volverá a estar disponible.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)}>Cancelar</Button>
            <Button variant={toggleTarget?.activa ? "destructive" : "default"} onClick={handleToggle}>
              {toggleTarget?.activa ? "Desactivar" : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
