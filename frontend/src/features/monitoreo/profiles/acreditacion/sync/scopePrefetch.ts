import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { apiMonitoreoState, type MonitoreoState } from "../../../../../api/client";
import type { MonitoreoReportScope } from "../../types";
import { observarCorte, useResumenDelCorte } from "../navegacion/resumenDelCorte";

// Prefetch de scopes de fondo, extraído del page-file congelado
// (AcreditacionMonitoreoPage.tsx). Copia por perfil deliberada: telefónico es
// un fork vivo de acreditación; el gemelo vive en telefonico/sync/scopePrefetch.ts.

export type ScopePrefetchCacheRefs = {
  stateByScopeRef: MutableRefObject<Map<string, MonitoreoState>>;
  warmedScopesRef: MutableRefObject<Set<string>>;
  inFlightScopeRef: MutableRefObject<Map<string, Promise<MonitoreoState | null>>>;
  scopeCacheEpochRef: MutableRefObject<number>;
};

// Guarda los ids de los setTimeout del prefetch y los cancela al desmontar
// (unidad 1.5c): antes quedaban vivos y disparaban apiMonitoreoState pesados
// contra el Plumber mono-hilo después de salir del módulo.
export function usePrefetchTimeouts(): MutableRefObject<Set<number>> {
  const timeoutsRef = useRef(new Set<number>());
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      timeouts.clear();
    };
  }, []);
  return timeoutsRef;
}

export function schedulePrefetchScopes(
  refs: ScopePrefetchCacheRefs,
  timeoutsRef: MutableRefObject<Set<number>>,
  scopes: MonitoreoReportScope[],
  delayForIndex: (index: number) => number,
) {
  scopes.forEach((scope, index) => {
    if (refs.stateByScopeRef.current.has(scope)) {
      refs.warmedScopesRef.current.add(scope);
      return;
    }
    if (refs.warmedScopesRef.current.has(scope)) return;
    refs.warmedScopesRef.current.add(scope);
    const cacheEpoch = refs.scopeCacheEpochRef.current;
    const timer = window.setTimeout(() => {
      timeoutsRef.current.delete(timer);
      if (cacheEpoch !== refs.scopeCacheEpochRef.current) return;
      if (refs.stateByScopeRef.current.has(scope) || refs.inFlightScopeRef.current.has(scope)) return;
      const request = apiMonitoreoState({
        includeReports: true,
        reportScope: scope,
        warmupCache: true,
      }).then((next) => {
        if (cacheEpoch !== refs.scopeCacheEpochRef.current) return null;
        refs.stateByScopeRef.current.set(scope, next);
        // La barra del modo lee de aquí los casos y el avance aunque la
        // sección a la vista no los traiga (revamp, G1).
        observarCorte(next.dashboard?.acreditacion_reports, next.config?.goals ?? []);
        return next;
      }).catch(() => {
        if (scope === "queries_summary") useResumenDelCorte.getState().marcarFalloDeCasos();
        if (cacheEpoch !== refs.scopeCacheEpochRef.current) return null;
        refs.warmedScopesRef.current.delete(scope);
        return null;
      }).finally(() => {
        if (refs.inFlightScopeRef.current.get(scope) === request) refs.inFlightScopeRef.current.delete(scope);
      });
      refs.inFlightScopeRef.current.set(scope, request);
      void request;
    }, delayForIndex(index));
    timeoutsRef.current.add(timer);
  });
}
