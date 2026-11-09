source("setup-load-all.R")

# H4 (Arte, 2026-11-09): la columna de rótulos del contraste tomaba la más angosta que cabía, así que un rótulo que
# entraba en una línea se partía en dos. Regla de la casa (ancho dinámico del rótulo): la columna más ancha que deja el
# área de puntos en su mínimo, sin pasar de lo que piden los rótulos en una línea (`.lam_contraste_ancho_rotulos`).

.lca_espec <- function(rotulos) {
  n <- length(rotulos)
  d <- data.frame(eje = rep(rotulos, 2), grupo = rep(c("Estudiantes", "Docentes"), each = n),
                  valor = c(seq(60, 85, length.out = n), seq(70, 95, length.out = n)), n_casos = rep(c(279, 115), each = n))
  .espec_contraste(d, base_en = "nota")
}
.lca_lineas <- function(ge) vapply(ge$textos, function(t) length(.lam_rotulo_recortar(t, ge$m$wrot, ge$size, 3L)$lineas), 0L)

test_that("rótulos que entran en una línea dentro del ancho disponible van en una línea, aunque pasen de 3.8 in", {
  rot <- c("Las autoridades de Formación General son accesibles para realizar cualquier consulta.",
           "Estoy satisfecho(a) con los canales de comunicación que me ofrece la Unidad.",
           "Servicio de salud", "Servicio de Bienestar Psicológico")
  ge <- .lam_contraste_geom(.lca_espec(rot), titulo = "Contraste de públicos")
  expect_true(ge$cabe)
  expect_gt(ge$m$wrot, 3.8)                      # antes se quedaba en el tope de 3.8 in y partía el primero
  expect_true(all(.lca_lineas(ge) == 1L))
  expect_gte(ge$m$xr - ge$m$xl, 3.5 - 1e-6)      # el área de puntos no baja de su mínimo
})

test_that("con rótulos que no entran en una línea, la columna toma todo el ancho que deja el área de puntos en su mínimo", {
  largo <- paste("Los(as) estudiantes conocen las instancias a donde deben recurrir si tienen un problema académico o",
                 "administrativo en la Facultad y en el Departamento")
  ge <- .lam_contraste_geom(.lca_espec(c(largo, "Servicio de salud")), titulo = "Contraste de públicos")
  expect_true(ge$cabe)
  expect_equal(ge$m$xr - ge$m$xl, 3.5, tolerance = 0.06)
  expect_identical(unname(.lca_lineas(ge)), c(2L, 1L))
})

test_that("con rótulos cortos la columna no crece de más: el área de puntos se queda con el resto", {
  ge <- .lam_contraste_geom(.lca_espec(c("Servicio de salud", "Biblioteca")), titulo = "Contraste de públicos")
  expect_lt(ge$m$wrot, 2.5)
  expect_gt(ge$m$xr - ge$m$xl, 5)
})
