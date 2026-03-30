"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserCog, ShieldAlert, Eye, Building2, CheckCircle, XCircle, Trash2 } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────

interface Usuario {
  id: string;
  nombreCompleto: string;
  email: string;
  rol: string;
  activo: boolean;
  sucursalId: string | null;
  sucursalNombre: string | null;
  createdAt: string;
}

interface Sucursal {
  id: string;
  nombre: string;
}

interface Props {
  usuarios: Usuario[];
  sucursales: Sucursal[];
  adminId: string;
}

// ─── Config de roles ──────────────────────────────────────────────

const ROL_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  admin:         { label: "Admin",          badge: "bg-violet-100 text-violet-700 border-0", icon: <ShieldAlert size={12} /> },
  jefe_sucursal: { label: "Jefe Sucursal",  badge: "bg-blue-100 text-blue-700 border-0",    icon: <Building2 size={12} />   },
  visor:         { label: "Visor",          badge: "bg-slate-100 text-slate-600 border-0",  icon: <Eye size={12} />         },
};

// ─── Componente principal ─────────────────────────────────────────

export function UsuariosPanel({ usuarios: inicial, sucursales, adminId }: Props) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>(inicial);
  const [editTarget, setEditTarget] = useState<Usuario | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Usuario | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Estado del formulario de edición
  const [rolEdit, setRolEdit] = useState("");
  const [sucursalEdit, setSucursalEdit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(u: Usuario) {
    setRolEdit(u.rol);
    setSucursalEdit(u.sucursalId ?? "");
    setError(null);
    setEditTarget(u);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = { rol: rolEdit };
    if (rolEdit === "jefe_sucursal") {
      if (!sucursalEdit) {
        setError("Selecciona una sucursal para el jefe.");
        setSaving(false);
        return;
      }
      body.sucursalId = sucursalEdit;
    } else {
      body.sucursalId = null;
    }

    try {
      const res = await fetch(`/api/admin/usuarios/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { error?: string; rol?: string; sucursalId?: string | null; sucursalNombre?: string | null };

      if (!res.ok) { setError(json.error ?? "Error al guardar"); return; }

      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === editTarget.id
            ? { ...u, rol: json.rol ?? u.rol, sucursalId: json.sucursalId ?? null, sucursalNombre: json.sucursalNombre ?? null }
            : u
        )
      );
      setEditTarget(null);
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActivo() {
    if (!toggleTarget) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${toggleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !toggleTarget.activo }),
      });
      if (res.ok) {
        setUsuarios((prev) =>
          prev.map((u) => u.id === toggleTarget.id ? { ...u, activo: !u.activo } : u)
        );
      }
    } finally {
      setToggleTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsuarios((prev) => prev.filter((u) => u.id !== deleteTarget.id));
        router.refresh();
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      {/* ── Contadores ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {(["admin", "jefe_sucursal", "visor"] as const).map((rol) => {
          const count = usuarios.filter((u) => u.rol === rol && u.activo).length;
          const cfg = ROL_CONFIG[rol];
          return (
            <div key={rol} className="rounded-xl border bg-card p-4 text-center space-y-1 shadow-sm">
              <p className="text-2xl font-bold">{count}</p>
              <Badge className={`${cfg.badge} gap-1`}>{cfg.icon}{cfg.label}</Badge>
            </div>
          );
        })}
      </div>

      {/* ── Tabla desktop / Cards mobile ──────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">

        {/* Tabla — desktop */}
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Usuario</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-left px-4 py-3 font-medium">Sucursal</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {usuarios.map((u) => {
              const cfg = ROL_CONFIG[u.rol] ?? ROL_CONFIG.visor;
              const esMismoAdmin = u.id === adminId;
              return (
                <tr key={u.id} className={`transition-colors ${u.activo ? "hover:bg-muted/30" : "opacity-50"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nombre={u.nombreCompleto} activo={u.activo} />
                      <div>
                        <p className="font-medium">{u.nombreCompleto}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`${cfg.badge} gap-1`}>{cfg.icon}{cfg.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.sucursalNombre ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.activo
                      ? <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle size={13} />Activo</span>
                      : <span className="flex items-center gap-1 text-slate-400 text-xs"><XCircle size={13} />Inactivo</span>}
                  </td>
                  <td className="px-4 py-3">
                    {!esMismoAdmin && (
                      <div className="flex gap-1.5 justify-end">
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          <UserCog size={13} className="mr-1" />Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={u.activo ? "text-red-500 hover:text-red-700" : "text-emerald-600 hover:text-emerald-800"}
                          onClick={() => setToggleTarget(u)}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Cards — mobile */}
        <div className="md:hidden divide-y">
          {usuarios.map((u) => {
            const cfg = ROL_CONFIG[u.rol] ?? ROL_CONFIG.visor;
            const esMismoAdmin = u.id === adminId;
            return (
              <div key={u.id} className={`p-4 space-y-2.5 ${!u.activo ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar nombre={u.nombreCompleto} activo={u.activo} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{u.nombreCompleto}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge className={`${cfg.badge} gap-1 shrink-0`}>{cfg.icon}{cfg.label}</Badge>
                </div>
                {u.sucursalNombre && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 size={11} />{u.sucursalNombre}
                  </p>
                )}
                {!esMismoAdmin && (
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(u)}>
                      <UserCog size={13} className="mr-1" />Editar rol
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={u.activo ? "text-red-500" : "text-emerald-600"}
                      onClick={() => setToggleTarget(u)}
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal: Editar rol/sucursal ─────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>{editTarget?.nombreCompleto}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rol</label>
              <Select value={rolEdit} onValueChange={(v) => { setRolEdit(v ?? ""); setSucursalEdit(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="jefe_sucursal">Jefe de Sucursal</SelectItem>
                  <SelectItem value="visor">Visor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rolEdit === "jefe_sucursal" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Sucursal *</label>
                <Select value={sucursalEdit} onValueChange={(v) => setSucursalEdit(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Selecciona sucursal" /></SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirmar eliminación ─────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.nombreCompleto}</strong> perderá acceso permanentemente.
              Sus registros (combustible, mantenimientos, documentos) se conservan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirmar toggle activo ────────────────── */}
      <Dialog open={!!toggleTarget} onOpenChange={(o) => { if (!o) setToggleTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.activo ? "Desactivar" : "Activar"} usuario
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.activo
                ? `${toggleTarget.nombreCompleto} no podrá ingresar al sistema.`
                : `${toggleTarget?.nombreCompleto} recuperará el acceso al sistema.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)}>Cancelar</Button>
            <Button
              variant={toggleTarget?.activo ? "destructive" : "default"}
              onClick={handleToggleActivo}
            >
              {toggleTarget?.activo ? "Desactivar" : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Avatar({ nombre, activo }: { nombre: string; activo: boolean }) {
  const initials = nombre.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
      activo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
    }`}>
      {initials}
    </div>
  );
}
