import { useGetCharacter, useAllocateStat, getGetCharacterQueryKey, AllocateStatRequestStat } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Skull, Heart, Zap, Sparkles, Shield, Sword, Eye, Brain, Plus, Sprout } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface RegenRate { hpPerSec: number; manaPerSec: number; zone: "safe" | "wilderness" | "dangerous" }

export function CharacterSheet() {
  const queryClient = useQueryClient();
  const { data: characterData, isLoading } = useGetCharacter();
  const allocateStat = useAllocateStat();

  if (isLoading || !characterData?.character) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Skull className="w-8 h-8 text-primary animate-pulse opacity-50" />
        </div>
      </Layout>
    );
  }

  const character = characterData.character;
  // P7 — passive regen rate is appended by the server on every GET /character.
  // The orval-generated type doesn't know about it, so we read it loosely.
  const regen = (character as unknown as { regen?: RegenRate }).regen ?? null;
  const zoneLabel: Record<string, string> = {
    safe: "Безопасная зона — раны затягиваются быстро",
    wilderness: "Глушь — восстановление медленное",
    dangerous: "Опасная зона — едва-едва",
  };

  const handleAllocate = (stat: AllocateStatRequestStat) => {
    allocateStat.mutate({ data: { stat } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
      }
    });
  };

  const stats = [
    { key: AllocateStatRequestStat.strength, label: "Сила", value: character.strength, icon: Sword, color: "text-red-400" },
    { key: AllocateStatRequestStat.agility, label: "Ловкость", value: character.agility, icon: Sparkles, color: "text-green-400" },
    { key: AllocateStatRequestStat.intelligence, label: "Интеллект", value: character.intelligence, icon: Brain, color: "text-blue-400" },
    { key: AllocateStatRequestStat.endurance, label: "Выносливость", value: character.endurance, icon: Shield, color: "text-orange-400" },
    { key: AllocateStatRequestStat.intuition, label: "Интуиция", value: character.intuition, icon: Eye, color: "text-purple-400" },
  ];

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <header className="border-b border-border/40 pb-6">
          <h1 className="text-3xl font-serif text-foreground tracking-wide mb-2">Сущность</h1>
          <p className="text-muted-foreground font-serif italic text-sm">Ваша душа, запечатленная в числах</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-black/20 border-white/5">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Heart className="w-5 h-5 text-destructive opacity-70" />
                Жизненные Силы
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-mono text-muted-foreground">
                  <span>Здоровье</span>
                  <span className="text-destructive">{character.hp} / {character.maxHp}</span>
                </div>
                <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(character.hp / character.maxHp) * 100}%` }}
                    className="h-full bg-destructive"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm font-mono text-muted-foreground">
                  <span>Мана</span>
                  <span className="text-secondary-foreground">{character.mana} / {character.maxMana}</span>
                </div>
                <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(character.mana / character.maxMana) * 100}%` }}
                    className="h-full bg-secondary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm font-mono text-muted-foreground">
                  <span>Энергия</span>
                  <span className="text-yellow-500">{character.energy} / {character.maxEnergy}</span>
                </div>
                <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(character.energy / character.maxEnergy) * 100}%` }}
                    className="h-full bg-yellow-500"
                  />
                </div>
              </div>

              {/* P7 — passive regeneration replaces the old "Отдых у костра" button.
                  Healing happens automatically over time, faster in safe zones. */}
              <div className="pt-4 border-t border-white/5">
                <div
                  className={`rounded border p-3 flex items-start gap-3 ${
                    regen?.zone === "safe"
                      ? "border-primary/30 bg-primary/5"
                      : regen?.zone === "dangerous"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                  data-testid="regen-card"
                >
                  <Sprout
                    className={`w-5 h-5 mt-0.5 ${
                      regen?.zone === "safe"
                        ? "text-primary"
                        : regen?.zone === "dangerous"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-sm text-foreground">Естественное восстановление</p>
                    <p className="text-xs text-muted-foreground italic mt-0.5">
                      {regen ? zoneLabel[regen.zone] : "Раны затягиваются сами"}
                    </p>
                    {regen && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
                        <span className="text-destructive/80">+{regen.hpPerSec.toFixed(2)} HP/с</span>
                        <span className="text-secondary-foreground/80">+{regen.manaPerSec.toFixed(2)} мана/с</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/20 border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary opacity-70" />
                Атрибуты
              </CardTitle>
              {character.statPoints > 0 && (
                <Badge className="bg-primary text-primary-foreground animate-pulse font-mono">
                  {character.statPoints} очков
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.map((stat) => (
                  <div key={stat.key} className="flex items-center justify-between p-3 rounded bg-black/40 border border-white/5 group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full bg-white/5 ${stat.color}`}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <span className="font-serif text-foreground/90">{stat.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-lg text-primary">{stat.value}</span>
                      {character.statPoints > 0 && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 rounded-full hover:bg-primary/20 hover:text-primary transition-colors"
                          onClick={() => handleAllocate(stat.key)}
                          disabled={allocateStat.isPending}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </Layout>
  );
}
