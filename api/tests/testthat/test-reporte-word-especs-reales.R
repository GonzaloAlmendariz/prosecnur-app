source("setup-load-all.R")

# Cada renderer del Word con la espec REAL de su graficador (fixtures sin red de los test-lamina-*.R). Nace del verificador de
# N8.9: dos defectos (escala 0-1 del radar, anillos del radar con piso bajo) pasaron con especs armadas a mano.

.wr_dir <- tempfile("word_reales_"); dir.create(.wr_dir)
probar <- function(nombre, tipo_esperado, mk) {
  test_that(paste0("el Word dibuja «", nombre, "» con la espec real y el renderer «", tipo_esperado, "»"), {
    skip_if_not_installed("ggplot2")
    p <- suppressWarnings(mk())
    avisos <- character(0)
    g <- withCallingHandlers(.word_grafico(p), message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
    expect_identical(attr(g, "renderer"), tipo_esperado)
    expect_false(any(grepl("[word]", avisos, fixed = TRUE)))
    expect_no_error(suppressWarnings(ggplot2::ggplot_build(g)))
    f <- suppressWarnings(.word_png(g, attr(g, "alto"), ancho = attr(g, "ancho") %||% .std_word("pagina", "ancho_util"), archivo = file.path(.wr_dir, paste0(nombre, ".png"))))
    expect_gt(file.size(f), 1000)
  })
}

# categorica
probar("categorica_barras", "categorica", function() {
  d <- data.frame(categoria = c("Redes sociales", "Un amigo", "Otro"), N = c(45, 30, 25), pct = c(.45, .30, .25))
  graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total")) })
probar("categorica_sino", "categorica", function() {
  d <- data.frame(categoria = c("Sí", "No"), N = c(30, 10), pct = c(.75, .25))
  graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total")) })
probar("categorica_2series", "marco", function() {
  d <- data.frame(categoria = c("A", "B", "C"), N = c(45, 30, 25), p1 = c(.45, .30, .25), p2 = c(.5, .2, .3))
  graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = c("p1", "p2"), etiquetas_series = c(p1 = "2024", p2 = "2025")) })
# escala
probar("escala", "escala", function() {
  d <- data.frame(categoria = c("Quinto", "Sexto", "Séptimo"), N = 100L, t1 = c(.3, .1, .2), t2 = c(.2, .1, .2), t3 = c(.3, .4, .3), t4 = c(.2, .4, .3))
  graficar_barras_apiladas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("t", 1:4),
    etiquetas_grupos = c(t1 = "TD", t2 = "D", t3 = "A", t4 = "TA"), exportar = "rplot", usar_canvas = TRUE,
    ancho = 12.5, alto = 4.6, mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", top2box_labels = c("A", "TA")) })
# divergentes
niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
probar("divergentes", "divergentes", function() {
  d <- data.frame(it = c("Baja", "Alta"), t1 = c(.27, 0), t2 = c(.20, .13), t3 = c(.27, .80), t4 = c(.07, .07), t5 = c(.19, 0))
  graficar_barras_divergentes(d, "it", names(niv), niv, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = FALSE) })
probar("divergentes_neutro", "divergentes", function() {
  d <- data.frame(it = c("Baja", "Alta", "Media"), t1 = c(.27, 0, .1), t2 = c(.20, .13, .2), t3 = c(.27, .80, .3), t4 = c(.07, .07, .3), t5 = c(.19, 0, .1))
  graficar_barras_divergentes(d, "it", names(niv), niv, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = TRUE) })
# pesas
probar("pesas", "pesas", function() {
  dd <- data.frame(eje = rep(c("A", "B", "C"), 2), grupo = factor(rep(c("x", "y"), each = 3), levels = c("x", "y")), valor = c(60, 40, 70, 50, 45, 72))
  graficar_dumbbell(dd, mostrar_brecha = TRUE) })
# histograma
probar("histograma", "histograma", function() {
  x <- c(rep(19, 9), rep(20, 30), rep(21, 35), rep(22, 32), rep(23, 25))
  graficar_histograma(data.frame(edad = x), "edad", modo = "conteo") })
probar("histograma_recetario", "histograma", function() {
  .histograma_recetario(c(rep(19, 9), rep(20, 30), rep(21, 35), rep(22, 32), rep(23, 25)), modo = "conteo", unidad = "años") })
# numerico (sellador real del render del plan)
probar("numerico", "numerico", function() {
  dw <- tibble::tibble(categoria = factor(c("b", "a"), levels = c("a", "b")), N = c(10, 20), v = c(22.46, 20.55))
  .numerico_sellar(ggplot2::ggplot(), "mean", "Media", dw, "v", list(decimales = 1)) })
# media_rango
probar("media_rango", "media_rango", function() {
  d <- data.frame(categoria = factor(rep(c("Docentes", "Estudiantes"), c(4, 5)), levels = c("Docentes", "Estudiantes")), valor = c(27, 40, 50, 71, 19, 20, 22, 25, 40))
  graficar_media_rango(d, "categoria", "valor", tipo_rango = "minmax") })
# boxplot
probar("boxplot", "boxplot", function() {
  d <- data.frame(cat = rep(c("A", "B"), c(5, 6)), v = c(19, 20, 20, 21, 30, 20, 21, 21, 22, 22, 23))
  graficar_boxplot(d, "cat", "v") })
# pie
probar("pie_dona4", "pie", function() graficar_pie(data.frame(cat = c("Dependiente", "Independiente", "No trabaja", "Estudia"), pct = c(.62, .21, .11, .06), n = c(110, 37, 20, 11)), "cat", "pct", "n", tipo_pie = "donut"))
probar("pie_torta2", "pie", function() graficar_pie(data.frame(c = c("Sí", "No"), p = c(56, 122) / 178, n = c(56, 122)), "c", "p", var_n = "n", tipo_pie = "pie"))
probar("pie_torta3", "pie", function() graficar_pie(data.frame(c = c("Sí", "No", "NS"), p = c(.6, .33, .07), n = c(60, 33, 7)), "c", "p", var_n = "n", tipo_pie = "pie"))
probar("pie_dona7", "pie", function() graficar_pie(data.frame(c = LETTERS[1:7], p = c(.3,.2,.15,.1,.1,.1,.05), n = c(30,20,15,10,10,10,5)), "c", "p", var_n = "n", tipo_pie = "donut"))
# dimensiones (fixture de test-lamina-dimensiones.R, motor real reporte_dimensiones)
dm <- local({
  set.seed(4); n <- 60
  dat <- data.frame(p1 = sample(c("1", "2", "3", "4"), n, TRUE, prob = c(.05, .1, .4, .45)), p2 = sample(c("1", "2", "3", "4"), n, TRUE),
                    p3 = sample(c("1", "2", "3", "4"), n, TRUE, prob = c(.1, .1, .3, .5)), sexo = sample(c("1", "2"), n, TRUE), stringsAsFactors = FALSE)
  for (v in c("p1", "p2", "p3")) attr(dat[[v]], "label") <- toupper(v)
  attr(dat$sexo, "label") <- "Sexo"
  inst <- list(survey = data.frame(name = c("p1", "p2", "p3", "sexo"), type = c(rep("select_one sat", 3), "select_one sx"), list_name = c(rep("sat", 3), "sx"), stringsAsFactors = FALSE),
               choices = rbind(data.frame(list_name = "sat", name = c("1", "2", "3", "4"), label = c("1", "2", "3", "4")),
                               data.frame(list_name = "sx", name = c("1", "2"), label = c("Masculino", "Femenino"))), orders_list = NULL)
  d1 <- suppressMessages(reporte_dimensiones(data = dat, instrumento = inst, vars = c("p1", "p2", "p3"), prefijo = "r100_", reemplazar = FALSE,
                                             orden_por_lista = list(sat = c("1", "2", "3", "4")), verbose = FALSE))
  d2 <- suppressMessages(reporte_dimensiones_indices(data = d1, subindices = list(subindice("a", "Técnicas", c("r100_p1", "r100_p2")), subindice("b", "Transversales", "r100_p3")),
                                                     indices = list(indice("idx", "Índice", c("a", "b")))))
  list(data = d2, instrumento = inst)
})
args_dm <- list(data = dm$data, instrumento = dm$instrumento, modo = "general", objetivo = "idx_idx", cruce = "sexo", incluir_total = TRUE)
probar("heatmap_dim", "heatmap_dim", function() .espec_dim_adjuntar(suppressWarnings(do.call(graficar_heatmap_dimensiones, args_dm)), args_dm, "heatmap"))
args_cmp <- list(data = dm$data, instrumento = dm$instrumento, modo = "general", objetivo = "idx_idx", cruce = "sexo")
probar("comparativo_dim", "comparativo_dim", function() .espec_dim_adjuntar(suppressWarnings(do.call(graficar_comparativo_radarbar_dimensiones, args_cmp)), args_cmp, "comparativo"))
# radar
rd <- function(v) { do.call(rbind, lapply(names(v), function(g) data.frame(eje = c("Estados financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial"), grupo = g, valor = v[[g]]))) }
probar("radar_recetario", "radar", function() graficar_radar(rd(list(Docentes = c(98, 96, 92, 96, 94, 92), Estudiantes = c(96, 91, 94, 95, 96, 94), Egresados = c(98, 98, 94, 93, 98, 95))),
                                                             escala_valor = "proporcion_100", usar_canvas = TRUE, mostrar_tabla_derecha = TRUE))
probar("radar_valores_bajos", "radar", function() graficar_radar(rd(list(A = c(30, 45, 52, 60, 38, 41), B = c(25, 50, 58, 66, 35, 44))), escala_valor = "proporcion_100", usar_canvas = TRUE))
probar("radar_prop1", "radar", function() graficar_radar(rd(list(A = c(.9, .85, .8, .95, .88, .91), B = c(.82, .9, .86, .93, .8, .87))), escala_valor = "proporcion_1", usar_canvas = TRUE))
# mapa (cartografía del paquete, sin red)
probar("mapa_distrito", "mapa", function() {
  ubigeo <- "150108"; feats <- hojas_ruta_zone_map_preview(ubigeo)$geojson$features
  set.seed(3); idx <- sample(seq_along(feats), 14); ef <- idx[1:9]
  zones <- lapply(seq_along(feats), function(i) list(ubigeo = ubigeo, distrito = "Chorrillos", zona = .graficos_geojson_zone_code(feats[[i]]),
    status = if (i %in% ef) "efectiva" else if (i %in% idx) "intervencion" else "no_intervenido", rings = .graficos_geojson_rings_payload(feats[[i]]$geometry)))
  graficar_mapa_cobertura_territorial(list(scope = "district", ubigeo = ubigeo, distrito = "Chorrillos", zones = zones,
       summary = list(list(ubigeo = ubigeo, distrito = "Chorrillos", grupo = "intervencion", zonas_ruta = 14, zonas_efectivas = 9)))) })
probar("mapa_general", "mapa", function() {
  ds <- .graficos_acnur_koica_districts()
  graficar_mapa_cobertura_territorial(list(scope = "overview_koica", zones = list(), lima_boundary = .graficos_lima_district_context(),
       summary = lapply(seq_along(ds), function(k) list(ubigeo = ds[[k]]$ubigeo, distrito = ds[[k]]$distrito, grupo = ds[[k]]$group, zonas_ruta = 20 + k, zonas_efectivas = 10 + 2 * k)))) })
probar("mapa_resultado", "mapa", function() {
  dl <- c("Chorrillos", "Comas", "El Agustino", "Distrito Inventado"); pct <- c(77, 55, 51, 60); n <- 100
  filas <- lapply(seq_along(pct), function(k) data.frame(dist = as.character(k), sat = c(rep("5", pct[k]), rep("2", n - pct[k]))))
  inst <- list(survey = data.frame(name = c("sat", "dist"), type = c("select_one s", "select_one d"), list_name = c("s", "d"), label = c("Satisfacción", "Distrito")),
               choices = data.frame(list_name = c(rep("s", 5), rep("d", 4)), name = c(as.character(1:5), as.character(1:4)),
                                    label = c("Muy insatisfecho", "Insatisfecho", "Ni uno ni otro", "Satisfecho", "Muy satisfecho", dl)), orders_list = NULL)
  f <- .mapa_resultado_casar(.mapa_resultado_calcular(do.call(rbind, filas), inst, "sat", "dist", c("4", "5")), .mapa_resultado_lima())
  graficar_mapa_resultado_distrital(.espec_mapa_resultado(f, c(55, 65, 75), min_n = 5L, indicador = c("Satisfecho", "Muy satisfecho"))) })

test_that("el radar con piso bajo dibuja sólo los anillos de su espec, no uno cada 5 (verificador de N8.9)", {
  p <- suppressWarnings(graficar_radar(rd(list(A = c(30, 45, 52, 60, 38, 41), B = c(25, 50, 58, 66, 35, 44))), escala_valor = "proporcion_100", usar_canvas = TRUE))
  e <- attr(p, "pulso_espec")
  g <- .word_g_radar(e)
  rot <- g$layers[[2]]$aes_params$label %||% suppressWarnings(ggplot2::ggplot_build(g))$data[[2]]$label
  expect_identical(as.character(rot), paste0(e$anillos, "%"))
  expect_lte(length(rot), 5L)
})

test_that("una torta de siete porciones no repite color", {
  p <- suppressWarnings(graficar_pie(data.frame(c = LETTERS[1:7], p = c(.3, .2, .15, .1, .1, .1, .05), n = c(30, 20, 15, 10, 10, 10, 5)), "c", "p", var_n = "n", tipo_pie = "donut"))
  b <- suppressWarnings(ggplot2::ggplot_build(.word_g_pie(attr(p, "pulso_espec"))))
  expect_length(unique(b$data[[1]]$fill), 7L)
})
