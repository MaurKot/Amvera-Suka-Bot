import { 
  useGetLedger,
  getGetLedgerQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ScrollText, Ghost, Eye } from "lucide-react";
import { format } from "date-fns";

export function Ledger() {
  const { data: ledger, isLoading } = useGetLedger();

  if (isLoading || !ledger) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Ghost className="w-8 h-8 text-primary animate-pulse opacity-50" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col h-[calc(100vh-6rem)] gap-6"
      >
        <header className="border-b border-border/40 pb-6">
          <h1 className="text-3xl font-serif text-foreground tracking-wide mb-2 flex items-center gap-3">
            <ScrollText className="w-8 h-8 text-primary" />
            Хроники
          </h1>
          <p className="text-muted-foreground font-serif italic text-sm">Мир помнит каждое ваше слово и каждое действие.</p>
        </header>

        <Card className="flex-1 flex flex-col card-parchment bg-card/70 border-border/40 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            {ledger.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic font-serif py-20">
                <ScrollText className="w-12 h-12 opacity-20 mb-4" />
                <p>Страницы пусты. Ваша история еще не началась.</p>
              </div>
            ) : (
              <div className="space-y-6 pb-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                {ledger.map((entry, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={entry.id}
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                  >
                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border/40 bg-surface-1 text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      {entry.eventType === 'battle' ? <span className="text-destructive font-mono text-xs">⚔</span> :
                       entry.eventType === 'dialogue' ? <span className="text-secondary-foreground font-mono text-xs">❝</span> :
                       entry.eventType === 'gift' ? <span className="text-primary font-mono text-xs">✦</span> :
                       <Eye className="w-4 h-4 opacity-50" />}
                    </div>
                    
                    {/* Content */}
                    <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-surface-2 border-border/40 hover:border-primary/20 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
                              {format(new Date(entry.createdAt), 'dd.MM.yyyy HH:mm')}
                            </span>
                            <Badge variant="outline" className={`text-[10px] font-mono border-border/40 uppercase tracking-widest ${
                              entry.severity > 2 ? 'text-destructive border-destructive/30' : 
                              entry.severity > 1 ? 'text-secondary-foreground border-secondary/30' : 
                              'text-muted-foreground'
                            }`}>
                              Ур. {entry.severity}
                            </Badge>
                          </div>
                          
                          <p className="font-serif text-foreground/90 leading-relaxed text-sm">
                            {entry.description}
                          </p>

                          {entry.deltaRep !== 0 && (
                            <div className="mt-2 text-xs font-mono">
                              <span className="text-muted-foreground">Репутация: </span>
                              <span className={entry.deltaRep > 0 ? "text-primary" : "text-destructive"}>
                                {entry.deltaRep > 0 ? "+" : ""}{entry.deltaRep}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </motion.div>
    </Layout>
  );
}
