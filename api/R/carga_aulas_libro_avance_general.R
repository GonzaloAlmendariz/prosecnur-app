# carga_aulas_libro_avance_general.R — la tabla «AVANCE GENERAL».
#
# Dictado de Gonzalo (2026-09-08): «En la tabla AVANCE GENERAL las columnas van
# a ser las siguientes: Indicadores, Total, Hombres, Mujeres», y diez filas
# nombradas una por una. Se llamaba «Avance contra la meta» y era un bloque de
# etiqueta|valor que fue creciendo; ahora es una TABLA con la misma anatomía que
# las otras cuatro, y su primera celda —«Indicadores»— es lo que la hace
# reconocible como cabecera para el formateador.
#
# **Qué ganó y qué perdió respecto del bloque anterior.** Ganó las tres filas de
# aulas que el operativo pregunta cada mañana —cuántas se aplicaron, cuántas
# están asignadas a alguien y cuántas hay planificadas— y perdió «Aulas que
# llegaron a SU meta», que medía cada aula contra su propia meta y no contra la
# cuota: es una cifra de calidad del aula, no de avance del estudio, y no está
# en el dictado. Sigue viva en `ind$meta$aulas_cerradas` para el tablero.
#
# Todo lo que hay aquí SE DERIVA de la tabla por facultad (`ind$facultades`):
# una sola definición de la muestra, de la sobremuestra, de las efectivas y de
# los faltantes para el libro, el Sheets, el PDF y el tablero. Sumar los
# faltantes por celda —y no restar los totales— es el ADR 0079: pasarse en una
# facultad o en un sexo no cubre lo que falta en otro.

# Las tres filas de AULAS no son de personas: no se reparten por sexo y sus
# celdas de Hombres y Mujeres quedan en blanco declarado. Contar aulas «de
# mujeres» no significa nada — el aula es mixta por definición.
.calag_FILAS_AULAS <- c("Aulas aplicadas", "Aulas asignadas", "Aulas planificadas")

# Suma de una columna de la tabla por facultad; NA si la columna no trae ningún
# dato finito (sin variable de sexo declarada, sin sobremuestra en el diseño).
.calam_suma <- function(fac, col) {
  v <- suppressWarnings(as.numeric(fac[[col]] %||% NA))
  v <- v[is.finite(v)]
  if (length(v)) sum(v) else NA_real_
}

#' La tabla «Avance general», o `NULL` sin tabla por facultad.
#'
#' @param fac el `ind$facultades` de `aulas_libro_indicadores()`.
#' @param aulas lista con `aplicadas`, `asignadas` y `planificadas`. Las tres
#'   son conteos de curso-horario y viajan aparte porque no se derivan de la
#'   cuota: la tabla por facultad sólo conoce las aplicadas.
#' @return data.frame de cuatro columnas (`AULAS_AVANCE_CABECERAS$general`) con
#'   una fila por concepto, en el orden de `AULAS_AVANCE_FILAS_GENERAL`.
#'
#'   Las tres filas de la sobremuestra se escriben SIEMPRE, incluso sin
#'   sobremuestra en el diseño. La versión anterior las omitía —«tres renglones
#'   de — son ruido»— y eso valía cuando el bloque era una lista de etiquetas;
#'   en una tabla de filas dictadas, una fila que aparece y desaparece según el
#'   estudio obliga a contar renglones para saber qué se está leyendo.
#' @keywords internal
.calag_tabla_general <- function(fac, aulas = list()) {
  if (!is.data.frame(fac) || !nrow(fac)) return(NULL)

  # Hombres antes que mujeres: el orden del dictado, en las cinco tablas.
  ef <- c(.calam_suma(fac, "Efectivas"), .calam_suma(fac, "Efectivas hombres"),
          .calam_suma(fac, "Efectivas mujeres"))
  mu <- c(.calam_suma(fac, "Muestra"), .calam_suma(fac, "Muestra hombres"),
          .calam_suma(fac, "Muestra mujeres"))
  sm <- c(.calam_suma(fac, "Sobremuestra"), .calam_suma(fac, "Sobremuestra hombres"),
          .calam_suma(fac, "Sobremuestra mujeres"))

  # Un 0 de 0 no es 0 %: la tasa sólo existe con denominador positivo.
  tasa <- function(obs, meta) {
    ifelse(is.finite(obs) & is.finite(meta) & meta > 0, obs / meta, NA_real_)
  }
  # Los faltantes NO se recalculan aquí: salen de las columnas que ya viven en
  # la tabla por facultad (`monitoreo_aulas_brecha_facultad`, ADR 0079), sumadas
  # celda a celda. Restar los totales daría otra cifra y sería la segunda verdad.
  falta_mu <- c(.calam_suma(fac, "Faltantes muestra"),
                .calam_suma(fac, "Faltantes hombres muestra"),
                .calam_suma(fac, "Faltantes mujeres muestra"))
  falta_sm <- c(.calam_suma(fac, "Faltantes sobremuestra"),
                .calam_suma(fac, "Faltantes hombres sobremuestra"),
                .calam_suma(fac, "Faltantes mujeres sobremuestra"))

  n <- function(x) {
    v <- suppressWarnings(as.numeric(x %||% NA))[1]
    if (length(v) && is.finite(v)) v else NA_real_
  }
  solo_total <- function(v) c(n(v), NA_real_, NA_real_)

  # **Los conteos de personas salen ENTEROS, y su dirección es por cifra**
  # (A9-B6): la META al entero más próximo con las mitades hacia arriba —NO
  # `round()`, que en R es banquero—, lo CONSEGUIDO hacia abajo (no se declara
  # cubierto lo que no se consiguió) y lo que FALTA hacia arriba (no se le dice
  # al campo que falta menos de lo que falta). Media encuesta no existe, y la
  # cuota llega fraccionaria del cálculo.
  meta_ent <- function(v) ifelse(is.finite(v), floor(v + 0.5), v)
  abajo <- function(v) ifelse(is.finite(v), floor(v), v)
  arriba <- function(v) ifelse(is.finite(v), ceiling(v), v)

  valores <- list(
    "Efectivas" = abajo(ef),
    "Muestra" = meta_ent(mu),
    # Las tasas se calculan con los BRUTOS: son razones, no conteos, y la regla
    # de enteros no las alcanza.
    "Avance muestra" = tasa(ef, mu),
    "Faltantes para la muestra" = arriba(falta_mu),
    "Sobremuestra" = meta_ent(sm),
    "Avance sobremuestra" = tasa(ef, sm),
    "Faltantes para la sobremuestra" = arriba(falta_sm),
    "Aulas aplicadas" = solo_total(aulas$aplicadas),
    "Aulas asignadas" = solo_total(aulas$asignadas),
    "Aulas planificadas" = solo_total(aulas$planificadas)
  )

  filas <- lapply(AULAS_AVANCE_FILAS_GENERAL, function(etiqueta) {
    v <- valores[[etiqueta]]
    out <- data.frame(etiqueta, v[[1]], v[[2]], v[[3]],
                      stringsAsFactors = FALSE)
    names(out) <- AULAS_AVANCE_CABECERAS$general
    out
  })
  do.call(rbind, filas)
}

#' La línea que preside la hoja: «Efectivas sobre la cuota».
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
