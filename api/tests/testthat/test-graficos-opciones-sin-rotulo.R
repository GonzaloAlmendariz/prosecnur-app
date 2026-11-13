# Ítem 48 (PPT ACNUR RMS 2026): una opción sin rótulo no se dibuja como un
# número suelto. Sin casos no se dibuja; con casos se rotula "Sin rótulo
# (código X)" y el plan avisa. Antes la lámina "¿Cuál fue el motivo principal
# para buscar atención?" mostraba "6", "7", "8", "9", "113", "114" con 0.0 %, y
# los casos de las opciones vacías que sí tenían respuestas no se dibujaban.

.sin_rotulo_src <- function() {
  survey <- data.frame(
    type = c("select_one motivo", "select_multiple apoyo"),
    name = c("motivo", "apoyo"),
    label = c("¿Cuál fue el motivo?", "¿Qué apoyo recibió?"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c(rep("motivo", 5), rep("apoyo", 3)),
    name = c("1", "2", "6", "105", "96", "1", "2", "7"),
    label = c("Enfermedad", "Lesión", NA, "", "Otro", "Comida", "Dinero", NA),
    stringsAsFactors = FALSE
  )
  motivo <- c(rep("1", 5), rep("2", 3), rep("6", 2), NA)
  attr(motivo, "labels") <- c(`1` = "Enfermedad", `2` = "Lesión", `6` = "", `105` = "", `96` = "Otro")
  df <- data.frame(motivo = I(motivo), apoyo = NA_character_, stringsAsFactors = FALSE)
  df$motivo <- motivo
  df$`apoyo/1` <- c(rep(1, 4), rep(0, 7))
  df$`apoyo/2` <- c(rep(0, 4), rep(1, 2), rep(0, 5))
  df$`apoyo/7` <- 0
  inst <- list(
    survey = survey, choices = choices, label_col_choices = "label",
    orders_list = list(
      motivo = list(names = c("1", "2", "6", "105", "96"),
                    labels = c("Enfermedad", "Lesión", "", "", "Otro"), label = "Motivo")
    ),
    dicc_code_to_label = list(motivo = c(`1` = "Enfermedad", `2` = "Lesión", `6` = "", `105` = "", `96` = "Otro"))
  )
  list(inst_sources = list(default = inst), data_sources = list(default = df))
}

test_that("sin rótulo y sin casos no se dibuja; con casos se rotula y avisa", {
  out <- prosecnurapp:::.graficos_opciones_sin_rotulo_sources(.sin_rotulo_src())
  inst <- out$inst_sources$default
  ch <- inst$choices
  motivo <- ch[ch$list_name == "motivo", , drop = FALSE]

  expect_equal(motivo$name, c("1", "2", "6", "96"))
  expect_equal(motivo$label[motivo$name == "6"], "Sin rótulo (código 6)")
  expect_false("7" %in% ch$name[ch$list_name == "apoyo"])
  expect_equal(inst$orders_list$motivo$names, c("1", "2", "6", "96"))
  expect_equal(inst$orders_list$motivo$labels[3], "Sin rótulo (código 6)")
  labs <- attr(out$data_sources$default$motivo, "labels")
  expect_equal(unname(labs[["6"]]), "Sin rótulo (código 6)")
  expect_false("105" %in% names(labs))

  hall <- attr(out, "graficos_opciones_sin_rotulo")
  acciones <- vapply(hall, function(h) paste(h$codigo, h$accion, h$n), character(1))
  expect_setequal(acciones, c("6 rotulada 2", "105 omitida 0", "7 omitida 0"))

  avisos <- prosecnurapp:::.graficos_opciones_sin_rotulo_avisos(hall)
  expect_length(avisos, 1L)
  expect_match(avisos, "La opción 6 de motivo no tiene rótulo", fixed = TRUE)
  expect_match(avisos, "2 respuestas", fixed = TRUE)

  # La misma lista en la base principal y en un grupo repetido se avisa una vez.
  doble <- c(hall, lapply(hall, function(h) { h$base <- "repetido"; h$n <- 9L; h }))
  avisos2 <- prosecnurapp:::.graficos_opciones_sin_rotulo_avisos(doble)
  expect_length(avisos2, 1L)
  expect_match(avisos2, "2 respuestas", fixed = TRUE)
})

test_that("la tabla de frecuencias de Gráficos conserva los casos sin rótulo", {
  out <- prosecnurapp:::.graficos_opciones_sin_rotulo_sources(.sin_rotulo_src())
  inst <- out$inst_sources$default
  tab <- prosecnurapp::freq_table_spss(out$data_sources$default, "motivo",
                                       survey = inst$survey, orders_list = inst$orders_list,
                                       mostrar_todo = TRUE, casos = TRUE)
  ops <- as.character(tab$Opciones)
  expect_false(any(!nzchar(ops)))
  expect_false(any(ops %in% c("6", "105")))
  expect_equal(tab$n[ops == "Sin rótulo (código 6)"], 2)
  expect_equal(tab$n[ops == "Total"], 10)
})

test_that("un rótulo presente no se toca", {
  src <- .sin_rotulo_src()
  src$inst_sources$default$choices$label[3] <- "Oftalmología"
  src$inst_sources$default$choices$label[4] <- "Ginecología"
  src$inst_sources$default$choices$label[8] <- "Vivienda"
  out <- prosecnurapp:::.graficos_opciones_sin_rotulo_sources(src)
  expect_identical(out$inst_sources$default$choices, src$inst_sources$default$choices)
  expect_length(attr(out, "graficos_opciones_sin_rotulo"), 0L)
})

test_that("las fuentes de Gráficos y el plan sugerido aplican la regla", {
  fuentes <- paste(deparse(prosecnurapp:::.graficos_processing_sources), collapse = "\n")
  expect_match(fuentes, ".graficos_opciones_sin_rotulo_sources", fixed = TRUE)
  plan <- paste(deparse(prosecnurapp:::.graficos_suggested_plan), collapse = "\n")
  expect_match(plan, ".graficos_opciones_sin_rotulo_avisos_session", fixed = TRUE)
})
