source("setup-load-all.R")

# Pedido del usuario (2026-10-23): «Tabla de datos» del radar entre públicos y de sus variantes (líneas y puntos, barras).
# `tabla` = auto (defecto; igual que hoy: tabla junto al radar y ninguna con líneas y puntos o barras) | si | no.
# `mostrar_tabla` TRUE -> auto, FALSE -> no. `word_tabla` (solo Word, defecto FALSE): tabla nativa, centrada, ENCIMA de la figura.

.rt_fuente <- function(prefijo, n_temas, valores) {
  data <- data.frame(id = seq_along(valores[[1]]), stringsAsFactors = FALSE)
  for (k in seq_len(n_temas)) data[[paste0(prefijo, k)]] <- as.character(valores[[(k - 1L) %% length(valores) + 1L]])
  lst <- paste0("lst_", prefijo); vars <- paste0(prefijo, seq_len(n_temas))
  list(data = data, inst = list(
    survey = data.frame(type = c("integer", rep("select_one", n_temas)), list_name = c(NA, rep(lst, n_temas)),
                        name = c("id", vars), label = c("id", vars), stringsAsFactors = FALSE),
    choices = data.frame(list_name = lst, name = as.character(1:4), label = c("Muy mal", "Mal", "Bien", "Muy bien"),
                         stringsAsFactors = FALSE)))
}
.rt_sources <- function(n) {
  v <- list(c("3", "4", "3", "1", "4", "3", "3", "2"), c("3", "3", "4", "4", "1", "3", "3", "3"))
  a <- .rt_fuente("a", n, v); b <- .rt_fuente("b", n, rev(v)); c3 <- .rt_fuente("c", n, v[2:1])
  list(data_sources = list(docentes = a$data, estudiantes = b$data, egresados = c3$data),
       inst_sources = list(docentes = a$inst, estudiantes = b$inst, egresados = c3$inst))
}
.rt_vars <- function(n, tres = FALSE) {
  setNames(lapply(seq_len(n), function(k) c(paste0("docentes$a", k), paste0("estudiantes$b", k), if (tres) paste0("egresados$c", k))),
           paste("Tema", seq_len(n)))
}
.rt_render <- function(n, ..., word = FALSE, tres = FALSE, tabla_args = list()) {
  src <- .rt_sources(n); data_sources <- src$data_sources; instrument_sources <- src$inst_sources
  el <- do.call(p_radar, c(list(modo = "publicos", vars = .rt_vars(n, tres), corte = "3,4",
                               corte_etiqueta = "% Bien + Muy bien", ...), tabla_args))
  if (word) el$.word_render <- TRUE
  avisos <- character(0)
  g <- withCallingHandlers(suppressWarnings(.render_radar_publicos(el)), message = function(m) {
    avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage")
  })
  list(g = g, el = el, avisos = avisos[grepl(.PULSO_AVISO_SELLO, avisos, fixed = TRUE)])
}
.rt_forma <- function(g) {
  e <- attr(g, "pulso_espec")
  if (identical(e$tipo, "pesas")) "puntos" else if (identical(e$tipo, "radar")) "radar" else "barras"
}
# ¿El gráfico lleva tabla de datos? radar: en su espec; puntos: en `espec$tabla`; barras: tabla nativa del camino general.
.rt_con_tabla <- function(g) {
  e <- attr(g, "pulso_espec")
  if (identical(e$tipo, "radar")) return(isTRUE(e$con_tabla))
  if (identical(e$tipo, "pesas")) return(is.list(e[["tabla"]]) && !is.null(.tabla_nativa_de(g)))
  !is.null(.tabla_nativa_de(g))
}
.rt_doc_xml <- function(doc) {
  out <- tempfile(fileext = ".docx"); print(doc, target = out)
  xml2::read_xml(unz(out, "word/document.xml"))
}
.rt_ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

test_that("default auto: el radar lleva tabla y las líneas y puntos o barras NO (todo igual que antes)", {
  expect_identical(p_radar(modo = "publicos", vars = .rt_vars(6L), corte = "3,4")[["tabla"]], "auto")
  r6 <- .rt_render(6L)
  expect_identical(.rt_forma(r6$g), "radar"); expect_true(.rt_con_tabla(r6$g))
  r4 <- .rt_render(4L)
  expect_identical(.rt_forma(r4$g), "puntos"); expect_false(.rt_con_tabla(r4$g))
  rb <- .rt_render(4L, forma = "barras")
  expect_identical(.rt_forma(rb$g), "barras"); expect_false(.rt_con_tabla(rb$g))
  # tabla = "auto" explícito es lo mismo que sin declarar
  expect_false(.rt_con_tabla(.rt_render(4L, tabla = "auto")$g))
  expect_true(.rt_con_tabla(.rt_render(6L, tabla = "auto")$g))
})

test_that("tabla = si lleva la tabla en radar, líneas y puntos y barras; tabla = no, en ninguna", {
  for (forma in c("radar", "puntos", "barras")) {
    r <- .rt_render(6L, forma = forma, tabla = "si")
    expect_identical(.rt_forma(r$g), forma, info = forma)
    expect_true(.rt_con_tabla(r$g), info = forma)
    expect_length(r$avisos, 0L)
    expect_false(.rt_con_tabla(.rt_render(6L, forma = forma, tabla = "no")$g), info = forma)
  }
  expect_error(p_radar(modo = "publicos", vars = .rt_vars(4L), corte = "3,4", tabla = "quizá"), "tabla")
  expect_identical(p_radar(modo = "publicos", vars = .rt_vars(4L), corte = "3,4", tabla = "Sí")[["tabla"]], "si")
})

test_that("mostrar_tabla es alias: TRUE -> auto, FALSE -> no; tabla declarada manda; el campo viejo sigue derivado", {
  mk <- function(...) p_radar(modo = "publicos", vars = .rt_vars(6L), corte = "3,4", ...)
  expect_identical(mk(mostrar_tabla = TRUE)[["tabla"]], "auto")
  expect_identical(mk(mostrar_tabla = FALSE)[["tabla"]], "no")
  expect_identical(mk(mostrar_tabla = FALSE, tabla = "si")[["tabla"]], "si")
  expect_true(mk(mostrar_tabla = TRUE)$mostrar_tabla); expect_false(mk(mostrar_tabla = FALSE)$mostrar_tabla)
  expect_false(.rt_con_tabla(.rt_render(6L, mostrar_tabla = FALSE)$g))
  expect_true(.rt_con_tabla(.rt_render(6L, mostrar_tabla = TRUE)$g))
  # un elemento guardado antes de `tabla` (solo `mostrar_tabla`) se lee igual
  viejo <- mk(); viejo[["tabla"]] <- NULL
  expect_identical(.radar_mb_tabla_modo_el(viejo), "auto")
  viejo$mostrar_tabla <- FALSE; expect_identical(.radar_mb_tabla_modo_el(viejo), "no")
})

test_that("la migración del plan: mostrar_tabla -> tabla, idempotente, solo en radares entre públicos", {
  slide <- function(ga) list(id = "s1", tipo = "p_slide_1_grafico", payload = list(titulo = "T", grafico = ga))
  rad <- function(mt, modo = "publicos") list(graficador = "p_radar", args = list(modo = modo, vars = list(), corte = "3,4", mostrar_tabla = mt))
  plan <- list(slides = list(slide(rad(TRUE)), slide(rad(FALSE)), slide(rad(FALSE, modo = "sm")),
                             slide(list(graficador = "p_barras_agrupadas", args = list(var = "x", mostrar_tabla = FALSE)))))
  m <- .graficos_migrar_plan(plan)
  a <- function(i) m$slides[[i]]$payload$grafico$args
  expect_identical(a(1)$tabla, "auto"); expect_null(a(1)$mostrar_tabla)
  expect_identical(a(2)$tabla, "no"); expect_null(a(2)$mostrar_tabla)
  expect_identical(a(3)$mostrar_tabla, FALSE); expect_null(a(3)$tabla)          # el modo sm no usa la tabla: no se toca
  expect_identical(a(4)$mostrar_tabla, FALSE)                                    # otro graficador: no se toca
  expect_identical(.graficos_migrar_plan(m), m)                                  # idempotente
  # una tarjeta que ya declara `tabla` no la pierde
  p2 <- plan; p2$slides[[1]]$payload$grafico$args$tabla <- "si"
  expect_identical(.graficos_migrar_plan(p2)$slides[[1]]$payload$grafico$args$tabla, "si")
  # la normalización de la config pasa por la misma migración
  expect_identical(.normalize_plan(plan, avisar = FALSE)$slides[[2]]$payload$grafico$args$tabla, "no")
})

test_that("la metadata declara tabla y word_tabla, y mostrar_tabla como heredado", {
  args <- .GRAFICADORES_META$p_radar$args
  nm <- vapply(args, function(a) a$name, "")
  tab <- args[[match("tabla", nm)]]
  expect_identical(tab$tipo_input, "choice"); expect_identical(tab$default, "auto")
  expect_identical(vapply(tab$choices, function(x) x$value, ""), c("auto", "si", "no"))
  expect_identical(vapply(tab$choices, function(x) x$label, "")[1], "Automática: junto al radar")
  expect_identical(tab$label, "Tabla de datos")
  expect_true(match("tabla", nm) > match("forma", nm))                           # junto a `forma`
  wt <- args[[match("word_tabla", nm)]]
  expect_identical(wt$tipo_input, "bool"); expect_identical(wt$grupo, "word"); expect_false(wt$default)
  expect_true(isTRUE(args[[match("mostrar_tabla", nm)]]$heredado))
})

test_that("round-trip de la config: tabla y word_tabla llegan al graficador por .graficos_rebuild_graf_json", {
  g <- list(graficador = "p_radar", args = list(modo = "publicos", vars = .rt_vars(4L), corte = "3,4",
                                                tabla = "si", word_tabla = TRUE))
  el <- .graficos_rebuild_graf_json(g)
  expect_identical(el[["tabla"]], "si"); expect_true(el[["word_tabla"]])
  g$args$word_tabla <- NULL; g$args$tabla <- NULL; g$args$mostrar_tabla <- FALSE     # plan viejo sin migrar
  el2 <- .graficos_rebuild_graf_json(g)
  expect_identical(el2[["tabla"]], "no")
  expect_null(el2[["word_tabla"]])
  expect_true(all(c("tabla", "word_tabla") %in% names(formals(p_radar))))
  expect_true(all(c("tabla", "word_tabla") %in% names(formals(p_radar_publicos))))
})

test_that("contenido: lo que reporta el indicador, con los decimales y las cifras de las etiquetas del gráfico", {
  r <- .rt_render(4L, forma = "puntos", tabla = "si", valores_decimales = 1)
  t <- attr(r$g, "pulso_espec")[["tabla"]]
  esp <- attr(r$g, "pulso_espec")
  expect_identical(t$encabezado, "% Bien + Muy bien")                              # el nombre del indicador
  expect_identical(t$grupos, c("Docentes", "Estudiantes"))
  expect_identical(t$ejes, paste("Tema", 1:4))
  # mismas cifras redondeadas que las etiquetas del gráfico (espec$cifras_a / cifras_b)
  expect_identical(unname(t$cifras[, 1]), unname(esp$cifras_a)); expect_identical(unname(t$cifras[, 2]), unname(esp$cifras_b))
  expect_match(t$cifras[1, 1], "^[0-9]+\\.[0-9]%$")                                # 1 decimal, como el gráfico
  # y son los porcentajes del indicador: Tema 1, docentes = 5 de 8 con 3 o 4
  src <- .rt_sources(4L)
  datos <- .radar_mb_datos(.rt_vars(4L), "3,4", src)
  v <- datos$valor[datos$eje == "Tema 1" & datos$grupo == "docentes"]
  expect_identical(t$cifras[1, 1], .pulso_fmt_pct_half_up(v, 1L, escala = 1))
  # tabla_titulo manda sobre el indicador
  rt <- .rt_render(4L, forma = "puntos", tabla = "si", tabla_titulo = "Competencia")
  expect_identical(attr(rt$g, "pulso_espec")[["tabla"]]$encabezado, "Competencia")
  # barras: las etiquetas de las barras llevan los mismos decimales que la tabla
  rb <- .rt_render(4L, forma = "barras", tabla = "si", valores_decimales = 1)
  tb <- .tabla_nativa_de(rb$g)$tabla
  expect_identical(names(tb)[1], "% Bien + Muy bien"); expect_identical(names(tb)[-1], c("Docentes", "Estudiantes"))
  etq <- ggplot2::ggplot_build(rb$g)$plot$data$etiqueta
  expect_true(all(unlist(tb[, -1]) %in% etq))
})

test_that("decisión de sitio: al costado, debajo con aviso, omitida con aviso; nunca en silencio", {
  med <- .lam_tabla_costado_medidas(paste("Tema", 1:4), c("Docentes", "Estudiantes"), "% Bien")
  caja <- list(x0 = 0.495, y0 = 1.65, x1 = 13.018, y1 = 6.72)
  d <- .lam_tabla_costado_decidir(4, med, caja)
  expect_identical(d$lugar, "costado")
  expect_gte(d$graf_x1 - caja$x0, 3.6)                                              # el gráfico conserva al menos 3,6 in
  expect_equal(d$w, 2.2 + 2 * 1.15, tolerance = 0.2)                               # 1ª columna 2,2 in y 1,15 in por público
  expect_gte(d$fila, 0.4)
  # seis públicos: la tabla (9,1 in) no cabe al costado sin dejar 3,6 in al gráfico -> debajo
  med6 <- .lam_tabla_costado_medidas(paste("Tema", 1:4), paste("Público", 1:6), "% Bien")
  d6 <- .lam_tabla_costado_decidir(4, med6, caja)
  expect_identical(d6$lugar, "debajo")
  expect_lte(d6$y + d6$h, caja$y1 + 1e-6); expect_lt(d6$graf_y1, d6$y)
  # doce criterios en filas de 0,4 in: ni al costado ni debajo -> se omite
  med12 <- .lam_tabla_costado_medidas(paste("Tema", 1:12), c("Docentes", "Estudiantes"), "% Bien")
  expect_identical(.lam_tabla_costado_decidir(12, med12, caja)$lugar, "omitir")
  # los avisos nombran el hecho y no son mudos
  av <- function(d) { m <- character(0); withCallingHandlers(.lam_tabla_costado_avisar(d), message = function(x) { m <<- c(m, conditionMessage(x)); invokeRestart("muffleMessage") }); m }
  expect_match(av(d6), "no cabe al costado.*va debajo")
  expect_match(av(list(lugar = "omitir")), "no cabe ni al costado ni debajo.*se omiti")
  expect_length(av(d), 0L)
})

test_that("camino general (barras): el sitio sale del cajón real y los avisos de debajo y omitida llegan al analista", {
  r <- .rt_render(4L, forma = "barras", tabla = "si")
  loc <- list(left = 0.495, top = 1.65, width = 12.523, height = 4.77)
  g1 <- .tabla_nativa_geom(r$g, loc)
  expect_identical(g1$lugar, "costado")
  expect_gte(g1$graf_w, 3.6); expect_equal(g1$left + g1$width, loc$left + loc$width, tolerance = 1e-6)
  # el slot del gráfico cede el ancho
  slot <- .plot_slot_recortado_por_tabla(list(loc = loc), g1)
  expect_equal(slot$loc$width, g1$graf_w); expect_equal(slot$loc$height, loc$height)
  # un cajón angosto (como una lámina de dos paneles): debajo, con aviso, y el gráfico cede el alto
  avisos <- character(0)
  g2 <- withCallingHandlers(.tabla_nativa_geom(r$g, list(left = 0.5, top = 1.65, width = 8.4, height = 4.8)),
                            message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  expect_identical(g2$lugar, "debajo"); expect_match(avisos, "no cabe al costado.*va debajo")
  slot2 <- .plot_slot_recortado_por_tabla(list(loc = list(left = 0.5, top = 1.65, width = 8.4, height = 4.8)), g2)
  expect_equal(slot2$loc$width, 8.4); expect_lt(slot2$loc$height, 4.8)
  # no cabe en ningún lado: NULL (nada se emite) y aviso
  avisos <- character(0)
  g3 <- withCallingHandlers(.tabla_nativa_geom(r$g, list(left = 0.5, top = 1.65, width = 5, height = 2)),
                            message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  expect_null(g3); expect_match(avisos, "no cabe ni al costado ni debajo.*se omiti")
  # la tabla con sitio propio nunca ocupa el placeholder: sale la imagen del gráfico
  expect_false(inherits(.dml_o_tabla(r$g), "flextable"))
})

test_that("lámina de líneas y puntos con tabla: nativa al costado, gráfico más angosto y cifras iguales a las etiquetas", {
  r <- .rt_render(4L, forma = "puntos", tabla = "si")
  e <- attr(r$g, "pulso_espec")
  expect_true(.lam_compositor_aplica(r$g));
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_pesas(doc, e, "COMPETENCIAS", folio = 1)
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  tbl <- xml2::xml_find_all(xml, "//a:tbl")
  expect_length(tbl, 1L)
  celdas <- xml2::xml_text(xml2::xml_find_all(tbl, ".//a:tc"))
  expect_identical(celdas[1:3], c("% Bien + Muy bien", "Docentes", "Estudiantes"))
  expect_identical(celdas[4:6], c("Tema 1", e$cifras_a[1], e$cifras_b[1]))
  off <- xml2::xml_find_first(xml, "//p:graphicFrame[.//a:tbl]/p:xfrm/a:off")
  x_tab <- as.numeric(xml2::xml_attr(off, "x")) / 914400
  expect_gt(x_tab, 7)                                                                # al costado, a la derecha
  # sin tabla (default) la lámina no lleva tabla
  e0 <- attr(.rt_render(4L)$g, "pulso_espec")
  o0 <- .lam_laminas_pesas(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")), e0, "SIN", folio = 1)
  out0 <- tempfile(fileext = ".pptx"); print(o0$doc, target = out0)
  expect_length(xml2::xml_find_all(xml2::read_xml(unz(out0, "ppt/slides/slide1.xml")), "//a:tbl"), 0L)
})

test_that("lámina de líneas y puntos: sin sitio en ninguna parte la tabla se omite con aviso y el gráfico sigue", {
  r <- .rt_render(12L, forma = "puntos", tabla = "si")
  e <- attr(r$g, "pulso_espec")
  plan <- .lam_pesas_tabla_plan(e)
  expect_identical(plan$lugar, "omitir")
  avisos <- character(0)
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- withCallingHandlers(.lam_laminas_pesas(doc, e, "MUCHOS", folio = 1), message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  expect_length(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")), "//a:tbl"), 0L)
  expect_match(avisos, "no cabe ni al costado ni debajo", fixed = FALSE)
})

test_that("word_tabla: FALSE por defecto (incluido el radar) y el gráfico del Word nunca pinta la tabla en la imagen", {
  expect_null(p_radar(modo = "publicos", vars = .rt_vars(4L), corte = "3,4")[["word_tabla"]])
  expect_true(p_radar(modo = "publicos", vars = .rt_vars(4L), corte = "3,4", word_tabla = TRUE)[["word_tabla"]])
  for (n in c(4L, 6L)) {
    for (args in list(list(), list(tabla = "si"))) {
      r <- do.call(.rt_render, c(list(n, word = TRUE), list(tabla_args = args)))
      expect_null(attr(r$g, "pulso_word_tabla"), info = n)                          # no pidió word_tabla
      expect_null(.tabla_nativa_de(r$g)); expect_false(isTRUE(attr(r$g, "pulso_espec")$con_tabla))
    }
  }
  # word_tabla TRUE no hereda de `tabla = no`
  r <- .rt_render(4L, word = TRUE, tabla = "no", word_tabla = TRUE)
  expect_false(is.null(attr(r$g, "pulso_word_tabla")))
  # y el PPT con la misma tarjeta no lleva tabla (tabla = no)
  expect_false(.rt_con_tabla(.rt_render(4L, tabla = "no", word_tabla = TRUE)$g))
})

test_that("word_tabla TRUE: tabla nativa de Word, centrada y ENCIMA de la figura, con el rótulo pegado", {
  for (forma in c("puntos", "radar")) {
    r <- .rt_render(if (identical(forma, "radar")) 6L else 4L, word = TRUE, forma = forma, word_tabla = TRUE, valores_decimales = 1)
    info <- attr(r$g, "pulso_word_tabla")
    expect_true(is.list(info), info = forma)
    png <- tempfile(fileext = ".png"); grDevices::png(png, 600, 300); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
    doc <- .word_figura(.word_documento_nuevo(), 3, "Competencias de salida", png, alto = 1.5, base = "Base: 120", tabla = info)
    x <- .rt_doc_xml(doc)
    hijos <- xml2::xml_name(xml2::xml_children(xml2::xml_find_first(x, "//w:body", .rt_ns)))
    hijos <- hijos[hijos != "sectPr"]
    expect_identical(hijos[1:4], c("p", "tbl", "p", "p"), info = forma)             # rótulo, TABLA, figura, base
    expect_false(inherits(xml2::xml_find_first(x, "//w:body/w:p[2]//w:drawing", .rt_ns), "xml_missing"))   # la figura va después de la tabla
    jc <- xml2::xml_attr(xml2::xml_find_first(x, "//w:tbl/w:tblPr/w:jc", .rt_ns), "w:val", ns = .rt_ns)
    expect_identical(jc, "center", info = forma)
    celdas <- xml2::xml_text(xml2::xml_find_all(x, "//w:tbl//w:tc", .rt_ns))
    expect_identical(celdas[1:3], c("% Bien + Muy bien", "Docentes", "Estudiantes"), info = forma)
    expect_match(celdas[5], "^[0-9]+\\.[0-9]%$")
    # rótulo, tabla y figura juntos: keep-with-next en el rótulo (estilo), en las filas y en la imagen
    expect_false(inherits(xml2::xml_find_first(x, "//w:tbl//w:tr[last()]//w:keepNext", .rt_ns), "xml_missing"))
    expect_false(inherits(xml2::xml_find_first(x, "//w:body/w:p[.//w:drawing]/w:pPr/w:keepNext", .rt_ns), "xml_missing"))
  }
  # sin tabla, el Word de siempre: rótulo, figura, base
  png <- tempfile(fileext = ".png"); grDevices::png(png, 600, 300); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
  x0 <- .rt_doc_xml(.word_figura(.word_documento_nuevo(), 3, "Competencias", png, alto = 1.5, base = "Base: 120"))
  expect_length(xml2::xml_find_all(x0, "//w:tbl", .rt_ns), 0L)
})

test_that("el Word de la tarjeta completa lleva la tabla encima cuando word_tabla y ninguna cuando no", {
  src <- .rt_sources(4L)
  mk <- function(...) p_radar(modo = "publicos", vars = .rt_vars(4L), corte = "3,4", corte_etiqueta = "% Bien", ...)
  doc_de <- function(el) {
    data_sources <- src$data_sources; instrument_sources <- src$inst_sources
    el$.word_render <- TRUE
    p <- suppressMessages(.render_radar_publicos(el))
    png <- tempfile(fileext = ".png"); grDevices::png(png, 600, 300); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
    .rt_doc_xml(.word_figura(.word_documento_nuevo(), 1, "T", png, alto = 1.5, tabla = attr(p, "pulso_word_tabla")))
  }
  expect_length(xml2::xml_find_all(doc_de(mk()), "//w:tbl", .rt_ns), 0L)
  expect_length(xml2::xml_find_all(doc_de(mk(tabla = "si")), "//w:tbl", .rt_ns), 0L)     # no hereda `tabla`
  expect_length(xml2::xml_find_all(doc_de(mk(word_tabla = TRUE)), "//w:tbl", .rt_ns), 1L)
})
