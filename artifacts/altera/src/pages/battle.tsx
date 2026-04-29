import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sword, Shield, Wind, Sparkles, Skull, Heart } from "lucide-react";
import { 
  useGetActiveBattle, 
  useGetLore, 
  useGetCharacter,
  useStartBattle,
  useBattleAction,
  getGetActiveBattleQueryKey,
  getGetCharacterQueryKey,
  BattleActionRequestAction,
  BattleStatus
} from "@workspace/api-client-react";

import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function BattleScreen() {
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
      <Layout>
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
    startBattle.mutate({ data: { enemyKey } }, {
      onSuccess: invalidateData
    });
  };

  const handleAction = (action: BattleActionRequestAction) => {
    battleAction.mutate({ data: { action } }, {
      onSuccess: invalidateData
    });
  };

  // If no active battle, show location enemies
  if (!battle || battle.status !== BattleStatus.active) {
    const enemies = lore.enemies.filter(e => e.locationId === character.locationId);
    
    return (
      <Layout>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <header className="border-b border-border/40 pb-6 text-center">
            <h1 className="text-3xl font-serif text-destructive tracking-wide mb-2">Битва</h1>
            <p className="text-muted-foreground font-serif italic text-sm">Жизнь за жизнь. Кровь за кровь.</p>
          </header>

          {battle && (battle.status === BattleStatus.victory || battle.status === BattleStatus.defeat || battle.status === BattleStatus.fled) && (
            <Card className={`bg-black/40 border-white/10 mb-8 text-center ${battle.status === BattleStatus.victory ? 'border-primary/50' : 'border-destructive/50'}`}>
              <CardContent className="pt-6">
                <h3 className={`text-2xl font-serif mb-2 ${battle.status === BattleStatus.victory ? 'text-primary' : 'text-destructive'}`}>
                  {battle.status === BattleStatus.victory ? 'Победа' : battle.status === BattleStatus.defeat ? 'Поражение' : 'Бегство'}
                </h3>
                {battle.status === BattleStatus.victory && (
                  <p className="text-muted-foreground font-mono text-sm">
                    Награда: <span className="text-primary">{battle.rewardSilver} серебра</span>, <span className="text-secondary-foreground">{battle.rewardExp} опыта</span>
                  </p>
                )}
                {battle.status === BattleStatus.defeat && (
                  <p className="text-muted-foreground font-mono text-sm">Вам потребуется отдых.</p>
                )}
                <div className="mt-4 text-xs font-mono text-muted-foreground/50 border-t border-white/5 pt-4 text-left space-y-1">
                  {battle.log.map((l, i) => (
                    <div key={i} className="truncate">[{l.round}] {l.text}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {enemies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground italic font-serif">
              Здесь не с кем сражаться.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enemies.map(enemy => (
                <Card key={enemy.key} className="bg-black/20 border-white/5 hover:border-destructive/30 transition-colors group cursor-pointer" onClick={() => handleStart(enemy.key)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="font-serif text-xl flex justify-between items-center group-hover:text-destructive transition-colors">
                      {enemy.name}
                      <span className="text-sm font-mono text-muted-foreground">Ур. {enemy.level}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground italic mb-4">{enemy.lore}</p>
                    <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                      <span className="flex items-center gap-1 text-destructive/80"><Heart className="w-3 h-3" /> {enemy.hp} HP</span>
                      <span className="flex items-center gap-1 text-primary/80"><Sword className="w-3 h-3" /> {enemy.damage} Урон</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </Layout>
    );
  }

  // Active battle UI
  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col h-[calc(100vh-6rem)] gap-6"
      >
        <div className="grid grid-cols-2 gap-6 relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center font-serif text-destructive">VS</div>
          </div>
          
          <Card className="bg-black/20 border-white/5 text-center">
            <CardContent className="pt-6">
              <h3 className="font-serif text-xl text-foreground mb-4">{character.name}</h3>
              <div className="text-3xl font-mono text-destructive mb-2">{battle.characterHp}</div>
              <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(battle.characterHp / character.maxHp) * 100}%` }}
                  className="h-full bg-destructive"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/20 border-white/5 text-center">
            <CardContent className="pt-6">
              <h3 className="font-serif text-xl text-foreground mb-4">{battle.enemyName}</h3>
              <div className="text-3xl font-mono text-secondary-foreground mb-2">{battle.enemyHp}</div>
              <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(battle.enemyHp / battle.enemyMaxHp) * 100}%` }}
                  className="h-full bg-secondary"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="flex-1 flex flex-col bg-black/40 border-white/5 overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={logRef}>
            <div className="space-y-2">
              <AnimatePresence>
                {battle.log.map((entry, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: entry.actor === 'player' ? -20 : entry.actor === 'enemy' ? 20 : 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={idx}
                    className={`p-2 rounded font-serif text-sm border ${
                      entry.actor === 'player' ? 'bg-primary/5 border-primary/20 text-primary-foreground ml-0 mr-8' :
                      entry.actor === 'enemy' ? 'bg-destructive/5 border-destructive/20 text-destructive-foreground ml-8 mr-0' :
                      'bg-black/20 border-white/5 text-muted-foreground mx-4 text-center text-xs font-mono uppercase tracking-widest'
                    }`}
                  >
                    {entry.actor !== 'system' && (
                      <span className="opacity-50 text-xs mr-2 font-mono">[{entry.round}]</span>
                    )}
                    {entry.text}
                    {entry.damage ? <span className="ml-2 font-mono font-bold">{entry.damage}</span> : null}
                    {entry.crit ? <span className="ml-2 text-yellow-500 font-bold uppercase tracking-widest text-[10px]">Крит!</span> : null}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button 
            variant="outline" 
            className="h-16 font-serif bg-black/20 border-white/10 hover:bg-primary/20 hover:text-primary hover:border-primary/50 transition-all"
            disabled={battleAction.isPending}
            onClick={() => handleAction(BattleActionRequestAction.attack)}
          >
            <Sword className="w-5 h-5 mr-2" />
            Атака
          </Button>
          <Button 
            variant="outline" 
            className="h-16 font-serif bg-black/20 border-white/10 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50 transition-all"
            disabled={battleAction.isPending}
            onClick={() => handleAction(BattleActionRequestAction.heavy)}
          >
            <Skull className="w-5 h-5 mr-2" />
            Тяжелая
          </Button>
          <Button 
            variant="outline" 
            className="h-16 font-serif bg-black/20 border-white/10 hover:bg-secondary/20 hover:text-secondary-foreground hover:border-secondary/50 transition-all"
            disabled={battleAction.isPending}
            onClick={() => handleAction(BattleActionRequestAction.defend)}
          >
            <Shield className="w-5 h-5 mr-2" />
            Защита
          </Button>
          <Button 
            variant="outline" 
            className="h-16 font-serif bg-black/20 border-white/10 hover:bg-white/10 transition-all"
            disabled={battleAction.isPending}
            onClick={() => handleAction(BattleActionRequestAction.flee)}
          >
            <Wind className="w-5 h-5 mr-2" />
            Бегство
          </Button>
        </div>
      </motion.div>
    </Layout>
  );
}
