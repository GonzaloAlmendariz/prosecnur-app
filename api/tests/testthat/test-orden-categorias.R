test_that(".orden_categorias_from_cfg normaliza y descarta entradas vacías", {
  cfg <- list(orden_categorias = list(
    ingreso_rangos = list("3", "2", "1"),
    tiempo         = c("a", "b"),
    vacia          = list(),
    sin_nombre     = list("x")
  ))
  out <- .orden_categorias_from_cfg(cfg)
  expect_equal(out$ingreso_rangos, c("3", "2", "1"))
  expect_equal(out$tiempo, c("a", "b"))
  expect_false("vacia" %in% names(out))          # lista vacía se descarta
  expect_equal(out$sin_nombre, "x")

  # Sin sub-config => list() vacía
  expect_equal(.orden_categorias_from_cfg(list()), list())
  expect_equal(.orden_categorias_from_cfg(NULL), list())
})

test_that(".orden_categorias_perm pone los deseados primero y anexa el resto en su orden", {
  cur <- c("1", "2", "3", "94")
  # Invertir 1..3, dejar 94 fuera del override
  expect_equal(.orden_categorias_perm(cur, c("3", "2", "1")), c(3L, 2L, 1L, 4L))
  # Código deseado inexistente en cur se ignora
  expect_equal(.orden_categorias_perm(cur, c("3", "99", "1")), c(3L, 1L, 2L, 4L))
  # Override completo
  expect_equal(.orden_categorias_perm(cur, c("94", "3", "2", "1")), c(4L, 3L, 2L, 1L))
})

test_that(".apply_orden_categorias reordena por list_name y respeta especiales al final", {
  inst <- list(
    orders_list = list(
      ingreso = list(names = c("1", "2", "3", "94"),
                     labels = c("Bajo", "Medio", "Alto", "NS/NR"),
                     label = "Ingreso"),
      sexo    = list(names = c("1", "2"), labels = c("Hombre", "Mujer"), label = "Sexo")
    ),
    survey = data.frame(
      name = c("ingreso", "sexo"),
      type = c("select_one ingreso_rangos", "select_one sexo_l"),
      list_name = c("ingreso_rangos", "sexo_l"),
      stringsAsFactors = FALSE
    )
  )
  out <- .apply_orden_categorias(inst, list(ingreso_rangos = c("3", "2", "1")))

  # ingreso: de mayor a menor, 94 (especial no listado) al final; labels siguen
  expect_equal(out$orders_list$ingreso$names, c("3", "2", "1", "94"))
  expect_equal(out$orders_list$ingreso$labels, c("Alto", "Medio", "Bajo", "NS/NR"))
  # sexo: sin override, intacto
  expect_equal(out$orders_list$sexo$names, c("1", "2"))
})

test_that(".apply_orden_categorias es no-op sin override e idempotente", {
  inst <- list(
    orders_list = list(
      v = list(names = c("1", "2", "3"), labels = c("A", "B", "C"), label = "V")
    ),
    survey = data.frame(name = "v", type = "select_one l",
                        list_name = "l", stringsAsFactors = FALSE)
  )
  # Sin override aplicable => intacto
  expect_identical(.apply_orden_categorias(inst, list())$orders_list, inst$orders_list)
  expect_identical(.apply_orden_categorias(inst, list(otra = c("1")))$orders_list, inst$orders_list)
  # Override que ya coincide con el orden actual => no toca (identity)
  expect_identical(
    .apply_orden_categorias(inst, list(l = c("1", "2", "3")))$orders_list,
    inst$orders_list
  )
  # Idempotencia sobre un reorden real
  once  <- .apply_orden_categorias(inst, list(l = c("3", "1", "2")))
  twice <- .apply_orden_categorias(once, list(l = c("3", "1", "2")))
  expect_identical(once$orders_list, twice$orders_list)
})

test_that(".apply_orden_categorias tolera instrumentos sin orders_list o sin survey", {
  expect_null(.apply_orden_categorias(NULL, list(l = c("1")))$orders_list)
  inst_sin <- list(survey = data.frame(name = "v", type = "select_one l",
                                       list_name = "l", stringsAsFactors = FALSE))
  expect_identical(.apply_orden_categorias(inst_sin, list(l = c("1")))$orders_list, NULL)
})

test_that(".variables_desde_instrumento expone list_name desde la columna aunque el type venga stripped", {
  # El instrumento cargado puede traer el type normalizado a "select_one" (sin
  # la lista) y el nombre de la lista en la columna list_name. El endpoint de
  # variables debe devolver ese list_name para que el frontend pueda keyar el
  # orden de categorías por lista.
  inst <- list(
    survey = data.frame(
      name = c("region", "satisfaccion", "acuerdo", "edad"),
      type = c("select_one", "select_one", "select_one", "integer"),
      list_name = c("region", "likert5", "likert5", NA_character_),
      label = c("Región", "Satisfacción", "Acuerdo", "Edad"),
      stringsAsFactors = FALSE
    )
  )
  vars <- .variables_desde_instrumento(inst)
  by_name <- stats::setNames(lapply(vars, function(v) v$list_name), vapply(vars, function(v) v$name, character(1)))
  expect_equal(by_name[["region"]], "region")
  expect_equal(by_name[["satisfaccion"]], "likert5")
  expect_equal(by_name[["acuerdo"]], "likert5")   # comparte lista -> misma key
})

test_that(".orden_categorias_ordinal_auto detecta likert y descarta nominales", {
  inst <- list(dicc_code_to_label = list(
    likert  = stats::setNames(c("Nada", "Poco", "Algo", "Mucho"), c("1", "2", "3", "4")),
    acuerdo = stats::setNames(c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo"),
                              c("1", "2", "3", "4")),
    region  = stats::setNames(c("Lima", "Cusco", "Arequipa"), c("1", "2", "3"))
  ))
  auto <- .orden_categorias_ordinal_auto(inst)
  expect_true(auto[["likert"]])
  expect_true(auto[["acuerdo"]])
  expect_false(auto[["region"]])

  # Instrumento sin diccionario => named logical vacío, sin error.
  expect_length(.orden_categorias_ordinal_auto(list()), 0L)
  expect_length(.orden_categorias_ordinal_auto(NULL), 0L)
})

test_that(".orden_categorias_ordinales_from_cfg toma solo claves con override explícito", {
  ov <- .orden_categorias_ordinales_from_cfg(list(listas_ordinales = list(
    region = TRUE, likert = FALSE, ausente = NULL, vacia = list()
  )))
  expect_true(ov[["region"]])
  expect_false(ov[["likert"]])
  expect_false("ausente" %in% names(ov))  # NULL => sin override
  expect_false("vacia" %in% names(ov))    # length 0 => sin override

  expect_length(.orden_categorias_ordinales_from_cfg(list()), 0L)
  expect_length(.orden_categorias_ordinales_from_cfg(NULL), 0L)
})

test_that(".orden_categorias_ordinal_set resuelve auto ∪ override-true − override-false", {
  inst <- list(dicc_code_to_label = list(
    likert = stats::setNames(c("Nada", "Poco", "Algo", "Mucho"), c("1", "2", "3", "4")),  # auto TRUE
    region = stats::setNames(c("Lima", "Cusco", "Arequipa"), c("1", "2", "3"))            # auto FALSE
  ))

  # Solo auto: likert ordinal, region nominal.
  auto_set <- .orden_categorias_ordinal_set(inst, list())
  expect_true("likert" %in% auto_set)
  expect_false("region" %in% auto_set)

  # Override invierte ambos: region ordinal (true), likert nominal (false).
  ov_set <- .orden_categorias_ordinal_set(
    inst, list(listas_ordinales = list(region = TRUE, likert = FALSE))
  )
  expect_true("region" %in% ov_set)
  expect_false("likert" %in% ov_set)

  # Override solo de una lista: la otra sigue por auto.
  mix_set <- .orden_categorias_ordinal_set(
    inst, list(listas_ordinales = list(region = TRUE))
  )
  expect_setequal(mix_set, c("likert", "region"))
})

test_that("integración: freq_table_spss refleja el orden reordenado por el override", {
  data <- data.frame(
    ingreso = c("1", "1", "2", "3", "3", "3", "94"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    orders_list = list(
      ingreso = list(names = c("1", "2", "3", "94"),
                     labels = c("Bajo", "Medio", "Alto", "NS/NR"),
                     label = "Ingreso mensual")
    ),
    survey = data.frame(name = "ingreso", type = "select_one ingreso_rangos",
                        list_name = "ingreso_rangos", label = "Ingreso mensual",
                        stringsAsFactors = FALSE)
  )

  # Orden por defecto (instrumento): Bajo, Medio, Alto, NS/NR
  tab_default <- freq_table_spss(
    data = data, var = "ingreso",
    survey = inst$survey, orders_list = inst$orders_list
  )
  body_default <- tab_default[tab_default$Opciones != "Total", , drop = FALSE]
  expect_equal(body_default$Opciones, c("Bajo", "Medio", "Alto", "NS/NR"))

  # Con override de mayor a menor: Alto, Medio, Bajo, NS/NR (94 al final)
  inst2 <- .apply_orden_categorias(inst, list(ingreso_rangos = c("3", "2", "1")))
  tab_ord <- freq_table_spss(
    data = data, var = "ingreso",
    survey = inst2$survey, orders_list = inst2$orders_list
  )
  body_ord <- tab_ord[tab_ord$Opciones != "Total", , drop = FALSE]
  expect_equal(body_ord$Opciones, c("Alto", "Medio", "Bajo", "NS/NR"))
  # Los conteos acompañan a su categoría (no se barajan solos)
  expect_equal(body_ord$n[body_ord$Opciones == "Alto"], 3)
  expect_equal(body_ord$n[body_ord$Opciones == "Bajo"], 2)
})
