# N3b: el «N respuestas» del filtro («120 respuestas») va apagado por defecto y sólo sale con `mostrar_respuestas`.
# La nota del filtro («Sólo los N que respondieron «Sí»») NO es ese n: es la base de la subpregunta y se conserva siempre.
source("test-lamina-filtro-sub.R", local = TRUE)

test_that("filtro y subpregunta: el n de respuestas del filtro sale sólo con mostrar_respuestas; la nota del filtro se conserva", {
  skip_if_not_installed("officer")
  for (disp in c("abajo", "costado")) {
    mk <- function(...) p_filtro_subpregunta("inter", habilita = "Sí", subpregunta = "util", grafico_sub = "escala", disposicion = disp, ...)
    off <- .fsub_render(mk())
    on <- .fsub_render(mk(overrides = list(mostrar_respuestas = TRUE)))
    n <- sum(!is.na(off$fx$df$inter)); n_si <- sum(off$fx$df$inter == "1")
    expect_false(any(grepl(sprintf("^%d respuestas$", n), off$textos)), info = disp)
    expect_true(any(grepl(sprintf("^%d respuestas$", n), on$textos)), info = paste(disp, paste(on$textos, collapse = "|")))
    expect_true(any(grepl(sprintf("Sólo los %d que respondieron", n_si), off$textos, fixed = TRUE)), info = disp)
  }
})
