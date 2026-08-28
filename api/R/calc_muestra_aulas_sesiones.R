# calc_muestra_aulas_sesiones.R — el día, la hora y el aula que ya se sabían.
#
# La ficha que el aplicador lleva al aula tiene tres casillas que salían en
# blanco —«Pabellón y aula», «Horario del curso» y, con ellas, el curso y el
# docente— con el argumento de que «aquí casi ningún dato existe antes de entrar
# al aula». Para el pabellón y el horario eso no es cierto: el catálogo de
# cursos-horarios trae la columna `SESIONES`, que dice exactamente cuándo y
# dónde.
#
# Medido el 2026-08-27 sobre el libro de HSVG2026 (`207915-Cursos-Horarios
# 2026-2.xlsx`): **21.210 filas con dato**, que dan **30.207 sesiones sueltas**
# una vez separadas por `<br />`. Las **30.207 de 30.207** casan la misma
# gramática:
#
#     DIA HH:MM-HH:MM  <tipo>  [aula]
#     "MIE 17:00-20:00 C  A506"     -> miércoles de 5 a 8, aula A506
#     "MAR 10:00-12:00 C"           -> sin aula asignada
#     "LUN 16:00-18:00 C  L101<br />MIE 16:00-18:00 C  L220"  -> dos sesiones
#
# El `<tipo>` es la letra de tipo de sesión (C, H, I…), no el aula, y por eso se
# descarta: imprimir «C» bajo el rótulo «Pabellón y aula» sería peor que dejar la
# raya en blanco.
#
# Vive aparte porque `calc_muestra_aulas.R` está congelado a crecimiento; allí
# sólo quedan los enganches.

# El catálogo escribe `0000` donde no hay aula asignada. No es un aula: es el
# hueco con forma de dato, y llega a la ficha impresa como si lo fuera.
.CM_AULAS_SESION_SIN_AULA <- c("0000", "000", "-", "S/A", "N/A")

# Se tokeniza por espacios en vez de resolverlo con una sola expresión regular.
# La versión regular dejaba el aula como «C  L401» —la letra de tipo pegada al
# aula— porque los cuantificadores opcionales alrededor del tipo son ambiguos y
# el motor los resolvía a favor del grupo equivocado. Con tokens, cada posición
# dice lo que es y el fallo se ve en el acto.
.cm_aulas_sesion_partes <- function(sesion) {
  x <- trimws(as.character(sesion %||% "")[1])
  if (is.na(x) || !nzchar(x)) return(list(horario = "", aula = ""))
  tk <- strsplit(x, "\\s+")[[1]]
  tk <- tk[nzchar(tk)]
  dia_ok <- length(tk) >= 2L && grepl("^[A-Za-z]{3}$", tk[[1]])
  rango_ok <- length(tk) >= 2L && grepl("^[0-9]{1,2}:[0-9]{2}-[0-9]{1,2}:[0-9]{2}$", tk[[2]])
  # Sin la gramática esperada no se inventa una lectura: el string entero pasa
  # como horario, que es literalmente lo que el catálogo dijo, y el aula queda
  # vacía en vez de recibir un trozo elegido a ojo.
  if (!dia_ok || !rango_ok) return(list(horario = x, aula = ""))
  # tk[3] es la letra de tipo de sesión (C, H, I…); el aula es lo que sigue.
  aula <- if (length(tk) >= 4L) paste(tk[-seq_len(3L)], collapse = " ") else ""
  if (toupper(trimws(aula)) %in% .CM_AULAS_SESION_SIN_AULA) aula <- ""
  list(horario = paste(toupper(tk[[1]]), tk[[2]]), aula = trimws(aula))
}

.cm_aulas_sesiones_unir <- function(valores) {
  v <- trimws(as.character(valores %||% character(0)))
  v <- unique(v[!is.na(v) & nzchar(v)])
  if (!length(v)) return("")
  paste(v, collapse = " · ")
}

#' Descompone el `SESIONES` de un curso-horario en horario y aula.
#'
#' @param sesiones cadena del catálogo, con una o varias sesiones separadas por
#'   `<br />`.
#' @return lista con `horario` («MIE 17:00-20:00») y `aula` («A506»); varias
#'   sesiones se unen con « · » y sin repetir. Ambos pueden venir vacíos: un
#'   curso sin aula asignada existe, y su casilla vuelve a ser una raya.
#' @export
calc_muestra_aulas_sesiones_partes <- function(sesiones) {
  x <- trimws(as.character(sesiones %||% "")[1])
  if (is.na(x) || !nzchar(x)) return(list(horario = "", aula = ""))
  trozos <- trimws(unlist(strsplit(x, "<br\\s*/?>", perl = TRUE)))
  trozos <- trozos[nzchar(trozos)]
  if (!length(trozos)) return(list(horario = "", aula = ""))
  partes <- lapply(trozos, .cm_aulas_sesion_partes)
  list(
    horario = .cm_aulas_sesiones_unir(vapply(partes, function(p) p$horario, character(1))),
    aula = .cm_aulas_sesiones_unir(vapply(partes, function(p) p$aula, character(1)))
  )
}

#' Vector a vector, para anotar una tabla entera.
#'
#' @param sesiones vector de cadenas `SESIONES`.
#' @param parte `"horario"` o `"aula"`.
#' @return vector de caracteres del mismo largo.
#' @export
calc_muestra_aulas_sesiones_columna <- function(sesiones, parte = c("horario", "aula")) {
  parte <- match.arg(parte)
  v <- as.character(sesiones %||% character(0))
  if (!length(v)) return(character(0))
  vapply(v, function(x) calc_muestra_aulas_sesiones_partes(x)[[parte]], character(1), USE.NAMES = FALSE)
}

#' Anota `venue` y `sesiones_dia_hora` en la base, desde el catálogo.
#'
#' Se llama desde `.cm_aulas_enrich_with_catalog()`, con las claves ya
#' calculadas. Sigue el mismo contrato que el resto del enriquecido: **sólo
#' rellena donde no había dato**, para que una base que ya trae su propia
#' columna de aula mande sobre el catálogo.
#'
#' **Los nombres de estas dos columnas no son decorativos.** La primera versión
#' las llamó `pabellon_aula` y `horario_sesiones`, que es como se llaman en el
#' Sheet de 2025, y el aula se coló donde no debía: `mapping$classroom_label`
#' lleva el alias `aula`, y `.cm_aulas_col()` acepta que el nombre de la columna
#' esté CONTENIDO en el candidato, así que `pabellon_aula` fue capturada como si
#' fuera la etiqueta del aula. Consecuencia visible: `label` dejó de ser el
#' código académico y las 1.512 fichas pasaron a titularse «A501» y a llamarse
#' `CH 1 - A501.pdf` en vez de `CH 1 - MAT202_0591.pdf`.
#'
#' `venue` y `sesiones_dia_hora` están elegidos para no casar con ningún alias de
#' otro rol —ni con `classroom_label`, ni con `schedule`, ni con `session_type`—
#' y hay una prueba que lo sella. Antes de renombrarlas, comprobar eso.
#'
#' @param raw base madre ya limpia.
#' @param catalogo catálogo de cursos-horarios ya limpio.
#' @param raw_key,catalog_key claves de cruce de una y otro.
#' @param mapping mapeo vigente; de él sale qué columna es `SESIONES`.
#' @return `raw` con las dos columnas añadidas.
#' @export
calc_muestra_aulas_anotar_sesiones <- function(raw, catalogo, raw_key, catalog_key, mapping) {
  if (!is.data.frame(raw) || !nrow(raw)) return(raw)
  if (!is.data.frame(catalogo) || !nrow(catalogo)) return(raw)
  col <- .cm_aulas_col(catalogo, c(
    mapping$classroom_label, "SESIONES", "sesiones", "sesiones_y_aula", "horario_y_aula"
  ))
  if (!nzchar(col)) return(raw)
  valores <- .cm_aulas_values(catalogo, col, "")
  lookup <- function(parte) {
    partes <- calc_muestra_aulas_sesiones_columna(valores, parte)
    keys <- catalog_key[nzchar(catalog_key) & nzchar(partes)]
    vals <- partes[nzchar(catalog_key) & nzchar(partes)]
    if (!length(keys)) return(character(0))
    vapply(split(vals, keys), .cm_aulas_mode, character(1), default = "")
  }
  raw <- .cm_aulas_fill_from_lookup(raw, raw_key, "venue", lookup("aula"))
  .cm_aulas_fill_from_lookup(raw, raw_key, "sesiones_dia_hora", lookup("horario"))
}
