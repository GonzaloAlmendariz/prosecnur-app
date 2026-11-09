# =============================================================================
# graficos_tope_espacio.R — nunca una imagen ilegible: si no cabe, menos filas y el pie lo dice (E3)
# =============================================================================
#
# Prueba con Arte (2026-11-09): la escala del resumen con más de 20 filas salía como imagen de respaldo con las cifras
# montadas unas sobre otras, y un contraste de 40 pares salía igual de apretado. Una imagen donde las cifras se pisan
# no se entrega.
#
# Regla: si las filas no caben en la lámina nativa, se muestran las que caben, en el orden de la regla (las más bajas
# con «bajo umbral», las de más Sin información, las de mayor diferencia en el contraste), y el pie lo dice en UNA frase
# (P7): con regla, «Se muestran las 20 más bajas de las 22 bajo 60%, de 157 preguntas de escala; las 2 siguientes no
# caben en esta lámina.»; sin regla, «Por espacio, se muestran las primeras 20 de 22; las 2 siguientes no caben en esta
# lámina.». El motor no crea láminas y el texto no promete otra (P14): con `continuar_desde` el analista arma la que
# sigue («Se muestran de la 21 a la 22 de las 22 bajo 60%…»).
# En una ranura (lámina de dos o cuatro gráficos) el contraste no se recorta aquí: recorta la ranura con lo que de verdad
# cabe, por la misma prioridad (`espec$prioridad`, lamina_resumen_ranura.R).
# El tope es el de la lámina nativa: 20 filas en la escala del resumen (`.LAM_DIV_RESUMEN_MAX_FILAS`) y 14 pares en el
# contraste (o las preguntas que caben en 27 sub-filas con tres o cuatro grupos, `.lam_contraste_cabe`).

#' Pares que caben en el contraste según cuántos grupos compara (el tope de `.lam_contraste_cabe`)
#' @keywords internal
.contraste_tope_filas <- function(k) {
  k <- as.integer(k)[1]
  if (!is.finite(k) || k <= 2L) return(14L)
  as.integer(floor((27 + 0.7) / (k + 0.7)))   # n·k + (n − 1)·0,7 ≤ 27 sub-filas
}

#' Cómo se nombra, en el pie, el orden con que se recortan las filas
#' @param tipo Tipo de la regla de preguntas (o NULL: el orden declarado).
#' @keywords internal
.tope_espacio_criterio <- function(tipo) {
  switch(as.character(tipo %||% "")[1],
    bajo_umbral = "más bajas",
    mayor_sin_info = "con más Sin información",
    mayor_diferencia = , diferencia_minima = "de mayor diferencia",
    "primeras")
}

#' Nota del pie cuando se muestran menos filas por espacio
#' @param k Filas que se muestran. @param n Filas elegidas. @param criterio `.tope_espacio_criterio()`.
#' @keywords internal
.tope_espacio_texto <- function(k, n, criterio, desde = 1L) {
  desde <- .tope_espacio_desde(desde)
  cab <- if (desde > 1L) sprintf("de la %d a la %d", desde, desde + k - 1L) else if (identical(criterio, "primeras")) sprintf("las primeras %d", k) else sprintf("las %d %s", k, criterio)
  if (desde > 1L && !identical(criterio, "primeras")) cab <- paste(cab, criterio)
  paste0(sprintf("%s se muestran %s de %d", if (desde > 1L) "" else "Por espacio,", cab, n) |> trimws() |> .tope_espacio_mayuscula(),
         .tope_espacio_siguientes(n - (desde - 1L) - k))
}

#' La escala sin regla: las más bajas por su Top Two Box (graficos_escala_comodin.R), con su cola de P14
#' @keywords internal
.tope_espacio_mas_bajas <- function(k, n, desde = 1L) {
  desde <- .tope_espacio_desde(desde)
  de_n <- .regla_preguntas_de_total(n, "preguntas de escala")
  cab <- if (desde > 1L) sprintf("Se muestran de la %d a la %d %s, de la más baja a la más alta", desde, desde + k - 1L, de_n)
         else sprintf("Se muestran las %d más bajas %s", k, de_n)
  paste0(cab, .tope_espacio_siguientes(n - (desde - 1L) - k))
}

#' P14 (lead, 2026-11-09): el motor no crea láminas y el texto no promete una que no existe. La cola dice cuántas
#' quedan: «; las 11 siguientes no caben en esta lámina.» (o sólo el punto final si no queda ninguna).
#' @keywords internal
.tope_espacio_siguientes <- function(m) {
  m <- as.integer(m)
  if (is.na(m) || m <= 0L) return(".")
  if (m == 1L) "; la siguiente no cabe en esta lámina." else sprintf("; las %d siguientes no caben en esta lámina.", m)
}

#' `continuar_desde` normalizado: entero >= 1 (1 si no viene o no sirve)
#' @keywords internal
.tope_espacio_desde <- function(desde) {
  d <- suppressWarnings(as.integer(unlist(desde))[1])
  if (is.na(d) || d < 1L) 1L else d
}

#' @keywords internal
.tope_espacio_mayuscula <- function(x) paste0(toupper(substr(x, 1, 1)), substring(x, 2))

#' La nota de la regla cuando el recorte por espacio deja menos filas de las que eligió: UNA frase (P7)
#'
#' Prueba con Arte (2026-11-09): el pie decía «Se muestran las 22 bajo 60%» y luego «Por espacio, se muestran las 20 más
#' bajas de 22»: dos frases que se contradicen. Con recorte la nota de la regla se reemplaza por una sola:
#' «Se muestran las 20 más bajas de las 22 bajo 60%; las 2 siguientes no caben en esta lámina.» Sin regla, la de siempre
#' (`.tope_espacio_texto`). Con ajuste a mano las elegidas no son sólo las de la regla y se dicen «elegidas».
#' @param regla Regla del elemento (o NULL). @param k Filas que se muestran. @param n Filas que eligió la regla.
#' @param criterio Orden del recorte (`.tope_espacio_criterio`; el contraste recorta siempre por la mayor diferencia).
#' @param universo,n_grupos,grupos_unidad Los de la evaluación (para «todas» y «comunes»).
#' @keywords internal
.tope_espacio_frase <- function(regla, k, n, criterio = NULL, universo = "preguntas de escala", n_grupos = 2L, grupos_unidad = "públicos",
                               total = NULL, desde = 1L) {
  r <- .regla_preguntas_normalizar(regla)
  criterio <- criterio %||% .tope_espacio_criterio(r$tipo)
  desde <- .tope_espacio_desde(desde)
  if (is.null(r)) return(.tope_espacio_texto(k, n, criterio, desde = desde))
  # El universo se conserva (decisión del lead, 2026-11-09): «…de las 22 bajo 60%, de 157 preguntas de escala; …». Con
  # «todas» y «comunes» las elegidas ya son el universo y no se repite.
  cola <- if (!is.null(total) && is.finite(total) && !r$tipo %in% c("todas", "comunes")) paste0(", ", .regla_preguntas_de_total(total, universo)) else ""
  ajuste <- length(r$agregar) > 0L || length(r$quitar) > 0L || identical(r$tipo, "a_mano")
  de <- if (ajuste) sprintf("de las %d elegidas", n) else switch(r$tipo,
    bajo_umbral = sprintf("de las %d bajo %s%%", n, .regla_preguntas_umbral_txt(r$umbral)),
    diferencia_minima = sprintf("de las %d con diferencia de al menos %s %s", n, .regla_preguntas_umbral_txt(r$umbral),
                                if (r$umbral == 1) "punto" else "puntos"),
    todas = sprintf("de las %d %s", n, universo),
    comunes = sprintf("de las %d preguntas comunes a los %s %s", n,
                      if (n_grupos >= 2L && n_grupos <= length(.REGLA_PREGUNTAS_NUMEROS)) .REGLA_PREGUNTAS_NUMEROS[n_grupos] else .regla_preguntas_cifra(n_grupos),
                      grupos_unidad),
    sprintf("de las %d elegidas", n))
  # P14: con `continuar_desde`, «de la 12 a la 22 de las 22 bajo 60%…»; la cola dice cuántas siguen, sin prometer una
  # lámina que no existe.
  cab <- if (desde > 1L) sprintf("de la %d a la %d", desde, desde + k - 1L) else if (identical(criterio, "primeras")) sprintf("las primeras %d", k) else sprintf("las %d %s", k, criterio)
  paste0(sprintf("Se muestran %s %s%s", cab, de, cola), .tope_espacio_siguientes(n - (desde - 1L) - k))
}

#' Aviso al analista (sin nombrar la serie: dice qué pasó y qué hacer)
#' @keywords internal
.tope_espacio_aviso <- function(k, n, desde = 1L, consejo = TRUE) {
  desde <- .tope_espacio_desde(desde)
  hecho <- sprintf("%d filas no caben en la lámina: se muestran %d y el pie lo dice.", n - (desde - 1L), k)
  if (!isTRUE(consejo)) return(hecho)
  paste(hecho, .tope_espacio_consejo(desde + k))
}

#' El consejo del aviso (P14): la lámina siguiente la agrega el analista, desde la posición que sigue
#' @keywords internal
.tope_espacio_consejo <- function(siguiente) sprintf("Para las siguientes, agrega una lámina que continúe desde la %d.", as.integer(siguiente))

#' Recorta un contraste a los temas de mayor diferencia que caben (`datos` tidy: eje, grupo, valor)
#'
#' La diferencia es la de la lámina (`.contraste_diferencia` sobre las cifras redondeadas: el primero menos el segundo
#' con dos grupos, el mayor menos el menor con tres o más), en valor absoluto; en un empate gana el orden declarado.
#' @return `list(datos, texto)`; `texto` es NULL si todo cabe.
#' @keywords internal
.contraste_tope_espacio <- function(datos, decimales = 0L, desde = 1L) {
  desde <- .tope_espacio_desde(desde)
  if (!is.data.frame(datos) || !nrow(datos)) return(list(datos = datos, texto = NULL))
  eje <- as.character(datos$eje); grp <- as.character(datos$grupo)
  temas <- if (is.factor(datos$eje)) intersect(levels(datos$eje), unique(eje)) else unique(eje)
  grupos <- if (is.factor(datos$grupo)) intersect(levels(datos$grupo), unique(grp)) else unique(grp)
  tope <- .contraste_tope_filas(length(grupos))
  if (length(temas) <= tope && desde == 1L) return(list(datos = datos, texto = NULL))
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  R <- vapply(grupos, function(g) {
    v <- suppressWarnings(as.numeric(datos$valor))[match(paste(temas, g), paste(eje, grp))]
    .pulso_round_half_up(v, dec)
  }, numeric(length(temas)))
  R <- matrix(R, nrow = length(temas))
  dif <- abs(.contraste_diferencia(R)); dif[!is.finite(dif)] <- -Inf
  rango <- order(-dif, seq_along(temas))
  if (desde > 1L) rango <- rango[-seq_len(min(length(rango), desde - 1L))]   # P14: desde la que pide `continuar_desde`
  if (!length(rango)) stop("`continuar_desde` pasa de las ", length(temas), " preguntas del contraste.", call. = FALSE)
  k <- min(tope, length(rango))
  quedan <- temas[sort(rango[seq_len(k)])]
  d <- datos[eje %in% quedan, , drop = FALSE]
  if (is.factor(d$eje)) d$eje <- factor(as.character(d$eje), levels = intersect(levels(datos$eje), quedan))
  for (a in setdiff(names(attributes(datos)), c("names", "row.names", "class"))) attr(d, a) <- attr(datos, a)
  if (length(rango) > k) .pulso_aviso(.aviso_en_lamina(.tope_espacio_aviso(k, length(temas), desde)))
  list(datos = d, texto = .tope_espacio_texto(k, length(temas), "de mayor diferencia", desde = desde))
}

#' Recorta las preguntas de la escala del resumen a las que caben, en el orden de la regla
#'
#' @param vars Refs ya elegidas por la regla (en su orden) o declaradas. @param regla Regla del elemento.
#' @return `list(vars, texto)`; `texto` es NULL si todo cabe.
#' @keywords internal
.divergentes_tope_espacio <- function(vars, regla = NULL) {
  v <- as.character(unlist(vars))
  tope <- .LAM_DIV_RESUMEN_MAX_FILAS
  if (length(v) <= tope) return(list(vars = vars, texto = NULL))
  .pulso_aviso(.aviso_en_lamina(.tope_espacio_aviso(tope, length(v))))
  list(vars = utils::head(v, tope), texto = .tope_espacio_frase(regla, tope, length(v)))
}

#' Recorta lo que eligió la regla a lo que cabe, en el orden de su métrica, y la nota lo dice en una frase (P7, P5)
#'
#' La escala del resumen recorta en el orden de la regla (las más bajas con «bajo umbral», con el desempate por el valor
#' sin redondear de graficos_regla_desempate.R); el contraste de página entera, por la mayor diferencia absoluta (la
#' misma de `.contraste_tope_espacio`), y conserva el orden de la regla entre las que quedan. El conteo y el render
#' reciben lo mismo: las elegidas son las que se dibujan.
#' @param ev Evaluación. @param ind Indicadores. @param el Elemento. @param regla Regla normalizada.
#' @return `list(ev, aviso)`; `aviso` es NULL si todo cabe.
#' @keywords internal
.regla_preguntas_recortar <- function(ev, ind, el, regla, decimales = 0L) {
  et <- as.character(el$.element_type %||% "")[1]
  if (isTRUE(el$.sin_recorte)) return(list(ev = ev, aviso = NULL))   # `base$*` sin regla: recorta el render (graficos_escala_comodin.R)
  contraste <- identical(et, "dumbbell") && identical((el$overrides %||% list())$estilo, "resumen") && !.tope_espacio_en_ranura(el)
  if (!identical(et, "barras_divergentes") && !contraste) return(list(ev = ev, aviso = NULL))
  temas <- as.character(ev$temas); n <- length(temas)
  desde <- .tope_espacio_desde(el$continuar_desde)
  k_grupos <- length(unique(as.character(ind$indicadores$grupo)))
  tope <- if (contraste) .contraste_tope_filas(k_grupos) else .LAM_DIV_RESUMEN_MAX_FILAS
  if (n <= tope && desde == 1L) return(list(ev = ev, aviso = NULL))
  # El orden de la prioridad: el de la regla en la escala; la mayor diferencia absoluta en el contraste.
  prioridad <- if (contraste) {
    d <- .regla_preguntas_evaluar(ind$indicadores, list(tipo = "mayor_diferencia", n = max(1L, length(unique(ind$indicadores$tema)))),
                                  universo = ind$universo, grupos_unidad = ind$grupos_unidad, decimales = decimales)
    rango <- match(temas, d$temas); rango[is.na(rango)] <- .Machine$integer.max
    order(rango, seq_along(temas))
  } else seq_along(temas)
  # P14: `continuar_desde` (1-based, en ese orden) salta las que ya mostró otra lámina.
  if (desde > n) .regla_preguntas_falla(sprintf("`continuar_desde` (%d) pasa de las %d preguntas que elige la regla.", desde, n), list(continuar_desde = desde))
  if (desde > 1L) prioridad <- prioridad[-seq_len(desde - 1L)]
  k <- min(tope, length(prioridad))
  quedan <- temas[sort(prioridad[seq_len(k)])]
  if (!contraste) quedan <- temas[prioridad[seq_len(k)]]
  ev$temas <- quedan
  if (is.data.frame(ev$candidatas) && nrow(ev$candidatas)) ev$candidatas$seleccionada <- ev$candidatas$tema %in% quedan
  ev$texto <- .tope_espacio_frase(regla, k, n, criterio = if (contraste) "de mayor diferencia" else NULL, universo = ev$universo %||% "preguntas de escala", total = ev$total,
                                  n_grupos = k_grupos, grupos_unidad = ind$grupos_unidad %||% "públicos", desde = desde)
  queda_fuera <- n - (desde - 1L) - k > 0L
  aviso <- if (queda_fuera) sprintf("La regla elige %d preguntas y la lámina admite %d: %s", n, tope, sub("^Se muestran", "se muestran", ev$texto))
  list(ev = ev, aviso = aviso, recorte = if (queda_fuera) c(k = k, n = n, desde = desde))
}

#' ¿El elemento va en una ranura (lámina de dos o cuatro gráficos)? Ahí recorta la ranura con lo que de verdad cabe (P5)
#' @keywords internal
.tope_espacio_en_ranura <- function(el) {
  a <- suppressWarnings(as.numeric((el$overrides %||% list())$ancho %||% NA_real_)[1])
  is.finite(a) && a < 10
}

#' Une la nota de la regla con la del recorte por espacio
#' @keywords internal
.tope_espacio_unir <- function(texto_regla, texto_tope) {
  t <- c(texto_regla, texto_tope)
  t <- t[!is.na(t) & nzchar(trimws(t))]
  if (length(t)) paste(t, collapse = " ") else NULL
}

#' Pone la nota del recorte en el pie de un gráfico que no lleva especificación de resumen (el dumbbell clásico)
#' @keywords internal
.tope_espacio_al_pie <- function(p, el, texto) {
  if (is.null(texto) || is.null(p)) return(p)
  previa <- attr(p, "note_outside", exact = TRUE) %||% (el$overrides %||% list())$nota_pie %||% el$nota_pie
  previa <- trimws(as.character(previa %||% "")[1])
  attr(p, "note_outside") <- .lam_unir_base(if (is.na(previa) || !nzchar(previa)) NULL else previa, texto)
  p
}
