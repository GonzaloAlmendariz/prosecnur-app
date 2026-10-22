source("setup-load-all.R")

# Contrato E4-E7 (R4): estructura de los XLSX comparativos contra la maqueta
# aprobada («Comparativo simple 2024-2026» y «Comparativo cruces 2024-2026»).
# El fixture sintético (tres mediciones, pesos distintos) es el de
# test-analitica-armonizada.R: se cargan sus definiciones `.az_*` para no
# mantener dos copias que diverjan.
for (.rc_e in parse(test_path("test-analitica-armonizada.R"), encoding = "UTF-8")) {
  if (is.call(.rc_e) && identical(.rc_e[[1]], as.name("<-")) &&
      grepl("^\\.az_", as.character(.rc_e[[2]]))) {
    eval(.rc_e)
  }
}

.rc_estilo <- function(wb, hoja, fila, col) {
  out <- NULL
  for (so in wb$styleObjects) {
    if (identical(so$sheet, hoja) && any(so$rows == fila & so$cols == col)) out <- so$style
  }
  out
}

.rc_merges <- function(wb, hoja) {
  m <- wb$worksheets[[which(names(wb) == hoja)]]$mergeCells
  sub('.*ref="([^"]+)".*', "\\1", m)
}

.rc_celdas <- function(path) {
  openxlsx::read.xlsx(path, colNames = FALSE, skipEmptyRows = FALSE, skipEmptyCols = FALSE)
}

.rc_generar <- function(env = parent.frame(), datos = .az_datos(), extras = NULL) {
  sid <- .az_setup(env, datos = datos)
  cfg <- list(notas = .az_notas())
  dir <- withr::local_tempdir(.local_envir = env)
  ap_f <- .armz_preparar(sid, cfg)
  ap_c <- .armz_preparar(sid, cfg, cruces_refs = list("S-05"))
  rot <- .armz_rotulos(ap_f$periodos)
  mf <- armonizada_modelo_frecuencias(ap_f)
  mc <- armonizada_modelo_cruces(ap_c)
  list(
    simple = file.path(dir, "simple.xlsx"), cruces = file.path(dir, "cruces.xlsx"),
    mf = mf, mc = mc,
    rs = reporte_comparativo_simple(mf, file.path(dir, "simple.xlsx"), rot, cfg$notas, extras = extras),
    rcz = reporte_comparativo_cruces(mc, file.path(dir, "cruces.xlsx"), rot, cfg$notas, extras = extras)
  )
}

# Saltos de página manuales de la hoja (openxlsx no los relee con loadWorkbook).
.rc_saltos <- function(path) {
  xml <- paste(readLines(unz(path, "xl/worksheets/sheet1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
  as.integer(regmatches(xml, gregexpr('(?<=<brk id=")[0-9]+', xml, perl = TRUE))[[1]])
}

# Notas al pie: sin raya, punto medio ni punto y coma. La marca «—» de opción
# no ofrecida es la única raya permitida, y sólo como marca al inicio.
.rc_notas_limpias <- function(notas) {
  notas <- sub("^n\\.a\\.: ", "", notas)
  expect_false(any(grepl("[;·—–]", notas)), info = paste(notas, collapse = " | "))
}

test_that("comparativo simple: geometría, formatos, n.c., «—» y pie como la maqueta", {
  g <- .rc_generar()
  expect_identical(openxlsx::getSheetNames(g$simple), "Comparativo")
  d <- .rc_celdas(g$simple)
  wb <- openxlsx::loadWorkbook(g$simple)
  m <- .rc_merges(wb, "Comparativo")

  expect_identical(d[1, 1], "VIOLENCIA BASADA EN GÉNERO")
  expect_identical(d[3, 1], "¿Alguna vez en la vida has experimentado violencia basada en género?")
  expect_identical(unlist(d[4, c(2, 4, 6)]), c(X2 = "2024", X4 = "2025", X6 = "2026"))
  expect_identical(unname(unlist(d[5, 2:7])), rep(c("N", "%"), 3))
  expect_true(all(c("A1:G1", "A3:G3", "B4:C4", "D4:E4", "F4:G4") %in% m))
  expect_identical(d[6:9, 1], c("Sí", "No", "No sé / Prefiero no decir", "Total"))
  # Sin Total combinado: 7 columnas = etiqueta + 3 períodos x (N, %).
  expect_equal(ncol(d), 7L)

  vbg <- g$mf$preguntas[[1]]
  expect_equal(as.numeric(d[6, 2]), unname(vbg$periodos$b2024$n[1]))
  expect_equal(as.numeric(d[7, 5]), unname(vbg$periodos$b2025$pct[2]))
  expect_equal(as.numeric(d[9, 4]), vbg$periodos$b2025$N)
  expect_identical(.rc_estilo(wb, "Comparativo", 6, 3)$numFmt$formatCode, "0.00%")
  expect_identical(.rc_estilo(wb, "Comparativo", 6, 2)$numFmt$formatCode, "#,##0")

  # Pie: fuente y base en líneas propias y casos sustantivos sin mapa. Sin la
  # línea «Ponderación: …» ni «La columna N muestra el N ponderado.»: la maqueta
  # no las trae (Gonzalo, 2026-10-15).
  expect_identical(d[10, 1], "Fuente: Pulso PUCP 2026.")
  expect_identical(d[11, 1], "Base: total de encuestados.")
  expect_identical(d[12, 1], "2 casos de 2024 sin correspondencia en la escala.")
  expect_false(any(grepl("^Ponderación|N ponderado", d[[1]])))

  # DEN-01: n.c. en 2025 en gris cursiva, «—» donde 2024 no ofrecía la opción
  # y un cero observado en 2026 que sigue siendo 0 / 0.00 %.
  expect_identical(d[14, 1], "Denunció")
  expect_identical(unname(unlist(d[17:20, 4])), rep("n.c.", 4))
  est <- .rc_estilo(wb, "Comparativo", 17, 4)
  expect_true("ITALIC" %in% toupper(est$fontDecoration))
  expect_identical(toupper(unname(unlist(est$fontColour))[1]), "FF6B7280")
  expect_identical(d[19, 1], "No recuerda")
  expect_identical(unname(unlist(d[19, 2:3])), rep("n.a.", 2))
  est <- .rc_estilo(wb, "Comparativo", 19, 2)
  expect_true("ITALIC" %in% toupper(est$fontDecoration))
  expect_equal(as.numeric(d[19, 6]), 0)
  expect_equal(as.numeric(d[19, 7]), 0)
  expect_identical(.rc_estilo(wb, "Comparativo", 19, 7)$numFmt$formatCode, "0.00%")
  expect_equal(as.numeric(d[20, 2]), g$mf$preguntas[[2]]$periodos$b2024$N)  # el total no se marca
  expect_identical(d[22, 1], "Base: quienes experimentaron al menos una situación.")
  expect_identical(d[23, 1], "n.c.: no comparable por diferencias en la redacción de la pregunta entre mediciones.")
  expect_identical(d[24, 1], "n.a.: no aplica, la opción no se ofrecía ese año.")

  notas <- unlist(d[grepl("^(Fuente|Base|Ponderación|La columna|n\\.c\\.|n\\.a\\.|—:|[0-9])", d[[1]]), 1])
  .rc_notas_limpias(notas)
  expect_identical(g$rs$preguntas[[2]]$n_c, list("b2025"))
  expect_identical(g$rs$preguntas[[2]]$no_ofrecidas, list(b2024 = list("3")))

  # Una pregunta por página y ajuste al ancho.
  expect_identical(.rc_saltos(g$simple), c(13L, 25L))
  expect_match(wb$worksheets[[1]]$pageSetup, 'fitToWidth="1"', fixed = TRUE)
})

test_that("comparativo de cruces: Respuesta x año, «—», letras dentro del año y pie", {
  g <- .rc_generar()
  expect_identical(openxlsx::getSheetNames(g$cruces), "Comparativo cruces")
  d <- .rc_celdas(g$cruces)
  wb <- openxlsx::loadWorkbook(g$cruces)
  m <- .rc_merges(wb, "Comparativo cruces")

  # Banner: Total en C:D, el grupo combinado sobre sus 3 categorías x (n, %).
  expect_identical(d[4, 5], "Lugar de nacimiento")
  expect_identical(d[5, 3], "Total")
  expect_identical(unname(unlist(d[5, c(5, 7, 9)])),
                   c("Lima Metropolitana y Callao", "Otras regiones", "Fuera del país"))
  expect_identical(unname(unlist(d[6, 1:4])), c("Respuesta", "Año", "n", "%"))
  expect_true(all(c("A4:D4", "E4:J4", "C5:D5", "E5:F5", "I5:J5", "A7:A9", "A16:A18") %in% m))

  # Respuesta combinada en vertical, un renglón por año.
  expect_identical(d[7, 1], "Sí")
  expect_identical(unname(unlist(d[7:9, 2])), c("2024", "2025", "2026"))
  expect_identical(d[16, 1], "Total")

  # «—»: «Fuera del país» no se ofrecía en 2024 (marca estructural, no n.a.).
  expect_identical(unname(unlist(d[c(7, 10, 13, 16), 9])), rep("n.a.", 4))
  expect_identical(unname(unlist(d[c(7, 16), 10])), rep("n.a.", 2))
  est <- .rc_estilo(wb, "Comparativo cruces", 7, 9)
  expect_true("ITALIC" %in% toupper(est$fontDecoration))
  # Un cero observado en una columna ofrecida sigue siendo 0.
  expect_equal(as.numeric(d[14, 9]), 0)

  q <- g$mc$preguntas[[1]]
  c25 <- q$periodos$b2025$cruces$x1
  expect_equal(as.numeric(d[8, 5]), unname(c25$n_mat[1, 1]))
  expect_equal(as.numeric(d[8, 6]), unname(c25$n_mat[1, 1] / c25$N_vec[1]))
  expect_equal(as.numeric(d[17, 3]), q$periodos$b2025$total$N)
  expect_identical(.rc_estilo(wb, "Comparativo cruces", 8, 6)$numFmt$formatCode, "0.0%")

  # Pie en el orden del contrato.
  expect_identical(d[19, 1], paste("Fuente: Pulso PUCP 2026. Base: total de encuestados.",
                                   "Porcentajes por columna dentro de cada año."))
  expect_false(any(grepl("^Ponderación", d[[1]])))
  expect_identical(d[20, 1], "Lugar de nacimiento: «Lima Metropolitana y Callao» incluye el Callao.")
  expect_identical(d[21, 1], paste("n.a.: no aplica, la opción no se ofrecía ese año.",
                                   "El cuestionario de 2024 no incluía la opción «Fuera del país»."))
  expect_identical(d[22, 1], "2 casos de 2024 sin correspondencia en la escala.")
  # Especiales del cruce: fuera de toda columna pero dentro del Total.
  expect_identical(d[23, 1], "5 casos de 2025 sin categoría en Lugar de nacimiento (Opción 99).")
  # Bases reducidas agrupadas por columna, con los años.
  expect_identical(d[24, 1], paste("Tiene base reducida (menos de 30 casos) la columna «Fuera del país»",
                                   "(2025 y 2026). Sus porcentajes deben leerse con cautela."))

  # Subtabla de letras.
  expect_identical(d[26, 1], "Comparaciones de proporciones de columna")
  expect_identical(d[27, 3], "Lugar de nacimiento")
  expect_true(all(c("A27:B27", "C27:E27", "A29:A31") %in% m))
  expect_identical(unname(unlist(d[28, 3:5])),
                   c("Lima Metropolitana y Callao (A)", "Otras regiones (B)", "Fuera del país (C)"))
  letras_xlsx <- unname(unlist(d[30, 3:5]))
  letras_xlsx[is.na(letras_xlsx)] <- ""
  expect_identical(letras_xlsx, unname(c25$letras[1, ]))
  expect_identical(d[29, 5], "n.a.")
  expect_identical(d[38, 1], paste0(.notas_pie_significancia("z", 0.05),
                                    " Las comparaciones se hacen dentro de cada año.",
                                    " Las letras usan el N ponderado, sin corrección por efecto de diseño."))
  expect_identical(d[39, 1], d[21, 1])

  # DEN-01 no comparable en 2025: toda la fila del año en n.c. «No recuerda»
  # no se ofrecía en 2024: toda su fila del año en «—».
  fila_den <- which(d[[1]] == "Denunció")
  expect_length(fila_den, 1L)
  fila25 <- fila_den + 5L
  expect_identical(d[fila25, 2], "2025")
  expect_identical(unname(unlist(d[fila25, 3:10])), rep("n.c.", 8))
  fila_nr <- which(d[[1]] == "No recuerda")[1]
  expect_identical(unname(unlist(d[fila_nr, 3:10])), rep("n.a.", 8))
  expect_true(any(d[[1]] == "n.c.: no comparable por diferencias en la redacción de la pregunta entre mediciones.",
                  na.rm = TRUE))

  notas <- unlist(d[grepl("^(Fuente|Base|Ponderación|n\\.c\\.|n\\.a\\.|—:|Las letras|Tiene|Lugar|[0-9])", d[[1]]), 1])
  .rc_notas_limpias(notas)
  expect_identical(.rc_saltos(g$cruces), fila_den - 1L)  # salto tras el renglón previo al título
  expect_identical(g$rcz$preguntas[[1]]$sin_mapa[[1]]$n_sin_mapa, 2L)
})

test_that("cruces: una columna ofrecida sin casos es n.a., no «—»", {
  datos <- .az_datos()
  datos$b2025$lug25[datos$b2025$lug25 == 27] <- 1  # 2025 ofrecía «Fuera del país» y nadie la eligió
  g <- .rc_generar(datos = datos)
  d <- .rc_celdas(g$cruces)
  expect_identical(unname(unlist(d[c(8, 11, 14, 17), 9])), rep("n.a.", 4))
  expect_identical(unname(unlist(d[c(7, 10), 9])), rep("n.a.", 2))
  expect_true(any(grepl("^n\\.a\\.: no aplica\\. «Fuera del país» \\(Lugar de nacimiento\\) no tiene casos en 2025\\.$",
                        d[[1]])))
})

test_that("notas libres: la de la pregunta y las generales van pegadas al pie, sin renglón en blanco", {
  # Formato aprobado de HSyVbG 2026 («Lista y formato de entregables»): Fuente,
  # Base y la nota de la pregunta en filas seguidas.
  ext <- list(notas_pregunta = list(`VBG-01` = "En cada medición la pregunta se refiere al año de esa encuesta"),
              notas_generales = c("Los segmentos se definen igual en los tres años"))
  g <- .rc_generar(extras = ext)
  d <- .rc_celdas(g$simple)
  expect_identical(d[12, 1], "2 casos de 2024 sin correspondencia en la escala.")
  expect_identical(d[13, 1], "En cada medición la pregunta se refiere al año de esa encuesta.")
  expect_identical(d[14, 1], "Los segmentos se definen igual en los tres años.")
  expect_identical(sum(d[[1]] == "Los segmentos se definen igual en los tres años.", na.rm = TRUE), 3L)
  expect_identical(sum(d[[1]] == "En cada medición la pregunta se refiere al año de esa encuesta.", na.rm = TRUE), 1L)

  dc <- .rc_celdas(g$cruces)
  fila <- which(dc[[1]] == "En cada medición la pregunta se refiere al año de esa encuesta.")
  expect_length(fila, 1L)
  expect_false(is.na(dc[fila - 1L, 1]))
  na_linea <- "n.a.: no aplica, la opción no se ofrecía ese año. El cuestionario de 2024 no incluía la opción «Fuera del país»."
  expect_true(na_linea %in% dc[(fila - 3L):(fila - 1L), 1])
})

test_that("bases reducidas: una línea agrupada por columna con sus años", {
  rot <- .armz_rotulos(c("b2024", "b2025", "b2026"))
  items <- list(
    list(cruce = "Lugar", columna = "Fuera del país", periodo = "b2025", n = 20),
    list(cruce = "Lugar", columna = "Otras regiones", periodo = "b2024", n = 12),
    list(cruce = "Lugar", columna = "Fuera del país", periodo = "b2026", n = 10),
    list(cruce = "Lugar", columna = "Lima", periodo = "b2026", n = 400))
  expect_identical(.comparativo_linea_reducidas(items, 30, rot),
                   paste("Tienen bases reducidas (menos de 30 casos) las columnas «Fuera del país» (2025 y 2026)",
                         "y «Otras regiones» (2024). Sus porcentajes deben leerse con cautela."))
  expect_identical(.comparativo_linea_reducidas(items[4], 30, rot), "")
})

test_that("contrato de artefactos: un deliverable y un único manifest con su huella", {
  expect_report_artifacts_registered <- function(result, slug) {
    file_ids <- vapply(result$artifacts, function(artifact) artifact$file_id %||% "", character(1))
    expect_true(all(nzchar(file_ids)), info = slug)
    manifest_records <- Filter(function(artifact) identical(artifact$role %||% "", "manifest"), result$artifacts)
    expect_equal(length(manifest_records), 1L, info = slug)
    expect_true(nzchar(manifest_records[[1]]$file_id %||% ""), info = slug)
  }
  sid <- .az_setup()
  for (tipo in c("frecuencias", "cruces")) {
    body <- if (tipo == "cruces") list(cruces = list("S-05")) else list()
    r <- .az_llamar(sid, paste0("/api/analitica/armonizada/", tipo), body)
    expect_report_artifacts_registered(r$public, tipo)
    files <- session_get(sid)$files
    for (a in r$public$artifacts) {
      meta <- files[[a$file_id]]
      expect_identical(a$sha256, tolower(digest::digest(file = meta$path, algo = "sha256")))
      expect_false(grepl("[0-9a-fA-F-]{36}", meta$original_name))
    }
    # Fuera del .pulso: los archivos viven en el directorio efímero de la sesión.
    expect_true(startsWith(normalizePath(files[[r$public$file_id]]$path),
                           normalizePath(session_get(sid)$dir)))
  }
})

test_that("R4b condiciones: el pie ya no dice nada del N ponderado, n.a. con especiales", {
  rot <- .armz_rotulos(c("b2024", "b2025", "b2026"))
  expect_false(exists(".comparativo_linea_n_ponderado", mode = "function"))

  # Un año que sólo tiene especiales: «n.a.» dice cuántos fueron.
  datos <- .az_datos()
  datos$b2025$v25 <- 99
  g <- .rc_generar(datos = datos)
  d <- .rc_celdas(g$simple)
  # Los especiales se nombran con su etiqueta en el instrumento de esa base.
  expect_true("n.a.: no aplica, 2025 sin respuestas válidas (208 casos Opción 99)." %in% d[[1]])
  expect_false(any(grepl("No sé / No responde", d[[1]], fixed = TRUE)))
  sm <- list(b2025 = list(n_especial_sin_mapa = 5, etiquetas_especiales = list("No sabe", "No responde")),
             b2026 = list(n_especial_sin_mapa = 1, codigos_especiales = list("98")))
  expect_identical(.comparativo_linea_na_simple(c("b2025", "b2026"), sm, rot),
                   "n.a.: no aplica, 2025 sin respuestas válidas (5 casos No sabe y No responde) y 2026 sin respuestas válidas (1 caso 98).")
  expect_identical(unname(unlist(d[6, 4:5])), rep("n.a.", 2))
})

test_that("el rótulo de sección sale sin la numeración del eje de la matriz", {
  expect_identical(.comparativo_rotulo_seccion("3. Prevalencia general de hostigamiento sexual"),
                   "PREVALENCIA GENERAL DE HOSTIGAMIENTO SEXUAL")
  expect_identical(.comparativo_rotulo_seccion("2) Características sociodemográficas"),
                   "CARACTERÍSTICAS SOCIODEMOGRÁFICAS")
  expect_identical(.comparativo_rotulo_seccion("7.1. Respuesta institucional"), "RESPUESTA INSTITUCIONAL")
  expect_identical(.comparativo_rotulo_seccion("Violencia basada en género"), "VIOLENCIA BASADA EN GÉNERO")
  expect_identical(.comparativo_rotulo_seccion("2024 en cifras"), "2024 EN CIFRAS")
  expect_identical(.comparativo_rotulo_seccion(NULL), "")
  expect_identical(.comparativo_rotulo_seccion(NA), "")
})

test_that("resumen de cruces: no_ofrecidas_cruce por variable y año, aunque la primera respuesta tampoco se ofreciera", {
  g <- .rc_generar()
  expect_identical(g$rcz$preguntas[[1]]$no_ofrecidas_cruce,
                   list(`Lugar de nacimiento` = list(b2024 = list("3"))))
  expect_identical(g$rs$preguntas[[1]]$no_ofrecidas_cruce, NULL)  # el simple no tiene cruces

  # 2024 no ofrecía «Sí» en VBG-01: lo que es de la columna se registra igual.
  sid <- .az_setup()
  eq <- session_get(sid)$equivalencias_publicos
  eq$filas[[1]]$armonizacion$por_base$b2024$mapa <- list(`2` = "2", `9` = "3")
  session_set(sid, "equivalencias_publicos", eq)
  notas <- .az_notas()
  notas$base_reducida$umbral <- 1000
  mc <- armonizada_modelo_cruces(.armz_preparar(sid, list(notas = notas), filas_refs = list("VBG-01"),
                                                cruces_refs = list("S-05")))
  path <- withr::local_tempfile(fileext = ".xlsx")
  rz <- reporte_comparativo_cruces(mc, path, .armz_rotulos(mc$periodos), notas)
  expect_identical(rz$preguntas[[1]]$no_ofrecidas, list(b2024 = list("1")))
  expect_identical(rz$preguntas[[1]]$no_ofrecidas_cruce$`Lugar de nacimiento`$b2024, list("3"))
  expect_gt(rz$preguntas[[1]]$n_reducidas, 0L)
  d <- .rc_celdas(path)
  expect_true(any(grepl("«Lima Metropolitana y Callao» (2024, 2025 y 2026)", d[[1]], fixed = TRUE)))
  expect_true(any(grepl("no incluía la opción «Fuera del país»", d[[1]], fixed = TRUE)))
})

test_that("resumen: sin_mapa trae los códigos especiales y sus etiquetas", {
  g <- .rc_generar()
  sm25 <- Filter(function(x) identical(x$base, "b2025"), g$rs$preguntas[[1]]$sin_mapa)[[1]]
  expect_identical(sm25$n_especial_sin_mapa, 3L)
  expect_identical(sm25$codigos_especiales, list("99"))
  expect_identical(sm25$etiquetas_especiales, list("Opción 99"))
  sm24 <- Filter(function(x) identical(x$base, "b2024"), g$rcz$preguntas[[1]]$sin_mapa)[[1]]
  expect_identical(sm24$codigos_especiales, list())
})

test_that("sin variable: pie «n.c.» propio, agrupado por año, en el simple y en cruces", {
  sid <- .az_setup()
  s <- session_get(sid)
  for (i in seq_along(s$equivalencias_publicos$filas)) {
    id <- s$equivalencias_publicos$filas[[i]]$id
    if (id %in% c("VBG-01", "DEN-01")) {
      s$equivalencias_publicos$filas[[i]]$variables$b2026 <- ""
      if (identical(id, "VBG-01")) s$equivalencias_publicos$filas[[i]]$variables$b2025 <- ""
    }
    if (identical(id, "S-05")) s$equivalencias_publicos$filas[[i]]$variables$b2024 <- ""
  }
  .session_env[[sid]] <- s
  cfg <- list(notas = .az_notas())
  dir <- withr::local_tempdir()
  rot <- .armz_rotulos(c("b2024", "b2025", "b2026"))

  ap <- .armz_preparar(sid, cfg, filas_refs = list("VBG-01", "DEN-01"))
  rs <- reporte_comparativo_simple(armonizada_modelo_frecuencias(ap), file.path(dir, "s.xlsx"), rot, cfg$notas)
  d <- .rc_celdas(file.path(dir, "s.xlsx"))[[1]]
  # VBG-01 sin variable en 2025 y 2026: una sola frase con los dos años.
  expect_identical(sum(d == "n.c.: 2025 y 2026 sin variable declarada en la matriz.", na.rm = TRUE), 1L)
  # DEN-01: su n.c. declarado de 2025 conserva su nota y 2026 va aparte.
  expect_true("n.c.: no comparable por diferencias en la redacción de la pregunta entre mediciones." %in% d)
  expect_identical(sum(d == "n.c.: 2026 sin variable declarada en la matriz.", na.rm = TRUE), 1L)
  expect_identical(rs$preguntas[[1]]$sin_variable, list("b2025", "b2026"))
  expect_identical(rs$preguntas[[2]]$sin_variable, list("b2026"))
  expect_identical(rs$preguntas[[2]]$n_c, list("b2025", "b2026"))
  .rc_notas_limpias(d[grepl("^n\\.c\\.", d)])

  ap_c <- .armz_preparar(sid, cfg, filas_refs = list("DEN-01"), cruces_refs = list("S-05"))
  path <- file.path(dir, "c.xlsx")
  rc <- reporte_comparativo_cruces(armonizada_modelo_cruces(ap_c), path, rot, cfg$notas)
  dc <- .rc_celdas(path)
  # Fila 2024 de la primera respuesta: Total con datos, las 3 columnas de S-05 en n.c.
  r24 <- which(dc[[2]] == "2024")[1]
  expect_false(identical(dc[r24, 3], "n.c."))
  expect_identical(unname(unlist(dc[r24, 5:10])), rep("n.c.", 6))
  pie <- dc[[1]]
  expect_true(paste("n.c.: 2024 sin variable declarada en la matriz para Lugar de nacimiento.",
                    "2026 sin variable declarada en la matriz.") %in% pie)
  expect_false(any(grepl("no es comparable en", pie)))
  expect_identical(rc$preguntas[[1]]$sin_variable,
                   list(list(base = "b2024", fila = "Lugar de nacimiento"),
                        list(base = "b2026", fila = "Denunció")))
  .rc_notas_limpias(pie[grepl("^n\\.c\\.", pie)])
})

test_that("serie de públicos: con rótulos que no son años y 4 mediciones, encabezado y pie dicen «Medición»", {
  nuevos <- c(b2024 = "docentes", b2025 = "egresados", b2026 = "alumnos", b2027 = "jefes")
  d0 <- .az_datos()
  datos <- stats::setNames(list(d0$b2024, d0$b2025, d0$b2026, d0$b2026), unname(nuevos))
  renombrar <- function(x) stats::setNames(x[names(nuevos)[names(nuevos) %in% names(x)]],
                                           nuevos[names(nuevos) %in% names(x)])
  pond <- list(ponderacion = list(enabled = FALSE))
  sid <- .az_setup(datos = datos, por_base = list(
    docentes = list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = "factor_ponderacion")),
    egresados = list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = "w25")),
    alumnos = pond, jefes = pond))
  s <- session_get(sid)
  s$equivalencias_publicos$filas <- lapply(s$equivalencias_publicos$filas, function(f) {
    f$variables$b2027 <- f$variables$b2026
    f$armonizacion$por_base$b2027 <- f$armonizacion$por_base$b2026
    f$variables <- renombrar(f$variables)
    f$armonizacion$por_base <- renombrar(f$armonizacion$por_base)
    f
  })
  s$equivalencias_publicos$armonizacion_periodos <- unname(nuevos)
  .session_env[[sid]] <- s

  cfg <- list(notas = .az_notas())
  dir <- withr::local_tempdir()
  ap <- .armz_preparar(sid, cfg, filas_refs = list("VBG-01", "DEN-01"), cruces_refs = list("S-05"))
  expect_identical(ap$periodos, unname(nuevos))
  rot <- .armz_rotulos(ap$periodos)
  expect_identical(unname(rot), unname(nuevos))
  path <- file.path(dir, "c.xlsx")
  reporte_comparativo_cruces(armonizada_modelo_cruces(ap), path, rot, cfg$notas)
  dc <- .rc_celdas(path)
  # Encabezado de la tabla principal y de la de letras.
  expect_identical(sum(dc[[2]] == "Medición", na.rm = TRUE), 4L)  # 2 preguntas x 2 tablas
  expect_false(any(dc[[2]] == "Año", na.rm = TRUE))
  expect_true(all(unname(nuevos) %in% dc[[2]]))
  pie <- dc[[1]][!is.na(dc[[1]])]
  expect_true(any(grepl("Porcentajes por columna dentro de cada medición.", pie, fixed = TRUE)))
  expect_true(any(grepl("Las comparaciones se hacen dentro de cada medición.", pie, fixed = TRUE)))
  expect_true(any(grepl("no se ofrecía esa medición.", pie, fixed = TRUE)))
  todo <- unlist(dc, use.names = FALSE)
  expect_false(any(grepl("\\baño\\b", todo[!is.na(todo)], ignore.case = TRUE, perl = TRUE)))

  ps <- file.path(dir, "s.xlsx")
  reporte_comparativo_simple(armonizada_modelo_frecuencias(ap), ps, rot, cfg$notas)
  ds <- unlist(.rc_celdas(ps), use.names = FALSE)
  expect_true("n.a.: no aplica, la opción no se ofrecía esa medición." %in% ds)
  expect_false(any(grepl("\\baño\\b", ds[!is.na(ds)], ignore.case = TRUE, perl = TRUE)))

  # Con rótulos de año la unidad sigue siendo «Año».
  expect_identical(.comparativo_unidad(c(a = "2024", b = "2025", c = "2026", d = "2027"))$titulo, "Año")
  expect_identical(.comparativo_unidad(c(a = "2024", b = "egresados"))$titulo, "Medición")
})

test_that("letras de columna: siguen con AA, AB… pasada la 26.ª categoría", {
  l <- .comparativo_letras(30)
  expect_length(l, 30L)
  expect_identical(l[c(1, 26, 27, 28, 30)], c("A", "Z", "AA", "AB", "AD"))
  expect_false(anyNA(l))
  expect_identical(.comparativo_letras(0), character(0))
})

test_that("variable ausente: pie «n.c.» con su causa en el simple y en cruces, sin raya ni punto y coma", {
  datos <- .az_sin_columna(list(b2024 = "lug24", b2025 = "v25", b2026 = "v26"))
  sid <- .az_setup(datos = datos, por_base = .az_por_base_excluidas(list(b2025 = "v25")))
  cfg <- list(notas = .az_notas())
  dir <- withr::local_tempdir()
  rot <- .armz_rotulos(c("b2024", "b2025", "b2026"))

  ap <- .armz_preparar(sid, cfg, filas_refs = list("VBG-01", "DEN-01"))
  rs <- reporte_comparativo_simple(armonizada_modelo_frecuencias(ap), file.path(dir, "s.xlsx"), rot, cfg$notas)
  d <- .rc_celdas(file.path(dir, "s.xlsx"))[[1]]
  expect_identical(sum(d == paste("n.c.: la variable «v25» está excluida en Analítica en 2025.",
                                  "La variable «v26» no está en la base de 2026."), na.rm = TRUE), 1L)
  expect_identical(rs$preguntas[[1]]$n_c, list("b2025", "b2026"))
  expect_identical(vapply(rs$preguntas[[1]]$variable_ausente, `[[`, "", "motivo"),
                   c("excluida", "no_esta_en_la_base"))
  expect_false(any(grepl("n.c.: no comparable.$", d)))
  .rc_notas_limpias(d[grepl("^n\\.c\\.", d)])

  ap_c <- .armz_preparar(sid, cfg, filas_refs = list("DEN-01"), cruces_refs = list("S-05"))
  path <- file.path(dir, "c.xlsx")
  rc <- reporte_comparativo_cruces(armonizada_modelo_cruces(ap_c), path, rot, cfg$notas)
  dc <- .rc_celdas(path)
  r24 <- which(dc[[2]] == "2024")[1]
  expect_identical(unname(unlist(dc[r24, 5:10])), rep("n.c.", 6))
  pie <- dc[[1]]
  expect_true("n.c.: la variable «lug24» de Lugar de nacimiento no está en la base de 2024." %in% pie)
  expect_identical(rc$preguntas[[1]]$variable_ausente,
                   list(list(base = "b2024", fila = "Lugar de nacimiento", variable = "lug24",
                             motivo = "no_esta_en_la_base")))
  .rc_notas_limpias(pie[grepl("^n\\.c\\.", pie)])
})

# Pie y título contra la maqueta HSyVbG (2026-10-15): título = enunciado de la
# fila sin marcado de Kobo, «Base: <base_texto>.» declarada en la matriz o
# calculada contra el total de casos con peso > 0, «Fuente: Pulso PUCP <año>.»
# por defecto y ninguna línea «Ponderación: …».
.rc_sesion_maqueta <- function(env = parent.frame()) {
  sid <- .az_setup(env)
  s <- session_get(sid)
  for (i in seq_along(s$equivalencias_publicos$filas)) {
    f <- s$equivalencias_publicos$filas[[i]]
    if (identical(f$id, "VBG-01")) {
      f$enunciado <- "¿Alguna vez en la vida has experimentado **violencia basada en género**?"
      f$armonizacion$escala[[1]]$etiqueta <- "*Sí*"
    }
    if (identical(f$id, "DEN-01")) {
      f$base_texto <- "quienes declararon haber experimentado hostigamiento sexual alguna vez en la vida"
    }
    if (identical(f$id, "S-05")) f$etiqueta_estandar <- "**Lugar** de nacimiento"
    s$equivalencias_publicos$filas[[i]] <- f
  }
  .session_env[[sid]] <- s
  sid
}

# Líneas de pie entre el Total de la pregunta `titulo` y el siguiente renglón vacío.
.rc_pie_de <- function(col1, titulo, desde_total = TRUE) {
  i <- which(col1 == titulo)[1]
  expect_false(is.na(i), info = titulo)
  t <- i + which(col1[(i + 1):length(col1)] == "Total")[1]
  if (!desde_total) t <- i
  out <- character(0)
  r <- t + 1L
  # En cruces el Total ocupa un renglón por período con la columna A combinada.
  while (r <= length(col1) && is.na(col1[r])) r <- r + 1L
  while (r <= length(col1) && !is.na(col1[r]) && nzchar(col1[r])) {
    out <- c(out, col1[r]); r <- r + 1L
  }
  out
}

test_that("maqueta: título = enunciado sin marcado, base declarada o calculada, fuente con año, sin ponderación (simple)", {
  sid <- .rc_sesion_maqueta()
  notas <- list(base_reducida = list(activo = FALSE))  # nada declarado: fuente y base por defecto
  ap <- .armz_preparar(sid, list(notas = notas))
  mf <- armonizada_modelo_frecuencias(ap)
  path <- withr::local_tempfile(fileext = ".xlsx")
  reporte_comparativo_simple(mf, path, .armz_rotulos(ap$periodos), notas)
  d <- .rc_celdas(path)[[1]]

  titulo <- "¿Alguna vez en la vida has experimentado violencia basada en género?"
  expect_true(titulo %in% d)
  expect_true("Sí" %in% d)
  expect_false(any(grepl("*", d, fixed = TRUE)))
  expect_true("¿Dónde naciste?" %in% d)  # S-05 declara enunciado: manda sobre la etiqueta
  expect_false(any(grepl("^Ponderación", d)))

  # VBG-01: 2024 deja 2 casos sin mapa y 2025 3 especiales fuera de la escala.
  expect_identical(.rc_pie_de(d, titulo)[1:2],
                   c("Fuente: Pulso PUCP 2026.", "Base: quienes respondieron la pregunta."))
  expect_false(any(grepl("N ponderado", .rc_pie_de(d, titulo))))
  # DEN-01: base declarada en la fila de la matriz, punto final incluido.
  expect_identical(.rc_pie_de(d, "Denunció")[1:2],
                   c("Fuente: Pulso PUCP 2026.",
                     "Base: quienes declararon haber experimentado hostigamiento sexual alguna vez en la vida."))
  # Sin base_texto, DEN-01 la tiene completa en 2024 y 2026 (2025 es n.c. y no cuenta).
  ap$preguntas[[2]]$base_texto <- ""
  q_den <- armonizada_modelo_frecuencias(ap)$preguntas[[2]]
  expect_identical(q_den$periodos$b2024$N_sin_peso, q_den$periodos$b2024$casos)
  expect_identical(.comparativo_base(notas, q_den, ap$periodos), "total de encuestados")
  # Un caso con peso 0 no es encuestado de la base; uno sin respuesta sí la reduce.
  q_den$periodos$b2026$N_sin_peso <- q_den$periodos$b2026$casos - 1L
  expect_identical(.comparativo_base(notas, q_den, ap$periodos), "quienes respondieron la pregunta")
  # Lo declarado en las notas sigue mandando sobre lo calculado; base_texto sobre todo.
  expect_identical(.comparativo_base(list(base_defecto = "total de encuestados"), q_den, ap$periodos),
                   "total de encuestados")
  q_den$base_texto <- "quienes estudian"
  expect_identical(.comparativo_base(list(base_defecto = "x"), q_den, ap$periodos), "quienes estudian")
})

test_that("maqueta: el pie de cruces junta fuente, base y porcentajes en una línea", {
  sid <- .rc_sesion_maqueta()
  notas <- list(fuente = "Pulso PUCP", por_cruce = list(`S-05` = "Lugar de nacimiento: nota."),
                base_reducida = list(activo = FALSE))
  ap <- .armz_preparar(sid, list(notas = notas), cruces_refs = list("S-05"))
  path <- withr::local_tempfile(fileext = ".xlsx")
  reporte_comparativo_cruces(armonizada_modelo_cruces(ap), path, .armz_rotulos(ap$periodos), notas)
  dc <- .rc_celdas(path)
  d <- dc[[1]]
  titulo <- "¿Alguna vez en la vida has experimentado violencia basada en género?"
  expect_true(titulo %in% d)
  expect_identical(dc[which(d == titulo) + 1L, 5], "Lugar de nacimiento")  # banner sin marcado
  expect_true("Sí" %in% d)
  expect_false(any(grepl("*", unlist(dc), fixed = TRUE)))
  expect_false(any(grepl("^Ponderación", d)))
  # «Pulso PUCP» es la que siembra el editor de notas: no cuenta como declarada.
  expect_identical(.rc_pie_de(d, titulo)[1:2],
                   c(paste("Fuente: Pulso PUCP 2026. Base: quienes respondieron la pregunta.",
                           "Porcentajes por columna dentro de cada año."),
                     "Lugar de nacimiento: nota."))
  expect_identical(.rc_pie_de(d, "Denunció")[1],
                   paste("Fuente: Pulso PUCP 2026.",
                         "Base: quienes declararon haber experimentado hostigamiento sexual alguna vez en la vida.",
                         "Porcentajes por columna dentro de cada año."))
})

test_that("fuente: la declarada se respeta, la por defecto lleva el año del último período si es año", {
  rot <- c(b2024 = "2024", b2025 = "2025", b2026 = "2026")
  per <- names(rot)
  expect_identical(.comparativo_fuente(NULL, rot, per), "Fuente: Pulso PUCP 2026.")
  expect_identical(.comparativo_fuente(list(fuente = "Pulso PUCP."), rot, per), "Fuente: Pulso PUCP 2026.")
  expect_identical(.comparativo_fuente(list(fuente = "Encuesta OIGD 2026"), rot, per),
                   "Fuente: Encuesta OIGD 2026.")
  expect_identical(.comparativo_fuente(list(fuente = "  "), rot, per), "Fuente: Pulso PUCP 2026.")
  expect_identical(.comparativo_fuente(NULL, c(a = "2024", b = "egresados"), c("a", "b")), "Fuente: Pulso PUCP.")
  expect_identical(.comparativo_fuente(NULL, rot, c("b2026", "b2024")), "Fuente: Pulso PUCP 2024.")
})

test_that("marcado de Kobo: se quitan los pares de asteriscos, no los sueltos", {
  expect_identical(.inst_sin_marcado(c("**Sí**, *mucho*", "De 5* a 10*", "x * y", NA, "")),
                   c("Sí, mucho", "De 5* a 10*", "x * y", "", ""))
  expect_identical(.armz_titulo_fila(list(enunciado = " *¿Has* **visto**? ", etiqueta_estandar = "E")),
                   "¿Has visto?")
  expect_identical(.armz_titulo_fila(list(enunciado = "", etiqueta_estandar = "**E**")), "E")
})

test_that("el comparativo de cruces archiva sus estilos por pregunta sin cambiar lo que se ve", {
  # H16 (2026-10-21): mismo patrón cuadrático que las tablas de cruces anuales.
  vistos <- integer(0)
  archivar <- get(".xlsx_archivar_estilos", envir = asNamespace("prosecnurapp"))
  leer <- function(r) list(estilos = .xlsx_estilos_por_celda(r$cruces), celdas = .rc_celdas(r$cruces))
  con <- local({
    testthat::local_mocked_bindings(.xlsx_archivar_estilos = function(wb, archivo) {
      vistos <<- c(vistos, length(wb$styleObjects))
      archivar(wb, archivo)
    })
    leer(.rc_generar())
  })
  sin <- local({
    testthat::local_mocked_bindings(.xlsx_archivar_estilos = function(wb, archivo) invisible(wb),
                                    .xlsx_restaurar_estilos = function(wb, archivo) invisible(wb))
    leer(.rc_generar())
  })
  expect_gt(length(vistos), 1L)
  expect_setequal(names(con$estilos), names(sin$estilos))
  expect_identical(con$estilos[names(sin$estilos)], sin$estilos)
  expect_identical(con$celdas, sin$celdas)
})

test_that("el comparativo de cruces escribe cada fila de respuesta de una vez y el libro no cambia", {
  # H16 (2026-10-22): celda por celda, cada writeData recorría todos los estilos
  # del libro; 10 preguntas reales tardaban 362 s (12 s con el búfer).
  leer <- function(r) list(estilos = .xlsx_estilos_por_celda(r$cruces), celdas = .rc_celdas(r$cruces))
  put0 <- get(".comparativo_put", envir = asNamespace("prosecnurapp"))
  contar <- function(directo) {
    puts <- 0L
    local({
      testthat::local_mocked_bindings(.comparativo_put = function(...) { puts <<- puts + 1L; put0(...) })
      if (directo) testthat::local_mocked_bindings(
        .comparativo_buffer = function() {
          b <- new.env()
          b$put <- function(wb, hoja, fila, col, valor, estilo) .comparativo_put(wb, hoja, fila, col, valor, estilo)
          b
        },
        .comparativo_buffer_volcar = function(wb, hoja, b) invisible(wb))
      list(leido = leer(.rc_generar()), puts = puts)
    })
  }
  con <- contar(FALSE); directo <- contar(TRUE)
  # El simple sigue celda por celda en las dos corridas; la diferencia es el búfer.
  expect_lt(con$puts, directo$puts / 2)
  expect_setequal(names(con$leido$estilos), names(directo$leido$estilos))
  expect_identical(con$leido$estilos[names(directo$leido$estilos)], directo$leido$estilos)
  expect_identical(con$leido$celdas, directo$leido$celdas)
})
