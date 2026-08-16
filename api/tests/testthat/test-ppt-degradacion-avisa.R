# Vara V4 del GOAL de UI: lo que el motor no pudo hacer se dice, no se omite.
#
# El motor de PPT degrada bien: si una lámina no se puede renderizar, sale un
# canvas «Sin datos» y el resto del mazo se salva. Lo que faltaba es que el
# analista se entere. La degradación dejaba `warning()`, y el propio `jobs.R`
# advierte que **el renderer se traga los `warning()`**: por eso existe
# `.pulso_aviso()`, que viaja por `message()` con sello y sí llega al cliente
# como `avisos` del job.
#
# Sin esto el mazo salía con una lámina en blanco y la razón se quedaba en el
# stderr del subproceso callr.

.sello <- prosecnurapp:::.PULSO_AVISO_SELLO

# Captura los `message()` sellados que emite una expresión, que es exactamente
# lo que `.pulso_avisos_de_job()` después cosecha del stderr.
.avisos_de <- function(expr) {
  msgs <- character(0)
  withCallingHandlers(
    suppressWarnings(force(expr)),
    message = function(m) {
      msgs <<- c(msgs, conditionMessage(m))
      invokeRestart("muffleMessage")
    }
  )
  grep(.sello, msgs, fixed = TRUE, value = TRUE)
}

test_that("una lámina que no se pudo renderizar avisa al analista, no sólo al log", {
  avisos <- .avisos_de(
    prosecnurapp:::.plan_render_element_degradable(
      function(el) stop(structure(
        class = c("pulso_slide_render_error", "error", "condition"),
        list(message = "la variable P7 no existe en la fuente", call = NULL)
      )),
      list()
    )
  )
  expect_length(avisos, 1L)
  expect_true(grepl("Sin datos", avisos[[1]], fixed = TRUE))
  # El aviso lleva el porqué, que es lo único accionable.
  expect_true(grepl("P7 no existe", avisos[[1]], fixed = TRUE))
})

test_that("un renderer que devuelve NULL también avisa", {
  avisos <- .avisos_de(prosecnurapp:::.plan_canvas_render_nulo("El grafico de barras no produjo nada."))
  expect_length(avisos, 1L)
  expect_true(grepl("no produjo nada", avisos[[1]], fixed = TRUE))
})

test_that("un slot que no era ppt_element avisa y devuelve el canvas", {
  caja <- new.env(parent = emptyenv())
  avisos <- .avisos_de({
    caja$el <- prosecnurapp:::.plan_elemento_degradado("El icono del objetivo llego mangleado.")
  })
  expect_length(avisos, 1L)
  expect_true(grepl("mangleado", avisos[[1]], fixed = TRUE))
  # Y sigue degradando como antes: el aviso se suma, no reemplaza.
  expect_s3_class(caja$el, "ppt_element")
  expect_equal(caja$el$.element_type, "canvas_degradado")
})

test_that("el caption que no se pudo calcular avisa antes de salir sin él", {
  avisos <- .avisos_de(
    prosecnurapp:::.plan_base_caption_segura(
      function(el, sufijo_auto = NULL, formato = NULL) stop("la variable no existe"),
      list()
    )
  )
  expect_length(avisos, 1L)
  expect_true(grepl("sin caption", avisos[[1]], fixed = TRUE))
})

test_that("un render que sale bien no inventa avisos", {
  # El control: si `.pulso_aviso()` se llamara siempre, los tests de arriba
  # pasarían sin que la degradación los haya provocado.
  avisos <- .avisos_de(prosecnurapp:::.plan_render_element_degradable(function(el) "lamina ok", list()))
  expect_length(avisos, 0L)
})

test_that("el aviso viaja con el sello que el cosechador busca", {
  # Sin sello, `.pulso_avisos_de_job()` no puede separarlo del ruido del
  # stderr —progreso, locale, avisos de paquetes— y el aviso se pierde igual.
  avisos <- .avisos_de(prosecnurapp:::.plan_canvas_render_nulo("algo"))
  expect_true(startsWith(avisos[[1]], .sello))
})
