# carga_aulas_libro_avance_total.R — la fila «Total» de la tabla por facultad.
#
# Gonzalo (2026-09-08), sobre la tabla por facultad y sexo de «Avance de
# campo»: «debe haber una fila de total al final». Es PRESENTACIÓN, como la fila
# de cierre del avance diario (`.cali_cierre_diario`): el modelo
# (`ind$facultades`) sigue siendo una fila por facultad —el PDF lo suma por su
# cuenta y el tablero ni lo mira— y la fila la piden el writer del xlsx y el
# renderer del Sheets a esta única función, para que los dos digan lo mismo.
#
# Todo lo que hay en la tabla son personas y aulas, así que todo se SUMA:
# muestra, efectivas, faltantes, aulas aplicadas y sobremuestra, por sexo y en
# total. Sumar los faltantes —y no restar los totales— es el ADR 0079: pasarse
# en una facultad o en un sexo no cubre lo que falta en otro. Una columna sin
# ningún dato (sin variable de sexo, sin sobremuestra en el diseño) queda NA y
# el renderer escribe su «—»; una con algún dato suma lo que hay.

#' La fila «Total» de la tabla por facultad, o `NULL` sin tabla.
#'
#' @param fac el `ind$facultades` de `aulas_libro_indicadores()`.
#' @return un data.frame de UNA fila con las mismas columnas: «Total» en
#'   `Facultad` y la suma de cada columna numérica.
#' @keywords internal
.calaf_fila_total <- function(fac) {
  if (!is.data.frame(fac) || !nrow(fac)) return(NULL)
  fila <- fac[1L, , drop = FALSE]
  for (col in names(fila)) fila[[col]] <- NA_real_
  fila[["Facultad"]] <- "Total"
  for (col in setdiff(names(fac), "Facultad")) {
    v <- suppressWarnings(as.numeric(fac[[col]]))
    v <- v[is.finite(v)]
    fila[[col]] <- if (length(v)) sum(v) else NA_real_
  }
  # **Una PROPORCIÓN no se suma.** Sumar quince avances del 40 % daría 600 %.
  # Las columnas de avance del total se recalculan desde los agregados ya
  # sumados —efectivas del total entre muestra del total—, que es la única
  # cifra que significa algo en esa fila.
  razon <- function(obs, meta) {
    o <- suppressWarnings(as.numeric(fila[[obs]] %||% NA))
    m <- suppressWarnings(as.numeric(fila[[meta]] %||% NA))
    if (!length(o) || !length(m) || !is.finite(o) || !is.finite(m) || m <= 0) NA_real_ else o / m
  }
  for (par in list(c("Avance muestra", "Efectivas", "Muestra"),
                   c("Avance muestra hombres", "Efectivas hombres", "Muestra hombres"),
                   c("Avance muestra mujeres", "Efectivas mujeres", "Muestra mujeres"))) {
    if (par[[1]] %in% names(fila)) fila[[par[[1]]]] <- razon(par[[2]], par[[3]])
  }
  fila
}
