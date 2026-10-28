// =============================================================================
// LogsPanel.tsx — registro de la sesión, con ⌘⇧L (macOS) o Ctrl+Shift+L
// =============================================================================
// Muestra las últimas entradas del logSink. Útil para inspeccionar errores o
// warnings que pasaron sin tirar la app.
//
// Monta el Dialog del kit (L1): velo, Escape, foco y portal vienen de él. Vive
// fuera del router (para que funcione con la sesión rota), así que el acento
// es el global (`module={null}`).
//
// Acciones:
//   - "Copiar diagnóstico" → mismo formato que el ErrorBoundary.
//   - "Limpiar" → borra el sink (útil para reproducir un bug y empezar limpio).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clipboard, Check, Trash2 } from "../vendor/lucide-react";
import {
  buildDiagnostic,
  clear as clearSink,
  getEntries,
  subscribe,
  type LogEntry,
  type LogLevel,
} from "../lib/logSink";
import { conModificador, nombreDeAtajo } from "../lib/teclado";
import { Dialog } from "./Dialog";
import { PulsoButton } from "./PulsoButton";
import "./logs-panel.css";

/** ⌘⇧L en macOS, Ctrl+Shift+L en Windows. */
export function esAtajoDeLogs(evento: Pick<KeyboardEvent, "key" | "shiftKey" | "metaKey" | "ctrlKey">, mac?: boolean): boolean {
  return conModificador(evento, mac) && evento.shiftKey && (evento.key === "L" || evento.key === "l");
}

export default function LogsPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Suscripción al sink mientras está abierto.
  useEffect(() => {
    if (!open) return;
    setEntries(getEntries());
    return subscribe(setEntries);
  }, [open]);

  // Atajo global para alternar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (esAtajoDeLogs(e)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-scroll al final cuando llegan nuevas entradas y el panel está abierto.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries, open]);

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter((e) => e.level === filter);
  }, [entries, filter]);

  const handleCopy = useCallback(async () => {
    const diag = buildDiagnostic({ tailEntries: 200 });
    try {
      await navigator.clipboard.writeText(diag);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = diag;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }, []);

  const handleClear = useCallback(() => {
    clearSink();
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      module={null}
      size="lg"
      title={`Registro de la sesión · ${filtered.length} de ${entries.length}`}
      stepper={<FilterChips current={filter} onPick={setFilter} entries={entries} />}
      flush
      footerHint={<span>{nombreDeAtajo("⇧L")} abre y cierra · Esc cierra</span>}
      footer={(
        <>
          <PulsoButton variant="secondary" size="md" onClick={handleClear}>
            <Trash2 size={13} aria-hidden="true" /> Limpiar
          </PulsoButton>
          <PulsoButton variant="primary" size="md" onClick={() => void handleCopy()}>
            {copied ? <Check size={13} aria-hidden="true" /> : <Clipboard size={13} aria-hidden="true" />}
            {copied ? "Copiado" : "Copiar diagnóstico"}
          </PulsoButton>
        </>
      )}
    >
      <div ref={scrollRef} className="pulso-logs-lista">
        {filtered.length === 0 ? (
          <div className="pulso-logs-vacio">Sin entradas para este filtro.</div>
        ) : (
          filtered.map((e, i) => <LogRow key={`${e.ts}-${i}`} entry={e} />)
        )}
      </div>
    </Dialog>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const ts = new Date(entry.ts).toLocaleTimeString("es-PE", { hour12: false });
  return (
    <div className="pulso-logs-fila" data-nivel={entry.level}>
      <span className="pulso-logs-tenue">[{ts}]</span>{" "}
      <span className="pulso-logs-nivel">{entry.level}</span>{" "}
      <span className="pulso-logs-tenue">({entry.source})</span>{" "}
      <span className="pulso-logs-mensaje">{entry.message}</span>
      {entry.stack && <div className="pulso-logs-stack">{entry.stack}</div>}
    </div>
  );
}

function FilterChips({
  current,
  onPick,
  entries,
}: {
  current: LogLevel | "all";
  onPick: (l: LogLevel | "all") => void;
  entries: LogEntry[];
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) c[e.level] = (c[e.level] ?? 0) + 1;
    return c;
  }, [entries]);
  const items: Array<LogLevel | "all"> = ["all", "error", "warn", "info", "log", "debug"];
  return (
    <div className="pulso-logs-filtros" role="group" aria-label="Filtrar por nivel">
      {items.map((l) => {
        const n = counts[l] ?? 0;
        if (l !== "all" && n === 0) return null;
        return (
          <button
            key={l}
            type="button"
            className="pulso-logs-filtro"
            aria-pressed={current === l}
            onClick={() => onPick(l)}
          >
            {l} {n}
          </button>
        );
      })}
    </div>
  );
}
