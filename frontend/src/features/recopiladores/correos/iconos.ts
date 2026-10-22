import { isOpaqueMailBlock, type MailBlock, type MailBlockType } from "../../../api/materialMail";
import {
  AlignLeft,
  CalendarCheck,
  Columns2,
  Paintbrush,
  Palette,
  Sparkles,
  Type,
  Minus,
  CircleHelp,
  Image,
  Info,
  List,
  Mail,
  MessageSquareText,
  MousePointer2,
  PencilLine,
  ShieldCheck,
  type LucideIcon,
} from "../../../vendor/lucide-react";
import { CABECERA, SOBRE } from "./modeloCorreo";

export const ICONO_DE_BLOQUE: Record<MailBlockType, LucideIcon> = {
  greeting: MessageSquareText,
  heading: Type,
  paragraph: AlignLeft,
  button: MousePointer2,
  callout: Info,
  list: List,
  divider: Minus,
  image: Image,
  signature: PencilLine,
  footer_legal: ShieldCheck,
  band: Palette,
  ornament: Sparkles,
  icon_text: CalendarCheck,
  two_images: Columns2,
};

/** La imagen decorativa tiene su propio ícono en la biblioteca y en la lista. */
export const ICONO_DE_IMAGEN_DECORATIVA: LucideIcon = Paintbrush;

export function iconoDeBloque(block: MailBlock): LucideIcon {
  if (isOpaqueMailBlock(block)) return CircleHelp;
  return block.type === "image" && block.decorative ? ICONO_DE_IMAGEN_DECORATIVA : ICONO_DE_BLOQUE[block.type];
}

export const ICONO_DE_PSEUDO: Record<typeof SOBRE | typeof CABECERA, LucideIcon> = {
  [SOBRE]: Mail,
  [CABECERA]: Image,
};
