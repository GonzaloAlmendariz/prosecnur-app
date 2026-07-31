// El elenco de actores del estudio, del lado del cliente.
//
// Espejo exacto de las reglas que `api/R/monitoreo_actor_roster.R` impone al
// guardar. Se duplican a propósito y con una razón concreta: el backend corta
// con un 409, pero enterarse de que el padrón de Egresados ya existía DESPUÉS
// de pegar la URL de la hoja y esperar la lectura es exactamente el ciclo que
// el rediseño de Fuentes vino a matar. Aquí la regla se aplica antes, para
// poder decirlo mientras todavía se puede corregir.
//
// La autoridad sigue siendo el servidor. Si estas dos copias divergen, gana el
// 409 y el usuario ve su mensaje, no el nuestro.

import type { MonitoreoActorUnit, MonitoreoSource } from "../../../api/client";

/**
 * Los actores con los que se siembra un estudio de acreditación nuevo.
 *
 * Son una SEMILLA, no un catálogo cerrado: el estudio los renombra y agrega los
 * suyos. Antes de existir el elenco vivían como constante duplicada en los dos
 * monolitos de perfil y alimentaban un `<datalist>` que no se podía editar,
 * así que «Empleadores» aparecía sugerido en estudios que no lo tenían y un
 * actor propio como «Ex alumnos» había que tipearlo entero en cada fuente.
 */
export const ACTORES_SEMILLA = [
  "Estudiantes",
  "Docentes",
  "Egresados",
  "Administrativos",
  "Empleadores",
] as const;

export type PapelDeFuenteContado = "universo" | "respuestas" | "barrido";

export type CuentaDeActor = {
  actor: string;
  universo: number;
  respuestas: number;
  barrido: number;
};

/**
 * Clave de comparación de un nombre de actor.
 *
 * «Egresados», «egresados » y «EGRESADOS» son el mismo actor. Sin normalizar,
 * un espacio final lo partía en dos.
 */
export function claveDeActor(actor: unknown) {
  return String(actor ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function mismoActor(a: unknown, b: unknown) {
  const clave = claveDeActor(a);
  return Boolean(clave) && clave === claveDeActor(b);
}

/** El actor que declara una fuente, sin inventar uno cuando no lo hay. */
export function actorDeLaFuente(source: MonitoreoSource) {
  const dimensions = (source.dimensions ?? {}) as Record<string, unknown>;
  return String(dimensions.actor ?? dimensions.unidad ?? "").trim();
}

/**
 * Cuántas fuentes de cada papel tiene cada actor.
 *
 * Una fuente sin actor no crea una entrada: la ausencia de actor tiene que
 * seguir siendo ausencia, no un actor vacío en la lista.
 */
export function cuentasPorActor(sources: readonly MonitoreoSource[]): Map<string, CuentaDeActor> {
  const out = new Map<string, CuentaDeActor>();
  for (const source of sources) {
    const actor = actorDeLaFuente(source);
    const clave = claveDeActor(actor);
    if (!clave) continue;
    const actual = out.get(clave) ?? { actor, universo: 0, respuestas: 0, barrido: 0 };
    const papel = String(source.role ?? "") as PapelDeFuenteContado;
    if (papel === "universo" || papel === "respuestas" || papel === "barrido") {
      actual[papel] += 1;
    }
    out.set(clave, actual);
  }
  return out;
}

export function cuentaDelActor(sources: readonly MonitoreoSource[], actor: string): CuentaDeActor {
  return cuentasPorActor(sources).get(claveDeActor(actor))
    ?? { actor, universo: 0, respuestas: 0, barrido: 0 };
}

/** Si el actor tiene canal telefónico declarado en el elenco. */
export function tieneCanalTelefonico(elenco: readonly MonitoreoActorUnit[], actor: string) {
  const clave = claveDeActor(actor);
  if (!clave) return true;
  const unidades = elenco.filter((unit) => claveDeActor(unit.actor) === clave);
  if (!unidades.length) return true; // Todavía no está en el elenco: no es aquí donde se exige.
  return unidades.some((unit) => Boolean(unit.phone?.enabled));
}

export type ConflictoDeCardinalidad = {
  code: string;
  message: string;
};

/**
 * Las tres reglas del boceto de Fuentes, comprobadas antes de pedir nada.
 *
 *   · exactamente una base de universo por actor
 *   · como máximo una hoja de barrido por actor
 *   · barrido solo para actores con canal telefónico declarado
 *
 * `idExcluido` deja fuera a la fuente que se está reeditando: el guardado
 * reemplaza por id, así que volver a guardar el mismo padrón es legal.
 */
export function conflictoDeCardinalidad({
  sources,
  elenco,
  papel,
  actor,
  idExcluido = "",
}: {
  sources: readonly MonitoreoSource[];
  elenco: readonly MonitoreoActorUnit[];
  papel: string;
  actor: string;
  idExcluido?: string;
}): ConflictoDeCardinalidad | null {
  if (papel !== "universo" && papel !== "barrido") return null;
  const nombre = String(actor ?? "").trim();
  if (!claveDeActor(nombre)) return null;

  const otras = sources.filter((source) => source.id !== idExcluido);
  const cuenta = cuentaDelActor(otras, nombre);

  if (papel === "universo" && cuenta.universo >= 1) {
    return {
      code: "E_MONITOREO_ACTOR_UNIVERSO_DUPLICADO",
      message: `${nombre} ya tiene una base de universo. Cada actor se mide contra un solo padrón: edita el existente o cambia el actor de esta fuente.`,
    };
  }

  if (papel === "barrido") {
    if (cuenta.barrido >= 1) {
      return {
        code: "E_MONITOREO_ACTOR_BARRIDO_DUPLICADO",
        message: `${nombre} ya tiene una hoja de barrido. Solo se admite una por actor para no duplicar intentos y estados de llamada.`,
      };
    }
    if (!tieneCanalTelefonico(elenco, nombre)) {
      return {
        code: "E_MONITOREO_ACTOR_SIN_CANAL_TELEFONICO",
        message: `${nombre} no tiene canal telefónico declarado. Actívalo en Actores antes de conectar su hoja de barrido.`,
      };
    }
  }

  return null;
}

/**
 * El elenco que se muestra: lo declarado más lo que solo vive en fuentes.
 *
 * Se calcula igual que en el backend para que la vista no parpadee entre lo que
 * el servidor devolvió y lo que el cliente cree.
 */
export function elencoVisible(
  unidades: readonly MonitoreoActorUnit[] | undefined,
  sources: readonly MonitoreoSource[],
): MonitoreoActorUnit[] {
  const declarados = (unidades ?? []).filter((unit) => unit.origin === "declarado");
  const claves = new Set(declarados.map((unit) => claveDeActor(unit.actor)));
  const out = [...declarados];
  for (const unit of unidades ?? []) {
    const clave = claveDeActor(unit.actor);
    if (!clave || claves.has(clave)) continue;
    claves.add(clave);
    out.push(unit);
  }
  for (const source of sources) {
    const actor = actorDeLaFuente(source);
    const clave = claveDeActor(actor);
    if (!clave || claves.has(clave)) continue;
    claves.add(clave);
    out.push({
      id: clave,
      type: "actor",
      actor,
      label: actor,
      segment: "",
      group: "",
      origin: "fuentes",
      phone: { enabled: false, role: "none" },
    });
  }
  return out;
}

/** Si un nombre se puede usar sin chocar con otro actor del elenco. */
export function nombreDisponible(
  elenco: readonly MonitoreoActorUnit[],
  nombre: string,
  idExcluido = "",
) {
  const clave = claveDeActor(nombre);
  if (!clave) return false;
  return !elenco.some((unit) => unit.id !== idExcluido && claveDeActor(unit.actor) === clave);
}

/**
 * Qué le falta a un actor para estar operativo, en la lengua del estudio.
 *
 * El orden importa: sin padrón no hay denominador y el avance no se puede
 * calcular, así que esa carencia se dice antes que la de encuestas.
 */
export function faltantesDelActor(cuenta: CuentaDeActor, tienePhone: boolean): string[] {
  const faltan: string[] = [];
  if (cuenta.universo === 0) faltan.push("sin padrón");
  if (cuenta.respuestas === 0) faltan.push("sin encuesta");
  if (tienePhone && cuenta.barrido === 0) faltan.push("sin barrido");
  return faltan;
}
