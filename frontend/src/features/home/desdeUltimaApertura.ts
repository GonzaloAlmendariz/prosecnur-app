// «Desde tu última apertura» (L31, Meta B): lo que cambió en el proyecto entre
// la apertura anterior en ESTE equipo y ahora.
//
// La fecha y las cifras de la apertura anterior viven en `localStorage`, no en
// el `.pulso` (decisión de Meta B por Gonzalo): son de quien mira, no del
// estudio, y un `.pulso` compartido no debe decirle a otra persona qué cambió
// desde que YO lo abrí. Todo acceso al almacenamiento va con try/catch: en una
// ventana privada o con el almacenamiento bloqueado el bloque se calla y el
// Home sigue igual.
//
// La apertura anterior se lee UNA vez por sesión de la app y por proyecto, y en
// ese mismo momento se guarda la actual. Volver al Home dentro de la misma
// sesión compara contra la misma apertura anterior, no contra hace un minuto.

import type { ProjectOverview } from "../../api/client";

/** `singular` es la etiqueta cuando la diferencia es de uno: «+1 fase lista», no «+1 fases listas». */
export type Cifra = { clave: string; etiqueta: string; singular: string; valor: number };

export type Apertura = { en: string; cifras: Record<string, number> };

export type Cambio = { clave: string; etiqueta: string; singular: string; antes: number; ahora: number };

export type LecturaDeHoy =
  | { tipo: "primera" }
  | { tipo: "cambios"; desde: string; cambios: Cambio[] }
  | { tipo: "sin-cambios"; desde: string };

const PREFIJO = "prosecnur:home:ultima-apertura:";
const FASES_PROCESAMIENTO = ["carga", "validacion", "codificacion", "analitica", "graficos"];

/** La clave del proyecto en el almacenamiento: su archivo, o su nombre si no lo tiene. */
export function claveDelProyecto(overview: Pick<ProjectOverview, "project">): string | null {
  const id = overview.project.project_file || overview.project.name;
  return id ? `${PREFIJO}${id}` : null;
}

/**
 * Las cifras que se comparan. Son conteos que suben con el trabajo; un
 * porcentaje o una fecha no se restan con sentido. Cada una dice de qué módulo
 * es en su etiqueta, porque el bloque las lee juntas.
 */
export function cifrasDelProyecto(overview: ProjectOverview): Cifra[] {
  const { facts, metrics, modules } = overview;
  const monitoreo = facts.monitoreo;
  const fasesListas = FASES_PROCESAMIENTO.filter((id) =>
    modules.some((item) => item.id === id && item.state === "ready"),
  ).length;
  const validas = monitoreo?.valid_label || "válidas";
  const cifras: Cifra[] = [
    { clave: "editor.preguntas", etiqueta: "preguntas en el instrumento", singular: "pregunta en el instrumento", valor: facts.editor?.questions_count ?? 0 },
    // El rótulo lo manda el backend según la familia («validadas», «efectivas»): el singular le quita la «s».
    // La clave cambió de nombre cuando el avance pasó a contar las efectivas
    // de Kobo, con las en observación dentro (L20, 2cb7659e9): comparada con
    // la cifra vieja, la primera apertura habría dicho «+255» sin campo de por
    // medio. Una clave que la apertura anterior no tiene no se lee como cambio.
    { clave: "monitoreo.efectivas", etiqueta: `${validas} en Monitoreo`, singular: `${validas.replace(/s$/, "")} en Monitoreo`, valor: monitoreo?.valid ?? 0 },
    { clave: "monitoreo.alertas", etiqueta: "casos por revisar en Monitoreo", singular: "caso por revisar en Monitoreo", valor: monitoreo?.alerts ?? 0 },
    { clave: "procesamiento.registros", etiqueta: "registros en la base", singular: "registro en la base", valor: metrics.records_count ?? 0 },
    { clave: "procesamiento.fases", etiqueta: "fases de Procesamiento listas", singular: "fase de Procesamiento lista", valor: fasesListas },
  ];
  return cifras.filter((c) => Number.isFinite(c.valor));
}

export function aperturaDe(overview: ProjectOverview, ahora: Date): Apertura {
  return {
    en: ahora.toISOString(),
    cifras: Object.fromEntries(cifrasDelProyecto(overview).map((c) => [c.clave, c.valor])),
  };
}

/** Qué cambió entre la apertura anterior y el overview de ahora. */
export function leerHoy(anterior: Apertura | null, overview: ProjectOverview): LecturaDeHoy {
  if (!anterior) return { tipo: "primera" };
  const cambios: Cambio[] = [];
  for (const cifra of cifrasDelProyecto(overview)) {
    const antes = anterior.cifras[cifra.clave];
    // Una cifra que la apertura anterior no tenía (backend más viejo) no se
    // lee como «subió desde cero».
    if (typeof antes !== "number" || antes === cifra.valor) continue;
    cambios.push({ clave: cifra.clave, etiqueta: cifra.etiqueta, singular: cifra.singular, antes, ahora: cifra.valor });
  }
  return cambios.length
    ? { tipo: "cambios", desde: anterior.en, cambios }
    : { tipo: "sin-cambios", desde: anterior.en };
}

/** «hace 3 horas», «hace 2 días»; pasado un mes, la fecha. */
export function haceCuanto(desde: string, ahora: Date): string {
  const ms = ahora.getTime() - Date.parse(desde);
  if (!Number.isFinite(ms) || ms < 0) return "hace un momento";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  return `el ${new Date(desde).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}`;
}

function esApertura(valor: unknown): valor is Apertura {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Partial<Apertura>;
  return typeof v.en === "string" && !!v.cifras && typeof v.cifras === "object";
}

/** Lee la apertura guardada, o `null` si no hay, no se puede leer o no tiene forma. */
export function leerApertura(clave: string, almacen: Pick<Storage, "getItem"> | null): Apertura | null {
  try {
    const crudo = almacen?.getItem(clave);
    if (!crudo) return null;
    const valor: unknown = JSON.parse(crudo);
    return esApertura(valor) ? valor : null;
  } catch {
    // Almacenamiento bloqueado o JSON roto: como si fuera la primera apertura.
    return null;
  }
}

export function guardarApertura(clave: string, apertura: Apertura, almacen: Pick<Storage, "setItem"> | null): void {
  try {
    almacen?.setItem(clave, JSON.stringify(apertura));
  } catch {
    // Cuota llena o almacenamiento bloqueado: el bloque se calla la próxima vez.
  }
}

/** La apertura anterior de cada proyecto, leída una vez por sesión de la app. */
const anterioresDeLaSesion = new Map<string, Apertura | null>();

/**
 * La apertura contra la que se mide «hoy» en esta sesión. La primera vez que
 * se pide para un proyecto, lee la guardada y guarda la de ahora.
 */
export function aperturaAnteriorDeLaSesion(
  clave: string,
  overview: ProjectOverview,
  almacen: Pick<Storage, "getItem" | "setItem"> | null,
  ahora: Date,
): Apertura | null {
  if (anterioresDeLaSesion.has(clave)) return anterioresDeLaSesion.get(clave) ?? null;
  const anterior = leerApertura(clave, almacen);
  anterioresDeLaSesion.set(clave, anterior);
  guardarApertura(clave, aperturaDe(overview, ahora), almacen);
  return anterior;
}

/** Sólo para tests: olvida lo leído en la sesión. */
export function olvidarSesionDeAperturas(): void {
  anterioresDeLaSesion.clear();
}

/** `window.localStorage`, o `null` si ni siquiera se puede tocar. */
export function almacenDelEquipo(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
