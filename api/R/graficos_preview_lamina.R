# Vista previa de una lámina: sus partes y si salió nativa (F6.0b; inventario F6, parte C).
#
# El endpoint `/api/graficos/preview-slide` arma un mini-PPTX con el mismo motor del export y rasterizaba sólo la lámina 1:
# una escala que se parte traía su «(cont.)» dentro del archivo y nadie la veía, y la respuesta no decía si la lámina había
# salido con formas nativas o por la ruta anterior (imagen). Gonzalo, 2026-10-09: «comprueba que la app pueda realmente
# mostrar la lamina tal cual como lo publicitas». Aquí se lee el mini-PPTX ya armado —barato: sólo descomprimir el XML— y
# se rasterizan todas sus partes con una sola conversión a PDF.

#' Láminas de un PPTX, en el orden de la presentación
#'
#' @return Vector con las rutas internas (`ppt/slides/slideN.xml`) en el orden de `presentation.xml`; si ese orden no se
#'   puede leer, en orden numérico.
#' @keywords internal
.pptx_slide_paths <- function(pptx_path) {
  nombres <- tryCatch(utils::unzip(pptx_path, list = TRUE)$Name, error = function(e) character())
  slides <- grep("^ppt/slides/slide[0-9]+\\.xml$", nombres, value = TRUE)
  if (!length(slides)) return(character())
  numericas <- slides[order(as.integer(sub("^ppt/slides/slide([0-9]+)\\.xml$", "\\1", slides)))]
  orden <- tryCatch({
    pres <- .pptx_leer_parte(pptx_path, "ppt/presentation.xml")
    rels <- .pptx_leer_parte(pptx_path, "ppt/_rels/presentation.xml.rels")
    ids <- regmatches(pres, gregexpr('<p:sldId [^>]*r:id="[^"]+"', pres))[[1]]
    ids <- sub('.*r:id="([^"]+)".*', "\\1", ids)
    destino <- vapply(ids, function(id) {
      m <- regmatches(rels, regexpr(sprintf('<Relationship [^>]*Id="%s"[^>]*>', id), rels))
      if (!length(m)) return(NA_character_)
      paste0("ppt/", sub('.*Target="([^"]+)".*', "\\1", m))
    }, character(1))
    destino[!is.na(destino) & destino %in% slides]
  }, error = function(e) character())
  if (length(orden) == length(slides)) unname(orden) else numericas
}

#' Lee una parte del zip como texto UTF-8
#' @keywords internal
.pptx_leer_parte <- function(pptx_path, parte) {
  con <- unz(pptx_path, parte, encoding = "UTF-8")
  on.exit(close(con), add = TRUE)
  paste(readLines(con, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
}

#' Grupos del motor nativo que no son gráficos: encabezado, pie y láminas de estructura
#' @keywords internal
.PREVIEW_GRUPOS_ESTRUCTURA <- c("titulo", "pie", "narrativa", "top_two_box", "seccion", "redondeo", "portada",
                                "objetivo", "indice", "ficha", "cierre")

#' Cómo salió una lámina
#'
#' El motor nativo agrupa lo que dibuja en formas nombradas `prosecnur:*`. Un gráfico es `prosecnur:grafico:<tipo>` o una
#' ranura de una lámina compuesta (`prosecnur:poblacion_4:up_left`, `prosecnur:slide_1:…`); el encabezado, el pie y las
#' láminas de estructura (`prosecnur:titulo`, `prosecnur:objetivo`, `prosecnur:seccion`…) no son gráficos. La ruta anterior
#' no deja esos nombres y pega imágenes (`<p:pic>`): así sale hoy el índice con argumentos de focos (inventario F6, A9).
#' Verificador de 55ff0d1bf: la regla anterior llamaba «nativa» a la lámina de objetivo, que no tiene gráfico.
#' @return «nativa» (gráfico con formas nativas), «estructura» (la dibujó el motor y no lleva gráfico), «ruta_anterior»
#'   (sin formas del motor y con imágenes) o «sin_grafico» (ni formas del motor ni imágenes: texto o plantilla).
#' @keywords internal
.pptx_lamina_estado <- function(xml) {
  grupos <- regmatches(xml, gregexpr('name="prosecnur:[^"]+"', xml))[[1]]
  # Una imagen pegada en una ranura (`ph_label = "prosecnur:slide_1:right"`, la ruta anterior) lleva el nombre de la
  # ranura en su propio `<p:nvPicPr>`: ese nombre no es una forma nativa (hallazgo del autor de 3409b0aa8).
  de_imagen <- regmatches(xml, gregexpr('<p:nvPicPr>\\s*<p:cNvPr[^>]*name="prosecnur:[^"]+"', xml, perl = TRUE))[[1]]
  de_imagen <- sub('^.*name="(prosecnur:[^"]+)"$', 'name="\\1"', de_imagen)
  for (d in de_imagen) grupos <- grupos[-match(d, grupos)]
  grupos <- sub('^name="prosecnur:([^"]+)"$', "\\1", grupos)
  if (length(grupos) || length(de_imagen)) {
    raiz <- sub(":.*$", "", grupos)
    # Sólo el motor nativo agrupa sus gráficos como `prosecnur:grafico:*`. Una ranura `prosecnur:<tipo>:<ranura>`
    # (`slide_1:plot`, `poblacion_4:up_left`) la nombra la ruta anterior al pegar su dibujo DML o su imagen: no es nativa
    # (verificador de 87d9fcbb0: con motor_nativo = FALSE la escala, la multilista y la población de 4 salían «nativa»).
    ranura <- raiz != "grafico" & grepl(":", grupos, fixed = TRUE) & !raiz %in% .PREVIEW_GRUPOS_ESTRUCTURA
    return(if (any(raiz == "grafico")) "nativa" else if (any(ranura) || length(de_imagen)) "ruta_anterior" else "estructura")
  }
  if (grepl("<p:pic>", xml, fixed = TRUE) || grepl("<p:pic ", xml, fixed = TRUE)) return("ruta_anterior")
  "sin_grafico"
}

#' Título visible de una lámina
#'
#' El motor escribe el título en la forma «Titulo lamina» (y el antetítulo en «Antetitulo lamina»); las láminas de
#' estructura lo ponen en `<familia>:titulo` (`objetivo:titulo`). Si el título quedó vacío (la explicación del Top Two
#' Box) vale el antetítulo; sin ninguna de esas formas, el primer texto de la lámina. Verificador de 55ff0d1bf: tomar «el
#' texto más largo» devolvía el cuerpo del objetivo y el antetítulo de «Cómo leer».
#' @keywords internal
.pptx_lamina_titulo <- function(xml) {
  xml <- gsub("\n", " ", xml, fixed = TRUE)
  .textos <- function(x) {
    t <- regmatches(x, gregexpr("<a:t>([^<]*)</a:t>", x))[[1]]
    t <- trimws(sub("^<a:t>(.*)</a:t>$", "\\1", t))
    t[nzchar(t)]
  }
  .de_forma <- function(patron_nombre) {
    formas <- regmatches(xml, gregexpr("<p:sp>.*?</p:sp>", xml, perl = TRUE))[[1]]
    f <- formas[grepl(patron_nombre, formas, perl = TRUE)]
    if (!length(f)) return("")
    paste(.textos(f[[1]]), collapse = " ")
  }
  for (patron in c('name="Titulo lamina"', 'name="Antetitulo lamina"', 'name="[a-z_]+:titulo"')) {
    t <- .de_forma(patron)
    if (nzchar(t)) return(t)
  }
  t <- .textos(xml)
  if (length(t)) t[[1]] else ""
}

#' Partes de la lámina que salió en el mini-PPTX de la vista previa
#'
#' @return `list(n, partes)`, con una entrada por lámina: `indice`, `titulo`, `estado` (ver `.pptx_lamina_estado`) y
#'   `continuacion` (si su título lleva «(cont.)»). `n = 0` si el archivo no se puede leer.
#' @keywords internal
.preview_partes <- function(pptx_path) {
  slides <- .pptx_slide_paths(pptx_path)
  partes <- lapply(seq_along(slides), function(i) {
    xml <- tryCatch(.pptx_leer_parte(pptx_path, slides[[i]]), error = function(e) "")
    titulo <- .pptx_lamina_titulo(xml)
    list(indice = i, titulo = titulo, estado = .pptx_lamina_estado(xml),
         continuacion = grepl("(cont.)", titulo, fixed = TRUE))
  })
  list(n = length(partes), partes = partes)
}

#' Rasteriza las partes del mini-PPTX (hasta `max_partes`)
#'
#' Con LibreOffice convierte una sola vez a PDF y rasteriza cada página; con el renderer de artefactos, lámina por lámina
#' (un proceso por parte: ~10 s cada una, por eso el endpoint sólo pide todas cuando el cliente lo solicita). La parte 1 es
#' la misma que devolvía `.render_pptx_slide_preview`.
#' @return Lista alineada con las partes: el elemento k es el payload de la parte k (`png_base64`, `width`, `height`,
#'   `renderer`, `indice`) o `NULL` si esa parte no se pudo rasterizar (la API lo serializa como `{}`: un objeto sin
#'   `indice` es un hueco); vacía si no hay renderer. El atributo `truncado`
#'   vale `TRUE` cuando había más partes que `max_partes`.
#' @keywords internal
.render_pptx_preview_partes <- function(pptx_path, n_partes, preview_quality = "quick", max_partes = 6L) {
  preview_quality <- if (identical(tolower(as.character(preview_quality %||% "quick")), "normal")) "normal" else "quick"
  dpi <- if (preview_quality == "quick") 160L else 220L
  timeout <- if (preview_quality == "quick") 12L else 30L
  total <- suppressWarnings(as.integer(n_partes %||% 1L))
  if (is.na(total) || total < 1L) total <- 1L
  n <- min(total, as.integer(max_partes))
  tmpdir <- tempfile("pptx_preview_partes_")
  dir.create(tmpdir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmpdir, recursive = TRUE, force = TRUE), add = TRUE)
  .con_indice <- function(out) {
    out <- lapply(seq_along(out), function(i) if (is.null(out[[i]])) NULL else c(out[[i]], list(indice = i)))
    if (all(vapply(out, is.null, logical(1)))) out <- list()
    attr(out, "truncado") <- total > n
    out
  }

  if (.preview_usar_artifact()) {
    out <- lapply(seq_len(n), function(i) .render_pptx_slide_png_artifact(pptx_path, tmpdir, slide_index = i, timeout = timeout, scale = max(1, dpi / 96)))
    if (!is.null(out[[1]])) return(.con_indice(out))
  }
  pdf_path <- .pptx_to_pdf_soffice(pptx_path, tmpdir, timeout = timeout + 4L * (n - 1L))
  if (is.null(pdf_path)) return(.con_indice(list(NULL)))
  .con_indice(lapply(seq_len(n), function(i) .pdf_page_to_png(pdf_path, tmpdir, "soffice", page = i, dpi = dpi, timeout = timeout)))
}

#' Perfil de LibreOffice para una conversión: el de la sesión R si está libre, uno nuevo si no
#'
#' Crear el perfil desde cero cuesta ~1 s de cada conversión (medido 2026-10-10: 3.0 s con perfil nuevo, 1.95 s
#' reutilizado, en una lámina). Dos soffice no pueden compartir perfil a la vez, así que el reutilizado se toma con un
#' candado (`dir.create` es atómico) y, si otra conversión lo tiene, ésta usa uno propio dentro de `out_dir`.
#' @keywords internal
.preview_perfil_tomar <- function(out_dir, raiz = tempdir()) {
  compartido <- file.path(raiz, "prosecnur-lo-perfil")
  candado <- paste0(compartido, ".candado")
  if (isTRUE(dir.create(candado, showWarnings = FALSE))) {
    dir.create(compartido, recursive = TRUE, showWarnings = FALSE)
    return(list(dir = compartido, compartido = TRUE, liberar = function() unlink(candado, recursive = TRUE)))
  }
  propio <- file.path(out_dir, "lo-profile")
  dir.create(propio, recursive = TRUE, showWarnings = FALSE)
  list(dir = propio, compartido = FALSE, liberar = function() invisible(NULL))
}

#' ¿La vista previa usa el renderer de desarrollo (artifact-tool)?
#'
#' Sólo si no hay LibreOffice utilizable o si se pide con `PROSECNUR_PREFER_ARTIFACT_RENDERER`. Antes tenía prioridad
#' siempre que estuviera instalado: en una máquina de desarrollo la vista previa iba por él (17,4 s medidos por la
#' auditoría del editor, contra 1,9 s de LibreOffice en caliente) y no por el renderer que lleva el instalador.
#' @keywords internal
.preview_usar_artifact <- function() {
  if (!.artifact_renderer_configured()) return(FALSE)
  if (tolower(Sys.getenv("PROSECNUR_PREFER_ARTIFACT_RENDERER", unset = "")) %in% c("1", "true", "yes")) return(TRUE)
  !(nzchar(.soffice_cmd()) && isTRUE(.preview_rasterizer_status()$available))
}

#' Un argumento de `system2` con comillas para el shell de la plataforma
#'
#' `system2` pone comillas al comando pero no a los argumentos: una ruta con espacios («C:/Users/Juan Pérez/…», lo normal
#' en Windows) partía la llamada a soffice o a pdftoppm y la vista previa salía vacía sin aviso (plan de empaquetado, P1).
#' @keywords internal
.preview_arg <- function(x) shQuote(x, type = if (identical(.Platform$OS.type, "windows")) "cmd" else "sh")

#' URI `file://` del perfil propio de LibreOffice, con la ruta codificada
#'
#' Espacios y tildes van como `%XX` (UTF-8); `/` y `:` se conservan. Una ruta de Windows («C:/…») lleva la barra inicial.
#' @keywords internal
.preview_profile_uri <- function(dir) {
  ruta <- normalizePath(dir, winslash = "/", mustWork = FALSE)
  if (!startsWith(ruta, "/")) ruta <- paste0("/", ruta)
  paste0("file://", utils::URLencode(enc2utf8(ruta), reserved = FALSE))
}

#' Rasteriza una página de un PDF con pdftools
#' @return Ruta del PNG escrito, o `NULL` si pdftools no está o falla.
#' @keywords internal
.pdf_page_to_png_pdftools <- function(pdf_path, out_dir, page = 1L, dpi = 220) {
  if (!requireNamespace("pdftools", quietly = TRUE)) return(NULL)
  png_path <- file.path(out_dir, sprintf("slide_preview_%03d.png", as.integer(page)))
  ok <- tryCatch({
    bitmap <- pdftools::pdf_render_page(pdf_path, page = as.integer(page), dpi = dpi, numeric = TRUE)
    png::writePNG(bitmap, png_path)
    file.exists(png_path)
  }, error = function(e) FALSE)
  if (isTRUE(ok)) png_path else NULL
}

#' Quién pasa el PDF de LibreOffice a PNG
#' @return `list(available, id)`: «pdftools», «pdftoppm» o `NA`.
#' @keywords internal
.preview_rasterizer_status <- function() {
  if (requireNamespace("pdftools", quietly = TRUE)) return(list(available = TRUE, id = "pdftools"))
  if (nzchar(.first_available_cmd(c("pdftoppm")))) return(list(available = TRUE, id = "pdftoppm"))
  list(available = FALSE, id = NA_character_)
}

#' Antetítulo que la lámina hereda en el informe
#'
#' En el export el antetítulo es el título del último separador (`p_slide_seccion`) antes de la lámina
#' (`.lam_antetitulos`). La vista previa arma un mini-plan de una sola lámina y lo perdía: la escala 13 de acrconta
#' difería del export en 3.707 px por eso (inventario F6, parte C).
#' @param plan_slides Láminas del plan guardado (`cfg$plan$slides`), en el formato del editor (`id`, `tipo`, `payload`).
#' @return El título del separador vigente para la lámina `slide_id`, o `NULL` si no la encuentra o no hay separador.
#' @keywords internal
.preview_antetitulo_vigente <- function(plan_slides, slide_id) {
  if (is.null(slide_id) || !nzchar(as.character(slide_id)[1])) return(NULL)
  vigente <- NULL
  for (x in plan_slides) {
    if (identical(as.character(x$tipo %||% "")[1], "p_slide_seccion")) {
      t <- as.character((x$payload %||% list())$titulo %||% "")[1]
      vigente <- if (!is.na(t) && nzchar(trimws(t))) t else vigente
    }
    if (identical(as.character(x$id %||% "")[1], as.character(slide_id)[1])) return(vigente)
  }
  NULL
}

#' La lámina de la vista previa con el antetítulo que hereda, salvo que ya fije uno o sea un separador
#' @keywords internal
.preview_con_antetitulo <- function(slide, plan_slides) {
  if (identical(as.character(slide$tipo %||% "")[1], "p_slide_seccion")) return(slide)
  meta <- (slide$payload %||% list())$meta %||% list()
  if (!is.null(meta$antetitulo)) return(slide)
  ante <- .preview_antetitulo_vigente(plan_slides, slide$id)
  if (is.null(ante)) return(slide)
  meta$antetitulo <- ante
  slide$payload$meta <- meta
  slide
}

#' Evalúa `expr` y recoge los avisos sellados del motor (`[PULSO-AVISO]`) que emite como mensajes
#'
#' Los demás mensajes siguen su curso; los sellados no se imprimen y vuelven, sin repetir, para que la vista previa diga
#' por qué una lámina salió distinta (una columna omitida, la ruta anterior).
#' @return `list(valor, avisos)`.
#' @keywords internal
.preview_con_avisos <- function(expr) {
  avisos <- character(0)
  valor <- withCallingHandlers(expr, message = function(m) {
    texto <- conditionMessage(m)
    if (grepl(.PULSO_AVISO_SELLO, texto, fixed = TRUE)) {
      avisos <<- c(avisos, trimws(sub(paste0(".*", gsub("([][])", "\\\\\\1", .PULSO_AVISO_SELLO)), "", texto)))
      invokeRestart("muffleMessage")
    }
  })
  list(valor = valor, avisos = unique(avisos[nzchar(avisos)]))
}
