# La lista de variables del explorador (Validación › Explorar) clasifica lo que
# trae una base real de Kobo: la madre de una múltiple llega en minúsculas, los
# `calculate` llegan como texto y la plataforma suma columnas de sistema.

inventario_fixture <- function() {
  survey <- data.frame(
    type = c("select_one sino", "select_multiple medios", "calculate", "text"),
    name = c("consent", "D1_information", "duracion_A_seg", "comentario"),
    label = c("¿Acepta?", "¿Dónde vio los mensajes?", "Duración A", "Comentario"),
    stringsAsFactors = FALSE
  )
  n <- 30L
  data <- data.frame(
    consent = rep(c("1", "2"), length.out = n),
    d1_information.1 = rep(c("1", "0"), length.out = n),
    d1_information.2 = rep(c("0", "1"), length.out = n),
    duracion_A_seg = as.character(seq_len(n) * 7L),
    comentario = paste("texto", seq_len(n)),
    kobo_fecha = rep(c("2026-07-01", "2026-07-02", "2026-07-03"), length.out = n),
    `_status` = rep("submitted_via_web", n),
    formhub.uuid = rep("abc", n),
    `__version__` = rep("v1", n),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  list(data = data, instrumento = list(survey = survey))
}

variables_de <- function(inv) {
  unlist(lapply(inv$secciones, function(s) lapply(s$variables, function(v) {
    stats::setNames(v$tipo, v$name)
  })))
}

test_that("la múltiple en minúsculas es una sola variable y sus dummies no se listan", {
  f <- inventario_fixture()
  vars <- variables_de(.explorar_inventario(f$data, f$instrumento))
  expect_equal(unname(vars["d1_information"]), "sm")
  expect_false(any(grepl("^d1_information\\.", names(vars))))
})

test_that("un calculate numérico es numérica y una fecha ISO es fecha", {
  f <- inventario_fixture()
  vars <- variables_de(.explorar_inventario(f$data, f$instrumento))
  expect_equal(unname(vars["duracion_A_seg"]), "num")
  expect_equal(unname(vars["kobo_fecha"]), "fecha")
})

test_that("las columnas de sistema de la plataforma no se listan como preguntas", {
  f <- inventario_fixture()
  vars <- variables_de(.explorar_inventario(f$data, f$instrumento))
  expect_false(any(c("_status", "formhub.uuid", "__version__") %in% names(vars)))
  expect_true(all(c("consent", "comentario") %in% names(vars)))
})

test_that("pocos códigos numéricos en texto siguen siendo una única", {
  expect_equal(.explorar_tipo_var("x", df = data.frame(x = rep(c("1", "2", "3"), 10))), "so")
})
