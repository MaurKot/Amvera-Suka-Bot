import { Link, useLocation } from "wouter";
import { Castle, Map, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/telegram";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matches?: (path: string) => boolean;
}

interface BottomNavProps {
  hasCharacter: boolean;
}

export function BottomNav({ hasCharacter }: BottomNavProps) {
  const [location] = useLocation();
  if (!hasCharacter) return null;

  const items: NavItem[] = [
    { href: "/", label: "Главная", icon: Castle, matches: (p) => p === "/" || p.startsWith("/world") },
    { href: "/map", label: "Карта", icon: Map },
    { href: "/character", label: "Персонаж", icon: User },
    { href: "/inventory", label: "Инвентарь", icon: Shield },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Главное меню"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4 gap-0">
        {items.map((item) => {
          const isActive = item.matches ? item.matches(location) : location === item.href || location.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => haptic("selection")}
                aria-current={isActive ? "page" : undefined}
                data-testid={`nav-${item.href.replace("/", "") || "home"}`}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[10px] font-serif uppercase tracking-wider transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_rgba(212,175,55,0.45)]")} />
                <span className="leading-none truncate w-full text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
