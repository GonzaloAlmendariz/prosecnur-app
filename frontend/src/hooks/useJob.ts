import { useEffect, useRef, useState } from "react";
import { apiJobCancel, apiJobStatus, JobSnapshot } from "../api/client";

type UseJobResult<T> = {
  snapshot: JobSnapshot<T> | null;
  error: string;
  cancel: () => Promise<void>;
};

export function useJob<T = unknown>(jobId: string | null): UseJobResult<T> {
  const [snapshot, setSnapshot] = useState<JobSnapshot<T> | null>(null);
  const [error, setError] = useState<string>("");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!jobId) {
      setSnapshot(null);
      setError("");
      return;
    }
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const snap = await apiJobStatus<T>(jobId);
        if (cancelled) return;
        setSnapshot(snap);
        if (snap.status === "running") {
          const delay = Date.now() - startedAt > 15000 ? 1500 : 500;
          timeoutRef.current = window.setTimeout(poll, delay);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    void poll();

    return () => {
      cancelled = true;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [jobId]);

  async function cancel() {
    if (!jobId) return;
    try {
      await apiJobCancel(jobId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return { snapshot, error, cancel };
}
