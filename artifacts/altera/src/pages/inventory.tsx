import { 
  useGetInventory,
  useEquipItem,
  getGetInventoryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Shield, Package, Ghost } from "lucide-react";

export function Inventory() {
  const queryClient = useQueryClient();
  const { data: inventory, isLoading } = useGetInventory();
  const equipItem = useEquipItem();

  if (isLoading || !inventory) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Ghost className="w-8 h-8 text-primary animate-pulse opacity-50" />
        </div>
      </Layout>
    );
  }

  const handleEquip = (itemId: number) => {
    equipItem.mutate({ data: { itemId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
      }
    });
  };

  const getRarityTextColor = (rarity: string) => {
    switch(rarity) {
      case 'legendary': return 'text-yellow-500';
      case 'rare': return 'text-purple-400';
      case 'uncommon': return 'text-blue-400';
      default: return 'text-muted-foreground';
    }
  };

  const getRarityBorderColor = (rarity: string) => {
    switch(rarity) {
      case 'legendary': return 'border-yellow-500/30';
      case 'rare': return 'border-purple-400/30';
      case 'uncommon': return 'border-blue-400/30';
      default: return 'border-border/40';
    }
  };

  const getRarityLabel = (rarity: string) => {
    switch(rarity) {
      case 'legendary': return 'Легендарное';
      case 'rare': return 'Редкое';
      case 'uncommon': return 'Необычное';
      default: return 'Обычное';
    }
  };

  const equippedItems = inventory.filter(i => i.equipped);
  const bagItems = inventory.filter(i => !i.equipped);

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col h-[calc(100vh-6rem)] gap-6"
      >
        <header className="border-b border-border/40 pb-6">
          <h1 className="text-3xl font-serif text-foreground tracking-wide mb-2 flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            Снаряжение
          </h1>
          <p className="text-muted-foreground font-serif italic text-sm">Ваша броня — ваша жизнь.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
          <Card className="flex flex-col card-parchment bg-card/70 border-border/40 overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-surface-2">
              <CardTitle className="font-serif text-xl flex items-center gap-2 text-primary">
                <Shield className="w-5 h-5 opacity-70" />
                Экипировано
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              {equippedItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground italic font-serif py-12 text-sm text-center">
                  Вы беззащитны.
                </div>
              ) : (
                <div className="space-y-4">
                  {equippedItems.map(item => (
                    <Card key={item.id} className={`bg-surface-2 border-border/40 hover:border-primary/30 transition-all ${item.rarity === 'legendary' ? 'shadow-[0_0_15px_rgba(234,179,8,0.1)]' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className={`font-serif text-lg ${getRarityTextColor(item.rarity)}`}>
                              {item.name}
                            </h4>
                            <Badge variant="outline" className={`mt-1 font-mono text-[10px] uppercase tracking-widest ${getRarityTextColor(item.rarity)} ${getRarityBorderColor(item.rarity)}`}>
                              {getRarityLabel(item.rarity)}
                            </Badge>
                          </div>
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleEquip(item.id)}
                            disabled={equipItem.isPending}
                            className="h-7 text-xs font-serif bg-surface-2 border-border/40 hover:bg-surface-3"
                          >
                            Снять
                          </Button>
                        </div>
                        {item.stats && Object.keys(item.stats).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs font-mono">
                            {Object.entries(item.stats).map(([stat, val]) => (
                              <div key={stat} className="flex justify-between text-muted-foreground">
                                <span>{stat}:</span>
                                <span className="text-foreground">+{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>

          <Card className="flex flex-col card-parchment bg-card/70 border-border/40 overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-surface-2">
              <CardTitle className="font-serif text-xl flex items-center gap-2 text-secondary-foreground">
                <Package className="w-5 h-5 opacity-70" />
                Сумка
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              {bagItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground italic font-serif py-12 text-sm text-center">
                  Пусто. Лишь пыль на дне.
                </div>
              ) : (
                <div className="space-y-4">
                  {bagItems.map(item => (
                    <Card key={item.id} className="bg-surface-2 border-border/40 hover:border-primary/20 transition-all">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className={`font-serif text-lg ${getRarityTextColor(item.rarity)}`}>
                              {item.name} {item.quantity > 1 ? <span className="text-muted-foreground text-sm font-mono opacity-50">x{item.quantity}</span> : ''}
                            </h4>
                            <Badge variant="outline" className={`mt-1 font-mono text-[10px] uppercase tracking-widest ${getRarityTextColor(item.rarity)} ${getRarityBorderColor(item.rarity)}`}>
                              {getRarityLabel(item.rarity)}
                            </Badge>
                          </div>
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleEquip(item.id)}
                            disabled={equipItem.isPending}
                            className="h-7 text-xs font-serif bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50"
                          >
                            Надеть
                          </Button>
                        </div>
                        {item.stats && Object.keys(item.stats).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs font-mono">
                            {Object.entries(item.stats).map(([stat, val]) => (
                              <div key={stat} className="flex justify-between text-muted-foreground">
                                <span>{stat}:</span>
                                <span className="text-foreground">+{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      </motion.div>
    </Layout>
  );
}
