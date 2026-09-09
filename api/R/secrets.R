# =============================================================================
# Persistencia local de secretos (token API SurveyMonkey, etc.)
#
# Guarda secretos cifrados con AES-256-CBC en el directorio del usuario
# (~/.prosecnurapp/secrets/{name}.dat). La clave de cifrado se deriva con un
# ÚNICO SHA-256 sobre salt fijo + `Sys.info()[["user"]]` + hostname (NO es un
# KDF con iteraciones tipo PBKDF2/scrypt), de modo que el archivo cifrado solo
# es leíble desde el mismo sistema/usuario que lo escribió.
#
# Threat model honesto: los insumos de la clave (user, hostname, salt en el
# fuente) son públicos para cualquiera con acceso a esta máquina, así que un
# atacante local puede derivar la misma clave trivialmente — un KDF lento no
# cambiaría eso, porque aquí no hay passphrase secreta que estirar. Lo que SÍ
# cubre: abrir el .dat en un editor de texto, commits accidentales a git, y
# copiar el archivo a otra máquina/usuario (allí no descifra).
#
# Migrar a un KDF real (con passphrase del usuario) exigiría una migración de
# los secretos ya cifrados (descifrar con la clave actual y re-cifrar): es una
# unidad futura deliberada, no un cambio drop-in en la derivación.
#
# LA CLAVE YA NO DEPENDE DEL HOSTNAME, Y ESO NO ES COSMÉTICA
#
# El 2026-09-08, en pleno campo, TODOS los conectores dejaron de abrirse a la
# vez —Sheets, Kobo, SurveyMonkey— con «Falta autorizacion local». Los `.dat`
# estaban intactos. La causa: en macOS `Sys.info()[["nodename"]]` devuelve la
# IP de la máquina (`192.168.1.8`), así que la clave cambiaba al cambiar de red
# o al renovarse el DHCP. Un token guardado a las 17:34 era ilegible a las
# 20:45 sin que nadie hubiera tocado nada, y no había forma de volver a
# autorizar porque el cliente OAuth estaba cifrado con la misma clave.
#
# Ahora la clave sale de un archivo propio de la instalación
# (`.secrets_dir()/.key`, 32 bytes aleatorios, permisos 600) que se crea la
# primera vez. Cubre lo mismo que antes —copiar un `.dat` a otra máquina no
# sirve, porque allí no está esta clave— y además no se cae sola.
#
# El esquema viejo NO se retira: se sigue probando al leer, y un secreto que
# abra con él se re-cifra al vuelo con la nueva clave. Así nadie tiene que
# volver a autorizar nada por este cambio; los que ya estaban rotos por el
# hostname siguen rotos, que no es algo que este código pueda deshacer.
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

# La clave LEGADA: salt||user:host. Se conserva sólo para poder abrir lo que se
# cifró con ella y migrarlo; nada nuevo se escribe así.
.derive_key_legado <- function() {
  if (!requireNamespace("openssl", quietly = TRUE)) {
    stop("Paquete 'openssl' no instalado.", call. = FALSE)
  }
  user <- Sys.info()[["user"]]
  host <- tryCatch(Sys.info()[["nodename"]], error = function(e) "unknown")
  pwd <- charToRaw(paste(user, host, sep = ":"))
  openssl::sha256(c(.SECRETS_SALT, pwd))
}

# El archivo de clave de esta instalación. 32 bytes aleatorios, creados una vez
# y sólo legibles por el dueño. No lleva extensión `.dat` a propósito: así no
# entra en ningún barrido de secretos ni se confunde con uno.
.secret_key_path <- function() file.path(.secrets_dir(), ".key")

.derive_key <- function() {
  if (!requireNamespace("openssl", quietly = TRUE)) {
    stop("Paquete 'openssl' no instalado.", call. = FALSE)
  }
  path <- .secret_key_path()
  if (file.exists(path)) {
    k <- tryCatch(readBin(path, what = "raw", n = 32L), error = function(e) NULL)
    if (!is.null(k) && length(k) == 32L) return(k)
  }
  k <- openssl::rand_bytes(32L)
  # Escritura atómica: un `.key` a medio escribir dejaría ilegibles todos los
  # secretos de la instalación, que es exactamente el fallo que este cambio
  # existe para evitar.
  tmp <- paste0(path, ".tmp")
  con <- file(tmp, open = "wb"); on.exit(close(con), add = TRUE)
  writeBin(k, con); close(con); on.exit()
  Sys.chmod(tmp, mode = "0600")
  file.rename(tmp, path)
  k
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
  migrar <- FALSE
  if (is.null(pt)) {
    # Escrito con el esquema viejo: se abre con la clave legada y se re-cifra
    # con la de la instalación, para que no vuelva a depender de la red.
    pt <- tryCatch(openssl::aes_cbc_decrypt(ct, key = .derive_key_legado(), iv = iv),
                   error = function(e) NULL)
    migrar <- !is.null(pt)
  }
  if (is.null(pt)) return(NA_character_)
  out <- rawToChar(pt)
  Encoding(out) <- "UTF-8"
  if (migrar) tryCatch(prosecnur_secret_save(name, out), error = function(e) NULL)
  out
}

#' ¿Hay un secreto guardado que NO se puede descifrar?
#'
#' Existe porque los dos casos se contaban igual y costaban lo mismo de
#' diagnosticar: «no hay token» y «hay token y no abre» daban ambos «Falta
#' autorizacion local», y el segundo mandó a buscar una sesión caducada de
#' Google durante un cuarto de hora en pleno campo. Quien pregunte por la
#' credencial puede ahora decir cuál de las dos cosas pasa.
#' @param name Identificador del secreto.
#' @return `TRUE` si el archivo existe y ninguna clave lo abre.
#' @export
prosecnur_secret_locked <- function(name) {
  path <- .secret_path(name)
  if (!file.exists(path)) return(FALSE)
  is.na(prosecnur_secret_load(name))
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

# =============================================================================
# Secretos efímeros por sesión
#
# Estos valores viven solo en memoria del proceso R y no forman parte del
# objeto de sesión que serializa `.pulso`. Sirven para flujos donde el usuario
# no quiere persistir un token en disco, pero sí usarlo durante la sesión local.
# =============================================================================

.SESSION_SECRETS <- new.env(parent = emptyenv())

.session_secret_key <- function(sid, name) {
  sid <- as.character(sid)[1]
  name <- as.character(name)[1]
  if (is.na(sid) || !nzchar(sid)) {
    stop("sid requerido para secreto de sesión.", call. = FALSE)
  }
  if (is.na(name) || !grepl("^[a-zA-Z0-9_-]+$", name)) {
    stop("nombre de secreto de sesión inválido: ", name, call. = FALSE)
  }
  paste(sid, name, sep = "::")
}

prosecnur_session_secret_save <- function(sid, name, plaintext) {
  if (is.null(plaintext) || length(plaintext) == 0L ||
      is.na(as.character(plaintext)[1]) || !nzchar(as.character(plaintext)[1])) {
    return(prosecnur_session_secret_clear(sid, name))
  }
  .SESSION_SECRETS[[.session_secret_key(sid, name)]] <- enc2utf8(as.character(plaintext)[1])
  invisible(TRUE)
}

prosecnur_session_secret_load <- function(sid, name) {
  key <- .session_secret_key(sid, name)
  if (!exists(key, envir = .SESSION_SECRETS, inherits = FALSE)) return(NA_character_)
  value <- .SESSION_SECRETS[[key]]
  if (is.null(value)) NA_character_ else value
}

prosecnur_session_secret_clear <- function(sid, name) {
  key <- .session_secret_key(sid, name)
  if (exists(key, envir = .SESSION_SECRETS, inherits = FALSE)) {
    rm(list = key, envir = .SESSION_SECRETS)
  }
  invisible(TRUE)
}

prosecnur_session_secret_exists <- function(sid, name) {
  exists(.session_secret_key(sid, name), envir = .SESSION_SECRETS, inherits = FALSE)
}

prosecnur_session_secrets_clear_all <- function(sid) {
  sid <- as.character(sid)[1]
  if (is.na(sid) || !nzchar(sid)) return(invisible(TRUE))
  prefix <- paste0(sid, "::")
  keys <- ls(.SESSION_SECRETS, all.names = TRUE)
  targets <- keys[startsWith(keys, prefix)]
  if (length(targets)) rm(list = targets, envir = .SESSION_SECRETS)
  invisible(TRUE)
}
