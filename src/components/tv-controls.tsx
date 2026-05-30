import { useEffect, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, X, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TvController } from "@/hooks/use-dashboard";

export function TvControls({ controller }: { controller: TvController }) {
  const { tv, paused, enabled, currentIndex, currentTab, progress, togglePause, pause, next, prev, goto, exit } = controller;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!tv) return;
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 3500);
    };
    show();
    window.addEventListener("mousemove", show);
    window.addEventListener("keydown", show);
    window.addEventListener("touchstart", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", show);
      window.removeEventListener("keydown", show);
      window.removeEventListener("touchstart", show);
    };
  }, [tv]);

  if (!tv) return null;

  const secondsLeft = currentTab
    ? Math.max(0, Math.ceil((currentTab.durationMs * (1 - progress)) / 1000))
    : 0;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <div className="flex flex-col items-center gap-2 bg-black/75 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 shadow-2xl text-white min-w-[480px]">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/15 h-8 w-8 p-0" onClick={prev} title="Aba anterior (←)">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/15 h-8 w-8 p-0"
            onClick={togglePause}
            title={paused ? "Retomar (Espaço)" : "Pausar (Espaço)"}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/15 h-8 w-8 p-0" onClick={next} title="Próxima aba (→)">
            <SkipForward className="h-4 w-4" />
          </Button>
          <div className="mx-2 h-6 w-px bg-white/20" />
          {enabled.map((t, i) => (
            <Button
              key={t.to}
              size="sm"
              variant="ghost"
              className={cn(
                "text-white hover:bg-white/15 text-xs px-2.5 h-8",
                i === currentIndex && "bg-white/25 font-semibold",
              )}
              onClick={() => { pause(); goto(t.to); }}
              title={`Ir para ${t.label}`}
            >
              {t.label}
            </Button>
          ))}
          <div className="mx-2 h-6 w-px bg-white/20" />
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-red-500/40 h-8 w-8 p-0"
            onClick={exit}
            title="Sair do modo apresentação (ESC)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/85 transition-[width] duration-200"
            style={{ width: `${(paused ? 0 : progress) * 100}%` }}
          />
        </div>
        <div className="text-[10px] uppercase tracking-widest text-white/75 flex items-center gap-2">
          <Tv className="h-3 w-3" />
          {paused ? "Pausado" : `Em rotação · ${secondsLeft}s`} • {currentTab?.label}
          <span className="text-white/40">| Espaço pausa · ← → trocam aba · ESC sai</span>
        </div>
      </div>
    </div>
  );
}
