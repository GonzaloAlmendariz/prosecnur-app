// =============================================================================
// templates/seeds/stress.ts — seed de estrés para QA visual (solo dev)
// =============================================================================
// Un formulario que ejercita TODA la cobertura visual del editor:
//   - Un ejemplo de cada tipo de pregunta soportado.
//   - Variantes de appearance (multiline, likert, minimal, columns).
//   - Un catálogo largo (25 regiones del Perú) para probar scroll + búsqueda.
//   - Una sección, un repeat, constraints y relevants de muestra.
//
// NO aparece en la galería del usuario final: `devOnly: true` lo filtra
// cuando `!import.meta.env.DEV`.
// =============================================================================

import type { TemplateSeed } from "../seedHelper";

export const stressSeed: TemplateSeed = {
  id: "stress",
  title: "QA visual (dev)",
  description:
    "Un ejemplo de cada tipo de pregunta, variantes de appearance y un catálogo de 25 regiones. Solo para revisar el editor.",
  highlights: [
    "Todos los tipos soportados, uno por uno",
    "Appearances: multiline · likert · minimal · columns",
    "Catálogo largo (25 regiones) para scroll y búsqueda",
    "Sección + repeat + constraints + relevants",
  ],
  accent: "#7c3aed",
  devOnly: true,
  formTitle: "QA visual de tipos de pregunta",
  formId: "qa_visual_tipos",
  surveyRows: [
    // -------- Metadatos automáticos --------
    { type: "start", name: "_start" },
    { type: "end", name: "_end" },
    { type: "today", name: "_today" },
    { type: "deviceid", name: "_deviceid" },
    { type: "username", name: "_username" },

    {
      type: "note",
      name: "nota_intro",
      label: "Formulario de prueba: cada pregunta ejercita un tipo o appearance distinto.",
    },

    // -------- Sección: captura básica --------
    { type: "begin_group", name: "g_basicos", label: "Tipos básicos" },
    {
      type: "text",
      name: "texto_corto",
      label: "Texto corto",
      required: "yes",
    },
    {
      type: "text",
      name: "texto_largo",
      label: "Texto largo (multilínea)",
      appearance: "multiline",
      hint: "Debe verse como área de varias líneas.",
    },
    {
      type: "integer",
      name: "edad",
      label: "Edad (con validación 0–120)",
      constraint: ". >= 0 and . <= 120",
      constraint_message: "La edad debe estar entre 0 y 120.",
      required: "yes",
    },
    {
      type: "decimal",
      name: "peso_kg",
      label: "Peso en kilogramos",
      constraint: ". > 0 and . < 500",
    },
    { type: "date", name: "fecha_visita", label: "Fecha de la visita" },
    { type: "time", name: "hora_inicio", label: "Hora de inicio" },
    { type: "datetime", name: "fecha_hora_cita", label: "Fecha y hora de la cita" },
    { type: "end_group", name: "g_basicos_end" },

    // -------- Sección: selecciones y appearances --------
    { type: "begin_group", name: "g_selecciones", label: "Selecciones y appearances" },
    {
      type: "select_one sexo",
      name: "sexo",
      label: "Selección única (lista corta)",
      required: "yes",
    },
    {
      type: "select_one escala_acuerdo",
      name: "acuerdo_servicio",
      label: "Escala de acuerdo (likert)",
      appearance: "likert",
      relevant: "${sexo} != ''",
    },
    {
      type: "select_one region_peru",
      name: "region_residencia",
      label: "Región de residencia (lista larga, con scroll y búsqueda)",
    },
    {
      type: "select_one region_peru",
      name: "region_nacimiento",
      label: "Región de nacimiento (minimal → campo desplegable)",
      appearance: "minimal",
    },
    {
      type: "select_multiple servicios_basicos",
      name: "servicios",
      label: "Servicios de la vivienda (columns → grid de 2 columnas)",
      appearance: "columns",
    },
    {
      type: "rank prioridades",
      name: "prioridades_barrio",
      label: "Ordena las prioridades de tu barrio",
    },
    {
      type: "range",
      name: "satisfaccion",
      label: "Satisfacción general (0 a 10)",
      parameters: "start=0 end=10 step=1",
    },
    {
      type: "select_one_from_file regiones.csv",
      name: "region_archivo",
      label: "Región desde archivo externo",
    },
    { type: "end_group", name: "g_selecciones_end" },

    // -------- Repeat: miembros del hogar --------
    { type: "begin_repeat", name: "r_miembros", label: "Miembros del hogar" },
    {
      type: "text",
      name: "miembro_nombre",
      label: "Nombre del miembro",
      required: "yes",
    },
    {
      type: "integer",
      name: "miembro_edad",
      label: "Edad del miembro",
      relevant: "${miembro_nombre} != ''",
      constraint: ". >= 0 and . <= 120",
    },
    { type: "end_repeat", name: "r_miembros_end" },

    // -------- Multimedia, geo y captura en campo --------
    { type: "begin_group", name: "g_campo", label: "Captura en campo" },
    { type: "image", name: "foto_fachada", label: "Foto de la fachada" },
    { type: "audio", name: "audio_entrevista", label: "Audio de la entrevista" },
    { type: "video", name: "video_recorrido", label: "Video del recorrido" },
    { type: "file", name: "documento_adjunto", label: "Documento adjunto" },
    { type: "barcode", name: "codigo_vivienda", label: "Código de la vivienda (QR)" },
    { type: "geopoint", name: "gps_punto", label: "Ubicación de la vivienda" },
    { type: "geotrace", name: "gps_recorrido", label: "Recorrido de la cuadra" },
    { type: "geoshape", name: "gps_area", label: "Área del lote" },
    { type: "end_group", name: "g_campo_end" },

    // -------- Lógica derivada y cierres --------
    {
      type: "calculate",
      name: "edad_meses",
      calculation: "${edad} * 12",
    },
    {
      type: "acknowledge",
      name: "consentimiento",
      label: "Confirmo que leí el consentimiento informado",
      required: "yes",
    },
    { type: "hidden", name: "codigo_carga", label: "Código de carga" },
  ],
  catalogs: [
    {
      listName: "sexo",
      items: [
        { name: "femenino", label: "Femenino" },
        { name: "masculino", label: "Masculino" },
        { name: "otro", label: "Otro" },
        { name: "prefiero_no_decir", label: "Prefiero no decirlo" },
      ],
    },
    {
      listName: "escala_acuerdo",
      items: [
        { name: "muy_desacuerdo", label: "Muy en desacuerdo" },
        { name: "desacuerdo", label: "En desacuerdo" },
        { name: "neutral", label: "Ni de acuerdo ni en desacuerdo" },
        { name: "acuerdo", label: "De acuerdo" },
        { name: "muy_acuerdo", label: "Muy de acuerdo" },
      ],
    },
    {
      listName: "servicios_basicos",
      items: [
        { name: "agua", label: "Agua potable de red pública" },
        { name: "desague", label: "Desagüe / alcantarillado" },
        { name: "electricidad", label: "Electricidad" },
        { name: "internet", label: "Internet" },
        { name: "gas_natural", label: "Gas natural" },
        { name: "telefono_fijo", label: "Teléfono fijo" },
      ],
    },
    {
      listName: "prioridades",
      items: [
        { name: "seguridad", label: "Seguridad ciudadana" },
        { name: "limpieza", label: "Limpieza pública" },
        { name: "pistas", label: "Pistas y veredas" },
        { name: "areas_verdes", label: "Áreas verdes" },
        { name: "alumbrado", label: "Alumbrado público" },
      ],
    },
    {
      // 25 regiones del Perú (24 departamentos + Callao) — catálogo largo
      // para probar scroll interno, fade masks, contador y búsqueda.
      listName: "region_peru",
      items: [
        { name: "amazonas", label: "Amazonas" },
        { name: "ancash", label: "Áncash" },
        { name: "apurimac", label: "Apurímac" },
        { name: "arequipa", label: "Arequipa" },
        { name: "ayacucho", label: "Ayacucho" },
        { name: "cajamarca", label: "Cajamarca" },
        { name: "callao", label: "Callao" },
        { name: "cusco", label: "Cusco" },
        { name: "huancavelica", label: "Huancavelica" },
        { name: "huanuco", label: "Huánuco" },
        { name: "ica", label: "Ica" },
        { name: "junin", label: "Junín" },
        { name: "la_libertad", label: "La Libertad" },
        { name: "lambayeque", label: "Lambayeque" },
        { name: "lima", label: "Lima" },
        { name: "loreto", label: "Loreto" },
        { name: "madre_de_dios", label: "Madre de Dios" },
        { name: "moquegua", label: "Moquegua" },
        { name: "pasco", label: "Pasco" },
        { name: "piura", label: "Piura" },
        { name: "puno", label: "Puno" },
        { name: "san_martin", label: "San Martín" },
        { name: "tacna", label: "Tacna" },
        { name: "tumbes", label: "Tumbes" },
        { name: "ucayali", label: "Ucayali" },
      ],
    },
  ],
};
