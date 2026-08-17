#' Facultades excluidas del marco por decisión de diseño
#'
#' Hay unidades académicas que no participan del estudio —posgrado, escuelas de
#' estudios especiales— y hasta ahora nadie lo decía: quedaban fuera de rebote,
#' porque `exclude_level_patterns` busca las palabras «posgrado», «maestria» o
#' «doctorado` dentro de la columna `level`, y en las bases reales `level` es un
#' número de ciclo. El patrón no coincidía nunca, así que la exclusión la hacía
#' de hecho `min_eligible_per_class`: las aulas de posgrado son pequeñas y caían
#' por tamaño. Las que superaban el mínimo entraban al marco sin que nada las
#' parara —en HSVG2026 fueron dos, de Ingeniería Civil, con 17 y 16 elegibles—.
#'
#' Excluir por tamaño no es excluir por diseño: basta bajar el mínimo, o que un
#' posgrado tenga aulas grandes, para que vuelva a entrar. Por eso la exclusión
#' se declara ahora en una lista explícita y editable, y no se deduce de otro
#' filtro.
#'
#' @keywords internal
NULL

#' Normaliza un nombre de facultad para compararlo
#'
#' Sin acentos, sin mayúsculas y sin espacios de más: la lista la escribe una
#' persona y la base la escribe la universidad, y no siempre coinciden en el
#' detalle tipográfico.
#'
#' @keywords internal
.cm_aulas_facultad_clave <- function(x) {
  v <- as.character(x %||% "")
  v[is.na(v)] <- ""
  v <- toupper(trimws(v))
  # `iconv(to = "ASCII//TRANSLIT")` depende de la locale: en macOS convierte «Í»
  # en «'I», que luego se parte en dos palabras y deja de casar. `chartr` es
  # determinista en toda plataforma.
  v <- chartr("ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÇ", "AEIOUUNAEIOUAEIOUAEIOC", v)
  trimws(gsub(" +", " ", gsub("[^A-Z0-9]+", " ", v)))
}

#' ¿Cada fila pertenece a una facultad excluida?
#'
#' @param faculty Vector de facultades, una por fila.
#' @param excluidas Lista o vector de facultades excluidas por diseño.
#' @return Vector lógico: `TRUE` donde la fila SÍ está excluida.
#' @keywords internal
.cm_aulas_facultad_excluida <- function(faculty, excluidas) {
  claves <- .cm_aulas_facultad_clave(unlist(excluidas, use.names = FALSE))
  claves <- claves[nzchar(claves)]
  if (!length(claves)) return(rep(FALSE, length(faculty)))
  .cm_aulas_facultad_clave(faculty) %in% claves
}
