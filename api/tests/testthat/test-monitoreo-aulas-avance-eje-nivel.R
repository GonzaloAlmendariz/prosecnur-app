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

test_that("con eje por PERSONA el plan no genera filas que nunca se llenan", {
  # **Salió armando el simulacro, no de un test.** El diseño declara los niveles
  # de la cuota y el plan trae además aulas cuyo nivel MODAL es otro —en CCSS,
  # 5 y 10—. Con eje por persona el valor lo pone el padrón, así que en esas
  # filas no puede caer nunca una respuesta: la tabla salía con SEIS filas y no
  # cuatro, dos con cuota `NA` y cero para siempre. Dos filas vacías que no se
  # llenan se leen como un hueco del operativo.
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    eje_cuota = "nivel",
    plan = c(.aen_plan(), list(
      # El aula de nivel modal 10: existe en el plan y no es del universo del eje.
      list(classroom_id = "a3", operational_code = "CH 3", label = "a3",
           faculty = "CIENCIAS SOCIALES", level = "10", sample_role = "titular",
           wave = "M1", orden = 3, eligible_n = 30, expected_valid = 12,
           sample_status = "agendada"))),
    design_targets = .aen_dt(),
    source_mapping = list(collector_var = "collectorID", sex_var = "sexo",
                          student_code_var = "codigo")))
  av <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())$avance_cuota
  claves <- vapply(av$facultades, function(f) as.character(f$facultad), character(1))
  expect_setequal(claves, c("7", "8"))
  expect_false("10" %in% claves)

  # Y con eje por AULA el plan SÍ las genera, que es lo que HSVG publica hoy:
  # ahí la columna del plan es la población del eje.
  cfg2 <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = list(
      list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
           faculty = "DERECHO", sample_role = "titular", wave = "M1", orden = 1,
           eligible_n = 30, expected_valid = 12, sample_status = "agendada"),
      list(classroom_id = "a2", operational_code = "CH 2", label = "a2",
           faculty = "PSICOLOGIA", sample_role = "titular", wave = "M1", orden = 2,
           eligible_n = 30, expected_valid = 12, sample_status = "agendada")),
    design_targets = list(
      schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
      tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 10,
      facultades = list(list(facultad = "DERECHO",
                             faculty_key = monitoreo_aulas_eje_key("DERECHO"),
                             cuota = 10, tau = 0.5)),
      selection_run_id = "run_1", frame_hash = "hash_1"),
    source_mapping = list(collector_var = "collectorID")))
  av2 <- monitoreo_aulas_dashboard(cfg2$plan, data.frame(collectorID = "a2"), cfg2)$avance_cuota
  claves2 <- vapply(av2$facultades, function(f) as.character(f$facultad), character(1))
  expect_true("PSICOLOGIA" %in% claves2)
  psico <- Filter(function(f) identical(as.character(f$facultad), "PSICOLOGIA"), av2$facultades)[[1]]
  expect_identical(psico$fuente_fila, "sin_cuota")
})

test_that("con eje por persona NO se mezcla el fallback por facultad", {
  # **El defecto más visible que encontró el simulacro**, y no lo vio ningún
  # test: la pantalla publicaba «faltan 1.168» sobre una muestra de 400.
  #
  # Las celdas de sexo salían de dos vocabularios a la vez: las del DISEÑO
  # —niveles 6 a 9, sumando 400— más dos del fallback por facultad, que proyecta
  # el cruce facultad × sexo del marco («CIENCIAS SOCIALES» F 404 y M 364). La
  # misma carencia contada dos veces, en dos idiomas.
  #
  # El fallback existe para cubrir a las facultades que el diseño no trazó, y con
  # el eje en facultad sigue haciendo su trabajo. Con `atribucion = "persona"` no
  # hay fallback que ofrecer: si el diseño no trae la cuota por sexo del eje, esa
  # celda no existe, y decirlo es mejor que rellenarla con la cuenta de otra cosa.
  cfg <- .aen_cfg()
  # El cruce facultad × sexo del marco, tal como lo copia `from_calc`: es el
  # insumo del fallback, y con eje nivel no puede aparecer en las celdas.
  cfg$quotas <- list(sex_by_faculty = data.frame(
    primary_role = c("faculty", "faculty"), primary_raw = c("CIENCIAS SOCIALES", "CIENCIAS SOCIALES"),
    secondary_role = c("sex", "sex"), secondary_raw = c("F", "M"),
    count = c(421L, 379L), stringsAsFactors = FALSE))
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())

  celdas <- d$quotas_sex_faculty %||% list()
  fuentes <- unique(vapply(celdas, function(c1) as.character(c1$source %||% ""), character(1)))
  expect_false("calc_muestra_faculty_sex" %in% fuentes)
  # Ninguna celda habla de la facultad: todas son del eje.
  valores <- unique(vapply(celdas, function(c1) as.character(c1$faculty %||% ""), character(1)))
  expect_false("CIENCIAS SOCIALES" %in% valores)
  expect_true(all(valores %in% c("7", "8")))

  # Y la cifra que se veía mal: la brecha total no puede pasar de la cuota.
  expect_lte(as.numeric(d$avance_cuota$total$brecha), as.numeric(d$avance_cuota$total$cuota))
})

test_that("la meta es por NIVEL y no por nivel y sexo", {
  # Gonzalo, 2026-09-17: «recuerda que la meta no es por sexo y nivel sino sólo
  # nivel». Decisión 2 del plan: la cuota es por el eje y es DURA; sexo y carrera
  # son referenciales.
  #
  # **Yo lo había hecho mal en el simulacro**, no el motor: le puse `cuota_sexo`
  # mitad y mitad dentro de cada nivel «para que el tablero tuviera celdas que
  # enseñar», y eso es convertir en cuota dura algo que el estudio declaró
  # descriptivo. Esta prueba existe para que no vuelva a pasar por comodidad.
  #
  # El diseño de CCSS declara `cuota` por nivel y NO declara `cuota_sexo`; el
  # motor ya hacía lo correcto con eso, y aquí queda fijado.
  cfg <- .aen_cfg()   # su `design_targets` no trae `cuota_sexo`
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())

  # Ni una celda de sexo: no hay cuota que medir por sexo.
  expect_identical(length(d$quotas_sex_faculty %||% list()), 0L)

  # Y la brecha de cada nivel es su NETO —cuota menos conseguidas—, no la suma de
  # unas celdas de sexo que nadie prometió.
  por <- stats::setNames(
    lapply(d$avance_cuota$facultades, identity),
    vapply(d$avance_cuota$facultades, function(f) as.character(f$facultad), character(1)))
  siete <- por[["7"]]
  expect_identical(as.numeric(siete$brecha),
                   as.numeric(siete$cuota) - as.numeric(siete$respuestas_validas))

  # El sexo NO desaparece: se describe. Es la diferencia entre «no se mide» y
  # «no se exige».
  expect_true("sexo" %in% names(d$avance_cuota$composicion$dimensiones))
})

test_that("un estudio que SI declara cuota por sexo la sigue midiendo", {
  # La contracara, que protege a HSVG: el ADR 0079 sigue vigente para el eje
  # facultad, donde la cuota es facultad Y sexo y no se compensa entre celdas.
  # Lo que cambia no es la regla: es que ahora se aplica sólo donde el diseño la
  # declara.
  cfg <- .aen_cfg()
  cfg$design_targets$facultades <- lapply(cfg$design_targets$facultades, function(f) {
    f$cuota_sexo <- list(F = floor(f$cuota / 2), M = f$cuota - floor(f$cuota / 2))
    f
  })
  cfg <- monitoreo_aulas_normalize_config(cfg)
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())
  expect_gt(length(d$quotas_sex_faculty %||% list()), 0L)
  # Y todas las celdas hablan del eje, no de la facultad (el fallback sigue apagado).
  valores <- unique(vapply(d$quotas_sex_faculty, function(c1) as.character(c1$faculty %||% ""), character(1)))
  expect_false("CIENCIAS SOCIALES" %in% valores)
})
