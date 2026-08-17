

# --- El enganche ------------------------------------------------------------

test_that("la lamina metodologica se reconoce por su titulo", {
  # Los planes ya guardados no traen `diagrama`: se escribieron cuando la unica
  # forma de esta lamina era el parrafo. Sin este reconocimiento el diagrama
  # existiria y no lo veria nadie.
  expect_equal(.slide_texto_diagrama_auto("NÚMERO DE RESPUESTAS"), "numero_respuestas")
  expect_equal(.slide_texto_diagrama_auto("Numero de respuestas"), "numero_respuestas")
})


test_that("el detector es estrecho: otra lamina de texto no dibuja nada", {
  # Una lamina de texto que de pronto dibuja algo es peor que una que no dibuja.
  expect_null(.slide_texto_diagrama_auto("OBJETIVO"))
  expect_null(.slide_texto_diagrama_auto("NÚMERO DE RESPUESTAS POR PÚBLICO"))
  expect_null(.slide_texto_diagrama_auto(""))
  expect_null(.slide_texto_diagrama_auto(NULL))
})


test_that("el constructor deja el diagrama en su slot", {
  sl <- p_slide_texto("NÚMERO DE RESPUESTAS", texto = "x")
  expect_equal(sl$slots$diagrama, "numero_respuestas")
})


test_that("una lamina de texto normal no gana el slot", {
  sl <- p_slide_texto("OBJETIVO", texto = "x")
  expect_null(sl$slots$diagrama)
})


test_that("`diagrama = \"\"` lo apaga", {
  sl <- p_slide_texto("NÚMERO DE RESPUESTAS", texto = "x", diagrama = "")
  expect_null(sl$slots$diagrama)
})


test_that("el lienzo guarda la proporcion medida del aprobado", {
  # 33.48 x 10.15 cm en la lamina 7 del aprobado -> 3.30. Con el 1000 x 430 de
  # la primera version el encaje por alto dejaba 1.4 pulgadas de margen a cada
  # lado mientras el aprobado va de borde a borde.
  expect_equal(.NRESP_W / .NRESP_H, 33.48 / 10.15, tolerance = 0.03)
})


test_that("sin documento el colocador no hace nada en vez de reventar", {
  # Medido sobre el mazo real: sin este cortafuegos, `graficos_job_worker_word`
  # moria con «Base \'estudiantes\': attempt to apply non-function» —el PPT
  # salia perfecto y el informe Word no salia—. Word llama al MISMO renderer
  # del PPT con `solo_lista = TRUE` y `doc = NULL`, solo para cosechar el
  # `render_meta`.
  expect_null(.nresp_colocar(NULL, list(diagrama = "numero_respuestas")))
})


test_that("sin diagrama declarado el colocador devuelve el documento intacto", {
  # El renderer lo llama en TODA lamina de texto: la que decide es esta.
  doc <- "documento-de-mentira"
  expect_identical(.nresp_colocar(doc, list()), doc)
  expect_identical(.nresp_colocar(doc, list(diagrama = "otra_cosa")), doc)
})


test_that("en la pasada sin documento no se coloca nada", {
  doc <- "documento-de-mentira"
  expect_identical(
    .nresp_colocar(doc, list(diagrama = "numero_respuestas"), solo_lista = TRUE),
    doc
  )
})
