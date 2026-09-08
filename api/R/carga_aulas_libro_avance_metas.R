# carga_aulas_libro_avance_metas.R — el bloque «Avance contra la meta», con las
# DOS metas y por sexo.
#
# Gonzalo (2026-09-08): «Dos metas una real y otra referencial (aunque no debe
# decir que lo es), la de 2500 y la de 3750. Además debe estar clarísimo la meta
# de hombres y mujeres en total y por facultad en muestra y sobremuestra.» Y,
# sobre qué preside Avance: «Efectivas sobre la cuota (212 de 2,500 · 8,5 %)».
#
# El bloque de hoy abre con «Encuestas de la meta 3 158», que es la suma de
# `expected_valid` por curso-horario del plan: una TERCERA cifra —el rendimiento
# esperado del operativo— que nadie pidió y que compite con las dos metas del
# estudio. Deja de presidir. Sigue viva donde significa algo: «Aulas que
# llegaron a SU meta» se mide contra la meta de cada aula, y sin cuotas del
# diseño el bloque entero vuelve a ser el de siempre (`aulas_libro_indicadores`
# no puede reconstruir la cuota).
#
# Todo lo que hay aquí SE DERIVA de la tabla por facultad (`ind$facultades`,
# V1): una sola definición de la muestra, de la sobremuestra, de las efectivas
# y de los faltantes para el libro, el Sheets, el PDF y el tablero. Sumar los
# faltantes por celda —y no restar los totales— es el ADR 0079: pasarse en una
# facultad o en un sexo no cubre lo que falta en otro.

# Las filas de la tabla que son PROPORCIÓN y no conteo: sus celdas se escriben
# «8.5 %» en el Sheets y con numFmt de porcentaje en el xlsx. Vive aquí, junto
# a quien las produce, para que los dos renderers no repitan la lista.
.calam_FILAS_PCT <- c("Avance a la muestra", "Avance a la sobremuestra")

# La cabecera de la tabla de metas. Su primera celda entra en
# `.maaf_CABECERAS_TABLA` para que el formato del Sheets la vista como cabecera.
.calam_CABECERA <- c("Por sexo", "Total", "Mujeres", "Hombres")

# Suma de una columna de la tabla por facultad; NA si la columna no trae ningún
# dato finito (sin variable de sexo declarada, sin sobremuestra en el diseño).
.calam_suma <- function(fac, col) {
  v <- suppressWarnings(as.numeric(fac[[col]] %||% NA))
  v <- v[is.finite(v)]
  if (length(v)) sum(v) else NA_real_
}

# Lo que falta en UNA celda de sexo contra UNA meta, sumado por facultad: la
# misma regla direccional que `falta_sexo()` de la tabla por facultad, aplicada
# a la sobremuestra (que en la tabla sólo viaja en total, porque Gonzalo dictó
# quince columnas). Nunca negativo, nunca compensado entre facultades.
.calam_falta_celda <- function(fac, col_meta, col_obs) {
  meta <- suppressWarnings(as.numeric(fac[[col_meta]] %||% NA))
  obs <- suppressWarnings(as.numeric(fac[[col_obs]] %||% NA))
  if (!length(meta) || !length(obs)) return(NA_real_)
  ok <- is.finite(meta) & is.finite(obs)
  if (!any(ok)) return(NA_real_)
  sum(pmax(0, meta[ok] - obs[ok]))
}

#' La tabla «Por sexo» del bloque de meta, o `NULL` sin tabla por facultad.
#'
#' @param fac el `ind$facultades` de `aulas_libro_indicadores()`.
#' @return data.frame de cuatro columnas (`Por sexo`, `Total`, `Mujeres`,
#'   `Hombres`) con una fila por concepto. Las filas de la sobremuestra se
#'   omiten cuando el diseño no la publica: tres renglones de «—» son ruido y
#'   la nota al pie ya lo dice con palabras.
#' @keywords internal
.calam_tabla_metas <- function(fac) {
  if (!is.data.frame(fac) || !nrow(fac)) return(NULL)

  ef <- c(.calam_suma(fac, "Efectivas"), .calam_suma(fac, "Efectivas mujeres"),
          .calam_suma(fac, "Efectivas hombres"))
  mu <- c(.calam_suma(fac, "Muestra"), .calam_suma(fac, "Muestra mujeres"),
          .calam_suma(fac, "Muestra hombres"))
  sm <- c(.calam_suma(fac, "Sobremuestra"), .calam_suma(fac, "Sobremuestra mujeres"),
          .calam_suma(fac, "Sobremuestra hombres"))

  # Un 0 de 0 no es 0 %: la tasa sólo existe con denominador positivo.
  tasa <- function(obs, meta) {
    ifelse(is.finite(obs) & is.finite(meta) & meta > 0, obs / meta, NA_real_)
  }
  # Los faltantes NO se recalculan aquí: el total sale de la columna que ya
  # vive en la tabla por facultad (`monitoreo_aulas_brecha_facultad`, ADR 0079)
  # y los de sexo, de la misma resta por celda que esa columna hace por dentro.
  falta_mu <- c(.calam_suma(fac, "Faltantes"),
                .calam_suma(fac, "Faltantes mujeres"),
                .calam_suma(fac, "Faltantes hombres"))
  falta_sm <- c(.calam_suma(fac, "Faltantes para la sobremuestra"),
                .calam_falta_celda(fac, "Sobremuestra mujeres", "Efectivas mujeres"),
                .calam_falta_celda(fac, "Sobremuestra hombres", "Efectivas hombres"))

  fila <- function(etiqueta, v) data.frame(
    `Por sexo` = etiqueta, Total = v[[1]], Mujeres = v[[2]], Hombres = v[[3]],
    check.names = FALSE, stringsAsFactors = FALSE
  )
  filas <- list(
    fila("Efectivas conseguidas", ef),
    fila("Muestra", mu),
    fila("Avance a la muestra", tasa(ef, mu)),
    fila("Faltan para la muestra", falta_mu)
  )
  if (any(is.finite(sm))) {
    filas <- c(filas, list(
      fila("Sobremuestra", sm),
      fila("Avance a la sobremuestra", tasa(ef, sm)),
      fila("Faltan para la sobremuestra", falta_sm)
    ))
  }
  do.call(rbind, filas)
}

#' La línea que preside el bloque: «Efectivas sobre la cuota».
#'
#' Gonzalo pidió exactamente esta cifra al frente de Avance. Es la misma que la
#' primera tarjeta de la banda en la app (A1): un solo enunciado del avance del
#' estudio, en el libro y en pantalla.
#'
#' @param fac el `ind$facultades` de `aulas_libro_indicadores()`.
#' @return una frase, o `NULL` si no hay muestra contra la que medir.
#' @keywords internal
.calam_titular <- function(fac) {
  if (!is.data.frame(fac) || !nrow(fac)) return(NULL)
  ef <- .calam_suma(fac, "Efectivas")
  mu <- .calam_suma(fac, "Muestra")
  if (!is.finite(ef) || !is.finite(mu) || mu <= 0) return(NULL)
  cifra <- function(x) format(round(x), big.mark = " ", trim = TRUE, scientific = FALSE)
  pct <- function(p) paste0(format(round(p * 100, 1), trim = TRUE, scientific = FALSE), " %")
  txt <- paste0("Efectivas sobre la cuota: ", cifra(ef), " de ", cifra(mu),
                " (", pct(ef / mu), " de la muestra")
  sm <- .calam_suma(fac, "Sobremuestra")
  if (is.finite(sm) && sm > 0) {
    txt <- paste0(txt, "; ", pct(ef / sm), " de la sobremuestra")
  }
  paste0(txt, ").")
}
