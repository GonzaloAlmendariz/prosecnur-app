# La apertura de un recordatorio va después del saludo Y del nombre en su propio
# párrafo (Acreditación 2026: quedaba entre «Estimado(a)…» y el nombre), y toma la
# alineación del primer párrafo de texto, no la del nombre. Sin red.

.cmav_tpl <- function(con_nombre = TRUE) {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  g <- which(vapply(t$blocks, function(b) identical(b$type, "greeting"), NA))
  t$blocks[[g]]$text <- "**Estimado(a) profesor(a)**"; t$blocks[[g]]$fallback <- "**Estimado(a) profesor(a)**"; t$blocks[[g]]$trato <- NULL
  if (con_nombre) t$blocks <- append(t$blocks, list(list(block_id = "nombre-destinatario", type = "paragraph", text = "**{{nombre}}**", align = "left")), after = g)
  .cmail_template_normalize(t)
}
.cmav_rec <- list(send_id = "recordatorio-1", kind = "recordatorio", label = "R1", audience = "ambos", opening = "Le recordamos la invitación.")
ids <- function(t) vapply(t$blocks, function(b) b$block_id, "")

test_that("con el nombre en su párrafo, el orden es saludo, nombre, apertura y la apertura no hereda align left", {
  ef <- .cmail_template_for_send(.cmav_tpl(), .cmav_rec)
  i <- ids(ef); g <- which(vapply(ef$blocks, function(b) identical(b$type, "greeting"), NA))
  expect_identical(i[(g + 1):(g + 2)], c("nombre-destinatario", .CMAIL_OPENING_ID))
  ap <- ef$blocks[[g + 2]]
  expect_false(identical(ap$align, "left"))
})

test_that("sin párrafo de nombre la apertura sigue yendo justo después del saludo", {
  ef <- .cmail_template_for_send(.cmav_tpl(con_nombre = FALSE), .cmav_rec)
  g <- which(vapply(ef$blocks, function(b) identical(b$type, "greeting"), NA))
  expect_identical(ef$blocks[[g + 1]]$block_id, .CMAIL_OPENING_ID)
})
