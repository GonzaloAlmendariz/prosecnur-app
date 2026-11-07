source("setup-load-all.R")

# ADR 0135, punto 6: cobertura y participación. Por público, los casos (filas tras los filtros, sin ponderar), el
# padrón, la tasa y la meta; el padrón y la meta se proponen desde Cálculo de muestra o Monitoreo y nada se infiere.

.co_fuentes <- function() {
  base <- function(n) data.frame(sexo = rep(c("1", "2"), length.out = n), q = "1", stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("sexo", "q"), type = "select_one sx", list_name = "sx", label = c("Sexo", "Q"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = "sx", name = c("1", "2"), label = c("Mujer", "Hombre"), stringsAsFactors = FALSE),
               orders_list = NULL)
  list(data_sources = list(estudiantes = base(279), docentes = base(115), administrativos = base(85)),
       inst_sources = list(estudiantes = inst, docentes = inst, administrativos = inst))
}
.co_univ <- "Estudiantes: 327; Docentes: 123; Administrativos: 91"

test_that("metas en porcentaje o en casos, y filas extra desde lista o texto", {
  m <- .cobertura_metas("Docentes: 60%; Administrativos: 74")
  expect_identical(m$docentes, list(valor = 60, unidad = "porcentaje"))
  expect_identical(m$administrativos, list(valor = 74, unidad = "casos"))
  expect_identical(.cobertura_metas(list(Docentes = "60%"))$docentes$unidad, "porcentaje")
  expect_null(.cobertura_metas(""))
  ex <- .cobertura_extras("34 | egresados(as) | en 4 grupos focales")
  expect_identical(ex$cifra, "34"); expect_identical(ex$detalle, "en 4 grupos focales")
  ex2 <- .cobertura_extras(list(list(cifra = "34", rotulo = "egresados(as)", detalle = "en 4 grupos focales"), list(cifra = "")))
  expect_identical(nrow(ex2), 1L)
})

test_that("la especificación: tasa sobre el padrón, meta en % y sin padrón ni tasa ni barra", {
  e <- .espec_cobertura(c("Estudiantes", "Docentes", "Administrativos"), c(279, 115, 85), .co_univ,
                        "Estudiantes: 60%; Docentes: 60%; Administrativos: 90%",
                        list(list(cifra = "34", rotulo = "egresados(as)", detalle = "en 4 grupos focales")))
  pb <- e$publicos
  expect_identical(e$version, "cobertura/1")
  expect_identical(pb$texto_casos, c("279", "115", "85"))
  expect_identical(pb$texto_padron, c("de 327", "de 123", "de 91"))
  expect_identical(pb$texto_tasa, c("85%", "93%", "93%"))
  expect_identical(pb$texto_meta, c("60%", "60%", "90%"))
  expect_identical(unname(e$leyenda), c("Tasa de respuesta", "Meta de la propuesta"))
  expect_identical(unname(e$colores[["tasa"]]), .std_color("azul"))
  expect_identical(e$extras$rotulo, "egresados(as)")
  # Sin padrón: sólo n, ninguna tasa inventada; una meta en casos sin padrón no se dibuja y se avisa.
  e2 <- .espec_cobertura(c("Docentes", "Estudiantes"), c(115, 279), "Docentes: 123", "Estudiantes: 200")
  expect_identical(e2$publicos$texto_tasa, c("93%", ""))
  expect_identical(e2$publicos$texto_padron, c("de 123", ""))
  expect_true(is.na(e2$publicos$meta[2]))
  expect_match(e2$avisos, "La meta de Estudiantes está en casos y no tiene padrón", fixed = TRUE)
  # Meta en casos con padrón: se lleva a porcentaje. Más casos que padrón: no hay tasa y se avisa.
  e3 <- .espec_cobertura(c("Docentes", "Estudiantes"), c(115, 400), .co_univ, "Docentes: 74")
  expect_identical(e3$publicos$texto_meta[1], "60%")
  expect_identical(e3$publicos$texto_tasa[2], "")
  expect_match(e3$avisos, "más casos que su padrón", fixed = TRUE)
  e4 <- .espec_cobertura(c("Docentes"), c(115))
  expect_false(e4$con_barras)
})

test_that("en la ruta real los casos son las filas tras los filtros y la lámina nativa sale con sus piezas", {
  skip_if_not_installed("officer")
  src <- .co_fuentes()
  el <- p_cobertura(universos = .co_univ, metas = "Estudiantes: 60%; Docentes: 60%; Administrativos: 90%",
                    extras = "34 | egresados(as) | en 4 grupos focales")
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Cobertura"),
                               p_slide_1_grafico(p_cobertura(bases = "docentes", filtros = list(sexo = "1")), titulo = "Mujeres")))
  salida <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                              solo_lista = TRUE, mensajes_progreso = FALSE))
  e <- attr(salida$rendered[[1]], "pulso_espec")
  expect_identical(e$publicos$publico, c("Estudiantes", "Docentes", "Administrativos"))
  expect_identical(e$publicos$casos, c(279, 115, 85))
  expect_identical(attr(salida$rendered[[2]], "pulso_espec")$publicos$casos, 58)
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan[1],
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  grupos <- xml2::xml_attr(xml2::xml_find_all(x, "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:cobertura" %in% grupos)
  texto <- paste(xml2::xml_text(xml2::xml_find_all(x, "//a:t")), collapse = " | ")
  for (t in c("279", "de 327", "estudiantes", "85%", "93%", "90%", "Tasa de respuesta", "Meta de la propuesta", "34", "en 4 grupos focales")) {
    expect_match(texto, t, fixed = TRUE)
  }
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:sp/p:nvSpPr/p:cNvPr"), "name")
  expect_identical(sum(nombres == "cobertura:barra_tasa"), 3L); expect_identical(sum(nombres == "cobertura:barra_meta"), 3L)
  # La base automática de la encuesta entera no describe a ningún público: no va.
  expect_false(grepl("Base:", texto, fixed = TRUE))
})

test_that("con más de siete filas va el dibujo de respaldo", {
  skip_if_not_installed("ggplot2")
  d <- data.frame(publico = paste("Público", 1:8), casos = 10 * (1:8))
  p <- graficar_cobertura(d)
  expect_s3_class(p, "ggplot")
  expect_false(.lam_cobertura_cabe(attr(p, "pulso_espec")))
  expect_true(.lam_cobertura_cabe(attr(graficar_cobertura(d[1:3, ], universos = "Público 1: 20"), "pulso_espec")))
})

test_that("el padrón se propone desde Cálculo de muestra y, si no, desde Monitoreo; sin actor que calce, NA con motivo", {
  s <- list(
    calc_muestra_estudio = list(componentes = list(
      list(actor = "Docentes", actor_id = "docentes", marco = list(marco_validado = 123L), meta = list(tipo = "cobertura", valor = 60L)),
      list(actor = "Estudiantes", actor_id = "estudiantes", marco = list(marco_validado = 327L), meta = list(tipo = "objetivo", valor = 0L)),
      list(actor = "Egresados", actor_id = "egresados", marco = list(marco_validado = 40L), meta = list(tipo = "objetivo", valor = 20L)),
      list(actor = "Egresados", actor_id = "egresados_gf", marco = list(marco_validado = 55L), meta = list(tipo = "objetivo", valor = 20L)))),
    monitoreo_snapshot = list(dashboard = list(acreditacion_reports = list(client_report = list(actors = data.frame(
      Actor = c("Administrativos", "Estudiantes"), Universo = c(91, 330), Meta = c(82, 196), stringsAsFactors = FALSE))))))
  r <- .graficos_padron_por_base(s, c("docentes", "estudiantes", "administrativos", "egresados", "autoridades"))
  names(r) <- vapply(r, `[[`, "", "base")
  expect_identical(r$docentes$padron, 123); expect_identical(r$docentes$meta, 60); expect_identical(r$docentes$meta_unidad, "porcentaje")
  expect_match(r$docentes$padron_origen, "Cálculo de muestra", fixed = TRUE)
  # Estudiantes: padrón de Cálculo de muestra (manda) y la meta, que allí no está declarada, de Monitoreo.
  expect_identical(r$estudiantes$padron, 327); expect_identical(r$estudiantes$meta, 196)
  expect_match(r$estudiantes$meta_origen, "Monitoreo", fixed = TRUE)
  expect_identical(r$administrativos$padron, 91); expect_identical(r$administrativos$meta_unidad, "casos")
  # Dos componentes para la misma base con cifras distintas: no se elige uno.
  expect_true(is.na(r$egresados$padron)); expect_match(r$egresados$motivo, "cifras distintas", fixed = TRUE)
  expect_true(is.na(r$autoridades$padron)); expect_match(r$autoridades$motivo, "Sin padrón declarado", fixed = TRUE)
})

.co_http_get <- function(sid, path) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_regla(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = path, QUERY_STRING = "", HTTP_X_PULSO_SESSION = sid,
                             HEADERS = c(`x-pulso-session` = sid), rook.input = list(read = function(...) raw(0), rewind = function() invisible(0),
                                                                                    read_lines = function(...) character())))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: GET /api/graficos/resumenes/padron propone por cada base del estudio, también la que no es activa", {
  src <- .co_fuentes()
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(estudiantes = list(nombre = "estudiantes"), docentes = list(nombre = "docentes"),
                                                administrativos = list(nombre = "administrativos")),
                                   active_base = "administrativos", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", src$inst_sources)
  session_set(sid, "calc_muestra_estudio", list(componentes = list(
    list(actor = "Docentes", actor_id = "docentes", marco = list(marco_validado = 123L), meta = list(tipo = "cobertura", valor = 60L)))))
  r <- .co_http_get(sid, "/api/graficos/resumenes/padron")
  expect_identical(r$status, 200L)
  bases <- vapply(r$body$bases, `[[`, "", "base")
  expect_identical(bases, c("estudiantes", "docentes", "administrativos"))
  doc <- r$body$bases[[2]]
  expect_identical(doc$padron, 123L); expect_identical(doc$meta, 60L); expect_identical(doc$meta_unidad, "porcentaje")
  est <- r$body$bases[[1]]
  expect_null(est$padron); expect_match(est$motivo, "Sin padrón declarado", fixed = TRUE)
})

test_that("el registro ofrece cobertura y participación, y el endpoint queda montado", {
  meta <- .GRAFICADORES_META$p_cobertura
  expect_identical(meta$titulo_humano, "Cobertura y participación")
  expect_true(meta$salida_nativa)
  args <- vapply(meta$args, `[[`, "", "name")
  expect_true(all(c("bases", "universos", "metas", "extras") %in% args))
  expect_true(all(args %in% names(formals(p_cobertura))))
  expect_true(is.function(getExportedValue("prosecnurapp", "p_cobertura")))
  src <- paste(readLines(test_path("..", "..", "R", "plumber_app.R"), warn = FALSE), collapse = "\n")
  expect_match(src, "mount_graficos_regla(pr)", fixed = TRUE)
})
