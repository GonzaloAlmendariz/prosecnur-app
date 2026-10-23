/**
 * Control › Respuestas del telefónico (ficha «Control, Respuestas»): qué envío
 * de Kobo es efectiva. Modelo puro sobre `control_tiempo_kobo` (las efectivas
 * que pasan el filtro, con su duración) y `comparacion_codpulso` (lo que dice la
 * hoja de cada caso y su categoría de cuota).
 *
 * Absorbe «Efectivas Kobo» y «Validación de tiempo»: cada envío con su duración,
 * su cruce con la hoja y sus marcas, y la distribución de duraciones. El
 * control de tiempo revisa las CORTAS (pueden estar mal hechas o inventadas);
 * una encuesta larga no es un problema (Gonzalo, 2026-10-23): no se marca, no
 * va a «por revisar» ni a Avisos, y sólo se dice cuántas hay como dato neutro.
 * Marcar no excluye: decide el supervisor.
 *
 * Lo que el corte no trae no se inventa: los envíos de prueba y los sin
 * consentimiento ya vienen filtrados fuera del bloque, así que no hay chips
 * para ellos; los recibidos sólo se cuentan si la metadata del sync los trae.
 */

import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";

type Fila = Record<string, unknown>;

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number | null {
  const crudo = texto(valor).replace(/,/g, "");
  if (!crudo) return null;
  const n = Number(crudo);
  return Number.isFinite(n) ? n : null;
}

function clave(valor: unknown) {
  return texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, "");
}

export const DOS_HORAS = 7200;
export const CINCO_MINUTOS = 300;

export type MarcaDeEnvio = "corta" | "repetida" | "no-cruza";

export const ETIQUETA_DE_MARCA: Record<MarcaDeEnvio, string> = {
  corta: "Menos de 5 min",
  repetida: "Repetida",
  "no-cruza": "No cruza",
};

/**
 * Cómo cruzó el código de un envío con la hoja. Lo pintan Control › Respuestas
 * e Insumos › Llave y filtros: vive aquí, junto al valor, para que las dos
 * pestañas no puedan decirlo distinto.
 */
export const ROTULO_DE_LLAVE: Record<EnvioEfectivo["llave"], string> = {
  exacta: "Exacta",
  normalizada: "Por sus dígitos",
  "no-cruza": "No cruza",
};

export type EnvioEfectivo = {
  codigo: string;
  fecha: string | null;
  segundos: number | null;
  categoria: string;
  /** Status del caso en la hoja de barrido, si cruza. */
  hojaDice: string;
  responsable: string;
  cruza: boolean;
  /** Cómo cruzó el código con la hoja: tal cual, o sólo por sus dígitos. */
  llave: "exacta" | "normalizada" | "no-cruza";
  /** El CodPulso del caso de la hoja con el que cruzó; vacío si no cruza. */
  codigoEnHoja: string;
  marcas: MarcaDeEnvio[];
  responseId: string;
};

/** `corto`: el tramo que el control de tiempo revisa (menos de 5 min). */
export type TramoDeDuracion = { etiqueta: string; casos: number; corto: boolean };

export type Respuestas = {
  envios: EnvioEfectivo[];
  unicas: number;
  /** Envíos de más: los que sobran sobre uno por CodPulso. */
  repetidos: number;
  /** CodPulso con más de un envío. */
  casosRepetidos: number;
  mediana: number | null;
  tramos: TramoDeDuracion[];
  conteos: Record<MarcaDeEnvio, number>;
  /** Dato neutro: cuántas duraron más de 2 h. */
  largas: number;
  porRevisar: number;
};

const TRAMOS: ReadonlyArray<{ etiqueta: string; hasta: number; corto?: boolean }> = [
  { etiqueta: "< 5 min", hasta: 300, corto: true },
  { etiqueta: "5–10", hasta: 600 },
  { etiqueta: "10–15", hasta: 900 },
  { etiqueta: "15–20", hasta: 1200 },
  { etiqueta: "20–30", hasta: 1800 },
  { etiqueta: "30–60", hasta: 3600 },
  { etiqueta: "1–2 h", hasta: DOS_HORAS },
  { etiqueta: "> 2 h", hasta: Number.POSITIVE_INFINITY },
];

function mediana(valores: number[]) {
  const orden = [...valores].sort((a, b) => a - b);
  if (!orden.length) return null;
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

export function construirRespuestas({
  reports,
  segmento,
}: {
  reports: MonitoreoAcreditacionReports | null | undefined;
  /** Columna de cuota en `comparacion_codpulso` (Sede, Actor…). */
  segmento: string;
}): Respuestas {
  const comparacion = new Map<string, Fila>();
  filasDeBloque(reports, ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]).forEach((fila) => {
    const llave = clave(fila.CodPulso ?? fila.Caso);
    if (llave && !comparacion.has(llave)) comparacion.set(llave, fila);
  });
  // Un código tecleado sin prefijo («1231») cruza con «PDM1231» por sus
  // dígitos, sólo si esos dígitos señalan un único caso de la hoja: en Medios
  // de Vida MVH0019 y MVV0019 comparten dígitos y no se adivina.
  const porDigitos = new Map<string, Fila | null>();
  comparacion.forEach((fila, llave) => {
    const digitos = llave.replace(/\D/g, "");
    if (!digitos) return;
    porDigitos.set(digitos, porDigitos.has(digitos) ? null : fila);
  });
  const filas = filasDeBloque(reports, ["control_tiempo_kobo", "tiempos_kobo", "validacion_tiempos"]);
  const veces = new Map<string, number>();
  filas.forEach((fila) => {
    const llave = clave(fila.CodPulso);
    if (llave) veces.set(llave, (veces.get(llave) ?? 0) + 1);
  });

  const envios: EnvioEfectivo[] = filas.map((fila) => {
    const llave = clave(fila.CodPulso);
    const exacto = llave ? comparacion.get(llave) : undefined;
    const digitos = llave.replace(/\D/g, "");
    const normalizado = !exacto && digitos ? porDigitos.get(digitos) ?? undefined : undefined;
    const caso = exacto ?? normalizado;
    const segundos = numero(fila["Duración segundos"] ?? fila["Duracion segundos"]);
    const marcas: MarcaDeEnvio[] = [];
    // Corta: la regla de duración del motor (muy corto o corto) o, sin ella,
    // menos de 5 min. Una larga no se marca.
    const estadoDuracion = texto(fila["Estado duración"] ?? fila["Estado duracion"]).toLowerCase();
    const cortaPorRegla = estadoDuracion === "muy_corto" || estadoDuracion === "corto";
    if (cortaPorRegla || (segundos != null && segundos < CINCO_MINUTOS)) marcas.push("corta");
    if (llave && (veces.get(llave) ?? 0) > 1) marcas.push("repetida");
    if (!caso) marcas.push("no-cruza");
    return {
      codigo: texto(fila.CodPulso) || "Sin código",
      fecha: texto(fila["Fecha Kobo"] ?? fila.Fecha) || null,
      segundos,
      categoria: caso ? texto(caso[segmento] ?? caso.Sede ?? caso.Actor) : "",
      hojaDice: caso ? texto(caso["Estado telefónico"] ?? caso["Estado telefonico"]) : "",
      responsable: caso ? texto(caso.Responsable) : texto(fila["Responsable plataforma"]),
      cruza: Boolean(caso),
      llave: exacto ? "exacta" : normalizado ? "normalizada" : "no-cruza",
      codigoEnHoja: caso ? texto(caso.CodPulso) : "",
      marcas,
      responseId: texto(fila["Response ID"]),
    };
  });

  const duraciones = envios.map((envio) => envio.segundos).filter((s): s is number => s != null);
  const conteos: Record<MarcaDeEnvio, number> = { corta: 0, repetida: 0, "no-cruza": 0 };
  envios.forEach((envio) => envio.marcas.forEach((marca) => { conteos[marca] += 1; }));
  const unicas = new Set(envios.map((envio) => clave(envio.codigo)).filter(Boolean)).size;

  return {
    envios,
    unicas,
    repetidos: envios.length - unicas,
    casosRepetidos: [...veces.values()].filter((cuantas) => cuantas > 1).length,
    mediana: mediana(duraciones),
    tramos: TRAMOS.map((tramo, i) => {
      const desde = i === 0 ? Number.NEGATIVE_INFINITY : TRAMOS[i - 1].hasta;
      return {
        etiqueta: tramo.etiqueta,
        casos: duraciones.filter((s) => s >= desde && s < tramo.hasta).length,
        corto: Boolean(tramo.corto),
      };
    }),
    conteos,
    /** Dato neutro: cuántas duraron más de 2 h. No es un problema ni se revisa. */
    largas: duraciones.filter((s) => s > DOS_HORAS).length,
    porRevisar: envios.filter((envio) => envio.marcas.length > 0).length,
  };
}

export type FiltroDeRespuestas = "por-revisar" | "todas" | MarcaDeEnvio;

const ORDEN_DE_LLAVE: Record<EnvioEfectivo["llave"], number> = { "no-cruza": 0, normalizada: 1, exacta: 2 };

export function filtrarEnvios(envios: readonly EnvioEfectivo[], filtro: FiltroDeRespuestas, busqueda: string) {
  const buscada = clave(busqueda);
  return envios
    .filter((envio) => (
      filtro === "todas" ? true : filtro === "por-revisar" ? envio.marcas.length > 0 : envio.marcas.includes(filtro)
    ))
    .filter((envio) => !buscada || clave(envio.codigo).includes(buscada))
    // En «Todas» van primero los que no cruzaron tal cual (por sus dígitos o
    // sin cruce): sin otro criterio, es lo único de la llave que hay que mirar.
    .sort((a, b) => (filtro === "todas" ? ORDEN_DE_LLAVE[a.llave] - ORDEN_DE_LLAVE[b.llave] : 0)
      || b.marcas.length - a.marcas.length
      || (a.fecha ?? "").localeCompare(b.fecha ?? "")
      || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
}

/** «29 min», «2 h 22», «101 h 45». */
export function duracionLegible(segundos: number | null) {
  if (segundos == null) return "—";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas} h ${String(minutos % 60).padStart(2, "0")}`;
}

function plural(cantidad: number, uno: string, varios: string) {
  return `${cantidad.toLocaleString("es-PE")} ${cantidad === 1 ? uno : varios}`;
}

/**
 * Las repetidas se cuentan de dos maneras y cada rótulo dice la suya: el chip
 * filtra envíos marcados (todos los del caso repetido) y la cadena descuenta
 * los que sobran. En PDM: «Repetidas: 1 caso, 2 envíos» y «1 envío repetido de
 * 1 caso».
 */
export function rotuloDeRepetidas(modelo: Pick<Respuestas, "casosRepetidos" | "conteos">) {
  return `Repetidas: ${plural(modelo.casosRepetidos, "caso", "casos")}, ${plural(modelo.conteos.repetida, "envío", "envíos")}`;
}

export function mermaDeRepetidos(modelo: Pick<Respuestas, "casosRepetidos" | "repetidos">) {
  if (!modelo.repetidos) return undefined;
  return `${plural(modelo.repetidos, "envío repetido", "envíos repetidos")} de ${plural(modelo.casosRepetidos, "caso", "casos")}`;
}
