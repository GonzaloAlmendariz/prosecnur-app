# P1 #8: detección de booleano debe funcionar en idiomas comunes
# (es/en/pt/fr/de/it) cuando los valores son strings sin labels.

test_that("is_binary_like detecta sim/não (portugués) sin labels", {
  expect_true(.sm_is_binary_like(c("sim", "não", "sim")))
  expect_true(.sm_is_binary_like(c("Sim", "Não", "Sim")))
})

test_that("is_binary_like detecta oui/non (francés) sin labels", {
  expect_true(.sm_is_binary_like(c("oui", "non", "oui")))
  expect_true(.sm_is_binary_like(c("OUI", "NON")))
})

test_that("is_binary_like detecta ja/nein (alemán) sin labels", {
  expect_true(.sm_is_binary_like(c("ja", "nein", "ja")))
})

test_that("is_binary_like NO confunde 'cero/uno' como binario (no está en la lista)", {
  expect_false(.sm_is_binary_like(c("cero", "uno", "cero")))
})

test_that("is_binary_like sigue funcionando con español sí/no con tildes", {
  expect_true(.sm_is_binary_like(c("Sí", "No", "Sí")))
  expect_true(.sm_is_binary_like(c("si", "no")))
})

test_that("is_binary_like reconoce 0/1 numérico", {
  expect_true(.sm_is_binary_like(c(0, 1, 0, 1)))
  expect_true(.sm_is_binary_like(c("0", "1")))
  expect_false(.sm_is_binary_like(c(0, 1, 2)))
})

test_that("is_binary_like reconoce true/false y t/f y y/n", {
  expect_true(.sm_is_binary_like(c("true", "false")))
  expect_true(.sm_is_binary_like(c("y", "n", "y")))
  expect_true(.sm_is_binary_like(c("T", "F")))
})
