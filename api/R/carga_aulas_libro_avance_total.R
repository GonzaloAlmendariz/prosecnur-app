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

#' La nota al pie de la tabla por facultad, UNA para el xlsx y el Sheets.
#'
#' Nombra las dos metas con el mismo rango (Gonzalo, 2026-09-08: «dos metas,
#' una real y otra referencial, aunque no debe decir que lo es»), dice contra
#' cuál se mide cada columna de faltantes y cómo se repartió la sobremuestra.
#' Sin sobremuestra en el diseño, lo declara en vez de callar (C3).
#'
#' @param fac el `ind$facultades` de `aulas_libro_indicadores()`.
#' @param eje la declaración del eje ([monitoreo_aulas_eje()]). Sin ella,
#'   `facultad`, que es lo que la nota decía.
#' @param con_sexo si el estudio declara cuota POR SEXO. La nota afirmaba
#'   siempre «por facultad y por sexo», y sobre CCSS —cuota por nivel, sexo
#'   referencial— eso era falso dos veces al pie de una tabla que enseña
#'   niveles. Se ve generando el libro, no leyendo el motor.
#' @return una frase.
#' @keywords internal
.calaf_nota_metas <- function(fac, eje = NULL, con_sexo = NULL) {
  total <- .calaf_fila_total(fac)
  # **Si el estudio promete por sexo se lee del DATO, y de la MISMA fila que la
  # nota describe.** `fac` es la tabla del libro, no las metas del diseño: aquí
  # el sexo está en sus columnas «Muestra hombres» y «Muestra mujeres», que la
  # tabla deja vacías cuando el diseño no fijó cuota de sexo —esa maquinaria ya
  # distingue «cero» de «no lo sabemos»—. Leerlo de otra parte era el defecto
  # que escribí primero: busqué `cuota_sexo` en una tabla que no lo tiene y la
  # nota habría dicho «por nivel» para todo el mundo, HSVG incluido.
  if (is.null(con_sexo)) {
    por_sexo <- suppressWarnings(as.numeric(c(
      total[["Muestra hombres"]] %||% NA, total[["Muestra mujeres"]] %||% NA)))
    con_sexo <- any(is.finite(por_sexo) & por_sexo > 0)
  }
  # **El grano de la cuota, dicho como es.** Con el eje en facultad y cuota de
  # sexo sale «por facultad y por sexo», byte a byte como la lee HSVG.
  unidad <- tolower(.monitoreo_scalar((eje %||% list())[["etiqueta"]] %||% "Facultad", "Facultad"))
  grano <- if (isTRUE(con_sexo)) paste0("por ", unidad, " y por sexo") else paste0("por ", unidad)
  mu <- suppressWarnings(as.numeric(total[["Muestra"]] %||% NA))
  sm <- suppressWarnings(as.numeric(total[["Sobremuestra"]] %||% NA))
  cifra <- function(x) format(round(x), big.mark = " ", trim = TRUE, scientific = FALSE)
  # La nota de ARRIBA de la tabla ya dice que la cuota no se compensa entre
  # facultades ni entre sexos; ésta dice lo que falta saber al pie: cuáles son
  # las dos metas y contra cuál se mide cada columna de faltantes.
  if (is.finite(mu) && mu > 0 && is.finite(sm) && sm > 0) {
    paste0(
      "Muestra (", cifra(mu), ") y sobremuestra (", cifra(sm),
      ") son las dos metas del estudio, cada una ", grano, ". ",
      "Cada meta lleva al lado lo que le falta, y una celda de faltantes en cero ",
      "va pintada: verde si cubrió la muestra, celeste si cubrió la sobremuestra. ",
      if (isTRUE(con_sexo))
        "La sobremuestra de cada facultad y de cada sexo reparte la del diseño con su ratio (x"
      else paste0("La sobremuestra de cada ", unidad, " reparte la del diseño con su ratio (x"),
      format(round(sm / mu, 2), trim = TRUE), ")."
    )
  } else {
    paste0(
      "Cada meta lleva al lado lo que le falta. La muestra es la cuota del diseño ",
      grano, "; el estudio no publica la sobremuestra, así que sus columnas ",
      "van en blanco."
    )
  }
}
