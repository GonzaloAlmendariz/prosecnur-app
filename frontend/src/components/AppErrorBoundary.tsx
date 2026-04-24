// =============================================================================
// AppErrorBoundary.tsx — boundary global con UI de error copiable
// =============================================================================
// React desmonta el árbol entero cuando un componente tira durante render.
// En Electron eso se ve como "pantalla gris" sin info para el usuario.
//
// Esta boundary atrapa el error, lo registra en el log sink y muestra una
// pantalla con:
//   - El mensaje de error y su stack.
//   - Un botón "Copiar diagnóstico" que junta error + últimos 100 logs.
//   - Un botón "Recargar" para intentar volver al estado base.
//   - Un botón "Volver al inicio" (navega a "/" pero sin reload).
//
// Se monta envolviendo el árbol entero en main.tsx / App.tsx.
// =============================================================================

import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Clipboard, RefreshCcw, Home, Check } from "lucide-react";
import { buildDiagnostic, note } from "../lib/logSink";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Registrar en el log sink (la captura de console.error ya lo capta,
    // pero `note()` deja un marcador explícito antes del error).
    note(`AppErrorBoundary: ${error.message}`, "error");
    // No silenciar — log a la consola real también para DevTools.
    // eslint-disable-next-line no-console
    console.error("AppErrorBoundary capturó:", error, errorInfo);
  }

  private handleCopy = async () => {
    const diag = buildDiagnostic({
      errorMessage: this.state.error?.message,
      errorStack: this.state.error?.stack,
      errorContext: this.state.errorInfo?.componentStack
        ? `Component stack:${this.state.errorInfo.componentStack}`
        : "AppErrorBoundary",
    });
    try {
      await navigator.clipboard.writeText(diag);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      // Fallback: textarea + execCommand. En Electron clipboard suele
      // funcionar, pero por las dudas.
      try {
        const ta = document.createElement("textarea");
        ta.value = diag;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        this.setState({ copied: true });
        window.setTimeout(() => this.setState({ copied: false }), 2500);
      } catch {
        // Si todo falla, mostramos el texto en un prompt para copia manual.
        // eslint-disable-next-line no-alert
        window.prompt("Copia manualmente este diagnóstico:", diag);
      }
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    // Volver a "/" y resetear la boundary intentando re-renderizar.
    window.history.pushState({}, "", "/");
    this.setState({ error: null, errorInfo: null, copied: false });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const error = this.state.error;
    const componentStack = this.state.errorInfo?.componentStack ?? "";

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: "100vh",
          padding: "32px 24px",
          background: "var(--pulso-surface, #fff)",
          color: "var(--pulso-text, #0f172a)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 880, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <AlertTriangle size={28} color="#b91c1c" />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              La aplicación se detuvo por un error
            </h1>
          </div>

          <p
            style={{
              fontSize: 14,
              color: "#5f6b7a",
              lineHeight: 1.55,
              marginTop: 0,
              marginBottom: 18,
            }}
          >
            Pulso atrapó una excepción que no debería ocurrir. Copia el
            diagnóstico y compártelo — incluye el error, el stack y los
            últimos 100 eventos del log para que lo podamos resolver rápido.
          </p>

          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleCopy}
              style={primaryBtn}
            >
              {this.state.copied ? <Check size={14} /> : <Clipboard size={14} />}
              {this.state.copied ? "Copiado" : "Copiar diagnóstico"}
            </button>
            <button type="button" onClick={this.handleReload} style={secondaryBtn}>
              <RefreshCcw size={14} /> Recargar
            </button>
            <button type="button" onClick={this.handleHome} style={secondaryBtn}>
              <Home size={14} /> Volver al inicio
            </button>
          </div>

          <Section title="Mensaje">
            <pre style={preStyle}>{error.message || "(sin mensaje)"}</pre>
          </Section>

          {error.stack && (
            <Section title="Stack">
              <pre style={preStyle}>{error.stack}</pre>
            </Section>
          )}

          {componentStack && (
            <Section title="Component stack (React)">
              <pre style={preStyle}>{componentStack.trim()}</pre>
            </Section>
          )}

          <p style={{ fontSize: 11, color: "#5f6b7a", marginTop: 24 }}>
            Atajo: <kbd style={kbdStyle}>Cmd</kbd> + <kbd style={kbdStyle}>Shift</kbd> +{" "}
            <kbd style={kbdStyle}>L</kbd> abre el panel de logs en cualquier momento.
          </p>
        </div>
      </div>
    );
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        marginBottom: 14,
        border: "1px solid #d8e0ef",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: "#5f6b7a",
          background: "#f8faff",
          borderBottom: "1px solid #d8e0ef",
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  background: "#2457d6",
  color: "#fff",
  border: "1px solid #1e40af",
  borderRadius: 8,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #d8e0ef",
  borderRadius: 8,
  cursor: "pointer",
};

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: "12px 14px",
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  color: "#0f172a",
  background: "#fff",
  maxHeight: 280,
  overflowY: "auto",
};

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
  background: "#f8faff",
  border: "1px solid #d8e0ef",
  borderRadius: 4,
};
