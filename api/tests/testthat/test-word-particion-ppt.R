source("setup-load-all.R")

# R0 (usuario, 2026-10-22): «el Word debe estar estrechamente conectado a cómo el ppt se configura ahora, en cuántas
# láminas»: la partición del PPT (`.lam_escala_partir` / `.lam_multilista_planear`) es el TOPE de agrupación del Word: una
# figura nunca cruza el corte de una lámina; puede ser más fina. `.word_particion_ppt()` la lee de la espec del plot del PPT
# sin dibujar y devuelve una fila por premisa (bloque, id = grupo_id, texto, parte); NULL si no hay espec utilizable.

.wp_partes <- function(ids, texto = ids, parte, bloque = 1L) {
  data.frame(bloque = bloque, id = ids, texto = texto, parte = as.integer(parte), stringsAsFactors = FALSE)
}
.wp_bloque <- function(n, actor = "docentes") {
  nm <- paste0("t", seq_len(n))
  list(modo = "var_cruce", title_slide = "Gestión",
       vars = stats::setNames(as.list(paste0(actor, "$p", seq_len(n))), nm),
       titulos_grupo = stats::setNames(paste("Enunciado", seq_len(n)), nm))
}
.wp_escala <- function(r) "misma"
.wp_figuras <- function(piezas) vapply(piezas, function(p) length(unlist(p$sub$vars)), 1L)

test_that("sin partición, una batería de 7 premisas de un actor se corta en 3 + 4 (tope de 6 barras)", {
  pz <- .word_multi_piezas(.wp_bloque(7), .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala)
  expect_identical(.wp_figuras(pz), c(3L, 4L))
  expect_identical(.wp_figuras(.word_multi_piezas(.wp_bloque(6), .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala)), 6L)
})

test_that("una batería que pasa de 6 barras sin partición del PPT avisa; separar por escala también", {
  expect_message(.word_multi_piezas(.wp_bloque(7), .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala), "máximo de 6 barras")
  expect_no_message(.word_multi_piezas(.wp_bloque(6), .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala))
  dos_escalas <- function(r) if (grepl("p3$", r)) "otra" else "misma"
  expect_message(.word_multi_piezas(.wp_bloque(3), .WORD_MULTI_MODO_DEFAULT, escala_de = dos_escalas), "no comparten escala")
})

test_that("la partición del PPT es el tope: la batería no cruza el corte de una lámina y puede ser más fina", {
  b <- .wp_bloque(5)
  pt <- .wp_partes(names(b$vars), unname(unlist(b$titulos_grupo)), c(1, 1, 2, 2, 2))
  expect_identical(.wp_figuras(.word_multi_piezas(b, .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala, partes = pt)), c(2L, 3L))
  # más fino: el PPT parte en tres láminas aunque cupieran juntas
  pt3 <- .wp_partes(names(b$vars), unname(unlist(b$titulos_grupo)), c(1, 2, 2, 3, 3))
  expect_identical(.wp_figuras(.word_multi_piezas(b, .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala, partes = pt3)), c(1L, 2L, 2L))
})

test_that("las premisas se emparejan con la partición por id o por texto, no por posición", {
  b <- .wp_bloque(4)
  # la partición llega en otro orden y sólo con texto (var: grupo_id NA)
  pt <- .wp_partes(rep("", 4), paste("Enunciado", c(3, 4, 1, 2)), c(2, 2, 1, 1))
  expect_identical(.wp_figuras(.word_multi_piezas(b, .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala, partes = pt)), c(2L, 2L))
  # una premisa que la partición no conoce: se descarta la partición y rigen las reglas del criterio
  pt_x <- .wp_partes(c("t1", "t2", "t3", "zz"), c("a", "b", "c", "d"), c(1, 1, 2, 2))
  expect_identical(.wp_figuras(.word_multi_piezas(b, .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala, partes = pt_x)), 4L)
})

test_that("la partición no une lo que el PPT separa aunque sea la misma premisa", {
  b <- list(modo = "var_cruce", title_slide = "Gestión",
            vars = list(t1 = "estudiantes$a1", t2 = "administrativos$a1"),
            titulos_grupo = c(t1 = "Liderazgo", t2 = "Liderazgo"))
  junto <- .word_multi_piezas(b, .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala)
  expect_length(junto, 1L)                                  # C2: misma premisa, actores distintos
  expect_identical(unlist(junto[[1]]$sub$vars, use.names = FALSE), c("estudiantes$a1", "administrativos$a1"))
  expect_identical(junto[[1]]$titulo, "Liderazgo")
  pt <- .wp_partes(c("t1", "t2"), c("Liderazgo", "Liderazgo"), c(1, 2))
  expect_length(.word_multi_piezas(b, .WORD_MULTI_MODO_DEFAULT, escala_de = .wp_escala, partes = pt), 2L)
})

test_that("bloques de una multilista que el PPT pone en una misma lámina y comparten premisa se juntan; los demás no", {
  a <- list(modo = "var_cruce", title_slide = "G", vars = list(t1 = "estudiantes$a1"), titulos_grupo = c(t1 = "Liderazgo"))
  b <- list(modo = "var_cruce", title_slide = "G", vars = list(t1 = "administrativos$a1"), titulos_grupo = c(t1 = "Liderazgo"))
  c_ <- list(modo = "var_cruce", title_slide = "G", vars = list(t1 = "docentes$p1"), titulos_grupo = c(t1 = "Otra"))
  pt <- rbind(.wp_partes("t1", "Liderazgo", 1, 1L), .wp_partes("t1", "Liderazgo", 1, 2L), .wp_partes("t1", "Otra", 2, 3L))
  out <- .word_bloques_con_partes(list(a, b, c_), list(), pt)
  expect_length(out, 2L)
  expect_identical(names(out[[1]]$block$vars), c("t1", "t1_2"))
  expect_identical(unname(unlist(out[[1]]$block$vars)), c("estudiantes$a1", "administrativos$a1"))
  expect_identical(out[[1]]$partes$parte, c(1L, 1L))
  expect_identical(out[[2]]$block$vars$t1, "docentes$p1")
  # en láminas distintas del PPT: no se juntan
  pt2 <- rbind(.wp_partes("t1", "Liderazgo", 1, 1L), .wp_partes("t1", "Liderazgo", 2, 2L))
  expect_length(.word_bloques_con_partes(list(a, b), list(), pt2), 2L)
  # sin partición no se juntan (regla de bloques de siempre)
  expect_length(.word_bloques_con_partes(list(a, b), list(), NULL), 2L)
})

.wp_capturar <- function(grafico, n_vars = NULL) {
  fx <- .bc_fixture_wp()
  cap <- new.env(); cap$plots <- list()
  testthat::local_mocked_bindings(
    .word_particion_ppt = function(plot) { cap$plots[[length(cap$plots) + 1L]] <- plot; NULL },
    .package = "prosecnurapp")
  suppressWarnings(suppressMessages(reporte_ppt_plan(
    data = fx$data, instrumento = fx$inst, plan = list(diapo_001 = p_slide_1_grafico(titulo = "G", grafico = grafico)),
    presets = .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), w_presets()),
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)))
  cap$plots[[1]]
}
.bc_fixture_wp <- function() {
  ac <- data.frame(list_name = "acuerdo", name = as.character(1:5),
                   label = c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"))
  nm <- paste0("p", 1:7)
  inst1 <- list(survey = data.frame(name = nm, type = "select_one acuerdo", list_name = "acuerdo",
                                    label = paste("Los libros de la biblioteca número", 1:7, "son adecuados y suficientes para el estudio."),
                                    stringsAsFactors = FALSE), choices = ac, orders_list = NULL)
  set.seed(3)
  mk <- function(n) as.data.frame(stats::setNames(lapply(nm, function(v) as.character(sample(1:5, n, TRUE))), nm), stringsAsFactors = FALSE)
  list(data = list(docentes = mk(40), estudiantes = mk(60), administrativos = mk(30)),
       inst = list(docentes = inst1, estudiantes = inst1, administrativos = inst1))
}

test_that(".word_particion_ppt lee la partición del PPT de la espec: 7 premisas de un actor = 3 + 4", {
  skip_if_not_installed("officer")
  p <- .wp_capturar(p_barras_multiapiladas(modo = "var", vars = paste0("docentes$p", 1:7), titulo = "Biblioteca"))
  pt <- .word_particion_ppt(p)
  expect_s3_class(pt, "data.frame")
  expect_identical(names(pt), c("bloque", "id", "texto", "parte"))
  expect_identical(nrow(pt), 7L)
  expect_identical(as.integer(table(pt$parte)), c(3L, 4L))
  expect_identical(pt$parte, sort(pt$parte))                       # en el orden del plan
  expect_identical(pt$texto, paste("Los libros de la biblioteca número", 1:7, "son adecuados y suficientes para el estudio."))
})

test_that(".word_particion_ppt: un var_cruce trae el grupo_id como id y el enunciado como texto", {
  skip_if_not_installed("officer")
  p <- .wp_capturar(p_barras_multiapiladas(modo = "var_cruce", titulo = "B",
        vars = list(t1 = c("docentes$p1", "estudiantes$p1"), t2 = c("docentes$p2", "estudiantes$p2")),
        titulos_grupo = c(t1 = "Uno", t2 = "Dos")))
  pt <- .word_particion_ppt(p)
  expect_identical(pt$id, c("t1", "t2")); expect_identical(pt$texto, c("Uno", "Dos"))
  expect_true(all(pt$parte >= 1L))
})

test_that(".word_particion_ppt: una multilista trae una fila por premisa de cada bloque con su número de bloque", {
  skip_if_not_installed("officer")
  p <- .wp_capturar(p_barras_multiapiladas(modo = "multilista", titulo = "M", bloques = list(
    list(modo = "var_cruce", vars = list(t1 = "estudiantes$p1"), titulos_grupo = c(t1 = "Liderazgo")),
    list(modo = "var_cruce", vars = list(t1 = "administrativos$p1"), titulos_grupo = c(t1 = "Liderazgo")))))
  pt <- .word_particion_ppt(p)
  expect_identical(pt$bloque, c(1L, 2L)); expect_identical(pt$parte, c(1L, 1L))   # el PPT los pone en una lámina
})

test_that(".word_particion_ppt devuelve NULL sin espec utilizable (no nativo, nulo, otro gráfico)", {
  expect_null(.word_particion_ppt(NULL))
  expect_null(.word_particion_ppt(ggplot2::ggplot()))
  expect_null(.word_particion_ppt("no es un plot"))
})
