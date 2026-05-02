import { useQuery } from "@tanstack/react-query";
import { useGetCharacter } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listAchievements, type AchievementDTO } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/realtime";
import { Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function Achievements() {
  const { data: characterData } = useGetCharacter();
  const character = characterData?.character;

  const { data: items, refetch } = useQuery({
    queryKey: ["achievements"],
    queryFn: listAchievements,
    enabled: !!character,
  });

  useRealtimeEvents((ev) => {
    if (ev.type === "location_discovered") void refetch();
  });

  if (!character) {
    return (
      <Layout title="Награды">
        <div className="flex-1 flex items-center justify-center text-muted-foreground font-serif italic">
          Сначала создай персонажа.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Награды" subtitle="Свидетельства твоих деяний в Альтере">
      <div className="grid gap-3">
        {(items ?? []).map((a) => (
          <AchievementRow key={a.key} a={a} />
        ))}
      </div>
    </Layout>
  );
}

function AchievementRow({ a }: { a: AchievementDTO }) {
  const buffActive = a.activeBuffExpiresAt && new Date(a.activeBuffExpiresAt).getTime() > Date.now();
  return (
    <Card
      data-testid={`achievement-${a.key}`}
      className={cn(
        "border bg-card/70 backdrop-blur card-parchment",
        a.earned ? "border-primary/40" : "border-border/40 opacity-70",
      )}
    >
      <CardContent className="p-3 flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full border flex items-center justify-center text-lg",
            a.earned ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border/60 text-muted-foreground",
          )}
        >
          {a.icon || (a.earned ? <Trophy className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-serif text-base text-foreground">{a.title}</h3>
            {a.count > 1 && (
              <Badge variant="outline" className="text-[10px] uppercase">x{a.count}</Badge>
            )}
            {buffActive && (
              <Badge variant="outline" className="text-[10px] uppercase border-primary/40 text-primary">
                Бафф активен
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{a.description}</p>
          {a.targets.length > 0 && (
            <p className="text-[11px] mt-2 text-muted-foreground">
              Получено: {new Date(a.targets[0]?.earnedAt ?? "").toLocaleString("ru-RU")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
