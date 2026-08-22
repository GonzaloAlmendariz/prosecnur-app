# El Sheets del libro lo edita el equipo mientras el operativo corre: esconde una
# columna que le estorba, agrega una de notas, mueve algo. La hoja seguia
# leyendose «bien» —sin error y sin aviso— con la mitad de las aulas.
#
# La causa: los bloques de la hoja ancha se contaban por ANCHO,
# `(ncol - 1) %/% 20`. Con 41 columnas daban 2 y con 40 daban 1, asi que UNA
# columna borrada se llevaba por delante el bloque de la cadena de reservas.
# Y las reservas son justo lo que hay que vigilar para no acabar usandolas.

.hoja_de_dos_bloques <- function() {
  unidades <- list(
    list(operational_code = "CH 1", sample_role = "titular",
         titular_operational_code = "CH 1", teacher = "Docente Uno",
         teacher_phone = "999111222", course_name = "Curso Uno",
         faculty = "SOCIALES", eligible_n = 40, scheduled_date = "2026-08-11"),
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_order = 1,
         teacher = "Docente Dos", teacher_phone = "999333444",
         course_name = "Curso Dos", faculty = "SOCIALES", eligible_n = 30)
  )
  hoja <- aulas_libro_hoja_agendadas(unidades)
  lapply(seq_len(nrow(hoja)), function(i) as.list(as.character(hoja[i, ])))
}

.codigos <- function(plan) {
  vapply(plan, function(u) as.character(u$operational_code %||% ""), character(1))
}

test_that("una columna borrada NO se lleva la cadena de reservas", {
  val <- .hoja_de_dos_bloques()
  # El equipo borra la cuarta columna. Antes: 40 columnas -> 1 bloque -> la
  # reserva desaparecia del plan sin decir nada.
  recortada <- lapply(val, function(fila) fila[-4L])

  plan <- aulas_libro_desde_valores(recortada, "agendadas")
  expect_length(plan, 2L)
  expect_true(all(c("CH 1", "R 1.1") %in% .codigos(plan)))
})

test_that("una columna insertada no corre los campos de bloque a bloque", {
  val <- .hoja_de_dos_bloques()
  ins <- function(fila, pos, valor) append(fila, list(valor), after = pos)
  # «Observaciones» en medio del primer bloque.
  con <- lapply(seq_along(val), function(i)
    ins(val[[i]], 3L, if (i == 1L) "OBSERVACIONES" else sprintf("nota %d", i)))

  plan <- aulas_libro_desde_valores(con, "agendadas")
  expect_length(plan, 2L)
  # Y cada fila conserva SU telefono: el sintoma de una ventana corrida es que
  # el segundo bloque lea columnas del primero.
  por_codigo <- setNames(
    vapply(plan, function(u) as.character(u$teacher_phone %||% ""), character(1)),
    .codigos(plan)
  )
  expect_identical(unname(por_codigo[["CH 1"]]), "999111222")
  expect_identical(unname(por_codigo[["R 1.1"]]), "999333444")
})

test_that("una columna al principio tampoco descoloca los bloques", {
  val <- .hoja_de_dos_bloques()
  con <- lapply(seq_along(val), function(i)
    append(val[[i]], list(if (i == 1L) "NOTA" else sprintf("n%d", i)), after = 0L))

  plan <- aulas_libro_desde_valores(con, "agendadas")
  expect_true(all(c("CH 1", "R 1.1") %in% .codigos(plan)))
})

test_that("con la hoja intacta los arranques son los mismos que daba el ancho", {
  # El contrato de compatibilidad: la reparacion no puede mover una hoja sana.
  val <- .hoja_de_dos_bloques()
  titulos <- as.character(unlist(val[[1]]))
  n_bloques <- aulas_agendadas_n_bloques(length(titulos))
  por_ancho <- 1L + (seq_len(n_bloques) - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + 1L

  expect_identical(prosecnurapp:::.caa_bloques_desde(titulos), por_ancho)
})

test_that("sin titulos reconocibles se cae al calculo por ancho", {
  # Un data.frame con nombres genericos —V1, V2…— no tiene de donde sacar los
  # arranques; ahi el ancho sigue siendo la unica pista y no debe romperse.
  expect_length(prosecnurapp:::.caa_bloques_desde(c("V1", "V2", "V3")), 0L)
})
