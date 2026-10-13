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
  notas <- sub("^—: ", "", notas)
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

  # Pie: fuente, base, ponderación por año y casos sustantivos sin mapa.
  expect_identical(d[10, 1], "Fuente: Pulso PUCP 2026.")
  expect_identical(d[11, 1], "Base: total de encuestados.")
  expect_identical(d[12, 1], "Ponderación: 2024 por factor_ponderacion. 2025 por w25. 2026 sin ponderar.")
  expect_identical(d[13, 1], "La columna N muestra el N ponderado.")
  expect_identical(d[14, 1], "2 casos de 2024 sin correspondencia en la escala.")

  # DEN-01: n.c. en 2025 en gris cursiva, «—» donde 2024 no ofrecía la opción
  # y un cero observado en 2026 que sigue siendo 0 / 0.00 %.
  expect_identical(d[16, 1], "Denunció")
  expect_identical(unname(unlist(d[19:22, 4])), rep("n.c.", 4))
  est <- .rc_estilo(wb, "Comparativo", 19, 4)
  expect_true("ITALIC" %in% toupper(est$fontDecoration))
  expect_identical(toupper(unname(unlist(est$fontColour))[1]), "FF6B7280")
  expect_identical(d[21, 1], "No recuerda")
  expect_identical(unname(unlist(d[21, 2:3])), rep("—", 2))
  est <- .rc_estilo(wb, "Comparativo", 21, 2)
  expect_true("ITALIC" %in% toupper(est$fontDecoration))
  expect_equal(as.numeric(d[21, 6]), 0)
  expect_equal(as.numeric(d[21, 7]), 0)
  expect_identical(.rc_estilo(wb, "Comparativo", 21, 7)$numFmt$formatCode, "0.00%")
  expect_equal(as.numeric(d[22, 2]), g$mf$preguntas[[2]]$periodos$b2024$N)  # el total no se marca
  expect_identical(d[24, 1], "Base: quienes experimentaron al menos una situación.")
  expect_identical(d[27, 1], "n.c.: no comparable por diferencias en la redacción de la pregunta entre mediciones.")
  expect_identical(d[28, 1], "—: la opción no se ofrecía ese año.")

  notas <- unlist(d[grepl("^(Fuente|Base|Ponderación|La columna|n\\.c\\.|n\\.a\\.|—:|[0-9])", d[[1]]), 1])
  .rc_notas_limpias(notas)
  expect_identical(g$rs$preguntas[[2]]$n_c, list("b2025"))
  expect_identical(g$rs$preguntas[[2]]$no_ofrecidas, list(b2024 = list("3")))

  # Una pregunta por página y ajuste al ancho.
  expect_identical(.rc_saltos(g$simple), c(15L, 29L))
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
  expect_identical(unname(unlist(d[c(7, 10, 13, 16), 9])), rep("—", 4))
  expect_identical(unname(unlist(d[c(7, 16), 10])), rep("—", 2))
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
  expect_identical(d[20, 1], "Ponderación: 2024 por factor_ponderacion. 2025 por w25. 2026 sin ponderar.")
  expect_identical(d[21, 1], "Lugar de nacimiento: «Lima Metropolitana y Callao» incluye el Callao.")
  expect_identical(d[22, 1], paste("—: la opción no se ofrecía ese año.",
                                   "El cuestionario de 2024 no incluía la opción «Fuera del país»."))
  expect_identical(d[23, 1], "2 casos de 2024 sin correspondencia en la escala.")
  # Especiales del cruce: fuera de toda columna pero dentro del Total.
  expect_identical(d[24, 1], "5 casos de 2025 sin categoría en Lugar de nacimiento (Opción 99).")
  # Bases reducidas agrupadas por columna, con los años.
  expect_identical(d[25, 1], paste("Tiene base reducida (menos de 30 casos) la columna «Fuera del país»",
                                   "(2025 y 2026). Sus porcentajes deben leerse con cautela."))

  # Subtabla de letras.
  expect_identical(d[27, 1], "Comparaciones de proporciones de columna")
  expect_identical(d[28, 3], "Lugar de nacimiento")
  expect_true(all(c("A28:B28", "C28:E28", "A30:A32") %in% m))
  expect_identical(unname(unlist(d[29, 3:5])),
                   c("Lima Metropolitana y Callao (A)", "Otras regiones (B)", "Fuera del país (C)"))
  letras_xlsx <- unname(unlist(d[31, 3:5]))
  letras_xlsx[is.na(letras_xlsx)] <- ""
  expect_identical(letras_xlsx, unname(c25$letras[1, ]))
  expect_identical(d[30, 5], "—")
  expect_identical(d[39, 1], paste0(.notas_pie_significancia("z", 0.05),
                                    " Las comparaciones se hacen dentro de cada año.",
                                    " Las letras usan el N ponderado, sin corrección por efecto de diseño."))
  expect_identical(d[40, 1], d[22, 1])

  # DEN-01 no comparable en 2025: toda la fila del año en n.c. «No recuerda»
  # no se ofrecía en 2024: toda su fila del año en «—».
  fila_den <- which(d[[1]] == "Denunció")
  expect_length(fila_den, 1L)
  fila25 <- fila_den + 5L
  expect_identical(d[fila25, 2], "2025")
  expect_identical(unname(unlist(d[fila25, 3:10])), rep("n.c.", 8))
  fila_nr <- which(d[[1]] == "No recuerda")[1]
  expect_identical(unname(unlist(d[fila_nr, 3:10])), rep("—", 8))
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
  expect_identical(unname(unlist(d[c(7, 10), 9])), rep("—", 2))
  expect_true(any(grepl("^n\\.a\\.: no aplica\\. «Fuera del país» \\(Lugar de nacimiento\\) no tiene casos en 2025\\.$",
                        d[[1]])))
})

test_that("notas libres: la de la pregunta y las generales tras un renglón en blanco", {
  ext <- list(notas_pregunta = list(`VBG-01` = "En cada medición la pregunta se refiere al año de esa encuesta"),
              notas_generales = c("Los segmentos se definen igual en los tres años"))
  g <- .rc_generar(extras = ext)
  d <- .rc_celdas(g$simple)
  expect_identical(d[14, 1], "2 casos de 2024 sin correspondencia en la escala.")
  expect_true(is.na(d[15, 1]))
  expect_identical(d[16, 1], "En cada medición la pregunta se refiere al año de esa encuesta.")
  expect_identical(d[17, 1], "Los segmentos se definen igual en los tres años.")
  expect_identical(sum(d[[1]] == "Los segmentos se definen igual en los tres años.", na.rm = TRUE), 3L)
  expect_identical(sum(d[[1]] == "En cada medición la pregunta se refiere al año de esa encuesta.", na.rm = TRUE), 1L)

  dc <- .rc_celdas(g$cruces)
  fila <- which(dc[[1]] == "En cada medición la pregunta se refiere al año de esa encuesta.")
  expect_length(fila, 1L)
  expect_identical(dc[fila - 2L, 1], "—: la opción no se ofrecía ese año. El cuestionario de 2024 no incluía la opción «Fuera del país».")
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

test_that("R4b condiciones: pie de calibración fallida, N ponderado sólo si alguien pondera, n.a. con especiales", {
  rot <- .armz_rotulos(c("b2024", "b2025", "b2026"))
  pond <- list(b2024 = list(pondera = FALSE, estado = "no_aplicada"),
               b2025 = list(pondera = TRUE, metodo = "columna", peso_columna = "w25"),
               b2026 = list(pondera = FALSE, estado = "sin_ponderar"))
  expect_identical(.comparativo_linea_ponderacion(pond, names(pond), rot),
    "Ponderación: 2024 sin ponderar (la calibración declarada no se aplicó). 2025 por w25. 2026 sin ponderar.")
  expect_identical(.comparativo_linea_n_ponderado(pond), "La columna N muestra el N ponderado.")
  expect_identical(.comparativo_linea_n_ponderado(pond[c(1, 3)]), "")

  # Un año que sólo tiene especiales: «n.a.» dice cuántos fueron.
  datos <- .az_datos()
  datos$b2025$v25 <- 99
  g <- .rc_generar(datos = datos)
  d <- .rc_celdas(g$simple)
  expect_true("n.a.: no aplica, 2025 sin respuestas válidas (208 casos No sé / No responde)." %in% d[[1]])
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
