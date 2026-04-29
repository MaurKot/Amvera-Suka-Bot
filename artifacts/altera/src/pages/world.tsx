import { useLocation } from "wouter";
import { 
  useGetCharacter, 
  useGetLore, 
  useListNpcs, 
  useMoveLocation,
  getListNpcsQueryKey,
  getGetCharacterQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { MapPin, Users, Swords, ArrowRight, Ghost, Heart, Sword } from "lucide-react";

export function World() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: characterData, isLoading: isCharLoading } = useGetCharacter();
  const { data: loreData, isLoading: isLoreLoading } = useGetLore();
  
  const character = characterData?.character;
  const locationId = character?.locationId;

  const { data: npcsData, isLoading: isNpcsLoading } = useListNpcs(
    { locationId },
    { query: { enabled: !!locationId, queryKey: getListNpcsQueryKey({ locationId }) } }
  );
  
  const moveLocation = useMoveLocation();

  if (isCharLoading || isLoreLoading || isNpcsLoading || !character || !loreData) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Ghost className="w-8 h-8 text-primary animate-pulse opacity-50" />
        </div>
      </Layout>
    );
  }

  const currentLocation = loreData.locations.find(l => l.id === locationId);
  const npcs = npcsData || [];
  const enemies = loreData.enemies.filter(e => e.locationId === locationId);
  const otherLocations = loreData.locations.filter(l => l.id !== locationId);

  const handleMove = (newLocationId: string) => {
    moveLocation.mutate({ data: { locationId: newLocationId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
      }
    });
  };

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <header className="border-b border-border/40 pb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />
          <div className="relative z-10">
            <h1 className="text-3xl font-serif text-foreground tracking-wide mb-2 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-primary" />
              {currentLocation?.name || "Неизведанные земли"}
            </h1>
            <div className="flex gap-2 mb-4">
              <Badge variant="outline" className="border-primary/30 text-primary">{currentLocation?.region}</Badge>
              {currentLocation?.isSafe && (
                <Badge variant="outline" className="border-secondary/30 text-secondary-foreground">Безопасная зона</Badge>
              )}
            </div>
            <p className="text-muted-foreground font-serif italic text-lg leading-relaxed max-w-2xl">
              {currentLocation?.description}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="bg-black/20 border-white/5">
              <CardHeader>
                <CardTitle className="font-serif text-xl flex items-center gap-2 text-secondary-foreground">
                  <Users className="w-5 h-5 opacity-70" />
                  Присутствующие ({npcs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {npcs.length === 0 ? (
                  <p className="text-muted-foreground italic text-sm">Здесь никого нет...</p>
                ) : (
                  <div className="space-y-3">
                    {npcs.map(npc => (
                      <div 
                        key={npc.id}
                        className="p-3 border border-white/5 rounded-sm bg-black/40 hover:border-secondary/50 cursor-pointer transition-all group"
                        onClick={() => navigate(`/npc/${npc.id}`)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-serif text-lg text-foreground group-hover:text-secondary-foreground transition-colors">{npc.name}</h4>
                            <p className="text-xs text-muted-foreground">{npc.shortProfile}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono border-white/10">{npc.role}</Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                          <span className="opacity-70">{npc.repIcon}</span>
                          <span>{npc.repName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-black/20 border-white/5">
              <CardHeader>
                <CardTitle className="font-serif text-xl flex items-center gap-2 text-destructive">
                  <Swords className="w-5 h-5 opacity-70" />
                  Угрозы ({enemies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {enemies.length === 0 ? (
                  <p className="text-muted-foreground italic text-sm">Здесь безопасно... пока что.</p>
                ) : (
                  <div className="space-y-3">
                    {enemies.map(enemy => (
                      <div 
                        key={enemy.key}
                        className="p-3 border border-white/5 rounded-sm bg-black/40 hover:border-destructive/50 transition-all group"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-serif text-lg text-foreground group-hover:text-destructive transition-colors">{enemy.name}</h4>
                          <span className="text-xs font-mono text-muted-foreground">Ур. {enemy.level}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex gap-3 text-xs font-mono text-muted-foreground">
                            <span className="flex items-center gap-1 text-destructive/80"><Heart className="w-3 h-3" /> {enemy.hp}</span>
                            <span className="flex items-center gap-1 text-primary/80"><Sword className="w-3 h-3" /> {enemy.damage}</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground font-serif tracking-widest"
                            onClick={() => navigate("/battle")}
                          >
                            Сразиться
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-black/20 border-white/5">
              <CardHeader>
                <CardTitle className="font-serif text-xl flex items-center gap-2 text-primary">
                  <ArrowRight className="w-5 h-5 opacity-70" />
                  Пути
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {otherLocations.map(loc => (
                    <div 
                      key={loc.id}
                      className="p-3 border border-white/5 rounded-sm bg-black/40 flex justify-between items-center group"
                    >
                      <div>
                        <h4 className="font-serif text-lg text-foreground">{loc.name}</h4>
                        <span className="text-xs text-muted-foreground font-mono">{loc.region}</span>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleMove(loc.id)}
                        disabled={moveLocation.isPending}
                        className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all font-serif tracking-widest"
                      >
                        Отправиться
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
