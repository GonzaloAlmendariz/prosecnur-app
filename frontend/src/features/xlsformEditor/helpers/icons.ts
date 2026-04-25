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
