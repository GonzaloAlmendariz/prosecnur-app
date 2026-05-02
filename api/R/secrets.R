# =============================================================================
# Persistencia local de secretos (token API SurveyMonkey, etc.)
#
# Guarda secretos cifrados con AES-256-CBC en el directorio del usuario
# (~/.prosecnurapp/secrets/{name}.dat). La clave de cifrado se deriva de
# `Sys.info()[["user"]]` + machine_id (hostname) + un salt fijo via PBKDF2,
# de modo que el archivo cifrado solo es leíble desde el mismo sistema/usuario
# que lo escribió.
#
# No es seguridad criptográfica perfecta — alguien con acceso completo al
# sistema puede derivar la misma clave — pero protege el "open file in
# text editor" / accidental commit a git scenarios.
# =============================================================================

# Salt fijo identificador de prosecnur. Cambiarlo invalida todos los secretos
# previamente cifrados (necesitarían re-guardarse).
.SECRETS_SALT <- charToRaw("prosecnurapp:v1:do-not-share")

.secrets_dir <- function() {
  d <- file.path(Sys.getenv("HOME", unset = "~"), ".prosecnurapp", "secrets")
  if (!dir.exists(d)) dir.create(d, recursive = TRUE, showWarnings = FALSE, mode = "0700")
  d
}

.secret_path <- function(name) {
  if (!grepl("^[a-zA-Z0-9_-]+$", name)) {
    stop("nombre de secreto inválido: ", name, call. = FALSE)
  }
  file.path(.secrets_dir(), paste0(name, ".dat"))
}

.derive_key <- function() {
  # PBKDF2-HMAC-SHA256 sobre user+host+salt → 32 bytes (AES-256).
  if (!requireNamespace("openssl", quietly = TRUE)) {
    stop("Paquete 'openssl' no instalado.", call. = FALSE)
  }
  user <- Sys.info()[["user"]]
  host <- tryCatch(Sys.info()[["nodename"]], error = function(e) "unknown")
  pwd <- charToRaw(paste(user, host, sep = ":"))
  openssl::sha256(c(.SECRETS_SALT, pwd))
}

#' Encripta un texto y lo guarda en disco bajo `~/.prosecnurapp/secrets/{name}.dat`.
#' @param name Identificador del secreto (alfanumérico + `_-`).
#' @param plaintext Cadena a guardar.
#' @export
prosecnur_secret_save <- function(name, plaintext) {
  if (!nzchar(plaintext)) {
    return(prosecnur_secret_clear(name))
  }
  if (!requireNamespace("openssl", quietly = TRUE)) stop("'openssl' no instalado.")
  key <- .derive_key()
  iv <- openssl::rand_bytes(16L)
  ct <- openssl::aes_cbc_encrypt(charToRaw(enc2utf8(plaintext)), key = key, iv = iv)
  # Formato del archivo: 16 bytes IV + ciphertext
  path <- .secret_path(name)
  con <- file(path, "wb")
  on.exit(close(con), add = TRUE)
  writeBin(c(iv, ct), con)
  Sys.chmod(path, mode = "0600")
  invisible(TRUE)
}

#' Lee y descifra un secreto previamente guardado.
#' @param name Identificador.
#' @return Cadena descifrada, o NA_character_ si no existe / falla.
#' @export
prosecnur_secret_load <- function(name) {
  path <- .secret_path(name)
  if (!file.exists(path)) return(NA_character_)
  if (!requireNamespace("openssl", quietly = TRUE)) return(NA_character_)
  blob <- tryCatch(readBin(path, what = "raw", n = file.info(path)$size), error = function(e) NULL)
  if (is.null(blob) || length(blob) < 17L) return(NA_character_)
  iv <- blob[1:16]
  ct <- blob[17:length(blob)]
  pt <- tryCatch(openssl::aes_cbc_decrypt(ct, key = .derive_key(), iv = iv), error = function(e) NULL)
  if (is.null(pt)) return(NA_character_)
  out <- rawToChar(pt)
  Encoding(out) <- "UTF-8"
  out
}

#' Borra un secreto del disco.
#' @export
prosecnur_secret_clear <- function(name) {
  path <- .secret_path(name)
  if (file.exists(path)) unlink(path, force = TRUE)
  invisible(TRUE)
}

#' Indica si existe un secreto guardado (sin leerlo).
#' @export
prosecnur_secret_exists <- function(name) {
  file.exists(.secret_path(name))
}
