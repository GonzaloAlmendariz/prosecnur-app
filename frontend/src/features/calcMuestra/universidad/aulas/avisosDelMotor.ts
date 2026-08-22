/**
 * Traducción de los avisos del motor al idioma de la app.
 *
 * POR QUÉ EXISTE
 *
 * R emite sus warnings pensando en quien audita el motor, y la lista de riesgos
 * los pintaba literales. El resultado que ve un coordinador de campo:
 *
 *   «Comparacion de metodos con descuento secuencial aplicado al sorteo: las pi
 *    de esta tarjeta son referenciales del diseno estatico (pi_design); la pi
 *    del proceso secuencial solo se estima por Monte Carlo en la seleccion
 *    final, no en la comparacion.»
 *
 * Sin tildes, con identificadores internos y con un nombre de método que no
 * dice qué hacer. Medido en las pestañas de Selección: 18 apariciones de texto
 * crudo en tres vistas, contra 0 en Cálculo.
 *
 * La traducción va ACÁ, en el borde de presentación, y no en R: el mensaje del
 * motor es la traza técnica y tiene que seguir existiendo tal cual para quien
 * audita. Lo que cambia es que deja de ser lo primero que se lee.
 *
 * REGLA: si un aviso se reconoce, se le da título propio y un resumen que se
 * pueda decir en voz alta. Si no se reconoce pero se detecta que es técnico, se
 * resume genérico y el crudo va detrás del disclosure. Nunca se descarta.
 */

export type AvisoTraducido = {
  /** Título propio; `null` deja el que trae el motor. */
  titulo: string | null;
  /** Lo que se lee primero. Siempre en castellano y sin identificadores. */
  resumen: string;
  /** El crudo va detrás de un disclosure. */
  mostrarCrudo: boolean;
};

/**
 * Identificadores internos y jerga del motor. Si aparecen, el texto no está
 * escrito para el usuario.
 */
const MARCAS_TECNICAS = [
  /\b[A-Za-z][\w.]*::[\w.]+/, // sampling::UPsystematic
  /\bpi_(design|mc|base|final|student)\b/,
  /\b(eligible_n|discount_step|classroom_id|stratum|unique_student_ids|mos_strategy)\b/,
  /\bselector_engine\b/,
];

/**
 * Castellano sin tildes: señal de que la cadena viene de una fuente R escrita
 * en ASCII. Se buscan palabras frecuentes que SIEMPRE llevan tilde, no una
 * heurística general de acentos —que daría falsos positivos con siglas.
 */
const SIN_TILDES = /\b(comparacion|seleccion|implementacion|metodos|metodo|diseno|estatico|proporcion|estimacion|simulacion|informacion|division|asignacion)\b/i;

export function avisoEsTecnico(detalle: string): boolean {
  return MARCAS_TECNICAS.some((patron) => patron.test(detalle)) || SIN_TILDES.test(detalle);
}

/**
 * Diccionario de avisos conocidos. La clave es un patrón sobre el detalle
 * crudo; el valor, cómo se cuenta.
 *
 * El título propio importa tanto como el resumen: el motor mandaba dos avisos
 * distintos bajo el mismo «Fallback metodológico», y dos cosas distintas con el
 * mismo nombre se leen como una repetida.
 */
const DICCIONARIO: Array<{ patron: RegExp; titulo: string; resumen: string }> = [
  {
    patron: /comparacion de metodos con descuento secuencial/i,
    titulo: "Las probabilidades de esta tarjeta son del diseño, no del sorteo",
    resumen:
      "El descuento de repetidos cambia la probabilidad de cada curso-horario a medida que se sortea. " +
      "Acá se muestran las del diseño; las del sorteo real se publican en la selección final.",
  },
  {
    patron: /implementacion alternativa|no disponible o fallo|se uso sistematico_pps/i,
    titulo: "El motor resolvió con un método equivalente",
    resumen: "La librería del método pedido no estaba disponible y se usó una alternativa equivalente.",
  },
  {
    patron: /descuento_sin_ids/i,
    titulo: "El descuento de repetidos no se pudo aplicar",
    resumen:
      "El marco no trae la lista de alumnos por curso-horario, así que no hay traslape que descontar. " +
      "La selección corrió sin descontar repetidos.",
  },
  {
    patron: /ajuste de tamano divulgado|balance del sorteo/i,
    // Título y resumen se componen aparte, porque el aviso puede traer sólo
    // ajustes, sólo balances o ambos, y un título fijo prometía las dos cosas
    // aunque el aviso trajera una. Ver `componerAvisoDeSorteo`.
    titulo: "",
    resumen: "",
  },
  {
    patron: /al menos 100 corridas|simulacion insuficiente/i,
    titulo: "Simulación corta para leer estabilidad",
    resumen: "La optimización por candidatas necesita al menos 100 corridas para una lectura preliminar.",
  },
];

/**
 * Compone título y resumen de las notas del sorteo a partir de lo que el aviso
 * TRAE, no de lo que su familia podría traer.
 *
 * El motor concatena sus notas con « | » y llegaban como un ladrillo ilegible
 * (Gonzalo, 2026-08-20: «no se entiende absolutamente nada»). El resumen cuenta
 * lo que pasó y el detalle queda plegado. Pero el título quedó FIJO —«El sorteo
 * ajustó tamaños y balanceó con lo disponible»— mientras el contenido es
 * variable, así que un aviso que sólo traía balances se anunciaba como si
 * también hubiera ajustado tamaños, y dos avisos con contenidos distintos se
 * leían con el mismo nombre. Medido en HSVG2026 el 2026-08-22: un aviso de «4
 * estratos balanceó» y otro de «8 ajustó; 4 balanceó», ambos bajo el mismo
 * título.
 */
function componerAvisoDeSorteo(limpio: string): AvisoTraducido {
  const ajustes = (limpio.match(/ajuste de tamano divulgado/gi) ?? []).length;
  const balances = (limpio.match(/balance del sorteo/gi) ?? []).length;
  const partes: string[] = [];
  if (ajustes) partes.push(`en ${ajustes} estrato${ajustes === 1 ? "" : "s"} el sorteo entregó más o menos aulas que la cuota y se corrigió por sorteo ponderado`);
  if (balances) partes.push(`en ${balances} estrato${balances === 1 ? "" : "s"} balanceó con menos variables porque las demás no varían dentro del estrato`);
  const titulo = ajustes && balances
    ? "El sorteo corrigió cuotas y balanceó con lo disponible"
    : ajustes
      ? "El sorteo corrigió cuotas que no salieron exactas"
      : balances
        ? "El sorteo balanceó con menos variables de las pedidas"
        : "El motor dejó notas de este sorteo";
  return {
    titulo,
    resumen: partes.length ? `${partes.join("; ")}. El resultado final respeta las cuotas.` : "El motor dejó notas del sorteo en esta corrida.",
    mostrarCrudo: true,
  };
}

export function traducirAvisoDelMotor(detalle: string): AvisoTraducido {
  const limpio = String(detalle ?? "").trim();
  if (!limpio) {
    return { titulo: null, resumen: "Revisa la auditoría técnica del selector.", mostrarCrudo: false };
  }
  const conocido = DICCIONARIO.find((entrada) => entrada.patron.test(limpio));
  if (conocido) {
    if (!conocido.resumen && /ajuste de tamano divulgado|balance del sorteo/i.test(limpio)) {
      return componerAvisoDeSorteo(limpio);
    }
    return { titulo: conocido.titulo, resumen: conocido.resumen, mostrarCrudo: true };
  }
  if (avisoEsTecnico(limpio)) {
    return {
      titulo: null,
      // Genérico a propósito: prometer más de lo que se sabe sería peor que
      // admitir que el detalle está en el mensaje del motor.
      resumen: "El motor dejó una nota técnica sobre esta corrida.",
      mostrarCrudo: true,
    };
  }
  return { titulo: null, resumen: limpio, mostrarCrudo: false };
}

/**
 * Qué clase de cosa es un aviso, que no es lo mismo que su gravedad.
 *
 * Gonzalo, 2026-08-22, viendo cinco avisos seguidos en ámbar: «¿a qué se deben
 * tantas alertas, es porque algo está mal?». No lo estaba. De los cinco, uno
 * pedía una decisión (5 celdas con menos reservas que titulares), tres eran
 * notas de que el motor hizo su trabajo —las probabilidades mostradas son las
 * del diseño; en 4 estratos no había nada que balancear; en 8 la cuota no salía
 * entera y se corrigió— y uno era un recordatorio de que faltaba correr la
 * simulación. Los cinco marcados «media».
 *
 * Una escala donde todo vale lo mismo obliga a leerlos todos para descubrir que
 * sólo uno pide algo. La gravedad se conserva; la naturaleza se añade.
 */
export type NaturalezaAviso = "asunto" | "nota" | "pendiente" | "ok";

const NATURALEZA_POR_PATRON: Array<{ patron: RegExp; naturaleza: NaturalezaAviso }> = [
  // Lo que pide una decisión o deja al estudio con menos de lo que pidió.
  { patron: /reserva|profundidad|descuento_sin_ids|implementacion alternativa|no disponible o fallo/i, naturaleza: "asunto" },
  // Lo que sólo cuenta cómo se comportó el sorteo.
  { patron: /ajuste de tamano divulgado|balance del sorteo|descuento secuencial/i, naturaleza: "nota" },
  // Lo que se resuelve corriendo algo.
  { patron: /al menos \d+ corridas|simulacion insuficiente|auditoria_pendiente|simulaci.n corta/i, naturaleza: "pendiente" },
];

export function naturalezaDelAviso(risk: Record<string, unknown>): NaturalezaAviso {
  const severity = String(risk.severity ?? "");
  if (severity === "ok") return "ok";
  const code = String(risk.code ?? "");
  // La salud deriva de cifras del propio cálculo: si una cruza su umbral, hay
  // algo que mirar, no una nota de procedimiento.
  if (code.startsWith("salud_")) return "asunto";
  const texto = `${code} ${String(risk.title ?? "")} ${String(risk.detail ?? "")}`;
  const encontrado = NATURALEZA_POR_PATRON.find((entrada) => entrada.patron.test(texto));
  // Sin señal, se trata como asunto: callar algo que pedía atención es peor que
  // pedir atención de más.
  return encontrado?.naturaleza ?? "asunto";
}

export const ETIQUETA_NATURALEZA: Record<NaturalezaAviso, { plural: string; singular: string }> = {
  asunto: { singular: "asunto para revisar", plural: "asuntos para revisar" },
  nota: { singular: "nota de cómo salió el sorteo", plural: "notas de cómo salió el sorteo" },
  pendiente: { singular: "tarea pendiente", plural: "tareas pendientes" },
  ok: { singular: "sin observaciones", plural: "sin observaciones" },
};
