# lamina_cifra_y_grafico.R — la cifra al lado y el gráfico protagonista con su desglose en línea (ADR 0129 §9)
#
# Maqueta «Colegio y resumen ejecutivo» (2026-11-04), alternativa B de la lámina 17
# (`02_colegio_B_cifra_y_desglose_en_linea.png`): a la izquierda, un tercio con la tarjeta de la cifra (rótulo, cifra
# grande, lo que mide, la franja partida con su intervalo y la comparación con la prueba del informe); a la derecha, el
# gráfico de la otra pregunta con las diferencias de grupo pegadas a su barra (lamina_tarjetas_en_linea.R).
#
# Decisión (para el lead): la composición no es un tipo de lámina nuevo sino una disposición de `p_slide_2_graficos`,
# `meta.composicion = "cifra_lateral"`, con la cifra en `meta.cifra` (`fila`, `texto`, `rotulo`, `franja`,
# `comparacion`). Un tipo nuevo exigía crecer `reporte_plan_ppt.R` (congelado) y el catálogo de tipos; la de dos gráficos
# ya trae las dos ranuras, sus elementos renderizados y su Word (dos figuras, con tarjetas). Vive aquí y no en
# `lamina_hallazgos.R`: de hallazgos reusa sin cambiarlos el modelo de la cifra (`.halla_kpi_modelo`: valor, intervalo
# con el diseño, comparación automática) y sus piezas (`.lam_halla_marco`, `.lam_halla_comparacion`).

#' ¿La lámina de dos gráficos pide la cifra al lado?
#' @keywords internal
.lam_cifra_lateral_aplica <- function(slide) identical(as.character(unlist((slide$meta %||% list())$composicion))[1], "cifra_lateral")

#' Franja partida de la cifra: la opción y el resto al 100%, el intervalo debajo y los dos rótulos
#' @return Fin vertical (in).
#' @keywords internal
.lam_cifra_franja <- function(lz, k, otro_rotulo, x, y, w) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  p <- max(0, min(1, k$valor / 100)); h <- 0.32
  .lam_caja(lz, x, y, w * p, h, azul, nombre = "cifra:franja")
  .lam_caja(lz, x + w * p, y, w * (1 - p), h, .std_color("tarjeta_barra_neutra"), nombre = "cifra:franja:resto")
  iv <- k$intervalo
  if (is.finite(iv$inferior %||% NA_real_) && is.finite(iv$superior %||% NA_real_)) {
    .lam_forma_borde(lz, x + w * iv$inferior, y + h + 0.06, max(0.04, w * (iv$superior - iv$inferior)), 0.06, fill = .std_color("azul_medio"),
                     geom = "roundRect", radio = 0.03, nombre = "cifra:intervalo")
  }
  yl <- y + h + 0.2
  .lam_txt(lz, paste(k$fila, k$cifra), x - 0.1, yl, w * 0.6, 0.3, 12, azul, bold = TRUE, nombre = "cifra:franja:rotulo")
  if (!is.null(otro_rotulo)) .lam_txt(lz, otro_rotulo, x + w * 0.4, yl, w * 0.6 + 0.1, 0.3, 12, azul, bold = TRUE, align = "right",
                                      nombre = "cifra:franja:rotulo")
  ci <- if (nzchar(k$intervalo_texto)) paste0(k$intervalo_texto, " con 95% de confianza (franja)") else ""
  if (nzchar(ci)) .lam_txt(lz, ci, x - 0.1, yl + 0.27, w + 0.2, 0.3, 11, suave, nombre = "cifra:intervalo:texto")
  yl + 0.6
}

#' Tarjeta de la cifra en `[l, l + w] × [t, t + h]`
#' @keywords internal
.lam_cifra_tarjeta <- function(lz, k, rotulo, otro, franja, l, t, w, h) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  pad <- 0.3; wi <- w - 2 * pad
  .lam_halla_marco(lz, l, t, w, h, "arriba")
  y <- t + 0.3
  if (!is.null(rotulo) && nzchar(rotulo)) { .lam_txt(lz, toupper(rotulo), l + pad - 0.1, y, wi + 0.2, 0.28, 10.5, suave, bold = TRUE, nombre = "cifra:rotulo"); y <- y + 0.32 }
  .lam_txt(lz, k$cifra, l + pad - 0.1, y, wi + 0.2, 1.05, 60, azul, bold = TRUE, nombre = "cifra:valor")
  y <- y + 1.1
  y <- .lam_halla_escribir(lz, .lam_halla_lineas(k$texto, wi, 16, 3), l + pad, y, wi, 16, azul, nombre = "cifra:texto") + 0.35
  y_comp <- t + h - 0.55
  if (isTRUE(franja) && !is.null(otro)) {
    .lam_cifra_franja(lz, k, otro, l + pad, max(y, y_comp - 1.55), wi)
  } else {
    .lam_halla_barra_intervalo(lz, k, l + pad, max(y + 0.2, y_comp - 1.0), wi)
    if (nzchar(k$intervalo_texto)) .lam_txt(lz, paste0(k$intervalo_texto, " con 95% de confianza"), l + pad - 0.1, max(y + 0.35, y_comp - 0.8),
                                            wi + 0.2, 0.3, 11, suave, nombre = "cifra:intervalo:texto")
  }
  .lam_caja(lz, l + pad, y_comp - 0.3, wi, 0.01, .std_color("filete"), nombre = "cifra:separador")
  if (!is.null(k$comparacion)) {
    if (identical(k$comparacion$estado, "sin_diferencias")) {
      # Completa, en hasta dos líneas («Sin diferencias por área, nivel, sexo ni estudios de padres»), como la maqueta.
      lin <- .lam_halla_lineas(k$comparacion$partes[[1]]$texto, wi, 12, 2, bold = TRUE)
      .lam_halla_escribir(lz, lin, l + pad, y_comp - 0.12, wi, 12, suave, bold = TRUE, nombre = "hallazgo:comparacion")
    } else {
      .lam_halla_comparacion(lz, k$comparacion, l + pad, y_comp, wi, pt = 11)
    }
  }
}

#' La lámina «cifra al lado y gráfico» (enganche de `.lam_slide_2_despacho`); NULL si no se puede componer
#' @param env Entorno del motor (`.resolve_ref`, el plan).
#' @keywords internal
.lam_slide_cifra_y_grafico <- function(doc, ps, els, slide, titulo, presets, antetitulo, base_auto, por_lamina = function(doc) doc, env = NULL,
                                       layout = "Graficos2", master = "Office Theme") {
  aviso <- function(...) if (exists(".pulso_aviso", mode = "function")) .pulso_aviso(paste0("Cifra y gráfico: ", ...))
  texto <- function(x) {
    x <- if (inherits(x, "ppt_element_text")) x$text else x
    if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  }
  resolver <- if (is.environment(env)) get0(".resolve_ref", envir = env, inherits = TRUE) else NULL
  cfg <- (slide$meta %||% list())$cifra %||% list()
  if (!is.function(resolver) || is.null(cfg$fila)) { aviso("la cifra necesita `meta.cifra.fila`; la lámina va como dos gráficos."); return(NULL) }
  var_c <- as.character(unlist(els[[1]]$var %||% els[[1]]$vars))[1]
  ctx <- resolver(var_c)
  fuente <- list(data = as.data.frame(ctx$data, stringsAsFactors = FALSE), survey = ctx$survey, choices = ctx$choices, orders_list = ctx$orders_list)
  sig <- .sig_contexto_render(fuente$data)
  # Los cruces y rótulos de la cifra: los de las tarjetas de la lámina (el mapa por ranura) o los del estudio.
  mapa <- .tarjetas_mapa(slide$meta)
  opt_g <- mapa$derecha %||% mapa$izquierda
  cx <- .dif_cruces(list(cruces = cfg$cruces %||% opt_g$cruces, rotulos = as.list(opt_g$rotulos %||% character(0)),
                         cortos = as.list(opt_g$cortos %||% character(0)), publico = opt_g$publico),
                    tryCatch(.dif_plan_render(), error = function(e) list()), sig, fuente)
  it <- .halla_kpi_item(c(list(var = var_c), cfg[intersect(names(cfg), c("fila", "filas", "top2box", "texto", "comparacion", "filtros"))]))
  k <- .halla_kpi_modelo(fuente, it, sig, cx, tauto = list(), n_lamina = nrow(fuente$data), con_grafico = FALSE)
  if (is.null(k)) return(NULL)
  # El gráfico de la derecha con su desglose en línea.
  ts <- .tarjetas_de_ranuras(ps, els, slide, env)
  t_g <- if (length(ts) >= 2L) ts[[2]] else NULL
  espec_g <- attr(ps[[2]], "pulso_espec")
  if (!is.list(espec_g) || !identical(espec_g$tipo, "categorica")) { aviso("el gráfico de la derecha no es una categórica en barras; la lámina va como dos gráficos."); return(NULL) }
  if (!is.null(t_g) && !identical(t_g$opcion$modo, "en_linea")) t_g$opcion$modo <- "en_linea"
  enl <- if (is.null(t_g)) list() else .tarjetas_en_linea(t_g, texto(titulo) %||% "")
  # La otra opción de la franja (dicotómica de dos opciones): «Estatal 15%».
  espec_c <- attr(ps[[1]], "pulso_espec")
  otro <- NULL
  if (is.list(espec_c) && identical(espec_c$tipo, "categorica") && length(espec_c$rotulos) == 2L) {
    j <- which(as.character(espec_c$rotulos) != k$fila)[1]
    if (!is.na(j)) otro <- paste(espec_c$rotulos[j], espec_c$cifras[j])
  }
  # Marco de la lámina.
  slots <- slide$slots %||% list()
  tit <- texto(titulo) %||% texto(slots$title) %||% ""
  base <- texto(slots$base) %||% texto(base_auto(els = els, sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
                                                  formato = presets$base$args$formato %||% "Base: %s"))
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, tit, ante = texto(antetitulo))
  lz <- .lam_lienzo()
  W <- .std_geom("ancho"); ML <- .std_geom("margen_izq"); MR <- .std_geom("margen_der")
  y0 <- .lam_titulo_fin(tit) + 0.4
  nota <- .dif_texto_metodo(sig$regla, sig$m)
  y_ley <- .std_valor("ppt", "geometria", "base_y") - 0.75
  wc <- (W - ML - MR) * 0.3
  .lam_cifra_tarjeta(lz, k, texto(cfg$rotulo), otro, !identical(cfg$franja, FALSE), ML, y0, wc, y_ley - 0.15 - y0)
  # Derecha: la pregunta del gráfico, su aclaración y las barras con el desglose.
  xr <- ML + wc + 0.5; xr1 <- W - MR
  preg <- texto(els[[2]]$overrides$titulo) %||% texto(els[[2]]$title_slide) %||% .tarjetas_rotulo_var(as.character(unlist(els[[2]]$var))[1], fuente$survey)
  .lam_txt(lz, preg, xr - 0.1, y0 - 0.05, xr1 - xr + 0.2, 0.36, 16, .std_color("azul"), bold = TRUE, nombre = "cifra:grafico:pregunta")
  yg <- y0 + 0.35
  if (sum(as.numeric(espec_g$valores %||% espec_g$largos), na.rm = TRUE) > 1.02) {
    .lam_txt(lz, "Respuesta múltiple. Los porcentajes suman más de 100%.", xr - 0.1, yg, xr1 - xr + 0.2, 0.3, 11, .std_color("texto_suave"), nombre = "cifra:grafico:aclaracion")
    yg <- yg + 0.32
  }
  .lam_barras_en_linea(lz, espec_g, enl, t_g$rotulos_cruce %||% character(0), t_g$opcion$cortos %||% character(0), xr, xr1, yg + 0.1, y_ley - 0.15,
                       titulo = tit)
  # Leyenda de marcas y método, sobre la base.
  if (length(enl)) .lam_en_linea_leyenda(lz, ML, y_ley)
  .lam_txt(lz, nota, ML - 0.1, y_ley + 0.27, W - ML - MR + 0.2, 0.42, 9.5, .std_color("texto_suave"), nombre = "cifra:metodo")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:cifra_y_grafico")
  doc <- .lam_pie(doc, base, length(doc))
  por_lamina(doc)
}
