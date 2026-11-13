# observaciones_regla() publica todas las preguntas de la regla en `casos`,
# no solo Variable 1 a 3 (validacion_evaluacion_data.R). Una batería de 14
# ítems llega a Hallazgos con sus 14 columnas; los casos se cruzan por id.

.obs_items <- sprintf("b%d", 1:14)

.obs_datos <- function() {
  m <- rbind(rep(4, 14), c(rep(4, 13), 3), c(1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2))
  d <- as.data.frame(m)
  names(d) <- .obs_items
  cbind(data.frame(respondent_id = c("u07", "u03", "u11"), stringsAsFactors = FALSE), d)
}

.obs_evaluar <- function() {
  regla <- list(id = "RC_BAT", activa = TRUE, nombre = "Batería", tipo = "bateria",
                variables = as.list(.obs_items), params = list(patron = "iguales"),
                severidad = "advertencia", hallazgo_kind = "caso_validar")
  rule <- bridge_regla_custom(regla)
  list(rule = rule, ev = evaluate_validation_bundle(list(rules = list(rule)), .obs_datos(), strict = FALSE))
}

test_that("los casos de una batería traen las 14 preguntas, no solo tres", {
  r <- .obs_evaluar()
  casos <- observaciones_regla(r$ev, regla = r$rule$id, por = "id_regla")
  expect_identical(casos$respondent_id, "u07")
  expect_true(all(.obs_items %in% names(casos)))
  expect_identical(unname(unlist(casos[1, .obs_items])), rep(4, 14))
})

test_that("las columnas de antes siguen y en el mismo orden al inicio", {
  r <- .obs_evaluar()
  casos <- observaciones_regla(r$ev, regla = r$rule$id, por = "id_regla")
  meta <- r$ev$reglas_meta[r$ev$reglas_meta$id_regla == r$rule$id, , drop = FALSE]
  antes <- c("respondent_id", na.omit(c(meta$variable_1, meta$variable_2, meta$variable_3)))
  antes <- antes[antes %in% names(casos)]
  expect_identical(names(casos)[seq_along(antes)], antes)
})

test_that("sin roles publicados quedan las tres de siempre", {
  r <- .obs_evaluar()
  r$ev$reglas_meta$variable_roles <- NULL
  casos <- observaciones_regla(r$ev, regla = r$rule$id, por = "id_regla")
  pregs <- intersect(names(casos), .obs_items)
  expect_lte(length(pregs), 3L)
  expect_identical(casos$respondent_id, "u07")
})

test_that("el detalle de la regla pasa las 14 preguntas a la tabla de casos", {
  r <- .obs_evaluar()
  ids <- r$rule$id
  # Instrumento sin secciones: el detalle no agrega preguntas de apertura.
  inst <- list(meta = list(
    section_map = data.frame(prefix = character(), group_name = character(), group_relevant = character()),
    groups_detail = data.frame(gname = character())
  ))
  aud <- auditar_regla(r$ev, ids = ids, inst = inst, verbose = FALSE)
  casos <- aud$casos[[1]]
  expect_true(all(.obs_items %in% names(casos)))
})
