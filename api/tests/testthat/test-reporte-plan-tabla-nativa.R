source("setup-load-all.R")

# ADR 0072: una tabla es una tabla y va nativa. La tabla de apoyo del radar se
# dibujaba dentro del canvas de ggplot, como imagen: no se busca, no se copia,
# no se corrige en PowerPoint y no escala con el placeholder. El coste está en
# su propia API —`tabla_padding_mm`, `tabla_auto_fit`, `tabla_fit_pad`,
# `tabla_clip`…—, una veintena de parámetros para resolver a mano lo que un
# motor de tablas resuelve solo.

fx_radar <- function() data.frame(
  eje   = rep(c("Diseño", "Docencia", "Gestión"), 2),
  grupo = rep(c("Docentes", "Egresados"), each = 3),
  valor = c(0.80, 0.62, 0.74, 0.71, 0.68, 0.59),
  stringsAsFactors = FALSE
)

solo_tabla <- function(...) graficar_radar(
  fx_radar(), mostrar_tabla_derecha = TRUE, radar_scale = 0,
  usar_canvas = TRUE, exportar = "rplot", ...
)

test_that("sin radar, la tabla viaja como datos y no como dibujo", {
  p <- solo_tabla()
  expect_true(.tabla_nativa_procede(p))

  tb <- .tabla_nativa_de(p)$tabla
  expect_s3_class(tb, "data.frame")
  expect_equal(nrow(tb), 3L)
  # Encabezado incluido: sus columnas son series y sin sus nombres la rejilla
  # no se lee. Es lo que la distingue de la ficha técnica, que va sin header.
  expect_true(all(c("Docentes", "Egresados") %in% names(tb)))
  expect_equal(as.character(tb[[1]]), c("Diseño", "Docencia", "Gestión"))
})

test_that("el interruptor apaga la emisión, que es el control", {
  # Si `tabla_nativa` no cambiara nada, el test de arriba pasaría igual con la
  # tabla dibujada como siempre.
  expect_false(.tabla_nativa_procede(solo_tabla(tabla_nativa = FALSE)))
})

test_that("con el radar al lado se sigue compartiendo canvas", {
  # Ahí la alineación entre el radar y su tabla es justo lo que se está
  # cuidando, y separarlos la rompería.
  p <- graficar_radar(fx_radar(), mostrar_tabla_derecha = TRUE,
                      usar_canvas = TRUE, exportar = "rplot")
  expect_false(.tabla_nativa_procede(p))
})

test_that("al placeholder llega una tabla, no una imagen", {
  skip_if_not_installed("flextable")
  expect_s3_class(.dml_o_tabla(solo_tabla()), "flextable")
  # Y el control: un gráfico cualquiera sigue yendo como imagen vectorial.
  expect_s3_class(.dml_o_tabla(solo_tabla(tabla_nativa = FALSE)), "dml")
})

test_that("un gráfico sin tabla pasa por el puente sin enterarse", {
  p <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  expect_null(.tabla_nativa_de(p))
  expect_s3_class(.dml_o_tabla(p), "dml")
})

test_that("el renderer ya no escribe imágenes a mano", {
  # Contrato estático: cada `rvg::dml(ggobj = …)` suelto es un placeholder que
  # nunca podrá recibir una tabla nativa.
  src <- readLines(file.path("..", "..", "R", "reporte_plan_ppt.R"), warn = FALSE)
  expect_length(grep("rvg::dml(ggobj = ", src, fixed = TRUE), 0L)
  expect_gt(length(grep(".dml_o_tabla(", src, fixed = TRUE)), 20L)
})
