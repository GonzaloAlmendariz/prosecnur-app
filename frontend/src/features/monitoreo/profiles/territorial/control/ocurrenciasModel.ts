import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { diaYMes, nombreDeDistrito, pctEntero } from "../rotulos";

/**
 * Control › Ocurrencias (territorial.md §3.9): lo que declaran los partes de
 * ocurrencias de campo (`field_occurrences`). Sus efectivas son DECLARADAS y no
 * son las que cuentan para la meta: el rótulo lo dice siempre.
 */

export type Motivo = { clave: string; rotulo: string; total: number; proporcion: number };
export type FilaDeDistritoOcurrencias = { distrito: string; intentos: number; partes: number; efectivas: number; porCien: number[] };
export type DiaDeOcurrencias = { rotulo: string; intentos: number; efectivas: number };
export type TramoDeTasa = { rotulo: string; umps: number };

export type ModeloOcurrencias = {
  conPartes: boolean;
  partes: number;
  umpsConParte: number;
  intentos: number;
  efectivas: number;
  noEfectivas: number;
  tasa: string;
  motivos: Motivo[];
  /** Los cuatro motivos de no efectividad más frecuentes: columnas de la matriz. */
  columnas: Motivo[];
  distritos: FilaDeDistritoOcurrencias[];
  dias: DiaDeOcurrencias[];
  tasas: TramoDeTasa[];
  medianaDeTasa: number | null;
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function esEfectiva(clave: string, rotulo: string): boolean {
  return /^efectiv/i.test(clave) || /^efectiv/i.test(rotulo);
}

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

export function construirOcurrencias(reports: MonitoreoTerritorialDashboard | null | undefined): ModeloOcurrencias {
  const tablero = reports?.field_occurrences ?? null;
  const resumen = tablero?.summary;
  const intentos = Math.round(n(resumen?.intentos));
  const efectivas = Math.round(n(resumen?.efectivas));
  const noEfectivas = Math.round(n(resumen?.no_efectivas));

  const motivos: Motivo[] = (tablero?.by_outcome ?? [])
    .filter((item) => n(item.total) > 0)
    .map((item) => ({ clave: String(item.key), rotulo: String(item.label || item.key), total: Math.round(n(item.total)), proporcion: intentos ? n(item.total) / intentos : 0 }))
    .sort((a, b) => b.total - a.total);
  const columnas = motivos.filter((motivo) => !esEfectiva(motivo.clave, motivo.rotulo)).slice(0, 4);

  const distritos: FilaDeDistritoOcurrencias[] = (tablero?.by_district ?? []).map((fila) => {
    const intentosDelDistrito = n(fila.intentos);
    return {
      distrito: nombreDeDistrito(fila.distrito),
      intentos: Math.round(intentosDelDistrito),
      partes: Math.round(n(fila.ump_reportadas)),
      efectivas: Math.round(n(fila.efectivas)),
      porCien: columnas.map((columna) => {
        const total = n(fila.outcomes?.find((item) => item.key === columna.clave)?.total);
        return intentosDelDistrito ? Math.round((total / intentosDelDistrito) * 1000) / 10 : 0;
      }),
    };
  }).sort((a, b) => a.distrito.localeCompare(b.distrito, "es"));

  const dias: DiaDeOcurrencias[] = [...(tablero?.by_day ?? [])]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((dia) => ({ rotulo: diaYMes(dia.date) || String(dia.date_label ?? dia.date), intentos: Math.round(n(dia.intentos)), efectivas: Math.round(n(dia.efectivas)) }));

  const conParte = (tablero?.by_ump ?? []).filter((item) => (item.has_report ?? n(item.reportes) > 0) && n(item.intentos) > 0);
  const tasasPorUmp = conParte.map((item) => (n(item.efectivas) / n(item.intentos)) * 100);
  const tasas: TramoDeTasa[] = Array.from({ length: 10 }, (_, indice) => ({
    rotulo: indice === 9 ? "90 % o más" : `${indice * 10} a ${indice * 10 + 10} %`,
    umps: tasasPorUmp.filter((tasa) => (indice === 9 ? tasa >= 90 : tasa >= indice * 10 && tasa < indice * 10 + 10)).length,
  }));

  return {
    conPartes: n(resumen?.total_records) > 0,
    partes: Math.round(n(resumen?.total_records)),
    umpsConParte: (tablero?.by_ump ?? []).filter((item) => item.has_report ?? n(item.reportes) > 0).length,
    intentos,
    efectivas,
    noEfectivas,
    tasa: pctEntero(efectivas, intentos),
    motivos,
    columnas,
    distritos,
    dias,
    tasas,
    medianaDeTasa: mediana(tasasPorUmp),
  };
}

/**
 * Los motivos de la barra apilada y su leyenda: los cinco más frecuentes y,
 * si hay más, «Otros motivos» con la suma del resto. Con seis colores, un
 * séptimo motivo repetía el color del primero y la leyenda lo callaba.
 */
export function motivosDeLaBarra(motivos: readonly Motivo[], colores = 6): Motivo[] {
  if (motivos.length <= colores) return [...motivos];
  const primeros = motivos.slice(0, colores - 1);
  const resto = motivos.slice(colores - 1);
  const total = resto.reduce((suma, motivo) => suma + motivo.total, 0);
  const proporcion = resto.reduce((suma, motivo) => suma + motivo.proporcion, 0);
  return [...primeros, { clave: "otros", rotulo: `Otros ${resto.length} motivos`, total, proporcion }];
}

/** Rótulos cortos de los motivos frecuentes del parte de ocurrencias. */
const CORTOS: Array<[RegExp, string]> = [
  [/miembros del hogar ausentes?/i, "Hogar ausente"],
  [/no cumple (los )?criterios/i, "No cumple criterios"],
];

/**
 * Rótulo corto de un motivo, para encabezados y leyendas que no caben con el
 * rótulo del formulario («Fuera de cuota (sexo, edad)», «Vivienda abandonada/
 * sin vivencia/inaccesible»). Quita la aclaración entre paréntesis y se queda
 * con la primera alternativa; el texto entero va siempre en el `title`.
 */
export function rotuloCortoDeMotivo(rotulo: string, maximo = 22): string {
  const texto = rotulo.trim();
  for (const [patron, corto] of CORTOS) if (patron.test(texto)) return corto;
  const limpio = texto.replace(/\s*\([^)]*\)\s*/g, " ").split("/")[0].replace(/\s+/g, " ").trim() || texto;
  if (limpio.length <= maximo) return limpio;
  const palabras = limpio.split(" ");
  let corto = "";
  for (const palabra of palabras) {
    const siguiente = corto ? `${corto} ${palabra}` : palabra;
    if (siguiente.length > maximo - 1) break;
    corto = siguiente;
  }
  return `${corto || limpio.slice(0, maximo - 1)}…`;
}
