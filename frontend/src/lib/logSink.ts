// =============================================================================
// logSink.ts — captura unificada de logs del frontend
// =============================================================================
// Un anillo en memoria de las últimas N entradas de log de la app, alimentado
// por:
//   - Interceptación de console.error / console.warn / console.info /
//     console.log / console.debug.
//   - Listener global `window.error` (errores no-React).
//   - Listener `unhandledrejection` (Promises sin .catch).
//
// Razón: cuando un render de React tira en producción, vemos pantalla gris y
// los logs de DevTools quedan inaccesibles desde Electron. Con el sink:
//   - El usuario abre el LogsPanel (Cmd/Ctrl+Shift+L) o le da copiar desde
//     la AppErrorBoundary.
//   - Pega el diagnóstico — resolver el bug deja de depender de adivinar.
//
// Diseño:
//   - No-op si install() no se llama (entradas siguen funcionando vía push()
//     y los listeners globales no se enganchan dos veces).
//   - Singleton — vive en module scope. No usamos Zustand para evitar
//     dependencias circulares (Zustand consumiría console.error si fallara).
//   - Persistencia opcional en sessionStorage (último crash se preserva al
//     reload).
// =============================================================================

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface LogEntry {
  ts: number;            // Date.now()
  level: LogLevel;
  source: "console" | "window" | "promise" | "manual";
  message: string;       // texto plano (args ya formateados)
  stack?: string;        // stack si el primer arg es Error
  url?: string;          // window.location.href en el momento
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = "pulso.logSink.v1";

let entries: LogEntry[] = [];
let installed = false;
const listeners = new Set<(entries: LogEntry[]) => void>();

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

export function install(): void {
  if (installed) return;
  installed = true;

  // Cargar entries persistidos del último crash, si los hay.
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LogEntry[];
      if (Array.isArray(parsed)) entries = parsed.slice(-MAX_ENTRIES);
    }
  } catch {
    // no-op: si sessionStorage falla, simplemente arrancamos vacíos.
  }

  // Interceptar console.*
  patchConsole("log");
  patchConsole("info");
  patchConsole("warn");
  patchConsole("error");
  patchConsole("debug");

  // Errores globales no atrapados (sintaxis, throw fuera de React, etc.)
  window.addEventListener("error", (event) => {
    push({
      level: "error",
      source: "window",
      message: event.message || "(error sin mensaje)",
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  // Promises rechazadas sin catch — comunes en async/await mal manejados.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    push({
      level: "error",
      source: "promise",
      message: reason instanceof Error ? reason.message : String(reason ?? "rejection"),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

export function getEntries(): LogEntry[] {
  return entries.slice();
}

export function clear(): void {
  entries = [];
  persist();
  notify();
}

export function subscribe(fn: (entries: LogEntry[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Empuja una entrada manual (útil para anotaciones explícitas). */
export function note(message: string, level: LogLevel = "info"): void {
  push({ level, source: "manual", message });
}

// -----------------------------------------------------------------------------
// Diagnóstico — texto listo para copiar al portapapeles
// -----------------------------------------------------------------------------

export interface DiagnosticOptions {
  /** Mensaje principal (ej: el error capturado por la ErrorBoundary). */
  errorMessage?: string;
  /** Stack del error principal. */
  errorStack?: string;
  /** Componente o boundary donde fue capturado, si aplica. */
  errorContext?: string;
  /** Cuántas entradas de log incluir. Default 100. */
  tailEntries?: number;
}

export function buildDiagnostic(opts: DiagnosticOptions = {}): string {
  const tail = opts.tailEntries ?? 100;
  const lines: string[] = [];
  lines.push("=== Pulso · diagnóstico ===");
  lines.push(`Timestamp: ${new Date().toISOString()}`);
  lines.push(`URL: ${typeof window !== "undefined" ? window.location.href : "(sin window)"}`);
  if (typeof navigator !== "undefined") {
    lines.push(`User-Agent: ${navigator.userAgent}`);
  }
  lines.push("");

  if (opts.errorMessage) {
    lines.push("--- Error principal ---");
    if (opts.errorContext) lines.push(`Contexto: ${opts.errorContext}`);
    lines.push(`Mensaje: ${opts.errorMessage}`);
    if (opts.errorStack) {
      lines.push("Stack:");
      lines.push(opts.errorStack);
    }
    lines.push("");
  }

  lines.push(`--- Últimas ${tail} entradas del log (más recientes al final) ---`);
  const slice = entries.slice(-tail);
  for (const e of slice) {
    const ts = new Date(e.ts).toISOString();
    const levelTag = e.level.toUpperCase().padEnd(5);
    lines.push(`[${ts}] ${levelTag} (${e.source}) ${e.message}`);
    if (e.stack) {
      // Indentar stack para que se vea como bloque.
      lines.push(e.stack.split("\n").map((l) => `    ${l}`).join("\n"));
    }
  }
  if (slice.length === 0) lines.push("(sin entradas)");
  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// Internos
// -----------------------------------------------------------------------------

function push(partial: Omit<LogEntry, "ts" | "url"> & { ts?: number; url?: string }): void {
  const entry: LogEntry = {
    ts: partial.ts ?? Date.now(),
    level: partial.level,
    source: partial.source,
    message: partial.message,
    stack: partial.stack,
    url: partial.url ?? (typeof window !== "undefined" ? window.location.href : undefined),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
  persist();
  notify();
}

function persist(): void {
  // Guardar solo en sessionStorage — no queremos llenar localStorage con
  // logs cross-session, pero sí queremos sobrevivir el reload tras un crash.
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // QuotaExceeded o SecurityError — ignoramos, los logs siguen en memoria.
  }
}

function notify(): void {
  const snapshot = entries.slice();
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      // No queremos que un listener mal escrito tire el sink.
    }
  }
}

function patchConsole(level: LogLevel): void {
  const orig = (console as unknown as Record<string, (...args: unknown[]) => void>)[level];
  if (typeof orig !== "function") return;
  (console as unknown as Record<string, (...args: unknown[]) => void>)[level] = (
    ...args: unknown[]
  ) => {
    try {
      const { message, stack } = formatArgs(args);
      push({ level, source: "console", message, stack });
    } catch {
      // Capturar errores del propio sink no debe romper la consola.
    }
    // Llamamos a la función original — DevTools sigue mostrando los logs.
    orig.apply(console, args);
  };
}

function formatArgs(args: unknown[]): { message: string; stack?: string } {
  if (args.length === 0) return { message: "" };
  let stack: string | undefined;
  const parts: string[] = [];
  for (const a of args) {
    if (a instanceof Error) {
      parts.push(a.message || a.toString());
      if (!stack) stack = a.stack;
    } else if (typeof a === "string") {
      parts.push(a);
    } else if (a == null) {
      parts.push(String(a));
    } else {
      try {
        parts.push(JSON.stringify(a));
      } catch {
        parts.push(String(a));
      }
    }
  }
  return { message: parts.join(" "), stack };
}
