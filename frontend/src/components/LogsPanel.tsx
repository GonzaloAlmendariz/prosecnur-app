// =============================================================================
// LogsPanel.tsx — overlay accesible con Cmd/Ctrl+Shift+L
// =============================================================================
// Modal flotante que muestra las últimas entradas del logSink. Útil para
// inspeccionar errores o warnings que pasaron sin tirar la app.
//
// Atajos:
//   - Cmd/Ctrl+Shift+L → toggle abrir/cerrar.
//   - Esc cierra cuando está abierto.
//
// Acciones:
//   - "Copiar diagnóstico" → mismo formato que el ErrorBoundary.
//   - "Limpiar" → borra el sink (útil para reproducir un bug y empezar limpio).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clipboard, Check, Trash2, X } from "lucide-react";
import {
  buildDiagnostic,
  clear as clearSink,
  getEntries,
  subscribe,
  type LogEntry,
  type LogLevel,
} from "../lib/logSink";

export default function LogsPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Suscripción al sink + Esc para cerrar.
  useEffect(() => {
    if (!open) return;
    setEntries(getEntries());
    const unsub = subscribe(setEntries);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unsub();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Shortcut global Cmd/Ctrl+Shift+L.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle =
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "L" || e.key === "l");
      if (isToggle) {
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

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label="Panel de logs"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(15,23,42,0.42)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        style={{
          width: "100%",
          maxHeight: "70vh",
          background: "#fff",
          borderTop: "1px solid #d8e0ef",
          boxShadow: "0 -12px 32px rgba(15,23,42,0.18)",
          display: "flex",
          flexDirection: "column",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            borderBottom: "1px solid #d8e0ef",
            background: "#f8faff",
          }}
        >
          <strong style={{ fontSize: 13, color: "#0f172a" }}>
            Logs · {filtered.length} de {entries.length}
          </strong>
          <FilterChips current={filter} onPick={setFilter} entries={entries} />
          <div style={{ flex: 1 }} />
          <button type="button" onClick={handleCopy} style={btnPrimary}>
            {copied ? <Check size={12} /> : <Clipboard size={12} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button type="button" onClick={handleClear} style={btnSecondary}>
            <Trash2 size={12} /> Limpiar
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar panel"
            style={btnIcon}
          >
            <X size={14} />
          </button>
        </header>

        {/* Lista */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            lineHeight: 1.55,
            background: "#0f172a",
            color: "#e2e8f0",
            padding: "10px 16px",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ color: "#94a3b8", padding: "12px 0" }}>
              Sin entradas para este filtro.
            </div>
          ) : (
            filtered.map((e, i) => (
              <LogRow key={`${e.ts}-${i}`} entry={e} />
            ))
          )}
        </div>

        <footer
          style={{
            padding: "6px 16px",
            fontSize: 10,
            color: "#5f6b7a",
            borderTop: "1px solid #d8e0ef",
            background: "#f8faff",
          }}
        >
          Cmd/Ctrl + Shift + L para alternar · Esc para cerrar
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const tone = LEVEL_TONE[entry.level] ?? LEVEL_TONE.log;
  const ts = new Date(entry.ts).toLocaleTimeString("es-PE", { hour12: false });
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ color: "#94a3b8" }}>[{ts}]</span>{" "}
      <span
        style={{
          color: tone.fg,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {entry.level}
      </span>{" "}
      <span style={{ color: "#94a3b8" }}>({entry.source})</span>{" "}
      <span style={{ color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {entry.message}
      </span>
      {entry.stack && (
        <div
          style={{
            marginTop: 4,
            paddingLeft: 14,
            color: "#cbd5e1",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            opacity: 0.85,
          }}
        >
          {entry.stack}
        </div>
      )}
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
    <div style={{ display: "inline-flex", gap: 4 }}>
      {items.map((l) => {
        const active = current === l;
        const n = counts[l] ?? 0;
        if (l !== "all" && n === 0) return null;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onPick(l)}
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              border: `1px solid ${active ? "#2457d6" : "#d8e0ef"}`,
              background: active ? "#dbeafe" : "#fff",
              color: active ? "#1e40af" : "#0f172a",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {l} {n}
          </button>
        );
      })}
    </div>
  );
}

const LEVEL_TONE: Record<LogLevel, { fg: string }> = {
  error: { fg: "#fca5a5" },
  warn: { fg: "#fcd34d" },
  info: { fg: "#7dd3fc" },
  log: { fg: "#cbd5e1" },
  debug: { fg: "#a5b4fc" },
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  padding: "5px 10px",
  borderRadius: 6,
  background: "#2457d6",
  color: "#fff",
  border: "1px solid #1e40af",
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  padding: "5px 10px",
  borderRadius: 6,
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #d8e0ef",
  cursor: "pointer",
};

const btnIcon: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  border: "1px solid #d8e0ef",
  background: "#fff",
  borderRadius: 6,
  cursor: "pointer",
  color: "#0f172a",
};
