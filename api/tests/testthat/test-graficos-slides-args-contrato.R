source("setup-load-all.R")

# Contrato de superficie de los slides (P7 del GOAL loop del motor PPT,
# docs/qa/goal-loop-motor-ppt-2026-08-03.md): todo arg que el registry ofrece
# a la UI debe existir como formal del constructor del slide. El puente de
# payload (.graficos_* en router_graficos.R) filtra con
# `payload[names(payload) %in% names(formals(fn))]`, asi que un arg curado sin
# formal es un campo fantasma: el analista escribe y el valor muere en
# silencio. Asi se ofrecieron `pie`/`etiqueta` en poblacion y `base` en
# poblacion_5/6 durante meses.

test_that("todo arg curado de un slide existe como formal de su constructor", {
  for (nm in names(.SLIDES_META)) {
    expect_true(exists(nm, envir = asNamespace("prosecnurapp")), info = nm)
    fn <- get(nm, envir = asNamespace("prosecnurapp"))
    fmls <- names(formals(fn))
    curated <- vapply(.SLIDES_META[[nm]]$args, function(a) a$name, character(1))
    fantasmas <- setdiff(curated, fmls)
    expect_identical(
      fantasmas, character(0),
      info = sprintf("%s ofrece args sin formal: %s", nm, paste(fantasmas, collapse = ", "))
    )
  }
})

test_that("los formals con render conocido tienen superficie en el registry", {
  # Ocultos que la auditoria P7 saco a la luz; si alguien los vuelve a
  # esconder, este test lo detecta.
  # Nota: iconos_focos_left_cm/top_cm del indice quedan deliberadamente SIN
  # superficie (decision previa fijada en test-graficos-argumentos-ui.R).
  casos <- list(
    p_slide_1_grafico = "subtitulo",
    p_slide_2_graficos_poblacion = "texto"
  )
  for (nm in names(casos)) {
    curated <- vapply(.SLIDES_META[[nm]]$args, function(a) a$name, character(1))
    faltan <- setdiff(casos[[nm]], curated)
    expect_identical(
      faltan, character(0),
      info = sprintf("%s perdio superficie para: %s", nm, paste(faltan, collapse = ", "))
    )
  }
})

test_that("la etiqueta solo se ofrece donde el motor la consume", {
  # El bloque paneles_4 del motor la ignora explicitamente y los constructores
  # de 1_grafico/2_graficos/poblacion_2/poblacion_4 no la aceptan.
  sin_etiqueta <- c(
    "p_slide_1_grafico", "p_slide_2_graficos", "p_slide_4_graficos",
    "p_slide_2_graficos_poblacion", "p_slide_4_graficos_poblacion",
    # formal aceptado pero jamas dibujado (render diferencial P8)
    "p_slide_5_graficos_poblacion", "p_slide_6_graficos_poblacion"
  )
  for (nm in sin_etiqueta) {
    curated <- vapply(.SLIDES_META[[nm]]$args, function(a) a$name, character(1))
    expect_false("etiqueta" %in% curated, info = nm)
  }
})
