source("setup-load-all.R")

# Las láminas de población llevaban UNA base al pie y los cuatro gráficos
# compartían ese denominador aunque no fuera el suyo. Medido en «Conta 11-08»,
# lámina 10: la línea decía «Base: 178 egresados» y el gráfico de sueldo tiene
# 167 respuestas válidas. El lector no tenía forma de saberlo.

el_falso <- function(overrides = list()) {
  structure(list(.element_type = "barras", overrides = overrides),
            class = c("ppt_element", "list"))
}

test_that("la base del elemento se convierte en su nota al pie", {
  el <- .base_por_grafico_inyectar(el_falso(), "Base: 167 egresados")
  expect_equal(el$overrides$nota_pie, "Base: 167 egresados")
})

test_that("una nota escrita por el analista no se pisa", {
  # La base automática no borra un texto que alguien redactó. Si quiere las dos
  # cosas, las escribe él.
  el <- .base_por_grafico_inyectar(
    el_falso(list(nota_pie = "Excluye a quienes no respondieron")),
    "Base: 167 egresados"
  )
  expect_equal(el$overrides$nota_pie, "Excluye a quienes no respondieron")
})

test_that("sin base que poner, el elemento sale intacto", {
  # El control: si la función escribiera siempre, el test de arriba pasaría
  # igual y este delataría la diferencia.
  for (vacio in list(NULL, "", "   ", NA_character_)) {
    el <- .base_por_grafico_inyectar(el_falso(), vacio)
    expect_null(el$overrides$nota_pie)
  }
})

test_that("lo que no es un elemento del plan no se toca", {
  expect_null(.base_por_grafico_inyectar(NULL, "Base: 10"))
  expect_equal(.base_por_grafico_inyectar(list(), "Base: 10"), list())
})

test_that("la base de la lámina sólo existe si el analista la declaró", {
  # Con la base dentro de cada gráfico, repetirla abajo dice dos veces lo mismo
  # cuando coinciden y se contradice cuando no. El espacio en blanco es lo que
  # el contrato de PPT exige para dejar el placeholder vacío.
  expect_equal(.base_de_lamina_texto(NULL), " ")
  expect_equal(.base_de_lamina_texto(""), " ")
  expect_equal(.base_de_lamina_texto("Base: total de egresados"), "Base: total de egresados")
})

test_that("el renderer de poblacion_4 ya no compone una base de los cuatro", {
  # Contrato estático: si alguien devuelve `.base_auto_de_elementos()` a esa
  # lámina, los cuatro paneles vuelven a compartir denominador.
  src <- readLines("../../R/reporte_plan_ppt.R", warn = FALSE)
  ini <- grep('identical\\(stype, "poblacion_4"\\)', src)[1]
  fin <- grep("---- TEXT_R", src)
  fin <- fin[fin > ini][1]
  expect_false(is.na(ini))
  bloque <- src[ini:fin]
  expect_length(grep(".base_auto_de_elementos", bloque, fixed = TRUE), 0L)
  expect_gt(length(grep(".base_por_grafico_inyectar", bloque, fixed = TRUE)), 3L)
})
