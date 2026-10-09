/**
 * Qué escenario dimensiona el estudio, y de dónde lo sabemos.
 *
 * `universityAulasScenario()` responde `e1` siempre que nadie haya elegido, y
 * esa respuesta por defecto es indistinguible de una decisión tomada. En
 * HSVG 2026 eso produjo tres superficies con tres respuestas: el KPI de la tira
 * y `aulas_config.n_aulas` decían 165 (componente Universidad, el que sale por
 * defecto) mientras el sorteo sellado el 2026-08-26 llevaba 174 aulas y seguía
 * al componente Facultades facultad por facultad, en las quince, sin una sola
 * discrepancia. `motor_recorrido.decisiones` estaba vacío: el escenario nunca
 * se eligió, y nada en pantalla lo advertía.
 *
 * Una corrida sellada es evidencia de con qué se dimensionó: se ejecutó contra
 * un reparto concreto y ese reparto es de un componente. Así que cuando la
 * decisión no está declarada, el sorteo la dice mejor que el valor por defecto.
 *
 * Dos reglas que este módulo no rompe:
 *
 * - Una decisión declarada MANDA, aunque el sorteo diga otra cosa (ADR 0074: el
 *   proyecto guarda decisiones, no defaults). Lo que hacemos con la
 *   contradicción es publicarla en `discrepa`, no resolverla por nuestra cuenta.
 * - La inferencia exige calce EXACTO con un único componente. Dos componentes
 *   que calcen, o ninguno, dejan el origen en `defecto`: preferimos declarar
 *   que no sabemos antes que adivinar.
 */
import type {
  CalcMuestraAulasSelection,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "./constants";
import type { UniversityAulasScenario } from "./study";

/** De dónde sale el escenario que la pantalla está usando. */
export type OrigenEscenario =
  /** Alguien lo eligió y quedó en `motor_recorrido.decisiones.escenario`. */
  | "declarado"
  /** Nadie lo eligió, pero el sorteo ejecutado calza con un componente. */
  | "sorteo"
  /** Nadie lo eligió y no hay corrida que lo delate: `e1` por convención. */
  | "defecto";

export type EscenarioEnVigor = {
  escenario: UniversityAulasScenario;
  origen: OrigenEscenario;
  /** Lo que el proyecto declara, o `null` si nadie eligió. */
  declarado: UniversityAulasScenario | null;
  /** Lo que el sorteo delata, o `null` si no hay corrida o no calza. */
  delSorteo: UniversityAulasScenario | null;
  /** Titulares de la corrida sellada. `null` cuando no hay corrida. */
  titularesSorteados: number | null;
  /**
   * El sorteo se ejecutó contra un componente distinto del declarado. No lo
   * corregimos: lo decimos. Un estudio en este estado tiene el número del
   * diseño y el número de lo ejecutado en desacuerdo.
   */
  discrepa: boolean;
};

const ACTOR_POR_ESCENARIO: Record<UniversityAulasScenario, string> = {
  e1: UNIVERSITY_TOTAL_COMPONENT_ID,
  e2: UNIVERSITY_FACULTY_COMPONENT_ID,
};

/**
 * Titulares por facultad de la corrida sellada. `null` cuando no hay corrida o
 * cuando no trae ni un titular: un mapa vacío calzaría con cualquier cosa.
 */
export function titularesPorFacultad(
  seleccion: CalcMuestraAulasSelection | null | undefined,
): Map<string, number> | null {
  const filas = seleccion?.selection;
  if (!Array.isArray(filas) || filas.length === 0) return null;
  const cuenta = new Map<string, number>();
  for (const fila of filas) {
    if (String(fila?.sample_role ?? "") !== "titular") continue;
    const facultad = String(fila?.faculty ?? "").trim();
    if (!facultad) continue;
    cuenta.set(facultad, (cuenta.get(facultad) ?? 0) + 1);
  }
  return cuenta.size > 0 ? cuenta : null;
}

/** `aulas_base` por estrato del componente. `null` si no publicó reparto. */
function repartoDelComponente(
  componente: CalcMuestraComponente | undefined,
): Map<string, number> | null {
  const filas = componente?.resultado?.aulas_por_estrato;
  if (!Array.isArray(filas) || filas.length === 0) return null;
  const mapa = new Map<string, number>();
  for (const fila of filas) {
    const estrato = String(fila?.estrato ?? "").trim();
    if (!estrato) continue;
    mapa.set(estrato, Number(fila?.aulas_base) || 0);
  }
  return mapa.size > 0 ? mapa : null;
}

/**
 * Calce exacto: mismas facultades y mismo número en cada una. Un calce parcial
 * no sirve —los dos componentes de HSVG 2026 coincidían en nueve de quince— y
 * comparar sólo los totales tampoco: dos repartos distintos pueden sumar igual.
 */
function calzaExacto(reparto: Map<string, number>, sorteo: Map<string, number>): boolean {
  if (reparto.size !== sorteo.size) return false;
  for (const [facultad, aulas] of sorteo) {
    if (reparto.get(facultad) !== aulas) return false;
  }
  return true;
}

export function escenarioEnVigor({
  workspace,
  componentes,
  seleccion,
}: {
  workspace: CalcMuestraWorkspace | null | undefined;
  componentes: readonly CalcMuestraComponente[];
  seleccion: CalcMuestraAulasSelection | null | undefined;
}): EscenarioEnVigor {
  const crudo = workspace?.motor_recorrido?.decisiones?.escenario;
  const declarado: UniversityAulasScenario | null =
    crudo === "e1" || crudo === "e2" ? crudo : null;

  const sorteo = titularesPorFacultad(seleccion);
  const titularesSorteados = sorteo
    ? [...sorteo.values()].reduce((suma, n) => suma + n, 0)
    : null;

  let delSorteo: UniversityAulasScenario | null = null;
  if (sorteo) {
    const calzan = (["e1", "e2"] as const).filter((candidato) => {
      const componente = componentes.find((c) => c.actor_id === ACTOR_POR_ESCENARIO[candidato]);
      const reparto = repartoDelComponente(componente);
      return reparto ? calzaExacto(reparto, sorteo) : false;
    });
    // Un único calce es evidencia. Dos calces significan que los componentes
    // reparten igual y el sorteo no distingue: eso no delata nada.
    if (calzan.length === 1) delSorteo = calzan[0];
  }

  if (declarado) {
    return {
      escenario: declarado,
      origen: "declarado",
      declarado,
      delSorteo,
      titularesSorteados,
      discrepa: delSorteo != null && delSorteo !== declarado,
    };
  }
  if (delSorteo) {
    return {
      escenario: delSorteo,
      origen: "sorteo",
      declarado: null,
      delSorteo,
      titularesSorteados,
      discrepa: false,
    };
  }
  return {
    escenario: "e1",
    origen: "defecto",
    declarado: null,
    delSorteo: null,
    titularesSorteados,
    discrepa: false,
  };
}

/** El componente con el que el estudio está dimensionado de verdad. */
export function componenteEnVigor(
  componentes: readonly CalcMuestraComponente[],
  vigor: EscenarioEnVigor,
): CalcMuestraComponente | undefined {
  return componentes.find((c) => c.actor_id === ACTOR_POR_ESCENARIO[vigor.escenario]);
}

/**
 * Si un clic en el selector tiene que escribirse.
 *
 * La pregunta es si `next` ya esta DECLARADO, no si coincide con el valor que
 * la pantalla muestra. Cuando el escenario se infiere del sorteo, la pantalla
 * puede estar mostrando `e2` mientras el store —que responde `e1` a falta de
 * decision— dice `e1`: una guarda que compare contra el store deja MUERTO el
 * boton de `e1`, y el usuario ve `e2` marcado, clickea `e1` y no pasa nada.
 * Medido en la app el 2026-08-27.
 *
 * Sin declaracion previa cualquier clic se escribe, porque el clic ES la
 * declaracion; y con `e1` ya declarado, volver a elegir `e1` no hace nada.
 */
export function declararEscenarioEscribe(
  vigor: Pick<EscenarioEnVigor, "declarado">,
  next: UniversityAulasScenario,
): boolean {
  return vigor.declarado !== next;
}
