source("setup-load-all.R")

# F6.0b.4: el visor del Word arma el mapa de capítulos desde el texto de cada página.

.paginas_word <- c(
  "Estudio de opinión\nInforme consolidado",
  "Contabilidad 2026    Contenido\nContenido\nÍndice de gráficos\nSe actualizan con clic derecho",
  "Contabilidad 2026    Introducción\nCAPÍTULO 1\nIntroducción\n1.1. Objetivo",
  "Contabilidad 2026    Cómo leer este informe\nCAPÍTULO 2\nCómo leer este informe\n2.1. Top Two Box",
  "Contabilidad 2026    Cómo leer este informe\n2.4. Cifras muy pequeñas\nSi una cifra no cabe",
  "Contabilidad 2026    Perfil del encuestado\nCAPÍTULO 3\nPerfil del encuestado\nGráfico 6",
  "pulso@pucp.edu.pe"
)

test_that("cada capítulo con su rango de páginas y cada sección con su página", {
  m <- .word_visor_mapa(.paginas_word)
  expect_equal(vapply(m$capitulos, `[[`, "", "titulo"), c("Introducción", "Cómo leer este informe", "Perfil del encuestado"))
  expect_equal(vapply(m$capitulos, `[[`, integer(1), "desde"), c(3L, 4L, 6L))
  expect_equal(vapply(m$capitulos, `[[`, integer(1), "hasta"), c(3L, 5L, 7L))
  expect_equal(vapply(m$secciones, `[[`, "", "numero"), c("1.1", "2.1", "2.4"))
  expect_equal(m$secciones[[3]]$pagina, 5L)
  expect_true(is.na(m$paginas[[1]]$capitulo)); expect_equal(m$paginas[[5]]$capitulo, "2")
})

test_that("un índice sin entradas (LibreOffice no rellena el TOC) se marca para avisarlo", {
  expect_true(.word_visor_mapa(.paginas_word)$indice_vacio)
  lleno <- .paginas_word; lleno[2] <- "Contenido\nContenido\n1. Introducción ........ 3\n2. Cómo leer este informe ..... 4"
  expect_false(.word_visor_mapa(lleno)$indice_vacio)
})

test_that("las páginas del Word salen como PNG con su mapa", {
  skip_if_not(nzchar(.soffice_cmd()), "sin LibreOffice")
  skip_if_not_installed("pdftools")
  doc <- officer::read_docx()
  doc <- officer::body_add_par(doc, "CAPÍTULO 1"); doc <- officer::body_add_par(doc, "Introducción")
  doc <- officer::body_add_par(doc, "1.1. Objetivo"); doc <- officer::body_add_break(doc)
  doc <- officer::body_add_par(doc, "CAPÍTULO 2"); doc <- officer::body_add_par(doc, "Resultados")
  f <- tempfile(fileext = ".docx"); print(doc, target = f)
  v <- .word_visor_paginas(f, tempfile("visor_"))
  expect_equal(v$n, 2L)
  expect_true(all(file.exists(v$archivos)))
  expect_equal(vapply(v$mapa$capitulos, `[[`, "", "titulo"), c("Introducción", "Resultados"))
})

test_that("un título de capítulo en dos líneas se lee entero", {
  m <- .word_visor_mapa(c("x    Estructura\nCAPÍTULO 6\nEstructura organizacional, administrativa y\nfinanciera\nGráfico 40",
                          "x    Cuerpo\nCAPÍTULO 7\nCuerpo académico\nGráfico 50"))
  expect_equal(vapply(m$capitulos, `[[`, "", "titulo"), c("Estructura organizacional, administrativa y financiera", "Cuerpo académico"))
})

test_that("el visor toma el último Word exportado de la sesión y dice qué falta si no hay ninguno", {
  a <- tempfile(fileext = ".docx"); b <- tempfile(fileext = ".docx"); file.create(a, b)
  files <- list(
    w1 = list(file_id = "w1", kind = "reporte_word", path = a, uploaded_at = "2026-10-09T10:00:00Z"),
    p1 = list(file_id = "p1", kind = "reporte_ppt", path = a, uploaded_at = "2026-10-10T10:00:00Z"),
    w2 = list(file_id = "w2", kind = "reporte_word", path = b, uploaded_at = "2026-10-10T09:00:00Z")
  )
  local_mocked_bindings(session_get = function(sid) list(files = files))
  expect_identical(.graficos_word_para_visor("s")$file_id, "w2")
  local_mocked_bindings(session_get = function(sid) list(files = files["p1"]))
  e <- tryCatch(.graficos_word_para_visor("s"), error = function(e) e)
  expect_match(conditionMessage(e), "Todavía no hay un Word exportado")
})

test_that("el worker del visor deja las páginas y la respuesta las entrega como imágenes con su mapa", {
  skip_if_not(nzchar(.soffice_cmd()), "sin LibreOffice")
  skip_if_not_installed("pdftools")
  doc <- officer::read_docx()
  doc <- officer::body_add_par(doc, "CAPÍTULO 1"); doc <- officer::body_add_par(doc, "Introducción")
  f <- tempfile(fileext = ".docx"); print(doc, target = f)
  r <- graficos_job_worker_word_visor(f, tempfile("visor_"), tempfile(fileext = ".rds"))
  resp <- .graficos_word_visor_respuesta(r, list(file_id = "w1", original_name = "informe.docx", uploaded_at = "2026-10-10"))
  expect_equal(resp$n, 1L)
  expect_match(resp$paginas[[1]], "^data:image/png;base64,")
  expect_equal(resp$mapa$capitulos[[1]]$titulo, "Introducción")
})

test_that("con la apertura B (número grande, la de fábrica) también se mapean los capítulos, y el folio no cuenta", {
  b <- c("Estudio\nInforme",
         "Contabilidad 2026    Introducción\n1\nIntroducción\nEl objetivo del estudio\n3",
         "Contabilidad 2026    Introducción\nTexto del capítulo\n4",
         "Contabilidad 2026    Perfil del encuestado\n2\nPerfil del encuestado\n2.1. Egresados\n5",
         "Contabilidad 2026    Estructura organizacional, administrativa y financiera\n3\nEstructura organizacional, administrativa y\nfinanciera\n6")
  m <- .word_visor_mapa(b)
  expect_equal(vapply(m$capitulos, `[[`, "", "numero"), c("1", "2", "3"))
  expect_equal(vapply(m$capitulos, `[[`, "", "titulo"), c("Introducción", "Perfil del encuestado", "Estructura organizacional, administrativa y financiera"))
  expect_equal(vapply(m$capitulos, `[[`, integer(1), "desde"), c(2L, 4L, 5L))
})
