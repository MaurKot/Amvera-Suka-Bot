import { useGetCharacter } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/bottom-nav";

export function Layout({
  children,
  className,
  title,
  subtitle,
  hideNav,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  hideNav?: boolean;
}) {
  const { data: characterData } = useGetCharacter();
  const character = characterData?.character;

  return (
    <div className="min-h-[100dvh] flex flex-col w-full max-w-2xl mx-auto bg-background text-foreground selection:bg-primary/30">
      {(title || subtitle) && (
        <header className="sticky top-0 z-30 px-4 pt-[env(safe-area-inset-top)] pb-3 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {title && (
            <h1 className="text-lg font-serif text-primary tracking-wider uppercase truncate" data-testid="page-title">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground font-serif italic truncate">{subtitle}</p>
          )}
          {character && (
            <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
              <span className="text-destructive/80">HP {character.hp}/{character.maxHp}</span>
              <span className="text-secondary-foreground/80">MN {character.mana}/{character.maxMana}</span>
              <span className="text-primary/80 ml-auto">⌬ {character.silver}</span>
            </div>
          )}
        </header>
      )}

      <main
        className={cn(
          "flex-1 min-w-0 flex flex-col px-4 pt-4 pb-24 relative",
          className,
        )}
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/[0.06] via-background to-background pointer-events-none" />
        {children}
      </main>

      {!hideNav && <BottomNav hasCharacter={!!character} />}
    </div>
  );
}
