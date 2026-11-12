// Modelo puro del explorador de variables (E4, E5, E6, E9): la base dicha en
// una frase, la tira de cifras, el orden de las barras, la barra divergente y
// la tabla de calor del cruce. Sin React: lo que aquí se decide se prueba con
// Vitest y la presentación sólo pinta.

import type { ExplorarUnivariadoResult } from "../../../../api/validacion";
import type {
  ExploradorCruce,
  ExploradorCruceTabla,
  ExploradorDist,
  ExploradorDistFila,
  ExploradorFicha,
} from "../../../../api/validacionExplorar";
import type { ViewDescriptor } from "../../types";
import { fechaCorta } from "./escalas";

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

/** Número con los decimales que necesita (hasta 2): 1,150, 3.5 o 0.25. */
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
      : `; ${fmtN(base.responden)} responden y ${fmtN(base.sinRespuesta ?? 0)} ${
          base.sinRespuesta === 1 ? "queda" : "quedan"
        } sin respuesta`;
  return { destacado, resto: `${filtro}${desglose}.` };
}

// --- Orden de las categorías (E6) ---------------------------------------------

// Respuestas que no son parte de la escala ni compiten por el primer puesto. «Sin información» y «No aplica» se
// colaban como un punto más de la escala y le quitaban su centro (visto al probar una de 7 puntos, 3/11).
const RESIDUAL = /^(otr[oa]s?)\b|no sabe|no responde|no contesta|no recuerda|ns\s*\/\s*nr|no precisa|prefiere no|sin informacion|no aplica|no corresponde/;

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
  // Cada lado se nombra con su opción más cercana al centro («En desacuerdo», «De acuerdo»): es el nombre del
  // grupo entero, no del extremo («Totalmente…»), y es corto. Si las opciones son números (una escala de 0 a 10),
  // el lado se nombra por su rango: «4» no dice nada, «0 a 4» sí.
  const numerica = escala.every((f) => /^-?\d+([.,]\d+)?$/.test(f.etiqueta.trim()));
  const lado = (desde: number, hasta: number, cerca: number) =>
    numerica && desde !== hasta ? `${escala[desde].etiqueta} a ${escala[hasta].etiqueta}` : escala[cerca].etiqueta;
  return {
    segmentos,
    baja: { pct: suma("baja"), etiqueta: lado(0, mitad - 1, mitad - 1) },
    centro: centroIdx >= 0 ? { pct: suma("centro"), etiqueta: escala[centroIdx].etiqueta } : null,
    alta: { pct: suma("alta"), etiqueta: lado(k - mitad, k - 1, k - mitad) },
  };
}

// --- Tira de cifras (E5) -------------------------------------------------------

/**
 * Una cifra de la tira, como en el prototipo: el número y, debajo, lo que
 * cuenta ("142" y "responden, de 178"). `nota` es una segunda línea opcional
 * para lo que la cifra mezcla o deja fuera.
 */
export type Cifra = { valor: string; rotulo: string; nota?: string };

function porcentaje(parte: number, total: number): number {
  return total > 0 ? (100 * parte) / total : 0;
}

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? uno : varios;
}

/**
 * Las cifras de la pregunta. Con `dist` se arman por tipo; sin ella se toman
 * las tarjetas KPI que ya mandaba el motor (las cuatro primeras), tal cual.
 *
 * "No les correspondía" (el prototipo la separa de "sin respuesta") no está:
 * la ficha no distingue el vacío por salto del vacío sin respuesta (pedido
 * M6, `n_no_corresponde` en `/explorar/ficha`). Mientras tanto "sin
 * respuesta" lleva la nota que dice que los junta.
 */
export function cifrasClave(
  uni: Pick<ExplorarUnivariadoResult, "kpis" | "tipo">,
  dist: ExploradorDist | null | undefined,
  ficha: ExploradorFicha | null | undefined,
  base: BaseLectura,
): Cifra[] {
  if (!dist || base.responden === null) {
    return uni.kpis.slice(0, 4).map((k) => ({
      valor: k.meta?.value === undefined || k.meta.value === null ? "—" : String(k.meta.value),
      rotulo: k.title,
      nota: k.subtitle ?? "",
    }));
  }
  const responden = base.responden;
  const sin = base.sinRespuesta ?? 0;
  const respondenDe: Cifra = { valor: fmtN(responden), rotulo: `responden, de ${fmtN(base.nCasos)}` };
  const sinRespuesta: Cifra = { valor: fmtN(sin), rotulo: "sin respuesta", nota: "por salto o vacío" };

  if ((dist.tipo === "so" || dist.tipo === "sm") && dist.filas) {
    const declarados = ficha?.opciones.length ? new Set(ficha.opciones.map((o) => o.codigo)) : null;
    const fuera = esFueraDeLista(dist.filas, declarados);
    const enLista = dist.filas.filter((f) => !fuera(f));
    const usadas = enLista.filter((f) => f.n > 0).length;
    const declaradas = ficha?.opciones.length || enLista.length;
    // Casos con un código fuera de la lista, con los filtros activos (dist).
    const casosFuera = dist.filas.filter(fuera).reduce((t, f) => t + f.n, 0);
    return [
      respondenDe,
      sinRespuesta,
      {
        valor: `${fmtN(usadas)} de ${fmtN(declaradas)}`,
        rotulo: "opciones usadas",
        nota: casosFuera === 0 ? "" : `${fmtN(casosFuera)} ${plural(casosFuera, "caso", "casos")} fuera de lista`,
      },
    ];
  }
  if (dist.tipo === "num" && dist.num) {
    const num = dist.num;
    // El prototipo pone "desviación" entre la mediana y el mínimo: el motor no
    // la publica (pedido M6, `desviacion` en `dist.num`). Los atípicos, que la
    // pantalla ya contaba, siguen al final.
    return [
      respondenDe,
      { valor: fmtValor(num.media), rotulo: "media" },
      { valor: fmtValor(num.mediana), rotulo: "mediana" },
      { valor: fmtValor(num.min), rotulo: "mínimo" },
      { valor: fmtValor(num.max), rotulo: "máximo" },
      { valor: fmtN(num.n_atipicos), rotulo: plural(num.n_atipicos, "atípico", "atípicos") },
    ];
  }
  if (dist.tipo === "fecha" && dist.fecha) {
    const dias = dist.fecha.dias;
    const pico = dias.reduce<{ fecha: string; n: number } | null>((m, d) => (!m || d.n > m.n ? d : m), null);
    const conCasos = dias.filter((d) => d.n > 0);
    return [
      respondenDe,
      sinRespuesta,
      ...(pico ? [{ valor: fechaCorta(pico.fecha), rotulo: `día con más casos (${fmtN(pico.n)})` }] : []),
      {
        valor: fmtN(conCasos.length),
        rotulo: plural(conCasos.length, "día con casos", "días con casos"),
        nota: conCasos.length ? `del ${fechaCorta(conCasos[0].fecha)} al ${fechaCorta(conCasos[conCasos.length - 1].fecha)}` : "",
      },
    ];
  }
  if (dist.tipo === "texto" && dist.texto) {
    const grupos = dist.texto.grupos;
    const top = grupos.reduce<{ texto: string; n: number } | null>((m, g) => (!m || g.n > m.n ? g : m), null);
    return [
      respondenDe,
      sinRespuesta,
      { valor: fmtN(grupos.length), rotulo: "respuestas distintas", nota: "agrupadas sin mayúsculas ni tildes" },
      ...(top ? [{ valor: fmtN(top.n), rotulo: "veces la más repetida", nota: top.texto }] : []),
    ];
  }
  return [respondenDe, sinRespuesta];
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
  /** Su denominador tiene menos de 30 casos: se atenúa y no lleva flecha. */
  chica?: boolean;
};

/** Bajo este número de casos, el denominador de una celda es chico: un 100 % de 1 caso no compite con uno de 300. */
export const BASE_CHICA = 30;

/**
 * El tono de una celda (maqueta v4). En porcentajes dice cuánto se aparta del total y hacia dónde, no el valor: así
 * una tabla sin diferencias se ve pareja. Tramos de 2, 5 y 10 puntos; la flecha va desde 5. En n, el tono es el
 * conteo en cinco tramos. Una base chica queda neutra.
 */
export function tonoDeCelda(c: CeldaCalor, lectura: LecturaCalor): string {
  if (lectura === "n") return `is-n${Math.max(1, Math.min(5, Math.ceil(c.peso * 5)))}`;
  if (c.chica || c.dif === null) return "is-parejo";
  const a = Math.abs(c.dif);
  const k = a < 2 ? 0 : a < UMBRAL_PUNTOS ? 1 : a < 10 ? 2 : 3;
  return k === 0 ? "is-parejo" : `is-${c.dif > 0 ? "sobre" : "bajo"}${k}`;
}

export type ModeloCalor = {
  lectura: LecturaCalor;
  /** Cómo se lee la lectura activa: va en la esquina de la tabla, no como título del gráfico (D1). */
  titulo: string;
  columnas: { etiqueta: string; n: number }[];
  /** `n`: casos de la fila (null si un payload viejo no lo trae y no se puede deducir). */
  filas: { etiqueta: string; n: number | null; celdas: CeldaCalor[]; total: CeldaCalor | null }[];
  /** Fila de totales: en lectura por fila (contra ella se compara) y en n. */
  filaTotal: CeldaCalor[] | null;
  /** Esquina total × total: 100 si la lectura suma 100; si no, los casos de la base. */
  esquina: CeldaCalor;
  /** Casos de la base del cruce (responden las dos). */
  totalGeneral: number;
  /** Una línea, sólo con una múltiple: por qué una diferencia puede no ser una asociación. */
  nota: string | null;
};

export type Desviacion = {
  sentido: "arriba" | "abajo";
  titulo: string;
  detalle: string;
  dif: number;
};

function celda(n: number, valor: number, esPct: boolean, total: number | null, chica = false): CeldaCalor {
  const dif = total === null ? null : valor - total;
  const marca = chica || dif === null || Math.abs(dif) < UMBRAL_PUNTOS ? null : dif > 0 ? "arriba" : "abajo";
  return { n, valor, texto: esPct ? fmtDecimal(valor, 1) : fmtN(valor), peso: 0, dif, marca, chica };
}

/** Una celda que no se puede calcular sin mezclar menciones: se dice «—» y no compite. */
function celdaSinDato(n: number): CeldaCalor {
  return { n, valor: 0, texto: "—", peso: 0, dif: null, marca: null };
}

/** Tipo de la variable para la tabla: «so» o «sm» (lo demás no llega a una tabla). */
export type TipoTabla = "so" | "sm" | string;

/** Lectura con la que abre la tabla (revisión metodológica): única × múltiple se lee por fila, «% que marca, por categoría». */
export function lecturaInicial(tipoX: TipoTabla, tipoY: TipoTabla): LecturaCalor {
  return tipoX === "so" && tipoY === "sm" ? "fila" : "columna";
}

/**
 * La tabla de calor, con los denominadores en CASOS (revisión metodológica, 2026-11-03): con una múltiple un caso
 * está en varias celdas, así que ningún total sale de sumar celdas.
 *
 * - Por columna: celda = n / casos de la columna; Total de la fila = casos de la fila / base.
 * - Por fila: celda = n / casos de la fila; fila Total = casos de la columna / base.
 * - En n: totales = casos de fila y de columna; esquina = base.
 *
 * El signo de cada diferencia es el mismo en las dos lecturas (P(A|B) > P(A) ⇔ P(B|A) > P(B)). Sin `filas[].n`
 * (payload viejo) sólo se deduce cuando las dos variables son únicas; si no, sin Total ni flechas. Con base 0,
 * tampoco: nunca se vuelve a menciones.
 */
export function modeloCalor(
  tabla: ExploradorCruceTabla,
  lectura: LecturaCalor,
  baseN = 0,
  tipoX: TipoTabla = "so",
  tipoY: TipoTabla = "so",
): ModeloCalor {
  const nf = tabla.filas.length;
  const sumaFila = tabla.n.map((fila) => fila.reduce((t, x) => t + x, 0));
  const ambasUnicas = tipoX === "so" && tipoY === "so";
  const nFila = tabla.filas.map((f, r) => f.n ?? (ambasUnicas ? sumaFila[r] : null));
  const nCol = tabla.columnas.map((col) => col.n);
  const base = baseN > 0 ? baseN : null;
  const pctDe = (parte: number | null) => (parte === null || base === null ? null : porcentaje(parte, base));
  const conMultiple = tipoX === "sm" || tipoY === "sm";

  const filas: ModeloCalor["filas"] = [];
  for (let r = 0; r < nf; r += 1) {
    let celdas: CeldaCalor[];
    let total: CeldaCalor | null;
    const casos = nFila[r];
    if (lectura === "columna") {
      const pctTotal = pctDe(casos);
      celdas = tabla.n[r].map((x, c) =>
        nCol[c] > 0 ? celda(x, porcentaje(x, nCol[c]), true, pctTotal, nCol[c] < BASE_CHICA) : celdaSinDato(x),
      );
      total = pctTotal === null || casos === null ? null : celda(casos, pctTotal, true, null);
    } else if (lectura === "fila") {
      celdas = tabla.n[r].map((x, c) =>
        casos !== null && casos > 0 ? celda(x, porcentaje(x, casos), true, pctDe(nCol[c]), casos < BASE_CHICA) : celdaSinDato(x),
      );
      // La fila suma 100 sólo si la columna es única; con una múltiple, el Total dice sus casos.
      total = casos === null ? null : tipoY === "so" ? celda(casos, casos > 0 ? 100 : 0, true, null) : celda(casos, casos, false, null);
    } else {
      celdas = tabla.n[r].map((x) => celda(x, x, false, null));
      total = casos === null ? null : celda(casos, casos, false, null);
    }
    filas.push({ etiqueta: tabla.filas[r].etiqueta, n: casos, celdas, total });
  }

  const max = Math.max(0, ...filas.flatMap((f) => f.celdas.map((x) => x.valor)));
  for (const f of filas) for (const x of f.celdas) x.peso = max > 0 ? x.valor / max : 0;

  const filaTotal =
    lectura === "fila"
      ? nCol.map((x) => {
          const p = pctDe(x);
          return p === null ? celdaSinDato(x) : celda(x, p, true, null);
        })
      : lectura === "n"
        ? nCol.map((x) => celda(x, x, false, null))
        : null;
  const totalGeneral = base ?? 0;
  const sumaCien = (lectura === "columna" && tipoX === "so") || (lectura === "fila" && tipoY === "so");
  const esquina = sumaCien && base !== null ? celda(totalGeneral, 100, true, null) : celda(totalGeneral, totalGeneral, false, null);

  const titulo =
    lectura === "columna"
      ? tipoX === "so" ? "Cada columna suma 100%" : "% de cada columna que marca la opción de la fila"
      : lectura === "fila"
        ? tipoY === "so" ? "Cada fila suma 100%" : "% de cada fila que marca la opción de la columna"
        : "Casos en cada celda";
  const nota = !conMultiple
    ? null
    : lectura === "n"
      ? "Los totales cuentan casos: un caso que marca varias opciones está en varias celdas."
      : "Quien marca más opciones entra en más celdas: una diferencia puede ser volumen de marcas y no una asociación.";

  return {
    lectura,
    titulo,
    columnas: tabla.columnas.map((col) => ({ etiqueta: col.etiqueta, n: col.n })),
    filas,
    filaTotal,
    esquina,
    totalGeneral,
    nota,
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
            ? `${col}: ${mas ? "más" : "menos"} "${fila.etiqueta}"`
            : `"${fila.etiqueta}": ${mas ? "más" : "menos"} en ${col}`,
        detalle: `${fmtPct(x.valor)} frente a ${fmtPct(total)} del total, ${fmtDecimal(Math.abs(x.dif), 1)} puntos ${
          mas ? "por encima" : "por debajo"
        }.`,
      });
    });
  });
  return todas.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif)).slice(0, limite);
}

/**
 * «Cada columna tiene entre 95 y 108 casos»: el tamaño del denominador de la lectura activa, que acota cuánto pesa
 * una diferencia. Por fila, el de las filas.
 */
export function rangoColumnas(modelo: ModeloCalor): { min: number; max: number; de: "columna" | "fila" } | null {
  const de = modelo.lectura === "fila" ? "fila" : "columna";
  const ns = (de === "fila" ? modelo.filas.map((f) => f.n ?? 0) : modelo.columnas.map((c) => c.n)).filter((n) => n > 0);
  if (!ns.length) return null;
  return { min: Math.min(...ns), max: Math.max(...ns), de };
}

/**
 * La base de un cruce en una frase: «560 casos responden las dos (de 1,283)», con el «de» sólo si una de las dos
 * variables tiene más casos que el cruce. Sin ponderar: el explorador cuenta casos.
 */
export function fraseCruceBase(cruce: Pick<ExploradorCruce, "base_n" | "n_x" | "n_y">): string {
  const de = [cruce.n_x, cruce.n_y].find((n): n is number => n !== null && n > cruce.base_n);
  const casos = `${fmtN(cruce.base_n)} ${cruce.base_n === 1 ? "caso responde" : "casos responden"} las dos`;
  return `${casos}${de !== undefined ? ` (de ${fmtN(de)})` : ""}, sin ponderar`;
}

// --- Escalas -------------------------------------------------------------------

/** Posición 0..100 de `v` entre `min` y `max` (50 si el rango es nulo). */
export function posicion(v: number, min: number, max: number): number {
  if (!(max > min)) return 50;
  return Math.max(0, Math.min(100, (100 * (v - min)) / (max - min)));
}
