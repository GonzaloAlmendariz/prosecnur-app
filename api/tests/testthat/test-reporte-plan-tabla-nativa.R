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

test_that("con el radar al lado la tabla TAMBIEN va nativa, con su sitio", {
  # Este test decia lo contrario: que con radar visible la tabla se quedaba
  # dentro del canvas «porque separarlos rompe la alineacion». Medido sobre el
  # entregable aprobado, ahi hay un CHART nativo y una tabla nativa 7x4 lado a
  # lado, cada uno su forma. Lo que faltaba no era alineacion sino que el
  # graficador dijera DONDE va su tabla.
  p <- graficar_radar(fx_radar(), mostrar_tabla_derecha = TRUE,
                      tabla_nativa = TRUE, usar_canvas = TRUE,
                      exportar = "rplot")
  expect_true(.tabla_nativa_procede(p))

  g <- .tabla_nativa_geom(p, list(left = 1, top = 1, width = 10, height = 5))
  expect_false(is.null(g))
  # La tabla cae en la mitad derecha del cajon, que es donde la pone el radar.
  expect_gt(g$left, 1 + 10 * 0.4)
  expect_lt(g$left + g$width, 1 + 10 + 1e-6)
})

test_that("con `tabla_nativa = FALSE` la tabla se queda dentro del canvas", {
  # La salida sigue disponible para quien la quiera dibujada. Ojo: el default
  # de `tabla_nativa` es TRUE, asi que hay que apagarlo explicitamente —este
  # test se escribio primero al reves y pasaba por el default, no por lo que
  # decia comprobar—.
  p <- graficar_radar(fx_radar(), mostrar_tabla_derecha = TRUE,
                      tabla_nativa = FALSE, usar_canvas = TRUE,
                      exportar = "rplot")
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
