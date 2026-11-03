# Cuatro limitaciones del motor de gráficos vistas en el mazo del Perfil del Estudiante CCSS 2026 (2026-11-02). Fixture
# sintético: no hay datos del estudio.
#   1. Lámina 46: el cruce de respuesta múltiple con una opción visible ocupaba la franja superior (techo de grosor por fila).
#   2. Lámina 51: en la apilada nativa los grupos («Nivel 6») quedaban lejos de sus barras y `canvas_w_etiquetas` no hacía nada.
#   3. Lámina 64: la agrupada de rótulos largos ignoraba `size_ejes` y `size_texto_barras`.
#   4. Lámina 11: el histograma ignoraba `mostrar_frecuencia`; se pide «103 (26%)».

.tdc_fx <- function(n = 400) {
  set.seed(7)
  ops <- c("Bus", "Bicicleta", "Auto")
  m <- sapply(c(.6, .3, .15), function(p) stats::rbinom(n, 1, p))
  sm <- apply(m, 1, function(r) paste(ops[r == 1], collapse = " ")); sm[!nzchar(sm)] <- "Bus"
  largos <- c("Porque la universidad ofrece una formación académica de alto nivel y prestigio nacional",
              "Porque mis padres o familiares cercanos estudiaron en esta misma universidad antes",
              "Porque la carrera que quería estudiar solo se ofrecía aquí con ese plan de estudios",
              "Porque me otorgaron una beca o apoyo económico que cubre parte de la pensión anual")
  lk <- c("Nada satisfecho", "Poco satisfecho", "Satisfecho", "Muy satisfecho")
  d <- data.frame(nivel = sample(paste("Nivel", 1:4), n, TRUE), sm = sm, lk = sample(lk, n, TRUE),
                  largo = sample(largos, n, TRUE, prob = c(.4, .3, .2, .1)), edad = pmin(35, 17 + stats::rpois(n, 4)),
                  stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = c("nivel", "sm", "lk", "largo", "edad"),
                        type = c("select_one l_niv", "select_multiple l_sm", "select_one l_lk", "select_one l_largo", "integer"),
                        list_name = c("l_niv", "l_sm", "l_lk", "l_largo", NA),
                        label = c("Nivel", "Medios", "Satisfacción", "Motivo", "Edad (años)"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("l_niv", 4), rep("l_sm", 3), rep("l_lk", 4), rep("l_largo", 4)),
                         name = c(paste("Nivel", 1:4), ops, lk, largos), label = c(paste("Nivel", 1:4), ops, lk, largos),
                         stringsAsFactors = FALSE),
    orders_list = NULL)
  list(data = d, inst = inst)
}

.tdc_render <- function(grafico, solo_lista = FALSE) {
  fx <- .tdc_fx()
  out <- tempfile(fileext = ".pptx")
  r <- suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = fx$data, instrumento = fx$inst, path_ppt = out, solo_lista = solo_lista, mensajes_progreso = FALSE,
    presets = .build_presets(.enriquecer_presets(list(), NULL)),
    plan = p_plan(slides = list(p_slide_1_grafico(titulo = "Lámina", grafico = grafico))))))
  if (isTRUE(solo_lista)) r else xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}

# Piezas nombradas de la lámina nativa: nombre, x, y, ancho (in), cuerpo (pt) y texto.
.tdc_piezas <- function(x, nombre) {
  ns <- xml2::xml_ns(x)
  sp <- xml2::xml_find_all(x, sprintf(".//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre), ns)
  num <- function(n, at) as.numeric(xml2::xml_attr(xml2::xml_find_first(n, paste0(".//a:", at), ns), if (at == "off") "x" else "cx")) / 914400
  data.frame(x = vapply(sp, num, 0, at = "off"), w = vapply(sp, num, 0, at = "ext"),
             sz = vapply(sp, function(n) as.numeric(xml2::xml_attr(xml2::xml_find_first(n, ".//a:rPr", ns), "sz")) / 100, 0),
             texto = vapply(sp, function(n) paste(xml2::xml_text(xml2::xml_find_all(n, ".//a:t", ns)), collapse = ""), ""))
}

test_that("1: el cruce de respuesta múltiple con una opción visible usa el alto de la lámina", {
  expect_identical(.agrupadas_cruce_barras_por_fila(NULL, 4L), 1L)
  expect_identical(.agrupadas_cruce_barras_por_fila(list(dodge = 0.86), 4L), 4L)
  r <- .tdc_render(p_barras_agrupadas("sm", cruces = "nivel", excluir_opciones = c("Auto", "Bicicleta")), solo_lista = TRUE)
  lay <- attr(r$rendered[[1]], "pulso_barras_agrupadas_layout")
  expect_identical(lay$n_categorias, 1L)
  # Antes 0.82 in: el techo de una barra por fila, con cuatro barras en la fila. Desde el mazo de 97 láminas (2026-11-03)
  # el grosor tiene un tope por barra y lo que sobra del hueco centra el bloque (test-graficos-agrupadas-grosor-cifras.R).
  expect_gt(lay$h_panel_in, 1.5)
  expect_lte(lay$h_panel_in * lay$grosor_eff / 4, .AGRUPADAS_CRUCE_BARRA_MAX_IN + 1e-9)
  expect_gt(lay$h_pad_in, 0)
  # La cifra deja el piso de 8 pt: con la barra gruesa cabe el cuerpo declarado.
  cr <- attr(r$rendered[[1]], "pulso_barras_agrupadas_cruce")
  expect_gt(cr$size_cifra_mm * 72 / 25.4, 10)
})

test_that("2: los grupos de la apilada nativa quedan junto a sus barras y `canvas_w_etiquetas` mueve la columna", {
  arranque <- function(ov) {
    x <- .tdc_render(p_barras_apiladas("lk", cruces = "nivel", overrides = ov))
    prem <- .tdc_piezas(x, "premisa"); seg <- .tdc_piezas(x, "segmento")
    expect_setequal(prem$texto, paste("Nivel", 1:4))
    c(prem = min(prem$x), barra = min(seg$x))
  }
  auto <- arranque(list())
  expect_lt(auto[["barra"]] - auto[["prem"]], 1.6)   # antes, la barra arrancaba a ~3.4 in de los rótulos
  ancha <- arranque(list(canvas_w_etiquetas = 0.30))
  expect_gt(ancha[["barra"]] - auto[["barra"]], 1.5)
})

test_that("3: la agrupada de rótulos largos obedece `size_ejes` y `size_texto_barras` (nativa y cruce)", {
  x0 <- .tdc_render(p_barras_agrupadas("largo"))
  x1 <- .tdc_render(p_barras_agrupadas("largo", overrides = list(size_ejes = 16, size_texto_barras = 6)))
  r0 <- .tdc_piezas(x0, "rotulo"); r1 <- .tdc_piezas(x1, "rotulo")
  expect_true(all(r0$sz <= 11))
  expect_true(all(r1$sz > 12))
  expect_true(all(abs(.tdc_piezas(x1, "cifra")$sz - 6 * 72 / 25.4) < 0.1))
  expect_identical(.lam_tamanos_declarados(list(size_ejes = "16", canvas_w_etiquetas = 2))$rotulo_pt, 16)
  expect_null(.lam_tamanos_declarados(list(canvas_w_etiquetas = 2))$w_etiquetas)
  # Ruta ggplot (cruce): el cuerpo declarado ya no se topa en 13.2 pt por la regla de rótulos densos.
  el <- p_barras_agrupadas("largo", cruces = "nivel", overrides = list(size_ejes = 16))
  expect_true(isTRUE(el$overrides$preservar_tamanos_texto))
  expect_null(p_barras_agrupadas("largo", cruces = "nivel")$overrides$preservar_tamanos_texto)
  lay <- function(g) attr(.tdc_render(g, solo_lista = TRUE)$rendered[[1]], "pulso_barras_agrupadas_layout")$size_ejes_eff
  expect_gt(lay(el), lay(p_barras_agrupadas("largo", cruces = "nivel")))
})

test_that("4: el histograma con `mostrar_frecuencia` rotula «conteo (porcentaje)»", {
  expect_identical(.histograma_cifra_con_frecuencia(c(103, 297)), c("103 (26%)", "297 (74%)"))
  expect_identical(.histograma_cifra_con_frecuencia(c(1, 2), decimales = 1), c("1 (33.3%)", "2 (66.7%)"))
  sin <- .tdc_piezas(.tdc_render(p_histograma("edad")), "histograma:cifra")
  expect_false(any(grepl("(", sin$texto, fixed = TRUE)))
  x <- .tdc_render(p_histograma("edad", mostrar_frecuencia = TRUE))
  con <- .tdc_piezas(x, "histograma:cifra"); pct <- .tdc_piezas(x, "histograma:cifra_pct")
  expect_true(all(grepl("^[0-9,]+", con$texto)))
  # Con una columna angosta el porcentaje baja a su propia línea; las dos juntas dicen «conteo (porcentaje)».
  if (nrow(pct)) expect_true(all(grepl("^\\([0-9]+%\\)$", pct$texto))) else expect_true(all(grepl("^[0-9,]+ \\([0-9]+%\\)$", con$texto)))
  expect_identical(.histograma_cifras_en_columna(c("103 (26%)", "9 (2%)"), wcol = 0.75)$lineas, 2L)
  expect_identical(.histograma_cifras_en_columna(c("103 (26%)", "9 (2%)"), wcol = 3)$lineas, 1L)
})

test_that("presets del cuerpo: tamaños por tipo o por base no borran las exclusiones del cruce de respuesta múltiple", {
  fx <- .tdc_fx()
  dp <- tempfile(fileext = ".rds"); ip <- tempfile(fileext = ".rds"); saveRDS(fx$data, dp); saveRDS(fx$inst, ip)
  plan <- .normalize_plan(jsonlite::fromJSON(paste0(
    '{"slides":[{"tipo":"p_slide_1_grafico","payload":{"titulo":"x","grafico":{"graficador":"p_barras_agrupadas",',
    '"args":{"var":"sm","cruces":"nivel","excluir_opciones":["Auto","Bicicleta"]}}}}]}'), simplifyVector = FALSE))
  reg <- stats::setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
  for (pj in list(NULL, list(barras_agrupadas = list(size_ejes = 14, alto_por_categoria = 1)),
                  list(base = list(args = list(size_ejes = 14))))) {
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(graficos_job_worker_ppt(dp, ip, plan, .enriquecer_presets(pj, NULL), list(), reg, .graf_names(),
                                                              list(), NULL, NA_character_, NULL, FALSE, out)))
    txt <- paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")), ".//a:t")), collapse = "|")
    expect_true(grepl("Bus", txt, fixed = TRUE))
    expect_false(grepl("Bicicleta|Auto", txt))
  }
})
