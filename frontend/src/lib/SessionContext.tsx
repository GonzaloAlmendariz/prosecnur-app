import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  apiCreateSession,
  apiHealth,
  apiSessionState,
  apiSystemBootstrap,
  SessionState,
} from "../api/client";
import { note as logNote } from "./logSink";

type Ctx = {
  sessionId: string;
  version: string;
  state: SessionState | null;
  refresh: () => Promise<void>;
  error: string;
  // `sessionLost` sube a true cuando alguna request devuelve E_NO_SESSION.
  // Típicamente porque el backend se reinició (el `sid` del browser ya no
  // existe en el store en memoria). La app puede pintar un banner global
  // con "Recargar página" para guiar al usuario sin que aparezca el error
  // crudo en los pickers.
  sessionLost: boolean;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>("");
  const [version, setVersion] = useState<string>("…");
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string>("");
  const [sessionLost, setSessionLost] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await apiSessionState();
      setState(s);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [sessionId]);

  // Coacciona y valida antes de actualizar el state. Cualquier valor que
  // no sea un string no vacío queda registrado en logSink (visible con
  // Cmd+Shift+L) — usar para cazar respuestas malformadas del backend
  // sin tumbar toda la app vía SessionChip.
  const setSessionIdSafe = useCallback((source: string, v: unknown) => {
    if (typeof v === "string" && v.length > 0) {
      setSessionId(v);
    } else {
      logNote(
        `setSessionId(${source}) recibió valor inválido: typeof=${typeof v} value=${JSON.stringify(v)}`,
        "error",
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const h = await apiHealth();
        setVersion(`app v${h.version} · prosecnur v${h.prosecnur_version}`);
        // Bootstrap: si el backend arrancó con PULSO_BOOTSTRAP_PROJECT,
        // adoptamos su sid en vez de crear una sesión efímera. El backend
        // lo "consume" una sola vez (recargas posteriores reciben null).
        const bs = await apiSystemBootstrap().catch(() => ({ sid: null }));
        // jsonlite (R) serializa `NULL` dentro de un objeto como `{}`, no
        // como `null`. Sin la guarda de string, `if (bs.sid)` daba truthy
        // para `{}` y `setSessionIdSafe` rechazaba el valor; se quedaba
        // sin sid y la app no podía hablar con el backend.
        if (typeof bs.sid === "string" && bs.sid.length > 0) {
          localStorage.setItem("pulso.sessionId", bs.sid);
          setSessionIdSafe("bootstrap", bs.sid);
          setSessionLost(false);
          return;
        }
        const s = await apiCreateSession();
        setSessionIdSafe("create", s.session_id);
        setSessionLost(false);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    })();
  }, [setSessionIdSafe]);

  useEffect(() => {
    if (sessionId) void refresh();
  }, [sessionId, refresh]);

  // Escucha el evento emitido por `client.ts` cuando alguna respuesta
  // trae E_NO_SESSION. Marca el flag una sola vez (no parpadea por cada
  // request subsecuente).
  useEffect(() => {
    function onLost() {
      setSessionLost(true);
    }
    window.addEventListener("pulso:session-lost", onLost);
    return () => window.removeEventListener("pulso:session-lost", onLost);
  }, []);

  // Backend cambió el sid (ej. al cargar un demo → session_create fresh).
  // Actualizamos el state → gatillamos refresh() via el useEffect anterior,
  // y `sessionId` cambia como dependencia para que hooks que dependan de
  // ella (autosave, etc.) re-hidraten.
  useEffect(() => {
    function onChanged(ev: Event) {
      const detail = (ev as CustomEvent).detail as { new_sid?: string } | undefined;
      const newSid = detail?.new_sid;
      if (newSid && newSid !== sessionId) {
        setSessionIdSafe("event", newSid);
        setSessionLost(false);  // si había banner viejo, lo limpiamos
      }
    }
    window.addEventListener("pulso:session-changed", onChanged);
    return () => window.removeEventListener("pulso:session-changed", onChanged);
  }, [sessionId, setSessionIdSafe]);

  const value = useMemo(
    () => ({ sessionId, version, state, refresh, error, sessionLost }),
    [sessionId, version, state, refresh, error, sessionLost],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
