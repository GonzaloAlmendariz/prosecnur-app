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
  expect_match(linea, sprintf("^Lámina 1 · “Multilista larga”: las premisas ocupan hasta [0-9]+ líneas?; salió en %d partes$", k))
})

# Verificador de K12b (acrconta, BIENESTAR UNIVERSITARIO): el plan parte la escala por barras
# (`.plan_particionar_escalas`) y el compositor vuelve a partir cada pieza; el aviso contaba sólo la partición del
# compositor y se sumaba el aviso previo «se partió en N». Un solo aviso por lámina lógica, con las láminas reales.
.al_niv4 <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
.al_cruce <- function(largas = TRUE) {
  mk <- function(seed, n) { set.seed(seed); as.data.frame(setNames(lapply(1:7, function(k) sample(.al_niv4, n, TRUE)), sprintf("p%d", 1:7)), stringsAsFactors = FALSE) }
  ins <- function() list(survey = data.frame(name = sprintf("p%d", 1:7), type = "select_one esc", list_name = "esc",
                                             label = if (largas) .al_larga(1:7) else sprintf("Premisa %d", 1:7), stringsAsFactors = FALSE),
                         choices = data.frame(list_name = "esc", name = .al_niv4, label = .al_niv4, stringsAsFactors = FALSE),
                         orders_list = NULL, label_col_survey = "label", label_col_choices = "label", lang = "es")
  vars <- setNames(lapply(1:7, function(k) list(sprintf("docentes$p%d", k), sprintf("estudiantes$p%d", k))), sprintf("t%d", 1:7))
  tg <- setNames(as.list(if (largas) .al_larga(1:7) else sprintf("Premisa %d", 1:7)), sprintf("t%d", 1:7))
  list(data = list(docentes = mk(1, 60), estudiantes = mk(2, 150)), inst = list(docentes = ins(), estudiantes = ins()),
       plan = list(x = p_slide_texto(titulo = "Antes", texto = "Una"), a = p_slide_1_grafico(titulo = "BIENESTAR UNIVERSITARIO",
         grafico = p_barras_multiapiladas(modo = "var_cruce", vars = vars, titulos_grupo = tg, top2box = TRUE, top2box_labels = .al_niv4[3:4]))))
}
.al_mazo <- function(f) {
  out <- tempfile(fileext = ".pptx")
  av <- .al_avisos(suppressWarnings(reporte_ppt_plan(data = f$data, instrumento = f$inst, plan = f$plan, path_ppt = out,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  list(avisos = av, n = length(.pptx_slide_paths(out)) - 1L)                 # menos la lámina de texto
}

test_that("una escala partida por el plan y otra vez por el compositor avisa una vez con las láminas reales", {
  r <- .al_mazo(.al_cruce())
  expect_gt(r$n, 3L)                                                         # 3 piezas del plan, alguna partida otra vez
  sobre <- grep("BIENESTAR", r$avisos, value = TRUE, fixed = TRUE)
  expect_length(sobre, 1L)
  expect_match(sobre, sprintf("^Lámina 2 · “BIENESTAR UNIVERSITARIO”: las premisas ocupan hasta [0-9]+ líneas; salió en %d partes \\(14 barras; el máximo legible por lámina es 7\\)$", r$n))
  expect_false(any(grepl("se partió en", r$avisos, fixed = TRUE)))           # el aviso previo se fusiona
})

test_that("una escala partida sólo por el plan también avisa, con sus piezas", {
  r <- .al_mazo(.al_cruce(largas = FALSE))
  sobre <- grep("BIENESTAR", r$avisos, value = TRUE, fixed = TRUE)
  expect_length(sobre, 1L)
  expect_match(sobre, sprintf("^Lámina 2 · .*salió en %d partes \\(14 barras; el máximo legible por lámina es 7\\)$", r$n))
})

test_that("el Word avisa la partición del plan una vez, con sus figuras", {
  f <- .al_cruce()
  av <- .al_avisos(suppressWarnings(reporte_word_plan(data = f$data, instrumento = f$inst, plan = f$plan, path_docx = tempfile(fileext = ".docx"),
    presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  sobre <- grep("BIENESTAR", av, value = TRUE, fixed = TRUE)
  expect_length(sobre, 1L)
  expect_match(sobre, "Lámina 2 · “BIENESTAR UNIVERSITARIO”: salió en 3 partes (14 barras; el máximo legible por lámina es 7)", fixed = TRUE)
})

test_that("un mazo que falla a mitad no deja el registro tomado: el compositor llamado solo vuelve a avisar", {
  local({ .lam_avisos_paso(list(1, 2), 1L, NULL) })                          # el marco que lo abrió ya no existe
  expect_false(.lam_avisos_activo())
  av <- .al_avisos(.lam_laminas_escala(.al_doc(), .al_espec(11, .al_larga), "Tras un fallo", base = "Base: 51"))
  expect_length(grep("Tras un fallo", av, fixed = TRUE), 1L)
})

# Verificador de K12b: con títulos repetidos los avisos salían idénticos y `.pulso_avisos_de_job` los colapsaba; y con
# muchas particiones el tope de 8 dejaba fuera avisos previos (el del radar). Cada aviso dice su lámina y, en un job,
# los de partición se agrupan si no caben: ningún otro aviso se pierde.
test_that("dos láminas con el mismo título que se parten dan dos avisos distintos, con su número de lámina", {
  f <- .al_cruce(); f$plan$b <- f$plan$a
  r <- .al_mazo(f)
  sobre <- grep("BIENESTAR", r$avisos, value = TRUE, fixed = TRUE)
  expect_length(unique(sobre), 2L)
  expect_match(sobre[1], "^Lámina 2 · ")
  n1 <- as.integer(sub(".*salió en ([0-9]+) partes.*", "\\1", sobre[1]))
  expect_match(sobre[2], sprintf("^Lámina %d · ", 2L + n1))                    # la segunda empieza tras las partes de la primera
})

test_that("un job con muchas particiones conserva todos los demás avisos y agrupa los de partición", {
  sid <- session_create()
  jobs <- file.path(session_get(sid)$dir, "jobs"); dir.create(jobs, recursive = TRUE, showWarnings = FALSE)
  part <- sprintf("Lámina %d · “BIENESTAR UNIVERSITARIO”: las premisas ocupan hasta 2 líneas; salió en 3 partes", c(18, 21, 24, 27, 30, 33, 36, 39, 42))
  tit <- "Lámina 50 · “UN TÍTULO MUY LARGO”: el título ocupa 3 líneas"
  otros <- c("El radar recibió valores de hasta 98.1 declarados como proporción.", "La columna «top2box» se omite.", "Falta un ícono.")
  writeLines(paste(.PULSO_AVISO_SELLO, c(part[1:4], otros[1], part[5:9], tit, otros[2:3])), file.path(jobs, "J.err"))
  av <- .pulso_avisos_de_job(sid, "J")
  expect_identical(av[1:3], otros)                                              # los demás, primero y completos
  expect_true("9 láminas salieron en varias partes: 18, 21, 24, 27, 30, 33, 36, 39, 42." %in% av)
  expect_true("1 título pasa de dos líneas: 50." %in% av)
  expect_length(av, 5L)
  # si caben, van uno por uno, después de los demás
  writeLines(paste(.PULSO_AVISO_SELLO, c(part[1], otros[1], tit)), file.path(jobs, "K.err"))
  expect_identical(.pulso_avisos_de_job(sid, "K"), c(otros[1], part[1], tit))
})

# Verificador de K12b (mutante M12b3): una línea se dice en singular.
test_that("«1 línea» va en singular, dentro y fuera de un mazo", {
  corta <- list(list(list(texto = "Corta")))
  expect_identical(.al_avisos(.lam_aviso_partes("Satisfacción", corta, 2L)), "“Satisfacción”: las premisas ocupan hasta 1 línea; salió en 2 partes")
  expect_identical(.lam_aviso_lineas_txt(1L), "1 línea")
  expect_identical(.lam_aviso_lineas_txt(2L), "2 líneas")
  r <- .al_mazo(.al_cruce(largas = FALSE))
  expect_match(grep("BIENESTAR", r$avisos, value = TRUE, fixed = TRUE), "hasta 1 línea; salió", fixed = TRUE)
})

# Verificador de K12b (2.ª ronda): en el Word el número salía del plan ya partido («Lámina 16/18/20» en acrconta) y en
# el plan del usuario son 16/17/18. Sin archivo, el número es la posición en el plan del usuario: cuenta láminas
# lógicas y no cuenta las «Otros» que inserta el motor.
test_that("en el Word dos láminas partidas por el plan avisan con su número en el plan del usuario", {
  f <- .al_cruce(); f$plan$b <- f$plan$a
  av <- .al_avisos(suppressWarnings(reporte_word_plan(data = f$data, instrumento = f$inst, plan = f$plan, path_docx = tempfile(fileext = ".docx"),
    presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  sobre <- grep("BIENESTAR", av, value = TRUE, fixed = TRUE)
  expect_identical(sub(" · .*$", "", sobre), c("Lámina 2", "Lámina 3"))
})

test_that("sin archivo, las láminas «Otros» que inserta el motor no corren el número", {
  marca <- function(id) list(id = id, barras = 9L, techo = 8L, titulo = "T")
  s <- function(titulo, part = NULL, otros = FALSE) {
    x <- structure(list(title = titulo, meta = if (otros) list(auto_otros = TRUE) else list()), class = c("ppt_slide", "list"))
    if (!is.null(part)) attr(x, "pulso_particion") <- marca(part)
    x
  }
  plan <- list(s("Uno"), s("Otros", otros = TRUE), s("A", "pa"), s("A (cont.)", "pa"), s("B", "pb"), s("B (cont.)", "pb"))
  correr <- function() { for (i in seq_along(plan)) .lam_avisos_paso(plan, i, NULL); .lam_avisos_cierre(plan, NULL) }
  av <- .al_avisos(correr())
  expect_identical(sub(" · .*$", "", av), c("Lámina 2", "Lámina 3"))
})

# Verificador de K12b (mutante M2): en la vista previa el número del aviso sigue al folio real de la lámina (K2).
test_that("en la vista previa el número del aviso suma el desplazamiento de folio", {
  f <- .al_cruce()
  av <- .al_avisos(.preview_con_folio(suppressWarnings(reporte_ppt_plan(data = f$data, instrumento = f$inst, plan = f$plan,
    path_ppt = tempfile(fileext = ".pptx"), presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)), 7L))
  expect_match(grep("BIENESTAR", av, value = TRUE, fixed = TRUE), "^Lámina 8 · ")      # la de texto es la 7
  sin <- .al_avisos(suppressWarnings(reporte_ppt_plan(data = f$data, instrumento = f$inst, plan = f$plan,
    path_ppt = tempfile(fileext = ".pptx"), presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  expect_match(grep("BIENESTAR", sin, value = TRUE, fixed = TRUE), "^Lámina 2 · ")
})

# Verificador de K12b: el registro guardaba el marco de `reporte_ppt_plan` (`e$marco`) y, si el mazo fallaba, retenía
# sus 222 objetos —datos incluidos— hasta el mazo siguiente. El registro no guarda entornos: se cierra solo al salir.
test_that("un mazo que falla no deja entornos retenidos en el registro de avisos", {
  e <- .lam_avisos_estado
  falla <- function() { datos <- data.frame(x = seq_len(1e5)); .lam_avisos_paso(list(1, 2), 1L, NULL); stop("se cayó") }
  expect_error(falla(), "se cayó")
  retenidos <- vapply(ls(e, all.names = TRUE), function(k) is.environment(get(k, envir = e)), logical(1))
  expect_false(any(retenidos))
  expect_false(.lam_avisos_activo())
})

# Verificador de K12b (2.ª ronda, punto 6): `.pulso_avisos_ordenar` agrupaba todo «Lámina N ·» y descartaba en
# silencio los que no eran de partes ni de título. Sólo esos dos se agrupan; cualquier otro va con los demás.
test_that("un aviso «Lámina N ·» que no es de partes ni de título no se pierde al agrupar", {
  part <- sprintf("Lámina %d · “B”: salió en 3 partes", 1:9)
  otro <- "Lámina 5 · “X”: el gráfico se degradó a «Sin datos»"
  av <- .pulso_avisos_ordenar(c(part, otro), 8L)
  expect_true(otro %in% av)
  expect_true("9 láminas salieron en varias partes: 1, 2, 3, 4, 5, 6, 7, 8, 9." %in% av)
})
