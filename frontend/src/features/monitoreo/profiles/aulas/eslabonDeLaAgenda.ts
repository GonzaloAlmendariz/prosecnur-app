// eslabonDeLaAgenda.ts — qué eslabón de la cadena enseña la tabla de la Agenda.
//
// B27, dictado de Gonzalo (2026-09-01, mirando la tabla): «no sé por qué no
// muestras todas las columnas; ¿no sería mejor tener un desplegable para poder
// seleccionar las columnas a mostrar? en este caso los titulares, pero podría
// seleccionarse reemplazo 1 o reemplazo 2 y que muestre esas columnas».
//
// En el LIBRO de Sheets cada fila es una cadena con bloques por eslabón
// —titular, R1, R2…—, así que «las columnas de reemplazo 1» son, en el modelo
// de la app, LAS FILAS del eslabón 1: cada unidad del plan es una fila con
// `sample_role` y `replacement_order`. El desplegable conmuta qué eslabón se
// lista, con las mismas columnas del agendador — espejo de los bloques del
// libro sin duplicar su geometría.
//
// La lógica vive aquí y no en el componente por el patrón del feature: lo
// calculable se prueba sin montar la página.

import { ordenarPorCadenaOperativa } from "../../../../lib/cadenaOperativa";
import { corteDelEstudio } from "./corteDelEstudio";
import { estadoDeMuestraLegible } from "./estadoDeMuestraLegible";
import { queTocaConCadaAula } from "./queTocaConCadaAula";

type Fila = Record<string, unknown>;

/** `0` es el eslabón de los titulares; `k >= 1`, el reemplazo k de cada cadena. */
export type OpcionDeEslabon = {
  eslabon: number;
  etiqueta: string;
  /** Cuántos cursos-horario tiene ese eslabón en el plan. */
  cursos: number;
};

export type EslabonesDeLaAgenda = {
  opciones: OpcionDeEslabon[];
  /**
   * Reservas de cadena sin `replacement_order` válido: no caben en ningún
   * eslabón y, sin esta cuenta, desaparecerían de TODAS las vistas del
   * desplegable sin dejar rastro — la lista cerrada que se traga filas en
   * silencio, otra vez. La cabecera del panel las declara cuando existen.
   */
  sinOrden: number;
};

// Comparación EXACTA, la misma que `agendaRows` en el page-file: normalizar
// aquí («Chain Reserve» → reserva) mientras la tabla por defecto no normaliza
// haría que la opción «Titulares» contara distinto de lo que esa tabla enseña.
const rolDe = (fila: Fila): string => String(fila.sample_role ?? "");

const ordenDe = (fila: Fila): number | null => {
  const n = Number(fila.replacement_order);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

/**
 * Las opciones del desplegable, derivadas del plan real: «Titulares» y
 * «Reemplazo 1..n» con n el máximo `replacement_order` presente — nunca un
 * número tecleado.
 */
export function opcionesDeEslabon(agenda: ReadonlyArray<Fila>): EslabonesDeLaAgenda {
  let titulares = 0;
  let sinOrden = 0;
  const porOrden = new Map<number, number>();
  for (const fila of agenda) {
    const rol = rolDe(fila);
    // El banco es capacidad del estrato, no el plan B de nadie: ni se lista
    // con los titulares ni forma eslabón.
    if (rol === "extra_reserve_pool") continue;
    // La MISMA regla que `agendaRows`: titular es todo lo que no es banco ni
    // reserva de cadena, para que la opción y la tabla por defecto cuenten lo
    // mismo.
    if (rol !== "chain_reserve") { titulares += 1; continue; }
    const orden = ordenDe(fila);
    if (orden === null) { sinOrden += 1; continue; }
    porOrden.set(orden, (porOrden.get(orden) ?? 0) + 1);
  }
  const tope = porOrden.size ? Math.max(...porOrden.keys()) : 0;
  const opciones: OpcionDeEslabon[] = [{ eslabon: 0, etiqueta: "Titulares", cursos: titulares }];
  // 1..n CONTIGUO: un hueco (hay reemplazo 5 pero ninguna cadena tiene
  // reemplazo 3) sale como opción con 0 cursos y la tabla declara su vacío,
  // en vez de renumerar eslabones y esconder el hueco.
  for (let k = 1; k <= tope; k += 1) {
    opciones.push({ eslabon: k, etiqueta: `Reemplazo ${k}`, cursos: porOrden.get(k) ?? 0 });
  }
  return { opciones, sinOrden };
}

/**
 * El eslabón que se puede enseñar: el elegido si sigue existiendo en el plan,
 * o los titulares. Un Recargar puede encoger las cadenas y dejaría al select
 * con un valor sin opción y a la tabla enseñando un eslabón que ya no existe.
 */
export function eslabonVigente(
  opciones: ReadonlyArray<OpcionDeEslabon>,
  elegido: number,
): number {
  return opciones.some((o) => o.eslabon === elegido) ? elegido : 0;
}

/**
 * Lo que hace falta del tablero. Estructural a propósito: el helper no tiene
 * por qué atarse al tipo entero del payload para leer tres campos.
 */
export type TableroDeLaAgenda = {
  agenda?: unknown;
  partes_campo?: unknown;
  generated_at?: unknown;
} | null;

/**
 * Las filas del eslabón `k >= 1`, con el MISMO tratamiento que la tabla de
 * titulares: «qué toca» contra el corte del ESTUDIO —el último parte de campo,
 * no `generated_at`—, status que no afirma contradicciones y el orden de la
 * cadena operativa.
 *
 * Para `k = 0` devuelve vacío: a los titulares los sigue sirviendo
 * `agendaRows`, que es la fuente de las demás superficies de la sección.
 * Duplicar aquí su regla es como dos vistas de la misma agenda acaban
 * enseñando cuentas distintas.
 */
export function filasDeReemplazo(tablero: TableroDeLaAgenda, eslabon: number): Fila[] {
  if (!tablero || eslabon < 1) return [];
  const agenda = (Array.isArray(tablero.agenda) ? tablero.agenda : []) as Fila[];
  const corte = corteDelEstudio(
    (Array.isArray(tablero.partes_campo) ? tablero.partes_campo : []) as Fila[],
    tablero.generated_at,
  ).dia;
  const filas = agenda
    .filter((fila) => rolDe(fila) === "chain_reserve" && ordenDe(fila) === eslabon)
    .map((fila): Fila => ({
      ...fila,
      que_toca: queTocaConCadaAula(fila, corte),
      sample_status: estadoDeMuestraLegible(fila.sample_status, fila.operational_status),
    }));
  // Las mismas señas que ordenan la tabla de titulares. Dentro de un eslabón no
  // viaja ningún titular, así que la cadena se resuelve por `operational_
  // sequence` o por el propio código («R 3.1» es de la cadena 3).
  return ordenarPorCadenaOperativa(filas, (fila) => ({
    rol: String(fila.sample_role ?? ""),
    secuencia: fila.operational_sequence,
    orden: fila.replacement_order,
    codigo: String(fila.operational_code ?? ""),
    reemplazaA: String(fila.titular_operational_code ?? fila.replacement_for ?? ""),
  }));
}
