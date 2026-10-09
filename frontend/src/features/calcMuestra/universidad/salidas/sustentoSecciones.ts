/**
 * Las once secciones del sustento metodológico, con su disponibilidad.
 *
 * Decisión 7 de Gonzalo: «el que crea la app debe ser más general pero de todas
 * formas considerar a detalle todo lo que escribimos en el de las 23 páginas y
 * nuestro motor tiene esa información».
 *
 * El inventario dio una respuesta que cambia el trabajo: **el contenido ya
 * existe**, repartido entre cuatro superficies —el «Sustento técnico» de
 * Selección con las fórmulas y sus valores, el relato de siete escenas, la hoja
 * «Bitácora metodológica» del export y la prosa que el motor escribe en
 * `selection_result.methodology`—. Lo que no existe es el documento que las
 * reúna. Así que este módulo no redacta contenido nuevo: **dice qué secciones
 * hay, de dónde sale cada una y cuáles se pueden escribir hoy**.
 *
 * Dos decisiones tomadas al construirlo:
 *
 * - **El capítulo de campo y monitoreo vive en Monitoreo**, no acá
 *   (`AulasCriterioDeAula`, `alcanceDelBanco`, `agendamiento`). Se declara como
 *   externo en vez de omitirlo en silencio o inventarlo: un sustento al que le
 *   falta un capítulo y no lo dice miente por omisión, y uno que lo rellena con
 *   generalidades miente y además suena bien.
 * - **La frescura se hereda, no se reinventa.** `paqueteDefensa.ts` ya define
 *   qué hace que un artefacto corresponda al estudio vigente; un segundo
 *   criterio crearía dos nociones de «este documento está al día» que se
 *   contradirían el día que difieran.
 */
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { safeNumber } from "../../sharedCore";

export type OrigenSeccion =
  /** Se arma con lo que el motor ya publica en el estudio o la corrida. */
  | "estudio"
  /** Se arma con la selección persistida. */
  | "seleccion"
  /** Vive en otro módulo y este documento sólo puede citarlo. */
  | "externo";

export type SeccionSustento = {
  numero: number;
  id: string;
  titulo: string;
  origen: OrigenSeccion;
  /** De dónde sale, literal, para que el que mantenga esto no lo adivine. */
  fuente: string;
  disponible: boolean;
  /** Por qué no se puede escribir todavía. Vacío cuando sí se puede. */
  falta: string;
};

type Contexto = {
  estudio: { componentes: CalcMuestraComponente[] } | null | undefined;
  workspace: CalcMuestraWorkspace | null | undefined;
  aulasState: CalcMuestraAulasState | null | undefined;
};

function filasPorFacultad(ctx: Contexto): number {
  for (const comp of ctx.estudio?.componentes ?? []) {
    const filas = comp.resultado?.aulas_por_estrato ?? [];
    if (filas.length) return filas.length;
  }
  return 0;
}

function hayTau(ctx: Contexto): boolean {
  for (const comp of ctx.estudio?.componentes ?? []) {
    for (const fila of comp.resultado?.aulas_por_estrato ?? []) {
      const tau = safeNumber((fila as { tau?: unknown }).tau, 0);
      if (tau > 0) return true;
    }
  }
  return false;
}

export function seccionesSustento(ctx: Contexto): SeccionSustento[] {
  const seleccion = ctx.aulasState?.selection ?? null;
  const marco = ctx.aulasState?.frame ?? null;
  const porFacultad = filasPorFacultad(ctx);
  const haySeleccion = Boolean(seleccion?.selection_run_id);
  const sexo = Boolean((seleccion as { sexo_por_facultad?: unknown } | null)?.sexo_por_facultad);
  const reemplazos = Boolean(ctx.aulasState?.replacement_simulation);
  const comparacion = Boolean(ctx.aulasState?.method_comparison);

  const s = (
    numero: number, id: string, titulo: string, origen: OrigenSeccion,
    fuente: string, disponible: boolean, falta: string,
  ): SeccionSustento => ({ numero, id, titulo, origen, fuente, disponible, falta });

  return [
    s(1, "quienes-entran", "Quiénes entran al estudio", "estudio",
      "El embudo de criterios del marco (`aulas.frame.audit`)",
      Boolean(marco), "Todavía no se construyó el marco."),
    s(2, "que-aulas", "Qué aulas pueden usarse", "estudio",
      "Los criterios de aula del marco y su recuento por paso",
      Boolean(marco), "Todavía no se construyó el marco."),
    s(3, "cuantas-encuestas", "Cuántas encuestas necesita el estudio", "estudio",
      "La fórmula del diseño y sus parámetros (`componente.parametros`)",
      porFacultad > 0, "Falta calcular la propuesta."),
    s(4, "tau", "τ: cuántas encuestas produce un aula", "estudio",
      "`aulas_por_estrato[].tau`, con su descomposición en `rendimiento_mix × factor_residual`",
      hayTau(ctx), "Las tasas de efectividad por facultad todavía no se calcularon."),
    s(5, "cuantas-aulas", "Cuántas aulas hacen falta", "estudio",
      "La cadena `cuota / (divisor × τ)` por facultad",
      porFacultad > 0, "Falta calcular la propuesta."),
    s(6, "cuales-aulas", "Cuáles aulas, y por qué esas", "seleccion",
      "`selection.methodology` más el motor, la semilla y el hash del marco",
      haySeleccion, "Todavía no hay una selección."),
    s(7, "cuotas-sexo", "Las cuotas por sexo", "seleccion",
      "`selection.sexo_por_facultad`: marco, titulares y brecha por facultad",
      sexo, "La selección no publicó el balance por sexo."),
    s(8, "reemplazos", "Qué hacer cuando un aula no puede aplicarse", "seleccion",
      "Las cadenas de reemplazo y su profundidad por facultad",
      reemplazos || haySeleccion, "Todavía no hay cadenas de reemplazo."),
    // El único externo. Se declara, no se omite ni se rellena.
    s(9, "campo-monitoreo", "Criterios para el campo y su monitoreo", "externo",
      "Monitoreo · perfil de aulas (`AulasCriterioDeAula`, `alcanceDelBanco`, `agendamiento`)",
      false,
      "Este capítulo vive en Monitoreo, que hoy lo muestra en pantalla pero no lo publica como dato. El documento puede citarlo pero no reconstruirlo."),
    s(10, "vs-propuesta", "Contraste con la propuesta técnica", "estudio",
      "La comparación de métodos y el contraste por facultad",
      comparacion, "Todavía no se comparó contra la propuesta."),
    s(11, "reproducir", "Cómo reproducir esta selección", "seleccion",
      "`selection_run_id`, `frame_hash`, semilla y motor usado",
      haySeleccion, "Todavía no hay una corrida que reproducir."),
  ];
}

export type ResumenSustento = {
  total: number;
  disponibles: number;
  /** Las que faltan por datos del propio módulo: se resuelven trabajando. */
  pendientes: SeccionSustento[];
  /** Las que dependen de otro módulo: no se resuelven trabajando acá. */
  externas: SeccionSustento[];
};

export function resumenSustento(secciones: SeccionSustento[]): ResumenSustento {
  return {
    total: secciones.length,
    disponibles: secciones.filter((x) => x.disponible).length,
    pendientes: secciones.filter((x) => !x.disponible && x.origen !== "externo"),
    externas: secciones.filter((x) => x.origen === "externo"),
  };
}
