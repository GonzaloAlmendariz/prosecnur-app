# graficos_no_sustantivos.R — las respuestas que no son parte de la escala, en gris y al final
#
# CCSS Perfil 2026: en las multiapiladas C1 (1-5 + 9 «No tengo información suficiente para responder») y B12 (1-5 + 77
# «No lo sé / No uso este recurso») el no sustantivo recibía el último paso de una rampa de seis, el verde más intenso,
# y se leía como «Totalmente de acuerdo». Los rótulos no casaban con `.DIVERGENTES_ESPECIAL` y la paleta se decidía sólo
# por rótulo: el código, que sí lo dice (9 o 77 fuera de una escala 1-5), ya se había perdido.
#
# Modelo: «SIN INF» en el mazo de Arte — gris (`likert[5]`), último segmento, con su entrada en la leyenda, y la escala
# con su propia rampa. En las apiladas esto sólo decide COLOR y LUGAR: las cifras, la base y el Top Two Box no cambian
# (si el no sustantivo sale o no del denominador del T2B es la decisión D13, abierta). En la escala divergente (resumen y
# lámina 71, ADR 0135 §3) el no sustantivo sale de los lados y del reparto, y el denominador sigue siendo el total.
#
# Detección, en este orden:
#   (a) metadata del instrumento: una columna de `choices` que marca la opción como especial (sí) o como de la escala
#       (no); cuando habla, manda sobre (b) y (c);
#   (b) código fuera del rango de la escala (la corrida consecutiva más larga de códigos enteros de la lista);
#   (c) el rótulo (`.CATEGORIAS_RESIDUALES`, `.DIVERGENTES_ESPECIAL` y los «no lo sé / no tengo información»), sin
#       distinguir mayúsculas ni tildes; un rótulo compuesto con « / » cuenta si alguna de sus partes casa.
# Un código DENTRO del rango nunca es no sustantivo (salvo que la metadata lo declare), con una excepción en la PUNTA
# DE ARRIBA: los códigos más altos de la corrida cuyo rótulo es inequívocamente una no respuesta o un «no aplica»
# (`.NO_SUSTANTIVOS_ROTULO_COLA`) se recortan del rango. CCSS 2026, B15_2_1: 1-5 de acuerdo + 6 «No he acudido a esos
# horarios» + 7 «No sabía que los/as docentes tuvieran horario de atención», contiguos a la escala, recibían el verde
# más intenso de una rampa de siete. Sólo por arriba: un «Ninguno» que abre una escala de frecuencia sigue en ella.

.NO_SUSTANTIVOS_ROTULO_EXTRA <- paste0("^(no tengo informaci|no lo s[eé]|no s[eé]\\b|no uso|no utilic|no conozco|desconozco|no aplica|sin informaci|ns ?/ ?n[rco]|",
                                       "prefiero no (responder|decir)|no precisa|sin opini|no contesta|rechaz|no recuerda|no corresponde)")
.NO_SUSTANTIVOS_ROTULO_COLA <- paste0("^(no tengo informaci|no lo s[eé]|no s[eé]\\b|no sab[ií]a|no conoc[ií]a|no conozco|desconozco|",
                                      "no aplica|sin informaci|ns ?/ ?n[rco]|no responde|no opina|",
                                      "no he (acudido|asistido|usado|utilizado|ido|participado|tenido)|no uso|no utilic|",
                                      "prefiero no (responder|decir)|no precisa|sin opini|no contesta|rechaz|no recuerda|no corresponde)")
# Con `residuales = FALSE` (la escala divergente) «Ninguno/Ninguna» es el extremo de la escala, pero «Otro» sigue siendo
# residual: cuenta por rótulo y, contiguo a la escala por arriba, se recorta de su punta como una no respuesta.
.NO_SUSTANTIVOS_RESIDUALES_ESCALA <- "^(Otro|Otros|Otra|Otras|No sabe|Prefiero no)\\b"
# La ESCALA (barra divergente y regla de las láminas de resumen) no decide por el rango de códigos: una escala de dos
# en dos (1, 3, 5, 7, 9) o con un 0 «Prefiero no responder» delante rompía cualquier heurística de corrida (tercera
# revisión metodológica de 31db92ae2). Un código es no sustantivo de la escala SÓLO si (a) la lista lo declara, (b) es
# 90-99 o (c) su rótulo es de no respuesta, en cualquier punta. «Ninguno/Ninguna» como nivel y «Ninguna confianza»
# siguen en la escala; «Ninguna de las anteriores» no. Un rótulo de no respuesta que esta lista no conozca queda como
# nivel: la salida es declararlo en `choices$especial`. Se compara en minúsculas y sin tildes (`.box_norm_etiqueta`).
.NO_SUSTANTIVOS_ROTULO_ESCALA <- paste0("^(", paste(c(
  "prefiero no (responder|decir|contestar)", "no precisa", "sin opini", "no tiene opini", "no tengo opini", "no opina",
  "no opino", "no contesta", "no responde", "no (quiere|desea) (responder|contestar)", "rechaz[oa] (a )?(responder|contestar)",
  "ns ?/ ?n[rcos]", "ns$", "nr$", "no se$", "no lo se\\b", "no sabe\\b", "no sabria", "no sabia", "no tengo informaci",
  "sin informaci", "sin inf\\b", "sin respuesta", "no aplica", "no corresponde", "no recuerda",
  "ningun[oa] de (los|las) (anteriores|opciones)", "otr[oa]s?$", "otro\\b"), collapse = "|"), ")")
# Raíces ambiguas (cuarta revisión metodológica, H1): «Rechazo», «No conoce», «No uso», «No he participado» son una no
# respuesta como opción suelta, pero el extremo de una escala si otra opción de la misma lista contiene la raíz
# («Rechazo totalmente … Acepto totalmente», «No conoce / Conoce poco», «No uso / Uso poco»). Patrón -> raíz hermana.
.NO_SUSTANTIVOS_RAICES_ESCALA <- list(
  list(patron = "^rechaz[oa]?$", raiz = "(rechaz|acept)"),   # «Rechazo / Indiferente / Acepto»
  list(patron = "^(no (conoce|conozco)$|desconoc)", raiz = "conoc"),
  list(patron = "^no (uso|utilizo|utilic|utiliz)", raiz = "\\b(us[oa]|usad|utiliz|utilic)"),
  # «No he X» es el cero de una escala de frecuencia («Una vez», «Algunas veces», «Nunca»…) o de una del mismo verbo.
  list(patron = "^no he (acudido|asistido)", raiz = "(acud|asist|\\bvez\\b|\\bveces\\b|nunca|siempre)"),
  list(patron = "^no he (usado|utilizado)", raiz = "(\\b(us[oa]|usad|utiliz)|\\bvez\\b|\\bveces\\b|nunca|siempre)"),
  list(patron = "^no he participado", raiz = "(particip|\\bvez\\b|\\bveces\\b|nunca|siempre)"),
  list(patron = "^no he tenido", raiz = "(\\bten(go|ido|ia)|\\bvez\\b|\\bveces\\b|nunca|siempre)"),
  list(patron = "^no he ido", raiz = "(\\b(fui|ido|voy)\\b|\\bvez\\b|\\bveces\\b|nunca|siempre)"))
.NO_SUSTANTIVOS_COLS_META <- c("especial", "no_sustantivo", "valor_especial", "special", "es_especial")
.NO_SUSTANTIVOS_META_SI <- c("1", "true", "t", "si", "sí", "yes", "x", "especial")
.NO_SUSTANTIVOS_META_NO <- c("0", "false", "f", "no", "n")

#' Códigos que la metadata del instrumento marca como especiales en una lista (regla a)
#'
#' Lee una columna de `choices` (`especial`, `no_sustantivo`, …) con un valor verdadero (1, true, sí, x).
#' @return Códigos marcados; `character(0)` si la lista no trae esa metadata.
#' @keywords internal
.graficos_no_sustantivos_especiales_meta <- function(list_name, choices, valores = .NO_SUSTANTIVOS_META_SI) {
  if (!is.data.frame(choices) || !all(c("list_name", "name") %in% names(choices))) return(character(0))
  col <- intersect(.NO_SUSTANTIVOS_COLS_META, names(choices))
  if (!length(col)) return(character(0))
  sub <- choices[trimws(as.character(choices$list_name)) == trimws(as.character(list_name %||% "")[1]), , drop = FALSE]
  if (!nrow(sub)) return(character(0))
  v <- tolower(trimws(as.character(sub[[col[1]]])))
  marcado <- !is.na(v) & v %in% valores
  trimws(as.character(sub$name[marcado]))
}

#' Rango de la escala: la corrida consecutiva más larga de códigos enteros (al menos dos); `NULL` si no hay
#'
#' `especiales` (los que la metadata declara) se recortan de las PUNTAS de la corrida: un 9 marcado no alarga una escala
#' 1-8, y un 3 marcado en medio de una 1-5 no la parte en dos (4 y 5 siguen dentro).
#' @keywords internal
#' `salto_max` es el paso más grande que no corta la corrida: 1 (consecutivos, lo de siempre) o 2 en la escala divergente,
#' donde una 1, 2, 4, 5 (sin el 3) es una sola escala y no dos corridas (ADR 0135 §3).
#' @keywords internal
.graficos_no_sustantivos_rango <- function(codigos, especiales = character(0), salto_max = 1L) {
  v <- suppressWarnings(as.numeric(codigos))
  v <- sort(unique(v[is.finite(v) & v == round(v)]))
  if (length(v) < 2L) return(NULL)
  corte <- cumsum(c(1L, diff(v) > salto_max))
  largo <- tabulate(corte)
  mejor <- which.max(largo)   # empate: la primera (la de códigos menores)
  if (largo[mejor] < 2L) return(NULL)
  run <- v[corte == mejor]
  # El salto de 2 sólo une un hueco INTERIOR (1, 2, 4, 5): una punta separada por un salto de 2 y sin vecino
  # consecutivo (el 9 tras una 1-7, el 6 tras una 1-4) no es parte de la escala.
  if (salto_max > 1L) {
    while (length(run) >= 3L && run[2] - run[1] > 1) run <- run[-1]
    while (length(run) >= 3L && run[length(run)] - run[length(run) - 1L] > 1) run <- run[-length(run)]
  }
  esp <- suppressWarnings(as.numeric(especiales)); esp <- esp[is.finite(esp)]
  while (length(run) && run[1] %in% esp) run <- run[-1]
  while (length(run) && run[length(run)] %in% esp) run <- run[-length(run)]
  if (length(run) < 2L) return(NULL)
  range(run)
}

#' ¿El rótulo es de no sustantivo? Partes separadas por « / »: basta una (`.graficos_no_sustantivos`, regla c)
#' @keywords internal
#' `residuales = FALSE` no cuenta `.CATEGORIAS_RESIDUALES` («Ninguno», «Otro»…): en una escala ordinal «Ninguna confianza»
#' o «Ninguno» es su extremo, no una no respuesta (revisión metodológica de la oleada 3, ADR 0135 §3).
.graficos_no_sustantivos_rotulo <- function(etiquetas, residuales = TRUE) {
  re_res <- if (isTRUE(residuales)) .CATEGORIAS_RESIDUALES else .NO_SUSTANTIVOS_RESIDUALES_ESCALA
  casa <- function(e) {
    grepl(re_res, e, ignore.case = TRUE, perl = TRUE) | grepl(.DIVERGENTES_ESPECIAL, e, ignore.case = TRUE) |
      grepl(.NO_SUSTANTIVOS_ROTULO_EXTRA, tolower(.box_norm_etiqueta(e)), perl = TRUE)
  }
  vapply(as.character(etiquetas), function(e) {
    if (is.na(e)) return(FALSE)
    partes <- trimws(strsplit(e, "\\s+/\\s+", perl = TRUE)[[1]])
    any(casa(c(e, partes[nzchar(partes)])))
  }, logical(1), USE.NAMES = FALSE)
}

#' Recorta de la punta de arriba del rango los códigos con rótulo de no respuesta (`.NO_SUSTANTIVOS_ROTULO_COLA`)
#'
#' Sólo códigos cuyo rótulo se conoce (`v`, `etiquetas`) y que la metadata no declara de la escala; la escala que queda
#' conserva al menos dos puntos.
#' @keywords internal
.graficos_no_sustantivos_recortar_cola <- function(rango, v, etiquetas, sustantivos = character(0), residuales = TRUE) {
  if (is.null(rango)) return(rango)
  norm <- tolower(.box_norm_etiqueta(ifelse(is.na(etiquetas), "", etiquetas)))
  es_cola <- grepl(.NO_SUSTANTIVOS_ROTULO_COLA, norm, perl = TRUE)
  if (!isTRUE(residuales)) es_cola <- es_cola | grepl(.NO_SUSTANTIVOS_RESIDUALES_ESCALA, norm, ignore.case = TRUE, perl = TRUE)
  cola <- v[is.finite(v) & es_cola &
              !(as.character(v) %in% trimws(as.character(sustantivos %||% character(0))))]
  while (rango[2] %in% cola && rango[2] - 1 > rango[1]) rango[2] <- rango[2] - 1
  rango
}

#' ¿Qué categorías no son sustantivas?
#'
#' @param codigos Códigos de las categorías a decidir (alineados con `etiquetas`).
#' @param etiquetas Rótulos de esas categorías.
#' @param codigos_lista Todos los códigos de la lista (para el rango); por defecto `codigos`.
#' @param especiales Códigos que la metadata del instrumento declara especiales (regla a).
#' @param sustantivos Códigos que la metadata declara de la escala (regla a en «no»): mandan sobre (b) y (c).
#' @param residuales Si `FALSE`, los rótulos residuales («Ninguno», «Otro») no cuentan (la escala divergente).
#' @param salto_max Paso más grande dentro del rango de la escala (ver `.graficos_no_sustantivos_rango`).
#' @return Lógico alineado con `codigos`.
#' @keywords internal
.graficos_no_sustantivos <- function(codigos, etiquetas, codigos_lista = codigos, especiales = character(0),
                                     sustantivos = character(0), residuales = TRUE, salto_max = 1L) {
  codigos <- trimws(as.character(codigos)); etiquetas <- trimws(as.character(etiquetas))
  especiales <- trimws(as.character(especiales %||% character(0)))
  meta <- codigos %in% especiales
  meta_no <- codigos %in% setdiff(trimws(as.character(sustantivos %||% character(0))), especiales)
  # Los que la metadata ya declaró no alargan la escala por sus puntas (un 9 marcado especial no alarga una 1-8).
  rango <- .graficos_no_sustantivos_rango(trimws(as.character(codigos_lista)), especiales, salto_max = salto_max)
  v <- suppressWarnings(as.numeric(codigos))
  rango <- .graficos_no_sustantivos_recortar_cola(rango, v, etiquetas, sustantivos, residuales = residuales)
  dentro <- if (is.null(rango)) rep(FALSE, length(codigos)) else (is.finite(v) & v >= rango[1] & v <= rango[2])
  fuera <- if (is.null(rango)) rep(FALSE, length(codigos)) else (is.finite(v) & !dentro)
  rotulo <- .graficos_no_sustantivos_rotulo(etiquetas, residuales = residuales)
  (meta | fuera | rotulo) & !(dentro & !meta) & !meta_no
}

#' ¿Qué columnas de una escala apilada son no sustantivas? (Top/Bottom Two Box por defecto, `.default_box_cols`)
#'
#' Las columnas llegan como `pct_<código>` (o con el código al inicio); el código se lee de ahí y la lista es el conjunto de
#' columnas. Sin código decide el rótulo. Suma la regla de siempre (`.is_special_box_choice`: «SIN INF», códigos > 60 al
#' inicio del rótulo) a las del dominio: «No tengo información suficiente» (9 en una 1-5) ya no entra al Top Two Box.
#' @return Lógico alineado con `cols`.
#' @keywords internal
.graficos_no_sustantivos_box <- function(cols, etiquetas) {
  cols <- as.character(cols); etiquetas <- as.character(etiquetas)
  etiquetas[is.na(etiquetas)] <- ""
  cod <- sub("^.*?_([0-9]+)$", "\\1", cols, perl = TRUE)
  cod <- ifelse(grepl("^[0-9]+$", cod), cod, sub("^\\s*([0-9]{1,3})\\b.*$", "\\1", cols, perl = TRUE))
  cod[!grepl("^[0-9]+$", cod)] <- NA_character_
  ns <- .graficos_no_sustantivos(ifelse(is.na(cod), cols, cod), etiquetas, codigos_lista = cod[!is.na(cod)])
  previo <- vapply(seq_along(cols), function(i) .is_special_box_choice(cols[i], etiquetas[i]), logical(1))
  previo | ns
}

#' Código y rótulo de cada nivel (los niveles pueden llegar como códigos o como rótulos)
#' @keywords internal
.graficos_no_sustantivos_niveles <- function(list_name, levels, choices) {
  cl <- .reporte_plan_choice_levels_for_list(list_name, choices)
  levels <- trimws(as.character(levels))
  i <- match(levels, cl$code); j <- match(levels, cl$label); i[is.na(i)] <- j[is.na(i)]
  list(codigo = ifelse(is.na(i), levels, cl$code[i]), etiqueta = ifelse(is.na(i), levels, cl$label[i]),
       lista = cl$code, especiales = .graficos_no_sustantivos_especiales_meta(list_name, choices),
       sustantivos = .graficos_no_sustantivos_especiales_meta(list_name, choices, .NO_SUSTANTIVOS_META_NO))
}

#' Lógico por nivel: ¿es no sustantivo?
#' @keywords internal
.graficos_no_sustantivos_de_niveles <- function(list_name, levels, choices) {
  nv <- .graficos_no_sustantivos_niveles(list_name, levels, choices)
  .graficos_no_sustantivos(nv$codigo, nv$etiqueta, codigos_lista = if (length(nv$lista)) nv$lista else nv$codigo,
                           especiales = nv$especiales, sustantivos = nv$sustantivos)
}

#' Los niveles de una escala con los no sustantivos al final (el resto conserva su orden)
#' @keywords internal
.graficos_no_sustantivos_al_final <- function(levels, list_name, choices) {
  if (!length(levels)) return(levels)
  ns <- .graficos_no_sustantivos_de_niveles(list_name, levels, choices)
  c(levels[!ns], levels[ns])
}

#' Paleta de la escala por defecto (sin paleta del usuario), con los no sustantivos en gris
#'
#' La escala se colorea sin ellos (`.reporte_plan_pulso_palette_for_levels` sobre los sustantivos: la rampa de cinco
#' pasos de una 1-5) y el no sustantivo toma el gris de «SIN INF» (`likert[5]`). Sin no sustantivos devuelve
#' exactamente la paleta de antes.
#' @return Vector con nombres = rótulos de los niveles, en su orden.
#' @keywords internal
.graficos_no_sustantivos_paleta <- function(list_name, levels, choices) {
  etiquetas <- .reporte_plan_labels_for_levels(list_name, levels, choices_use = choices)
  ns <- .graficos_no_sustantivos_de_niveles(list_name, levels, choices)
  if (!any(ns) || all(ns)) return(.reporte_plan_pulso_palette_for_levels(etiquetas))
  escala <- .reporte_plan_pulso_palette_for_levels(etiquetas[!ns])
  out <- stats::setNames(character(length(etiquetas)), etiquetas)
  out[!ns] <- unname(escala)
  out[ns] <- .graficos_no_sustantivo_color()
  out
}

#' Color del no sustantivo: el gris azulado `texto_tenue` del estándar
#'
#' El gris de «SIN INF» (`likert[5]`, #BFBFBF) casi no se distinguía del neutro de la escala (#D9D9D9) cuando ambos están en la
#' misma barra (CCSS Perfil 2026, ccss-mazo, ronda R6). Decisión del loop, para revisión de Gonzalo.
#' @keywords internal
.graficos_no_sustantivo_color <- function() .std_color("texto_tenue")

#' ¿Qué opciones de una ESCALA no son sustantivas? (barra divergente y regla de las láminas de resumen)
#'
#' Sin rango de códigos: (a) la metadata de la lista (`especiales`; `sustantivos` manda sobre todo), (b) códigos 90-99,
#' (c) rótulo de no respuesta (`.NO_SUSTANTIVOS_ROTULO_ESCALA`, o una raíz ambigua de `.NO_SUSTANTIVOS_RAICES_ESCALA` sin
#' hermana en la lista); un rótulo compuesto con «/» cuenta si alguna parte casa.
#' @param codigos Códigos (o rótulos, si no hay código) alineados con `etiquetas`.
#' @return Lógico alineado con `codigos`.
#' @keywords internal
.graficos_no_sustantivos_escala <- function(codigos, etiquetas, especiales = character(0), sustantivos = character(0),
                                            direccion = "negativo_positivo") {
  codigos <- trimws(as.character(codigos)); codigos[is.na(codigos)] <- ""
  etiquetas <- trimws(as.character(etiquetas))
  especiales <- trimws(as.character(especiales %||% character(0)))
  meta <- nzchar(codigos) & codigos %in% especiales
  meta_no <- nzchar(codigos) & codigos %in% setdiff(trimws(as.character(sustantivos %||% character(0))), especiales)
  cod9x <- grepl("^9[0-9]$", codigos)
  formas <- lapply(etiquetas, .graficos_no_sustantivos_formas)
  firme <- vapply(formas, function(norm) length(norm) > 0L && any(grepl(.NO_SUSTANTIVOS_ROTULO_ESCALA, norm, perl = TRUE)), logical(1))
  fuera <- firme | meta | cod9x
  # Quinta revisión (H3): una raíz ambigua sólo es nivel en la mitad negativa de la escala (según `direccion`), contada
  # entre las opciones que no son ya no respuesta; al final de una escala positiva es una no respuesta.
  pos <- cumsum(!fuera); k <- sum(!fuera)
  mitad_neg <- if (identical(direccion, "positivo_negativo")) pos > k - k %/% 2L else pos <= k %/% 2L
  hay_nunca <- any(grepl("\\bnunca\\b", unlist(formas), perl = TRUE))
  ambigua <- vapply(seq_along(formas), function(i) {
    norm <- formas[[i]]
    if (!length(norm) || fuera[i]) return(FALSE)
    # H4: las formas que ya son no respuesta («Rechaza responder») no salvan a nadie.
    hermanas <- unlist(formas[-i][!fuera[-i]], use.names = FALSE)
    for (r in .NO_SUSTANTIVOS_RAICES_ESCALA) {
      if (!any(grepl(r$patron, norm, perl = TRUE))) next
      if (hay_nunca && any(grepl("^no he ", norm, perl = TRUE))) return(TRUE)   # «No he X» con «Nunca» en la lista
      if (!mitad_neg[i] || !any(grepl(r$raiz, hermanas, perl = TRUE))) return(TRUE)
    }
    FALSE
  }, logical(1))
  (meta | cod9x | firme | ambigua) & !meta_no
}

#' Formas comparables de un rótulo: entero y sus partes separadas por «/», en minúsculas, sin tildes y sin un paréntesis
#' inicial de instrucción al encuestador («(No leer) No sabe» -> «no sabe»)
#' @keywords internal
.graficos_no_sustantivos_formas <- function(e) {
  if (is.na(e) || !nzchar(trimws(e))) return(character(0))
  partes <- trimws(strsplit(e, "\\s*/\\s*", perl = TRUE)[[1]])
  norm <- trimws(tolower(.box_norm_etiqueta(c(e, partes[nzchar(partes)]))))
  norm <- trimws(sub("^\\([^)]*\\)\\s*", "", norm))
  unique(norm[nzchar(norm)])
}
