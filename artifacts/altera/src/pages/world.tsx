import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCharacter,
  useGetLore,
  useListNpcs,
  getListNpcsQueryKey,
  useStartBattle,
  getGetCharacterQueryKey,
  getGetActiveBattleQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  MapPin,
  Users,
  Swords,
  Ghost,
  Heart,
  Sword,
  MessageCircle,
  Map as MapIcon,
  Store,
} from "lucide-react";
import { NpcDialog } from "@/components/npc-dialog";
import { useRealtimeEvents } from "@/lib/realtime";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const MERCHANT_ROLES = new Set(["merchant", "smith", "tavern_keeper"]);

export function World() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [openNpc, setOpenNpc] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: characterData, isLoading: isCharLoading } = useGetCharacter();
  const { data: loreData, isLoading: isLoreLoading } = useGetLore();

  const character = characterData?.character;
  const locationId = character?.locationId;

  const { data: npcsData, isLoading: isNpcsLoading, refetch: refetchNpcs } = useListNpcs(
    { locationId },
    { query: { enabled: !!locationId, queryKey: getListNpcsQueryKey({ locationId }) } },
  );

  const startBattle = useStartBattle();

  useRealtimeEvents((ev) => {
    if (
      (ev.type === "character_entered" || ev.type === "character_left") &&
      typeof ev.payload?.["locationId"] === "string" &&
      ev.payload["locationId"] === locationId
    ) {
      void refetchNpcs();
    }
  });

  if (isCharLoading || isLoreLoading || isNpcsLoading || !character || !loreData) {
    return (
      <Layout title="Мир">
        <div className="flex-1 flex items-center justify-center">
          <Ghost className="w-8 h-8 text-primary animate-pulse opacity-50" />
        </div>
      </Layout>
    );
  }

  const currentLocation = loreData.locations.find((l) => l.id === locationId);
  const npcs = npcsData ?? [];
  const enemies = loreData.enemies.filter((e) => e.locationId === locationId);

  const handleEngage = (enemyKey: string) => {
    setErrorMsg(null);
    haptic("medium");
    startBattle.mutate(
      { data: { enemyKey } },
      {
        onSuccess: () => {
          haptic("success");
          queryClient.invalidateQueries({ queryKey: getGetActiveBattleQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          navigate("/battle");
        },
        onError: (err) => {
          haptic("error");
          setErrorMsg((err as Error)?.message ?? "Не удалось начать бой");
        },
      },
    );
  };

  return (
    <Layout title={currentLocation?.name ?? "Неизведанные земли"} subtitle={currentLocation?.region}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* Location card */}
        <Card className="card-parchment bg-card/70 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-primary">
              <MapPin className="w-4 h-4 opacity-80" />
              Здесь
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic font-serif leading-relaxed">
              {currentLocation?.description ?? "Это место не отмечено на карте."}
            </p>
            <div className="flex gap-2 mt-3 flex-wrap items-center">
              {currentLocation?.isSafe && (
                <Badge variant="outline" className="border-secondary/30 text-secondary-foreground text-[10px] uppercase">
                  Безопасно
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  haptic("selection");
                  navigate("/map");
                }}
                className="ml-auto text-xs h-9"
                data-testid="goto-map"
              >
                <MapIcon className="h-3.5 w-3.5 mr-1.5" /> К карте
              </Button>
            </div>
          </CardContent>
        </Card>

        {errorMsg && (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive font-mono"
            data-testid="world-error"
          >
            {errorMsg}
          </div>
        )}

        {/* NPCs */}
        <Card className="card-parchment bg-card/70 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-secondary-foreground">
              <Users className="w-4 h-4 opacity-80" />
              Присутствующие ({npcs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {npcs.length === 0 ? (
              <div className="py-3 text-center">
                <p className="text-muted-foreground italic text-sm">Здесь никого нет.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    haptic("selection");
                    navigate("/map");
                  }}
                >
                  Найти других на карте
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {npcs.map((npc) => {
                  const isMerchant = MERCHANT_ROLES.has(npc.role);
                  return (
                    <button
                      key={npc.id}
                      type="button"
                      onClick={() => {
                        haptic("light");
                        setOpenNpc(npc.id);
                      }}
                      data-testid={`npc-${npc.id}`}
                      className={cn(
                        "w-full text-left p-3 border rounded-md transition-all min-h-[64px]",
                        "border-border/40 bg-background/40 hover:border-secondary/40 hover:bg-secondary/5",
                        isMerchant && "border-primary/30 bg-primary/[0.04]",
                      )}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h4 className="font-serif text-base text-foreground truncate">{npc.name}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{npc.shortProfile}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase shrink-0",
                            isMerchant && "border-primary/40 text-primary",
                          )}
                        >
                          {isMerchant ? (
                            <span className="inline-flex items-center gap-1">
                              <Store className="h-3 w-3" /> Лавка
                            </span>
                          ) : (
                            npc.role
                          )}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          <span className="opacity-70 mr-1">{npc.repIcon}</span>
                          {npc.repName}
                        </span>
                        <span className="text-secondary-foreground/70 inline-flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {isMerchant ? "Заговорить · купить" : "Заговорить"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enemies */}
        {enemies.length > 0 ? (
          <Card className="card-parchment bg-card/70 border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-base flex items-center gap-2 text-destructive">
                <Swords className="w-4 h-4 opacity-80" />
                Угрозы ({enemies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {enemies.map((enemy) => (
                  <div
                    key={enemy.key}
                    className="p-3 border border-border/40 rounded-md bg-background/40 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-serif text-base text-foreground truncate">{enemy.name}</h4>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Ур. {enemy.level}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1 text-[11px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1 text-destructive/80">
                          <Heart className="w-3 h-3" /> {enemy.hp}
                        </span>
                        <span className="flex items-center gap-1 text-primary/80">
                          <Sword className="w-3 h-3" /> {enemy.damage}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={startBattle.isPending || character.inBattle}
                      className="h-10 px-4 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs font-serif tracking-wide"
                      variant="outline"
                      onClick={() => handleEngage(enemy.key)}
                      data-testid={`engage-${enemy.key}`}
                    >
                      {startBattle.isPending ? "..." : "В бой"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          currentLocation?.isSafe === false && (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              В этой местности тихо. Иди дальше — на карте есть опасные места.
            </p>
          )
        )}
      </motion.div>

      <NpcDialog npcId={openNpc} open={!!openNpc} onClose={() => setOpenNpc(null)} />
    </Layout>
  );
}
