// =============================================================================
// helpers/icons.ts — icono lucide por tipo XLSForm
// =============================================================================
// Mapping centralizado tipo → componente de icono. Útil para:
//   - Outline (icono al lado del label de cada fila).
//   - TypePicker (icono en cada tarjeta de tipo).
//   - Badges en el preview.
//
// La elección de iconos sigue convenciones reconocibles: CircleDot para
// radio (single choice), ListChecks para multi, Type para texto, etc.
// =============================================================================

import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  EyeOff,
  File,
  Folder,
  Hash,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  MessageSquare,
  Mic,
  QrCode,
  Repeat,
  Sigma,
  Sparkles,
  Type,
  Video,
  HelpCircle,
} from "lucide-react";

/**
 * Icono "conditional rules" — pieza con dos ramas que sale de un nodo común.
 * Inspirado en https://www.svgrepo.com/svg/450750/conditional-rules. Lo
 * usamos para indicar visibilidad condicional en outline y canvas.
 *
 * Recibe `weight` como `"thin"` (para preguntas condicionadas) o
 * `"bold"` (para secciones condicionadas). El mismo trazo, solo cambia
 * el strokeWidth — fino para que no compita con el icono de tipo, más
 * marcado en secciones para reflejar que la condición afecta al bloque.
 */
export type ConditionalIconProps = {
  size?: number;
  color?: string;
  weight?: "thin" | "bold";
  className?: string;
  title?: string;
};

export function ConditionalIcon({
  size = 14,
  color = "currentColor",
  weight = "thin",
  className,
  title,
}: ConditionalIconProps) {
  const sw = weight === "bold" ? 2.4 : 1.6;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* Diamante "if" arriba */}
      <path d="M12 3l4 4-4 4-4-4z" />
      {/* Línea baja central */}
      <path d="M12 11v2" />
      {/* Bifurcación a izquierda y derecha */}
      <path d="M12 13H6v3" />
      <path d="M12 13h6v3" />
      {/* Hojas */}
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
    </svg>
  );
}

/** Devuelve el componente de icono para un tipo base. Fallback: HelpCircle. */
export function iconForType(baseType: string): LucideIcon {
  switch (baseType) {
    case "select_one":
      return CircleDot;
    case "select_multiple":
      return ListChecks;

    case "integer":
      return Hash;
    case "decimal":
      return Sigma;

    case "text":
      return Type;

    case "date":
      return Calendar;
    case "time":
      return Clock;
    case "datetime":
      return Calendar;

    case "calculate":
      return Calculator;

    case "note":
      return MessageSquare;
    case "acknowledge":
      return CheckCircle2;
    case "hidden":
      return EyeOff;

    case "start":
    case "end":
    case "today":
    case "deviceid":
    case "username":
      return Sparkles;

    case "begin_group":
    case "end_group":
      return Folder;

    case "begin_repeat":
    case "end_repeat":
      return Repeat;

    case "image":
      return ImageIcon;
    case "audio":
      return Mic;
    case "video":
      return Video;
    case "file":
      return File;
    case "barcode":
      return QrCode;

    case "geopoint":
    case "geotrace":
    case "geoshape":
      return MapPin;

    default:
      return HelpCircle;
  }
}
