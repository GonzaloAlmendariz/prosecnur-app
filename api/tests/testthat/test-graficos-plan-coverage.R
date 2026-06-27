test_that("inventario de graficos prioriza recodificadas e integra campos other", {
  inst <- list(
    survey = data.frame(
      type_base = c("text", "select_one", "text", "text", "select_multiple"),
      type = c("text", "select_one lst_inst", "text", "text", "select_multiple lst_multi"),
      name = c("p9", "p9_recod", "p9_other", "correo", "p19"),
      label = c("Institucion abierta", "Institucion recodificada", "Otra institucion", "Correo electronico", "Herramientas"),
      group_name = c("Perfil", "Perfil", "Perfil", "Perfil", "IA"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_inst", "lst_inst", "lst_multi", "lst_multi"),
      name = c("pucp", "otros", "a", "b"),
      label = c("PUCP", "Otros", "A", "B"),
      stringsAsFactors = FALSE
    )
  )
  data <- data.frame(
    p9 = c("PUCP", "UNI", ""),
    p9_recod = c("pucp", "otros", "pucp"),
    p9_other = c("", "UNI", ""),
    correo = c("a@b.com", "", ""),
    p19 = c("a b", "a", ""),
    stringsAsFactors = FALSE
  )

  vars <- .graficos_extract_vars_from_inst(inst, data = data, source_kind = "kobo")
  by_name <- stats::setNames(vars, vapply(vars, `[[`, character(1), "name"))

  expect_false(isTRUE(by_name$p9$is_preferred))
  expect_equal(by_name$p9$covered_by, "p9_recod")
  expect_true(isTRUE(by_name$p9_recod$graphable))
  expect_true(isTRUE(by_name$p9_recod$is_preferred))
  expect_equal(by_name$p9_other$integrated_in, "p9_recod")
  expect_false(isTRUE(by_name$correo$graphable))
  expect_match(by_name$correo$exclusion_reason, "identificador|contacto")
  expect_true(isTRUE(by_name$p19$graphable))
  expect_true(isTRUE(by_name$p19$section_reliable))
})

test_that("cobertura extrae variables desde graficadores y bloques", {
  plan <- list(slides = list(
    list(
      id = "s1",
      tipo = "p_slide_2_graficos",
      payload = list(
        izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "base$p19")),
        derecha = list(graficador = "p_barras_apiladas", args = list(var = "p32", cruces = "sexo"))
      )
    ),
    list(
      id = "s2",
      tipo = "p_slide_1_grafico",
      payload = list(
        grafico = list(
          graficador = "p_barras_multiapiladas",
          args = list(modo = "var", vars = list("p33_1", "p33_2"), bloques = list(list(vars = list("p34_recod"))))
        )
      )
    )
  ))

  refs <- .graficos_collect_plan_refs(plan)
  expect_setequal(refs, c("base$p19", "p32", "sexo", "p33_1", "p33_2", "p34_recod"))
})

.graficos_acnur_test_session <- function() {
  sid <- session_create()
  estudio_ensure(sid)

  survey <- data.frame(
    type = c(
      "begin_group",
      "select_one district_list",
      "select_one yesno",
      "select_multiple topics",
      "note",
      "calculate",
      "geopoint",
      "text",
      "end_group"
    ),
    name = c(
      "datos_hogar",
      "Core/M5_district",
      "p1",
      "p2",
      "intro_note",
      "calc_score",
      "gps_raw",
      "email",
      "datos_hogar"
    ),
    label = c(
      "Datos del hogar",
      "Distrito",
      "Acceso a servicios",
      "Temas prioritarios",
      "Nota introductoria",
      "Calculo interno",
      "GPS crudo",
      "Correo electronico",
      "Datos del hogar"
    ),
    group_path = c("", rep("Datos del hogar", 7), ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c(
      rep("district_list", 3),
      rep("yesno", 2),
      rep("topics", 2)
    ),
    name = c("150132", "150103", "150117", "yes", "no", "a", "b"),
    label = c(
      "San Juan de Lurigancho",
      "Ate",
      "Los Olivos",
      "Si",
      "No",
      "Educacion",
      "Salud"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data <- data.frame(
    `Core/M5_district` = c("150132", "150103", "150117", ""),
    p1 = c("yes", "no", "yes", ""),
    p2 = c("a b", "a", "b", ""),
    gps_raw = c("-12 -77", "-12 -76", "", ""),
    email = c("a@example.org", "", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  s <- session_get(sid)
  s$estudio$bases <- list(default = list(nombre = "default", source_kind = "kobo"))
  s$rp_inst <- list(survey = survey, choices = choices)
  s$rp_data <- data
  .session_env[[sid]] <- s
  sid
}

test_that("perfil ACNUR/Kobo agrega variables virtuales KOICA sin exponerlas como preguntas", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)

  sources <- .graficos_processing_sources(sid)
  data <- sources$data_sources$default
  inst <- sources$inst_sources$default
  vars <- .graficos_extract_vars_from_inst(inst, data = data, source_kind = "kobo")

  expect_true("__koica_group" %in% names(data))
  expect_true("__district" %in% names(data))
  expect_equal(
    as.character(data$`__koica_group`[1:3]),
    c("Intervencion KOICA", "Comparacion KOICA", "Comparacion KOICA")
  )
  expect_false("__koica_group" %in% vapply(vars, `[[`, character(1), "name"))
  expect_false("__district" %in% vapply(vars, `[[`, character(1), "name"))
})

test_that("plan ACNUR/Kobo coloca mapas al inicio y omite variables no graficables", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(
    sid,
    config = list(
      profile_id = "acnur_kobo_cruncher_plus",
      include_coverage_maps = TRUE,
      comparison_mode = "koica_group"
    )
  )
  slides <- suggested$plan$slides
  map_idx <- which(vapply(slides, function(slide) {
    graf <- (slide$payload %||% list())$grafico %||% list()
    identical(graf$graficador, "p_mapa_cobertura_territorial")
  }, logical(1)))
  section_idx <- which(vapply(slides, function(slide) identical(slide$tipo, "p_slide_seccion"), logical(1)))
  refs <- .graficos_collect_plan_refs(suggested$plan)

  expect_equal(map_idx, 4:10)
  expect_true(length(section_idx) > 0L)
  expect_true(max(map_idx) < min(section_idx))
  expect_true("__koica_group" %in% refs)
  expect_false(any(c("intro_note", "calc_score", "gps_raw", "email") %in% refs))
})

test_that("plan ACNUR/Kobo respeta opciones explicitas de mapas y comparativo", {
  sid <- .graficos_acnur_test_session()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(
    sid,
    config = list(
      profile_id = "acnur_kobo_cruncher_plus",
      include_coverage_maps = FALSE,
      comparison_mode = "none"
    )
  )
  refs <- .graficos_collect_plan_refs(suggested$plan)
  map_count <- sum(vapply(suggested$plan$slides, function(slide) {
    graf <- (slide$payload %||% list())$grafico %||% list()
    identical(graf$graficador, "p_mapa_cobertura_territorial")
  }, logical(1)))

  expect_equal(map_count, 0L)
  expect_false("__koica_group" %in% refs)
  expect_false("__district" %in% refs)
})
