source("setup-load-all.R")

.arx_test_inst <- function(child = FALSE) {
  if (!child) {
    return(list(
      survey = data.frame(
        type = c("select_one sexo", "text"),
        name = c("sexo", "sexo_recod"),
        label = c("Sexo", "Sexo recodificado"),
        stringsAsFactors = FALSE, check.names = FALSE
      ),
      choices = data.frame(
        list_name = c("sexo", "sexo"), name = c("1", "2"),
        label = c("Mujer", "Hombre"), stringsAsFactors = FALSE,
        check.names = FALSE
      )
    ))
  }
  list(
    survey = data.frame(
      type = c("select_one claridad", "text", "select_one sexo"),
      name = c("srv_claridad", "srv_claridad_recod", "sexo"),
      label = c("Claridad del servicio", "Claridad recodificada", "Sexo"),
      parent_inherited = c(FALSE, FALSE, TRUE),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("claridad", "claridad", "sexo", "sexo"),
      name = c("1", "2", "1", "2"),
      label = c("Clara", "Poco clara", "Mujer", "Hombre"),
      stringsAsFactors = FALSE, check.names = FALSE
    )
  )
}

.arx_test_session <- function() {
  sid <- session_create()
  parent <- data.frame(
    `_index` = c("e1", "e2", "e3"),
    sexo = c("1", "2", "1"),
    sexo_recod = c("mujer", "hombre", "mujer"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  child <- data.frame(
    `_index` = c("r1", "r2", "r3", "r4"),
    `_parent_index` = c("e1", "e1", "e2", "e3"),
    srv_claridad = c("1", "2", "1", "1"),
    srv_claridad_recod = c("clara", "poco_clara", "clara", "clara"),
    sexo = c("1", "1", "2", "1"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  attr(child$sexo, "repeat_inherited") <- TRUE

  estudio_add_base(
    sid, "principal", "xls-parent", "data-parent", "xlsx",
    parent, .arx_test_inst(FALSE), nrow(parent), ncol(parent)
  )
  estudio_add_base(
    sid, "rep_servicios", "xls-child", "data-child", "xlsx",
    child, .arx_test_inst(TRUE), nrow(child), ncol(child),
    extra_meta = list(
      source_kind = "kobo_repeat", parent_base = "principal",
      repeat_group = "rep_servicios", link_key = "_parent_index",
      parent_index_key = "_index"
    )
  )
  list(sid = sid, parent = parent, child = child)
}

test_that("el Excel estándar madre-repeat es un libro relacional de cuatro hojas", {
  skip_if_not_installed("openxlsx")
  fixture <- .arx_test_session()
  on.exit(session_delete(fixture$sid), add = TRUE)
  path <- tempfile(fileext = ".xlsx")

  built <- .analitica_relational_write_xlsx(
    sid = fixture$sid,
    data_sources = list(principal = fixture$parent, rep_servicios = fixture$child),
    inst_sources = list(principal = .arx_test_inst(FALSE), rep_servicios = .arx_test_inst(TRUE)),
    cfg = .analitica_default_config(),
    path_xlsx = path
  )

  expect_true(file.exists(path))
  expect_equal(
    openxlsx::getSheetNames(path),
    c("encuestas_codigos", "encuestas_etiquetas", "servicios_codigos", "servicios_etiquetas")
  )
  expect_equal(unlist(built$rows, use.names = FALSE), c(3L, 4L))

  surveys <- openxlsx::read.xlsx(path, sheet = "encuestas_codigos", check.names = FALSE)
  responses <- openxlsx::read.xlsx(path, sheet = "servicios_codigos", check.names = FALSE)
  expect_equal(nrow(surveys), 3L)
  expect_equal(nrow(responses), 4L)
  expect_true("id_encuesta" %in% names(surveys))
  expect_true(all(c("id_encuesta", "id_respuesta") %in% names(responses)))
  expect_true("sexo_recod" %in% names(surveys))
  expect_true("srv_claridad_recod" %in% names(responses))
  expect_equal(anyDuplicated(surveys$id_encuesta), 0L)
  expect_equal(anyDuplicated(responses$id_respuesta), 0L)
  expect_true(all(responses$id_encuesta %in% surveys$id_encuesta))
  expect_false(any(c("_index", "_parent_index", "sexo") %in% names(responses)))

  survey_labels <- openxlsx::read.xlsx(
    path, sheet = "encuestas_etiquetas", startRow = 3L, colNames = FALSE
  )
  response_labels <- openxlsx::read.xlsx(
    path, sheet = "servicios_etiquetas", startRow = 3L, colNames = FALSE
  )
  expect_equal(nrow(survey_labels), 3L)
  expect_equal(nrow(response_labels), 4L)
})

test_that("la fuente codificada multibase se resuelve POR BASE, no exige todas", {
  fixture <- .arx_test_session()
  on.exit(session_delete(fixture$sid), add = TRUE)
  s <- session_get(fixture$sid)
  s$files <- list(
    `xls-parent` = list(kind = "instrumento_adaptado"),
    `data-parent` = list(kind = "data_adaptada"),
    `xls-child` = list(kind = "xlsform"),
    `data-child` = list(kind = "data")
  )
  s$analitica_config <- .analitica_default_config()
  s$analitica_config$fuente_preferida <- "adaptados"
  .session_env[[fixture$sid]] <- s

  # Madre adaptada + hija sin par adaptado: el estudio prefiere adaptados (antes
  # caía a originales por exigir TODAS). `.analitica_all_bases_adapted` sigue
  # siendo un predicado estricto de completitud y devuelve FALSE.
  expect_false(.analitica_all_bases_adapted(s))
  expect_equal(.analitica_effective_source(s, s$analitica_config), "adaptados")

  # Fuente POR BASE: la madre resuelve su par adaptado; la hija, su original.
  madre_pair <- .analitica_pair_for_base(
    s, s$estudio$bases$principal, "adaptados", "principal"
  )
  expect_equal(madre_pair$xls$kind, "instrumento_adaptado")
  expect_equal(madre_pair$data$kind, "data_adaptada")
  hija_pair <- .analitica_pair_for_base(
    s, s$estudio$bases$rep_servicios, "adaptados", "rep_servicios"
  )
  expect_equal(hija_pair$xls$kind, "xlsform")
  expect_equal(hija_pair$data$kind, "data")

  # `fuente_preferida = "originales"` explícito fuerza original en todas.
  expect_equal(
    .analitica_effective_source(
      s, modifyList(s$analitica_config, list(fuente_preferida = "originales"))
    ),
    "originales"
  )

  # Ambas adaptadas: el estudio sigue en adaptados y ahora sí completo.
  s$files[["xls-child"]]$kind <- "instrumento_adaptado"
  s$files[["data-child"]]$kind <- "data_adaptada"
  .session_env[[fixture$sid]] <- s
  expect_true(.analitica_all_bases_adapted(s))
  expect_equal(.analitica_effective_source(s, s$analitica_config), "adaptados")
})

test_that("la ficha repeat declara respuestas y encuestas sin llamarlas casos", {
  grain <- list(
    kind = "instancia", n_instancias = 667L, n_personas = 426L,
    repeat_group = "servicios"
  )
  inst <- list(survey = data.frame())
  inst$repeat_grain <- grain
  rows <- .ficha_tecnica_rows(
    data = data.frame(respuesta = seq_len(667L)),
    instrumento = inst,
    cfg = list(fuente_preferida = "adaptados")
  )
  value <- rows$Detalle[rows$Campo == "Tamano de la muestra"]
  expect_match(value, "667 respuestas")
  expect_match(value, "426 encuestas")
  expect_false(grepl("casos|personas", value, ignore.case = TRUE))
})
