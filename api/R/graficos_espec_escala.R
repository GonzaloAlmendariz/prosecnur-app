# =============================================================================
# graficos_espec_escala.R — lo que afirma un gráfico de escala (ADR 0093)
# =============================================================================
#
# La especificación es la capa pura del motor nativo: lo que el gráfico dice, ya
# resuelto, sin dibujar nada. La llenan las reglas del recetario donde éste las
# declara (ADR 0093, punto 2; Gonzalo: «Debe ser 100% fiel al recetario»):
#
# - redondeo de las láminas 20 y 21 (`estandar`: desde 0.5 sube; `reparto`:
#   resto mayor), con `.pulso_pct_unidades`;
# - Top Two Box de la lámina 19: «la suma de los dos valores superiores»,
#   «90% = 35% + 55%», o sea la SUMA DE LAS CIFRAS ROTULADAS de las categorías
#   declaradas, para que el lector pueda sumarla;
# - SIN INF como último segmento, dentro de la base (láminas 216 y 221);
# - una batería de un solo público se ordena por Top Two Box (lámina 221);
# - cada segmento mide su cifra rotulada sobre la suma de su fila
#   (`barra_apilada()` del recetario); lo que se rotula 0 % no se dibuja.
#
# Los renderers (PPT nativo, Word ggplot) leen esto y no recalculan nada.

.ESPEC_ESCALA_VERSION <- "escala/1"

#' Especificación de un gráfico de escala (apiladas y multiapiladas)
#'
#' Recibe la misma tabla ancha que `graficar_barras_apiladas()`: una fila por
#' categoría del eje (afirmación o actor) y una columna de proporción por
#' categoría de la escala.
#'
#' @param data Tabla ancha.
#' @param var_categoria,var_n,cols_porcentaje,etiquetas_grupos Como en
#'   `graficar_barras_apiladas()`.
#' @param var_n_casos,cols_n_casos Columnas de casos sin ponderar de la fila y de cada segmento (contrato
#'   base-sin-ponderar F6): «x de y», la base chica y «N respuestas» se cuentan ahí; los porcentajes siguen ponderados.
#'   Sin ellas, los casos son `var_n` y el box se estima desde la proporción, como antes.
#' @param fila_total_bases `"una"` o `"varias"`: cómo pesa cada fila en la fila Total (`.apiladas_fila_total`, D-a).
#' @param orden `"declarado"` (por defecto: filas que son públicos o niveles de un
#'   cruce no se reordenan), `"auto"` (por Top Two Box si ninguna premisa tiene
#'   varias barras y hay box) o `"top_two_box"`. La batería de afirmaciones la pide
#'   el compositor (`.espec_ordenar_por_box`).
#' @return Lista con `version`, `categorias`, `filas`, `unidades`, `cifras`,
#'   `anchos`, `dibujar`, `box`, `box2`, `orden`, `redondeo`.
#' @keywords internal
preparar_escala <- function(data, var_categoria, var_n, cols_porcentaje, etiquetas_grupos,
                            var_etiqueta_categoria = NULL, var_grupo_id = NULL, var_grupo_titulo = NULL,
                            escala_valor = c("proporcion_1", "proporcion_100"), colores_grupos = NULL,
                            etiquetas_leyenda = NULL, decimales = 0, metodo_redondeo = "estandar",
                            mostrar_categorias_en_cero = FALSE, piso_categoria_cero = .BARRAS_PISO_CERO,
                            mostrar_barra_extra = TRUE, barra_extra_preset = "ninguno",
                            top2box_labels = NULL, top3box_labels = NULL, bottom2box_labels = NULL,
                            columna_bottom2box = FALSE, sufijos_etiqueta = NULL, fila_total = FALSE,
                            orden = c("declarado", "auto", "top_two_box"),
                            invertir_barras = FALSE, invertir_segmentos = FALSE, invertir_leyenda = FALSE,
                            var_n_casos = NULL, cols_n_casos = NULL, fila_total_bases = "una") {
  escala_valor <- match.arg(escala_valor)
  orden <- match.arg(orden)
  metodo <- .pulso_pct_metodo(metodo_redondeo)
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0) dec <- 0L
  df <- as.data.frame(data, stringsAsFactors = FALSE)
  if (is.null(var_etiqueta_categoria)) var_etiqueta_categoria <- var_categoria

  var_n_casos <- .graficos_col_casos(df, var_n, var_n_casos)
  cols_n_casos <- .graficos_cols_casos(df, stats::setNames(cols_porcentaje, cols_porcentaje), cols_n_casos)
  con_casos_seg <- !identical(unname(cols_n_casos), cols_porcentaje)
  if (isTRUE(fila_total)) {
    df <- .apiladas_fila_total(df, var_categoria, var_etiqueta_categoria, var_n, cols_porcentaje,
                               cols_n = if (con_casos_seg) cols_n_casos, var_n_casos = var_n_casos,
                               varias_bases = identical(fila_total_bases, "varias"))
  }
  es_total <- rep(FALSE, nrow(df))
  if (isTRUE(fila_total) && nrow(df) > nrow(data)) es_total[1] <- TRUE

  # ---- categorías de la escala, de izquierda a derecha ----------------------
  cols_seg <- if (isTRUE(invertir_segmentos)) rev(cols_porcentaje) else cols_porcentaje
  rotulos <- unname(as.character(etiquetas_grupos[cols_seg]))
  rotulos[is.na(rotulos) | !nzchar(rotulos)] <- cols_seg[is.na(rotulos) | !nzchar(rotulos)]
  if (!is.null(etiquetas_leyenda) && !is.null(names(etiquetas_leyenda))) {
    hit <- as.character(unlist(etiquetas_leyenda))[match(rotulos, names(etiquetas_leyenda))]
    ok <- !is.na(hit) & nzchar(trimws(hit)); rotulos[ok] <- hit[ok]
  }
  colores <- tryCatch(.graficos_mk_palette(unname(as.character(etiquetas_grupos[cols_seg])), pal_user = colores_grupos),
                      error = function(e) NULL)
  colores <- unname(colores %||% rep(.std_color("tenue"), length(cols_seg)))
  if (length(colores) < length(cols_seg)) colores <- rep_len(colores, length(cols_seg))
  especial <- vapply(seq_along(cols_seg), function(i) .is_special_box_choice(cols_seg[i], rotulos[i]), logical(1))
  categorias <- data.frame(col = cols_seg, rotulo = rotulos, color = colores[seq_along(cols_seg)],
                           especial = especial, stringsAsFactors = FALSE)
  leyenda <- if (isTRUE(invertir_leyenda)) rev(seq_len(nrow(categorias))) else seq_len(nrow(categorias))

  # ---- filas en su orden de origen -------------------------------------------
  rot_fila <- as.character(df[[var_etiqueta_categoria]]); rot_fila[is.na(rot_fila)] <- ""
  # Los rótulos pueden llegar envueltos con saltos de línea para ggplot (`stringr::str_wrap` en la
  # multiapilada): la caja nativa envuelve sola, así que el salto se vuelve espacio.
  rot_fila <- trimws(gsub("\\s*\n\\s*", " ", rot_fila))
  filas <- data.frame(
    id = as.character(df[[var_categoria]]), rotulo = rot_fila,
    grupo_id = if (!is.null(var_grupo_id)) as.character(df[[var_grupo_id]]) else NA_character_,
    grupo_titulo = if (!is.null(var_grupo_titulo)) trimws(gsub("\\s*\n\\s*", " ", as.character(df[[var_grupo_titulo]]))) else NA_character_,
    n = suppressWarnings(as.numeric(df[[var_n]])), n_casos = suppressWarnings(as.numeric(df[[var_n_casos]])),
    es_total = es_total, stringsAsFactors = FALSE
  )
  origen <- seq_len(nrow(filas)); if (isTRUE(invertir_barras)) origen <- rev(origen)

  # ---- cifras y anchos: unidades del motor, anchos por cifra rotulada ---------
  prop <- as.matrix(df[, cols_seg, drop = FALSE]); storage.mode(prop) <- "double"
  if (escala_valor == "proporcion_100") prop <- prop / 100
  prop[!is.finite(prop)] <- 0
  unidades <- t(apply(prop, 1, function(p) {
    s <- sum(p); if (s <= 0) return(integer(length(p)))
    .pulso_pct_unidades(p / s, dec, metodo)
  }))
  if (length(cols_seg) == 1L) unidades <- t(unidades)
  dimnames(unidades) <- list(filas$id, cols_seg)
  cifras <- matrix(.pulso_fmt_pct_unidades(unidades, dec), nrow(unidades), dimnames = dimnames(unidades))
  if (is.data.frame(sufijos_etiqueta) && nrow(sufijos_etiqueta) &&
      all(c(var_categoria, ".col_pct", ".sufijo") %in% names(sufijos_etiqueta))) {
    for (k in seq_len(nrow(sufijos_etiqueta))) {
      i <- match(as.character(sufijos_etiqueta[[var_categoria]][k]), filas$id)
      j <- match(sufijos_etiqueta$.col_pct[k], cols_seg)
      suf <- as.character(sufijos_etiqueta$.sufijo[k])
      if (!is.na(i) && !is.na(j) && unidades[i, j] > 0 && nzchar(suf)) cifras[i, j] <- paste(cifras[i, j], suf)
    }
  }
  # Categorías en cero (C40 D2): el sustantivo sin casos recibe su piso; una especial (SIN INF, 90-99) en cero no se
  # dibuja ni ocupa ancho: los especiales sólo se muestran si están presentes (nucleo-metodologico regla 3).
  cero_visible <- isTRUE(mostrar_categorias_en_cero) & !categorias$especial
  dibujar <- unidades > 0 | matrix(cero_visible, nrow(unidades), ncol(unidades), byrow = TRUE)
  anchos <- t(vapply(seq_len(nrow(unidades)), function(i) {
    u <- as.numeric(unidades[i, ]); s <- sum(u)
    a <- if (s > 0) u / s else numeric(length(u))
    if (isTRUE(mostrar_categorias_en_cero)) {
      a <- .barras_inflar_ceros(a, mostrar = TRUE, piso = piso_categoria_cero, cero_rotulado = u == 0 & cero_visible)
      if (sum(a) > 0) a <- a / sum(a)
    }
    a
  }, numeric(ncol(unidades))))
  if (ncol(unidades) == 1L) anchos <- t(anchos)
  dimnames(anchos) <- dimnames(unidades)
  dibujar <- dibujar & (anchos > 0 | matrix(cero_visible, nrow(anchos), ncol(anchos), byrow = TRUE))

  # ---- Top Two Box: suma de las cifras rotuladas (lámina 19) ------------------
  caja <- function(preset, labels, minimo, rotulo) {
    dec_box <- .box_decidir(labels = labels, etiquetas_grupos = etiquetas_grupos,
                            cols_porcentaje = cols_porcentaje, minimo = minimo)
    if (!isTRUE(dec_box$dibujar)) return(list(preset = preset, rotulo = rotulo, cols = character(0),
                                              unidades = NULL, cifras = NULL, casos = NULL, motivo = dec_box$motivo))
    # Nunca SIN INF ni los códigos 90-99, aunque se declaren: no son «valores superiores» de la escala.
    cols <- setdiff(intersect(dec_box$cols, cols_seg), categorias$col[categorias$especial])
    u <- rowSums(unidades[, cols, drop = FALSE])
    # Casos del box sobre la base de la fila: el recetario escribe «x de y» bajo la cifra cuando la base es
    # chica (recetario.R:238-244). Son personas que contestaron esas categorías, sin ponderar: la suma de los casos
    # crudos de sus columnas (`nc_i`), no `prop × n` (con peso, la proporción ponderada por los casos no es un conteo).
    casos <- if (con_casos_seg) {
      crudos <- matrix(0, nrow(df), length(cols))
      for (k in seq_along(cols)) { v <- suppressWarnings(as.numeric(df[[cols_n_casos[[cols[k]]]]])); v[!is.finite(v)] <- 0; crudos[, k] <- v }
      rowSums(crudos)
    } else {
      sumas <- rowSums(prop); pn <- prop / ifelse(sumas > 0, sumas, 1)
      floor(rowSums(pn[, cols, drop = FALSE]) * .espec_casos(filas) + 0.5)
    }
    list(preset = preset, rotulo = rotulo, cols = cols, unidades = u,
         cifras = .pulso_fmt_pct_unidades(u, dec), casos = unname(casos), motivo = NULL)
  }
  box <- NULL; box2 <- NULL
  if (isTRUE(mostrar_barra_extra) && barra_extra_preset %in% c("top2box", "top3box", "bottom2box")) {
    box <- switch(barra_extra_preset,
      top2box = caja("top2box", top2box_labels, 3L, .PPT_ROTULO_TOP_TWO_BOX),
      top3box = caja("top3box", top3box_labels, 4L, "Top 3 Box"),
      bottom2box = caja("bottom2box", bottom2box_labels, 3L, "Bottom Two Box"))
    if (identical(barra_extra_preset, "top2box") && isTRUE(columna_bottom2box) && length(box$cols)) {
      box2 <- caja("bottom2box", bottom2box_labels, 3L, "Bottom Two Box")
    }
  }

  # ---- orden (lámina 221): batería de un público por Top Two Box ---------------
  # «Un público» = ninguna premisa con varias barras. Con actores (un grupo con varias filas) el recetario
  # conserva su orden declarado, aunque sea una sola afirmación.
  grupos <- filas$grupo_id[!is.na(filas$grupo_id)]
  un_publico <- !length(grupos) || all(table(grupos) <= 1L)
  por_box <- !is.null(box$unidades) && (identical(orden, "top_two_box") || (identical(orden, "auto") && un_publico))
  aplicado <- if (por_box) .espec_orden_por_box(origen, filas$es_total, box$unidades) else origen

  list(
    version = .ESPEC_ESCALA_VERSION, tipo = "escala",
    categorias = categorias, leyenda = leyenda, filas = filas,
    unidades = unidades, cifras = cifras, anchos = anchos, dibujar = dibujar,
    box = box, box2 = box2,
    orden = list(criterio = if (por_box) "top_two_box" else "declarado", origen = origen, aplicado = aplicado),
    redondeo = list(metodo = metodo, decimales = dec)
  )
}

#' Orden por Top Two Box de mayor a menor (lámina 221 del recetario)
#'
#' La fila Total va primera; los empates conservan el orden de origen.
#' @keywords internal
.espec_orden_por_box <- function(origen, es_total, unidades) {
  resto <- origen[!es_total[origen]]
  resto <- resto[order(-unidades[resto], match(resto, origen))]
  c(origen[es_total[origen]], resto)
}

#' Reordena una especificación de escala por su Top Two Box
#'
#' La usa el compositor cuando el elemento es una batería de afirmaciones
#' (`p_barras_multiapiladas`, `modo = "var"`): ahí el recetario ordena. Los
#' niveles de un cruce (ciclo, sexo) conservan su orden.
#' @keywords internal
.espec_ordenar_por_box <- function(espec) {
  if (is.null(espec$box$unidades)) return(espec)
  espec$orden$aplicado <- .espec_orden_por_box(espec$orden$origen, espec$filas$es_total, espec$box$unidades)
  espec$orden$criterio <- "top_two_box"
  espec
}

