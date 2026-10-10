# Migrar una población antigua conserva la base de CADA gráfico, en su sitio y una sola vez.
#
# Contrato (lead, 2026-10-10): cada gráfico del tipo vigente lleva exactamente el mismo texto de base que tenía en el
# tipo antiguo y en la misma posición (su panel); ninguna base se repite al pie si ya va en su panel. El test anterior
# comparaba `sort(unique(bases))` con un fixture donde dos gráficos tenían la misma base: no veía una base perdida que
# coincidiera con otra ni una base repetida al pie. Aquí cada gráfico tiene una base distinta (y el sufijo del proyecto,
# «docentes», que sólo aparece si la base la compone el motor), y la comparación es por panel y por conteo.

.mpb_fixture <- function() {
  niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
  cargo <- c("Decano(a)", "Coordinador(a)", "Jefe(a)")
  esc <- function(n) c(rep(niv, each = n / 4), rep(NA, 120 - n))
  df <- data.frame(
    cargo = rep(cargo, c(20, 50, 50)),
    anios = c(rep(c("Menos de 2", "Más de 2"), c(40, 60)), rep(NA, 20)),
    sexo  = c(rep(c("Mujer", "Hombre"), c(60, 50)), rep(NA, 10)),
    grado = c(rep(c("Magíster", "Doctor(a)"), c(30, 50)), rep(NA, 40)),
    e1 = esc(92), e2 = esc(72), e3 = esc(100), e4 = esc(60),
    stringsAsFactors = FALSE)
  ch <- rbind(data.frame(list_name = "lc", name = cargo, label = cargo),
              data.frame(list_name = "la", name = c("Menos de 2", "Más de 2"), label = c("Menos de 2", "Más de 2")),
              data.frame(list_name = "ls", name = c("Mujer", "Hombre"), label = c("Mujer", "Hombre")),
              data.frame(list_name = "lg", name = c("Magíster", "Doctor(a)"), label = c("Magíster", "Doctor(a)")),
              data.frame(list_name = "le", name = niv, label = niv))
  vars <- c("cargo", "anios", "sexo", "grado", "e1", "e2", "e3", "e4")
  ln <- c("lc", "la", "ls", "lg", "le", "le", "le", "le")
  inst <- list(survey = data.frame(name = vars, type = paste("select_one", ln), list_name = ln,
                                   label = c("Cargo", "Años en el cargo", "Sexo", "Grado", paste("Escala", 1:4)),
                                   stringsAsFactors = FALSE), choices = ch, orders_list = NULL)
  list(df = df, inst = inst)
}

# Cada párrafo de base de la lámina con el panel al que pertenece (por la caja de su forma de primer nivel).
.mpb_bases <- function(slide_json, filas = 1L) {
  f <- .mpb_fixture(); out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
  sl <- .graficos_rebuild_slide_json(slide_json, slide_registry = reg, graficador_registry = .graf_names())
  presets <- list(barras_apiladas = .PRESETS_DEFAULT_PULSO$barras_apiladas, base = list(args = list(sufijo_auto = "docentes")))
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = p_plan(slides = list(sl)),
                                                     presets = presets, path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[[1]]))
  ps <- xml2::xml_find_all(x, "//a:p")
  tx <- trimws(vapply(ps, xml2::xml_text, ""))
  k <- grep("^Base|respuestas$", tx)
  caja <- function(p) {
    anc <- xml2::xml_find_all(p, "ancestor::*[p:spPr/a:xfrm or p:grpSpPr/a:xfrm or p:xfrm]")
    a <- anc[[length(anc)]]
    q <- function(n) as.numeric(xml2::xml_attr(xml2::xml_find_first(a, sprintf("p:spPr/a:xfrm/a:%1$s|p:grpSpPr/a:xfrm/a:%1$s|p:xfrm/a:%1$s", n)), c(off = "x", ext = "cx")[[n]])) / 914400
    qy <- function(n) as.numeric(xml2::xml_attr(xml2::xml_find_first(a, sprintf("p:spPr/a:xfrm/a:%1$s|p:grpSpPr/a:xfrm/a:%1$s|p:xfrm/a:%1$s", n)), c(off = "y", ext = "cy")[[n]])) / 914400
    c(cx = q("off") + q("ext") / 2, y = qy("off"), w = q("ext"))
  }
  cj <- if (length(k)) t(vapply(ps[k], caja, numeric(3))) else matrix(numeric(), 0, 3, dimnames = list(NULL, c("cx", "y", "w")))
  # Una base que cruza los dos paneles (ancho > media lámina) es del pie de la lámina, no de un panel.
  panel <- ifelse(cj[, "w"] > 6.67, "pie",
                  paste0(if (filas > 1L) ifelse(cj[, "y"] < 4, "sup_", "inf_") else "", ifelse(cj[, "cx"] < 6.67, "izq", "der")))
  d <- data.frame(panel = panel, texto = tx[k], stringsAsFactors = FALSE)
  list(estado = .pptx_lamina_estado(as.character(x)), d = d[order(d$panel, d$texto), , drop = FALSE])
}

.mpb_migrar <- function(s) suppressMessages(.graficos_migrar_poblacion_antigua(list(slides = list(s))))$slides[[1]]
.mpb_g <- function(v, gr = "p_barras_categoricas") list(graficador = gr, args = list(var = v))
.mpb_cuatro <- function(vars, gr, meta) {
  list(id = "x", tipo = "p_slide_4_graficos_poblacion",
       payload = list(titulo = "Perfil", base = "", superior_izquierda = .mpb_g(vars[1], gr), superior_derecha = .mpb_g(vars[2], gr),
                      inferior_izquierda = .mpb_g(vars[3], gr), inferior_derecha = .mpb_g(vars[4], gr), meta = meta))
}

test_that("cuatro gráficos por la ruta anterior: cada panel conserva su base, distinta, una vez y sin repetirla al pie", {
  for (caso in list(list(vars = c("cargo", "anios", "sexo", "grado"), gr = "p_barras_categoricas"),
                    list(vars = c("e1", "e2", "e3", "e4"), gr = "p_barras_apiladas"))) {
    vieja <- .mpb_cuatro(caso$vars, caso$gr, list(motor_nativo = FALSE))
    a <- .mpb_bases(vieja, filas = 2L); d <- .mpb_bases(.mpb_migrar(vieja), filas = 2L)
    expect_identical(d$estado, "ruta_anterior")
    expect_identical(d$d, a$d, label = caso$gr)
    # Cuatro bases distintas, una por panel: ninguna se perdió, ninguna sobra.
    expect_setequal(d$d$panel, c("sup_izq", "sup_der", "inf_izq", "inf_der"))
    expect_identical(nrow(d$d), 4L)
    expect_identical(length(unique(d$d$texto)), 4L)
  }
  # El sufijo del proyecto sólo sale si el motor compuso la base de cada gráfico.
  vieja <- .mpb_cuatro(c("e1", "e2", "e3", "e4"), "p_barras_apiladas", list(motor_nativo = FALSE))
  d <- .mpb_bases(.mpb_migrar(vieja), filas = 2L)$d
  expect_identical(d$texto[match(c("sup_izq", "sup_der", "inf_izq", "inf_der"), d$panel)],
                   c("Base: 92 docentes", "Base: 72 docentes", "Base: 100 docentes", "Base: 60 docentes"))
})

test_that("cuatro gráficos nativos: la migración no añade bases ni las mueve", {
  vieja <- .mpb_cuatro(c("cargo", "anios", "sexo", "grado"), "p_barras_categoricas", list())
  a <- .mpb_bases(vieja, filas = 2L); d <- .mpb_bases(.mpb_migrar(vieja), filas = 2L)
  expect_identical(d$estado, a$estado)
  expect_identical(d$d, a$d)
  expect_identical(nrow(d$d), 4L)
  expect_identical(length(unique(d$d$texto)), 4L)
})

test_that("dos gráficos por la ruta anterior: cada uno su base, en su lado, y el pie no la repite", {
  for (caso in list(list(v = c("anios", "grado"), gr = "p_barras_categoricas"), list(v = c("e1", "e2"), gr = "p_barras_apiladas"))) {
    vieja <- list(id = "y", tipo = "p_slide_2_graficos_poblacion",
                  payload = list(titulo = "Perfil", izquierda = .mpb_g(caso$v[1], caso$gr), derecha = .mpb_g(caso$v[2], caso$gr),
                                 meta = list(motor_nativo = FALSE)))
    a <- .mpb_bases(vieja); d <- .mpb_bases(.mpb_migrar(vieja))
    expect_identical(d$estado, "ruta_anterior")
    expect_identical(d$d, a$d, label = caso$gr)
    expect_identical(d$d$panel, c("der", "izq"))
    expect_identical(length(unique(d$d$texto)), 2L)
  }
})

test_that("dos gráficos que el tipo vigente compone en nativo: el pie nombra la base de cada uno, en orden y una vez", {
  vieja <- list(id = "z", tipo = "p_slide_2_graficos_poblacion",
                payload = list(titulo = "Perfil", izquierda = .mpb_g("e1", "p_barras_apiladas"), derecha = .mpb_g("e2", "p_barras_apiladas")))
  a <- .mpb_bases(vieja); d <- .mpb_bases(.mpb_migrar(vieja))
  # La población antigua no tenía panel nativo: cada base iba en su gráfico. El panel nativo del tipo vigente no lleva
  # base propia, así que las dos van al pie de la lámina, izquierda primero, cada una una sola vez.
  expect_identical(a$d$texto[match(c("izq", "der"), a$d$panel)], c("Base: 92 docentes", "Base: 72 docentes"))
  expect_identical(d$estado, "nativa")
  expect_identical(d$d$panel, "pie")
  expect_identical(d$d$texto, "Base: 92 docentes. Base: 72 docentes")
  partes <- strsplit(d$d$texto, ". ", fixed = TRUE)[[1]]
  expect_identical(partes, a$d$texto[match(c("izq", "der"), a$d$panel)])
})
