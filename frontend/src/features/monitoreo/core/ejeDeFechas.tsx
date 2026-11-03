/**
 * El eje de fechas de los gráficos diarios de Monitoreo, en dos líneas
 * (Gonzalo, 3/11): el número del día bajo su barra y el mes debajo, sólo donde
 * empieza. Un día pide ~18 px, así que con barras de 18 px o más se rotulan
 * todos; con menos, uno cada `ceil(18 / paso)`. Siempre centrado bajo su barra:
 * anclar los extremos al borde los corría fuera de ella.
 *
 * El modelo (`ejeDeFechas`) es puro y sirve a los tres modos de dibujar que hay
 * en Monitoreo: SVG propio (`EjeDeFechas`), rótulos HTML posicionados y Plotly
 * (`ticksDeFechas`).
 */

import "./ejeDeFechas.css";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

export const ANCHO_DEL_DIA = 18;
/** Distancia mínima entre dos meses («oct», «nov») para que no se monten. */
const ANCHO_DEL_MES = 30;
/** El eje de dos líneas: necesita 34 px bajo el área del gráfico. */
export const ALTO_DEL_EJE_DE_FECHAS = 34;

/** Qué días se rotulan bajo barras de `paso` px: todos si caben, si no uno cada tanto, y el último si queda lejos. */
export function rotulosDeFecha(n: number, paso: number): Array<{ indice: number }> {
  if (n <= 0 || !(paso > 0)) return [];
  const cada = Math.max(1, Math.ceil(ANCHO_DEL_DIA / paso));
  const indices: number[] = [];
  for (let indice = 0; indice < n; indice += cada) indices.push(indice);
  const ultimo = indices[indices.length - 1];
  if (ultimo !== n - 1 && (n - 1 - ultimo) * paso >= ANCHO_DEL_DIA) indices.push(n - 1);
  return indices.map((indice) => ({ indice }));
}

export type RotuloDeDia = { indice: number; dia: string; mes: string | null };

/** «2026-10-29», «29/10/2026» o «10/29/2026»: año, mes y día; `null` si no es una fecha. */
function partesDeFecha(valor: string): { mes: number; dia: number } | null {
  const texto = String(valor ?? "").trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(texto);
  if (iso) return { mes: Number(iso[2]), dia: Number(iso[3]) };
  const diaPrimero = /^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}$/.exec(texto);
  if (diaPrimero) return { mes: Number(diaPrimero[2]), dia: Number(diaPrimero[1]) };
  return null;
}

/**
 * Los rótulos del eje: el día en cada uno y el mes en el primero de cada mes.
 * Si dos meses quedan más cerca que su ancho (el campo empieza el 31 y sigue
 * el 1), se queda el más nuevo: es el que dice a qué mes pertenecen los días
 * que siguen. Un valor que no es fecha (p. ej. «Sin fecha») va tal cual. Puro.
 */
export function ejeDeFechas(fechas: readonly string[], paso: number): RotuloDeDia[] {
  const rotulos: RotuloDeDia[] = [];
  let mesAnterior = 0;
  let ultimoConMes = -1;
  for (const { indice } of rotulosDeFecha(fechas.length, paso)) {
    const partes = partesDeFecha(fechas[indice]);
    if (!partes || partes.mes < 1 || partes.mes > 12 || !partes.dia) {
      rotulos.push({ indice, dia: String(fechas[indice] ?? ""), mes: null });
      continue;
    }
    const rotulo: RotuloDeDia = { indice, dia: String(partes.dia), mes: null };
    if (partes.mes !== mesAnterior) {
      mesAnterior = partes.mes;
      if (ultimoConMes >= 0 && (indice - rotulos[ultimoConMes].indice) * paso < ANCHO_DEL_MES) rotulos[ultimoConMes].mes = null;
      rotulo.mes = MESES[partes.mes - 1];
      ultimoConMes = rotulos.length;
    }
    rotulos.push(rotulo);
  }
  return rotulos;
}

/**
 * Para Plotly: `tickvals` son los índices rotulados (o lo que devuelva
 * `valorDe`) y `ticktext` lleva el mes en una segunda línea donde empieza.
 */
export function ticksDeFechas<T = number>(
  fechas: readonly string[],
  paso: number,
  valorDe: (indice: number) => T = (indice) => indice as unknown as T,
): { tickvals: T[]; ticktext: string[] } {
  const rotulos = ejeDeFechas(fechas, paso);
  return {
    tickvals: rotulos.map((rotulo) => valorDe(rotulo.indice)),
    ticktext: rotulos.map((rotulo) => (rotulo.mes ? `${rotulo.dia}<br><b>${rotulo.mes}</b>` : rotulo.dia)),
  };
}

/** El eje en SVG: el día a 19 px del pie y el mes a 5 px. `clase` es la del texto del eje de cada gráfico. */
export function EjeDeFechas({
  fechas,
  paso,
  x,
  alto,
  clase = "mon-eje-fecha",
}: {
  fechas: readonly string[];
  paso: number;
  x: (indice: number) => number;
  alto: number;
  clase?: string;
}) {
  return (
    <g>
      {ejeDeFechas(fechas, paso).map((rotulo) => (
        <g key={`${fechas[rotulo.indice]}-${rotulo.indice}`}>
          <text className={clase} x={x(rotulo.indice)} y={alto - 19} textAnchor="middle">{rotulo.dia}</text>
          {rotulo.mes ? <text className={`${clase} is-mes`} x={x(rotulo.indice)} y={alto - 5} textAnchor="middle">{rotulo.mes}</text> : null}
        </g>
      ))}
    </g>
  );
}
