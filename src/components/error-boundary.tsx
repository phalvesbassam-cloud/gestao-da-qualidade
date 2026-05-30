import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  resetKey?: string;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Dashboard] Erro de renderização capturado", { error, info });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[360px] flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-display font-semibold text-foreground">Erro ao carregar dados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O dashboard encontrou uma inconsistência temporária. Os filtros podem ser limpos ou a página pode ser recarregada sem interromper a apresentação.
          </p>
          <Button className="mt-5" onClick={() => this.setState({ hasError: false, error: undefined })}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
}