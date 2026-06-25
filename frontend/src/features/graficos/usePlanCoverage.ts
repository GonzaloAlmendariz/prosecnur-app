import { useEffect, useState } from "react";
import {
  apiGraficosPlanCoverage,
  type GraficosCoverageResponse,
  type GraficosCoverageVariable,
} from "../../api/client";
import { usePlanStore } from "./store";
import { buildGraficosConfigFromStore } from "./configSnapshot";

const COVERAGE_DEBOUNCE_MS = 350;

export type PlanCoverageState = {
  coverage: GraficosCoverageResponse | null;
  loading: boolean;
  error: string;
};

export function usePlanCoverage(): PlanCoverageState {
  const plan = usePlanStore((s) => s.plan);
  const scopeRules = usePlanStore((s) => s.scopeRules);
  const hydrated = usePlanStore((s) => s.hydrated);
  const [coverage, setCoverage] = useState<GraficosCoverageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await apiGraficosPlanCoverage(plan, buildGraficosConfigFromStore());
        if (!cancelled) setCoverage(result);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, COVERAGE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [plan, scopeRules, hydrated]);

  return { coverage, loading, error };
}

export function variableCoverageRef(source: string, variable: GraficosCoverageVariable): string {
  const name = variable.name || "";
  if (!name) return "";
  return source && source !== "default" ? `${source}$${name}` : name;
}
