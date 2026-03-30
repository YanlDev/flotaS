"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sucursal { id: string; nombre: string }
interface Invitacion {
  id: string;
  token: string;
  email: string;
  rol: string;
  usado: boolean;
  expiraEn: string;
  sucursal: { nombre: string } | null;
}

interface Props {
  invitaciones: Invitacion[];
  sucursales: Sucursal[];
}

export function InvitacionesClient({ invitaciones: init, sucursales }: Props) {
  const [invitaciones, setInvitaciones] = useState(init);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCrear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, rol, sucursalId: sucursalId || undefined }),
      });
      const data = await res.json() as Invitacion & { error?: string };
      if (!res.ok) { setError(data.error ?? "Error al crear"); return; }
      setInvitaciones([data, ...invitaciones]);
      setOpen(false);
      setEmail(""); setRol(""); setSucursalId("");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/registro?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const ROL_LABEL: Record<string, string> = {
    jefe_sucursal: "Jefe de Sucursal",
    visor: "Visor",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invitaciones</h1>
        <Button size="sm" onClick={() => setOpen(true)}>+ Nueva invitación</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Crear invitación</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCrear} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Correo electrónico</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="usuario@empresa.com" />
              </div>
              <div className="space-y-1">
                <Label>Rol</Label>
                <Select value={rol} onValueChange={v => setRol(v ?? "")} required>
                  <SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jefe_sucursal">Jefe de Sucursal</SelectItem>
                    <SelectItem value="visor">Visor (solo lectura)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rol === "jefe_sucursal" && (
                <div className="space-y-1">
                  <Label>Sucursal *</Label>
                  <Select value={sucursalId} onValueChange={v => setSucursalId(v ?? "")} required>
                    <SelectTrigger><SelectValue placeholder="Selecciona sucursal" /></SelectTrigger>
                    <SelectContent>
                      {sucursales.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando..." : "Crear y copiar link"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {invitaciones.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          No hay invitaciones creadas.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Email</th>
                <th className="text-left px-4 py-2.5 font-medium">Rol</th>
                <th className="text-left px-4 py-2.5 font-medium">Sucursal</th>
                <th className="text-left px-4 py-2.5 font-medium">Expira</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {invitaciones.map((inv) => {
                const expirado = new Date(inv.expiraEn) < new Date();
                return (
                  <tr key={inv.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{inv.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{ROL_LABEL[inv.rol] ?? inv.rol}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{inv.sucursal?.nombre ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(inv.expiraEn).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-2.5">
                      {inv.usado
                        ? <Badge className="bg-gray-100 text-gray-600 border-0">Usado</Badge>
                        : expirado
                        ? <Badge className="bg-red-100 text-red-600 border-0">Expirado</Badge>
                        : <Badge className="bg-emerald-100 text-emerald-700 border-0">Activo</Badge>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      {!inv.usado && !expirado && (
                        <Button variant="ghost" size="sm" onClick={() => copyLink(inv.token)}>
                          {copied === inv.token ? "✓ Copiado" : "Copiar link"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
