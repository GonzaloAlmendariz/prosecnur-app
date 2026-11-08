# Ola 4, A1 (captura «I. Cuatro gráficos con exclusión», panel de arriba a la izquierda): la apilada de cinco grupos con Top
# Two Box, de respaldo en medio espacio, montaba sus cifras de fuera («8%8%», «2%2%»), dibujaba la leyenda a 7 pt y dejaba
# la barra bajo el piso sin decir nada. Ahora: (a) las cifras de una fila se separan por su tinta; (b) la leyenda no baja
# del cuerpo del estándar y el alto sale del panel; (c) si la barra no llega al piso de media lámina, el motor AVISA.
# Fixture sintético con los porcentajes de la captura (Arte, docentes por categoría); nunca datos de cliente.

.ola4_clima <- function() {
  rep_c <- function(k, n) rep(k, n)
  grupos <- list(asoc = c(3, 3, 18, 12, 3), aux = c(0, 1, 9, 8, 1), cont = c(1, 1, 26, 15, 2), jp = c(1, 0, 18, 12, 2),
                 pri = c(0, 0, 1, 1, 0))
  cod <- c("1", "2", "3", "4", "9"); gcod <- c(asoc = "1", aux = "2", cont = "3", jp = "4", pri = "5")
  q <- unlist(lapply(grupos, function(n) unlist(mapply(rep_c, cod, n))))
  g <- unlist(lapply(names(grupos), function(k) rep(gcod[[k]], sum(grupos[[k]]))))
  set.seed(7)
  q2 <- sample(cod, length(q), TRUE, prob = c(.03, .08, .75, .09, .05))
  sx <- sample(c("1", "2", "3"), length(q), TRUE, prob = c(.37, .57, .06))
  ded <- sample(c("1", "2"), length(q), TRUE, prob = c(.3, .7))
  gr <- sample(c("1", "2", "3", "4"), length(q), TRUE, prob = c(.11, .13, .68, .08))
  d <- data.frame(clima = unname(q), regl = q2, cat = unname(g), sx = sx, ded = ded, gr = gr, stringsAsFactors = FALSE)
  survey <- data.frame(name = c("clima", "regl", "cat", "sx", "ded", "gr"),
                       type = c("select_one lk", "select_one lk", "select_one ct", "select_one sx", "select_one dd", "select_one gr"),
                       list_name = c("lk", "lk", "ct", "sx", "dd", "gr"),
                       label = c("Existe un buen clima laboral en la Unidad.", "El reglamento de la carrera profesoral es pertinente.",
                                 "Categoría", "¿Cuál es su género?", "Dedicación", "¿Cuál es su mayor grado académico alcanzado?"),
                       stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c(rep("lk", 5), rep("ct", 5), rep("sx", 3), rep("dd", 2), rep("gr", 4)),
                        name = c(cod, "1", "2", "3", "4", "5", "1", "2", "3", "1", "2", "1", "2", "3", "4"),
                        label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF",
                                  "Asociado", "Auxiliar", "Contratado", "Jefe de Práctica", "Principal",
                                  "Masculino", "Femenino", "Prefiero no responder",
                                  "Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)",
                                  "Bachiller", "Licenciado(a)", "Magíster", "Doctor(a)"), stringsAsFactors = FALSE)
  list(data = list(doc = d), inst = list(doc = .ola2_instrumento(survey, choices)))
}

.ola4_t2 <- list(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))

.ola4_render_con_avisos <- function(fx, slides) {
  pth <- tempfile("ola4-", fileext = ".pptx"); avisos <- character(0)
  withCallingHandlers(
    suppressWarnings(reporte_ppt_plan(data = fx$data, instrumento = fx$inst, presets = .ola2_presets(), plan = p_plan(slides = slides),
                                      path_ppt = pth, mensajes_progreso = FALSE)),
    message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  list(pptx = pth, avisos = avisos)
}

.ola4_lamina_i <- function(fx = .ola4_clima()) {
  .ola4_render_con_avisos(fx, list(p_slide_4_graficos(
    titulo = "Cuatro gráficos con exclusión",
    superior_izquierda = p_barras_apiladas(var = "doc$clima", cruces = "doc$cat", overrides = .ola4_t2, mostrar_significancia = TRUE,
                                           excluir_grupos = list("Principal")),
    superior_derecha = p_barras_apiladas(var = "doc$regl", cruces = "doc$ded", overrides = .ola4_t2),
    inferior_izquierda = p_barras_agrupadas(var = "doc$sx"), inferior_derecha = p_barras_agrupadas(var = "doc$gr"))))
}

test_that("A1a: las cifras de fuera de una misma fila no se montan en el respaldo de medio espacio", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_i()
  cj <- .ola2_cajas(r$pptx, 1L)
  izq <- cj[cj$x1 < 6.7 & cj$y0 > 1.7 & cj$y1 < 4.4 & .ola2_es_cifra(cj$texto), , drop = FALSE]
  expect_gte(nrow(izq), 8L)
  # Ninguna pareja de cifras del panel se cruza (las cajas de la apilada de respaldo son su tinta).
  expect_length(.ola2_solapes(izq), 0L)
  # Las de la fila de «Asociado» (8 % y 8 % del lado negativo) quedan con aire entre sí.
  ochos <- izq[izq$texto == "8%", , drop = FALSE]
  ochos <- ochos[order(ochos$y0, ochos$x0), , drop = FALSE]
  if (nrow(ochos) >= 2L && abs(ochos$y0[1] - ochos$y0[2]) < 0.01) expect_gte(ochos$x0[2] - ochos$x1[1], 0.02)
})

test_that("A1b: la leyenda del respaldo no baja del cuerpo del estándar", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_i()
  cj <- .ola2_cajas(r$pptx, 1L)
  ley <- cj[cj$x1 < 6.7 & cj$texto %in% c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"), ,
            drop = FALSE]
  expect_gte(nrow(ley), 5L)
  expect_true(all(ley$pt >= .std_pt("leyenda") - 0.05))
  expect_identical(.apiladas_leyenda_piso_pt(16), as.numeric(.std_pt("leyenda")))   # 16 puede ceder hasta el estándar, no más
  expect_identical(.apiladas_leyenda_piso_pt(9), 9)                                  # lo pedido menor manda
  # Sin cupo, cede el panel y no cabecera, leyenda ni pie.
  x <- .apiladas_panel_cede_alto(0.5, 3.0, 0.6, 0.2, 2.4)
  expect_true(x$cedio); expect_equal(x$h_total_in, 2.4); expect_equal(x$h_panel_in, 1.1)
  expect_false(.apiladas_panel_cede_alto(0.5, 1, 0.6, 0.2, 2.4)$cedio)               # cabe: no se toca
  expect_false(.apiladas_panel_cede_alto(0.5, 3.5, 1.5, 0.2, 2.4)$cedio)             # el panel quedaría inútil: no se toca
})

test_that("A1c: si la barra no llega al piso de media lámina, el motor avisa y no parte la lámina", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_i()
  av <- grep("no cabe en medio espacio", r$avisos, value = TRUE)
  expect_false(anyDuplicated(av) > 0)                                                  # una vez por gráfico, no por pasada
  expect_true(any(grepl("El gráfico «Existe un buen clima laboral en la Unidad.» no cabe en medio espacio a tamaño estándar: conviene una lámina propia.",
                        av, fixed = TRUE)))
  expect_true(all(startsWith(av, .PULSO_AVISO_SELLO)))
  expect_identical(length(officer::read_pptx(r$pptx)), 1L)                            # sigue siendo una lámina
  expect_length(suppressMessages(.lam_respaldo_avisar_medio_espacio(c(`Una` = 1))), 0L) # sobre el piso: no avisa
})
