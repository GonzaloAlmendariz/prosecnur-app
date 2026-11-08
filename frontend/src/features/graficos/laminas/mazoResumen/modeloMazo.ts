// El mazo «Resumen ejecutivo» (ADR 0135; maqueta graficos-sintesis, Mazo): a partir del estudio propone, en orden, las
// láminas de resumen que el registro ofrece. Cada propuesta reutiliza la tarjeta del selector «¿Qué quieres contar?»
// (TARJETAS_CONTAR y su `porDefecto`), así que una lámina insertada desde el mazo es la misma que se inserta desde el
// selector, con la franja (públicos, indicador y referencia) y la regla del mazo escritas encima.
//
// El título no se propone: lo escribe siempre el analista (ADR 0135 §9), y la lámina nace también sin antetítulo (D1 de
// la oleada M): la tarjeta dice qué públicos lee, pero nombrar la lámina es del analista. Nada viene elegido: el analista
// marca las que quiere, las ordena y recién entonces inserta. La tendencia entre mediciones no existe aquí.
// Aperturas internas entra con su aviso: le falta la pregunta que divide, que se elige en Datos de la lámina, igual que
// cuando se inserta desde el selector. Pura: el diálogo la usa y los tests la prueban sola.

import type { GraficadorRef, Slide, SlideType, VarInfo } from "../../../../api/graficos";
import type { ReglaPreguntas } from "../../../../api/graficosRegla";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { payloadPorDefecto } from "../../store";
import { CORTE_EN_CADENA } from "../argsDatosGrafico";
import { nombrePublico } from "../gruposPadron/modeloPadron";
import { leerRegla, reglaEnCorto } from "../reglaPreguntas/modeloReglaPreguntas";
import { conGraficoDePartida, tarjetaContar, tarjetaDisponible, todasDeLasBases, type ClaseTarjeta, type TarjetaConGrafico } from "../selectores/intencionesContar";
import { graficoConPreset, ranuraDePreset, type ClavePreset, type EstudioDelSelector } from "../selectores/opcionesLamina";

type Args = Record<string, unknown>;

export type ClasePropuesta =
  | "cobertura" | "panorama" | "contraste" | "escala_umbral" | "escala_sin_info" | "aperturas" | "fortalezas" | "cierre";

export type PropuestaMazo = {
  /** Estable entre renders: «panorama», «fortalezas:docentes». Con él se recuerdan la elección, el orden y la regla. */
  id: string;
  clase: ClasePropuesta;
  /** La tarjeta del selector de la que sale. */
  tarjeta: ClavePreset | null;
  tipo: SlideType;
  nombre: string;
  claseTarjeta: ClaseTarjeta;
  /** Los públicos que lee la lámina, en el orden de la franja. */
  publicos: readonly string[];
  graficador: string | null;
  slot: string | null;
  /** Args del gráfico con la franja y la regla del mazo. */
  args: Args;
  /** La regla dicha en palabras, para cuando el conteo en vivo no aplica o todavía no llega. */
  reglaEnPalabras: string;
  /** Lo que le falta a la lámina para dibujarse; se inserta igual y lo pide en Datos. */
  falta: string | null;
};

/** El indicador que suman los puntos: códigos de la escala dominante y su nombre para el pie. */
export type IndicadorMazo = { id: string; etiqueta: string; rotulo: string; codigos: string[] };

export type EntradaMazo = {
  estudio: EstudioDelSelector;
  /** Las bases que entran, en el orden que el analista eligió en la franja (el de las filas del panorama). */
  publicos: readonly string[];
  graficadores: ReadonlySet<string>;
  laminas: ReadonlySet<string>;
  /** Tipos de lámina que el editor sabe insertar (con payload de partida). */
  tiposInsertables: ReadonlySet<SlideType>;
  /** ¿El graficador declara ese arg (y, si se da, ese valor entre sus opciones)? */
  admiteArg: (graficador: string, arg: string, valor?: string) => boolean;
  indicador: IndicadorMazo | null;
  /** Referencia en %: la línea del panorama y el umbral de la escala bajo la referencia. */
  referencia: number;
  /** Reglas editadas en el mazo, por id de propuesta. */
  reglas?: Readonly<Record<string, ReglaPreguntas>>;
};

export const REFERENCIA_POR_DEFECTO = 60;
export const N_CONTRASTE = 13;
export const N_SIN_INFO = 12;
/** El cierre con hallazgos (ADR 0135 §6): último paso del mazo cuando el registro lo trae. */
export const TIPO_CIERRE: SlideType = "p_slide_cierre_hallazgos";
export const ORIGEN_RESUMEN = "resumen";
export const FALTA_DIVIDE = "Falta elegir la pregunta que divide";

const TARJETA = {
  cobertura: "p_slide_1_grafico:cobertura",
  panorama: "p_slide_1_grafico:panorama",
  contraste: "p_slide_1_grafico:contraste",
  escala: "p_slide_1_grafico:escala",
  aperturas: "p_slide_1_grafico:aperturas",
  fortalezas: "p_slide_1_grafico:fortalezas",
  cierre: "p_slide_cierre_hallazgos:cierre",
} as const;

// ---------------------------------------------------------------------------
// Públicos en palabras
// ---------------------------------------------------------------------------

/** Un público dentro de una frase: sin guiones bajos, como está escrito. */
export function publicoEnFrase(base: string): string {
  return base.replace(/[_-]+/g, " ").trim();
}

/** «docentes», «docentes y estudiantes», «estudiantes, docentes y administrativos» (como están escritos). */
export function unirPublicos(bases: readonly string[]): string {
  const nombres = bases.map(publicoEnFrase);
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** La misma lista con la primera letra en mayúscula («Docentes y estudiantes»): la cabeza de la tarjeta. */
export function listaPublicos(bases: readonly string[]): string {
  return nombrePublico(unirPublicos(bases));
}

/** La base que leen las láminas de un solo público: la activa si entra, si no la primera. */
export function basePrincipal(publicos: readonly string[], baseActiva: string | null): string | null {
  return baseActiva && publicos.includes(baseActiva) ? baseActiva : publicos[0] ?? null;
}

/** El nombre accesible de una tarjeta: el de la lámina con sus públicos («Fortalezas y alertas, Docentes»). */
export function nombreAccesible(p: Pick<PropuestaMazo, "nombre" | "publicos">): string {
  return p.publicos.length ? `${p.nombre}, ${listaPublicos(p.publicos)}` : p.nombre;
}

// ---------------------------------------------------------------------------
// La regla en palabras
// ---------------------------------------------------------------------------

/** La regla dicha en una línea, sin pedir nada al motor: «Las 13 de mayor diferencia, de docentes y estudiantes». */
export function reglaEnPalabras(regla: ReglaPreguntas | null, publicos: readonly string[]): string {
  const de = publicos.length ? `, de ${unirPublicos(publicos)}` : "";
  return `${regla ? reglaEnCorto(regla, publicos.length) : "Las preguntas declaradas"}${de}`;
}

// ---------------------------------------------------------------------------
// La escala del estudio y el indicador
// ---------------------------------------------------------------------------

/** Lo que no es una opción sustantiva de la escala (mismo criterio que el editor: top2boxSeleccion.ts). */
const NO_SUSTANTIVA = /^(sin inf|sin información|no sabe|no sé|no se\b|ns\/nr|ns\/no|no responde|no opina|no aplica|ninguno de los anteriores|no utilic|no us[eé]|no he usado)/i;

type Opcion = { name: string; label: string };

const sustantivas = (v: Pick<VarInfo, "choices">): Opcion[] =>
  (v.choices ?? []).filter((c) => (c.label ?? c.name ?? "").trim() !== "" && !NO_SUSTANTIVA.test((c.label ?? c.name).trim()));

/** ¿Pregunta de escala? `select_one` con al menos cuatro opciones sustantivas (ADR 0135 §5; el motor decide al final). */
export function esPreguntaDeEscala(v: Pick<VarInfo, "tipo" | "choices">): boolean {
  return v.tipo.startsWith("select_one") && sustantivas(v).length >= 4;
}

type Fuente = { name: string; variables: readonly VarInfo[] };

/** Cuántas preguntas de escala tiene cada público (estimación del editor; el conteo del motor manda). */
export function escalasPorPublico(fuentes: readonly Fuente[], publicos: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of publicos) out[b] = fuentes.find((f) => f.name === b)?.variables.filter(esPreguntaDeEscala).length ?? 0;
  return out;
}

/** La escala más repetida entre las preguntas de escala de los públicos: sus opciones sustantivas, en orden. */
export function escalaDominante(fuentes: readonly Fuente[], publicos: readonly string[]): Opcion[] {
  const cuenta = new Map<string, { n: number; opciones: Opcion[] }>();
  for (const f of fuentes) {
    if (!publicos.includes(f.name)) continue;
    for (const v of f.variables) {
      if (!esPreguntaDeEscala(v)) continue;
      const opciones = sustantivas(v);
      const firma = opciones.map((o) => `${o.name}=${o.label}`).join("|");
      const previo = cuenta.get(firma);
      cuenta.set(firma, { n: (previo?.n ?? 0) + 1, opciones });
    }
  }
  let mejor: { n: number; opciones: Opcion[] } | null = null;
  for (const c of cuenta.values()) if (!mejor || c.n > mejor.n) mejor = c;
  return mejor?.opciones ?? [];
}

const rotuloDe = (ops: readonly Opcion[]) => ops.map((o) => o.label || o.name).join(" + ");

/**
 * Los indicadores que el estudio permite elegir, desde su escala dominante. El primero, Top Two Box (las dos últimas
 * opciones sustantivas), es el de partida; el rótulo nombra las respuestas para que se vea qué suma cada uno.
 */
export function indicadoresDelEstudio(escala: readonly Opcion[]): IndicadorMazo[] {
  if (escala.length < 4) return [];
  const ultimas = escala.slice(-2);
  const ultima = escala.slice(-1);
  const primeras = escala.slice(0, 2);
  return [
    { id: "top2box", etiqueta: "Top Two Box", rotulo: `${rotuloDe(ultimas)} (Top Two Box)`, codigos: ultimas.map((o) => o.name) },
    { id: "topbox", etiqueta: "Top Box", rotulo: `${rotuloDe(ultima)} (Top Box)`, codigos: ultima.map((o) => o.name) },
    { id: "bottom2box", etiqueta: "Bottom Two Box", rotulo: `${rotuloDe(primeras)} (Bottom Two Box)`, codigos: primeras.map((o) => o.name) },
  ];
}

// ---------------------------------------------------------------------------
// Las propuestas
// ---------------------------------------------------------------------------

function argsDeTarjeta(t: TarjetaConGrafico, estudio: EstudioDelSelector): Args {
  return { ...graficoConPreset(undefined, t.grafico, estudio).args };
}

function conIndicador(e: EntradaMazo, graficador: string, args: Args): Args {
  if (!e.indicador || !e.admiteArg(graficador, "corte")) return args;
  const out: Args = { ...args, corte: CORTE_EN_CADENA.has(graficador) ? e.indicador.codigos.join(",") : [...e.indicador.codigos] };
  if (e.admiteArg(graficador, "corte_etiqueta")) out.corte_etiqueta = e.indicador.etiqueta;
  return out;
}

function conRegla(e: EntradaMazo, id: string, args: Args): Args {
  const editada = e.reglas?.[id];
  return editada ? { ...args, regla: { ...editada } } : args;
}

type Borrador = Omit<PropuestaMazo, "reglaEnPalabras" | "graficador" | "slot" | "nombre" | "claseTarjeta" | "tipo" | "falta" | "publicos"> & {
  t: TarjetaConGrafico;
  nombre?: string;
  falta?: string | null;
  publicosRegla: readonly string[];
  palabras?: string;
};

function cerrar(e: EntradaMazo, b: Borrador): PropuestaMazo {
  const graficador = b.t.grafico.graficador;
  const args = conRegla(e, b.id, conIndicador(e, graficador, b.args));
  const regla = leerRegla(args.regla);
  return {
    id: b.id,
    clase: b.clase,
    tarjeta: b.tarjeta,
    tipo: b.t.tipo,
    nombre: b.nombre ?? b.t.nombre,
    claseTarjeta: b.t.clase,
    publicos: [...b.publicosRegla],
    graficador,
    slot: ranuraDePreset(b.t),
    args,
    reglaEnPalabras: b.palabras ?? reglaEnPalabras(regla ?? (graficador === "p_fortalezas" ? { tipo: "extremos", n: typeof args.n === "number" ? args.n : 5 } : null), b.publicosRegla),
    falta: b.falta ?? null,
  };
}

/** Las láminas que el mazo propone, en orden. Sin públicos, ninguna. */
export function proponerMazo(e: EntradaMazo): PropuestaMazo[] {
  const publicos = e.publicos.filter((b, i) => e.estudio.bases.includes(b) && e.publicos.indexOf(b) === i);
  if (!publicos.length) return [];
  const principal = basePrincipal(publicos, e.estudio.baseActiva) as string;
  const varios = publicos.length > 1;
  const estudio: EstudioDelSelector = { ...e.estudio, bases: publicos, baseActiva: principal };
  const disponible = (clave: string): TarjetaConGrafico | null => {
    const t = tarjetaContar(clave);
    return t && conGraficoDePartida(t) && tarjetaDisponible(t, e.graficadores, e.laminas) ? t : null;
  };
  const out: PropuestaMazo[] = [];

  const cobertura = disponible(TARJETA.cobertura);
  if (cobertura) {
    out.push(cerrar(e, {
      id: "cobertura", clase: "cobertura", tarjeta: cobertura.clave, t: cobertura,
      args: argsDeTarjeta(cobertura, estudio), publicosRegla: publicos,
      palabras: `Casos, padrón, cobertura y meta de ${unirPublicos(publicos)}`,
    }));
  }

  const panorama = disponible(TARJETA.panorama);
  if (panorama) {
    const args = argsDeTarjeta(panorama, estudio);
    if (e.admiteArg(panorama.grafico.graficador, "referencia")) args.referencia = e.referencia;
    out.push(cerrar(e, { id: "panorama", clase: "panorama", tarjeta: panorama.clave, t: panorama, args, publicosRegla: publicos }));
  }

  // El contraste compara UN par (graficos_dumbbell_auto.R): los dos primeros públicos de la franja. Para cambiarlo se
  // reordena la franja o se elige en la tarjeta, «Públicos que se comparan».
  const contraste = disponible(TARJETA.contraste);
  if (contraste && varios) {
    const par = publicos.slice(0, 2);
    const args = argsDeTarjeta(contraste, { ...estudio, bases: par });
    args.bases = par;
    args.regla = { tipo: "mayor_diferencia", n: N_CONTRASTE };
    out.push(cerrar(e, {
      id: "contraste", clase: "contraste", tarjeta: contraste.clave, t: contraste, args, publicosRegla: par,
    }));
  }

  // Con varios públicos la escala es UNA lámina sobre todos (graficos_divergentes_publicos.R): `base$*` de cada público en
  // el orden de la franja, y el motor rotula cada fila con su público. Con uno, la del público.
  const escala = disponible(TARJETA.escala);
  if (escala) {
    const leen = varios ? publicos : [principal];
    const deEscala = (): Args => {
      const args = argsDeTarjeta(escala, estudio);
      if (e.admiteArg(escala.grafico.graficador, "vars")) args.vars = todasDeLasBases(leen);
      return args;
    };
    const args = deEscala();
    args.regla = { tipo: "bajo_umbral", umbral: e.referencia };
    out.push(cerrar(e, {
      id: "escala_umbral", clase: "escala_umbral", tarjeta: escala.clave, t: escala,
      nombre: `Escala bajo ${formatoConteo(e.referencia)}%`, args, publicosRegla: leen,
    }));
    const sinInfo = deEscala();
    sinInfo.regla = { tipo: "mayor_sin_info", n: N_SIN_INFO };
    if (e.admiteArg(escala.grafico.graficador, "orden", "sin_informacion")) sinInfo.orden = "sin_informacion";
    out.push(cerrar(e, {
      id: "escala_sin_info", clase: "escala_sin_info", tarjeta: escala.clave, t: escala,
      nombre: "Escala ordenada por Sin información", args: sinInfo, publicosRegla: leen,
    }));
  }

  const aperturas = disponible(TARJETA.aperturas);
  if (aperturas) {
    const args = argsDeTarjeta(aperturas, estudio);
    if (e.admiteArg(aperturas.grafico.graficador, "vars") && args.vars === undefined) args.vars = [`${principal}$*`];
    out.push(cerrar(e, {
      id: "aperturas", clase: "aperturas", tarjeta: aperturas.clave, t: aperturas, args, publicosRegla: [principal], falta: FALTA_DIVIDE,
    }));
  }

  const fortalezas = disponible(TARJETA.fortalezas);
  if (fortalezas) {
    for (const base of publicos) {
      out.push(cerrar(e, {
        id: `fortalezas:${base}`, clase: "fortalezas", tarjeta: fortalezas.clave, t: fortalezas,
        args: argsDeTarjeta(fortalezas, { ...estudio, bases: [base], baseActiva: base }),
        publicosRegla: [base],
      }));
    }
  }

  if (e.tiposInsertables.has(TIPO_CIERRE) && e.laminas.has(TIPO_CIERRE)) {
    out.push({
      id: "cierre", clase: "cierre", tarjeta: TARJETA.cierre, tipo: TIPO_CIERRE, nombre: "Cierre con hallazgos", claseTarjeta: "resumen",
      publicos, graficador: null, slot: null, args: {}, reglaEnPalabras: "Una cifra de cada lámina anterior", falta: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Insertar
// ---------------------------------------------------------------------------

/** La clave de `payload.meta` con el nombre de la propuesta. El motor no la imprime (conserva las claves que no lee). */
export const META_NOMBRE = "nombre";

/**
 * La lámina de una propuesta: payload de partida del tipo, su gráfico y el origen «resumen». Sin título ni antetítulo.
 * M2: el nombre de la propuesta («Escala bajo 60%») va en `meta.nombre`, para que el editor la nombre como el mazo y no
 * por el tipo de su gráfico («Escala con Sin información aparte»). No es un título: no sale en la lámina.
 * M8: con su público (`nombreAccesible`), para que las tres «Fortalezas y alertas» no se llamen igual en la Estructura
 * ni en «Elegir cifra» del cierre («Fortalezas y alertas, Docentes»).
 */
export function laminaDePropuesta(p: PropuestaMazo, id: string): Slide {
  const payload: Args = payloadPorDefecto(p.tipo);
  if (p.graficador && p.slot) {
    const g: GraficadorRef = { graficador: p.graficador, args: { ...p.args } };
    payload[p.slot] = g;
  }
  const meta = payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta) ? (payload.meta as Args) : {};
  payload.meta = { ...meta, [META_NOMBRE]: nombreAccesible(p) };
  return { id, tipo: p.tipo, payload, origen: ORIGEN_RESUMEN };
}

/** Las elegidas, en el orden de las propuestas, como láminas nuevas. */
export function laminasDelMazo(
  propuestas: readonly PropuestaMazo[], elegidas: Readonly<Record<string, true>>, nuevoId: () => string,
): Slide[] {
  return propuestas.filter((p) => elegidas[p.id]).map((p) => laminaDePropuesta(p, nuevoId()));
}

/** Cuántas de las propuestas están elegidas (una elección de una propuesta que ya no está no cuenta). */
export function contarElegidas(propuestas: readonly PropuestaMazo[], elegidas: Readonly<Record<string, true>>): number {
  return propuestas.filter((p) => elegidas[p.id]).length;
}

/** Las propuestas en el orden que el analista dejó; las que el orden no nombra (un público nuevo), detrás en su lugar. */
export function ordenarPropuestas(propuestas: readonly PropuestaMazo[], orden: readonly string[] | null): PropuestaMazo[] {
  if (!orden?.length) return [...propuestas];
  const pos = new Map(orden.map((id, i) => [id, i]));
  const nombradas = propuestas.filter((p) => pos.has(p.id)).sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
  return [...nombradas, ...propuestas.filter((p) => !pos.has(p.id))];
}

/** «4 de 10 elegidas», «1 de 10 elegida», «Ninguna de 10 elegida». */
export function textoElegidas(n: number, total: number): string {
  if (n === 0) return `Ninguna de ${formatoConteo(total)} elegida`;
  return `${formatoConteo(n)} de ${formatoConteo(total)} ${n === 1 ? "elegida" : "elegidas"}`;
}

/** El aviso al insertar: «Se insertaron 8 láminas», «Se insertó 1 lámina». */
export function mensajeInsertadas(n: number): string {
  return n === 1 ? "Se insertó 1 lámina" : `Se insertaron ${formatoConteo(n)} láminas`;
}

/** El plan con las nuevas detrás de la lámina `posicion` (1-based); sin posición, al final. */
export function insertarTras(slides: readonly Slide[], nuevas: readonly Slide[], posicion: number | null): Slide[] {
  const i = posicion === null ? slides.length : Math.max(0, Math.min(slides.length, Math.floor(posicion)));
  return [...slides.slice(0, i), ...nuevas, ...slides.slice(i)];
}

/** «Insertar 8 láminas», «Insertar 1 lámina»; sin ninguna elegida, «Insertar láminas» (el botón queda deshabilitado). */
export function rotuloInsertar(n: number): string {
  if (n <= 0) return "Insertar láminas";
  return `Insertar ${formatoConteo(n)} ${n === 1 ? "lámina" : "láminas"}`;
}

/**
 * Todas las bases en el orden elegido: las de `orden` que siguen en el estudio y, detrás, las que el orden no nombra (una
 * base nueva). Sin orden, el del estudio.
 */
export function ordenPublicos(orden: readonly string[] | null, todas: readonly string[]): string[] {
  if (!orden) return [...todas];
  const vistas = orden.filter((b, i) => todas.includes(b) && orden.indexOf(b) === i);
  return [...vistas, ...todas.filter((b) => !vistas.includes(b))];
}

/** El orden con `desde` en el lugar que ocupaba `hasta` (lo que hace un arrastre); los demás se corren. */
export function moverA(orden: readonly string[], desde: string, hasta: string): string[] {
  const i = orden.indexOf(desde);
  const j = orden.indexOf(hasta);
  if (i < 0 || j < 0 || i === j) return [...orden];
  const out = [...orden];
  out.splice(i, 1);
  out.splice(j, 0, desde);
  return out;
}

/** Los públicos al encender o apagar uno, en el orden de `todas` (el elegido); el último no se apaga. */
export function alternarPublico(actuales: readonly string[], base: string, todas: readonly string[]): string[] {
  const set = new Set(actuales);
  if (set.has(base)) {
    if (set.size === 1) return [...actuales];
    set.delete(base);
  } else set.add(base);
  return todas.filter((b) => set.has(b));
}
