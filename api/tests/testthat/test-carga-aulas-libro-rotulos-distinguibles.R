# Dos rotulos del mismo bloque que solo se distinguian por una tilde.
#
# «Aulas Aplicadas (Campo)» repite la parte de agenda y le pega el parte de
# campo, asi que dentro de UN bloque salian:
#
#   FECHA DE APLICACION   (lo que se agendo)
#   FECHA DE APLICACIÓN   (lo que ocurrio)
#
# Lo unico que las separaba en pantalla era la tilde, que es una diferencia
# accidental y que nadie lee como distincion de significado. El lector ya lo
# sufria: separa las dos partes por la SEGUNDA aparicion de `MATRICULADOS TOTAL
# DTI`, una heuristica que existe solo porque los rotulos no se distinguen.
#
# Y el mismo par, sin dos significados detras: «MATRICULADOS POBLACION» contra
# «MATRICULADOS POBLACIÓN», el mismo dato escrito de dos formas a veinte
# columnas de distancia.
#
# Es la familia de la tanda 46 («DIA» vs «DÍA»), que no se barrio entera.

.crd_sin_tilde <- function(x) chartr("ÁÉÍÓÚÑáéíóúñ", "AEIOUNaeioun", x)

.crd_pares_por_tilde <- function(v) {
  v <- v[!is.na(v) & nzchar(v)]
  plano <- .crd_sin_tilde(v)
  repetidos <- names(which(table(plano) > 1))
  Filter(function(k) length(unique(v[plano == k])) > 1, repetidos)
}

.crd_cabeceras <- function(ruta, hoja) {
  fila <- if (identical(hoja, "Aulas Aplicadas (Campo)")) 2L else 1L
  d <- openxlsx::read.xlsx(ruta, sheet = hoja, colNames = FALSE,
                           skipEmptyRows = FALSE, rows = fila)
  as.character(unlist(d[1, ], use.names = FALSE))
}

.crd_libro <- function() {
  ruta <- tempfile(fileext = ".xlsx")
  plan <- list(
    list(classroom_id = "A1", operational_code = "CH 1", label = "x", wave = "M1",
         sample_role = "titular", orden = 1, eligible_n = 30,
         titular_operational_code = "CH 1"),
    list(classroom_id = "A2", operational_code = "R 1.1", label = "x", wave = "M1",
         sample_role = "chain_reserve", orden = 2, eligible_n = 28,
         replacement_order = 1, titular_operational_code = "CH 1")
  )
  aulas_libro_generar(plan, ruta, partes = list(
    list(operational_code = "CH 1", observed_students = 20, effective_surveys = 18)
  ))
  ruta
}

test_that("ninguna hoja escribe el mismo rotulo de dos formas", {
  ruta <- .crd_libro()
  on.exit(unlink(ruta), add = TRUE)
  for (h in c("Aulas Agendadas", "Aulas Aplicadas (Campo)", "Base de control")) {
    pares <- .crd_pares_por_tilde(.crd_cabeceras(ruta, h))
    expect_length(pares, 0L)
  }
})

test_that("las dos fechas del bloque de campo se llaman distinto", {
  ruta <- .crd_libro()
  on.exit(unlink(ruta), add = TRUE)
  cab <- .crd_cabeceras(ruta, "Aulas Aplicadas (Campo)")
  # **Dentro de UN bloque**, que es donde estaba la confusion. Entre bloques se
  # repiten a proposito: cada uno trae la fecha de SU aula, y ahi la banda
  # «TITULAR»/«REEMPLAZO n» de la fila 1 dice de quien es. El primer bloque va
  # de `ID MATCH` al siguiente `ID MATCH`.
  inicios <- which(cab == "ID MATCH")
  hasta <- if (length(inicios) > 1L) inicios[[2]] - 1L else length(cab)
  fechas <- grep("FECHA", cab[seq_len(hasta)], value = TRUE)
  # La agendada y la real, con nombres que dicen cual es cual.
  expect_true("FECHA AGENDADA" %in% fechas)
  expect_true("FECHA DE APLICACIÓN" %in% fechas)
  # Y no queda ninguna pareja indistinguible tras normalizar.
  expect_identical(anyDuplicated(.crd_sin_tilde(fechas)), 0L)
})

test_that("«Aulas Agendadas» conserva su fecha con el nombre de siempre", {
  # El control: el cambio es SOLO de la hoja de campo, donde hay dos fechas que
  # confundir. En la de agenda no hay con que confundirla y renombrarla ahi
  # rompería el vocabulario que el equipo ya conoce.
  ruta <- .crd_libro()
  on.exit(unlink(ruta), add = TRUE)
  cab <- .crd_cabeceras(ruta, "Aulas Agendadas")
  expect_true(any(grepl("^FECHA DE APLICACION", cab)))
  expect_false(any(cab == "FECHA AGENDADA"))
})

test_that("el lector sigue aceptando la escritura vieja", {
  # El equipo tiene libros de 2025 con «MATRICULADOS POBLACION» sin tilde y con
  # «FECHA DE APLICACION» en la parte de agenda de la hoja de campo.
  claves <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  spec <- AULAS_AGENDADAS_BLOQUE[[which(claves == "eligible_n")]]
  expect_true("MATRICULADOS POBLACION" %in% spec$titulos)
  expect_true("MATRICULADOS POBLACIÓN" %in% spec$titulos)
  # El canonico —el que se ESCRIBE— es el que lleva tilde.
  expect_identical(spec$titulos[[1]], "MATRICULADOS POBLACIÓN")
})
