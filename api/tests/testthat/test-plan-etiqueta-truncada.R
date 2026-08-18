# B7. SPSS corta la etiqueta de variable en 256 bytes. Cuando ese texto cortado
# se guarda en el plan como override —`titulos_grupo`, `titulo`—, el motor lo
# dibuja tal cual: hace bien, es lo que el plan le dice. Pero el entregable sale
# con la frase a medias y nadie avisa. Esto avisa.
#
# LAS DOS CONDICIONES SON LA REGLA, y la segunda no es adorno: en el plan de
# Contabilidad hay DOS textos de 256 bytes exactos —el objetivo del estudio de
# la lamina 3, redactado a mano y terminado en punto, y el enunciado cortado de
# la 21—. Sin la regla del prefijo, la mitad de los avisos serian falsos.

txt <- function(n) paste(rep("a", n), collapse = "")

# 256 bytes exactos, y su version entera de 300 que lo contiene por prefijo.
CORTADO <- txt(256)
ENTERA  <- paste0(CORTADO, " y sigue hasta el final de la frase")

survey_con <- data.frame(name = c("p1", "p13_3"),
                         label = c("otra cosa", ENTERA), stringsAsFactors = FALSE)

plan_con <- function(x) list(slides = list(
  list(payload = list(grafico = list(args = list(titulos_grupo = list(tema_2 = x))))))) 


test_that("un texto de 256 bytes con su entera en el survey dispara", {
  h <- .verif_plan_etiqueta_truncada(plan_con(CORTADO), list(survey_con))
  expect_equal(nrow(h), 1L)
  expect_equal(h$lamina[1], 1L)
  expect_equal(h$ruta[1], "$grafico$args$titulos_grupo$tema_2")
  expect_equal(h$bytes[1], 256L)
  expect_equal(h$bytes_entera[1], nchar(ENTERA, "bytes"))
  expect_equal(h$texto[1], CORTADO)
})


test_that("un texto de 256 bytes SIN prefijo en el survey NO dispara", {
  # EL CASO REAL QUE OBLIGA A LA SEGUNDA CONDICION: el objetivo del estudio de
  # la lamina 3 del mazo de Contabilidad mide 256 bytes justos por casualidad,
  # esta redactado a mano y termina en punto. No es un truncamiento.
  h <- .verif_plan_etiqueta_truncada(plan_con(CORTADO),
                                     list(data.frame(name = "p1", label = "nada que ver",
                                                     stringsAsFactors = FALSE)))
  expect_equal(nrow(h), 0L)
})


test_that("un texto corto no dispara aunque el survey lo contenga por prefijo", {
  corto <- txt(40)
  sv <- data.frame(name = "p1", label = paste0(corto, " y mucho mas texto detras"),
                   stringsAsFactors = FALSE)
  expect_equal(nrow(.verif_plan_etiqueta_truncada(plan_con(corto), list(sv))), 0L)
})


test_that("255 y 257 bytes tampoco disparan: el limite es exacto", {
  for (n in c(255L, 257L)) {
    t <- txt(n)
    sv <- data.frame(name = "p1", label = paste0(t, " cola"), stringsAsFactors = FALSE)
    expect_equal(nrow(.verif_plan_etiqueta_truncada(plan_con(t), list(sv))), 0L)
  }
})


test_that("una etiqueta IGUAL de larga no es la entera", {
  # `startsWith` con dos textos identicos daria TRUE; hace falta que la del
  # survey sea ESTRICTAMENTE mas larga, o toda etiqueta de 256 se delataria
  # a si misma.
  sv <- data.frame(name = "p1", label = CORTADO, stringsAsFactors = FALSE)
  expect_equal(nrow(.verif_plan_etiqueta_truncada(plan_con(CORTADO), list(sv))), 0L)
})


test_that("sin survey, sin plan o sin la fila no hay hallazgos ni error", {
  expect_equal(nrow(.verif_plan_etiqueta_truncada(plan_con(CORTADO), list())), 0L)
  expect_equal(nrow(.verif_plan_etiqueta_truncada(plan_con(CORTADO),
                                                  list(data.frame(a = 1)))), 0L)
  expect_equal(nrow(.verif_plan_etiqueta_truncada(list(slides = list()),
                                                  list(survey_con))), 0L)
  expect_equal(nrow(.verif_plan_etiqueta_truncada(list(), list(survey_con))), 0L)
})


test_that("acepta un data.frame suelto y un instrumento con $survey", {
  expect_equal(nrow(.verif_plan_etiqueta_truncada(plan_con(CORTADO), survey_con)), 1L)
  expect_equal(nrow(.verif_plan_etiqueta_truncada(plan_con(CORTADO),
                                                  list(list(survey = survey_con)))), 1L)
})


test_that("recorre el plan entero y no solo `titulos_grupo`", {
  # El truncamiento puede guardarse en cualquier override de texto. La regla es
  # del PLAN, no de un campo concreto.
  p <- list(slides = list(
    list(payload = list(titulo = "corto")),
    list(payload = list(grafico = list(args = list(titulo = CORTADO)))),
    list(payload = list(bloques = list(list(etiquetas_vars = c("x", CORTADO)))))))
  h <- .verif_plan_etiqueta_truncada(p, list(survey_con))
  expect_equal(nrow(h), 2L)
  expect_equal(h$lamina, c(2L, 3L))
  expect_equal(h$ruta[1], "$grafico$args$titulo")
  expect_true(grepl("etiquetas_vars[[2]]", h$ruta[2], fixed = TRUE))
})


test_that("el espacio distinto no rompe la comparacion", {
  # El plan guarda el texto tal como salio del `.sav`; el XLSForm puede traer
  # dobles espacios o saltos. Se normaliza antes de comparar, igual que hace
  # `.etiqueta_sin_truncar()` en `reporte_frecuencias.R`.
  sv <- data.frame(name = "p1",
                   label = paste0(txt(100), "  ", txt(153), "\n cola larga"),
                   stringsAsFactors = FALSE)
  t <- paste0(txt(100), " ", txt(153))          # 254 caracteres
  t <- paste0(t, txt(256 - nchar(t, "bytes")))  # ajustado a 256 B exactos
  expect_equal(nchar(t, "bytes"), 256L)
  expect_equal(nrow(.verif_plan_etiqueta_truncada(plan_con(t), list(sv))), 0L)
})
