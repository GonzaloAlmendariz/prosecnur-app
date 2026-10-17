// Catálogo de tipos de pregunta del editor (M8, 2026-10-17). Pedido de Gonzalo: «es importante que al igual que en
// Gráficos tengas el kit visual completo bien definido». Una sola fuente para cada tipo XLSForm: nombre visible,
// familia (de la que sale el tono) y grupo en los menús de alta. El glifo de cada tipo vive en glifosTipo.ts.
//
// Identidad «Señales» (2026-10-17, propuesta aprobada): todo tipo se pinta como SELLO (Sello.tsx), la silueta del
// glifo sobre el color pleno de su familia. El color dice la familia y la forma dice el tipo. Sección y repetición
// son dos tonos de la misma familia estructural y su cierre va en suave. Las fachadas TypeIcon, MaquetaTipo e
// iconForType pintan el mismo sello en el tamaño que pide cada sitio.

export type FamiliaTipo = "opciones" | "texto" | "numero" | "fecha" | "evidencia" | "ubicacion" | "nota" | "calculo" | "seccion" | "repeticion" | "metadato" | "otro";
export type GrupoTipo = "opciones" | "captura" | "fecha" | "evidencia" | "ubicacion" | "estructura" | "metadato";

export type TipoPregunta = { base: string; nombre: string; familia: FamiliaTipo; grupo: GrupoTipo };

export const TIPOS_PREGUNTA: readonly TipoPregunta[] = [
  { base: "select_one", nombre: "Selección única", familia: "opciones", grupo: "opciones" },
  { base: "select_multiple", nombre: "Selección múltiple", familia: "opciones", grupo: "opciones" },
  { base: "rank", nombre: "Ordenar opciones", familia: "opciones", grupo: "opciones" },
  { base: "text", nombre: "Texto corto", familia: "texto", grupo: "captura" },
  { base: "integer", nombre: "Número entero", familia: "numero", grupo: "captura" },
  { base: "decimal", nombre: "Número decimal", familia: "numero", grupo: "captura" },
  { base: "range", nombre: "Escala numérica", familia: "numero", grupo: "captura" },
  { base: "date", nombre: "Fecha", familia: "fecha", grupo: "fecha" },
  { base: "time", nombre: "Hora", familia: "fecha", grupo: "fecha" },
  { base: "datetime", nombre: "Fecha y hora", familia: "fecha", grupo: "fecha" },
  { base: "image", nombre: "Imagen", familia: "evidencia", grupo: "evidencia" },
  { base: "audio", nombre: "Audio", familia: "evidencia", grupo: "evidencia" },
  { base: "video", nombre: "Video", familia: "evidencia", grupo: "evidencia" },
  { base: "file", nombre: "Archivo", familia: "evidencia", grupo: "evidencia" },
  { base: "barcode", nombre: "Código de barras", familia: "evidencia", grupo: "evidencia" },
  { base: "geopoint", nombre: "Ubicación (punto)", familia: "ubicacion", grupo: "ubicacion" },
  { base: "geotrace", nombre: "Ubicación (recorrido)", familia: "ubicacion", grupo: "ubicacion" },
  { base: "geoshape", nombre: "Ubicación (área)", familia: "ubicacion", grupo: "ubicacion" },
  { base: "note", nombre: "Nota informativa", familia: "nota", grupo: "estructura" },
  { base: "acknowledge", nombre: "Confirmación", familia: "nota", grupo: "estructura" },
  { base: "calculate", nombre: "Cálculo", familia: "calculo", grupo: "estructura" },
  { base: "hidden", nombre: "Campo oculto", familia: "calculo", grupo: "estructura" },
  { base: "begin_group", nombre: "Sección", familia: "seccion", grupo: "estructura" },
  { base: "begin_repeat", nombre: "Repetición", familia: "repeticion", grupo: "estructura" },
  { base: "end_group", nombre: "Cierre de sección", familia: "seccion", grupo: "estructura" },
  { base: "end_repeat", nombre: "Cierre de repetición", familia: "repeticion", grupo: "estructura" },
  { base: "start", nombre: "Inicio (automático)", familia: "metadato", grupo: "metadato" },
  { base: "end", nombre: "Fin (automático)", familia: "metadato", grupo: "metadato" },
  { base: "today", nombre: "Fecha del día (automático)", familia: "metadato", grupo: "metadato" },
  { base: "deviceid", nombre: "Dispositivo (automático)", familia: "metadato", grupo: "metadato" },
  { base: "username", nombre: "Usuario (automático)", familia: "metadato", grupo: "metadato" },
  { base: "start-geopoint", nombre: "Ubicación al abrir (automático)", familia: "metadato", grupo: "metadato" },
  { base: "audit", nombre: "Registro de la entrevista (automático)", familia: "metadato", grupo: "metadato" },
  { base: "phonenumber", nombre: "Teléfono del equipo (automático)", familia: "metadato", grupo: "metadato" },
  { base: "simserial", nombre: "Serie del chip (automático)", familia: "metadato", grupo: "metadato" },
  { base: "subscriberid", nombre: "Suscriptor del chip (automático)", familia: "metadato", grupo: "metadato" },
];

const POR_BASE = new globalThis.Map(TIPOS_PREGUNTA.map((t) => [t.base, t]));
const ALIAS: Record<string, string> = { select_one_from_file: "select_one", select_multiple_from_file: "select_multiple" };

/** El tipo del catálogo; uno desconocido cae en «otro» con su propio nombre técnico. */
export function tipoPregunta(base: string): TipoPregunta {
  return POR_BASE.get(ALIAS[base] ?? base) ?? { base, nombre: base || "Sin tipo", familia: "otro", grupo: "estructura" };
}

/** Lo llena el dispositivo, no el encuestado: no se pregunta, no se imprime, no cuenta como contenido. */
export function esMetadato(base: string): boolean {
  return tipoPregunta(base).familia === "metadato";
}

export const TONO_FAMILIA: Record<FamiliaTipo, string> = {
  opciones: "var(--pulso-tipo-opciones)",
  texto: "var(--pulso-tipo-texto)",
  numero: "var(--pulso-tipo-numero)",
  fecha: "var(--pulso-tipo-fecha)",
  evidencia: "var(--pulso-tipo-evidencia)",
  ubicacion: "var(--pulso-tipo-ubicacion)",
  nota: "var(--pulso-tipo-nota)",
  calculo: "var(--pulso-tipo-calculo)",
  seccion: "var(--pulso-tipo-seccion)",
  repeticion: "var(--pulso-tipo-repeticion)",
  metadato: "var(--pulso-tipo-metadato)",
  otro: "var(--pulso-tipo-metadato)",
};

/** El cierre de una sección o repetición: mismo tono que su apertura, en suave y con borde. */
export function esCierre(base: string): boolean {
  const b = tipoPregunta(base).base;
  return b === "end_group" || b === "end_repeat";
}

export const NOMBRE_GRUPO: Record<GrupoTipo, string> = {
  opciones: "Con opciones",
  captura: "Texto y números",
  fecha: "Fecha y hora",
  evidencia: "Evidencia",
  ubicacion: "Ubicación",
  estructura: "Estructura y lógica",
  metadato: "Automáticos",
};
