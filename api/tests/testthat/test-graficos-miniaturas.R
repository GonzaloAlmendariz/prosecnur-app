# Huella y caché de la vista previa de lámina (graficos_miniaturas*.R). Contrato:
# docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md. La llave es la huella de TODO lo que el render lee, en seis grupos
# (a)–(f): cambiar uno de cada grupo cambia la huella; reordenar claves sólo no la cambia en la lista blanca
# conmutativa (familias de presets, íconos), nunca en la lámina. La caché no cambia el render: lo servido desde
# caché es byte a byte lo recién renderizado.

.mt_fuentes <- function(etiqueta_norte = "Norte", peso = 1) {
  df <- data.frame(region = rep(c("norte", "sur"), c(6, 4)), peso = peso, stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = "region", type = "select_one l_region", list_name = "l_region", label = "Región",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "l_region", name = c("norte", "sur"), label = c(etiqueta_norte, "Sur"),
                         stringsAsFactors = FALSE),
    orders_list = list(region = list(names = c("norte", "sur"), labels = c(etiqueta_norte, "Sur")))
  )
  list(df = df, inst = inst)
}

.mt_slide <- function(titulo = "Región", var = "region") {
  list(id = "s1", tipo = "p_slide_1_grafico",
       payload = list(titulo = titulo, grafico = list(graficador = "p_barras_categoricas", args = list(var = var))))
}

.mt_ctx <- function(slide = .mt_slide(), fuentes = .mt_fuentes(), ...) {
  .mini_contexto(slide, data_sources = list(principal = fuentes$df), inst_sources = list(principal = fuentes$inst),
                 template_pptx = .graficos_resolve_template_pptx(), ...)
}

.mt_opts <- function(render = TRUE) list(preview_quality = "quick", render_slide_preview = render, preview_partes = FALSE)

.mt_texto_pptx <- function(pptx) {
  xml <- xml2::read_xml(.pptx_leer_parte(pptx, .pptx_slide_paths(pptx)[[1]]))
  paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " | ")
}

# El raster depende de LibreOffice en el entorno (en algunos linux R hereda un LD_LIBRARY_PATH con el que soffice.bin no
# carga): los tests de PNG se saltan si el renderer no rasteriza, los de PPTX y huella no.
.mt_raster_disponible <- local({
  cache <- NULL
  function() {
    if (!is.null(cache)) return(cache)
    raiz <- withr::local_tempdir()
    r <- tryCatch(.mini_resolver(.mt_ctx(slide = .mt_slide("sonda")), raiz, .mt_opts()), error = function(e) NULL)
    cache <<- !is.null(r) && length(r$slide_previews) > 0L
    cache
  }
})

test_that("la huella es estable; reordenar claves sólo no la cambia en los niveles conmutativos de la lista blanca", {
  a <- .mt_ctx()
  b <- .mt_ctx()
  expect_identical(a$hash, b$hash)
  expect_match(a$hash, "^[0-9a-f]{64}$")
  # Lista blanca: las familias de presets se consumen por nombre.
  p1 <- .mt_ctx(presets_json = list(barras = list(formato = "pct"), general = list(nota_redondeo = "x")))
  p2 <- .mt_ctx(presets_json = list(general = list(nota_redondeo = "x"), barras = list(formato = "pct")))
  expect_identical(p1$hash, p2$hash)
  # Fuera de la lista blanca (la lámina) el orden de claves es parte de la huella.
  s <- .mt_slide()
  s_rev <- list(payload = list(grafico = list(args = list(var = "region"), graficador = "p_barras_categoricas"),
                               titulo = "Región"),
                tipo = s$tipo, id = s$id)
  expect_false(identical(.mt_ctx(slide = s_rev)$hash, a$hash))
})

# Escala de tres preguntas por región: multiapiladas `var_cruce`, cuyos bloques son las claves de `vars`.
.mt_temas <- function() {
  set.seed(1); n <- 40
  esc <- c("1", "2", "3")
  df <- data.frame(region = sample(c("norte", "sur"), n, TRUE), p1 = sample(esc, n, TRUE), p2 = sample(esc, n, TRUE),
                   p3 = sample(esc, n, TRUE), stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = c("region", "p1", "p2", "p3"), type = c("select_one l_region", rep("select_one l_esc", 3)),
                        list_name = c("l_region", rep("l_esc", 3)), label = c("Región", "Pregunta uno", "Pregunta dos", "Pregunta tres"),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("l_region", "l_region", "l_esc", "l_esc", "l_esc"), name = c("norte", "sur", "1", "2", "3"),
                         label = c("Norte", "Sur", "Malo", "Regular", "Bueno"), stringsAsFactors = FALSE))
  list(df = df, inst = inst)
}

test_that("B1: reordenar los bloques de `vars` cambia la huella Y el PPTX (no hay colisión de caché)", {
  f <- .mt_temas()
  lamina <- function(vars) list(id = "m1", tipo = "p_slide_1_grafico", payload = list(titulo = "Temas", grafico = list(
    graficador = "p_barras_multiapiladas", args = list(modo = "var_cruce", vars = vars, cruces = "region"))))
  ctx <- function(vars) .mt_ctx(slide = lamina(vars), fuentes = f)
  a <- ctx(list(tema_1 = list("p1"), tema_2 = list("p2", "p3")))
  b <- ctx(list(tema_2 = list("p2", "p3"), tema_1 = list("p1")))
  expect_false(identical(a$hash, b$hash))
  raiz <- withr::local_tempdir()
  ra <- .mini_resolver(a, raiz, .mt_opts(render = FALSE))
  rb <- .mini_resolver(b, raiz, .mt_opts(render = FALSE))
  expect_identical(rb$cache$pptx, "miss")
  orden <- function(r) {
    t <- .mt_texto_pptx(r$pptx)
    regmatches(t, gregexpr("tema_[12]", t))[[1]]
  }
  expect_identical(orden(ra), c("tema_1", "tema_2"))
  expect_identical(orden(rb), c("tema_2", "tema_1"))
})

test_that("B1: los ejes del radar (claves de `vars` en orden de filas) también son parte de la huella", {
  f <- .mt_temas()
  lamina <- function(vars) list(id = "r1", tipo = "p_slide_1_grafico", payload = list(titulo = "Radar", grafico = list(
    graficador = "p_radar", args = list(vars = vars))))
  a <- .mt_ctx(slide = lamina(list(`Eje A` = "p1", `Eje B` = "p2", `Eje C` = "p3")), fuentes = f)
  b <- .mt_ctx(slide = lamina(list(`Eje C` = "p3", `Eje B` = "p2", `Eje A` = "p1")), fuentes = f)
  expect_false(identical(a$hash, b$hash))
})

test_that("(a) la lámina: cambiar un texto, un arg, el orden de categorías, un filtro o el folio cambia la huella", {
  base <- .mt_ctx()$hash
  expect_false(identical(.mt_ctx(slide = .mt_slide(titulo = "Otra región"))$hash, base))
  s <- .mt_slide(); s$payload$grafico$args$orden_categorias <- list(modo = "personalizado", lista = list("sur", "norte"))
  expect_false(identical(.mt_ctx(slide = s)$hash, base))
  s <- .mt_slide(); s$payload$grafico$args$filtros <- list(region = "norte")
  expect_false(identical(.mt_ctx(slide = s)$hash, base))
  expect_false(identical(.mt_ctx(folio = 7L)$hash, base))
})

test_that("(b) el scope, la base activa y el conjunto ordenado de bases cambian la huella", {
  f <- .mt_fuentes()
  base <- .mt_ctx()$hash
  expect_false(identical(.mt_ctx(scope = "consolidated")$hash, base))
  expect_false(identical(.mt_ctx(base = "principal")$hash, base))
  dos <- function(orden) {
    ds <- list(principal = f$df, otra = f$df)[orden]
    is <- list(principal = f$inst, otra = f$inst)[orden]
    .mini_contexto(.mt_slide(), data_sources = ds, inst_sources = is, template_pptx = .graficos_resolve_template_pptx())$hash
  }
  expect_false(identical(dos(c("principal", "otra")), dos(c("otra", "principal"))))
})

test_that("(c) los datos que recibe el motor: una ponderación o una etiqueta distinta cambian la huella", {
  base <- .mt_ctx()$hash
  expect_false(identical(.mt_ctx(fuentes = .mt_fuentes(peso = 2))$hash, base))               # ponderación
  expect_false(identical(.mt_ctx(fuentes = .mt_fuentes(etiqueta_norte = "Zona Norte"))$hash, base))  # etiqueta
  f <- .mt_fuentes(); attr(f$df, "instrumento_reporte") <- list(x = 1)                        # atributo que leen los graficadores
  expect_false(identical(.mt_ctx(fuentes = f)$hash, base))
})

test_that("(d) presets, paletas, íconos, perfil/plantilla y opciones prosecnur.* cambian la huella", {
  base <- .mt_ctx()$hash
  expect_false(identical(.mt_ctx(presets_json = list(general = list(nota_redondeo = "Redondeado")))$hash, base))
  expect_false(identical(.mt_ctx(paletas = list(l_region = list(norte = "#112233")))$hash, base))
  expect_false(identical(.mt_ctx(template_id = "acnur_16_9")$hash, base))
  expect_false(identical(.mt_ctx(profile_id = "otro")$hash, base))
  expect_false(identical(.mt_ctx(auto_otros_slides = TRUE)$hash, base))
  withr::with_options(list(prosecnur.plan_etiquetas_cortas = TRUE), {
    expect_false(identical(.mt_ctx()$hash, base))
  })
  ico <- withr::local_tempfile(fileext = ".png")
  writeBin(as.raw(1:10), ico)
  h1 <- .mt_ctx(icon_registry = list(casa = ico))$hash
  writeBin(as.raw(10:1), ico)
  Sys.setFileTime(ico, Sys.time() + 5)
  h2 <- .mt_ctx(icon_registry = list(casa = ico))$hash
  expect_false(identical(h1, base))
  expect_false(identical(h1, h2))                                                              # mismo nombre, otro archivo
})

test_that("(e) el contenido de la plantilla y del estándar cambian la huella; la ruta no", {
  base <- .mt_ctx()$hash
  copia <- withr::local_tempfile(fileext = ".pptx")
  file.copy(.graficos_resolve_template_pptx(), copia)
  expect_identical(.mt_ctx()$hash, .mini_contexto(.mt_slide(), data_sources = list(principal = .mt_fuentes()$df),
                                                  inst_sources = list(principal = .mt_fuentes()$inst),
                                                  template_pptx = copia)$hash)
  con <- file(copia, "ab"); writeBin(as.raw(0), con); close(con)
  Sys.setFileTime(copia, Sys.time() + 5)
  expect_false(identical(.mini_contexto(.mt_slide(), data_sources = list(principal = .mt_fuentes()$df),
                                        inst_sources = list(principal = .mt_fuentes()$inst), template_pptx = copia)$hash, base))

  dir_std <- withr::local_tempdir()
  std <- file.path(dir_std, "estandar_pulso.json")
  file.copy(.std_ruta(), std)
  cat("\n", file = std, append = TRUE)
  local_mocked_bindings(.std_ruta = function() std)
  expect_false(identical(.mt_ctx()$hash, base))
})

test_that("(f) la versión del paquete y la versión manual de la caché cambian la huella", {
  base <- .mt_ctx()$hash
  expect_false(identical(.mt_ctx(version_paquete = "9.9.9")$hash, base))
  local_mocked_bindings(.MINIATURAS_VERSION_CACHE = "versión-de-prueba")
  expect_false(identical(.mt_ctx()$hash, base))
})

test_that("la caché: miss renderiza, hit no vuelve a llamar al motor y devuelve el mismo PPTX", {
  raiz <- withr::local_tempdir()
  ctx <- .mt_ctx()
  r1 <- .mini_resolver(ctx, raiz, .mt_opts(render = FALSE))
  expect_identical(r1$cache$pptx, "miss")
  expect_identical(r1$meta$hash, ctx$hash)
  expect_identical(r1$meta$partes$partes[[1]]$estado, "nativa")
  expect_identical(r1$meta$graficos_pedidos, 1L)
  sha1 <- digest::digest(file = r1$pptx, algo = "sha256")
  expect_identical(r1$meta$sha256_pptx, sha1)

  llamadas <- 0L
  local_mocked_bindings(.mini_render_pptx = function(...) { llamadas <<- llamadas + 1L; stop("no debía renderizar") })
  r2 <- .mini_resolver(ctx, raiz, .mt_opts(render = FALSE))
  expect_identical(r2$cache$pptx, "hit")
  expect_identical(llamadas, 0L)
  expect_identical(digest::digest(file = r2$pptx, algo = "sha256"), sha1)

  # Una entrada a medias (PPTX sin meta: job cancelado entre las dos escrituras) no cuenta como hit.
  unlink(.mini_entrada(raiz, ctx$hash)$meta)
  expect_null(.mini_entrada_leer(raiz, ctx$hash))
})

test_that("un cambio de etiqueta o de ponderación en la base invalida la miniatura y la nueva dice lo nuevo", {
  raiz <- withr::local_tempdir()
  viejo <- .mini_resolver(.mt_ctx(), raiz, .mt_opts(render = FALSE))
  expect_match(.mt_texto_pptx(viejo$pptx), "Norte", fixed = TRUE)
  ctx_nuevo <- .mt_ctx(fuentes = .mt_fuentes(etiqueta_norte = "Zona Norte"))
  expect_null(.mini_entrada_leer(raiz, ctx_nuevo$hash))
  nuevo <- .mini_resolver(ctx_nuevo, raiz, .mt_opts(render = FALSE))
  expect_identical(nuevo$cache$pptx, "miss")
  expect_match(.mt_texto_pptx(nuevo$pptx), "Zona Norte", fixed = TRUE)
  ctx_peso <- .mt_ctx(fuentes = .mt_fuentes(peso = 3))
  expect_identical(.mini_resolver(ctx_peso, raiz, .mt_opts(render = FALSE))$cache$pptx, "miss")
})

test_that("la caché no cambia el render: el PNG servido desde caché es byte a byte el recién renderizado", {
  skip_if_not(.mt_raster_disponible(), "El renderer (LibreOffice + pdftools) no rasteriza en este entorno.")
  raiz <- withr::local_tempdir()
  ctx <- .mt_ctx()
  r1 <- .mini_resolver(ctx, raiz, .mt_opts())
  expect_identical(r1$cache, list(pptx = "miss", raster = "miss"))
  bytes <- function(sp) jsonlite::base64_dec(sub("^data:image/png;base64,", "", sp[[1]]$png_base64))
  sha_render <- digest::digest(bytes(r1$slide_previews), algo = "sha256", serialize = FALSE)
  r2 <- .mini_resolver(ctx, raiz, .mt_opts())
  expect_identical(r2$cache, list(pptx = "hit", raster = "hit"))
  expect_identical(digest::digest(bytes(r2$slide_previews), algo = "sha256", serialize = FALSE), sha_render)
  # La miniatura del lote es el raster reducido a 480 px: derivada de forma determinista y servida desde caché tal cual.
  png <- .mini_miniatura_png(raiz, ctx$hash, r2$slide_previews)
  sha_mini <- digest::digest(file = png, algo = "sha256")
  expect_identical(sha_mini, digest::digest(.mini_reducir_png(bytes(r1$slide_previews)), algo = "sha256", serialize = FALSE))
  dims <- .mini_png_dims(png)
  expect_identical(unname(dims[["width"]]), 480L)
  completo <- dim(png::readPNG(bytes(r1$slide_previews)))
  expect_identical(unname(dims[["height"]]), as.integer(round(completo[[1]] * 480 / completo[[2]])))
  expect_identical(unname(.mini_png_dims(png)), rev(dim(png::readPNG(png))[1:2]))   # la cabecera dice lo mismo que decodificar
  expect_lt(file.size(png), length(bytes(r1$slide_previews)) / 4)
  expect_identical(.mini_miniatura_png(raiz, ctx$hash, r2$slide_previews), png)          # hit: el mismo archivo
  expect_identical(digest::digest(file = png, algo = "sha256"), sha_mini)
  # La vista previa de la lámina activa sigue con el raster completo.
  expect_identical(digest::digest(bytes(.mini_resolver(ctx, raiz, .mt_opts())$slide_previews), algo = "sha256", serialize = FALSE), sha_render)
  # La miniatura (1 parte) reutiliza el raster de 6 partes de la vista previa de la lámina activa.
  raiz2 <- withr::local_tempdir()
  seis <- .mini_resolver(ctx, raiz2, list(preview_quality = "quick", render_slide_preview = TRUE, preview_partes = TRUE))
  una <- .mini_resolver(ctx, raiz2, .mt_opts())
  expect_identical(una$cache$raster, "hit")
  expect_identical(una$slide_previews[[1]]$png_base64, seis$slide_previews[[1]]$png_base64)
  expect_false(isTRUE(attr(una$slide_previews, "truncado")))
})

test_that("el resultado por lámina del lote: ok/sin_imagen, sin_datos y error con su código", {
  raiz <- withr::local_tempdir()
  ok <- .mini_lote_item(.mt_ctx(), raiz, .mt_opts())
  expect_true(ok$estado %in% c("ok", "sin_imagen"))
  if (.mt_raster_disponible()) {
    expect_identical(ok$estado, "ok")
    expect_true(file.exists(ok$png))
  }
  vacia <- .mini_lote_item(.mt_ctx(slide = .mt_slide(var = "")), raiz, .mt_opts(render = FALSE))
  expect_identical(vacia$estado, "sin_datos")
  # Una variable que no está en la base: el motor degrada el gráfico al canvas «Sin datos» y lo avisa.
  sin_var <- suppressWarnings(.mini_lote_item(.mt_ctx(slide = .mt_slide(var = "no_existe")), raiz, .mt_opts(render = FALSE)))
  expect_identical(sin_var$estado, "sin_datos")
  s <- .mt_slide(); s$payload$grafico$graficador <- "p_graficador_inventado"
  rota <- .mini_lote_item(.mt_ctx(slide = s), raiz, .mt_opts(render = FALSE))
  expect_identical(rota$estado, "error")
  expect_identical(rota$error$code, "E_MINIATURA_FALLIDA")
  expect_match(rota$error$message, "Graficador no registrado", fixed = TRUE)
  s <- .mt_slide(); s$tipo <- "p_slide_inventada"
  mala <- .mini_lote_item(.mt_ctx(slide = s), raiz, .mt_opts())
  expect_identical(mala$error$code, "E_MINIATURA_TIPO_INVALIDO")
})

test_that("I1/M2: un filtro sin casos deja la lámina sin_datos con motivo n0", {
  raiz <- withr::local_tempdir()
  s <- .mt_slide(); s$payload$grafico$args$filtros <- list(region = "oeste")
  item <- suppressWarnings(.mini_lote_item(.mt_ctx(slide = s), raiz, .mt_opts(render = FALSE)))
  expect_identical(item$estado, "sin_datos")
  meta <- .mini_entrada_leer(raiz, item$hash)
  expect_identical(.mini_graficos_publico(meta)$vacios, 1L)
  expect_identical(as.character(.mini_graficos_publico(meta)$motivo), "n0")
  # Con un filtro que sí tiene casos, nada de n0.
  s$payload$grafico$args$filtros <- list(region = "norte")
  ok <- .mini_lote_item(.mt_ctx(slide = s), raiz, .mt_opts(render = FALSE))
  expect_false(identical(ok$estado, "sin_datos"))
  expect_identical(.mini_graficos_publico(.mini_entrada_leer(raiz, ok$hash))$vacios, 0L)
})

test_that("M2: el motivo distingue borrador incompleto, variable fuera de la base y n0", {
  raiz <- withr::local_tempdir()
  motivo <- function(slide) {
    it <- suppressWarnings(.mini_lote_item(.mt_ctx(slide = slide), raiz, .mt_opts(render = FALSE)))
    as.character(.mini_graficos_publico(.mini_entrada_leer(raiz, it$hash))$motivo)
  }
  expect_identical(motivo(.mt_slide(var = "")), "borrador_incompleto")
  expect_identical(motivo(.mt_slide(var = "no_existe")), "variable_fuera_de_base")
  s <- .mt_slide(); s$payload$grafico$args$filtros <- list(region = "oeste")
  expect_identical(motivo(s), "n0")
  expect_identical(motivo(.mt_slide()), character(0))
})

test_that("M1: una lámina de 2 gráficos con 1 vacío sale ok con vacios = 1", {
  raiz <- withr::local_tempdir()
  graf <- function(var) list(graficador = "p_barras_categoricas", args = list(var = var))
  s <- list(id = "d1", tipo = "p_slide_2_graficos",
            payload = list(titulo = "Dos", izquierda = graf("region"), derecha = graf("")))
  item <- .mini_lote_item(.mt_ctx(slide = s), raiz, .mt_opts(render = FALSE))
  expect_identical(item$estado, "sin_imagen")                     # sin raster pedido: no es sin_datos
  g <- .mini_graficos_publico(.mini_entrada_leer(raiz, item$hash))
  expect_identical(g$pedidos, 2L)
  expect_identical(g$vacios, 1L)
  expect_identical(as.character(g$motivo), "borrador_incompleto")
  if (.mt_raster_disponible()) expect_identical(.mini_lote_item(.mt_ctx(slide = s), raiz, .mt_opts())$estado, "ok")
})

test_that("M3: cada degradación al canvas «Sin datos» señala pulso_lamina_degradada con su motivo (sello, no texto)", {
  escuchar <- function(expr) {
    motivos <- character(0)
    suppressWarnings(suppressMessages(withCallingHandlers(expr, pulso_lamina_degradada = function(c) motivos <<- c(motivos, c$motivo))))
    motivos
  }
  falla <- function(el) .slide_abort_render("se rompió")
  expect_identical(escuchar(.plan_render_element_degradable(falla, list())), "error_render")
  expect_identical(escuchar(.plan_canvas_render_nulo("El renderer devolvió NULL.")), "render_nulo")
  expect_identical(escuchar(.plan_elemento_degradado("Slot mangleado.")), "elemento_invalido")
  # Sin nadie escuchando la señal no hace nada.
  expect_silent(.pulso_senal_degradado("error_render", "x"))
  # El conteo de la vista previa usa el sello: cambiar el texto del aviso no lo rompe.
  local_mocked_bindings(.pulso_aviso = function(...) invisible(TRUE))
  raiz <- withr::local_tempdir()
  it <- suppressWarnings(.mini_lote_item(.mt_ctx(slide = .mt_slide(var = "no_existe")), raiz, .mt_opts(render = FALSE)))
  expect_identical(it$estado, "sin_datos")
})

test_that("I2: la vista previa consolidada usa el orden de releases y la metodología del export", {
  f <- .mt_fuentes()
  orden_pedido <- NULL
  catalogo <- list(detected = TRUE, entries = list(
    list(base = "estudiantes", pins = list(methodology = list(configured = TRUE,
      ppt_plan_defaults = list(region = list(excluir_opciones = list("sur")))))),
    list(base = "docentes", pins = list(methodology = list(configured = FALSE)))))
  local_mocked_bindings(
    .processing_release_catalog = function(s) catalogo,
    .graficos_consolidado_sources = function(sid, source_order = NULL) {
      orden_pedido <<- source_order
      list(data_sources = list(estudiantes = f$df, docentes = f$df), inst_sources = list(estudiantes = f$inst, docentes = f$inst))
    },
    .graficos_sources_usable = function(...) TRUE,
    session_get = function(sid, ...) list(dir = tempdir())
  )
  fuentes <- .graficos_preview_fuentes("sid-x", list(scope = "consolidated"))
  expect_identical(orden_pedido, c("estudiantes", "docentes"))
  slide <- list(id = "c1", tipo = "p_slide_1_grafico", payload = list(titulo = "Región", grafico = list(
    graficador = "p_barras_agrupadas", args = list(var = "estudiantes$region"))))
  comun <- list(plan_slides = list(slide), scope = "consolidated", base = "", data_sources = fuentes$data_sources,
                inst_sources = fuentes$inst_sources, reglas_metodologia = fuentes$reglas_metodologia,
                template_pptx = .graficos_resolve_template_pptx(), template_id = "generic_16_9")
  ctx <- .graficos_preview_lamina_ctx(comun, slide)
  # Paridad: la lámina de la vista previa es la del plan que dibuja el export (misma función, mismo resultado).
  export <- .graficos_consolidado_plan_entregable(list(slides = list(slide)), .graficos_consolidado_methodology_rules(catalogo))
  expect_identical(ctx$slide, export$plan$slides[[1]])
  expect_identical(as.character(unlist(ctx$slide$payload$grafico$args$excluir_opciones)), "sur")
  expect_identical(ctx$bases, c("estudiantes", "docentes"))
  # Y el render lo respeta: «Sur» excluida no aparece en el mini-PPTX.
  raiz <- withr::local_tempdir()
  r <- .mini_resolver(ctx, raiz, .mt_opts(render = FALSE))
  texto <- .mt_texto_pptx(r$pptx)
  expect_match(texto, "Norte", fixed = TRUE)
  expect_false(grepl("Sur", texto, fixed = TRUE))
})

test_that("el worker resuelve las láminas desde su entrada RDS, escribe cada resultado y reporta progreso", {
  raiz <- withr::local_tempdir()
  lote_dir <- withr::local_tempdir()
  f <- .mt_fuentes()
  ctx <- .mt_ctx()
  fuentes_path <- withr::local_tempfile(fileext = ".rds")
  saveRDS(list(data_sources = ctx$data_sources, inst_sources = ctx$inst_sources), fuentes_path)
  sin <- function(x) x[setdiff(names(x), c("data_sources", "inst_sources"))]
  entrada <- list(lote_id = "L", modo = "lote", raiz = raiz, lote_dir = lote_dir, opts = .mt_opts(render = FALSE),
                  fuentes_path = fuentes_path, opciones_motor = list(),
                  laminas = list(sin(ctx), sin(.mt_ctx(slide = .mt_slide(titulo = "Dos")))), ordenes = list(1L, 2L))
  entrada_path <- withr::local_tempfile(fileext = ".rds")
  saveRDS(entrada, entrada_path)
  progreso <- withr::local_tempfile(fileext = ".progress")
  out <- .graficos_miniaturas_worker(entrada_path, progreso)
  expect_length(out$items, 2L)
  expect_identical(vapply(out$items, `[[`, "", "estado"), c("sin_imagen", "sin_imagen"))
  expect_true(all(file.exists(file.path(lote_dir, c("item_0001.rds", "item_0002.rds")))))
  p <- jsonlite::fromJSON(readLines(progreso))
  expect_identical(p$phase, "done")
  expect_identical(as.integer(p$total), 2L)
  # El thunk del job no arrastra el namespace: se deserializa sin el paquete instalado.
  expect_identical(environment(.mini_job_thunk()), globalenv())
})

test_that(".mini_reducir_png promedia bloques y es determinista", {
  img <- array(0, c(4, 8, 3)); img[, 1:4, ] <- 1                                # mitad izquierda blanca
  b <- png::writePNG(img)
  r <- .mini_reducir_png(b, ancho = 2L)
  expect_identical(r, .mini_reducir_png(b, ancho = 2L))
  out <- png::readPNG(r)
  expect_identical(dim(out)[1:2], c(1L, 2L))
  expect_equal(out[1, , 1], c(1, 0))
  expect_identical(.mini_reducir_png(b, ancho = 16L), b)                        # más angosto que el ancho: tal cual
})

test_that(".pptx_leer_parte lee una parte de una sola línea sin salto final (officer, ruta anterior) y en UTF-8", {
  dir <- withr::local_tempdir()
  dir.create(file.path(dir, "ppt"))
  xml <- '<p:sld><a:t>Región «Sí»</a:t></p:sld>'
  writeBin(charToRaw(enc2utf8(xml)), file.path(dir, "ppt", "una.xml"))                       # sin salto final
  writeBin(charToRaw("linea 1\r\nlinea 2\n"), file.path(dir, "ppt", "dos.xml"))
  z <- file.path(dir, "x.pptx")
  withr::with_dir(dir, zip::zip(z, c("ppt/una.xml", "ppt/dos.xml")))
  leido <- .pptx_leer_parte(z, "ppt/una.xml")
  expect_identical(leido, enc2utf8(xml))
  expect_identical(Encoding(leido), "UTF-8")
  expect_identical(.pptx_leer_parte(z, "ppt/dos.xml"), "linea 1\nlinea 2")
  expect_error(.pptx_leer_parte(z, "ppt/no.xml"), "no está")
})

# ---- Re-revisión metodológica (2026-10-11, segunda ronda) ------------------------------------------------------------

.mt_base_n <- function(texto) regmatches(texto, regexpr("Base: [0-9]+", texto))

test_that("I-N1: la vista previa consolidada usa la config del borrador consolidado, no la de la base activa (paridad con el export)", {
  f <- .mt_fuentes()
  activa <- .graficos_default_config(NULL)
  activa$presets$barras_categoricas$excluir_opciones <- "sur"                  # decisión SOLO de la base activa
  borrador <- .graficos_default_config(NULL)                                    # el borrador consolidado no la declara
  local_mocked_bindings(
    .graficos_config_get = function(sid, ...) activa,
    graficos_consolidado_draft_get = function(sid) list(ok = TRUE, revision = 1L, config = borrador),
    session_get = function(sid, ...) list(dir = tempdir(), files = list())
  )
  fuentes <- list(data_sources = list(estudiantes = f$df), inst_sources = list(estudiantes = f$inst),
                  consolidado = TRUE, reglas_metodologia = list())
  comun <- .graficos_preview_comun("sid-x", list(), fuentes)
  expect_identical(comun$presets_json, .enriquecer_presets(borrador$presets %||% list(), borrador$debug_ph))
  expect_null(comun$presets_json$barras_categoricas$excluir_opciones)
  # La de la base activa SÍ la tiene: es la fuga que se cierra.
  expect_identical(.graficos_effective_config("sid-x", NULL)$presets$barras_categoricas$excluir_opciones, "sur")

  slide <- list(id = "c1", tipo = "p_slide_1_grafico", payload = list(titulo = "Región", grafico = list(
    graficador = "p_barras_categoricas", args = list(var = "estudiantes$region"))))
  ctx <- .graficos_preview_lamina_ctx(comun, slide)
  raiz <- withr::local_tempdir()
  previa <- .mt_texto_pptx(suppressWarnings(.mini_resolver(ctx, raiz, .mt_opts(render = FALSE)))$pptx)

  # El export consolidado de la misma lámina, por su propio worker y su propia receta.
  dir <- withr::local_tempdir()
  saveRDS(fuentes$data_sources, file.path(dir, "d.rds")); saveRDS(fuentes$inst_sources, file.path(dir, "i.rds"))
  receta <- list(plan = .graficos_consolidado_plan_entregable(list(slides = list(slide)), list())$plan,
                 presets = .enriquecer_presets(borrador$presets %||% list(), NULL), paletas = borrador$paletas %||% list(),
                 auto_otros_slides = FALSE, icon_registry = list())
  saveRDS(receta, file.path(dir, "r.rds"))
  out <- file.path(dir, "export.pptx")
  suppressWarnings(suppressMessages(graficos_consolidado_job_runner(
    file.path(dir, "d.rds"), file.path(dir, "i.rds"), file.path(dir, "r.rds"),
    template_pptx = .graficos_resolve_template_pptx(), template_id = "generic_16_9", result_path = out)))
  export <- .mt_texto_pptx(out)
  expect_identical(.mt_base_n(previa), .mt_base_n(export))
  expect_identical(.mt_base_n(previa), "Base: 10")
  expect_match(previa, "Sur", fixed = TRUE)
})

test_that("I-N2: la vista previa consolidada lleva el aviso de denominador cero del export", {
  f <- .mt_fuentes()
  catalogo <- list(detected = TRUE, entries = list(
    list(base = "estudiantes", pins = list(methodology = list(configured = TRUE,
      ppt_plan_defaults = list(region = list(excluir_opciones = list("norte", "sur"))),
      denominator_rules = list(region = list(zero_denominator = "report_na_with_warning"))))),
    list(base = "docentes", pins = list(methodology = list(configured = FALSE)))))
  reglas <- .graficos_consolidado_methodology_rules(catalogo)
  fuentes <- list(data_sources = list(estudiantes = f$df, docentes = f$df), inst_sources = list(estudiantes = f$inst, docentes = f$inst))
  del_export <- .graficos_consolidado_denominator_warnings(fuentes, reglas)
  expect_true(any(grepl("methodology_zero_denominator", del_export, fixed = TRUE)))
  slide <- list(id = "c1", tipo = "p_slide_1_grafico", payload = list(titulo = "Región", grafico = list(
    graficador = "p_barras_agrupadas", args = list(var = "estudiantes$region"))))
  comun <- list(plan_slides = list(slide), scope = "consolidated", base = "", data_sources = fuentes$data_sources,
                inst_sources = fuentes$inst_sources, reglas_metodologia = reglas,
                template_pptx = .graficos_resolve_template_pptx(), template_id = "generic_16_9")
  ctx <- .graficos_preview_lamina_ctx(comun, slide)
  expect_true(all(del_export %in% ctx$avisos_previos))
  raiz <- withr::local_tempdir()
  it <- suppressWarnings(.mini_lote_item(ctx, raiz, .mt_opts(render = FALSE)))
  meta <- .mini_entrada_leer(raiz, it$hash)
  expect_true(any(grepl("methodology_zero_denominator", meta$avisos, fixed = TRUE)))
  expect_identical(it$estado, "sin_datos")                                     # todo excluido: el canvas vacío cuenta
  # Una lámina que no toca la regla no hereda el aviso.
  otra <- slide; otra$payload$grafico$args$var <- "docentes$region"
  expect_false(any(grepl("methodology_zero_denominator", .graficos_preview_lamina_ctx(comun, otra)$avisos_previos, fixed = TRUE)))
})

test_that("M-N1: variable toda NA, NA en los casos filtrados, excluir_opciones total y pesos 0 → sin_datos (sin_respuestas_validas)", {
  raiz <- withr::local_tempdir()
  ver <- function(slide, fuentes = .mt_fuentes()) {
    it <- suppressWarnings(.mini_lote_item(.mt_ctx(slide = slide, fuentes = fuentes), raiz, .mt_opts(render = FALSE)))
    g <- .mini_graficos_publico(.mini_entrada_leer(raiz, it$hash))
    list(estado = it$estado, vacios = g$vacios, motivo = as.character(g$motivo))
  }
  todo_na <- .mt_fuentes(); todo_na$df$region <- NA_character_
  expect_identical(ver(.mt_slide(), todo_na), list(estado = "sin_datos", vacios = 1L, motivo = "sin_respuestas_validas"))
  parcial <- .mt_fuentes(); parcial$df$zona <- rep(c("a", "b"), c(6, 4)); parcial$df$region[parcial$df$zona == "b"] <- NA
  s <- .mt_slide(); s$payload$grafico$args$filtros <- list(zona = "b")
  expect_identical(ver(s, parcial)$motivo, "sin_respuestas_validas")
  s <- .mt_slide(); s$payload$grafico$args$excluir_opciones <- c("norte", "sur")
  expect_identical(ver(s)$estado, "sin_datos")
  s <- .mt_slide(); s$payload$grafico$graficador <- "p_barras_apiladas"; s$payload$grafico$args$peso <- "peso"
  expect_identical(ver(s, .mt_fuentes(peso = 0))$estado, "sin_datos")
  # Control: con datos, ok/sin_imagen y 0 vacíos.
  expect_identical(ver(.mt_slide())$vacios, 0L)
})

test_that("M-N1: el embudo .blank_canvas señala pulso_grafico_sin_datos, que hereda de pulso_lamina_degradada", {
  senales <- list()
  withCallingHandlers(.pulso_senal_sin_datos(1, "Sin datos para mostrar"),
                      pulso_lamina_degradada = function(c) senales[[length(senales) + 1L]] <<- c)
  expect_length(senales, 1L)
  expect_s3_class(senales[[1]], "pulso_grafico_sin_datos")
  expect_identical(senales[[1]]$motivo, "sin_respuestas_validas")
  expect_identical(.pulso_senal_sin_datos(list(a = 1)), list(a = 1))           # devuelve su argumento intacto
  # Un n = 0 diagnosticado no se cuenta dos veces aunque el canvas vacío también señale.
  expect_identical(.mini_resumen_graficos(2L, c("n0", NA), degradados = 0L, sin_respuestas = 1L)$graficos_vacios, 1L)
  expect_identical(.mini_resumen_graficos(2L, c(NA, NA), degradados = 0L, sin_respuestas = 1L)$graficos_motivos, "sin_respuestas_validas")
})

test_that("M-N2: un filtro sobre una columna que no está en la base es variable_fuera_de_base, no n0", {
  raiz <- withr::local_tempdir()
  s <- .mt_slide(); s$payload$grafico$args$filtros <- list(no_existe = "x")
  it <- suppressWarnings(.mini_lote_item(.mt_ctx(slide = s), raiz, .mt_opts(render = FALSE)))
  expect_identical(it$estado, "sin_datos")
  expect_identical(as.character(.mini_graficos_publico(.mini_entrada_leer(raiz, it$hash))$motivo), "variable_fuera_de_base")
})

# ---- Tercera revisión: el sello sin_datos cuenta gráficos, no bloques ---------------------------------------------------

.mt_ver <- function(slide, fuentes) {
  raiz <- withr::local_tempdir(.local_envir = parent.frame())
  it <- suppressWarnings(.mini_lote_item(.mt_ctx(slide = slide, fuentes = fuentes), raiz, .mt_opts(render = FALSE)))
  g <- .mini_graficos_publico(.mini_entrada_leer(raiz, it$hash))
  list(estado = it$estado, pedidos = g$pedidos, vacios = g$vacios, motivo = as.character(g$motivo))
}
.mt_multilista <- function(vars, filtros = NULL) {
  args <- list(modo = "multilista", bloques = lapply(vars, function(v) list(modo = "var", vars = list(v))))
  if (!is.null(filtros)) args$filtros <- filtros
  list(graficador = "p_barras_multiapiladas", args = args)
}
.mt_ok <- list(graficador = "p_barras_categoricas", args = list(var = "region"))

test_that("A: una multilista con un bloque con datos y otro todo NA dibuja datos (vacios = 0)", {
  f <- .mt_temas(); f$df$p2 <- NA_character_
  r <- .mt_ver(list(id = "a", tipo = "p_slide_1_grafico", payload = list(titulo = "T", grafico = .mt_multilista(c("p1", "p2")))), f)
  expect_false(identical(r$estado, "sin_datos"))
  expect_identical(r$vacios, 0L)
})

test_that("G: OK + multilista cuyo filtro deja 0 casos en sus 2 bloques → vacios = 1 (una señal por gráfico)", {
  r <- .mt_ver(list(id = "g", tipo = "p_slide_2_graficos", payload = list(titulo = "T", izquierda = .mt_ok,
                    derecha = .mt_multilista(c("p1", "p2"), filtros = list(region = "oeste")))), .mt_temas())
  expect_identical(r$pedidos, 2L)
  expect_identical(r$vacios, 1L)
  expect_identical(r$motivo, "n0")
  expect_false(identical(r$estado, "sin_datos"))
})

test_that("H: OK + multilista de 3 bloques con 1 con datos → la multilista dibuja: vacios = 0, no sin_datos", {
  f <- .mt_temas(); f$df$p2 <- NA_character_; f$df$p3 <- NA_character_
  r <- .mt_ver(list(id = "h", tipo = "p_slide_2_graficos", payload = list(titulo = "T", izquierda = .mt_ok,
                    derecha = .mt_multilista(c("p1", "p2", "p3")))), f)
  expect_identical(r$pedidos, 2L)
  expect_identical(r$vacios, 0L)
  expect_false(identical(r$estado, "sin_datos"))
})

test_that("una multilista con TODOS sus bloques vacíos → sin_datos con vacios = 1", {
  f <- .mt_temas(); f$df$p1 <- NA_character_; f$df$p2 <- NA_character_
  r <- .mt_ver(list(id = "t", tipo = "p_slide_1_grafico", payload = list(titulo = "T", grafico = .mt_multilista(c("p1", "p2")))), f)
  expect_identical(r, list(estado = "sin_datos", pedidos = 1L, vacios = 1L, motivo = "sin_respuestas_validas"))
})

test_that("el envoltorio por gráfico silencia las señales de sus bloques y re-señala una sola si todos quedaron vacíos", {
  contar <- function(el, n_senales) {
    n <- 0L
    withCallingHandlers(
      .plan_con_sin_datos_por_grafico(el, { for (i in seq_len(n_senales)) .pulso_senal_sin_datos(NULL); "ok" }),
      pulso_grafico_sin_datos = function(c) n <<- n + 1L)
    n
  }
  dos_bloques <- list(bloques = list(1, 2))
  expect_identical(contar(dos_bloques, 1L), 0L)
  expect_identical(contar(dos_bloques, 2L), 1L)
  expect_identical(contar(dos_bloques, 3L), 1L)                                  # bloques vacíos + canvas final: una
  expect_identical(contar(list(), 1L), 1L)
  expect_identical(contar(list(), 0L), 0L)
})

test_that("H23: una entrada cuyo meta trae otra huella no es hit", {
  raiz <- withr::local_tempdir()
  ctx <- .mt_ctx()
  .mini_resolver(ctx, raiz, .mt_opts(render = FALSE))
  e <- .mini_entrada(raiz, ctx$hash)
  meta <- readRDS(e$meta); meta$hash <- strrep("0", 64); saveRDS(meta, e$meta)
  expect_null(.mini_entrada_leer(raiz, ctx$hash))
  expect_identical(.mini_resolver(ctx, raiz, .mt_opts(render = FALSE))$cache$pptx, "miss")
  expect_identical(readRDS(e$meta)$hash, ctx$hash)                               # el miss reescribe la entrada sana
})

test_that("H24: la poda LRU corre y conserva las entradas usadas más recientemente", {
  raiz <- withr::local_tempdir()
  ahora <- Sys.time()
  for (k in 1:5) {
    d <- file.path(raiz, sprintf("h%d", k)); dir.create(d)
    Sys.setFileTime(d, ahora - (6 - k) * 60)                                     # h1 la más vieja, h5 la más nueva
  }
  Sys.setFileTime(file.path(raiz, "h1"), ahora - 1)                              # h1 se acaba de usar
  expect_identical(.mini_cache_podar(raiz, max = 3L), 2L)
  expect_setequal(basename(list.dirs(raiz, recursive = FALSE)), c("h1", "h4", "h5"))
  expect_identical(.mini_cache_podar(raiz, max = 3L), 0L)
  # Corre en el camino real: con el tope en 1, la vista previa síncrona deja una sola entrada en la caché de la sesión.
  withr::local_options(pulso.miniaturas_cache_max = 1L)
  r1 <- .mini_resolver(.mt_ctx(slide = .mt_slide("uno")), raiz, .mt_opts(render = FALSE))
  expect_identical(.mini_cache_podar(raiz), 3L)                                 # h1, h4 y h5 ceden ante la nueva
  expect_identical(basename(list.dirs(raiz, recursive = FALSE)), r1$hash)
})
