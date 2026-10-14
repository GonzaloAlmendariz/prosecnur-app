# =============================================================================
# Contrato HTTP real — endpoints de F6.0b (íconos del recetario y opciones del documento Word).
# =============================================================================
#
# El verificador encontró por el wire lo que los tests in-process no veían: `wrap_endpoint` pasa los campos del body
# como argumentos con nombre, y dos handlers sin esos parámetros respondían 500 en su camino principal.

test_that("POST /iconos-recetario/elegir responde la elección con su motivo y rechaza un contexto desconocido", {
  srv <- http_contract_server()
  r <- http_post_json(srv, "/api/graficos/iconos-recetario/elegir",
                      body = list(contexto = "capitulo", textos = list("Perfil del encuestado", "Cuerpo académico")))
  expect_identical(r$status, 200L)
  expect_identical(r$json$elecciones[[1]]$icono, "users")
  expect_identical(r$json$elecciones[[2]]$icono, "presentation")
  expect_match(r$json$elecciones[[1]]$motivo, "«perfil»", fixed = TRUE)
  malo <- http_post_json(srv, "/api/graficos/iconos-recetario/elegir", body = list(contexto = "lamina", textos = list("x")))
  expect_identical(malo$status, 400L)
  expect_identical(malo$json$error$code %||% malo$json$code, "E_BAD_ICONO_CONTEXTO")
})

test_that("GET /iconos-recetario entrega cada color como lista aunque tenga un solo ícono", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/iconos-recetario?color=verde")
  expect_identical(r$status, 200L)
  expect_match(rawToChar(r$raw), '"verde":["', fixed = TRUE)
})

test_that("POST /word acepta opciones_documento en el body y rechaza una portada inválida con 400", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  plan <- list(slides = list(list(tipo = "p_slide_1_grafico",
                                  payload = list(titulo = "Región", grafico = list(graficador = "p_barras_agrupadas", args = list(var = "region"))))))
  malo <- http_post_json(srv, "/api/graficos/word", body = list(plan = plan, opciones_documento = list(portada = "D")), sid = base$sid)
  expect_identical(malo$status, 400L)
  expect_identical(malo$json$error$code %||% malo$json$code, "E_BAD_DOCUMENTO_WORD")
  bien <- http_post_json(srv, "/api/graficos/word", body = list(plan = plan, opciones_documento = list(portada = "C", titulo_corto = "Prueba")),
                         sid = base$sid)
  expect_identical(bien$status, 200L)
  expect_true(is.character(bien$json$job_id) && nzchar(bien$json$job_id))
})

test_that("GET /estandar entrega los 22 tipos de lámina con ranuras en pulgadas, colores y paletas (K1)", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/estandar")
  expect_identical(r$status, 200L)
  expect_length(r$json$tipos_lamina, 22L)
  t1 <- r$json$tipos_lamina[[1]]
  expect_identical(t1$id, "p_slide_1_grafico")
  expect_identical(t1$nombre, "Un gráfico")
  expect_true(nzchar(t1$uso))
  expect_identical(t1$ranuras[[1]]$rol, "grafico")
  expect_equal(t1$ranuras[[1]]$w, 12.523)
  expect_identical(r$json$colores$coral, "#CA5651")
  expect_identical(r$json$unidad, "in")
  expect_match(rawToChar(r$raw), '"ranuras":[{"rol":"grafico"', fixed = TRUE)   # arreglo aunque haya una sola ranura
})

test_that("GET /registry dice el tipo del estándar de cada lámina y null en las de estructura (K1)", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/registry")
  expect_identical(r$status, 200L)
  por <- setNames(r$json$slides, vapply(r$json$slides, `[[`, "", "name"))
  expect_identical(por$p_slide_3_graficos_poblacion_corona$estandar$nombre, .std_tipo_lamina("p_slide_3_graficos_poblacion_corona")$nombre)
  expect_null(por$p_slide_portada$estandar)
  expect_identical(lengths(regmatches(rawToChar(r$raw), gregexpr('"estandar":null', rawToChar(r$raw), fixed = TRUE))), 11L)
})

test_that("GET /registry publica familia del editor y salida de cada graficador, con las familias en orden (K4)", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/registry")
  expect_identical(r$status, 200L)
  expect_identical(vapply(r$json$familias_editor, `[[`, "", "id"),
                   c("categorias", "escalas", "numeros", "comparar", "dimensiones", "territorio", "texto"))
  g <- setNames(r$json$graficadores, vapply(r$json$graficadores, `[[`, "", "name"))
  expect_identical(g$p_nube_palabras$familia_editor, "texto")
  # c7ca26281 (G11): la nube sale nativa con su ranking; sin él cae a marco, y eso lo dice la condición.
  expect_true(isTRUE(g$p_nube_palabras$salida_nativa))
  expect_identical(g$p_nube_palabras$salida, "nativa")
  expect_true(nzchar(g$p_nube_palabras$salida_condicion))
  expect_false(g$p_dim_foda$salida_nativa)                                # la no nativa publica su motivo
  expect_identical(g$p_dim_foda$salida, "ruta_anterior")
  expect_true(nzchar(g$p_dim_foda$salida_motivo))
  expect_true(isTRUE(g$p_barras_apiladas$salida_nativa))
  expect_identical(g$p_barras_apiladas$salida_motivo, "")
  expect_false(g$p_dim_foda$en_selector)                                  # fuera del selector, pero sigue en el registro
  expect_true(g$p_barras_apiladas$en_selector)
})

test_that("POST /preview-slide numera la lámina con su lugar en el plan o con el folio que pide el cliente (K2)", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  graf <- list(graficador = "p_barras_agrupadas", args = list(var = "region"))
  plan <- list(slides = list(
    list(id = "s1", tipo = "p_slide_portada", payload = list(titulo = "Estudio")),
    list(id = "s2", tipo = "p_slide_seccion", payload = list(titulo = "Perfil")),
    list(id = "s3", tipo = "p_slide_1_grafico", payload = list(titulo = "Región", grafico = graf))
  ))
  lamina <- plan$slides[[3]]
  r <- http_post_json(srv, "/api/graficos/preview-slide", body = list(slide = lamina, config = list(plan = plan), include_images = FALSE),
                      sid = base$sid)
  expect_identical(r$status, 200L)
  expect_identical(r$json$folio, 3L)
  pedido <- http_post_json(srv, "/api/graficos/preview-slide",
                           body = list(slide = lamina, config = list(plan = plan), include_images = FALSE, folio = 14), sid = base$sid)
  expect_identical(pedido$status, 200L)
  expect_identical(pedido$json$folio, 14L)
  # El folio PINTADO en el mini-PPTX, no sólo el del JSON: sin el desplazamiento (`.preview_con_folio`) la lámina dice
  # «1» aunque el JSON diga 3 (M4); sin el folio en la llave de la caché, pedir 14 devolvía la imagen ya pintada con 3 (M3).
  pintado <- function(r) {
    dl <- http_get(srv, sprintf("/api/files/%s/download", r$json$file_id), sid = base$sid)
    f <- tempfile(fileext = ".pptx"); writeBin(dl$raw, f)
    n <- xml2::xml_find_first(xml2::read_xml(.pptx_leer_parte(f, .pptx_slide_paths(f)[[1]])),
                              "//p:sp[p:nvSpPr/p:cNvPr[@name='Folio lamina']]")
    if (inherits(n, "xml_missing")) NA_character_ else xml2::xml_text(n)
  }
  expect_identical(pintado(r), "3")
  expect_identical(pintado(pedido), "14")
  expect_false(identical(pedido$json$file_id, r$json$file_id))
  # La caché sí sirve el mismo folio: repetir el pedido de 14 devuelve el mismo archivo, pintado con 14.
  otra_vez <- http_post_json(srv, "/api/graficos/preview-slide",
                             body = list(slide = lamina, config = list(plan = plan), include_images = FALSE, folio = 14), sid = base$sid)
  expect_identical(otra_vez$json$file_id, pedido$json$file_id)
  expect_identical(pintado(otra_vez), "14")
})

test_that("GET /recetario/ejemplo entrega la lámina de ejemplo por tipo o página, y 404/400 con su código (K5)", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/recetario/ejemplo?tipo=p_slide_4_graficos")
  expect_identical(r$status, 200L)
  expect_identical(r$json$pagina, 162L)
  expect_identical(r$json$recetario$id, "recetario-moderna")
  expect_match(r$json$data_uri, "^data:image/webp;base64,")
  p <- http_get(srv, "/api/graficos/recetario/ejemplo?pagina=94")
  expect_identical(p$json$tipo, "p_dim_heatmap")
  no <- http_get(srv, "/api/graficos/recetario/ejemplo?tipo=p_dim_foda")
  expect_identical(no$status, 404L)
  expect_identical(no$json$error$code %||% no$json$code, "E_RECETARIO_EJEMPLO_NO_EXISTE")
  malo <- http_get(srv, "/api/graficos/recetario/ejemplo")
  expect_identical(malo$status, 400L)
  expect_identical(malo$json$error$code %||% malo$json$code, "E_BAD_RECETARIO_EJEMPLO")
  idx <- http_get(srv, "/api/graficos/recetario/ejemplos")
  expect_identical(idx$status, 200L)
  expect_length(idx$json$ejemplos, 44L)
})

test_that("POST /preview-slide con preview_formas entrega las formas de cada parte y las ranuras del estándar; sin él, nada cambia (K11)", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  lamina <- list(id = "s1", tipo = "p_slide_1_grafico",
                 payload = list(titulo = "Región", grafico = list(graficador = "p_barras_agrupadas", args = list(var = "region"))))
  cuerpo <- list(slide = lamina, config = list(plan = list(slides = list(lamina))), include_images = FALSE)
  sin <- http_post_json(srv, "/api/graficos/preview-slide", body = cuerpo, sid = base$sid)
  expect_identical(sin$status, 200L)
  expect_null(sin$json$ranuras_estandar)
  expect_null(sin$json$partes$partes[[1]]$formas)
  con <- http_post_json(srv, "/api/graficos/preview-slide", body = c(cuerpo, list(preview_formas = TRUE)), sid = base$sid)
  expect_identical(con$status, 200L)
  formas <- con$json$partes$partes[[1]]$formas
  expect_true(length(formas) > 3L)
  por <- setNames(formas, vapply(formas, `[[`, "", "nombre"))
  expect_identical(por[["Titulo lamina"]]$rol, "titulo")
  expect_true(is.numeric(por[["Titulo lamina"]]$x) && is.numeric(por[["Titulo lamina"]]$pt_max))
  expect_true(any(vapply(formas, function(f) identical(f$rol, "grafico"), logical(1))))
  expect_true(all(c("nombre", "rol", "x", "y", "w", "h", "pt_min", "pt_max", "lineas", "recortado", "grupo") %in% names(formas[[1]])))
  expect_identical(con$json$ranuras_estandar[[1]]$rol, "grafico")
  expect_match(rawToChar(con$raw), '"grupo":null', fixed = TRUE)                    # ausente es null, no {}
  malo <- http_post_json(srv, "/api/graficos/preview-slide", body = c(cuerpo, list(preview_formas = "si")), sid = base$sid)
  expect_identical(malo$status, 400L)
  expect_identical(malo$json$error$code %||% malo$json$code, "E_BAD_PREVIEW_FORMAS")
})

test_that("POST /preview-slide lleva la etiqueta corta de args.overrides.etiquetas_vars a la lámina nativa (K12a)", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  texto_lamina <- function(etiquetas) {
    args <- list(var = "claridad")
    if (!is.null(etiquetas)) args$overrides <- list(etiquetas_vars = etiquetas)
    lamina <- list(id = "s1", tipo = "p_slide_1_grafico",
                   payload = list(titulo = "Claridad", grafico = list(graficador = "p_barras_apiladas", args = args)))
    r <- http_post_json(srv, "/api/graficos/preview-slide", body = list(slide = lamina, include_images = FALSE), sid = base$sid)
    expect_identical(r$status, 200L)
    expect_identical(r$json$partes$partes[[1]]$estado, "nativa")
    dl <- http_get(srv, sprintf("/api/files/%s/download", r$json$file_id), sid = base$sid)
    f <- tempfile(fileext = ".pptx"); writeBin(dl$raw, f)
    xml <- xml2::read_xml(.pptx_leer_parte(f, .pptx_slide_paths(f)[[1]]))
    paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " | ")
  }
  sin <- texto_lamina(NULL)
  expect_match(sin, "Claridad de la informacion", fixed = TRUE)
  con <- texto_lamina(list(claridad = "Información clara"))
  expect_match(con, "Información clara", fixed = TRUE)
  expect_false(grepl("Claridad de la informacion", con, fixed = TRUE))
})

test_that("GET /categorias entrega código, etiqueta y frecuencia, con sus E_*; /preview-slide respeta orden_categorias (D8)", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  r <- http_get(srv, "/api/graficos/categorias?var=region", sid = base$sid)
  expect_identical(r$status, 200L)
  expect_identical(vapply(r$json$categorias, `[[`, "", "codigo"), c("norte", "sur"))
  expect_identical(vapply(r$json$categorias, `[[`, "", "etiqueta"), c("Norte", "Sur"))
  expect_identical(vapply(r$json$categorias, function(x) as.integer(x$n), 0L), c(4L, 4L))
  expect_identical(r$json$modo_recetario, "instrumento")                     # dos categorías
  expect_identical(unlist(r$json$orden$instrumento), c("norte", "sur"))
  expect_match(rawToChar(r$raw), '"recetario":["', fixed = TRUE)            # arreglo aunque tenga pocas
  sin <- http_get(srv, "/api/graficos/categorias", sid = base$sid)
  expect_identical(sin$status, 400L); expect_identical(sin$json$error$code %||% sin$json$code, "E_BAD_CATEGORIAS_VAR")
  no <- http_get(srv, "/api/graficos/categorias?var=nadie", sid = base$sid)
  expect_identical(no$status, 404L); expect_identical(no$json$error$code %||% no$json$code, "E_CATEGORIAS_VAR_NO_EXISTE")
  num <- http_get(srv, "/api/graficos/categorias?var=edad", sid = base$sid)
  expect_identical(num$status, 409L); expect_identical(num$json$error$code %||% num$json$code, "E_CATEGORIAS_SIN_LISTA")

  rotulos <- function(oc) {
    args <- list(var = "region"); if (!is.null(oc)) args$orden_categorias <- oc
    lamina <- list(id = "s1", tipo = "p_slide_1_grafico", payload = list(titulo = "Región", grafico = list(graficador = "p_barras_categoricas", args = args)))
    p <- http_post_json(srv, "/api/graficos/preview-slide", body = list(slide = lamina, include_images = FALSE), sid = base$sid)
    expect_identical(p$status, 200L)
    dl <- http_get(srv, sprintf("/api/files/%s/download", p$json$file_id), sid = base$sid)
    f <- tempfile(fileext = ".pptx"); writeBin(dl$raw, f)
    xml <- xml2::read_xml(.pptx_leer_parte(f, .pptx_slide_paths(f)[[1]]))
    # Dos categorías: la lámina sale como dicotomía y sus rótulos se llaman `dicotomia:rotulo` («Norte (4)»).
    t <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='rotulo' or @name='dicotomia:rotulo']]"))
    trimws(sub("\\s*\\(.*$", "", t))
  }
  expect_identical(rotulos(NULL), c("Norte", "Sur"))
  expect_identical(rotulos(list(modo = "personalizado", lista = list("sur", "norte"))), c("Sur", "Norte"))
})
