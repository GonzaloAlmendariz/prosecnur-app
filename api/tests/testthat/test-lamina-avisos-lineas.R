source("setup-load-all.R")

# K12b (dirección F6 §4.3c): cuando el motor parte una lámina en «(cont.)» o un título pasa de dos líneas, el analista
# lo sabe con el conteo de líneas que lo causó, una vez por lámina, por el canal sellado `[PULSO-AVISO]`.

.al_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.al_espec <- function(n_filas, rotulo = function(k) sprintf("Competencia %d", k)) {
  set.seed(n_filas)
  d <- do.call(rbind, lapply(seq_len(n_filas), function(k) {
    c3 <- sample(10:25, 1); c4 <- 51 - c3 - sample(0:2, 1); resto <- 51 - c3 - c4
    data.frame(item = sprintf("p%02d", k), rotulo = rotulo(k), N = 51, t1 = 0, t2 = resto, t3 = c3, t4 = c4, t5 = 0)
  }))
  d[paste0("t", 1:5)] <- d[paste0("t", 1:5)] / d$N
  preparar_escala(d, "item", "N", paste0("t", 1:5), .al_niv, var_etiqueta_categoria = "rotulo",
                  colores_grupos = as.list(setNames(.std_paleta("likert"), .al_niv)),
                  barra_extra_preset = "top2box", top2box_labels = .al_niv[3:4])
}
.al_larga <- function(k) sprintf("El docente número %d explica con claridad los objetivos de aprendizaje de cada sesión y los relaciona con el perfil de egreso de la carrera", k)
.al_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

.al_avisos <- function(expr) {
  out <- character()
  withCallingHandlers(expr, message = function(m) {
    t <- conditionMessage(m)
    if (grepl(.PULSO_AVISO_SELLO, t, fixed = TRUE)) out <<- c(out, trimws(sub(".*\\[PULSO-AVISO\\]", "", t)))
    invokeRestart("muffleMessage")
  })
  out
}

test_that("una escala que se parte avisa una vez con las líneas de su premisa más alta y el número de partes", {
  e <- .al_espec(11, .al_larga)
  o <- NULL
  av <- .al_avisos(o <- .lam_laminas_escala(.al_doc(), e, "Desempeño docente", base = "Base: 51"))
  expect_gt(o$partes, 1L)
  premisas <- .lam_escala_premisas(e)
  n <- max(.lam_lineas_tinta(vapply(premisas, `[[`, "", "texto"), .lam_escala_ancho_prem(premisas), .std_pt("pregunta"), TRUE))
  expect_gte(n, 2L)
  esperado <- sprintf("“Desempeño docente”: las premisas ocupan hasta %d líneas; salió en %d partes", n, o$partes)
  expect_identical(av, esperado)
})

test_that("una escala que cabe en una lámina no avisa", {
  expect_identical(.al_avisos(.lam_laminas_escala(.al_doc(), .al_espec(4), "Competencias", base = "Base: 51")), character())
})

test_that("un título de más de dos líneas avisa una sola vez aunque la lámina salga en varias partes", {
  largo <- paste("Valoración de los estudiantes sobre el desempeño de los docentes del programa en las competencias",
                 "declaradas en el perfil de egreso y en los objetivos educacionales de la carrera profesional")
  n <- .lam_lineas_tinta(largo, 10.4, .std_pt("titulo"), TRUE)
  expect_gt(n, 2L)
  o <- NULL
  av <- .al_avisos(o <- .lam_laminas_escala(.al_doc(), .al_espec(11, .al_larga), largo, base = "Base: 51"))
  expect_gt(o$partes, 1L)
  expect_identical(sum(grepl("el título ocupa", av, fixed = TRUE)), 1L)
  expect_true(sprintf("“%s”: el título ocupa %d líneas", largo, n) %in% av)
  expect_identical(sum(grepl("las premisas ocupan", av, fixed = TRUE)), 1L)
})

test_that("un título de dos líneas no avisa", {
  dos <- "Valoración de los estudiantes sobre el desempeño de los docentes del programa de estudios"
  expect_identical(.lam_lineas_tinta(dos, 10.4, .std_pt("titulo"), TRUE), 2L)
  doc <- officer::add_slide(.al_doc(), layout = "Graficos2", master = "Office Theme")
  expect_identical(.al_avisos(.lam_titulo(doc, dos)), character())
})

test_that("una multilista que se parte avisa una vez con sus partes", {
  niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
  vars <- sprintf("v%02d", 1:12)
  set.seed(2)
  df <- as.data.frame(setNames(lapply(vars, function(v) sample(niv, 120, TRUE)), vars), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = vars, type = "select_one esc", list_name = "esc", label = .al_larga(1:12), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "esc", name = niv, label = niv, stringsAsFactors = FALSE),
               orders_list = NULL, label_col_survey = "label", label_col_choices = "label", lang = "es")
  plan <- list(a = p_slide_1_grafico(titulo = "Multilista larga", grafico = p_barras_multiapiladas(
    modo = "multilista", top2box = TRUE, top2box_labels = niv[3:4],
    bloques = list(list(modo = "var", vars = vars[1:6], titulo = "Uno"), list(modo = "var", vars = vars[7:12], titulo = "Dos")))))
  out <- tempfile(fileext = ".pptx")
  av <- .al_avisos(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  k <- length(.pptx_slide_paths(out))
  expect_gt(k, 1L)
  linea <- grep("las premisas ocupan", av, value = TRUE, fixed = TRUE)
  expect_length(linea, 1L)
  expect_match(linea, sprintf("^“Multilista larga”: las premisas ocupan hasta [0-9]+ líneas?; salió en %d partes$", k))
})
