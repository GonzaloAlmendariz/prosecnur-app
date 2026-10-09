# =============================================================================
# estandar_presets.R — los proyectos guardados migran solos al estándar (ADR 0092)
# =============================================================================
#
# La UI de Base PPT guarda TODOS los args del preset, así que un proyecto viejo
# trae su propia copia del estilo de entonces (base a 14 pt, leyenda a 16, cifras
# a 5.6) y esa copia gana sobre el suelo de fábrica. Medido el 2026-10-08 sobre
# el mazo de referencia: con el suelo ya en 10 pt, las 58 láminas seguían
# escribiendo la base a 14 porque la sacaban del proyecto.
#
# Decisión de Gonzalo (2026-10-08): «El recetario es el estándar» y los
# proyectos «migran solos», con aviso de lo que cambia. Las claves de esta tabla
# las fija el estándar y dejan de ser una preferencia del proyecto: se imponen al
# normalizar la config y al renderizar. Cuando el valor guardado era otro, el
# render lo dice con nombre (`[PULSO-AVISO]`); nunca se pisa en silencio.
#
# Sólo entran claves cuyo significado en el motor es inequívoco. Colores y
# paletas quedan fuera: son lo único que un perfil de cliente puede cambiar.

#' Claves de `base` que fija el estándar, con su valor y su token de origen
#' @keywords internal
.std_claves_base <- function() {
  list(
    size_nota_pie     = list(valor = .std_pt("base"),    token = "tipografia.base"),
    size_titulo_slide = list(valor = .std_pt("titulo"),  token = "tipografia.titulo"),
    size_leyenda      = list(valor = .std_pt("leyenda"), token = "tipografia.leyenda"),
    # Las cifras de barra viajan en milímetros de ggplot (1 mm = 72.27 / 25.4 pt).
    size_texto_barras = list(valor = round(.std_pt("cifra") * 25.4 / 72.27, 2), token = "tipografia.cifra"),
    font_family       = list(valor = .std_pt("fuente"),  token = "tipografia.fuente")
  )
}

#' Claves por tipo de gráfico que fija el estándar
#'
#' Reglas del recetario que no son de `base` sino de un tipo: en las apiladas,
#' la cifra que no cabe en su segmento sube con guía (`reglas.cifras_chicas`).
#' @keywords internal
.std_claves_tipo <- function() {
  # y la columna Top Two Box: cifras a 14 pt, rótulo a 10 pt, en su verde.
  claves <- list(
    etiquetas_arriba_si_no_caben = list(valor = TRUE, token = "reglas.cifras_chicas"),
    size_barra_extra  = list(valor = .std_pt("cifra"), token = "tipografia.cifra"),
    size_titulo_extra = list(valor = .std_pt("rotulo_top_two_box"), token = "tipografia.rotulo_top_two_box"),
    color_barra_extra = list(valor = .std_color("verde_top_two_box"), token = "colores.verde_top_two_box")
  )
  list(barras_apiladas = claves, multi_apiladas = claves)
}

#' Impone el estándar sobre `presets$base` (y `base$args` si existe)
#'
#' @param presets Presets del proyecto o del body del render.
#' @param avisar Si `TRUE`, emite un `[PULSO-AVISO]` con las claves cuyo valor
#'   guardado difería del estándar.
#' @return Los presets con las claves del estándar impuestas.
#' @keywords internal
.std_imponer_base <- function(presets, avisar = FALSE) {
  if (!is.list(presets)) return(presets)
  claves <- tryCatch(.std_claves_base(), error = function(e) NULL)
  if (is.null(claves)) return(presets)
  base <- presets$base
  if (!is.list(base)) base <- NULL
  cambios <- character(0)
  for (nm in if (is.null(base)) character(0) else names(claves)) {
    nuevo <- claves[[nm]]$valor
    for (donde in c("base", "args")) {
      holder <- if (identical(donde, "base")) base else base$args
      if (!is.list(holder)) next
      viejo <- holder[[nm]]
      # Una clave ausente no se crea: ahí rige el suelo de fábrica, que ya es el
      # estándar, y «no configurado» sigue siendo un estado que el motor distingue.
      if (is.null(viejo)) next
      if (!identical(as.character(viejo)[1], as.character(nuevo))) {
        cambios <- c(cambios, sprintf("%s %s → %s", nm, as.character(viejo)[1], as.character(nuevo)))
      }
      if (identical(donde, "base")) base[[nm]] <- nuevo else base$args[[nm]] <- nuevo
    }
  }
  if (!is.null(base)) presets$base <- base
  # Lo mismo, tipo por tipo, para las reglas que no son de `base`.
  for (tipo in names(.std_claves_tipo())) {
    entrada <- presets[[tipo]]
    if (!is.list(entrada)) next
    for (nm in names(.std_claves_tipo()[[tipo]])) {
      nuevo <- .std_claves_tipo()[[tipo]][[nm]]$valor
      for (donde in c("tipo", "args")) {
        holder <- if (identical(donde, "tipo")) entrada else entrada$args
        if (!is.list(holder) || is.null(holder[[nm]])) next
        if (!identical(as.character(holder[[nm]])[1], as.character(nuevo))) {
          cambios <- c(cambios, sprintf("%s de %s %s → %s", nm, tipo, as.character(holder[[nm]])[1], as.character(nuevo)))
        }
        if (identical(donde, "tipo")) entrada[[nm]] <- nuevo else entrada$args[[nm]] <- nuevo
      }
    }
    presets[[tipo]] <- entrada
  }
  # Valores de fábrica viejos que el proyecto guardó tal cual (la UI copiaba el
  # suelo entero) y que impiden que lleguen el histograma y el radar del
  # recetario. Sólo se migran si coinciden EXACTO con el viejo valor de fábrica:
  # un valor distinto es decisión del analista y se respeta.
  fosil <- .std_migrar_fosiles_graficos(presets)
  presets <- fosil$presets
  cambios <- c(cambios, fosil$cambios)
  cambios <- unique(cambios)
  if (isTRUE(avisar) && length(cambios)) {
    .pulso_aviso(
      "El estilo guardado en el proyecto se ajustó al estándar de los recetarios (ADR 0092): ",
      paste(cambios, collapse = ", "), "."
    )
  }
  presets
}


#' Migra los valores de fábrica viejos del histograma y del radar (ADR 0092, F2.7)
#'
#' `bins = 8` en el histograma y `limites = c(0, 1)` con `mostrar_niveles =
#' FALSE` en el radar eran el suelo de fábrica: guardados tal cual en el
#' proyecto, el histograma no llegaba a una barra por valor ni el radar a su eje
#' acercado. Medido el 2026-10-08 en el mazo de referencia.
#' @return Lista con `presets` y `cambios` (para el aviso).
#' @keywords internal
.std_migrar_fosiles_graficos <- function(presets) {
  cambios <- character(0)
  holder_de <- function(e) if (is.list(e$args)) "args" else "tipo"
  quitar <- function(tipo, clave, es_fosil, nuevo = NULL, texto) {
    e <- presets[[tipo]]
    if (!is.list(e)) return(invisible())
    h <- if (identical(holder_de(e), "args")) e$args else e
    if (is.null(h[[clave]]) || !isTRUE(es_fosil(h[[clave]]))) return(invisible())
    h[clave] <- list(nuevo)
    if (is.null(nuevo)) h[[clave]] <- NULL
    if (identical(holder_de(e), "args")) e$args <- h else e <- h
    presets[[tipo]] <<- e
    cambios <<- c(cambios, texto)
  }
  num <- function(v) suppressWarnings(as.numeric(unlist(v, use.names = FALSE)))
  quitar("histograma", "bins", function(v) identical(num(v), 8), NULL, "bins de histograma 8 → una barra por valor")
  quitar("radar_tabla", "limites", function(v) identical(num(v), c(0, 1)), NULL, "limites de radar_tabla 0–1 → eje desde el mínimo")
  quitar("radar_tabla", "mostrar_niveles", function(v) identical(as.logical(unlist(v))[1], FALSE), TRUE,
         "mostrar_niveles de radar_tabla FALSE → TRUE")
  list(presets = presets, cambios = cambios)
}


#' Migra el coral de fábrica del extremo negativo de las paletas Likert
#'
#' Las paletas por lista guardadas por versiones anteriores pintaban «Totalmente
#' en desacuerdo» (y sus equivalentes) con el rojo institucional `#CA5651`. El
#' recetario y el mazo aprobado usan el salmón de la escala Likert (`#F4B183`,
#' `.std_paleta("likert")[1]`; ver la rampa canónica en
#' `graficos_verificar_mazo.R`). Sólo se toca una paleta que YA trae la rampa del
#' recetario en el resto de la escala: una paleta propia del cliente, con otros
#' colores, se respeta.
#' @return Lista con `paletas` y `cambios` (nombres de lista migrados).
#' @keywords internal
.std_migrar_paletas <- function(paletas) {
  cambios <- character(0)
  if (!is.list(paletas) || !length(paletas)) return(list(paletas = paletas, cambios = cambios))
  likert <- toupper(.std_paleta("likert"))
  negativo <- c("totalmente en desacuerdo", "muy en desacuerdo", "muy insatisfecho", "nada satisfecho",
                "muy malo", "nada de acuerdo", "nada util", "nada importante")
  norm <- function(x) tolower(trimws(.box_norm_etiqueta(x)))
  for (ln in names(paletas)) {
    pal <- paletas[[ln]]
    cols <- toupper(as.character(unlist(pal, use.names = FALSE)))
    nms <- names(pal); if (is.null(nms)) next
    es_neg <- norm(nms) %in% norm(negativo) & cols == "#CA5651"
    if (!any(es_neg)) next
    if (!all(likert[2:4] %in% cols)) next   # no es la rampa del recetario: paleta del cliente
    for (k in which(es_neg)) pal[[k]] <- .std_paleta("likert")[1]
    paletas[[ln]] <- pal
    cambios <- c(cambios, ln)
  }
  list(paletas = paletas, cambios = cambios)
}
