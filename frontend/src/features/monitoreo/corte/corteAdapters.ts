// Adaptadores del contrato de corte por perfil de Monitoreo.
//
// Cada perfil guarda sus conteos en un sitio distinto del payload, pero todos
// hablan de los mismos tres granos. Estos adaptadores son la única traducción
// autorizada: si una superficie necesita "cuántas válidas hay", pide el corte,
// no rebusca en `reports`.

import type {
  MonitoreoAulasDashboard,
  MonitoreoState,
  MonitoreoTerritorialDashboard,
} from "../../../api/client";
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

/**
 * Cursos-horario. El grano procesable es `filter_passed` —las respuestas que
 * pasan el filtro declarado en la fuente— y el oficial `respuestas_validas`.
 *
 * La meta se suma sobre `expected_valid` del plan, no sobre `brecha`: el engine
 * define la brecha como `max(0, expected_valid - validas)`, así que un aula que
 * sobrecumple aporta su brecha en cero y reconstruir la meta como
 * `validas + brecha` la inflaría hasta el sobrecumplimiento. Se excluye el pool
 * de reservas extra por la misma razón que el engine lo excluye de
 * `avance_por_estrato`: son aulas que todavía no pertenecen a la muestra.
 */
export function corteAulas(
  state: MonitoreoState | null | undefined,
  dashboard: MonitoreoAulasDashboard | null | undefined,
): MonitoreoCorte {
  const kpis = dashboard?.kpis;
  // La meta la publica el MOTOR, no se recompone acá.
  //
  // Se sumaba `expected_valid` sobre la agenda quitando el banco, y eso da
  // 4 336 donde el estudio pide 3 743: la agenda trae TODOS los eslabones de
  // cada cadena y la meta es de una aula por cadena —la que está en juego—,
  // porque las reservas dormidas no piden respuestas hasta que entran. El
  // resultado era la misma palabra con dos cifras en el mismo módulo: la
  // tarjeta de Salidas decía «meta 4 336» mientras Avance decía 3 743 en tres
  // paneles distintos.
  //
  // El motor ya calcula esa suma sobre el conjunto en juego y la manda dentro
  // de `ritmo_diario`, con un comentario que dice justamente que viaja ahí para
  // que la vista no tenga que recomponerla. Se usa ésa.
  const metaDelMotor = numero(dashboard?.ritmo_diario?.meta);
  const meta = metaDelMotor != null && metaDelMotor > 0 ? metaDelMotor : null;

  return construirCorte({
    ingesta: numero(state?.n_rows) ?? numero(kpis?.respuestas_total) ?? 0,
    procesable: numero(kpis?.filter_passed),
    oficial: numero(kpis?.respuestas_validas),
    meta,
    cutAt: state?.synced_at || dashboard?.generated_at || "",
    hasSnapshot: Boolean(state?.has_snapshot),
    generationStatus: state?.generation_status,
    reglaProcesable: "Respuestas fuera del filtro declarado para la aplicación en aula.",
    direccionProcesable: "seccion=fuentes",
    reglaOficial: "Respuestas sin curso-horario reconocido o descartadas por el control de validez.",
    direccionOficial: "seccion=calidad",
  });
}
