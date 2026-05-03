# Tests del módulo de lógica condicional (parser + aplicador).
# Aplica reglas tipo "Q7 NOT IN [C4,C5] => Ocultar P8" al XLSForm de
# referencia, llenando la columna `relevant` con expresiones XLSForm.

.write_temp_sav <- function(df) {
  path <- tempfile(fileext = ".sav")
  haven::write_sav(df, path)
  path
}

test_that("parser entiende '=', '!=', 'IN', 'NOT IN' y múltiples acciones", {
  text <- "
    Q7 NOT IN [C4, C5, C6, C7] => Ocultar P8, Ocultar P9, Ocultar P10.
    Q8 = C1 => Ocultar P10.
    Q27 != C1 => Ocultar P31.
    Q27 IN [C8, C9] => Ocultar P32.
  "
  rules <- surveymonkey_parsear_logica(text)
  expect_equal(nrow(rules), 6L)  # 3 + 1 + 1 + 1
  expect_setequal(unique(rules$target), c("P8", "P9", "P10", "P31", "P32"))
  expect_setequal(unique(rules$when_op), c("not_in", "eq", "ne", "in"))
  expect_equal(rules$when_codes[[1]], c("C4", "C5", "C6", "C7"))
})

test_that("parser entiende saltos SurveyMonkey tipo Pasar/Ir/Saltar", {
  rules <- surveymonkey_parsear_logica("
    Q15 = C6 => Pasar a P27.
    Q15 IN [C1, C2] => Ir a Pág. 16.
    Q15 != C3 => Saltar a Q20.
  ")
  expect_equal(rules$action, c("jump_to", "jump_to", "jump_to"))
  expect_equal(rules$target, c("P27", "PAG:16", "Q20"))
})

test_that("aplicador llena `relevant` invirtiendo el sentido de Ocultar (P7 select_one)", {
  # P7 con 7 choices, P8/P9/P10 tags simples
  labs7 <- stats::setNames(seq_len(7), paste0("Op", LETTERS[1:7]))
  df <- tibble::tibble(
    P7 = haven::labelled(c(1, 2, 5), labs7),
    P8 = haven::labelled(c(1, 2, 1), c("Sí" = 1, "No" = 2)),
    P9 = haven::labelled(c(2, 1, 2), c("Sí" = 1, "No" = 2)),
    P10 = haven::labelled(c(1, 1, 2), c("Sí" = 1, "No" = 2))
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)

  rules <- surveymonkey_parsear_logica(
    "Q7 NOT IN [C4, C5, C6, C7] => Ocultar P8, Ocultar P9, Ocultar P10."
  )
  out2 <- surveymonkey_aplicar_logica(out, rules, sm)

  rel <- out2$survey$relevant[match(c("p8", "p9", "p10"), out2$survey$name)]
  # "Ocultar cuando NOT IN" → "se muestra cuando IN" → expresión OR de igualdades
  for (e in rel) {
    expect_match(e, "\\$\\{p7\\}")
    expect_match(e, "= '4'")
    expect_match(e, "= '5'")
    expect_match(e, "= '6'")
    expect_match(e, "= '7'")
    expect_match(e, " or ")
  }
})

test_that("aplicador acumula múltiples reglas sobre el mismo target con AND", {
  labs <- stats::setNames(seq_len(3), paste0("Op", LETTERS[1:3]))
  df <- tibble::tibble(
    P1 = haven::labelled(c(1, 2, 3), labs),
    P2 = haven::labelled(c(1, 2, 3), labs),
    P5 = haven::labelled(c(1, 1, 2), c("Sí" = 1, "No" = 2))
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)

  rules <- surveymonkey_parsear_logica(
    "Q1 = C1 => Ocultar P5.
     Q2 = C2 => Ocultar P5."
  )
  out2 <- surveymonkey_aplicar_logica(out, rules, sm)

  rel_p5 <- out2$survey$relevant[match("p5", out2$survey$name)]
  # Ambas reglas combinadas con `and`: relevant cuando p1!=1 AND p2!=2
  expect_match(rel_p5, "\\$\\{p1\\}")
  expect_match(rel_p5, "\\$\\{p2\\}")
  expect_match(rel_p5, " and ")
})

test_that("aplicador resuelve P{n} battery/multi expandiendo a children", {
  likert <- c("Bajo" = 1, "Medio" = 2, "Alto" = 3)
  df <- tibble::tibble(
    P1 = haven::labelled(c(1, 2, 1), c("Sí" = 1, "No" = 2)),
    # P3 es battery con 3 items
    P3_1 = haven::labelled(c(1, 2, 3), likert),
    P3_2 = haven::labelled(c(2, 3, 1), likert),
    P3_3 = haven::labelled(c(3, 1, 2), likert)
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)

  rules <- surveymonkey_parsear_logica("Q1 = C2 => Ocultar P3.")
  out2 <- surveymonkey_aplicar_logica(out, rules, sm)

  # Las 3 children p3_1, p3_2, p3_3 deben tener relevant
  rel <- out2$survey$relevant[match(c("p3_1", "p3_2", "p3_3"), out2$survey$name)]
  expect_true(all(!is.na(rel)),
    info = "todas las children del battery deben tener relevant")
  for (e in rel) expect_match(e, "\\$\\{p1\\}")
})

test_that("'Ocultar Pág. N' se expande con el mapeo `paginas`", {
  df <- tibble::tibble(
    P1 = haven::labelled(c(1, 2, 1), c("a" = 1, "b" = 2)),
    P5 = haven::labelled(c(1, 2, 1), c("Sí" = 1, "No" = 2)),
    P6 = haven::labelled(c(1, 1, 2), c("Sí" = 1, "No" = 2))
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  out2 <- surveymonkey_aplicar_logica(
    out,
    "Q1 = C1 => Ocultar Pág. 5.",
    sm,
    paginas = list("5" = c("Q5", "Q6"))
  )
  rel <- out2$survey$relevant[match(c("p5", "p6"), out2$survey$name)]
  expect_true(all(!is.na(rel)),
    info = "ambas preguntas de la página 5 deben tener relevant")
  for (e in rel) expect_match(e, "\\$\\{p1\\} != '1'")
})

test_that("'Pasar a Pn' oculta el tramo intermedio y no toca el destino", {
  names <- paste0("p", 15:27)
  survey <- tibble::tibble(
    type = c("select_one lst_p15", rep("text", length(names) - 1L)),
    name = names,
    relevant = NA_character_
  )
  xlsform <- list(
    survey = survey,
    choices = tibble::tibble(
      list_name = "lst_p15",
      name = as.character(1:6),
      `label::es` = paste0("Op", 1:6)
    )
  )
  sm <- list(
    vars_tbl = tibble::tibble(name_raw = "p15", name_clean = "p15"),
    label_sets = list(p15 = stats::setNames(as.character(1:6), paste0("Op", 1:6)))
  )

  out <- surveymonkey_aplicar_logica(xlsform, "Q15 = C6 => Pasar a P27.", sm)
  rel <- stats::setNames(out$survey$relevant, out$survey$name)
  expect_true(all(!is.na(rel[paste0("p", 16:26)])))
  expect_true(is.na(rel[["p27"]]) || !nzchar(rel[["p27"]]))
  for (e in rel[paste0("p", 16:26)]) expect_match(e, "\\$\\{p15\\} != '6'")
})

test_that("'Pasar a Pág. N' se consolida en PagN cuando cubre toda la página intermedia", {
  xlsform <- list(
    survey = tibble::tibble(
      type = c("select_one lst_p15", "begin_group", "text", "text", "end_group", "begin_group", "text", "end_group"),
      name = c("p15", "Pag16", "p16", "p17", "", "Pag17", "p18", ""),
      relevant = NA_character_
    ),
    choices = tibble::tibble(list_name = "lst_p15", name = as.character(1:6), `label::es` = paste0("Op", 1:6))
  )
  sm <- list(
    vars_tbl = tibble::tibble(name_raw = "p15", name_clean = "p15"),
    label_sets = list(p15 = stats::setNames(as.character(1:6), paste0("Op", 1:6)))
  )
  out <- surveymonkey_aplicar_logica(
    xlsform,
    "Q15 = C6 => Pasar a Pág. 17.",
    sm,
    paginas = list("15" = "Q15", "16" = c("Q16", "Q17"), "17" = "Q18")
  )
  rel <- stats::setNames(out$survey$relevant, out$survey$name)
  expect_match(rel[["Pag16"]], "\\$\\{p15\\} != '6'")
  expect_true(is.na(rel[["p16"]]) || !nzchar(rel[["p16"]]))
  expect_true(is.na(rel[["p17"]]) || !nzchar(rel[["p17"]]))
  expect_true(is.na(rel[["Pag17"]]) || !nzchar(rel[["Pag17"]]))
})

test_that("salto desde select_multiple usa selected() en expresiones Kobo", {
  xlsform <- list(
    survey = tibble::tibble(
      type = c("select_multiple lst_p15", "text", "text"),
      name = c("p15", "p16", "p17"),
      relevant = NA_character_
    ),
    choices = tibble::tibble(list_name = "lst_p15", name = c("a", "b", "c"), `label::es` = c("A", "B", "C"))
  )
  sm <- list(
    vars_tbl = tibble::tibble(name_raw = "p15", name_clean = "p15"),
    label_sets = list(p15 = c("A" = "a", "B" = "b", "C" = "c"))
  )
  out <- surveymonkey_aplicar_logica(xlsform, "Q15 = C2 => Pasar a P17.", sm)
  rel <- out$survey$relevant[match("p16", out$survey$name)]
  expect_match(rel, "not\\(selected\\(\\$\\{p15\\}, 'b'\\)\\)")
})

test_that("declaratoria de orden visual reordena catalogo y reglas aplicadas", {
  xlsform <- list(
    survey = tibble::tibble(
      type = c("select_multiple lst_p27", "begin_group", "text", "end_group", "begin_group", "text", "end_group"),
      name = c("p27", "Pag17", "p28", "", "Pag18", "p31", ""),
      relevant = NA_character_
    ),
    choices = tibble::tibble(
      list_name = "lst_p27",
      name = as.character(1:9),
      `label::es` = c(
        "Emprendimiento",
        "Investigación",
        "Voluntariado o Pasantías",
        "Enseñanza/Dictado Independiente",
        "Consultor independiente",
        "Soy estudiante",
        "Me encuentro en búsqueda activa de empleo",
        "Otros:",
        "No me encuentro laborando ni en búsqueda de trabajo por motivos personales"
      )
    )
  )
  sm <- .sm_logic_context_from_xlsform(xlsform)
  overrides <- list("27" = c(
    "Emprendimiento",
    "Investigación",
    "Voluntariado o Pasantías",
    "Enseñanza/Dictado Independiente",
    "Consultor independiente",
    "Soy estudiante",
    "Me encuentro en búsqueda activa de empleo",
    "No me encuentro laborando ni en búsqueda de trabajo por motivos personales",
    "Otros:"
  ))

  out <- surveymonkey_aplicar_logica(
    xlsform,
    paste(
      "Q27 NOT IN [C1, C2, C3, C4, C5, C9] => Ocultar P31.",
      "Q27 = [C8] => Ocultar Pág. 17, Ocultar Pág. 18"
    ),
    sm,
    paginas = list("17" = "Q28", "18" = "Q31"),
    choice_order_overrides = overrides
  )

  p27_choices <- out$choices[out$choices$list_name == "lst_p27", , drop = FALSE]
  expect_equal(
    p27_choices$`label::es`[8:9],
    c("No me encuentro laborando ni en búsqueda de trabajo por motivos personales", "Otros:")
  )
  expect_equal(p27_choices$name, as.character(1:9))

  rel <- stats::setNames(out$survey$relevant, out$survey$name)
  expect_match(rel[["Pag17"]], "not\\(selected\\(\\$\\{p27\\}, '8'\\)\\)")
  expect_match(rel[["Pag18"]], "not\\(selected\\(\\$\\{p27\\}, '8'\\)\\)")
  expect_match(rel[["Pag18"]], "selected\\(\\$\\{p27\\}, '9'\\)")
  expect_true(is.na(rel[["p31"]]) || !nzchar(rel[["p31"]]))
})

test_that("interpretador muestra salto SurveyMonkey como relevant Kobo", {
  make_q <- function(n, choices = NULL) {
    q <- list(
      family = if (is.null(choices)) "open_ended" else "single_choice",
      subtype = if (is.null(choices)) "single" else "vertical",
      headings = list(list(heading = paste("Pregunta", n)))
    )
    if (!is.null(choices)) q$answers <- list(choices = choices)
    q
  }
  choices <- lapply(1:6, function(i) list(text = paste("Op", i), position = i))
  questions <- lapply(1:17, function(i) if (i == 15) make_q(i, choices) else make_q(i))
  details <- list(pages = list(list(position = 1, questions = questions)))

  out <- surveymonkey_interpretar_regla(
    "Q15 = C6 => Pasar a P17.",
    details = details,
    paginas = list("1" = paste0("Q", 1:17))
  )
  expect_true(out$ok)
  expect_equal(out$resolucion$kobo_expr, "${p15} != '6'")
  edge_ids <- vapply(out$diagrama$edges, `[[`, character(1), "target_id")
  expect_equal(edge_ids, "p16")
  expect_match(out$texto_humano, "saltar hasta")
})

test_that("API normalizada consolida lógica en grupos PagN y no deja secciones huérfanas", {
  xlsform <- list(
    survey = tibble::tibble(
      type = c(
        "select_multiple lst_p7",
        "begin_group", "select_one lst_p8", "end_group",
        "begin_group", "select_one lst_p9", "end_group",
        "begin_group", "text", "end_group"
      ),
      name = c("p7", "Pag3", "p8", "", "Pag4", "p9", "", "Pag5", "p10", ""),
      relevant = NA_character_,
      section = c("", "Pag3", "Pag3", "", "Pag4", "Pag4", "", "Pag5", "Pag5", "")
    ),
    choices = tibble::tibble(
      list_name = c(rep("lst_p7", 7), rep("lst_p8", 2), rep("lst_p9", 2)),
      name = c(as.character(1:7), "1", "2", "1", "2"),
      `label::es` = c(paste0("Op", 1:7), "Sí", "No", "Sí", "No")
    )
  )
  sm <- list(
    vars_tbl = tibble::tibble(name_raw = c("p7", "p8"), name_clean = c("p7", "p8")),
    label_sets = list(
      p7 = stats::setNames(as.character(1:7), paste0("Op", 1:7)),
      p8 = c("Sí" = "1", "No" = "2")
    )
  )

  out <- surveymonkey_aplicar_logica(
    xlsform,
    paste(
      "Q7 NOT IN [C4, C5, C6, C7] => Ocultar P8, Ocultar P9, Ocultar P10.",
      "Q8 = C1 => Ocultar P10."
    ),
    sm
  )

  rel <- stats::setNames(out$survey$relevant, out$survey$name)
  expect_match(rel[["Pag3"]], "\\$\\{p7\\}")
  expect_match(rel[["Pag4"]], "\\$\\{p7\\}")
  expect_match(rel[["Pag5"]], "\\$\\{p7\\}")
  expect_match(rel[["Pag5"]], "\\$\\{p8\\}")
  expect_true(is.na(rel[["p8"]]) || !nzchar(rel[["p8"]]))
  expect_true(is.na(rel[["p9"]]) || !nzchar(rel[["p9"]]))
  expect_true(is.na(rel[["p10"]]) || !nzchar(rel[["p10"]]))
})

test_that("acepta etiquetas literales con comillas (resuelve a code via labels)", {
  df <- tibble::tibble(
    P1 = haven::labelled(c(1, 2, 3, 1, 2),
      c("Sí" = 1, "Consultará" = 2, "No" = 3)),
    P5 = haven::labelled(c(1, NA, NA, 1, NA),
      c("a" = 1, "b" = 2))
  )
  path <- .write_temp_sav(df); on.exit(unlink(path), add = TRUE)
  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)

  # Usa etiquetas literales tal como aparecen en el constructor SM
  out2 <- surveymonkey_aplicar_logica(
    out, 'Q1 IN ["Consultará", "No"] => Ocultar P5.', sm
  )
  rel <- out2$survey$relevant[match("p5", out2$survey$name)]
  expect_match(rel, "\\$\\{p1\\}")
  # 'IN [Consultará=2, No=3] => Ocultar' → relevant cuando NOT IN → != 2 AND != 3
  expect_match(rel, "p1.*!=.*'2'")
  expect_match(rel, "p1.*!=.*'3'")
})

test_that("'Fin de encuesta' oculta todas las páginas estrictamente posteriores", {
  df <- tibble::tibble(
    P5 = haven::labelled(c(1, 2, 3, 1, 2), c("Sí" = 1, "Consultará" = 2, "No" = 3)),
    P6 = haven::labelled(rep(NA_real_, 5L), c("a" = 1, "b" = 2)),
    P7 = haven::labelled(rep(NA_real_, 5L), c("x" = 1, "y" = 2)),
    P10 = haven::labelled(rep(NA_real_, 5L), c("u" = 1, "v" = 2))
  )
  path <- .write_temp_sav(df); on.exit(unlink(path), add = TRUE)
  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  paginas <- list("16" = c("Q5"), "17" = c("Q6", "Q7"), "18" = c("Q10"))

  out2 <- surveymonkey_aplicar_logica(
    out,
    "Q5 IN [C2, C3] => Fin de la encuesta.",
    sm,
    paginas = paginas
  )

  rel <- out2$survey$relevant[match(c("p6", "p7", "p10"), out2$survey$name)]
  expect_true(all(!is.na(rel)),
    info = "todas las preguntas de páginas posteriores deben tener relevant")
  for (e in rel) {
    expect_match(e, "\\$\\{p5\\}")
    # 'Fin cuando IN [C2,C3]' → relevant cuando NOT IN [C2,C3] → != ambos
    expect_match(e, "and|& ")
  }
})

test_that("'Fin' aplicado a página final no agrega relevant adicional", {
  df <- tibble::tibble(
    P5 = haven::labelled(c(1, 2), c("Sí" = 1, "No" = 2)),
    P6 = haven::labelled(c(1, 2), c("a" = 1, "b" = 2))
  )
  path <- .write_temp_sav(df); on.exit(unlink(path), add = TRUE)
  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  # P6 está en la última página → no hay nada después de "fin"
  paginas <- list("1" = c("Q5"), "2" = c("Q6"))
  out2 <- surveymonkey_aplicar_logica(
    out, "Q6 = C1 => Fin.", sm, paginas = paginas
  )
  # Q6 está en página 2 (la última) → "Fin" no oculta nada
  expect_true(all(is.na(out2$survey$relevant)))
})

test_that("warning si la página referenciada no está en el mapeo", {
  df <- tibble::tibble(P1 = haven::labelled(c(1, 2), c("a" = 1, "b" = 2)))
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  expect_warning(
    surveymonkey_aplicar_logica(out, "Q1 = C1 => Ocultar Pág. 99.", sm),
    regexp = "P[áa]gina 99"
  )
})

test_that("operador != en select_one produce expresión correcta", {
  df <- tibble::tibble(
    P27 = haven::labelled(c(1, 2, 1), c("Sí" = 1, "No" = 2)),
    P31 = haven::labelled(c(1, 1, 2), c("Sí" = 1, "No" = 2))
  )
  path <- .write_temp_sav(df)
  on.exit(unlink(path), add = TRUE)

  sm <- surveymonkey_leer(path)
  out <- surveymonkey_xlsform(sm)
  out2 <- surveymonkey_aplicar_logica(out, "Q27 != C1 => Ocultar P31.", sm)

  rel <- out2$survey$relevant[match("p31", out2$survey$name)]
  # Ocultar cuando p27 != C1 → relevant cuando p27 == C1 → ${p27} = '1'
  expect_match(rel, "\\$\\{p27\\} = '1'")
})
