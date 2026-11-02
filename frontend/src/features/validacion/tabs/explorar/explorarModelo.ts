// Modelo puro del explorador de variables (E4, E5, E6, E9): la base dicha en
// una frase, la tira de cifras, el orden de las barras, la barra divergente y
// la tabla de calor del cruce. Sin React: lo que aquí se decide se prueba con
// Vitest y la presentación sólo pinta.

import type { ExplorarUnivariadoResult } from "../../../../api/validacion";
import type {
  ExploradorCruceTabla,
  ExploradorDist,
  ExploradorDistFila,
  ExploradorFicha,
} from "../../../../api/validacionExplorar";
import type { ViewDescriptor } from "../../types";

// --- Formatos -----------------------------------------------------------------
// Propios y no `toLocaleString`: es-PE escribe «1,234.5» y el Node de los tests
// puede venir sin ICU completo (el mismo número saldría distinto en Vitest).

export function fmtN(n: number): string {
  const entero = Math.round(n);
  const signo = entero < 0 ? "-" : "";
  return signo + String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function fmtDecimal(x: number, decimales = 1): string {
  if (!Number.isFinite(x)) return "—";
  const [ent, dec] = Math.abs(x).toFixed(decimales).split(".");
  const signo = x < 0 && Number(ent + (dec ?? "")) !== 0 ? "-" : "";
  return `${signo}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${dec ? `.${dec}` : ""}`;
}

export function fmtPct(x: number): string {
  return `${fmtDecimal(x, 1)}%`;
}

/** Número con los decimales que necesita (hasta 2): 1,150 · 3.5 · 0.25. */
export function fmtValor(x: number): string {
  if (!Number.isFinite(x)) return "—";
  if (Number.isInteger(x)) return fmtN(x);
  return fmtDecimal(x, Math.abs(x) >= 100 ? 1 : 2).replace(/\.?0+$/, "");
}

// --- Base (E4) ------------------------------------------------------------------

export type BaseLectura = {
  nCasos: number;
  nTotal: number;
  filtrado: boolean;
  responden: number | null;
  sinRespuesta: number | null;
};

function kpiNumero(kpis: readonly ViewDescriptor[], patron: RegExp): number | null {
  const kpi = kpis.find((k) => patron.test(k.title ?? ""));
  const v = kpi?.meta?.value;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Quiénes responden: primero la distribución (ya filtrada), después la ficha
 * —que se calcula sobre toda la base, así que sólo vale sin filtro— y al final
 * la tarjeta KPI del motor anterior.
 */
export function resolverBase(
  uni: Pick<ExplorarUnivariadoResult, "n_tras_filtro" | "n_total" | "filtros_aplicados" | "kpis">,
  dist: ExploradorDist | null | undefined,
  ficha: ExploradorFicha | null | undefined,
): BaseLectura {
  const filtrado = uni.filtros_aplicados > 0;
  const nCasos = uni.n_tras_filtro;
  const responden =
    dist?.base_n ??
    (!filtrado && ficha ? ficha.datos.n_responden : null) ??
    kpiNumero(uni.kpis, /^(v[aá]lidos|respondentes con dato)$/i);
  return {
    nCasos,
    nTotal: uni.n_total,
    filtrado,
    responden,
    sinRespuesta: responden === null ? null : Math.max(0, nCasos - responden),
  };
}

export function fraseBase(base: BaseLectura): { destacado: string; resto: string } {
  const destacado = base.filtrado
    ? `${fmtN(base.nCasos)} de ${fmtN(base.nTotal)} casos`
    : `${fmtN(base.nCasos)} casos`;
  const filtro = base.filtrado ? " con el filtro activo" : "";
  const desglose =
    base.responden === null
      ? ""
      : ` · ${fmtN(base.responden)} responden y ${fmtN(base.sinRespuesta ?? 0)} ${
          base.sinRespuesta === 1 ? "queda" : "quedan"
        } sin respuesta`;
  return { destacado, resto: `${filtro}${desglose}.` };
}

// --- Orden de las categorías (E6) ---------------------------------------------

const RESIDUAL = /^(otr[oa]s?)\b|no sabe|no responde|ns\s*\/\s*nr|no precisa|prefiere no/;

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** «Otro», «No sabe» y parientes: se dibujan al final, no compiten por el primer puesto. */
export function esResidual(etiqueta: string): boolean {
  return RESIDUAL.test(sinTildes(etiqueta));
}

/**
 * Códigos fuera de la lista: el motor los manda al final de `dist.filas` con el
 * propio código como etiqueta. Con la ficha se reconocen por no estar entre sus
 * opciones; sin ella, por ser la cola de filas cuya etiqueta es su código.
 */
export function esFueraDeLista(
  filas: readonly ExploradorDistFila[],
  declarados?: ReadonlySet<string> | null,
): (fila: ExploradorDistFila) => boolean {
  if (declarados && declarados.size > 0) return (f) => !declarados.has(f.codigo);
  let cola = filas.length;
  while (cola > 0 && filas[cola - 1].etiqueta === filas[cola - 1].codigo) cola -= 1;
  // Si TODAS las filas tienen la etiqueta igual al código, la lista no trae
  // etiquetas: ninguna se marca como fuera.
  const fuera = cola === 0 ? new Set<ExploradorDistFila>() : new Set(filas.slice(cola));
  return (f) => fuera.has(f);
}

/**
 * Por frecuencia, con las residuales («Otro», «No sabe») después y los códigos
 * fuera de la lista al final; una lista ordinal respeta su orden (y también
 * deja al final los fuera de lista).
 */
export function ordenarFilas(
  filas: readonly ExploradorDistFila[],
  ordinal: boolean,
  declarados?: ReadonlySet<string> | null,
): ExploradorDistFila[] {
  const fuera = esFueraDeLista(filas, declarados);
  const enLista = filas.filter((f) => !fuera(f));
  const fueraDeLista = filas.filter(fuera);
  if (ordinal) return [...enLista, ...fueraDeLista];
  const sustantivas = enLista.filter((f) => !esResidual(f.etiqueta));
  const residuales = enLista.filter((f) => esResidual(f.etiqueta));
  const porN = (a: ExploradorDistFila, b: ExploradorDistFila) => b.n - a.n;
  return [...[...sustantivas].sort(porN), ...residuales, ...fueraDeLista];
}

// --- Escala divergente ---------------------------------------------------------

export type LadoDivergente = "baja" | "centro" | "alta";

export type Divergente = {
  segmentos: { fila: ExploradorDistFila; lado: LadoDivergente; intensidad: number }[];
  baja: { pct: number; etiqueta: string };
  centro: { pct: number; etiqueta: string } | null;
  alta: { pct: number; etiqueta: string };
};

/**
 * Una escala ordinal (sin las residuales) partida en sus dos mitades y, si es
 * impar, su centro. `intensidad` crece hacia los extremos (0..1).
 */
export function divergente(filas: readonly ExploradorDistFila[]): Divergente | null {
  const escala = filas.filter((f) => !esResidual(f.etiqueta));
  const k = escala.length;
  if (k < 3) return null;
  const mitad = Math.floor(k / 2);
  const centroIdx = k % 2 === 1 ? mitad : -1;
  const segmentos = escala.map((fila, i) => {
    const lado: LadoDivergente = i === centroIdx ? "centro" : i < mitad ? "baja" : "alta";
    const distancia = lado === "baja" ? mitad - i : lado === "alta" ? i - (centroIdx >= 0 ? centroIdx : mitad - 1) : 0;
    return { fila, lado, intensidad: lado === "centro" ? 0 : Math.min(1, distancia / Math.max(1, mitad)) };
  });
  const suma = (lado: LadoDivergente) =>
    segmentos.filter((s) => s.lado === lado).reduce((t, s) => t + s.fila.pct, 0);
  return {
    segmentos,
    baja: { pct: suma("baja"), etiqueta: escala[0].etiqueta },
    centro: centroIdx >= 0 ? { pct: suma("centro"), etiqueta: escala[centroIdx].etiqueta } : null,
    alta: { pct: suma("alta"), etiqueta: escala[k - 1].etiqueta },
  };
}

// --- Tira de cifras (E5) -------------------------------------------------------

export type Cifra = { rotulo: string; valor: string; nota: string };

function porcentaje(parte: number, total: number): number {
  return total > 0 ? (100 * parte) / total : 0;
}

/**
 * Cuatro cifras clave. Con `dist` se arman por tipo; sin ella se toman las
 * tarjetas KPI que ya mandaba el motor (las cuatro primeras), tal cual.
 */
export function cifrasClave(
  uni: Pick<ExplorarUnivariadoResult, "kpis" | "tipo">,
  dist: ExploradorDist | null | undefined,
  ficha: ExploradorFicha | null | undefined,
  base: BaseLectura,
): Cifra[] {
  if (!dist || base.responden === null) {
    return uni.kpis.slice(0, 4).map((k) => ({
      rotulo: k.title,
      valor: k.meta?.value === undefined || k.meta.value === null ? "—" : String(k.meta.value),
      nota: k.subtitle ?? "",
    }));
  }
  const responden = base.responden;
  const sin = base.sinRespuesta ?? 0;
  const cifras: Cifra[] = [
    { rotulo: "Responden", valor: fmtN(responden), nota: `${fmtPct(porcentaje(responden, base.nCasos))} de la base` },
    { rotulo: "Sin respuesta", valor: fmtN(sin), nota: `${fmtPct(porcentaje(sin, base.nCasos))}, por salto o vacío` },
  ];

  if ((dist.tipo === "so" || dist.tipo === "sm") && dist.filas) {
    const declarados = ficha?.opciones.length ? new Set(ficha.opciones.map((o) => o.codigo)) : null;
    const fuera = esFueraDeLista(dist.filas, declarados);
    const enLista = dist.filas.filter((f) => !fuera(f));
    const top = ordenarFilas(enLista, false).find((f) => !esResidual(f.etiqueta)) ?? ordenarFilas(enLista, false)[0];
    cifras.push(
      top && top.n > 0
        ? { rotulo: "Más frecuente", valor: fmtPct(top.pct), nota: top.etiqueta }
        : { rotulo: "Más frecuente", valor: "—", nota: "ninguna opción con casos" },
    );
    const usadas = enLista.filter((f) => f.n > 0).length;
    const declaradas = ficha?.opciones.length || enLista.length;
    // Casos con un código fuera de la lista, con los filtros activos (dist).
    const casosFuera = dist.filas.filter(fuera).reduce((t, f) => t + f.n, 0);
    cifras.push({
      rotulo: "Opciones usadas",
      valor: `${fmtN(usadas)} de ${fmtN(declaradas)}`,
      nota:
        casosFuera === 0
          ? "ningún caso fuera de lista"
          : `${fmtN(casosFuera)} ${casosFuera === 1 ? "caso" : "casos"} fuera de lista`,
    });
  } else if (dist.tipo === "num" && dist.num) {
    const num = dist.num;
    cifras.push({
      rotulo: "Mediana",
      valor: fmtValor(num.mediana),
      nota: `p25–p75 · ${fmtValor(num.p25)}–${fmtValor(num.p75)}`,
    });
    cifras.push({
      rotulo: "Atípicos",
      valor: fmtN(num.n_atipicos),
      nota: `rango ${fmtValor(num.min)} a ${fmtValor(num.max)}`,
    });
  } else if (dist.tipo === "fecha" && dist.fecha) {
    const dias = dist.fecha.dias;
    const pico = dias.reduce<{ fecha: string; n: number } | null>((m, d) => (!m || d.n > m.n ? d : m), null);
    cifras.push({
      rotulo: "Día con más casos",
      valor: pico ? fmtN(pico.n) : "—",
      nota: pico ? pico.fecha : "sin fechas",
    });
    const conCasos = dias.filter((d) => d.n > 0);
    cifras.push({
      rotulo: "Días con casos",
      valor: fmtN(conCasos.length),
      nota: conCasos.length ? `del ${conCasos[0].fecha} al ${conCasos[conCasos.length - 1].fecha}` : "sin fechas",
    });
  } else if (dist.tipo === "texto" && dist.texto) {
    const grupos = dist.texto.grupos;
    const top = grupos.reduce<{ texto: string; n: number } | null>((m, g) => (!m || g.n > m.n ? g : m), null);
    cifras.push({
      rotulo: "Más repetida",
      valor: top ? `× ${fmtN(top.n)}` : "—",
      nota: top ? top.texto : "sin respuestas",
    });
    cifras.push({
      rotulo: "Respuestas distintas",
      valor: fmtN(grupos.length),
      nota: "agrupadas sin mayúsculas ni tildes",
    });
  }
  return cifras;
}

// --- Tabla de calor (E9) -------------------------------------------------------

export type LecturaCalor = "columna" | "fila" | "n";

export const UMBRAL_PUNTOS = 5;

export type CeldaCalor = {
  n: number;
  valor: number;
  texto: string;
  /** 0..1: peso de la celda frente a la mayor del cuerpo; gobierna el tono. */
  peso: number;
  /** Puntos frente al total (sólo en lectura por columna o por fila). */
  dif: number | null;
  marca: "arriba" | "abajo" | null;
};

export type ModeloCalor = {
  lectura: LecturaCalor;
  titulo: string;
  columnas: { etiqueta: string; n: number }[];
  filas: { etiqueta: string; celdas: CeldaCalor[]; total: CeldaCalor | null }[];
  /** Fila de totales: en lectura por fila (contra ella se compara) y en n. */
  filaTotal: CeldaCalor[] | null;
  /** Celda de la esquina total × total, en n. */
  totalGeneral: number;
};

export type Desviacion = {
  sentido: "arriba" | "abajo";
  titulo: string;
  detalle: string;
  dif: number;
};

function celda(n: number, valor: number, esPct: boolean, total: number | null): CeldaCalor {
  const dif = total === null ? null : valor - total;
  const marca = dif === null || Math.abs(dif) < UMBRAL_PUNTOS ? null : dif > 0 ? "arriba" : "abajo";
  return { n, valor, texto: esPct ? fmtDecimal(valor, 1) : fmtN(valor), peso: 0, dif, marca };
}

/**
 * Lectura por columna: cada columna suma 100 (denominador = n de la columna,
 * que en una múltiple no es la suma de sus filas) y se compara con la columna
 * Total. Por fila: cada fila suma 100 y se compara con la fila Total. En n no
 * hay comparación.
 */
export function modeloCalor(tabla: ExploradorCruceTabla, lectura: LecturaCalor, baseN = 0): ModeloCalor {
  const nf = tabla.filas.length;
  const nc = tabla.columnas.length;
  const sumaFila = tabla.n.map((fila) => fila.reduce((t, x) => t + x, 0));
  const sumaCol = tabla.columnas.map((_, c) => tabla.n.reduce((t, fila) => t + (fila[c] ?? 0), 0));
  const denCol = tabla.columnas.map((col, c) => (col.n > 0 ? col.n : sumaCol[c]));
  const totalDen = baseN > 0 ? baseN : denCol.reduce((t, x) => t + x, 0);
  const totalFilas = sumaFila.reduce((t, x) => t + x, 0);

  const filas: ModeloCalor["filas"] = [];
  for (let r = 0; r < nf; r += 1) {
    let celdas: CeldaCalor[];
    let total: CeldaCalor | null;
    if (lectura === "columna") {
      const pctTotal = porcentaje(sumaFila[r], totalDen);
      celdas = tabla.n[r].map((x, c) => celda(x, porcentaje(x, denCol[c]), true, pctTotal));
      total = celda(sumaFila[r], pctTotal, true, null);
    } else if (lectura === "fila") {
      celdas = tabla.n[r].map((x, c) =>
        celda(x, porcentaje(x, sumaFila[r]), true, porcentaje(sumaCol[c], totalFilas)),
      );
      total = celda(sumaFila[r], sumaFila[r] > 0 ? 100 : 0, true, null);
    } else {
      celdas = tabla.n[r].map((x) => celda(x, x, false, null));
      total = celda(sumaFila[r], sumaFila[r], false, null);
    }
    filas.push({ etiqueta: tabla.filas[r].etiqueta, celdas, total });
  }

  const max = Math.max(0, ...filas.flatMap((f) => f.celdas.map((x) => x.valor)));
  for (const f of filas) for (const x of f.celdas) x.peso = max > 0 ? x.valor / max : 0;

  const filaTotal =
    lectura === "fila"
      ? sumaCol.map((x) => celda(x, porcentaje(x, totalFilas), true, null))
      : lectura === "n"
        ? sumaCol.map((x) => celda(x, x, false, null))
        : null;

  return {
    lectura,
    titulo:
      lectura === "columna" ? "Cada columna suma 100%" : lectura === "fila" ? "Cada fila suma 100%" : "Casos en cada celda",
    columnas: tabla.columnas.map((col, c) => ({ etiqueta: col.etiqueta, n: denCol[c] })),
    filas,
    filaTotal,
    totalGeneral: lectura === "n" ? totalFilas : totalDen,
  };
}

/** Las mayores diferencias frente al total (≥ 5 puntos), de mayor a menor. */
export function desviaciones(modelo: ModeloCalor, limite = 3): Desviacion[] {
  if (modelo.lectura === "n") return [];
  const todas: Desviacion[] = [];
  modelo.filas.forEach((fila) => {
    fila.celdas.forEach((x, c) => {
      if (x.dif === null || x.marca === null) return;
      const col = modelo.columnas[c].etiqueta;
      const total = x.valor - x.dif;
      const mas = x.marca === "arriba";
      todas.push({
        sentido: x.marca,
        dif: x.dif,
        titulo:
          modelo.lectura === "columna"
            ? `${col}: ${mas ? "más" : "menos"} «${fila.etiqueta}»`
            : `«${fila.etiqueta}»: ${mas ? "más" : "menos"} en ${col}`,
        detalle: `${fmtPct(x.valor)} frente a ${fmtPct(total)} del total, ${fmtDecimal(Math.abs(x.dif), 1)} puntos ${
          mas ? "por encima" : "por debajo"
        }.`,
      });
    });
  });
  return todas.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif)).slice(0, limite);
}

/** «Cada X tiene entre 95 y 108 respuestas»: el tamaño que acota cuánto pesa una diferencia. */
export function rangoColumnas(modelo: ModeloCalor): { min: number; max: number } | null {
  const ns = modelo.columnas.map((c) => c.n).filter((n) => n > 0);
  if (!ns.length) return null;
  return { min: Math.min(...ns), max: Math.max(...ns) };
}

// --- Escalas -------------------------------------------------------------------

/** Posición 0..100 de `v` entre `min` y `max` (50 si el rango es nulo). */
export function posicion(v: number, min: number, max: number): number {
  if (!(max > min)) return 50;
  return Math.max(0, Math.min(100, (100 * (v - min)) / (max - min)));
}
