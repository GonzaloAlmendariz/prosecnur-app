// Modelo puro de «Diferencias entre grupos» (ADR 0128; propuesta de significancia §3.5, §4.4): opciones cerradas de la
// regla, su resumen en una línea, el estado del inspector, los conteos de una lámina, la frase de un par y las
// condiciones con ✓/✗, la nota partida en cápsula + texto y la revisión en lote (filtro y CSV). Sin React.

import type {
  CodigoRevisar,
  FragilesDiferencias,
  GrupoDiferencias,
  LaminaDiferencias,
  ParDiferencias,
  ReglaDiferencias,
  ResultadoDiferencias,
} from "../../../../api/graficosDiferencias";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";

// ---------- Opciones cerradas de la regla (nunca un paso a paso libre) ----------

export type OpcionCerrada = { valor: number; rotulo: string };

export const ALFAS: readonly number[] = [0.1, 0.05, 0.01];
export const UMBRALES: readonly number[] = [0, 5, 10, 15];
export const BASES_MINIMAS: readonly number[] = [20, 30, 50];

export const OPCIONES_FRAGILES: readonly { clave: FragilesDiferencias; rotulo: string }[] = [
  { clave: "contorno", rotulo: "Contorno" },
  { clave: "ocultar", rotulo: "No marcar" },
];

/** Prueba de tendencia entre niveles ordenados (D6): opcional, apagada por defecto. */
export type TendenciaDiferencias = "no" | "si";
export const OPCIONES_TENDENCIA: readonly { clave: TendenciaDiferencias; rotulo: string }[] = [
  { clave: "no", rotulo: "No" },
  { clave: "si", rotulo: "Sí" },
];

/** El nivel en el texto de la UI: «p < 0.05» (punto decimal, es-PE). */
export const rotuloAlfa = (a: number): string => `p < ${a.toFixed(2)}`;

/**
 * Las opciones de un campo cerrado. Un valor guardado fuera de la lista (una regla migrada con 0.02) se agrega para que
 * se vea y se pueda cambiar; no se pierde en silencio.
 */
export function opcionesCerradas(base: readonly number[], guardado: number, rotulo: (v: number) => string, descendente = false): OpcionCerrada[] {
  const valores = base.includes(guardado) || !Number.isFinite(guardado) ? [...base] : [...base, guardado];
  valores.sort((x, y) => (descendente ? y - x : x - y));
  return valores.map((valor) => ({ valor, rotulo: rotulo(valor) }));
}

export const opcionesAlfa = (guardado: number) => opcionesCerradas(ALFAS, guardado, rotuloAlfa, true);
export const opcionesUmbral = (guardado: number) => opcionesCerradas(UMBRALES, guardado, (v) => (v === 0 ? "Sin mínimo" : `${v} puntos`));
export const opcionesBaseMinima = (guardado: number) => opcionesCerradas(BASES_MINIMAS, guardado, (v) => `${v} casos`);

// ---------- La regla en palabras ----------

export function nombrePrueba(regla: Pick<ReglaDiferencias, "prueba" | "conglomerado">): string {
  return regla.prueba === "rao_scott" ? `Rao-Scott por ${regla.conglomerado ?? "conglomerado"}` : "Prueba z";
}

export function nombreCorreccion(regla: Pick<ReglaDiferencias, "correccion">): string {
  return regla.correccion === "bh_informe" ? "BH" : "Bonferroni";
}

/** «Rao-Scott por aula, BH, p < 0.05, 10 pts, n ≥ 30». */
export function resumenRegla(regla: ReglaDiferencias): string {
  return [
    nombrePrueba(regla),
    nombreCorreccion(regla),
    rotuloAlfa(regla.alfa),
    regla.umbral_puntos > 0 ? `${regla.umbral_puntos} pts` : "sin mínimo de puntos",
    `n ≥ ${regla.base_minima}`,
  ].join(", ");
}

/** Dos reglas iguales en lo que decide una marca (la versión y `tendencia`, apagada, no cuentan). */
export function mismaRegla(a: ReglaDiferencias, b: ReglaDiferencias): boolean {
  const campos: (keyof ReglaDiferencias)[] = [
    "prueba", "correccion", "alfa", "umbral_puntos", "base_minima", "conglomerados_minimos", "fragiles", "conglomerado",
    "estrato", "incluir_ns", "max_letras", "tendencia",
  ];
  return campos.every((c) => a[c] === b[c]);
}

// ---------- Cifras ----------

/**
 * p ajustado para leer: «< 0.001» o tres decimales con punto (es-PE usa punto decimal). `compacto`, para la columna de
 * una tabla: «<0.001», sin el espacio, para que la cifra quepa entera en su celda.
 */
export function formatoP(p: number | null, { compacto = false }: { compacto?: boolean } = {}): string {
  if (p === null) return "—";
  if (p < 0.001) return compacto ? "<0.001" : "< 0.001";
  return p.toFixed(3);
}

export const formatoPct = (x: number | null): string => (x === null ? "—" : `${formatoDecimal(x, 0)}%`);

/** Diferencia en puntos con signo: «+27». */
export function formatoPuntos(d: number | null): string {
  if (d === null) return "—";
  const r = Math.round(d);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${formatoConteo(Math.abs(r))}`;
}

// ---------- Una lámina ----------

export type ConteosLamina = { marcadas: number; fragiles: number; bajoUmbral: number; noComparables: number };

/** «Marcadas» son las que llevan cápsula (firmes y frágiles); las frágiles se cuentan además aparte. */
export function conteosLamina(lamina: Pick<LaminaDiferencias, "pares" | "grupos">): ConteosLamina {
  const de = (v: ParDiferencias["veredicto"]) => lamina.pares.filter((p) => p.veredicto === v).length;
  return {
    marcadas: de("marcada") + de("fragil"),
    fragiles: de("fragil"),
    bajoUmbral: de("bajo_umbral"),
    noComparables: lamina.grupos.filter((g) => !g.comparable).length,
  };
}

export const esMarcado = (p: Pick<ParDiferencias, "veredicto">): boolean => p.veredicto === "marcada" || p.veredicto === "fragil";

export function etiquetaGrupo(grupos: readonly GrupoDiferencias[], letra: string): string {
  if (letra === "resto") return "el resto";
  return grupos.find((g) => g.letra === letra)?.etiqueta ?? letra;
}

/** R11-10: el par que compara una fila de la tabla del «Por qué»: «36 a 45 años y 24 a 35 años». */
export function parDeGrupos(par: Pick<ParDiferencias, "a" | "b">, grupos: readonly GrupoDiferencias[]): string {
  const a = etiquetaGrupo(grupos, par.a);
  return `${a.charAt(0).toLocaleUpperCase("es")}${a.slice(1)} y ${etiquetaGrupo(grupos, par.b)}`;
}

const unirConY = (partes: readonly string[]): string =>
  partes.length <= 1 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

/** «Compara los 2 grupos de Área entre sí (bases 224 y 176).» (o «cada grupo frente al resto»). */
export function descripcionComparacion(lamina: Pick<LaminaDiferencias, "grupos" | "modo_letras" | "cruce">, etiquetaCruce?: string | null): string {
  const n = lamina.grupos.length;
  const cruce = etiquetaCruce || lamina.cruce || "el cruce";
  const que = lamina.modo_letras === "frente_al_resto"
    ? `Compara cada uno de los ${n} grupos de ${cruce} frente al resto`
    : `Compara los ${n} grupos de ${cruce} entre sí`;
  const bases = lamina.grupos.map((g) => g.n).filter((x): x is number => x !== null);
  if (!bases.length) return `${que}.`;
  const tramo = bases.length <= 3
    ? `bases ${unirConY(bases.map((b) => formatoConteo(b)))}`
    : `bases de ${formatoConteo(Math.min(...bases))} a ${formatoConteo(Math.max(...bases))}`;
  return `${que} (${tramo}).`;
}

/** Grupos que no se comparan, con su razón visible: «Antropología: n = 11, no se compara». */
export function gruposNoComparables(grupos: readonly GrupoDiferencias[]): string[] {
  return grupos.filter((g) => !g.comparable).map((g) => `${g.etiqueta}: ${g.motivo ?? (g.n !== null ? `n = ${formatoConteo(g.n)}, no se compara` : "no se compara")}`);
}

/**
 * La nota de los grupos chicos, con lo que se ve en la lámina (espejo de `.sig_texto_bases_chicas` del motor). El umbral
 * es la base mínima de la regla del estudio. Antes decía «Con trama: …», una trama que ningún motor dibuja.
 */
export function notaBasesChicas(baseMinima: number): string {
  return `Los grupos con menos de ${formatoConteo(baseMinima)} casos se muestran como referencia y no se comparan.`;
}

/** La redacción de las marcadas de una lámina, en el orden de sus filas. */
export function redaccionLamina(pares: readonly ParDiferencias[]): string {
  return pares.filter(esMarcado).map((p) => p.redaccion.trim()).filter(Boolean).join(" ");
}

// ---------- Estado del inspector (seis estados, más el interruptor apagado) ----------

export type EstadoInspector = "con_marcas" | "sin_cruce" | "calculando" | "ninguna" | "abstencion" | "error" | "apagado";

export type CargaDiferencias<T> =
  | { estado: "cargando"; datos?: T }
  | { estado: "listo"; datos: T }
  | { estado: "error"; code: string; message: string; error_id: string | null };

export function estadoInspector(entrada: {
  tieneCruce: boolean;
  encendido: boolean;
  carga: CargaDiferencias<{ lamina: Pick<LaminaDiferencias, "estado"> }> | undefined;
}): EstadoInspector {
  if (!entrada.tieneCruce) return "sin_cruce";
  if (!entrada.encendido) return "apagado";
  const c = entrada.carga;
  if (!c) return "calculando";
  if (c.estado === "error") return "error";
  const datos = c.datos;
  if (!datos) return "calculando";
  return datos.lamina.estado;
}

// ---------- «Por qué» de un par ----------

/** El par que se abre primero: la primera marcada; si no hay, el primero. */
export function parInicial(pares: readonly ParDiferencias[]): number {
  const i = pares.findIndex(esMarcado);
  return i >= 0 ? i : 0;
}

/** «Ciencias políticas (44%) supera a Economía y Finanzas (17%) por 27 puntos.» */
export function frasePar(par: ParDiferencias, grupos: readonly GrupoDiferencias[]): string {
  const a = etiquetaGrupo(grupos, par.a);
  const b = etiquetaGrupo(grupos, par.b);
  const cifras = (g: string, p: number | null) => (p === null ? g : `${g} (${formatoPct(p)})`);
  const puntos = par.dif === null ? "" : ` por ${formatoConteo(Math.abs(Math.round(par.dif)))} puntos`;
  if (par.veredicto === "no_comparable") return `${cifras(a, par.p_a)} y ${cifras(b, par.p_b)} no se comparan: un grupo no alcanza la base mínima.`;
  // «supera a el resto» → «supera al resto».
  if (esMarcado(par)) return `${cifras(a, par.p_a)} supera ${b.startsWith("el ") ? `al ${cifras(b.slice(3), par.p_b)}` : `a ${cifras(b, par.p_b)}`}${puntos}.`;
  return `${cifras(a, par.p_a)} y ${cifras(b, par.p_b)} no se distinguen con esta regla.`;
}

export type CondicionPar = { clave: "elegibilidad" | "significancia" | "magnitud"; rotulo: string; cumple: boolean };

/** Las tres condiciones de §4 con su ✓/✗: bases elegibles, p ajustado bajo el nivel y diferencia de al menos el umbral. */
export function condicionesPar(par: ParDiferencias, grupos: readonly GrupoDiferencias[], regla: ReglaDiferencias): CondicionPar[] {
  const comparable = (l: string) => grupos.find((g) => g.letra === l)?.comparable ?? false;
  const elegible = par.veredicto !== "no_comparable" && comparable(par.a) && comparable(par.b);
  const significativa = par.p_ajustado !== null && par.p_ajustado < regla.alfa;
  const magnitud = par.dif !== null && Math.abs(par.dif) >= regla.umbral_puntos;
  return [
    { clave: "elegibilidad", rotulo: `bases de ${regla.base_minima} o más`, cumple: elegible },
    { clave: "significancia", rotulo: "significativa", cumple: elegible && significativa },
    { clave: "magnitud", rotulo: regla.umbral_puntos > 0 ? `${regla.umbral_puntos} pts o más` : "sin mínimo de puntos", cumple: elegible && magnitud },
  ];
}

// ---------- La nota que leerá el cliente ----------

export type LineaNota = { capsula: { letras: string; fragil: boolean } | null; texto: string };

/** `▲A  Mayor que…` (o `[▲A] …`) → cápsula ▲A + texto; `△A` es la frágil. Las demás líneas, texto solo. */
export function partirNota(nota: string): LineaNota[] {
  return nota.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((linea) => {
    const m = /^\[([▲△])\s*([^\]]*)\]\s*(.*)$/u.exec(linea) ?? /^([▲△])([A-Z]*)\s+(.*)$/u.exec(linea);
    if (!m) return { capsula: null, texto: linea };
    return { capsula: { letras: m[2].trim(), fragil: m[1] === "△" }, texto: m[3] };
  });
}

/** Las letras que dibuja la cápsula: «resto» (modo frente al resto) no se escribe, el ▲ ya lo dice. */
export const letrasDeCapsula = (b: string): string => (b === "resto" ? "" : b);

// ---------- Revisión en lote ----------

export type FiltroRevision = "todas" | "revisar" | "marcadas";

export const OPCIONES_FILTRO: readonly { clave: FiltroRevision; rotulo: string }[] = [
  { clave: "todas", rotulo: "Todas" },
  { clave: "revisar", rotulo: "Para revisar" },
  { clave: "marcadas", rotulo: "Marcadas" },
];

export function filtrarRevision<T extends ResultadoDiferencias>(laminas: readonly T[], filtro: FiltroRevision): T[] {
  if (filtro === "revisar") return laminas.filter((l) => l.revisar.length > 0 || l.estado === "error");
  if (filtro === "marcadas") return laminas.filter((l) => l.pares.some(esMarcado));
  return [...laminas];
}

export type TonoEstado = "marcada" | "fragil" | "neutro" | "aviso" | "peligro";

/** La columna «Estado» de la revisión: «3 marcadas», «1 frágil», «Ninguna», «2 grupos sin comparar», «No se marca». */
export function estadoRevision(lamina: ResultadoDiferencias): { rotulo: string; tono: TonoEstado } {
  const c = conteosLamina(lamina);
  if (lamina.estado === "error") return { rotulo: "Sin prueba", tono: "peligro" };
  if (lamina.estado === "abstencion") return { rotulo: "No se marca", tono: "peligro" };
  if (lamina.estado === "sin_cruce") return { rotulo: "Sin cruce", tono: "neutro" };
  if (c.marcadas > 0) {
    const firmes = c.marcadas - c.fragiles;
    if (firmes === 0) return { rotulo: c.fragiles === 1 ? "1 frágil" : `${c.fragiles} frágiles`, tono: "fragil" };
    return { rotulo: c.marcadas === 1 ? "1 marcada" : `${c.marcadas} marcadas`, tono: "marcada" };
  }
  if (c.noComparables > 0 && lamina.revisar.includes("base_chica")) {
    return { rotulo: c.noComparables === 1 ? "1 grupo sin comparar" : `${c.noComparables} grupos sin comparar`, tono: "aviso" };
  }
  if (c.bajoUmbral > 0) return { rotulo: `${c.bajoUmbral} bajo el umbral`, tono: "neutro" };
  return { rotulo: "Ninguna", tono: "neutro" };
}

const QUE_REVISAR: Readonly<Record<CodigoRevisar, (l: ResultadoDiferencias) => string>> = {
  titulo_afirma_fragil: () => "El título afirma una diferencia frágil: moderar",
  sin_diferencias: () => "El cruce no muestra diferencias: ¿quitarlo?",
  bajo_umbral: () => "Hay diferencias bajo el umbral: no se marcan",
  base_chica: (l) => {
    const chicos = l.grupos.filter((g) => !g.comparable).map((g) => (g.n !== null ? `${g.etiqueta} n = ${formatoConteo(g.n)}` : g.etiqueta));
    return chicos.length ? `Sin comparar: ${chicos.join(", ")}` : "Hay grupos con base chica";
  },
  sin_prueba: (l) => l.motivo ?? l.error?.message ?? "La prueba no se ejecutó",
};

/** «Qué revisar» de una lámina, una frase por código; un código desconocido se nombra tal cual. */
export function queRevisar(lamina: ResultadoDiferencias): string[] {
  const frases = lamina.revisar.map((c) => (c in QUE_REVISAR ? QUE_REVISAR[c as CodigoRevisar](lamina) : `Revisar: ${c}`));
  if (lamina.estado === "error" && !lamina.revisar.includes("sin_prueba")) frases.push(QUE_REVISAR.sin_prueba(lamina));
  return frases;
}

/**
 * Una fila de la revisión: una ranura con cruce (ADR 0128 «Familia por base»). `grafico` nombra la ranura cuando la
 * lámina tiene más de una («Gráfico 2: Barras agrupadas»); vacío si es la única. `clave` es única en la tabla.
 */
export type FilaRevision = { lamina: ResultadoDiferencias; posicion: number | null; titulo: string; grafico?: string; clave?: string };

const celdaCsv = (v: string | number | null): string => {
  const t = v === null ? "" : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** La revisión exportada: una fila por ranura con cruce, separada por comas y con comillas donde hace falta. */
export function csvRevision(filas: readonly FilaRevision[]): string {
  const cabecera = ["Lámina", "Título", "Gráfico", "Variable", "Cruce", "Estado", "Marcadas", "Frágiles", "Bajo el umbral", "Qué revisar"];
  const cuerpo = filas.map(({ lamina, posicion, titulo, grafico }) => {
    const c = conteosLamina(lamina);
    return [posicion, titulo, grafico ?? "", lamina.variable, lamina.cruce, estadoRevision(lamina).rotulo, c.marcadas, c.fragiles, c.bajoUmbral, queRevisar(lamina).join("; ")]
      .map(celdaCsv).join(",");
  });
  return [cabecera.map(celdaCsv).join(","), ...cuerpo].join("\n");
}

// ---------- Qué cambia el resultado de una lámina ----------

type SlotConArgs = { graficador?: unknown; args?: unknown } | null | undefined;

/**
 * Huella de lo que decide las diferencias de una lámina (ADR 0128 §5 es por lámina, no por gráfico): pregunta, cruce e
 * interruptor de cada ranura. El inspector y «Por qué» la comparten para no pedir dos veces lo mismo.
 */
export function claveDiferencias(slots: readonly SlotConArgs[]): string {
  return JSON.stringify(slots.map((s) => {
    const a = (s && typeof s.args === "object" && s.args ? s.args : {}) as Record<string, unknown>;
    return [s?.graficador ?? null, a.var ?? null, a.cruces ?? a.cruce ?? null, a.mostrar_significancia ?? null];
  }));
}

/** El arg que divide en grupos: `cruces` en las barras, `cruce` en la serie temporal (graficos_metadata.R). */
export function argDeCruce(nombres: readonly string[]): "cruces" | "cruce" | null {
  return nombres.includes("cruces") ? "cruces" : nombres.includes("cruce") ? "cruce" : null;
}

/** El valor del cruce como texto: una lista toma su primer elemento; nada, vacío. */
export function valorDeCruce(v: unknown): string {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" ? x.trim() : "";
}
