import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCharacter,
  useGetLore,
  useListNpcs,
  getListNpcsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { MapPin, Users, Swords, Ghost, Heart, Sword, MessageCircle } from "lucide-react";
import { NpcDialog } from "@/components/npc-dialog";
import { useRealtimeEvents } from "@/lib/realtime";
import { haptic } from "@/lib/telegram";

export function World() {
  const [, navigate] = useLocation();
  const [openNpc, setOpenNpc] = useState<string | null>(null);

  const { data: characterData, isLoading: isCharLoading } = useGetCharacter();
  const { data: loreData, isLoading: isLoreLoading } = useGetLore();

  const character = characterData?.character;
  const locationId = character?.locationId;

  const { data: npcsData, isLoading: isNpcsLoading, refetch: refetchNpcs } = useListNpcs(
    { locationId },
    { query: { enabled: !!locationId, queryKey: getListNpcsQueryKey({ locationId }) } },
  );

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
  const npcs = npcsData || [];
  const enemies = loreData.enemies.filter((e) => e.locationId === locationId);

  return (
    <Layout title={currentLocation?.name ?? "Неизведанные земли"} subtitle={currentLocation?.region}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <Card className="bg-card/70 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-primary">
              <MapPin className="w-4 h-4 opacity-80" />
              Здесь
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic font-serif leading-relaxed">
              {currentLocation?.description}
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
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
                className="ml-auto text-xs"
                data-testid="goto-map"
              >
                К карте
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-secondary-foreground">
              <Users className="w-4 h-4 opacity-80" />
              Присутствующие ({npcs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {npcs.length === 0 ? (
              <p className="text-muted-foreground italic text-sm">Здесь никого нет...</p>
            ) : (
              <div className="space-y-2">
                {npcs.map((npc) => (
                  <button
                    key={npc.id}
                    type="button"
                    onClick={() => {
                      haptic("light");
                      setOpenNpc(npc.id);
                    }}
                    data-testid={`npc-${npc.id}`}
                    className="w-full text-left p-3 border border-border/40 rounded-md bg-background/40 hover:border-secondary/40 hover:bg-secondary/5 transition-all"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-serif text-base text-foreground truncate">{npc.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{npc.shortProfile}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                        {npc.role}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        <span className="opacity-70 mr-1">{npc.repIcon}</span>
                        {npc.repName}
                      </span>
                      <span className="text-secondary-foreground/70 inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> Заговорить
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {enemies.length > 0 && (
          <Card className="bg-card/70 border-border/40">
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
                        <span className="text-[10px] font-mono text-muted-foreground">Ур. {enemy.level}</span>
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
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground text-[11px] font-serif"
                      onClick={() => {
                        haptic("medium");
                        navigate("/battle");
                      }}
                    >
                      Бой
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <NpcDialog npcId={openNpc} open={!!openNpc} onClose={() => setOpenNpc(null)} />
    </Layout>
  );
}
