/**
 * Pautas de revisión de un hallazgo, por tipo (ítem 27 del checklist de
 * Validación usada por un practicante): qué mirar en el caso antes de decidir
 * y, junto a cada opción de la Decisión, en qué situación corresponde.
 *
 * Es la única fuente de esos textos. El tipo sale de lo que el motor ya
 * publica: la familia del catálogo, la dirección del salto, el subtipo del
 * enunciado de cada caso (`validacion_enunciado_hallazgo.R`) y, como último
 * recurso, el tipo de regla de la cola. Un tipo que no está aquí no recibe
 * pautas: la pantalla no muestra una lista genérica que valga para todo.
 *
 * Las situaciones van por la clave de la opción (`opcionesDeTratamiento`), no
 * por la acción del motor: "La más completa" y "La primera" son la misma
 * acción con criterios distintos.
 *
 * Si la pregunta filtro de un salto trae, en los casos marcados, un código que
 * no está en su lista (`filtroFueraDeLista.ts`, ítem 41), la primera pauta lo
 * dice: lo más probable es que el formulario y la base usen otro código para
 * la misma opción, y entonces lo que se corrige es el formulario.
 */
import { pautaDelFiltro, type FiltroFueraDeLista } from "./filtroFueraDeLista";
import type { OpcionDeTratamiento, VistaDelHallazgo } from "./modeloHallazgos";

export type TipoDePauta =
  | "rango"
  | "atipico"
  | "salto_vacia"
  | "salto_sobra"
  | "seccion_sobra"
  | "obligatoria"
  | "fuera_de_lista"
  | "coherencia"
  | "bateria"
  | "fechas"
  | "formato"
  | "casi_iguales"
  | "duplicados"
  | "calculo";

/** Clave de la opción de la Decisión (`OpcionDeTratamiento.clave`). */
type ClaveDeOpcion =
  | "dejar" | "corregir" | "vaciar" | "excluir" | "asignar" | "recodificar"
  | "mas-completa" | "mas-reciente" | "primera" | "todas";

type Pauta = { revisar: readonly string[]; situaciones: Partial<Record<ClaveDeOpcion, string>> };

export type PautasDelHallazgo = {
  tipo: TipoDePauta | null;
  /** La regla la propuso el detector a partir de la base. */
  detector: boolean;
  revisar: readonly string[];
  situaciones: Partial<Record<ClaveDeOpcion, string>>;
};

const PAUTAS: Record<TipoDePauta, Pauta> = {
  rango: {
    revisar: [
      "Compara el valor con el resto del caso: una edad de 95 con hijos en edad escolar, un ingreso alto con la ocupación declarada.",
      "Un 0, 99 o 999 suele ser un código de no respuesta o un error de digitación.",
      "Si la encuesta fue en papel, compara con la ficha física.",
    ],
    situaciones: {
      dejar: "Si el valor es real y el resto del caso lo respalda.",
      corregir: "Si la ficha o el resto del caso muestran el valor correcto.",
      vaciar: "Si el valor es imposible y no hay de dónde recuperarlo.",
      excluir: "Si el caso entero es dudoso, no solo este valor.",
      asignar: "Si es un código de no respuesta escrito de otra forma.",
    },
  },
  atipico: {
    revisar: [
      "Un valor atípico es raro frente al resto de la base, no necesariamente un error.",
      "Revisa si cuadra con las demás respuestas del caso antes de tocarlo.",
      "Si varios atípicos son del mismo recopilador, revisa todas sus encuestas.",
    ],
    situaciones: {
      dejar: "Si el valor cuadra con el resto del caso. Es lo más frecuente.",
      corregir: "Si es un error de digitación, como un cero de más.",
      vaciar: "Si el valor es imposible y no se puede recuperar.",
      excluir: "Solo si el caso entero es dudoso.",
    },
  },
  salto_vacia: {
    revisar: [
      "Revisa la respuesta que abre la pregunta: si está mal registrada, el salto es correcto y el error está ahí.",
      "Si varios casos son del mismo recopilador o del mismo día, puede ser una falla del formulario en campo.",
      "Si la encuesta fue en papel, revisa si la respuesta está en la ficha física y no se digitó.",
    ],
    situaciones: {
      dejar: "Si la persona no respondió y así queda registrado.",
      asignar: "Si corresponde marcarla como no respuesta con el código del estudio.",
      corregir: "Si la ficha física trae la respuesta.",
      excluir: "Si al caso le faltan muchas preguntas, no solo esta.",
    },
  },
  salto_sobra: {
    revisar: [
      "Revisa la respuesta que cierra la pregunta: si esa está mal, la respuesta que sobra puede ser la buena.",
      "Si la respuesta que sobra cuadra con el resto del caso, el error suele estar en la pregunta filtro.",
    ],
    situaciones: {
      vaciar: "Si la pregunta filtro está bien: la respuesta que sobra no cuenta.",
      corregir: "Si el error está en la pregunta filtro y se corrige ahí.",
      dejar: "Si se decide conservar la respuesta para el análisis.",
      excluir: "Si el caso tiene varios saltos rotos.",
    },
  },
  seccion_sobra: {
    revisar: [
      "Revisa la respuesta que abre la sección: si está mal registrada o se dejó vacía al digitar, la sección es válida y el error está ahí.",
      "Si la encuesta no debía continuar, el caso entero sobra: excluirlo es más claro que vaciar la sección pregunta por pregunta.",
      "Abre el caso completo para ver qué respondió en la sección antes de decidir.",
    ],
    situaciones: {
      excluir: "Si la sección no debía aplicarse y el caso no cuenta para el estudio.",
      dejar: "Si la respuesta que abre la sección está mal registrada y las respuestas de la sección valen.",
    },
  },
  obligatoria: {
    revisar: [
      "Revisa si al caso le falta solo esta pregunta o un bloque entero: un bloque vacío suele ser una encuesta interrumpida.",
      "Si la encuesta fue en papel, revisa si la respuesta está en la ficha física y no se digitó.",
    ],
    situaciones: {
      dejar: "Si la persona no respondió y queda como dato perdido.",
      asignar: "Si corresponde el código de no respuesta del estudio.",
      corregir: "Si la ficha física trae la respuesta.",
      excluir: "Si la encuesta quedó interrumpida y no llega al mínimo para contar.",
    },
  },
  fuera_de_lista: {
    revisar: [
      "Compara el valor con las opciones de la pregunta: un código vecino (12 por 2) o un texto escrito a mano suelen tener su opción.",
      "Si muchos casos traen el mismo valor, puede faltar una opción en el formulario o venir de otra versión.",
    ],
    situaciones: {
      recodificar: "Si cada valor tiene una opción clara en la lista.",
      corregir: "Si la ficha muestra la opción que marcó la persona.",
      vaciar: "Si el valor no corresponde a ninguna opción.",
      dejar: "Si es una opción válida que el formulario no declara. Anótalo en el motivo.",
    },
  },
  coherencia: {
    revisar: [
      "Lee las respuestas juntas y ubica cuál es la dudosa: suele ser la que choca con el resto del caso.",
      "Abre el caso completo antes de corregir una de las dos.",
    ],
    situaciones: {
      corregir: "Si una de las respuestas está mal y la ficha o el caso muestran la correcta.",
      vaciar: "Si no se puede saber cuál de las dos es la correcta.",
      dejar: "Si la combinación es rara pero posible.",
      excluir: "Si el caso tiene varias contradicciones.",
    },
  },
  bateria: {
    revisar: [
      "Respuestas iguales en toda la batería con una entrevista corta hacen sospechar un llenado sin leer. La duración está en el caso completo.",
      "Si la batería mezcla frases a favor y en contra, responder igual en todas no es coherente.",
      "Si varios casos son del mismo recopilador, revisa todas sus encuestas.",
    ],
    situaciones: {
      dejar: "Si la entrevista duró lo normal y las respuestas iguales son creíbles.",
      corregir: "Si la ficha física trae otras respuestas.",
      excluir: "Si además la entrevista fue muy corta o el caso tiene otros hallazgos.",
    },
  },
  fechas: {
    revisar: [
      "Compara lo leído con el texto original: un día y un mes invertidos (08.11 por 11.08) explican muchos casos.",
      "Si la fecha no se pudo leer y la encuesta fue en papel, revisa la ficha física.",
    ],
    situaciones: {
      corregir: "Si la ficha o el orden de las encuestas del día muestran la fecha correcta.",
      dejar: "Si la fecha es real, por ejemplo una encuesta autorizada fuera del periodo.",
      vaciar: "Si la fecha no se puede recuperar.",
      excluir: "Si la encuesta se hizo fuera del operativo y no debe contar.",
    },
  },
  formato: {
    revisar: [
      "Revisa si el dato está bien pero escrito de otra forma: espacios, guiones o un cero inicial perdido.",
      "Un correo o un teléfono con un carácter de más suele ser un error de digitación.",
    ],
    situaciones: {
      corregir: "Si el dato se reconoce y se puede reescribir con el formato pedido.",
      vaciar: "Si el dato no se puede reconstruir.",
      dejar: "Si el formato distinto también es válido, como un teléfono fijo con código de ciudad.",
    },
  },
  casi_iguales: {
    revisar: [
      "Compara las dos respuestas pregunta por pregunta: si solo cambian la hora de envío o una respuesta, es la misma persona enviando dos veces.",
      "Si son de recopiladores distintos, puede ser una encuesta copiada.",
    ],
    situaciones: {
      "mas-completa": "Si es un reenvío y una de las dos quedó a medias.",
      "mas-reciente": "Si la persona corrigió sus respuestas al reenviar.",
      primera: "Si la segunda es una copia de la primera.",
      todas: "Si son personas distintas con respuestas parecidas, como dos miembros de un hogar.",
    },
  },
  duplicados: {
    revisar: [
      "Revisa si los registros repetidos son el mismo envío (todas las respuestas iguales) o personas distintas con el mismo código.",
      "Un código repetido con respuestas distintas suele ser un error al digitar el código.",
    ],
    situaciones: {
      excluir: "Si es el mismo envío repetido: queda uno.",
      corregir: "Si son personas distintas y el código está mal digitado.",
      dejar: "Si el código se repite por diseño, como los miembros de un mismo hogar.",
    },
  },
  calculo: {
    revisar: [
      "Revisa los componentes del cálculo: si uno está mal, el error está en ese componente y no en el total.",
      "Un total vacío con los componentes llenos suele venir de una versión anterior del formulario.",
    ],
    situaciones: {
      corregir: "Si un componente o el total tienen un error que se puede corregir.",
      dejar: "Si la diferencia es de redondeo.",
      vaciar: "Si el total no se puede reconstruir.",
    },
  },
};

/** Solo si los casos comparan horas: una hora de fin anterior a la de inicio suele ser una confusión entre mañana y tarde. */
const PAUTA_DE_HORAS = "Una hora de fin anterior a la de inicio suele ser una confusión entre mañana y tarde.";

/**
 * Si lo que el motor dice de los casos habla de horas (una hora suelta, "pasaron
 * 3 horas", minutos). Una fecha fuera del periodo no recibe la pauta de horas.
 */
export function conHorasEnLosCasos(esperados: ReadonlyArray<{ hecho?: string | null; choque?: string | null } | null | undefined>): boolean {
  return esperados.some((e) => /\b\d{1,2}:\d{2}\b|\bhoras?\b|\bminutos?\b/.test(`${e?.hecho ?? ""} ${e?.choque ?? ""}`));
}

/** Lo que cambia cuando la regla la propuso el detector a partir de la base. */
const DETECTOR: Pauta = {
  revisar: [
    "La regla salió de un patrón de la base, no del formulario: antes de corregir, confirma que la combinación es un error y no una respuesta posible.",
  ],
  situaciones: {
    dejar: "Si la combinación es posible: la regla no aplica a este estudio.",
  },
};

const POR_FAMILIA: Record<string, TipoDePauta> = {
  rango_num: "rango",
  restriccion: "rango",
  outliers_iqr: "atipico",
  outliers_z: "atipico",
  obligatoria: "obligatoria",
  no_nulo: "obligatoria",
  fuera_catalogo: "fuera_de_lista",
  coherencia_2v: "coherencia",
  condiciones: "coherencia",
  filtro_opciones: "coherencia",
  select_multiple_exclusive: "coherencia",
  bateria: "bateria",
  rango_fecha: "fechas",
  comparar_fechas: "fechas",
  periodo: "fechas",
  formato: "formato",
  casi_iguales: "casi_iguales",
  duplicados: "duplicados",
  calculo: "calculo",
};

/** Subtipos del enunciado del motor (`.validacion_subtipo_hallazgo()`). */
const POR_SUBTIPO: Record<string, TipoDePauta> = {
  rango: "rango",
  restriccion: "rango",
  especial: "rango",
  fecha: "fechas",
  fechas: "fechas",
  periodo: "fechas",
  salto_debe: "salto_vacia",
  salto_nodebe: "salto_sobra",
  seccion_nodebe: "seccion_sobra",
  faltante: "obligatoria",
  catalogo: "fuera_de_lista",
  coherencia: "coherencia",
  contradiccion: "coherencia",
  bateria: "bateria",
  formato: "formato",
  calculo: "calculo",
};

/** Tipo de regla de la cola, para un motor que no publica familia ni subtipo. */
const POR_TIPO_DE_REGLA: Record<string, TipoDePauta> = {
  range: "rango",
  outlier: "atipico",
  required: "obligatoria",
  catalog: "fuera_de_lista",
  coherence: "coherencia",
  calculate_check: "calculo",
};

/** La restricción del formulario es un patrón de texto (`regex(., '...')`), no un rango: sus casos se revisan como formato. */
export function esRestriccionDeFormato(expresion: string | null | undefined): boolean {
  return /\bregex\s*\(/i.test(expresion ?? "");
}

export function tipoDePauta(o: {
  vista: VistaDelHallazgo;
  familia: string | null;
  direccion: "debe" | "nodebe" | null;
  subtipo: string | null;
  tipoRegla: string | null;
  /** La restricción del formulario es un patrón de texto (`esRestriccionDeFormato`). */
  restriccionDeFormato?: boolean;
}): TipoDePauta | null {
  if (o.vista === "casi-iguales") return "casi_iguales";
  if (o.familia === "salto" || o.vista === "salto" || o.tipoRegla === "skip") {
    if (o.subtipo === "seccion_nodebe") return "seccion_sobra";
    if (o.direccion === "debe" || o.subtipo === "salto_debe") return "salto_vacia";
    if (o.direccion === "nodebe" || o.subtipo === "salto_nodebe") return "salto_sobra";
    return null;
  }
  if (o.familia === "restriccion" && o.restriccionDeFormato) return "formato";
  return (o.familia && POR_FAMILIA[o.familia])
    || (o.subtipo && POR_SUBTIPO[o.subtipo])
    || (o.tipoRegla && POR_TIPO_DE_REGLA[o.tipoRegla])
    || null;
}

/** El subtipo que más se repite entre los casos que trajo el detalle (`esperado[].subtipo`). */
export function subtipoDeLosCasos(subtipos: ReadonlyArray<string | null | undefined>): string | null {
  const cuenta = new Map<string, number>();
  for (const s of subtipos) if (s) cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
  let mejor: string | null = null;
  let n = 0;
  for (const [s, k] of cuenta) if (k > n) { mejor = s; n = k; }
  return mejor;
}

/**
 * Las pautas del hallazgo abierto; `null` si no hay ninguna que decir. Una
 * regla del detector suma su pauta al tipo de la regla; si el tipo no se
 * reconoce, quedan solo las del detector.
 */
export function pautasDelHallazgo(o: {
  vista: VistaDelHallazgo;
  familia: string | null;
  direccion: "debe" | "nodebe" | null;
  subtipo: string | null;
  tipoRegla: string | null;
  semillaOrigen: string | null;
  /** Preguntas de la condición con un código fuera de su lista en los casos marcados (ítem 41). */
  filtroFueraDeLista?: readonly FiltroFueraDeLista[];
  /** Los casos comparan horas (`conHorasEnLosCasos`): una regla de fechas suma entonces su pauta de horas. */
  conHoras?: boolean;
  restriccionDeFormato?: boolean;
}): PautasDelHallazgo | null {
  const tipo = tipoDePauta(o);
  const detector = o.semillaOrigen === "detector_consistencia";
  const base = tipo ? PAUTAS[tipo] : null;
  const filtro = tipo === "salto_vacia" || tipo === "salto_sobra" || tipo === "seccion_sobra" ? o.filtroFueraDeLista ?? [] : [];
  if (!base && !detector) return null;
  const delTipo = tipo === "fechas" && o.conHoras
    ? [...(base?.revisar.slice(0, 1) ?? []), PAUTA_DE_HORAS, ...(base?.revisar.slice(1) ?? [])]
    : [...(base?.revisar ?? [])];
  const propias = detector ? [...DETECTOR.revisar, ...delTipo].slice(0, 3) : delTipo;
  const revisar = filtro.length ? [...filtro.map(pautaDelFiltro), ...propias].slice(0, Math.max(3, filtro.length + 1)) : propias;
  const situaciones = {
    ...(base?.situaciones ?? {}),
    ...(detector ? DETECTOR.situaciones : {}),
    ...(filtro.length ? { dejar: "Si el salto falla por un código que el formulario no declara: corrige el formulario y vuelve a auditar." } : {}),
  };
  return { tipo, detector, revisar, situaciones };
}

/** La situación en que corresponde una opción de la Decisión; `null` si las pautas no la nombran. */
export function situacionDeOpcion(pautas: PautasDelHallazgo | null, opcion: Pick<OpcionDeTratamiento, "clave">): string | null {
  if (!pautas) return null;
  return pautas.situaciones[opcion.clave as ClaveDeOpcion] ?? null;
}

/** Todas las pautas, para el test que revisa la redacción de cada una. */
export function todasLasPautas(): ReadonlyArray<[TipoDePauta | "detector", Pauta]> {
  return [...(Object.entries(PAUTAS) as [TipoDePauta, Pauta][]), ["detector", DETECTOR]];
}
