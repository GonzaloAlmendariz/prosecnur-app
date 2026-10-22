# Notas al pie de Analítica (checklist entregables HSyVBG 2026, ítems 1a–1e).

.np_fixture <- function() {
  # sexo: m = 160 casos con peso 0.5 (80 ponderados), h = 40 con peso 1 (40).
  # lugar: pe = 190 casos con peso 0.5, ex = 10 casos con peso 5 (50 ponderados).
  # La columna «Extranjero» tiene 10 casos SIN ponderar (reducida) aunque pondere
  # 50; la columna «Hombre» pondera 40 y tiene 40 casos (no reducida). Con un
  # denominador ponderado el aviso se equivocaría en ambos sentidos.
  n <- 200
  sexo <- c(rep("m", 160), rep("h", 40))
  lugar <- c(rep("pe", 190), rep("ex", 10))
  peso <- ifelse(lugar == "ex", 5, ifelse(sexo == "m", 0.5, 1))
  data <- data.frame(
    p1 = rep(c("a", "b"), length.out = n),
    p2 = rep(c("a", "a", "b"), length.out = n),
    sexo = sexo,
    lugar = lugar,
    peso = peso,
    stringsAsFactors = FALSE
  )
  instrumento <- list(
    survey = data.frame(
      name = c("p1", "p2", "sexo", "lugar"),
      type = c("select_one si_no", "select_one si_no", "select_one sexo", "select_one lugar"),
      label = c("Pregunta uno", "Pregunta dos", "Sexo", "Lugar de nacimiento"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("si_no", "si_no", "sexo", "sexo", "lugar", "lugar"),
      name = c("a", "b", "m", "h", "pe", "ex"),
      label = c("Sí", "No", "Mujer", "Hombre", "Perú", "Fuera del país"),
      stringsAsFactors = FALSE
    )
  )
  list(data = data, instrumento = instrumento)
}

.np_col1 <- function(path, sheet) {
  raw <- openxlsx::read.xlsx(path, sheet = sheet, colNames = FALSE,
                             skipEmptyRows = FALSE, skipEmptyCols = FALSE)
  v <- as.character(raw[[1]])
  v[is.na(v)] <- ""
  v
}

.np_notas_maqueta <- function() {
  list(
    fuente = "Pulso PUCP 2026.",
    base_defecto = "total de encuestados.",
    base_por_pregunta = list(p2 = "quienes respondieron la pregunta 2"),
    por_cruce = list(
      lugar = "Lugar de nacimiento agrupa a quienes nacieron fuera del país.",
      sexo = "Sexo según lo declarado en P3."
    ),
    base_reducida = list(activo = TRUE, umbral = 30)
  )
}

test_that("normalizar tolera NULL, claves faltantes y listas de JSON", {
  n0 <- .notas_pie_normalizar(NULL)
  expect_identical(n0$fuente, "Pulso PUCP")
  expect_identical(n0$base_defecto, "")
  expect_length(n0$base_por_pregunta, 0L)
  expect_length(n0$por_cruce, 0L)
  expect_false(n0$base_reducida$activo)
  expect_identical(n0$base_reducida$umbral, 30L)

  expect_identical(.notas_pie_normalizar(NULL, fuente_defecto = "Otra")$fuente, "Otra")

  js <- jsonlite::fromJSON(
    '{"fuente":"  ","base_por_pregunta":[],"por_cruce":{"s":"Nota","t":""},"base_reducida":{"activo":true,"umbral":"25"}}',
    simplifyVector = FALSE
  )
  n1 <- .notas_pie_normalizar(js)
  expect_identical(n1$fuente, "Pulso PUCP")
  expect_length(n1$base_por_pregunta, 0L)
  expect_identical(unname(n1$por_cruce), "Nota")
  expect_identical(names(n1$por_cruce), "s")
  expect_true(n1$base_reducida$activo)
  expect_identical(n1$base_reducida$umbral, 25L)
})

test_that("la base de la pregunta manda sobre la por defecto", {
  notas <- list(base_defecto = "total de encuestados.", base_por_pregunta = list(p2 = "subgrupo"))
  expect_identical(.notas_pie_base(notas, "p1"), "total de encuestados.")
  expect_identical(.notas_pie_base(notas, "p2"), "subgrupo")
  expect_identical(.notas_pie_base(NULL, "p1"), "")
})

test_that("la primera línea de cruces agrega el punto solo cuando falta", {
  expect_identical(.notas_pie_linea_cruces("Pulso PUCP"), "Fuente: Pulso PUCP")
  expect_identical(
    .notas_pie_linea_cruces("Pulso PUCP 2026.", "total de encuestados."),
    "Fuente: Pulso PUCP 2026. Base: total de encuestados. Porcentajes por columna."
  )
  expect_identical(
    .notas_pie_linea_cruces("Pulso PUCP 2026", "total de encuestados"),
    "Fuente: Pulso PUCP 2026. Base: total de encuestados. Porcentajes por columna."
  )
  expect_identical(
    .notas_pie_linea_cruces("¿Fuente?", "x!"),
    "Fuente: ¿Fuente? Base: x! Porcentajes por columna."
  )
})

test_that("las notas por cruce salen en el orden del banner", {
  notas <- list(por_cruce = list(b = "Nota B", a = "Nota A", z = "No está"))
  expect_identical(.notas_pie_lineas_por_cruce(notas, c("a", "c", "b")), c("Nota A", "Nota B"))
  expect_identical(.notas_pie_lineas_por_cruce(NULL, c("a")), character(0))
})

test_that("la línea de bases reducidas agrupa por variable y excluye columnas vacías", {
  expect_identical(.notas_pie_unir_es(c("a", "b", "c")), "a, b y c")
  expect_identical(.notas_pie_unir_es(c("a", "b")), "a y b")
  items <- data.frame(
    variable = c("Lugar de nacimiento", "Lugar de nacimiento",
                 "Presenta discapacidad", "Presenta discapacidad", "Presenta discapacidad"),
    columna = c("Perú", "Fuera del país", "No", "Presenta discapacidad", "No sé / Prefiero no decir"),
    n = c(400, 12, 380, 25, 8),
    stringsAsFactors = FALSE
  )
  expect_identical(
    .notas_pie_linea_base_reducida(items, 30),
    paste0(
      "Bases reducidas (menos de 30 casos): \"Fuera del país\" (Lugar de nacimiento), ",
      "\"Presenta discapacidad\" y \"No sé / Prefiero no decir\" (Presenta discapacidad). ",
      "Sus porcentajes deben leerse con cautela."
    )
  )
  # Umbral estricto y columna sin casos fuera.
  items2 <- data.frame(variable = "V", columna = c("x", "y", "z"), n = c(30, 0, 29),
                       stringsAsFactors = FALSE)
  expect_identical(
    .notas_pie_linea_base_reducida(items2, 30),
    "Bases reducidas (menos de 30 casos): \"z\" (V). Sus porcentajes deben leerse con cautela."
  )
  expect_identical(.notas_pie_linea_base_reducida(items2[1:2, ], 30), "")
})

test_that("la nota de significancia sigue la redacción de la maqueta", {
  z <- .notas_pie_significancia("z", 0.05)
  expect_identical(z, paste0(
    "Las letras comparan las columnas de una misma variable de cruce. Una letra en una celda ",
    "indica que esa proporción es significativamente mayor que la de la columna identificada ",
    "con esa letra (prueba z de diferencia de proporciones con corrección de Bonferroni, ",
    "nivel de significancia de 0.05). \".a\" indica una columna excluida de la comparación ",
    "porque su proporción es 0 % o 100 %."
  ))
  expect_match(.notas_pie_significancia("z", 0.1), "nivel de significancia de 0.1)", fixed = TRUE)
  cl <- .notas_pie_significancia("cluster", 0.01)
  expect_match(cl, "(contrastes cluster-robust por persona con corrección de Bonferroni, nivel de significancia de 0.01)", fixed = TRUE)
  w <- .notas_pie_significancia("welch", 0.05)
  expect_identical(w, paste0(
    "Las letras comparan las columnas de una misma variable de cruce. Una letra en una celda ",
    "indica que esa media es significativamente mayor que la de la columna identificada con ",
    "esa letra (prueba t de Welch con corrección de Bonferroni, nivel de significancia de 0.05)."
  ))
  for (t in c(z, cl, w)) {
    expect_false(grepl("—|·|;", t))
    expect_false(grepl("Letras por estrato|Fuente", t))
  }
})

test_that("cruces sin notas conserva el pie de una sola línea", {
  fx <- .np_fixture()
  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)
  reporte_cruces(
    data = fx$data, instrumento = fx$instrumento,
    SECCIONES = list(General = c("p1", "p2")), cruces = c("sexo", "lugar"),
    path_xlsx = out, show_sig = FALSE, incluir_secciones = FALSE
  )
  col1 <- .np_col1(out, "Cruces")
  fuentes <- which(col1 == "Fuente: Pulso PUCP")
  expect_length(fuentes, 2L)
  totales <- which(col1 == "Total")
  expect_identical(fuentes, totales + 1L)
  # Debajo de cada pie no hay otra nota: la siguiente fila está vacía.
  expect_identical(col1[fuentes[1] + 1L], "")
  expect_false(any(grepl("^Base|Bases reducidas", col1)))
})

test_that("cruces con notas escribe fuente, base, notas por cruce y base reducida", {
  fx <- .np_fixture()
  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)
  reporte_cruces(
    data = fx$data, instrumento = fx$instrumento,
    SECCIONES = list(General = c("p1", "p2")), cruces = c("sexo", "lugar"),
    path_xlsx = out, show_sig = TRUE, incluir_secciones = FALSE,
    notas = .np_notas_maqueta()
  )
  col1 <- .np_col1(out, "Cruces")
  totales <- which(col1 == "Total")
  expect_length(totales, 2L)

  pie1 <- col1[totales[1] + 1:4]
  expect_identical(pie1, c(
    "Fuente: Pulso PUCP 2026. Base: total de encuestados. Porcentajes por columna.",
    "Sexo según lo declarado en P3.",
    "Lugar de nacimiento agrupa a quienes nacieron fuera del país.",
    "Bases reducidas (menos de 30 casos): \"Fuera del país\" (Lugar de nacimiento). Sus porcentajes deben leerse con cautela."
  ))
  # «Hombre» pondera 40 pero tiene 40 casos: no es reducida. «Fuera del país»
  # pondera 50 y tiene 10 casos: sí lo es.
  expect_false(any(grepl("Hombre", col1[grepl("^Bases reducidas", col1)], fixed = TRUE)))

  # La segunda pregunta usa su base propia.
  expect_identical(
    col1[totales[2] + 1L],
    "Fuente: Pulso PUCP 2026. Base: quienes respondieron la pregunta 2. Porcentajes por columna."
  )

  # La tabla de significancia empieza después del pie, sin pisarlo.
  sig_titles <- which(col1 == "Comparaciones de proporciones de columna")
  expect_length(sig_titles, 2L)
  expect_identical(sig_titles[1], totales[1] + 5L)
  # La siguiente pregunta empieza después de la nota de significancia.
  q2 <- which(col1 == "Pregunta dos")
  expect_length(q2, 1L)
  nota_sig <- which(startsWith(col1, "Las letras comparan"))
  expect_length(nota_sig, 2L)
  expect_gt(q2, nota_sig[1])
  expect_gt(totales[2], q2)

  # Primera fila del pie combinada a lo ancho de la tabla (1 + 2 * (1 + 2 + 2) = 11).
  wb <- openxlsx::loadWorkbook(out)
  merges <- wb$worksheets[[1]]$mergeCells
  fila_pie <- totales[1] + 1L
  expect_true(any(grepl(sprintf("A%d:K%d", fila_pie, fila_pie), merges, fixed = TRUE)))
  expect_true(any(grepl(sprintf("A%d:K%d", fila_pie + 3L, fila_pie + 3L), merges, fixed = TRUE)))
})

test_that("frecuencias escribe la línea de base y corre la tabla siguiente", {
  fx <- .np_fixture()
  out0 <- tempfile(fileext = ".xlsx")
  out1 <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(out0, out1)), add = TRUE)
  args <- list(
    data = fx$data, instrumento = fx$instrumento,
    secciones = list(General = c("p1", "p2")),
    orden = "original", incluir_secciones = FALSE, ficha_tecnica = FALSE
  )
  do.call(reporte_frecuencias, c(args, list(path_xlsx = out0)))
  do.call(reporte_frecuencias, c(args, list(path_xlsx = out1, notas = .np_notas_maqueta())))

  c0 <- .np_col1(out0, "Frecuencias")
  # Formato aprobado (HSyVbG 2026): Fuente y Base cierran con punto aunque la
  # nota declarada no lo traiga.
  f0 <- which(c0 == "Fuente: Pulso PUCP.")
  expect_length(f0, 2L)
  expect_false(any(startsWith(c0, "Base:")))

  c1 <- .np_col1(out1, "Frecuencias")
  f1 <- which(c1 == "Fuente: Pulso PUCP 2026.")
  expect_length(f1, 2L)
  expect_identical(c1[f1 + 1L], c("Base: total de encuestados.", "Base: quienes respondieron la pregunta 2."))
  # Cada pie con base ocupa una fila más: la segunda tabla baja exactamente una.
  q2_0 <- which(c0 == "Pregunta dos")
  q2_1 <- which(c1 == "Pregunta dos")
  expect_identical(q2_1, q2_0 + 1L)
  expect_gt(q2_1, f1[1] + 1L)
})

test_that("la config por defecto declara el bloque notas con la forma del contrato", {
  cfg <- .analitica_default_config()
  expect_true(is.list(cfg$notas))
  js <- as.character(jsonlite::toJSON(cfg$notas, auto_unbox = TRUE, null = "null"))
  expect_identical(
    js,
    '{"fuente":"Pulso PUCP","base_defecto":"","base_por_pregunta":{},"por_cruce":{},"base_reducida":{"activo":false,"umbral":30}}'
  )
  # Normalizar el default no cambia nada visible: pie de hoy.
  n <- .notas_pie_normalizar(cfg$notas)
  expect_identical(.notas_pie_linea_cruces(n$fuente, .notas_pie_base(n, "p1")), "Fuente: Pulso PUCP")
})

test_that("frecuencias anuales: sección sin el marcado de Kobo y Fuente/Base con punto final (formato aprobado HSyVbG 2026)", {
  expect_identical(.freq_clean_section_label_for_export("<span style=\"color:#002060\">CARACTERÍSTICAS SOCIODEMOGRÁFICAS</span>"),
                   "CARACTERÍSTICAS SOCIODEMOGRÁFICAS")
  expect_identical(.freq_clean_section_label_for_export("<span style=\"color:#002060\">REACCIONES Y CONSECUENCIAS </span>"),
                   "REACCIONES Y CONSECUENCIAS")
  expect_identical(.notas_pie_cerrar("Pulso PUCP 2026"), "Pulso PUCP 2026.")
})
