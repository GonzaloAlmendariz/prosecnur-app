source("setup-load-all.R")

# B55/W-8: la reserva de pie (.reservar_pie_para_base_slide) es doctrina de
# SLIDE — en PPT la Base vive en el placeholder inferior del slide y la banda
# evita que la leyenda la pise (B41). En Word la Base es un PARRAFO del
# documento (reporte_word_plan la agrega debajo de la imagen), asi que la
# banda solo abria 0.34-0.85in de aire muerto dentro del PNG. Con
# word_render = TRUE la reserva no se impone; el camino PPT no cambia.

test_that("la reserva de pie sigue aplicando en el camino PPT", {
  out <- .reservar_pie_para_base_slide(list())
  expect_equal(out$canvas_h_reserva_pie_in, 0.34)

  out_multi <- .reservar_pie_para_base_slide(list(), min_in = 0.85)
  expect_equal(out_multi$canvas_h_reserva_pie_in, 0.85)

  # word_render = FALSE explicito es el mismo camino PPT.
  out_flag <- .reservar_pie_para_base_slide(list(), word_render = FALSE)
  expect_equal(out_flag$canvas_h_reserva_pie_in, 0.34)
})

test_that("en el camino Word la franja del pie colapsa", {
  out <- .reservar_pie_para_base_slide(list(), word_render = TRUE)
  expect_null(out$canvas_h_reserva_pie_in)

  out_multi <- .reservar_pie_para_base_slide(
    list(), min_in = 0.85, word_render = TRUE
  )
  expect_null(out_multi$canvas_h_reserva_pie_in)
})

test_that("nota_pie y reserva explicita del analista siguen mandando en Word", {
  # Con nota_pie el caption vive DENTRO del grafico tambien en Word: la
  # funcion no toca nada (ni en PPT ni en Word).
  con_nota <- .reservar_pie_para_base_slide(
    list(nota_pie = "Base: 52 docentes"), word_render = TRUE
  )
  expect_null(con_nota$canvas_h_reserva_pie_in)

  # Una reserva fijada por el analista no se borra en el camino Word.
  explicita <- .reservar_pie_para_base_slide(
    list(canvas_h_reserva_pie_in = 0.5), word_render = TRUE
  )
  expect_equal(explicita$canvas_h_reserva_pie_in, 0.5)
})
