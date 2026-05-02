import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Skull,
  Scroll,
  Heart,
  Sparkles,
  Map,
  Trophy,
  Gift,
  ScrollText,
  Sword,
  Eye,
  Flame,
  Star,
  Shield,
  User,
} from "lucide-react";

import {
  useGetCharacter,
  useGetLore,
  useCreateCharacter,
  useDeleteCharacter,
  getGetCharacterQueryKey,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/layout";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

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
    defaultValues: { name: "", race: "", charClass: "" },
  });

  const selectedRace = form.watch("race");
  const selectedClass = form.watch("charClass");

  if (isCharLoading || isLoreLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-10 h-10 text-primary runic-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <p className="text-muted-foreground font-serif tracking-widest text-sm uppercase">
            Чтение свитков судьбы...
          </p>
        </div>
      </div>
    );
  }

  const character = characterData?.character;
  const lore = loreData;

  const onSubmit = (values: CreateCharacterValues) => {
    haptic("medium");
    createMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          haptic("success");
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        },
        onError: () => haptic("error"),
      },
    );
  };

  const handleSuicide = () => {
    if (confirm("Вы уверены? Ваша душа будет стерта из хроник навсегда.")) {
      deleteMutation.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        },
      });
    }
  };

  // -------- Character creation (mobile-first) -----------------------------
  if (!character) {
    return (
      <div className="min-h-[100dvh] w-full bg-background relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),5rem)]">
          <header className="text-center pt-2 pb-6">
            <div className="ornament-rule mb-3">&nbsp;</div>
            <h1 className="text-2xl sm:text-3xl font-serif text-primary tracking-widest uppercase">
              Создание Души
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-serif italic mt-2">
              Начертайте свое имя в хрониках Альтеры
            </p>
          </header>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80 font-serif text-sm tracking-wide uppercase">
                      Истинное Имя
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Например, Эларион..."
                        className="text-center font-serif text-lg border-primary/30 bg-surface-2 focus-visible:ring-primary/50 h-12"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-destructive font-mono text-xs" />
                  </FormItem>
                )}
              />

              {/* Race */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif text-sm uppercase tracking-widest text-foreground/80">
                    Происхождение
                  </h3>
                  {selectedRace && (
                    <Badge variant="outline" className="text-[10px] uppercase border-primary/40 text-primary">
                      Выбрано
                    </Badge>
                  )}
                </div>
                <div className="grid gap-2">
                  {lore?.races.map((race) => {
                    const isActive = selectedRace === race.key;
                    return (
                      <button
                        key={race.key}
                        type="button"
                        onClick={() => {
                          form.setValue("race", race.key, { shouldValidate: true });
                          haptic("selection");
                        }}
                        className={cn(
                          "text-left p-3 rounded-md border transition-all btn-press",
                          isActive
                            ? "bg-primary/10 border-primary shadow-[0_0_12px_rgba(212,175,55,0.18)]"
                            : "bg-surface-2 border-border/50 hover:border-primary/40",
                        )}
                        data-testid={`race-${race.key}`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-serif text-base text-primary">{race.nameRu}</span>
                          {isActive && (
                            <span className="text-[10px] font-mono text-primary/70 uppercase tracking-wider">
                              ✓
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-xs text-muted-foreground mt-1 leading-snug",
                            isActive ? "" : "line-clamp-2",
                          )}
                        >
                          {race.lore}
                        </p>
                        {isActive && Object.keys(race.bonuses).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono text-primary/80">
                            {Object.entries(race.bonuses).map(([s, v]) => (
                              <span key={s}>
                                {Number(v) >= 0 ? "+" : ""}
                                {v} {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-destructive font-mono mt-1 h-4">
                  {form.formState.errors.race?.message}
                </p>
              </section>

              {/* Class */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif text-sm uppercase tracking-widest text-foreground/80">Путь</h3>
                  {selectedClass && (
                    <Badge variant="outline" className="text-[10px] uppercase border-secondary/40 text-secondary-foreground">
                      Выбрано
                    </Badge>
                  )}
                </div>
                <div className="grid gap-2">
                  {lore?.classes.map((cls) => {
                    const isActive = selectedClass === cls.key;
                    return (
                      <button
                        key={cls.key}
                        type="button"
                        onClick={() => {
                          form.setValue("charClass", cls.key, { shouldValidate: true });
                          haptic("selection");
                        }}
                        className={cn(
                          "text-left p-3 rounded-md border transition-all btn-press",
                          isActive
                            ? "bg-secondary/15 border-secondary shadow-[0_0_12px_rgba(80,160,120,0.18)]"
                            : "bg-surface-2 border-border/50 hover:border-secondary/40",
                        )}
                        data-testid={`class-${cls.key}`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-serif text-base text-secondary-foreground">{cls.nameRu}</span>
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] uppercase border-secondary/30 text-secondary-foreground/70 shrink-0"
                          >
                            {cls.resource}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-snug">{cls.desc}</p>
                        {isActive && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono text-secondary-foreground/80">
                            {Object.entries(cls.startStats).map(([k, v]) => (
                              <span key={k}>
                                <span className="text-muted-foreground">{k}:</span> {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-destructive font-mono mt-1 h-4">
                  {form.formState.errors.charClass?.message}
                </p>
              </section>
            </form>
          </Form>

          {/* Sticky submit */}
          <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-background/95 backdrop-blur-md border-t border-primary/20">
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              size="lg"
              className="w-full h-12 font-serif text-base tracking-widest uppercase bg-primary text-primary-foreground hover:bg-primary/90 btn-press shadow-[0_0_16px_rgba(212,175,55,0.2)]"
              disabled={createMutation.isPending}
              data-testid="create-character"
            >
              {createMutation.isPending ? "Рождение..." : "Войти в Альтеру"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // -------- Active character hub (mobile-first) ---------------------------
  const currentLocation = lore?.locations.find((l) => l.id === character.locationId);

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Identity — portrait frame + name */}
        <div className="pb-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            {/* Character portrait ring — WoW unit frame style */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="shrink-0 w-12 h-12 rounded-full border-2 border-primary/40 bg-surface-2 flex items-center justify-center shadow-[0_0_12px_rgba(212,175,55,0.15)]">
                <User className="w-6 h-6 text-primary/70" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-serif text-foreground tracking-wide truncate">
                  {character.name}
                </h1>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs font-mono text-muted-foreground">
                  <Badge variant="outline" className="border-primary/30 text-primary uppercase text-[10px]">
                    {character.race}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-secondary/30 text-secondary-foreground uppercase text-[10px]"
                  >
                    {character.charClass}
                  </Badge>
                  <span>Ур. {character.level}</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSuicide}
              className="font-serif italic text-[10px] h-7 px-2 opacity-40 hover:opacity-100 hover:text-destructive"
            >
              Стереть
            </Button>
          </div>
        </div>

        {/* Vitals — segmented WoW-style bars */}
        <Card className="card-parchment bg-card/70 border-border/40">
          <CardContent className="pt-4 space-y-3">
            <Bar
              label="Здоровье"
              icon={Heart}
              value={character.hp}
              max={character.maxHp}
              color="bg-destructive"
              valueClass="text-destructive"
            />
            <Bar
              label="Мана"
              icon={Flame}
              value={character.mana}
              max={character.maxMana}
              color="bg-secondary"
              valueClass="text-secondary-foreground"
            />
            <Bar
              label="Опыт"
              icon={Star}
              value={character.experience}
              max={character.nextLevelExp}
              color="bg-primary/70"
              valueClass="text-primary"
            />
            <div className="pt-2 flex items-center justify-between border-t border-border/40">
              <span className="font-mono text-sm">
                <span className="text-muted-foreground">Серебро:</span>{" "}
                <span className="text-primary">{character.silver}</span>
              </span>
              {character.statPoints > 0 && (
                <Badge
                  className="bg-primary text-primary-foreground animate-pulse cursor-pointer btn-press"
                  onClick={() => navigate("/character")}
                  data-testid="stat-points-cta"
                >
                  +{character.statPoints} очков
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current location with prominent CTAs */}
        <Card className="card-parchment bg-card/70 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base text-primary flex items-center gap-2">
              <Scroll className="w-4 h-4 opacity-70" />
              {currentLocation?.name ?? "Заблудшая душа"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentLocation && (
              <p className="text-sm text-muted-foreground italic font-serif leading-relaxed line-clamp-3 border-l-2 border-primary/30 pl-3">
                {currentLocation.description}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  haptic("light");
                  navigate("/world");
                }}
                className="h-12 font-serif tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 btn-press shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                data-testid="home-look"
              >
                <Eye className="w-4 h-4 mr-2" /> Осмотреться
              </Button>
              <Button
                onClick={() => {
                  haptic("light");
                  navigate("/map");
                }}
                variant="outline"
                className="h-12 font-serif tracking-wide btn-press"
                data-testid="home-map"
              >
                <Map className="w-4 h-4 mr-2" /> Карта
              </Button>
              <Button
                onClick={() => {
                  haptic("light");
                  navigate("/battle");
                }}
                variant="outline"
                className="h-11 font-serif tracking-wide border-destructive/40 text-destructive hover:bg-destructive/10 btn-press"
                data-testid="home-battle"
              >
                <Sword className="w-4 h-4 mr-2" /> Битва
              </Button>
              <Button
                onClick={() => {
                  haptic("light");
                  navigate("/quests");
                }}
                variant="outline"
                className="h-11 font-serif tracking-wide btn-press"
                data-testid="home-quests"
              >
                <Scroll className="w-4 h-4 mr-2" /> Дела
              </Button>
              <Button
                onClick={() => {
                  haptic("light");
                  navigate("/achievements");
                }}
                variant="outline"
                className="h-11 font-serif tracking-wide btn-press"
                data-testid="home-achievements"
              >
                <Trophy className="w-4 h-4 mr-2" /> Награды
              </Button>
              <Button
                onClick={() => {
                  haptic("light");
                  navigate("/ledger");
                }}
                variant="outline"
                className="h-11 font-serif tracking-wide btn-press"
                data-testid="home-ledger"
              >
                <ScrollText className="w-4 h-4 mr-2" /> Хроника
              </Button>
              <Button
                onClick={() => {
                  haptic("light");
                  navigate("/referral");
                }}
                variant="outline"
                className="col-span-2 h-10 font-serif tracking-wide btn-press"
                data-testid="home-referral"
              >
                <Gift className="w-4 h-4 mr-2" /> Пригласить друга
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hint */}
        <p className="text-[11px] text-muted-foreground/60 font-serif italic text-center px-4">
          <Sparkles className="inline h-3 w-3 mr-1 opacity-60" />
          Открывай новые места первым — получишь бафф «Аура открытия».
        </p>
      </motion.div>
    </Layout>
  );
}

function Bar({
  label,
  icon: Icon,
  value,
  max,
  color,
  valueClass,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  max: number;
  color: string;
  valueClass: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className={valueClass}>
          {value} / {max}
        </span>
      </div>
      <div className="h-2 w-full bg-black/50 rounded-sm overflow-hidden border border-white/5 bar-segmented">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
          className={cn("h-full rounded-sm", color)}
          style={{ willChange: "transform" }}
        />
      </div>
    </div>
  );
}
