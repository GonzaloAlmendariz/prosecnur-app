# collection_material_catalog.R — el catálogo de tipos de material (ADR 0109 E1a).
#
# Catálogo › Tipos muestra qué materiales sabe hacer la app y cómo se ve cada
# uno. La miniatura sale del MISMO compilador `grid` que imprime el PDF
# (`collection_material_compile()` + `collection_material_render_compiled()`):
# no se rasteriza un PDF ni se dibuja una maqueta aparte. Una miniatura que no
# viene del compilador puede mentir sobre lo que sale de la imprenta.
#
# **La miniatura no lleva datos del proyecto.** Se compila contra una UNIDAD DE
# PRUEBA sintética («CH 014», «Curso de ejemplo», «Docente de ejemplo») y un
# enlace de ejemplo. Así es determinista —el mismo preset da los mismos bytes en
# cualquier sesión— y la galería puede mostrarse sin plan, sin accesos y sin
# arriesgar que un nombre real de docente aparezca en una vista de catálogo.
#
# Lo único que se lee de la sesión es lo que el catálogo necesita para decir si
# un tipo encaja: el `unit_type` del plan vigente (compatible) y el preset de la
# plantilla activa (active). Nunca se escribe estado: es una lectura pura más
# un caché de PNG en el directorio temporal de la sesión.
#
# Título, familia y unidades compatibles se declaran aquí y no en
# `COLLECTION_MATERIAL_PRESETS`: ese registro es el contrato que valida
# plantillas, y añadirle campos de presentación obligaría a tocar su validación.

COLLECTION_MATERIAL_CATALOG_SCHEMA <- "collection_material_catalog/v1"

# Resolución de la miniatura. 90 dpi da ~744×1052 px en A4: legible en la
# galería y en el editor, y una fracción del peso del PNG a 150 dpi del preview
# autoritativo.
.CMC_PREVIEW_DPI <- 90

# Id del logo de casa que la careta del afiche usa en la miniatura. El afiche
# exige entre 1 y 6 logos; sin uno la plantilla no valida y no hay qué mostrar.
.CMC_LOGO_ID <- "pulso"

# Tabla de presentación, en el orden en que la galería los muestra. `template`
# es la plantilla built-in del preset: la misma que el operativo usa cuando no
# hay una personalizada.
.cmc_presets <- function() {
  list(
    ficha_aplicacion_a4_v1 = list(
      title = "Ficha de aula con QR",
      family = "identifica_unidad",
      copies_per = "unidad",
      compatible_unit_types = "classroom_course_schedule",
      template = function() collection_material_builtin_template()
    ),
    ficha_campo_qr_a4_v1 = list(
      title = "Ficha de campo con croquis",
      family = "identifica_unidad",
      copies_per = "unidad",
      compatible_unit_types = "classroom_course_schedule",
      template = function() collection_material_field_sheet_template()
    ),
    afiche_qr_a4_v1 = list(
      title = "Afiche QR",
      family = "va_al_participante",
      copies_per = "unidad",
      compatible_unit_types = "classroom_course_schedule",
      template = function() collection_material_poster_template(assets = .CMC_LOGO_ID)
    )
  )
}

.cmc_preset_or_stop <- function(preset_id) {
  presets <- .cmc_presets()
  ok <- is.character(preset_id) && length(preset_id) == 1L && !is.na(preset_id) &&
    preset_id %in% names(presets)
  if (!ok) {
    stop_api(
      422, "E_COLLECTION_MATERIAL_PRESET_UNKNOWN",
      sprintf("preset_id no pertenece al catálogo. Use uno de: %s.", paste(names(presets), collapse = ", ")),
      details = list(presets = as.list(names(presets)))
    )
  }
  presets[[preset_id]]
}

.cmc_blocks_count <- function(template) {
  sum(vapply(template$pages %||% list(), function(p) length(p$blocks %||% list()), integer(1)))
}

# Poda recursiva de NULL. La receta built-in declara campos opcionales como
# `lines = NULL` / `note = NULL`; el serializador JSON los manda como `{}` y el
# PUT de vuelta los lee como objetos, que el validador rechaza con razón. Un
# campo ausente es lo que significa ese NULL, así que se quita antes de servir.
.cmc_drop_nulls_deep <- function(x) {
  if (!is.list(x)) return(x)
  keep <- !vapply(x, is.null, logical(1))
  x <- x[keep]
  x[] <- lapply(x, .cmc_drop_nulls_deep)
  x
}

#' Catálogo de tipos de material con su compatibilidad para el plan vigente.
#'
#' @param sid sesión.
#' @return `collection_material_catalog/v1`.
#' @keywords internal
collection_material_catalog_get <- function(sid) {
  session <- session_get(sid)
  state <- .collection_current(session)
  # Sin plan, el catálogo responde por el modo que hoy existe (aulas): es el
  # único tipo de unidad que la app sabe sembrar sola.
  unit_type <- as.character(state$plan$unit_type %||% "classroom_course_schedule")[[1]]
  active_preset <- as.character(.cm_material_template(state)$preset_id %||% "")[[1]]
  presets <- .cmc_presets()
  out <- lapply(names(presets), function(preset_id) {
    meta <- presets[[preset_id]]
    template <- meta$template()
    registry <- COLLECTION_MATERIAL_PRESETS[[preset_id]]
    pages <- length(template$pages %||% list())
    list(
      preset_id = preset_id,
      title = meta$title,
      family = meta$family,
      material_kind = registry$material_kind %||% template$material_kind,
      pages_per_unit = as.integer(pages),
      orientation = as.character(template$page$orientation %||% "portrait"),
      # Una plantilla de dos páginas es frente y dorso de la MISMA hoja (la
      # ficha de campo lleva el croquis al reverso), no dos hojas.
      faces = if (pages >= 2L) 2L else 1L,
      copies_per = meta$copies_per,
      compatible_unit_types = as.list(meta$compatible_unit_types),
      compatible = unit_type %in% meta$compatible_unit_types,
      blocks_count = as.integer(.cmc_blocks_count(template)),
      active = identical(active_preset, preset_id),
      paper = as.character(template$page$size %||% "A4"),
      # La receta built-in viaja para que «Usar este tipo» la fije con el
      # PUT /material-template de siempre; el frontend no arma bloques. Sin
      # NULL: tiene que volver por ese PUT tal como salió.
      template = .cmc_drop_nulls_deep(template)
    )
  })
  list(schema = COLLECTION_MATERIAL_CATALOG_SCHEMA, presets = out)
}

# La unidad de prueba. Ningún valor sale del proyecto: si una miniatura muestra
# un nombre real, es que algo leyó la sesión y este contrato se rompió.
.cmc_unidad_ejemplo <- function() {
  list(
    unit_id = "unidad-ejemplo",
    label = "CUR014_0101",
    role = "titular",
    group = "Muestra",
    dimensions = list(
      legacy_ref = "CH 014",
      classroom_id = "CUR014_0101",
      course_name = "Curso de ejemplo",
      teacher = "Docente de ejemplo",
      program = "Escuela de ejemplo",
      faculty = "Facultad de ejemplo",
      venue = "A101",
      schedule = "Lunes 08:00-10:00",
      eligible_n = "40"
    )
  )
}

.CMC_ENLACE_EJEMPLO <- "https://ee.kobotoolbox.org/x/ejemplo?d[collectorID]=CH014"

#' Compila la plantilla built-in de un preset con la unidad de prueba.
#'
#' @param template plantilla built-in del preset.
#' @return lista `compiled` + `brand_assets`.
#' @keywords internal
.cmc_compile_ejemplo <- function(template) {
  unidad <- .cmc_unidad_ejemplo()
  binding <- list(
    access_id = "acceso-ejemplo", logical_collector_id = "CH014",
    unit_id = unidad$unit_id, access_kind = "manual_handoff",
    access_ref = .CMC_ENLACE_EJEMPLO, status = "ready"
  )
  deployment <- list(
    deployment_id = "despliegue-ejemplo", target = list(provider = "kobo"),
    bindings = list(binding), sensitivity = list(access_urls = "operational"),
    status = "prepared"
  )
  plan <- list(plan_id = "plan-ejemplo", unit_type = "classroom_course_schedule",
               units = list(unidad))
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA,
    instance_id = "material-ejemplo",
    template_ref = list(
      template_id = template$template_id,
      revision = as.integer(template$revision),
      sha256 = template$template_sha256
    ),
    deployment_id = deployment$deployment_id,
    deployment_fingerprint = fp(deployment),
    access_fingerprint = fp(list(binding)),
    instance_fingerprint = fp(list("catalogo", template$template_sha256)),
    unit_refs = list(unidad$unit_id), access_refs = list(binding$access_id),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  compiled <- collection_material_compile(
    template, instance,
    project = list(name = "Estudio de ejemplo", period = "Periodo de ejemplo"),
    plan = plan, deployment = deployment
  )
  logo <- .pulso_pdf_logo_path()
  brand_assets <- list()
  if (.CMC_LOGO_ID %in% .cm_template_brand_ids(template) && !is.na(logo)) {
    brand_assets[[.CMC_LOGO_ID]] <- logo
  }
  list(compiled = compiled, brand_assets = brand_assets)
}

# Ancho y alto leídos del IHDR del PNG: lo que se reporta es lo que se escribió,
# no lo que se pidió al device.
.cmc_png_dims <- function(bytes) {
  be32 <- function(b) sum(as.integer(b) * 256^(3:0))
  list(width = as.integer(be32(bytes[17:20])), height = as.integer(be32(bytes[21:24])))
}

.cmc_page_or_stop <- function(page, pages) {
  index <- suppressWarnings(as.integer(unlist(page %||% 1L, use.names = FALSE)))
  if (length(index) != 1L || is.na(index) || index < 1L || index > pages) {
    stop_api(
      422, "E_COLLECTION_MATERIAL_PREVIEW_PAGE",
      sprintf("La página pedida no existe: este tipo de material tiene %d.", pages),
      details = list(pages = as.integer(pages))
    )
  }
  index
}

#' Miniatura PNG de un tipo de material, compilada con la unidad de prueba.
#'
#' Cachea por (preset, sha256 de la plantilla, página) en el directorio temporal
#' de la sesión: si la plantilla built-in cambia, cambia su sha y la miniatura
#' vieja deja de servirse sola.
#'
#' @param sid sesión.
#' @param preset_id preset del catálogo.
#' @param page página (1 = frente).
#' @return lista `preset_id`, `page`, `pages`, `width`, `height`, `png_base64`.
#' @keywords internal
collection_material_catalog_preview <- function(sid, preset_id, page = 1L) {
  session <- session_get(sid)
  meta <- .cmc_preset_or_stop(preset_id)
  template <- meta$template()
  pages <- length(template$pages %||% list())
  index <- .cmc_page_or_stop(page, pages)
  if (!isTRUE(capabilities("png"))) {
    stop_api(
      503, "E_COLLECTION_MATERIAL_PREVIEW_UNAVAILABLE",
      "Este equipo no puede dibujar imágenes PNG; la miniatura no está disponible."
    )
  }
  cache_dir <- file.path(session$dir, "material_catalog")
  dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)
  sha <- gsub("[^a-f0-9]", "", tolower(template$template_sha256))
  path <- file.path(cache_dir, sprintf("%s_%s_p%d.png", preset_id, substr(sha, 1L, 16L), index))
  if (!file.exists(path)) {
    built <- .cmc_compile_ejemplo(template)
    # Se escribe a un temporal y se renombra: una miniatura a medias en el
    # caché se serviría para siempre.
    tmp <- tempfile("preview-", tmpdir = cache_dir, fileext = ".png")
    collection_material_render_compiled(
      built$compiled, tmp, device = "png", page = index,
      dpi = .CMC_PREVIEW_DPI, brand_assets = built$brand_assets
    )
    if (!file.exists(tmp) || !isTRUE(file.rename(tmp, path))) {
      unlink(tmp)
      stop_internal(sprintf("La miniatura de %s no quedó escrita en el caché.", preset_id))
    }
  }
  bytes <- readBin(path, "raw", n = file.info(path)$size)
  dims <- .cmc_png_dims(bytes)
  list(
    preset_id = preset_id,
    page = as.integer(index),
    pages = as.integer(pages),
    width = dims$width,
    height = dims$height,
    png_base64 = jsonlite::base64_enc(bytes)
  )
}
