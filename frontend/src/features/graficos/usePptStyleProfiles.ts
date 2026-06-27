import { useEffect, useState } from "react";
import { apiGraficosPptStyleProfiles, type PptStyleProfileMeta } from "../../api/client";

type PptStyleProfilesState = {
  profiles: PptStyleProfileMeta[];
  loading: boolean;
  error: string;
};

let cache: PptStyleProfileMeta[] | null = null;
let pending: Promise<PptStyleProfileMeta[]> | null = null;

export function usePptStyleProfiles(): PptStyleProfilesState {
  const [profiles, setProfiles] = useState<PptStyleProfileMeta[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cache) return;
    if (!pending) {
      pending = apiGraficosPptStyleProfiles().then((r) => {
        const next = Array.isArray(r.style_profiles) ? r.style_profiles : [];
        cache = next;
        pending = null;
        return next;
      });
    }
    pending
      .then((next) => {
        setProfiles(next);
        setError("");
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return { profiles, loading, error };
}
