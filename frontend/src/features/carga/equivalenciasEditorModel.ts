/**
 * Modelo del editor de equivalencias (ADR 0062, enmienda del editor; ADR 0104).
 *
 * La forma la dicta el Excel que el equipo ya usaba, porque es la que se lee
 * bien: **una fila por pregunta y los públicos en paralelo**. ADR 0104: la
 * matriz se arma aquí, fila por fila, por la persona; no hay plantilla, subida
 * de Excel ni emparejado automático. Una fila `sugerida` sólo puede venir de un
 * `.pulso` anterior: se conserva marcada y se confirma de una en una.
 *
 * La lógica vive aparte del render porque es donde estaban los errores que
 * importan: una variable asignada a dos filas a la vez, o una propuesta que se
 * guarda como decisión sin que nadie la confirme.
 */

import { rotuloDeMatriz } from "../../lib/rotuloDeMatriz";
import type { EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";
import { ordenPorDefectoDeSerie } from "./nombreDeSerie";

export type FilaEditor = EquivalenciaFila & {
  /** Identidad estable de la fila mientras se edita; no viaja al backend. */
  id: string;
  /**
   * `id` del bloque en la matriz del proyecto (contrato E4-E7). Vive aparte
   * porque `id` es la identidad local; al guardar vuelve a viajar como `id`,
   * que es por donde la importación de bloques casa sin duplicar.
   */
  id_declarado?: string;
  /**
   * Posición de la fila en la declaración GUARDADA. Es lo que el preview de la
   * armonización acepta como referencia; una fila nueva no la tiene todavía.
   */
  indice_declarado?: number;
};

let contador = 0;
export function nuevaFilaId(): string {
  contador += 1;
  return `fila-${contador}`;
}

export function filaVacia(seccion = ""): FilaEditor {
  return { id: nuevaFilaId(), seccion, etiqueta_estandar: "", variables: {}, cantidad: 0 };
}

export function aFilasEditor(filas: readonly EquivalenciaFila[]): FilaEditor[] {
  return filas.map((f, i) => {
    const { id: idDeclarado, ...resto } = f;
    return {
      ...resto,
      id: nuevaFilaId(),
      ...(idDeclarado ? { id_declarado: idDeclarado } : {}),
      indice_declarado: i,
    };
  });
}

/**
 * Asigna una variable de una base a una fila. Devuelve la lista completa porque
 * la asignación **también quita esa variable de cualquier otra fila**: una misma
 * variable en dos filas significaría que la pregunta es dos preguntas, y el
 * conteo por público —y el gráfico que salga de él— quedaría mal sin ninguna
 * señal.
 */
export function asignarVariable(
  filas: readonly FilaEditor[],
  filaId: string,
  base: string,
  variable: string,
): FilaEditor[] {
  return filas.map((fila) => {
    const variables = { ...fila.variables };
    if (fila.id === filaId) {
      if (variable) variables[base] = variable;
      else delete variables[base];
    } else if (variable && variables[base] === variable) {
      delete variables[base];
    }
    return { ...fila, variables, cantidad: Object.keys(variables).length };
  });
}

/**
 * Asigna la pregunta de una base y, si la fila todavía no tiene nombre
 * estándar, le da la etiqueta de esa pregunta (ADR 0104): es el nombre que la
 * persona escribiría, y sigue siendo editable. Un nombre ya escrito no se pisa.
 */
export function asignarPregunta(
  filas: readonly FilaEditor[],
  filaId: string,
  base: string,
  variable: string,
  etiquetaDeLaPregunta: string,
): FilaEditor[] {
  const nombre = etiquetaDeLaPregunta.trim();
  return asignarVariable(filas, filaId, base, variable).map((fila) =>
    fila.id === filaId && variable && nombre && !fila.etiqueta_estandar.trim()
      ? { ...fila, etiqueta_estandar: nombre }
      : fila,
  );
}

/** ADR 0103: la matriz sólo declara equivalencias; la lámina, el gráfico y el corte se deciden en Gráficos. */
export type CampoFila = "etiqueta_estandar" | "seccion";

export function editarCampo(
  filas: readonly FilaEditor[],
  filaId: string,
  campo: CampoFila,
  valor: string,
): FilaEditor[] {
  return filas.map((fila) => (fila.id === filaId ? { ...fila, [campo]: valor } : fila));
}

export function quitarFila(filas: readonly FilaEditor[], filaId: string): FilaEditor[] {
  return filas.filter((fila) => fila.id !== filaId);
}

/** Variables de una base que ya están tomadas por alguna fila. */
export function variablesTomadas(filas: readonly FilaEditor[], base: string): Set<string> {
  const out = new Set<string>();
  for (const fila of filas) {
    const v = fila.variables[base];
    if (v) out.add(v);
  }
  return out;
}

/**
 * Marca como decidida una propuesta heredada de un `.pulso` anterior. ADR 0104:
 * de una en una; no hay confirmación en bloque.
 */
export function confirmarFila(filas: readonly FilaEditor[], filaId: string): FilaEditor[] {
  return filas.map((fila) =>
    fila.id === filaId ? { ...fila, sugerida: false } : fila,
  );
}

/**
 * Lo que se guarda. Las filas sin variables no declaran nada y se descartan.
 *
 * Las propuestas heredadas **sí se guardan, marcadas** (ADR 0064, ADR 0104 §5):
 * descartarlas al guardar borraría sin señal lo que un `.pulso` anterior traía. Lo que el ADR 0062 protege —que una
 * sugerencia nunca actúe como decisión— se cumple donde importa: una propuesta
 * no escribe etiquetas en Analítica y no llega al mazo.
 */
export function filasParaGuardar(filas: readonly FilaEditor[]): EquivalenciaFila[] {
  return filas
    .filter((fila) => Object.keys(fila.variables).length > 0)
    .map(({ id: _id, id_declarado, indice_declarado: _indice, ...resto }) => ({
      ...resto,
      ...(id_declarado ? { id: id_declarado } : {}),
      cantidad: Object.keys(resto.variables).length,
    }));
}

export type ResumenEditor = {
  total: number;
  confirmadas: number;
  sugeridas: number;
  sinEtiqueta: number;
};

export function resumenEditor(filas: readonly FilaEditor[]): ResumenEditor {
  const confirmadas = filas.filter((f) => !f.sugerida && Object.keys(f.variables).length > 0);
  return {
    total: filas.length,
    confirmadas: confirmadas.length,
    sugeridas: filas.filter((f) => f.sugerida).length,
    sinEtiqueta: confirmadas.filter((f) => !f.etiqueta_estandar.trim()).length,
  };
}

/** Cómo se lee una sección: «Pag2» es el nombre interno de la página en SurveyMonkey. */
export function seccionLegible(seccion: string | null | undefined): string {
  const s = (seccion ?? "").trim();
  const m = /^pag(?:ina|e)?\s*_?(\d+)$/i.exec(s);
  return m ? `Página ${Number(m[1])} del formulario` : rotuloDeMatriz(s);
}

/**
 * Orden de las columnas por base. Si la matriz declara la serie
 * (`armonizacion_periodos`), las bases van en ese orden y las que no forman
 * parte de ella siguen al final en su orden original. Sin serie, el orden por
 * defecto: cronológico si todas las bases nombran un año, si no el del estado.
 */
export function ordenarBasesPorSerie(bases: readonly string[], periodos: readonly string[] | null | undefined): string[] {
  const serie = (periodos ?? []).filter((p) => bases.includes(p));
  if (serie.length === 0) return ordenPorDefectoDeSerie(bases);
  const unicos = serie.filter((p, i) => serie.indexOf(p) === i);
  return [...unicos, ...bases.filter((b) => !unicos.includes(b))];
}
