# =============================================================================
# El tablero entero con el eje en NIVEL CURRICULAR
# =============================================================================
#
# Es la prueba de la fase 2 del eje declarable: `avance_cuota` dejó de leer
# `"faculty"` fijo y consume `monitoreo_aulas_eje_atribucion()`. Lo que aquí se
# comprueba es que un estudio cuyas metas son por nivel —CCSS Perfil 2026-II—
# mide de punta a punta, con las bolsas que el eje por persona añade y con el
# invariante cerrado.
#
# **El contrato del import NO cambia** (ADR 0079, «los tests son contra el
# contrato»): `design_targets$facultades`, `facultad` y `faculty_key` conservan
# sus nombres. Lo que cambia es su VALOR —el nivel— y lo que lo declara es el
# campo hermano `eje`.

.aen_plan <- function() list(
  # Dos aulas cuyo nivel MODAL es 7 y 8, con alumnos de varios niveles dentro:
  # es el caso real, y por eso el nivel no puede salir del aula.
  list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
       faculty = "CIENCIAS SOCIALES", program = "ECONOMÍA", level = "7",
       sample_role = "titular", wave = "M1", orden = 1,
       eligible_n = 30, expected_valid = 12, sample_status = "agendada"),
  list(classroom_id = "a2", operational_code = "CH 2", label = "a2",
       faculty = "CIENCIAS SOCIALES", program = "SOCIOLOGÍA", level = "8",
       sample_role = "titular", wave = "M1", orden = 2,
       eligible_n = 30, expected_valid = 12, sample_status = "agendada")
)

.aen_dt <- function() list(
  schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
  tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 7,
  facultades = list(
    list(facultad = "7", faculty_key = monitoreo_aulas_eje_key("7"), cuota = 4, tau = 0.5),
    list(facultad = "8", faculty_key = monitoreo_aulas_eje_key("8"), cuota = 3, tau = 0.5)
  ),
  selection_run_id = "run_1", frame_hash = "hash_1"
)

.aen_cfg <- function() monitoreo_aulas_normalize_config(list(
  enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
  plan = .aen_plan(), design_targets = .aen_dt(),
  eje_cuota = "nivel",
  eje_cuota_motivo = "Las metas del estudio se prometieron por nivel curricular.",
  source_mapping = list(collector_var = "collectorID", sex_var = "sexo",
                        student_code_var = "codigo")
))

.aen_padron <- function() list(
  schema = "monitoreo_aulas_padron_v1", vigencia = "2026-09-07",
  filas = list(
    list(codigo = "20190001", nivel = 7L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20190002", nivel = 7L, carrera = "ECONOMÍA", sexo = "M"),
    list(codigo = "20190003", nivel = 8L, carrera = "SOCIOLOGÍA", sexo = "F"),
    list(codigo = "20190004", nivel = 9L, carrera = "SOCIOLOGÍA", sexo = "M")
  )
)

# Seis respuestas. Las dos primeras son de niveles 7 y 7 en el aula a1; la
# tercera repite a la persona 0001 (duplicada); la cuarta es nivel 8 en a2; la
# quinta trae un código que no está en el padrón (sin eje); la sexta es de un
# aula que no está en el plan (huérfana).
.aen_resp <- function() data.frame(
  collectorID = c("a1", "a1", "a1", "a2", "a2", "ZZ"),
  codigo = c("20190001", "20190002", "20190001", "20190003", "20199999", "20190004"),
  sexo = c("Femenino", "Masculino", "Femenino", "Femenino", "Masculino", "Masculino"),
  stringsAsFactors = FALSE
)

.aen_avance <- function() {
  cfg <- .aen_cfg()
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())
  d$avance_cuota
}

test_that("las celdas se llenan por NIVEL, no por el nivel modal del aula", {
  av <- .aen_avance()
  por <- stats::setNames(
    vapply(av$facultades, function(f) as.integer(f$respuestas_validas), integer(1)),
    vapply(av$facultades, function(f) as.character(f$facultad), character(1)))
  # Nivel 7: las dos personas distintas del aula a1 (la repetida no cuenta).
  expect_identical(unname(por[["7"]]), 1L + 1L)
  # Nivel 8: la persona 0003, que estaba en a2 — cuyo nivel modal es 8 y aquí
  # coincide; lo que se comprueba es que el valor sale del PADRÓN.
  expect_identical(unname(por[["8"]]), 1L)
  # Y la cuota de cada celda es la del diseño, leída del contrato congelado.
  cuotas <- stats::setNames(
    vapply(av$facultades, function(f) as.numeric(f$cuota), numeric(1)),
    vapply(av$facultades, function(f) as.character(f$facultad), character(1)))
  expect_identical(unname(cuotas[["7"]]), 4)
  expect_identical(unname(cuotas[["8"]]), 3)
})

test_that("las tres bolsas se publican, y el invariante cierra", {
  av <- .aen_avance()
  t <- av$total
  # 6 válidas = 3 en celdas + 1 duplicada + 1 sin eje + 0 fuera de universo +
  # 1 huérfana.
  expect_identical(t$duplicadas, 1L)
  expect_identical(t$sin_eje, 1L)
  expect_identical(t$huerfanas, 1L)
  expect_identical(t$fuera_universo, 0L)
  expect_true(t$invariante$ok)
  expect_identical(t$invariante$suma, 6L)
  expect_identical(t$invariante$solapadas, 0L)
  expect_identical(t$invariante$partes$en_celdas, 3L)
})

test_that("la declaracion del eje viaja en el bloque, con su motivo", {
  cfg <- .aen_cfg()
  # La declaración va EN el bloque que publica las celdas: quien publica una
  # cifra dice de qué es. (En el import también viaja, colgada de `metas`.)
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())
  eje <- d$avance_cuota$eje
  expect_identical(eje$clave, "nivel")
  expect_identical(eje$columna, "level")
  expect_identical(eje$atribucion, "persona")
  expect_identical(eje$fuente_valor, "padron")
  expect_match(eje$motivo, "nivel curricular")
})

test_that("SIN padron ninguna respuesta acredita, y no es un cero medido", {
  # La regla del estudio: sin cruce no hay nivel. Lo que NO puede pasar es que
  # eso se lea como «no llegó nadie»: las válidas siguen contadas, en la bolsa.
  cfg <- .aen_cfg()
  av <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = NULL)$avance_cuota
  en_celdas <- sum(vapply(av$facultades, function(f) as.integer(f$respuestas_validas), integer(1)))
  expect_identical(en_celdas, 0L)
  expect_identical(av$total$sin_eje, 5L)
  expect_identical(av$total$huerfanas, 1L)
  expect_true(av$total$invariante$ok)
})

test_that("el eje NIVEL no toca el eje FACULTAD: identidad byte a byte", {
  # La prueba que protege lo que está en campo. El mismo estudio sin declarar
  # eje tiene que dar exactamente lo que daba antes de que el eje existiera, y
  # las dos bolsas nuevas salen en CERO — declaradas, no ausentes.
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = .aen_plan(),
    design_targets = local({
      dt <- .aen_dt()
      dt$facultades <- list(list(facultad = "CIENCIAS SOCIALES",
                                 faculty_key = monitoreo_aulas_eje_key("CIENCIAS SOCIALES"),
                                 cuota = 7, tau = 0.5))
      dt
    }),
    source_mapping = list(collector_var = "collectorID", sex_var = "sexo")
  ))
  av <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg)$avance_cuota
  expect_identical(as.character(av$facultades[[1]]$facultad), "CIENCIAS SOCIALES")
  # Las cinco respuestas con aula del plan cuentan TODAS: con eje facultad no se
  # deduplica, que es el supuesto del ADR 0079 y no se cambia por debajo.
  expect_identical(as.integer(av$facultades[[1]]$respuestas_validas), 5L)
  expect_identical(av$total$duplicadas, 0L)
  expect_identical(av$total$sin_eje, 0L)
  expect_identical(av$total$huerfanas, 1L)
  expect_true(av$total$invariante$ok)
})
