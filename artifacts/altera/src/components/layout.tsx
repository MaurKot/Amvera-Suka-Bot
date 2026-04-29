import { useGetCharacter } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/bottom-nav";
import { listLocations, type LocationEventBadge } from "@/lib/api";

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

  // P6 — pull active world events touching the player's current location.
  // Cheap: this query is shared (key "locations") with the map page.
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
    enabled: !!character,
    staleTime: 30_000,
    refetchInterval: 90_000,
  });
  const hereEvents: LocationEventBadge[] =
    (locations ?? []).find((l) => l.id === character?.locationId)?.activeEvents ?? [];

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

        {/* P6 — world event banner: shows what's stirring in the player's location */}
        {hereEvents.length > 0 && (
          <div className="mb-3 space-y-1.5" data-testid="world-event-banner">
            {hereEvents.map((ev, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md border bg-card/60 backdrop-blur px-3 py-2 flex items-start gap-2 text-sm",
                  ev.severity >= 3
                    ? "border-destructive/40"
                    : ev.severity === 2
                    ? "border-primary/40"
                    : "border-border/50",
                )}
              >
                <AlertTriangle
                  className={cn(
                    "h-4 w-4 mt-0.5 shrink-0",
                    ev.severity >= 3
                      ? "text-destructive"
                      : ev.severity === 2
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-serif text-fantasy-strong leading-tight",
                      ev.severity >= 3
                        ? "event-sev-3"
                        : ev.severity === 2
                        ? "event-sev-2"
                        : "event-sev-1",
                    )}
                  >
                    {ev.title}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Здесь сейчас: {ev.eventKind.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {children}
      </main>

      {!hideNav && <BottomNav hasCharacter={!!character} />}
    </div>
  );
}
