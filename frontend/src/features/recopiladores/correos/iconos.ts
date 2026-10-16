import type { MailBlockType } from "../../../api/materialMail";
import {
  AlignLeft,
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
  paragraph: AlignLeft,
  button: MousePointer2,
  callout: Info,
  list: List,
  signature: PencilLine,
  footer_legal: ShieldCheck,
};

export const ICONO_DE_PSEUDO: Record<typeof SOBRE | typeof CABECERA, LucideIcon> = {
  [SOBRE]: Mail,
  [CABECERA]: Image,
};
