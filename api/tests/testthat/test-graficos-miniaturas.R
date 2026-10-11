# Huella y caché de la vista previa de lámina (graficos_miniaturas*.R). Contrato:
# docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md. La llave es la huella de TODO lo que el render lee, en seis grupos
# (a)–(f): cambiar uno de cada grupo cambia la huella; reordenar claves no. La caché no cambia el render: lo servido desde
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

test_that("la huella es estable y no depende del orden de las claves", {
  a <- .mt_ctx()
  b <- .mt_ctx()
  expect_identical(a$hash, b$hash)
  expect_match(a$hash, "^[0-9a-f]{64}$")

  s <- .mt_slide()
  s_rev <- list(payload = list(grafico = list(args = list(var = "region"), graficador = "p_barras_categoricas"),
                               titulo = "Región"),
                tipo = s$tipo, id = s$id)
  expect_identical(.mt_ctx(slide = s_rev)$hash, a$hash)

  p1 <- .mt_ctx(presets_json = list(barras = list(formato = "pct", sufijo_auto = TRUE), general = list(nota_redondeo = "x")))
  p2 <- .mt_ctx(presets_json = list(general = list(nota_redondeo = "x"), barras = list(sufijo_auto = TRUE, formato = "pct")))
  expect_identical(p1$hash, p2$hash)
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
  png <- .mini_miniatura_png(raiz, ctx$hash, r2$slide_previews)
  expect_identical(digest::digest(file = png, algo = "sha256"), sha_render)
  expect_identical(unname(.mini_png_dims(png)), rev(dim(png::readPNG(png))[1:2]))   # la cabecera dice lo mismo que decodificar
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
