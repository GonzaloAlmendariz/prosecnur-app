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
