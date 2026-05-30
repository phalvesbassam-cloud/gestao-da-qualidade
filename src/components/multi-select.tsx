import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  width,
  icon,
  className,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  width?: number;
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const safeOptions = useMemo(
    () => [...new Set((Array.isArray(options) ? options : []).map((o) => String(o ?? "").trim()).filter(Boolean))],
    [options],
  );
  const safeValue = useMemo(
    () => (Array.isArray(value) ? value : []).map((o) => String(o ?? "").trim()).filter(Boolean),
    [value],
  );
  const filtered = useMemo(
    () => safeOptions.filter((o) => o.toLowerCase().includes(q.toLowerCase())).slice(0, 200),
    [safeOptions, q],
  );
  const toggle = (o: string) => {
    onChange(safeValue.includes(o) ? safeValue.filter((x) => x !== o) : [...safeValue, o]);
  };
  const summary =
    safeValue.length === 0 ? label : safeValue.length === 1 ? safeValue[0] : `${label} (${safeValue.length})`;
  const active = safeValue.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-active={active ? "true" : "false"}
          data-state={open ? "open" : "closed"}
          className={cn("filter-control justify-between cursor-pointer", className)}
          style={width ? { width } : undefined}
        >
          <span className="flex items-center gap-2 min-w-0">
            {icon && <span className="shrink-0 opacity-70">{icon}</span>}
            <span className="truncate">{summary}</span>
          </span>
          {active ? (
            <X
              className="h-3.5 w-3.5 shrink-0 opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          placeholder={`Buscar ${label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 text-xs mb-2"
        />
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 && <div className="text-xs text-muted-foreground p-2">Sem opções</div>}
          {filtered.map((o) => {
            const checked = safeValue.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-accent",
                  checked && "bg-accent/70",
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center",
                    checked ? "bg-primary border-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{o}</span>
              </button>
            );
          })}
        </div>
        {safeValue.length > 0 && (
          <div className="border-t mt-2 pt-2 flex justify-between">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([])}>
              Limpar
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Ok
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
