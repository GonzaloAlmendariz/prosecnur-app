// Lo que pinta el tablero de Seguimiento sin decidir nada de dominio: las
// cifras de cabecera de cada pestaña, el resumen o lo que falta de cada paso de
// la prueba, el veredicto de un recordatorio, la escala de los intervalos y el
// estado de una celda del plan. Puro y con Vitest.
//
// Cada cifra dice su base: "Respondieron" es sobre quienes tienen enlace en las
// campañas ya leídas, nunca sobre todo el estudio.

import type {
  CampanaSeguimiento,
  EstadoSeguimiento,
  FilaDeComparacion,
  FilaDelPlan,
  ResultadoDeRonda,
  ResultadosDeHorario,
} from "../../../api/mailSeguimiento";
import { formatoConteo } from "../../../lib/formatoNumero";
import { salioCorto, type EstadoDePaso, type IdDePaso } from "./modeloSeguimiento";

const n = (v: number) => formatoConteo(v);
const plural = (v: number, a: string, b: string) => (v === 1 ? a : b);
const suma = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// ---- Cifras de cabecera -----------------------------------------------------------------

export type CifrasDeRespondieron = {
  conEnlace: number;
  personas: number;
  /** `null` si ninguna campaña se leyó todavía. */
  respondieron: number | null;
  /** Con enlace en las campañas ya leídas: la base de "Respondieron". */
  baseLeida: number;
  aMedias: number | null;
  /** ISO de la lectura más reciente; vacío si ninguna. */
  ultimaLectura: string;
  leidas: number;
  campanas: number;
};

export function cifrasDeRespondieron(campanas: readonly CampanaSeguimiento[]): CifrasDeRespondieron {
  const leidas = campanas.filter((c) => c.respondieron !== null);
  const fechas = campanas.map((c) => c.leido_en).filter(Boolean).sort();
  return {
    conEnlace: suma(campanas.map((c) => c.con_enlace)),
    personas: suma(campanas.map((c) => c.personas)),
    respondieron: leidas.length ? suma(leidas.map((c) => c.respondieron ?? 0)) : null,
    baseLeida: suma(leidas.map((c) => c.con_enlace)),
    aMedias: leidas.length ? suma(leidas.map((c) => c.a_medias ?? 0)) : null,
    ultimaLectura: fechas.length ? fechas[fechas.length - 1] : "",
    leidas: leidas.length,
    campanas: campanas.length,
  };
}

export type CifrasDeHorarios = {
  personas: number;
  comparados: number | null;
  recordatorios: number;
  borradores: number;
  conHora: number;
  /** "Ganó 8:00 p. m.", "Sin diferencia clara" o `null` sin resultados comparables. */
  ganador: string | null;
};

export function cifrasDeHorarios(estado: EstadoSeguimiento, resultados: ResultadosDeHorario | null): CifrasDeHorarios {
  const h = estado.horario;
  const enPrueba = estado.campanas.filter((c) => h.campanas.includes(c.campaign_id));
  const conHora = h.plan.filter((f) => f.programado);
  const comparables = resultados?.rondas.filter((r) => r.comparable) ?? [];
  const ultima = comparables[comparables.length - 1];
  return {
    personas: suma(enPrueba.map((c) => c.grupos.A + c.grupos.B)),
    comparados: resultados ? comparables.length : null,
    recordatorios: h.rondas.length,
    borradores: conHora.filter((f) => f.mailchimp_id).length,
    conHora: conHora.length,
    ganador: ultima ? veredictoDeRonda(ultima).texto : null,
  };
}

export type CifrasDeCorreoPersonal = { personal: number; control: number; cargados: number; rechazados: number };

export function cifrasDeCorreoPersonal(campanas: readonly CampanaSeguimiento[]): CifrasDeCorreoPersonal {
  return {
    personal: suma(campanas.map((c) => c.segundo_correo.personal)),
    control: suma(campanas.map((c) => c.segundo_correo.control)),
    cargados: suma(campanas.map((c) => c.segundo_correo.cargados)),
    rechazados: suma(campanas.map((c) => c.segundo_correo.rechazados)),
  };
}

// ---- Pasos de la prueba: plegado, resumen y lo que falta ----------------------------------

/**
 * ¿El paso se ve abierto? El que sigue, siempre; Resultados, siempre que haya datos;
 * el resto, sólo si se pidió abrirlo.
 */
export function pasoAbierto(
  id: IdDePaso,
  estado: EstadoDePaso,
  pedidos: Readonly<Partial<Record<IdDePaso, boolean>>>,
  hayResultados: boolean,
): boolean {
  if (estado === "sigue") return true;
  if (id === "resultados" && hayResultados) return true;
  return pedidos[id] === true;
}

const fechaCorta = (iso: string) => {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}`;
};

/** La línea de un paso hecho, plegado. */
export function resumenDelPaso(id: IdDePaso, estado: EstadoSeguimiento): string {
  const h = estado.horario;
  const enPrueba = estado.campanas.filter((c) => h.campanas.includes(c.campaign_id));
  if (id === "publicos") {
    const oficina = h.oficina.filter((x) => h.campanas.includes(x)).length;
    const base = `${n(h.campanas.length)} ${plural(h.campanas.length, "público", "públicos")} en la prueba`;
    return oficina ? `${base}, ${n(oficina)} con horario de oficina (${h.oficina_desde} a ${h.oficina_hasta})` : base;
  }
  if (id === "asignacion") {
    const a = suma(enPrueba.map((c) => c.grupos.A));
    const b = suma(enPrueba.map((c) => c.grupos.B));
    const total = a + b;
    const reparto = total ? `${Math.round((100 * a) / total)}/${Math.round((100 * b) / total)}` : "";
    return `Asignados el ${fechaCorta(h.sorteado_en)} con la semilla ${h.semilla ?? ""}: ${n(total)} ${plural(total, "persona", "personas")}${reparto ? `, ${reparto}` : ""}`;
  }
  if (id === "etiquetas") return `"${h.etiquetas.A}" y "${h.etiquetas.B}" puestas el ${fechaCorta(h.etiquetado_en)}`;
  if (id === "plan") {
    return `${n(h.rondas.length)} ${plural(h.rondas.length, "recordatorio", "recordatorios")} con la hora de cada grupo en ${n(h.campanas.length)} ${plural(h.campanas.length, "público", "públicos")}`;
  }
  if (id === "borradores") {
    const conHora = h.plan.filter((f) => f.programado);
    return `${n(conHora.length)} ${plural(conHora.length, "borrador creado", "borradores creados")} en Mailchimp`;
  }
  const salieron = h.plan.filter((f) => f.enviado).length;
  return `${n(salieron)} ${plural(salieron, "envío salió", "envíos salieron")}`;
}

/** La línea de un paso pendiente: qué le falta. */
export function faltaDelPaso(id: IdDePaso, estado: EstadoSeguimiento): string {
  const h = estado.horario;
  if (id === "publicos") return estado.campanas.length ? "Marca los públicos que entran a la prueba." : "El estudio no tiene campañas de correo en Mailchimp.";
  if (id === "asignacion") return h.campanas.length ? "Falta asignar los grupos al azar." : "Primero, los públicos de la prueba.";
  if (id === "etiquetas") return h.sorteado_en ? "Falta poner las etiquetas de los grupos en Mailchimp." : "Primero, la asignación de los grupos.";
  if (id === "plan") return h.rondas.length ? "Falta la hora de cada grupo en cada recordatorio." : "Las campañas de la prueba no tienen recordatorios.";
  if (id === "borradores") {
    const conHora = h.plan.filter((f) => f.programado);
    const creados = conHora.filter((f) => f.mailchimp_id).length;
    return conHora.length ? `${n(creados)} de ${n(conHora.length)} ${plural(conHora.length, "borrador creado", "borradores creados")}.` : "Primero, el plan con sus horas.";
  }
  return "Aparecen cuando sale el primer recordatorio.";
}

// ---- Resultados -------------------------------------------------------------------------

export type VeredictoDeRonda = { texto: string; tono: "gana" | "neutro" };

/** "Ganó 8:00 p. m." en verde semántico; si no hay ganador, "Sin diferencia clara". */
export function veredictoDeRonda(r: Pick<ResultadoDeRonda, "ganador" | "horaA" | "horaB" | "comparable" | "en_curso">): VeredictoDeRonda {
  if (!r.comparable) return { texto: "Sin comparación", tono: "neutro" };
  if (r.ganador === "A" || r.ganador === "B") {
    const hora = r.ganador === "A" ? r.horaA : r.horaB;
    const verbo = r.en_curso ? "Va ganando" : "Ganó";
    return { texto: hora ? `${verbo} ${hora}` : `${verbo} el grupo ${r.ganador}`, tono: "gana" };
  }
  return { texto: "Sin diferencia clara", tono: "neutro" };
}

/**
 * Escala simétrica de los intervalos de una tabla, en puntos: el mayor valor
 * absoluto de diferencias y límites, con un mínimo para que un intervalo chico
 * no ocupe toda la barra.
 */
export function escalaDeIntervalos(filas: readonly Pick<FilaDeComparacion, "dif_pp" | "dif_li" | "dif_ls">[], minimo = 2): number {
  const valores = filas.flatMap((f) => [f.dif_pp, f.dif_li, f.dif_ls]).filter((v): v is number => v != null && Number.isFinite(v));
  return Math.max(minimo, ...valores.map(Math.abs));
}

/** Posición en % de la pista de un valor en la escala simétrica (el cero al medio). */
export function posicionEnEscala(v: number, escala: number): number {
  if (escala <= 0) return 50;
  return Math.min(100, Math.max(0, 50 + (v / escala) * 50));
}

/** Ancho relativo de la barra de cada grupo: la tasa contra la mayor de las dos. */
export function anchosComparados(pctA: number | null, pctB: number | null): { A: number; B: number } {
  const max = Math.max(pctA ?? 0, pctB ?? 0);
  if (max <= 0) return { A: 0, B: 0 };
  return { A: ((pctA ?? 0) / max) * 100, B: ((pctB ?? 0) / max) * 100 };
}

// ---- Plan ----------------------------------------------------------------------------

export type EstadoDeCelda = { texto: string; tono: "hecho" | "info" | "neutro" };

export function estadoDeCelda(f: FilaDelPlan | null): EstadoDeCelda {
  if (!f || !f.programado) return { texto: "Sin hora", tono: "neutro" };
  if (f.enviado) return { texto: `Salió ${salioCorto(f.enviado, f.programado)}`, tono: "hecho" };
  if (f.mailchimp_id) return { texto: "Borrador creado", tono: "info" };
  return { texto: "Sin borrador", tono: "neutro" };
}

/** La fecha de un recordatorio en el plan ("12/11") y si ya salió algún grupo. */
export function cabeceraDeRonda(plan: readonly FilaDelPlan[], ronda: number): { fecha: string; salio: boolean } {
  const filas = plan.filter((f) => f.ronda === ronda && f.programado);
  const fechas = [...new Set(filas.map((f) => f.programado.slice(0, 10)))].sort();
  const fecha = fechas.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(" y ");
  return { fecha, salio: filas.some((f) => f.enviado) };
}

