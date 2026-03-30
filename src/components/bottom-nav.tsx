"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Truck, UserRoundCheck, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

interface Props {
  rol: string;
  onMenuClick: () => void;
}

export function BottomNav({ rol, onMenuClick }: Props) {
  const pathname = usePathname();

  const ALL_NAV_ITEMS: NavItem[] = [
    { label: "Panel",    href: "/dashboard",   icon: <LayoutDashboard size={20} /> },
    { label: "Flota",    href: "/vehiculos",    icon: <Truck size={20} /> },
    { label: "Personal", href: "/conductores",  icon: <UserRoundCheck size={20} /> },
  ];

  const NAV_ITEMS = ALL_NAV_ITEMS.filter((i) => !i.adminOnly || rol === "admin");

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[68px] bg-background/90 backdrop-blur-xl border-t flex items-center justify-around px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] pb-safe">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn("p-1.5 rounded-xl transition-all", active && "bg-primary/10")}>
              {item.icon}
            </div>
            <span className={cn("text-[10px] transition-all", active ? "font-bold" : "font-medium")}>
              {item.label}
            </span>
          </Link>
        );
      })}
      
      {/* Menú Trigger */}
      <button
        onClick={onMenuClick}
        className="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors text-muted-foreground hover:text-foreground active:scale-95"
      >
        <div className="p-1.5 rounded-xl transition-all">
          <Menu size={20} />
        </div>
        <span className="text-[10px] font-medium">Menú</span>
      </button>
    </nav>
  );
}
