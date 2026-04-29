import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useGetCharacter, getGetCharacterQueryKey, getListNpcsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Footprints, Lock, MapPin, Shield, Sparkles, Star } from "lucide-react";
import {
  listLocations,
  visitLocation,
  type LocationDTO,
  type VisitResult,
} from "@/lib/api";
import { useMainButton, haptic } from "@/lib/telegram";
import { useRealtimeEvents } from "@/lib/realtime";
import { cn } from "@/lib/utils";

export function WorldMap() {
  const queryClient = useQueryClient();
  const { data: characterData } = useGetCharacter();
  const character = characterData?.character;

  const [selected, setSelected] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VisitResult | null>(null);

  const { data: locations, refetch } = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
    enabled: !!character,
    refetchInterval: 60_000,
  });

  // Real-time refresh: any new discovery anywhere → refresh map.
  useRealtimeEvents((ev) => {
    if (ev.type === "location_discovered" || ev.type === "character_entered" || ev.type === "character_left") {
      void refetch();
    }
  });

  const visit = useMutation({
    mutationFn: (locationId: string) => visitLocation(locationId),
    onSuccess: (data) => {
      haptic(data.isFirstDiscoverer ? "success" : "light");
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
      queryClient.invalidateQueries({ queryKey: getListNpcsQueryKey({ locationId: data.locationId }) });
      setSelected(null);
    },
    onError: () => haptic("error"),
  });

  const selectedLoc = locations?.find((l) => l.id === selected);
  const canVisit = !!selectedLoc && !selectedLoc.isCurrent && !character?.inBattle;

  useMainButton({
    text: selectedLoc ? `Посетить «${selectedLoc.name}»` : "Выбери место на карте",
    visible: !!selectedLoc,
    enabled: canVisit && !visit.isPending,
    onClick: () => selected && visit.mutate(selected),
  });

  useEffect(() => {
    if (lastResult) {
      const t = setTimeout(() => setLastResult(null), 6000);
      return () => clearTimeout(t);
    }
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
    <Layout title="Карта Альтеры" subtitle="Откой места — стань первопроходцем">
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
          />
        ))}
      </div>
    </Layout>
  );
}

function LocationCard({
  loc,
  isSelected,
  onSelect,
}: {
  loc: LocationDTO;
  isSelected: boolean;
  onSelect: () => void;
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
                <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase">
                  Здесь
                </Badge>
              )}
              {loc.isSafe && (
                <Badge variant="outline" className="border-secondary/40 text-secondary-foreground text-[10px] uppercase flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Тих
                </Badge>
              )}
              {loc.buffActive && (
                <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase flex items-center gap-1">
                  <Star className="h-3 w-3" /> Бафф
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{loc.region}</p>
            <p className="text-sm text-foreground/80 mt-2 leading-snug line-clamp-3">{loc.description}</p>
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
                onClick={(e) => {
                  e.stopPropagation();
                  // Hardware Back / no-Telegram fallback
                  const btn = (e.currentTarget as HTMLButtonElement);
                  btn.disabled = true;
                  visitLocation(loc.id)
                    .then(() => window.location.reload())
                    .catch(() => {
                      btn.disabled = false;
                    });
                }}
              >
                Посетить
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
