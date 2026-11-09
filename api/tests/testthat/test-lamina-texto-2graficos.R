# "Dos gráficos con texto a la izquierda / a la derecha" (text_l2 / text_r2) van por la composición nativa:
# los gráficos lado a lado con el ancho y el alto reales de su ranura y el texto en su columna (Gonzalo, 2026-11-09:
# "Estos aún no se ven bien"; en la plantilla los gráficos iban apilados en cajones de 1.6 in y la torta era diminuta).

.t2g_fixture <- function() {
  set.seed(7); n <- 172
  df <- data.frame(sexo = sample(c("m", "h", "p"), n, TRUE, c(.52, .45, .03)),
                   ciclo = sample(paste0("c", 5:10), n, TRUE), stringsAsFactors = FALSE)
  ch <- rbind(data.frame(list_name = "sx", name = c("m", "h", "p"), label = c("Mujer", "Hombre", "Prefiero no responder")),
              data.frame(list_name = "cc", name = paste0("c", 5:10),
                         label = c("Quinto ciclo", "Sexto ciclo", "Séptimo ciclo", "Octavo ciclo", "Noveno ciclo", "Décimo ciclo")))
  inst <- list(survey = data.frame(name = c("sexo", "ciclo"), type = c("select_one sx", "select_one cc"), list_name = c("sx", "cc"),
                                   label = c("Sexo", "Ciclo")), choices = ch, orders_list = NULL)
  list(df = df, inst = inst)
}

.t2g_formas <- function(ppt, k = 1L) {
  d <- tempfile(); utils::unzip(ppt, exdir = d)
  x <- xml2::read_xml(file.path(d, "ppt", "slides", sprintf("slide%d.xml", k)))
  sps <- xml2::xml_find_all(x, "//p:sp|//p:pic|//p:graphicFrame")
  do.call(rbind, lapply(sps, function(s) {
    off <- xml2::xml_find_first(s, ".//a:off"); ext <- xml2::xml_find_first(s, ".//a:ext")
    data.frame(grupo = xml2::xml_attr(xml2::xml_find_first(s, "ancestor::p:grpSp[1]/p:nvGrpSpPr/p:cNvPr"), "name") %||% NA_character_,
               nombre = xml2::xml_attr(xml2::xml_find_first(s, ".//p:cNvPr"), "name"),
               x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
               w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400,
               texto = paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t")), collapse = ""), stringsAsFactors = FALSE)
  }))
}

.t2g_render <- function(fn, motor_nativo = TRUE) {
  f <- .t2g_fixture()
  sl <- fn(p_pie(var = "sexo"), p_barras_agrupadas(var = "ciclo"), texto = "Las mujeres son el 52 % y los hombres el 45 %.",
           titulo = "Más de la mitad son mujeres")
  if (!motor_nativo) sl$meta <- list(motor_nativo = FALSE)
  ppt <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = p_plan(slides = list(sl)), path_ppt = ppt,
                                                     mensajes_progreso = FALSE)))
  ppt
}

test_that("las ranuras de dos gráficos con texto ponen los gráficos lado a lado, de al menos 2 in de alto", {
  for (tipo in c("text_l2", "text_r2")) {
    geo <- .lam_mixta_geo(tipo)
    expect_length(geo$paneles, 2L)
    p1 <- geo$paneles[[1]]; p2 <- geo$paneles[[2]]; t <- geo$texto
    expect_equal(p1$y, p2$y)                                     # lado a lado, no apilados
    expect_true(p1$x + p1$w < p2$x)
    for (p in geo$paneles) {
      expect_gte(p$h, 2.0); expect_gte(p$w, 4.0)
      expect_true(t$x + t$w <= p$x + 1e-9 || t$x >= p$x + p$w - 1e-9)   # el texto no pisa ningún gráfico
    }
    expect_gte(t$w, 3.4)
  }
  expect_lt(.lam_mixta_geo("text_l2")$texto$x, .lam_mixta_geo("text_l2")$paneles[[1]]$x)
  expect_gt(.lam_mixta_geo("text_r2")$texto$x, .lam_mixta_geo("text_r2")$paneles[[2]]$x)
})

test_that("cada gráfico se renderiza con el ancho (y el alto, si lo recibe) de su ranura nativa", {
  f <- .t2g_fixture()
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  for (fn in list(p_slide_2_graficos_texto_izquierda, p_slide_2_graficos_texto_derecha)) {
    sl <- fn(p_pie(var = "sexo"), p_barras_apiladas(var = "sexo"), texto = "Un texto")
    pedidos <- list()
    helpers <- list(
      elemento_degradado = function(m) stop(m), inject_var_titulo = identity, inject_title_override = identity,
      base_por_grafico = function(el, presets, f) el, base_auto_from_element = function(...) NULL, title_of_var = function(v) v,
      canvas_render_nulo = function(...) ggplot2::ggplot(),
      render_element = function(el, ancho_slot = NULL, alto_slot = NULL) {
        pedidos[[length(pedidos) + 1L]] <<- list(tipo = el$.element_type, ancho = ancho_slot, alto = alto_slot)
        ggplot2::ggplot()
      })
    .composicion_render(doc, sl, .PPT_CONTRACT[[sl$.slide_type]], helpers, presets = list(), solo_lista = TRUE)
    geo <- .lam_mixta_geo(sl$.slide_type)
    expect_equal(pedidos[[1]]$ancho, geo$paneles[[1]]$w)
    expect_equal(pedidos[[2]]$ancho, geo$paneles[[2]]$w)
    expect_null(pedidos[[1]]$alto)                               # la torta no recibe alto (su firma)
    expect_equal(pedidos[[2]]$alto, geo$paneles[[2]]$h)          # la apilada sí: el de su ranura
  }
})

test_that("la lámina sale en nativo: gráficos en su ranura, texto en su columna y la base dentro de su caja", {
  for (fn in list(p_slide_2_graficos_texto_izquierda, p_slide_2_graficos_texto_derecha)) {
    ppt <- .t2g_render(fn)
    fs <- .t2g_formas(ppt)
    tipo <- fn(p_pie(var = "sexo"), p_pie(var = "sexo"))$.slide_type
    geo <- .lam_mixta_geo(tipo)
    expect_false(any(fs$nombre %in% c("Picture Placeholder", "pic")))   # ningún gráfico como imagen de la plantilla
    g <- fs[fs$grupo %in% "prosecnur:grafico:mixta" & !fs$nombre %in% c("panel:pregunta", "separador"), ]
    expect_gt(nrow(g), 10L)
    for (k in 1:2) {
      p <- geo$paneles[[k]]
      en <- g[g$x >= p$x - 0.01 & g$x < p$x + p$w, ]
      expect_gt(nrow(en), 3L)
      # Todo lo del gráfico queda dentro de su ranura (no se sale hacia el texto ni hacia el otro gráfico).
      expect_true(all(en$x + en$w <= p$x + p$w + 0.02), info = paste(tipo, k))
      expect_true(all(en$y >= p$y - 0.01 & en$y + en$h <= p$y + p$h + 0.02), info = paste(tipo, k))
      # La envolvente horizontal de lo dibujado ocupa al menos el 80 % de la ranura (la torta, el 85 %).
      env <- (max(en$x + en$w) - min(en$x)) / p$w
      expect_gte(env, if (any(grepl("^torta", en$nombre))) 0.85 else 0.80)
    }
    # La torta mide al menos 2 in de diámetro (en la plantilla medía 1.0).
    expect_gte(max(fs$w[fs$nombre == "torta:porcion"]), 2.0)
    # El texto en su columna, con su filete.
    tx <- fs[fs$nombre == "narrativa:texto", ]
    expect_equal(nrow(tx), 1L)
    expect_match(tx$texto, "52 %", fixed = TRUE)
    expect_true(tx$x >= geo$texto$x - 0.01 && tx$x + tx$w <= geo$texto$x + geo$texto$w + 0.01)
    # La base: una sola, la de la lámina, en su pie (los dos gráficos comparten n); ninguna suelta junto a un gráfico.
    bases <- fs[grepl("^Base", fs$texto), ]
    expect_equal(nrow(bases), 1L)
    expect_identical(bases$nombre, "Base lamina")
    expect_match(bases$texto, "172", fixed = TRUE)
  }
})

test_that("con el motor nativo apagado, la plantilla de respaldo conserva texto, base y gráficos", {
  for (fn in list(p_slide_2_graficos_texto_izquierda, p_slide_2_graficos_texto_derecha)) {
    ppt <- .t2g_render(fn, motor_nativo = FALSE)
    fs <- .t2g_formas(ppt)
    expect_true(any(grepl("52 %", fs$texto, fixed = TRUE)))
    expect_true(any(grepl("^Base: 172", fs$texto)))
    # Una sola base por lámina, en su marcador, como en la nativa: los gráficos no escriben la suya.
    d <- tempfile(); utils::unzip(ppt, exdir = d)
    xml <- paste(readLines(file.path(d, "ppt", "slides", "slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
    expect_identical(lengths(regmatches(xml, gregexpr("<a:t>Base:", xml, fixed = TRUE))), 1L)
    expect_identical(fs$nombre[grepl("^Base: 172", fs$texto)], sprintf("prosecnur:%s:base", if (identical(fn, p_slide_2_graficos_texto_izquierda)) "text_l2" else "text_r2"))
    expect_gte(sum(fs$nombre %in% c("pic") | grepl("graphicFrame|Picture|Marcador", fs$nombre) | is.na(fs$grupo) & fs$w > 2), 1L)
  }
})
