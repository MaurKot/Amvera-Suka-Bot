import { useEffect, useRef, useState } from "react";
import {
  useGetNpc,
  useGetDialogue,
  useSendDialogue,
  getGetDialogueQueryKey,
  getGetNpcQueryKey,
  getListNpcsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, Sword, Send, Sparkles, MessageCircle, Skull } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const TONES: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { key: "friendly", label: "Дружелюбно", icon: Heart, tone: "friendly" },
  { key: "neutral", label: "Нейтрально", icon: MessageCircle, tone: "neutral" },
  { key: "persuade", label: "Убедить", icon: Sparkles, tone: "persuade" },
  { key: "threat", label: "Угрожать", icon: Sword, tone: "threat" },
  { key: "insult", label: "Оскорбить", icon: Skull, tone: "insult" },
];

export interface NpcDialogProps {
  npcId: string | null;
  open: boolean;
  onClose: () => void;
}

export function NpcDialog({ npcId, open, onClose }: NpcDialogProps) {
  const queryClient = useQueryClient();
  const [tone, setTone] = useState("neutral");
  const [text, setText] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { data: npc } = useGetNpc(npcId ?? "", { query: { enabled: !!npcId && open } });
  const { data: history } = useGetDialogue(npcId ?? "", {
    query: { enabled: !!npcId && open, refetchOnWindowFocus: false },
  });
  const send = useSendDialogue();

  useEffect(() => {
    if (history && scrollerRef.current) {
      requestAnimationFrame(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [history]);

  const handleSend = () => {
    if (!npcId || !text.trim() || send.isPending) return;
    const playerLine = text.trim();
    setText("");
    haptic("light");
    send.mutate(
      { npcId, data: { content: playerLine, tone } },
      {
        onSuccess: (data) => {
          haptic("success");
          queryClient.invalidateQueries({ queryKey: getGetDialogueQueryKey(npcId) });
          queryClient.invalidateQueries({ queryKey: getGetNpcQueryKey(npcId) });
          queryClient.invalidateQueries({ queryKey: getListNpcsQueryKey({ locationId: npc?.locationId }) });
          if ((data?.repDelta ?? 0) < -10) haptic("warning");
          else if ((data?.repDelta ?? 0) >= 5) haptic("success");
        },
        onError: () => haptic("error"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 bg-card border-primary/20 rounded-md flex flex-col h-[85vh]">
        <DialogHeader className="px-4 py-3 border-b border-border/50 flex-shrink-0">
          <DialogTitle className="font-serif text-primary text-lg tracking-wide flex items-center gap-2">
            {npc?.name ?? "Собеседник"}
            {npc?.title && <Badge variant="outline" className="text-[10px] uppercase">{npc.title}</Badge>}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Отношение: <span className="text-foreground">{npc?.repName ?? "Нейтральное"}</span>
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {npc?.shortProfile && history?.length === 0 && (
            <p className="text-sm text-muted-foreground font-serif italic leading-relaxed">
              {npc.shortProfile}
            </p>
          )}
          {(history ?? []).map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                m.role === "player"
                  ? "ml-auto bg-primary/15 border border-primary/30 text-foreground"
                  : "mr-auto bg-muted/40 border border-border/50 text-foreground/90",
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
            <div className="mr-auto bg-muted/40 border border-border/50 rounded-lg px-3 py-2 text-xs text-muted-foreground italic max-w-[85%]">
              {npc?.name ?? "Он"} обдумывает ответ...
            </div>
          )}
        </div>

        <div className="border-t border-border/50 p-3 flex-shrink-0 space-y-2">
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
                    "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] uppercase tracking-wider transition-all",
                    isActive
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-background border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`tone-${t.tone}`}
                >
                  <Icon className="h-3 w-3" />
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
              className="resize-none text-sm"
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
              data-testid="dialogue-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
