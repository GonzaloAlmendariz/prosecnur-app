# B9b — las dos hojas del equipo en el MISMO orden de filas (el M1 de 2025) y
# el arrastre mostrando lo que la celda MUESTRA, no su serial.
#
# Medido en vivo el 2026-09-01 sobre el libro v2 del operativo:
# - Aplicadas iba 1..9 y saltaba a 24, 30, 27…: el plan intercala reservas de
#   otras cadenas tras los primeros titulares (R 24.6 aparece antes que CH 24)
#   y Agendadas ordenaba grupos por primera aparicion de la clave INCLUYENDO
#   reservas, mientras Aplicadas itera titulares. Dos hojas, dos ordenes, y el
#   ID MATCH arrastrado delataba el desfase.
# - La fecha tecleada 01/09/2026 llegaba como «46266» y la hora 3:25 como
#   «0,14236…»: el `&""` de la formula concatena el VALOR crudo (serial), no lo
#   que la celda muestra. TO_TEXT(ref) devuelve el texto tal como se ve, con un
#   solo argumento (sin separadores dependientes del locale) y vacio → vacio.

.oe_unidad <- function(code, role, toc = code, orden = NA) {
  list(operational_code = code, sample_role = role,
       titular_operational_code = toc, replacement_order = orden,
       teacher = paste("Docente", code), eligible_n = 20, enrolled_total = 22)
}

# Plan intercalado como el real: la reserva de la cadena 9 aparece ANTES que el
# titular CH 5, y el titular CH 9 recien al final — la primera aparicion de la
# clave CH 9 es su reserva, no su titular (asi se colaba CH 24 a la fila 10 en
# el libro real).
.oe_plan <- function() list(
  .oe_unidad("CH 1", "titular"),
  .oe_unidad("CH 2", "titular"),
  .oe_unidad("CH 3", "titular"),
  .oe_unidad("R 9.6", "chain_reserve", toc = "CH 9", orden = 6),
  .oe_unidad("CH 5", "titular"),
  .oe_unidad("CH 9", "titular"),
  .oe_unidad("R 1.1", "chain_reserve", toc = "CH 1", orden = 1)
)

.oe_codigos <- function(hoja, col_ch) {
  vapply(2:nrow(hoja), function(r) as.character(hoja[r, col_ch]), character(1))
}

test_that("Agendadas ordena por aparicion del TITULAR, no de la cadena", {
  hoja <- aulas_libro_hoja_agendadas(.oe_plan())
  cab <- as.character(unlist(hoja[1, ]))
  col_ch <- which(cab == "CURSO-HORARIO")[[1]]
  cods <- .oe_codigos(hoja, col_ch)
  # Hoy: R 9.6 aparece antes que CH 5 y la cadena 9 se cuela a la fila 5
  # («CH 1, CH 2, CH 3, CH 9, CH 5»). El orden correcto es el de los titulares.
  expect_identical(cods, c("CH 1", "CH 2", "CH 3", "CH 5", "CH 9"))
})

test_that("las dos hojas del equipo van fila a fila (M1 de 2025)", {
  plan <- .oe_plan()
  ag <- aulas_libro_hoja_agendadas(plan)
  ap <- aulas_libro_hoja_aplicadas(plan)
  cab_ag <- as.character(unlist(ag[1, ]))
  col_ag <- which(cab_ag == "CURSO-HORARIO")[[1]]
  # Aplicadas tiene 2 filas de cabecera (banda + titulos, fila de titulos = 2).
  cab_ap <- as.character(unlist(ap[2, ]))
  col_ap <- which(cab_ap == "CURSO-HORARIO")[[1]]
  cods_ag <- vapply(2:nrow(ag), function(r) as.character(ag[r, col_ag]), character(1))
  cods_ap <- vapply(3:nrow(ap), function(r) as.character(ap[r, col_ap]), character(1))
  expect_identical(cods_ap, cods_ag)
})

test_that("el arrastre usa TO_TEXT: lo que se MUESTRA, no el serial", {
  f <- prosecnurapp:::.malar_formula("Aulas Agendadas", 2L, 2L)
  # `&""` concatenaba el serial (46266 por 01/09/2026; 0,1423… por 3:25).
  expect_false(grepl('&""', f, fixed = TRUE))
  expect_match(f, "^=TO_TEXT\\('Aulas Agendadas'!B2\\)$")
})
