# Ayudas de la ola 4 del motor PPT (tests test-ola4-*.R): el fixture «clima» con los porcentajes de las capturas G e I
# (Arte, docentes por categoría) y un render que recoge los avisos al analista. Datos sintéticos; nunca datos de cliente.

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

.ola4_lamina_g <- function(fx = .ola4_clima()) {
  .ola4_render_con_avisos(fx, list(p_slide_2_graficos_vertical(
    titulo = "Dos gráficos en vertical, divergente con saldo",
    superior = p_barras_divergentes(vars = c("doc$regl", "doc$clima"), n_negativas = 2, incluir_neutro = FALSE),
    inferior = p_barras_apiladas(var = "doc$clima", cruces = "doc$cat", overrides = .ola4_t2, mostrar_significancia = TRUE,
                                 excluir_grupos = list("Principal")))))
}
