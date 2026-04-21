import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiCreateSession, apiHealth, apiSessionState, SessionState } from "../api/client";

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

  useEffect(() => {
    (async () => {
      try {
        const h = await apiHealth();
        setVersion(`app v${h.version} · prosecnur v${h.prosecnur_version}`);
        const s = await apiCreateSession();
        setSessionId(s.session_id);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    })();
  }, []);

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
        setSessionId(newSid);
        setSessionLost(false);  // si había banner viejo, lo limpiamos
      }
    }
    window.addEventListener("pulso:session-changed", onChanged);
    return () => window.removeEventListener("pulso:session-changed", onChanged);
  }, [sessionId]);

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
