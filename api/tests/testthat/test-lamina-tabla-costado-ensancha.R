# G18 (Gabriela, 2026-10-28): en Arte, las seis competencias genéricas de dos o tres líneas no cabían de alto y la tabla de
# datos se omitía. La columna de criterios se ensancha lo justo para que quepa al costado, sin bajar la letra
# (lamina_tabla_costado.R, `.lam_pesas_tabla_plan`).

.tc_espec <- function(ejes) {
  list(tabla = list(ejes = ejes, grupos = c("Docentes", "Estudiantes"), encabezado = "TOP TWO BOX",
                    cifras = matrix("90%", nrow = length(ejes), ncol = 2)))
}
.TC_EJES <- c("Aprendizaje autónomo y adaptabilidad", "Ética, ciudadanía y conciencia ambiental",
              "Investigación, creación e innovación", "Pensamiento crítico y creativo",
              "Comunicación eficaz: oral, escrita y no verbal", "Habilidades colaborativas")

test_that("seis criterios largos: con la columna de 2,2 in no caben y se omitía; ensanchada lo justo va al costado", {
  skip_if_not_installed("systemfonts")
  e <- .tc_espec(.TC_EJES)
  caja <- .lam_pesas_caja(); min_w <- .LAM_TABLA_COSTADO$min_graf_w + 3.4
  med0 <- .lam_tabla_costado_medidas(.TC_EJES, e$tabla$grupos, "TOP TWO BOX")
  d0 <- .lam_tabla_costado_decidir(6L, med0, caja, min_graf_w = min_w, min_graf_h = 1.35 + 0.45 * 6)
  expect_false(identical(d0$lugar, "costado"))                       # sin ensanchar no cabe al costado
  d <- .lam_pesas_tabla_plan(e)
  expect_identical(d$lugar, "costado")
  c1 <- d$med$ws[1]
  expect_gt(c1, .LAM_TABLA_COSTADO$col1)
  # lo justo: 0,1 in menos ya no cabe, y al gráfico le queda al menos lo que pide
  med_menos <- .lam_tabla_costado_medidas(.TC_EJES, e$tabla$grupos, "TOP TWO BOX",
                                          M = utils::modifyList(.LAM_TABLA_COSTADO, list(col1 = c1 - 0.1)))
  if (c1 - 0.1 > .LAM_TABLA_COSTADO$col1 + 1e-9) {
    expect_false(identical(.lam_tabla_costado_decidir(6L, med_menos, caja, min_graf_w = min_w, min_graf_h = 1.35 + 0.45 * 6,
                                                      M = utils::modifyList(.LAM_TABLA_COSTADO, list(col1 = c1 - 0.1)))$lugar,
                           "costado"))
  }
  expect_gte(d$graf_x1 - caja$x0, min_w - 1e-6)
})

test_that("criterios cortos: la tabla va al costado con la columna de siempre", {
  d <- .lam_pesas_tabla_plan(.tc_espec(c("Creación", "Representación", "Comunicación visual", "Experimentación")))
  expect_identical(d$lugar, "costado")
  expect_equal(d$med$ws[1], .LAM_TABLA_COSTADO$col1)
})
