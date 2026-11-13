# D9: en el listado de envío cada persona compartida va a un solo público, el que se decidió para su par.

.le_pub <- function(id, correos) list(id = id, nombre = toupper(id), correos = correos)

test_that("sin decidir el par, las compartidas quedan por decidir y el listado no está listo", {
  out <- calc_muestra_listado_asignar(list(.le_pub("a", c("x@p.pe", "Y@p.pe", "")), .le_pub("b", c("y@p.pe", "z@p.pe"))))
  expect_equal(out$pendientes, 1)
  expect_false(out$listo)
  expect_equal(out$pares[[1]]$n, 1)
  expect_identical(out$pares[[1]]$va, "")
  a <- out$publicos[[1]]
  expect_equal(c(a$invitados, a$quedan, a$cedidas, a$por_decidir, a$sin_correo), c(3, 1, 0, 1, 1))
  # Sin correo no recibe la encuesta por correo: va aparte, no entre quienes la reciben.
  expect_identical(out$destino$a, c(TRUE, FALSE, FALSE))
})

test_that("decidido el par, las compartidas van al público elegido y salen del otro", {
  out <- calc_muestra_listado_asignar(
    list(.le_pub("a", c("x@p.pe", "y@p.pe")), .le_pub("b", c("y@p.pe", "z@p.pe"))),
    list(list(a = "b", b = "a", va = "b")))
  expect_true(out$listo)
  expect_equal(out$publicos[[1]]$cedidas, 1)
  expect_equal(out$publicos[[1]]$quedan, 1)
  expect_equal(out$publicos[[2]]$quedan, 2)
  expect_identical(out$destino$b, c(TRUE, TRUE))
  # Nadie recibe dos encuestas: la suma de lo que queda es el número de correos distintos.
  expect_equal(out$publicos[[1]]$quedan + out$publicos[[2]]$quedan, 3)
})

test_that("una persona en tres públicos va al que gana sus dos pares; un ciclo la deja sin asignar", {
  pubs <- list(.le_pub("a", "w@p.pe"), .le_pub("b", "w@p.pe"), .le_pub("c", "w@p.pe"))
  orden <- calc_muestra_listado_asignar(pubs, list(list(a = "a", b = "b", va = "b"), list(a = "b", b = "c", va = "b"),
                                                   list(a = "a", b = "c", va = "c")))
  expect_true(orden$listo)
  expect_equal(vapply(orden$publicos, `[[`, numeric(1), "quedan"), c(0, 1, 0))
  ciclo <- calc_muestra_listado_asignar(pubs, list(list(a = "a", b = "b", va = "a"), list(a = "b", b = "c", va = "b"),
                                                   list(a = "a", b = "c", va = "c")))
  expect_equal(ciclo$pendientes, 0)
  expect_equal(ciclo$sin_asignar, 1)
  expect_false(ciclo$listo)
  expect_equal(ciclo$publicos[[1]]$sin_asignar, 1)
})

test_that("un correo repetido dentro del mismo público recibe una sola encuesta", {
  out <- calc_muestra_listado_asignar(list(.le_pub("a", c("x@p.pe", "X@p.pe ", "y@p.pe"))))
  expect_identical(out$destino$a, c(TRUE, FALSE, TRUE))
  expect_equal(out$publicos[[1]]$quedan, 2)
  expect_true(out$listo)
})

test_that("una decisión que no elige a uno de los dos públicos del par es un 400", {
  res <- tryCatch(calc_muestra_listado_asignar(list(.le_pub("a", "x@p.pe"), .le_pub("b", "x@p.pe")),
                                               list(list(a = "a", b = "b", va = "c"))),
                  error = function(e) e)
  expect_s3_class(res, "api_error")
})

test_that("las decisiones se limpian y el Excel lleva una hoja por público solo con su destino", {
  d <- calc_muestra_listado_decisiones(list(list(a = "a", b = "b", va = "a"), list(a = "b", b = "a", va = "b"),
                                            list(a = "a", b = "a", va = "a"), list(a = "a", b = "c", va = "x")))
  expect_length(d, 1)
  expect_identical(d[[1]]$va, "b")
  pubs <- list(
    list(id = "a", nombre = "Docentes", datos = data.frame(ID = c("1", "2"), MAIL = c("x@p.pe", "y@p.pe")),
         col_id = "ID", col_correo = "MAIL", col_segmento = "", correos = c("x@p.pe", "y@p.pe")),
    list(id = "b", nombre = "Administrativos", datos = data.frame(ID = c("9"), MAIL = c("y@p.pe")),
         col_id = "ID", col_correo = "MAIL", col_segmento = "", correos = c("y@p.pe")))
  pendiente <- calc_muestra_listado_asignar(pubs)
  expect_error(calc_muestra_listado_xlsx(pubs, pendiente, tempfile(fileext = ".xlsx")), class = "api_error")
  asig <- calc_muestra_listado_asignar(pubs, d)
  f <- tempfile(fileext = ".xlsx")
  calc_muestra_listado_xlsx(pubs, asig, f)
  expect_identical(openxlsx::getSheetNames(f), c("Docentes", "Administrativos"))
  expect_identical(openxlsx::read.xlsx(f, "Docentes")$MAIL, "x@p.pe")
  expect_identical(openxlsx::read.xlsx(f, "Administrativos")$MAIL, "y@p.pe")
})

test_that("la tanda de cada persona no cambia si el listado cambia, y la semilla la fija", {
  correos <- sprintf("p%04d@p.pe", 1:3000)
  t <- calc_muestra_listado_tandas(correos, 3, 7)
  expect_setequal(unique(t), 1:3)
  # Quitar una persona no mueve a nadie más de tanda (antes movía a 71 de 99).
  expect_identical(calc_muestra_listado_tandas(correos[-1], 3, 7), t[-1])
  expect_identical(calc_muestra_listado_tandas(toupper(correos), 3, 7), t)
  expect_false(identical(calc_muestra_listado_tandas(correos, 3, 8), t))
  # Tamaños parejos en promedio: ninguna tanda se aleja más de 10 % de un tercio.
  expect_true(all(abs(tabulate(t, 3) - 1000) < 100))
  expect_identical(calc_muestra_listado_tandas(correos[1:5], 1, 7), rep(1L, 5))
})

test_that("con tandas, cada hoja del Excel lleva la columna Tanda y sale ordenada por ella", {
  pubs <- list(list(id = "a", nombre = "Docentes",
                    datos = data.frame(ID = as.character(1:6), MAIL = sprintf("p%d@p.pe", 1:6), SEG = rep(c("X", "Y"), 3)),
                    col_id = "ID", col_correo = "MAIL", col_segmento = "SEG", correos = sprintf("p%d@p.pe", 1:6)))
  f <- tempfile(fileext = ".xlsx")
  calc_muestra_listado_xlsx(pubs, calc_muestra_listado_asignar(pubs), f, list(n = 2, semilla = 5))
  d <- openxlsx::read.xlsx(f, "Docentes")
  expect_identical(names(d), c("ID", "MAIL", "SEG", "Tanda"))
  expect_false(is.unsorted(d$Tanda))
  expect_equal(sum(table(d$Tanda)), 6)
  expect_identical(calc_muestra_listado_tandas_config(list(n = 99))$n, 20L)
})

test_that("las columnas del resumen suman los invitados de cada público", {
  out <- calc_muestra_listado_asignar(
    list(.le_pub("a", c("x@p.pe", "X@p.pe", "y@p.pe", "", NA, "z@p.pe")), .le_pub("b", c("z@p.pe", "w@p.pe"))))
  for (p in out$publicos) {
    expect_equal(p$quedan + p$cedidas + p$por_decidir + p$sin_asignar + p$sin_correo + p$repetidas, p$invitados)
  }
  expect_equal(out$publicos[[1]]$repetidas, 1)
  expect_equal(out$publicos[[1]]$sin_correo, 2)
})
