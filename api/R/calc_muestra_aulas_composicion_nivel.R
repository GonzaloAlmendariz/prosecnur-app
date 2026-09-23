# =============================================================================
# Cuántos elegibles de cada nivel tiene cada curso-horario
# =============================================================================
#
# Gonzalo, 2026-09-23: «tenemos su código, su sexo, su nivel curricular […]
# tenemos todo». El marco guardaba por aula cuántos elegibles hay de cada SEXO
# (`sex_top_*_n`) y del nivel sólo la MODA (`level`). Con la cuota por nivel
# atribuida a la persona (CCSS Perfil 2026-II), la moda no alcanza: un aula de
# nivel 6 tiene alumnos de 5, 6 y 7, y sin saber cuántos de cada uno Monitoreo
# no puede proyectar por nivel lo que falta aplicar.
#
# La composición es un CONTEO por aula, como el de sexo: no nombra a nadie y
# viaja en cualquier `.pulso`, confidencial o no (a diferencia de los ids del
# ADR 0089).
#
# Formato: `"6:3|7:10|8:1"` —valor del nivel y elegibles ÚNICOS de ese nivel,
# ordenado—, la misma convención de barra que `unique_student_ids`. Cuenta
# exactamente a los que cuenta `eligible_n`: mismas filas elegibles, mismos
# alumnos deduplicados. Un alumno con más de un nivel en la base (no debería)
# se cuenta por el de su primera fila elegible, para que la suma siga siendo
# `eligible_n`.
#
# **Se anota DESPUÉS del sello del marco** (`frame_hash_estable`), igual que la
# efectividad esperada: es derivada, y meterla en la firma cambiaría el hash de
# todos los estudios e invalidaría sorteos acreditados.

#' La composición por nivel de los elegibles de cada curso-horario.
#'
#' @param classroom_id,student_id,level vectores por fila de la base.
#' @param eligible_row lógico por fila: la misma máscara que da `eligible_n`.
#' @return vector con nombre (`classroom_id`) de cadenas `"nivel:n|…"`; `""`
#'   para un aula sin elegibles.
#' @keywords internal
.cm_aulas_composicion_nivel <- function(classroom_id, student_id, level, eligible_row) {
  cid <- as.character(classroom_id)
  sid <- as.character(student_id)
  lvl <- trimws(as.character(level))
  ok <- (eligible_row %in% TRUE) & nzchar(cid) & !is.na(sid) & nzchar(sid)
  aulas <- unique(cid[nzchar(cid)])
  out <- stats::setNames(rep("", length(aulas)), aulas)
  if (!any(ok)) return(out)
  d <- data.frame(cid = cid[ok], sid = sid[ok], lvl = lvl[ok], stringsAsFactors = FALSE)
  d <- d[!duplicated(d[c("cid", "sid")]), , drop = FALSE]
  d$lvl[is.na(d$lvl) | !nzchar(d$lvl)] <- "?"
  por_aula <- split(d$lvl, d$cid)
  for (a in names(por_aula)) out[[a]] <- .cm_aulas_composicion_texto(table(por_aula[[a]]))
  out
}

#' Anota `level_composition` en el marco, DESPUÉS del sello.
#'
#' La llama `calc_muestra_aulas_construir()` sobre el marco ya anotado con la
#' efectividad —las dos son derivadas y quedan fuera de `frame_hash`—. Vive aquí
#' y no en el constructor porque éste está congelado a crecimiento.
#'
#' @param aula_frame el marco por aula.
#' @inheritParams .cm_aulas_composicion_nivel
#' @return el marco con la columna `level_composition` (`""` sin elegibles).
#' @keywords internal
.cm_aulas_composicion_anotar <- function(aula_frame, classroom_id, student_id, level, eligible_row) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame)) return(aula_frame)
  comp <- .cm_aulas_composicion_nivel(classroom_id, student_id, level, eligible_row)
  v <- unname(comp[as.character(aula_frame$classroom_id)])
  v[is.na(v)] <- ""
  aula_frame$level_composition <- v
  aula_frame
}

# Una tabla de conteos a `"6:3|7:10"`, ordenada numéricamente cuando se puede.
.cm_aulas_composicion_texto <- function(tab) {
  if (!length(tab)) return("")
  k <- names(tab)
  num <- suppressWarnings(as.numeric(k))
  o <- order(is.na(num), num, k)
  paste(paste0(k[o], ":", as.integer(tab[o])), collapse = "|")
}

#' Lee una composición `"6:3|7:10"` a un vector con nombre.
#'
#' @param x la cadena (o `NULL`/`NA`).
#' @return vector numérico con nombre por valor; vacío si no hay dato legible.
#' @keywords internal
.cm_aulas_composicion_leer <- function(x) {
  s <- as.character(x %||% "")[1]
  if (is.na(s) || !nzchar(trimws(s))) return(stats::setNames(numeric(0), character(0)))
  partes <- strsplit(strsplit(s, "|", fixed = TRUE)[[1]], ":", fixed = TRUE)
  k <- vapply(partes, function(p) trimws(p[1] %||% ""), character(1))
  v <- vapply(partes, function(p) suppressWarnings(as.numeric(p[2] %||% NA)), numeric(1))
  ok <- nzchar(k) & is.finite(v) & v >= 0
  stats::setNames(v[ok], k[ok])
}
