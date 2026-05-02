import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Send, Gift, MessageCircle, Skull } from "lucide-react";
import { 
  useGetNpc, 
  useGetDialogue, 
  useSendDialogue, 
  useGiftNpc,
  getGetNpcQueryKey,
  getGetDialogueQueryKey,
  getGetCharacterQueryKey,
  SendDialogueRequestTone,
  useGetCharacter
} from "@workspace/api-client-react";

import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function NpcProfile() {
  const { npcId } = useParams<{ npcId: string }>();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<SendDialogueRequestTone>(SendDialogueRequestTone.neutral);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: npc, isLoading: isNpcLoading } = useGetNpc(npcId!, { 
    query: { enabled: !!npcId, queryKey: getGetNpcQueryKey(npcId!) } 
  });
  
  const { data: dialogue, isLoading: isDialogueLoading } = useGetDialogue(npcId!, {
    query: { enabled: !!npcId, queryKey: getGetDialogueQueryKey(npcId!) }
  });

  const { data: characterData } = useGetCharacter();

  const sendDialogue = useSendDialogue();
  const giftNpc = useGiftNpc();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dialogue]);

  if (isNpcLoading || isDialogueLoading || !npc) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Skull className="w-8 h-8 text-primary animate-pulse opacity-50" />
        </div>
      </Layout>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !npcId) return;

    sendDialogue.mutate({ npcId, data: { content: message, tone } }, {
      onSuccess: () => {
        setMessage("");
        queryClient.invalidateQueries({ queryKey: getGetDialogueQueryKey(npcId) });
        queryClient.invalidateQueries({ queryKey: getGetNpcQueryKey(npcId) });
      }
    });
  };

  const handleGift = () => {
    if (!npcId) return;
    giftNpc.mutate({ npcId, data: { silver: 10 } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNpcQueryKey(npcId) });
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDialogueQueryKey(npcId) });
      }
    });
  };

  const tones = [
    { value: SendDialogueRequestTone.neutral, label: "Нейтрально", color: "border-white/20 text-white" },
    { value: SendDialogueRequestTone.friendly, label: "Дружелюбно", color: "border-green-500/50 text-green-400" },
    { value: SendDialogueRequestTone.persuade, label: "Убедить", color: "border-blue-500/50 text-blue-400" },
    { value: SendDialogueRequestTone.flirt, label: "Флирт", color: "border-pink-500/50 text-pink-400" },
    { value: SendDialogueRequestTone.threat, label: "Угроза", color: "border-destructive/50 text-destructive" },
    { value: SendDialogueRequestTone.insult, label: "Оскорбить", color: "border-red-600/80 text-red-500" },
  ];

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full"
      >
        <div className="md:col-span-1 space-y-6">
          <Card className="card-parchment bg-card/70 border-border/40 sticky top-6">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto bg-surface-2 rounded-sm border border-primary/20 flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-primary/50" />
                </div>
                <h2 className="text-2xl font-serif text-foreground">{npc.name}</h2>
                {npc.title && <p className="text-primary font-serif italic text-sm">{npc.title}</p>}
              </div>
              
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <Badge variant="outline" className="border-border/40 uppercase text-[10px] tracking-wider">{npc.role}</Badge>
                <Badge variant="outline" className="border-border/40 uppercase text-[10px] tracking-wider">{npc.faction}</Badge>
              </div>

              <Separator className="bg-white/5 my-4" />

              <div className="space-y-2 text-center">
                <div className="text-xs uppercase font-mono tracking-widest text-muted-foreground">Отношение</div>
                <div className="flex items-center justify-center gap-2 font-serif text-lg">
                  <span>{npc.repIcon}</span>
                  <span className="text-secondary-foreground">{npc.repName}</span>
                  <span className="text-muted-foreground text-sm">({npc.reputation})</span>
                </div>
                <p className="text-xs italic text-muted-foreground">{npc.repBehavior}</p>
              </div>

              <Separator className="bg-white/5 my-4" />

              <p className="text-sm font-serif italic text-muted-foreground text-center leading-relaxed">
                "{npc.shortProfile}"
              </p>

              <div className="pt-6 flex justify-center">
                <Button 
                  variant="outline" 
                  className="w-full font-serif border-primary/30 text-primary hover:bg-primary/20"
                  onClick={handleGift}
                  disabled={giftNpc.isPending || (characterData?.character?.silver ?? 0) < 10}
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Предложить 10 серебра
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-12rem)]">
          <Card className="flex-1 flex flex-col card-parchment bg-card/70 border-border/40 overflow-hidden">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-6 pb-4">
                {(!dialogue || dialogue.length === 0) ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground italic font-serif py-20 text-center">
                    Тишина окутывает вас. Заговорите первыми, чтобы разорвать её.
                  </div>
                ) : (
                  dialogue.map((msg, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id} 
                      className={`flex flex-col max-w-[80%] ${msg.role === 'player' ? 'ml-auto items-end' : msg.role === 'npc' ? 'mr-auto items-start' : 'mx-auto items-center'}`}
                    >
                      {msg.role === 'system' ? (
                        <div className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest my-4 text-center">
                          {msg.content}
                        </div>
                      ) : (
                        <>
                          <div className={`text-xs font-serif mb-1 opacity-50 ${msg.role === 'player' ? 'text-right' : 'text-left'}`}>
                            {msg.role === 'player' ? 'Вы' : npc.name}
                          </div>
                          <div 
                            className={`p-3 rounded-sm font-serif leading-relaxed text-sm md:text-base border ${
                              msg.role === 'player' 
                                ? 'bg-primary/10 border-primary/20 text-primary-foreground' 
                                : 'bg-surface-2 border-border/40 text-foreground'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))
                )}
                {sendDialogue.isPending && (
                  <div className="mr-auto items-start max-w-[80%] opacity-50">
                    <div className="p-3 rounded-sm font-serif bg-surface-2 border border-border/40 text-foreground animate-pulse">
                      ...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t border-border/40 bg-surface-2">
              <form onSubmit={handleSend} className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  {tones.map(t => (
                    <div
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={`cursor-pointer px-2 py-1 text-xs font-mono uppercase tracking-widest rounded border transition-all ${
                        tone === t.value 
                          ? `${t.color} bg-white/5 shadow-inner` 
                          : `border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5`
                      }`}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Ваши слова..."
                    className="font-serif bg-black/50 border-border/40 focus-visible:ring-primary/50 rounded-sm"
                    disabled={sendDialogue.isPending}
                  />
                  <Button 
                    type="submit" 
                    disabled={!message.trim() || sendDialogue.isPending}
                    className="rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 px-8"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      </motion.div>
    </Layout>
  );
}
