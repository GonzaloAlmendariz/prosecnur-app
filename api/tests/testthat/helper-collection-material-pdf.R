# =============================================================================
# Contrato de artefactos PDF de Recopiladores — helper compartido
# =============================================================================
#
# Por que existe: la verificacion estructural de un PDF de material vivia
# repetida y desigual por archivo de test. test-collection-render-afiche.R
# comprobaba pagina + anotacion /Subtype /Link + URL; test-collection-
# render-ficha.R solo contaba paginas; test-collection-ficha-campo.R no
# comprobaba nada de los bytes del PDF pese a generar uno en tres tests
# distintos -el preset que un encuestador sostiene en el aula era el que
# menos se verificaba-. Sin un contrato unico, "el PDF se genero" (la
# funcion no tiro error) se confundia con "el PDF cumple lo que promete"
# (tiene el numero de paginas correcto y cada enlace declarado es de verdad
# clicable).
#
# `rendered` es el valor de retorno de collection_material_render_compiled()
# con device="pdf": trae `page_count` y `links` (los rectangulos clicables
# que el renderer declaro, con su `url`). No inventa datos nuevos: solo
# verifica que lo que el renderer YA declaro llegue de verdad al PDF.

expect_collection_material_pdf_valid <- function(pdf_path, rendered, expected_pages = NULL) {
  testthat::expect_true(file.exists(pdf_path), info = pdf_path)

  paginas_esperadas <- expected_pages %||% rendered$page_count
  testthat::expect_identical(
    qpdf::pdf_length(pdf_path), as.integer(paginas_esperadas),
    info = sprintf("paginas del PDF vs page_count declarado (%s)", basename(pdf_path))
  )

  raw <- readBin(pdf_path, "raw", n = file.info(pdf_path)$size)
  urls <- unique(vapply(rendered$links %||% list(), function(l) {
    as.character(l$url %||% "")
  }, character(1)))
  urls <- urls[nzchar(urls)]

  if (length(urls)) {
    testthat::expect_true(
      length(grepRaw("/Subtype /Link", raw, fixed = TRUE)) >= length(urls),
      info = sprintf(
        "%d URL(s) declaradas por el renderer, el PDF trae menos anotaciones /Subtype /Link (%s)",
        length(urls), basename(pdf_path)
      )
    )
    for (url in urls) {
      testthat::expect_true(
        length(grepRaw(url, raw, fixed = TRUE)) > 0L,
        info = sprintf("URL declarada por el renderer no aparece en los bytes del PDF: %s", url)
      )
    }
  }

  invisible(TRUE)
}
