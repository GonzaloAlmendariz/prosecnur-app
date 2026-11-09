source("setup-load-all.R")

# ADR 0140: cobertura por categorías de una variable frente al universo. Denominador = respuestas válidas (sin NA ni
# vacío ni 90, 94, 98, 99), sin ponderar, una fila de categorías por base alineada por código, % del universo derivado
# de lo tecleado, avisos sin renormalizar, precisión completa y ningún juicio inventado.

.cc_inst <- function() list(
  survey = data.frame(name = c("ciclo", "sexo"), type = c("select_one ci", "select_one sx"), list_name = c("ci", "sx"),
                      label = c("Ciclo", "Sexo"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("ci", "ci", "ci", "ci", "ci", "ci", "sx", "sx"),
                       name = c("1", "2", "3", "4", "98", "99", "1", "2"),
                       label = c("Primer ciclo", "Segundo ciclo", "Tercer ciclo", "Cuarto ciclo", "No sabe", "No responde",
                                 "Mujer", "Hombre"), stringsAsFactors = FALSE),
  orders_list = NULL)
.cc_base <- function(ciclo, sexo = rep(c("1", "2"), length.out = length(ciclo))) {
  data.frame(ciclo = ciclo, sexo = sexo, stringsAsFactors = FALSE)
}
# Estudiantes: 50 en 1, 30 en 2, 15 en 3, 0 en 4, más 3 "No sabe", 2 "No responde" y 2 NA (102 filas, 95 válidas).
.cc_fuentes <- function() list(
  data_sources = list(
    estudiantes = .cc_base(c(rep("1", 50), rep("2", 30), rep("3", 15), rep("98", 3), rep("99", 2), NA, NA)),
    docentes = .cc_base(c(rep("1", 40), rep("2", 20)))),
  inst_sources = list(estudiantes = .cc_inst(), docentes = .cc_inst()))
.cc_univ <- function(...) list(estudiantes = list(modo = "porcentajes", categorias = list(
  list(codigo = "1", etiqueta = "Primer ciclo", valor = 45), list(codigo = "2", etiqueta = "Segundo ciclo", valor = 30),
  list(codigo = "4", etiqueta = "Cuarto ciclo", valor = 25))), ...)
.cc_espec <- function(..., src = .cc_fuentes()) suppressWarnings(.cobcat_desde_fuentes(src$data_sources, src$inst_sources, ...))
.cc_fila <- function(e, base, codigo) { b <- Filter(function(x) identical(x$base, base), e$bloques)[[1]]; b$filas[b$filas$codigo == codigo, ] }

test_that("denominador: respuestas válidas sin especiales ni NA; los especiales van en la nota sobre todos los encuestados", {
  e <- .cc_espec("ciclo", bases = "estudiantes", universo = .cc_univ())
  b <- e$bloques[[1]]
  expect_identical(b$n_validos, 95L); expect_identical(b$n_encuestados, 102L)
  expect_equal(.cc_fila(e, "estudiantes", "1")$pct_muestra, 100 * 50 / 95)
  expect_false(any(b$filas$codigo %in% c("98", "99")))
  expect_identical(b$especiales$etiqueta, c("No sabe", "No responde"))
  expect_true(any(grepl("Fuera de las barras: No sabe 3 (2.9%), No responde 2 (2.0%) de 102 encuestados", e$notas_pie, fixed = TRUE)))
})

test_that("caso 1, base vacía: sin casos tras el filtro, no hay % de la muestra y se avisa; el universo se dibuja", {
  src <- .cc_fuentes(); src$data_sources$estudiantes$sexo <- "1"
  e <- .cobcat_desde_fuentes(src$data_sources, src$inst_sources, "ciclo", bases = "estudiantes", universo = .cc_univ(),
                             filtros = list(sexo = "2"))
  expect_true(any(grepl("la base queda sin casos", e$avisos, fixed = TRUE)))
  f <- e$bloques[[1]]$filas
  expect_identical(e$bloques[[1]]$n_validos, 0L)
  expect_true(all(is.na(f$pct_muestra))); expect_true(all(f$texto_muestra == "sin casos"))
  expect_equal(f$pct_universo[f$codigo == "1"], 45)
  expect_true(all(is.na(f$diferencia)))
})

test_that("caso 2, sólo especiales: denominador cero sin NaN, la nota lleva los especiales con su %", {
  src <- .cc_fuentes(); src$data_sources$estudiantes <- .cc_base(c(rep("98", 4), rep("99", 6)))
  e <- .cc_espec("ciclo", bases = "estudiantes", universo = .cc_univ(), src = src)
  expect_identical(e$bloques[[1]]$n_validos, 0L)
  expect_false(any(is.nan(e$bloques[[1]]$filas$pct_muestra)))
  expect_true(any(grepl("sólo valores especiales", e$avisos, fixed = TRUE)))
  expect_true(any(grepl("No sabe 4 (40.0%), No responde 6 (60.0%) de 10 encuestados", e$notas_pie, fixed = TRUE)))
})

test_that("caso 3, n = 0 va con 0% y diferencia negativa; la que falta en el universo sale 'sin dato' con aviso", {
  e <- .cc_espec("ciclo", bases = "estudiantes", universo = .cc_univ())
  f4 <- .cc_fila(e, "estudiantes", "4")
  expect_identical(f4$n, 0L); expect_equal(f4$pct_muestra, 0); expect_equal(f4$diferencia, -25)
  expect_identical(f4$texto_muestra, "0.0%"); expect_identical(f4$texto_diferencia, "-25.0")
  f3 <- .cc_fila(e, "estudiantes", "3")
  expect_identical(f3$estado, "sin_dato"); expect_true(is.na(f3$diferencia)); expect_identical(f3$texto_universo, "sin dato")
  expect_identical(f3$texto_diferencia, "")
  expect_true(any(grepl("no trae Tercer ciclo: sale \"sin dato\"", e$avisos, fixed = TRUE)))
})

test_that("caso 4, porcentajes que no suman 100: se avisa y se dibujan como se teclearon, sin reescalar", {
  u <- .cc_univ(); u$estudiantes$categorias[[3]]$valor <- 15   # 45 + 30 + 15 = 90
  e <- .cc_espec("ciclo", bases = "estudiantes", universo = u)
  expect_true(any(grepl("suman 90.0%, fuera de 99.5 a 100.5", e$avisos, fixed = TRUE)))
  expect_equal(.cc_fila(e, "estudiantes", "1")$pct_universo, 45)
  # Dentro de la tolerancia de suma no hay aviso.
  u$estudiantes$categorias[[3]]$valor <- 25.4
  expect_false(any(grepl("suman", .cc_espec("ciclo", bases = "estudiantes", universo = u)$avisos)))
})

test_that("caso 5, total distinto de la suma de los conteos: se avisa y se usa la suma", {
  u <- list(docentes = list(modo = "conteos", total = 1000, categorias = list(list(codigo = "1", valor = 600), list(codigo = "2", valor = 300))))
  e <- .cc_espec("ciclo", bases = "docentes", universo = u)
  expect_true(any(grepl("El total del universo de Docentes (1,000) no coincide con la suma de sus categorías (900): se usa la suma.", e$avisos, fixed = TRUE)))
  expect_equal(.cc_fila(e, "docentes", "1")$pct_universo, 100 * 600 / 900)
})

test_that("caso 6, universo en cero: no hay denominador, no se dibuja su barra y se avisa", {
  u <- list(docentes = list(modo = "conteos", total = 0, categorias = list(list(codigo = "1", valor = 0), list(codigo = "2", valor = 0))))
  e <- .cc_espec("ciclo", bases = "docentes", universo = u)
  expect_true(e$bloques[[1]]$sin_universo)
  expect_true(all(is.na(e$bloques[[1]]$filas$pct_universo)))
  expect_true(any(grepl("no trae cifras", e$avisos, fixed = TRUE)))
})

test_that("caso 7, varias bases con categorías distintas: un bloque por base, cada una contra su universo, alineadas por código", {
  u <- .cc_univ(docentes = list(modo = "conteos", categorias = list(list(codigo = "1.0", valor = 70), list(codigo = "2", valor = 30))))
  e <- .cc_espec("ciclo", bases = c("docentes", "estudiantes"), universo = u)
  expect_identical(vapply(e$bloques, `[[`, "", "base"), c("docentes", "estudiantes"))
  d <- e$bloques[[1]]$filas
  expect_identical(d$codigo, c("1", "2"))   # "1.0" del universo es la categoría 1
  expect_equal(d$pct_universo, c(70, 30)); expect_equal(d$pct_muestra, c(100 * 40 / 60, 100 * 20 / 60))
  expect_identical(e$bloques[[2]]$filas$codigo, c("1", "2", "3", "4"))
  expect_true(any(grepl("Base: respuestas válidas, Docentes 60 y Estudiantes 95", e$notas_pie, fixed = TRUE)))
})

test_that("caso 8, recodificada: se usa la `_recod`, se guarda cuál y se avisa si el universo no calza", {
  src <- .cc_fuentes()
  src$data_sources$estudiantes$ciclo_recod <- ifelse(src$data_sources$estudiantes$ciclo %in% c("1", "2"), "1",
                                                     ifelse(src$data_sources$estudiantes$ciclo == "3", "2", src$data_sources$estudiantes$ciclo))
  e <- .cc_espec("ciclo", bases = "estudiantes", universo = .cc_univ(), src = src)
  b <- e$bloques[[1]]
  expect_identical(b$variable_usada, "ciclo_recod"); expect_true(b$recodificada)
  expect_identical(b$filas$codigo[b$filas$n > 0], c("1", "2"))
  expect_true(any(grepl("trae categorías que \"ciclo_recod\" no tiene (4)", e$avisos, fixed = TRUE)))
  # Universo tecleado para otra variable: universo viejo, se avisa.
  u <- .cc_univ(); u$estudiantes$variable <- "edad"
  expect_true(any(grepl("se tecleó para \"edad\"", .cc_espec("ciclo", bases = "estudiantes", universo = u, src = src)$avisos, fixed = TRUE)))
})

test_that("caso 9, filtro activo: cuenta tras el filtro y la lámina lo dice, porque el universo es del total", {
  e <- .cc_espec("ciclo", bases = "docentes", universo = NULL, filtros = list(sexo = "1"))
  expect_identical(e$bloques[[1]]$n_validos, 30L)
  expect_true("Filtro: Sexo = Mujer (el universo es del total)" %in% e$notas_pie)
})

test_that("caso 10, sin universo: no hay barra del universo, la leyenda sólo dice Muestra y la lámina lo dice", {
  e <- .cc_espec("ciclo", bases = "docentes")
  expect_true(e$bloques[[1]]$sin_universo); expect_false(e$hay_universo)
  expect_identical(unname(e$leyenda), "Muestra")
  expect_true(any(grepl("Sin universo para Docentes: no se dibuja su barra", e$notas_pie, fixed = TRUE)))
  expect_true(all(e$bloques[[1]]$filas$texto_diferencia == ""))
})

test_that("precisión completa: la diferencia sale de los valores sin redondear; n chico visible con aviso; sin juicio", {
  e <- .cc_espec("ciclo", bases = "estudiantes", universo = .cc_univ())
  f1 <- .cc_fila(e, "estudiantes", "1")
  expect_equal(f1$diferencia, 100 * 50 / 95 - 45)   # 7.631...
  expect_identical(f1$texto_diferencia, "+7.6")
  expect_identical(.cc_fila(e, "estudiantes", "3")$texto_n, "n = 15")
  expect_true(any(grepl("Tercer ciclo (n = 15)", e$avisos, fixed = TRUE)))
  expect_true(any(grepl("Con menos de 30 casos, lectura referencial", e$notas_pie, fixed = TRUE)))
  todo <- paste(c(e$notas_pie, e$avisos), collapse = " ")
  expect_false(grepl("respeta", todo, ignore.case = TRUE)); expect_false(grepl("cuota", todo, ignore.case = TRUE))
})

test_that("tolerancia sólo si el analista la teclea; con pesos la lámina dice 'Sin ponderar' y no pondera", {
  e <- .cc_espec("ciclo", bases = "estudiantes", universo = .cc_univ())
  expect_false(any(grepl("±", e$notas_pie, fixed = TRUE)))
  e2 <- .cc_espec("ciclo", bases = "estudiantes", universo = .cc_univ(), tolerancia = 8)
  expect_true("Dentro de ±8 pts fijado por el analista: 2 de 3 categorías" %in% e2$notas_pie)
  src <- .cc_fuentes(); src$data_sources$docentes$peso <- c(rep(3, 40), rep(1, 20))
  e3 <- .cc_espec("ciclo", bases = "docentes", src = src)
  expect_true("Sin ponderar" %in% e3$notas_pie)
  expect_equal(e3$bloques[[1]]$filas$pct_muestra, c(100 * 40 / 60, 100 * 20 / 60))
})

test_that("los args se validan con códigos registrados", {
  err <- function(expr) tryCatch({ expr; NULL }, api_error = function(e) e$code)
  expect_identical(err(p_cobertura(modo = "otro")), "E_COBERTURA_CAT_MODO")
  expect_identical(err(p_cobertura(modo = "categorias", variable = c("a", "b"))), "E_COBERTURA_CAT_VARIABLE")
  expect_identical(err(p_cobertura(modo = "categorias", variable = "ciclo", tolerancia_pts = -1)), "E_COBERTURA_CAT_TOLERANCIA")
  expect_identical(err(p_cobertura(modo = "categorias", variable = "ciclo", universo_categorias = list(list(modo = "conteos")))), "E_COBERTURA_CAT_UNIVERSO")
  expect_identical(err(p_cobertura(modo = "categorias", variable = "ciclo", universo_categorias = list(d = list(modo = "x")))), "E_COBERTURA_CAT_UNIVERSO")
  expect_identical(err(p_cobertura(modo = "categorias", variable = "ciclo", universo_categorias = list(d = list(modo = "porcentajes",
    categorias = list(list(codigo = "1", valor = 120)))))), "E_COBERTURA_CAT_UNIVERSO")
  expect_identical(err(p_cobertura(modo = "categorias", variable = "ciclo", universo_categorias = list(d = list(modo = "conteos",
    categorias = list(list(codigo = "1", valor = 1), list(codigo = "1", valor = 2)))))), "E_COBERTURA_CAT_UNIVERSO")
  src <- .cc_fuentes()
  expect_identical(err(.cobcat_desde_fuentes(src$data_sources, src$inst_sources, "ciclo", bases = "egresados")), "E_COBERTURA_CAT_BASE")
  expect_identical(err(.cobcat_desde_fuentes(src$data_sources, src$inst_sources, "nada", bases = "docentes")), "E_COBERTURA_CAT_VARIABLE")
  # Lo tecleado se guarda tal cual en el elemento (un valor vacío queda NA, sin dato).
  el <- p_cobertura(modo = "categorias", variable = "estudiantes$ciclo", universo_categorias = .cc_univ(), tolerancia_pts = 2)
  expect_identical(el$variable, "ciclo"); expect_identical(el$tolerancia_pts, 2)
  expect_identical(el$universo_categorias$estudiantes$modo, "porcentajes")
  expect_identical(vapply(el$universo_categorias$estudiantes$categorias, `[[`, 0, "valor"), c(45, 30, 25))
  # La versión de siempre no cambia.
  expect_null(p_cobertura()$modo)
})

test_that("la variante, la versión base y los args del registro", {
  v <- Filter(function(x) identical(x$id, "p_cobertura:categorias"), .graficos_variantes())[[1]]
  expect_identical(v$nombre_version, "Por categorías de una variable")
  expect_identical(v$args_fijos, list(modo = "categorias"))
  expect_identical(.GRAFICADORES_META$p_cobertura$version_base, "Por públicos")
  expect_identical(.graficos_variante_de("p_cobertura", list(modo = "categorias")), "p_cobertura:categorias")
  expect_true(is.na(.graficos_variante_de("p_cobertura", list(universos = "Docentes: 10"))))
  args <- vapply(.GRAFICADORES_META$p_cobertura$args, `[[`, "", "name")
  expect_true(all(c("modo", "variable", "universo_categorias", "tolerancia_pts") %in% args))
  expect_true(all(args %in% names(formals(p_cobertura))))
  src <- paste(readLines(test_path("..", "..", "R", "plumber_app.R"), warn = FALSE), collapse = "\n")
  expect_match(src, "mount_graficos_cobertura_categorias(pr)", fixed = TRUE)
})

.cc_http_post <- function(sid, path, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_cobertura_categorias(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  raw_body <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = path, QUERY_STRING = "", HTTP_X_PULSO_SESSION = sid,
                             HEADERS = c(`x-pulso-session` = sid, `content-type` = "application/json"),
                             CONTENT_TYPE = "application/json", HTTP_CONTENT_TYPE = "application/json",
                             rook.input = list(read = function(...) raw_body, rewind = function() invisible(0),
                                               read_lines = function(...) rawToChar(raw_body))))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: POST /api/graficos/resumenes/cobertura-categorias devuelve las categorías de cada base para prellenar", {
  src <- .cc_fuentes()
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(estudiantes = list(nombre = "estudiantes"), docentes = list(nombre = "docentes")),
                                   active_base = "docentes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", src$inst_sources)
  r <- .cc_http_post(sid, "/api/graficos/resumenes/cobertura-categorias", list(variable = "ciclo", bases = list("estudiantes", "docentes")))
  expect_identical(r$status, 200L)
  expect_identical(r$body$variable, "ciclo")
  est <- r$body$bases[[1]]
  expect_identical(est$base, "estudiantes"); expect_identical(est$n_validos, 95L); expect_identical(est$n_encuestados, 102L)
  expect_identical(vapply(est$categorias, `[[`, "", "codigo"), c("1", "2", "3", "4"))
  expect_identical(est$categorias[[4]]$n, 0L); expect_identical(est$categorias[[1]]$etiqueta, "Primer ciclo")
  expect_identical(vapply(est$especiales, `[[`, "", "codigo"), c("98", "99"))
  r2 <- .cc_http_post(sid, "/api/graficos/resumenes/cobertura-categorias", list(bases = list("docentes")))
  expect_identical(r2$status, 400L); expect_identical(r2$body$error$code %||% r2$body$code, "E_COBERTURA_CAT_VARIABLE")
})

# ---- Render nativo -------------------------------------------------------------------------------------------------

.cc_grafico <- function(...) list(graficador = "p_cobertura", args = list(modo = "categorias", variable = "ciclo", ...))
.cc_render <- function(slide_raw, src = .cc_fuentes()) {
  .LAM_RR_PIE$notas <- NULL
  .lam_avisos_soltar(.lam_avisos_estado$token)
  plan <- .normalize_plan(list(slides = list(slide_raw)), avisar = FALSE)
  out <- withr::local_tempfile(fileext = ".pptx", .local_envir = parent.frame())
  suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                    plan = p_plan(slides = list(.rebuild_slide(plan$slides[[1]]))), path_ppt = out, mensajes_progreso = FALSE))
  list(path = out, xml = .pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
}
.cc_textos <- function(xml) paste(gsub("</?a:t>", "", regmatches(xml, gregexpr("<a:t>[^<]*</a:t>", xml))[[1]]), collapse = " | ")
.cc_nombres <- function(xml) regmatches(xml, gregexpr('name="cobertura:[a-z_]+"', xml))[[1]]

test_that("render: a página entera sale nativo, con barras de muestra y universo, cifras en %, diferencia y n", {
  skip_if_not_installed("officer")
  g <- .cc_grafico(bases = list("estudiantes", "docentes"),
                   universo_categorias = .cc_univ(docentes = list(modo = "conteos", total = 100, categorias = list(
                     list(codigo = "1", valor = 70), list(codigo = "2", valor = 30)))))
  r <- .cc_render(list(id = "s1", tipo = "p_slide_1_grafico", payload = list(titulo = "Ciclo frente al universo", grafico = g)))
  xml <- r$xml; tx <- .cc_textos(xml); nm <- .cc_nombres(xml)
  expect_identical(.pptx_lamina_estado(xml), "nativa")
  expect_true(grepl('name="prosecnur:grafico:cobertura"', xml, fixed = TRUE))
  expect_false(grepl("<p:pic>", xml, fixed = TRUE))
  # Con las barras al grosor de la casa no caben las seis filas de las dos bases: va Estudiantes ENTERA y Docentes, a otra
  # lámina (las categorías de una base suman el 100 %: nunca una parte de una base).
  expect_identical(sum(nm == 'name="cobertura:barra_muestra"'), 3L)   # 1, 2, 3 de estudiantes (4 tiene n = 0)
  expect_identical(sum(nm == 'name="cobertura:barra_universo"'), 3L)  # 1, 2, 4 de estudiantes
  expect_true(grepl("Por espacio, se muestra Estudiantes; Docentes no cabe en esta lámina", tx, fixed = TRUE))
  expect_identical(sum(nm == 'name="cobertura:publico"'), 1L)   # Docentes no cabe en esta lámina
  for (t in c("Muestra", "Universo", "Diferencia (pts)", "Estudiantes", "Docentes", "95 respuestas válidas", "Primer ciclo",
              "n = 50", "52.6%", "45.0%", "+7.6", "-25.0", "0.0%", "sin dato", "Base: Estudiantes 95 respuestas válidas",   # sólo de la base que se ve
              "Universo: cifras ingresadas por el analista")) {
    expect_true(grepl(t, tx, fixed = TRUE), label = t)
  }
  expect_false(grepl("respeta", tx, ignore.case = TRUE))
  fuera <- Filter(function(f) f$x < -0.01 || f$y < -0.01 || f$x + f$w > 13.34 || f$y + f$h > 7.51, .verif_formas(xml))
  expect_length(fuera, 0L)
  # Contrato del artefacto: el .pptx se registra con file_id y tamaño.
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  meta <- .register_output_file(sid, "graficos_ppt", r$path, original_name = "cobertura.pptx", copiar = FALSE, marca_dirty = FALSE)
  expect_true(nzchar(meta$file_id)); expect_identical(meta$size, as.integer(file.info(r$path)$size)); expect_gt(meta$size, 0L)
  expect_identical(session_get(sid)$files[[meta$file_id]]$path, r$path)
})

test_that("render: en las láminas de dos y de cuatro gráficos va nativo en la ranura, con sus notas al pie", {
  skip_if_not_installed("officer")
  g <- .cc_grafico(bases = list("docentes"), universo_categorias = list(docentes = list(modo = "porcentajes", categorias = list(
    list(codigo = "1", valor = 60), list(codigo = "2", valor = 40)))))
  for (k in c(2L, 4L)) {
    slide <- if (k == 2L) list(id = "s2", tipo = "p_slide_2_graficos", payload = list(titulo = "Dos", izquierda = g, derecha = g))
             else list(id = "s4", tipo = "p_slide_4_graficos", payload = list(titulo = "Cuatro", superior_izquierda = g, superior_derecha = g,
                                                                            inferior_izquierda = g, inferior_derecha = g))
    xml <- .cc_render(slide)$xml; tx <- .cc_textos(xml); nm <- .cc_nombres(xml)
    expect_identical(.pptx_lamina_estado(xml), "nativa", label = paste(k))
    expect_false(grepl('name="mixta:respaldo"', xml, fixed = TRUE), label = paste(k))
    expect_false(grepl("<p:pic>", xml, fixed = TRUE))
    expect_identical(sum(nm == 'name="cobertura:barra_muestra"'), 2L * k)
    expect_identical(sum(nm == 'name="cobertura:barra_universo"'), 2L * k)
    expect_true(grepl("+6.7", tx, fixed = TRUE), label = paste(k))
    expect_true(grepl("Base: Docentes 60 respuestas válidas", tx, fixed = TRUE), label = paste(k))
    fuera <- Filter(function(f) f$x < -0.01 || f$y < -0.01 || f$x + f$w > 13.34 || f$y + f$h > 7.51, .verif_formas(xml))
    expect_length(fuera, 0L)
  }
})

test_that("render: con más categorías de las que caben va el dibujo de respaldo con la misma especificación", {
  skip_if_not_installed("ggplot2")
  src <- .cc_fuentes()
  src$data_sources$docentes$ciclo <- as.character(rep(1:16, length.out = 60))
  e <- .cc_espec("ciclo", bases = "docentes", src = src)
  expect_false(.lam_cobertura_cabe(e))
  p <- .graficar_cobertura_categorias(e)
  expect_s3_class(p, "ggplot"); expect_identical(attr(p, "pulso_espec")$version, "cobertura_categorias/1")
  expect_true(.lam_cobertura_cabe(.cc_espec("ciclo", bases = "docentes")))
})

test_that("la columna de la diferencia queda dentro de su rectángulo, con aire a la derecha (vista previa recortada, 2026-11-09)", {
  e <- .cc_espec("ciclo", bases = "estudiantes", universo = .cc_univ())
  for (esc in c("pagina", "ranura")) {
    ge <- .lam_cobcat_geo(e, 0.495, 1.75, if (esc == "pagina") 12.523 else 6.0, 4.6, esc)
    expect_true(ge$cabe)
    expect_lte(ge$xd + ge$wd, 0.495 + (if (esc == "pagina") 12.523 else 6.0) - .COBCAT_AIRE_DER + 1e-9)
    expect_gte(ge$xd, ge$xb + ge$wb)                                   # no pisa las barras ni sus cifras
  }
})

test_that("las barras llevan el grosor de la casa; si no caben, van bases enteras y nunca una parte de una base", {
  e <- .cc_espec("ciclo", bases = c("estudiantes", "docentes"), universo = .cc_univ())
  n <- vapply(e$bloques, function(b) NROW(b$filas), 0L)
  holgada <- .lam_cobcat_geo(e, 0.5, 2, 6.0, 5.0, "ranura")
  expect_true(holgada$cabe); expect_identical(holgada$visibles, n); expect_length(holgada$omitidos, 0L)
  expect_gte(holgada$g, .std_piso_panel_in() - 1e-9)
  justa <- .lam_cobcat_geo(e, 0.5, 2, 6.0, 3.2, "ranura")                    # caben las filas de una sola base
  expect_true(justa$cabe)
  expect_gte(justa$g, .std_piso_panel_in() - 1e-9)                           # nunca más delgadas
  # Cada base va entera o no va.
  expect_true(all(justa$visibles == 0L | justa$visibles == n))
  expect_identical(justa$visibles, c(n[1], 0L)); expect_identical(justa$omitidos, e$bloques[[2]]$publico)
  for (h in seq(1.5, 5, by = 0.1)) {
    ge <- .lam_cobcat_geo(e, 0.5, 2, 6.0, h, "ranura")
    if (isTRUE(ge$cabe)) expect_true(all(ge$visibles == 0L | ge$visibles == n), label = paste("alto", h))
  }
  expect_false(.lam_cobcat_geo(e, 0.5, 2, 6.0, 1.6, "ranura")$cabe)          # ni una base entera: va dibujada
  .LAM_RR_PIE$notas <- NULL
  expect_message(.lam_rr_dibujar(.lam_lienzo(), e, .lam_rr_geo(e, 0.5, 2, 6.0, 3.2)), "Docentes no cabe en esta lámina")
  # Al pie, la base; la nota del recorte, al analista (lamina_pie_resumen.R).
  expect_message(p <- .lam_rr_pie_menos_filas("Base: 95"), "Por espacio, se muestra Estudiantes; Docentes no cabe en esta lámina", fixed = TRUE)
  expect_identical(p, "Base: 95")
})

test_that("las notas del pie son sólo de las bases que se ven y el dibujo de respaldo sigue las reglas de la nativa (2026-11-09)", {
  e <- .cc_espec("ciclo", bases = c("estudiantes", "docentes"), universo = .cc_univ(), tolerancia = 5)
  r <- .cobcat_reducir(e, 1L)
  expect_length(r$bloques, 1L); expect_true(isTRUE(r$varias_bases))
  expect_true(any(r$notas_pie == "Base: Estudiantes 95 respuestas válidas"))
  expect_false(any(grepl("Docentes 60", r$notas_pie, fixed = TRUE)))
  tol <- grep("^Dentro de", r$notas_pie, value = TRUE)
  d <- r$bloques[[1]]$filas$dentro; expect_identical(tol, sprintf("Dentro de ±5 pts fijado por el analista: %d de %d categorías", sum(d, na.rm = TRUE), sum(!is.na(d))))
  expect_true(any(r$notas_pie == "Por espacio, se muestra Estudiantes; Docentes no cabe en esta lámina"))
  # Respaldo: una cabecera por base (con dos bases, nunca dos rótulos iguales sin su público) y la barra al grosor de la casa.
  p <- .graficar_cobertura_categorias(e, alto = 5.5)
  b <- ggplot2::ggplot_build(p)
  textos <- unlist(lapply(b$data, function(d) d$label))
  expect_true(all(c("Estudiantes  95 respuestas válidas", "Docentes  60 respuestas válidas") %in% textos))
  g <- suppressWarnings(ggplot2::ggplotGrob(p)); hs <- g$heights
  panel <- 5.5 - as.numeric(grid::convertHeight(sum(hs[grid::unitType(hs) != "null"]), "in", valueOnly = TRUE))
  lim <- b$layout$panel_params[[1]]$y.range
  tiles <- b$data[[1]]; grosor <- unique(round((tiles$ymax - tiles$ymin) * panel / diff(lim), 3))
  expect_true(all(grosor >= .std_piso_panel_in() - 0.005))
  expect_identical(attr(p, "note_outside"), .lam_con_punto(do.call(.lam_unir_base, as.list(e$notas_pie))))
  expect_null(p$labels$caption)
})
