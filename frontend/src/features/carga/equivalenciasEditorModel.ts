/**
 * Modelo del editor de equivalencias (ADR 0062, enmienda del editor).
 *
 * La forma la dicta el Excel que el equipo ya usaba, porque es la que se lee
 * bien: **una fila por pregunta y los públicos en paralelo**. La plantilla que
 * la app emite tiene 300 filas sin emparejar —una por variable de cada base—,
 * y esa forma es correcta para no inventar emparejamientos en un archivo, pero
 * es peor para trabajar. Aquí el emparejamiento se hace en pantalla, donde una
 * sugerencia puede verse COMO sugerencia y confirmarse de un clic.
 *
 * La lógica vive aparte del render porque es donde estaban los errores que
 * importan: una variable asignada a dos filas a la vez, o una sugerencia que se
 * guarda sin que nadie la confirme.
 */

import { rotuloDeMatriz } from "../../lib/rotuloDeMatriz";
import type { EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";

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
 * Incorpora sugerencias sin pisar lo decidido. Una sugerencia se descarta
 * entera si **cualquiera** de sus variables ya está tomada: aceptarla a medias
 * produciría una fila que dice ser la misma pregunta en tres públicos cuando el
 * analista sólo confirmó dos, y esa diferencia no se ve en la tabla.
 */
export function incorporarSugerencias(
  filas: readonly FilaEditor[],
  sugerencias: readonly EquivalenciaFila[],
): FilaEditor[] {
  const tomadas = new Map<string, Set<string>>();
  for (const fila of filas) {
    for (const [base, v] of Object.entries(fila.variables)) {
      if (!tomadas.has(base)) tomadas.set(base, new Set());
      tomadas.get(base)!.add(v);
    }
  }

  const nuevas: FilaEditor[] = [];
  for (const sug of sugerencias) {
    const choca = Object.entries(sug.variables).some(
      ([base, v]) => tomadas.get(base)?.has(v),
    );
    if (choca) continue;
    for (const [base, v] of Object.entries(sug.variables)) {
      if (!tomadas.has(base)) tomadas.set(base, new Set());
      tomadas.get(base)!.add(v);
    }
    nuevas.push({ ...sug, id: nuevaFilaId(), sugerida: true });
  }
  return [...filas, ...nuevas];
}

/** Marca una fila propuesta como decidida por el analista. */
export function confirmarFila(filas: readonly FilaEditor[], filaId: string): FilaEditor[] {
  return filas.map((fila) =>
    fila.id === filaId ? { ...fila, sugerida: false } : fila,
  );
}

export function confirmarTodas(filas: readonly FilaEditor[]): FilaEditor[] {
  return filas.map((fila) => ({ ...fila, sugerida: false }));
}

/**
 * Lo que se guarda. Las filas sin variables no declaran nada y se descartan.
 *
 * Las propuestas **sí se guardan, marcadas** (ADR 0064). La regla anterior las
 * descartaba al guardar, y con la plantilla sembrada eso destruía el trabajo:
 * confirmar diez de cincuenta y ocho propuestas y pulsar Guardar borraba las
 * otras cuarenta y ocho sin ninguna señal. Lo que el ADR 0062 protege —que una
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
 * parte de ella siguen al final en su orden original. Sin serie, el orden que
 * trae el estado.
 */
export function ordenarBasesPorSerie(bases: readonly string[], periodos: readonly string[] | null | undefined): string[] {
  const serie = (periodos ?? []).filter((p) => bases.includes(p));
  if (serie.length === 0) return [...bases];
  const unicos = serie.filter((p, i) => serie.indexOf(p) === i);
  return [...unicos, ...bases.filter((b) => !unicos.includes(b))];
}
