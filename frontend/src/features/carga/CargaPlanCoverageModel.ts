// Filas de «Qué tiene cada base» en Carga › Plan.
//
// F9 (matriz HSyVbG, 2026-10-15): al elegir «Varias bases» en un estudio que ya
// tenía su base (`default`), la tabla decía «Aún no hay bases creadas · BASES 0»
// con la base cargada. La lista de bases sale del payload del estudio, que la
// página sólo pide cuando el estudio YA es multibase; mientras «Varias bases» es
// un plan sobre una carga simple, esa lista llega vacía. La base existente no
// deja de existir por elegir el plan: si la lista viene vacía y la carga simple
// tiene formulario o respuestas, esa base sigue siendo una fila.

import type { EstudioBase } from "../../api/client";
import type { CargaTopologyResolution } from "./CargaTopologyModel";

export type CoverageState = "ready" | "attention" | "pending";

export type CoverageRow = {
  key: string;
  label: string;
  meta: string;
  hasInstrument: boolean;
  hasData: boolean;
  state: CoverageState;
};

export type CoverageSummary = {
  rows: CoverageRow[];
  baseCount: number;
  instrumentCount: number;
  dataCount: number;
};

function baseLabel(base: EstudioBase) {
  return String(base.source_alias || base.source_title || base.nombre || "").trim() || base.nombre;
}

function sourceLabel(base: EstudioBase) {
  if (base.source_kind === "surveymonkey") return "SurveyMonkey";
  if (base.source_kind === "kobo_repeat") return "Kobo · grupo repetido";
  if (base.source_kind?.startsWith("kobo")) return "KoboToolbox";
  return "Archivo o fuente local";
}

function baseMeta(base: EstudioBase) {
  const rows = typeof base.n_filas === "number"
    ? `${base.n_filas.toLocaleString("es-PE")} filas`
    : "filas por contar";
  const columns = typeof base.n_columnas === "number"
    ? `${base.n_columnas.toLocaleString("es-PE")} columnas`
    : "columnas por contar";
  return `${sourceLabel(base)} · ${rows} · ${columns}`;
}

export function rowState(hasInstrument: boolean, hasData: boolean): CoverageState {
  if (hasInstrument && hasData) return "ready";
  if (hasInstrument || hasData) return "attention";
  return "pending";
}

function singleRow(hasInstrument: boolean, hasData: boolean, meta: string): CoverageRow {
  return {
    key: "single",
    label: "Base del estudio",
    meta,
    hasInstrument,
    hasData,
    state: rowState(hasInstrument, hasData),
  };
}

export function coverageSummary({
  topology,
  bases,
  hasInstrument,
  hasData,
}: {
  topology: CargaTopologyResolution;
  bases: readonly EstudioBase[];
  hasInstrument: boolean;
  hasData: boolean;
}): CoverageSummary {
  const topologyDefined = topology.mode !== "undecided";
  let rows: CoverageRow[];
  if (topology.mode === "multi" && bases.length > 0) {
    rows = bases.map((base) => {
      const baseHasInstrument = Boolean(base.xlsform_file_id);
      const baseHasData = Boolean(base.data_file_id);
      return {
        key: base.nombre,
        label: baseLabel(base),
        meta: baseMeta(base),
        hasInstrument: baseHasInstrument,
        hasData: baseHasData,
        state: rowState(baseHasInstrument, baseHasData),
      };
    });
  } else if (topology.mode === "multi") {
    // Plan de varias bases sobre una carga simple: la base que ya existe sigue.
    rows = hasInstrument || hasData
      ? [singleRow(
          hasInstrument,
          hasData,
          `Base que ya tiene el estudio · ${hasData ? "respuestas conectadas" : "aún sin respuestas"}`,
        )]
      : [];
  } else if (topologyDefined) {
    rows = [singleRow(
      hasInstrument,
      hasData,
      hasData ? "Respuestas conectadas a esta sesión" : "Aún sin respuestas conectadas",
    )];
  } else {
    rows = [];
  }
  return {
    rows,
    baseCount: rows.length,
    instrumentCount: rows.filter((row) => row.hasInstrument).length,
    dataCount: rows.filter((row) => row.hasData).length,
  };
}
