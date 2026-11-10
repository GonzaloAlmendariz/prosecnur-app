# Los mensajes de error del libro de aulas llegan al equipo tal cual: van con
# tildes y con el nombre de los módulos que ve el usuario. QA visual del
# 2026-11-10: E_AULAS_LIBRO_SIN_PLAN decía "Importa la seleccion de calculo de
# muestra primero".

# Literales de texto dentro de cada llamada a stop_api() del archivo.
.talm_textos_stop_api <- function(archivo) {
  ruta <- testthat::test_path("..", "..", "R", archivo)
  pd <- utils::getParseData(parse(ruta, keep.source = TRUE), includeText = TRUE)
  llamadas <- pd$parent[pd$token == "SYMBOL_FUNCTION_CALL" & pd$text == "stop_api"]
  llamadas <- pd$parent[match(llamadas, pd$id)]
  desciende_de <- function(id, raiz) {
    while (!is.na(id) && id != 0L) {
      if (id == raiz) return(TRUE)
      id <- pd$parent[match(id, pd$id)]
    }
    FALSE
  }
  cadenas <- pd[pd$token == "STR_CONST", c("id", "text")]
  unlist(lapply(llamadas, function(raiz) {
    dentro <- vapply(cadenas$id, desciende_de, logical(1), raiz = raiz)
    cadenas$text[dentro]
  }))
}

.talm_sin_tilde <- c("seleccion", "calculo", "codigo", "sesion", "irian", "entrarian",
                     "saldria", "sumaria", "agendacion", "aplicacion", "publicacion")

for (.talm_archivo in c("carga_aulas_libro_generar.R", "monitoreo_aulas_publicar_libro.R")) {
  local({
    archivo <- .talm_archivo
    test_that(paste("los mensajes de stop_api de", archivo, "van con tildes y comillas rectas"), {
      textos <- .talm_textos_stop_api(archivo)
      expect_gt(length(textos), 0L)
      patron <- paste0("\\b(", paste(.talm_sin_tilde, collapse = "|"), ")\\b")
      malos <- textos[grepl(patron, textos, ignore.case = TRUE)]
      expect_identical(malos, character(0))
      expect_false(any(grepl("[«»]", textos)), info = paste(textos, collapse = "\n"))
      expect_false(any(grepl("Recopiladores", textos, fixed = TRUE)))
    })
  })
}

test_that("publicar sin plan nombra Cálculo de muestra con tildes", {
  sid <- session_create()
  withr::defer(session_delete(sid))
  testthat::local_mocked_bindings(
    .malp_adoptar_distribucion = function(...) list(fijadas = list())
  )
  err <- tryCatch(
    monitoreo_aulas_publicar_libro_en_sesion(sid, cfg = list(), destino = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdEf",
                                             leer_primero = FALSE),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_SIN_PLAN")
  expect_match(conditionMessage(err), "selección de Cálculo de muestra", fixed = TRUE)
})
