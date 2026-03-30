"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Save, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CategoriaLicencia } from "@/generated/prisma/client";

// ─── Tipos explícitos (sin any) ───────────────────────────────────

interface ConductorEditable {
  id: string;
  nombreCompleto: string;
  dni: string;
  telefono: string | null;
  email: string | null;
  licenciaCategoria: CategoriaLicencia;
  licenciaNumero: string | null;
  licenciaVencimiento: Date | string | null;
  activo: boolean;
  sucursalId: string | null;
  vehiculoId: string | null;
  vehiculo: { id: string; placa: string } | null;
}

interface Sucursal {
  id: string;
  nombre: string;
  ciudad?: string;
}

interface VehiculoOpt {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
}

interface Props {
  conductor: ConductorEditable;
  sucursales: Sucursal[];
  vehiculosDisponibles: VehiculoOpt[];
}

// ─────────────────────────────────────────────────────────────────

const CATEGORIAS_LICENCIA: CategoriaLicencia[] = [
  "A1", "A2a", "A2b", "A3a", "A3b", "A3c", "B", "B2C", "C", "D", "E",
];

export function EditarConductorForm({ conductor, sucursales, vehiculosDisponibles }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sucursalId, setSucursalId] = useState<string | null>(conductor.sucursalId ?? null);
  const [vehiculoId, setVehiculoId] = useState<string | null>(conductor.vehiculoId ?? "none");
  const [categoria, setCategoria] = useState<CategoriaLicencia>(conductor.licenciaCategoria);
  const [activo, setActivo] = useState<boolean>(conductor.activo);

  // Serializar fecha para el input type="date"
  const formattedDate =
    conductor.licenciaVencimiento
      ? new Date(conductor.licenciaVencimiento).toISOString().split("T")[0]
      : "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data = {
      nombreCompleto: form.get("nombreCompleto") as string,
      dni: form.get("dni") as string,
      telefono: (form.get("telefono") as string) || null,
      email: (form.get("email") as string) || null,
      licenciaCategoria: categoria,
      licenciaNumero: (form.get("licenciaNumero") as string) || null,
      licenciaVencimiento: (form.get("licenciaVencimiento") as string) || null,
      sucursalId: sucursalId || null,
      vehiculoId: vehiculoId === "none" ? null : vehiculoId,
      activo,
    };

    try {
      const res = await fetch(`/api/conductores/${conductor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Error al actualizar");
        return;
      }

      router.push(`/conductores/${conductor.id}`);
      router.refresh();
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-8">

        {/* ── ESTADO ──────────────────────────────── */}
        <div className="flex items-center justify-between p-4 bg-muted/30 border rounded-xl">
          <div>
            <Label className="text-base font-semibold">Estado del conductor</Label>
            <p className="text-sm text-muted-foreground">
              Define si el conductor sigue activo en la empresa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{activo ? "Activo" : "Inactivo"}</span>
            <Switch checked={activo} onCheckedChange={setActivo} />
          </div>
        </div>

        {/* ── DATOS PERSONALES ────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 size={18} className="text-primary" />
            Datos personales
          </h2>
          <Separator className="my-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Nombre completo *">
              <Input
                name="nombreCompleto"
                defaultValue={conductor.nombreCompleto}
                required
                className="uppercase"
              />
            </Field>
            <Field label="DNI *">
              <Input
                name="dni"
                defaultValue={conductor.dni}
                required
                maxLength={15}
              />
            </Field>
            <Field label="Teléfono">
              <Input name="telefono" defaultValue={conductor.telefono ?? ""} />
            </Field>
            <Field label="Correo electrónico">
              <Input
                name="email"
                type="email"
                defaultValue={conductor.email ?? ""}
              />
            </Field>
          </div>
        </div>

        {/* ── LICENCIA ────────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 size={18} className="text-primary" />
            Licencia
          </h2>
          <Separator className="my-4" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="Categoría *">
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as CategoriaLicencia)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_LICENCIA.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Número">
              <Input
                name="licenciaNumero"
                defaultValue={conductor.licenciaNumero ?? ""}
              />
            </Field>
            <Field label="Vencimiento">
              <Input
                name="licenciaVencimiento"
                type="date"
                defaultValue={formattedDate}
              />
            </Field>
          </div>
        </div>

        {/* ── ASIGNACIÓN ──────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 size={18} className="text-primary" />
            Asignación y operación
          </h2>
          <Separator className="my-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Sucursal *">
              <Select value={sucursalId} onValueChange={setSucursalId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Vehículo asignado">
              <Select value={vehiculoId} onValueChange={setVehiculoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin vehículo asignado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vehículo</SelectItem>
                  {vehiculosDisponibles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.marca} {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Al seleccionar un vehículo, el conductor anterior será desvinculado automáticamente.
              </p>
            </Field>
          </div>
        </div>

        {error && (
          <p className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
            {error}
          </p>
        )}

        <Separator />
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="gap-2">
            <Save size={16} />
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm text-foreground/80 font-medium">{label}</Label>
      {children}
    </div>
  );
}
