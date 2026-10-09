# Láminas con narrativa del recetario (124 y 136; ADR 0093, N7): la franja con filete coral va arriba, a 15 pt y con
# tramos en negrita, y la lámina nativa del gráfico baja su zona de datos lo que mide el texto.

.nr_inst <- function() list(
  survey = data.frame(name = c("anio", "sueldo"), type = c("select_one la", "select_one ls"), list_name = c("la", "ls"),
                      label = c("¿En qué año obtuvo su título?", "Sueldo mensual bruto"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("la", 4), rep("ls", 3)), name = c("2022", "2023", "2024", "2025", "s1", "s2", "s3"),
                       label = c("2022", "2023", "2024", "2025", "Menos de S/ 2,500", "S/ 2,500 a 4,499", "S/ 4,500 a más"), stringsAsFactors = FALSE),
  orders_list = NULL)
.nr_datos <- function() { set.seed(5); data.frame(anio = sample(c("2022", "2023", "2024", "2025"), 90, TRUE), sueldo = sample(c("s1", "s2", "s3"), 90, TRUE), stringsAsFactors = FALSE) }
.nr_mazo <- function(plan) {
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .nr_datos(), instrumento = .nr_inst(), plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}
.nr_nombres <- function(x) xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
.nr_y <- function(x, n) as.numeric(xml2::xml_attr(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]/p:spPr/a:xfrm/a:off", n)), "y")) / 914400

test_that("la narrativa parte los tramos en negrita y mide al menos una línea del recetario", {
  tr <- .lam_narrativa_tramos("Lo que más piden es **integrar herramientas** y **actualizar el plan**.")
  expect_identical(vapply(tr, `[[`, "", 1), c("Lo que más piden es ", "integrar herramientas", " y ", "actualizar el plan", "."))
  expect_identical(vapply(tr, `[[`, TRUE, 2), c(FALSE, TRUE, FALSE, TRUE, FALSE))
  expect_equal(.lam_narrativa_alto("Breve.", 12.523), 0.45)
  expect_equal(getOption("prosecnur.lam_desplazo", 0), 0)
  expect_equal(.lam_con_desplazo(0.7, .std_geom("zona_datos_y0")), .std_valor("ppt", "geometria", "zona_datos_y0") + 0.7)
  expect_equal(getOption("prosecnur.lam_desplazo", 0), 0)                                  # la opción se repone
})

test_that("un gráfico con narrativa (124) sale nativo, con el gráfico debajo de la franja coral", {
  tx <- "El **27% de los titulados** obtuvo su título en 2025."
  lam <- .nr_mazo(list(a = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "Titulación", texto = tx),
                       b = p_slide_1_grafico(p_barras_categoricas("anio"), titulo = "Sin narrativa")))
  x <- lam[[1]]; nm <- .nr_nombres(x)
  expect_true("prosecnur:narrativa" %in% nm); expect_true(any(grepl("^prosecnur:grafico", nm)))
  t <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='narrativa:texto']]//a:r"))
  expect_identical(paste(t, collapse = ""), "El 27% de los titulados obtuvo su título en 2025.")
  fondo <- max(.nr_y(x, "narrativa:texto")) + .lam_narrativa_alto(tx, 12.523)
  # Columnas (cuatro años): la base queda en su sitio y nada del gráfico sube a la franja.
  arriba <- min(.nr_y(x, "columna"), .nr_y(x, "cifra"), .nr_y(x, "n"))
  expect_gt(arriba, fondo)
  # Barras (siete rótulos que no caben bajo una columna): todo el gráfico baja lo que mide la franja.
  # El código es el propio rótulo: el fixture crudo (sin orders_list) rotula con el código.
  cods <- paste("Ingeniería industrial y de sistemas, sede", c("Lima", "Arequipa", "Cusco", "Piura", "Trujillo", "Chiclayo", "Huancayo"))
  inst <- list(survey = data.frame(name = "anio", type = "select_one lc", list_name = "lc", label = "Carrera", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lc", name = cods, label = cods, stringsAsFactors = FALSE), orders_list = NULL)
  set.seed(2); d11 <- data.frame(anio = sample(cods, 200, TRUE), stringsAsFactors = FALSE)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = d11, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE, plan = list(
    a = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "T", texto = tx), b = p_slide_1_grafico(p_barras_categoricas("anio"), titulo = "S")))))
  xb <- lapply(1:2, function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
  yb <- lapply(xb, function(z) .nr_y(z, "barra"))
  expect_gt(length(yb[[1]]), 0L)
  expect_equal(min(yb[[1]]) - min(yb[[2]]), .lam_narrativa_geo(tx)$desplazo, tolerance = 0.12)
})

test_that("con una narrativa de tres líneas las columnas se acortan y no suben a la franja", {
  tx <- paste(rep("Lectura extensa del resultado principal de la pregunta.", 5), collapse = " ")
  G <- .lam_narrativa_geo(tx); expect_gt(G$h, 0.8); expect_lte(G$h, 1.1)
  lam <- .nr_mazo(list(a = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "T", texto = tx)))
  arriba <- min(.nr_y(lam[[1]], "columna"), .nr_y(lam[[1]], "cifra"), .nr_y(lam[[1]], "n"))
  expect_gt(arriba, G$y + G$h)
})

test_that("sin texto la lámina narrativa es la de un gráfico, y una narrativa larga o motor_nativo = FALSE vuelven a la ruta anterior", {
  largo <- paste(rep("Una lectura que no cabe en la franja del recetario.", 14), collapse = " ")
  lam <- .nr_mazo(list(
    a = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "Sin texto", texto = ""),
    b = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "Largo", texto = largo),
    c = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "Atrás", texto = "Corta.", meta = list(motor_nativo = FALSE))))
  nativo <- vapply(lam, function(x) any(grepl("^prosecnur:grafico", .nr_nombres(x))), TRUE)
  narr <- vapply(lam, function(x) "prosecnur:narrativa" %in% .nr_nombres(x), TRUE)
  expect_identical(nativo, c(TRUE, FALSE, FALSE)); expect_false(any(narr))
})

test_that("dos gráficos con narrativa (136) salen lado a lado bajo la franja, con el filete al medio", {
  lam <- .nr_mazo(list(a = p_slide_2_graficos_narrativo(p_barras_categoricas("anio"), p_barras_categoricas("sueldo"), titulo = "Inserción",
                                                        texto = "El tramo más frecuente es **S/ 2,500 a 4,499**.")))
  x <- lam[[1]]; nm <- .nr_nombres(x)
  expect_true("prosecnur:narrativa" %in% nm); expect_true(any(grepl("^prosecnur:grafico", nm)))
  sep <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='separador']]/p:spPr/a:xfrm/a:off")
  xs <- as.numeric(xml2::xml_attr(sep, "x")) / 914400
  g_ <- .std_geom; ml <- g_("margen_izq"); col2 <- (g_("ancho") - ml - g_("margen_der") - 0.5) / 2
  expect_true(any(abs(xs - (ml + col2 + 0.25)) < 0.02))                                     # filete vertical al medio (6.756)
  ys <- as.numeric(xml2::xml_attr(sep, "y")) / 914400
  expect_gt(min(ys), .std_geom("zona_datos_y0") + 0.5)                                       # los paneles bajan bajo la narrativa
})

test_that("los saltos de línea se miden por párrafo y se dibujan como saltos; cuatro líneas van a la ruta anterior (verificador de N7)", {
  w <- 12.523
  expect_equal(.lam_narrativa_lineas("Uno.\nDos.\nTres.", w), 3)
  expect_gt(.lam_narrativa_alto("Uno.\nDos.\nTres.", w), .lam_narrativa_alto("Uno. Dos. Tres.", w))
  lam <- .nr_mazo(list(a = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "Tres", texto = "Uno.\n**Dos.**\nTres."),
                       b = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "Cuatro", texto = "Uno.\nDos.\nTres.\nCuatro.")))
  expect_true("prosecnur:narrativa" %in% .nr_nombres(lam[[1]]))
  sp <- xml2::xml_find_all(lam[[1]], "//p:sp[p:nvSpPr/p:cNvPr[@name='narrativa:texto']]")
  expect_length(xml2::xml_find_all(sp, ".//a:br"), 2L)
  expect_length(xml2::xml_find_all(sp, ".//a:r//a:r"), 0L)                                   # ningún run dentro de otro
  expect_identical(paste(xml2::xml_text(xml2::xml_find_all(sp, ".//a:t")), collapse = "|"), "Uno.|Dos.|Tres.")
  expect_false("prosecnur:narrativa" %in% .nr_nombres(lam[[2]]))
})

test_that("un ** sin pareja queda literal y no invierte la negrita", {
  tr <- .lam_narrativa_tramos("El **27%** obtuvo su título en **2025.")
  expect_identical(vapply(tr, `[[`, "", 1), c("El ", "27%", " obtuvo su título en **2025."))
  expect_identical(vapply(tr, `[[`, TRUE, 2), c(FALSE, TRUE, FALSE))
})

test_that("el encabezado de selección múltiple y el del numérico quedan bajo la franja, con una a tres líneas", {
  set.seed(4)
  ops <- c("dig", "plan", "pract", "ingles")
  df <- data.frame(sm = vapply(1:80, function(i) paste(sample(ops, sample(1:3, 1)), collapse = " "), ""), edad = sample(18:30, 80, TRUE),
                   ciclo = sample(c("I", "II", "III"), 80, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("sm", "edad", "ciclo"), type = c("select_multiple lsm", "integer", "select_one lc"), list_name = c("lsm", NA, "lc"),
                                   label = c("¿Qué mejorarías?", "Edad", "Ciclo"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("lsm", 4), rep("lc", 3)), name = c(ops, "I", "II", "III"), label = c(ops, "I", "II", "III")), orders_list = NULL)
  for (tx in c("Una línea de **lectura**.", paste(rep("Una lectura extensa del resultado principal de la pregunta.", 5), collapse = " "))) {
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE, plan = list(
      a = p_slide_1_grafico_narrativo(p_barras_agrupadas(var = "sm"), titulo = "SM", texto = tx),
      b = p_slide_1_grafico_narrativo(p_numerico("edad", metrica = "mean", cruce = "ciclo"), titulo = "Num", texto = tx)))))
    G <- .lam_narrativa_geo(tx); fondo <- G$y + G$h
    for (k in 1:2) {
      x <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
      expect_true("prosecnur:narrativa" %in% .nr_nombres(x), info = paste(k, tx))
      ys <- c(.nr_y(x, "encabezado"), .nr_y(x, "numerico:encabezado"), .nr_y(x, "barra"), .nr_y(x, "numerico:columna"))
      expect_gt(length(ys), 0L); expect_gte(min(ys), fondo, label = paste("lámina", k, nchar(tx)))
    }
  }
})

test_that("sin texto, la lámina narrativa es la de un gráfico también en la pregunta de la dicotomía (titulo_de_var)", {
  inst <- .nr_inst(); inst$survey <- rbind(inst$survey, data.frame(name = "trab", type = "select_one lt", list_name = "lt", label = "¿Está trabajando actualmente?"))
  inst$choices <- rbind(inst$choices, data.frame(list_name = "lt", name = c("si", "no"), label = c("Sí", "No")))
  df <- .nr_datos(); df$trab <- rep(c("si", "no"), length.out = nrow(df))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE, plan = list(
    a = p_slide_1_grafico(p_barras_categoricas("trab"), titulo = "Trabajo"),
    b = p_slide_1_grafico_narrativo(p_barras_categoricas("trab"), titulo = "Trabajo", texto = "")))))
  txt <- lapply(1:2, function(k) xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))),
                                                                     "//p:sp[not(p:nvSpPr/p:cNvPr[@name='Folio lamina'])]//a:t")))   # el folio es la posición
  expect_identical(txt[[2]], txt[[1]])
})

test_that("una narrativa con etiqueta lleva la etiqueta en su línea y el texto sin duplicar", {
  lam <- .nr_mazo(list(a = p_slide_1_grafico_narrativo(p_barras_categoricas("anio"), titulo = "T", etiqueta = "Hallazgo clave",
                                                       texto = "El **27%** obtuvo su título en 2025.")))
  sp <- xml2::xml_find_all(lam[[1]], "//p:sp[p:nvSpPr/p:cNvPr[@name='narrativa:texto']]")
  expect_length(xml2::xml_find_all(sp, ".//a:r//a:r"), 0L)
  expect_identical(paste(xml2::xml_text(xml2::xml_find_all(sp, ".//a:t")), collapse = ""), "Hallazgo claveEl 27% obtuvo su título en 2025.")
  expect_length(xml2::xml_find_all(sp, ".//a:br"), 1L)
})
