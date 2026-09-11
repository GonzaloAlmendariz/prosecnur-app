# El rótulo de «Asignación de aplicadores» dice QUIÉN repartió.
#
# Desde que la app adopta la hoja de los aplicadores, cada cita adoptada es una
# fijación y el sorteo ya no la mueve: el 2026-09-10 eran noventa y tres de
# noventa y seis, y la hoja seguía encabezada con «Sorteo: original
# (alfabético)». Quien la abre entiende que repartió la app —y que puede volver
# a repartir distinto—, cuando lo que hay ahí es la decisión del coordinador.

plan_uno <- list(list(operational_code = "CH 1", faculty = "DERECHO",
                      scheduled_venue = "A1", scheduled_date = "2026-09-07",
                      scheduled_time = "10:00", eligible_n = 30))
disp_uno <- list(list(nombre = "Interno Pulso", dias = list("2026-09-07")))
nota_de <- function(cfg) {
  filas <- aulas_libro_filas_asignacion(plan_uno, disp_uno, cfg = cfg)
  filas[[2]]$celdas[[1]]
}

test_that("con citas adoptadas el rótulo nombra su procedencia, no el sorteo", {
  cfg <- list(reparto_fijado = as.list(stats::setNames(
    rep("Interno Pulso", 93), paste0("CH ", seq_len(93)))))
  nota <- nota_de(cfg)
  expect_match(nota, "93 citas tomadas de la hoja de los aplicadores", fixed = TRUE)
  # Y deja de decir que repartió un sorteo, que es lo que engañaba.
  expect_false(grepl("Sorteo", nota, fixed = TRUE))
})

test_that("una sola cita se dice en singular", {
  # Un rótulo que dice «1 citas» se lee como descuidado y resta confianza a la
  # cifra de al lado.
  expect_match(nota_de(list(reparto_fijado = list(`CH 1` = "Interno Pulso"))),
               "1 cita tomada de la hoja", fixed = TRUE)
})

test_that("sin citas adoptadas sigue diciendo el sorteo, como siempre", {
  expect_match(nota_de(list()), "Sorteo: original (alfabético)", fixed = TRUE)
  expect_match(nota_de(list(reparto_semilla = 4L)), "Sorteo:", fixed = TRUE)
})

test_that("el rango sigue estando, venga de donde venga el reparto", {
  # La nota contesta dos cosas —quién repartió y hasta cuándo— y arreglar una no
  # puede llevarse la otra.
  cfg <- list(reparto_fijado = list(`CH 1` = "Interno Pulso"),
              reparto_rango = list(desde = "2026-09-07", hasta = "2026-09-12"))
  expect_match(nota_de(cfg), "del 2026-09-07 al 2026-09-12", fixed = TRUE)
})
