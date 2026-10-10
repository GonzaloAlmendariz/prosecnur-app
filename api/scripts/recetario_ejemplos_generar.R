#!/usr/bin/env Rscript
# =============================================================================
# recetario_ejemplos_generar.R — empaqueta las láminas de ejemplo del recetario (K5, plan F6 §5.6)
# =============================================================================
#
# Uso, desde la raíz del repo:
#   Rscript api/scripts/recetario_ejemplos_generar.R [ruta/recetario.pptx] [--calidad=82] [--ancho=1280]
#
# Convierte el recetario a PDF con LibreOffice, rasteriza con pdftools las páginas de EJEMPLO listadas abajo, las
# comprime a WebP (cwebp) y escribe `api/inst/recetario/ejemplos/` con su `catalogo.json` (tipo → página → archivo →
# versión del recetario → sha256). Reemplaza los ejemplos de ese recetario y conserva los de otros: un recetario
# futuro más pulido se agrega con otro `--id` sin tocar el código del endpoint.
#
# Las páginas vienen del inventario conciliado (tmp/f6-iconos/inventario.md, tablas A.1 y B, verificado sobre las 274
# láminas). Sólo tipos que el motor produce: no se empaquetan fichas «TIPO DE LÁMINA n DE 22» (son documentación) ni
# páginas de propuesta (torta con leyenda de cifras p69, composición de mapa p105, conteos por año p85, peso en la
# satisfacción p97…). Si el recetario se regenera y las páginas se corren, el script lo detecta por el rótulo.
#
# Dependencias de desarrollo: LibreOffice (`soffice`) y `cwebp` (libwebp). Sin cwebp deja PNG.

args <- commandArgs(trailingOnly = TRUE)
opcion <- function(nombre, defecto) {
  hit <- grep(sprintf("^--%s=", nombre), args, value = TRUE)
  if (length(hit)) sub(sprintf("^--%s=", nombre), "", hit[1]) else defecto
}
posicionales <- args[!grepl("^--", args)]
raiz <- if (dir.exists("api/R")) "." else ".."
pptx <- if (length(posicionales)) posicionales[1] else file.path(raiz, "docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx")
if (grepl("Repaired", basename(pptx), fixed = TRUE)) stop("No uses la copia «Repaired» del recetario.", call. = FALSE)
id_recetario <- opcion("id", "recetario-moderna")
calidad <- as.integer(opcion("calidad", "82"))
ancho <- as.integer(opcion("ancho", "1280"))
destino <- file.path(raiz, "api", "inst", "recetario", "ejemplos")
stopifnot(file.exists(pptx))

# clase, tipo (nombre del registro), página del ejemplo, rótulo con que empieza la página (detecta páginas corridas).
EJEMPLOS <- read.csv(text = '
clase,tipo,pagina,rotulo
lamina,p_slide_1_grafico,124,
lamina,p_slide_1_grafico_narrativo,126,
lamina,p_slide_grafico_texto_derecha,128,GRÁFICO CON TEXTO A LA DERECHA
lamina,p_slide_grafico_texto_izquierda,130,GRÁFICO CON TEXTO A LA IZQUIERDA
lamina,p_slide_texto,132,TEXTO
lamina,p_slide_2_graficos,135,DOS GRÁFICOS
lamina,p_slide_2_graficos_narrativo,138,DOS GRÁFICOS CON NARRATIVA
lamina,p_slide_2_graficos_texto_izquierda,140,DOS GRÁFICOS CON TEXTO A LA IZQUIERDA
lamina,p_slide_2_graficos_texto_derecha,142,DOS GRÁFICOS CON TEXTO A LA DERECHA
lamina,p_slide_2_graficos_vertical,144,DOS GRÁFICOS APILADOS
lamina,p_slide_2_graficos_asimetrico,146,GRÁFICO PRINCIPAL Y GRÁFICO DE APOYO
lamina,p_slide_3_graficos_2mas1,149,TRES GRÁFICOS: DOS APILADOS Y UNO ALTO
lamina,p_slide_3_graficos_1mas2,151,TRES GRÁFICOS: UNO ALTO Y DOS APILADOS
lamina,p_slide_3_graficos_1arriba,154,TRES GRÁFICOS: UNO ANCHO ARRIBA
lamina,p_slide_3_graficos_fila,156,TRES GRÁFICOS EN FILA
lamina,p_slide_3_graficos_poblacion_tira,158,TRES GRÁFICOS EN TIRA
lamina,p_slide_3_graficos_poblacion_corona,160,TRES GRÁFICOS EN CORONA
lamina,p_slide_4_graficos,162,CUATRO GRÁFICOS
lamina,p_slide_5_graficos_poblacion,164,CINCO GRÁFICOS
lamina,p_slide_6_graficos_poblacion,166,SEIS GRÁFICOS
lamina,p_slide_3_graficos_poblacion_cifras,169,CIFRAS EN COLUMNA LATERAL
lamina,p_slide_cifras_y_graficos,171,CIFRAS EN BANDA SUPERIOR
grafico,p_barras_categoricas,68,BARRAS CATEGÓRICAS
grafico,p_donut,70,GRÁFICO DE DONA
grafico,p_barras_divergentes,71,BARRAS DIVERGENTES
grafico,p_lollipop,72,RANKING CON PUNTOS
grafico,p_barras_agrupadas,73,RANKING EN BARRAS
grafico,p_barras_multiapiladas,78,ESCALA DE UTILIDAD
grafico,p_histograma,81,HISTOGRAMA
grafico,p_numerico,82,INDICADOR NUMÉRICO
grafico,p_boxplot,83,DIAGRAMA DE CAJA
grafico,p_media_rango,84,MEDIA Y RANGO
grafico,p_puntos_comparativos,87,PUNTOS COMPARATIVOS
grafico,p_dumbbell,88,BRECHA ENTRE DOS PÚBLICOS
grafico,p_serie_temporal,89,SERIE TEMPORAL DE DOS MEDICIONES
grafico,p_radar,92,RADAR CON TABLA
grafico,p_dim_heatmap,94,MAPA DE CALOR POR DIMENSIÓN
grafico,p_dim_heatmap_criterios,95,MAPA DE CALOR POR CRITERIO
grafico,p_dim_comparativo_radarbar,96,COMPARATIVO DE DIMENSIONES
grafico,p_dim_radar,98,RADAR POR DIMENSIONES
grafico,p_nube_palabras,100,NUBE DE PALABRAS
grafico,p_mapa_resultado_distrital,106,MAPA DE LIMA: RESULTADO POR DISTRITO
grafico,p_cifra,172,CIFRA EN LUGAR DE UN GRÁFICO
grafico,p_tabla,197,PERFIL EN TABLA
', stringsAsFactors = FALSE, encoding = "UTF-8", na.strings = character(0))

sha256 <- function(f) digest::digest(file = f, algo = "sha256")
tmp <- tempfile("recetario_ejemplos_"); dir.create(tmp)
on.exit(unlink(tmp, recursive = TRUE, force = TRUE), add = TRUE)

soffice <- Sys.which("soffice")
if (!nzchar(soffice)) soffice <- "/Applications/LibreOffice.app/Contents/MacOS/soffice"
stopifnot(file.exists(soffice))
copia <- file.path(tmp, "recetario.pptx"); file.copy(pptx, copia)
perfil <- paste0("-env:UserInstallation=file://", file.path(tmp, "lo-perfil"))
system2(soffice, c(perfil, "--headless", "--convert-to", "pdf", "--outdir", shQuote(tmp), shQuote(copia)), stdout = FALSE, stderr = FALSE)
pdf <- file.path(tmp, "recetario.pdf")
if (!file.exists(pdf)) stop("LibreOffice no produjo el PDF.", call. = FALSE)
textos <- pdftools::pdf_text(pdf)
info <- pdftools::pdf_pagesize(pdf)
cat(sprintf("Recetario: %d páginas\n", length(textos)))

# Una página corrida o de otro tipo se detecta antes de escribir nada.
norm <- function(x) toupper(gsub("[[:space:]]+", " ", trimws(x)))
for (i in seq_len(nrow(EJEMPLOS))) {
  r <- EJEMPLOS[i, ]
  if (r$pagina > length(textos)) stop(sprintf("%s: la página %d no existe.", r$tipo, r$pagina), call. = FALSE)
  if (nzchar(r$rotulo) && !startsWith(norm(textos[r$pagina]), norm(r$rotulo))) {
    stop(sprintf("%s: la página %d no empieza con «%s» (empieza con «%s»). ¿Se corrieron las páginas?",
                 r$tipo, r$pagina, r$rotulo, substr(norm(textos[r$pagina]), 1, 60)), call. = FALSE)
  }
  if (grepl("TIPO DE L[ÁA]MINA [0-9]+ DE 22", norm(textos[r$pagina]))) stop(sprintf("%s: la página %d es una ficha.", r$tipo, r$pagina), call. = FALSE)
}

dir.create(destino, recursive = TRUE, showWarnings = FALSE)
cwebp <- Sys.which("cwebp")
ext <- if (nzchar(cwebp)) "webp" else "png"
ejemplos <- list()
for (i in seq_len(nrow(EJEMPLOS))) {
  r <- EJEMPLOS[i, ]
  dpi <- ancho / (info$width[r$pagina] / 72)
  png_tmp <- file.path(tmp, sprintf("p%03d.png", r$pagina))
  png::writePNG(pdftools::pdf_render_page(pdf, page = r$pagina, dpi = dpi, numeric = TRUE), png_tmp)
  archivo <- sprintf("%s-%s-p%03d.%s", r$clase, r$tipo, r$pagina, ext)
  salida <- file.path(destino, archivo)
  if (nzchar(cwebp)) {
    system2(cwebp, c("-quiet", "-q", calidad, "-m", "6", "-metadata", "none", shQuote(png_tmp), "-o", shQuote(salida)))
  } else {
    file.copy(png_tmp, salida, overwrite = TRUE)
  }
  dims <- dim(png::readPNG(png_tmp))
  ejemplos[[length(ejemplos) + 1L]] <- list(
    clase = r$clase, tipo = r$tipo, pagina = r$pagina, recetario = id_recetario, archivo = archivo,
    formato = ext, ancho = dims[2], alto = dims[1], bytes = file.size(salida), sha256 = sha256(salida),
    rotulo = substr(gsub("[[:space:]]+", " ", trimws(textos[r$pagina])), 1, 80)
  )
  cat(sprintf("  %-7s %-38s p%-3d %7.1f KB\n", r$clase, r$tipo, r$pagina, file.size(salida) / 1024))
}

ruta_catalogo <- file.path(destino, "catalogo.json")
previo <- if (file.exists(ruta_catalogo)) jsonlite::fromJSON(ruta_catalogo, simplifyVector = FALSE) else list(recetarios = list(), ejemplos = list())
# Se conservan los ejemplos de otros recetarios; los de éste se reemplazan (y sus archivos viejos se borran).
viejos <- Filter(function(e) identical(e$recetario, id_recetario), previo$ejemplos)
for (e in viejos) if (!e$archivo %in% vapply(ejemplos, `[[`, "", "archivo")) unlink(file.path(destino, e$archivo))
otros <- Filter(function(e) !identical(e$recetario, id_recetario), previo$ejemplos)
recetarios <- Filter(function(r) !identical(r$id, id_recetario), previo$recetarios)
estandar <- jsonlite::fromJSON(file.path(raiz, "api", "inst", "estandar", "estandar_pulso.json"), simplifyVector = FALSE)
recetarios[[length(recetarios) + 1L]] <- list(
  id = id_recetario,
  version = estandar$version,
  fuente = sub(paste0("^", normalizePath(raiz), "/"), "", normalizePath(pptx)),
  sha256 = sha256(pptx),
  paginas = length(textos),
  generado = format(Sys.Date())
)
catalogo <- list(
  formato = 1L,
  descripcion = "Ejemplos del recetario por tipo de lámina y de gráfico. Generado por api/scripts/recetario_ejemplos_generar.R; no editar a mano.",
  recetarios = recetarios,
  ejemplos = c(otros, ejemplos)
)
con <- file(ruta_catalogo, open = "w", encoding = "UTF-8")
writeLines(as.character(jsonlite::toJSON(catalogo, auto_unbox = TRUE, pretty = TRUE)), con)
close(con)
total <- sum(vapply(ejemplos, `[[`, numeric(1), "bytes"))
cat(sprintf("%d ejemplos, %.2f MB en %s\n", length(ejemplos), total / 1024^2, destino))
