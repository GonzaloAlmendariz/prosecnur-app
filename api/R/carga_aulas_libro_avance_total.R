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
  fila
}

#' La nota al pie de la tabla por facultad, UNA para el xlsx y el Sheets.
#'
#' Nombra las dos metas con el mismo rango (Gonzalo, 2026-09-08: «dos metas,
#' una real y otra referencial, aunque no debe decir que lo es»), dice contra
#' cuál se mide cada columna de faltantes y cómo se repartió la sobremuestra.
#' Sin sobremuestra en el diseño, lo declara en vez de callar (C3).
#'
#' @param fac el `ind$facultades` de `aulas_libro_indicadores()`.
#' @return una frase.
#' @keywords internal
.calaf_nota_metas <- function(fac) {
  total <- .calaf_fila_total(fac)
  mu <- suppressWarnings(as.numeric(total[["Muestra"]] %||% NA))
  sm <- suppressWarnings(as.numeric(total[["Sobremuestra"]] %||% NA))
  cifra <- function(x) format(round(x), big.mark = " ", trim = TRUE, scientific = FALSE)
  # La nota de ARRIBA de la tabla ya dice que la cuota no se compensa entre
  # facultades ni entre sexos; ésta dice lo que falta saber al pie: cuáles son
  # las dos metas y contra cuál se mide cada columna de faltantes.
  if (is.finite(mu) && mu > 0 && is.finite(sm) && sm > 0) {
    paste0(
      "Muestra (", cifra(mu), ") y sobremuestra (", cifra(sm),
      ") son las dos metas del estudio, cada una por facultad y por sexo. ",
      "Faltantes se mide contra la muestra; la última columna, contra la sobremuestra. ",
      "La sobremuestra de cada facultad y de cada sexo reparte la del diseño con su ratio (x",
      format(round(sm / mu, 2), trim = TRUE), ")."
    )
  } else {
    paste0(
      "Faltantes se mide contra la muestra, que es la cuota del diseño por facultad y por sexo. ",
      "El estudio no publica la sobremuestra, así que sus columnas van en blanco."
    )
  }
}
