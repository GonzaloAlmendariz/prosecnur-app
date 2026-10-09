# El nombre de un aplicador, escrito como se escribe un nombre.
#
# Dictado de Gonzalo (2026-09-04): «necesita tener el nombre, y eso es
# importante, el nombre normalizado: apellido, coma, nombre y nombre. Y SIEMPRE
# tiene que ser así, y en mayúsculas donde sea y en minúsculas donde debe
# corresponder».
#
# Ese «siempre» es lo que trae la regla al backend. La vista de Asignación ya
# normalizaba al pintar, pero el LIBRO y el Google Sheets —que son lo que el
# equipo de campo lee— seguían sacando el nombre crudo del libro de
# disponibilidad: `Castillo SOLORSANO , LEIDY VIVIANA`, `Chávez Espinoza ,
# Alondra Cristina`. Arreglar sólo la pantalla dejaba el defecto justo donde se
# ve fuera de la app.
#
# Es PRESENTACIÓN, nunca identidad: el nombre crudo es la clave con la que el
# motor arma `reparto_fijado` y con la que vuelve una fijación. Se normaliza al
# ESCRIBIR una salida, jamás lo que se guarda o se compara.
#
# Espejo exacto de `frontend/src/features/monitoreo/profiles/aulas/
# nombreDeAplicador.ts`. Los dos juegos de casos son los mismos a propósito: si
# alguien cambia uno, el test del otro lo delata.

# Partículas que van en minúscula cuando no abren su bloque: `De La Cruz` abre
# el apellido y se respeta, pero `Ramos De La Cruz` es `Ramos de la Cruz`.
.ana_PARTICULAS <- c(
  "de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos",
  "van", "von", "di", "der", "den", "el", "san"
)

# Capitaliza respetando guiones y apóstrofos (`d'angelo` da `D'Angelo`).
.ana_capitalizar <- function(palabra) {
  gsub("(^|[-'’])(\\p{L})", "\\1\\U\\2", palabra, perl = TRUE)
}

# Un bloque (los apellidos, o los nombres), palabra por palabra.
.ana_bloque <- function(texto) {
  palabras <- strsplit(texto, "[[:space:]]+")[[1]]
  palabras <- palabras[nzchar(palabras)]
  if (!length(palabras)) return("")
  bajas <- tolower(palabras)
  salida <- vapply(seq_along(bajas), function(i) {
    # La partícula sólo se agacha si alguien la precede dentro del bloque.
    if (i > 1L && bajas[[i]] %in% .ana_PARTICULAS) bajas[[i]]
    else .ana_capitalizar(bajas[[i]])
  }, character(1))
  paste(salida, collapse = " ")
}

#' El nombre de un aplicador para MOSTRAR.
#'
#' `Castillo SOLORSANO , LEIDY VIVIANA` queda `Castillo Solorsano, Leidy
#' Viviana`. Sin coma se normaliza igual, en un solo bloque: no se reordena lo
#' que no se sabe separar. Un nombre vacío devuelve `""`, nunca un guion
#' inventado.
#'
#' @param crudo el nombre tal como llegó del libro de disponibilidad.
#' @return el nombre para mostrar; nunca para comparar ni para guardar.
#' @keywords internal
aulas_nombre_aplicador <- function(crudo) {
  x <- as.character(crudo %||% "")[1]
  if (length(x) == 0L || is.na(x)) return("")
  limpio <- trimws(gsub("[[:space:]]+", " ", x))
  if (!nzchar(limpio)) return("")
  partes <- trimws(strsplit(limpio, ",", fixed = TRUE)[[1]])
  partes <- partes[nzchar(partes)]
  if (!length(partes)) return("")
  paste(vapply(partes, .ana_bloque, character(1)), collapse = ", ")
}

#' La clave de COMPARACIÓN de un nombre de aplicador.
#'
#' El nombre crudo sigue siendo la identidad (arriba); pero una fijada adoptada
#' del Sheets de distribución vuelve con el nombre ya escrito para mostrar
#' —«Chamorro Rodriguez, Rosa Alejandrina»— y la disponibilidad lo guarda crudo
#' —«CHAMORRO RODRIGUEZ, ROSA ALEJANDRINA»—. Compararlos tal cual partía a cada
#' aplicador en dos dentro del reparto (medido en CCSS el 2026-09-23: la
#' equidad listaba diez aplicadores para cinco personas). La clave es el nombre
#' normalizado, sin mayúsculas ni tildes.
#' @keywords internal
.ana_clave <- function(x) {
  n <- vapply(as.character(x), aulas_nombre_aplicador, character(1), USE.NAMES = FALSE)
  # En macOS `iconv` translitera «á» como «'a» y «ñ» como «~n»: lo que no es
  # letra, coma o espacio se descarta DESPUÉS de transliterar.
  k <- gsub("[^a-z, ]", "", tolower(iconv(n, from = "UTF-8", to = "ASCII//TRANSLIT", sub = "")))
  # Un nombre que no se pudo transliterar (NA) o sin letras no es una clave:
  # dos vacíos no son la misma persona.
  k[is.na(k)] <- ""
  trimws(k)
}

#' Las fijadas, con su aplicador escrito como lo tiene la oferta.
#'
#' Una fijada cuyo nombre casa (por `.ana_clave`) con un aplicador de la oferta
#' pasa a llevar el nombre de la oferta; una que no casa con ninguno se deja
#' como viene —es un externo y el reparto ya sabe tratarlo—.
#'
#' @param fij lista nombrada código → aplicador.
#' @param nombres los nombres de la oferta.
#' @keywords internal
.marep_fijadas_a_la_oferta <- function(fij, nombres) {
  if (!length(fij) || !length(nombres)) return(fij)
  claves <- .ana_clave(nombres)
  for (cod in names(fij)) {
    k <- .ana_clave(fij[[cod]])
    if (!nzchar(k)) next
    i <- match(k, claves)
    if (!is.na(i)) fij[[cod]] <- nombres[[i]]
  }
  fij
}
