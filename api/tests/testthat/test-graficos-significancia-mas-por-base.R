# Decisión del lead (ADR 0138 «Conglomerado», ADR 0128 «Familia por base»): en un estudio multibase con una regla
# Rao-Scott, la base que no trae la columna de conglomerado se prueba como muestreo aleatorio simple en TODOS los
# consumidores de la regla —serie por niveles, línea por nivel, tarjetas de diferencias (ADR 0129) y entre públicos
# (ADR 0138), tablas de cruces— y su nota lo dice con la misma línea del pie de la lámina. Con una sola base, nada cambia.

.mpb_regla <- function() {
  r <- .sig_regla_fabrica()
  r$prueba <- "rao_scott"; r$correccion <- "bh_informe"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  r
}
.mpb_linea <- "En Docentes no hay conglomerado: se prueba como muestreo aleatorio simple."
.mpb_plano <- function(x) gsub("\\s+", " ", gsub("​", "", paste(as.character(x), collapse = " ")))
# El contexto que fija el worker del export: multibase (`base_familia`: docentes es la activa, la de las láminas) o una
# sola base (sin ella).
.mpb_con_contexto <- function(multibase, codigo) {
  ctx <- list(regla = .mpb_regla(), origen = "estudio", familia = NULL, m = 0L)
  if (multibase) ctx$base_familia <- "docentes"
  previa <- options(prosecnur.sig_informe = ctx)
  on.exit(options(previa))
  force(codigo)
}

# ---- Serie por niveles ----------------------------------------------------------------------------------------------

.mpb_serie_inst <- function() list(
  survey = data.frame(name = c("niv", "t"), type = c("select_one nv", "select_one sn"), list_name = c("nv", "sn"),
                      label = c("Nivel", "Trabaja"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("nv", "nv", "nv", "sn", "sn"), name = c("6", "7", "8", "1", "2"),
                       label = c("VI", "VII", "VIII", "Sí", "No"), stringsAsFactors = FALSE),
  orders_list = list(niv = list(names = c("6", "7", "8"), labels = c("VI", "VII", "VIII"), label = "Nivel"),
                     t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Trabaja")))
.mpb_serie_dat <- function() data.frame(
  niv = rep(c("6", "7", "8"), each = 40),
  t = c(rep("1", 4), rep("2", 36), rep("1", 20), rep("2", 20), rep("1", 36), rep("2", 4)), stringsAsFactors = FALSE)
.mpb_serie_src <- function(multibase) {
  ds <- list(docentes = .mpb_serie_dat())
  if (multibase) { e <- .mpb_serie_dat(); e$aula <- rep(sprintf("a%02d", 1:12), each = 10); ds$estudiantes <- e }
  list(data_sources = ds, inst_sources = stats::setNames(rep(list(.mpb_serie_inst()), length(ds)), names(ds)))
}

test_that("serie por niveles: la base sin conglomerado marca como MAS y la nota lo dice; con una sola base se abstiene", {
  el <- p_serie_temporal(vars = list(Trabaja = "docentes$t"), corte = "1", cruce = "docentes$niv", mostrar_significancia = TRUE)
  p <- .mpb_con_contexto(TRUE, .render_serie_cruce(el, .mpb_serie_src(TRUE)))
  nota <- .mpb_plano(attr(p, "pulso_sig_nota"))
  expect_false(grepl("No se marcan diferencias", nota))
  expect_match(nota, .mpb_linea, fixed = TRUE)
  # Una sola base: igual que antes, se abstiene por la columna que falta.
  p1 <- .mpb_con_contexto(FALSE, .render_serie_cruce(el, .mpb_serie_src(FALSE)))
  expect_match(.mpb_plano(attr(p1, "pulso_sig_nota")), "No se marcan diferencias", fixed = TRUE)
})

# ---- Línea por nivel ------------------------------------------------------------------------------------------------

.mpb_ln_inst <- function() list(
  survey = data.frame(name = c("niv", "t"), type = c("select_one nv", "select_one sn"), list_name = c("nv", "sn"),
                      label = c("Nivel", "¿Trabajas?"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("nv", 4), "sn", "sn"), name = c("6", "7", "8", "9", "1", "2"),
                       label = c("Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9", "Sí", "No"), stringsAsFactors = FALSE),
  orders_list = list(niv = list(names = c("6", "7", "8", "9"), labels = c("Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9"), label = "Nivel"),
                     t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "¿Trabajas?")))
.mpb_ln_dat <- function() {
  si <- c(`6` = 20L, `7` = 30L, `8` = 35L, `9` = 70L)
  do.call(rbind, lapply(names(si), function(nv) data.frame(niv = nv, t = c(rep("1", si[[nv]]), rep("2", 100 - si[[nv]])),
                                                            stringsAsFactors = FALSE)))
}
.mpb_ln_src <- function(multibase) {
  ds <- list(docentes = .mpb_ln_dat())
  if (multibase) { e <- .mpb_ln_dat(); e$aula <- rep(sprintf("a%02d", 1:40), each = 10); ds$estudiantes <- e }
  list(data_sources = ds, inst_sources = stats::setNames(rep(list(.mpb_ln_inst()), length(ds)), names(ds)))
}
.mpb_ln_el <- function() p_lineas_nivel(var = "docentes$t", cruce = "niv", series = list(list(rotulo = "Trabaja", codigos = "1")),
                                        titulo_seccion = "Según nivel", rotulo_total = "Total", publico = "docentes",
                                        mostrar_significancia = TRUE)

test_that("línea por nivel: la base sin conglomerado no se abstiene en multibase; con una sola base, sí", {
  msgs <- testthat::capture_messages(.mpb_con_contexto(TRUE, .lineas_nivel_render_fuentes(.mpb_ln_el(), .mpb_ln_src(TRUE))))
  expect_false(any(grepl("no se marcan diferencias", msgs)))
  msgs1 <- testthat::capture_messages(.mpb_con_contexto(FALSE, .lineas_nivel_render_fuentes(.mpb_ln_el(), .mpb_ln_src(FALSE))))
  expect_true(any(grepl("no se marcan diferencias", msgs1)))
})

# ---- Tarjetas de diferencias (ADR 0129) -----------------------------------------------------------------------------

.mpb_tj_dat <- function() {
  set.seed(129)
  area <- rep(c("1", "2"), each = 200)
  q <- ifelse(stats::runif(400) < ifelse(area == "1", 0.75, 0.2), "1", "2")
  data.frame(area = area, q = q, stringsAsFactors = FALSE)
}
.mpb_tarjetas <- function(multibase) {
  d <- .mpb_tj_dat()
  resolver <- function(ref, ...) list(source = "docentes", data = d, survey = NULL, choices = NULL, orders_list = NULL,
                                      var = "q")
  p <- structure(list(), class = "ggplot")
  attr(p, "pulso_espec") <- list(tipo = "categorica")
  slide <- list(title = "Q", meta = list(tarjetas_diferencias = list(cruces = list("area"))),
                slots = list(plot = list(vars = "docentes$q")))
  avisos <- character(0)
  r <- withCallingHandlers(.mpb_con_contexto(multibase, .tarjetas_de_lamina(p, slide, resolver)),
                           message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  list(r = r, avisos = avisos)
}

test_that("tarjetas ADR 0129: la base sin conglomerado se compara en multibase; con una sola base, se abstiene", {
  x <- .mpb_tarjetas(TRUE)
  expect_false(is.null(x$r))
  expect_gt(x$r$total, 0L)
  x1 <- .mpb_tarjetas(FALSE)
  expect_null(x1$r)
})

# ---- Tarjetas entre públicos (ADR 0138) -----------------------------------------------------------------------------

test_that("tarjetas entre públicos: el público sin conglomerado lo dice en el pie con la misma línea", {
  inst <- list(survey = data.frame(name = "p1", type = "select_one lk", label = "P1", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4"), label = c("A", "B", "C", "D"),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  col <- function(x, n) c(rep(c("3", "4"), length.out = x), rep(c("1", "2"), length.out = n - x))
  est <- data.frame(p1 = col(150, 300), aula = rep(sprintf("a%02d", 1:30), each = 10), stringsAsFactors = FALSE)
  doc <- data.frame(p1 = col(90, 120), stringsAsFactors = FALSE)
  src <- list(data_sources = list(docentes = doc, estudiantes = est), inst_sources = list(docentes = inst, estudiantes = inst))
  vars <- list(t = c("docentes$p1", "estudiantes$p1"))
  r <- .tpub_calcular(.tpub_temas_declarados(vars, vars, NULL), "3,4", src, .mpb_regla(),
                      .tpub_opcion(list(tarjetas_diferencias = list(entre_publicos = TRUE))))
  expect_identical(.tpub_tema_estado <- r$temas[[1]]$estado, "evaluable")
  expect_match(.mpb_plano(r$nota), .mpb_linea, fixed = TRUE)
  expect_false(grepl("Estudiantes no hay conglomerado", .mpb_plano(r$nota)))
})

# ---- Tablas de cruces -----------------------------------------------------------------------------------------------

test_that("tablas de cruces: la nota del método dice la verdad para cada base", {
  set.seed(3)
  doc <- data.frame(g = rep(c("a", "b"), each = 60), p = sample(c("1", "2"), 120, TRUE), stringsAsFactors = FALSE)
  est <- doc; est$aula <- rep(sprintf("a%02d", 1:12), each = 10)
  nota_de <- function(d) {
    tab <- .cruces_comparar_con_regla(d, "p", c("1", "2"), c("1", "2"), c("a", "b"), "g", "so", "peso", .mpb_regla())
    .mpb_plano(.cruces_nota_regla(tab$regla))
  }
  ctx <- list(regla = .mpb_regla(), origen = "estudio", familia = NULL, m = 0L, base_familia = "docentes")
  previa <- options(prosecnur.sig_informe = ctx); on.exit(options(previa), add = TRUE)
  n_doc <- nota_de(doc)
  expect_match(n_doc, .mpb_linea, fixed = TRUE)
  expect_false(grepl("Rao-Scott por aula", n_doc, fixed = TRUE))
  ctx$base_familia <- "estudiantes"; options(prosecnur.sig_informe = ctx)
  n_est <- nota_de(est)
  expect_match(n_est, "Rao-Scott por aula", fixed = TRUE)
  expect_false(grepl("no hay conglomerado", n_est, fixed = TRUE))
  # Sin la marca (una sola base, o la base con conglomerado): las notas de siempre, bit a bit (capturadas antes del cambio).
  expect_identical(.cruces_nota_regla(.mpb_regla()), paste0(
    "Las letras comparan las columnas de una misma variable de cruce: la letra marca la columna superada, con diferencia ",
    "significativa y de al menos 10 puntos. En minúscula, frágil (p ajustado entre 0.01 y 0.05). \".b\" indica una ",
    "columna con menos de 30 casos o de 8 aulas, que no se compara. Rao-Scott por aula, p < 0.05 con corrección de ",
    "Benjamini-Hochberg."))
  expect_identical(.sig_texto_linea_marcas(.mpb_regla(), TRUE), paste0(
    "▲A  Mayor que el grupo de esa letra: diferencia significativa y de al menos 10 puntos. △A  Frágil: igual, con p ",
    "ajustado entre 0.01 y 0.05. Rao-Scott por aula, p < 0.05 con corrección de Benjamini-Hochberg."))
})

# ---- La familia de SU base (ADR 0128 «Familia por base») en la serie, la línea por nivel y las tarjetas ----------------

.mpb_fam_ds <- function() {
  est <- .mpb_serie_dat()
  est$e <- c(rep(c("1", "2"), c(15, 25)), rep(c("1", "2"), c(20, 20)), rep(c("1", "2"), c(26, 14)))
  set.seed(11)
  doc <- data.frame(niv = sample(c("6", "7", "8"), 90, TRUE), t = sample(c("1", "2"), 90, TRUE),
                    e = sample(c("1", "2"), 90, TRUE), stringsAsFactors = FALSE)
  list(docentes = doc, estudiantes = est)
}
.mpb_fam_inst <- function() {
  i <- .mpb_serie_inst()
  i$survey <- rbind(i$survey, data.frame(name = "e", type = "select_one sn", list_name = "sn", label = "Experiencia"))
  i$orders_list$e <- list(names = c("1", "2"), labels = c("Sí", "No"), label = "Experiencia")
  i
}
.mpb_lam <- function(id, var, cruce) list(id = id, payload = list(list(graficador = "p_barras_agrupadas",
                                                                      args = list(var = var, cruces = cruce))))
.mpb_z_bh <- list(prueba = "z", correccion = "bh_informe", umbral_puntos = 0, base_minima = 20)
.mpb_preparar <- function(ds, is, plan) {
  .sig_informe_preparar(list(equivalencias_publicos = NULL, graficos_config = list(significancia = .mpb_z_bh, plan = plan),
                             analitica_config = list(cruces_vars = list(), secciones = list(), cruces = list(cruces_vars = list()))),
                        ds, is, "docentes")
}
# Captura la evaluación con veredictos que produce `.sig_veredictos` dentro de `codigo`.
.mpb_capturar_veredictos <- function(codigo) {
  capt <- list()
  orig <- .sig_veredictos
  testthat::local_mocked_bindings(.sig_veredictos = function(ev, regla, familia = NULL, exigir_familia = FALSE) {
    out <- orig(ev, regla, familia, exigir_familia)
    capt[[length(capt) + 1L]] <<- out
    out
  })
  force(codigo)
  capt
}

test_that("serie de una base no activa con bh_informe: p ajustado = p.adjust sobre la familia de SU base", {
  ds <- .mpb_fam_ds(); is <- list(docentes = .mpb_fam_inst(), estudiantes = .mpb_fam_inst())
  plan <- list(slides = list(.mpb_lam("t", "estudiantes$t", "estudiantes$niv"), .mpb_lam("e", "estudiantes$e", "estudiantes$niv"),
                             .mpb_lam("d", "p3", "niv")))
  previa <- suppressMessages(.mpb_preparar(ds, is, plan))
  on.exit(options(previa), add = TRUE)
  regla <- .sig_regla_normalizar(.mpb_z_bh)
  f <- .sig_fuente(ds$estudiantes, is$estudiantes)
  p_fam <- unlist(lapply(c("t", "e"), function(v) .sig_p_para_familia(.sig_evaluar_pregunta(f, v, "niv", regla))))
  expect_identical(getOption("prosecnur.sig_informe")$familias$estudiantes$m, length(p_fam))
  src <- list(data_sources = ds, inst_sources = is)
  el <- p_serie_temporal(vars = list(Trabaja = "estudiantes$t"), corte = "1", cruce = "estudiantes$niv", mostrar_significancia = TRUE)
  capt <- .mpb_capturar_veredictos(.render_serie_cruce(el, src))
  expect_length(capt, 1L)
  pr <- capt[[1]]$pares
  expect_equal(pr$p_ajustado[pr$elegible], stats::p.adjust(p_fam, "BH")[match(pr$p[pr$elegible], p_fam)])
})

test_that("línea por nivel y tarjetas ADR 0129: la familia con que se marca es la de su base", {
  ds <- .mpb_fam_ds(); is <- list(docentes = .mpb_fam_inst(), estudiantes = .mpb_fam_inst())
  plan <- list(slides = list(.mpb_lam("t", "estudiantes$t", "estudiantes$niv"), .mpb_lam("d", "p3", "niv")))
  previa <- suppressMessages(.mpb_preparar(ds, is, plan))
  on.exit(options(previa), add = TRUE)
  fam_est <- getOption("prosecnur.sig_informe")$familias$estudiantes$familia
  src <- list(data_sources = ds, inst_sources = is)
  el <- p_lineas_nivel(var = "estudiantes$t", cruce = "niv", series = list(list(rotulo = "Trabaja", codigos = "1")),
                       titulo_seccion = "Según nivel", rotulo_total = "Total", publico = "estudiantes", mostrar_significancia = TRUE)
  fams <- list()
  orig <- .sig_veredictos
  testthat::local_mocked_bindings(.sig_veredictos = function(ev, regla, familia = NULL, exigir_familia = FALSE) {
    fams[[length(fams) + 1L]] <<- familia
    orig(ev, regla, familia, exigir_familia)
  })
  suppressMessages(.lineas_nivel_render_fuentes(el, src))
  expect_identical(fams[[1]], fam_est)
  # Tarjetas: la base del resolutor es estudiantes.
  d <- ds$estudiantes
  resolver <- function(ref, ...) list(source = "estudiantes", data = d, survey = is$estudiantes$survey,
                                      choices = is$estudiantes$choices, orders_list = is$estudiantes$orders_list, var = "t")
  p <- structure(list(), class = "ggplot"); attr(p, "pulso_espec") <- list(tipo = "categorica")
  slide <- list(title = "T", meta = list(tarjetas_diferencias = list(cruces = list("niv"))),
                slots = list(plot = list(vars = "estudiantes$t")))
  fams <- list()
  suppressMessages(.tarjetas_de_lamina(p, slide, resolver))
  expect_true(length(fams) >= 1L)
  expect_identical(fams[[1]], fam_est)
})

test_that("hallazgos, resumen, cifra y propuesta: la nota nombra la base sin conglomerado", {
  ctx <- list(regla = .mpb_regla(), origen = "estudio", familia = NULL, m = 0L, base_familia = "estudiantes")
  previa <- options(prosecnur.sig_informe = ctx); on.exit(options(previa), add = TRUE)
  r <- .sig_contexto_render(.mpb_serie_dat(), "docentes")$regla
  expect_identical(.sig_texto_sin_conglomerado(r), .mpb_linea)
  # Cada consumidor pasa su base: se comprueba en el código, porque los cuatro arman su fuente dentro del motor.
  for (f in c("graficos_hallazgos.R", "graficos_resumen_diferencias.R", "lamina_cifra_y_grafico.R", "graficos_propuesta_resumen.R")) {
    src <- readLines(testthat::test_path("..", "..", "R", f), warn = FALSE)
    llamadas <- grep(".sig_contexto_render(", src, fixed = TRUE, value = TRUE)
    llamadas <- llamadas[!grepl("^\\s*#", llamadas)]
    expect_true(length(llamadas) > 0L, label = f)
    expect_true(all(grepl("\\.sig_contexto_render\\([^,()]+(\\([^()]*\\))?[^,()]*,", llamadas)), label = paste(f, "pasa la base"))
  }
})
