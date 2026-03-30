"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Truck,
  Users,
  UserCog,
  UserRoundCheck,
  LogOut,
  Menu,
  ChevronRight,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard",          icon: <LayoutDashboard size={18} /> },
  { label: "Vehículos",    href: "/vehiculos",          icon: <Truck size={18} /> },
  { label: "Conductores",  href: "/conductores",        icon: <UserRoundCheck size={18} /> },
  { label: "Invitaciones", href: "/admin/invitaciones", icon: <Users size={18} />,    adminOnly: true },
  { label: "Usuarios",     href: "/admin/usuarios",     icon: <UserCog size={18} />,  adminOnly: true },
  { label: "Sucursales",   href: "/admin/sucursales",   icon: <Building2 size={18} />, adminOnly: true },
];

interface Props {
  rol: string;
  nombre: string;
  sucursal?: string;
}

export function Sidebar({ rol, nombre, sucursal }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || rol === "admin");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const navContent = (
    <nav className="flex flex-col h-full bg-card">
      {/* Logo */}
      <div className="px-6 py-6 border-b flex items-center justify-between">
        <div>
          <p className="font-bold text-xl text-primary leading-none">Selcosi Flota</p>
          <p className="text-xs text-muted-foreground mt-1 font-medium">Gestión vehicular</p>
        </div>
      </div>

      {/* Links */}
      <div className="flex-1 py-6 space-y-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                active
                  ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1"
              )}
            >
              {item.icon}
              {item.label}
              {active && <ChevronRight size={14} className="ml-auto opacity-70" />}
            </Link>
          );
        })}
      </div>

      {/* Usuario */}
      <div className="border-t px-6 py-4 space-y-3 bg-muted/10">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs flex-1 min-w-0">
            <p className="font-semibold text-sm truncate text-foreground">{nombre}</p>
            <p className="text-muted-foreground/80 mt-0.5 truncate">
              {rol === "admin" ? "Administrador" : rol === "jefe_sucursal" ? "Jefe de Sucurs." : "Visor"}
              {sucursal && ` · ${sucursal}`}
            </p>
          </div>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors gap-2 rounded-lg"
          onClick={handleLogout}
        >
          <LogOut size={16} />
          Cerrar sesión
        </Button>
      </div>
    </nav>
  );

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 border-r bg-card shrink-0">
        {navContent}
      </aside>

      {/* ── Mobile Bottom Nav ──────────────────────────── */}
      <BottomNav rol={rol} onMenuClick={() => setMobileOpen(true)} />

      {/* ── Mobile drawer (Menú expandido) ─────────────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          {navContent}
        </SheetContent>
      </Sheet>
    </>
  );
}
