# Dato potencialmente personal en una columna fuera del formulario.
#
# Decisión de Gonzalo (2026-11-12, ítem 21 del checklist de Validación, ronda 2):
# en la reconciliación, una columna que parece dato personal viene SIN marcar
# aunque tenga dato, con el rótulo "Dato potencialmente personal identificado" y
# su causa en una línea. El usuario puede marcarla igual. Esta es la única
# función que lo decide; la usan el diálogo de variables extra y Carga > Revisión
# a través de `.reconciliacion_variables_extra`.
#
# Se mira primero el CONTENIDO (teléfono, DNI, correo, coordenada, dirección,
# nombre de persona) y, si no alcanza, el NOMBRE de la columna. Una regla de
# contenido pide al menos 3 valores con dato y que la forma se cumpla en casi
# todos (80 %; 60 % en direcciones, que se digitan con más variedad). La base
# del porcentaje son los casos con dato de esa columna.
#
# No son datos personales: el ubigeo (6 dígitos), un número de encuesta, fechas,
# horas, códigos cortos, un distrito de una palabra, una urbanización o zona
# (lleva URB, ZONA, DEL...) ni el texto libre largo.

.RECON_PERSONAL_MIN_VALORES <- 3L
.RECON_PERSONAL_UMBRAL <- 0.8
.RECON_PERSONAL_UMBRAL_DIRECCION <- 0.6

# Palabras que delatan un lugar y no a una persona.
.RECON_PERSONAL_PALABRAS_DE_LUGAR <- c(
  "URB", "URBANIZACION", "URBANIZACIÓN", "ZONA", "AAHH", "AA.HH", "AA.HH.", "ASOC", "ASOCIACION", "ASOCIACIÓN",
  "SECTOR", "MZ", "MZA", "LT", "LOTE", "JR", "JR.", "AV", "AV.", "AVENIDA", "CALLE", "PSJE", "PJE", "PASAJE",
  "COOP", "COOPERATIVA", "RESIDENCIAL", "VILLA", "PUEBLO", "BARRIO", "ETAPA", "CERCADO", "CONDOMINIO", "CENTRO",
  "POBLADO", "ANEXO", "COMUNIDAD", "CASERIO", "CASERÍO", "PARQUE", "PLAZA", "DEL", "LAS", "LOS"
)

# Pistas en el nombre de la columna (ya normalizado: minúsculas, sin tildes, con
# espacios entre palabras).
.RECON_PERSONAL_PISTAS_DE_NOMBRE <- list(
  "teléfono" = "\\b(tel|telf|telef|telefono|telefonos|fono|cel|celular|movil|whatsapp|wsp)\\b",
  "DNI" = "\\b(dni|documento|pasaporte|carnet)\\b",
  "correo electrónico" = "\\b(correo|email|e mail|mail)\\b",
  "dirección" = "\\b(direccion|domicilio)\\b",
  "nombre de persona" = "\\b(nombre|nombres|apellido|apellidos)\\b",
  "coordenada" = "\\b(lat|lon|lng|latitud|longitud|gps|coordenada|coordenadas)\\b"
)

.recon_personal_valores <- function(x) {
  v <- trimws(as.character(x))
  v[!is.na(x) & !is.na(v) & nzchar(v) & v != "[]"]
}

# Porcentaje para la causa: no se redondea a 100 si no son todos.
.recon_personal_pct <- function(k, n) {
  if (k >= n) return("100")
  as.character(min(99L, as.integer(round(100 * k / n))))
}

.recon_personal_causa <- function(tipo, detalle, k, n) {
  sprintf("Parece %s: %s en el %s %% de los casos con dato", tipo, detalle, .recon_personal_pct(k, n))
}

.recon_personal_digitos <- function(v) {
  # Sin quitar puntos: "23.10.2026" es una fecha, no un DNI.
  d <- gsub("[[:space:]()+-]", "", v)
  d[!grepl("^[0-9]+$", d)] <- NA_character_
  # Prefijo de país del Perú delante de un número de 9 dígitos.
  con_pais <- !is.na(d) & nchar(d) == 11L & startsWith(d, "51")
  d[con_pais] <- substring(d[con_pais], 3L)
  d
}

# AAAAMMDD con año entre 1900 y 2100 y un día que existe.
.recon_personal_es_fecha_compacta <- function(d) {
  ok <- !is.na(d) & nchar(d) == 8L & substring(d, 1L, 2L) %in% c("19", "20", "21")
  f <- rep(as.Date(NA), length(d))
  f[ok] <- suppressWarnings(as.Date(d[ok], format = "%Y%m%d"))
  !is.na(f)
}

.recon_personal_es_nombre <- function(v) {
  palabras <- strsplit(toupper(v), "[[:space:]]+")
  vapply(palabras, function(p) {
    p <- p[nzchar(p)]
    length(p) >= 2L && length(p) <= 4L &&
      all(grepl("^\\p{L}[\\p{L}'.-]*$", p, perl = TRUE)) &&
      !any(p %in% .RECON_PERSONAL_PALABRAS_DE_LUGAR)
  }, logical(1))
}

.recon_personal_es_direccion <- function(v) {
  vv <- toupper(v)
  via <- "^(AV|AVDA|AVENIDA|JR|JIRON|JIRÓN|CALLE|CA|CL|PSJE|PJE|PASAJE|PROLONG[A-ZÁÉÍÓÚ]*|CARRETERA|CARR|MZ|MZA|URB|AAHH|AA[.] ?HH|ASOC|COOP)\\b"
  numero <- "\\b(MZ|MZA|LT|NRO|N°|NUM)[.]? ?[A-Z0-9-]*[0-9]"
  grepl(via, vv, perl = TRUE) | grepl(numero, vv, perl = TRUE)
}

# Sospecha por contenido; NULL si ninguna forma alcanza.
.recon_personal_por_contenido <- function(v) {
  n <- length(v)
  if (n < .RECON_PERSONAL_MIN_VALORES) return(NULL)
  alcanza <- function(k, umbral = .RECON_PERSONAL_UMBRAL) k / n >= umbral

  k <- sum(grepl("^[^@[:space:]]+@[^@[:space:]]+[.][A-Za-z]{2,}$", v))
  if (alcanza(k)) return(.recon_personal_causa("correo electrónico", "tiene forma de correo", k, n))

  coord <- "^-?[0-9]{1,3}[.][0-9]{4,}([[:space:],;]+-?[0-9]{1,3}[.][0-9]{4,})?$"
  k <- sum(grepl(coord, v))
  if (alcanza(k)) return(.recon_personal_causa("coordenada", "número con 4 o más decimales", k, n))

  d <- .recon_personal_digitos(v)
  largo <- nchar(d)
  es_tel <- !is.na(d) & ((largo == 9L & substring(d, 1L, 1L) %in% c("9", "0")) | largo == 7L)
  k <- sum(es_tel)
  if (alcanza(k)) {
    largos <- sort(unique(largo[es_tel]))
    detalle <- if (length(largos) == 1L) sprintf("%d dígitos", largos) else sprintf("%d a %d dígitos", min(largos), max(largos))
    return(.recon_personal_causa("teléfono", detalle, k, n))
  }
  # Una fecha compacta (20260613) también tiene 8 dígitos: no es DNI.
  k <- sum(!is.na(d) & largo == 8L & !.recon_personal_es_fecha_compacta(d))
  if (alcanza(k)) return(.recon_personal_causa("DNI", "8 dígitos", k, n))

  k <- sum(.recon_personal_es_direccion(v))
  if (alcanza(k, .RECON_PERSONAL_UMBRAL_DIRECCION)) {
    return(.recon_personal_causa("dirección", "empieza con Av., Jr., Calle o trae manzana y lote", k, n))
  }

  k <- sum(.recon_personal_es_nombre(v))
  if (alcanza(k)) return(.recon_personal_causa("nombre de persona", "de 2 a 4 palabras sin números", k, n))
  NULL
}

.recon_personal_por_nombre <- function(nombre) {
  nn <- .dn_norm_text(nombre)
  if (!nzchar(nn)) return(NULL)
  for (tipo in names(.RECON_PERSONAL_PISTAS_DE_NOMBRE)) {
    if (grepl(.RECON_PERSONAL_PISTAS_DE_NOMBRE[[tipo]], nn, perl = TRUE)) {
      return(sprintf("Su nombre sugiere %s", tipo))
    }
  }
  NULL
}

#' ¿La columna `nombre` con valores `x` parece un dato personal?
#'
#' @return `list(sospecha = TRUE/FALSE, causa = "Parece teléfono: 9 dígitos en el
#'   97 % de los casos con dato")`; `causa` es "" cuando no hay sospecha.
#' @keywords internal
.reconciliacion_dato_personal <- function(nombre, x) {
  causa <- .recon_personal_por_contenido(.recon_personal_valores(x)) %||%
    .recon_personal_por_nombre(as.character(nombre %||% "")[1])
  if (is.null(causa)) return(list(sospecha = FALSE, causa = ""))
  list(sospecha = TRUE, causa = causa)
}
