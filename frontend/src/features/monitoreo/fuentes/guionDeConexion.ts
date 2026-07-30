/**
 * Qué se conecta en cada modo de Monitoreo, en qué orden y con qué palabras.
 *
 * El panel de conectar fuente empezaba preguntando **el servicio** —Google
 * Sheets / Kobo / SurveyMonkey— para cualquier estudio. Eso repite en el flujo
 * el defecto de fondo que el rediseño de Fuentes corrigió en las pestañas: la
 * app se organizaba por proveedor externo y el usuario llega con preguntas de
 * estudio. Peor, ofrecía las tres opciones siempre: en un estudio telefónico,
 * que lee un padrón de Sheets y sus efectivas de Kobo, SurveyMonkey no es una
 * elección posible y presentarla como tal es invitar a una fuente mal
 * configurada.
 *
 * Aquí cada familia declara sus piezas. El servicio deja de preguntarse cuando
 * la pieza sólo admite uno —una hoja de barrido es una hoja de cálculo— y se
 * pregunta únicamente donde hay una decisión real, como las respuestas de
 * acreditación, que pueden venir de SurveyMonkey o de Kobo.
 *
 * El orden no es una preferencia: es la dependencia del estudio. En telefónico
 * el barrido va primero porque es lo que trae los estados de llamada, y sin él
 * el padrón es una lista de teléfonos sin operación. En acreditación mandan los
 * instrumentos, porque el estudio se reparte por actor y cada actor tiene el
 * suyo.
 */

import type { MonitoreoSource } from "../../../api/client";
import type { ServicioDeFuente } from "./direccionDeFuente";

export type FamiliaDeMonitoreo =
  | "telefonico"
  | "acreditacion"
  | "territorial"
  | "aulas_universitarias"
  | "digital_general";

export type PapelDeFuente = "universo" | "barrido" | "respuestas";

export type PiezaDelGuion = {
  papel: PapelDeFuente;
  /** Qué es, en el vocabulario del estudio. */
  titulo: string;
  /** Qué aporta al monitoreo. Es lo que la pieza permite calcular. */
  aporta: string;
  /**
   * Servicios que esta pieza admite. Uno solo significa que no hay nada que
   * preguntar: la app lo elige y el paso desaparece del flujo.
   */
  servicios: readonly ServicioDeFuente[];
  /**
   * Si el estudio reparte esta pieza por actor. En acreditación cada actor
   * tiene su encuesta y su padrón; en telefónico hay una sola base y un solo
   * barrido para todo el estudio.
   */
  porActor: boolean;
  /**
   * Otra pieza que puede cubrir a esta.
   *
   * Regla de dominio de telefónico, y no un atajo: muchos estudios llevan
   * universo y barrido en **la misma hoja** —cada fila es una persona a llamar y
   * lleva su estado de llamada al lado—. El motor ya lo resuelve así, y sin
   * declararlo aquí el panel pedía conectar un padrón que el estudio ya tiene,
   * contradiciendo a la pantalla de al lado que lo daba por completo.
   */
  cubiertaPor?: PapelDeFuente;
};

export type GuionDeConexion = {
  familia: FamiliaDeMonitoreo;
  /** Cómo se llama el modo, para que el panel diga dónde está el usuario. */
  modo: string;
  piezas: readonly PiezaDelGuion[];
};

const SHEETS = ["google_sheets"] as const;
const KOBO = ["kobo"] as const;
const PLATAFORMAS = ["surveymonkey", "kobo"] as const;

const GUIONES: Record<FamiliaDeMonitoreo, GuionDeConexion> = {
  telefonico: {
    familia: "telefonico",
    modo: "Monitoreo telefónico",
    piezas: [
      {
        papel: "barrido",
        titulo: "Hoja de barrido",
        aporta: "Responsable, intentos, estado y fecha de cada llamada",
        servicios: SHEETS,
        porActor: false,
      },
      {
        papel: "universo",
        titulo: "Base de universo",
        aporta: "A quién hay que llamar y las variables de cuota",
        servicios: SHEETS,
        porActor: false,
        cubiertaPor: "barrido",
      },
      {
        papel: "respuestas",
        titulo: "Encuesta en Kobo",
        aporta: "Qué respuesta cuenta como efectiva",
        servicios: KOBO,
        porActor: false,
      },
    ],
  },
  acreditacion: {
    familia: "acreditacion",
    modo: "Acreditación institucional",
    piezas: [
      {
        papel: "respuestas",
        titulo: "Encuesta del actor",
        aporta: "Las respuestas que cuentan para su cuota",
        servicios: PLATAFORMAS,
        porActor: true,
      },
      {
        papel: "universo",
        titulo: "Padrón del actor",
        aporta: "Cuánta gente hay y contra qué se mide el avance",
        servicios: SHEETS,
        porActor: true,
      },
    ],
  },
  territorial: {
    familia: "territorial",
    modo: "Monitoreo territorial",
    piezas: [
      {
        papel: "respuestas",
        titulo: "Formulario de campo",
        aporta: "Las encuestas levantadas en ruta",
        servicios: KOBO,
        porActor: false,
      },
      {
        papel: "universo",
        titulo: "Hoja de ruta",
        aporta: "Las manzanas y cuotas asignadas a cada brigada",
        servicios: SHEETS,
        porActor: false,
      },
    ],
  },
  aulas_universitarias: {
    familia: "aulas_universitarias",
    modo: "Monitoreo de cursos-horario",
    piezas: [
      {
        papel: "respuestas",
        titulo: "Formulario del aula",
        aporta: "Las respuestas levantadas en cada curso-horario",
        servicios: PLATAFORMAS,
        porActor: false,
      },
      {
        papel: "universo",
        titulo: "Marco de cursos-horario",
        aporta: "Los cursos seleccionados y su matrícula",
        servicios: SHEETS,
        porActor: false,
      },
    ],
  },
  digital_general: {
    familia: "digital_general",
    modo: "Monitoreo",
    piezas: [
      {
        papel: "respuestas",
        titulo: "Encuesta",
        aporta: "Las respuestas del estudio",
        servicios: PLATAFORMAS,
        porActor: false,
      },
      {
        papel: "universo",
        titulo: "Base de universo",
        aporta: "Contra qué se mide el avance",
        servicios: SHEETS,
        porActor: false,
      },
    ],
  },
};

export function guionDeConexion(familia: string | undefined): GuionDeConexion {
  return GUIONES[(familia ?? "") as FamiliaDeMonitoreo] ?? GUIONES.digital_general;
}

/** Las fuentes ya conectadas que cumplen un papel, activas o no. */
export function fuentesDelPapel(sources: readonly MonitoreoSource[], papel: PapelDeFuente) {
  return sources.filter((source) => source.role === papel);
}

export type PiezaConEstado = PiezaDelGuion & {
  conectadas: MonitoreoSource[];
  lista: boolean;
  /** Actores que ya tienen esta pieza. Vacío cuando la pieza no se reparte. */
  actores: string[];
  /** Título de la pieza que la está cubriendo, cuando no tiene fuente propia. */
  cubiertaCon: string;
};

function actorDe(source: MonitoreoSource) {
  return String(source.dimensions?.actor ?? source.dimensions?.segmento ?? "").trim();
}

/**
 * El guion con el estado real del estudio encima.
 *
 * Una pieza `porActor` nunca está «lista» del todo: siempre puede entrar otro
 * actor. Lo que se dice de ella es cuántos ya tiene, que es la pregunta que se
 * hace quien viene a agregar el siguiente.
 */
export function guionConEstado(
  familia: string | undefined,
  sources: readonly MonitoreoSource[],
): { guion: GuionDeConexion; piezas: PiezaConEstado[] } {
  const guion = guionDeConexion(familia);
  const activaDelPapel = (papel: PapelDeFuente) => (
    fuentesDelPapel(sources, papel).some((source) => source.enabled)
  );
  const piezas = guion.piezas.map((pieza): PiezaConEstado => {
    const conectadas = fuentesDelPapel(sources, pieza.papel);
    const actores = pieza.porActor
      ? Array.from(new Set(conectadas.map(actorDe).filter(Boolean)))
      : [];
    const propia = conectadas.some((source) => source.enabled);
    const cubridora = !propia && pieza.cubiertaPor && activaDelPapel(pieza.cubiertaPor)
      ? guion.piezas.find((item) => item.papel === pieza.cubiertaPor)
      : undefined;
    return {
      ...pieza,
      conectadas,
      lista: propia || Boolean(cubridora),
      actores,
      cubiertaCon: cubridora?.titulo ?? "",
    };
  });
  return { guion, piezas };
}

/**
 * Por dónde seguir: la primera pieza sin conectar.
 *
 * Con todo conectado devuelve la primera que admite más de una —en acreditación
 * siempre se puede sumar un actor—, y `null` sólo cuando no queda nada por
 * hacer, que es cuando el panel se abre sin nada preseleccionado.
 */
export function piezaPorLaQueSeguir(piezas: readonly PiezaConEstado[]): PiezaConEstado | null {
  return piezas.find((pieza) => !pieza.lista)
    ?? piezas.find((pieza) => pieza.porActor)
    ?? piezas[0]
    ?? null;
}

/**
 * Qué sigue después de conectar una pieza — y `null` cuando no queda nada.
 *
 * Conectar y cerrar deja el estudio a medio configurar con el usuario fuera del
 * flujo: acaba de poner el barrido y tiene que volver a abrir el panel para el
 * padrón. Cuando queda algo, el panel se queda y lo lleva.
 *
 * En una pieza repartida por actor lo siguiente no es «la siguiente pieza» sino
 * **la siguiente pieza de ese actor**: quien acaba de conectar la encuesta de
 * Docentes necesita el padrón de Docentes, no la encuesta de otro.
 */
export function piezaSiguienteTrasConectar(
  piezas: readonly PiezaConEstado[],
  papelConectado: PapelDeFuente,
  actor: string,
): PiezaConEstado | null {
  const indice = piezas.findIndex((pieza) => pieza.papel === papelConectado);
  const posteriores = indice >= 0 ? piezas.slice(indice + 1) : piezas;
  const actorLimpio = actor.trim();
  if (actorLimpio) {
    const faltaDeEsteActor = posteriores.find((pieza) => (
      pieza.porActor && !pieza.actores.some((item) => (
        item.localeCompare(actorLimpio, "es", { sensitivity: "base" }) === 0
      ))
    ));
    if (faltaDeEsteActor) return faltaDeEsteActor;
  }
  return posteriores.find((pieza) => !pieza.lista)
    ?? piezas.find((pieza) => !pieza.lista)
    ?? null;
}
