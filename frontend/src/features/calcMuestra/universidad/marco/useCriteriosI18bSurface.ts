import { useMemo } from "react";
import type {
  CalcMuestraAulasFrame,
  CalcMuestraWorkspaceAulasConfig,
  CriteriosSeleccionMarco,
} from "../../../../api/calcMuestra";
import {
  accreditCalcMuestraCriteriosI18bInventory,
  normalizeCalcMuestraCriteriosI18bBundle,
  type CalcMuestraCriteriosI18bInventoryEntry,
  type CalcMuestraCriteriosPreviewInput,
} from "../../../../api/calcMuestraCriteriosI18b";
import type { CalcMuestraAulasCriteriosRadiografiaV2 } from "../../../../api/calcMuestraCriteriosRadiografia";

export type CriteriosI18bSurfaceSource = {
  frame: CalcMuestraAulasFrame | null;
  config: CalcMuestraWorkspaceAulasConfig;
  borrador: CriteriosSeleccionMarco;
  previewEnabled: boolean;
  /**
   * G41 · Los filtros legacy, traducidos igual que en el build.
   *
   * El motor lee la composición de `config.filters` —así la manda `construir`,
   * con `filtrosLegacyPayload`— pero la tarjeta los edita en la RAÍZ del config
   * de aulas. El preview recibía el config crudo, así que sus umbrales le
   * llegaban en un sitio donde no mira: evaluaba la composición como apagada y
   * devolvía la misma cascada pasara lo que pasara con el deslizador.
   *
   * Medido con el motor: mismo borrador, `filters` puestos → el paso corta 2→1;
   * en la raíz → 2→2 y `applies = FALSE`.
   */
  filtersPayload?: Record<string, unknown> | null;
};

export function useCriteriosI18bSurface(
  source: CriteriosI18bSurfaceSource | null | undefined,
  fallbackFrameHash: string | null,
  radiography: CalcMuestraAulasCriteriosRadiografiaV2 | null,
) {
  const frame = source?.frame ?? null;
  const frameHash = frame?.frame_hash ?? fallbackFrameHash;
  const normalized = useMemo(
    () => normalizeCalcMuestraCriteriosI18bBundle({
      frameHash,
      totals: frame?.criterios_totales,
      cascade: frame?.criterios_cascada,
      anchors: frame?.criterios_anclas_historicas,
    }),
    [
      frame?.criterios_anclas_historicas,
      frame?.criterios_cascada,
      frame?.criterios_totales,
      frameHash,
    ],
  );
  const inventory = useMemo<CalcMuestraCriteriosI18bInventoryEntry[]>(() => (
    radiography?.criterios.map((entry) => {
      const segments = new Map<string, { segment_key: string; segment_kind: string }>();
      const facultyKeys = new Set<string>();
      for (const row of entry.rows) {
        segments.set(`${row.segment_key}\u0000${row.segment_kind}`, {
          segment_key: row.segment_key,
          segment_kind: row.segment_kind,
        });
        facultyKeys.add(row.faculty_key);
      }
      return {
        criterion_id: entry.id,
        card_id: entry.card_id,
        faculty_dimension: entry.faculty_dimension,
        faculty_keys: [...facultyKeys],
        segments: [...segments.values()],
      };
    }) ?? []
  ), [radiography]);
  const includedCh = useMemo(() => {
    if (!frame?.aula_frame) return null;
    return frame.aula_frame.filter((row) => row.included === true).length;
  }, [frame?.aula_frame]);
  const i18b = useMemo(
    () => accreditCalcMuestraCriteriosI18bInventory(
      normalized,
      inventory,
      includedCh,
    ),
    [includedCh, inventory, normalized],
  );
  const previewRequest = useMemo<CalcMuestraCriteriosPreviewInput | null>(() => {
    if (
      !source?.previewEnabled || !frameHash || i18b.status !== "complete" ||
      !i18b.cascade
    ) return null;
    return {
      source_frame_hash: frameHash,
      criteria_hash: i18b.cascade.criteria_hash,
      config: {
        ...source.config,
        criterios_seleccion: source.borrador,
        ...(source.filtersPayload ? { filters: source.filtersPayload } : {}),
      } as Record<string, unknown>,
    };
  }, [
    frameHash, i18b.cascade, source?.borrador, source?.config,
    source?.filtersPayload, source?.previewEnabled,
  ]);

  return {
    ...i18b,
    previewRequest,
    rawRadiographyPresent: frame?.criterios_radiografia != null,
  };
}
