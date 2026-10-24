# collection_mail_sections_import.R — «Importar de otro estudio…» de «Mis
# secciones» (GOAL editor de correos profesional, L9; ADR 0113 §Decisión).
#
# Se elige un `.pulso` y se copian sus secciones, con sus fotos, a este estudio.
# El otro `.pulso` sólo se lee: nunca se abre como proyecto ni se escribe.
#
# - Se extrae `state.rds` y, al importar, sólo los archivos de las fotos que
#   nombran las secciones elegidas (un `.pulso` puede pesar cientos de MB).
# - Una foto entra como `mail_image` de este estudio por la vía de una subida
#   (`save_upload`). Si aquí ya hay una imagen con su id: con los mismos bytes
#   se reutiliza; con otros, entra con id nuevo (`<id>-2`…) y el bloque se
#   reescribe, porque el id vigente gana por fecha y pisaría la foto propia.
# - Una sección que ya está (mismo nombre y mismo bloque) no se duplica.
# - No viaja `campaign_id`: nombra una campaña del otro estudio.
# - Todo o nada respecto del tope: si no caben, no entra ninguna (409).

.cmail_import_err <- function(msg) {
  stop_api(422, "E_COLLECTION_MAIL_SECTIONS_IMPORT", msg)
}

# Ruta a un `.pulso` legible. No se cita la ruta en el error (puede llevar el
# nombre de una persona en la carpeta).
.cmail_import_path <- function(path) {
  p <- .cmail_one(as.list(path %||% list(NA_character_)))
  if (is.null(p) || !nzchar(trimws(p))) .cmail_import_err("Elige el .pulso del otro estudio.")
  p <- path.expand(trimws(p))
  if (!grepl("\\.pulso$", p, ignore.case = TRUE)) .cmail_import_err("Elige un archivo .pulso.")
  if (!file.exists(p) || dir.exists(p)) .cmail_import_err("No se encontró ese .pulso.")
  normalizePath(p, mustWork = TRUE)
}

# El estado guardado del otro estudio y su nombre, desde un staging propio.
.cmail_import_open <- function(path, stage_dir) {
  entries <- tryCatch(zip::zip_list(path)$filename, error = function(e) NULL)
  if (is.null(entries) || !("state.rds" %in% entries)) .cmail_import_err("Ese archivo no es un .pulso legible.")
  pick <- intersect(c("state.rds", "manifest.json"), entries)
  ok <- tryCatch({ zip::unzip(path, files = pick, exdir = stage_dir); TRUE }, error = function(e) FALSE)
  state <- if (ok) tryCatch(readRDS(file.path(stage_dir, "state.rds")), error = function(e) NULL)
  if (!is.list(state)) .cmail_import_err("Ese archivo no es un .pulso legible.")
  manifest <- if ("manifest.json" %in% pick) {
    tryCatch(jsonlite::fromJSON(file.path(stage_dir, "manifest.json"), simplifyVector = TRUE), error = function(e) list())
  } else list()
  name <- .cmail_one(as.list(manifest$project_name %||% list(NA_character_))) %||%
    sub("\\.pulso$", "", basename(path), ignore.case = TRUE)
  list(state = state, entries = entries, name = name)
}

# Huella de un bloque para reconocer «la misma sección»: sin lo que el
# guardado ya quita, y con los ids de foto fuera (pueden cambiar al importar).
.cmail_import_huella <- function(name, block) {
  b <- block
  b$block_id <- NULL
  b$guardado <- NULL
  for (k in c("image_ref", "mobile_ref", "left", "right")) b[[k]] <- NULL
  paste(trimws(name), jsonlite::toJSON(b, auto_unbox = TRUE, null = "null", digits = NA))
}

# Las secciones del otro estudio, cada una con si se puede importar y por qué no.
.cmail_import_candidates <- function(src_state, mine) {
  propias <- vapply(mine, function(x) .cmail_import_huella(x$name, x$block), "")
  fotos <- .cmail_image_latest(src_state$files, require_file = FALSE)
  lapply(.cmail_sections_of(src_state$collection_state %||% list()), function(x) {
    ok <- tryCatch({ .cmail_section_block(x$block); TRUE }, api_error = function(e) FALSE)
    ids <- if (ok) .cmail_section_image_ids(x$block) else character(0)
    list(section = x, valida = ok,
         ya_esta = ok && .cmail_import_huella(x$name, x$block) %in% propias,
         fotos = length(ids), fotos_sin_archivo = sum(!(ids %in% names(fotos))))
  })
}

# El id libre más cercano a `id` en este estudio (`<id>-2`, `-3`…, hasta 60).
.cmail_import_free_id <- function(id, taken) {
  if (!(id %in% taken)) return(id)
  for (i in 2:999) {
    suf <- paste0("-", i)
    cand <- paste0(sub("-+$", "", substr(id, 1L, 60L - nchar(suf))), suf)
    if (!(cand %in% taken)) return(cand)
  }
  .cmail_import_err("No quedan nombres libres para las fotos.")
}

# Copia una foto del otro estudio a este y devuelve el id con que quedó, o NULL
# si no se pudo leer (quien llama decide qué nombra el bloque).
.cmail_import_photo <- function(sid, id, src_meta, entries, path, stage_dir, ya_copiadas) {
  if (!is.null(ya_copiadas[[id]])) return(ya_copiadas[[id]])
  fid <- as.character(src_meta$file_id %||% "")[1]
  entry <- entries[startsWith(entries, paste0("files/", fid, "__"))]
  if (!nzchar(fid) || !length(entry)) return(NULL)
  ok <- tryCatch({ zip::unzip(path, files = entry[1], exdir = stage_dir); TRUE }, error = function(e) FALSE)
  raw <- if (ok) .cmail_read_raw(file.path(stage_dir, entry[1]))
  if (is.null(raw)) return(NULL)
  mine <- .cmail_image_latest(session_get(sid)$files)
  # La misma foto ya está aquí (con su id o con otro, p. ej. un `<id>-2` de una
  # importación anterior): se reutiliza, no se sube otra copia.
  propio <- mine[[id]]
  if (!is.null(propio) && identical(.cmail_read_raw(as.character(propio$path)[1]), raw)) return(id)
  for (otro in setdiff(names(mine), id)) {
    if (identical(.cmail_read_raw(as.character(mine[[otro]]$path)[1]), raw)) return(otro)
  }
  if (!is.null(propio)) id <- .cmail_import_free_id(id, names(mine))
  ext <- if (identical(.cmail_image_type_raw(raw), "jpeg")) "jpg" else "png"
  meta <- tryCatch(save_upload(sid, "mail_image", paste0(id, ".", ext), raw), api_error = function(e) NULL)
  if (is.null(meta)) NULL else id
}

#' Lo que trae otro `.pulso` en «Mis secciones», sin tocar este estudio.
#' @keywords internal
collection_mail_sections_import_peek <- function(sid, path) {
  session <- session_get(sid)
  path <- .cmail_import_path(path)
  stage <- tempfile("cmail_import_"); dir.create(stage)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  src <- .cmail_import_open(path, stage)
  mine <- .cmail_sections_of(.collection_current(session))
  cands <- .cmail_import_candidates(src$state, mine)
  list(
    ok = TRUE, project_name = src$name,
    same_project = identical(normalizePath(session$project_path %||% "", mustWork = FALSE), path),
    room = .CMAIL_SECTIONS_MAX - length(mine),
    sections = lapply(cands, function(x) c(.cmail_section_public(x$section)[c("section_id", "name", "block", "images")],
                                           list(importable = x$valida, already_here = x$ya_esta,
                                                photos = x$fotos, photos_missing = x$fotos_sin_archivo)))
  )
}

#' Copia secciones de otro `.pulso` (con sus fotos) a «Mis secciones» de este estudio.
#' @keywords internal
collection_mail_sections_import <- function(sid, expected_revision, path, section_ids) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  path <- .cmail_import_path(path)
  wanted <- unique(as.character(unlist(section_ids %||% list(), use.names = FALSE)))
  wanted <- wanted[!is.na(wanted) & nzchar(wanted)]
  if (!length(wanted)) .cmail_import_err("Elige al menos una sección.")
  stage <- tempfile("cmail_import_"); dir.create(stage)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  src <- .cmail_import_open(path, stage)
  sections <- .cmail_sections_of(current)
  cands <- .cmail_import_candidates(src$state, sections)
  cands <- Filter(function(x) x$section$section_id %in% wanted, cands)
  if (!length(cands)) stop_api(404, "E_COLLECTION_MAIL_SECTION_NOT_FOUND", "Esas secciones ya no están en el otro estudio.")
  nuevas <- Filter(function(x) x$valida && !x$ya_esta, cands)
  if (length(sections) + length(nuevas) > .CMAIL_SECTIONS_MAX) {
    stop_api(409, "E_COLLECTION_MAIL_SECTION_LIMIT",
             sprintf("Un estudio guarda hasta %d secciones: caben %d más.", .CMAIL_SECTIONS_MAX,
                     .CMAIL_SECTIONS_MAX - length(sections)))
  }
  fotos_src <- .cmail_image_latest(src$state$files, require_file = FALSE)
  copiadas <- list(); sin_foto <- 0L; renombradas <- 0L
  now <- .collection_now_iso()
  vistas <- character(0)
  for (x in nuevas) {
    # Dos secciones iguales en el origen entran una vez.
    huella <- .cmail_import_huella(x$section$name, x$section$block)
    if (huella %in% vistas) next
    vistas <- c(vistas, huella)
    block <- x$section$block
    block$block_id <- NULL
    block$guardado <- NULL
    images <- list()
    for (k in c("image_ref", "mobile_ref", "left", "right")) {
      id <- .cmail_one(block[[k]])
      if (is.null(id) || !nzchar(id)) next
      nuevo <- if (!is.null(fotos_src[[id]])) .cmail_import_photo(sid, id, fotos_src[[id]], src$entries, path, stage, copiadas)
      if (is.null(nuevo)) {
        # Sin su foto, el bloque no puede nombrar una imagen de este estudio con
        # el mismo id: mostraría una foto ajena. Va a un id libre y el editor
        # avisa que falta.
        sin_foto <- sin_foto + 1L
        aqui <- names(.cmail_image_latest(session_get(sid)$files, require_file = FALSE))
        if (id %in% aqui) block[[k]] <- .cmail_import_free_id(id, c(aqui, unlist(copiadas, use.names = FALSE)))
        next
      }
      if (is.null(copiadas[[id]]) && !identical(nuevo, id)) renombradas <- renombradas + 1L
      copiadas[[id]] <- nuevo
      block[[k]] <- nuevo
      e <- (x$section$images %||% list())[[id]]
      if (is.list(e)) images[[nuevo]] <- e
    }
    sections[[length(sections) + 1L]] <- list(
      section_id = .cmail_section_id(x$section$name, vapply(sections, function(y) y$section_id, "")),
      name = x$section$name, block = block, images = images, created_at = now, updated_at = now)
  }
  # Las fotos ya subidas pudieron mover la sesión; el estado del correo se
  # escribe sobre el vigente (save_upload sólo toca `files`).
  next_state <- if (length(nuevas)) .cmail_sections_commit(sid, .collection_current(session_get(sid)), sections) else current
  list(ok = TRUE, state_revision = as.integer(next_state$state_revision), project_name = src$name,
       imported = length(sections) - length(.cmail_sections_of(current)), already_here = sum(vapply(cands, function(x) isTRUE(x$ya_esta), TRUE)),
       not_readable = sum(vapply(cands, function(x) !isTRUE(x$valida), TRUE)),
       photos_renamed = renombradas, photos_missing = sin_foto,
       sections = lapply(.cmail_sections_of(next_state), .cmail_section_public))
}
