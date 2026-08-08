# =============================================================================
# Enlace entre una base del estudio y la revisión publicada que la explica
# =============================================================================
#
# Una revisión publicada del Editor solo sirve si algo la consume. Los
# contratos de Validación (`instrument_validation_contract`) y de Analítica
# (`instrument_analysis_contract`) resuelven sus reglas leyendo
# `s$estudio$bases[[base]]$instrument_revision_id`, así que una base sin ese
# campo ignora por completo lo que el Editor selló.
#
# Hasta ahora ese campo lo escribían únicamente las vías de acreditación
# multiactor (`carga_acreditacion_sav.R`, `carga_acreditacion_batch.R`) y el
# bundle SAV de SurveyMonkey. En un estudio de una sola base —manual, Kobo,
# telefónico, territorial— publicar no tenía ningún efecto: la UI pedía el
# ritual completo y Procesamiento nunca se enteraba.
#
# Este módulo cierra ese hueco para cualquier estudio, sin adivinar:
#
#   La base queda ligada a una revisión SOLO si el XLSForm que efectivamente
#   se cargó tiene el mismo hash canónico que la revisión publicada.
#
# El hash es el de `.xlsform_revision_hash()`: se calcula sobre survey/choices/
# settings normalizados, ignora las columnas `paper_*` de la capa de edición y
# no mira los bytes del ZIP. Por eso un XLSForm exportado desde el Editor —en
# su variante Kobo/ODK o en la variante Prosecnur— vuelve a dar exactamente el
# hash con el que se selló la revisión.
#
# La consecuencia deliberada es que el enlace es conservador: si el usuario
# pasó el archivo por Excel, lo bajó de Kobo o lo editó a mano, el hash cambia
# y NO se liga nada. Preferimos una base sin revisión a una base ligada a un
# instrumento que no es el suyo, porque el `instrument_revision_id` es lo que
# autoriza reglas de validación y exclusiones analíticas.
#
# El estado del intento queda registrado en la propia base para que la UI pueda
# explicar por qué una revisión publicada no está surtiendo efecto.
# =============================================================================

# Ninguna revisión publicada en el proyecto todavía.
.INSTRUMENT_REVISION_BINDING_NONE <- "none_published"
# Hay revisiones, pero ninguna coincide con el XLSForm cargado.
.INSTRUMENT_REVISION_BINDING_NO_MATCH <- "no_match"
# El XLSForm de la base coincide exactamente con una revisión publicada.
.INSTRUMENT_REVISION_BINDING_MATCHED <- "matched"
# El XLSForm de la base no se pudo leer para compararlo.
.INSTRUMENT_REVISION_BINDING_UNREADABLE <- "unreadable"

# Estados que este módulo escribe. Solo pisamos un `instrument_revision_id`
# cuando el binding vigente también salió de acá: los que vienen del plan de
# ingreso de acreditación o del bundle SAV mandan sobre el nuestro.
.INSTRUMENT_REVISION_BINDING_OWNED <- c(
  .INSTRUMENT_REVISION_BINDING_NONE,
  .INSTRUMENT_REVISION_BINDING_NO_MATCH,
  .INSTRUMENT_REVISION_BINDING_MATCHED,
  .INSTRUMENT_REVISION_BINDING_UNREADABLE
)

.instrument_revision_binding_scalar <- function(value, default = "") {
  if (is.null(value) || !length(value)) return(default)
  out <- as.character(value[[1]])
  if (is.na(out)) return(default)
  trimws(out)
}

#' Lee un XLSForm físico y devuelve el workbook canónico del editor.
#'
#' Es el puente entre un `.xlsx` en disco y la forma que consume
#' `.xlsform_revision_hash()`. Lanza error si el archivo no conserva las tres
#' hojas canónicas o si `survey`/`choices` perdieron sus columnas mínimas.
#'
#' @param path Ruta al XLSForm.
#' @return Workbook con las hojas survey/choices/settings.
instrument_revision_workbook_from_xlsx <- function(path) {
  sheets <- readxl::excel_sheets(path)
  lower <- tolower(sheets)
  required <- c("survey", "choices", "settings")
  if (length(setdiff(required, lower))) {
    stop("El snapshot no conserva las tres hojas canónicas.", call. = FALSE)
  }
  read_sheet <- function(name) {
    defaults <- .xlsform_editor_default_columns(name)
    out <- .xlsform_editor_read_sheet(path, name, defaults)
    if (is.null(out) || ncol(out) == 0L) {
      out <- as.data.frame(
        stats::setNames(lapply(defaults, function(column) character(0)), defaults),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    }
    out
  }
  survey <- read_sheet("survey")
  choices <- read_sheet("choices")
  settings <- read_sheet("settings")
  if (!all(c("type", "name") %in% tolower(names(survey)))) {
    stop("La hoja survey no conserva type y name.", call. = FALSE)
  }
  if (ncol(choices) && !all(c("list_name", "name") %in% tolower(names(choices)))) {
    stop("La hoja choices no conserva list_name y name.", call. = FALSE)
  }
  .xlsform_editor_workbook_payload(list(
    survey = survey,
    choices = choices,
    settings = settings
  ))$workbook
}

#' Revisión publicada cuyo contenido canónico coincide con un hash.
#'
#' Si más de una revisión comparte el hash —dos formularios con instrumentos
#' idénticos— gana la de `revision_no` más alto, y a igualdad la publicada más
#' tarde. Es determinista y no depende del orden de la lista.
#'
#' @param s Estado de sesión.
#' @param content_sha256 Hash canónico a buscar.
#' @return La revisión, o NULL si ninguna coincide.
.instrument_revision_published_for_hash <- function(s, content_sha256) {
  content_sha256 <- .instrument_revision_binding_scalar(content_sha256)
  if (!nzchar(content_sha256)) return(NULL)
  revisions <- (s %||% list())$instrument_revisions %||% list()
  hits <- Filter(function(item) {
    identical(
      .instrument_revision_binding_scalar((item %||% list())$content_sha256),
      content_sha256
    )
  }, unname(revisions))
  if (!length(hits)) return(NULL)
  revision_no <- vapply(hits, function(item) {
    value <- suppressWarnings(as.integer(item$revision_no %||% 0L)[1])
    if (is.na(value)) 0L else value
  }, integer(1))
  published <- vapply(hits, function(item) {
    .instrument_revision_binding_scalar(item$published_at)
  }, character(1))
  hits[[order(revision_no, published, decreasing = TRUE)[[1]]]]
}

#' Hash canónico del XLSForm que tiene cargado una base.
#'
#' @return Lista con `ok`, `hash` y `reason` cuando no se pudo calcular.
.instrument_revision_base_hash <- function(s, base_meta) {
  file_id <- .instrument_revision_binding_scalar(base_meta$xlsform_file_id)
  meta <- ((s %||% list())$files %||% list())[[file_id]] %||% NULL
  path <- .instrument_revision_binding_scalar((meta %||% list())$path)
  if (!nzchar(file_id) || is.null(meta) || !nzchar(path) || !file.exists(path)) {
    return(list(ok = FALSE, hash = "", reason = "El XLSForm de la base no está disponible en disco."))
  }
  hash <- tryCatch(
    .xlsform_revision_hash(instrument_revision_workbook_from_xlsx(path)),
    error = function(e) e
  )
  if (inherits(hash, "error")) {
    return(list(ok = FALSE, hash = "", reason = conditionMessage(hash)))
  }
  list(ok = TRUE, hash = hash, reason = "")
}

#' Liga (o deslíga) una base con la revisión publicada que le corresponde.
#'
#' Es idempotente y no lanza: se llama como enriquecimiento al final de la
#' carga, y una carga válida no puede fallar porque el Editor tenga o no
#' revisiones. Respeta los enlaces que hayan puesto el plan de ingreso de
#' acreditación o el bundle SAV: si la base los tiene, sale sin tocar nada.
#'
#' @param sid Sesión.
#' @param base_nombre Nombre de la base dentro de `s$estudio$bases`.
#' @return Invisible: la metadata de binding aplicada, o NULL si no aplicó.
instrument_revision_bind_base <- function(sid, base_nombre) {
  base_nombre <- .instrument_revision_binding_scalar(base_nombre)
  if (!nzchar(base_nombre)) return(invisible(NULL))
  s <- session_get(sid, required = FALSE)
  base_meta <- (((s %||% list())$estudio %||% list())$bases %||% list())[[base_nombre]] %||% NULL
  if (is.null(base_meta)) return(invisible(NULL))

  # El plan de ingreso de acreditación materializa la base con su propio
  # enlace y su propia familia de hermanos. Ese binding es autoridad.
  if (nzchar(.instrument_revision_binding_scalar(base_meta$processing_intake_entry_id))) {
    return(invisible(NULL))
  }
  previous_state <- .instrument_revision_binding_scalar(base_meta$instrument_revision_binding)
  previous_id <- .instrument_revision_binding_scalar(base_meta$instrument_revision_id)
  if (nzchar(previous_id) && !(previous_state %in% .INSTRUMENT_REVISION_BINDING_OWNED)) {
    return(invisible(NULL))
  }

  revisions <- (s %||% list())$instrument_revisions %||% list()
  if (!length(revisions)) {
    return(invisible(.instrument_revision_binding_apply(
      sid, base_nombre,
      state = .INSTRUMENT_REVISION_BINDING_NONE,
      revision = NULL,
      hash = "",
      detail = ""
    )))
  }

  hashed <- .instrument_revision_base_hash(s, base_meta)
  if (!isTRUE(hashed$ok)) {
    return(invisible(.instrument_revision_binding_apply(
      sid, base_nombre,
      state = .INSTRUMENT_REVISION_BINDING_UNREADABLE,
      revision = NULL,
      hash = "",
      detail = hashed$reason
    )))
  }

  revision <- .instrument_revision_published_for_hash(s, hashed$hash)
  if (is.null(revision)) {
    return(invisible(.instrument_revision_binding_apply(
      sid, base_nombre,
      state = .INSTRUMENT_REVISION_BINDING_NO_MATCH,
      revision = NULL,
      hash = hashed$hash,
      detail = paste0(
        "El XLSForm cargado no coincide con ninguna revisión publicada. ",
        "Exporta el instrumento desde el Editor y vuelve a cargarlo, o publica ",
        "una revisión del formulario que estás usando."
      )
    )))
  }

  invisible(.instrument_revision_binding_apply(
    sid, base_nombre,
    state = .INSTRUMENT_REVISION_BINDING_MATCHED,
    revision = revision,
    hash = hashed$hash,
    detail = ""
  ))
}

# Escribe el resultado del intento en la base. Separado para que las cinco
# salidas de `instrument_revision_bind_base` compartan una sola forma.
.instrument_revision_binding_apply <- function(sid, base_nombre, state, revision,
                                               hash, detail) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null((s$estudio %||% list())$bases[[base_nombre]])) {
    return(NULL)
  }
  meta <- s$estudio$bases[[base_nombre]]
  matched <- identical(state, .INSTRUMENT_REVISION_BINDING_MATCHED)
  meta$instrument_revision_id <- if (matched) {
    .instrument_revision_binding_scalar(revision$revision_id)
  } else {
    ""
  }
  meta$instrument_revision_hash <- if (matched) {
    .instrument_revision_binding_scalar(revision$content_sha256)
  } else {
    ""
  }
  meta$instrument_revision_binding <- state
  meta$instrument_revision_binding_detail <- .instrument_revision_binding_scalar(detail)
  meta$instrument_revision_binding_hash <- .instrument_revision_binding_scalar(hash)
  meta$instrument_revision_bound_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  s$estudio$bases[[base_nombre]] <- meta
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  meta
}
