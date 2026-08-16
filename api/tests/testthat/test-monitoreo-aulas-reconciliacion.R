# El cuadre del parte de campo.
#
# El parte declara cuatro numeros que no son independientes:
#   asistentes - rechazos - duplicados = efectivas
# El Excel no comprueba esa identidad. Falla en 2 de 196 partes del estudio de
# 2025: pocos, y por eso mismo invisibles a ojo en una hoja de 101 columnas.

.mar_parte <- function(asist, rech, dup, efec, code = "CH 1") list(
  operational_code = code, intento = 1L, observed_students = asist,
  refusals = rech, duplicates = dup, effective_surveys = efec
)

test_that("un parte que cuadra no se denuncia", {
  expect_length(monitoreo_aulas_reconciliacion_partes(list(.mar_parte(27, 1, 3, 23))), 0L)
  expect_length(monitoreo_aulas_reconciliacion_partes(list(.mar_parte(15, 0, 0, 15))), 0L)
})

test_that("los dos descuadres del estudio real se detectan", {
  hallazgos <- monitoreo_aulas_reconciliacion_partes(list(
    .mar_parte(15, 0, 0, 14, "1TEA08-0401"),
    .mar_parte(27, 1, 3, 27, "LIN127-0203"),
    .mar_parte(20, 2, 0, 18, "OK-01")
  ))
  expect_length(hallazgos, 2L)
  expect_identical(hallazgos[[1]]$diferencia, -1)
  expect_identical(hallazgos[[2]]$diferencia, 4)
})

test_that("sin asistentes o sin efectivas no se inventa un descuadre", {
  # Suponer cero donde no hay dato denunciaria aulas que nadie llego a medir.
  expect_null(monitoreo_aulas_parte_descuadre(.mar_parte(NA, 0, 0, 10)))
  expect_null(monitoreo_aulas_parte_descuadre(.mar_parte(10, 0, 0, NA)))
})

test_that("rechazos y duplicados ausentes SI valen cero", {
  # Son cantidades de eventos: si no se anotaron, no ocurrieron.
  d <- monitoreo_aulas_parte_descuadre(list(observed_students = 10, effective_surveys = 10))
  expect_identical(d$diferencia, 0)
})

test_that("el aviso explica la resta, no solo el hecho", {
  h <- monitoreo_aulas_reconciliacion_partes(list(.mar_parte(27, 1, 3, 27, "LIN127-0203")))[[1]]
  texto <- monitoreo_aulas_descuadre_texto(h)

  # El control: "hay un descuadre" no le sirve a nadie; hay que poder ver de
  # donde sale el numero esperado.
  expect_match(texto, "27 asistentes")
  expect_match(texto, "1 rechazos")
  expect_match(texto, "3 duplicados")
  expect_match(texto, "dan 23")
  expect_match(texto, "declara 27")
  expect_match(texto, "sobran 4")
})

test_that("el tablero distingue descuadre, cuadre y ausencia de partes", {
  plan <- list(list(classroom_id = "A-01", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1, eligible_n = 30))
  aviso <- function(pc) {
    d <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE, plan = plan, partes_campo = pc))
    Filter(function(r) identical(as.character(r$check), "field_report_reconciliation"), d$validation)[[1]]
  }
  # El control: sin declarar `partes_campo` en el normalizador, los tres casos
  # devolvian "no hay partes que comprobar".
  expect_identical(as.character(aviso(list(.mar_parte(15, 0, 0, 14)))$status), "review")
  expect_identical(as.character(aviso(list(.mar_parte(15, 0, 0, 15)))$status), "ok")
  expect_match(as.character(aviso(list())$detail), "No hay partes")
})

# --- Cuotas sexo x facultad el primer dia de campo ----------------------------
# Encontrado sembrando un .pulso de QA para VER en pantalla lo que hasta ahora
# solo estaba en tests. El tablero reventaba entero —500 al abrir Monitoreo— en
# el estado mas normal del arranque: ya llegan envios y ninguno cuenta todavia.

test_that("el tablero no revienta con respuestas que aun no son validas", {
  plan <- list(list(classroom_id = "A-01", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1,
                    eligible_n = 30, expected_valid = 20,
                    faculty = "Ciencias", stratum = "Ciencias",
                    sex_top_1 = "Mujer", sex_top_1_n = 17,
                    sex_top_2 = "Hombre", sex_top_2_n = 13))
  cfg <- list(enabled = TRUE, plan = plan,
              source_mapping = list(collector_var = "collectorID", status_var = "estado"))

  # El control: sin cuotas declaradas la funcion sale antes de tocar el merge,
  # y sin respuestas la otra rama construye bien la columna. El caso que fallaba
  # es exactamente este: HAY respuestas y NINGUNA es valida.
  resp <- data.frame(collectorID = "A-01", sexo = "Mujer", estado = "pendiente",
                     stringsAsFactors = FALSE)
  d <- monitoreo_aulas_dashboard(plan, resp, cfg)

  cuotas <- d$cuotas_sexo_facultad %||% d$quotas_sex_faculty %||% list()
  expect_gt(length(cuotas), 0L)
  # Ninguna respuesta cuenta, asi que las dos cuotas estan enteras por cubrir.
  observadas <- vapply(cuotas, function(r) as.integer(r$observed %||% 0L), integer(1))
  expect_true(all(observadas == 0L))
  expect_true(all(vapply(cuotas, function(r) identical(as.character(r$status), "pendiente"), logical(1))))
})

test_that("con respuestas validas las cuotas si cuentan", {
  # El otro lado del control: si el arreglo hubiera puesto ceros a la fuerza,
  # este test lo veria.
  plan <- list(list(classroom_id = "A-01", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1,
                    eligible_n = 30, expected_valid = 20,
                    faculty = "Ciencias", stratum = "Ciencias",
                    sex_top_1 = "Mujer", sex_top_1_n = 2,
                    sex_top_2 = "Hombre", sex_top_2_n = 1))
  resp <- data.frame(collectorID = rep("A-01", 3), sexo = c("Mujer", "Mujer", "Hombre"),
                     estado = rep("completed", 3), stringsAsFactors = FALSE)
  d <- monitoreo_aulas_dashboard(plan, resp, list(
    enabled = TRUE, plan = plan,
    source_mapping = list(collector_var = "collectorID", status_var = "estado")))

  cuotas <- d$cuotas_sexo_facultad %||% d$quotas_sex_faculty %||% list()
  total <- sum(vapply(cuotas, function(r) as.integer(r$observed %||% 0L), integer(1)))
  expect_identical(total, 3L)
})
