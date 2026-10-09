# =============================================================================
# A qué celda va cada respuesta, y en qué orden se decide
# =============================================================================
#
# Tres cosas se prueban aquí, y la primera es la que protege lo que está en
# campo:
#
#   1. **Identidad.** Con el eje facultad, el satélite devuelve exactamente lo
#      que el bloque calculaba inline: `cuenta = válida & con aula & dentro de
#      universo`, ninguna bolsa nueva, y el aula sin facultad sigue teniendo su
#      fila propia. HSVG no puede moverse un dígito.
#   2. **El orden normativo.** Aula → persona → dedup. Está probado porque
#      invertir los dos últimos pasos es un fallo silencioso y plausible: una
#      huérfana con código resoluble consumiría la primera aparición de su
#      persona y la buena se publicaría como repetida.
#   3. **El invariante.** Toda válida cae en una bolsa y en una sola.

.tea_plan <- function() data.frame(
  classroom_id = c("A1", "A2", "A3", "A4"),
  collection_unit_id = c("", "", "", ""),
  operational_code = c("CH 1", "CH 2", "CH 3", "CH 4"),
  faculty = c("DERECHO", "DERECHO", "PSICOLOGIA", ""),
  level = c("7", "7", "8", "9"),
  replacement_reason = c("", "aula_no_existe", "", ""),
  stringsAsFactors = FALSE
)

# A1 dos veces, A2 (aula que no existía), A3, A4 (aula sin facultad) y una
# respuesta de un aula que no está en el plan.
.tea_resp_clase <- c("A1", "A1", "A2", "A3", "A4", "ZZ")

.tea_atr <- function(validas = rep(TRUE, 6)) {
  prosecnurapp:::.maac_atribucion(.tea_plan(), validas, .tea_resp_clase)
}

test_that("identidad: con eje facultad manda el aula y no aparece bolsa nueva", {
  atr <- .tea_atr()
  r <- monitoreo_aulas_eje_atribucion(atr, plan_df = .tea_plan(), cfg = list())

  # El valor es el de la fila del plan: es lo que `atr$facultad` traía.
  expect_identical(r$valor, c("DERECHO", "DERECHO", "DERECHO", "PSICOLOGIA", "", ""))
  # Y la clave colapsa la vacía al centinela de siempre, que es lo que hace que
  # el aula sin facultad tenga fila propia en vez de desaparecer.
  expect_identical(r$clave[[5]], "sin_facultad")

  # `cuenta` es exactamente la regla vieja.
  esperado <- atr$valid & atr$matched & !atr$fuera
  expect_identical(r$cuenta, esperado)
  # A2 estaba fuera de universo; ZZ es huérfana.
  expect_identical(which(r$fuera), 3L)
  expect_identical(which(r$huerfana), 6L)
  # Sin eje y duplicadas son del eje por persona: aquí no existen.
  expect_false(any(r$sin_eje))
  expect_false(any(r$duplicada))
  # Las dos respuestas de A1 cuentan las dos: con eje facultad no se deduplica,
  # que es el supuesto del ADR 0079 y no se cambia por debajo.
  expect_true(all(r$cuenta[1:2]))
})

test_that("identidad: la declaración del eje viaja con el resultado", {
  r <- monitoreo_aulas_eje_atribucion(.tea_atr(), plan_df = .tea_plan(), cfg = list())
  eje <- attr(r, "eje")
  expect_identical(eje$clave, "facultad")
  expect_identical(eje$atribucion, "aula")
  expect_identical(eje$fuente_valor, "plan")
  # Nada que avisar: el eje facultad no necesita padrón.
  expect_identical(attr(r, "aviso"), "")
  expect_null(attr(r, "diagnostico"))
})

test_that("el invariante suma las validas y no se solapa", {
  atr <- .tea_atr()
  r <- monitoreo_aulas_eje_atribucion(atr, plan_df = .tea_plan(), cfg = list())
  inv <- monitoreo_aulas_eje_invariante(r, sum(atr$valid))
  expect_true(inv$ok)
  expect_identical(inv$suma, 6L)
  expect_identical(inv$solapadas, 0L)
  # Y una inválida no entra en ninguna bolsa: el total baja con ella.
  atr2 <- .tea_atr(validas = c(TRUE, FALSE, TRUE, TRUE, TRUE, TRUE))
  r2 <- monitoreo_aulas_eje_atribucion(atr2, plan_df = .tea_plan(), cfg = list())
  expect_true(monitoreo_aulas_eje_invariante(r2, sum(atr2$valid))$ok)
  expect_identical(monitoreo_aulas_eje_invariante(r2, sum(atr2$valid))$total, 5L)
})

# --- el eje por persona ------------------------------------------------------

.tea_cfg_nivel <- function() list(
  eje_cuota = "nivel",
  source_mapping = list(collector_var = "collectorID", student_code_var = "codigo")
)

.tea_padron <- function() list(
  schema = "monitoreo_aulas_padron_v1", vigencia = "2026-09-07",
  filas = list(
    list(codigo = "20191111", nivel = 7L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20192222", nivel = 8L, carrera = "SOCIOLOGÍA", sexo = "M"),
    list(codigo = "20193333", nivel = 9L, carrera = "PSICOLOGÍA", sexo = "F")
  )
)

# Mismo orden que `.tea_resp_clase`: A1 con la persona 1111, A1 OTRA VEZ con la
# MISMA persona (el traslape que el eje nivel hace visible), A2 (fuera de
# universo) con 2222, A3 con 2222 —persona distinta de aula, nivel 8—, A4 con un
# código que no está en el padrón, y la huérfana ZZ con 1111.
.tea_resp_nivel <- function() data.frame(
  collectorID = .tea_resp_clase,
  codigo = c("20191111", "20191111", "20192222", "20192222", "20199999", "20191111"),
  stringsAsFactors = FALSE
)

test_that("el eje por persona lee el padron, no el aula", {
  r <- monitoreo_aulas_eje_atribucion(
    .tea_atr(), plan_df = .tea_plan(), responses = .tea_resp_nivel(),
    cfg = .tea_cfg_nivel(), padron = .tea_padron())

  expect_identical(attr(r, "eje")$clave, "nivel")
  expect_identical(attr(r, "eje")$atribucion, "persona")
  # La respuesta de A3 —un aula de nivel 8 en el plan— cuenta por el nivel de SU
  # PERSONA. Aquí coinciden en 8; lo que se comprueba es que el valor sale del
  # padrón: la de A1 es nivel 7 por la persona, no por el aula.
  expect_identical(r$valor[[1]], "7")
  expect_identical(r$valor[[4]], "8")
  # La de A4 no cruza: sin nivel, con su motivo, y NO acredita.
  expect_identical(r$valor[[5]], "")
  expect_true(r$sin_eje[[5]])
  expect_identical(r$motivo[[5]], "codigo_no_en_padron")
  expect_false(r$cuenta[[5]])
})

test_that("la segunda respuesta de la misma persona se marca, y solo una vez", {
  r <- monitoreo_aulas_eje_atribucion(
    .tea_atr(), plan_df = .tea_plan(), responses = .tea_resp_nivel(),
    cfg = .tea_cfg_nivel(), padron = .tea_padron())
  # 1111 responde en A1 dos veces: la primera acredita, la segunda es duplicada.
  expect_true(r$cuenta[[1]])
  expect_true(r$duplicada[[2]])
  expect_false(r$cuenta[[2]])
  # Se marca, no se borra: sigue publicada en su bolsa.
  expect_identical(attr(r, "invariante")$duplicadas, 1L)
})

test_that("EL ORDEN: el aula excluye primero, y el huerfano no consume su turno", {
  # **La trampa que este orden existe para evitar.** La respuesta 3 es de A2,
  # un aula que no existía (fuera de universo), y la 6 es huérfana; las dos
  # traen códigos que SÍ resuelven —2222 y 1111—. Si se deduplicara antes de
  # aplicar el paso del aula, la de A2 se quedaría con la primera aparición de
  # 2222 y la buena (A3) saldría como repetida; y la huérfana ZZ haría lo mismo
  # con 1111, dejando la de A1 como duplicada.
  r <- monitoreo_aulas_eje_atribucion(
    .tea_atr(), plan_df = .tea_plan(), responses = .tea_resp_nivel(),
    cfg = .tea_cfg_nivel(), padron = .tea_padron())
  # La de A3 acredita su nivel 8: nadie le robó el turno.
  expect_true(r$cuenta[[4]])
  expect_false(r$duplicada[[4]])
  # La de A1 acredita su nivel 7: la huérfana no le robó el turno.
  expect_true(r$cuenta[[1]])
  # Y las dos excluidas por el aula conservan SU bolsa, no la del eje: son del
  # aula y no cambian con el eje (ADR 0088 sobre el 0079).
  expect_true(r$fuera[[3]]); expect_false(r$sin_eje[[3]]); expect_false(r$duplicada[[3]])
  expect_true(r$huerfana[[6]]); expect_false(r$sin_eje[[6]]); expect_false(r$duplicada[[6]])
})

test_that("el invariante tambien cierra con eje por persona", {
  atr <- .tea_atr()
  r <- monitoreo_aulas_eje_atribucion(
    atr, plan_df = .tea_plan(), responses = .tea_resp_nivel(),
    cfg = .tea_cfg_nivel(), padron = .tea_padron())
  inv <- monitoreo_aulas_eje_invariante(r, sum(atr$valid))
  expect_true(inv$ok)
  # Las seis válidas, una por bolsa: acreditan la de A1 (nivel 7 de su persona)
  # y la de A3 (nivel 8); la segunda de A1 es duplicada, la de A4 no cruza, la
  # de A2 la excluyó el AULA antes de llegar al eje, y ZZ es huérfana.
  expect_identical(inv$suma, 6L)
  expect_identical(inv$partes$en_celdas, 2L)
  expect_identical(inv$partes$duplicadas, 1L)
  expect_identical(inv$partes$sin_eje, 1L)
  expect_identical(inv$partes$fuera_universo, 1L)
  expect_identical(inv$partes$huerfanas, 1L)
})

test_that("sin padron nadie resuelve, y el aviso dice donde se arregla", {
  r <- monitoreo_aulas_eje_atribucion(
    .tea_atr(), plan_df = .tea_plan(), responses = .tea_resp_nivel(),
    cfg = .tea_cfg_nivel(), padron = NULL)
  # Ninguna acredita, y no por un cero medido: por una bolsa declarada.
  expect_false(any(r$cuenta))
  expect_identical(attr(r, "invariante")$sin_eje, 4L)
  # El aviso nombra la causa Y dónde se arregla: sin la segunda mitad, el lector
  # sale a revisar el enlace del recopilador.
  expect_true(grepl("padrón", attr(r, "aviso"), fixed = TRUE))
  expect_true(grepl("Fuentes", attr(r, "aviso"), fixed = TRUE))
})

test_that("sin columna de codigo declarada el aviso apunta a la declaracion", {
  cfg <- .tea_cfg_nivel()
  cfg$source_mapping$student_code_var <- ""
  r <- monitoreo_aulas_eje_atribucion(
    .tea_atr(), plan_df = .tea_plan(), responses = .tea_resp_nivel(),
    cfg = cfg, padron = .tea_padron())
  expect_false(any(r$cuenta))
  expect_true(grepl("student_code_var", attr(r, "aviso"), fixed = TRUE))
})

test_that("un padron de otra poblacion se dice como lo que es", {
  otro <- .tea_padron()
  otro$filas <- list(list(codigo = "20180000", nivel = 6L, carrera = "X", sexo = "F"))
  r <- monitoreo_aulas_eje_atribucion(
    .tea_atr(), plan_df = .tea_plan(), responses = .tea_resp_nivel(),
    cfg = .tea_cfg_nivel(), padron = otro)
  expect_false(any(r$cuenta))
  # No manda a revisar los códigos: manda a comprobar la vigencia y el filtro,
  # que es lo que falla cuando NINGUNO cruza.
  expect_true(grepl("vigencia", attr(r, "aviso"), fixed = TRUE))
})

test_that("respuestas y atribucion de bases distintas no se emparejan a ciegas", {
  # Si las filas no coinciden, el cruce no se adivina: nadie resuelve y se dice.
  r <- monitoreo_aulas_eje_atribucion(
    .tea_atr(), plan_df = .tea_plan(),
    responses = .tea_resp_nivel()[1:3, , drop = FALSE],
    cfg = .tea_cfg_nivel(), padron = .tea_padron())
  expect_false(any(r$cuenta))
  expect_identical(attr(r, "invariante")$sin_eje, 4L)
  expect_true(grepl("mismo número de", attr(r, "aviso"), fixed = TRUE))
})
