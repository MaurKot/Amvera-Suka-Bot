import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Home } from "@/pages/home";
import { CharacterSheet } from "@/pages/character";
import { World } from "@/pages/world";
import { NpcProfile } from "@/pages/npc";
import { BattleScreen } from "@/pages/battle";
import { Ledger } from "@/pages/ledger";
import { Inventory } from "@/pages/inventory";
import { Lore } from "@/pages/lore";
import { WorldMap } from "@/pages/map";
import { Quests } from "@/pages/quests";
import { Achievements } from "@/pages/achievements";
import { ReferralPage } from "@/pages/referral";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/character" component={CharacterSheet} />
      <Route path="/world" component={World} />
      <Route path="/map" component={WorldMap} />
      <Route path="/quests" component={Quests} />
      <Route path="/achievements" component={Achievements} />
      <Route path="/referral" component={ReferralPage} />
      <Route path="/npc/:npcId" component={NpcProfile} />
      <Route path="/battle" component={BattleScreen} />
      <Route path="/ledger" component={Ledger} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/lore" component={Lore} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
