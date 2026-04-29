import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ShieldAlert,
  RefreshCcw,
  Play,
  StopCircle,
  Wand2,
  Save,
  LogOut,
  KeyRound,
  Users,
  Map as MapIcon,
  Clock,
  ScrollText,
  Activity,
} from "lucide-react";
import {
  adminGetOverview,
  adminListNpcs,
  adminPatchNpc,
  adminListLocations,
  adminGenerateLocation,
  adminListEvents,
  adminEndEvent,
  adminListCycles,
  adminRunCycle,
  adminListPlayers,
  adminModeratePlayer,
  adminListAuditLog,
  type AdminNpcRow,
  type AdminPlayerRow,
} from "@/lib/api";

const TOKEN_KEY = "altera_admin_token";

type Section = "overview" | "npcs" | "locations" | "events" | "cycles" | "players" | "audit";

export function Admin() {
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  });
  const [section, setSection] = useState<Section>("overview");

  const handleLogin = (t: string) => {
    sessionStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  };
  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
  };

  if (!token) {
    return (
      <Layout title="Палата хранителя" hideNav>
        <TokenGate onSubmit={handleLogin} />
      </Layout>
    );
  }

  return (
    <Layout title="Палата хранителя" subtitle="Скрытый зал управления Альтерой" hideNav>
      <div className="flex items-center justify-between mb-3">
        <SectionTabs section={section} setSection={setSection} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground"
          data-testid="admin-logout"
        >
          <LogOut className="h-3.5 w-3.5 mr-1" /> Выйти
        </Button>
      </div>
      <div className="flex-1">
        {section === "overview" && <OverviewPane token={token} onTokenInvalid={handleLogout} />}
        {section === "npcs" && <NpcsPane token={token} />}
        {section === "locations" && <LocationsPane token={token} />}
        {section === "events" && <EventsPane token={token} />}
        {section === "cycles" && <CyclesPane token={token} />}
        {section === "players" && <PlayersPane token={token} />}
        {section === "audit" && <AuditPane token={token} />}
      </div>
    </Layout>
  );
}

function SectionTabs({
  section,
  setSection,
}: {
  section: Section;
  setSection: (s: Section) => void;
}) {
  const items: { key: Section; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "overview", label: "Свод", Icon: Activity },
    { key: "npcs", label: "NPC", Icon: Users },
    { key: "locations", label: "Места", Icon: MapIcon },
    { key: "events", label: "События", Icon: ShieldAlert },
    { key: "cycles", label: "Циклы AI", Icon: Clock },
    { key: "players", label: "Игроки", Icon: Users },
    { key: "audit", label: "Журнал", Icon: ScrollText },
  ];
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-2 px-2">
      {items.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => setSection(key)}
          className={cn(
            "flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-wider font-serif",
            section === key
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-background/40 border-border/50 text-muted-foreground hover:text-foreground",
          )}
          data-testid={`tab-${key}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function TokenGate({ onSubmit }: { onSubmit: (t: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm bg-card/80 border-primary/20">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="h-5 w-5" />
            <h2 className="font-serif text-lg text-fantasy-strong">Введи ключ хранителя</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Палата охраняется сторожем. Ключ совпадает с переменной <code>ADMIN_TOKEN</code> на сервере.
            Никаких сессий — токен хранится только в этой вкладке браузера.
          </p>
          <Input
            type="password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="ADMIN_TOKEN"
            data-testid="admin-token-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && val.trim().length >= 8) onSubmit(val.trim());
            }}
          />
          <Button
            type="button"
            className="w-full"
            disabled={val.trim().length < 8}
            onClick={() => onSubmit(val.trim())}
            data-testid="admin-token-submit"
          >
            Войти
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Panes ─────────────────────────────────────────────────────────────────
function OverviewPane({ token, onTokenInvalid }: { token: string; onTokenInvalid: () => void }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["admin-overview", token],
    queryFn: () => adminGetOverview(token),
    retry: false,
  });

  useEffect(() => {
    if (error && /401|администратор/i.test((error as Error).message)) onTokenInvalid();
  }, [error, onTokenInvalid]);

  if (isLoading) return <PaneLoading />;
  if (error) return <PaneError error={error as Error} onRetry={() => refetch()} />;
  if (!data) return null;

  const stats: { label: string; value: number; tone?: "warn" | "ok" }[] = [
    { label: "Игроков", value: data.characters },
    { label: "NPC", value: data.npcs },
    { label: "Локаций", value: data.locations },
    { label: "Событий мира", value: data.activeEvents, tone: data.activeEvents > 0 ? "ok" : undefined },
    { label: "Циклов AI", value: data.aiCycles },
    { label: "Поручений AI", value: data.generatedQuests },
    { label: "Забаненных", value: data.bannedPlayers, tone: data.bannedPlayers > 0 ? "warn" : undefined },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {stats.map((s) => (
        <Card key={s.label} className="bg-card/70 border-border/40">
          <CardContent className="p-3 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p
              className={cn(
                "font-serif text-2xl text-fantasy-strong",
                s.tone === "warn" && "text-destructive",
                s.tone === "ok" && "text-primary",
              )}
              data-testid={`stat-${s.label}`}
            >
              {s.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NpcsPane({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-npcs", token],
    queryFn: () => adminListNpcs(token),
    retry: false,
  });
  const [editing, setEditing] = useState<AdminNpcRow | null>(null);

  const patch = useMutation({
    mutationFn: (p: { id: string; body: Parameters<typeof adminPatchNpc>[2] }) =>
      adminPatchNpc(token, p.id, p.body),
    onSuccess: () => {
      toast({ title: "NPC сохранён" });
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin-npcs", token] });
    },
    onError: (e: Error) => toast({ title: "Не сохранилось", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <PaneLoading />;
  if (error) return <PaneError error={error as Error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-2">
      {(data ?? []).map((n) => (
        <Card key={n.id} className="bg-card/70 border-border/40">
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-serif text-base text-foreground truncate">{n.name}</h4>
                  <Badge variant="outline" className="text-[10px] uppercase no-shadow">{n.tier}</Badge>
                  <Badge variant="outline" className="text-[10px] uppercase no-shadow">{n.role}</Badge>
                  {n.isHostile && (
                    <Badge variant="outline" className="text-[10px] uppercase no-shadow border-destructive/40 text-destructive">
                      агрессив.
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.shortProfile}</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">
                  Характер: <span className="text-foreground/80">{n.personality}</span>
                  {n.motives && (
                    <>
                      <br />Мотивы: <span className="text-foreground/80">{n.motives}</span>
                    </>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(n)}
                data-testid={`npc-edit-${n.id}`}
              >
                Править
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {editing && (
        <NpcEditor
          npc={editing}
          isSaving={patch.isPending}
          onClose={() => setEditing(null)}
          onSave={(body) => patch.mutate({ id: editing.id, body })}
        />
      )}
    </div>
  );
}

function NpcEditor({
  npc,
  isSaving,
  onClose,
  onSave,
}: {
  npc: AdminNpcRow;
  isSaving: boolean;
  onClose: () => void;
  onSave: (body: Parameters<typeof adminPatchNpc>[2]) => void;
}) {
  const [shortProfile, setShortProfile] = useState(npc.shortProfile);
  const [voiceStyle, setVoiceStyle] = useState(npc.voiceStyle);
  const [personality, setPersonality] = useState(npc.personality);
  const [motives, setMotives] = useState(npc.motives ?? "");
  const [isHostile, setIsHostile] = useState(npc.isHostile);
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-end sm:items-center justify-center p-2">
      <Card className="w-full sm:max-w-lg bg-card border-primary/30 max-h-[90dvh] overflow-y-auto">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-serif text-primary text-lg text-fantasy-strong">{npc.name}</h3>
          <Field label="Краткий профиль">
            <Textarea value={shortProfile} onChange={(e) => setShortProfile(e.target.value)} rows={2} />
          </Field>
          <Field label="Стиль речи (как говорит)">
            <Textarea value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)} rows={2} />
          </Field>
          <Field label="Характер (одной фразой)">
            <Input value={personality} onChange={(e) => setPersonality(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Мотивы">
            <Textarea value={motives} onChange={(e) => setMotives(e.target.value)} rows={2} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isHostile}
              onChange={(e) => setIsHostile(e.target.checked)}
            />
            Агрессивен по умолчанию
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onSave({
                  shortProfile,
                  voiceStyle,
                  personality,
                  motives: motives || undefined,
                  isHostile,
                })
              }
              className="flex-1"
              data-testid="npc-save"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" /> Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function LocationsPane({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-locations", token],
    queryFn: () => adminListLocations(token),
    retry: false,
  });
  const [parent, setParent] = useState<string>("");
  const [hint, setHint] = useState("");

  const gen = useMutation({
    mutationFn: () => adminGenerateLocation(token, parent, hint || undefined),
    onSuccess: (r) => {
      toast({ title: `Создано: ${r.location.name}`, description: `via ${r.via}` });
      setHint("");
      queryClient.invalidateQueries({ queryKey: ["admin-locations", token] });
    },
    onError: (e: Error) => toast({ title: "Не получилось", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <PaneLoading />;
  if (error) return <PaneError error={error as Error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-3">
      <Card className="bg-card/70 border-primary/20">
        <CardContent className="p-3 space-y-2">
          <h4 className="font-serif text-sm text-primary text-fantasy-strong inline-flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> Расширить мир
          </h4>
          <select
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            className="w-full bg-background border border-border/60 rounded px-2 py-2 text-sm"
            data-testid="admin-loc-parent"
          >
            <option value="">— выбрать родителя —</option>
            {(data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.region})
              </option>
            ))}
          </select>
          <Input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Подсказка для AI (опционально)"
            maxLength={80}
          />
          <Button
            type="button"
            disabled={!parent || gen.isPending}
            onClick={() => gen.mutate()}
            className="w-full"
            data-testid="admin-loc-generate"
          >
            {gen.isPending ? "Шёпот мира…" : "Создать новую локацию"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {(data ?? []).map((l) => (
          <Card key={l.id} className="bg-card/60 border-border/40">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-serif text-sm text-foreground truncate">{l.name}</h4>
                <Badge variant="outline" className="text-[10px] uppercase no-shadow">{l.type}</Badge>
                {l.isFrontier && <Badge variant="outline" className="text-[10px] uppercase no-shadow border-primary/40 text-primary">фронт.</Badge>}
                {l.isGenerated && <Badge variant="outline" className="text-[10px] uppercase no-shadow border-secondary/40">AI</Badge>}
                {l.isStarter && <Badge variant="outline" className="text-[10px] uppercase no-shadow">старт</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{l.region} · координаты {l.coordX},{l.coordY}</p>
              <p className="text-xs text-foreground/80 mt-1 line-clamp-2">{l.description}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Связи: <span className="text-foreground/80">{l.connectedTo.join(", ") || "—"}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EventsPane({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-events", token],
    queryFn: () => adminListEvents(token),
    retry: false,
    refetchInterval: 30_000,
  });
  const end = useMutation({
    mutationFn: (id: number) => adminEndEvent(token, id),
    onSuccess: () => {
      toast({ title: "Событие закрыто" });
      queryClient.invalidateQueries({ queryKey: ["admin-events", token] });
    },
    onError: (e: Error) => toast({ title: "Не получилось", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <PaneLoading />;
  if (error) return <PaneError error={error as Error} onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground italic text-center py-8">Активных событий нет.</p>;
  }
  return (
    <div className="space-y-2">
      {data.map((ev) => (
        <Card key={ev.id} className="bg-card/70 border-border/40">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert
                className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  ev.severity >= 3 ? "text-destructive" : ev.severity === 2 ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-serif text-sm text-foreground">{ev.title}</h4>
                <p className="text-xs text-muted-foreground">
                  {ev.eventKind} · ур.&nbsp;{ev.severity} · истекает {new Date(ev.expiresAt).toLocaleString("ru-RU")}
                </p>
                <p className="text-sm text-foreground/90 mt-1">{ev.description}</p>
                {ev.affectedLocationsJson && ev.affectedLocationsJson.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Места: <span className="text-foreground/80">{ev.affectedLocationsJson.join(", ")}</span>
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => end.mutate(ev.id)}
                disabled={end.isPending}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                data-testid={`event-end-${ev.id}`}
              >
                <StopCircle className="h-3.5 w-3.5 mr-1" /> Завершить
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CyclesPane({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-cycles", token],
    queryFn: () => adminListCycles(token),
    retry: false,
    refetchInterval: 30_000,
  });
  const run = useMutation({
    mutationFn: () => adminRunCycle(token),
    onSuccess: () => {
      toast({ title: "Цикл запущен" });
      queryClient.invalidateQueries({ queryKey: ["admin-cycles", token] });
    },
    onError: (e: Error) => toast({ title: "Цикл провалился", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <PaneLoading />;
  if (error) return <PaneError error={error as Error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={() => run.mutate()}
        disabled={run.isPending}
        className="w-full"
        data-testid="cycle-run"
      >
        <Play className="h-3.5 w-3.5 mr-1.5" /> {run.isPending ? "Master AI думает…" : "Запустить цикл сейчас"}
      </Button>
      <div className="space-y-2">
        {(data ?? []).map((c) => (
          <Card key={c.id} className="bg-card/60 border-border/40">
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-foreground">#{c.id}</span>
                <Badge variant="outline" className="text-[10px] uppercase no-shadow">{c.cycleKind}</Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase no-shadow",
                    c.status === "ok" && "border-primary/40 text-primary",
                    c.status === "fail" && "border-destructive/40 text-destructive",
                  )}
                >
                  {c.status}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {new Date(c.startedAt).toLocaleString("ru-RU")}
                {c.finishedAt && <> → {new Date(c.finishedAt).toLocaleTimeString("ru-RU")}</>}
              </p>
              {c.errorText && (
                <p className="text-[11px] text-destructive">{c.errorText}</p>
              )}
              {!!c.notesJson && (
                <pre className="text-[10px] font-mono text-muted-foreground bg-background/40 rounded p-2 overflow-x-auto no-shadow">
                  {String(JSON.stringify(c.notesJson, null, 2))}
                </pre>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PlayersPane({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-players", token],
    queryFn: () => adminListPlayers(token),
    retry: false,
  });
  const moderate = useMutation({
    mutationFn: (p: { id: number; body: Parameters<typeof adminModeratePlayer>[2] }) =>
      adminModeratePlayer(token, p.id, p.body),
    onSuccess: () => {
      toast({ title: "Сохранено" });
      queryClient.invalidateQueries({ queryKey: ["admin-players", token] });
    },
    onError: (e: Error) => toast({ title: "Не получилось", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <PaneLoading />;
  if (error) return <PaneError error={error as Error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-2">
      {(data ?? []).map((p) => (
        <PlayerRow
          key={p.id}
          player={p}
          isPending={moderate.isPending}
          onModerate={(body) => moderate.mutate({ id: p.id, body })}
        />
      ))}
    </div>
  );
}

function PlayerRow({
  player,
  isPending,
  onModerate,
}: {
  player: AdminPlayerRow;
  isPending: boolean;
  onModerate: (body: Parameters<typeof adminModeratePlayer>[2]) => void;
}) {
  const banned = !!player.moderation?.isBanned;
  const muted = !!player.moderation?.isMuted;
  return (
    <Card className="bg-card/70 border-border/40">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-serif text-sm text-foreground truncate">{player.name}</h4>
              <Badge variant="outline" className="text-[10px] uppercase no-shadow">ур. {player.level}</Badge>
              {banned && <Badge variant="outline" className="text-[10px] uppercase no-shadow border-destructive/40 text-destructive">бан</Badge>}
              {muted && <Badge variant="outline" className="text-[10px] uppercase no-shadow border-secondary/40">молч.</Badge>}
              {(player.moderation?.warnCount ?? 0) > 0 && (
                <Badge variant="outline" className="text-[10px] uppercase no-shadow">⚠ {player.moderation?.warnCount}</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              tg:{String(player.telegramId ?? "—")}{player.telegramUsername ? ` · @${player.telegramUsername}` : ""}
            </p>
            {player.moderation?.reason && (
              <p className="text-[11px] text-destructive italic mt-0.5">{player.moderation.reason}</p>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => onModerate({ warnDelta: 1, reason: "warn" })}
              data-testid={`warn-${player.id}`}
            >
              ⚠
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => onModerate({ isMuted: !muted })}
              data-testid={`mute-${player.id}`}
            >
              {muted ? "Размолч." : "Молч."}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => onModerate({ isBanned: !banned, reason: banned ? null : "admin ban" })}
              className="border-destructive/40 text-destructive"
              data-testid={`ban-${player.id}`}
            >
              {banned ? "Снять бан" : "Бан"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditPane({ token }: { token: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-audit", token],
    queryFn: () => adminListAuditLog(token),
    retry: false,
    refetchInterval: 60_000,
  });
  if (isLoading) return <PaneLoading />;
  if (error) return <PaneError error={error as Error} onRetry={() => refetch()} />;
  return (
    <div className="space-y-1.5">
      {(data ?? []).map((row) => (
        <Card key={row.id} className="bg-card/60 border-border/40">
          <CardContent className="p-2.5">
            <p className="text-[11px] font-mono text-muted-foreground">
              {new Date(row.createdAt).toLocaleString("ru-RU")} · …{row.tokenLast6}
            </p>
            <p className="text-sm text-foreground">
              <span className="text-primary font-mono">{row.action}</span>
              {row.targetKind && (
                <>
                  {" "}<span className="text-muted-foreground">{row.targetKind}</span>
                  {row.targetId && <span className="text-foreground/80"> #{row.targetId}</span>}
                </>
              )}
            </p>
            {!!row.detailsJson && Object.keys(row.detailsJson as object).length > 0 && (
              <pre className="text-[10px] font-mono text-muted-foreground bg-background/40 rounded p-2 mt-1 overflow-x-auto no-shadow">
                {String(JSON.stringify(row.detailsJson, null, 2))}
              </pre>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PaneLoading() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
      <RefreshCcw className="h-4 w-4 animate-spin mr-2" /> Загружаю…
    </div>
  );
}

function PaneError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-sm">
      <p className="text-destructive text-center">{error.message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Повторить
      </Button>
    </div>
  );
}
