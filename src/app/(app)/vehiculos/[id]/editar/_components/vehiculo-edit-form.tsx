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

interface Sucursal { id: string; nombre: string; ciudad: string; }
interface ConductorOpt { id: string; nombreCompleto: string; licenciaCategoria: string; }

interface VehiculoEditable {
  id: string;
  placa: string;
  sucursalId: string;
  sucursal: { nombre: string; ciudad: string };
  conductorId: string | null;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string | null;
  motor: string | null;
  numeroMotor: string | null;
  numeroChasis: string | null;
  numeroSerie: string | null;
  propietario: string | null;
  transmision: string | null;
  traccion: string | null;
  combustible: string | null;
  numAsientos: number | null;
  capacidadCargaKg: number | null;
  kmActuales: number | null;
  zonaOperacion: string | null;
  fechaAdquisicion: string | null;
  estado: string;
  problemaActivo: string | null;
  observaciones: string | null;
  gps: boolean;
}

interface Props {
  vehiculo: VehiculoEditable;
  sucursales: Sucursal[];
  conductoresDisponibles: ConductorOpt[];
}

export function VehiculoEditForm({ vehiculo, sucursales, conductoresDisponibles }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Controlled state para selects
  const [tipo, setTipo] = useState(vehiculo.tipo);
  const [transmision, setTransmision] = useState(vehiculo.transmision ?? "");
  const [traccion, setTraccion] = useState(vehiculo.traccion ?? "");
  const [combustible, setCombustible] = useState(vehiculo.combustible ?? "");
  const [estado, setEstado] = useState(vehiculo.estado);
  const [sucursalId, setSucursalId] = useState(vehiculo.sucursalId);
  const [conductorId, setConductorId] = useState(vehiculo.conductorId ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const data: Record<string, unknown> = {
      placa: form.get("placa"),
      tipo,
      marca: form.get("marca"),
      modelo: form.get("modelo"),
      anio: Number(form.get("anio")),
      color: form.get("color") || null,
      motor: form.get("motor") || null,
      numeroMotor: form.get("numeroMotor") || null,
      numeroChasis: form.get("numeroChasis") || null,
      numeroSerie: form.get("numeroSerie") || null,
      propietario: form.get("propietario") || null,
      transmision: transmision || null,
      traccion: traccion || null,
      combustible: combustible || null,
      numAsientos: form.get("numAsientos") ? Number(form.get("numAsientos")) : null,
      capacidadCargaKg: form.get("capacidadCargaKg") ? Number(form.get("capacidadCargaKg")) : null,
      kmActuales: form.get("kmActuales") ? Number(form.get("kmActuales")) : null,
      zonaOperacion: form.get("zonaOperacion") || null,
      fechaAdquisicion: form.get("fechaAdquisicion") || null,
      estado,
      sucursalId,
      conductorId: conductorId || null,
      problemaActivo: form.get("problemaActivo") || null,
      observaciones: form.get("observaciones") || null,
      gps: (form.get("gps") as string | null) === "on",
    };

    try {
      const res = await fetch(`/api/vehiculos/${vehiculo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json() as { error?: string };

      if (!res.ok) {
        setError(json.error ?? "Error al guardar los cambios");
        return;
      }

      router.push(`/vehiculos/${vehiculo.id}`);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">

      {/* Sucursal — editable por admin */}
      <Section title="Ubicación">
        <Field label="Sucursal *">
          <Select value={sucursalId} onValueChange={(v) => setSucursalId(v ?? sucursalId)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {sucursales.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nombre} — {s.ciudad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {/* Datos básicos */}
      <Section title="Datos básicos">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Placa *">
            <Input name="placa" defaultValue={vehiculo.placa} required className="uppercase" />
          </Field>
          <Field label="Tipo *">
            <Select value={tipo} onValueChange={(v) => setTipo(v ?? "")} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="moto">Moto</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="camioneta">Camioneta</SelectItem>
                <SelectItem value="minivan">Minivan</SelectItem>
                <SelectItem value="furgon">Furgón</SelectItem>
                <SelectItem value="bus">Bus</SelectItem>
                <SelectItem value="vehiculo_pesado">Vehículo Pesado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Marca *">
            <Input name="marca" defaultValue={vehiculo.marca} required />
          </Field>
          <Field label="Modelo *">
            <Input name="modelo" defaultValue={vehiculo.modelo} required />
          </Field>
          <Field label="Año *">
            <Input name="anio" type="number" min={1990} max={2100} defaultValue={vehiculo.anio} required />
          </Field>
          <Field label="Color">
            <Input name="color" defaultValue={vehiculo.color ?? ""} placeholder="Blanco" />
          </Field>
        </div>
      </Section>

      {/* Tarjeta de Propiedad (SUNARP) */}
      <Section title="Tarjeta de Propiedad — SUNARP">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número de motor">
            <Input name="numeroMotor" defaultValue={vehiculo.numeroMotor ?? ""} placeholder="Ej: 1KD0123456" />
          </Field>
          <Field label="Número de chasis">
            <Input name="numeroChasis" defaultValue={vehiculo.numeroChasis ?? ""} placeholder="Ej: 8AF..." />
          </Field>
          <Field label="VIN / Número de serie">
            <Input name="numeroSerie" defaultValue={vehiculo.numeroSerie ?? ""} placeholder="17 caracteres (opcional)" />
          </Field>
          <Field label="Propietario / RUC">
            <Input name="propietario" defaultValue={vehiculo.propietario ?? ""} placeholder="20123456789" />
          </Field>
        </div>
      </Section>

      {/* Datos técnicos */}
      <Section title="Datos técnicos">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Motor (descripción)">
            <Input name="motor" defaultValue={vehiculo.motor ?? ""} placeholder="Ej: Cummins ISB 6.7" />
          </Field>
          <Field label="Combustible">
            <Select value={combustible} onValueChange={(v) => setCombustible(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
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
          <Field label="Transmisión">
            <Select value={transmision} onValueChange={(v) => setTransmision(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="automatico">Automático</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tracción">
            <Select value={traccion} onValueChange={(v) => setTraccion(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fourbytwo">4x2</SelectItem>
                <SelectItem value="fourbyfour">4x4</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="N° asientos">
            <Input name="numAsientos" type="number" min={1} defaultValue={vehiculo.numAsientos ?? ""} placeholder="5" />
          </Field>
          <Field label="Capacidad de carga (kg)">
            <Input name="capacidadCargaKg" type="number" min={0} defaultValue={vehiculo.capacidadCargaKg ?? ""} placeholder="1000" />
          </Field>
        </div>
      </Section>

      {/* Operación */}
      <Section title="Operación">
        <div className="grid grid-cols-2 gap-4">
          <Field label="KM actuales">
            <Input name="kmActuales" type="number" min={0} defaultValue={vehiculo.kmActuales ?? ""} placeholder="50000" />
          </Field>
          <Field label="Zona de operación">
            <Input name="zonaOperacion" defaultValue={vehiculo.zonaOperacion ?? ""} placeholder="Juliaca - Puno" />
          </Field>
          <Field label="Fecha de adquisición">
            <Input name="fechaAdquisicion" type="date" defaultValue={vehiculo.fechaAdquisicion ?? ""} />
          </Field>
          <Field label="Estado *">
            <Select value={estado} onValueChange={(v) => setEstado(v ?? "")} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operativo">Operativo</SelectItem>
                <SelectItem value="parcialmente">Parcialmente operativo</SelectItem>
                <SelectItem value="fuera_de_servicio">Fuera de servicio</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Conductor asignado" className="col-span-2">
            <Select value={conductorId} onValueChange={(v) => setConductorId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Sin conductor asignado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin conductor</SelectItem>
                {conductoresDisponibles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombreCompleto} — Lic. {c.licenciaCategoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Problema activo">
          <Input
            name="problemaActivo"
            defaultValue={vehiculo.problemaActivo ?? ""}
            placeholder="Describe el problema si el vehículo está fuera de servicio"
          />
        </Field>
        <Field label="Observaciones">
          <textarea
            name="observaciones"
            defaultValue={vehiculo.observaciones ?? ""}
            placeholder="Observaciones adicionales..."
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="gps"
            id="gps"
            defaultChecked={vehiculo.gps}
            className="rounded"
          />
          <Label htmlFor="gps">Cuenta con GPS</Label>
        </div>
      </Section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/vehiculos/${vehiculo.id}`)}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-base">{title}</h2>
        <Separator className="mt-1" />
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
