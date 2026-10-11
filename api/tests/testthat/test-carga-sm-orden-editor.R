# Import SurveyMonkey por API con un formulario del editor que reordenó
# opciones (checklist 2026-10-11, H2/H3).
#
# El import por API codifica cada respuesta POR ETIQUETA contra el instrumento
# que registra. Los mapas de códigos del editor (nacidos para el .sav, donde SM
# exporta códigos por posición) aplicados después sobre esos datos desalineaban
# código y etiqueta: quien respondió «Nunca» quedaba con el código que en el
# instrumento de la base dice «A veces». Aquí corre la codificación real
# (`sm_api_xlsform` + `sm_multibase_api_responses_to_canonical_data`); solo se
# simula la red.

.sor_mock <- function(name, value) {
  env <- asNamespace("prosecnurapp")
  previous <- get(name, envir = env)
  locked <- bindingIsLocked(name, env)
  if (locked) unlockBinding(name, env)
  assign(name, value, envir = env)
  if (locked) lockBinding(name, env)
  function() {
    if (bindingIsLocked(name, env)) unlockBinding(name, env)
    assign(name, previous, envir = env)
    if (locked) lockBinding(name, env)
  }
}

# La API devuelve las opciones en un orden distinto al del constructor.
.sor_details <- function(survey_id = "sm_orden") {
  opcion <- function(id, text, pos) list(id = id, text = text, position = pos)
  list(id = survey_id, title = "Encuesta orden", pages = list(list(id = "pg1", questions = list(
    list(id = "q1", family = "single_choice", subtype = "vertical",
         headings = list(list(heading = "¿Con qué frecuencia usa la biblioteca?")),
         answers = list(choices = list(opcion("c11", "Siempre", 1L), opcion("c12", "Nunca", 2L), opcion("c13", "A veces", 3L)))),
    list(id = "q2", family = "multiple_choice", subtype = "vertical",
         headings = list(list(heading = "¿Qué servicios usa?")),
         answers = list(choices = list(opcion("c21", "Préstamo", 1L), opcion("c22", "Ninguno", 2L), opcion("c23", "Sala", 3L))))
  ))))
}

.sor_responses <- function() {
  resp <- function(id, p1, p2) list(id = id, response_status = "completed", pages = list(list(id = "pg1", questions = list(
    list(id = "q1", answers = list(list(choice_id = p1))),
    list(id = "q2", answers = lapply(p2, function(ch) list(choice_id = ch)))
  ))))
  list(resp("r1", "c12", c("c21", "c23")), resp("r2", "c13", "c22"), resp("r3", "c11", "c23"))
}

.sor_mocks <- function() {
  list(
    .sor_mock(".connections_token_require", function(...) "tok"),
    .sor_mock("sm_api_fetch_survey_details", function(survey_id, token, ...) .sor_details(survey_id)),
    .sor_mock("sm_api_fetch_all_responses_bulk", function(survey_id, token, ...) list(data = .sor_responses()))
  )
}

# Lo que eligió cada persona en SurveyMonkey.
.sor_esperado_p1 <- c("Nunca", "A veces", "Siempre")
.sor_esperado_p2 <- list(c("Préstamo", "Sala"), "Ninguno", "Sala")

# Mapas tal como los arma el asistente de reglas al reordenar: código SM por
# posición (source) → código del formulario del editor (xls).
.sor_item <- function(src, src_lab, xls, xls_lab = src_lab) {
  list(source_code = src, source_label = src_lab, xls_code = xls, xls_label = xls_lab)
}
.sor_mapas_editor <- function() {
  list(
    list(variable = "p1", type = "select_one", list_name = "lst_p1", mappings = list(
      .sor_item("1", "Siempre", "1"), .sor_item("2", "Nunca", "3"), .sor_item("3", "A veces", "2"))),
    list(variable = "p2", type = "select_multiple", list_name = "lst_p2", mappings = list(
      .sor_item("1", "Préstamo", "1"), .sor_item("2", "Ninguno", "3"), .sor_item("3", "Sala", "2")))
  )
}
.sor_form <- function(survey_id = "sm_orden", maps = .sor_mapas_editor()) {
  list(source = list(survey_id = survey_id),
       workbook = list(surveyMonkeyLogic = list(choice_code_maps = maps)))
}

# Etiquetas que el instrumento REGISTRADO en la base da a los códigos guardados.
.sor_etiquetas <- function(sid, xlsform_file_id, data) {
  inst <- reporte_instrumento(path = session_get(sid)$files[[xlsform_file_id]]$path)
  ch <- as.data.frame(inst$choices)
  lab_col <- intersect(c("label::es", "label"), names(ch))[1]
  lab <- function(lista, code) as.character(ch[[lab_col]][ch$list_name == lista & ch$name == code])
  # rp_data expande la select_multiple en dummies `p2.<código>`.
  if (!"p2" %in% names(data)) {
    dummies <- grep("^p2\\.", names(data), value = TRUE)
    data$p2 <- vapply(seq_len(nrow(data)), function(i) {
      marcados <- dummies[vapply(dummies, function(d) isTRUE(suppressWarnings(as.numeric(as.character(data[[d]][i]))) == 1), TRUE)]
      paste(sort(sub("^p2\\.", "", marcados)), collapse = " ")
    }, "")
  }
  p1 <- vapply(as.character(data$p1), function(cd) paste(lab("lst_p1", cd), collapse = "|"), "", USE.NAMES = FALSE)
  p2 <- lapply(as.character(data$p2), function(v) vapply(strsplit(v, " ")[[1]], function(cd) paste(lab("lst_p2", cd), collapse = "|"), "", USE.NAMES = FALSE))
  list(p1 = p1, p2 = p2)
}

.sor_check <- function(sid, xlsform_file_id, data, etapa) {
  et <- .sor_etiquetas(sid, xlsform_file_id, data)
  expect_equal(et$p1, .sor_esperado_p1, info = etapa)
  expect_equal(et$p2, .sor_esperado_p2, info = etapa)
}

test_that("base única: un reordenamiento del editor deja código y etiqueta coherentes en todas las etapas", {
  restores <- .sor_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .sor_form())

  out <- .carga_import_surveymonkey(sid, list(survey_id = "sm_orden"))
  s <- session_get(sid)
  archivo <- as.data.frame(readxl::read_excel(s$files[[out$data_file_id]]$path))

  # Los códigos son los del editor (su orden), en select_one y select_multiple.
  expect_equal(as.character(archivo$p1), c("3", "2", "1"))
  expect_equal(as.character(archivo$p2), c("1 2", "3", "2"))

  .sor_check(sid, out$xlsform_file_id, archivo, "archivo")
  .sor_check(sid, out$xlsform_file_id, as.data.frame(s$rp_data_sources$default), "rp_data default")
  .sor_check(sid, out$xlsform_file_id, as.data.frame(.carga_normalized_data_for_export(sid, "default")$data), "Ver base")

  destino <- tempfile(fileext = ".pulso")
  on.exit(unlink(destino), add = TRUE)
  build_pulso(sid, destino, project_name = "sor")
  re <- load_pulso(destino)
  on.exit(session_delete(re$session_id), add = TRUE)
  base_re <- session_get(re$session_id)$estudio$bases$default
  .sor_check(re$session_id, base_re$xlsform_file_id %||% out$xlsform_file_id,
             as.data.frame(.carga_normalized_data_for_export(re$session_id, "default")$data), "reabierto")
})

test_that("bases separadas: el reordenamiento del editor deja código y etiqueta coherentes", {
  restores <- .sor_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .sor_form())

  out <- .carga_import_surveymonkey_separate(sid, list(survey_id = "sm_orden"))
  archivo <- as.data.frame(readxl::read_excel(session_get(sid)$files[[out$data_file_id]]$path))
  expect_equal(as.character(archivo$p1), c("3", "2", "1"))
  .sor_check(sid, out$xlsform_file_id, archivo, "archivo separadas")
})

test_that("sin formulario de la misma encuesta, los códigos son los de la plataforma y calzan", {
  restores <- .sor_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .sor_form(survey_id = "otra_encuesta"))

  out <- .carga_import_surveymonkey(sid, list(survey_id = "sm_orden"))
  archivo <- as.data.frame(readxl::read_excel(session_get(sid)$files[[out$data_file_id]]$path))
  expect_equal(as.character(archivo$p1), c("2", "3", "1"))
  .sor_check(sid, out$xlsform_file_id, archivo, "otra encuesta")
})

test_that("un mapa cuyas etiquetas no calzan con la encuesta no toca la lista y avisa", {
  restores <- .sor_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  maps <- .sor_mapas_editor()
  maps[[1]]$mappings[[2]]$source_label <- "Jamás"
  maps[[1]]$mappings[[2]]$xls_label <- "Jamás"
  session_set(sid, "xlsform_state", .sor_form(maps = maps))

  out <- .carga_import_surveymonkey(sid, list(survey_id = "sm_orden"))
  archivo <- as.data.frame(readxl::read_excel(session_get(sid)$files[[out$data_file_id]]$path))
  .sor_check(sid, out$xlsform_file_id, archivo, "mapa que no calza")
  base <- session_get(sid)$estudio$bases$default
  expect_true("p1" %in% unlist(base$choice_order_editor$omitidas %||% list()))
  expect_true("p2" %in% unlist(base$choice_order_editor$adoptadas %||% list()))
})

test_that("adoptar el orden reescribe la lógica que cita los códigos y no toca la de otras variables", {
  model <- list(
    survey = tibble::tibble(
      type = c("select_one lst_p3", "text", "select_one lst_p4", "text"),
      name = c("p3", "p3_otro", "p4", "p4_otro"),
      `label::es` = c("Sexo", "Otro sexo", "Cargo", "Otro cargo"),
      relevant = c(NA, "${p3} = '4'", NA, "selected(${p4}, '2') or ${p3} != '3'")
    ),
    choices = tibble::tibble(
      list_name = c(rep("lst_p3", 4), rep("lst_p4", 2)),
      name = c("1", "2", "3", "4", "1", "2"),
      `label::es` = c("Masculino", "Femenino", "Prefiero no responder", "Otro (especifique)", "Docente", "Otro")
    )
  )
  maps <- list(list(variable = "p3", list_name = "lst_p3", mappings = list(
    .sor_item("1", "Masculino", "1"), .sor_item("2", "Femenino", "2"),
    .sor_item("3", "Prefiero no responder", "4"), .sor_item("4", "Otro (especifique)", "3"))))
  out <- .carga_sm_adoptar_orden_editor(model, maps)
  expect_equal(unlist(out$resumen$adoptadas), "p3")
  expect_equal(out$model$survey$relevant[2], "${p3} = '3'")
  expect_equal(out$model$survey$relevant[4], "selected(${p4}, '2') or ${p3} != '4'")
  ch <- out$model$choices[out$model$choices$list_name == "lst_p3", ]
  expect_equal(ch$name, c("1", "2", "3", "4"))
  expect_equal(ch$`label::es`, c("Masculino", "Femenino", "Otro (especifique)", "Prefiero no responder"))
  # La lista de otra variable no cambia.
  expect_equal(out$model$choices$name[5:6], c("1", "2"))
})

test_that("una lógica que usa los códigos de forma no reescribible deja la lista intacta y lo declara", {
  model <- list(
    survey = tibble::tibble(type = c("select_one lst_p1", "text"), name = c("p1", "p1b"),
                            `label::es` = c("P1", "P1b"), relevant = c(NA, "${p1} > 2")),
    choices = tibble::tibble(list_name = "lst_p1", name = c("1", "2", "3"), `label::es` = c("A", "B", "C"))
  )
  maps <- list(list(variable = "p1", list_name = "lst_p1", mappings = list(
    .sor_item("1", "A", "1"), .sor_item("2", "B", "3"), .sor_item("3", "C", "2"))))
  out <- .carga_sm_adoptar_orden_editor(model, maps)
  expect_length(out$resumen$adoptadas, 0L)
  expect_equal(out$resumen$omitidas[[1]]$variable, "p1")
  expect_identical(out$model, model)
})

test_that("refrescar («Traer respuestas») conserva los códigos del editor y la marca de la base", {
  restores <- .sor_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .sor_form())
  .carga_import_surveymonkey(sid, list(survey_id = "sm_orden"))

  snap <- .sm_mb_prepare_refresh_snapshot(sid, "default", list(survey_id = "sm_orden"), "tok")
  expect_equal(unlist(snap$choice_order_editor$adoptadas), c("p1", "p2"))
  expect_equal(as.character(snap$remote_df$p1), c("3", "2", "1"))
  ch <- as.data.frame(snap$rp_inst$choices)
  lab_col <- intersect(c("label::es", "label"), names(ch))[1]
  p1 <- ch[ch$list_name == "lst_p1", ]
  expect_equal(as.character(p1[[lab_col]][match(c("3", "2", "1"), p1$name)]), .sor_esperado_p1)
})

test_that("Carga › Revisión declara las preguntas que adoptaron el orden y las que no, sin bloquear", {
  restores <- .sor_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  maps <- .sor_mapas_editor()
  maps[[1]]$mappings[[2]]$source_label <- "Jamás"
  maps[[1]]$mappings[[2]]$xls_label <- "Jamás"
  session_set(sid, "xlsform_state", .sor_form(maps = maps))
  .carga_import_surveymonkey(sid, list(survey_id = "sm_orden"))

  review <- .carga_review_payload(sid, NULL)
  expect_equal(unlist(review$orden_editor$adoptadas), "p2")
  expect_equal(review$orden_editor$omitidas[[1]]$variable, "p1")
  expect_true(nzchar(review$orden_editor$omitidas[[1]]$motivo))
  expect_false(isTRUE(review$choice_mapping$pending))

  # Sin formulario de la misma encuesta no hay nada que declarar.
  sid2 <- session_create()
  on.exit(session_delete(sid2), add = TRUE)
  .carga_import_surveymonkey(sid2, list(survey_id = "sm_orden"))
  expect_null(.carga_review_payload(sid2, NULL)$orden_editor)
})

test_that("tras refrescar, la base nueva queda marcada y ninguna relectura le aplica mapas", {
  restores <- .sor_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", .sor_form())
  .carga_import_surveymonkey(sid, list(survey_id = "sm_orden"))
  # Un mapeo confirmado en la base: si la marca no acompañara al archivo nuevo,
  # las relecturas lo aplicarían sobre datos ya codificados.
  estudio <- session_get(sid)$estudio
  estudio$bases$default$choice_code_mapping <- list(confirmed = TRUE, maps = .sor_mapas_editor())
  session_set(sid, "estudio", estudio)
  antes <- session_get(sid)$estudio$bases$default$data_file_id

  snap <- .sm_mb_prepare_refresh_snapshot(sid, "default", list(survey_id = "sm_orden"), "tok")
  data_path <- tempfile(fileext = ".xlsx")
  .carga_write_xlsx_sheet(snap$remote_df, data_path, "datos")
  data_meta <- save_upload(sid, "data", "refresh.xlsx", readBin(data_path, "raw", n = file.info(data_path)$size))
  inst_meta <- save_upload(sid, "xlsform", "refresh_xlsform.xlsx", readBin(snap$inst_path, "raw", n = file.info(snap$inst_path)$size))
  .sm_mb_update_base_refresh_files(
    sid, "default", inst_meta, data_meta, snap$rp_inst,
    reporte_data(snap$remote_df, instrumento = snap$rp_inst), list(survey_id = "sm_orden"),
    snap$response_filter, snap$source_kind,
    choice_order_editor = snap$choice_order_editor
  )

  base <- session_get(sid)$estudio$bases$default
  expect_false(identical(base$data_file_id, antes))
  expect_true(.carga_codigos_ya_aplicados(base))
  expect_null(.carga_editor_choice_code_maps(sid, "default"))
  .sor_check(sid, base$xlsform_file_id,
             as.data.frame(.carga_normalized_data_for_export(sid, "default")$data), "Ver base tras refrescar")
})

# --- Ítem 12: formas de la lógica que cita los códigos ------------------------

test_that("reescribe la comparación invertida y las comillas dobles en todas las formas", {
  r <- c("1" = "2", "2" = "1")
  f <- .carga_sm_orden_reescribir_expr
  expect_equal(f("'1' = ${p1}", "p1", r), "'2' = ${p1}")
  expect_equal(f("'2' != ${p1}", "p1", r), "'1' != ${p1}")
  expect_equal(f("${p1} = \"1\"", "p1", r), "${p1} = \"2\"")
  expect_equal(f("${p1} != \"2\"", "p1", r), "${p1} != \"1\"")
  expect_equal(f("\"1\" = ${p1}", "p1", r), "\"2\" = ${p1}")
  expect_equal(f("selected(${p1}, \"2\")", "p1", r), "selected(${p1}, \"1\")")
  expect_equal(f("selected( ${p1} , '1' ) and not(selected(${p1}, '2'))", "p1", r),
               "selected( ${p1} , '2' ) and not(selected(${p1}, '1'))")
  # Otra variable con prefijo común no se toca.
  expect_equal(f("${p1} = '1' and ${p10} = '1'", "p1", r), "${p1} = '2' and ${p10} = '1'")
})

test_that("count-selected, string-length y la cadena vacía no dependen del código: no omiten la lista", {
  r <- c("1" = "2", "2" = "1")
  f <- .carga_sm_orden_reescribir_expr
  for (e in c("count-selected(${p1}) >= 1", "string-length(${p1}) > 0", "${p1} != ''", "'' = ${p1}",
              "${p1} = \"\"", "count-selected(${p1}) <= 2 and ${p1} != ''")) {
    expect_equal(f(e, "p1", r), e, info = e)
  }
  expect_equal(f("count-selected(${p1}) > 0 and selected(${p1}, '1')", "p1", r),
               "count-selected(${p1}) > 0 and selected(${p1}, '2')")
})

test_that("la autorreferencia `.` solo se reconoce en el constraint o relevant de la propia variable", {
  r <- c("1" = "2", "2" = "1")
  f <- .carga_sm_orden_reescribir_expr
  expect_equal(f("selected(., '1')", "p1", r, propia = TRUE), "selected(., '2')")
  expect_equal(f(". != '2'", "p1", r, propia = TRUE), ". != '1'")
  expect_equal(f("\"1\" = .", "p1", r, propia = TRUE), "\"2\" = .")
  expect_equal(f("not(selected(., '1') and selected(., '2')) and count-selected(.) <= 2", "p1", r, propia = TRUE),
               "not(selected(., '2') and selected(., '1')) and count-selected(.) <= 2")
  expect_equal(f("${p1} = '1'", "p1", r, propia = TRUE), "${p1} = '2'")
  # En la fila de otra variable `.` es ESA variable: no se toca.
  expect_equal(f("selected(., '1')", "p1", r, propia = FALSE), "selected(., '1')")
  # Un decimal no es autorreferencia; `. > 0.5` sí lo es, y no se sabe reescribir.
  expect_null(f(". > 0.5", "p1", r, propia = TRUE))
})

test_that("una forma desconocida sigue devolviendo NULL: nunca reescribe a ciegas", {
  r <- c("1" = "2", "2" = "1")
  f <- .carga_sm_orden_reescribir_expr
  expect_null(f("${p1} > 2", "p1", r))
  expect_null(f("${p1} = 1", "p1", r))
  expect_null(f("${p1} = '1' or ${p1} >= '2'", "p1", r))
  expect_null(f("cf = ${p1}", "p1", r))
  expect_null(f("selected(., 1)", "p1", r, propia = TRUE))
})

test_that("adoptar el orden reescribe el constraint con `.` de la propia fila y la lógica invertida de otra", {
  model <- list(
    survey = tibble::tibble(
      type = c("select_multiple lst_p1", "text", "select_one lst_p3"),
      name = c("p1", "p2", "p3"),
      `label::es` = c("Servicios", "Otro", "Cargo"),
      relevant = c(NA, "\"3\" = ${p1} or selected(${p1}, \"1\")", NA),
      constraint = c("not(selected(., '3') and count-selected(.) > 1)", NA, "selected(., '1') or . = '2'")
    ),
    choices = tibble::tibble(
      list_name = c(rep("lst_p1", 3), rep("lst_p3", 2)),
      name = c("1", "2", "3", "1", "2"),
      `label::es` = c("Préstamo", "Sala", "Ninguno", "Docente", "Otro")
    )
  )
  maps <- list(list(variable = "p1", list_name = "lst_p1", mappings = list(
    .sor_item("1", "Préstamo", "3"), .sor_item("2", "Sala", "2"), .sor_item("3", "Ninguno", "1"))))
  out <- .carga_sm_adoptar_orden_editor(model, maps)
  expect_equal(unlist(out$resumen$adoptadas), "p1")
  expect_length(out$resumen$omitidas, 0L)
  expect_equal(out$model$survey$constraint[1], "not(selected(., '1') and count-selected(.) > 1)")
  expect_equal(out$model$survey$relevant[2], "\"1\" = ${p1} or selected(${p1}, \"3\")")
  # El `.` de la fila de p3 es p3, que no cambió de lista.
  expect_equal(out$model$survey$constraint[3], "selected(., '1') or . = '2'")
})

test_that("un `.` usado de forma desconocida en el constraint propio omite la lista con su motivo", {
  model <- list(
    survey = tibble::tibble(type = "select_one lst_p1", name = "p1", `label::es` = "P1",
                            constraint = ". < '3'"),
    choices = tibble::tibble(list_name = "lst_p1", name = c("1", "2", "3"), `label::es` = c("A", "B", "C"))
  )
  maps <- list(list(variable = "p1", list_name = "lst_p1", mappings = list(
    .sor_item("1", "A", "1"), .sor_item("2", "B", "3"), .sor_item("3", "C", "2"))))
  out <- .carga_sm_adoptar_orden_editor(model, maps)
  expect_length(out$resumen$adoptadas, 0L)
  expect_equal(out$resumen$omitidas[[1]]$variable, "p1")
  expect_match(out$resumen$omitidas[[1]]$motivo, "no se puede reescribir")
  expect_identical(out$model, model)
})
