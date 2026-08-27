# De dónde sale el número de titulares de un estrato.
#
# `aulas_base_fijas` es un entero pelado y el motor lo respeta venga de donde
# venga, así que sin declarar el origen los tres —lo que calcula la fórmula, lo
# que certifica la simulación y lo que decide el analista— producen números
# idénticos a la vista. Medido en HSVG26ULT: `max(fórmula, certeza)` explica 14
# de 15 facultades y da 173; el final es 174. Ese aula de diferencia es una
# decisión de Gonzalo (2026-08-27, «agregación operativa») que el proyecto no
# distinguía de las otras 173.

.origen_comp <- function(fijas = NULL, origen = NULL, nota = NULL) {
  estrato <- list(label = "FAC1", N = 4000, promedio_conglomerado = 25, tau = 0.5)
  if (!is.null(fijas)) estrato$aulas_base_fijas <- fijas
  if (!is.null(origen)) estrato$aulas_base_origen <- origen
  if (!is.null(nota)) estrato$aulas_base_nota <- nota
  list(
    tecnica = "prob_conglomerado_multietapico",
    marco = list(estado = "validado", estratos = list(estrato)),
    parametros = list(promedio_conglomerado = 25, tau = 0.5)
  )
}

test_that("el origen y la nota sobreviven la normalización del estrato", {
  comp <- calc_muestra_normalize_componente(
    .origen_comp(fijas = 19, origen = "operativa", nota = "va justa por sexo")
  )
  e <- comp$marco$estratos[[1]]
  expect_identical(e$aulas_base_origen, "operativa")
  expect_identical(e$aulas_base_nota, "va justa por sexo")

  # Round-trip idempotente: la whitelist del componente los conserva.
  otra <- calc_muestra_normalize_componente(comp)
  expect_identical(otra$marco$estratos[[1]]$aulas_base_origen, "operativa")
  expect_identical(otra$marco$estratos[[1]]$aulas_base_nota, "va justa por sexo")
})

test_that("un origen inventado no se guarda: degrada a desconocido", {
  comp <- calc_muestra_normalize_componente(
    .origen_comp(fijas = 19, origen = "porque_si")
  )
  expect_identical(comp$marco$estratos[[1]]$aulas_base_origen, "")
})

test_that("sin fijación el resultado declara que el número es de la fórmula", {
  ape <- calc_muestra_calcular_componente(.origen_comp())$aulas_por_estrato
  expect_identical(ape[[1]]$aulas_base_origen, "formula")
  expect_identical(ape[[1]]$aulas_base, ape[[1]]$aulas_formula)
})

test_that("una fijación IGUAL a la fórmula no se atribuye a nadie", {
  # Fijar el número que la fórmula ya calculaba no es una decisión, y pintarlo
  # como agregación operativa atribuiría un juicio que nadie hizo.
  base <- calc_muestra_calcular_componente(.origen_comp())$aulas_por_estrato[[1]]
  igual <- calc_muestra_calcular_componente(
    .origen_comp(fijas = base$aulas_formula, origen = "operativa")
  )$aulas_por_estrato[[1]]
  expect_identical(igual$aulas_base_origen, "formula")
  expect_identical(igual$aulas_base, base$aulas_formula)
})

test_that("una fijación que se aparta viaja al resultado con su origen y su nota", {
  base <- calc_muestra_calcular_componente(.origen_comp())$aulas_por_estrato[[1]]
  mas <- base$aulas_formula + 1L
  fila <- calc_muestra_calcular_componente(
    .origen_comp(fijas = mas, origen = "operativa", nota = "la celda de mujeres va al filo")
  )$aulas_por_estrato[[1]]
  expect_identical(fila$aulas_base, mas)
  # La fórmula sigue publicándose aparte: sin ella la pantalla no puede decir
  # cuánto se apartó la decisión.
  expect_identical(fila$aulas_formula, base$aulas_formula)
  expect_identical(fila$aulas_base_origen, "operativa")
  expect_identical(fila$aulas_base_nota, "la celda de mujeres va al filo")
})

test_that("una fijación sin origen declarado se queda sin atribuir, no se inventa", {
  base <- calc_muestra_calcular_componente(.origen_comp())$aulas_por_estrato[[1]]
  fila <- calc_muestra_calcular_componente(
    .origen_comp(fijas = base$aulas_formula + 2L)
  )$aulas_por_estrato[[1]]
  expect_identical(fila$aulas_base_origen, "")
})

# LAS DOS TÉCNICAS. `aulas_por_estrato` se construye en DOS sitios del motor:
# `.cm_calc_conglomerado` (P1 · universidad) y
# `.cm_calc_estratificado_independiente` (P2 · facultades). El segundo se quedó
# atrás al añadir los campos y por eso la ruta de cálculo del reparto por
# facultad —que es justo la que usa HSVG2026— publicaba filas sin origen.

.origen_comp_indep <- function(fijas = NULL, origen = NULL, nota = NULL) {
  comp <- .origen_comp(fijas = fijas, origen = origen, nota = nota)
  comp$tecnica <- "prob_estratificado_independiente"
  comp
}

test_that("la técnica por facultad también publica origen, nota y la fórmula", {
  base <- calc_muestra_calcular_componente(.origen_comp_indep())$aulas_por_estrato[[1]]
  expect_false(is.null(base$aulas_formula))
  expect_identical(base$aulas_base_origen, "formula")

  mas <- base$aulas_formula + 1L
  fila <- calc_muestra_calcular_componente(
    .origen_comp_indep(fijas = mas, origen = "operativa", nota = "Derecho va al filo")
  )$aulas_por_estrato[[1]]
  expect_identical(fila$aulas_base, mas)
  expect_identical(fila$aulas_formula, base$aulas_formula)
  expect_identical(fila$aulas_base_origen, "operativa")
  expect_identical(fila$aulas_base_nota, "Derecho va al filo")
})

test_that("la técnica por facultad respeta la fijación, no la ignora", {
  # El sintoma que destapó todo esto en la app: el objetivo saltó de 175 a 294
  # porque las fijaciones habían desaparecido. Si el motor dejara de honrarlas,
  # este assert cae.
  base <- calc_muestra_calcular_componente(.origen_comp_indep())$aulas_por_estrato[[1]]
  fijado <- calc_muestra_calcular_componente(
    .origen_comp_indep(fijas = base$aulas_formula + 3L, origen = "operativa")
  )$aulas_por_estrato[[1]]
  expect_identical(fijado$aulas_base, base$aulas_formula + 3L)
})
