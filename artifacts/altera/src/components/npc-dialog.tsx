import { useEffect, useRef, useState } from "react";
import {
  useGetNpc,
  useGetDialogue,
  useSendDialogue,
  getGetDialogueQueryKey,
  getGetNpcQueryKey,
  getListNpcsQueryKey,
  getGetCharacterQueryKey,
  SendDialogueRequestTone,
} from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Sword,
  Send,
  Sparkles,
  MessageCircle,
  Skull,
  Store,
  Coins,
  X,
} from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import {
  buyFromNpc,
  getNpcShop,
  generateQuestFromNpc,
  updateGeneratedQuestStatus,
  type GeneratedQuestDTO,
  type ShopItemDTO,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ScrollText } from "lucide-react";

const TONES: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { key: "friendly", label: "Дружелюбно", icon: Heart, tone: "friendly" },
  { key: "neutral", label: "Нейтрально", icon: MessageCircle, tone: "neutral" },
  { key: "persuade", label: "Убедить", icon: Sparkles, tone: "persuade" },
  { key: "threat", label: "Угрожать", icon: Sword, tone: "threat" },
  { key: "insult", label: "Оскорбить", icon: Skull, tone: "insult" },
];

const MERCHANT_ROLES = new Set(["merchant", "smith", "tavern_keeper"]);

export interface NpcDialogProps {
  npcId: string | null;
  open: boolean;
  onClose: () => void;
}

type Tab = "talk" | "shop";

export function NpcDialog({ npcId, open, onClose }: NpcDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tone, setTone] = useState("neutral");
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("talk");
  const [pendingQuest, setPendingQuest] = useState<GeneratedQuestDTO | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // P3 — "Спросить про дело" — ask the NPC for an AI-generated quest.
  const askQuest = useMutation({
    mutationFn: () => generateQuestFromNpc(npcId!),
    onSuccess: (q) => {
      haptic("success");
      setPendingQuest(q);
    },
    onError: (e: Error) => {
      haptic("error");
      toast({ title: "Дело не нашлось", description: e.message, variant: "destructive" });
    },
  });

  const acceptQuest = useMutation({
    mutationFn: (id: number) => updateGeneratedQuestStatus(id, "accepted"),
    onSuccess: () => {
      haptic("success");
      toast({ title: "Дело принято", description: "Загляни во вкладку «Дела»." });
      setPendingQuest(null);
      queryClient.invalidateQueries({ queryKey: ["generated-quests"] });
    },
    onError: (e: Error) => toast({ title: "Не получилось", description: e.message, variant: "destructive" }),
  });

  const declineQuest = useMutation({
    mutationFn: (id: number) => updateGeneratedQuestStatus(id, "declined"),
    onSuccess: () => {
      setPendingQuest(null);
      queryClient.invalidateQueries({ queryKey: ["generated-quests"] });
    },
  });

  const { data: npc } = useGetNpc(npcId ?? "", { query: { enabled: !!npcId && open, queryKey: getGetNpcQueryKey(npcId ?? "") } });
  const { data: history } = useGetDialogue(npcId ?? "", {
    query: { enabled: !!npcId && open && tab === "talk", refetchOnWindowFocus: false, queryKey: getGetDialogueQueryKey(npcId ?? "") },
  });
  const send = useSendDialogue();

  const isMerchant = !!npc?.role && MERCHANT_ROLES.has(npc.role);

  // Reset tab whenever a new NPC is opened
  useEffect(() => {
    setTab("talk");
    setText("");
    setPendingQuest(null);
  }, [npcId]);

  useEffect(() => {
    if (history && scrollerRef.current && tab === "talk") {
      requestAnimationFrame(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [history, tab]);

  const handleSend = () => {
    if (!npcId || !text.trim() || send.isPending) return;
    const playerLine = text.trim();
    setText("");
    haptic("light");
    send.mutate(
      { npcId, data: { content: playerLine, tone: tone as SendDialogueRequestTone } },
      {
        onSuccess: (data) => {
          haptic("success");
          queryClient.invalidateQueries({ queryKey: getGetDialogueQueryKey(npcId) });
          queryClient.invalidateQueries({ queryKey: getGetNpcQueryKey(npcId) });
          queryClient.invalidateQueries({ queryKey: getListNpcsQueryKey({ locationId: npc?.locationId }) });
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          if ((data?.repDelta ?? 0) < -10) haptic("warning");
          else if ((data?.repDelta ?? 0) >= 5) haptic("success");
        },
        onError: () => haptic("error"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "p-0 gap-0 bg-card border-primary/20 flex flex-col overflow-hidden card-parchment",
          // Mobile: full-screen sheet. Desktop: classic centered dialog.
          "w-screen h-[100dvh] max-w-none rounded-none top-0 left-0 translate-x-0 translate-y-0",
          "sm:w-[95vw] sm:max-w-md sm:h-[85vh] sm:rounded-md sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
        )}
      >
        <DialogHeader className="px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 border-b border-border/50 flex-shrink-0">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <DialogTitle className="font-serif text-primary text-lg tracking-wide flex items-center gap-2 flex-wrap">
                <span className="truncate">{npc?.name ?? "Собеседник"}</span>
                {npc?.title && (
                  <Badge variant="outline" className="text-[10px] uppercase shrink-0 border-primary/30 text-primary">
                    {npc.title}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Отношение: <span className="text-foreground">{npc?.repName ?? "Нейтральное"}</span>
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="shrink-0 -mt-1 -mr-1 h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 btn-press"
              data-testid="dialog-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isMerchant && (
            <div className="mt-3 flex gap-1.5 bg-surface-2 rounded-md p-1 border border-border/40">
              <button
                type="button"
                onClick={() => {
                  setTab("talk");
                  haptic("selection");
                }}
                data-testid="tab-talk"
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs uppercase tracking-wider font-serif",
                  tab === "talk"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" /> Разговор
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("shop");
                  haptic("selection");
                }}
                data-testid="tab-shop"
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs uppercase tracking-wider font-serif",
                  tab === "shop"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Store className="h-3.5 w-3.5" /> Лавка
              </button>
            </div>
          )}
        </DialogHeader>

        {tab === "talk" ? (
          <>
            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {npc?.shortProfile && history?.length === 0 && (
                <p className="text-sm text-muted-foreground font-serif italic leading-relaxed border-l-2 border-primary/30 pl-3">
                  {npc.shortProfile}
                </p>
              )}
              {(history ?? []).map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-md px-3 py-2 text-sm leading-relaxed",
                    m.role === "player"
                      ? "ml-auto bg-primary/10 border border-primary/30 text-foreground"
                      : "mr-auto bg-surface-2 border border-border/50 text-foreground/90",
                  )}
                  data-testid={`dialogue-${m.role}`}
                >
                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    {m.role === "player" ? "Ты" : npc?.name ?? "Он"}
                  </span>
                  <span>{m.content}</span>
                </div>
              ))}
              {send.isPending && (
                <div className="mr-auto bg-surface-2 border border-border/50 rounded-md px-3 py-2 text-xs text-muted-foreground italic max-w-[85%] inline-flex items-center gap-1.5">
                  <span className="typing-dot-1 inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                  <span className="typing-dot-2 inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                  <span className="typing-dot-3 inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                </div>
              )}
            </div>

            {/* P3 — pending quest preview */}
            {pendingQuest && (
              <div className="border-t border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-primary" />
                  <h4 className="font-serif text-sm text-primary text-fantasy-strong">{pendingQuest.title}</h4>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">{pendingQuest.description}</p>
                <p className="text-[11px] text-muted-foreground italic">{pendingQuest.objective}</p>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-primary">{pendingQuest.rewardSilver}⌬</span>
                  <span className="text-secondary-foreground">+{pendingQuest.rewardExp} оп.</span>
                  {pendingQuest.rewardRepDelta !== 0 && (
                    <span className={pendingQuest.rewardRepDelta > 0 ? "text-primary/80" : "text-destructive/80"}>
                      {pendingQuest.rewardRepDelta > 0 ? "+" : ""}
                      {pendingQuest.rewardRepDelta} реп.
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 h-9"
                    disabled={acceptQuest.isPending}
                    onClick={() => acceptQuest.mutate(pendingQuest.id)}
                    data-testid="quest-accept"
                  >
                    Берусь
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-9"
                    disabled={declineQuest.isPending}
                    onClick={() => declineQuest.mutate(pendingQuest.id)}
                    data-testid="quest-decline"
                  >
                    Откажусь
                  </Button>
                </div>
              </div>
            )}

            <div className="border-t border-border/50 p-3 flex-shrink-0 space-y-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
              {/* P3 — quick "ask about a job" button */}
              {!pendingQuest && npcId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 border-primary/30 text-primary hover:bg-primary/10"
                  disabled={askQuest.isPending}
                  onClick={() => {
                    haptic("medium");
                    askQuest.mutate();
                  }}
                  data-testid="ask-quest"
                >
                  <ScrollText className="h-3.5 w-3.5 mr-1.5" />
                  {askQuest.isPending ? "Думает над поручением…" : "Спросить про дело"}
                </Button>
              )}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                {TONES.map((t) => {
                  const Icon = t.icon;
                  const isActive = tone === t.tone;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        setTone(t.tone);
                        haptic("selection");
                      }}
                      className={cn(
                        "flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border text-[11px] uppercase tracking-wider transition-all",
                        isActive
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-background border-border/60 text-muted-foreground hover:text-foreground",
                      )}
                      data-testid={`tone-${t.tone}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Что скажешь ${npc?.name ?? ""}?`}
                  rows={2}
                  className="resize-none text-base sm:text-sm min-h-[44px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSend}
                  disabled={!text.trim() || send.isPending}
                  className="h-11 w-11 shrink-0"
                  data-testid="dialogue-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <ShopPanel npcId={npcId} onPurchase={() => {
            queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          }} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Shop Panel ------------------------------------------------------------

function ShopPanel({
  npcId,
  onPurchase,
}: {
  npcId: string | null;
  onPurchase: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["npc-shop", npcId],
    queryFn: () => getNpcShop(npcId!),
    enabled: !!npcId,
    staleTime: 10_000,
  });

  const buy = useMutation({
    mutationFn: (catalogKey: string) => buyFromNpc(npcId!, catalogKey),
    onSuccess: () => {
      haptic("success");
      void refetch();
      onPurchase();
      queryClient.invalidateQueries({ queryKey: ["npc-shop", npcId] });
    },
    onError: () => haptic("error"),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Лавка просыпается...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm italic px-6 text-center">
        {(error as Error)?.message ?? "Не удалось открыть лавку"}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 bg-surface-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground italic font-serif line-clamp-2 flex-1 min-w-0">
          {data.greeting}
        </p>
        <span className="shrink-0 inline-flex items-center gap-1 text-primary font-mono text-sm">
          <Coins className="h-3.5 w-3.5" /> {data.silver}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {data.items.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            Прилавок пуст. Загляни в другой раз.
          </p>
        )}
        {data.items.map((item) => (
          <ShopRow
            key={item.catalogKey}
            item={item}
            silver={data.silver}
            disabled={buy.isPending}
            onBuy={() => {
              haptic("medium");
              buy.mutate(item.catalogKey);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ShopRow({
  item,
  silver,
  disabled,
  onBuy,
}: {
  item: ShopItemDTO;
  silver: number;
  disabled: boolean;
  onBuy: () => void;
}) {
  const canAfford = silver >= item.price;
  return (
    <div
      className="rounded-md border border-border/40 bg-surface-2 p-3"
      data-testid={`shop-item-${item.catalogKey}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-serif text-base text-foreground truncate">{item.name}</h4>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase shrink-0",
                item.rarity === "uncommon" && "border-secondary/50 text-secondary-foreground",
                item.rarity === "rare" && "border-primary/50 text-primary",
              )}
            >
              {item.rarity === "common" ? "Простой" : item.rarity === "uncommon" ? "Редкий" : "Эпич."}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">{item.description}</p>
          {Object.keys(item.stats).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-mono text-primary/80">
              {Object.entries(item.stats).map(([k, v]) => (
                <span key={k}>
                  +{v} {k}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!canAfford || disabled}
          onClick={onBuy}
          data-testid={`buy-${item.catalogKey}`}
          className={cn(
            "shrink-0 font-mono text-xs h-9 min-w-[72px]",
            canAfford
              ? "border-primary/40 text-primary hover:bg-primary/10"
              : "border-border/60 text-muted-foreground",
          )}
        >
          <Coins className="h-3 w-3 mr-1" /> {item.price}
        </Button>
      </div>
    </div>
  );
}
