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
    { href: "/character", label: "Герой", icon: User },
    { href: "/inventory", label: "Сумка", icon: Shield },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Главное меню"
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      {/* Gold decorative top border with glow — WoW action bar chrome */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

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
                  "flex flex-col items-center justify-center gap-1.5 py-3 px-1 text-[11px] font-serif uppercase tracking-wider transition-all btn-press",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-6 w-6", isActive && "drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]")} />
                  {isActive && (
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary shadow-[0_0_6px_rgba(212,175,55,0.6)]" />
                  )}
                </div>
                <span className="leading-none truncate w-full text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
