# Quién aceptó participar, y quién no.
#
# Un rechazo no es un fallo del cruce: quien no consiente no llega a la pregunta
# del código. Gonzalo, 2026-09-22, sobre CH 18: «creo que no es identificable
# porque fue un rechazo, eso la tabla de acreditación ya lo sabe mostrar bien».

.macst_resp <- function() data.frame(
  `consentimiento_informado/acepta_participar` = c("1", "2", "1", ""),
  otra = 1:4,
  check.names = FALSE, stringsAsFactors = FALSE
)

test_that("encuentra la columna aunque venga con el prefijo de grupo de Kobo", {
  # Es el mismo modo de fallo que costó el cruce del padrón: Kobo entrega
  # `grupo/pregunta` y la lista de candidatos trae la hoja.
  col <- monitoreo_aulas_columna_consentimiento(.macst_resp())
  expect_identical(col, "consentimiento_informado/acepta_participar")
})

test_that("traduce los valores a acepta / rechaza, y el vacio queda vacio", {
  v <- monitoreo_aulas_consentimiento(.macst_resp())
  expect_identical(v, c("acepta", "rechaza", "acepta", ""))
})

test_that("sin columna reconocible NO se supone que aceptaron", {
  # Suponerlo pintaría de verde una pregunta que nadie contestó.
  d <- data.frame(loquesea = c("1", "2"), stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_consentimiento(d), c("", ""))
  expect_identical(monitoreo_aulas_columna_consentimiento(d), "")
})

test_that("una columna declarada manda, y si no existe no se busca otra", {
  # Adivinar tras una declaración explícita convierte un error de tipeo en una
  # cifra plausible. Es la lección del cruce por código.
  d <- .macst_resp()
  d$otro_consent <- c("2", "1", "2", "1")
  cfg <- list(source_mapping = list(consent_var = "otro_consent"))
  expect_identical(monitoreo_aulas_columna_consentimiento(d, cfg), "otro_consent")
  expect_identical(monitoreo_aulas_consentimiento(d, cfg),
                   c("rechaza", "acepta", "rechaza", "acepta"))
  ciega <- list(source_mapping = list(consent_var = "no_existe"))
  expect_identical(monitoreo_aulas_columna_consentimiento(d, ciega), "")
  expect_identical(monitoreo_aulas_consentimiento(d, ciega), rep("", 4L))
})

test_that("sin respuestas devuelve un vector vacio, no NULL", {
  expect_identical(monitoreo_aulas_consentimiento(data.frame()), character(0))
})
