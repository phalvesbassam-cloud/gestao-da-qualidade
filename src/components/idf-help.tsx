import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function IdfHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <HelpCircle className="h-3 w-3 mr-1" /> Como o IDF é calculado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Como o IDF é calculado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold text-base mb-1">1. Apenas inspeções reprovadas pontuam</h3>
            <p className="text-muted-foreground">
              Inspeções aprovadas e aprovação condicional não geram pontos de não conformidade (NC).
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">2. Pontuação por criticidade</h3>
            <table className="w-full text-sm border rounded-md overflow-hidden">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Criticidade</th>
                  <th className="text-right p-2">Pontos NC</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="p-2">Grave</td><td className="p-2 text-right tabular-nums font-semibold">8</td></tr>
                <tr className="border-t"><td className="p-2">Moderada</td><td className="p-2 text-right tabular-nums font-semibold">4</td></tr>
                <tr className="border-t"><td className="p-2">Leve</td><td className="p-2 text-right tabular-nums font-semibold">2</td></tr>
                <tr className="border-t"><td className="p-2">Ponto de melhoria</td><td className="p-2 text-right tabular-nums font-semibold">0</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">3. Somar as notas por fornecedor</h3>
            <p className="text-muted-foreground">Somatório de todos os pontos NC do período filtrado.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">4. Conversão em IDF (%)</h3>
            <table className="w-full text-sm border rounded-md overflow-hidden">
              <thead className="bg-muted">
                <tr><th className="text-left p-2">Pontos NC</th><th className="text-right p-2">IDF</th></tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="p-2">NC = 0</td><td className="p-2 text-right tabular-nums font-semibold text-success">100%</td></tr>
                <tr className="border-t"><td className="p-2">0 &lt; NC ≤ 8</td><td className="p-2 text-right tabular-nums font-semibold text-success">90%</td></tr>
                <tr className="border-t"><td className="p-2">8 &lt; NC ≤ 16</td><td className="p-2 text-right tabular-nums font-semibold text-info">80%</td></tr>
                <tr className="border-t"><td className="p-2">16 &lt; NC ≤ 20</td><td className="p-2 text-right tabular-nums font-semibold text-warning">60%</td></tr>
                <tr className="border-t"><td className="p-2">20 &lt; NC ≤ 28</td><td className="p-2 text-right tabular-nums font-semibold text-destructive">40%</td></tr>
                <tr className="border-t"><td className="p-2">28 &lt; NC ≤ 32</td><td className="p-2 text-right tabular-nums font-semibold text-destructive">20%</td></tr>
                <tr className="border-t"><td className="p-2">NC &gt; 32</td><td className="p-2 text-right tabular-nums font-semibold text-destructive">0%</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">5. Classificação</h3>
            <ul className="text-muted-foreground space-y-1">
              <li>• <strong className="text-foreground">100%</strong> — Excelente</li>
              <li>• <strong className="text-foreground">90%</strong> — Muito Bom</li>
              <li>• <strong className="text-foreground">80%</strong> — Bom</li>
              <li>• <strong className="text-foreground">60%</strong> — Atenção</li>
              <li>• <strong className="text-foreground">40%</strong> — Crítico</li>
              <li>• <strong className="text-foreground">20%</strong> — Muito Crítico</li>
              <li>• <strong className="text-foreground">0%</strong> — Bloqueado</li>
            </ul>
          </section>

          <section className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <h3 className="font-semibold text-base mb-1">Exemplo prático — RUITAI</h3>
            <p className="text-sm">
              3 reprovadas no período: <strong>Grave (8) + Grave (8) + Moderada (4) = 20 pontos</strong>
              <br />
              IDF = <strong className="text-warning">60%</strong> → Classificação:{" "}
              <strong className="text-warning">Atenção</strong>.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
