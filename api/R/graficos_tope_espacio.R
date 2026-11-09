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
# (P7): con regla, «Se muestran las 20 más bajas de las 22 bajo 60%; el resto en otra lámina.»; sin regla,
#   «Por espacio, se muestran las primeras 20 de 22; el resto en otra lámina.»
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
.tope_espacio_texto <- function(k, n, criterio) {
  if (identical(criterio, "primeras")) return(sprintf("Por espacio, se muestran las primeras %d de %d; el resto en otra lámina.", k, n))
  sprintf("Por espacio, se muestran las %d %s de %d; el resto en otra lámina.", k, criterio, n)
}

#' La nota de la regla cuando el recorte por espacio deja menos filas de las que eligió: UNA frase (P7)
#'
#' Prueba con Arte (2026-11-09): el pie decía «Se muestran las 22 bajo 60%» y luego «Por espacio, se muestran las 20 más
#' bajas de 22»: dos frases que se contradicen. Con recorte la nota de la regla se reemplaza por una sola:
#' «Se muestran las 20 más bajas de las 22 bajo 60%; el resto en otra lámina.» Sin regla, la de siempre
#' (`.tope_espacio_texto`). Con ajuste a mano las elegidas no son sólo las de la regla y se dicen «elegidas».
#' @param regla Regla del elemento (o NULL). @param k Filas que se muestran. @param n Filas que eligió la regla.
#' @param criterio Orden del recorte (`.tope_espacio_criterio`; el contraste recorta siempre por la mayor diferencia).
#' @param universo,n_grupos,grupos_unidad Los de la evaluación (para «todas» y «comunes»).
#' @keywords internal
.tope_espacio_frase <- function(regla, k, n, criterio = NULL, universo = "preguntas de escala", n_grupos = 2L, grupos_unidad = "públicos") {
  r <- .regla_preguntas_normalizar(regla)
  criterio <- criterio %||% .tope_espacio_criterio(r$tipo)
  if (is.null(r)) return(.tope_espacio_texto(k, n, criterio))
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
  cab <- if (identical(criterio, "primeras")) sprintf("las primeras %d", k) else sprintf("las %d %s", k, criterio)
  sprintf("Se muestran %s %s; el resto en otra lámina.", cab, de)
}

#' Aviso al analista (sin nombrar la serie: dice qué pasó y qué hacer)
#' @keywords internal
.tope_espacio_aviso <- function(k, n) {
  sprintf("%d filas no caben en la lámina: se muestran %d y el pie lo dice; el resto va en otra lámina.", n, k)
}

#' Recorta un contraste a los temas de mayor diferencia que caben (`datos` tidy: eje, grupo, valor)
#'
#' La diferencia es la de la lámina (`.contraste_diferencia` sobre las cifras redondeadas: el primero menos el segundo
#' con dos grupos, el mayor menos el menor con tres o más), en valor absoluto; en un empate gana el orden declarado.
#' @return `list(datos, texto)`; `texto` es NULL si todo cabe.
#' @keywords internal
.contraste_tope_espacio <- function(datos, decimales = 0L) {
  if (!is.data.frame(datos) || !nrow(datos)) return(list(datos = datos, texto = NULL))
  eje <- as.character(datos$eje); grp <- as.character(datos$grupo)
  temas <- if (is.factor(datos$eje)) intersect(levels(datos$eje), unique(eje)) else unique(eje)
  grupos <- if (is.factor(datos$grupo)) intersect(levels(datos$grupo), unique(grp)) else unique(grp)
  tope <- .contraste_tope_filas(length(grupos))
  if (length(temas) <= tope) return(list(datos = datos, texto = NULL))
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  R <- vapply(grupos, function(g) {
    v <- suppressWarnings(as.numeric(datos$valor))[match(paste(temas, g), paste(eje, grp))]
    .pulso_round_half_up(v, dec)
  }, numeric(length(temas)))
  R <- matrix(R, nrow = length(temas))
  dif <- abs(.contraste_diferencia(R)); dif[!is.finite(dif)] <- -Inf
  quedan <- temas[sort(order(-dif, seq_along(temas))[seq_len(tope)])]
  d <- datos[eje %in% quedan, , drop = FALSE]
  if (is.factor(d$eje)) d$eje <- factor(as.character(d$eje), levels = intersect(levels(datos$eje), quedan))
  for (a in setdiff(names(attributes(datos)), c("names", "row.names", "class"))) attr(d, a) <- attr(datos, a)
  .pulso_aviso(.aviso_en_lamina(.tope_espacio_aviso(tope, length(temas))))
  list(datos = d, texto = .tope_espacio_texto(tope, length(temas), "de mayor diferencia"))
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
  k_grupos <- length(unique(as.character(ind$indicadores$grupo)))
  tope <- if (contraste) .contraste_tope_filas(k_grupos) else .LAM_DIV_RESUMEN_MAX_FILAS
  if (n <= tope) return(list(ev = ev, aviso = NULL))
  if (contraste) {
    d <- .regla_preguntas_evaluar(ind$indicadores, list(tipo = "mayor_diferencia", n = max(1L, length(unique(ind$indicadores$tema)))),
                                  universo = ind$universo, grupos_unidad = ind$grupos_unidad, decimales = decimales)
    rango <- match(temas, d$temas); rango[is.na(rango)] <- .Machine$integer.max
    quedan <- temas[sort(order(rango, seq_along(temas))[seq_len(tope)])]
  } else quedan <- utils::head(temas, tope)
  ev$temas <- quedan
  if (is.data.frame(ev$candidatas) && nrow(ev$candidatas)) ev$candidatas$seleccionada <- ev$candidatas$tema %in% quedan
  ev$texto <- .tope_espacio_frase(regla, tope, n, criterio = if (contraste) "de mayor diferencia" else NULL, universo = ev$universo %||% "preguntas de escala",
                                  n_grupos = k_grupos, grupos_unidad = ind$grupos_unidad %||% "públicos")
  aviso <- sprintf("La regla elige %d preguntas y la lámina admite %d: %s", n, tope, sub("^Se muestran", "se muestran", ev$texto))
  list(ev = ev, aviso = aviso, recorte = c(k = tope, n = n))
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
