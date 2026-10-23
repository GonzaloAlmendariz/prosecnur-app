import type {
  MonitoreoTerritorialDashboard,
  TerritorialQuotaProgressBlock,
  TerritorialQuotaProgressItem,
} from "../../../../../../api/client";

/**
 * Corte de prueba con la forma real de `route_quota_progress` y
 * `operational_adjustments` del motor (ACNURCG, 9/07/26), reducido a tres UMP y
 * con aplicadores ficticios. Las claves vienen como las publica el motor:
 * distritos en mayúsculas y sin tildes, tramos «18-29» y «60+», tipos
 * «titular» y «reemplazo», estados en inglés.
 */

const item = (label: string, target: number, achieved: number, delta = 0): TerritorialQuotaProgressItem => ({
  label,
  target,
  achieved,
  missing: Math.max(0, target - achieved),
  operational_adjustment_delta: delta,
});

function bloque(extra: Partial<TerritorialQuotaProgressBlock> & Pick<TerritorialQuotaProgressBlock, "id_manzana" | "ump">): TerritorialQuotaProgressBlock {
  return {
    distrito: "SAN MARTIN DE PORRES",
    ubigeo: "150135",
    zona: "06300",
    manzana: "0590",
    tipo_manzana: "titular",
    responsable: "P132 · Aplicadora de Prueba",
    configured: true,
    status: "complete",
    operational_group_selected: true,
    target: 8,
    validas: 8,
    missing_total: 0,
    last_response_date_iso: "2026-06-13",
    sex: [item("Hombre", 4, 4), item("Mujer", 4, 4)],
    age: [item("18-29", 2, 2), item("30-44", 3, 3), item("45-59", 2, 2), item("60+", 1, 1)],
    cross: [],
    missing: [],
    observed_cross: {
      total: 8,
      total_consentido: 8,
      rows: [
        { label: "Hombre", target: 4, total: 4, cells: [{ label: "18-29", value: 1 }, { label: "30-44", value: 2 }, { label: "45-59", value: 1 }, { label: "60+", value: 0 }] },
        { label: "Mujer", target: 4, total: 4, cells: [{ label: "18-29", value: 1 }, { label: "30-44", value: 1 }, { label: "45-59", value: 1 }, { label: "60+", value: 1, adjustment_delta: 1 }] },
      ],
      columns: [{ label: "18-29", target: 2, total: 2 }, { label: "30-44", target: 3, total: 3 }, { label: "45-59", target: 2, total: 2 }, { label: "60+", target: 1, total: 1 }],
    } as unknown as TerritorialQuotaProgressBlock["observed_cross"],
    ...extra,
  };
}

const ump143 = bloque({
  id_manzana: "150135063000590",
  ump: "143",
  status: "pending",
  validas: 8,
  missing_total: 1,
  operational_adjustment_gain: 1,
  age: [item("18-29", 2, 2), item("30-44", 3, 2), item("45-59", 2, 3, 1), item("60+", 1, 1)],
});
const ump143r = bloque({
  id_manzana: "150135063000600",
  ump: "143",
  manzana: "0600",
  tipo_manzana: "reemplazo",
  status: "missing",
  validas: 0,
  operational_group_selected: false,
});
const ump7 = bloque({
  id_manzana: "150103007000100",
  ump: "7",
  distrito: "ATE",
  manzana: "0100",
  tipo_manzana: "reemplazo",
  status: "subsanada",
  responsable: "P375 · Aplicador de Prueba",
  operational_adjustment_gain: 1,
  sex: [item("Hombre", 4, 4), item("Mujer", 4, 5, 1)],
});
const ump35 = bloque({ id_manzana: "150108035000200", ump: "35", distrito: "CHORRILLOS", manzana: "0200", responsable: "" });

export const CORTE_DE_CUOTAS = {
  report_scope: "advance_summary",
  advance: { total_respuestas: 25, validas: 24, observacion: 3, observacion_aprobada: 0, no_validas: 1, meta: 24, avance_pct: 100, brecha: 0, district_progress: [], block_progress: [], daily: [] },
  route_quota_progress: {
    schema: "monitoreo_territorial_quota_progress_v1",
    configured: true,
    blocks: [ump143, ump143r, ump7, ump35],
    ump_groups: [
      { ump: "7", status: "subsanada", selected_id_manzana: ump7.id_manzana },
      { ump: "35", status: "complete", selected_id_manzana: ump35.id_manzana },
      { ump: "143", status: "pending", selected_id_manzana: ump143.id_manzana },
    ],
    districts: [
      { distrito: "SAN MARTIN DE PORRES", configured: true, status: "complete", target: 200, validas: 215, missing_total: 0, sex: [item("Hombre", 100, 111), item("Mujer", 100, 112)], age: [item("18-29", 50, 53), item("30-44", 75, 74), item("45-59", 50, 61), item("60+", 25, 28)], missing: [] },
      { distrito: "SAN JUAN DE LURIGANCHO", configured: true, status: "complete", target: 200, validas: 207, missing_total: 0, sex: [item("Hombre", 100, 104), item("Mujer", 100, 104)], age: [item("18-29", 50, 52), item("30-44", 75, 77), item("45-59", 50, 51), item("60+", 25, 28)], missing: [] },
    ],
  },
  operational_adjustments: {
    schema: "monitoreo_territorial_operational_adjustments_v1",
    deficits: [
      { id: "deficit::150135063000590::campo::30_44", district: "SAN MARTIN DE PORRES", sex: "", age_group: "30-44", target_block_id: ump143.id_manzana, target_ump: "UMP 143", missing: 1, match_status: "eligible" },
      { id: "deficit::150135063000600::hombre::18_29", district: "SAN MARTIN DE PORRES", sex: "Hombre", age_group: "18-29", target_block_id: ump143r.id_manzana, target_ump: "UMP 143", missing: 1, match_status: "blocked" },
    ],
    suggestions: [
      { id: "oppkg_prueba", district: "SAN MARTIN DE PORRES", sex: "Hombre", age_group: "30-44", source_block_id: "150135062000440", source_ump: "UMP 142", source_manzana: "0440", target_block_id: ump143.id_manzana, target_ump: "UMP 143", source_response_ids: ["a"], count: 1, distance_km: 0.45, reason: "Paquete de subsanación que cierra la UMP completa" },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;
