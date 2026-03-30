"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface InvitacionData {
  email: string;
  rol: string;
  sucursal: { nombre: string; ciudad: string } | null;
}

interface Props {
  token?: string;
}

export function RegistroForm({ token }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitacion, setInvitacion] = useState<InvitacionData | null>(null);
  const [tokenValido, setTokenValido] = useState<boolean | null>(null);
  const [esPrimerAdmin, setEsPrimerAdmin] = useState(false);

  useEffect(() => {
    if (token) {
      fetch(`/api/auth/invitacion/${token}`)
        .then((r) => r.json())
        .then((data: InvitacionData & { error?: string }) => {
          if (data.error) {
            setTokenValido(false);
            setError(data.error);
          } else {
            setInvitacion(data);
            setEmail(data.email);
            setTokenValido(true);
          }
        })
        .catch(() => setTokenValido(false));
    } else {
      // Sin token: verificar si es primer admin
      fetch("/api/auth/registro/check")
        .then((r) => r.json())
        .then((data: { esPrimerAdmin: boolean }) => {
          setEsPrimerAdmin(data.esPrimerAdmin);
          if (!data.esPrimerAdmin) {
            setError("El registro requiere una invitación válida");
          }
        })
        .catch(() => setError("Error al verificar el estado del sistema"));
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, password, token }),
      });

      const data = await response.json() as { error?: string; message?: string };

      if (!response.ok) {
        setError(data.error ?? "Error al crear la cuenta");
        return;
      }

      setSuccess(data.message ?? "Cuenta creada exitosamente");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const noAcceso = !token && !esPrimerAdmin && tokenValido === null;
  const tokenInvalido = token && tokenValido === false;
  const sinInvitacion = !token && !esPrimerAdmin;

  if (tokenInvalido || sinInvitacion) {
    return (
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">Acceso restringido</CardTitle>
          <CardDescription>
            {error ?? "Se requiere una invitación válida para registrarse"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Ir al inicio de sesión
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (noAcceso) {
    return (
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="pt-6 text-center text-muted-foreground">
          Verificando invitación...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          {esPrimerAdmin ? "Configuración inicial" : "Crear cuenta"}
        </CardTitle>
        <CardDescription>
          {esPrimerAdmin
            ? "Crea la cuenta de administrador del sistema"
            : invitacion
            ? `Invitado como ${invitacion.rol.replace("_", " ")}${invitacion.sucursal ? ` — ${invitacion.sucursal.nombre}` : ""}`
            : "Completa tus datos para registrarte"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              type="text"
              placeholder="Juan Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              disabled={loading}
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || !!invitacion}
              readOnly={!!invitacion}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          {success && (
            <p className="text-sm text-primary text-center">{success}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
