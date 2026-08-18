# El cubo balanceado debe balancear DENTRO del estrato.
#
# Hallazgo J1 (checklist ae8e7845): el sorteo corre por estrato (facultad ×
# sexo × tamaño) y tres de las cinco balance_vars del diseño son CONSTANTES
# dentro de cada estrato. `model.matrix` falla ENTERO ante un factor de un
# solo nivel y el tryCatch degradaba la matriz completa a intercepto+pik:
# program y level — que SÍ varían y son lo único balanceable — se perdían con
# las constantes, sin aviso. El «cubo balanceado» del diseño vigente quedaba
# como sorteo pi-only por estrato.

.bs_estrato <- function() {
  # Un estrato real: facultad/sexo/tamaño constantes, programa y nivel variando.
  data.frame(
    classroom_id = paste0("CH", 1:8),
    faculty = "DERECHO", sex_top_1 = "F", size_group = "G2",
    program = rep(c("DERECHO", "CS POLITICA"), 4),
    level = rep(c("4", "6", "8", "10"), 2),
    eligible_n = c(20, 25, 30, 22, 28, 24, 26, 21),
    stringsAsFactors = FALSE
  )
}
.bs_vars <- c("faculty", "sex_top_1", "size_group", "program", "level")

test_that("las variables que varian SOBREVIVEN a las constantes del estrato", {
  df <- .bs_estrato()
  m <- .cm_aulas_balance_matrix(df, .bs_vars, pik = rep(0.5, 8))
  cols <- colnames(m)
  # Antes: solo pik+intercept. Ahora: program y level aportan columnas.
  expect_true(any(grepl("^program", cols)))
  expect_true(any(grepl("^level", cols)))
  expect_true(all(c("pik", "intercept") %in% cols))
  expect_gt(ncol(m), 2L)
})

test_that("las constantes descartadas SE DECLARAN, no se tragan", {
  m <- .cm_aulas_balance_matrix(.bs_estrato(), .bs_vars, pik = rep(0.5, 8))
  descartadas <- attr(m, "balance_vars_descartadas", exact = TRUE)
  expect_setequal(descartadas, c("faculty", "sex_top_1", "size_group"))
})

test_that("CONTROL: sin constantes la matriz no cambia de forma", {
  df <- .bs_estrato()
  m <- .cm_aulas_balance_matrix(df, c("program", "level"), pik = rep(0.5, 8))
  # pik + intercept + 2 programas + 3 niveles: model.matrix da todos los
  # niveles al PRIMER factor y aplica contrastes (n-1) a los siguientes.
  expect_identical(ncol(m), 7L)
  expect_length(attr(m, "balance_vars_descartadas", exact = TRUE), 0L)
})

test_that("todo constante degrada a intercepto+pik pero DICIENDO cuales", {
  df <- .bs_estrato()
  m <- .cm_aulas_balance_matrix(df, c("faculty", "sex_top_1"), pik = rep(0.5, 8))
  expect_setequal(colnames(m), c("pik", "intercept"))
  expect_setequal(attr(m, "balance_vars_descartadas", exact = TRUE), c("faculty", "sex_top_1"))
})

test_that("numerica constante tambien se descarta y declara", {
  df <- .bs_estrato()
  df$constante_num <- 7
  m <- .cm_aulas_balance_matrix(df, c("program", "constante_num"), pik = rep(0.5, 8))
  expect_true(any(grepl("^program", colnames(m))))
  expect_false("constante_num" %in% colnames(m))
  expect_setequal(attr(m, "balance_vars_descartadas", exact = TRUE), "constante_num")
})

test_that("el sorteo del cubo en un estrato con constantes queda balanceado por lo que varia", {
  # Integración: con la matriz reparada, lcube/samplecube reciben columnas de
  # program/level. La igualdad exacta de la muestra no se asierta (depende del
  # solver); lo verificable es que el pick corre y respeta la cuota.
  df <- .bs_estrato()
  pik <- rep(0.5, 8)
  sel <- list(balance_vars = .bs_vars, spread_vars = list())
  picked <- .cm_aulas_pick_local(df, pik, sel, seed = 123)
  if (is.null(picked)) skip("BalancedSampling no disponible en esta maquina")
  expect_length(unique(picked), 4L)
})
