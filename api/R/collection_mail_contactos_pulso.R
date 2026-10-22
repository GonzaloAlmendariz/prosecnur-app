# collection_mail_contactos_pulso.R — los contactos de las campañas de correo
# viajan en el `.pulso` (ADR 0112 §1 y §5).
#
# En la sesión, el store de cada campaña sigue en el directorio temporal
# (`<session$dir>/mail_recipients/<campaign_id>/recipients.rds`,
# collection_mail_recipients.R). Al guardar, build_pulso copia cada store de
# una campaña del proyecto a `files/contactos/<campaign_id>.rds` y lo declara en
# `manifest.json` (`contactos`: ruta, campaña, filas y huella, con
# `sensitivity: personal_data`; nunca un correo). Al abrir, load_pulso los
# devuelve a la carpeta de la sesión nueva. Nunca entran a `state.rds`.
#
# El anonimizador vacía `files/contactos/` y quita la entrada del manifest; el
# detector de PII marca cualquier archivo que quede ahí.

.CMAIL_CONTACTOS_ZIP_DIR <- "contactos"
.CMAIL_CONTACTOS_SCHEMAS <- c("collection_mail_recipients/v1")

# Campañas cuyos contactos se guardan: las del proyecto; sin campañas, la
# virtual `correo-1` (la que crea el primer guardado de la plantilla).
.cmail_contactos_campaign_ids <- function(s) {
  state <- s$collection_state
  ids <- if (is.list(state)) {
    vapply(.cmail_campaigns_of(state)$campaigns, function(c) as.character(c$campaign_id), "")
  } else character(0)
  if (!length(ids)) ids <- .CMAIL_CAMPAIGN_DEFAULT_ID
  ids[vapply(ids, .cmail_campaign_id_ok, NA)]
}

.cmail_contactos_store_ok <- function(store) {
  is.list(store) && identical(as.character(store$schema %||% "")[1] %in% .CMAIL_CONTACTOS_SCHEMAS, TRUE) &&
    is.data.frame(store$rows) && is.list(store$mapping)
}

#' Copia los contactos de la sesión al staging del `.pulso`.
#' @return lista de entradas del manifest (vacía si no hay contactos).
#' @keywords internal
.cmail_contactos_pack <- function(s, stage_dir) {
  if (is.null(s$dir)) return(list())
  ids <- .cmail_contactos_campaign_ids(s)
  # Un recipients.rds de la raíz (versión de una sola plantilla) es de la única campaña.
  if (length(ids) == 1L) .cmail_recipients_adopt_legacy(s, ids[[1]])
  out <- list()
  for (id in ids) {
    src <- .cmail_recipients_path(s, id)
    if (!file.exists(src)) next
    store <- tryCatch(readRDS(src), error = function(e) NULL)
    if (!.cmail_contactos_store_ok(store)) next
    dst_dir <- file.path(stage_dir, "files", .CMAIL_CONTACTOS_ZIP_DIR)
    dir.create(dst_dir, recursive = TRUE, showWarnings = FALSE)
    dst <- file.path(dst_dir, paste0(id, ".rds"))
    saveRDS(store, dst, version = 3, compress = "xz")
    out[[length(out) + 1L]] <- list(
      path = paste0("files/", .CMAIL_CONTACTOS_ZIP_DIR, "/", id, ".rds"),
      campaign_id = id,
      sensitivity = "personal_data",
      rows = as.integer(nrow(store$rows)),
      sha256 = paste0("sha256:", tolower(digest::digest(file = dst, algo = "sha256")))
    )
  }
  out
}

#' Devuelve los contactos del `.pulso` (staging descomprimido) a la sesión nueva.
#' @return ids de campaña restaurados.
#' @keywords internal
.cmail_contactos_unpack <- function(stage_dir, session) {
  dir <- file.path(stage_dir, "files", .CMAIL_CONTACTOS_ZIP_DIR)
  if (!dir.exists(dir) || is.null(session$dir)) return(character(0))
  # El modo público nunca carga datos personales a disco.
  if (isTRUE(is_public_mode())) return(character(0))
  restored <- character(0)
  for (f in list.files(dir, pattern = "\\.rds$", full.names = TRUE)) {
    id <- sub("\\.rds$", "", basename(f))
    if (!.cmail_campaign_id_ok(id)) next
    store <- tryCatch(readRDS(f), error = function(e) NULL)
    if (!.cmail_contactos_store_ok(store)) {
      message(sprintf("[collection_mail] contactos de %s ilegibles en el .pulso: se omiten", id))
      next
    }
    .cmail_recipients_save(session, id, store)
    restored <- c(restored, id)
  }
  restored
}

#' Cuántas campañas llevan contactos en la sesión (aviso de la barra al guardar).
#' @keywords internal
.cmail_contactos_count <- function(s) {
  if (is.null(s) || is.null(s$dir)) return(0L)
  ids <- tryCatch(.cmail_contactos_campaign_ids(s), error = function(e) character(0))
  as.integer(sum(vapply(ids, function(id) file.exists(.cmail_recipients_path(s, id)), NA)))
}

#' Anonimizador: vacía `files/contactos/` del staging y quita su entrada del manifest.
#' @return número de archivos de contactos retirados.
#' @keywords internal
.cmail_contactos_anon_vaciar <- function(stage) {
  dir <- file.path(stage, "files", .CMAIL_CONTACTOS_ZIP_DIR)
  n <- if (dir.exists(dir)) length(list.files(dir, recursive = TRUE, all.files = TRUE, no.. = TRUE)) else 0L
  unlink(dir, recursive = TRUE, force = TRUE)
  manifest_path <- file.path(stage, "manifest.json")
  if (file.exists(manifest_path)) {
    manifest <- jsonlite::fromJSON(manifest_path, simplifyVector = FALSE)
    if (!is.null(manifest$contactos)) {
      manifest$contactos <- NULL
      writeLines(jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE), manifest_path)
    }
  }
  as.integer(n)
}

#' Detector de PII: cualquier archivo en `files/contactos/` es un hallazgo.
#' @keywords internal
.cmail_contactos_hallazgos <- function(stage) {
  dir <- file.path(stage, "files", .CMAIL_CONTACTOS_ZIP_DIR)
  files <- if (dir.exists(dir)) list.files(dir, recursive = TRUE, all.files = TRUE, no.. = TRUE) else character(0)
  if (!length(files)) return(NULL)
  data.frame(ruta = paste0("files/", .CMAIL_CONTACTOS_ZIP_DIR), columna = "(archivo)", tipo = "contactos",
             n = length(files), ejemplo = paste(utils::head(files, 3L), collapse = " | "), stringsAsFactors = FALSE)
}
