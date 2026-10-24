# Frente D (CCSS Perfil 2026): «Nivel curricular» (VI, VII, VIII, IX; códigos 6-9) salía por frecuencia
# (VII, VI, VIII, IX) en barras y dona. Los números romanos son una pista de orden como «Quinto ciclo» (contrato D8
# §2, p68), y un `ordenar_categorias = "instrumento"` explícito en la dona no es un modo del graficador de torta: se
# traduce al orden del instrumento en vez de caer a «Sin datos».

.goie_inst <- function(etiquetas = c("VI", "VII", "VIII", "IX"), codigos = c("6", "7", "8", "9")) {
  list(
    orders_list = list(nivel_curricular = list(names = codigos, labels = etiquetas)),
    survey = data.frame(name = "nivel_curricular", type = "select_one nivel_curricular", stringsAsFactors = FALSE),
    listas_ordinales = character(0)   # sin marca de Analítica: decide la pista de las etiquetas
  )
}

.goie_el <- function(tipo, overrides = list(), orden_categorias = NULL) {
  structure(list(.element_type = tipo, var = "nivel_curricular", orden_categorias = orden_categorias,
                 overrides = overrides), class = c("ppt_element", "list"))
}

.goie_ctx <- function(inst = .goie_inst()) list(inst = inst, var = "nivel_curricular")

test_that("los números romanos son pista de orden; las palabras sueltas no", {
  expect_true(.goc_pistas_orden(c("VI", "VII", "VIII", "IX")))
  expect_true(.goc_pistas_orden(c("Ciclo I", "Ciclo II", "Ciclo III")))
  expect_true(.goc_pistas_orden(c("Nivel VI", "Nivel VII", "Nivel VIII", "Otro")))
  expect_false(.goc_pistas_orden(c("Lima", "Arequipa", "Cusco")))
  expect_false(.goc_pistas_orden(c("Mi casa", "Di que sí", "Vivo solo")))
})

test_that("barras de nivel curricular por defecto salen en orden del instrumento", {
  out <- .goc_traducir(.goie_el("barras_categoricas"), .goie_ctx())
  expect_identical(out$overrides$orden_barras, "manual")
  expect_identical(out$overrides$orden_categorias_manual, c("VI", "VII", "VIII", "IX"))
})

test_that("la dona de nivel curricular por defecto sale en orden del instrumento", {
  out <- .goc_traducir(.goie_el("donut"), .goie_ctx())
  expect_identical(out$overrides$ordenar_categorias, "manual")
  expect_identical(out$overrides$orden_categorias_manual, c("VI", "VII", "VIII", "IX"))
})

test_that("un «instrumento» explícito en la dona manda el orden del instrumento (no es un modo de la torta)", {
  for (tipo in c("donut", "pie")) {
    out <- .goc_traducir(.goie_el(tipo, overrides = list(ordenar_categorias = "instrumento")), .goie_ctx())
    expect_identical(out$overrides$ordenar_categorias, "manual", info = tipo)
    expect_identical(out$overrides$orden_categorias_manual, c("VI", "VII", "VIII", "IX"), info = tipo)
  }
})

test_that("orden_categorias modo instrumento explícito manda aunque la lista sea nominal", {
  inst <- .goie_inst(c("Lima", "Arequipa", "Cusco", "Piura"))
  out <- .goc_traducir(.goie_el("barras_categoricas", orden_categorias = list(modo = "instrumento")), .goie_ctx(inst))
  expect_identical(out$overrides$orden_categorias_manual, c("Lima", "Arequipa", "Cusco", "Piura"))
})

test_that("una nominal de más de dos sin orden explícito sigue por frecuencia (recetario)", {
  inst <- .goie_inst(c("Lima", "Arequipa", "Cusco", "Piura"))
  out <- .goc_traducir(.goie_el("barras_categoricas"), .goie_ctx(inst))
  expect_identical(out$overrides$orden_barras, "mayor_menor")
  out_d <- .goc_traducir(.goie_el("donut"), .goie_ctx(inst))
  expect_identical(out_d$overrides$ordenar_categorias, "desc")
})

test_that("un orden heredado distinto de «instrumento» se respeta tal cual (contrato §3, paso 2)", {
  el <- .goie_el("barras_categoricas", overrides = list(orden_barras = "mayor_menor"))
  expect_identical(.goc_traducir(el, .goie_ctx())$overrides$orden_barras, "mayor_menor")
  el_d <- .goie_el("donut", overrides = list(ordenar_categorias = "desc"))
  expect_identical(.goc_traducir(el_d, .goie_ctx())$overrides$ordenar_categorias, "desc")
})
