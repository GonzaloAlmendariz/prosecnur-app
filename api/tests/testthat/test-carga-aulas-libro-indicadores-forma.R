# Tres defectos de la hoja «Como va el campo», los tres vistos en el PDF y
# ninguno visible desde el XML sin mirar la pagina entera.
#
# 1. `#,##0.#` OMITE el cero decimal, asi que «Media por aula» enseñaba un 23
#    entre 20.5, 21.9 y 23.8: la misma columna con dos formatos, y el ojo lee
#    ese equipo como si tuviera una cifra mas redonda que los demas.
# 2. Sin serie diaria, el bloque «Avance diario» **desaparecia entero** de la
#    hoja. Quien la vio con datos no puede saber si se retiro o si falta el dato.
# 3. El bloque de meta ponia cuatro «—» y dos bloques mas abajo sumaba 3 508
#    «efectivas declaradas» por aplicador: la misma pagina parecia decir que no
#    hay efectivas y listarlas. No se contradicen —una sale de plataforma y la
#    otra del parte— pero sin decirlo, quien lee elige cual creer.

# Los textos de la hoja, aplanados: `skipEmptyRows = FALSE` para que los indices
# no se corran (trampa conocida de `read.xlsx`).
.cif_textos <- function(ruta) {
  d <- openxlsx::read.xlsx(ruta, sheet = "Cómo va el campo", colNames = FALSE,
                           skipEmptyRows = FALSE)
  v <- unlist(lapply(d, as.character), use.names = FALSE)
  v[!is.na(v)]
}

# En que fila esta un rotulo de la primera columna util.
.cif_fila_de <- function(ruta, rotulo) {
  d <- openxlsx::read.xlsx(ruta, sheet = "Cómo va el campo", colNames = FALSE,
                           skipEmptyRows = FALSE)
  hit <- which(apply(d, 1, function(r) any(as.character(r) == rotulo, na.rm = TRUE)))
  if (!length(hit)) return(NA_integer_)
  hit[[1]]
}

.cif_libro <- function(con_diario = FALSE) {
  ruta <- tempfile(fileext = ".xlsx")
  plan <- lapply(1:6, function(i) list(
    classroom_id = paste0("A", i), operational_code = paste("CH", i), label = "x",
    wave = "M1", sample_role = "titular", orden = i, eligible_n = 30,
    expected_valid = 21, faculty = "F1"
  ))
  # Dos aplicadores con media entera y media con decimal: el caso que destapo el
  # formato. 25 aulas a 23 encuestas da 23.0 exacto.
  partes <- list(
    list(operational_code = "CH 1", applicator = "Equipo 1", effective_surveys = 23),
    list(operational_code = "CH 2", applicator = "Equipo 1", effective_surveys = 23),
    list(operational_code = "CH 3", applicator = "Equipo 2", effective_surveys = 20),
    list(operational_code = "CH 4", applicator = "Equipo 2", effective_surveys = 21)
  )
  aulas_libro_generar(plan, ruta, partes = partes)
  ruta
}

test_that("«Media por aula» declara su decimal aunque sea cero", {
  ruta <- .cif_libro()
  on.exit(unlink(ruta), add = TRUE)
  # La columna 4 de «Produccion por aplicador». El formato se resuelve celda a
  # celda —`s=` → `cellXfs` → `numFmtId` → `formatCode`— y no por el catalogo:
  # un `0.0` presente por OTRA hoja no prueba nada sobre esta.
  cab <- .cif_fila_de(ruta, "Media por aula")
  expect_true(is.finite(cab), info = "no se encontro la cabecera de la media")
  formatos <- vapply((cab + 1L):(cab + 2L),
                     function(f) formato_de_celda(ruta, "Cómo va el campo", 4, f),
                     character(1))
  # Ninguna celda de la media puede llevar un formato que omita el decimal.
  expect_false(any(grepl("0\\.#", formatos)),
               info = paste("formatos de la media:", paste(formatos, collapse = " · ")))
  expect_true(any(grepl("0\\.0", formatos)),
              info = paste("formatos de la media:", paste(formatos, collapse = " · ")))
})

test_that("«Avance diario» no desaparece cuando no hay serie", {
  ruta <- .cif_libro()
  on.exit(unlink(ruta), add = TRUE)
  textos <- .cif_textos(ruta)
  expect_true(any(grepl("^Avance diario$", textos)),
              info = "la seccion se esfumo en vez de contener su vacio")
  # Y dice la CAUSA, no solo el hecho.
  expect_true(any(grepl("no hay (efectivas por dia|base de respuestas)", textos)),
              info = paste(utils::head(textos, 40), collapse = " | "))
})

test_that("el bloque de meta dice de donde saldrian sus cifras", {
  ruta <- .cif_libro()
  on.exit(unlink(ruta), add = TRUE)
  textos <- .cif_textos(ruta)
  expect_true(any(grepl("salen de la plataforma, no del parte", textos)),
              info = "cuatro «—» arriba y 'efectivas declaradas' abajo, sin decir que son dos fuentes")
})

test_that("con las cifras completas, la nota de procedencia NO aparece", {
  # El control: si la nota saliera siempre, el test de arriba pasaria por la
  # razon equivocada y la hoja llevaria una explicacion que nadie necesita.
  ruta <- tempfile(fileext = ".xlsx")
  on.exit(unlink(ruta), add = TRUE)
  plan <- lapply(1:3, function(i) list(
    classroom_id = paste0("A", i), operational_code = paste("CH", i), label = "x",
    wave = "M1", sample_role = "titular", orden = i, eligible_n = 30,
    expected_valid = 20, faculty = "F1"
  ))
  respuestas <- data.frame(
    classroom_id = rep(c("A1", "A2", "A3"), each = 20),
    fecha = rep(c("2026-08-18", "2026-08-19", "2026-08-20"), each = 20),
    stringsAsFactors = FALSE
  )
  aulas_libro_generar(plan, ruta, efectivas = rep(20L, 3), responses = respuestas,
                      validas = rep(TRUE, nrow(respuestas)))
  textos <- .cif_textos(ruta)
  expect_false(any(grepl("salen de la plataforma, no del parte", textos)),
               info = "la nota aparece con las cifras completas, asi que no discrimina")
})
