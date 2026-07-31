/**
 * Qué le toca a cada pestaña de Fuentes en el monitoreo telefónico.
 *
 * Las tres pestañas se llamaban por su pregunta —«Fuentes activas», «Universo y
 * barrido», «Encuestas»— pero renderizaban el mismo componente con distinto
 * `focus`, y ese `focus` sólo gobernaba las tarjetas: los dos bloques de
 * configuración («Configurar base y barrido» y «Seleccionar Kobo») se montaban
 * en las tres, abiertos o cerrados según un booleano. Medido en `acnur_pdm`: la
 * pestaña Encuestas ofrecía configurar hojas de cálculo, y «Fuentes activas» era
 * la unión literal de las otras dos.
 *
 * De ahí la sensación de que no están diferenciadas: no lo estaban. El reparto
 * vive aquí, en un solo sitio y con test, en vez de repartido en cinco booleanos
 * dentro de un page-file de veinte mil líneas.
 *
 * La regla es una sola: **cada pestaña muestra sólo aquello sobre lo que se
 * decide en ella.** Lo que se lee sin decidir vive en el resumen.
 */

export type PestanaDeFuentes = "activas" | "sheets" | "survey";

/**
 * Papel de la fuente que se va a conectar, en el vocabulario del `.pulso`.
 *
 * `undefined` significa «lo decide el guion del modo»: desde el resumen y desde
 * Universo y barrido no hay una respuesta única —lo que toca es lo primero que
 * falte, y en telefónico eso es el barrido antes que el padrón—, así que
 * forzarlo aquí contradiría el orden que el propio panel enseña.
 */
export type PapelAlConectar = "universo" | "barrido" | "respuestas" | undefined;

export type RepartoDeFuentes = {
  /** Tarjetas de configuración que se pintan, en orden. */
  slots: Array<"universo" | "barrido" | "plataforma">;
  /** La cadena de las tres piezas: sólo en el resumen, o no sería un resumen. */
  cadena: boolean;
  /** El filtro que decide qué cuenta como efectiva. */
  decisionKobo: boolean;
  /**
   * Qué significa cada estado que el cliente escribió en la hoja de barrido:
   * a qué familia va y de qué color se pinta.
   *
   * Va con las hojas y no con la encuesta porque es una propiedad del barrido,
   * no de Kobo: son las etiquetas de ESA hoja las que hay que confirmar.
   */
  declaracionDeEstados: boolean;
  /** Lista de todo lo conectado, con su estado. */
  listaConfigurada: boolean;
  papelAlConectar: PapelAlConectar;
};

const REPARTO: Record<PestanaDeFuentes, RepartoDeFuentes> = {
  // Resumen. Responde «¿de dónde salen mis números?» y no decide nada. Lo que sí
  // lleva es la lista de lo conectado, que es la única superficie donde una
  // fuente inactiva o duplicada se ve.
  activas: {
    slots: [],
    cadena: true,
    decisionKobo: false,
    declaracionDeEstados: false,
    listaConfigurada: true,
    papelAlConectar: undefined,
  },
  // Las dos hojas y nada de Kobo.
  //
  // No lleva un bloque de lectura aparte: el que había decía «Sheets listos para
  // operación» y repetía universo, barrido y último sync, que ya están en las
  // tarjetas.
  sheets: {
    slots: ["universo", "barrido"],
    cadena: false,
    decisionKobo: false,
    declaracionDeEstados: true,
    listaConfigurada: false,
    papelAlConectar: undefined,
  },
  // El formulario y su filtro, sin hojas.
  survey: {
    slots: ["plataforma"],
    cadena: false,
    decisionKobo: true,
    declaracionDeEstados: false,
    listaConfigurada: false,
    papelAlConectar: "respuestas",
  },
};

/**
 * Normaliza la clave de pestaña que viene de la dirección.
 *
 * El catálogo de Fuentes es compartido con Acreditación y trae `collectors`, que
 * en telefónico no se monta —el perfil ya la reescribe a `survey` al aterrizar—.
 * Sin esta puerta, una dirección con `?pestana=collectors` devolvería `undefined`
 * y la sección reventaría en vez de caer en el resumen.
 */
export function pestanaDeFuentesDesde(clave: string | undefined): PestanaDeFuentes {
  return clave === "sheets" || clave === "survey" || clave === "activas" ? clave : "activas";
}

/**
 * El reparto de una pestaña.
 *
 * `contratoCompleto` deja al resumen mostrar las piezas que faltan en vez de
 * mandar a buscarlas: es la pantalla donde se ve que falta algo, y cada tarjeta
 * abre el panel de conexión sobre su pieza.
 */
export function repartoDeFuentes(
  pestana: PestanaDeFuentes,
  contratoCompleto: boolean,
): RepartoDeFuentes {
  const base = REPARTO[pestana];
  if (pestana !== "activas" || contratoCompleto) return base;
  return { ...base, slots: ["universo", "barrido", "plataforma"] };
}
