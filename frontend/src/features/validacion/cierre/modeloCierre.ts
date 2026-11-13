// Lo que la pestaña Cierre de Validación escribe (plan de fidelidad, rebanada
// V4; prototipo `validacion-cierre`, vistas.js:1021-1049), a partir de
// `GET /limpieza` con su campo `cierre` (motor M5) y de `GET /auditoria/estado`.
// Puro: se prueba sin React ni red.
//
// Reglas de las cifras:
//  - Los casos excluidos salen de la cadena de casos (`cadena_casos`), no de
//    `summary`: después de cerrar, `summary` se mide sobre la base ya limpia y
//    vale 0.
//  - Las cifras por decisión (`decisiones_aplicadas`) también se miden sobre la
//    base vigente. Si esa base ya es la limpia de un cierre anterior, no cuentan
//    lo que ese cierre excluyó: la pantalla no las pone junto a la cadena sin
//    decir la causa, y la cabecera no publica "valores cambiados".
//  - `n_fuentes` llega `null`: la franja no dice "de N fuentes".

import type {
  ArchivoDelCierre,
  CadenaDeCasos,
  CierreDeLimpieza,
  DecisionAplicada,
  DecisionesAplicadas,
  EfectoAplicado,
} from "../../../api/validacionCierre";
import { normalizarAplicabilidad, textoDeMotivoNoAplicable, type AuditoriaEstado, type ClaseDeHallazgo } from "../../../api/validacionAuditoria";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import type { EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { AvisoDeFranja, CifraDeFranja, GrupoDeFranja } from "../../../components/procesamiento/FranjaRecorrido";
import { formatoConteo, formatoDecimal } from "../../../lib/formatoNumero";
import type { LimpiezaArtifactsBundle, LimpiezaSummary } from "../types";
import { ROTULO_FICHA_FISICA, esFichaFisica } from "../hallazgos/fichaFisica";
import { conteo, elementosDeCola, fechaCorta, type ElementoDeCola } from "../hallazgos/modeloHallazgos";

// ---------------------------------------------------------------------------
// Palabras
// ---------------------------------------------------------------------------

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"] as const;

/** "6 nov 11:20" de una fecha ISO, en la hora local; `null` si no se puede leer. */
export function fechaYHora(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return null;
  const hh = String(f.getHours()).padStart(2, "0");
  const mm = String(f.getMinutes()).padStart(2, "0");
  return `${f.getDate()} ${MESES[f.getMonth()]} ${hh}:${mm}`;
}

/** "97.2 %" de una proporción de 0 a 1. */
export function porcentaje(proporcion: number): string {
  return `${formatoDecimal(proporcion * 100, 1)} %`;
}

/** Lo que se hizo, como lo nombra la decisión en Hallazgos ("Qué hacer"). */
const TRATAMIENTO: Record<string, string> = {
  ignore_rule: "Dejar como está",
  exclude_cases: "Excluir los casos",
  nullify_fields: "Vaciar la respuesta",
  replace_value: "Corregir el valor",
  set_value: "Asignar un valor",
  recode_map: "Recodificar",
  complete_select_multiple_hierarchy: "Completar opciones",
  adjust_select_multiple: "Agregar o quitar opciones",
  normalize_value: "Normalizar el valor",
  impute_value: "Imputar el valor",
};

export function tratamientoDe(accion: string): string {
  return TRATAMIENTO[accion] ?? "Otra acción";
}

// ---------------------------------------------------------------------------
// En qué punto está la base
// ---------------------------------------------------------------------------

export type SituacionDeLaBase =
  | { tipo: "sin-auditar" }
  | { tipo: "por-decidir"; pendientes: number }
  | { tipo: "lista-para-cerrar" }
  /** Rige la base limpia de un cierre anterior y las decisiones cambiaron después. */
  | { tipo: "cambios-sin-cerrar"; cerradaEn: string | null }
  | { tipo: "cerrada"; cerradaEn: string | null; bloqueo: string | null; sinRespaldo: boolean }
  /** Se cerró y después se volvió a la base cargada (revertir la promoción). */
  | { tipo: "reabierta"; reabiertaEn: string | null; casosCargados: number | null };

function artefactos(data: LimpiezaSummary): Partial<LimpiezaArtifactsBundle> {
  return (data.artifacts ?? {}) as Partial<LimpiezaArtifactsBundle>;
}

function textoOVacio(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function cifraONulo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

export function situacionDeLaBase(data: LimpiezaSummary, cierre: CierreDeLimpieza | null): SituacionDeLaBase {
  if (!data.progreso?.auditoria_corrida) return { tipo: "sin-auditar" };
  const a = artefactos(data);
  const promo = a.promocion ?? null;
  const bloqueo = textoOVacio(promo?.bloqueo);
  const rige = !!promo?.enabled && !bloqueo;
  const revertida = !!promo && !promo.enabled && !bloqueo && !!promo.reverted_at;
  const cerrada = cierre ? cierre.estado === "cerrada" : !!a.finalized_at;
  const cerradaEn = cierre?.cerrada_en ?? a.finalized_at ?? null;
  if (cerrada) {
    if (revertida) return { tipo: "reabierta", reabiertaEn: promo?.reverted_at ?? null, casosCargados: cifraONulo(promo?.n_casos_antes) };
    return { tipo: "cerrada", cerradaEn, bloqueo, sinRespaldo: rige && promo?.sin_respaldo === true };
  }
  if (rige) return { tipo: "cambios-sin-cerrar", cerradaEn: promo?.applied_at ?? null };
  if (data.summary?.ready_to_finalize) return { tipo: "lista-para-cerrar" };
  return { tipo: "por-decidir", pendientes: Math.max(0, data.summary?.pendientes ?? 0) };
}

/** Se puede volver a la base cargada: la base limpia rige. */
export function sePuedeReabrir(s: SituacionDeLaBase): boolean {
  return (s.tipo === "cerrada" && !s.bloqueo) || s.tipo === "cambios-sin-cerrar";
}

/** Cerrar (aplicar las decisiones y generar la base limpia) tiene sentido. */
export function seOfreceCerrar(s: SituacionDeLaBase): boolean {
  return s.tipo !== "cerrada";
}

/** Por qué "Cerrar la base" no se puede pulsar; `null` si se puede. */
export function causaDeNoCerrar(s: SituacionDeLaBase, data: LimpiezaSummary): string | null {
  if (s.tipo === "sin-auditar") return "La base no se ha auditado.";
  if (s.tipo === "por-decidir") {
    return s.pendientes > 0
      ? `${s.pendientes === 1 ? "Queda" : "Quedan"} ${conteo(s.pendientes, "hallazgo", "hallazgos")} por decidir.`
      : "Las decisiones todavía no están listas para aplicarse.";
  }
  if (!data.summary?.ready_to_finalize) return "Las decisiones todavía no están listas para aplicarse.";
  return null;
}

// ---------------------------------------------------------------------------
// Las cifras por decisión frente a la cadena
// ---------------------------------------------------------------------------

/**
 * Por qué las cifras por decisión no cuentan lo mismo que la cadena, o `null`
 * si cuadran. Dos casos: la cadena del cierre excluye casos que las decisiones
 * no registran (un segundo cierre medido sobre la base ya limpia), o la vista
 * previa se mide sobre la base limpia de un cierre anterior.
 */
export function avisoDeCifrasPorDecision(cierre: CierreDeLimpieza | null): string | null {
  const cadena = cierre?.cadena_casos ?? null;
  const tot = cierre?.decisiones_aplicadas?.totales ?? null;
  if (!cadena) return null;
  const sobreLaLimpia = cadena.avisos.some((a) => a.codigo === "base_vigente_ya_limpia");
  if (sobreLaLimpia) {
    return "Las cifras por decisión se miden sobre la base limpia del cierre anterior: no cuentan los casos ni los valores que ese cierre ya cambió.";
  }
  const enCadena = cadena.excluidos_en_limpieza;
  const enDecisiones = tot?.n_casos_excluidos ?? null;
  if (enCadena !== null && enDecisiones !== null && enCadena !== enDecisiones) {
    return `Las cifras por decisión se midieron sobre la base ya limpia de un cierre anterior: no incluyen ${conteo(enCadena, "caso excluido", "casos excluidos")} que la cadena sí cuenta.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// La cabecera
// ---------------------------------------------------------------------------

export type CabeceraDeCierre = { estado: EstadoDePestana | null; cifras: CifraDePestana[]; pendientes: string };

export function estadoDeLaPestana(s: SituacionDeLaBase): EstadoDePestana {
  switch (s.tipo) {
    case "sin-auditar":
      return { tono: "parcial", texto: "Sin auditar" };
    case "por-decidir":
      return { tono: "parcial", texto: "Por decidir" };
    case "lista-para-cerrar":
      return { tono: "parcial", texto: "Lista para cerrar" };
    case "cambios-sin-cerrar":
      return { tono: "atencion", texto: "Con cambios sin cerrar" };
    case "cerrada": {
      const fecha = fechaCorta(s.cerradaEn);
      return { tono: s.bloqueo || s.sinRespaldo ? "atencion" : "listo", texto: fecha ? `Cerrada el ${fecha}` : "Cerrada" };
    }
    case "reabierta": {
      const fecha = fechaCorta(s.reabiertaEn);
      return { tono: "parcial", texto: fecha ? `Reabierta el ${fecha}` : "Reabierta" };
    }
  }
}

export function cabeceraDeCierre(opciones: {
  data: LimpiezaSummary;
  cierre: CierreDeLimpieza | null;
  situacion: SituacionDeLaBase;
  auditoria: AuditoriaEstado | null;
}): CabeceraDeCierre {
  const { data, cierre, situacion, auditoria } = opciones;
  const pendientes: string[] = [];
  const cifras: CifraDePestana[] = [];
  if (situacion.tipo === "sin-auditar") {
    return { estado: estadoDeLaPestana(situacion), cifras, pendientes: "" };
  }
  const elementos = elementosDeCola(data);
  const total = elementos.length;
  const decididos = elementos.filter((e) => !e.pendiente).length;
  cifras.push(total > 0
    ? { clave: "decididos", valor: formatoConteo(decididos), base: formatoConteo(total), rotulo: "hallazgos decididos", tono: decididos === total ? "ok" : "alerta", rango: 1 }
    : { clave: "decididos", valor: "0", rotulo: "hallazgos", rango: 1 });

  const celdas = cierre?.decisiones_aplicadas?.totales.n_celdas_cambiadas ?? null;
  if (celdas !== null && !avisoDeCifrasPorDecision(cierre)) {
    cifras.push({ clave: "valores", valor: formatoConteo(celdas), rotulo: celdas === 1 ? "valor cambiado" : "valores cambiados", rango: 2 });
  } else {
    pendientes.push(celdas === null
      ? "valores cambiados: el motor no publicó las decisiones aplicadas"
      : "valores cambiados: las cifras por decisión se midieron sobre la base ya limpia");
  }

  const fecha = fechaCorta(auditoria?.auditada_en ?? null);
  if (fecha) cifras.push({ clave: "auditoria", valor: fecha, rotulo: "última auditoría", rango: 3 });
  else pendientes.push("última auditoría: el motor no registró la fecha de la auditoría");

  return { estado: estadoDeLaPestana(situacion), cifras, pendientes: pendientes.join("; ") };
}

// ---------------------------------------------------------------------------
// La franja de casos
// ---------------------------------------------------------------------------

export type FranjaDeCasos = {
  grupos: GrupoDeFranja[];
  cuentan: number;
  nota: string | null;
  /** De 0 a 1; `null` si el motor no la midió. */
  proporcion: number | null;
  avisos: AvisoDeFranja[];
};

function cifraFuera(id: string, n: number, singular: string, plural: string): CifraDeFranja {
  return { id, cifra: n, texto: n === 1 ? singular : plural };
}

/**
 * De los recibidos a los que cuentan. Lo que queda fuera antes de la limpieza
 * se dice por causa; las pruebas solo se nombran si hay filtro de pruebas o si
 * salió alguna (sin filtro, "0 pruebas" se leería como "se revisó y no hubo").
 */
export function franjaDeCasos(cadena: CadenaDeCasos | null, situacion: SituacionDeLaBase): FranjaDeCasos | null {
  if (!cadena || cadena.recibidos === null || cadena.cuentan === null) return null;
  const f = cadena.fuera;
  const fuera: CifraDeFranja[] = [];
  if ((f.retirados_fuera_de_la_app ?? 0) > 0 || cadena.depuracion_externa) {
    fuera.push(cifraFuera("retirados", f.retirados_fuera_de_la_app ?? 0, "retirado antes de cargar", "retirados antes de cargar"));
  }
  if (cadena.filtro_de_pruebas || (f.pruebas ?? 0) > 0) fuera.push(cifraFuera("pruebas", f.pruebas ?? 0, "prueba", "pruebas"));
  if ((f.por_reglas_de_carga ?? 0) > 0) fuera.push(cifraFuera("reglas", f.por_reglas_de_carga ?? 0, "por reglas de Carga", "por reglas de Carga"));
  if ((f.sin_clasificar ?? 0) > 0) fuera.push(cifraFuera("sin-clasificar", f.sin_clasificar ?? 0, "sin clasificar", "sin clasificar"));
  if (f.fuera_de_la_auditoria !== null) {
    fuera.push(cifraFuera("fuera-auditoria", f.fuera_de_la_auditoria, "fuera de la auditoría", "fuera de la auditoría"));
  }
  const excluidos = cadena.excluidos_en_limpieza;
  if (excluidos !== null) {
    fuera.push({ id: "excluidos", cifra: excluidos, texto: excluidos === 1 ? "excluido en limpieza" : "excluidos en limpieza", ...(excluidos > 0 ? { tono: "aviso" as const } : {}) });
  }
  const avisos: AvisoDeFranja[] = cadena.avisos.map((a) => ({ id: a.codigo || a.texto, texto: a.texto, tono: "aviso" }));
  if (situacion.tipo === "reabierta") {
    const fecha = fechaCorta(situacion.reabiertaEn);
    const cargados = situacion.casosCargados;
    avisos.unshift({
      id: "reabierta",
      tono: "aviso",
      texto: `Son las cifras del cierre. La base se reabrió${fecha ? ` el ${fecha}` : ""}: ${cargados !== null ? `hoy cuentan los ${formatoConteo(cargados)} casos cargados` : "hoy cuentan los casos cargados"}.`,
    });
  }
  const proporcion = cadena.proporcion;
  return {
    grupos: [
      { id: "recibidos", rotulo: "Recibidos", cifras: [{ id: "recibidos", cifra: cadena.recibidos, texto: cadena.recibidos === 1 ? "caso" : "casos" }] },
      { id: "fuera", rotulo: "Quedan fuera", cifras: fuera },
    ],
    cuentan: cadena.cuentan,
    nota: proporcion !== null ? porcentaje(proporcion) : null,
    proporcion,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Las decisiones aplicadas, por grupo
// ---------------------------------------------------------------------------

export type FilaDeDecision = {
  id: string;
  sourceId: string;
  /** El nombre del hallazgo (de la cola); el id de la regla si la cola ya no lo trae. */
  hallazgo: string;
  enCola: boolean;
  motivo: string | null;
  clase: ClaseDeHallazgo | null;
  tratamiento: string;
  /** La cifra del grupo para esta decisión; `null` en las que no se aplicaron. */
  cifra: number | null;
  /** Una línea bajo el motivo: casos que ya excluyó otra decisión, o por qué no se aplicó. */
  nota: string | null;
};

export type GrupoDeDecisiones = {
  efecto: EfectoAplicado;
  titulo: string;
  /** "2 casos", "1 valor", "3 revisiones de casos"; `null` sin cifra (no se aplicaron). */
  resumen: string | null;
  filas: FilaDeDecision[];
};

const TITULO_DE_GRUPO: Record<EfectoAplicado, string> = {
  excluye: "Casos excluidos",
  cambia_valores: "Valores cambiados",
  sin_cambios: "Sin cambios",
  no_se_aplica: "No se aplicaron",
};

function resumenDeGrupo(efecto: EfectoAplicado, cifra: number | null): string | null {
  if (cifra === null) return null;
  if (efecto === "excluye") return conteo(cifra, "caso", "casos");
  if (efecto === "cambia_valores") return conteo(cifra, "valor", "valores");
  if (efecto === "sin_cambios") return conteo(cifra, "revisión de caso", "revisiones de casos");
  return null;
}

function cifraDeFila(d: DecisionAplicada, efecto: EfectoAplicado): number | null {
  if (efecto === "excluye") return d.n_filas_excluidas;
  if (efecto === "cambia_valores") return d.n_celdas_cambiadas;
  if (efecto === "sin_cambios") return d.n_casos_revisados;
  return null;
}

function notaDeFila(d: DecisionAplicada, efecto: EfectoAplicado): string | null {
  if (efecto === "no_se_aplica") {
    const a = normalizarAplicabilidad({ aplicable: false, motivo_no_aplicable: d.motivo_no_aplicable });
    return a.motivo_no_aplicable ? `No se aplicó: ${textoDeMotivoNoAplicable(a.motivo_no_aplicable, a.motivo_crudo)}.` : null;
  }
  const ya = d.n_filas_ya_excluidas ?? 0;
  if (ya > 0) return `${conteo(ya, "caso", "casos")} que también excluye ya ${ya === 1 ? "lo excluyó" : "los excluyó"} una decisión anterior.`;
  return null;
}

/**
 * Los grupos de la tabla en el orden del motor (primero las exclusiones), solo
 * los que tienen decisiones. La cifra del grupo "Casos excluidos" es la de la
 * cadena cuando la hay: es la que cuenta casos distintos al cerrar.
 */
export function gruposDeDecisiones(opciones: {
  aplicadas: DecisionesAplicadas;
  cadena: CadenaDeCasos | null;
  elementos: readonly ElementoDeCola[];
}): GrupoDeDecisiones[] {
  const { aplicadas, cadena, elementos } = opciones;
  const porId = new Map(elementos.map((e) => [e.id, e]));
  return aplicadas.grupos
    .map((g): GrupoDeDecisiones => {
      const decisiones = aplicadas.decisiones.filter((d) => d.efecto === g.efecto);
      const cifra = g.efecto === "excluye" && cadena?.excluidos_en_limpieza != null ? cadena.excluidos_en_limpieza : g.cifra;
      return {
        efecto: g.efecto,
        titulo: TITULO_DE_GRUPO[g.efecto],
        resumen: resumenDeGrupo(g.efecto, cifra),
        filas: decisiones.map((d) => {
          const e = porId.get(d.source_id);
          return {
            id: d.decision_id,
            sourceId: d.source_id,
            hallazgo: e?.nombre ?? d.source_id,
            enCola: !!e,
            motivo: d.rationale,
            clase: e?.clase ?? null,
            tratamiento: tratamientoDe(d.action_type),
            cifra: cifraDeFila(d, g.efecto),
            nota: notaDeFila(d, g.efecto),
          };
        }),
      };
    })
    .filter((g) => g.filas.length > 0);
}

// ---------------------------------------------------------------------------
// Lista para análisis
// ---------------------------------------------------------------------------

export type TonoDeSello = "ok" | "aviso" | "peligro" | "neutro";

export type Sello = { tono: TonoDeSello; titulo: string; detalle: string; reabierta?: boolean };

export function selloDeLaBase(s: SituacionDeLaBase): Sello {
  switch (s.tipo) {
    case "cerrada": {
      const fecha = fechaCorta(s.cerradaEn);
      const titulo = fecha ? `Base cerrada el ${fecha}` : "Base cerrada";
      if (s.bloqueo) return { tono: "aviso", titulo, detalle: `${s.bloqueo} La base limpia no rige: Codificación y Analítica parten de la base cargada.` };
      if (s.sinRespaldo) {
        return { tono: "peligro", titulo, detalle: "Rige la base limpia, pero sus decisiones se borraron al recargar el formulario: no se pueden justificar en el registro." };
      }
      return { tono: "ok", titulo, detalle: "Codificación y Analítica parten de la base limpia." };
    }
    case "reabierta": {
      const fecha = fechaCorta(s.reabiertaEn);
      return {
        tono: "neutro",
        reabierta: true,
        titulo: fecha ? `Base reabierta el ${fecha}` : "Base reabierta",
        detalle: "Codificación y Analítica parten de la base cargada. Las decisiones siguen guardadas.",
      };
    }
    case "cambios-sin-cerrar":
      return { tono: "aviso", titulo: "Cambios sin cerrar", detalle: "Rige la base limpia del cierre anterior; las decisiones cambiaron después y se aplican al volver a cerrar." };
    case "lista-para-cerrar":
      return { tono: "neutro", titulo: "Base sin cerrar", detalle: "Al cerrarla, Codificación y Analítica parten de la base limpia." };
    case "por-decidir":
    case "sin-auditar":
      return { tono: "neutro", titulo: "Base sin cerrar", detalle: "Codificación y Analítica parten de la base cargada." };
  }
}

export type PuntoDeLista = {
  clave: string;
  tono: "ok" | "aviso";
  titulo: string;
  detalle: string | null;
  irAHallazgos: boolean;
  /** Abre la lista de los casos marcados para la ficha física (`panel=ficha`). */
  verFicha?: boolean;
};

/** Lo que la lista para la ficha física tiene que decir en Cierre; `null` mientras se lee. */
export type ResumenDeFicha = { casos: number; hallazgos: number; fuera: number } | { error: string } | null;

export function puntosDeLista(opciones: {
  data: LimpiezaSummary;
  auditoria: AuditoriaEstado | null;
  casosAuditados: number | null;
  ficha?: ResumenDeFicha;
}): PuntoDeLista[] {
  const { data, auditoria, casosAuditados, ficha } = opciones;
  const puntos: PuntoDeLista[] = [];
  if (!data.progreso?.auditoria_corrida) {
    puntos.push({ clave: "auditoria", tono: "aviso", titulo: "Sin auditar", detalle: "La auditoría se corre en Hallazgos.", irAHallazgos: true });
    return puntos;
  }
  const fecha = fechaCorta(auditoria?.auditada_en ?? null);
  const sobre = casosAuditados !== null ? `sobre ${conteo(casosAuditados, "caso", "casos")}` : null;
  const detalle = [fecha, sobre].filter(Boolean).join(", ");
  if (auditoria?.estado === "desactualizada") {
    puntos.push({ clave: "auditoria", tono: "aviso", titulo: "Auditoría desactualizada", detalle: "Las reglas cambiaron desde la última auditoría.", irAHallazgos: true });
  } else {
    puntos.push({ clave: "auditoria", tono: "ok", titulo: "Auditoría al día", detalle: detalle ? detalle.charAt(0).toUpperCase() + detalle.slice(1) : null, irAHallazgos: false });
  }
  const elementos = elementosDeCola(data);
  const pendientes = elementos.filter((e) => e.pendiente).length;
  const total = elementos.length;
  if (total === 0) {
    puntos.push({ clave: "hallazgos", tono: "ok", titulo: "Sin hallazgos por decidir", detalle: "La auditoría no encontró hallazgos.", irAHallazgos: false });
  } else if (pendientes === 0) {
    puntos.push({ clave: "hallazgos", tono: "ok", titulo: "Sin hallazgos por decidir", detalle: `${formatoConteo(total)} de ${formatoConteo(total)}`, irAHallazgos: false });
  } else {
    puntos.push({
      clave: "hallazgos",
      tono: "aviso",
      titulo: `${conteo(pendientes, "hallazgo", "hallazgos")} por decidir`,
      detalle: `${formatoConteo(total - pendientes)} de ${formatoConteo(total)} decididos`,
      irAHallazgos: true,
    });
  }
  const punto = puntoDeFicha(ficha ?? null);
  if (punto) puntos.push(punto);
  return puntos;
}

/** Los casos que esperan su ficha física: un punto con "Ver la lista"; sin casos marcados no hay punto. */
function puntoDeFicha(ficha: ResumenDeFicha): PuntoDeLista | null {
  if (ficha === null) return null;
  if ("error" in ficha) {
    return { clave: "ficha", tono: "aviso", titulo: "No se pudo leer la lista para la ficha física", detalle: ficha.error, irAHallazgos: false };
  }
  if (ficha.casos === 0 && ficha.fuera === 0) return null;
  const fuera = ficha.fuera > 0
    ? `${conteo(ficha.fuera, "caso marcado ya no aparece", "casos marcados ya no aparecen")} en la última auditoría y no ${ficha.fuera === 1 ? "entra" : "entran"} en la lista.`
    : null;
  const en = ficha.casos > 0 ? `En ${conteo(ficha.hallazgos, "hallazgo", "hallazgos")}.` : null;
  return {
    clave: "ficha",
    tono: "aviso",
    titulo: `${conteo(ficha.casos, "caso", "casos")} para la ficha física`,
    detalle: [en, fuera].filter(Boolean).join(" "),
    irAHallazgos: false,
    verFicha: ficha.casos > 0,
  };
}

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

export type TonoDeArchivo = "ok" | "aviso" | "neutro";

export type LineaDeArchivo = { texto: string; tono: TonoDeArchivo };

const CAUSAS: Record<string, string> = {
  cambiaron_las_decisiones: "cambiaron las decisiones",
  cambio_la_auditoria: "cambió la auditoría",
};

/** El estado de un archivo en una línea: "Al día, 6 nov 11:20", "Desactualizado: cambiaron las decisiones". */
export function lineaDeArchivo(a: ArchivoDelCierre): LineaDeArchivo {
  if (a.estado === null) return { texto: a.causa_estado ?? "Sin estado", tono: "neutro" };
  if (a.estado === "no_generado") {
    return { texto: a.clave === "paquete_metodologico" ? "Sin generar" : "Se genera al cerrar la base", tono: "neutro" };
  }
  const cuando = fechaYHora(a.generado_en);
  const fueraDeSesion = !a.disponible && !a.guardado_en ? "; no se guardó con el proyecto" : "";
  if (a.estado === "desactualizado") {
    const causas = a.causas.map((c) => CAUSAS[c]).filter(Boolean);
    const causa = causas.length === 2 ? "cambiaron las decisiones y la auditoría" : causas[0] ?? null;
    return { texto: `Desactualizado${causa ? `: ${causa}` : ""}${fueraDeSesion}`, tono: "aviso" };
  }
  return { texto: `Al día${cuando ? `, ${cuando}` : ""}${fueraDeSesion}`, tono: "ok" };
}

/** El archivo se puede abrir o descargar: está en la sesión o junto al proyecto. */
export function archivoAlAlcance(a: ArchivoDelCierre): boolean {
  return a.estado !== "no_generado" && !!a.file_id && (a.disponible || !!a.guardado_en);
}

/** Sigla del formato para la tesela: la extensión publicada o, sin archivo, la que tendrá. */
const FORMATO_PREVISTO: Record<ArchivoDelCierre["clave"], string> = {
  base_limpia: "xlsx",
  registro: "xlsx",
  revision: "html",
  paquete_metodologico: "zip",
};

export function formatoDeArchivo(a: ArchivoDelCierre): string {
  return a.formato ?? FORMATO_PREVISTO[a.clave];
}

// ---------------------------------------------------------------------------
// Registro de decisiones (panel)
// ---------------------------------------------------------------------------

export type FilaDeRegistro = {
  id: string;
  sourceId: string;
  hallazgo: string;
  tratamiento: string;
  estado: "Lista" | "Borrador" | "Pendiente";
  fecha: string | null;
  motivo: string | null;
};

/** Todas las decisiones guardadas, listas y borradores, la más reciente primero. */
export function filasDeRegistro(data: LimpiezaSummary): FilaDeRegistro[] {
  const porId = new Map(elementosDeCola(data).map((e) => [e.id, e]));
  return [...data.decision_draft]
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    .map((d, i) => ({
      id: d.id || `${d.source_id}-${i}`,
      sourceId: d.source_id,
      hallazgo: porId.get(d.source_id)?.nombre ?? d.source_id,
      tratamiento: esFichaFisica(d) ? ROTULO_FICHA_FISICA : tratamientoDe(d.action_type),
      estado: d.status === "ready" ? "Lista" : esFichaFisica(d) ? "Pendiente" : "Borrador",
      fecha: fechaYHora(d.updated_at ?? null),
      motivo: textoOVacio(d.rationale),
    }));
}
