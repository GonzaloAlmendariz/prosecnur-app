source("setup-load-all.R")

# ADR 0135, punto 6: el cierre con hallazgos. Cada cifra es una referencia viva (id de la lámina de origen y clave de una
# de sus cifras) que se lee, al exportar, de la especificación que dibuja esa lámina. Las claves estables viven en
# graficos_cifras_clave.R.

.ch_fuentes <- function() {
  lk <- c("1", "2", "3", "4", "5", "9")
  inst <- list(survey = data.frame(name = c("q1", "q2", "sexo"), type = c("select_one lk", "select_one lk", "select_one sx"),
                                   list_name = c("lk", "lk", "sx"), label = c("Reglamentos", "Biblioteca", "Sexo"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("lk", 6), "sx", "sx"), name = c(lk, "1", "2"),
                                    label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo",
                                              "No tengo información suficiente", "Mujer", "Hombre"), stringsAsFactors = FALSE),
               orders_list = NULL, listas_ordinales_declaradas = "lk")   # dos preguntas: la escala la declara el estudio
  base <- function(a, b) data.frame(q1 = rep(lk, a), q2 = rep(lk, b), sexo = rep(c("1", "2"), length.out = 40), stringsAsFactors = FALSE)
  list(data_sources = list(docentes = base(c(2, 3, 5, 15, 10, 5), c(4, 6, 10, 10, 6, 4)),
                           estudiantes = base(c(5, 5, 10, 10, 8, 2), c(6, 8, 8, 9, 9, 0))),
       inst_sources = list(docentes = inst, estudiantes = inst))
}
.ch_correr <- function(plan, src = .ch_fuentes(), path = NULL) {
  avisos <- character(0)
  out <- withCallingHandlers(
    if (is.null(path)) reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan, solo_lista = TRUE,
                                        mensajes_progreso = FALSE)
    else reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan, path_ppt = path, mensajes_progreso = FALSE),
    warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  list(out = out, avisos = avisos)
}
.ch_vars <- list(Reglamentos = c("docentes$q1", "estudiantes$q1"), Biblioteca = c("docentes$q2", "estudiantes$q2"))
.ch_origenes <- function() list(
  p_slide_1_grafico(p_cobertura(universos = "Docentes: 50; Estudiantes: 80", metas = "Docentes: 60%"), titulo = "Cobertura",
                    meta = list(lamina_id = "cob")),
  p_slide_1_grafico(p_dumbbell(vars = .ch_vars, corte = c("4", "5"), estilo = "resumen"), titulo = "Contraste",
                    meta = list(lamina_id = "con")),
  p_slide_1_grafico(p_barras_divergentes(vars = c("docentes$q1", "docentes$q2"), estilo = "resumen"), titulo = "Escala",
                    meta = list(lamina_id = "esc")))
.ch_por <- function(cifras) stats::setNames(cifras, vapply(cifras, `[[`, "", "clave"))

test_that("cada especificación de resumen publica sus cifras con clave estable y el texto de la lámina", {
  skip_if_not_installed("ggplot2")
  r <- .ch_correr(p_plan(slides = .ch_origenes()))$out
  cob <- .ch_por(.cifras_clave(attr(r$rendered[[1]], "pulso_espec")))
  expect_identical(names(cob), c("casos:Docentes", "tasa:Docentes", "meta:Docentes", "casos:Estudiantes", "tasa:Estudiantes"))
  expect_identical(cob[["tasa:Docentes"]]$texto, "80%"); expect_equal(cob[["tasa:Docentes"]]$valor, 80)
  con_esp <- attr(r$rendered[[2]], "pulso_espec")
  con <- .ch_por(.cifras_clave(con_esp))
  expect_true(all(c("diferencia:Reglamentos", "valor:Reglamentos:Docentes", "valor:Reglamentos:Estudiantes") %in% names(con)))
  i <- match("Reglamentos", con_esp$rotulos)
  expect_identical(con[["diferencia:Reglamentos"]]$texto, con_esp$textos_diferencia[i])
  expect_identical(con[["diferencia:Reglamentos"]]$unidad, "pts")
  expect_identical(con[["valor:Reglamentos:Docentes"]]$texto, con_esp$cifras[i, 1])
  esc_esp <- attr(r$rendered[[3]], "pulso_espec")
  esc <- .ch_por(.cifras_clave(esc_esp))
  t <- esc_esp$filas[1]
  expect_identical(esc[[paste0("t2b:", t)]]$texto, esc_esp$cifras_pos[1])
  expect_true(paste0("sin_info:", t) %in% names(esc))
  # Panorama y fortalezas.
  pf <- .ch_correr(p_plan(slides = list(
    p_slide_1_grafico(p_panorama(vars = c("docentes$q1", "docentes$q2", "estudiantes$q1", "estudiantes$q2"), corte = c("4", "5")), titulo = "P"),
    p_slide_1_grafico(p_fortalezas(vars = c("docentes$q1", "docentes$q2"), corte = c("4", "5"), n = 1), titulo = "F"))))$out
  pan_esp <- attr(pf$rendered[[1]], "pulso_espec")
  pan <- .ch_por(.cifras_clave(pan_esp))
  expect_identical(names(pan), c("mediana:Docentes", "bajo:Docentes", "mediana:Estudiantes", "bajo:Estudiantes"))
  expect_identical(pan[["mediana:Docentes"]]$texto, pan_esp$textos_mediana[1])
  fo <- .ch_por(.cifras_clave(attr(pf$rendered[[2]], "pulso_espec")))
  expect_identical(sort(names(fo)), c("valor:Biblioteca", "valor:Reglamentos"))
  expect_length(.cifras_clave(list(tipo = "escala")), 0L)
})

test_that("el cierre lee cada cifra de su lámina de origen, con el mismo texto que esa lámina", {
  skip_if_not_installed("ggplot2")
  cierre <- p_slide_cierre_hallazgos(hallazgos = list(
    list(lamina = "cob", cifra = "tasa:Docentes", texto = "de los docentes respondió la encuesta"),
    list(lamina = "con", cifra = "diferencia:Reglamentos", texto = "separan a docentes y estudiantes en reglamentos"),
    list(lamina = "esc", cifra = paste0("t2b:", "Reglamentos"), texto = "conoce los reglamentos")), titulo = "Cierre")
  r <- .ch_correr(p_plan(slides = c(.ch_origenes(), list(cierre))))
  esp <- attr(r$out$rendered[[4]], "pulso_espec")
  expect_identical(esp$version, "cierre_hallazgos/1")
  hs <- esp$hallazgos
  origen <- function(k, clave) .ch_por(.cifras_clave(attr(r$out$rendered[[k]], "pulso_espec")))[[clave]]
  expect_identical(hs[[1]]$cifra, origen(1, "tasa:Docentes")$texto)
  expect_identical(hs[[2]]$cifra, origen(2, "diferencia:Reglamentos")$texto)
  expect_identical(hs[[2]]$unidad, "pts")
  expect_identical(hs[[3]]$cifra, origen(3, "t2b:Reglamentos")$texto)
  expect_true(all(vapply(hs, function(h) is.null(h$aviso), TRUE)))
  expect_identical(hs[[1]]$texto, "de los docentes respondió la encuesta")
})

test_that("sin lámina de origen o sin la cifra, el hallazgo avisa y no inventa; una cifra que cambió también avisa", {
  skip_if_not_installed("ggplot2")
  cierre <- p_slide_cierre_hallazgos(hallazgos = list(
    list(lamina = "borrada", cifra = "tasa:Docentes", texto = "a"),
    list(lamina = "cob", cifra = "tasa:Egresados", texto = "b"),
    list(lamina = "cob", cifra = "casos:Docentes", texto = "c", cifra_al_escribir = "39")))
  r <- .ch_correr(p_plan(slides = c(.ch_origenes()[1], list(cierre))))
  hs <- attr(r$out$rendered[[2]], "pulso_espec")$hallazgos
  expect_null(hs[[1]]$cifra); expect_identical(hs[[1]]$aviso, "La lámina de origen ya no está.")
  expect_null(hs[[2]]$cifra); expect_identical(hs[[2]]$aviso, "La cifra ya no está en su lámina de origen.")
  expect_identical(hs[[3]]$cifra, "40")
  expect_match(hs[[3]]$aviso, "era 39 y hoy es 40", fixed = TRUE)
  expect_true(any(grepl("La lámina de origen ya no está", r$avisos, fixed = TRUE)))
})

test_that("el constructor acepta hasta cinco hallazgos (el render avisa bajo tres y sin ninguno)", {
  expect_identical(length(p_slide_cierre_hallazgos()$slots$plot$hallazgos), 0L)
  seis <- rep(list(list(lamina = "a", cifra = "b", texto = "c")), 6)
  expect_error(p_slide_cierre_hallazgos(hallazgos = seis), "de tres a cinco")
  s <- p_slide_cierre_hallazgos(hallazgos = list(lamina = "a", cifra = "b", texto = "c"))   # un hallazgo suelto, como lo desenvuelve el JSON
  expect_length(s$slots$plot$hallazgos, 1L)
  # La app no escribe títulos: sin etiqueta ni título del analista, la lámina sale sin los dos.
  expect_null(s$meta$antetitulo); expect_null(s$title)
  expect_match(.espec_cierre_hallazgos(list(list(texto = "x")))$avisos[1], "de tres a cinco hallazgos y tiene 1", fixed = TRUE)
})

test_that("camino real del plan JSON: los rearmados conservan el id de la lámina y el cierre la encuentra", {
  skip_if_not_installed("ggplot2")
  json <- '{"slides": [
    {"id": "s-cob", "tipo": "p_slide_1_grafico", "payload": {"titulo": "Cobertura",
      "grafico": {"graficador": "p_cobertura", "args": {"universos": "Docentes: 50; Estudiantes: 80"}}}},
    {"id": "s-cierre", "tipo": "p_slide_cierre_hallazgos", "payload": {"titulo": "Cierre",
      "hallazgos": [{"lamina": "s-cob", "cifra": "tasa:Estudiantes", "texto": "de los estudiantes respondió"},
                    {"lamina": "s-cob", "cifra": "casos:Docentes", "texto": "docentes encuestados"},
                    {"lamina": "s-cob", "cifra": "tasa:Docentes", "texto": "de los docentes respondió"}]}}]}'
  plan <- jsonlite::fromJSON(json, simplifyVector = FALSE)
  # Los tres rearmados: el del job de export, el del router y el de la vista previa.
  rj <- lapply(plan$slides, .graficos_rebuild_slide_json)
  expect_identical(vapply(rj, function(s) s$meta$lamina_id, ""), c("s-cob", "s-cierre"))
  expect_identical(.rebuild_slide(plan$slides[[1]])$meta$lamina_id, "s-cob")
  expect_identical(.mini_rebuild_slide(plan$slides[[1]])$meta$lamina_id, "s-cob")
  # Un id declarado en la meta se respeta.
  expect_identical(.graficos_slide_con_id(p_slide_1_grafico(p_cobertura(), meta = list(lamina_id = "propio")), "otro")$meta$lamina_id, "propio")
  r <- .ch_correr(do.call(p_plan, list(slides = rj)))
  hs <- attr(r$out$rendered[[2]], "pulso_espec")$hallazgos
  expect_identical(vapply(hs, function(h) h$cifra %||% "", ""), c("50%", "40", "80%"))
  # La vista previa de la lámina sola rearma sus orígenes desde el plan del editor.
  origen <- .cierre_plan_preview(plan$slides[[2]], plan$slides, .graficos_rebuild_slide_json)
  expect_length(origen, 1L); expect_identical(origen[[1]]$meta$lamina_id, "s-cob")
  op <- options(prosecnur.cierre_plan = origen); on.exit(options(op), add = TRUE)
  solo <- .ch_correr(do.call(p_plan, list(slides = rj[2])))
  expect_identical(attr(solo$out$rendered[[1]], "pulso_espec")$hallazgos[[1]]$cifra, "50%")
})

test_that("la lámina nativa: una tarjeta por hallazgo con la cifra y la frase, sin intervalos", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  cierre <- p_slide_cierre_hallazgos(hallazgos = list(
    list(lamina = "cob", cifra = "tasa:Docentes", texto = "de los docentes respondió la encuesta"),
    list(lamina = "con", cifra = "diferencia:Reglamentos", texto = "separan a docentes y estudiantes en reglamentos"),
    list(lamina = "fuera", cifra = "x", texto = "un hallazgo sin origen")), titulo = "Lo que deja el estudio")
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  .ch_correr(p_plan(slides = c(.ch_origenes()[1:2], list(cierre))), path = out)
  x <- xml2::read_xml(unz(out, "ppt/slides/slide3.xml"))
  grupos <- xml2::xml_attr(xml2::xml_find_all(x, "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:cierre_hallazgos" %in% grupos)
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:sp/p:nvSpPr/p:cNvPr"), "name")
  expect_identical(sum(nombres == "hallazgo:tarjeta"), 3L)
  expect_identical(sum(nombres == "cierre:cifra"), 2L)
  expect_false(any(grepl("intervalo", nombres)))
  texto <- paste(xml2::xml_text(xml2::xml_find_all(x, "//a:t")), collapse = " | ")
  for (t in c("80%", "pts", "de los docentes respondió la encuesta", "La lámina de origen ya no está.", "Lo que deja el estudio")) {
    expect_match(texto, t, fixed = TRUE)
  }
})

test_that("título y antetítulo: vacíos por defecto, sin rótulo fantasma; los escritos se conservan", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  hs <- list(list(lamina = "cob", cifra = "tasa:Docentes", texto = "de los docentes respondió"),
             list(lamina = "cob", cifra = "casos:Docentes", texto = "docentes encuestados"),
             list(lamina = "cob", cifra = "tasa:Estudiantes", texto = "de los estudiantes respondió"))
  # Una lámina guardada con los suyos los conserva.
  escrita <- p_slide_cierre_hallazgos(hallazgos = hs, titulo = "Tres claves", etiqueta = "Síntesis")
  expect_identical(escrita$title, "Tres claves"); expect_identical(escrita$meta$antetitulo, "Síntesis")
  expect_null(p_slide_cierre_hallazgos(hallazgos = hs, etiqueta = "  ")$meta$antetitulo)   # en blanco = sin escribir
  formas <- function(slide) {
    out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
    .ch_correr(p_plan(slides = c(.ch_origenes()[1], list(slide))), path = out)
    x <- xml2::read_xml(unz(out, "ppt/slides/slide2.xml"))
    sps <- xml2::xml_find_all(x, "//p:sp")
    data.frame(nombre = xml2::xml_attr(xml2::xml_find_first(sps, ".//p:cNvPr"), "name"),
               texto = vapply(sps, function(n) paste(xml2::xml_text(xml2::xml_find_all(n, ".//a:t")), collapse = ""), ""),
               stringsAsFactors = FALSE)
  }
  vacia <- formas(p_slide_cierre_hallazgos(hallazgos = hs))
  todo <- paste(vacia$texto, collapse = " | ")
  expect_false(grepl("Resumen ejecutivo|RESUMEN EJECUTIVO|Principales hallazgos", todo))
  expect_false("Antetitulo lamina" %in% vacia$nombre)                  # sin antetítulo, ni su cuadro
  expect_false("titulo:barra" %in% vacia$nombre)                       # la barra de acento no queda sola
  expect_identical(vacia$texto[vacia$nombre == "Titulo lamina"], "")   # el cuadro del título queda vacío (invisible)
  llena <- formas(escrita)
  expect_true(all(c("titulo:barra", "Antetitulo lamina") %in% llena$nombre))
  expect_identical(llena$texto[llena$nombre == "Titulo lamina"], "Tres claves")
  expect_identical(llena$texto[llena$nombre == "Antetitulo lamina"], "SÍNTESIS")
})

.ch_http <- function(sid, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_regla(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  crudo <- charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = "/api/graficos/resumenes/cifras", QUERY_STRING = "",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                             bodyRaw = crudo, postBody = body, CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: POST /api/graficos/resumenes/cifras devuelve las cifras con clave de un gráfico de resumen", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  src <- .ch_fuentes()
  xl <- function(i) {
    x <- tempfile(fileext = ".xlsx")
    openxlsx::write.xlsx(list(survey = i$survey[, c("type", "name", "label")], choices = i$choices[, c("list_name", "name", "label")]), x)
    suppressMessages(reporte_instrumento(x))
  }
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = "estudiantes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", list(docentes = xl(src$inst_sources$docentes), estudiantes = xl(src$inst_sources$estudiantes)))
  r <- .ch_http(sid, '{"graficador": "p_cobertura", "args": {"universos": "Docentes: 50; Estudiantes: 80"}}')
  expect_identical(r$status, 200L)
  expect_identical(r$body$tipo, "cobertura/1")
  claves <- vapply(r$body$cifras, `[[`, "", "clave")
  expect_identical(claves, c("casos:Docentes", "tasa:Docentes", "casos:Estudiantes", "tasa:Estudiantes"))
  expect_identical(r$body$cifras[[2]]$texto, "80%")
  expect_identical(names(r$body$cifras[[1]]), c("clave", "rotulo", "texto", "valor", "unidad"))
  r2 <- .ch_http(sid, '{"graficador": "p_barras_agrupadas", "args": {"var": "docentes$q1"}}')
  expect_identical(r2$status, 400L); expect_identical(r2$body$error$code %||% r2$body$code, "E_CIFRAS_INVALIDO")
  expect_true("E_CIFRAS_INVALIDO" %in% errores_registrados()$codigo)
})

test_that("sin hallazgos el cierre dibuja tres tarjetas vacías y avisa en la lámina, sin abortar el mazo", {
  skip_if_not_installed("officer")
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  plan <- c(.ch_origenes(), list(p_slide_cierre_hallazgos(hallazgos = list())))
  r <- .ch_correr(plan, path = out)
  expect_true("El cierre no tiene hallazgos." %in% r$avisos)
  expect_true(file.exists(out))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide4.xml"))
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_true("prosecnur:grafico:cierre_hallazgos" %in% nombres)
  expect_false(any(c("cierre:cifra", "cierre:texto", "cierre:aviso", "cierre:rotulo") %in% nombres))
  textos <- trimws(xml2::xml_text(xml2::xml_find_all(x, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:cierre_hallazgos']]//a:t")))
  expect_false(any(nzchar(textos)))
  # La especificación: tres tarjetas vacías, sin cifra ni frase.
  esp <- .espec_cierre_hallazgos(list())
  expect_length(esp$hallazgos, 3L)
  expect_true(all(vapply(esp$hallazgos, function(h) isTRUE(h$vacio) && is.null(h$cifra) && !nzchar(h$texto), TRUE)))
  # El rearmado desde el JSON del editor (vista previa recién insertada) no falla.
  s <- .rebuild_slide(list(tipo = "p_slide_cierre_hallazgos", payload = list(hallazgos = list())))
  expect_s3_class(s, "ppt_slide")
})
