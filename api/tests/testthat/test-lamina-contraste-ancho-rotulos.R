source("setup-load-all.R")

# H4 (Arte, 2026-11-09) y S5 (Gonzalo, 2026-11-09: «sobreestimas el tamaño de las etiquetas del eje, y demasiado»): la
# columna de rótulos del contraste mide lo que piden sus rótulos con la tinta real: en una línea los de largo común
# (hasta 1.5 veces la mediana); el largo se parte en hasta cuatro y el área de puntos se queda con el resto
# (`.lam_rotulos_columna`, lamina_rotulos_columna.R).

.lca_espec <- function(rotulos) {
  n <- length(rotulos)
  d <- data.frame(eje = rep(rotulos, 2), grupo = rep(c("Estudiantes", "Docentes"), each = n),
                  valor = c(seq(60, 85, length.out = n), seq(70, 95, length.out = n)), n_casos = rep(c(279, 115), each = n))
  .espec_contraste(d, base_en = "nota")
}
.lca_lineas <- function(ge) vapply(ge$textos, .lam_rotulo_lineas, 0L, w = ge$m$wrot, size = ge$size)

test_that("rótulos de largo común van en una línea, aunque pasen de 3.8 in", {
  rot <- c("Las autoridades de Formación General son accesibles para realizar cualquier consulta.",
           "Estoy satisfecho(a) con los canales de comunicación que me ofrece la Unidad.",
           "Las autoridades de la Unidad son accesibles para realizar cualquier consulta.", "Servicio de Bienestar Psicológico y salud")
  ge <- .lam_contraste_geom(.lca_espec(rot), titulo = "Contraste de públicos")
  expect_true(ge$cabe)
  expect_gt(ge$m$wrot, 3.8)                      # antes se quedaba en el tope de 3.8 in y partía el primero
  expect_true(all(.lca_lineas(ge) == 1L))
  expect_gte(ge$m$xr - ge$m$xl, 3.5 - 1e-6)      # el área de puntos no baja de su mínimo
})

test_that("un rótulo largo se parte en hasta cuatro líneas y el área de puntos se queda con el resto", {
  largo <- paste("Los(as) estudiantes conocen las instancias a donde deben recurrir si tienen un problema académico o",
                 "administrativo en la Facultad y en el Departamento")
  ge <- .lam_contraste_geom(.lca_espec(c(largo, "Servicio de salud")), titulo = "Contraste de públicos")
  expect_true(ge$cabe)
  expect_gt(ge$m$xr - ge$m$xl, 5)
  l <- unname(.lca_lineas(ge))
  expect_identical(l[2], 1L)
  expect_true(l[1] >= 2L && l[1] <= 4L)
  expect_false(any(grepl("…", ge$textos, fixed = TRUE)))
})

test_that("con rótulos cortos la columna no crece de más: el área de puntos se queda con el resto", {
  ge <- .lam_contraste_geom(.lca_espec(c("Servicio de salud", "Biblioteca")), titulo = "Contraste de públicos")
  expect_lt(ge$m$wrot, 2.5)
  expect_gt(ge$m$xr - ge$m$xl, 5)
})
