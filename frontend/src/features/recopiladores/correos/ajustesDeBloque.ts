// =============================================================================
// ajustesDeBloque.ts — estilos por bloque, sólo enumeraciones cerradas (E1g §1)
// =============================================================================
// Espejo de `.CMAIL_STYLE_ENUMS` (collection_mail_styles.R) con los rótulos en
// la voz de la vista. Nunca hay CSS libre: cada ajuste ofrece una lista fija
// de valores y el render traduce cada uno a su estilo inline. El valor por
// defecto es el que usa el render cuando la clave falta.

import { MAIL_ICONS, isOpaqueMailBlock, type MailBlock } from "../../../api/materialMail";
import { ROTULO_DE_ICONO } from "./piezasGraficas";

export type OpcionDeAjuste = { valor: string; rotulo: string; ayuda?: string };

export type Ajuste = {
  clave: string;
  rotulo: string;
  opciones: readonly OpcionDeAjuste[];
  defecto: string;
};

/**
 * «Del estilo»: el bloque no fija alineación y sigue la del estilo del correo (Identidad › Alineación, justificado
 * por defecto). Es la ausencia de la clave, no un valor que viaje al backend.
 */
export const DEL_ESTILO = "estilo";

const ALINEACION_PARRAFO: readonly OpcionDeAjuste[] = [
  { valor: DEL_ESTILO, rotulo: "Del estilo", ayuda: "la de Identidad" },
  { valor: "left", rotulo: "Izquierda" },
  { valor: "justify", rotulo: "Justificado" },
  { valor: "center", rotulo: "Centrado" },
];

const ALINEACION_TEXTO: readonly OpcionDeAjuste[] = [
  { valor: "left", rotulo: "Izquierda" },
  { valor: "justify", rotulo: "Justificado" },
  { valor: "center", rotulo: "Centrado" },
];

export const AJUSTES_POR_TIPO: Partial<Record<MailBlock["type"], readonly Ajuste[]>> = {
  paragraph: [
    { clave: "align", rotulo: "Alineación", opciones: ALINEACION_PARRAFO, defecto: DEL_ESTILO },
    {
      clave: "size",
      rotulo: "Tamaño",
      opciones: [
        { valor: "normal", rotulo: "Normal", ayuda: "15 px" },
        { valor: "pequeno", rotulo: "Pequeño", ayuda: "13 px, para notas" },
      ],
      defecto: "normal",
    },
    {
      clave: "tone",
      rotulo: "Tono",
      opciones: [
        { valor: "normal", rotulo: "Normal" },
        { valor: "suave", rotulo: "Suave", ayuda: "gris, para lo secundario" },
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
    {
      clave: "align",
      rotulo: "Alineación",
      opciones: [
        { valor: "left", rotulo: "Izquierda" },
        { valor: "center", rotulo: "Centrado" },
      ],
      defecto: "left",
    },
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
    {
      clave: "align",
      rotulo: "Alineación",
      opciones: [
        { valor: "center", rotulo: "Centrado" },
        { valor: "left", rotulo: "Izquierda" },
      ],
      defecto: "center",
    },
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
};

/** Ajustes que no se muestran como segmentado: tienen su propio control. */
export const AJUSTES_CON_CONTROL_PROPIO: ReadonlySet<string> = new Set(["icon"]);

export function ajustesDe(block: MailBlock): readonly Ajuste[] {
  if (isOpaqueMailBlock(block)) return [];
  return AJUSTES_POR_TIPO[block.type] ?? [];
}

/** El valor vigente de un ajuste (el del bloque o, si falta, el del render). */
export function valorDeAjuste(block: MailBlock, ajuste: Ajuste): string {
  const raw = (block as Record<string, unknown>)[ajuste.clave];
  if (ajuste.clave === "ordered") return raw === true ? "si" : "no";
  return typeof raw === "string" && ajuste.opciones.some((o) => o.valor === raw) ? raw : ajuste.defecto;
}

/** El bloque con el ajuste nuevo. Un valor fuera de la enumeración no se aplica. */
export function conAjuste(block: MailBlock, clave: string, valor: string): MailBlock {
  const ajuste = ajustesDe(block).find((a) => a.clave === clave);
  if (!ajuste || !ajuste.opciones.some((o) => o.valor === valor)) return block;
  if (clave === "ordered") return { ...block, ordered: valor === "si" } as MailBlock;
  if (valor === DEL_ESTILO) {
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
