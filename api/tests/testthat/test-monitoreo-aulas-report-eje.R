# El PDF de avance a cliente cuando la cuota es por un eje que no es la
# facultad (CCSS Perfil 2026-II: una facultad, metas por nivel curricular).
# Ver `api/R/monitoreo_aulas_report_eje.R`.

.mare_bloque <- function() list(
  eje = list(clave = "nivel", etiqueta = "Nivel", etiqueta_plural = "Niveles",
             atribucion = "persona"),
  facultades = list(
    list(facultad = "6", estado = "ok", respuestas_validas = 104L),
    list(facultad = "10", estado = "fuera_del_diseno", respuestas_validas = 32L),
    list(facultad = "5", estado = "fuera_del_diseno", respuestas_validas = 56L)
  ),
  total = list(invariante = list(total = 430L, partes = list(
    en_celdas = 324L, sin_celda = 88L, sin_eje = 17L, duplicadas = 1L,
    fuera_universo = 0L, huerfanas = 0L)))
)

.mare_modelo <- function() {
  bloque <- .mare_bloque()
  list(
    report_kind = "aulas_advance_pdf",
    family = "aulas_universitarias",
    facultades = data.frame(
      Facultad = c("9", "8", "6", "7"),
      Efectivas = c(34, 74, 104, 112),
      `Avance muestra` = c(34 / 62, 74 / 97, 104 / 119, 112 / 122),
      Muestra = c(62, 97, 119, 122),
      `Faltantes muestra` = c(28, 23, 15, 10),
      check.names = FALSE, stringsAsFactors = FALSE
    ),
    total = list(muestra = 400, conseguidas = 324, avance = 0.81, faltan = 76,
                 facultades_abiertas = 4L, aulas_aplicadas = NA_real_,
                 sobremuestra = NA_real_, faltan_sobremuestra = NA_real_),
    ritmo = list(total = data.frame(
      dia = c("2026-09-22", "2026-09-23"), dia_semana = c("martes", "miércoles"),
      efectivas = c(136, 188), acumulado = c(136, 324), stringsAsFactors = FALSE),
      meta = 400, facultades = list()),
    portada_defecto = list(titulo = "Avance del trabajo de campo",
                           subtitulo = "Facultad de Ciencias Sociales", cliente = "",
                           periodo = "Del 22 al 23 de septiembre de 2026",
                           corte = "23 de septiembre de 2026", nota = ""),
    eje = bloque$eje,
    ambito = "Facultad de Ciencias Sociales",
    fuera_de_meta = .marp_fuera_de_meta(bloque),
    composicion = list(fuente = "padron", personas = 324L, dimensiones = list(
      sexo = list(dimension = "sexo", etiqueta = "Sexo", poblacion_total = 800L,
                  obtenidas_total = 324L, filas = list(
        list(categoria = "F", poblacion = 421L, poblacion_pct = 52.6,
             obtenidas = 186L, obtenidas_pct = 57.4),
        list(categoria = "M", poblacion = 379L, poblacion_pct = 47.4,
             obtenidas = 138L, obtenidas_pct = 42.6)))))
  )
}

.mare_paginas <- function(path) {
  bytes <- readBin(path, "raw", file.size(path))
  txt <- rawToChar(bytes[bytes != as.raw(0)])
  length(gregexpr("/Type /Page[^s]", txt, useBytes = TRUE)[[1L]])
}

test_that("despacha por el eje: la facultad (o un modelo sin eje) sigue en el documento de HSVG", {
  expect_false(.marp_eje_no_es_facultad(list()))
  expect_false(.marp_eje_no_es_facultad(list(eje = list(clave = "facultad"))))
  expect_true(.marp_eje_no_es_facultad(list(eje = list(clave = "nivel"))))
})

test_that("lo que no entra en ninguna meta se lee del invariante, con cada celda fuera en su cifra", {
  fm <- .marp_fuera_de_meta(.mare_bloque())
  expect_identical(fm$efectivas, 430L)
  expect_identical(fm$en_meta, 324L)
  expect_identical(fm$fuera, 106L)
  expect_identical(fm$sin_celda + fm$sin_eje + fm$duplicadas, fm$fuera)
  # Orden natural del nivel, no el de llegada.
  expect_identical(fm$celdas_fuera$valor, c("5", "10"))
  expect_identical(fm$celdas_fuera$n, c(56L, 32L))
})

test_that("la nota al pie dice las 106 con su desglose, y cada nivel con SU cifra", {
  nota <- .marp_eje_nota_fuera_de_meta(.marp_fuera_de_meta(.mare_bloque()),
                                       .marp_rotulos_eje(.mare_bloque()$eje))
  expect_match(nota, "De las 430 encuestas efectivas, 324 cuentan para la meta.", fixed = TRUE)
  expect_match(nota, "Las 106 restantes no entran en ninguna", fixed = TRUE)
  # Regresión: `.marp_personas()` es escalar y repetía «56» en el nivel 10.
  expect_match(nota, "(nivel 5: 56; nivel 10: 32)", fixed = TRUE)
  expect_match(nota, "17 no tienen nivel identificado", fixed = TRUE)
  expect_match(nota, "1 es de una persona que respondió dos veces", fixed = TRUE)
})

test_that("sin nada fuera de meta no hay nota: el cero no se narra", {
  b <- .mare_bloque()
  b$total$invariante <- list(total = 324L, partes = list(en_celdas = 324L))
  b$facultades <- b$facultades[1L]
  fm <- .marp_fuera_de_meta(b)
  expect_identical(fm$fuera, 0L)
  expect_identical(.marp_eje_nota_fuera_de_meta(fm, .marp_rotulos_eje(b$eje)), "")
})

test_that("el plan del documento por nivel: avance, ritmo y composicion; sin paginas de facultad", {
  plan <- monitoreo_aulas_plan_del_documento(.mare_modelo())
  expect_identical(plan$seccion, c("Avance por nivel", "Ritmo del campo", "Composición de lo recogido"))
  expect_false(any(grepl("facultad", plan$seccion, ignore.case = TRUE)))
  sin_comp <- .mare_modelo(); sin_comp$composicion$fuente <- "sin_padron"
  expect_identical(monitoreo_aulas_plan_del_documento(sin_comp)$seccion,
                   c("Avance por nivel", "Ritmo del campo"))
})

test_that("el ambito es la facultad cuando el plan vive en una sola", {
  plan <- list(list(faculty = "CIENCIAS SOCIALES"), list(faculty = "CIENCIAS SOCIALES"))
  expect_identical(.marp_ambito_del_plan(plan), "Facultad de Ciencias Sociales")
  expect_identical(.marp_ambito_del_plan(c(plan, list(list(faculty = "DERECHO")))), "")
})

test_that("el documento por nivel se genera con portada y tantas hojas como declara su plan", {
  out <- tempfile(fileext = ".pdf")
  on.exit(unlink(out), add = TRUE)
  monitoreo_aulas_advance_report_pdf(.mare_modelo(), out)
  expect_true(file.exists(out))
  expect_gt(file.size(out), 5000)
  plan <- monitoreo_aulas_plan_del_documento(.mare_modelo())
  expect_identical(.mare_paginas(out), 1L + sum(plan$hojas))
})

test_that("una tabla general sin columnas de sexo no tumba el resumen de HSVG", {
  # Un estudio por facultad sin variable de sexo declarada: la tabla no reserva
  # esas columnas y `.marp_bloque_sexo` revienta con `numeric(0)`.
  general <- data.frame(Indicadores = c("Efectivas", "Muestra", "Avance muestra"),
                        Total = c(10, 20, 0.5), stringsAsFactors = FALSE)
  pdf(NULL); on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  expect_silent(.marp_bloque_sexo(general, pulso_pdf_tokens(), pulso_pdf_type("cliente"),
                                  0.04, 0.92, y = 0.586))
})
