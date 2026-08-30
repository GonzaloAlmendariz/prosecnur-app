# =============================================================================
# El vocabulario de la casa también rige los textos del motor
# =============================================================================
#
# El ratchet de vocabulario del perfil (`vocabularioDeLaUnidad.contract.test.ts`)
# mira los archivos del FRONTEND. Los detalles de `validation` y los avisos de
# los paneles salen del motor y `presentDetail` los pinta tal cual, así que ese
# ratchet no puede verlos: «9 celdas sexo x facultad con brecha» llegaba a la
# pantalla con el término que el vocabulario retiró.
#
# Medido el 2026-08-30: 14 textos de `monitoreo_aulas_*.R` usan «aula» o
# «celda». Este guard NO los persigue a todos —muchos son correctos, «aula» es
# la palabra justa cuando se habla del salón físico— sino que fija los que ya se
# corrigieron para que no vuelvan.

test_that("el detalle de la cuota por sexo no dice «celdas»", {
  fuente <- readLines("../../R/monitoreo_aulas_universitarias.R", warn = FALSE)
  # Sólo las líneas de TEXTO publicable: las que arman un detalle con sprintf.
  publicables <- grep("sprintf\\(\"", fuente, value = TRUE)
  infractores <- grep("celdas? sexo", publicables, value = TRUE, ignore.case = TRUE)
  expect_equal(
    length(infractores), 0L,
    info = paste("«celda» es jerga de tabla estadística en la pantalla que lee",
                 "una autoridad. Va «grupos de facultad y sexo»:",
                 paste(infractores, collapse = " | "))
  )
})

test_that("y el guard mide algo: reconoce el texto viejo si vuelve", {
  # Control de fixture: sin esto, un patrón roto daría siempre cero infractores.
  muestra <- 'sprintf("%s celdas sexo x facultad con brecha.", n)'
  expect_length(grep("celdas? sexo", muestra, value = TRUE, ignore.case = TRUE), 1L)
})
