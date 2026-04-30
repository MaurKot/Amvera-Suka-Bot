import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useGetCharacter,
  getGetCharacterQueryKey,
  getListNpcsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Footprints,
  Lock,
  MapPin,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Swords,
  Wand2,
  AlertTriangle,
} from "lucide-react";
import {
  listLocations,
  visitLocation,
  guardCheck,
  type LocationDTO,
  type VisitResult,
  type GuardCheckResult,
} from "@/lib/api";
import { useMainButton, haptic } from "@/lib/telegram";
import { useRealtimeEvents } from "@/lib/realtime";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// SVG viewport constants — locations use coordX/Y in 0..100 space.
const SVG_W = 360;
const SVG_H = 240;
const PAD = 18;
const project = (n: number, max: number) => PAD + (n / 100) * (max - PAD * 2);

export function WorldMap() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: characterData } = useGetCharacter();
  const character = characterData?.character;

  const [selected, setSelected] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VisitResult | null>(null);
  const [guardWarning, setGuardWarning] = useState<GuardCheckResult | null>(null);

  const { data: locations, refetch } = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
    enabled: !!character,
    refetchInterval: 60_000,
  });

  useRealtimeEvents((ev) => {
    if (
      ev.type === "location_discovered" ||
      ev.type === "character_entered" ||
      ev.type === "character_left" ||
      ev.type === "world_event_started" ||
      ev.type === "world_event_ended"
    ) {
      void refetch();
    }
  });

  const visit = useMutation({
    mutationFn: (locationId: string) => visitLocation(locationId),
    onSuccess: (data) => {
      haptic(data.isFirstDiscoverer || data.discoveredNewPath ? "success" : "light");
      setLastResult(data);
      // P7 — Auto-discovery toast: a new path was revealed at the frontier.
      if (data.discoveredNewPath) {
        toast({
          title: `Открыта новая тропа — «${data.discoveredNewPath.locationName}»`,
          description: data.discoveredNewPath.description,
        });
      }
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
      queryClient.invalidateQueries({
        queryKey: getListNpcsQueryKey({ locationId: data.locationId }),
      });
      setSelected(null);
    },
    onError: (e: Error) => {
      haptic("error");
      toast({ title: "Не получилось", description: e.message, variant: "destructive" });
    },
  });

  // P7 — Guard check before traversing a guarded passage (Тропа Торговца).
  // If the player is too weak we open a warning dialog; otherwise we proceed.
  const startVisit = (locationId: string) => {
    const loc = locations?.find((l) => l.id === locationId);
    if (loc?.requiresGuard) {
      guardCheck(locationId)
        .then((res) => {
          if (res.tooWeak) {
            haptic("warning");
            setGuardWarning(res);
          } else {
            visit.mutate(locationId);
          }
        })
        .catch((e: Error) => {
          haptic("error");
          toast({ title: "Стража молчит", description: e.message, variant: "destructive" });
        });
    } else {
      visit.mutate(locationId);
    }
  };

  const selectedLoc = locations?.find((l) => l.id === selected);
  const canVisit =
    !!selectedLoc && !selectedLoc.isCurrent && selectedLoc.isReachable && !character?.inBattle;

  useMainButton({
    text: selectedLoc
      ? selectedLoc.isReachable
        ? selectedLoc.requiresGuard
          ? `Идти на «${selectedLoc.name}» (тропа торговца)`
          : `Посетить «${selectedLoc.name}»`
        : "Слишком далеко — нет тропы"
      : "Выбери место на карте",
    visible: !!selectedLoc,
    enabled: canVisit && !visit.isPending,
    onClick: () => selected && startVisit(selected),
  });

  useEffect(() => {
    if (!lastResult) return undefined;
    const t = setTimeout(() => setLastResult(null), 6000);
    return () => clearTimeout(t);
  }, [lastResult]);

  if (!character) {
    return (
      <Layout title="Карта">
        <div className="flex-1 flex items-center justify-center text-muted-foreground font-serif italic">
          Сначала создай персонажа, чтобы открыть карту Альтеры.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Карта Альтеры" subtitle="Тропы дальше — там, куда никто ещё не ходил">
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "mb-3 rounded-md border px-3 py-2 text-sm",
              lastResult.isFirstDiscoverer
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 bg-muted/30 text-foreground",
            )}
            data-testid="visit-result"
          >
            {lastResult.isFirstDiscoverer ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Первопроходец «{lastResult.locationName}»! Бафф «Аура открытия» активна.
              </span>
            ) : (
              <span>Ты в «{lastResult.locationName}».</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* P2 — Mini-map (SVG graph) */}
      <MiniMap
        locations={locations ?? []}
        selected={selected}
        onSelect={(id) => {
          haptic("selection");
          setSelected((prev) => (prev === id ? null : id));
        }}
      />

      {/* P7 — Frontier discovery is now AUTOMATIC on visit. The old "Шагнуть
          за горизонт" button is gone; the world reveals itself as you explore. */}
      <p className="mt-3 mb-3 text-[11px] text-muted-foreground italic flex items-center gap-1.5">
        <Wand2 className="h-3 w-3" />
        Тропы за горизонтом открываются сами — иди к границам мира.
      </p>

      {/* Detail list */}
      <div className="grid gap-3">
        {(locations ?? []).map((loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            isSelected={selected === loc.id}
            onSelect={() => {
              haptic("selection");
              setSelected((prev) => (prev === loc.id ? null : loc.id));
            }}
            onVisit={startVisit}
          />
        ))}
      </div>

      {/* P7 — Guard warning dialog (Тропа Торговца) */}
      <AnimatePresence>
        {guardWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
            onClick={() => setGuardWarning(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-md border border-destructive/50 bg-card/95 p-4 shadow-2xl"
              data-testid="guard-warning-dialog"
            >
              <div className="flex items-start gap-2 mb-2">
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-serif text-base text-destructive">Стража предупреждает</h3>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {guardWarning.passageName} → {guardWarning.destinationCityName} (ур. {guardWarning.destinationCityLevel})
                  </p>
                </div>
              </div>
              <p className="text-sm text-foreground/90 leading-snug mb-3">
                {guardWarning.warning}
              </p>
              <div className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                <Swords className="h-3 w-3" /> Шанс встретить разбойников: {Math.round(guardWarning.encounterChance * 100)}%
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setGuardWarning(null)}
                  data-testid="btn-guard-cancel"
                >
                  Подождать, окрепнуть
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    const id = guardWarning.passageId;
                    setGuardWarning(null);
                    visit.mutate(id);
                  }}
                  data-testid="btn-guard-proceed"
                >
                  Идти всё равно
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

// ── Mini-map ──────────────────────────────────────────────────────────────
function MiniMap({
  locations,
  selected,
  onSelect,
}: {
  locations: LocationDTO[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // Edges (deduped)
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: { a: LocationDTO; b: LocationDTO }[] = [];
    for (const a of locations) {
      for (const bid of a.connectedTo ?? []) {
        const key = a.id < bid ? `${a.id}|${bid}` : `${bid}|${a.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const b = byId.get(bid);
        if (b) out.push({ a, b });
      }
    }
    return out;
  }, [locations, byId]);

  if (locations.length === 0) return null;

  return (
    <Card className="bg-card/60 border-border/40 backdrop-blur">
      <CardContent className="p-2">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Карта Альтеры"
          data-testid="mini-map"
        >
          {/* Faint grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(36 38% 92% / 0.04)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

          {/* Edges */}
          {edges.map(({ a, b }) => {
            const x1 = project(a.coordX, SVG_W);
            const y1 = project(a.coordY, SVG_H);
            const x2 = project(b.coordX, SVG_W);
            const y2 = project(b.coordY, SVG_H);
            const isLive = a.isCurrent || b.isCurrent;
            return (
              <line
                key={`${a.id}-${b.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isLive ? "hsl(43 70% 62% / 0.7)" : "hsl(36 38% 92% / 0.18)"}
                strokeWidth={isLive ? 1.6 : 1}
                strokeDasharray={a.isDiscovered && b.isDiscovered ? undefined : "3 3"}
              />
            );
          })}

          {/* Nodes */}
          {locations.map((l) => {
            const cx = project(l.coordX, SVG_W);
            const cy = project(l.coordY, SVG_H);
            const isSel = selected === l.id;
            const fill = l.isCurrent
              ? "hsl(43 70% 62%)"
              : l.isDiscovered
              ? "hsl(36 38% 92%)"
              : "hsl(240 5% 35%)";
            const eventCount = l.activeEvents?.length ?? 0;
            return (
              <g
                key={l.id}
                onClick={() => onSelect(l.id)}
                className="cursor-pointer"
                data-testid={`map-node-${l.id}`}
              >
                {l.isCurrent && (
                  <circle cx={cx} cy={cy} r={11} fill="hsl(43 70% 62% / 0.18)">
                    <animate attributeName="r" values="9;13;9" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.25;0.05;0.25" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                {isSel && (
                  <circle cx={cx} cy={cy} r={10} fill="none" stroke="hsl(290 60% 70%)" strokeWidth={1.4} />
                )}
                <circle cx={cx} cy={cy} r={5.2} fill={fill} stroke="hsl(240 12% 5%)" strokeWidth={1.2} />
                {eventCount > 0 && (
                  <circle cx={cx + 5} cy={cy - 5} r={2.6} fill="hsl(0 75% 56%)" stroke="hsl(240 12% 5%)" strokeWidth={1} />
                )}
                {l.isReachable && !l.isCurrent && (
                  <circle cx={cx} cy={cy} r={7} fill="none" stroke="hsl(43 70% 62% / 0.5)" strokeWidth={1} strokeDasharray="2 2" />
                )}
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  fontSize="8"
                  fill={l.isDiscovered ? "hsl(36 38% 92%)" : "hsl(240 8% 60%)"}
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  fontWeight={l.isCurrent ? 700 : 500}
                  style={{ paintOrder: "stroke", stroke: "hsl(240 12% 5%)", strokeWidth: 2.5 }}
                >
                  {l.isDiscovered ? l.name : "???"}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="px-2 pt-1 pb-1.5 flex items-center gap-3 text-[10px] text-muted-foreground uppercase tracking-wider">
          <Legend color="hsl(43 70% 62%)" label="Здесь" />
          <Legend color="hsl(36 38% 92%)" label="Открыто" />
          <Legend color="hsl(240 5% 35%)" label="Скрыто" />
          <Legend color="hsl(0 75% 56%)" label="Событие" />
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="8" height="8" viewBox="0 0 8 8">
        <circle cx="4" cy="4" r="3" fill={color} />
      </svg>
      {label}
    </span>
  );
}

// ── Detail card ───────────────────────────────────────────────────────────
function LocationCard({
  loc,
  isSelected,
  onSelect,
  onVisit,
}: {
  loc: LocationDTO;
  isSelected: boolean;
  onSelect: () => void;
  onVisit: (id: string) => void;
}) {
  return (
    <Card
      onClick={onSelect}
      role="button"
      tabIndex={0}
      data-testid={`location-${loc.id}`}
      className={cn(
        "cursor-pointer transition-all border bg-card/70 backdrop-blur",
        loc.isCurrent && "border-primary/60 shadow-[0_0_18px_rgba(212,175,55,0.18)]",
        !loc.isCurrent && isSelected && "border-secondary/60 ring-1 ring-secondary/40",
        !isSelected && !loc.isCurrent && "border-border/40 hover:border-border",
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center",
              loc.isCurrent
                ? "bg-primary/20 border-primary/40 text-primary"
                : loc.isDiscovered
                ? "bg-muted/40 border-border text-foreground"
                : "bg-muted/20 border-border/60 text-muted-foreground",
            )}
          >
            {loc.isCurrent ? (
              <Footprints className="h-5 w-5" />
            ) : loc.isDiscovered ? (
              <MapPin className="h-5 w-5" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-base text-foreground truncate">{loc.name}</h3>
              {loc.isCurrent && (
                <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase no-shadow">
                  Здесь
                </Badge>
              )}
              {loc.isReachable && !loc.isCurrent && (
                <Badge variant="outline" className="border-primary/30 text-primary/90 text-[10px] uppercase no-shadow flex items-center gap-1">
                  <Footprints className="h-3 w-3" /> 1 шаг
                </Badge>
              )}
              {loc.isSafe && (
                <Badge variant="outline" className="border-secondary/40 text-secondary-foreground text-[10px] uppercase no-shadow flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Тих
                </Badge>
              )}
              {loc.isGenerated && (
                <Badge variant="outline" className="border-secondary/40 text-secondary-foreground text-[10px] uppercase no-shadow flex items-center gap-1">
                  <Wand2 className="h-3 w-3" /> Новь
                </Badge>
              )}
              {loc.buffActive && (
                <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase no-shadow flex items-center gap-1">
                  <Star className="h-3 w-3" /> Бафф
                </Badge>
              )}
              {loc.requiresGuard && (
                <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px] uppercase no-shadow flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> Под охраной
                </Badge>
              )}
              {loc.cityLevel > 0 && (
                <Badge variant="outline" className="border-primary/30 text-primary/90 text-[10px] uppercase no-shadow">
                  Ур. {loc.cityLevel}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{loc.region}</p>
            <p className="text-sm text-foreground/90 mt-2 leading-snug line-clamp-3">{loc.description}</p>

            {(loc.activeEvents?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-1">
                {loc.activeEvents.map((ev, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] uppercase tracking-wider",
                      ev.severity >= 3 ? "event-sev-3" : ev.severity === 2 ? "event-sev-2" : "event-sev-1",
                    )}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 text-[11px] flex items-center gap-2 text-muted-foreground">
              {loc.isDiscovered ? (
                <>
                  <Compass className="h-3 w-3" />
                  <span>
                    Открыл(а): <span className="text-foreground/80">{loc.discoveredByName ?? "—"}</span>
                  </span>
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  <span>Никем не открыто. Стань первым — и получишь «Ауру открытия».</span>
                </>
              )}
            </div>
            {!loc.isCurrent && isSelected && (
              <Button
                size="sm"
                className="mt-3 w-full"
                disabled={!loc.isReachable}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!loc.isReachable) return;
                  onVisit(loc.id);
                }}
                data-testid={`btn-visit-${loc.id}`}
              >
                {loc.isReachable
                  ? loc.requiresGuard
                    ? "Идти по тропе"
                    : "Посетить"
                  : "Нет тропы отсюда"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
