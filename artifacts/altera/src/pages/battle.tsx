import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sword, Shield, Wind, Skull, Heart, Map as MapIcon } from "lucide-react";
import {
  useGetActiveBattle,
  useGetLore,
  useGetCharacter,
  useStartBattle,
  useBattleAction,
  getGetActiveBattleQueryKey,
  getGetCharacterQueryKey,
  BattleActionRequestAction,
  BattleStatus,
} from "@workspace/api-client-react";

import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

export function BattleScreen() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const logRef = useRef<HTMLDivElement>(null);

  const { data: battleData, isLoading: isBattleLoading } = useGetActiveBattle();
  const { data: loreData, isLoading: isLoreLoading } = useGetLore();
  const { data: characterData, isLoading: isCharLoading } = useGetCharacter();

  const startBattle = useStartBattle();
  const battleAction = useBattleAction();

  const battle = battleData?.battle;
  const character = characterData?.character;
  const lore = loreData;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [battle?.log]);

  if (isBattleLoading || isLoreLoading || isCharLoading || !character || !lore) {
    return (
      <Layout title="Битва">
        <div className="flex-1 flex items-center justify-center">
          <Skull className="w-8 h-8 text-destructive animate-pulse opacity-50" />
        </div>
      </Layout>
    );
  }

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: getGetActiveBattleQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
  };

  const handleStart = (enemyKey: string) => {
    haptic("medium");
    startBattle.mutate(
      { data: { enemyKey } },
      {
        onSuccess: () => {
          haptic("success");
          invalidateData();
        },
        onError: () => haptic("error"),
      },
    );
  };

  const handleAction = (action: BattleActionRequestAction) => {
    haptic("light");
    battleAction.mutate(
      { data: { action } },
      {
        onSuccess: invalidateData,
        onError: () => haptic("error"),
      },
    );
  };

  // -------- No active battle: show recap + enemies in current location ----
  if (!battle || battle.status !== BattleStatus.active) {
    const enemies = lore.enemies.filter((e) => e.locationId === character.locationId);

    return (
      <Layout
        title="Битва"
        subtitle={
          enemies.length > 0
            ? "Жизнь за жизнь. Кровь за кровь."
            : "Здесь не с кем сражаться."
        }
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {battle &&
            (battle.status === BattleStatus.victory ||
              battle.status === BattleStatus.defeat ||
              battle.status === BattleStatus.fled) && (
              <Card
                className={cn(
                  "bg-card/70 border text-center",
                  battle.status === BattleStatus.victory
                    ? "border-primary/50"
                    : "border-destructive/50",
                )}
              >
                <CardContent className="pt-5 pb-4">
                  <h3
                    className={cn(
                      "text-xl font-serif mb-2",
                      battle.status === BattleStatus.victory
                        ? "text-primary"
                        : "text-destructive",
                    )}
                  >
                    {battle.status === BattleStatus.victory
                      ? "Победа"
                      : battle.status === BattleStatus.defeat
                      ? "Поражение"
                      : "Бегство"}
                  </h3>
                  {battle.status === BattleStatus.victory && (
                    <p className="text-muted-foreground font-mono text-sm">
                      Награда:{" "}
                      <span className="text-primary">{battle.rewardSilver} серебра</span>,{" "}
                      <span className="text-secondary-foreground">{battle.rewardExp} опыта</span>
                    </p>
                  )}
                  {battle.status === BattleStatus.defeat && (
                    <p className="text-muted-foreground font-mono text-sm">
                      Тебя возвращают на площадь Ардвейла. Отдохни.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

          {enemies.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <p className="text-muted-foreground italic font-serif">
                В этом месте врагов нет.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  haptic("selection");
                  navigate("/map");
                }}
                data-testid="battle-goto-map"
              >
                <MapIcon className="h-4 w-4 mr-2" /> Найти опасные земли
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {enemies.map((enemy) => (
                <button
                  key={enemy.key}
                  type="button"
                  className="w-full text-left bg-card/70 border border-border/40 hover:border-destructive/40 transition-colors rounded-md p-3"
                  onClick={() => handleStart(enemy.key)}
                  disabled={startBattle.isPending}
                  data-testid={`pick-enemy-${enemy.key}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-serif text-base text-foreground truncate">
                        {enemy.name}
                      </h4>
                      <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">
                        {enemy.lore}
                      </p>
                      <div className="mt-2 flex gap-3 text-[11px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1 text-destructive/80">
                          <Heart className="w-3 h-3" /> {enemy.hp}
                        </span>
                        <span className="flex items-center gap-1 text-primary/80">
                          <Sword className="w-3 h-3" /> {enemy.damage}
                        </span>
                        <span>Ур. {enemy.level}</span>
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center text-[11px] font-serif uppercase tracking-wide text-destructive border border-destructive/40 rounded px-2 py-1">
                      В бой
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </Layout>
    );
  }

  // -------- Active battle UI --------------------------------------------
  return (
    <Layout title="Бой" subtitle={`против ${battle.enemyName}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col gap-3"
      >
        {/* HP bars: stacked on mobile */}
        <div className="grid grid-cols-2 gap-2">
          <CombatantCard
            name={character.name}
            hp={battle.characterHp}
            maxHp={character.maxHp}
            color="bg-destructive"
            valueClass="text-destructive"
            align="left"
          />
          <CombatantCard
            name={battle.enemyName}
            hp={battle.enemyHp}
            maxHp={battle.enemyMaxHp}
            color="bg-secondary"
            valueClass="text-secondary-foreground"
            align="right"
          />
        </div>

        {/* Combat log */}
        <div
          ref={logRef}
          className="flex-1 min-h-[40dvh] max-h-[55dvh] overflow-y-auto bg-black/40 border border-border/40 rounded-md p-3 space-y-2"
          data-testid="battle-log"
        >
          <AnimatePresence initial={false}>
            {battle.log.map((entry, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-2 rounded font-serif text-sm border",
                  entry.actor === "player" &&
                    "bg-primary/5 border-primary/20 text-foreground mr-6",
                  entry.actor === "enemy" &&
                    "bg-destructive/5 border-destructive/20 text-foreground ml-6",
                  entry.actor === "system" &&
                    "bg-black/40 border-border/40 text-muted-foreground text-center text-xs uppercase tracking-widest",
                )}
              >
                {entry.actor !== "system" && (
                  <span className="opacity-50 text-[10px] mr-2 font-mono">[{entry.round}]</span>
                )}
                {entry.text}
                {entry.damage ? (
                  <span className="ml-2 font-mono font-bold">{entry.damage}</span>
                ) : null}
                {entry.crit ? (
                  <span className="ml-2 text-yellow-500 font-bold uppercase tracking-widest text-[10px]">
                    Крит!
                  </span>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Actions: 2x2 grid on mobile, larger tap targets */}
        <div className="grid grid-cols-2 gap-2 sticky bottom-20 sm:static">
          <ActionButton
            label="Атака"
            icon={Sword}
            disabled={battleAction.isPending}
            onClick={() => handleAction(BattleActionRequestAction.attack)}
            testId="action-attack"
            tone="primary"
          />
          <ActionButton
            label="Тяжёлая"
            icon={Skull}
            disabled={battleAction.isPending}
            onClick={() => handleAction(BattleActionRequestAction.heavy)}
            testId="action-heavy"
            tone="destructive"
          />
          <ActionButton
            label="Защита"
            icon={Shield}
            disabled={battleAction.isPending}
            onClick={() => handleAction(BattleActionRequestAction.defend)}
            testId="action-defend"
            tone="secondary"
          />
          <ActionButton
            label="Бегство"
            icon={Wind}
            disabled={battleAction.isPending}
            onClick={() => handleAction(BattleActionRequestAction.flee)}
            testId="action-flee"
            tone="muted"
          />
        </div>
      </motion.div>
    </Layout>
  );
}

function CombatantCard({
  name,
  hp,
  maxHp,
  color,
  valueClass,
  align,
}: {
  name: string;
  hp: number;
  maxHp: number;
  color: string;
  valueClass: string;
  align: "left" | "right";
}) {
  const pct = maxHp > 0 ? Math.min(100, Math.max(0, (hp / maxHp) * 100)) : 0;
  return (
    <Card className="bg-card/70 border-border/40">
      <CardContent className="p-3">
        <h3
          className={cn(
            "font-serif text-sm text-foreground truncate",
            align === "right" && "text-right",
          )}
        >
          {name}
        </h3>
        <div
          className={cn(
            "mt-1 text-2xl font-mono",
            valueClass,
            align === "right" && "text-right",
          )}
        >
          {hp}
        </div>
        <div className="mt-1 h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
          <motion.div
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
            className={cn("h-full", color)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ActionButton({
  label,
  icon: Icon,
  disabled,
  onClick,
  testId,
  tone,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
  onClick: () => void;
  testId: string;
  tone: "primary" | "secondary" | "destructive" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "border-primary/40 hover:bg-primary/15 text-primary"
      : tone === "destructive"
      ? "border-destructive/40 hover:bg-destructive/15 text-destructive"
      : tone === "secondary"
      ? "border-secondary/40 hover:bg-secondary/15 text-secondary-foreground"
      : "border-border/60 hover:bg-muted/40 text-foreground";
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn("h-14 font-serif text-sm tracking-wide bg-background/40", cls)}
      data-testid={testId}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
