# =============================================================================
# graficos_recetario_ejemplos.R — ejemplos del recetario empaquetados (K5, plan F6 §5.6)
# =============================================================================
#
# La pestaña «Ejemplo» del editor muestra la lámina real del recetario para cada tipo de lámina y de gráfico. Los
# ejemplos viajan con la app en `inst/recetario/ejemplos/` (WebP de 1280 px) con un `catalogo.json` que dice, por
# ejemplo, su clase, tipo, página, recetario de origen, archivo y sha256; el recetario lleva su versión y el hash del
# .pptx del que salió. Un recetario más pulido se agrega como otro recetario del catálogo, sin cambiar este código
# (Gonzalo, 2026-10-10). Se regeneran con `api/scripts/recetario_ejemplos_generar.R`.
#
# El archivo se sirve sólo si su hash coincide con el catálogo: un ejemplo truncado o cambiado a mano no se muestra.

.RECETARIO_EJEMPLO_CLASES <- c("lamina", "grafico")

#' Carpeta de los ejemplos: la del paquete instalado o, en desarrollo, la del árbol
#' @keywords internal
.recetario_ejemplos_dir <- function() {
  p <- system.file("recetario", "ejemplos", package = "prosecnurapp", mustWork = FALSE)
  if (nzchar(p) && file.exists(file.path(p, "catalogo.json"))) return(p)
  cands <- c(file.path(.app_api_dir(), "inst", "recetario", "ejemplos"),
             file.path(getwd(), "inst", "recetario", "ejemplos"),
             file.path(getwd(), "api", "inst", "recetario", "ejemplos"))
  hit <- cands[file.exists(file.path(cands, "catalogo.json"))][1]
  if (is.na(hit)) cands[[1]] else hit
}

#' Catálogo de ejemplos (`formato`, `recetarios`, `ejemplos`)
#' @keywords internal
.recetario_ejemplos_catalogo <- function() {
  ruta <- file.path(.recetario_ejemplos_dir(), "catalogo.json")
  if (!file.exists(ruta)) return(list(formato = 1L, recetarios = list(), ejemplos = list()))
  cat <- jsonlite::fromJSON(ruta, simplifyVector = FALSE)
  cat$formato <- as.integer(cat$formato)
  cat$ejemplos <- lapply(cat$ejemplos, function(e) { e$pagina <- as.integer(e$pagina); e })
  cat
}

#' Índice de ejemplos sin imágenes ni nombres de archivo (`GET /api/graficos/recetario/ejemplos`)
#' @keywords internal
.recetario_ejemplos_indice <- function() {
  cat <- .recetario_ejemplos_catalogo()
  list(
    ok = TRUE,
    recetarios = cat$recetarios,
    ejemplos = lapply(cat$ejemplos, function(e) e[c("clase", "tipo", "pagina", "recetario", "ancho", "alto")])
  )
}

#' Un ejemplo del recetario como imagen embebida (`GET /api/graficos/recetario/ejemplo`)
#'
#' @param tipo Tipo de lámina o de gráfico del registro (`p_slide_1_grafico`, `p_dim_heatmap`).
#' @param pagina Página del recetario; alternativa a `tipo`.
#' @param clase `lamina` o `grafico`; opcional, desempata si un nombre estuviera en las dos.
#' @param recetario Id del recetario; por defecto el último del catálogo.
#' @return `list(clase, tipo, pagina, recetario = list(id, version, sha256), ancho, alto, mime, data_uri)`.
#' @keywords internal
.recetario_ejemplo_payload <- function(tipo = NULL, pagina = NULL, clase = NULL, recetario = NULL) {
  txt <- function(x) { x <- as.character(unlist(x))[1]; if (length(x) && !is.na(x) && nzchar(trimws(x))) trimws(x) else NULL }
  tipo <- txt(tipo); clase <- txt(clase); recetario <- txt(recetario); pagina_txt <- txt(pagina)
  if (is.null(tipo) && is.null(pagina_txt)) {
    stop_api(400L, "E_BAD_RECETARIO_EJEMPLO", "Indica el tipo de lámina o de gráfico, o la página del recetario.")
  }
  pag <- if (is.null(pagina_txt)) NULL else suppressWarnings(as.integer(pagina_txt))
  if (!is.null(pagina_txt) && (is.na(pag) || pag < 1L)) {
    stop_api(400L, "E_BAD_RECETARIO_EJEMPLO", "La página del recetario debe ser un número entero positivo.")
  }
  if (!is.null(clase) && !clase %in% .RECETARIO_EJEMPLO_CLASES) {
    stop_api(400L, "E_BAD_RECETARIO_EJEMPLO", "«clase» debe ser lamina o grafico.")
  }
  cat <- .recetario_ejemplos_catalogo()
  ids <- vapply(cat$recetarios, function(r) as.character(r$id), character(1))
  rec_id <- recetario %||% (if (length(ids)) ids[[length(ids)]] else "")
  cand <- Filter(function(e) {
    identical(e$recetario, rec_id) &&
      (is.null(tipo) || identical(e$tipo, tipo)) &&
      (is.null(pag) || identical(e$pagina, pag)) &&
      (is.null(clase) || identical(e$clase, clase))
  }, cat$ejemplos)
  if (!length(cand)) {
    que <- if (!is.null(tipo)) sprintf("el tipo «%s»", tipo) else sprintf("la página %d", pag)
    stop_api(404L, "E_RECETARIO_EJEMPLO_NO_EXISTE", sprintf("El recetario no trae un ejemplo para %s.", que))
  }
  e <- cand[[1]]
  ruta <- file.path(.recetario_ejemplos_dir(), e$archivo)
  hash <- if (file.exists(ruta)) digest::digest(file = ruta, algo = "sha256") else ""
  if (!identical(hash, e$sha256)) {
    stop_api(500L, "E_RECETARIO_EJEMPLO_ALTERADO",
             "El ejemplo del recetario no está o no coincide con su catálogo; reinstala la aplicación.")
  }
  mime <- if (identical(e$formato, "webp")) "image/webp" else "image/png"
  rec <- cat$recetarios[[match(rec_id, ids)]]
  list(
    ok = TRUE, clase = e$clase, tipo = e$tipo, pagina = e$pagina,
    recetario = list(id = rec$id, version = rec$version, sha256 = rec$sha256),
    ancho = e$ancho, alto = e$alto, mime = mime,
    data_uri = paste0("data:", mime, ";base64,", jsonlite::base64_enc(readBin(ruta, "raw", file.size(ruta))))
  )
}
