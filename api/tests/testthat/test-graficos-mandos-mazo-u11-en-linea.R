source("setup-load-all.R")

# Checklist de mandos del mazo (2026-11-05). Tres arreglos del motor de gráficos para que todo lo del mazo se configure
# desde el editor:
#   U11  `mostrar_significancia` en `p_barras_multiapiladas` por cruce: el render lo aplicaba, pero el registro no lo
#        ofrecía y el constructor no lo tenía como formal (`.clean_rebuild_args` lo descartaba).
#   en_linea  las tarjetas «Bajo cada barra» con doce opciones y dos desgloses (CCSS, ccss-036) se salían del marco y la
#        leyenda de marcas se montaba sobre el último desglose.
#   canvas_w_etiquetas  el registro de agrupadas anunciaba 0.36 y la lámina sin valor usa el automático; declarada por
#        encima del tope (0.55, ccss-059), la lámina de tarjetas caía al respaldo ggplot, sin pista ni conector.
# Datos sintéticos.

# ---------------------------------------------------------------------------------------------------------------------
# U11
# ---------------------------------------------------------------------------------------------------------------------

.u11_arg <- function(nm) {
  args <- .GRAFICADORES_META$p_barras_multiapiladas$args
  args[[which(vapply(args, function(a) identical(a$name, nm), logical(1)))[1]]]
}

test_that("U11: el registro de multiapiladas ofrece la significancia sólo en el modo por cruce", {
  a <- .u11_arg("mostrar_significancia")
  expect_identical(a$tipo_input, "bool")
  expect_identical(a$grupo, "datos")
  expect_false(a$default)
  expect_identical(a$depende$arg, "modo")
  expect_identical(unlist(a$depende$valores), "cruce")
  al <- .u11_arg("significancia_alpha")
  expect_equal(al$default, 0.05)
  expect_identical(unlist(al$depende$valores), "cruce")
})

test_that("U11: lo que el editor guarda en el slot sobrevive a .clean_rebuild_args y llega a overrides", {
  slot <- list(modo = "cruce", var = "p1", cruces = "grupo", mostrar_significancia = TRUE, significancia_alpha = 0.1)
  el <- do.call(p_barras_multiapiladas, .clean_rebuild_args(slot, p_barras_multiapiladas))
  expect_true(isTRUE(el$overrides$mostrar_significancia))
  expect_equal(el$overrides$significancia_alpha, 0.1)
  # Un override explícito manda sobre el formal, como en el resto de los constructores.
  el2 <- p_barras_multiapiladas(modo = "cruce", var = "p1", cruces = "grupo", mostrar_significancia = TRUE,
                                overrides = list(mostrar_significancia = FALSE))
  expect_false(el2$overrides$mostrar_significancia)
  expect_error(p_barras_multiapiladas(modo = "cruce", var = "p1", cruces = "grupo", mostrar_significancia = "si"),
               "mostrar_significancia")
})

.u11_fuente <- function() {
  set.seed(11)
  grupos <- c("Primer nivel", "Segundo nivel", "Tercer nivel")
  g <- rep(grupos, each = 150)
  p <- c(.15, .45, .75)
  r <- unlist(lapply(seq_along(p), function(i) sample(c("Sí", "No"), 150, TRUE, prob = c(p[i], 1 - p[i]))))
  list(data = data.frame(id = seq_along(g), p1 = r, grupo = g, stringsAsFactors = FALSE),
       inst = list(survey = data.frame(type = c("integer", "select_one sn", "select_one gr"), name = c("id", "p1", "grupo"),
                                       label = c("id", "¿Participa?", "Nivel"), list_name = c(NA, "sn", "gr"),
                                       stringsAsFactors = FALSE),
                   choices = data.frame(list_name = c("sn", "sn", rep("gr", 3)), name = c("Sí", "No", grupos),
                                        label = c("Sí", "No", grupos), stringsAsFactors = FALSE)))
}
.u11_textos <- function(grafico) {
  f <- .u11_fuente(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$data, instrumento = f$inst,
    plan = list(a = p_slide_1_grafico(grafico = grafico, titulo = "Participación por nivel")),
    path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  ns <- xml2::xml_ns(x)
  sps <- xml2::xml_find_all(x, "//p:sp", ns)
  data.frame(nombre = xml2::xml_attr(xml2::xml_find_first(sps, ".//p:cNvPr"), "name"),
             texto = vapply(sps, function(s) paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t", ns)), collapse = ""), ""),
             stringsAsFactors = FALSE)
}

test_that("U11: activada desde el slot, la lámina por cruce lleva las letras de los grupos y la nota que las explica", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  slot <- function(sig) .clean_rebuild_args(list(modo = "cruce", var = "p1", cruces = "grupo", mostrar_significancia = sig),
                                            p_barras_multiapiladas)
  con <- .u11_textos(do.call(p_barras_multiapiladas, slot(TRUE)))
  sin <- .u11_textos(do.call(p_barras_multiapiladas, slot(FALSE)))
  todo_con <- paste(con$texto, collapse = " | "); todo_sin <- paste(sin$texto, collapse = " | ")
  expect_true(any(con$nombre == "Nota significancia"), info = todo_con)
  expect_match(todo_con, "Mayor que el grupo de esa letra", fixed = TRUE)
  expect_match(todo_con, "(A) Primer nivel", fixed = TRUE)
  expect_false(any(sin$nombre == "Nota significancia"))
  expect_false(grepl("(A) Primer nivel", todo_sin, fixed = TRUE))
  # Las cifras no cambian: los mismos porcentajes con y sin marcas (ADR 0128/0129).
  cifras <- function(t) sort(unlist(regmatches(t, gregexpr("[0-9]+%", t))))
  expect_identical(intersect(cifras(todo_sin), cifras(todo_con)), unique(cifras(todo_sin)))
})

# ---------------------------------------------------------------------------------------------------------------------
# Desglose en línea: doce opciones y dos desgloses caben en su franja, sin tocar la leyenda
# ---------------------------------------------------------------------------------------------------------------------

.enl_tarjeta <- function(fila, dirs = c("up", "down"), p = c(44, 17)) {
  list(cruce = "area", fila = fila, total = 30, cifra_total = "30%", fragil = FALSE, brecha = 20,
       grupos = data.frame(codigo = c("1", "2"), etiqueta = c("CC. Pol. y Soc.", "Econ. y Finanzas"), p = p, dir = dirs,
                           fragil = FALSE, stringsAsFactors = FALSE))
}
.enl_espec <- function(n = 12L) {
  rot <- c("Voluntariado", "Académica", "Deportiva", "Política universitaria", "Artística", "Profesional", "Religiosa",
           "Política nacional", "Entretenimiento", "Otros", "Ninguna", "Cultural", "Ambiental", "Vecinal")[seq_len(n)]
  v <- seq(0.44, 0.01, length.out = n)
  preparar_categorica(rot, v, paste0(round(v * 100), "%"))
}
.enl_formas <- function(lz) {
  doc <- .lam_agrupar(officer::add_slide(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                                         layout = "Graficos2", master = "Office Theme"), lz)
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  sl <- xml2::read_xml(unz(f, "ppt/slides/slide1.xml")); ns <- xml2::xml_ns(sl)
  sp <- xml2::xml_find_all(sl, "//p:sp", ns)
  v <- function(x, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0(".//a:", x)), a)) / 914400
  data.frame(nombre = xml2::xml_attr(xml2::xml_find_first(sp, "p:nvSpPr/p:cNvPr"), "name"), y = v("off", "y"),
             h = v("ext", "cy"), stringsAsFactors = FALSE)
}

test_that("en línea: doce opciones con dos desgloses caben en su alto apretando el desglose, sin aviso", {
  avisos <- character(0)
  local_mocked_bindings(.pulso_aviso = function(x) avisos <<- c(avisos, x))
  enl <- list(.enl_tarjeta("Académica"), .enl_tarjeta("Ninguna", dirs = c("down", "up"), p = c(16, 36)))
  alto <- 4.8   # el alto de la lámina ccss-036 (título de dos líneas)
  m <- .en_linea_medidas(.enl_espec(), enl, alto, wl = 2.3, titulo = "T")
  expect_lte(.en_linea_alto(.enl_espec(), enl, m, 2.3), alto + 1e-6)
  expect_gte(m$pt, 11)                            # la letra no baja del piso de la maqueta
  expect_length(avisos, 0L)
  # Con la maqueta (pocas opciones) las medidas no cambian.
  m4 <- .en_linea_medidas(.enl_espec(4L), enl[1], alto, wl = 2.3)
  expect_identical(c(m4$pt, m4$fila, m4$fila_g, m4$cab), c(14, 0.46, 0.27, 0.22))
})

test_that("en línea: si ni apretado cabe, todo baja en proporción y avisa en español formal", {
  avisos <- character(0)
  local_mocked_bindings(.pulso_aviso = function(x) avisos <<- c(avisos, x))
  enl <- list(.enl_tarjeta("Académica"), .enl_tarjeta("Ninguna", dirs = c("down", "up"), p = c(16, 36)))
  m <- .en_linea_medidas(.enl_espec(14L), enl, 3.6, wl = 2.3, titulo = "Agrupaciones")
  expect_lte(.en_linea_alto(.enl_espec(14L), enl, m, 2.3), 3.6 + 1e-6)
  expect_lt(m$pt, 11)
  expect_length(avisos, 1L)
  expect_match(avisos, "en «Agrupaciones»", fixed = TRUE)
  expect_false(grepl("[;·—–]", avisos))
})

test_that("en línea: la lámina de doce opciones deja el último desglose sobre la leyenda de marcas, sin tocarla", {
  skip_if_not_installed("officer")
  lz <- .lam_lienzo()
  enl <- list(.enl_tarjeta("Académica"), .enl_tarjeta("Ninguna", dirs = c("down", "up"), p = c(16, 36)))
  y0 <- 1.65; y1 <- .std_valor("ppt", "geometria", "base_y") - 0.55
  y_fin <- .lam_barras_en_linea(lz, .enl_espec(), enl, c(area = "Área"), character(0), 1.5, 12.3, y0, y1)
  .lam_en_linea_leyenda(lz, 1.1, y1 + 0.12)
  f <- .enl_formas(lz)
  expect_lte(y_fin, y1 + 1e-6)
  ley <- f[f$nombre == "en_linea:leyenda", ]
  datos <- f[grepl("^en_linea:", f$nombre) & !grepl("leyenda", f$nombre), ]
  expect_true(all(datos$y + datos$h <= min(ley$y) + 0.05), info = paste(datos$nombre[datos$y + datos$h > min(ley$y) + 0.05], collapse = ", "))
})

# ---------------------------------------------------------------------------------------------------------------------
# canvas_w_etiquetas en agrupadas
# ---------------------------------------------------------------------------------------------------------------------

test_that("canvas_w_etiquetas: el registro de agrupadas no anuncia un valor que la lámina no usa (vacío = automático)", {
  args <- .GRAFICADORES_META$p_barras_agrupadas$args
  a <- args[[which(vapply(args, function(x) identical(x$name, "canvas_w_etiquetas"), logical(1)))[1]]]
  expect_null(a$default)
})

test_that("canvas_w_etiquetas: una columna declarada y cumplida no saca la lámina de tarjetas del camino nativo", {
  ancho <- 9
  espec <- preparar_categorica(c("Biblioteca", "Aulas de clase", "Patios y mesas de la facultad", "Jardines"),
                               c(.61, .5, .26, .16), c("61%", "50%", "26%", "16%"))
  espec$tamanos <- list(w_etiquetas = 0.55)
  expect_true(.lam_tarjetas_columna_declarada_cabe(espec, list(wlab = 0.55 * ancho, size = 12), ancho))
  # No cumplida (el motor volvió al automático): decide el tope de siempre.
  expect_false(.lam_tarjetas_columna_declarada_cabe(espec, list(wlab = 5.5, size = 12), ancho))
  # Sin declaración, tampoco.
  espec$tamanos <- NULL
  expect_false(.lam_tarjetas_columna_declarada_cabe(espec, list(wlab = 0.55 * ancho, size = 12), ancho))
  # Una declaración que deja a las barras sin su área mínima no pasa.
  espec$tamanos <- list(w_etiquetas = 0.85)
  expect_false(.lam_tarjetas_columna_declarada_cabe(espec, list(wlab = 0.85 * ancho, size = 12), ancho))
})
