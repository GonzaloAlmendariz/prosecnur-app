# =============================================================================
# test-monitoreo-aulas-columna-declarada.R — la columna que el estudio nombró
# =============================================================================
#
# Kobo devuelve las columnas con el prefijo de su grupo (`modulo_a/cod_pucp`) y
# el estudio las declara sin él (`cod_pucp`), que es como se ven en el XLSForm.
#
# Medido el 2026-09-21 sobre CCSS Perfil 2026-II, la víspera del campo,
# inyectando UNA respuesta con un código sacado del propio padrón:
#   `modulo_a/cod_pucp` -> en_celdas=0, sin_eje=1
#   `cod_pucp`          -> en_celdas=1, sin_eje=0
# Todas las respuestas del campo habrían caído en «sin nivel» con el avance
# clavado en cero, y el aviso culpando al padrón, que estaba bien.
#
# La línea que NO se cruza: no se adivina la llave. La hoja de un camino con
# grupos es el MISMO nombre que el estudio declaró, calificado por su grupo;
# reconocerlo es leer lo que ya se nombró. Por eso sólo vale cuando es
# inequívoco.

.macdt_df <- function(cols) {
  d <- as.data.frame(
    stats::setNames(rep(list(character(1)), length(cols)), cols),
    stringsAsFactors = FALSE, check.names = FALSE)
  d
}

test_that("el nombre exacto gana siempre", {
  d <- .macdt_df(c("cod_pucp", "modulo_a/cod_pucp"))
  expect_identical(monitoreo_aulas_columna_declarada(d, "cod_pucp"), "cod_pucp")
  expect_identical(monitoreo_aulas_columna_declarada(d, "modulo_a/cod_pucp"),
                   "modulo_a/cod_pucp")
})

test_that("tolera la caja y los espacios del nombre declarado", {
  d <- .macdt_df(c("Cod_Pucp", "otra"))
  expect_identical(monitoreo_aulas_columna_declarada(d, "cod_pucp"), "Cod_Pucp")
  expect_identical(monitoreo_aulas_columna_declarada(d, "  COD_PUCP  "), "Cod_Pucp")
})

test_that("reconoce la columna con el prefijo de grupo de Kobo", {
  # El caso que habría dejado el campo entero sin medir.
  d <- .macdt_df(c("_id", "modulo_a/cod_pucp", "modulo_b/B1"))
  expect_identical(monitoreo_aulas_columna_declarada(d, "cod_pucp"), "modulo_a/cod_pucp")
})

test_that("y también al revés: el estudio declara el grupo y la plataforma no lo trae", {
  # Pasa cuando el formulario pierde su grupo entre versiones.
  d <- .macdt_df(c("_id", "cod_pucp"))
  expect_identical(monitoreo_aulas_columna_declarada(d, "modulo_a/cod_pucp"), "cod_pucp")
})

test_that("con DOS columnas que comparten la hoja NO elige: eso sí sería adivinar", {
  # `modulo_a/cod_pucp` y `modulo_b/cod_pucp` son dos preguntas distintas; coger
  # una devolvería un dato de otra pregunta sin que nada lo dijera. Devolver ""
  # deja saltar el aviso de siempre, que es la conducta correcta.
  d <- .macdt_df(c("modulo_a/cod_pucp", "modulo_b/cod_pucp"))
  expect_identical(monitoreo_aulas_columna_declarada(d, "cod_pucp"), "")
})

test_that("un nombre que no está en ninguna forma devuelve vacío, no la más parecida", {
  d <- .macdt_df(c("_id", "modulo_a/A1", "modulo_a/codigo_alumno"))
  expect_identical(monitoreo_aulas_columna_declarada(d, "cod_pucp"), "")
})

test_that("sin declaración, sin respuestas o sin columnas no afirma nada", {
  d <- .macdt_df(c("modulo_a/cod_pucp"))
  expect_identical(monitoreo_aulas_columna_declarada(d, ""), "")
  expect_identical(monitoreo_aulas_columna_declarada(d, NULL), "")
  expect_identical(monitoreo_aulas_columna_declarada(data.frame(), "cod_pucp"), "")
  expect_identical(monitoreo_aulas_columna_declarada(NULL, "cod_pucp"), "")
})

test_that("el resolvedor del CÓDIGO usa esta regla, no una copia suya", {
  # La integración es lo que importa: el helper puede estar bien y el consumidor
  # seguir con su propio match.
  d <- .macdt_df(c("_id", "modulo_a/cod_pucp"))
  cfg <- list(source_mapping = list(student_code_var = "cod_pucp"))
  expect_identical(monitoreo_aulas_columna_codigo(d, cfg), "modulo_a/cod_pucp")
  # Y sin declaración sigue sin adivinar: el código es la llave del padrón.
  expect_identical(monitoreo_aulas_columna_codigo(d, list()), "")
})

test_that("el resolvedor de SEXO usa la misma regla antes de caer a sus alias", {
  d <- .macdt_df(c("_id", "modulo_a/A2", "sexo"))
  cfg <- list(source_mapping = list(sex_var = "A2"))
  # Lo declarado manda, aunque exista una columna «sexo» que el alias cazaría.
  expect_identical(monitoreo_aulas_columna_sexo(d, cfg), "modulo_a/A2")
  # Sin declaración, el barrido por alias sigue funcionando como siempre.
  expect_identical(monitoreo_aulas_columna_sexo(d, list()), "sexo")
})

test_that("los dos CRUCES declarados también resuelven el prefijo de grupo", {
  # Tenían su propio `%in% names(responses)` y contestaban «la variable
  # declarada no está en la base» con el dato delante. Medido el 2026-09-21: el
  # instrumento de CCSS declara `A1` (Ciclo) y Kobo entrega `modulo_a/A1`, así
  # que la hoja «Control de nivel» salía muda.
  # Los códigos tienen que PARECER códigos PUCP: `.man_*` rechaza como
  # ilegible lo que no lo parece, y un fixture con «111» mide el rechazo en vez
  # del cruce.
  d <- data.frame(
    collectorID = c("CH 1", "CH 1"),
    `modulo_a/cod_pucp` = c("20240111", "20240222"),
    `modulo_a/A1` = c("6", "9"),
    `modulo_a/P7` = c("CIENCIAS SOCIALES", "DERECHO"),
    stringsAsFactors = FALSE, check.names = FALSE)
  padron <- list(filas = list(
    list(codigo = "20240111", nivel = 6L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20240222", nivel = 7L, carrera = "ECONOMÍA", sexo = "M")))
  cfg <- list(source_mapping = list(
    student_code_var = "cod_pucp", declared_level_var = "A1",
    declared_level_labels = list(`6` = "6", `7` = "7", `8` = "8", `9` = "9", `70` = "Otro"),
    collector_var = "collectorID"))

  cr <- monitoreo_aulas_cruce_nivel_declarado(d, padron, cfg)
  expect_true(isTRUE(cr$ok))
  expect_false(grepl("no está en la base", cr$motivo %||% "", fixed = TRUE))
  # Una coincide (6 y 6) y una discrepa (padrón 7, declara 9).
  expect_identical(cr$comparables, 2L)
  expect_identical(cr$coinciden, 1L)
  expect_identical(cr$discrepan, 1L)

  # Y cuando la variable de verdad NO está, el motivo sigue nombrando la que el
  # estudio declaró —no la resuelta, que está vacía—.
  cfg2 <- cfg
  cfg2$source_mapping$declared_level_var <- "Z99"
  cr2 <- monitoreo_aulas_cruce_nivel_declarado(d, padron, cfg2)
  expect_false(isTRUE(cr2$ok))
  expect_true(grepl("Z99", cr2$motivo, fixed = TRUE))
})
