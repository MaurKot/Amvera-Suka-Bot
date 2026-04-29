import { Link, useLocation } from "wouter";
import { Book, Castle, Ghost, Shield, ScrollText, Swords, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetCharacter, getGetCharacterQueryKey } from "@workspace/api-client-react";

export function Layout({ children, className }: { children: React.ReactNode; className?: string }) {
  const [location] = useLocation();
  const { data: characterData } = useGetCharacter();
  const character = characterData?.character;

  const navItems = [
    { href: "/", label: "Врата", icon: Castle },
    { href: "/character", label: "Душа", icon: User, hidden: !character },
    { href: "/world", label: "Мир", icon: Ghost, hidden: !character },
    { href: "/battle", label: "Битва", icon: Swords, hidden: !character },
    { href: "/inventory", label: "Инвентарь", icon: Shield, hidden: !character },
    { href: "/ledger", label: "Хроника", icon: ScrollText, hidden: !character },
    { href: "/lore", label: "Знания", icon: Book },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row w-full max-w-5xl mx-auto px-4 py-6 md:py-12 gap-8 selection:bg-primary/30 selection:text-primary-foreground">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-48 flex-shrink-0 flex flex-col gap-2">
        <div className="mb-8 hidden md:block">
          <h1 className="text-xl font-serif text-primary tracking-widest uppercase">Altera</h1>
          <p className="text-xs text-muted-foreground font-serif italic mt-1">Отголоски Судьбы</p>
        </div>

        <div className="flex md:flex-col overflow-x-auto md:overflow-visible pb-4 md:pb-0 gap-2 no-scrollbar">
          {navItems.filter(item => !item.hidden).map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex-shrink-0">
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-300 font-serif border border-transparent",
                    isActive
                      ? "bg-primary/10 text-primary border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 hover:border-white/10"
                  )}
                >
                  <item.icon className="w-4 h-4 opacity-70" />
                  <span className="tracking-wide text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {character && (
          <div className="mt-auto hidden md:block pt-8 border-t border-border/50">
            <div className="text-xs text-muted-foreground font-serif uppercase tracking-widest mb-2">Состояние</div>
            <div className="flex flex-col gap-2 text-sm font-mono">
              <div className="flex justify-between items-center">
                <span className="text-destructive/80">ЗДР</span>
                <span>{character.hp}/{character.maxHp}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary/80">МАНА</span>
                <span>{character.mana}/{character.maxMana}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/80">СЕРЕБРО</span>
                <span>{character.silver}</span>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className={cn("flex-1 min-w-0 flex flex-col relative", className)}>
        {/* Ambient background glow */}
        <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
        {children}
      </main>
    </div>
  );
}
