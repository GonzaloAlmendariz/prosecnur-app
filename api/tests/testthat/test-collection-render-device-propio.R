source("setup-load-all.R")

# CI de 0.9.5 (shard 1/4): el PDF de material salía truncado («unable to find trailer dictionary») sólo si otro device
# quedaba abierto de un test anterior. `brand_assets` se evaluaba por promesa DENTRO del render, con el PDF ya abierto;
# si generar la marca abre y cierra un png, R vuelve al «siguiente» device de la lista, no al PDF, el resto se dibujaba
# en el ajeno y el `dev.off()` final cerraba ése: el nuestro quedaba sin trailer. En la app puede haber otro device.

test_that("el render cierra su propio PDF aunque haya otro device abierto y la marca abra un png perezosamente", {
  # Los helpers de compilación del test de zonas (plantillas reales, sin red).
  src <- readLines(test_path("test-collection-render-zonas.R"))
  src <- src[seq_len(grep("^test_that", src)[1] - 1L)]
  eval(parse(text = src[!grepl("setup-load-all", src)]))
  compiled <- .czn_compiled(.czn_plantillas()[["aula_marca"]])
  ajeno <- tempfile(fileext = ".pdf")
  grDevices::pdf(ajeno)
  dev_ajeno <- grDevices::dev.cur()
  withr::defer(if (dev_ajeno %in% grDevices::dev.list()) grDevices::dev.off(dev_ajeno))
  out <- tempfile(fileext = ".pdf")
  suppressWarnings(collection_material_render_compiled(compiled, out, device = "pdf", brand_assets = .czn_assets()))
  expect_gt(qpdf::pdf_length(out), 0L)
  expect_true(dev_ajeno %in% grDevices::dev.list())       # el ajeno sigue abierto: no lo cerramos nosotros
})
