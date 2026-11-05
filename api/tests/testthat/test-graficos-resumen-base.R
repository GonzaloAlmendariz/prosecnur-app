source("setup-load-all.R")

# De qué base leen las láminas de resumen (graficos_resumen_base.R). Sin `fuente`, el resumen de diferencias y los
# hallazgos clave leían la PRIMERA base de la sesión aunque el plan fuera de otra (la base activa); ahora siguen la regla
# de las demás láminas: la fuente de la lámina, que el job, la vista previa y la propuesta llenan con la base del plan.
# Una fila o pregunta de otra base queda fuera con un aviso, en vez de leerse en silencio contra la base equivocada.
# Fixture: dos bases con las mismas columnas y datos distintos («default» primero, «otra» es la activa).

.rb_base <- function(semilla, efecto) {
  set.seed(semilla)
  aula <- rep(sprintf("a%02d", 1:40), each = 10)
  na <- as.integer(sub("a", "", aula))
  area <- ifelse(na <= 20, "1", "2")
  niv <- c("6", "7", "8", "9")[((na - 1L) %% 4L) + 1L]
  sexo <- rep(c("1", "1", "2", "2"), 100)
  q <- ifelse(stats::runif(400) < ifelse(area == "1", efecto[1], efecto[2]), "1", "2")
  t <- ifelse(stats::runif(400) < c(`6` = 0.2, `7` = 0.3, `8` = 0.35, `9` = 0.8)[niv], "1", "2")
  z <- rep(c("1", "2"), 200)
  data.frame(aula = aula, area = area, niv = niv, sexo = sexo, q = q, t = t, z = z, stringsAsFactors = FALSE)
}
.rb_inst <- function() list(
  survey = data.frame(name = c("area", "niv", "sexo", "q", "t", "z"),
                      type = c("select_one ar", "select_one nv", "select_one sx", "select_one qq", "select_one sn", "select_one qq"),
                      list_name = c("ar", "nv", "sx", "qq", "sn", "qq"),
                      label = c("Área", "Nivel", "Sexo", "Pregunta q", "¿Trabajas?", "Pregunta z"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("ar", "ar", rep("nv", 4), "sx", "sx", "qq", "qq", "sn", "sn"),
                       name = c("1", "2", "6", "7", "8", "9", "1", "2", "1", "2", "1", "2"),
                       label = c("Economía", "Sociales", "Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9", "Mujer", "Hombre",
                                 "Sí", "No", "Sí", "No"), stringsAsFactors = FALSE),
  orders_list = list(
    q = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Pregunta q"),
    z = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Pregunta z"),
    t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "¿Trabajas?")))
.rb_ds <- function() list(default = .rb_base(11, c(0.5, 0.5)), otra = .rb_base(2026, c(0.8, 0.15)))
.rb_is <- function() list(default = .rb_inst(), otra = .rb_inst())
.rb_sig <- function() {
  r <- .sig_regla_fabrica()
  r$prueba <- "rao_scott"; r$correccion <- "bh_informe"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  list(regla = r, familia = NULL, m = 500L, cruces = c("area", "niv", "sexo"))
}
.rb_rot <- list(area = "Área", niv = "Nivel", sexo = "Sexo")
.rb_grafico <- function(id, titulo, var) {
  list(id = id, tipo = "p_slide_1_grafico", payload = list(titulo = titulo, grafico = list(graficador = "p_barras_agrupadas", args = list(var = var))))
}
.rb_hallazgos <- function(...) list(id = "h1", tipo = "p_slide_hallazgos",
                                    payload = utils::modifyList(list(modo = "resumen", seleccion = "auto", rotulos = .rb_rot,
                                                                     cruces = list("area", "niv", "sexo")), list(...)))
.rb_resumen <- function(...) list(id = "r1", tipo = "p_slide_resumen_diferencias",
                                  payload = utils::modifyList(list(seleccion = "auto", rotulos = .rb_rot,
                                                                   cruces = list("area", "niv", "sexo")), list(...)))
.rb_plan <- function() list(
  list(id = "s1", tipo = "p_slide_seccion", payload = list(titulo = "Uno")),
  .rb_grafico("g1", "Pregunta q", "q"), .rb_grafico("g2", "Pregunta z", "z"),
  list(id = "s2", tipo = "p_slide_seccion", payload = list(titulo = "Dos")),
  .rb_grafico("g3", "¿Trabajas?", "t"), .rb_hallazgos(), .rb_resumen())
.rb_calcular <- function(slide, ds = .rb_ds(), is = .rb_is(), base = "otra") {
  suppressMessages(.propuesta_resumen_calcular(slide, .rb_plan(), ds, is, sig_informe = .rb_sig(), inclusivo = FALSE, base = base))
}
.rb_cifras <- function(p) {
  x <- unlist(lapply(p$capitulos, function(c) c$cifras %||% c$filas), recursive = FALSE)
  vapply(x, function(f) paste(f$var, f$cifra, f$diferencia, sep = "|"), "")
}
.rb_motor_plan <- function(base) {
  lapply(.rb_plan(), function(s) .graficos_rebuild_slide_json(.graficos_calificar_refs_plan(list(slides = list(s)), base)$slides[[1]]))
}

# ---- La regla -------------------------------------------------------------------------------------------------------

test_that("la base de la lámina: su fuente, luego sus referencias, luego las del plan, y nunca la primera en silencio", {
  ds <- .rb_ds()
  expect_identical(.resumen_base_lamina(list(fuente_ref = "otra"), ds), "otra")
  expect_identical(.resumen_base_lamina(list(fuente_ref = "otra$q"), ds), "otra")
  expect_error(.resumen_base_lamina(list(fuente_ref = "ajena"), ds), "no está en el informe")
  el <- list(.element_type = "resumen_diferencias", capitulos = list(list(titulo = "A", filas = list(list(var = "otra$q", fila = "Sí")))))
  expect_identical(.resumen_base_lamina(el, ds), "otra")
  expect_identical(.resumen_base_lamina(list(.element_type = "hallazgos"), ds, .rb_motor_plan("otra")), "otra")
  expect_identical(.resumen_base_lamina(list(), list(unica = ds$default)), "unica")
  # Sin nada que la diga y con varias bases: la primera, pero con un aviso sin punto medio, raya ni punto y coma.
  expect_message(b <- .resumen_base_lamina(list(.element_type = "resumen_diferencias"), ds), "no dice de qué base lee")
  expect_identical(b, "default")
  av <- tryCatch(.resumen_base_lamina(list(.element_type = "resumen_diferencias"), ds), message = conditionMessage)
  expect_false(grepl("[·;—–]", av))
})

test_that("el job, la vista previa y la propuesta califican la fuente del resumen con la base del plan", {
  cal <- function(s, base = "otra") .graficos_calificar_refs_plan(list(slides = list(s)), base)$slides[[1]]
  expect_identical(cal(.rb_hallazgos())$payload$fuente, "otra")
  expect_identical(cal(.rb_resumen())$payload$fuente, "otra")
  expect_identical(cal(.rb_resumen(fuente = "default"))$payload$fuente, "default")   # la que dice la lámina, manda
  propia <- .rb_resumen(seleccion = "manual", capitulos = list(list(titulo = "A", filas = list(list(var = "default$q", fila = "Sí")))))
  expect_identical(cal(propia)$payload$fuente, "default")                            # la que nombran sus filas
  expect_null(cal(.rb_grafico("g", "G", "q"))$payload$fuente)                         # las demás láminas, sin tocar
  expect_identical(.graficos_calificar_refs_plan(list(slides = list(.rb_resumen())), "")$slides[[1]], .rb_resumen())
  # La fuente llega al elemento del motor.
  expect_identical(.graficos_rebuild_slide_json(cal(.rb_resumen()))$slots$plot$fuente_ref, "otra")
  expect_identical(.graficos_rebuild_slide_json(cal(.rb_hallazgos()))$slots$plot$fuente_ref, "otra")
})

# ---- Dos bases: la propuesta y el render ----------------------------------------------------------------------------

test_that("con dos bases, la propuesta lee la base activa y no la primera de la sesión", {
  for (slide in list(.rb_hallazgos(), .rb_resumen())) {
    p <- .rb_calcular(slide)
    expect_identical(p$base, "otra")
    sola <- .rb_calcular(slide, ds = .rb_ds()["otra"], is = .rb_is()["otra"])
    expect_gt(length(.rb_cifras(p)), 0L)
    expect_identical(.rb_cifras(p), .rb_cifras(sola))                 # las mismas cifras que con la base sola
    primera <- .rb_calcular(slide, base = "default")
    expect_identical(primera$base, "default")
    expect_false(identical(.rb_cifras(p), .rb_cifras(primera)))      # y no las de la otra base
  }
})

test_that("el render lee la base que resuelve la lámina, no la primera", {
  render <- function(el, plan, data_sources, instrument_sources) .dif_fuente_render(el, plan)
  plan <- .rb_motor_plan("otra")
  el <- .graficos_rebuild_slide_json(.graficos_calificar_refs_plan(list(slides = list(.rb_resumen())), "otra")$slides[[1]])$slots$plot
  f <- render(el, plan, .rb_ds(), .rb_is())
  expect_identical(f$base, "otra")
  expect_identical(f$data, .rb_ds()$otra)
  # Sin fuente (un plan escrito en R): la base de las preguntas del plan.
  el$fuente_ref <- NULL
  expect_identical(render(el, plan, .rb_ds(), .rb_is())$base, "otra")
  # Con una sola base sin nombre, como antes.
  expect_identical(render(el, plan, .rb_ds()$otra, .rb_is()$otra)$data, .rb_ds()$otra)
})

# ---- Preguntas de otra base -----------------------------------------------------------------------------------------

test_that("una fila o cifra de otra base queda fuera con un aviso, en vez de leerse contra la base de la lámina", {
  fuente <- .sig_fuente(.rb_ds()$default, .rb_inst()); fuente$base <- "default"
  caps <- list(list(titulo = "A", filas = list(list(var = "default$q", fila = "Sí", rotulo = "Dice que sí"),
                                               list(var = "otra$t", fila = "Sí", rotulo = "Trabaja"))))
  el <- p_slide_resumen_diferencias(capitulos = caps, cruces = list("area", "niv", "sexo"), rotulos = .rb_rot)$slots$plot
  expect_message(espec <- .resumen_dif_modelo(el, fuente, .rb_sig()), "«Trabaja» es de la base «otra» y la lámina lee la base «default»")
  rot <- unlist(lapply(espec$capitulos, function(c) vapply(c$filas, `[[`, "", "rotulo")))
  expect_true("Dice que sí" %in% rot)
  expect_false("Trabaja" %in% rot)

  caps_h <- list(list(titulo = "A", cifras = list(list(var = "q", fila = "Sí"), list(var = "otra$t", fila = "Sí"))))
  el_h <- p_slide_hallazgos(modo = "resumen", capitulos = caps_h, cruces = list("area", "niv", "sexo"), rotulos = .rb_rot)$slots$plot
  expect_message(m <- .halla_modelo(el_h, fuente, .rb_sig()), "es de la base «otra»")
  expect_identical(vapply(m$kpis, `[[`, "", "var"), "q")
  # Sin base en la fuente (llamadas directas al modelo), nada se filtra: el comportamiento de siempre.
  fuente$base <- NULL
  expect_length(suppressMessages(.halla_modelo(el_h, fuente, .rb_sig()))$kpis, 2L)
})

test_that("en la selección automática, las preguntas del plan de otra base no entran y se dice", {
  fuente <- .sig_fuente(.rb_ds()$otra, .rb_inst()); fuente$base <- "otra"
  plan <- .rb_motor_plan("otra")
  plan[[3]] <- .graficos_rebuild_slide_json(.graficos_calificar_refs_plan(list(slides = list(.rb_grafico("g2", "Pregunta z", "default$z"))), "otra")$slides[[1]])
  el <- p_slide_resumen_diferencias(seleccion = "auto", cruces = list("area", "niv", "sexo"), rotulos = .rb_rot)$slots$plot
  avisos <- character(0)
  espec <- withCallingHandlers(.resumen_dif_modelo(el, fuente, .rb_sig(), plan),
                               message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  aviso <- grep("no entra a la propuesta", avisos, value = TRUE)
  expect_length(aviso, 1L)
  expect_match(aviso, "una pregunta del informe es de la base «default» y no entra a la propuesta, que lee la base «otra»", fixed = TRUE)
  expect_false(grepl("[·;—–]", aviso))
  expect_false("z" %in% unlist(lapply(espec$capitulos, function(c) vapply(c$filas, `[[`, "", "var"))))
})
