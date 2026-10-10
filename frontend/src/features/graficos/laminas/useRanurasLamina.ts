// Geometría de las ranuras de la lámina seleccionada, desde la composición efectiva de la plantilla.

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { Slide } from "../../../api/graficos";
import { slideCompositionRevision } from "../slideCompositionPersistence";
import { useGraficosReportScope } from "../reportScope";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { slideCompositionIdentityFromScopeRules, useSlideCompositions } from "../useSlideCompositions";
import { ranurasSobreLamina, type RanuraSobreLamina } from "./ranurasLamina";

export function useRanurasLamina(slide: Slide | null): RanuraSobreLamina[] {
  const { search } = useLocation();
  const scope = useGraficosReportScope(search);
  const scopeRules = usePlanStore((s) => s.scopeRules);
  const revision = usePlanStore(slideCompositionRevision);
  const { registry } = useGraficosRegistry();
  const identidad = useMemo(() => ({ ...slideCompositionIdentityFromScopeRules(scopeRules), scope }), [scopeRules, scope]);
  const { compositions } = useSlideCompositions(registry?.slides ?? [], identidad, revision);
  return useMemo(() => {
    if (!slide) return [];
    const res = compositions[slide.tipo];
    if (res?.status !== "ready") return [];
    return ranurasSobreLamina(SLIDE_GRAF_SLOTS[slide.tipo] ?? [], res.composition.regions);
  }, [slide, compositions]);
}
