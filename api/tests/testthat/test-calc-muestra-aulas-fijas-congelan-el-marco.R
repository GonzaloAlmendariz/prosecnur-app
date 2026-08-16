# Las aulas por facultad del preset HSVG estan CONGELADAS en 2025.
#
# `aulas_base_fijas` cortocircuita la formula: cuando viene > 0, el motor la
# devuelve tal cual y no mira el marco. El preset la trae rellena en las quince
# facultades, con los valores del diseno de 2025 (los del Excel mas la holgura
# de +1 por facultad, 177 en total).
#
# Eso hace lo correcto mientras el marco sea el de 2025 —de hecho reproduce el
# estudio al digito—, pero convierte una cifra calculable en una constante. Con
# el marco de 2026, donde los cursos-horario tienen otro tamano, el motor
# seguiria pidiendo las 177 aulas de 2025 sin que nada avise.
#
# Este archivo no arregla eso: lo hace VISIBLE. Fija el comportamiento de hoy
# para que quitar las fijas se vea en el diff, y de paso deja demostrado que la
# formula si reacciona al marco, que es lo que hace del congelamiento un
# defecto y no una limitacion.

.fijas_preset <- function() calc_muestra_aplicar_preset_hsvg()$componente

.fijas_sin <- function(comp) {
  comp$marco$estratos <- lapply(comp$marco$estratos, function(e) {
    e$aulas_base_fijas <- 0L
    e
  })
  comp
}

.fijas_escalar_aulas <- function(comp, factor) {
  comp$marco$estratos <- lapply(comp$marco$estratos, function(e) {
    e$promedio_conglomerado <- e$promedio_conglomerado * factor
    e
  })
  comp
}

test_that("el preset trae las quince aulas por facultad fijadas a mano", {
  fijas <- vapply(.fijas_preset()$marco$estratos, function(e) as.integer(e$aulas_base_fijas), integer(1))
  expect_length(fijas, 15L)
  expect_true(all(fijas > 0L))
  # Los valores del diseno de 2025: el Excel (162) mas +1 de holgura por
  # facultad. La holgura es decision operativa vigente; lo que este test vigila
  # es que sean CONSTANTES, no que valgan esto.
  expect_identical(sum(fijas), 177L)
})

test_that("con las aulas fijadas, el marco deja de importar", {
  # EL defecto. Aulas la mitad de grandes deberian pedir cerca del doble de
  # aulas; con las fijas no mueven ni una.
  comp <- .fijas_preset()
  base <- calc_muestra_calcular_componente(comp)$aulas_base_total
  expect_identical(base, 177L)

  for (factor in c(0.5, 2, 10)) {
    otro <- calc_muestra_calcular_componente(.fijas_escalar_aulas(comp, factor))$aulas_base_total
    expect_identical(otro, base)
  }
})

test_that("sin las fijas, la formula si sigue al marco", {
  # La otra mitad de la demostracion: el motor sabe calcularlo. Si no
  # reaccionara aqui tampoco, el congelamiento seria una limitacion del motor y
  # no una constante puesta encima.
  libre <- .fijas_sin(.fijas_preset())
  base <- calc_muestra_calcular_componente(libre)$aulas_base_total
  mitad <- calc_muestra_calcular_componente(.fijas_escalar_aulas(libre, 0.5))$aulas_base_total
  doble <- calc_muestra_calcular_componente(.fijas_escalar_aulas(libre, 2))$aulas_base_total

  expect_identical(base, 166L)
  expect_gt(mitad, base)   # aulas mas chicas -> hacen falta mas
  expect_lt(doble, base)   # aulas mas grandes -> hacen falta menos
  # Y el orden de magnitud es el que manda la aritmetica, no un ajuste suave.
  expect_gt(mitad, 1.7 * base)
})

test_that("min_media_mediana no puede dispararse sin mediana en el estrato", {
  # La regla que uso el diseno de 2025 —minimo entre mediana y media— existe en
  # el motor, pero degrada a la media en silencio cuando el estrato no trae
  # `mediana_conglomerado`. El preset la trae en 0 en las quince, asi que hoy
  # elegir el modo no cambia ni una cifra.
  medianas <- vapply(.fijas_preset()$marco$estratos,
                     function(e) as.numeric(e$mediana_conglomerado %||% 0), numeric(1))
  expect_true(all(medianas == 0))

  libre <- .fijas_sin(.fijas_preset())
  con_modo <- libre
  con_modo$parametros$estadistico_conglomerado <- "min_media_mediana"
  expect_identical(
    calc_muestra_calcular_componente(con_modo)$aulas_base_total,
    calc_muestra_calcular_componente(libre)$aulas_base_total
  )
  # Y el motor lo declara: dice que uso la media, no el minimo pedido.
  usados <- vapply(calc_muestra_calcular_componente(con_modo)$aulas_por_estrato,
                   function(x) x$estadistico_usado, character(1))
  expect_true(all(usados == "media"))

  # Alimentada la mediana, el modo SI manda y el resultado cambia.
  con_mediana <- con_modo
  con_mediana$marco$estratos <- lapply(con_mediana$marco$estratos, function(e) {
    e$mediana_conglomerado <- e$promedio_conglomerado / 2
    e
  })
  res <- calc_muestra_calcular_componente(con_mediana)
  expect_true(all(vapply(res$aulas_por_estrato, function(x) x$estadistico_usado, character(1)) == "min_media_mediana"))
  expect_gt(res$aulas_base_total, calc_muestra_calcular_componente(libre)$aulas_base_total)
})
