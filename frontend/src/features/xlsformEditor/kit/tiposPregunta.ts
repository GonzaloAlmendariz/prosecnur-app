// Catálogo de tipos de pregunta del editor (M8, 2026-10-17). Pedido de Gonzalo: «es importante que al igual que en
// Gráficos tengas el kit visual completo bien definido». Una sola fuente para cada tipo XLSForm: nombre visible,
// familia (de la que sale el tono), grupo en los menús de alta e ícono. La maqueta (MaquetaTipo.tsx) dibuja cada tipo.
//
// Regla de uso del kit:
// - Ícono (TypeIcon): donde el tipo acompaña un texto: listas, esquema, fichas pequeñas, referencias dentro de reglas.
// - Maqueta (MaquetaTipo): donde se elige o se explica un tipo: menú de alta, Resumen, ficha de la pregunta.
// El color de la familia va sólo en el acento (el glifo del ícono, la marca de la maqueta); lo demás en tinta.

import {
  Calculator,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock,
  EyeOff,
  File,
  Folder,
  FolderMinus,
  Hash,
  HelpCircle,
  Image,
  ListChecks,
  ListOrdered,
  Map,
  MapPin,
  MessageSquare,
  Mic,
  QrCode,
  Repeat,
  Route,
  Settings2,
  Sigma,
  SlidersHorizontal,
  Type,
  Video,
  type LucideIcon,
} from "../../../vendor/lucide-react";

export type FamiliaTipo = "unica" | "multiple" | "numero" | "texto" | "fecha" | "evidencia" | "ubicacion" | "nota" | "calculo" | "estructura" | "metadato" | "otro";
export type GrupoTipo = "opciones" | "captura" | "fecha" | "evidencia" | "ubicacion" | "estructura" | "metadato";

export type TipoPregunta = { base: string; nombre: string; familia: FamiliaTipo; grupo: GrupoTipo; icono: LucideIcon };

export const TIPOS_PREGUNTA: readonly TipoPregunta[] = [
  { base: "select_one", nombre: "Selección única", familia: "unica", grupo: "opciones", icono: CircleDot },
  { base: "select_multiple", nombre: "Selección múltiple", familia: "multiple", grupo: "opciones", icono: ListChecks },
  { base: "rank", nombre: "Ordenar opciones", familia: "unica", grupo: "opciones", icono: ListOrdered },
  { base: "text", nombre: "Texto corto", familia: "texto", grupo: "captura", icono: Type },
  { base: "integer", nombre: "Número entero", familia: "numero", grupo: "captura", icono: Hash },
  { base: "decimal", nombre: "Número decimal", familia: "numero", grupo: "captura", icono: Sigma },
  { base: "range", nombre: "Escala numérica", familia: "numero", grupo: "captura", icono: SlidersHorizontal },
  { base: "date", nombre: "Fecha", familia: "fecha", grupo: "fecha", icono: Calendar },
  { base: "time", nombre: "Hora", familia: "fecha", grupo: "fecha", icono: Clock },
  { base: "datetime", nombre: "Fecha y hora", familia: "fecha", grupo: "fecha", icono: CalendarClock },
  { base: "image", nombre: "Imagen", familia: "evidencia", grupo: "evidencia", icono: Image },
  { base: "audio", nombre: "Audio", familia: "evidencia", grupo: "evidencia", icono: Mic },
  { base: "video", nombre: "Video", familia: "evidencia", grupo: "evidencia", icono: Video },
  { base: "file", nombre: "Archivo", familia: "evidencia", grupo: "evidencia", icono: File },
  { base: "barcode", nombre: "Código de barras", familia: "evidencia", grupo: "evidencia", icono: QrCode },
  { base: "geopoint", nombre: "Ubicación (punto)", familia: "ubicacion", grupo: "ubicacion", icono: MapPin },
  { base: "geotrace", nombre: "Ubicación (recorrido)", familia: "ubicacion", grupo: "ubicacion", icono: Route },
  { base: "geoshape", nombre: "Ubicación (área)", familia: "ubicacion", grupo: "ubicacion", icono: Map },
  { base: "note", nombre: "Nota informativa", familia: "nota", grupo: "estructura", icono: MessageSquare },
  { base: "acknowledge", nombre: "Confirmación", familia: "nota", grupo: "estructura", icono: CheckCircle2 },
  { base: "calculate", nombre: "Cálculo", familia: "calculo", grupo: "estructura", icono: Calculator },
  { base: "hidden", nombre: "Campo oculto", familia: "calculo", grupo: "estructura", icono: EyeOff },
  { base: "begin_group", nombre: "Sección", familia: "estructura", grupo: "estructura", icono: Folder },
  { base: "begin_repeat", nombre: "Repetición", familia: "estructura", grupo: "estructura", icono: Repeat },
  { base: "end_group", nombre: "Cierre de sección", familia: "estructura", grupo: "estructura", icono: FolderMinus },
  { base: "end_repeat", nombre: "Cierre de repetición", familia: "estructura", grupo: "estructura", icono: FolderMinus },
  { base: "start", nombre: "Inicio (automático)", familia: "metadato", grupo: "metadato", icono: Settings2 },
  { base: "end", nombre: "Fin (automático)", familia: "metadato", grupo: "metadato", icono: Settings2 },
  { base: "today", nombre: "Fecha del día (automático)", familia: "metadato", grupo: "metadato", icono: Settings2 },
  { base: "deviceid", nombre: "Dispositivo (automático)", familia: "metadato", grupo: "metadato", icono: Settings2 },
  { base: "username", nombre: "Usuario (automático)", familia: "metadato", grupo: "metadato", icono: Settings2 },
];

const POR_BASE = new globalThis.Map(TIPOS_PREGUNTA.map((t) => [t.base, t]));
const ALIAS: Record<string, string> = { select_one_from_file: "select_one", select_multiple_from_file: "select_multiple" };

/** El tipo del catálogo; uno desconocido cae en «otro» con su propio nombre técnico. */
export function tipoPregunta(base: string): TipoPregunta {
  return POR_BASE.get(ALIAS[base] ?? base) ?? { base, nombre: base || "Sin tipo", familia: "otro", grupo: "estructura", icono: HelpCircle };
}

export const TONO_FAMILIA: Record<FamiliaTipo, string> = {
  unica: "var(--module-accent, var(--pulso-primary))",
  multiple: "var(--pulso-accent-sky)",
  numero: "var(--pulso-accent-green)",
  texto: "var(--pulso-accent-amber)",
  fecha: "var(--pulso-accent-cyan)",
  evidencia: "var(--pulso-accent-rose)",
  ubicacion: "var(--pulso-accent-steel)",
  nota: "var(--pulso-text-muted)",
  calculo: "var(--pulso-accent-violet)",
  estructura: "var(--pulso-text-muted)",
  metadato: "var(--pulso-text-faint)",
  otro: "var(--pulso-text-muted)",
};

export const NOMBRE_GRUPO: Record<GrupoTipo, string> = {
  opciones: "Con opciones",
  captura: "Texto y números",
  fecha: "Fecha y hora",
  evidencia: "Evidencia",
  ubicacion: "Ubicación",
  estructura: "Estructura y lógica",
  metadato: "Automáticos",
};
