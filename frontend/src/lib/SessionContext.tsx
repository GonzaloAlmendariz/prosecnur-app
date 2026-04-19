import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiCreateSession, apiHealth, apiSessionState, SessionState } from "../api/client";

type Ctx = {
  sessionId: string;
  version: string;
  state: SessionState | null;
  refresh: () => Promise<void>;
  error: string;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>("");
  const [version, setVersion] = useState<string>("…");
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string>("");

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

  const value = useMemo(() => ({ sessionId, version, state, refresh, error }), [sessionId, version, state, refresh, error]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
