# Las DOS varas del esperado por aula, y el invariante que las ata.
#
# El motor publicaba una sola —`efectivas_esperadas`, con la tasa del aula— y
# cada superficie que necesitaba la otra la reconstruia por su cuenta. Medido
# sobre HSVG 2026: la matriz de seleccion publicaba la de facultad y la
# aplicacion la del aula, con 120 de 174 aulas discrepando y hasta doce
# encuestas de diferencia en una sola. Ahora viajan juntas.

.dv_frame <- function() data.frame(
  faculty = c(rep("A", 4), rep("B", 3)),
  eligible_n = c(12, 20, 40, 60, 14, 30, 55),
  teacher_type = "DOCENTE CONTRATADO",
  included = TRUE, stringsAsFactors = FALSE
)

test_that("la tasa de la facultad es constante dentro de cada facultad", {
  out <- prosecnurapp:::.cm_aulas_efectividad_anotar(.dv_frame(), list())
  distintas <- tapply(out$tasa_facultad, out$faculty, function(z) length(unique(z)))
  expect_true(all(distintas == 1L))
})

test_that("la tasa de la facultad ES la media ponderada de la del aula", {
  # No es una aproximacion: es una identidad, y es la razon por la que ninguna
  # de las dos varas puede ser sistematicamente mas cauta que la otra. Si una
  # reescritura la rompe, dejaron de ser la misma familia.
  out <- prosecnurapp:::.cm_aulas_efectividad_anotar(.dv_frame(), list())
  for (f in unique(out$faculty)) {
    k <- out$faculty == f
    media <- sum(out$eligible_n[k] * out$tasa_efectividad_aula[k]) / sum(out$eligible_n[k])
    expect_equal(out$tasa_facultad[k][[1]], media, tolerance = 1e-3, info = f)
  }
})

test_that("las dos varas suman lo mismo POR FACULTAD y difieren POR AULA", {
  # El invariante estructural: agregando a facultad las dos dan el mismo total
  # —por eso ninguna gana en un agregado— y aula por aula se apartan segun el
  # tamano —por eso una responde la pregunta del aula y la otra no—.
  out <- prosecnurapp:::.cm_aulas_efectividad_anotar(.dv_frame(), list())
  for (f in unique(out$faculty)) {
    k <- out$faculty == f
    expect_equal(sum(out$efectivas_esperadas[k]), sum(out$esperadas_facultad[k]),
                 tolerance = 0.15, info = f)
  }
  # Y sin embargo NO son la misma columna: el aula chica espera mas por su
  # propia tasa y la grande menos, que es todo el punto de tener las dos.
  chica <- which.min(out$eligible_n)
  grande <- which.max(out$eligible_n)
  expect_gt(out$efectivas_esperadas[chica], out$esperadas_facultad[chica])
  expect_lt(out$efectivas_esperadas[grande], out$esperadas_facultad[grande])
})

test_that("las excluidas del marco no aportan a la tasa de su facultad", {
  # Mismo criterio que `calc_muestra_aulas_tasas_facultad`: solo el marco
  # elegible dimensiona. Una excluida recibe la tasa de su facultad pero no la
  # mueve, porque si no un aula descartada por criterios inclinaria la vara con
  # la que se mide a las que si entraron.
  af <- .dv_frame()
  af$included <- c(TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE)
  out <- prosecnurapp:::.cm_aulas_efectividad_anotar(af, list())
  k <- out$faculty == "A" & out$included
  esperada <- sum(out$eligible_n[k] * out$tasa_efectividad_aula[k]) / sum(out$eligible_n[k])
  expect_equal(out$tasa_facultad[out$faculty == "A"][[1]], esperada, tolerance = 1e-3)
})
