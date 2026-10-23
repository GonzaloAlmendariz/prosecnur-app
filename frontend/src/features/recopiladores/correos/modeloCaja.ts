// =============================================================================
// modeloCaja.ts — el estilo propio de un bloque y la paleta del correo (L2–L4)
// =============================================================================
// Espejo de collection_mail_box.R, sin React. La caja (`box`) sólo admite
// valores cerrados; el fondo se guarda por nombre de la paleta (papel, tinte,
// acento, tinta) para que siga al acento, o como un color libre #rrggbb.
//
// La paleta del correo (L3) son esos cuatro nombres, con el hex que dibuja el
// render, más los colores que más pesan en el banner o en el logo: así el
// estilo de un bloque se arma con los colores de la marca del estudio.

import {
  MAIL_BOX_BG_NAMES,
  MAIL_BOX_BORDERS,
  MAIL_BOX_CORNERS,
  MAIL_BOX_SPACINGS,
  MAIL_BOX_TEXTS,
  isOpaqueMailBlock,
  type MailBlock,
  type MailBlockBox,
  type MailBoxBgName,
  type MailTheme,
} from "../../../api/materialMail";
import type { Ajuste } from "./ajustesDeBloque";
import { contraste, esHex, estiloDe, hexCanonico, mismoColor } from "./modeloEstilo";

/** `#rrggbb` en minúsculas, como lo guarda `normalizeMailBox` y lo escribe el render. */
export function hexDeCaja(color: string): string {
  return hexCanonico(color).toLowerCase();
}

/** `.CMAIL_TEXT_COLOR` del render: la tinta del cuerpo. */
const TINTA = "#22262e";
const BLANCO = "#ffffff";
/** `.CMAIL_CONTRAST_MIN`. */
export const CONTRASTE_MINIMO = 4.5;

/** La caja que el render dibuja cuando una clave falta (`.cmail_box_of`). */
export const CAJA_POR_DEFECTO: Required<MailBlockBox> = {
  bg: "papel", border: "ninguno", corners: "suaves", spacing: "normal", text: "auto",
};

/** Con lo que arranca un bloque al darle estilo propio: el tinte se nota sin gritar. */
export const CAJA_INICIAL: MailBlockBox = { bg: "tinte" };

export type ClaveDeCaja = "border" | "corners" | "spacing" | "text";

export function admiteCaja(block: MailBlock): boolean {
  return !isOpaqueMailBlock(block) && block.type !== "footer_legal";
}

export function cajaDe(block: MailBlock): MailBlockBox | null {
  if (!admiteCaja(block)) return null;
  return "box" in block && block.box ? block.box : null;
}

/** La caja con sus valores por defecto puestos (lo que dibuja el render). */
export function cajaEfectiva(box: MailBlockBox): Required<MailBlockBox> {
  return { ...CAJA_POR_DEFECTO, ...box } as Required<MailBlockBox>;
}

/**
 * El bloque con un cambio de caja. `null` quita la caja entera. Un cambio sobre
 * un bloque sin caja la crea. Los bloques que no admiten caja no cambian.
 */
export function conCaja(block: MailBlock, cambio: Partial<MailBlockBox> | null): MailBlock {
  if (!admiteCaja(block)) return block;
  if (cambio === null) {
    if (!("box" in block) || !block.box) return block;
    const { box: _quitada, ...resto } = block as MailBlock & { box?: MailBlockBox };
    return resto as MailBlock;
  }
  const actual = cajaDe(block) ?? {};
  return { ...block, box: { ...actual, ...cambio } } as MailBlock;
}

// ---- paleta del correo (L3) ---------------------------------------------------------

export type ColorDeLaPaleta = {
  /** Lo que se guarda en `box.bg`: un nombre de la paleta o un hex del banner/logo. */
  valor: string;
  rotulo: string;
  hex: string;
  origen: "tema" | "marca";
};

function mezcla(color: string, con: string, peso: number): string {
  const a = hexDeCaja(color).slice(1);
  const b = hexDeCaja(con).slice(1);
  const canal = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * peso + parseInt(b.slice(i, i + 2), 16) * (1 - peso));
  return `#${[0, 2, 4].map((i) => canal(i).toString(16).padStart(2, "0")).join("")}`;
}

/** `.cmail_tint`: el acento con 92 % de blanco. */
export function tinteDe(acento: string): string {
  return mezcla(acento, BLANCO, 0.08);
}

/** El fondo sobre el que se lee el cuerpo: la tarjeta blanca en Sobrio, la página en Campaña. */
function papelDe(theme: MailTheme): string {
  const estilo = estiloDe(theme);
  return estilo.estilo === "campana" ? hexDeCaja(estilo.fondo) : BLANCO;
}

const ROTULO_DE_FONDO: Record<MailBoxBgName, string> = {
  papel: "Papel", tinte: "Tinte", acento: "Acento", tinta: "Tinta",
};

export function hexDelNombre(nombre: MailBoxBgName, theme: MailTheme): string {
  const acento = hexDeCaja(theme.accent);
  if (nombre === "papel") return papelDe(theme);
  if (nombre === "tinte") return tinteDe(acento);
  if (nombre === "acento") return acento;
  return TINTA;
}

/**
 * Los colores para el fondo de un bloque: los cuatro de la paleta y, después,
 * los de la marca (banner o logo) que no repiten ninguno. Hasta tres de marca.
 */
export function paletaDelCorreo(theme: MailTheme, deLaMarca: readonly string[] = []): ColorDeLaPaleta[] {
  const tema = MAIL_BOX_BG_NAMES.map((nombre) => ({
    valor: nombre, rotulo: ROTULO_DE_FONDO[nombre], hex: hexDelNombre(nombre, theme), origen: "tema" as const,
  }));
  const marca: ColorDeLaPaleta[] = [];
  for (const color of deLaMarca) {
    if (!esHex(color)) continue;
    const hex = hexDeCaja(color);
    if ([...tema, ...marca].some((c) => mismoColor(c.hex, hex))) continue;
    marca.push({ valor: hex, rotulo: "De la marca", hex, origen: "marca" });
    if (marca.length === 3) break;
  }
  return [...tema, ...marca];
}

/** El hex del fondo de la caja, como lo resuelve el render. */
export function fondoDeCaja(box: MailBlockBox, theme: MailTheme): string {
  const bg = cajaEfectiva(box).bg;
  return (MAIL_BOX_BG_NAMES as readonly string[]).includes(bg) ? hexDelNombre(bg as MailBoxBgName, theme) : hexDeCaja(bg);
}

/** La tinta del texto dentro de la caja (`.cmail_box_ink`). */
export function tintaDeCaja(box: MailBlockBox, theme: MailTheme): string {
  const { text } = cajaEfectiva(box);
  if (text === "tinta") return TINTA;
  if (text === "blanco") return BLANCO;
  if (text === "acento") return hexDeCaja(theme.accent);
  const fondo = fondoDeCaja(box, theme);
  // El mismo orden que el render: el texto del tema (en Campaña, el que se lee sobre la página), tinta y blanco.
  const estilo = estiloDe(theme);
  // `.cmail_best_ink(page_bg, c("#ffffff", TINTA))`: ante un empate gana el blanco.
  const pagina = hexDeCaja(estilo.fondo);
  const delTema = estilo.estilo !== "campana" ? TINTA
    : (contraste(BLANCO, pagina) ?? 0) >= (contraste(TINTA, pagina) ?? 0) ? BLANCO : TINTA;
  const candidatas = [...new Set([delTema, TINTA, BLANCO])];
  return candidatas.reduce((mejor, c) => ((contraste(c, fondo) ?? 0) > (contraste(mejor, fondo) ?? 0) ? c : mejor));
}

export type LecturaDeCaja = { razon: number | null; seLee: boolean };

export function lecturaDeCaja(box: MailBlockBox, theme: MailTheme): LecturaDeCaja {
  const razon = contraste(tintaDeCaja(box, theme), fondoDeCaja(box, theme));
  return { razon, seLee: razon !== null && razon >= CONTRASTE_MINIMO };
}

// ---- los ajustes de la caja, en la voz del inspector ------------------------------------

export const AJUSTES_DE_CAJA: readonly (Ajuste & { clave: ClaveDeCaja })[] = [
  {
    clave: "border", rotulo: "Borde", defecto: CAJA_POR_DEFECTO.border,
    opciones: [
      { valor: "ninguno", rotulo: "Ninguno" },
      { valor: "fino", rotulo: "Fino" },
      { valor: "acento", rotulo: "Acento", ayuda: "una raya del color del correo a la izquierda" },
    ],
  },
  {
    clave: "corners", rotulo: "Esquinas", defecto: CAJA_POR_DEFECTO.corners,
    opciones: [
      { valor: "rectas", rotulo: "Rectas" },
      { valor: "suaves", rotulo: "Suaves", ayuda: "8 px" },
      { valor: "redondas", rotulo: "Redondas", ayuda: "16 px" },
    ],
  },
  {
    clave: "spacing", rotulo: "Espaciado", defecto: CAJA_POR_DEFECTO.spacing,
    opciones: [
      { valor: "compacto", rotulo: "Compacto" },
      { valor: "normal", rotulo: "Normal" },
      { valor: "amplio", rotulo: "Amplio" },
    ],
  },
  {
    clave: "text", rotulo: "Color del texto", defecto: CAJA_POR_DEFECTO.text,
    opciones: [
      { valor: "auto", rotulo: "Automático", ayuda: "el que mejor se lee sobre el fondo" },
      { valor: "tinta", rotulo: "Tinta" },
      { valor: "acento", rotulo: "Acento" },
      { valor: "blanco", rotulo: "Blanco" },
    ],
  },
];

// Las enumeraciones del contrato y las del inspector no pueden separarse.
const ENUMS: Record<ClaveDeCaja, readonly string[]> = {
  border: MAIL_BOX_BORDERS, corners: MAIL_BOX_CORNERS, spacing: MAIL_BOX_SPACINGS, text: MAIL_BOX_TEXTS,
};
export function ajustesAlineadosConElContrato(): boolean {
  return AJUSTES_DE_CAJA.every((a) => a.opciones.map((o) => o.valor).join() === ENUMS[a.clave].join());
}
