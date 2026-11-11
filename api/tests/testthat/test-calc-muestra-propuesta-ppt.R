# PPT de diseño muestral para propuestas: escenarios comparados (A y B) desde
# los componentes de Cálculo de muestra.

.prop_comp <- function(actor, cat, N, meta, tasa, estratos = NULL, seg = "") {
  list(actor = actor, segmentacion = seg, actor_categoria = cat, canal_recojo = "online_email",
       meta = list(valor = meta, origen = "usuario"), parametros = list(n_minimo_estrato = 30, tasa_respuesta = tasa),
       marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N,
                    estratos = if (is.null(estratos)) NULL else lapply(names(estratos), function(k) list(label = k, N = estratos[[k]]))))
}

.prop_dci <- function() {
  adm <- list(Nombrado = 1528L, Contratado = 629L, `Autoridades (direcciones)` = 37L)
  doc <- list(`Contratado a tiempo completo` = 114L, `Contratado a tiempo parcial` = 1751L,
              `Ordinario auxiliar` = 269L, `Ordinario asociado` = 255L, `Ordinario principal` = 276L)
  esc <- function(nombre, m) list(nombre = nombre, componentes = list(
    .prop_comp("Docentes", "docentes", 2665L, m[1], 0.316, doc, "Condición y categoría"),
    .prop_comp("Administrativos", "administrativos", 2194L, m[2], 0.508, adm, "Tipo de contrato"),
    .prop_comp("Egresados", "egresados", 12512L, m[3], 0.105)))
  # (Egresados sin cuotas: meta única.)
  list(titulo = "Encuesta de prueba", referencia_rotulo = "medición anterior",
       escenarios = list(esc("Propuesta A", c(900L, 900L, 600L)), esc("Propuesta B", c(600L, 600L, 400L))))
}

test_that("las tablas comparan los escenarios con las metas del motor", {
  t <- calc_muestra_propuesta_tablas(.prop_dci())
  expect_identical(t$escenarios, c("Propuesta A", "Propuesta B"))
  # Dos bloques con fila de sección: encuestas (con total) y margen de referencia.
  expect_identical(t$comparacion$Indicador[c(1, 6)], c("Encuestas", "Margen de referencia"))
  expect_identical(attr(t$comparacion, "secciones"), c(1L, 6L))
  # El mínimo se suma encima: administrativos A 900 + 15 (autoridades de 15 a 30); B: docentes +4, administrativos +20.
  expect_identical(t$comparacion[["Propuesta A"]][2:5], c("900", "915", "600", "2,415"))
  expect_identical(t$comparacion[["Propuesta B"]][2:5], c("604", "620", "400", "1,624"))
  expect_identical(t$agregados, c("Docentes +4 en Propuesta B", "Administrativos +15 en Propuesta A, +20 en Propuesta B"))
  # Margen de referencia de 900 en 2,665: ±2.7 %.
  expect_identical(t$comparacion[["Propuesta A"]][7], "± 2.7 %")
  # Metas por segmento: suman la meta del público y respetan el mínimo.
  d <- t$segmentos$Docentes
  expect_identical(tail(d[["Meta Propuesta B"]], 1), "604")
  expect_identical(d[["Meta Propuesta B"]][1], "30")
  expect_identical(attr(d, "al_minimo"), "Contratado a tiempo completo")
  expect_false("Egresados" %in% names(t$segmentos))
  # Para cada actor queda dicho cómo se reparte su meta.
  expect_identical(t$poblacion[["Cómo se reparte la meta"]][1:3],
                   c("Condición y categoría: 5 segmentos que se reportan", "Tipo de contrato: 3 segmentos que se reportan",
                     "Meta única, sin cuotas"))
})

test_that("la viabilidad dice qué escenario exige más respuesta y qué segmento no alcanza", {
  t <- calc_muestra_propuesta_tablas(.prop_dci())
  v <- t$viabilidad
  expect_identical(v$Lectura[v[["Público"]] == "Docentes"], "Exige más respuesta en Propuesta A")
  expect_identical(v$Lectura[v[["Público"]] == "Egresados"], "Alcanzable")
  # Autoridades: 30 de 37 en ambos escenarios; los segmentos proporcionales de docentes no se repiten.
  expect_length(t$avisos, 1L)
  expect_match(t$avisos, "Autoridades (direcciones): 30 encuestas de 37 personas, 81 % de respuesta, en todos los escenarios", fixed = TRUE)
})

test_that("el PPT trae portada, cinco tipos de lámina y contraportada al final", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  out <- tempfile(fileext = ".pptx")
  r <- calc_muestra_propuesta_ppt(.prop_dci(), out)
  expect_true(file.exists(out))
  # Portada, diseño, población, escenarios, metas de docentes y de administrativos, viabilidad, cierre.
  expect_identical(as.integer(r$laminas), 8L)
  doc <- officer::read_pptx(out)
  # pptx_summary avisa coerción con las celdas combinadas de las filas de sección.
  textos <- suppressWarnings(officer::pptx_summary(doc))
  titulos <- unique(textos$text[grepl("^(DISEÑO|POBLACIÓN|ESCENARIOS|METAS|VIABILIDAD)", textos$text)])
  expect_identical(titulos, c("DISEÑO MUESTRAL", "POBLACIÓN Y SEGMENTOS", "ESCENARIOS DE MUESTRA",
                              "METAS POR SEGMENTO: DOCENTES", "METAS POR SEGMENTO: ADMINISTRATIVOS", "VIABILIDAD DE LAS METAS"))
  # Un barrido no habla de sorteo salvo para decir que no lo hay.
  con_sorteo <- textos$text[grepl("sorteo", textos$text, ignore.case = TRUE)]
  expect_true(all(grepl("no hay sorteo", con_sorteo, fixed = TRUE)))
  # La contraportada queda al final (orden de las láminas, no su id interno).
  ultima <- officer::slide_summary(officer::on_slide(doc, length(doc)))
  expect_true(any(grepl("pucp.edu.pe", ultima$text, fixed = TRUE)))
})

test_that("el Excel de escenarios trae las mismas cifras que el PPT, como números", {
  skip_if_not_installed("openxlsx")
  out <- tempfile(fileext = ".xlsx")
  r <- calc_muestra_propuesta_xlsx(.prop_dci(), out)
  expect_identical(r$hojas, c("Resumen", "Docentes", "Administrativos", "Viabilidad", "Diseño"))
  # Cabecera en la fila 5 y cuatro públicos más el total; las notas van debajo.
  res <- openxlsx::read.xlsx(out, sheet = "Resumen", rows = 5:9)
  # Metas de A y B por público y total: las mismas que la tabla del PPT.
  expect_identical(as.integer(res[[4]]), c(900L, 915L, 600L, 2415L))
  expect_identical(as.integer(res[[7]]), c(604L, 620L, 400L, 1624L))
  # Respuesta necesaria y margen de referencia son números, no texto.
  expect_true(is.numeric(res[[5]]))
  expect_equal(res[[5]][1], 900 / 2665)
  expect_equal(res[[6]][1], 1.96 * sqrt(0.25 / 900 * (2665 - 900) / 2664))
  doc <- openxlsx::read.xlsx(out, sheet = "Docentes", startRow = 3)
  expect_identical(as.integer(doc[[3]]), c(39L, 591L, 91L, 86L, 93L, 900L))
  v <- openxlsx::read.xlsx(out, sheet = "Viabilidad", startRow = 4, colNames = TRUE)
  expect_identical(v$Lectura[1:3], c("Exige más respuesta en Propuesta A", "Alcanzable", "Alcanzable"))
  # Cuotas de control: un actor declarado como control se rotula así en su hoja.
  p <- .prop_dci(); p$escenarios[[1]]$componentes[[1]]$uso_segmentos <- "control"; p$escenarios[[2]]$componentes[[1]]$uso_segmentos <- "control"
  out2 <- tempfile(fileext = ".xlsx"); calc_muestra_propuesta_xlsx(p, out2)
  expect_identical(openxlsx::read.xlsx(out2, sheet = "Docentes", colNames = FALSE, rows = 1)[[1]], "Metas por cuota de control: Docentes")
})
