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

import type { EquivalenciaFila } from "../../api/equivalencias";

export type FilaEditor = EquivalenciaFila & {
  /** Identidad estable de la fila mientras se edita; no viaja al backend. */
  id: string;
};

let contador = 0;
export function nuevaFilaId(): string {
  contador += 1;
  return `fila-${contador}`;
}

export function filaVacia(seccion = ""): FilaEditor {
  return {
    id: nuevaFilaId(),
    seccion,
    etiqueta_estandar: "",
    variables: {},
    diapositiva: "",
    cantidad: 0,
  };
}

export function aFilasEditor(filas: readonly EquivalenciaFila[]): FilaEditor[] {
  return filas.map((f) => ({ ...f, id: nuevaFilaId() }));
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

export function editarCampo(
  filas: readonly FilaEditor[],
  filaId: string,
  campo: "etiqueta_estandar" | "seccion" | "diapositiva",
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
 * Lo que se guarda. Las filas sin variables no declaran nada, y **las que siguen
 * marcadas como sugeridas no se guardan**: una propuesta que se persiste sin que
 * nadie la mire es indistinguible de una decisión, que es justo lo que el ADR
 * 0062 prohíbe.
 */
export function filasParaGuardar(filas: readonly FilaEditor[]): EquivalenciaFila[] {
  return filas
    .filter((fila) => Object.keys(fila.variables).length > 0 && !fila.sugerida)
    .map(({ id: _id, sugerida: _sugerida, ...resto }) => ({
      ...resto,
      cantidad: Object.keys(resto.variables).length,
    }));
}

export type ResumenEditor = {
  total: number;
  confirmadas: number;
  sugeridas: number;
  sinEtiqueta: number;
  conDiapositiva: number;
};

export function resumenEditor(filas: readonly FilaEditor[]): ResumenEditor {
  const confirmadas = filas.filter((f) => !f.sugerida && Object.keys(f.variables).length > 0);
  return {
    total: filas.length,
    confirmadas: confirmadas.length,
    sugeridas: filas.filter((f) => f.sugerida).length,
    sinEtiqueta: confirmadas.filter((f) => !f.etiqueta_estandar.trim()).length,
    conDiapositiva: confirmadas.filter((f) => (f.diapositiva ?? "").trim()).length,
  };
}
