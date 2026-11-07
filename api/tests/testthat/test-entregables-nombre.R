# ADR 0133 §3 — Un nombre.
#
# `entregable_nombre(sid, rotulo, ext, base = NULL, detalle = NULL, fecha = Sys.Date())` arma
#   <Estudio>_<Entregable>[_<Base>][_<Detalle>]_<dd_mm_yy>.<ext>
# y `.export_filename()` pasa a ser su envoltorio. Antes de la fase 2 convivían diez patrones de
# nombre y seis formatos de fecha (censo 2026-11-07); el estudio salía del nombre del .pulso aunque
# la Ficha declarara un código, y la base entraba al nombre con una sola base.
#
# Sin reloj real: todas las llamadas fijan `fecha`, salvo la comparación con `.export_filename()`,
# que compara dos nombres armados en el mismo instante.

.en_fecha <- as.Date("2026-11-07")

.en_sesion <- function(codigo = NULL, pulso = NULL, bases = character(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  if (!is.null(pulso)) {
    s <- session_get(sid)
    s$project_path <- pulso
    .session_env[[sid]] <- s
  }
  if (!is.null(codigo)) {
    .planner_declarar(sid, "estudio", list(nombre = "Estudio de prueba", codigo = codigo), 0L)
  }
  for (b in bases) {
    estudio_add_base(sid, b, xlsform_file_id = paste0("x-", b), data_file_id = paste0("d-", b),
                     data_ext = "xlsx", rp_data = data.frame(a = 1), rp_inst = NULL)
  }
  sid
}

test_that("el estudio sale del código de la Ficha, aunque haya un .pulso con otro nombre", {
  pulso <- file.path(withr::local_tempdir(), "archivo de trabajo.pulso")
  sid <- .en_sesion(codigo = "HSVG2026", pulso = pulso)
  expect_identical(.planner_identidad(session_get(sid))$codigo, "HSVG2026")
  expect_identical(
    entregable_nombre(sid, "Frecuencias por base", "xlsx", fecha = .en_fecha),
    "HSVG2026_Frecuencias_por_base_07_11_26.xlsx"
  )
})

test_that("sin código declarado, el estudio es el nombre del .pulso; sin proyecto, Prosecnur", {
  pulso <- file.path(withr::local_tempdir(), "Mi estudio 2026.pulso")
  sid_pulso <- .en_sesion(pulso = pulso)
  expect_identical(
    entregable_nombre(sid_pulso, "Frecuencias", "xlsx", fecha = .en_fecha),
    "Mi_estudio_2026_Frecuencias_07_11_26.xlsx"
  )
  sid_nada <- .en_sesion()
  expect_identical(
    entregable_nombre(sid_nada, "Frecuencias", "xlsx", fecha = .en_fecha),
    "Prosecnur_Frecuencias_07_11_26.xlsx"
  )
  # El código declarado manda también sin proyecto guardado (orden del §3: código, .pulso, Prosecnur).
  sid_codigo <- .en_sesion(codigo = "HSVG2026")
  expect_identical(
    entregable_nombre(sid_codigo, "Frecuencias", "xlsx", fecha = .en_fecha),
    "HSVG2026_Frecuencias_07_11_26.xlsx"
  )
})

test_that("el rótulo va con mayúscula inicial y palabras unidas por _; el detalle se translitera", {
  sid <- .en_sesion(codigo = "HSVG2026")
  expect_identical(
    entregable_nombre(sid, "Hoja de ruta", "pdf", detalle = "Breña Z003 Mz045A", fecha = .en_fecha),
    "HSVG2026_Hoja_de_ruta_Brena_Z003_Mz045A_07_11_26.pdf"
  )
  expect_identical(
    entregable_nombre(sid, "frecuencias", "xlsx", fecha = .en_fecha),
    "HSVG2026_Frecuencias_07_11_26.xlsx"
  )
  # Caracteres que Windows prohíbe y separadores repetidos: fuera por construcción.
  nombre <- entregable_nombre(sid, "Reporte: avance / cliente", "pdf", detalle = "  Aula «B-12»?*  ",
                              fecha = .en_fecha)
  stem <- sub("\\.pdf$", "", nombre)
  expect_match(stem, "^[A-Za-z0-9_]+$")
  expect_false(grepl("__", stem, fixed = TRUE))
  expect_false(grepl("^_|_$", stem))
  expect_identical(nombre, "HSVG2026_Reporte_avance_cliente_Aula_B_12_07_11_26.pdf")
})

test_that("la base entra sólo si la sesión tiene más de una base, después del rótulo", {
  una <- .en_sesion(codigo = "HSVG2026", bases = "docentes")
  expect_identical(
    entregable_nombre(una, "Frecuencias", "xlsx", base = "docentes", fecha = .en_fecha),
    "HSVG2026_Frecuencias_07_11_26.xlsx"
  )
  dos <- .en_sesion(codigo = "HSVG2026", bases = c("docentes", "Estudiantes Niñez"))
  expect_length(session_get(dos)$estudio$bases, 2L)
  expect_identical(
    entregable_nombre(dos, "Frecuencias", "xlsx", base = "Estudiantes Niñez", fecha = .en_fecha),
    "HSVG2026_Frecuencias_Estudiantes_Ninez_07_11_26.xlsx"
  )
  expect_identical(
    entregable_nombre(dos, "Hoja de ruta", "pdf", base = "docentes", detalle = "Z003", fecha = .en_fecha),
    "HSVG2026_Hoja_de_ruta_docentes_Z003_07_11_26.pdf"
  )
})

test_that("el nombre sin extensión no pasa de 80: se recorta el detalle y luego el rótulo, nunca estudio ni fecha", {
  sid <- .en_sesion(codigo = "HSVG2026")

  detalle_largo <- paste(rep("Manzana larguisima", 8), collapse = " ")
  n1 <- entregable_nombre(sid, "Hoja de ruta", "pdf", detalle = detalle_largo, fecha = .en_fecha)
  s1 <- sub("\\.pdf$", "", n1)
  expect_lte(nchar(s1), 80L)
  # El rótulo queda entero: lo primero que se recorta es el detalle.
  expect_match(s1, "^HSVG2026_Hoja_de_ruta_Manzana")
  expect_match(s1, "_07_11_26$")
  expect_false(grepl("__", s1, fixed = TRUE))

  rotulo_largo <- paste(rep("Reporte de avance para el cliente", 4), collapse = " ")
  n2 <- entregable_nombre(sid, rotulo_largo, "pdf", fecha = .en_fecha)
  s2 <- sub("\\.pdf$", "", n2)
  expect_lte(nchar(s2), 80L)
  expect_match(s2, "^HSVG2026_Reporte_de_avance")
  expect_match(s2, "_07_11_26$")
  expect_false(grepl("__", s2, fixed = TRUE))

  # Las dos largas a la vez: el estudio y la fecha siguen enteros.
  n3 <- entregable_nombre(sid, rotulo_largo, "pdf", detalle = detalle_largo, fecha = .en_fecha)
  s3 <- sub("\\.pdf$", "", n3)
  expect_lte(nchar(s3), 80L)
  expect_match(s3, "^HSVG2026_")
  expect_match(s3, "_07_11_26$")

  # Un código largo (40, el tope de la Ficha) tampoco se recorta.
  codigo_largo <- strrep("ABCDEFGHIJ", 4L)
  sid_largo <- .en_sesion(codigo = codigo_largo)
  n4 <- entregable_nombre(sid_largo, rotulo_largo, "pdf", detalle = detalle_largo, fecha = .en_fecha)
  s4 <- sub("\\.pdf$", "", n4)
  expect_lte(nchar(s4), 80L)
  expect_match(s4, paste0("^", codigo_largo, "_"))
  expect_match(s4, "_07_11_26$")
})

test_that("una extensión con punto interno se respeta tal cual", {
  sid <- .en_sesion(codigo = "HSVG2026")
  expect_identical(
    entregable_nombre(sid, "Gráficos", "pulso-graficos.zip", fecha = .en_fecha),
    "HSVG2026_Graficos_07_11_26.pulso-graficos.zip"
  )
})

test_that(".export_filename() es un envoltorio de entregable_nombre() para un kind del catálogo", {
  sid <- .en_sesion(codigo = "HSVG2026", bases = c("docentes", "estudiantes"))
  cat <- entregables_catalogo()
  fila <- if (is.data.frame(cat)) as.list(cat[cat$kind == "frecuencias", , drop = FALSE]) else cat[["frecuencias"]]
  expect_false(is.null(fila$rotulo))
  rotulo <- as.character(fila$rotulo)[1]
  expect_identical(.export_filename(sid, "frecuencias", "xlsx"),
                   entregable_nombre(sid, rotulo, "xlsx"))
  base_esperada <- if (isTRUE(as.logical(fila$por_base)[1])) "docentes" else NULL
  expect_identical(.export_filename(sid, "frecuencias", "xlsx", base = "docentes"),
                   entregable_nombre(sid, rotulo, "xlsx", base = base_esperada))
  # El estudio del nombre heredado ya es el código, no «Prosecnur» ni el .pulso.
  expect_match(.export_filename(sid, "frecuencias", "xlsx"), "^HSVG2026_")
})
