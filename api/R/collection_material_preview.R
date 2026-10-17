# collection_material_preview.R — la página real del editor de materiales
# (ADR 0109 E1b, «Editor sobre la página real»).
#
# El editor deja de mostrar una maqueta: pide la CARA que se está editando,
# compilada con la receta en borrador y una unidad del plan, y la recibe como
# PNG del mismo compilador grid que imprime el PDF, más las zonas de cada bloque
# para poner encima los botones de selección.
#
# Diferencias con sus dos vecinos, y por qué:
#
# - `collection_material_catalog_preview()` compila la receta de FÁBRICA con
#   una unidad sintética («CH 014»): es la vitrina de tipos y no puede depender
#   del proyecto. Aquí se compila el borrador y, si hay plan, una unidad real.
# - `materials/render` exige una instancia guardada y corre como job; esto es
#   síncrono (una página, 200-550 ms medidos) y no escribe estado: el editor lo
#   llama a cada cambio de la receta.
#
# Lo que NO hace: escribir `collection_state`, tocar `project_dirty`, dejar
# archivos fuera de `session$dir` ni pedir accesos resueltos (`resolved_access`).
# Con sensibilidad `restricted` el enlace real no existe en memoria
# (`.collection_access_url` devuelve ""), y para eso está el enlace de ejemplo.
#
# PII: el docente, el aula y el curso de la unidad viajan SOLO dentro de la
# imagen. El JSON lleva el código operativo como rótulo y nada de `dimensions`.

COLLECTION_MATERIAL_PREVIEW_SCHEMA <- "collection_material_preview/v1"

.CMV_DPI_PERMITIDOS <- c(72L, 90L, 150L)
.CMV_DPI_DEFECTO <- 90L
# Caras en el caché de la sesión. Una sesión de edición mueve una receta, un
# puñado de unidades de prueba y dos o tres caras: 48 cubre una tarde entera sin
# que el directorio crezca sin tope.
.CMV_CACHE_MAX <- 48L

# Aparte para poder fingir en los tests un R sin device PNG.
.cmv_png_disponible <- function() isTRUE(capabilities("png"))

.cmv_dpi_or_stop <- function(dpi) {
  if (is.null(dpi) || !length(dpi)) return(.CMV_DPI_DEFECTO)
  valor <- suppressWarnings(as.integer(unlist(dpi, use.names = FALSE)))
  if (length(valor) != 1L || is.na(valor) || !(valor %in% .CMV_DPI_PERMITIDOS)) {
    stop_api(
      422, "E_COLLECTION_MATERIAL_PREVIEW_DPI",
      sprintf("La resolución de la vista debe ser %s dpi.",
              paste(.CMV_DPI_PERMITIDOS, collapse = ", ")),
      details = list(allowed = as.list(.CMV_DPI_PERMITIDOS))
    )
  }
  valor
}

# Un problema del validador con la cara y el bloque a los que apunta, para que
# el editor marque la zona y la fila. El validador nombra por posición
# («template.pages[1].blocks[3].type»); aquí se traduce a ids.
.cmv_problema <- function(problem, template) {
  path <- as.character(problem$path %||% "")[1]
  num <- function(patron) {
    m <- regmatches(path, regexec(patron, path))[[1]]
    if (length(m) < 2L) NA_integer_ else as.integer(m[[2]])
  }
  pagina <- num("pages\\[([0-9]+)\\]")
  bloque <- num("blocks\\[([0-9]+)\\]")
  pages <- if (is.list(template)) template$pages else NULL
  spec <- if (!is.na(pagina) && is.list(pages) && pagina <= length(pages)) pages[[pagina]] else NULL
  block <- if (is.list(spec) && !is.na(bloque) && is.list(spec$blocks) && bloque <= length(spec$blocks)) {
    spec$blocks[[bloque]]
  } else {
    NULL
  }
  id_de <- function(x, campo) {
    v <- if (is.list(x)) x[[campo]] else NULL
    if (.cc_is_scalar_string(v)) v else NA_character_
  }
  list(
    path = path,
    code = as.character(problem$code %||% "")[1],
    detail = as.character(problem$detail %||% "")[1],
    page = pagina,
    page_id = id_de(spec, "page_id"),
    block_id = id_de(block, "block_id")
  )
}

.cmv_template_or_stop <- function(template) {
  if (!is.list(template)) {
    stop_api(
      422, "E_COLLECTION_MATERIAL_TEMPLATE_INVALID",
      "El borrador de la receta debe ser un objeto collection_material_template/v1.",
      details = list(problems = list(list(
        path = "template", code = "not_object", detail = "La plantilla debe ser un objeto.",
        page = NA_integer_, page_id = NA_character_, block_id = NA_character_
      )))
    )
  }
  candidate <- .cm_template_normalize(template)
  result <- collection_material_template_validate(candidate)
  if (!isTRUE(result$ok)) {
    stop_api(
      422, "E_COLLECTION_MATERIAL_TEMPLATE_INVALID",
      "El borrador de la receta no cumple collection_material_template/v1; la vista no se actualizó.",
      details = list(problems = lapply(result$problems, .cmv_problema, template = candidate))
    )
  }
  candidate
}

# La unidad con la que se dibuja la cara. Sin `unit_id`, la primera TITULAR del
# plan —es la ficha que más se imprime—; sin plan, la unidad de ejemplo del
# catálogo, rotulada como tal.
.cmv_unidad <- function(state, unit_id) {
  units <- Filter(function(u) is.list(u) && .cc_is_scalar_string(u$unit_id), state$plan$units %||% list())
  pedido <- unlist(unit_id %||% list(), use.names = FALSE)
  pedido <- if (length(pedido)) as.character(pedido)[1] else ""
  if (!is.na(pedido) && nzchar(trimws(pedido))) {
    hit <- Filter(function(u) identical(u$unit_id, pedido), units)
    if (!length(hit)) {
      stop_api(
        404, "E_COLLECTION_MATERIAL_PREVIEW_UNIT",
        "La unidad pedida no está en el plan de recolección vigente."
      )
    }
    return(list(source = "plan", unit = hit[[1]]))
  }
  if (!length(units)) return(list(source = "ejemplo", unit = .cmc_unidad_ejemplo()))
  rol <- vapply(units, function(u) tolower(gsub("[ -]+", "_", trimws(as.character(u$role %||% "")[1]))), character(1))
  titulares <- which(rol == "titular")
  list(source = "plan", unit = units[[if (length(titulares)) titulares[[1]] else 1L]])
}

# El acceso que va al QR. `deployment` solo si el enlace real se puede componer
# en memoria; si la sensibilidad lo impide o no hay accesos, el de ejemplo; si
# hay accesos pero esta unidad no tiene enlace, `sin_enlace` y la hoja lo dice.
.cmv_acceso <- function(state, unidad) {
  ejemplo <- list(
    access_id = "acceso-ejemplo", logical_collector_id = "ejemplo",
    unit_id = unidad$unit$unit_id, access_kind = "manual_handoff",
    access_ref = .CMC_ENLACE_EJEMPLO, status = "ready"
  )
  dep_ejemplo <- list(
    deployment_id = "despliegue-ejemplo", target = list(provider = "kobo"),
    bindings = list(ejemplo), sensitivity = list(access_urls = "operational"),
    status = "prepared"
  )
  como_ejemplo <- list(source = "ejemplo", deployment = dep_ejemplo, binding = ejemplo)
  if (identical(unidad$source, "ejemplo")) return(como_ejemplo)
  dep <- state$deployment
  if (!is.list(dep) || !length(dep$bindings %||% list())) return(como_ejemplo)
  sensibilidad <- tolower(as.character(dep$sensitivity$access_urls %||% "restricted")[1])
  if (!(sensibilidad %in% c("public", "operational"))) return(como_ejemplo)
  hits <- Filter(function(b) is.list(b) && identical(b$unit_id, unidad$unit$unit_id), dep$bindings)
  binding <- if (length(hits)) hits[[1]] else NULL
  payload <- if (is.null(binding)) "" else .collection_access_url(
    binding, sensibilidad, dep$target$provider %||% "kobo", dep$target$return_url %||% ""
  )
  dep_vista <- list(
    deployment_id = as.character(dep$deployment_id %||% "despliegue")[1],
    target = dep$target %||% list(provider = "kobo"),
    bindings = if (is.null(binding)) list() else list(binding),
    sensitivity = list(access_urls = sensibilidad),
    status = as.character(dep$status %||% "prepared")[1]
  )
  list(
    source = if (nzchar(.crf_txt(payload, ""))) "deployment" else "sin_enlace",
    deployment = dep_vista, binding = binding
  )
}

.cmv_compilar <- function(template, unidad, acceso, project) {
  binding <- acceso$binding
  access_refs <- if (is.list(binding) && .cc_is_scalar_string(binding$access_id)) list(binding$access_id) else list()
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA,
    instance_id = "material-vista-editor",
    template_ref = list(
      template_id = template$template_id,
      revision = as.integer(template$revision),
      sha256 = template$template_sha256
    ),
    deployment_id = acceso$deployment$deployment_id,
    deployment_fingerprint = fp(acceso$deployment),
    access_fingerprint = fp(acceso$deployment$bindings),
    instance_fingerprint = fp(list("vista", template$template_sha256, unidad$unit$unit_id)),
    unit_refs = list(unidad$unit$unit_id), access_refs = access_refs,
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  plan <- list(plan_id = "plan-vista-editor", units = list(unidad$unit))
  collection_material_compile(template, instance, project = project, plan = plan,
                              deployment = acceso$deployment)
}

# Huella de lo que, además de la receta, decide los pixeles: la unidad, el
# enlace, el proyecto y los logos (ruta, tamaño y fecha: re-subir un logo con el
# mismo nombre tiene que invalidar la cara).
.cmv_huella_contexto <- function(unidad, acceso, project, brand_assets) {
  logos <- lapply(brand_assets, function(path) {
    info <- file.info(path)
    list(path = path, size = as.numeric(info$size), mtime = as.numeric(info$mtime))
  })
  collection_fingerprint(list(
    unit = unidad$unit, source = unidad$source, access_source = acceso$source,
    deployment = acceso$deployment, project = project, logos = logos
  ))
}

.cmv_hex16 <- function(sha) substr(gsub("[^a-f0-9]", "", tolower(sub("^sha256:", "", sha))), 1L, 16L)

# Escribe a un temporal del mismo directorio y renombra: una cara a medias en
# el caché se serviría para siempre.
.cmv_escribir_atomico <- function(path, escribir) {
  tmp <- tempfile("vista-", tmpdir = dirname(path), fileext = sub("^.*(\\.[a-z]+)$", "\\1", path))
  ok <- tryCatch({ escribir(tmp); file.exists(tmp) && isTRUE(file.rename(tmp, path)) },
                 error = function(e) { unlink(tmp); stop(e) })
  if (!isTRUE(ok)) {
    unlink(tmp)
    stop_internal(sprintf("La vista del editor no quedó escrita en el caché (%s).", basename(path)))
  }
  invisible(path)
}

# LRU por fecha de uso: al servir una cara se le toca la fecha; al pasar el
# tope se borran las más viejas con su JSON hermano.
.cmv_podar_cache <- function(cache_dir, max = .CMV_CACHE_MAX) {
  pngs <- list.files(cache_dir, pattern = "\\.png$", full.names = TRUE)
  if (length(pngs) <= max) return(invisible(0L))
  orden <- order(file.info(pngs)$mtime, decreasing = TRUE)
  sobran <- pngs[orden][-seq_len(max)]
  unlink(c(sobran, sub("\\.png$", ".json", sobran)))
  invisible(length(sobran))
}

.cmv_bbox <- function(z) {
  r4 <- function(v) round(as.numeric(v), 4)
  list(x = r4(z$x0), y = r4(1 - z$y1), w = r4(z$x1 - z$x0), h = r4(z$y1 - z$y0))
}

.cmv_zona_json <- function(z, layout, blocks, page_mm) {
  block <- if (!is.na(z$block_id)) {
    hits <- Filter(function(b) is.list(b) && identical(b$block_id, z$block_id), blocks)
    if (length(hits)) hits[[1]] else NULL
  } else {
    NULL
  }
  bbox <- .cmv_bbox(z)
  r1 <- function(v) round(as.numeric(v), 1)
  derivada <- identical(z$kind, "derived")
  list(
    block_id = z$block_id,
    type = z$type,
    kind = z$kind,
    bbox = bbox,
    bbox_mm = list(x = r1(bbox$x * page_mm$w), y = r1(bbox$y * page_mm$h),
                   w = r1(bbox$w * page_mm$w), h = r1(bbox$h * page_mm$h)),
    editable = as.list(if (derivada) character(0) else .cmz_editable(layout, z$type)),
    reorderable = !derivada && .cmz_reorderable(layout, z$type),
    fills_from = as.list(.cmz_fills_from(block, layout, z$type))
  )
}

# Avisos para el editor: código, cara y bloque. Nada más: varios avisos del
# compilador cargan `unit_id`, rótulos o la letra del pabellón, y el JSON de la
# vista no lleva datos de la unidad.
.cmv_avisos <- function(warnings) {
  out <- lapply(Filter(is.list, warnings %||% list()), function(w) {
    list(
      code = as.character(w$code %||% "")[1],
      page = suppressWarnings(as.integer(w$page %||% NA_integer_)[1]),
      block_id = if (.cc_is_scalar_string(w$block_id)) w$block_id else NA_character_
    )
  })
  Filter(function(w) nzchar(w$code), out)
}

#' Vista de una cara de la receta, compilada con una unidad del plan.
#'
#' Solo lectura: no escribe `collection_state` ni exige `expected_revision`.
#'
#' @param sid sesión.
#' @param page cara pedida (1 = frente).
#' @param template borrador `collection_material_template/v1`; `NULL` usa la
#'   receta guardada.
#' @param unit_id unidad del plan; `NULL` toma la primera titular o la de ejemplo.
#' @param dpi 72, 90 o 150.
#' @return `collection_material_preview/v1`.
#' @keywords internal
collection_material_template_preview <- function(sid, page = 1L, template = NULL,
                                                 unit_id = NULL, dpi = NULL) {
  t0 <- proc.time()[["elapsed"]]
  session <- session_get(sid)
  state <- .collection_current(session)
  draft <- !is.null(template)
  template <- if (draft) .cmv_template_or_stop(template) else .cm_material_template(state)
  pages <- length(template$pages %||% list())
  index <- .cmc_page_or_stop(page, pages)
  dpi <- .cmv_dpi_or_stop(dpi)
  if (!.cmv_png_disponible()) {
    stop_api(
      503, "E_COLLECTION_MATERIAL_PREVIEW_UNAVAILABLE",
      "Este equipo no puede dibujar imágenes PNG; la vista de la página no está disponible."
    )
  }
  unidad <- .cmv_unidad(state, unit_id)
  acceso <- .cmv_acceso(state, unidad)
  project <- .cm_project_snapshot(session)
  brand_assets <- .cm_brand_assets_map(session, .cm_template_brand_ids(template))

  cache_dir <- file.path(session$dir, "material_preview")
  dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)
  clave <- sprintf(
    "%s_%s_p%d_%d", .cmv_hex16(template$template_sha256),
    .cmv_hex16(.cmv_huella_contexto(unidad, acceso, project, brand_assets)), index, dpi
  )
  png_path <- file.path(cache_dir, paste0(clave, ".png"))
  json_path <- file.path(cache_dir, paste0(clave, ".json"))
  hit <- file.exists(png_path) && file.exists(json_path)
  meta <- if (hit) tryCatch(jsonlite::read_json(json_path, simplifyVector = FALSE), error = function(e) NULL) else NULL
  if (is.null(meta)) {
    hit <- FALSE
    compiled <- .cmv_compilar(template, unidad, acceso, project)
    rendered <- NULL
    .cmv_escribir_atomico(png_path, function(tmp) {
      rendered <<- collection_material_render_compiled(
        compiled, tmp, device = "png", page = index, dpi = dpi, brand_assets = brand_assets
      )
    })
    meta <- list(
      zones = lapply(rendered$zones %||% list(), function(z) z[c("block_id", "type", "kind", "x0", "x1", "y0", "y1")]),
      warnings = .cmv_avisos(rendered$warnings)
    )
    .cmv_escribir_atomico(json_path, function(tmp) {
      jsonlite::write_json(meta, tmp, auto_unbox = TRUE, digits = NA, na = "null", null = "null")
    })
    .cmv_podar_cache(cache_dir)
  } else {
    ahora <- Sys.time()
    Sys.setFileTime(c(png_path, json_path), ahora)
  }
  zones <- lapply(meta$zones %||% list(), function(z) {
    z$block_id <- if (is.null(z$block_id)) NA_character_ else as.character(z$block_id)
    z
  })
  # En orden de lectura —de arriba abajo y de izquierda a derecha—, que es el
  # orden en que el editor las recorre con el teclado.
  if (length(zones)) {
    zones <- zones[order(-vapply(zones, function(z) as.numeric(z$y1), numeric(1)),
                         vapply(zones, function(z) as.numeric(z$x0), numeric(1)))]
  }

  spec <- template$pages[[index]]
  layout <- as.character(spec$layout_preset)[1]
  orientation <- as.character(template$page$orientation %||% "portrait")[1]
  page_mm <- if (identical(orientation, "landscape")) list(w = 297, h = 210) else list(w = 210, h = 297)
  bytes <- readBin(png_path, "raw", n = file.info(png_path)$size)
  dims <- .cmc_png_dims(bytes)
  codigo <- .crf_unit_context(unidad$unit)$operational_code

  list(
    schema = COLLECTION_MATERIAL_PREVIEW_SCHEMA,
    draft = draft,
    template_sha256 = template$template_sha256,
    page = as.integer(index),
    pages = as.integer(pages),
    page_id = as.character(spec$page_id)[1],
    layout_preset = layout,
    orientation = orientation,
    paper = as.character(template$page$size %||% "A4")[1],
    page_mm = page_mm,
    dpi = as.integer(dpi),
    width = dims$width,
    height = dims$height,
    png_base64 = jsonlite::base64_enc(bytes),
    faces = lapply(seq_along(template$pages), function(i) {
      p <- template$pages[[i]]
      list(page = as.integer(i), page_id = as.character(p$page_id)[1],
           layout_preset = as.character(p$layout_preset)[1],
           blocks = as.integer(length(p$blocks %||% list())))
    }),
    unit = list(source = unidad$source, unit_id = as.character(unidad$unit$unit_id)[1], label = codigo),
    access = list(source = acceso$source),
    zones = lapply(zones, .cmv_zona_json, layout = layout, blocks = spec$blocks, page_mm = page_mm),
    undrawn = .cmz_no_dibujados(spec$blocks, zones),
    warnings = lapply(meta$warnings %||% list(), function(w) {
      list(code = as.character(w$code %||% "")[1],
           page = suppressWarnings(as.integer(w$page %||% NA_integer_)[1]),
           block_id = if (is.null(w$block_id)) NA_character_ else as.character(w$block_id)[1])
    }),
    cache = if (hit) "hit" else "miss",
    elapsed_ms = as.integer(round(1000 * (proc.time()[["elapsed"]] - t0)))
  )
}
