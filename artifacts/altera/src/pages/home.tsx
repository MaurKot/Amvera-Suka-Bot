import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Scroll, Heart, Zap, Sparkles, Map, Trophy, Gift, ScrollText } from "lucide-react";

import { 
  useGetCharacter, 
  useGetLore,
  useCreateCharacter,
  useDeleteCharacter,
  getGetCharacterQueryKey
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Layout } from "@/components/layout";

const createCharacterSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа").max(30, "Имя слишком длинное"),
  race: z.string().min(1, "Выберите происхождение"),
  charClass: z.string().min(1, "Выберите путь"),
});

type CreateCharacterValues = z.infer<typeof createCharacterSchema>;

export function Home() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: characterData, isLoading: isCharLoading } = useGetCharacter();
  const { data: loreData, isLoading: isLoreLoading } = useGetLore();
  
  const createMutation = useCreateCharacter();
  const deleteMutation = useDeleteCharacter();

  const form = useForm<CreateCharacterValues>({
    resolver: zodResolver(createCharacterSchema),
    defaultValues: {
      name: "",
      race: "",
      charClass: "",
    },
  });

  const selectedRace = form.watch("race");
  const selectedClass = form.watch("charClass");

  if (isCharLoading || isLoreLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skull className="w-8 h-8 text-primary animate-pulse opacity-50" />
          <p className="text-muted-foreground font-serif tracking-widest text-sm uppercase">Чтение свитков судьбы...</p>
        </div>
      </div>
    );
  }

  const character = characterData?.character;
  const lore = loreData;

  const onSubmit = (values: CreateCharacterValues) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
      }
    });
  };

  const handleSuicide = () => {
    if (confirm("Вы уверены? Ваша душа будет стерта из хроник навсегда.")) {
      deleteMutation.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        }
      });
    }
  };

  if (!character) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 md:p-8 relative overflow-hidden">
        {/* Subtle background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        
        <Card className="w-full max-w-4xl bg-card/80 backdrop-blur-sm border-primary/20 shadow-2xl relative z-10">
          <CardHeader className="text-center border-b border-primary/10 pb-8">
            <CardTitle className="text-3xl md:text-4xl font-serif text-primary tracking-widest uppercase mt-4">
              Создание Души
            </CardTitle>
            <CardDescription className="text-muted-foreground font-serif italic text-lg mt-2">
              Начертайте свое имя в хрониках Альтеры
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
                
                {/* Name */}
                <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="w-full text-center">
                        <FormLabel className="text-foreground/80 font-serif text-lg tracking-wide">Истинное Имя</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Например, Эларион..." 
                            className="text-center font-serif text-xl border-primary/30 bg-black/50 focus-visible:ring-primary/50 h-14"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage className="text-destructive font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Race Selection */}
                  <div className="space-y-6">
                    <div className="text-center border-b border-border/50 pb-2">
                      <h3 className="font-serif text-xl text-foreground">Происхождение</h3>
                    </div>
                    
                    <div className="grid gap-4">
                      {lore?.races.map((race) => (
                        <div 
                          key={race.key}
                          className={`
                            relative p-4 rounded-sm border cursor-pointer transition-all duration-300 group
                            ${selectedRace === race.key 
                              ? 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)]' 
                              : 'bg-black/20 border-white/5 hover:border-primary/50 hover:bg-white/5'}
                          `}
                          onClick={() => form.setValue("race", race.key)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-serif text-lg text-primary">{race.nameRu}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2 group-hover:line-clamp-none transition-all">{race.lore}</p>
                          
                          {selectedRace === race.key && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="text-xs font-mono text-secondary-foreground/80 bg-black/40 p-2 rounded border border-white/5"
                            >
                              <span className="text-muted-foreground uppercase text-[10px] tracking-widest mb-1 block">Дары крови:</span>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(race.bonuses).map(([stat, val]) => (
                                  <span key={stat} className="text-primary">+{val} {stat}</span>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-destructive text-center h-4">
                      {form.formState.errors.race?.message}
                    </p>
                  </div>

                  {/* Class Selection */}
                  <div className="space-y-6">
                    <div className="text-center border-b border-border/50 pb-2">
                      <h3 className="font-serif text-xl text-foreground">Путь</h3>
                    </div>
                    
                    <div className="grid gap-4">
                      {lore?.classes.map((cls) => (
                        <div 
                          key={cls.key}
                          className={`
                            relative p-4 rounded-sm border cursor-pointer transition-all duration-300 group
                            ${selectedClass === cls.key 
                              ? 'bg-secondary/10 border-secondary shadow-[0_0_15px_rgba(var(--secondary),0.2)]' 
                              : 'bg-black/20 border-white/5 hover:border-secondary/50 hover:bg-white/5'}
                          `}
                          onClick={() => form.setValue("charClass", cls.key)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-serif text-lg text-secondary-foreground">{cls.nameRu}</h4>
                            <Badge variant="outline" className="font-mono text-[10px] uppercase border-secondary/30 text-secondary-foreground/70">
                              {cls.resource}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">{cls.desc}</p>
                          
                          {selectedClass === cls.key && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="text-xs font-mono text-secondary-foreground/80 bg-black/40 p-2 rounded border border-white/5"
                            >
                              <span className="text-muted-foreground uppercase text-[10px] tracking-widest mb-1 block">Начальные атрибуты:</span>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(cls.startStats).map(([stat, val]) => (
                                  <span key={stat}>
                                    <span className="text-muted-foreground">{stat}:</span> <span className="text-secondary-foreground">{val}</span>
                                  </span>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-destructive text-center h-4">
                      {form.formState.errors.charClass?.message}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center pt-8 border-t border-border/30">
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="font-serif text-lg tracking-widest uppercase px-12 h-14 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Рождение..." : "Войти в Альтеру"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active character hub
  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <header className="border-b border-border/40 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-serif text-foreground tracking-wide mb-2">{character.name}</h1>
            <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground">
              <Badge variant="outline" className="border-primary/30 text-primary uppercase">{character.race}</Badge>
              <Badge variant="outline" className="border-secondary/30 text-secondary-foreground uppercase">{character.charClass}</Badge>
              <span>Уровень {character.level}</span>
            </div>
          </div>
          
          <Button variant="destructive" size="sm" onClick={handleSuicide} className="font-serif italic text-xs h-8 opacity-50 hover:opacity-100 transition-opacity">
            Стереть душу
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-black/20 border-white/5 md:col-span-2 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader>
              <CardTitle className="font-serif text-xl text-primary flex items-center gap-2">
                <Scroll className="w-5 h-5 opacity-70" />
                Текущее Местоположение
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lore?.locations.find(l => l.id === character.locationId) ? (
                <div className="space-y-4">
                  <h3 className="text-2xl font-serif text-foreground">
                    {lore.locations.find(l => l.id === character.locationId)?.name}
                  </h3>
                  <p className="text-muted-foreground italic font-serif leading-relaxed">
                    {lore.locations.find(l => l.id === character.locationId)?.description}
                  </p>
                  
                  <div className="pt-6 grid grid-cols-2 gap-2">
                    <Button onClick={() => navigate("/world")} className="font-serif tracking-widest bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary/50 text-foreground transition-all">
                      Осмотреться
                    </Button>
                    <Button onClick={() => navigate("/map")} variant="outline" className="font-serif tracking-widest" data-testid="home-map">
                      <Map className="w-4 h-4 mr-2" /> Карта
                    </Button>
                    <Button onClick={() => navigate("/quests")} variant="outline" className="font-serif tracking-widest" data-testid="home-quests">
                      <Scroll className="w-4 h-4 mr-2" /> Дела
                    </Button>
                    <Button onClick={() => navigate("/achievements")} variant="outline" className="font-serif tracking-widest" data-testid="home-achievements">
                      <Trophy className="w-4 h-4 mr-2" /> Награды
                    </Button>
                    <Button onClick={() => navigate("/referral")} variant="outline" className="font-serif tracking-widest" data-testid="home-referral">
                      <Gift className="w-4 h-4 mr-2" /> Друзья
                    </Button>
                    <Button onClick={() => navigate("/ledger")} variant="outline" className="font-serif tracking-widest" data-testid="home-ledger">
                      <ScrollText className="w-4 h-4 mr-2" /> Хроника
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Заблудшая душа в неизвестности...</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-black/20 border-white/5">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Heart className="w-5 h-5 text-destructive opacity-70" />
                Состояние
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Здоровье</span>
                  <span className="text-destructive">{character.hp} / {character.maxHp}</span>
                </div>
                <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(character.hp / character.maxHp) * 100}%` }}
                    className="h-full bg-destructive"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Мана / Энергия</span>
                  <span className="text-secondary-foreground">{character.mana} / {character.maxMana}</span>
                </div>
                <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(character.mana / character.maxMana) * 100}%` }}
                    className="h-full bg-secondary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Опыт</span>
                  <span className="text-primary">{character.experience} / {character.nextLevelExp}</span>
                </div>
                <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(character.experience / character.nextLevelExp) * 100}%` }}
                    className="h-full bg-primary/70"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex justify-between items-center border-t border-white/5">
                <div className="font-mono text-sm">
                  <span className="text-muted-foreground">Серебро:</span>{" "}
                  <span className="text-primary">{character.silver}</span>
                </div>
                
                {character.statPoints > 0 && (
                  <Badge className="bg-primary text-primary-foreground animate-pulse cursor-pointer hover:bg-primary/80 transition-colors" onClick={() => navigate("/character")}>
                    +{character.statPoints} очков
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </Layout>
  );
}
