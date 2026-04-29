import { useGetLore } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Book, Skull, MapPin, Swords, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Lore() {
  const { data: lore, isLoading } = useGetLore();

  if (isLoading || !lore) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Book className="w-8 h-8 text-primary animate-pulse opacity-50" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col h-[calc(100vh-6rem)] gap-6"
      >
        <header className="border-b border-border/40 pb-6">
          <h1 className="text-3xl font-serif text-foreground tracking-wide mb-2 flex items-center gap-3">
            <Book className="w-8 h-8 text-primary" />
            Библиотека Знаний
          </h1>
          <p className="text-muted-foreground font-serif italic text-sm">Труды древних мудрецов Альтеры.</p>
        </header>

        <Card className="flex-1 flex flex-col bg-black/20 border-white/5 overflow-hidden">
          <Tabs defaultValue="races" className="flex-1 flex flex-col h-full">
            <div className="px-4 pt-4">
              <TabsList className="w-full grid grid-cols-4 bg-black/40 border border-white/10 rounded-sm">
                <TabsTrigger value="races" className="font-serif tracking-widest data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Происхождения</TabsTrigger>
                <TabsTrigger value="classes" className="font-serif tracking-widest data-[state=active]:bg-secondary/20 data-[state=active]:text-secondary-foreground">Пути</TabsTrigger>
                <TabsTrigger value="locations" className="font-serif tracking-widest data-[state=active]:bg-white/10">Локации</TabsTrigger>
                <TabsTrigger value="enemies" className="font-serif tracking-widest data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">Бестиарий</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="races" className="h-full m-0">
                <ScrollArea className="h-full p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                    {lore.races.map(race => (
                      <Card key={race.key} className="bg-black/40 border-white/5 hover:border-primary/30 transition-colors">
                        <CardHeader className="pb-2">
                          <CardTitle className="font-serif text-xl text-primary flex items-center justify-between">
                            {race.nameRu}
                            <User className="w-4 h-4 opacity-50" />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground italic mb-4 leading-relaxed">{race.lore}</p>
                          <div className="bg-black/50 p-3 rounded border border-white/5">
                            <span className="text-xs uppercase font-mono tracking-widest text-muted-foreground mb-2 block">Особенности Крови</span>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(race.bonuses).map(([stat, val]) => (
                                <Badge key={stat} variant="outline" className="border-primary/20 text-primary bg-primary/5">
                                  +{String(val)} {stat}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="classes" className="h-full m-0">
                <ScrollArea className="h-full p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                    {lore.classes.map(cls => (
                      <Card key={cls.key} className="bg-black/40 border-white/5 hover:border-secondary/30 transition-colors">
                        <CardHeader className="pb-2">
                          <CardTitle className="font-serif text-xl text-secondary-foreground flex items-center justify-between">
                            {cls.nameRu}
                            <Badge variant="outline" className="border-secondary/30 text-secondary-foreground font-mono text-[10px] uppercase">{cls.resource}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{cls.desc}</p>
                          <div className="bg-black/50 p-3 rounded border border-white/5">
                            <span className="text-xs uppercase font-mono tracking-widest text-muted-foreground mb-2 block">Базовые Характеристики</span>
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                              {Object.entries(cls.startStats).map(([stat, val]) => (
                                <div key={stat} className="flex justify-between">
                                  <span className="text-muted-foreground">{stat}:</span>
                                  <span className="text-secondary-foreground">{String(val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="locations" className="h-full m-0">
                <ScrollArea className="h-full p-4">
                  <div className="grid grid-cols-1 gap-4 pb-8">
                    {lore.locations.map(loc => (
                      <Card key={loc.id} className="bg-black/40 border-white/5 hover:border-white/20 transition-colors relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardContent className="p-6 relative z-10">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-serif text-2xl text-foreground flex items-center gap-2 mb-1">
                                <MapPin className="w-5 h-5 text-primary opacity-70" />
                                {loc.name}
                              </h3>
                              <Badge variant="outline" className="border-white/10 text-muted-foreground font-mono text-xs">{loc.region}</Badge>
                            </div>
                            {loc.isSafe ? (
                              <Badge variant="outline" className="border-secondary/30 text-secondary-foreground bg-secondary/10">Мирная зона</Badge>
                            ) : (
                              <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10">Опасно</Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground italic font-serif leading-relaxed text-sm max-w-3xl">
                            {loc.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="enemies" className="h-full m-0">
                <ScrollArea className="h-full p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                    {lore.enemies.map(enemy => (
                      <Card key={enemy.key} className="bg-black/40 border-white/5 hover:border-destructive/30 transition-colors">
                        <CardHeader className="pb-2">
                          <CardTitle className="font-serif text-xl text-destructive flex items-center justify-between">
                            {enemy.name}
                            <span className="font-mono text-xs text-muted-foreground">Ур. {enemy.level}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground italic mb-4 leading-relaxed">{enemy.lore}</p>
                          <div className="bg-black/50 p-3 rounded border border-white/5 flex justify-between text-xs font-mono">
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Здоровье</div>
                              <div className="text-destructive text-lg">{enemy.hp}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Урон</div>
                              <div className="text-primary text-lg">{enemy.damage}</div>
                            </div>
                            <div className="space-y-1 text-right">
                              <div className="text-muted-foreground">Награда</div>
                              <div className="text-foreground">{enemy.rewardSilver} сер. / {enemy.rewardExp} оп.</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </motion.div>
    </Layout>
  );
}
