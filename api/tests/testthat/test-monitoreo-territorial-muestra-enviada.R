# I4 (decidido por Meta B, 2026-11-01): Monitoreo lee la muestra viva y avisa
# cuando difiere de la foto enviada a Material.

.tme_muestra <- function(seed, ids, rem = character(0)) {
  list(seed = seed,
       blocks = lapply(ids, function(i) list(id_manzana = i, ump = i, cuota_total = 5L)),
       replacement_blocks = lapply(rem, function(i) list(id_manzana = i, ump = i, cuota_total = 5L)))
}

.tme_enviar <- function(muestra, at = "2026-10-20T15:00:00Z") {
  .hojas_ruta_envio_normalize(list(sample = muestra, enviado_at = at))
}

test_that("sin re-sorteo, la viva es la enviada", {
  m <- .tme_muestra(11L, c("M1", "M2", "M3"), "R1")
  r <- monitoreo_territorial_muestra_enviada_desde(.tme_enviar(m), m)
  expect_identical(r$estado, "igual")
  expect_identical(r$ump_enviadas, 4L)
  expect_identical(r$texto, "")
})

test_that("se vuelve a sortear después de enviar: lo dice con la causa, la fecha y cuántas UMP cambian", {
  enviada <- .tme_muestra(11L, c("M1", "M2", "M3"), "R1")
  envio <- .tme_enviar(enviada)
  resorteada <- .tme_muestra(42L, c("M1", "M4", "M5"), "R1")
  r <- monitoreo_territorial_muestra_enviada_desde(envio, resorteada)
  expect_identical(r$estado, "distinta")
  expect_identical(c(r$semilla_enviada, r$semilla_viva), c(11L, 42L))
  expect_setequal(unlist(r$entran), c("M4", "M5"))
  expect_setequal(unlist(r$salen), c("M2", "M3"))
  expect_identical(r$cambian, 4L)
  expect_match(r$texto, "se volvió a sortear después del envío (semilla 42; Material tiene la 11)", fixed = TRUE)
  expect_match(r$texto, "Material recibió la del 20 de octubre", fixed = TRUE)
  expect_match(r$texto, "2 UMP entran, 2 UMP salen", fixed = TRUE)
})

test_that("misma semilla con otro recorrido también se avisa, sin culpar al sorteo", {
  enviada <- .tme_muestra(11L, c("M1", "M2"))
  otra <- .tme_muestra(11L, c("M1", "M2"))
  otra$blocks[[1]]$viviendas <- 30L
  r <- monitoreo_territorial_muestra_enviada_desde(.tme_enviar(enviada), otra)
  expect_identical(r$estado, "distinta")
  expect_identical(r$cambian, 0L)
  expect_match(r$texto, "misma semilla, otra configuración", fixed = TRUE)
  expect_match(r$texto, "las UMP y sus papeles son los mismos, pero cambió su recorrido", fixed = TRUE)
})

test_that("sin envío o sin muestra viva no hay comparación", {
  expect_identical(monitoreo_territorial_muestra_enviada_desde(NULL, .tme_muestra(1L, "M1"))$estado, "sin_envio")
  expect_identical(monitoreo_territorial_muestra_enviada_desde(.tme_enviar(.tme_muestra(1L, "M1")), NULL)$estado, "sin_muestra")
})

test_that("una manzana que pasa de titular a reemplazo cuenta como cambio y se nombra", {
  enviada <- .tme_muestra(11L, c("M1", "M2"), "R1")
  viva <- .tme_muestra(11L, c("M1", "R1"), "M2")
  r <- monitoreo_territorial_muestra_enviada_desde(.tme_enviar(enviada), viva)
  expect_identical(r$estado, "distinta")
  expect_setequal(unlist(r$cambian_rol), c("M2", "R1"))
  expect_identical(r$cambian, 2L)
  expect_match(r$texto, "2 UMP cambian de titular a reemplazo o al revés", fixed = TRUE)
  expect_false(grepl("son los mismos", r$texto, fixed = TRUE))
})

test_that("3 que entran y 1 que sale: se dicen por separado y cuentan 4 afectadas", {
  enviada <- .tme_muestra(11L, c("M1", "M2"))
  viva <- .tme_muestra(42L, c("M1", "M3", "M4", "M5"))
  r <- monitoreo_territorial_muestra_enviada_desde(.tme_enviar(enviada), viva)
  expect_identical(r$cambian, 4L)
  expect_match(r$texto, "3 UMP entran, 1 UMP sale", fixed = TRUE)
})

test_that("sin semilla en un lado no se afirma la causa", {
  enviada <- .tme_muestra(11L, c("M1", "M2"))
  viva <- .tme_muestra(NULL, c("M1", "M3"))
  r <- monitoreo_territorial_muestra_enviada_desde(.tme_enviar(enviada), viva)
  expect_true(is.na(r$semilla_viva))
  expect_match(r$texto, "^La muestra cambió después del envío\\. ")
  expect_false(grepl("misma semilla", r$texto, fixed = TRUE))
})

test_that("un envío de noche en Lima se fecha ese día, no el siguiente en UTC", {
  m <- .tme_muestra(11L, c("M1"))
  r <- monitoreo_territorial_muestra_enviada_desde(.tme_enviar(m, at = "2026-10-21T04:30:00Z"), .tme_muestra(42L, c("M2")))
  expect_match(r$texto, "Material recibió la del 20 de octubre", fixed = TRUE)
})
