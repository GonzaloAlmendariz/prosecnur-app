# «Mujer» empieza por eme.
#
# Tres sitios del motor se hacían su propia clasificación de sexo y dos miraban
# la primera letra, así que un padrón etiquetado «Mujer»/«Hombre» metía todas
# las mujeres en la cuenta de hombres —sin aviso, con los totales por facultad
# cuadrando—. El tercero comparaba contra los literales y las descartaba.
#
# No es hipotético: `sex_top_1` sale del padrón de la universidad TAL CUAL, que
# es la regla de la casa, y `audit_reference.R` mapea `"1" = "Mujer"`. Que
# HSVG2026 traiga F/M es una propiedad de ese archivo, no del formato — y por
# eso ningún test lo cazaba.

test_that("clasifica etiquetas y códigos, y no confunde la eme", {
  expect_identical(.pulso_sexo_fm(c("F", "M", "f", "m")), c("F", "M", "F", "M"))
  # El caso que costó todo esto.
  expect_identical(.pulso_sexo_fm(c("Mujer", "Hombre")), c("F", "M"))
  expect_identical(.pulso_sexo_fm(c("MUJER", "Masculino", "Femenino")), c("F", "M", "F"))
  # Con tilde y en plural, que es como salen algunos padrones.
  expect_identical(.pulso_sexo_fm(c("Varón", "mujeres", "Varones")), c("M", "F", "M"))
})

test_that("lo que no es sexo devuelve NA y NUNCA cae a un lado por descarte", {
  # Un valor desconocido que se resolviera a "M" es peor que uno que se declare
  # ausente: el primero inventa un dato, el segundo deja decidir a quien llama.
  expect_true(all(is.na(.pulso_sexo_fm(c("", "Otro", "X", NA, "Prefiere no decir")))))
})

test_that("«m» a secas SIGUE siendo hombre: el orden del criterio importa", {
  # El control del arreglo. Si se probara subcadena antes que pertenencia
  # exacta, "m" no casaría ningún `grepl("hombre|masculin|varon")` y saldría NA,
  # rompiendo el caso que hoy funciona en todos los estudios reales.
  expect_identical(.pulso_sexo_fm("m"), "M")
  expect_identical(.pulso_sexo_fm("f"), "F")
})

test_that("los conteos por sexo del marco NO dependen de cómo se etiquetó", {
  # La comprobación que importa: el mismo aula descrita con códigos y con
  # palabras tiene que dar los mismos elegibles por sexo. Antes, la versión en
  # palabras daba 0 mujeres y 30 hombres.
  con <- function(s1, s2) data.frame(
    sex_top_1 = s1, sex_top_1_n = 18, sex_top_2 = s2, sex_top_2_n = 12,
    stringsAsFactors = FALSE
  )
  codigos <- .cm_aulas_sexo_conteos(con("F", "M"))
  palabras <- .cm_aulas_sexo_conteos(con("Mujer", "Hombre"))
  expect_identical(palabras, codigos)
  expect_identical(codigos$f, 18)
  expect_identical(codigos$m, 12)
})

test_that("y tampoco se invierten cuando el mayoritario es el otro sexo", {
  # `sex_top_1` es el mayoritario, no «el de las mujeres». Un aula de mayoría
  # hombres etiquetada en palabras tiene que dar 12 mujeres, no 18.
  df <- data.frame(sex_top_1 = "Hombre", sex_top_1_n = 18,
                   sex_top_2 = "Mujer", sex_top_2_n = 12, stringsAsFactors = FALSE)
  out <- .cm_aulas_sexo_conteos(df)
  expect_identical(out$f, 12)
  expect_identical(out$m, 18)
})
