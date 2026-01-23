import Link from "next/link";
import { Sparkles, Zap, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background selection:bg-primary/30">
      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden py-24 lg:py-32">
          {/* Background Background Glows */}
          <div className="absolute top-0 right-0 p-64 bg-primary/10 rounded-full blur-3xl -mr-64 -mt-64 pointer-events-none" />
          <div className="absolute bottom-0 left-0 p-64 bg-primary/5 rounded-full blur-3xl -ml-64 -mb-64 pointer-events-none" />

          <div className="container relative px-6 mx-auto">
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium animate-in fade-in slide-in-from-bottom-3 duration-1000">
                <Sparkles className="h-4 w-4" />
                <span>La nouvelle ère de la prospection</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-150">
                Trouvez vos prochains clients avec <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">SUPER Prospect</span>
              </h1>

              <p className="text-xl text-muted-foreground animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-300">
                Automatisez votre prospection sur Google Maps. Extraction intelligente, enrichissement d'emails et gestion simplifiée de vos leads.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-500">
                <Button size="lg" className="h-14 px-8 text-lg font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-105" asChild>
                  <Link href="/dashboard">
                    Commencer maintenant <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold bg-white/50 backdrop-blur-sm transition-all hover:bg-white/80" asChild>
                  <Link href="/searches">
                    Voir mes recherches
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-secondary/30">
          <div className="container px-6 mx-auto">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-2xl bg-card border shadow-sm transition-all hover:shadow-md hover:border-primary/20 group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold italic">Extraction Rapide</h3>
                <p className="text-muted-foreground">Scrapez des centaines de leads sur Google Maps en quelques secondes seulement.</p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-2xl bg-card border shadow-sm transition-all hover:shadow-md hover:border-primary/20 group border-primary/20 shadow-primary/5">
                <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white scale-110">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold italic">Enrichissement AI</h3>
                <p className="text-muted-foreground">Récupérez automatiquement les emails et les réseaux sociaux de vos prospects.</p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-2xl bg-card border shadow-sm transition-all hover:shadow-md hover:border-primary/20 group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold italic">Données Précises</h3>
                <p className="text-muted-foreground">Un workflow robuste pour garantir la qualité de chaque contact généré.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t">
        <div className="container px-6 mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              N
            </span>
            <span className="tracking-tight italic uppercase">SUPER PROSPECT</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Neuraflow. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
