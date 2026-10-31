# El barrido telefónico avisa cuántas filas tienen el Status vacío y qué hace el
# motor con ellas (las cuenta como «No barrido» y las saca de la cola). Antes no
# lo decía en ninguna parte.

.tasv_datos <- function(status) {
  barrido <- data.frame(
    CodPulso = sprintf("P%03d", seq_along(status)), Status = status,
    .source_role = "barrido", .source_label = "Barrido", stringsAsFactors = FALSE, check.names = FALSE
  )
  respuestas <- data.frame(CodPulso = "P001", Status = "", .source_role = "respuestas",
                           .source_label = "Kobo", stringsAsFactors = FALSE, check.names = FALSE)
  rbind(barrido, respuestas)
}

test_that("con Status vacíos el barrido lo avisa con su cifra", {
  d <- .tasv_datos(c(rep("", 9), rep("No contesta", 3)))
  a <- .monitoreo_report_alerts_df(d, list(family = "telefonico"))
  fila <- a[a[["Tipo alerta"]] == "status_vacio_barrido", , drop = FALSE]
  expect_equal(nrow(fila), 1L)
  expect_match(fila$Detalle, "^9 filas del barrido sin Status")
  expect_match(fila$Detalle, "No barrido")
})

test_that("sin Status vacíos no hay aviso", {
  d <- .tasv_datos(rep("No contesta", 3))
  a <- .monitoreo_report_alerts_df(d, list(family = "telefonico"))
  expect_false("status_vacio_barrido" %in% a[["Tipo alerta"]])
})

test_that("una sola fila se dice en singular", {
  avisos <- .monitoreo_aviso_status_vacio(data.frame(Status = c("", "Efectivo"), stringsAsFactors = FALSE))
  expect_match(avisos[[1]]$Detalle, "^1 fila del barrido sin Status: se cuenta")
})
