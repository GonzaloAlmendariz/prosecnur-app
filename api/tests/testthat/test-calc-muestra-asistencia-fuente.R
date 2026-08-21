.asf_engine_existe <- function() {
  exists("calc_muestra_asistencia_referencia", mode = "function", inherits = TRUE)
}

.asf_capturar_error <- function(datos) {
  fn <- get("calc_muestra_asistencia_referencia", mode = "function", inherits = TRUE)
  tryCatch(
    fn(
      datos,
      estudio = list(
        id = "estudio-sintetico",
        label = "Estudio sintético",
        periodo = "2026-I",
        fuente = "fixture_sintetico"
      ),
      bootstrap_n = 20L
    ),
    error = identity
  )
}

.asf_celda_agregada <- function() {
  list(
    celda_key = "T2",
    celda_label = "15-24",
    orden = 2L,
    k = 2L,
    matriculados = 40L,
    asistentes = 28L,
    tasa = 0.7,
    estimador = "razon_agregada",
    media_ch = 0.7,
    sd_ch = 0,
    ic_low = 0.7,
    ic_high = 0.7,
    metodo_ic = "bootstrap_percentil",
    suficiencia = "delgada",
    tasa_publicada = 0.7,
    k_publicada = 2L,
    fuente_publicada = "celda",
    # Contaminantes deliberados: el saneo debe retirarlos sin borrar la celda.
    classroom_id = c("CH-001", "CH-002"),
    unique_student_ids = list(c("persona-001", "persona-002")),
    rows = data.frame(classroom_id = "CH-001", stringsAsFactors = FALSE)
  )
}

.asf_resumen_contaminado <- function() {
  list(
    schema = "calc_muestra_referencia_asistencia_v1",
    owner = "estudio_historico_externo",
    momento = "post_hoc_estudio_previo",
    transferible = "modelo_por_celda",
    modelo = "marginales_independientes",
    combinable = FALSE,
    unidad = "curso_horario_aplicado",
    denominador = "matriculados_totales",
    estudio = list(
      id = "estudio-sintetico",
      label = "Estudio sintético",
      periodo = "2026-I",
      fuente = "fixture_sintetico"
    ),
    cobertura = list(agendados = 2L, aplicados = 2L, observados = 2L),
    identidad = list(
      regla = "A = E + no_respondieron",
      verificada = TRUE,
      verificables = 2L,
      inconsistentes = 0L
    ),
    umbrales = list(
      insuficiente_max = 11L,
      delgada_min = 12L,
      solida_min = 30L,
      bootstrap_n = 20L,
      nivel_ic = 0.95,
      quantile_type = 7L
    ),
    cadena = list(),
    global = list(
      k = 2L,
      matriculados = 40L,
      asistentes = 28L,
      enviadas = 24L,
      validas = 22L,
      no_respondieron = 4L,
      tasa = 0.7,
      media_ch = 0.7,
      sd_ch = 0,
      ic_low = 0.7,
      ic_high = 0.7,
      metodo_ic = "bootstrap_percentil"
    ),
    dimensiones = list(list(
      dimension_key = "tamano",
      dimension_label = "Tamaño",
      orden = 1L,
      filas = list(.asf_celda_agregada())
    )),
    advertencias = list("marginales_no_combinables"),
    # Contenedores raw ajenos al schema: ninguno debe persistir.
    rows = data.frame(classroom_id = "CH-001", stringsAsFactors = FALSE),
    filas = list(list(classroom_id = "CH-001")),
    raw = list(classroom_id = "CH-001"),
    data = data.frame(unique_student_ids = "persona-001", stringsAsFactors = FALSE),
    tabla_raw = list(unique_student_ids = list("persona-001")),
    classroom_id = "CH-001",
    unique_student_ids = list("persona-001")
  )
}

.asf_nombres_recursivos <- function(x) {
  if (!is.list(x)) return(character(0))
  c(names(x), unlist(lapply(unname(x), .asf_nombres_recursivos), use.names = FALSE))
}

.asf_binding_referencia <- function(file_meta) {
  list(
    id = "src-referencia-asistencia",
    role = "referencia_asistencia",
    label = "Referencia de asistencia",
    status = "cargada",
    file_id = file_meta$file_id,
    file_name = file_meta$original_name,
    sheet_name = "Base de control",
    available_sheets = list("Base de control"),
    suggested_sheet = "Base de control",
    detected_role = "referencia_asistencia",
    compatibility_status = "compatible",
    sheet_diagnostics = list(list(
      name = "Base de control",
      role = "referencia_asistencia",
      columns_sample = list("curso_horario", "matriculados", "asistieron", "enviadas")
    )),
    rows = 2L,
    columns = 4L,
    notes = "Fixture sintético sin datos reales"
  )
}

test_that("session_schema censa la referencia de asistencia", {
  clave <- "calc_muestra_referencia_asistencia"

  expect_true(
    clave %in% session_schema()$clave,
    info = paste("Falta la clave persistible en session_schema():", clave)
  )
})

test_that("precedencias existentes conservan agenda y catálogo sin métricas", {
  base_control <- data.frame(
    curso_horario = "CH-001",
    horario = "08:00",
    matriculados = 30L,
    asistieron = 24L,
    enviadas = 20L,
    stringsAsFactors = FALSE
  )
  catalogo <- data.frame(
    curso_horario = "CH-002",
    horario = "10:00",
    docente = "Docente sintético",
    stringsAsFactors = FALSE
  )

  expect_identical(.cm_aulas_sheet_role("Aplicación", base_control)$role, "agenda")
  expect_identical(
    .cm_aulas_sheet_role("CURSO Y HORARIO", catalogo)$role,
    "catalogo_curso_horario"
  )
})

test_that("engine tipa input vacío y columnas faltantes sin ocultar las encontradas", {
  if (!.asf_engine_existe()) {
    skip("Contrato pendiente: falta calc_muestra_asistencia_referencia()")
  }

  vacio <- .asf_capturar_error(data.frame())
  expect_s3_class(vacio, "api_error")
  expect_identical(vacio$code, "E_CALC_MUESTRA_ASISTENCIA_INPUT")

  incompleto <- .asf_capturar_error(data.frame(
    curso_horario = "CH-001",
    stringsAsFactors = FALSE
  ))
  expect_s3_class(incompleto, "api_error")
  expect_identical(incompleto$code, "E_CALC_MUESTRA_ASISTENCIA_COLUMNS")
  # El mensaje ya no enumera las columnas encontradas —con una base de campo
  # real son ~140 y sepultaban el dato accionable—: nombra lo que FALTA con sus
  # alias y cuenta cuantas trae la hoja. La lista completa sigue en `details`,
  # que es lo que este test cuidaba.
  expect_match(conditionMessage(incompleto), "no trae", fixed = TRUE)
  expect_match(conditionMessage(incompleto), "La hoja tiene", fixed = TRUE)
  expect_false(grepl("Columnas encontradas", conditionMessage(incompleto), fixed = TRUE))
  expect_true("curso_horario" %in% unlist(incompleto$details$encontradas))
})

test_that("state payload es retrocompatible y hace eco exacto del resumen", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  expect_null(.cm_state_payload(sid)$referencia_asistencia)
  resumen <- .asf_resumen_contaminado()
  session_set(sid, "calc_muestra_referencia_asistencia", resumen)
  expect_identical(
    .cm_state_payload(sid)$referencia_asistencia,
    resumen,
    info = "El state payload no expone calc_muestra_referencia_asistencia como referencia_asistencia"
  )
})

test_that(".pulso conserva el resumen agregado Y el archivo de la referencia", {
  skip_if_not_installed("zip")
  skip_if_not_installed("jsonlite")
  sid <- session_create()
  loaded_sid <- NULL
  pulso <- tempfile(fileext = ".pulso")
  on.exit({
    unlink(pulso, force = TRUE)
    session_delete(sid)
    if (!is.null(loaded_sid)) session_delete(loaded_sid)
  }, add = TRUE)

  raw_meta <- save_upload(
    sid,
    "data",
    "referencia_asistencia_sintetica.xlsx",
    as.raw(c(0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00))
  )
  estudio <- calc_muestra_normalize_estudio(list(
    titulo = "Persistencia sintética",
    workspace = list(
      source_mode = "dos_bases",
      source_bindings = list(.asf_binding_referencia(raw_meta))
    )
  ))
  session_set(sid, "calc_muestra_estudio", estudio)
  session_set(sid, "calc_muestra_referencia_asistencia", .asf_resumen_contaminado())

  build_pulso(sid, pulso, project_name = "Referencia sintética")
  zip_entries <- zip::zip_list(pulso)$filename
  loaded <- load_pulso(pulso)
  loaded_sid <- loaded$session_id
  restored <- session_get(loaded_sid)

  # MUDADO 2026-08-21 — antes se exigia lo contrario. El archivo de la
  # referencia VIAJA: sin el, quien recibe el proyecto tiene los agregados
  # pero no puede re-derivar nada, y para empezar uno nuevo tiene que conseguir
  # el xlsx por su cuenta (de los ocho candidatos del estudio real, uno pasa el
  # validador). Lo que el motor acepta es un agregado por AULA, sin filas por
  # estudiante, asi que viaja con la misma anonimidad que el resumen.
  raw_presente <- any(grepl(raw_meta$file_id, zip_entries, fixed = TRUE)) &&
    (raw_meta$file_id %in% names(restored$files %||% list()))
  expect_true(
    raw_presente,
    info = paste("El archivo de referencia_asistencia NO viaja en el .pulso:", raw_meta$file_id)
  )

  resumen <- restored$calc_muestra_referencia_asistencia
  expect_identical(resumen$schema, "calc_muestra_referencia_asistencia_v1")
  expect_identical(resumen$global$matriculados, 40L)
  expect_length(resumen$dimensiones[[1L]]$filas, 1L)
  celda <- resumen$dimensiones[[1L]]$filas[[1L]]
  campos_celda <- c(
    "celda_key", "celda_label", "orden", "k", "matriculados", "asistentes",
    # G53 · La ventana temporal de la celda. Es agregado, no fila: dice en qué
    # tramo del campo se aplicó, que es lo que permite leer su tasa sin
    # confundirla con una propiedad de la facultad.
    "semana_min", "semana_max", "semana_media", "k_con_semana",
    # B2/ADR 0060: la marca de desborde viaja con la tasa de la celda (una
    # tasa imposible se persiste como NA + residual_negativo, nunca > 1).
    "tasa", "residual_negativo", "estimador", "media_ch", "sd_ch",
    "ic_low", "ic_high",
    "metodo_ic", "suficiencia", "tasa_publicada", "k_publicada",
    "fuente_publicada"
  )
  expect_identical(
    names(celda),
    campos_celda,
    info = "La celda agregada no fue saneada a sus 22 campos canónicos"
  )
  contaminantes_root <- intersect(
    c("rows", "filas", "raw", "data", "tabla_raw"),
    names(resumen)
  )
  pii <- intersect(
    c("classroom_id", "unique_student_ids"),
    .asf_nombres_recursivos(resumen)
  )
  expect_true(
    length(contaminantes_root) == 0L && length(pii) == 0L,
    info = paste(
      "El resumen persistido conserva filas raw/PII:",
      paste(unique(c(contaminantes_root, pii)), collapse = ", ")
    )
  )

  binding <- restored$calc_muestra_estudio$workspace$source_bindings[[1L]]
  expect_identical(binding$role, "referencia_asistencia")
  expect_identical(binding$label, "Referencia de asistencia")
  expect_identical(binding$sheet_name, "Base de control")
  # MUDADO 2026-08-21: el binding YA NO se degrada. Antes se vaciaba su file_id
  # y su archivo no entraba al zip, asi que la referencia sobrevivia sin su
  # fuente. Gonzalo: «ademas el historico debe viajar con el .pulso».
  expect_true(
    !is.null(binding$file_id) && nzchar(binding$file_id),
    info = sprintf(
      "El binding de referencia_asistencia perdio su file_id: %s",
      as.character(binding$file_id %||% "<NULL>")
    )
  )
  expect_true(
    !is.null(binding$file_name) && nzchar(binding$file_name),
    info = "El binding de referencia_asistencia perdio el nombre de su archivo."
  )
  expect_false(identical(binding$status, "pendiente"))
})

test_that("un .pulso previo a referencia_asistencia abre con payload NULL", {
  skip_if_not_installed("zip")
  skip_if_not_installed("jsonlite")
  sid <- session_create()
  loaded_sid <- NULL
  pulso <- tempfile(fileext = ".pulso")
  on.exit({
    unlink(pulso, force = TRUE)
    session_delete(sid)
    if (!is.null(loaded_sid)) session_delete(loaded_sid)
  }, add = TRUE)

  build_pulso(sid, pulso, project_name = "Proyecto previo sintético")
  loaded <- load_pulso(pulso)
  loaded_sid <- loaded$session_id
  expect_null(.cm_state_payload(loaded_sid)$referencia_asistencia)
})

test_that("una Base de control se clasifica como referencia de asistencia", {
  base_control <- data.frame(
    curso_horario = "CH-001",
    horario = "08:00",
    matriculados = 30L,
    asistieron = 24L,
    enviadas = 20L,
    stringsAsFactors = FALSE
  )

  clasificacion <- .cm_aulas_sheet_role("Base de control", base_control)

  expect_identical(
    clasificacion$role,
    "referencia_asistencia",
    info = paste(
      "La hoja Base de control con curso_horario/matriculados/asistieron/enviadas fue clasificada como",
      clasificacion$role,
      "en vez de referencia_asistencia"
    )
  )
})
