import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetCharacter, getGetCharacterQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scroll, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { listQuests, acceptQuest, completeQuest, type QuestDTO } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/realtime";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

export function Quests() {
  const qc = useQueryClient();
  const { data: characterData } = useGetCharacter();
  const character = characterData?.character;

  // P7 — Quests must always re-fetch when the tab is opened so newly-unlocked
  // social quests, repaired relations, and freshly accepted/completed objectives
  // appear immediately.
  const { data: quests, refetch } = useQuery({
    queryKey: ["quests"],
    queryFn: listQuests,
    enabled: !!character,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useRealtimeEvents((ev) => {
    if (ev.type === "quest_completed" || ev.type === "quest_accepted") void refetch();
  });

  const accept = useMutation({
    mutationFn: (id: string) => acceptQuest(id),
    onSuccess: () => {
      haptic("success");
      qc.invalidateQueries({ queryKey: ["quests"] });
    },
    onError: () => haptic("error"),
  });

  const complete = useMutation({
    mutationFn: (id: string) => completeQuest(id),
    onSuccess: () => {
      haptic("success");
      qc.invalidateQueries({ queryKey: ["quests"] });
      qc.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
    },
    onError: () => haptic("error"),
  });

  if (!character) {
    return (
      <Layout title="Дела">
        <div className="flex-1 flex items-center justify-center text-muted-foreground font-serif italic">
          Сначала создай персонажа.
        </div>
      </Layout>
    );
  }

  const grouped = {
    active: (quests ?? []).filter((q) => q.status === "active"),
    available: (quests ?? []).filter((q) => q.status === "available"),
    completed: (quests ?? []).filter((q) => q.status === "completed"),
  };

  return (
    <Layout title="Дела" subtitle="Стартовые задания знакомят тебя с миром">
      {grouped.active.length > 0 && (
        <Section title="Активные">
          {grouped.active.map((q) => (
            <QuestCard key={q.id} q={q} action="complete" onAction={() => complete.mutate(q.id)} pending={complete.isPending} />
          ))}
        </Section>
      )}
      {grouped.available.length > 0 && (
        <Section title="Доступные">
          {grouped.available.map((q) => (
            <QuestCard key={q.id} q={q} action="accept" onAction={() => accept.mutate(q.id)} pending={accept.isPending} />
          ))}
        </Section>
      )}
      {grouped.completed.length > 0 && (
        <Section title="Завершённые">
          {grouped.completed.map((q) => (
            <QuestCard key={q.id} q={q} action={null} />
          ))}
        </Section>
      )}
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-xs font-serif uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
        <Scroll className="h-3 w-3" />
        {title}
      </h2>
      <div className="grid gap-2.5">{children}</div>
    </div>
  );
}

function QuestCard({
  q,
  action,
  onAction,
  pending,
}: {
  q: QuestDTO;
  action: "accept" | "complete" | null;
  onAction?: () => void;
  pending?: boolean;
}) {
  const isCompleted = q.status === "completed";
  return (
    <Card
      data-testid={`quest-${q.id}`}
      className={cn(
        "border bg-card/70 backdrop-blur",
        isCompleted ? "border-border/40 opacity-70" : q.status === "active" ? "border-primary/40" : "border-border/50",
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {isCompleted ? <CheckCircle2 className="h-4 w-4 text-primary mt-1" /> : <Circle className="h-4 w-4 text-muted-foreground mt-1" />}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-base text-foreground">{q.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-snug">{q.description}</p>
            {q.objectives.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {q.objectives.map((obj, i) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-2">
                    <span className="text-primary/60">▸</span>
                    {obj.text}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {q.rewards.silver != null && (
                <Badge variant="outline" className="text-[10px] uppercase">⌬ {q.rewards.silver}</Badge>
              )}
              {q.rewards.exp != null && (
                <Badge variant="outline" className="text-[10px] uppercase border-secondary/40">+{q.rewards.exp} опыта</Badge>
              )}
              {q.rewards.reputation && Object.entries(q.rewards.reputation).map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-[10px] uppercase border-primary/30 text-primary/80">
                  <Sparkles className="h-2.5 w-2.5 mr-1" /> {k} {v > 0 ? `+${v}` : v}
                </Badge>
              ))}
            </div>
            {action && (
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={onAction}
                disabled={pending}
                data-testid={`quest-action-${action}`}
              >
                {action === "accept" ? "Принять" : "Завершить и получить награду"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
