# =============================================================================
# El cruce de alumnos por código PUCP, repartido por carrera
# =============================================================================
#
# Gonzalo, 2026-09-22: «en validación tiene que estar el cruce por alumnos por
# código PUCP, de la misma forma que en acreditación tenemos la lista de actores
# y su estatus, pero no por actores —porque todos son estudiantes— sino por la
# carrera a la que pertenecen».
#
# De este cruce depende todo el avance de un estudio cuyo eje se resuelve por
# persona, y sólo se publicaba su total. El detalle por motivo ya lo calculaba
# `monitoreo_aulas_nivel_diagnostico()` y no lo leía nadie.

# El estudio CONFIDENCIAL: pide un código identificador. Sin eso no hay cruce
# y la superficie no debe existir (ver el último bloque).
.mcc_cfg <- function(codigo = "cod_pucp", anonimo = FALSE) list(
  anonymous_responses = anonimo,
  source_mapping = list(student_code_var = codigo)
)

.mcc_resueltas <- function() data.frame(
  codigo = c("20190001", "20190002", "20190001", "20190003", "", "99999999", "abc"),
  nivel = c(6L, 7L, 6L, 8L, NA, NA, NA),
  carrera = c("ECONOMÍA", "ECONOMÍA", "ECONOMÍA", "SOCIOLOGÍA", "", "", ""),
  sexo = c("F", "M", "F", "F", "", "", ""),
  resuelto = c(TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE),
  motivo = c("", "", "", "", "sin_codigo_declarado", "codigo_no_en_padron", "codigo_ilegible"),
  stringsAsFactors = FALSE
)

test_that("sin respuestas devuelve la forma entera en ceros, no NULL", {
  v <- monitoreo_aulas_cruce_por_carrera(data.frame(), cfg = .mcc_cfg())
  expect_identical(v$schema, "monitoreo_aulas_cruce_por_carrera_v1")
  expect_identical(v$total$consideradas, 0L)
  expect_identical(v$carreras, list())
  expect_identical(v$sin_cruce, list())
})

test_that("cuenta PERSONAS por carrera, no respuestas", {
  # La tercera fila repite a 20190001: la segunda respuesta de alguien no es
  # alguien más. Se marca y se cuenta aparte; nunca se borra.
  v <- monitoreo_aulas_cruce_por_carrera(.mcc_resueltas(), cfg = .mcc_cfg())
  por <- stats::setNames(
    vapply(v$carreras, function(c1) c1$personas, integer(1)),
    vapply(v$carreras, function(c1) c1$carrera, character(1)))
  expect_identical(unname(por[["ECONOMÍA"]]), 2L)
  expect_identical(unname(por[["SOCIOLOGÍA"]]), 1L)
  expect_identical(v$total$personas, 3L)
  expect_identical(v$total$duplicadas, 1L)
  # Y la repetición se ve donde se produjo, no sólo en el total.
  eco <- Filter(function(c1) identical(c1$carrera, "ECONOMÍA"), v$carreras)[[1]]
  expect_identical(eco$duplicadas, 1L)
})

test_that("las que no cruzan tienen su propia fila, con el motivo que las arregla", {
  # No se les imputa la carrera del curso-horario: la carrera sale del padrón y
  # ellas no llegaron a él. Cada motivo se arregla en un sitio distinto, así que
  # el número solo no sirve para actuar.
  v <- monitoreo_aulas_cruce_por_carrera(.mcc_resueltas(), cfg = .mcc_cfg())
  expect_identical(v$total$sin_cruce, 3L)
  motivos <- stats::setNames(
    vapply(v$sin_cruce, function(m) m$respuestas, integer(1)),
    vapply(v$sin_cruce, function(m) m$motivo, character(1)))
  expect_identical(unname(motivos[["sin_codigo_declarado"]]), 1L)
  expect_identical(unname(motivos[["codigo_ilegible"]]), 1L)
  expect_identical(unname(motivos[["codigo_no_en_padron"]]), 1L)
  # La etiqueta viaja declarada: dice dónde se arregla, no repite la clave.
  etiquetas <- vapply(v$sin_cruce, function(m) m$etiqueta, character(1))
  expect_true(any(grepl("padrón", etiquetas)))
  expect_true(any(grepl("no declararon", tolower(etiquetas))))
})

test_that("un motivo sin casos NO se publica en cero: seria ruido", {
  r <- .mcc_resueltas()[1:4, , drop = FALSE]
  v <- monitoreo_aulas_cruce_por_carrera(r, cfg = .mcc_cfg())
  expect_identical(v$sin_cruce, list())
  expect_identical(v$total$sin_cruce, 0L)
  expect_identical(v$total$tasa, 1)
})

test_that("la poblacion del padron entra en la fila, y su ausencia es NA declarado", {
  v <- monitoreo_aulas_cruce_por_carrera(
    .mcc_resueltas(), poblacion = list("ECONOMÍA" = 358), cfg = .mcc_cfg())
  eco <- Filter(function(c1) identical(c1$carrera, "ECONOMÍA"), v$carreras)[[1]]
  socio <- Filter(function(c1) identical(c1$carrera, "SOCIOLOGÍA"), v$carreras)[[1]]
  expect_identical(eco$poblacion, 358L)
  # Sin dato, NA y no cero: «no lo sé» y «son cero» no son lo mismo.
  expect_true(is.na(socio$poblacion))
})

test_that("`elegible` acota igual que en el resto del bloque", {
  # Sólo las que pasaron el paso del AULA: una huérfana con código resoluble no
  # debe consumir la primera aparición de su persona.
  v <- monitoreo_aulas_cruce_por_carrera(
    .mcc_resueltas(), elegible = c(TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
    cfg = .mcc_cfg())
  expect_identical(v$total$consideradas, 1L)
  expect_identical(v$total$personas, 1L)
  expect_identical(v$total$sin_cruce, 0L)
})

test_that("quien cruza sin carrera en el padron se declara, no se esconde", {
  r <- .mcc_resueltas()[1, , drop = FALSE]
  r$carrera <- ""
  v <- monitoreo_aulas_cruce_por_carrera(r, cfg = .mcc_cfg())
  expect_identical(vapply(v$carreras, function(c1) c1$carrera, character(1)),
                   "Sin carrera en el padrón")
})

test_that("el tablero lo iza al primer nivel, sin cruzar dos veces", {
  # Lo calcula `avance_cuota`, que es quien resuelve la persona. Dos lecturas de
  # la misma respuesta es el defecto que este perfil lleva el día corrigiendo.
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    eje_cuota = "nivel",
    plan = list(
      list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
           faculty = "CIENCIAS SOCIALES", program = "ECONÓMIA", level = "7",
           sample_role = "titular", wave = "M1", orden = 1,
           eligible_n = 30, expected_valid = 12, sample_status = "agendada")),
    design_targets = list(
      schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
      tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 4,
      facultades = list(list(facultad = "7", faculty_key = monitoreo_aulas_eje_key("7"),
                             cuota = 4, tau = 0.5)),
      selection_run_id = "run_1", frame_hash = "hash_1"),
    source_mapping = list(collector_var = "collectorID", student_code_var = "codigo")))
  padron <- list(schema = "monitoreo_aulas_padron_v1", vigencia = "2026-09-07", filas = list(
    list(codigo = "20190001", nivel = 7L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20190002", nivel = 9L, carrera = "SOCIOLOGÍA", sexo = "M")))
  resp <- data.frame(
    collectorID = c("CH 1", "CH 1", "CH 1", "CH 1"),
    codigo = c("20190001", "20190001", "20190002", "20199999"),
    stringsAsFactors = FALSE)
  d <- monitoreo_aulas_dashboard(cfg$plan, resp, cfg, padron = padron)
  expect_identical(d$cruce_por_carrera$schema, "monitoreo_aulas_cruce_por_carrera_v1")
  expect_identical(d$cruce_por_carrera, d$avance_cuota$cruce_por_carrera)
  # Y sus cifras cuadran con las bolsas del avance: mismas respuestas, mismo cruce.
  expect_identical(d$cruce_por_carrera$total$personas,
                   as.integer(d$avance_cuota$total$respuestas_validas +
                                d$avance_cuota$total$sin_celda))
  expect_identical(d$cruce_por_carrera$total$duplicadas, d$avance_cuota$total$duplicadas)
  expect_identical(d$cruce_por_carrera$total$sin_cruce, d$avance_cuota$total$sin_eje)
})

# =============================================================================
# Anónimo contra confidencial: cuándo esta superficie EXISTE
# =============================================================================
#
# Gonzalo, 2026-09-22: «esta pestaña sólo está disponible si la encuesta, en vez
# de ser anónima, es confidencial. No todos los estudios lo son: las
# confidenciales piden un código identificador, las anónimas no».
#
# Lo que separa una de otra es si el instrumento PIDE el código, y eso en la
# config es `student_code_var`.

test_that("un estudio anonimo no tiene cruce, y el bloque lo declara", {
  v <- monitoreo_aulas_cruce_por_carrera(.mcc_resueltas(), cfg = list())
  expect_false(v$aplica)
  expect_match(v$motivo, "no pide un código identificador")
  # Y no publica cifras de un cruce que no hizo: ni carreras ni motivos.
  expect_identical(v$carreras, list())
  expect_identical(v$total$personas, 0L)
})

test_that("un estudio que pide codigo SI lo tiene, aunque el rotulo diga anonimo", {
  # Se mira el mecanismo y no la etiqueta: `anonymous_responses` puede estar sin
  # actualizar —lo está en CCSS Perfil 2026-II— y ocultar el panel por una
  # etiqueta vieja escondería el cruce del que depende todo su avance.
  v <- monitoreo_aulas_cruce_por_carrera(
    .mcc_resueltas(), cfg = .mcc_cfg(anonimo = TRUE))
  expect_true(v$aplica)
  expect_identical(v$total$personas, 3L)
  # Pero la contradicción se dice: no se elige en silencio entre dos
  # declaraciones que no pueden ser ciertas a la vez.
  expect_match(v$aviso_anonimato, "no pueden ser ciertas a la vez")
  expect_match(v$aviso_anonimato, "cod_pucp", fixed = TRUE)
})

test_that("sin contradiccion no hay aviso: un cero permanente seria ruido", {
  v <- monitoreo_aulas_cruce_por_carrera(.mcc_resueltas(), cfg = .mcc_cfg())
  expect_true(v$aplica)
  expect_identical(v$aviso_anonimato, "")
})

# =============================================================================
# El detalle: una fila por alumno, con hora y curso-horario
# =============================================================================
#
# Gonzalo, 2026-09-22, comparando con acreditación: «esto debe ser más
# específico, ¿has revisado cómo lo hace acreditación? Es bastante específico
# con hora y todo». Su tabla de casos de plataforma publica actor/caso, estado,
# FECHA Y HORA, canal y cruce, una fila por caso. El agregado por carrera
# contesta «cuántos» y no «quién, cuándo y desde qué curso-horario», que es con
# lo que se comprueba una respuesta concreta.

.mcc_respuestas <- function() data.frame(
  start = c("2026-09-22T09:10:00", "2026-09-22T11:40:00", "2026-09-22T09:12:00",
            "2026-09-21T15:00:00", "2026-09-22T08:00:00", "2026-09-22T08:05:00",
            "2026-09-22T08:07:00"),
  stringsAsFactors = FALSE
)

.mcc_aulas <- function() c("CH 45", "CH 7", "CH 45", "CH 26", "CH 45", "CH 45", "CH 45")

test_that("cada fila trae a quien respondio, cuando y desde que curso-horario", {
  v <- monitoreo_aulas_cruce_por_carrera(
    .mcc_resueltas(), cfg = .mcc_cfg(),
    responses = .mcc_respuestas(), aulas = .mcc_aulas())
  expect_identical(length(v$alumnos), 7L)
  uno <- Filter(function(a) identical(a$codigo, "20190002"), v$alumnos)[[1]]
  expect_identical(uno$carrera, "ECONOMÍA")
  expect_identical(uno$nivel, "7")
  expect_identical(uno$fecha, "2026-09-22")
  expect_identical(uno$hora, "11:40")
  expect_identical(uno$curso_horario, "CH 7")
  expect_identical(uno$estado, "identificado")
})

test_that("la mas reciente primero: es el orden con el que se comprueba lo que acaba de pasar", {
  v <- monitoreo_aulas_cruce_por_carrera(
    .mcc_resueltas(), cfg = .mcc_cfg(),
    responses = .mcc_respuestas(), aulas = .mcc_aulas())
  horas <- vapply(v$alumnos, function(a) paste(a$fecha, a$hora), character(1))
  expect_identical(horas, sort(horas, decreasing = TRUE))
  expect_identical(v$alumnos[[1]]$hora, "11:40")
})

test_that("tres estados, no dos: repetida CRUZO y no cuenta", {
  # Meter la repetida con las que no se identificaron mandaría a revisar el
  # código de quien lo escribió bien.
  v <- monitoreo_aulas_cruce_por_carrera(
    .mcc_resueltas(), cfg = .mcc_cfg(),
    responses = .mcc_respuestas(), aulas = .mcc_aulas())
  estados <- table(vapply(v$alumnos, function(a) a$estado, character(1)))
  expect_identical(unname(estados[["identificado"]]), 3L)
  expect_identical(unname(estados[["repetida"]]), 1L)
  expect_identical(unname(estados[["sin_identificar"]]), 3L)
  # Y la que no se identificó lleva su motivo con la frase que dice dónde se
  # arregla, no sólo la clave.
  sin <- Filter(function(a) identical(a$estado, "sin_identificar"), v$alumnos)
  expect_true(all(vapply(sin, function(a) nzchar(a$motivo_etiqueta), logical(1))))
  # Y la identificada NO lleva motivo: un motivo vacío es ruido en cada fila.
  ident <- Filter(function(a) identical(a$estado, "identificado"), v$alumnos)
  expect_true(all(vapply(ident, function(a) identical(a$motivo, ""), logical(1))))
})

test_that("sin respuestas el detalle sale sin fecha, no se omite", {
  # La fila sigue diciendo quién y de qué carrera: el dato que falta es la hora.
  v <- monitoreo_aulas_cruce_por_carrera(.mcc_resueltas(), cfg = .mcc_cfg())
  expect_identical(length(v$alumnos), 7L)
  expect_true(all(vapply(v$alumnos, function(a) identical(a$fecha, ""), logical(1))))
})

test_that("el tope se declara y se dice cuando recorta", {
  # Recortar en silencio haría creer que el operativo tiene las filas que se ven.
  v <- monitoreo_aulas_cruce_por_carrera(
    .mcc_resueltas(), cfg = .mcc_cfg(),
    responses = .mcc_respuestas(), aulas = .mcc_aulas(), tope = 3L)
  expect_identical(length(v$alumnos), 3L)
  expect_true(v$truncado)
  expect_identical(v$tope, 3L)
  # Y el TOTAL sigue siendo el de todas: el tope es de la tabla, no del conteo.
  expect_identical(v$total$consideradas, 7L)
})

test_that("`elegible` acota tambien el detalle, y sin desalinear la fecha", {
  # El riesgo real: `responses` viene sin filtrar y `sub` sí, así que emparejar
  # por posición sin aplicar la misma máscara le pondría a cada fila la hora de
  # otra. Aquí la primera respuesta es de las 09:10 y la cuarta de ayer.
  v <- monitoreo_aulas_cruce_por_carrera(
    .mcc_resueltas(), elegible = c(FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE),
    cfg = .mcc_cfg(), responses = .mcc_respuestas(), aulas = .mcc_aulas())
  expect_identical(length(v$alumnos), 1L)
  expect_identical(v$alumnos[[1]]$codigo, "20190003")
  expect_identical(v$alumnos[[1]]$fecha, "2026-09-21")
  expect_identical(v$alumnos[[1]]$curso_horario, "CH 26")
})
