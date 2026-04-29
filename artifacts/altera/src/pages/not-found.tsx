import { Link } from "wouter";
import { Ghost } from "lucide-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col items-center justify-center text-center p-8 relative overflow-hidden min-h-[calc(100vh-6rem)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-destructive/10 via-background to-background pointer-events-none" />
        
        <Ghost className="w-16 h-16 text-destructive/50 mb-8 animate-pulse relative z-10" />
        
        <h1 className="text-4xl md:text-6xl font-serif text-foreground tracking-widest uppercase mb-4 relative z-10">
          Пустота
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground font-serif italic max-w-lg mb-12 relative z-10">
          Вы забрели туда, где обрываются нити судьбы. Эти земли не описаны ни в одной хронике Альтеры.
        </p>

        <Link href="/">
          <Button 
            size="lg" 
            variant="outline" 
            className="font-serif tracking-widest uppercase border-primary/30 text-primary hover:bg-primary/20 hover:text-primary-foreground relative z-10"
          >
            Вернуться на путь
          </Button>
        </Link>
      </motion.div>
    </Layout>
  );
}
