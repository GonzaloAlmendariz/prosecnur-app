# Tres defectos de la hoja «Avance de campo» —hasta A13a (2026-08-31) se
# llamaba «Cómo va el campo»; Gonzalo: «es AVANCE»—, los tres vistos en el PDF y
# ninguno visible desde el XML sin mirar la pagina entera.
#
# 1. `#,##0.#` OMITE el cero decimal, asi que «Media por aula» enseñaba un 23
#    entre 20.5, 21.9 y 23.8: la misma columna con dos formatos, y el ojo lee
#    ese equipo como si tuviera una cifra mas redonda que los demas.
# 2. Sin serie diaria, el bloque «Avance diario» **desaparecia entero** de la
#    hoja. Quien la vio con datos no puede saber si se retiro o si falta el dato.
# 3. El bloque de meta ponia cuatro «—» y dos bloques mas abajo listaba
#    producción por aplicador: la misma pagina parecia decir que no hay
#    efectivas y listarlas. La nota de procedencia lo explica, y sólo aparece
#    cuando de verdad hay huecos.

# Los textos de la hoja, aplanados: `skipEmptyRows = FALSE` para que los indices
# no se corran (trampa conocida de `read.xlsx`).
.cif_textos <- function(ruta) {
  d <- openxlsx::read.xlsx(ruta, sheet = "Avance de campo", colNames = FALSE,
                           skipEmptyRows = FALSE)
  v <- unlist(lapply(d, as.character), use.names = FALSE)
  v[!is.na(v)]
}

# En que fila esta un rotulo de la primera columna util.
.cif_fila_de <- function(ruta, rotulo) {
  d <- openxlsx::read.xlsx(ruta, sheet = "Avance de campo", colNames = FALSE,
                           skipEmptyRows = FALSE)
  hit <- which(apply(d, 1, function(r) any(as.character(r) == rotulo, na.rm = TRUE)))
  if (!length(hit)) return(NA_integer_)
  hit[[1]]
}

.cif_libro <- function(con_diario = FALSE, con_plataforma = TRUE) {
  ruta <- tempfile(fileext = ".xlsx")
  plan <- lapply(1:6, function(i) list(
    classroom_id = paste0("A", i), operational_code = paste("CH", i), label = "x",
    wave = "M1", sample_role = "titular", orden = i, eligible_n = 30,
    expected_valid = 21, faculty = "F1", rendimiento_ref = 0.7
  ))
  # Dos aplicadores con media entera y media con decimal: el caso que destapo el
  # formato. Dos cursos-horario a 23 encuestas dan 23.0 exacto; 20 y 21 dan 20.5.
  #
  # Desde el 2026-09-07 la media sale de la PLATAFORMA. La atribución la manda
  # el reparto y, sin reparto —este libro no lo tiene—, el parte: también dice
  # quién aplicó cada curso-horario.
  partes <- list(
    list(operational_code = "CH 1", applicator = "Equipo 1", effective_surveys = 23),
    list(operational_code = "CH 2", applicator = "Equipo 1", effective_surveys = 23),
    list(operational_code = "CH 3", applicator = "Equipo 2", effective_surveys = 20),
    list(operational_code = "CH 4", applicator = "Equipo 2", effective_surveys = 21)
  )
  # Sin efectivas de plataforma el bloque de meta sale en «—» y la hoja escribe
  # sus dos notas de procedencia: ése es el caso que los tests del vacío miran.
  aulas_libro_generar(plan, ruta, partes = partes,
                      efectivas = if (con_plataforma) {
                        c(`CH 1` = 23, `CH 2` = 23, `CH 3` = 20, `CH 4` = 21)
                      } else NULL)
  ruta
}

test_that("una TASA declara su decimal aunque su columna sea de razones", {
  # `#,##0.#` OMITE el cero decimal, así que una columna de razones enseñaba un
  # 23 entre 20,5 y 23,8 y el ojo lo lee como si ese equipo tuviera una cifra
  # más redonda que los demás. Desde el 2026-09-08 las razones de esta hoja son
  # tasas de rendimiento y van con formato de PORCENTAJE, que siempre declara su
  # decimal — y de paso cumple el dictado: el «(%)» va en la celda, no en el
  # rótulo.
  ruta <- .cif_libro()
  on.exit(unlink(ruta), add = TRUE)
  cab <- .cif_fila_de(ruta, "Tasa de rendimiento obtenida")
  expect_true(is.finite(cab), info = "no se encontró la cabecera de la tasa")
  # La columna se BUSCA por su cabecera: estuvo fijada al índice 4 y la tabla
  # ganó columnas, así que el índice apuntaba a otra cosa. Un número de columna
  # a mano es la misma ancla frágil que un rótulo.
  d <- openxlsx::read.xlsx(ruta, sheet = "Avance de campo", colNames = FALSE,
                           skipEmptyRows = FALSE)
  col_tasa <- which(as.character(unlist(d[cab, ])) == "Tasa de rendimiento obtenida")[[1]]
  formatos <- vapply((cab + 1L):(cab + 2L),
                     function(f) formato_de_celda(ruta, "Avance de campo", col_tasa, f),
                     character(1))
  expect_false(any(grepl("0\\.#", formatos)),
               info = paste("formatos de la tasa:", paste(formatos, collapse = " · ")))
  expect_true(all(formatos == "0.0%"),
              info = paste("formatos de la tasa:", paste(formatos, collapse = " · ")))
})

test_that("«Avance diario» no desaparece cuando no hay serie", {
  ruta <- .cif_libro(con_plataforma = FALSE)
  on.exit(unlink(ruta), add = TRUE)
  textos <- .cif_textos(ruta)
  expect_true(any(grepl("^Avance diario$", textos)),
              info = "la seccion se esfumo en vez de contener su vacio")
  # Y dice la CAUSA, no solo el hecho.
  expect_true(any(grepl("no hay (efectivas por dia|base de respuestas)", textos)),
              info = paste(utils::head(textos, 40), collapse = " | "))
})

test_that("el bloque de meta dice de donde saldrian sus cifras", {
  ruta <- .cif_libro(con_plataforma = FALSE)
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
