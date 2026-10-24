/**
 * Rondas de supervisión (Control › Supervisión). Cada ronda sale de las
 * efectivas nuevas desde la anterior, con un porcentaje repartido por
 * enumerador (mínimo 1) más los casos que el analista agrega; queda guardada y
 * numerada, y se publica en su propia pestaña «Ronda N» de la hoja de
 * supervisión. Motor: `api/R/monitoreo_supervision_rondas.R`.
 *
 * Bloques: `supervision_rondas` (una fila por ronda), `supervision_base`
 * (las efectivas con la ronda que las eligió), `supervision_casos` y
 * `supervision_reparto` (con su `Ronda`), `supervision_resumen`.
 */
import type { MonitoreoAcreditacionReports, MonitoreoSource } from "../../../../../api/client";
import type { RondaDeSupervisionApi } from "../../../../../api/monitoreoTelefonico";
import { filasDeBloque } from "../navegacion/bloques";
import type { CasoSorteado, RepartoDeEnumerador } from "./supervisionModel";

export type FilaDeRonda = {
  numero: number;
  guardada: boolean;
  generadaEl: string;
  porcentaje: number | null;
  semilla: number | null;
  universo: number;
  corte: string;
  sorteados: number;
  agregados: number;
  casos: number;
  publicadaEn: string;
  publicadaEl: string;
  /** Última lectura de su pestaña: `leida`, `pestana_borrada`, `sin_pestana` o "" si nunca se leyó. */
  lectura: string;
  leidaEl: string;
};

export type CasoDeLaBase = {
  codigo: string;
  progres: string;
  enumerador: string;
  categoria: string;
  fechaKobo: string;
  responseId: string;
  /** La ronda que ya lo eligió, o null si sigue disponible. */
  ronda: number | null;
};

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number | null {
  const crudo = texto(valor);
  if (!crudo) return null;
  const n = Number(crudo);
  return Number.isFinite(n) ? n : null;
}

export function rondasDesdeBloques(reports: MonitoreoAcreditacionReports | null | undefined): FilaDeRonda[] {
  return filasDeBloque(reports, ["supervision_rondas"]).flatMap((fila) => {
    const n = numero(fila.Ronda);
    if (n == null) return [];
    return [{
      numero: n,
      guardada: texto(fila.Guardada) === "Sí",
      generadaEl: texto(fila["Generada el"]),
      porcentaje: numero(fila.Porcentaje),
      semilla: numero(fila.Semilla),
      universo: numero(fila.Universo) ?? 0,
      corte: texto(fila.Corte),
      sorteados: numero(fila.Sorteados) ?? 0,
      agregados: numero(fila.Agregados) ?? 0,
      casos: numero(fila.Casos) ?? 0,
      publicadaEn: texto(fila["Publicada en"]),
      publicadaEl: texto(fila["Publicada el"]),
      lectura: texto(fila.Lectura),
      leidaEl: texto(fila["Leída el"]),
    }];
  }).sort((a, b) => a.numero - b.numero);
}

/** Las rondas que devuelve la API tras generar o publicar, con la forma del bloque. */
export function rondasDesdeApi(rondas: readonly RondaDeSupervisionApi[]): FilaDeRonda[] {
  return rondas.map((ronda) => {
    const origen = ronda.casos.map((caso) => texto(caso.Origen));
    return {
      numero: ronda.numero,
      guardada: true,
      generadaEl: ronda.generada_el,
      porcentaje: ronda.porcentaje,
      semilla: ronda.semilla,
      universo: ronda.universo,
      corte: ronda.corte,
      sorteados: origen.filter((o) => o === "sorteo").length,
      agregados: origen.filter((o) => o === "analista").length,
      casos: ronda.casos.length,
      publicadaEn: ronda.publicada?.pestana ?? "",
      publicadaEl: ronda.publicada?.en ?? "",
      lectura: ronda.resultados?.estado ?? "",
      leidaEl: ronda.resultados?.leido_el ?? "",
    };
  });
}

/** Los casos de una ronda recién devuelta por la API, con la forma de `supervision_casos`. */
export function casosDeRondaApi(ronda: RondaDeSupervisionApi): CasoSorteado[] {
  return ronda.casos.map((caso, i) => ({
    n: numero(caso.N) ?? i + 1,
    codigo: texto(caso.CodPulso),
    progres: texto(caso.proGres),
    enumerador: texto(caso.Enumerador),
    categoria: texto(caso["Categoría"]),
    fechaKobo: texto(caso["Fecha Kobo"]),
    resultado: "",
    statusFinal: "",
    coincide: "",
    observacion: "",
    supervisor: "",
    controles: "",
    controlesQueNoCoinciden: [],
    ronda: ronda.numero,
    origen: texto(caso.Origen),
  }));
}

/** El reparto de una ronda recién devuelta por la API, con la forma de `supervision_reparto`. */
export function repartoDeRondaApi(ronda: RondaDeSupervisionApi): RepartoDeEnumerador[] {
  return ronda.reparto.map((fila) => ({
    enumerador: texto(fila.Enumerador),
    efectivas: numero(fila.Efectivas) ?? 0,
    casos: numero(fila.Casos) ?? 0,
    minimo: fila["Mínimo"] === true || /^(true|sí|si)$/i.test(texto(fila["Mínimo"])),
    ronda: ronda.numero,
  }));
}

export function baseDeSupervision(reports: MonitoreoAcreditacionReports | null | undefined): CasoDeLaBase[] {
  return filasDeBloque(reports, ["supervision_base"]).map((fila) => ({
    codigo: texto(fila.CodPulso),
    progres: texto(fila.proGres),
    enumerador: texto(fila.Enumerador) || "Sin enumerador",
    categoria: texto(fila["Categoría"]),
    fechaKobo: texto(fila["Fecha Kobo"]),
    responseId: texto(fila["Response ID"]),
    ronda: numero(fila.Ronda),
  })).filter((caso) => caso.codigo);
}

export function efectivasSinRonda(reports: MonitoreoAcreditacionReports | null | undefined) {
  const fila = filasDeBloque(reports, ["supervision_resumen"]).find((item) => texto(item.Indicador) === "Efectivas sin ronda");
  return fila ? numero(fila.Valor) : null;
}

/**
 * El reparto que saldría con un porcentaje: proporcional a las efectivas de
 * cada enumerador por mayor resto, al menos uno por enumerador y nunca más que
 * sus efectivas. Es el mismo criterio del motor (`.monitoreo_supervision_reparto`).
 */
export function repartoPrevio(porEnumerador: ReadonlyMap<string, number>, porcentaje: number) {
  const entradas = [...porEnumerador.entries()].filter(([, efectivas]) => efectivas > 0);
  const total = entradas.reduce((suma, [, efectivas]) => suma + efectivas, 0);
  const vacio = { casos: 0, filas: [] as Array<{ enumerador: string; efectivas: number; casos: number; minimo: boolean }> };
  // Como el motor: `ceiling(universo * pct / 100)`, en el mismo orden de
  // operaciones para que la coma flotante redondee igual; 0 % no sortea nada
  // (la ronda queda sólo con los casos agregados a mano).
  const declarados = porcentaje > 0 && total ? Math.ceil((total * porcentaje) / 100) : 0;
  if (!declarados) return vacio;
  const cuota = entradas.map(([enumerador, efectivas]) => ({ enumerador, efectivas, exacta: (efectivas / total) * Math.min(declarados, total) }));
  const base = cuota.map((item) => ({ ...item, casos: Math.floor(item.exacta) }));
  let resto = Math.min(declarados, total) - base.reduce((suma, item) => suma + item.casos, 0);
  [...base]
    .sort((a, b) => Math.round((b.exacta - b.casos) * 1e9) - Math.round((a.exacta - a.casos) * 1e9) || b.efectivas - a.efectivas || a.enumerador.localeCompare(b.enumerador, "es"))
    .forEach((item) => {
      if (resto > 0) {
        item.casos += 1;
        resto -= 1;
      }
    });
  const filas = base.map((item) => {
    const proporcional = item.casos;
    const casos = Math.min(item.efectivas, Math.max(proporcional, 1));
    return { enumerador: item.enumerador, efectivas: item.efectivas, casos, minimo: casos > proporcional };
  }).sort((a, b) => b.efectivas - a.efectivas || a.enumerador.localeCompare(b.enumerador, "es"));
  return { casos: filas.reduce((suma, item) => suma + item.casos, 0), filas };
}

/** Avisos de la hoja de supervisión (hoy: una ronda publicada cuya pestaña se borró). */
export function avisosDeSupervision(reports: MonitoreoAcreditacionReports | null | undefined) {
  return filasDeBloque(reports, ["supervision_avisos"])
    .map((fila) => ({ ronda: numero(fila.Ronda), aviso: texto(fila.Aviso) }))
    .filter((fila) => fila.aviso);
}

/** La hoja de supervisión conectada (rol `supervision`), si la hay. */
export function hojaDeSupervision(fuentes: readonly MonitoreoSource[] = []) {
  return fuentes.find((fuente) => fuente.enabled && fuente.role === "supervision") ?? null;
}

const MENSAJES: Record<string, string> = {
  E_MONITOREO_SUPERVISION_PORCENTAJE: "El porcentaje tiene que estar entre 1 y 100.",
  E_MONITOREO_SUPERVISION_AGREGADO: "Uno de los casos agregados no es una efectiva de este corte.",
  E_MONITOREO_SUPERVISION_REPETIDO: "Uno de los casos agregados ya salió en una ronda anterior.",
  E_MONITOREO_SUPERVISION_SIN_NUEVAS: "No hay efectivas nuevas desde la última ronda.",
  E_MONITOREO_SUPERVISION_RONDA: "Esa ronda no está guardada: genérala antes de publicarla.",
  E_MONITOREO_SUPERVISION_HOJA: "No hay hoja de supervisión conectada: conéctala en Insumos, Fuentes.",
  E_MONITOREO_SUPERVISION_PESTANA_OCUPADA: "La hoja ya tiene una pestaña con el nombre de esta ronda; no se toca.",
  E_MONITOREO_SUPERVISION_PUBLICADA: "Esta ronda ya está publicada; no se reescribe.",
  E_MONITOREO_SUPERVISION_PREGUNTA: "Una de las preguntas elegidas no está en la encuesta.",
};

/**
 * El error en palabras: el mensaje del motor sin el « · E_…» del final o, si
 * sólo llegó la clave, su traducción. Nunca la clave cruda.
 */
export function mensajeDeError(error: unknown) {
  const crudo = error instanceof Error ? error.message : String(error ?? "");
  const codigo = (error as { code?: string } | null)?.code ?? /(E_[A-Z_]+)/.exec(crudo)?.[1] ?? "";
  const sinClave = crudo.replace(/\s*·\s*E_[A-Z_]+\s*$/, "").trim();
  if (sinClave && !/^E_[A-Z_]+$/.test(sinClave)) return sinClave;
  return MENSAJES[codigo] ?? "No se pudo completar la acción.";
}
