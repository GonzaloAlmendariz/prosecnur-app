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
  list(titulo = "Encuesta de prueba", referencia_rotulo = "medición anterior", incluir_viabilidad = TRUE,
       escenarios = list(esc("Propuesta A", c(900L, 900L, 600L)), esc("Propuesta B", c(600L, 600L, 400L))))
}

test_that("las tablas comparan los escenarios con las metas del motor", {
  t <- calc_muestra_propuesta_tablas(.prop_dci())
  expect_identical(t$escenarios, c("Propuesta A", "Propuesta B"))
  # Dos bloques con fila de sección: encuestas (con total) y margen de referencia.
  expect_identical(t$comparacion$Indicador[c(1, 6)], c("Encuestas", "Margen de error"))
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
  # De mayor a menor población, como el gráfico: tiempo parcial (1,751) primero, tiempo completo (114) al final.
  expect_identical(d$Segmento, c("Contratado a tiempo parcial", "Ordinario principal", "Ordinario auxiliar",
                                 "Ordinario asociado", "Contratado a tiempo completo", "Total"))
  expect_identical(d[["Meta Propuesta B"]][5], "30")
  expect_identical(attr(d, "al_minimo"), "Contratado a tiempo completo")
  # El % de la población se escribe como en el gráfico (barras verticales, enteros: "4%", "66%"), porque explica
  # las metas.
  expect_identical(d[["% de la población"]][c(5, 1)], c("4%", "66%"))
  expect_identical(tail(d[["% de la población"]], 1), "100%")
  expect_false("Egresados" %in% names(t$segmentos))
  # Para cada actor queda dicho cómo se reparte su meta.
  # Revisión 2026-11-11: se nombran los segmentos de cruce; un actor sin cruce no lleva nada.
  expect_identical(t$poblacion[["Segmento de cruce"]][2:3],
                   c("Tipo de contrato: Nombrado, Contratado y Autoridades (direcciones)", ""))
  expect_identical(names(t$poblacion), c("Público", "Segmento de cruce", "Población"))
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

test_that("portada y diseño muestral se pueden quitar cuando las láminas van dentro de otra propuesta", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  p <- .prop_dci(); p$incluir_viabilidad <- NULL; p$incluir_portada <- FALSE; p$incluir_diseno <- FALSE
  r <- calc_muestra_propuesta_ppt(p, tempfile(fileext = ".pptx"))
  expect_identical(as.integer(r$laminas), 7L)
  doc <- officer::read_pptx(r$path)
  primera <- officer::slide_summary(officer::on_slide(doc, 1))$text
  expect_true(any(grepl("POBLACIÓN Y SEGMENTOS DE CRUCE", primera, fixed = TRUE)))
})

test_that("sin pedirla, la propuesta para el cliente no lleva la lámina de viabilidad", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  p <- .prop_dci(); p$incluir_viabilidad <- NULL
  r <- calc_muestra_propuesta_ppt(p, tempfile(fileext = ".pptx"))
  # Portada, diseño, población, gráficos de dos en dos (población y docentes; administrativos), escenarios,
  # metas de docentes y de administrativos, contraportada.
  expect_identical(as.integer(r$laminas), 9L)
  rx <- calc_muestra_propuesta_xlsx(p, tempfile(fileext = ".xlsx"))
  expect_false("Viabilidad" %in% rx$hojas)
})

test_that("el PPT trae portada, cinco tipos de lámina y contraportada al final", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  out <- tempfile(fileext = ".pptx")
  r <- calc_muestra_propuesta_ppt(.prop_dci(), out)
  expect_true(file.exists(out))
  # Las mismas nueve más la viabilidad.
  expect_identical(as.integer(r$laminas), 10L)
  doc <- officer::read_pptx(out)
  # pptx_summary avisa coerción con las celdas combinadas de las filas de sección.
  textos <- suppressWarnings(officer::pptx_summary(doc))
  titulos <- unique(textos$text[grepl("^(DISEÑO|POBLACIÓN|ESCENARIOS|METAS|VIABILIDAD)", textos$text)])
  # pptx_summary no sigue el orden de las láminas tras move_slide: aquí se compara el conjunto; el orden se
  # mira abajo, lámina por lámina.
  expect_setequal(titulos, c("DISEÑO MUESTRAL", "POBLACIÓN Y SEGMENTOS DE CRUCE", "POBLACIÓN Y DOCENTES", "ESCENARIOS DE MUESTRA",
                             "METAS POR SEGMENTO: DOCENTES", "METAS POR SEGMENTO: ADMINISTRATIVOS", "VIABILIDAD DE LAS METAS"))
  # Gráficos del motor de Procesamiento, cada uno junto a su tabla.
  orden <- vapply(seq_len(length(doc)), function(i) {
    t <- officer::slide_summary(officer::on_slide(doc, i))$text
    paste(t[!is.na(t)], collapse = " ")
  }, "")
  # Es población, no respuestas: ningún gráfico dice "N respuestas" (revisión 2026-11-11).
  expect_false(any(grepl("respuestas", orden, fixed = TRUE)))
  # Los gráficos van juntos tras la tabla de población, de dos en dos.
  expect_match(orden[4], "POBLACIÓN Y DOCENTES", fixed = TRUE)
  expect_match(orden[4], "Docentes por condición y categoría", fixed = TRUE)
  expect_match(orden[5], "ADMINISTRATIVOS POR TIPO DE CONTRATO", fixed = TRUE)
  expect_match(orden[6], "ESCENARIOS DE MUESTRA", fixed = TRUE)
  expect_match(orden[7], "METAS POR SEGMENTO: DOCENTES", fixed = TRUE)
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
  expect_identical(as.integer(doc[[4]]), c(591L, 93L, 91L, 86L, 39L, 900L))
  expect_equal(doc[[3]][5], 114 / 2665)
  v <- openxlsx::read.xlsx(out, sheet = "Viabilidad", startRow = 4, colNames = TRUE)
  expect_identical(v$Lectura[1:3], c("Exige más respuesta en Propuesta A", "Alcanzable", "Alcanzable"))
  # Cuotas de control: un actor declarado como control se rotula así en su hoja.
  p <- .prop_dci(); p$escenarios[[1]]$componentes[[1]]$uso_segmentos <- "control"; p$escenarios[[2]]$componentes[[1]]$uso_segmentos <- "control"
  out2 <- tempfile(fileext = ".xlsx"); calc_muestra_propuesta_xlsx(p, out2)
  expect_identical(openxlsx::read.xlsx(out2, sheet = "Docentes", colNames = FALSE, rows = 1)[[1]], "Metas por cuota de control: Docentes")
})
