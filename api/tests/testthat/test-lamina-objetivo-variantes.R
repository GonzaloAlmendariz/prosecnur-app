# G6 (Gonzalo, 2026-10-13): las tres versiones del objetivo del recetario (26 clásica, 27 panel, 28 dimensiones), con los
# actores consultados.

.ov_mazo <- function(plan) {
  df <- data.frame(p = rep(c("a", "b"), 10))
  inst <- list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
               choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}
.ov_txt <- function(x, n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.ov_hay <- function(x, n) length(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))) > 0L

test_that("la meta elige la variante y lo desconocido cae en la clásica", {
  expect_identical(.lam_objetivo_args(list(variante = "panel"))$variante, "panel")
  expect_identical(.lam_objetivo_args(list(variante = "dimensiones", dimensiones = c("A", "", "B")))$dimensiones, c("A", "B"))
  expect_identical(.lam_objetivo_args(c("Estudiantes", "Docentes"))$variante, "clasica")
  expect_identical(.lam_objetivo_variante("rara"), "clasica")
})

test_that("panel (27) y dimensiones (28) dibujan lo suyo con sus actores", {
  skip_if_not_installed("officer")
  actores <- c("Estudiantes", "Docentes", "Egresados", "Personal administrativo")
  objetivo <- "Conocer la percepción sobre **los propósitos de la carrera** y su **perfil de egreso**."
  lam <- .ov_mazo(list(
    p_slide_objetivo_icono(.graficos_rebuild_icon(.lam_icono_ruta("diana-flecha", "coral")), objetivo, meta = list(variante = "panel", actores = actores)),
    p_slide_objetivo_icono(.graficos_rebuild_icon(.lam_icono_ruta("diana-flecha", "coral")), "", meta = list(variante = "dimensiones", actores = actores,
                                                  dimensiones = c("Los propósitos de la carrera", "El perfil de egreso", "El plan de estudios")))
  ))
  expect_true(.ov_hay(lam[[1]], "objetivo:panel"))
  expect_identical(.ov_txt(lam[[1]], "objetivo:actor"), actores)
  expect_identical(.ov_txt(lam[[2]], "objetivo:dimension"), c("Los propósitos de la carrera", "El perfil de egreso", "El plan de estudios"))
  expect_identical(.ov_txt(lam[[2]], "objetivo:actores_rotulo"), "a partir de la opinión de")
  expect_identical(.ov_txt(lam[[2]], "objetivo:actor"), actores)
})

test_that("cada actor puede llevar el ícono que elige el analista; vacío o desconocido, el automático", {
  # Gonzalo (2026-10-13): «¿por qué no me deja escoger el ícono para cada uno?». `actores_iconos` va alineado con
  # `actores`; una fila vacía se descarta con su ícono, para que el resto no se corra de lugar.
  a <- .lam_objetivo_args(list(actores = c("Estudiantes", "", "Docentes", "Egresados"),
                               actores_iconos = c("book-open", "camera", "", "no-existe")))
  expect_identical(a$actores, c("Estudiantes", "Docentes", "Egresados"))
  expect_identical(a$iconos, c("book-open", "", "no-existe"))
  expect_identical(.lam_icono_actor("Estudiantes", "book-open"), "book-open")
  expect_identical(.lam_icono_actor("Docentes", ""), .lam_icono_actor("Docentes"))
  expect_identical(.lam_icono_actor("Egresados", "no-existe"), .lam_icono_actor("Egresados"))
  # Sin `actores_iconos` (proyectos guardados antes): todos automáticos.
  expect_identical(.lam_objetivo_args(list(actores = c("A", "B")))$iconos, c("", ""))
  expect_identical(.lam_objetivo_args(c("A", "B"))$iconos, c("", ""))
})
