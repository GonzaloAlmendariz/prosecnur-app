import type {
  CalcMuestraCriteriosCascada,
  CalcMuestraCriteriosCascadeStep,
} from "../../../../api/calcMuestraCriteriosI18b";
import type { EstadoCascada } from "../criterios/usarEmbudoVivo";

/**
 * ADR 0058 · La matriz de criterios es la transposición de la cascada.
 *
 * El motor publica la cascada por **paso × facultad** con `before_ch`,
 * `after_ch` y `excluded_ch`. La superficie que existía la presentaba como una
 * lista de pasos filtrada a una facultad; la matriz la gira: facultades en
 * filas, criterios en columnas, y cada celda **lo que ese criterio quitó ahí**.
 *
 * Aquí no se calcula ningún estadístico. Se transpone, se suma la última fila y
 * se restan universos — aritmética sobre cifras que el motor ya publicó.
 */

export type CeldaMatriz = {
  criterioId: string;
  /** Cursos-horario que este paso quitó en esta facultad. */
  quita: number;
  /** El paso corrió y no quitó nada, frente a no haber corrido aquí. */
  aplica: boolean;
  estado: EstadoCascada;
};

export type FilaMatriz = {
  facultadKey: string;
  label: string;
  /** Cursos-horario antes del primer criterio. */
  universo: number;
  celdas: CeldaMatriz[];
  /** Los que sobreviven a toda la cascada. */
  quedan: number;
  /** Proporción que sobrevive, 0..1. Null si el universo es cero. */
  supervivencia: number | null;
};

export type MatrizCascada = {
  /**
   * G7 · Los pasos operativos entran, marcados.
   *
   * Medido en la app: la matriz sumaba 2.806 cursos-horario y el KPI de la
   * cabecera decía 2.799. No era un desajuste del motor — era mi filtro. Las
   * **exclusiones manuales** viajan en la cascada con `gate = false` porque no
   * son un criterio metodológico, y al descartarlas la matriz **aterrizaba en
   * un número que no eran los elegibles**: prometía contar de dónde salen y
   * paraba un paso antes, dejando siete sin explicar.
   *
   * Siguen sin ser criterios, así que no se mezclan con ellos: van marcados
   * como operativos y se pintan aparte. Lo que no pueden es faltar.
   */
  criterios: Array<{ id: string; label: string; operativo: boolean; scope: "alumno" | "aula" }>;
  /**
   * G8 · Grupos de columnas por lo que filtra cada criterio.
   *
   * Medido en la app: de 14 columnas, 12 no recortaban nada en ninguna facultad,
   * y cinco eran criterios de **estudiante** —Formación, Edad, Ciclo, Facultad,
   * Condición de matrícula—. Todas publican `excluded_ch`, así que la unidad de
   * la celda es la misma; lo que cambia es **qué filtra el criterio**, y sin
   * declararlo el eje mezcla dos cosas.
   *
   * Un criterio de estudiante sólo quita un curso-horario cuando lo deja sin
   * ningún alumno elegible. Agrupadas, cinco columnas en cero dejan de ser ruido
   * y pasan a decir algo: ninguno vació un curso.
   */
  grupos: Array<{ scope: "alumno" | "aula" | "operativo"; label: string; desde: number; ancho: number }>;
  filas: FilaMatriz[];
  total: FilaMatriz;
};

/** Celda en edición: un criterio EN una facultad (ADR 0057, regla 1). */
export type CeldaEnEdicion = { facultadKey: string; criterioId: string } | null;

function estadoDe(
  facultadKey: string,
  indice: number,
  indiceEditando: number | null,
  facultadEditando: string | null,
): EstadoCascada {
  // Sólo la facultad en edición tiene cascada abierta. Pintar la columna
  // pondría en duda filas que nadie tocó (ADR 0058).
  if (facultadEditando !== facultadKey || indiceEditando == null) return "confirmado";
  if (indice < indiceEditando) return "confirmado";
  if (indice === indiceEditando) return "editando";
  return "espera";
}

/**
 * Transpone la cascada a matriz.
 *
 * Sólo entran los pasos que son **gate**: los operativos quedan fuera del
 * denominador y sumarlos como recortes contaría dos veces lo mismo.
 */
export function construirMatrizCascada(
  cascada: CalcMuestraCriteriosCascada | null | undefined,
  edicion: CeldaEnEdicion = null,
): MatrizCascada | null {
  // G7 · TODOS los pasos, no sólo los gates: la matriz tiene que terminar en
  // los elegibles de verdad. Los operativos van marcados para no confundirlos
  // con criterios, pero descartarlos rompía la única promesa de la superficie.
  const pasos: CalcMuestraCriteriosCascadeStep[] = cascada?.steps ?? [];
  if (!pasos.length) return null;

  const criterios = pasos.map((p) => ({
    id: p.criterion_id,
    label: p.label,
    operativo: !p.gate,
    scope: p.scope,
  }));

  // Grupos contiguos: el orden del embudo lo fija el ADR y no se reordena, así
  // que basta recorrer y cortar donde cambia el tipo.
  const tipoDe = (i: number): "alumno" | "aula" | "operativo" =>
    criterios[i].operativo ? "operativo" : criterios[i].scope;
  const ETIQUETA = {
    alumno: "Criterios de estudiante · quitan un curso-horario sólo si lo vacían",
    aula: "Criterios de curso-horario",
    operativo: "Operativo",
  } as const;
  const grupos: MatrizCascada["grupos"] = [];
  for (let i = 0; i < criterios.length; i++) {
    const t = tipoDe(i);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.scope === t) ultimo.ancho += 1;
    else grupos.push({ scope: t, label: ETIQUETA[t], desde: i, ancho: 1 });
  }
  const indiceEditando = edicion
    ? pasos.findIndex((p) => p.criterion_id === edicion.criterioId)
    : -1;
  const idxEdit = indiceEditando >= 0 ? indiceEditando : null;
  const facEdit = idxEdit != null && edicion ? edicion.facultadKey : null;

  // El orden de las facultades lo fija el primer paso: el motor las publica
  // igual en todos, y tomarlo de ahí evita inventar un orden propio.
  const claves = pasos[0].faculties.map((f) => ({ key: f.faculty_key, label: f.label }));

  const filas: FilaMatriz[] = claves.map(({ key, label }) => {
    const celdas: CeldaMatriz[] = pasos.map((paso, i) => {
      const f = paso.faculties.find((x) => x.faculty_key === key);
      return {
        criterioId: paso.criterion_id,
        quita: f?.excluded_ch ?? 0,
        aplica: paso.applies,
        estado: estadoDe(key, i, idxEdit, facEdit),
      };
    });
    // El universo es el `before` del PRIMER paso: antes de él no hay recorte.
    const universo = pasos[0].faculties.find((x) => x.faculty_key === key)?.before_ch ?? 0;
    // Lo que queda es el `after` del ÚLTIMO, no `universo − Σquita`: si algún
    // paso no publicara su facultad, la resta mentiría y el `after` no.
    const quedan = pasos[pasos.length - 1].faculties.find((x) => x.faculty_key === key)?.after_ch ?? 0;
    return {
      facultadKey: key,
      label,
      universo,
      celdas,
      quedan,
      supervivencia: universo > 0 ? quedan / universo : null,
    };
  });

  /*
   * La última fila SUMA las facultades — es la diferencia con la matriz
   * marginal, cuyo total se recalcula sobre todo el marco y no suma. Aquí, si
   * la suma de las filas no diera el total del motor, la matriz estaría
   * mintiendo sobre su propia aritmética; se usa la suma para que el lector
   * pueda comprobarla columna a columna.
   */
  const universoTotal = filas.reduce((a, f) => a + f.universo, 0);
  const quedanTotal = filas.reduce((a, f) => a + f.quedan, 0);
  const total: FilaMatriz = {
    facultadKey: "__total__",
    label: "Todas las facultades",
    universo: universoTotal,
    celdas: criterios.map((c, i) => ({
      criterioId: c.id,
      quita: filas.reduce((a, f) => a + (f.celdas[i]?.quita ?? 0), 0),
      aplica: pasos[i].applies,
      estado: "confirmado",
    })),
    quedan: quedanTotal,
    supervivencia: universoTotal > 0 ? quedanTotal / universoTotal : null,
  };

  return { criterios, grupos, filas, total };
}

/**
 * ¿La suma de las filas cuadra con el total que publica el motor?
 *
 * Se expone para poder declararlo en pantalla en vez de esconderlo. Un descuadre
 * no es un fallo de la matriz: significa que algún paso no publicó todas sus
 * facultades, y el usuario tiene derecho a saber que la última fila no es
 * exactamente la suma de lo que está viendo.
 */
export function cuadraConElMotor(
  matriz: MatrizCascada,
  cascada: CalcMuestraCriteriosCascada,
): boolean {
  const pasos = cascada.steps ?? [];
  if (!pasos.length) return true;
  return matriz.total.quedan === pasos[pasos.length - 1].total.after_ch;
}
