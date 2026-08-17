# El alto del cajon tiene que llegar al graficador EN EL BLOQUE QUE SE EJECUTA.
#
# El defecto que estas pruebas cubren no fue un calculo mal hecho: fue enchufar
# el valor en el layout equivocado. `reporte_plan_ppt.R` tiene dos bloques de
# cuatro paneles —`paneles_4` y `poblacion_4`— con call sites casi identicos, y
# el primer intento paso `alto_slot` por `paneles_4`. En el mazo de Conta las
# seis laminas de cuatro paneles son las seis `poblacion_4`; de `paneles_4` no
# hay ninguna, y su layout ni siquiera existe en la plantilla. El render salio
# byte a byte igual y la vara no se movio: nada avisaba.
#
# De ahi que se compruebe el CODIGO FUENTE del renderer y no solo la constante.
# Una prueba sobre la constante sola pasa con el arreglo puesto en cualquiera de
# los dos bloques, que es justamente lo que no distingue.

.fuente_renderer <- function() {
  ruta <- testthat::test_path("..", "..", "R", "reporte_plan_ppt.R")
  testthat::skip_if_not(file.exists(ruta), "no se encontro reporte_plan_ppt.R")
  readLines(ruta, warn = FALSE)
}

# Devuelve las lineas del bloque que atiende `stype`, hasta el `next` que lo
# cierra.
.bloque_de <- function(lineas, stype) {
  ini <- grep(sprintf('identical\\(stype, "%s"\\)', stype), lineas, fixed = FALSE)
  if (!length(ini)) return(character(0))
  ini <- ini[1]
  resto <- lineas[seq(ini, length(lineas))]
  fin <- grep("^      next$", resto)
  if (!length(fin)) return(resto)
  resto[seq_len(fin[1])]
}


test_that("el alto medido del cajon existe y es el del XML de la lamina 13", {
  # 5.169 x 2.565 in, medidos sobre los cuatro grupos de nivel superior de
  # `slide13.xml` del mazo de Conta. El ancho ya viajaba como 5.2; el alto es
  # este.
  expect_true(exists(".POBLACION_4_ALTO_SLOT_IN"))
  expect_equal(.POBLACION_4_ALTO_SLOT_IN, 2.565)
})


test_that("el bloque poblacion_4 pasa el alto en sus cuatro paneles", {
  bloque <- .bloque_de(.fuente_renderer(), "poblacion_4")
  expect_gt(length(bloque), 0)

  con_ancho <- grep("\\.render_element\\(.*ancho_slot = 5\\.2", bloque)
  expect_equal(length(con_ancho), 4L)

  # El `alto_slot` puede ir en la misma linea o en la siguiente: se mira el par.
  lleva_alto <- vapply(con_ancho, function(i) {
    tramo <- paste(bloque[seq(i, min(i + 1L, length(bloque)))], collapse = " ")
    grepl("alto_slot = .POBLACION_4_ALTO_SLOT_IN", tramo, fixed = TRUE)
  }, logical(1))
  expect_true(all(lleva_alto))
})


test_that("el bloque paneles_4 NO se queda con una medida que no es suya", {
  # Su cajon no esta medido. Pasarle el 2.565 de `poblacion_4` seria inventar
  # una geometria, y ademas es el error exacto que costo un turno entero.
  bloque <- .bloque_de(.fuente_renderer(), "paneles_4")
  expect_gt(length(bloque), 0)
  expect_false(any(grepl("POBLACION_4_ALTO_SLOT_IN", bloque, fixed = TRUE)))
})


test_that("el renderer sabe inyectar el alto y no pisa el que ya venia", {
  # Contrato de `.render_element()`: `alto_slot` rellena `overrides$alto` solo
  # cuando el elemento no traia el suyo.
  lineas <- .fuente_renderer()
  firma <- grep("\\.render_element <- function\\(el, ancho_slot = NULL, alto_slot = NULL\\)",
                lineas)
  expect_equal(length(firma), 1L)

  cuerpo <- paste(lineas[seq(firma[1], min(firma[1] + 12L, length(lineas)))],
                  collapse = " ")
  expect_true(grepl("el\\$overrides\\$alto <- alto_slot", cuerpo))
  expect_true(grepl("is.null((el$overrides %||% list())$alto)", cuerpo, fixed = TRUE))
})
