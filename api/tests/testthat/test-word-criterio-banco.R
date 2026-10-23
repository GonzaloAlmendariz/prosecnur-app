source("setup-load-all.R")

# Criterio B de agrupación de figuras del Word (usuario, 2026-10-22): «Variante A pero si hay un solo actor, uno solo que se
# repite varias veces con la misma escala el eje y puede ser la premisa y formar un solo gráfico».
#   C1 misma escala para compartir figura · C2 misma premisa con actores distintos = una figura, fila por actor ·
#   C3 premisas distintas con varios actores = una figura por premisa · C4 un solo actor + misma escala = batería con los
#   enunciados en el eje Y, de hasta 6 barras · C5 título: una premisa lleva su enunciado; la batería, el declarado o ninguno.
# Banco de 14 casos (scratchpad/criterio/CRITERIO_AGRUPACION_WORD.md): docentes n=40, estudiantes n=80, administrativos n=30.

.bc_enun <- c(
  p1 = "Los libros disponibles en la biblioteca son suficientes.",
  p2 = "Los libros de la biblioteca están actualizados.",
  p3 = "Los servicios de la biblioteca son adecuados.",
  p4 = "Los horarios de atención de la biblioteca son convenientes.",
  p5 = "El personal de la biblioteca atiende con amabilidad.",
  p6 = "Los espacios de estudio de la biblioteca son cómodos.",
  p7 = "El acceso a bases de datos digitales es sencillo.",
  a1 = "Estoy satisfecho(a) con el liderazgo de las autoridades.",
  s1 = "Estoy satisfecho(a) con el liderazgo de las autoridades.",
  s2 = "Valoro la gestión de la infraestructura.",
  y1 = "¿Conoce el reglamento de la biblioteca?", y2 = "¿Ha usado el préstamo a domicilio?",
  y3 = "¿Ha usado el catálogo en línea?", y4 = "¿Ha solicitado capacitación de usuarios?"
)
.bc_tipo <- function(n) if (grepl("^p|^a", n)) "acuerdo" else if (grepl("^s", n)) "satisfaccion" else "sino"

.bc_fixture <- local({
  cache <- NULL
  function() {
    if (!is.null(cache)) return(cache)
    ac <- data.frame(list_name = "acuerdo", name = as.character(1:5),
                     label = c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"))
    sa <- data.frame(list_name = "satisfaccion", name = as.character(1:5),
                     label = c("Muy insatisfecho(a)", "Insatisfecho(a)", "Ni satisfecho(a) ni insatisfecho(a)", "Satisfecho(a)", "Muy satisfecho(a)"))
    sn <- data.frame(list_name = "sino", name = c("1", "0"), label = c("Sí", "No"))
    tipos <- vapply(names(.bc_enun), .bc_tipo, "")
    inst1 <- list(survey = data.frame(name = names(.bc_enun), type = paste("select_one", tipos), list_name = tipos,
                                      label = unname(.bc_enun), stringsAsFactors = FALSE),
                  choices = rbind(ac, sa, sn), orders_list = NULL)
    set.seed(7)
    mk <- function(n) as.data.frame(stats::setNames(lapply(names(.bc_enun), function(v) {
      if (.bc_tipo(v) == "sino") as.character(sample(c(1, 0), n, TRUE, c(.6, .4))) else as.character(sample(1:5, n, TRUE))
    }), names(.bc_enun)), stringsAsFactors = FALSE)
    cache <<- list(data = list(docentes = mk(40), estudiantes = mk(80), administrativos = mk(30)),
                   inst = list(docentes = inst1, estudiantes = inst1, administrativos = inst1))
    cache
  }
})

.bc_R <- function(f, p) paste0(f, "$", p)
.bc_vc <- function(vars, tg, ...) p_barras_multiapiladas(modo = "var_cruce", vars = vars, titulos_grupo = tg, titulo = "Gestión institucional", ...)
.bc_vr <- function(refs, ...) p_barras_multiapiladas(modo = "var", vars = refs, titulo = "Gestión institucional", ...)
.bc_E <- function(...) .bc_enun[c(...)]

# Figuras Word del plan de un caso (el mismo camino que `reporte_word_plan`, sin escribir el docx) y los avisos emitidos.
.bc_run <- function(grafico, chart_options = NULL) {
  fx <- .bc_fixture()
  wp <- if (is.null(chart_options)) w_presets() else w_presets(chart_options = chart_options)
  avisos <- character(0)
  meta <- withCallingHandlers(
    suppressWarnings(reporte_ppt_plan(
      data = fx$data, instrumento = fx$inst, plan = list(diapo_001 = p_slide_1_grafico(titulo = "Gestión institucional", grafico = grafico)),
      presets = .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), wp),
      solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta),
    message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  ch <- Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)
  list(charts = ch, avisos = grep("PULSO-AVISO", avisos, value = TRUE),
       filas = vapply(ch, function(m) NROW(attr(m$plot_word, "pulso_espec")$filas), 1L),
       titulos = vapply(ch, function(m) as.character(m$title %||% NA_character_), ""),
       rotulos = lapply(ch, function(m) as.character(attr(m$plot_word, "pulso_espec")$filas$rotulo)))
}
.bc_vacio <- function() .WORD_TITULO_VACIO

test_that("caso 1: una premisa, un actor = una figura con su enunciado (sin prefijo de lámina)", {
  skip_if_not_installed("officer")
  r <- .bc_run(.bc_vr(.bc_R("docentes", "p1")))
  expect_identical(r$filas, 1L)
  expect_identical(r$titulos, unname(.bc_enun[["p1"]]))
})

test_that("casos 2 y 2b: un actor, misma escala = batería con enunciados en el eje Y, sin título ni actor", {
  skip_if_not_installed("officer")
  r2 <- .bc_run(.bc_vr(.bc_R("docentes", c("p1", "p2", "p3"))))
  expect_identical(r2$filas, 3L); expect_identical(r2$titulos, .bc_vacio())
  r2b <- .bc_run(.bc_vc(list(t1 = .bc_R("docentes", "p1"), t2 = .bc_R("docentes", "p2"), t3 = .bc_R("docentes", "p3")), .bc_E("p1", "p2", "p3") |> stats::setNames(c("t1", "t2", "t3"))))
  expect_identical(r2b$filas, 3L); expect_identical(r2b$titulos, .bc_vacio())
  expect_identical(r2b$rotulos[[1]], unname(.bc_E("p1", "p2", "p3")))
  expect_false(any(grepl("Docentes", unlist(r2b$rotulos))))
  # el título declarado manda en la batería
  rt <- .bc_run(.bc_vr(.bc_R("docentes", c("p1", "p2")), word_titulo_figura = "Biblioteca"))
  expect_identical(rt$titulos, "Biblioteca")
})

test_that("caso 3 y 8: escalas distintas = figuras separadas y un aviso que lo dice", {
  skip_if_not_installed("officer")
  r3 <- .bc_run(.bc_vr(.bc_R("docentes", c("p1", "p2", "s2"))))
  expect_identical(r3$filas, c(2L, 1L))
  expect_true(any(grepl("escala", r3$avisos)))
  r8 <- .bc_run(.bc_vc(list(t1 = "docentes$a1", t2 = "docentes$s1"), c(t1 = .bc_enun[["a1"]], t2 = .bc_enun[["s1"]])))
  expect_identical(r8$filas, c(1L, 1L))
  expect_true(any(grepl("escala", r8$avisos)))
  expect_identical(r8$titulos, rep(unname(.bc_enun[["a1"]]), 2))
})

test_that("caso 4: una premisa con dos actores = una figura con una fila por actor y su enunciado", {
  skip_if_not_installed("officer")
  r <- .bc_run(.bc_vc(list(t1 = .bc_R(c("docentes", "estudiantes"), "p1")), c(t1 = .bc_enun[["p1"]])))
  expect_identical(r$filas, 2L); expect_identical(r$rotulos[[1]], c("Docentes", "Estudiantes"))
  expect_identical(r$titulos, unname(.bc_enun[["p1"]]))
})

test_that("casos 5, 6 y 12: premisas distintas con varios actores = una figura por premisa", {
  skip_if_not_installed("officer")
  da <- c("docentes", "estudiantes")
  r5 <- .bc_run(.bc_vc(list(t1 = .bc_R(da, "p1"), t2 = .bc_R(da, "p2")), c(t1 = .bc_enun[["p1"]], t2 = .bc_enun[["p2"]])))
  expect_identical(r5$filas, c(2L, 2L)); expect_identical(r5$titulos, unname(.bc_E("p1", "p2")))
  r6 <- .bc_run(.bc_vc(list(t1 = .bc_R(da, "p1"), t2 = .bc_R(da, "p2"), t3 = .bc_R(da, "p3")),
                        c(t1 = .bc_enun[["p1"]], t2 = .bc_enun[["p2"]], t3 = .bc_enun[["p3"]])))
  expect_identical(r6$filas, c(2L, 2L, 2L)); expect_identical(r6$titulos, unname(.bc_E("p1", "p2", "p3")))
  r12 <- .bc_run(.bc_vc(list(t1 = .bc_R(da, "y1"), t2 = .bc_R(da, "y2")), c(t1 = .bc_enun[["y1"]], t2 = .bc_enun[["y2"]])))
  expect_identical(r12$filas, c(2L, 2L)); expect_identical(r12$titulos, unname(.bc_E("y1", "y2")))
})

test_that("casos 7 y 7b: la misma premisa con actores distintos = una figura con una fila por actor", {
  skip_if_not_installed("officer")
  r7b <- .bc_run(.bc_vc(list(t1 = "estudiantes$a1", t2 = "administrativos$a1"), c(t1 = .bc_enun[["a1"]], t2 = .bc_enun[["a1"]])))
  expect_identical(r7b$filas, 2L); expect_identical(r7b$rotulos[[1]], c("Estudiantes", "Administrativos"))
  expect_identical(r7b$titulos, unname(.bc_enun[["a1"]]))
  # caso 7: dos bloques de una multilista (el bucle de bloques los junta con la partición del PPT)
  ml <- p_barras_multiapiladas(modo = "multilista", titulo = "Gestión institucional", bloques = list(
    list(modo = "var_cruce", vars = list(t1 = "estudiantes$a1"), titulos_grupo = c(t1 = .bc_enun[["a1"]])),
    list(modo = "var_cruce", vars = list(t1 = "administrativos$a1"), titulos_grupo = c(t1 = .bc_enun[["a1"]]))))
  r7 <- .bc_run(ml)
  expect_identical(r7$filas, 2L); expect_identical(r7$rotulos[[1]], c("Estudiantes", "Administrativos"))
  expect_identical(r7$titulos, unname(.bc_enun[["a1"]]))
})

test_that("caso 9: premisas y actores distintos = una figura por premisa", {
  skip_if_not_installed("officer")
  r <- .bc_run(.bc_vc(list(t1 = "docentes$p1", t2 = "estudiantes$p2"), c(t1 = .bc_enun[["p1"]], t2 = .bc_enun[["p2"]])))
  expect_identical(r$filas, c(1L, 1L)); expect_identical(r$titulos, unname(.bc_E("p1", "p2")))
})

test_that("caso 10: siete premisas de un actor = batería en tramos de hasta 6 barras (3 + 4 como el PPT) y aviso de tope", {
  skip_if_not_installed("officer")
  r <- .bc_run(.bc_vr(.bc_R("docentes", paste0("p", 1:7))))
  expect_identical(r$filas, c(3L, 4L))
  expect_identical(unlist(r$rotulos), unname(.bc_enun[paste0("p", 1:7)]))   # ni se reordena ni se omite
  expect_identical(r$titulos, rep(.bc_vacio(), 2))
  # el corte 3 + 4 es el de la lámina del PPT (R0): el aviso del tope lo emite el PPT; el del Word sale cuando corta sin partición
})

test_that("caso 11: batería Sí/No de un actor = una figura con las preguntas en el eje Y", {
  skip_if_not_installed("officer")
  r <- .bc_run(.bc_vr(.bc_R("docentes", paste0("y", 1:4))))
  expect_identical(r$filas, 4L); expect_identical(r$titulos, .bc_vacio())
  expect_identical(r$rotulos[[1]], unname(.bc_enun[paste0("y", 1:4)]))
})

test_that("'automatico' explícito del informe y los modos de slot siguen como antes", {
  skip_if_not_installed("officer")
  antes <- list(multiapiladas_word = "automatico")
  r <- .bc_run(.bc_vc(list(t1 = .bc_R(c("docentes", "estudiantes"), "p1"), t2 = .bc_R(c("docentes", "estudiantes"), "p2")),
                      c(t1 = .bc_enun[["p1"]], t2 = .bc_enun[["p2"]])), antes)
  expect_identical(r$filas, c(2L, 2L))
  expect_identical(r$titulos, paste("Gestión institucional —", .bc_enun[c("p1", "p2")]))
  expect_identical(.bc_run(.bc_vr(.bc_R("docentes", c("p1", "p2", "p3"))), antes)$filas, c(1L, 1L, 1L))
  expect_identical(.bc_run(.bc_vr(.bc_R("docentes", c("p1", "p2", "p3")), word_multiapiladas = "un_grafico"))$filas, 3L)
})

# Base propia de la fila (hallazgo del autor de pruebas): una batería de un actor donde una premisa tiene menos casos que
# las demás anota la N de esa fila en el pie del Word, como el PPT («N = 80»), sin cambiar cifras.
test_that("batería: la fila con menos casos que la base común la anota en el pie («premisa 3: n»)", {
  skip_if_not_installed("officer")
  fx <- .bc_fixture()
  d <- fx$data; d$docentes$p3[1:10] <- NA            # 30 de 40 con respuesta
  meta <- function(refs) {
    m <- suppressWarnings(suppressMessages(reporte_ppt_plan(
      data = d, instrumento = fx$inst, plan = list(diapo_001 = p_slide_1_grafico(titulo = "G", grafico = .bc_vr(refs))),
      presets = .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), w_presets()),
      solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta))
    Filter(function(x) identical(x$kind %||% "chart", "chart"), m)
  }
  ch <- meta(.bc_R("docentes", c("p1", "p2", "p3")))
  expect_length(ch, 1L)
  expect_match(ch[[1]]$base, "premisa 3: 30", fixed = TRUE)
  expect_match(ch[[1]]$base, "^Base: ")
  expect_false(grepl("premisa 1|premisa 2", ch[[1]]$base))
  # sin diferencia, el pie queda como siempre; con una diferencia de 1 caso (tolerancia del PPT) tampoco
  expect_false(grepl("premisa", meta(.bc_R("docentes", c("p1", "p2")))[[1]]$base))
  d$docentes$p3 <- fx$data$docentes$p3; d$docentes$p3[1] <- NA
  expect_false(grepl("premisa", meta(.bc_R("docentes", c("p1", "p2", "p3")))[[1]]$base))
})

test_that(".word_base_filas no toca figuras de varios públicos ni sin espec", {
  expect_identical(.word_base_filas("Base: 10", NULL, list(modo = "var", vars = c("a$x", "b$x"))), "Base: 10")
  expect_null(.word_base_filas(NULL, NULL, list()))
})

test_that("dicotomía del Word: con base chica la leyenda dice los casos («Masculino (4)»); con base grande, limpia", {
  mk <- function(n) list(tipo = "categorica", rotulos = c("Masculino", "Femenino"), cifras = c("40%", "60%"),
                         largos = c(4, 6), valores = c(.4, .6), n_casos = n, n_base_casos = sum(n))
  etiquetas <- function(espec) {
    g <- .word_g_sino_estandar(espec)
    as.character(ggplot2::ggplot_build(g)$plot$scales$get_scales("fill")$get_labels())
  }
  expect_identical(etiquetas(mk(c(4, 6))), c("Masculino (4)", "Femenino (6)"))
  expect_identical(etiquetas(mk(c(40, 60))), c("Masculino", "Femenino"))
})
