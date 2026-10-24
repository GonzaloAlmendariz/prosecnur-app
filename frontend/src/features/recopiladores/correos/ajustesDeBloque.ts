// =============================================================================
// ajustesDeBloque.ts — estilos por bloque, sólo enumeraciones cerradas (E1g §1)
// =============================================================================
// Espejo de `.CMAIL_STYLE_ENUMS` (collection_mail_styles.R) con los rótulos en
// la voz de la vista. Nunca hay CSS libre: cada ajuste ofrece una lista fija
// de valores y el render traduce cada uno a su estilo inline. El valor por
// defecto es el que usa el render cuando la clave falta.

import { MAIL_ICONS, isOpaqueMailBlock, type MailBlock, type MailTheme } from "../../../api/materialMail";
import { ROTULO_DE_ICONO } from "./piezasGraficas";

export type OpcionDeAjuste = { valor: string; rotulo: string; ayuda?: string };

export type Ajuste = {
  clave: string;
  rotulo: string;
  opciones: readonly OpcionDeAjuste[];
  defecto: string;
};

const IZQUIERDA: OpcionDeAjuste = { valor: "left", rotulo: "Izquierda" };
const CENTRADO: OpcionDeAjuste = { valor: "center", rotulo: "Centrado" };
const DERECHA: OpcionDeAjuste = { valor: "right", rotulo: "Derecha" };
const JUSTIFICADO: OpcionDeAjuste = { valor: "justify", rotulo: "Justificado" };

/** El orden clásico de los editores de texto. El título y el botón no se justifican. */
const ALINEACION_PARRAFO: readonly OpcionDeAjuste[] = [IZQUIERDA, CENTRADO, DERECHA, JUSTIFICADO];
const ALINEACION_SIN_JUSTIFICAR: readonly OpcionDeAjuste[] = [IZQUIERDA, CENTRADO, DERECHA];

export const AJUSTES_POR_TIPO: Partial<Record<MailBlock["type"], readonly Ajuste[]>> = {
  paragraph: [
    // Sin tema a mano, el defecto es el del render (justificado); con tema, `heredadoDe` manda.
    { clave: "align", rotulo: "Alineación", opciones: ALINEACION_PARRAFO, defecto: "justify" },
    {
      clave: "size",
      rotulo: "Tamaño",
      opciones: [
        { valor: "pequeno", rotulo: "Pequeño", ayuda: "13 px, para notas" },
        { valor: "normal", rotulo: "Normal", ayuda: "16 px" },
        { valor: "grande", rotulo: "Grande", ayuda: "18 px" },
        { valor: "muy_grande", rotulo: "Muy grande", ayuda: "21 px" },
      ],
      defecto: "normal",
    },
    {
      clave: "tone",
      rotulo: "Tono",
      opciones: [
        { valor: "normal", rotulo: "Normal" },
        { valor: "suave", rotulo: "Suave", ayuda: "gris, para lo secundario" },
        { valor: "acento", rotulo: "Acento", ayuda: "el color del correo" },
      ],
      defecto: "normal",
    },
  ],
  heading: [
    {
      clave: "level",
      rotulo: "Nivel",
      opciones: [
        { valor: "titulo", rotulo: "Título", ayuda: "22 px" },
        { valor: "subtitulo", rotulo: "Subtítulo", ayuda: "17 px" },
      ],
      defecto: "titulo",
    },
    { clave: "align", rotulo: "Alineación", opciones: ALINEACION_SIN_JUSTIFICAR, defecto: "left" },
  ],
  button: [
    {
      clave: "fill",
      rotulo: "Relleno",
      opciones: [
        { valor: "solido", rotulo: "Sólido", ayuda: "texto blanco sobre el acento" },
        { valor: "contorno", rotulo: "Contorno", ayuda: "borde y texto en el acento" },
      ],
      defecto: "solido",
    },
    {
      clave: "size",
      rotulo: "Tamaño",
      opciones: [
        { valor: "compacto", rotulo: "Compacto" },
        { valor: "normal", rotulo: "Normal" },
        { valor: "grande", rotulo: "Grande" },
      ],
      defecto: "normal",
    },
    { clave: "align", rotulo: "Alineación", opciones: ALINEACION_SIN_JUSTIFICAR, defecto: "center" },
  ],
  callout: [
    {
      clave: "variant",
      rotulo: "Estilo",
      opciones: [
        { valor: "box", rotulo: "Borde fino" },
        { valor: "bar", rotulo: "Franja lateral" },
        { valor: "tinte", rotulo: "Tinte", ayuda: "fondo del acento muy claro" },
      ],
      defecto: "box",
    },
  ],
  list: [
    {
      clave: "ordered",
      rotulo: "Tipo",
      opciones: [
        { valor: "no", rotulo: "Viñetas" },
        { valor: "si", rotulo: "Numerada" },
      ],
      defecto: "no",
    },
  ],
  divider: [
    {
      clave: "style",
      rotulo: "Forma",
      opciones: [
        { valor: "linea", rotulo: "Línea" },
        { valor: "espacio", rotulo: "Espacio" },
      ],
      defecto: "linea",
    },
    {
      clave: "size",
      rotulo: "Aire",
      opciones: [
        { valor: "s", rotulo: "Poco" },
        { valor: "m", rotulo: "Medio" },
        { valor: "l", rotulo: "Mucho" },
      ],
      defecto: "m",
    },
  ],
  image: [
    {
      clave: "align",
      rotulo: "Alineación",
      opciones: [
        { valor: "left", rotulo: "Izquierda" },
        { valor: "center", rotulo: "Centrado" },
        { valor: "right", rotulo: "Derecha" },
      ],
      defecto: "center",
    },
  ],
  // Piezas gráficas (E1o). El color no es una enumeración: va por `conColor` (piezasGraficas.ts).
  band: [
    {
      clave: "height",
      rotulo: "Alto",
      opciones: [
        { valor: "s", rotulo: "Fina", ayuda: "8 px" },
        { valor: "m", rotulo: "Media", ayuda: "16 px" },
        { valor: "l", rotulo: "Gruesa", ayuda: "32 px" },
      ],
      defecto: "m",
    },
  ],
  ornament: [
    {
      clave: "style",
      rotulo: "Forma",
      opciones: [
        { valor: "onda", rotulo: "Onda" },
        { valor: "puntos", rotulo: "Puntos" },
        { valor: "linea_doble", rotulo: "Línea doble" },
      ],
      defecto: "onda",
    },
  ],
  // El ícono se elige en una cuadrícula visual (SelectorDeIcono), no en un segmentado.
  icon_text: [
    {
      clave: "icon",
      rotulo: "Ícono",
      opciones: MAIL_ICONS.map((icon) => ({ valor: icon, rotulo: ROTULO_DE_ICONO[icon] })),
      defecto: "calendario",
    },
  ],
  // Sección Destacado (collection_mail_destacado.R): dónde va la foto.
  feature: [
    {
      clave: "layout",
      rotulo: "Imagen",
      opciones: [
        { valor: "izquierda", rotulo: "Izquierda" },
        { valor: "derecha", rotulo: "Derecha" },
        { valor: "arriba", rotulo: "Arriba", ayuda: "a todo el ancho" },
      ],
      defecto: "izquierda",
    },
  ],
};

/** Ajustes que no se muestran como segmentado: tienen su propio control. */
export const AJUSTES_CON_CONTROL_PROPIO: ReadonlySet<string> = new Set(["icon"]);

export function ajustesDe(block: MailBlock): readonly Ajuste[] {
  if (isOpaqueMailBlock(block)) return [];
  return AJUSTES_POR_TIPO[block.type] ?? [];
}

/** Lo que el render aplica cuando el bloque no fija el ajuste. */
export type Herencia = { valor: string; deIdentidad: boolean };

type TemaDeAlineacion = Pick<MailTheme, "text_align"> | null | undefined;

/**
 * La alineación que hereda un bloque sin `align` propio, espejo de
 * collection_mail_campana.R: el párrafo sigue Identidad › Alineación
 * (justificado por defecto), el título va centrado sólo si Identidad centra y
 * el botón va centrado siempre (eso no sale de Identidad). Los demás ajustes no
 * heredan: su ausencia es el `defecto` del render.
 */
export function heredadoDe(block: MailBlock, ajuste: Ajuste, theme?: TemaDeAlineacion): Herencia | null {
  if (ajuste.clave !== "align" || isOpaqueMailBlock(block)) return null;
  const identidad = theme?.text_align ?? "justify";
  if (block.type === "paragraph") return { valor: identidad, deIdentidad: true };
  if (block.type === "heading") return { valor: identidad === "center" ? "center" : "left", deIdentidad: true };
  if (block.type === "button") return { valor: "center", deIdentidad: false };
  return null;
}

function valorPropio(block: MailBlock, ajuste: Ajuste): string | null {
  const raw = (block as Record<string, unknown>)[ajuste.clave];
  return typeof raw === "string" && ajuste.opciones.some((o) => o.valor === raw) ? raw : null;
}

/** El valor vigente de un ajuste: el del bloque o, si falta, el que hereda (o el del render). */
export function valorDeAjuste(block: MailBlock, ajuste: Ajuste, theme?: TemaDeAlineacion): string {
  if (ajuste.clave === "ordered") return (block as Record<string, unknown>).ordered === true ? "si" : "no";
  return valorPropio(block, ajuste) ?? heredadoDe(block, ajuste, theme)?.valor ?? ajuste.defecto;
}

/** Verdadero si el bloque no fija el ajuste y sigue la alineación de Identidad. */
export function sigueAIdentidad(block: MailBlock, ajuste: Ajuste, theme?: TemaDeAlineacion): boolean {
  return valorPropio(block, ajuste) === null && heredadoDe(block, ajuste, theme)?.deIdentidad === true;
}

/**
 * El bloque con el ajuste nuevo. Un valor fuera de la enumeración no se aplica.
 * Elegir el valor heredado no escribe la clave (y la quita si estaba): la
 * ausencia sigue significando «hereda».
 */
export function conAjuste(block: MailBlock, clave: string, valor: string, theme?: TemaDeAlineacion): MailBlock {
  const ajuste = ajustesDe(block).find((a) => a.clave === clave);
  if (!ajuste || !ajuste.opciones.some((o) => o.valor === valor)) return block;
  if (clave === "ordered") return { ...block, ordered: valor === "si" } as MailBlock;
  if (heredadoDe(block, ajuste, theme)?.valor === valor) {
    if (!(clave in block)) return block;
    const { [clave]: _quitada, ...resto } = block as Record<string, unknown>;
    return resto as MailBlock;
  }
  return { ...block, [clave]: valor } as MailBlock;
}

/** Ancho de una imagen: entero de 40 a 600, o `undefined` = automático. */
export function anchoDeImagen(valor: number | string | null | undefined): number | undefined {
  if (valor === null || valor === undefined || valor === "") return undefined;
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return undefined;
  return Math.max(40, Math.min(600, n));
}
