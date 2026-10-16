# Validación › «Qué caso cuenta» declarado a mano: columnas candidatas y efecto.

.cvm_data <- function() {
  data.frame(
    `_uuid` = sprintf("u%02d", 1:12),
    seleccionado = c(rep(1, 9), rep(0, 3)),
    p1 = rep(c("1", "2", "99"), 4),
    edad = 18:29,
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.cvm_inst <- list(
  survey = data.frame(type = c("select_one sn", "integer"), name = c("p1", "edad"),
                      label = c("¿Presenció?", "Edad"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "sn", name = c("1", "2", "99"),
                       label = c("Sí", "No", "No responde"), stringsAsFactors = FALSE)
)

test_that("las candidatas son las columnas de pocos valores, con casos y etiqueta", {
  cols <- caso_valido_columnas_candidatas(.cvm_data(), .cvm_inst, max_valores = 5L)
  por <- stats::setNames(cols, vapply(cols, `[[`, "", "variable"))
  # El identificador y la edad (12 valores) no entran con tope 5.
  expect_identical(names(por), c("seleccionado", "p1"))
  sel <- por$seleccionado$valores
  expect_identical(vapply(sel, `[[`, "", "valor"), c("0", "1"))
  expect_identical(vapply(sel, `[[`, 0L, "n"), c(3L, 9L))
  expect_identical(vapply(por$p1$valores, `[[`, "", "etiqueta"), c("Sí", "No", "No responde"))
  expect_identical(por$p1$etiqueta, "¿Presenció?")
  expect_identical(c(por$seleccionado$del_formulario, por$p1$del_formulario), c(FALSE, TRUE))
})

test_that("el efecto cuenta los casos y avisa la variable que la base no trae", {
  e <- caso_valido_efecto(.cvm_data(), list(list(variable = "seleccionado", operador = "==", valores = list("1"))))
  expect_identical(c(e$n_total, e$n_validos, e$n_excluidos), c(12L, 9L, 3L))
  expect_length(e$variables_ausentes, 0L)

  dos <- caso_valido_efecto(.cvm_data(), list(
    list(variable = "seleccionado", operador = "==", valores = list("1")),
    list(variable = "p1", operador = "not_in", valores = list("99"))
  ))
  expect_identical(dos$n_validos, 6L)

  aus <- caso_valido_efecto(.cvm_data(), list(list(variable = "marca", operador = "==", valores = list("1"))))
  expect_identical(aus$n_validos, 12L)
  expect_identical(unlist(aus$variables_ausentes), "marca")
  # Una condición sin valores no cuenta como condición.
  expect_identical(caso_valido_efecto(.cvm_data(), list(list(variable = "p1", operador = "in", valores = list())))$n_validos, 12L)
})

test_that("guardar el criterio lo deja en la config de la base sin tocar el resto", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  caso_valido_guardar(sid, "2026", TRUE, list(list(variable = "q1", operador = "==", valores = list("1"))))
  cfg <- .get_base_scope(sid, "2026")$operational_config
  expect_true(cfg$caso_valido$enabled)
  expect_identical(cfg$caso_valido$condiciones[[1]]$variable, "q1")
  # Sin condiciones queda apagado.
  caso_valido_guardar(sid, "2026", TRUE, list())
  expect_false(.get_base_scope(sid, "2026")$operational_config$caso_valido$enabled)
})
