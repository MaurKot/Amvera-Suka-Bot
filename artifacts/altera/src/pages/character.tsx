import { useGetCharacter, useAllocateStat, getGetCharacterQueryKey, AllocateStatRequestStat } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Skull, Heart, Zap, Sparkles, Shield, Sword, Eye, Brain, Plus, Sprout, Ghost, Flame, Star } from "lucide-react";
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
          <svg className="w-10 h-10 text-primary runic-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </div>
      </Layout>
    );
  }

  const character = characterData.character;
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
          <div className="ornament-rule mb-2">&nbsp;</div>
          <h1 className="text-3xl font-serif text-foreground tracking-wide mb-2">Сущность</h1>
          <p className="text-muted-foreground font-serif italic text-sm">Ваша душа, запечатленная в числах</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="card-parchment bg-card/70 border-border/40">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Heart className="w-5 h-5 text-destructive opacity-70" />
                Жизненные Силы
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <VitalBar label="Здоровье" icon={Heart} value={character.hp} max={character.maxHp} color="bg-destructive" valueClass="text-destructive" />
              <VitalBar label="Мана" icon={Flame} value={character.mana} max={character.maxMana} color="bg-secondary" valueClass="text-secondary-foreground" />
              <VitalBar label="Энергия" icon={Zap} value={character.energy} max={character.maxEnergy} color="bg-primary/70" valueClass="text-primary" />

              <div className="pt-4 border-t border-border/40">
                <div
                  className={cn(
                    "rounded border p-3 flex items-start gap-3",
                    regen?.zone === "safe"
                      ? "border-primary/30 bg-primary/5"
                      : regen?.zone === "dangerous"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border/40 bg-surface-2"
                  )}
                  data-testid="regen-card"
                >
                  <Sprout
                    className={cn(
                      "w-5 h-5 mt-0.5",
                      regen?.zone === "safe"
                        ? "text-primary"
                        : regen?.zone === "dangerous"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
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

          <Card className="card-parchment bg-card/70 border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Star className="w-5 h-5 text-primary opacity-70" />
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
                  <div key={stat.key} className="flex items-center justify-between p-3 rounded bg-surface-2 border border-border/40 group hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-full bg-surface-3 ${stat.color}`}>
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
                          className="h-8 w-8 rounded-full hover:bg-primary/20 hover:text-primary transition-colors btn-press"
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

        <PsychePanel character={character} />
      </motion.div>
    </Layout>
  );
}

function VitalBar({ label, icon: Icon, value, max, color, valueClass }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  max: number;
  color: string;
  valueClass: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-mono text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span className={valueClass}>{value} / {max}</span>
      </div>
      <div className="h-2.5 w-full bg-black/50 rounded-sm overflow-hidden border border-white/5 bar-segmented">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          className={cn("h-full rounded-sm", color)}
          style={{ willChange: "transform" }}
        />
      </div>
    </div>
  );
}

function cn(...args: (string | undefined | false)[]) {
  return args.filter(Boolean).join(" ");
}

// ─── Psyche panel ────────────────────────────────────────────────────
interface PsycheCharacter {
  archetype?: string | null;
  cruelty?: number;
  curiosity?: number;
  loyalty?: number;
  fearLevel?: number;
  fame?: number;
}

function PsychePanel({ character }: { character: PsycheCharacter }) {
  const traits = [
    { key: "cruelty",   label: "Жестокость", value: character.cruelty   ?? 0, hint: "Растёт от добиваний и пролитой крови", color: "bg-red-500/70", icon: Skull },
    { key: "curiosity", label: "Любопытство", value: character.curiosity ?? 0, hint: "Растёт от диалогов и открытий", color: "bg-blue-500/70", icon: Eye },
    { key: "loyalty",   label: "Верность",    value: character.loyalty   ?? 0, hint: "Растёт от выполненных обещаний", color: "bg-amber-500/70", icon: Shield },
    { key: "fearLevel", label: "Страх",       value: character.fearLevel ?? 0, hint: "Растёт от поражений и бегства", color: "bg-violet-500/70", icon: Ghost },
  ];
  const fame = character.fame ?? 0;
  return (
    <Card className="card-parchment bg-card/70 border-border/40" data-testid="psyche-panel">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-serif text-xl flex items-center gap-2">
          <Brain className="w-5 h-5 text-secondary-foreground opacity-70" />
          Психика
        </CardTitle>
        {character.archetype ? (
          <Badge
            variant="outline"
            className="border-primary/40 text-primary font-serif glow-important shimmer-legendary"
            data-testid="archetype-badge"
          >
            {character.archetype}
          </Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">архетип ещё не сложился</span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {traits.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.key} className="surface-3 rounded p-3" data-testid={`psyche-${t.key}`}>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-secondary-soft inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </span>
                  <span className="text-primary-soft">{t.value}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-black/60 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, t.value)}%` }}
                    transition={{ duration: 0.4 }}
                    className={`h-full ${t.color}`}
                    style={{ willChange: "transform" }}
                  />
                </div>
                <p className="text-[11px] text-muted-soft italic mt-1.5 leading-snug">{t.hint}</p>
              </div>
            );
          })}
        </div>

        <div className="surface-3 rounded p-3" data-testid="psyche-fame">
          <div className="flex justify-between text-sm font-mono">
            <span className="text-secondary-soft">Слава</span>
            <span className={fame >= 0 ? "text-primary-soft" : "text-destructive"}>
              {fame > 0 ? `+${fame}` : fame}
            </span>
          </div>
          <div className="mt-1.5 relative h-1.5 w-full bg-black/60 rounded-full overflow-hidden">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(50, Math.abs(fame) / 2)}%`,
                left: fame >= 0 ? "50%" : `${50 - Math.min(50, Math.abs(fame) / 2)}%`,
              }}
              transition={{ duration: 0.4 }}
              className={`absolute top-0 h-full ${fame >= 0 ? "bg-primary/70" : "bg-destructive/70"}`}
              style={{ willChange: "transform" }}
            />
          </div>
          <p className="text-[11px] text-muted-soft italic mt-1.5 leading-snug">
            Что о тебе говорят в тавернах. От -100 (изгой) до +100 (легенда).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
