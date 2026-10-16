/**
 * Modelo de la armonización entre mediciones (contrato E4-E7, R3).
 *
 * Una serie de mediciones pregunta lo mismo con otra lista: en una base
 * «Hombre homosexual [1]» y «Mujer lesbiana [2]» son dos opciones y en otra son
 * una sola. La fila de la matriz de equivalencias declara una escala común y,
 * por base, si es comparable y a qué código de la escala cae cada código suyo.
 *
 * Reglas del motor que este modelo reproduce para que el editor diga lo mismo
 * que el backend antes de guardar (`api/R/equivalencias_armonizacion.R`):
 *   - mapa vacío es identidad: el código de la base ES el de la escala;
 *   - con mapa, un código que el mapa no nombra queda sin destino;
 *   - una base sin entrada o con `comparable = false` no se armoniza: declarar
 *     es obligatorio y no se presume comparable.
 *
 * Lógica pura: el componente sólo pinta lo que este módulo decide.
 */

import type {
  AdvertenciaBloques,
  Armonizacion,
  ArmonizacionBase,
  CategoriaEscalaComun,
  EquivalenciaFila,
  TipoAdvertenciaBloques,
} from "../../api/equivalencias";
import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { etiquetaTolerante, etiquetasAmbiguas, indicePorEtiqueta } from "./etiquetaTolerante";
import { ordenPorDefectoDeSerie, type NombreDeSerie } from "./nombreDeSerie";

// ---- Paneles direccionables -------------------------------------------------

/**
 * Editor de armonización de una fila. `?panel=armonizacion&foco=<ref>`, donde
 * `ref` es el `id` del bloque o el índice de la fila en la declaración guardada.
 */
export const PANEL_ARMONIZACION: PanelDeclarado = {
  id: "armonizacion",
  label: "Armonizar una pregunta",
  clase: "sideover",
};

/** Editar el orden de la serie de mediciones (M7: la vista lo resume en una línea). */
export const PANEL_ORDEN_SERIE: PanelDeclarado = {
  id: "orden-serie",
  label: "Orden de la serie",
  clase: "sideover",
};

/** Traer la matriz por bloques de una serie de mediciones (ADR 0104: sólo series). */
export const PANEL_IMPORTAR_BLOQUES: PanelDeclarado = {
  id: "importar-bloques",
  label: "Traer una serie de mediciones ya armada",
  clase: "dialogo",
};

// ---- Indicador por fila -----------------------------------------------------

export type EstadoArmonizacion =
  | { tipo: "sin_armonizar"; texto: string }
  | { tipo: "armonizada"; texto: string }
  | { tipo: "no_comparable"; texto: string; bases: string[] };

/** «a», «a y b», «a, b y c». */
export function listarEnPalabras(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * Estado de la fila para su indicador. Sólo cuentan las bases donde la fila
 * tiene variable: una base sin la pregunta no tiene nada que armonizar.
 */
export function estadoArmonizacion(
  fila: Pick<EquivalenciaFila, "armonizacion" | "variables">,
): EstadoArmonizacion {
  const arm = fila.armonizacion;
  if (!arm || arm.escala.length === 0) {
    return { tipo: "sin_armonizar", texto: "Sin armonizar" };
  }
  const conVariable = Object.keys(fila.variables).filter((b) => fila.variables[b]);
  const noComparables = conVariable.filter((b) => arm.por_base[b]?.comparable !== true);
  if (noComparables.length > 0) {
    // El chip dice cuántas y el `title` las nombra: con cualquier cantidad de
    // bases y cualquier largo de nombre, el chip cabe y no esconde nada tras
    // una elipsis.
    return {
      tipo: "no_comparable",
      texto: `No comparable en ${noComparables.length} ${noComparables.length === 1 ? "base" : "bases"}`,
      bases: noComparables,
    };
  }
  return { tipo: "armonizada", texto: "Armonizada" };
}

/**
 * Qué significa el estado del chip, en palabras llanas. Va como descripción del
 * botón (su `title`), así el lector de pantalla la anuncia tras el nombre y el
 * puntero la muestra al pasar.
 */
export function explicacionArmonizacion(estado: EstadoArmonizacion, serie: NombreDeSerie): string {
  switch (estado.tipo) {
    case "armonizada":
      return `Las respuestas de esta pregunta están puestas en una misma escala en todas las bases donde existe. Entra a los comparativos entre ${serie.plural}.`;
    case "sin_armonizar":
      return `Esta pregunta todavía no tiene una escala común. Sin ella no se puede comparar entre ${serie.plural} ni entra a los comparativos.`;
    case "no_comparable":
      return `No comparable en ${listarEnPalabras(estado.bases)}. Ahí la pregunta se marcó como no comparable o falta decidirlo, y sale como no comparable en los comparativos.`;
  }
}

/**
 * La escala común de una fila armonizada, en una línea: «Primer año · 1 a 2
 * años · …». Va bajo el estado para que se vea CÓMO quedó armonizada sin abrir
 * el editor: «Año de ingreso» armonizada como tramos de antigüedad decía sólo
 * «Armonizada» y se leía como si comparara años (2026-10-16).
 */
export function resumenDeEscala(fila: { armonizacion?: Armonizacion | null }): string {
  const escala = fila.armonizacion?.escala ?? [];
  return escala.map((o) => o.etiqueta.trim() || o.codigo).join(" · ");
}

/** Estado de cada base dentro del borrador, para el índice del editor. */
export type EstadoBaseBorrador = "comparable" | "no-comparable" | "sin-declarar";

export function estadoDeBase(entrada: EntradaBorrador | undefined): EstadoBaseBorrador {
  if (!entrada || entrada.comparable === null) return "sin-declarar";
  return entrada.comparable ? "comparable" : "no-comparable";
}

export const TEXTO_ESTADO_BASE: Record<EstadoBaseBorrador, string> = {
  comparable: "comparable",
  "no-comparable": "no comparable",
  "sin-declarar": "sin decidir",
};

// ---- Referencia de la fila (foco) -------------------------------------------

/** El `foco` que abre el editor sobre una fila guardada. */
export function focoDeFila(fila: { id_declarado?: string; indice_declarado?: number }): string | null {
  if (fila.id_declarado) return fila.id_declarado;
  if (typeof fila.indice_declarado === "number") return String(fila.indice_declarado);
  return null;
}

/**
 * Índice en la declaración guardada que nombra el foco. Primero por `id` del
 * bloque —un id puede ser numérico y no debe leerse como posición—, después
 * por posición.
 */
export function indiceDeFoco(
  filas: readonly Pick<EquivalenciaFila, "id">[],
  foco: string | null,
): number | null {
  if (!foco) return null;
  const porId = filas.findIndex((f) => f.id === foco);
  if (porId >= 0) return porId;
  if (/^\d+$/.test(foco)) {
    const i = Number(foco);
    return i < filas.length ? i : null;
  }
  return null;
}

// ---- Borrador ---------------------------------------------------------------

export type CategoriaBorrador = CategoriaEscalaComun & {
  /** Identidad local estable: el código cambia al editarse. */
  clave: string;
};

export type EntradaBorrador = {
  /** `null` = sin declarar. No se presume comparable. */
  comparable: boolean | null;
  nota: string;
  mapa: Record<string, string>;
};

/**
 * Textos de la fila que imprime el comparativo: el enunciado de la tabla y la
 * línea «Base: …» bajo ella. Vacío = el informe usa el nombre estándar y una
 * base calculada por el motor.
 */
export type TextosInforme = { enunciado: string; baseTexto: string };

export type BorradorArmonizacion = {
  escala: CategoriaBorrador[];
  porBase: Record<string, EntradaBorrador>;
  siguiente: number;
  textos: TextosInforme;
};

export function borradorDesde(
  arm: Armonizacion | null | undefined,
  bases: readonly string[],
  fila?: Pick<EquivalenciaFila, "enunciado" | "base_texto">,
): BorradorArmonizacion {
  const escala = (arm?.escala ?? []).map((c, i) => ({ ...c, clave: `c${i + 1}` }));
  const porBase: Record<string, EntradaBorrador> = {};
  for (const base of bases) {
    const e = arm?.por_base[base];
    porBase[base] = e
      ? { comparable: e.comparable, nota: e.nota ?? "", mapa: { ...e.mapa } }
      : { comparable: null, nota: "", mapa: {} };
  }
  const textos = { enunciado: fila?.enunciado ?? "", baseTexto: fila?.base_texto ?? "" };
  return { escala, porBase, siguiente: escala.length + 1, textos };
}

/** Siguiente código numérico libre de la escala. */
export function siguienteCodigoEscala(escala: readonly CategoriaEscalaComun[]): string {
  const numeros = escala.map((c) => Number(c.codigo)).filter((n) => Number.isInteger(n) && n < 80);
  return String((numeros.length ? Math.max(...numeros) : 0) + 1);
}

export type AccionArmonizacion =
  | { tipo: "agregar"; codigo?: string; etiqueta?: string }
  | { tipo: "quitar"; clave: string }
  | { tipo: "mover"; clave: string; delta: -1 | 1 }
  | { tipo: "codigo"; clave: string; valor: string }
  | { tipo: "etiqueta"; clave: string; valor: string }
  | { tipo: "comparable"; base: string; valor: boolean | null }
  | { tipo: "nota"; base: string; valor: string }
  | {
    tipo: "destino";
    base: string;
    codigo: string;
    destino: string | null;
    /** Códigos de la base que se conocen: hacen falta para materializar la identidad. */
    conocidos: readonly string[];
  }
  | {
    /** F2: varios códigos de la base a la misma categoría (o a «sin mapa») de una vez. */
    tipo: "destinos";
    base: string;
    codigos: readonly string[];
    destino: string | null;
    conocidos: readonly string[];
  }
  | { tipo: "texto"; campo: keyof TextosInforme; valor: string }
  | { tipo: "sembrar"; opciones: readonly CategoriaEscalaComun[] }
  | { tipo: "emparejar"; base: string; opciones: readonly CategoriaEscalaComun[] };

function conEntrada(
  b: BorradorArmonizacion,
  base: string,
  f: (e: EntradaBorrador) => EntradaBorrador,
): BorradorArmonizacion {
  const actual = b.porBase[base] ?? { comparable: null, nota: "", mapa: {} };
  return { ...b, porBase: { ...b.porBase, [base]: f(actual) } };
}

/** Reescribe un código de la escala en todos los mapas que lo usan. */
function renombrarEnMapas(
  porBase: Record<string, EntradaBorrador>,
  de: string,
  a: string | null,
): Record<string, EntradaBorrador> {
  const out: Record<string, EntradaBorrador> = {};
  for (const [base, e] of Object.entries(porBase)) {
    const mapa: Record<string, string> = {};
    for (const [origen, destino] of Object.entries(e.mapa)) {
      if (destino !== de) mapa[origen] = destino;
      else if (a) mapa[origen] = a;
    }
    out[base] = { ...e, mapa };
  }
  return out;
}

/**
 * La misma etiqueta tolerante que la escala compartida y los segmentos de
 * cruce: «18–20 años» y «18-20 años» casan; ver `etiquetaTolerante.ts`.
 */
export function normalizarEtiqueta(s: string): string {
  return etiquetaTolerante(s);
}

/**
 * Destino de un código de la base según el borrador, con las reglas del motor.
 * `null` es «sin mapa».
 */
export function destinoDe(
  entrada: EntradaBorrador | undefined,
  escala: readonly CategoriaEscalaComun[],
  codigo: string,
): string | null {
  if (!entrada || entrada.comparable !== true) return null;
  if (mapaExplicito(entrada)) return entrada.mapa[codigo] || null;
  return escala.some((c) => c.codigo === codigo) ? codigo : null;
}

/** Un mapa sin ningún destino es identidad para el motor, igual que vacío. */
export function mapaExplicito(entrada: EntradaBorrador | undefined): boolean {
  return Object.values(entrada?.mapa ?? {}).some(Boolean);
}

export function reducirArmonizacion(
  b: BorradorArmonizacion,
  a: AccionArmonizacion,
): BorradorArmonizacion {
  switch (a.tipo) {
    case "agregar": {
      const codigo = a.codigo ?? siguienteCodigoEscala(b.escala);
      return {
        ...b,
        escala: [...b.escala, { clave: `c${b.siguiente}`, codigo, etiqueta: a.etiqueta ?? "" }],
        siguiente: b.siguiente + 1,
      };
    }
    case "quitar": {
      const cat = b.escala.find((c) => c.clave === a.clave);
      if (!cat) return b;
      return {
        ...b,
        escala: b.escala.filter((c) => c.clave !== a.clave),
        porBase: renombrarEnMapas(b.porBase, cat.codigo, null),
      };
    }
    case "mover": {
      const i = b.escala.findIndex((c) => c.clave === a.clave);
      const j = i + a.delta;
      if (i < 0 || j < 0 || j >= b.escala.length) return b;
      const escala = b.escala.slice();
      [escala[i], escala[j]] = [escala[j], escala[i]];
      return { ...b, escala };
    }
    case "codigo": {
      const cat = b.escala.find((c) => c.clave === a.clave);
      if (!cat) return b;
      const valor = a.valor.trim();
      return {
        ...b,
        escala: b.escala.map((c) => (c.clave === a.clave ? { ...c, codigo: valor } : c)),
        porBase: renombrarEnMapas(b.porBase, cat.codigo, valor || null),
      };
    }
    case "etiqueta":
      return {
        ...b,
        escala: b.escala.map((c) => (c.clave === a.clave ? { ...c, etiqueta: a.valor } : c)),
      };
    case "comparable":
      return conEntrada(b, a.base, (e) => ({ ...e, comparable: a.valor }));
    case "nota":
      return conEntrada(b, a.base, (e) => ({ ...e, nota: a.valor }));
    case "destino":
      return asignarDestinos(b, a.base, [a.codigo], a.destino, a.conocidos);
    case "destinos":
      if (a.codigos.length === 0) return b;
      return asignarDestinos(b, a.base, a.codigos, a.destino, a.conocidos);
    case "texto":
      return { ...b, textos: { ...b.textos, [a.campo]: a.valor } };
    case "sembrar": {
      if (b.escala.length > 0) return b;
      const escala = a.opciones.map((o, i) => ({
        clave: `c${b.siguiente + i}`,
        codigo: o.codigo,
        etiqueta: o.etiqueta,
      }));
      return { ...b, escala, siguiente: b.siguiente + escala.length };
    }
    case "emparejar":
      // La guía de la matriz manda recodificar POR ETIQUETA. Esto propone ese
      // emparejamiento y deja intacto lo que no casa: no inventa destinos.
      return conEntrada(b, a.base, (e) => {
        // Ambigüedad en los dos lados: si dos códigos de la escala, o dos de la
        // base, dicen lo mismo, ninguno se empareja por esa etiqueta.
        const porEtiqueta = indicePorEtiqueta(b.escala);
        const ambiguas = etiquetasAmbiguas(a.opciones);
        const mapa: Record<string, string> = {};
        for (const [origen, destino] of Object.entries(e.mapa)) if (destino) mapa[origen] = destino;
        for (const o of a.opciones) {
          const clave = normalizarEtiqueta(o.etiqueta);
          if (ambiguas.has(clave)) continue;
          const destino = porEtiqueta.get(clave);
          if (destino && !mapa[o.codigo]) mapa[o.codigo] = destino;
        }
        return { ...e, comparable: e.comparable ?? true, mapa };
      });
  }
}

/**
 * Lleva códigos de una base a un destino. Con el mapa vacío la identidad está
 * implícita: editar UNOS códigos la rompería para todos los demás —pasarían a
 * «sin mapa» sin que nadie lo pidiera—, así que antes se escribe la identidad
 * que ya regía.
 */
function asignarDestinos(
  b: BorradorArmonizacion,
  base: string,
  codigos: readonly string[],
  destino: string | null,
  conocidos: readonly string[],
): BorradorArmonizacion {
  return conEntrada(b, base, (e) => {
    const mapa = { ...e.mapa };
    if (!mapaExplicito(e)) {
      for (const cod of conocidos) {
        if (b.escala.some((c) => c.codigo === cod)) mapa[cod] = cod;
      }
    }
    for (const codigo of codigos) {
      if (destino) mapa[codigo] = destino;
      else delete mapa[codigo];
    }
    return { ...e, comparable: e.comparable ?? true, mapa };
  });
}

const CODIGO_RE = /^[A-Za-z0-9_.-]+$/;

/** Lo que el backend rechazaría, dicho antes de guardar. */
export function validarArmonizacion(b: BorradorArmonizacion): string[] {
  const errores: string[] = [];
  const vistos = new Set<string>();
  b.escala.forEach((c, i) => {
    if (!c.codigo) errores.push(`La categoría ${i + 1} de la escala no tiene código.`);
    else if (!CODIGO_RE.test(c.codigo)) errores.push(`El código «${c.codigo}» lleva espacios o símbolos.`);
    else if (vistos.has(c.codigo)) errores.push(`El código «${c.codigo}» se repite en la escala.`);
    vistos.add(c.codigo);
  });
  return errores;
}

/** Borrador a la forma del contrato. `null` borra la armonización de la fila. */
export function aArmonizacion(b: BorradorArmonizacion): Armonizacion | null {
  const escala = b.escala
    .filter((c) => c.codigo)
    .map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta.trim() || c.codigo }));
  const codigos = new Set(escala.map((c) => c.codigo));
  const por_base: Record<string, ArmonizacionBase> = {};
  for (const [base, e] of Object.entries(b.porBase)) {
    if (e.comparable === null) continue;
    const mapa: Record<string, string> = {};
    for (const [origen, destino] of Object.entries(e.mapa)) {
      if (destino && codigos.has(destino)) mapa[origen] = destino;
    }
    const nota = e.nota.trim();
    por_base[base] = { comparable: e.comparable, ...(nota ? { nota } : {}), mapa };
  }
  if (escala.length === 0 && Object.keys(por_base).length === 0) return null;
  return { escala, por_base };
}

/**
 * La declaración guardada con UNA fila reemplazada en su armonización. Las demás
 * filas viajan como estaban en el servidor: guardar la armonización no puede
 * arrastrar ediciones sin guardar de otras filas.
 */
export function filasConArmonizacion(
  guardadas: readonly EquivalenciaFila[],
  indice: number,
  arm: Armonizacion | null,
  textos?: TextosInforme,
): EquivalenciaFila[] {
  return guardadas.map((f, i) => {
    if (i !== indice) return f;
    const fila: EquivalenciaFila = { ...f, armonizacion: arm };
    if (textos) {
      aplicarTexto(fila, "enunciado", textos.enunciado);
      aplicarTexto(fila, "base_texto", textos.baseTexto);
    }
    return fila;
  });
}

/**
 * Un texto vacío borra el campo. Si la fila ya lo traía viaja como `""` para
 * que el guardado lo quite y no lo conserve por ausencia.
 */
function aplicarTexto(fila: EquivalenciaFila, campo: "enunciado" | "base_texto", valor: string) {
  const limpio = valor.trim();
  if (limpio) fila[campo] = limpio;
  else if (fila[campo]) fila[campo] = "";
  else delete fila[campo];
}

// ---- Tabla de mapeo por base -------------------------------------------------

export type FilaMapa = {
  codigo: string;
  etiqueta: string | null;
  /** `null` cuando no hay conteo (la base todavía no tiene armonización guardada). */
  n: number | null;
  destino: string | null;
  sinMapa: boolean;
  /** Etiqueta de la categoría de la escala a la que cae, si cae en alguna. */
  etiquetaDestino: string | null;
  /**
   * Cae en una categoría cuya etiqueta no es la suya. Pasa sobre todo con la
   * identidad: el código 3 de la base cae en el 3 de la escala aunque uno diga
   * «Prefiero no responder» y el otro «Otro». La regla de la matriz es
   * emparejar por etiqueta, así que esto se avisa y no se da por bueno.
   */
  etiquetaDistinta: boolean;
  /** Comparte destino con otros códigos de la base: agrupación deliberada (F3). */
  agrupado: boolean;
};

export function filasDeMapa(
  codigos: readonly { codigo: string; etiqueta: string | null; n: number | null }[],
  entrada: EntradaBorrador | undefined,
  escala: readonly CategoriaEscalaComun[],
): FilaMapa[] {
  const destinos = codigos.map((c) => destinoDe(entrada, escala, c.codigo));
  const porDestino = new Map<string, number>();
  for (const d of destinos) if (d !== null) porDestino.set(d, (porDestino.get(d) ?? 0) + 1);
  return codigos.map((c, i) => {
    const destino = destinos[i];
    const etiquetaDestino = destino === null
      ? null
      : escala.find((e) => e.codigo === destino)?.etiqueta ?? null;
    // F3: varios códigos en el mismo destino son una agrupación deliberada
    // (26 departamentos → «Provincias»): ahí la etiqueta difiere por diseño y
    // no se acusa. Sólo un destino 1:1 con otra etiqueta es sospechoso.
    const agrupado = destino !== null && (porDestino.get(destino) ?? 0) > 1;
    // Sin etiqueta en la base no hay con qué comparar: no se acusa.
    const etiquetaDistinta = Boolean(
      !agrupado
        && c.etiqueta
        && etiquetaDestino
        && normalizarEtiqueta(c.etiqueta) !== normalizarEtiqueta(etiquetaDestino),
    );
    return { ...c, destino, sinMapa: destino === null, etiquetaDestino, etiquetaDistinta, agrupado };
  });
}

export type ResumenMapa = {
  sinMapa: number;
  casosSinMapa: number;
  etiquetaDistinta: number;
  /** Códigos que comparten destino con otros, y en cuántas categorías caen. */
  agrupados?: number;
  categoriasAgrupadas?: number;
};

export function resumenMapa(filas: readonly FilaMapa[]): ResumenMapa {
  const base = filas.reduce(
    (acc, f) => ({
      sinMapa: acc.sinMapa + (f.sinMapa ? 1 : 0),
      casosSinMapa: acc.casosSinMapa + (f.sinMapa ? f.n ?? 0 : 0),
      etiquetaDistinta: acc.etiquetaDistinta + (f.etiquetaDistinta ? 1 : 0),
    }),
    { sinMapa: 0, casosSinMapa: 0, etiquetaDistinta: 0 },
  );
  const agrupadas = filas.filter((f) => f.agrupado);
  if (agrupadas.length === 0) return base;
  return {
    ...base,
    agrupados: agrupadas.length,
    categoriasAgrupadas: new Set(agrupadas.map((f) => f.destino)).size,
  };
}

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? `1 ${uno}` : `${n} ${varios}`;
}

/**
 * Resumen de la tabla de una base. «Todos tienen destino» sólo se dice si
 * además todos caen en una categoría con su misma etiqueta: un destino por
 * número con otra etiqueta no es un destino resuelto.
 */
/**
 * ¿El resumen es un aviso? Un código sin mapa que no pierde casos (el «0
 * Selecciona una respuesta» de Kobo, contado en 0) se informa, pero no alarma.
 * Sin conteos todavía no se sabe y sí avisa.
 */
export function resumenEsAviso(r: ResumenMapa, conConteos: boolean): boolean {
  if (r.etiquetaDistinta > 0) return true;
  return r.sinMapa > 0 && (!conConteos || r.casosSinMapa > 0);
}

export function textoResumenMapa(r: ResumenMapa, explicito: boolean): string {
  const partes: string[] = [];
  if (r.sinMapa > 0) {
    partes.push(
      `${plural(r.sinMapa, "código sin mapa", "códigos sin mapa")}${r.casosSinMapa ? ` con ${r.casosSinMapa} casos` : ""}.`,
    );
  }
  if (r.etiquetaDistinta > 0) {
    partes.push(`${plural(r.etiquetaDistinta, "código con etiqueta distinta", "códigos con etiqueta distinta")} a la de su destino.`);
  }
  if (r.agrupados) {
    partes.push(`${r.agrupados} códigos agrupados en ${plural(r.categoriasAgrupadas ?? 0, "categoría", "categorías")}.`);
  }
  if (partes.length === 0) partes.push("Todos los códigos caen en una categoría con su misma etiqueta.");
  if (!explicito) partes.push("Sin mapa explícito cada código cae en el código igual de la escala.");
  return partes.join(" ");
}

// ---- Orden de la serie --------------------------------------------------------

/**
 * Orden efectivo de la serie: lo declarado que sigue siendo una base del
 * estudio, y al final las bases que el orden todavía no nombra. Sin nada
 * declarado, el orden por defecto (`ordenPorDefectoDeSerie`): cronológico si
 * todas las bases nombran un año.
 */
export function ordenEfectivo(periodos: readonly string[], bases: readonly string[]): string[] {
  const set = new Set(bases);
  const declarados = periodos.filter((p, i) => set.has(p) && periodos.indexOf(p) === i);
  if (declarados.length === 0) return ordenPorDefectoDeSerie(bases);
  return [...declarados, ...bases.filter((b) => !declarados.includes(b))];
}

/**
 * Resumen de una línea del orden de la serie: «b2024 → b2025 → … → posgrado».
 * Con pocas bases se nombran todas; con más, las primeras y la última, y el
 * resto se cuenta. La misma forma con 3 bases que con 20.
 */
export function resumenOrdenSerie(orden: readonly string[], maxVisibles = 4): string {
  if (orden.length <= maxVisibles) return orden.join(" → ");
  const cabeza = orden.slice(0, Math.max(1, maxVisibles - 1));
  const ocultas = orden.length - cabeza.length - 1;
  return `${cabeza.join(" → ")} → … (${ocultas} más) → ${orden[orden.length - 1]}`;
}

export function moverEnLista<T>(lista: readonly T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (i < 0 || i >= lista.length || j < 0 || j >= lista.length) return lista.slice();
  const out = lista.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function mismoOrden(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// ---- Importar por bloques -------------------------------------------------------

export const ETIQUETA_ADVERTENCIA: Record<TipoAdvertenciaBloques, string> = {
  variable_pendiente: "Variable pendiente",
  variable_no_unica: "Más de una variable en la celda",
  variable_inexistente: "Variable que la base no tiene",
  sin_instrumento: "Base sin instrumento",
  sin_codigos: "Categorías sin código",
  sin_variables: "Bloque sin variables",
  fusion: "Categorías fusionadas",
  codigo_inexistente: "Código que la lista no tiene",
  etiqueta_distinta: "Etiqueta distinta a la de la lista",
  codigo_sin_mapa: "Código de la base sin destino",
  sin_lista: "Variable sin lista de opciones",
  otro: "Otras advertencias",
};

export type GrupoAdvertencias = {
  tipo: TipoAdvertenciaBloques;
  etiqueta: string;
  n: number;
  items: AdvertenciaBloques[];
};

/** Agrupa por tipo, de mayor a menor, para leer primero lo que más pesa. */
export function agruparAdvertencias(advs: readonly AdvertenciaBloques[]): GrupoAdvertencias[] {
  const grupos = new Map<TipoAdvertenciaBloques, AdvertenciaBloques[]>();
  for (const a of advs) {
    const lista = grupos.get(a.tipo) ?? [];
    lista.push(a);
    grupos.set(a.tipo, lista);
  }
  return [...grupos.entries()]
    .map(([tipo, items]) => ({ tipo, etiqueta: ETIQUETA_ADVERTENCIA[tipo], n: items.length, items }))
    .sort((x, y) => y.n - x.n || x.etiqueta.localeCompare(y.etiqueta, "es"));
}

/**
 * Propuesta inicial año → base: la base cuyo nombre contiene el año. Un año sin
 * base que lo nombre queda sin asignar, y una base no se propone dos veces.
 */
export function mapaPeriodosInicial(
  anios: readonly string[],
  bases: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const usadas = new Set<string>();
  for (const anio of anios) {
    const base = bases.find((b) => b.includes(anio) && !usadas.has(b));
    out[anio] = base ?? "";
    if (base) usadas.add(base);
  }
  return out;
}

export function mapaPeriodosValido(mapa: Record<string, string>): { ok: boolean; motivo: string } {
  const asignadas = Object.values(mapa).filter(Boolean);
  if (asignadas.length === 0) return { ok: false, motivo: "Asigna al menos una columna a una base." };
  if (new Set(asignadas).size !== asignadas.length) {
    return { ok: false, motivo: "Dos columnas apuntan a la misma base." };
  }
  return { ok: true, motivo: "" };
}

/** Sólo los años asignados: el backend ignora los demás, pero no los quiere vacíos. */
export function mapaPeriodosParaEnviar(mapa: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(mapa).filter(([, b]) => Boolean(b)));
}
