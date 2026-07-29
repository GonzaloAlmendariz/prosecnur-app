// Adaptadores del contrato de corte por perfil de Monitoreo.
//
// Cada perfil guarda sus conteos en un sitio distinto del payload, pero todos
// hablan de los mismos tres granos. Estos adaptadores son la única traducción
// autorizada: si una superficie necesita "cuántas válidas hay", pide el corte,
// no rebusca en `reports`.

import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../api/client";
import { construirCorte, type MonitoreoCorte } from "./corteContract";

function numero(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Territorial. `consentidas` es el grano procesable —las respuestas que pasan el
 * filtro de la fuente— y `advance.validas` el oficial. La auditoría vio los tres
 * números conviviendo sin nombre: 36 recibidas, 22 filtradas, 0 válidas.
 */
export function corteTerritorial(
  state: MonitoreoState | null | undefined,
  reports: MonitoreoTerritorialDashboard | null | undefined,
): MonitoreoCorte {
  const kpis = reports?.kpis;
  const advance = reports?.advance;

  return construirCorte({
    ingesta: numero(state?.n_rows) ?? numero(kpis?.total_respuestas) ?? 0,
    procesable: numero(kpis?.consentidas),
    oficial: numero(advance?.validas) ?? numero(kpis?.validas),
    meta: numero(advance?.meta) ?? numero(kpis?.meta),
    cutAt: state?.synced_at || reports?.generated_at || "",
    hasSnapshot: Boolean(state?.has_snapshot),
    generationStatus: state?.generation_status,
    reglaProcesable: "Respuestas sin consentimiento o fuera del filtro de la fuente.",
    direccionProcesable: "seccion=fuentes&pestana=filter",
    reglaOficial: "Casos en revisión o no defendibles que no cuentan como avance.",
    direccionOficial: "seccion=consultas&pestana=registro",
  });
}

export type CorteAcreditacionAporte = {
  universe: number;
  effective: number;
  meta: number | null;
};

/**
 * Acreditación. El avance vive repartido en tarjetas por actor, así que el grano
 * oficial es la suma de efectivas y la meta la suma de metas declaradas. Cuando
 * no hay tarjetas, el oficial queda `null` —"efectivas sin determinar"— en vez
 * de colapsar a cero, que es lo que hacía que `EFECTIVAS S/D` conviviera con
 * botones habilitados.
 */
export type CorteAcreditacionOpciones = {
  generatedAt?: string;
  /** Telefónico exige tres fuentes (base, barrido, Kobo); acreditación las declara. */
  fuentesActivas?: number | null;
  fuentesRequeridas?: number | null;
};

export function corteAcreditacion(
  state: MonitoreoState | null | undefined,
  aportes: readonly CorteAcreditacionAporte[],
  opciones: CorteAcreditacionOpciones = {},
): MonitoreoCorte {
  const hayAportes = aportes.length > 0;
  // El universo se trata como la meta: hay que distinguir «ninguna tarjeta lo
  // declara» de «suma cero». `advanceCardsFromRows` usa `rowNumber(row,
  // COL_UNIVERSO, 0)`, así que una fila sin esa columna aporta un 0 silencioso
  // —es lo que pasa con las filas del reporte telefónico—, y sumarlos daba un
  // procesable en cero que convivía con cientos de efectivas.
  const universosDeclarados = aportes.filter((card) => (numero(card.universe) ?? 0) > 0);
  const universe = universosDeclarados.reduce((sum, card) => sum + (numero(card.universe) ?? 0), 0);
  const effective = aportes.reduce((sum, card) => sum + (numero(card.effective) ?? 0), 0);
  const metasDeclaradas = aportes.filter((card) => numero(card.meta) != null);
  const meta = metasDeclaradas.length
    ? metasDeclaradas.reduce((sum, card) => sum + (numero(card.meta) ?? 0), 0)
    : null;

  return construirCorte({
    ingesta: numero(state?.n_rows) ?? 0,
    procesable: hayAportes && universosDeclarados.length ? universe : null,
    oficial: hayAportes ? effective : null,
    meta,
    cutAt: state?.synced_at || opciones.generatedAt || "",
    hasSnapshot: Boolean(state?.has_snapshot),
    generationStatus: state?.generation_status,
    reglaProcesable: "Registros fuera del universo declarado por actor.",
    direccionProcesable: "seccion=fuentes&pestana=estado",
    reglaOficial: "Casos sin encuesta efectiva registrada.",
    direccionOficial: "seccion=avance&pestana=actores",
    fuentesActivas: opciones.fuentesActivas,
    fuentesRequeridas: opciones.fuentesRequeridas,
  });
}
