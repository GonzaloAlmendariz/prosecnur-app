# Banco de conformidad (ADR 0092): mide un .pptx del motor contra api/inst/estandar/estandar_pulso.json.
# Por lámina compara la posición y el tamaño del título, el rectángulo de cada gráfico contra las ranuras de su tipo y el tamaño y la
# altura de la base. Lee el XML del paquete: posiciones en EMU, heredadas del layout cuando la lámina no las declara.
# Uso (desde la raíz del repo):
#   Rscript scripts/qa_estandar_conformidad.R <mazo.pptx> <tipos.csv> [salida.csv]
#   tipos.csv: columnas lamina, tipo (p_slide_*), como la que escribe catalogo_motor.R en modo deck.
suppressMessages({ library(xml2); library(jsonlite) })
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) stop("Uso: qa_estandar_conformidad.R <mazo.pptx> <tipos.csv> [salida.csv]")
pptx <- args[1]; tipos <- utils::read.csv(args[2], stringsAsFactors = FALSE); salida <- if (length(args) >= 3) args[3] else sub("\\.pptx$", "-conformidad.csv", pptx)
est <- jsonlite::fromJSON("api/inst/estandar/estandar_pulso.json", simplifyVector = FALSE)
G <- est$ppt$geometria; TP <- est$ppt$tipografia
TOL_IN <- 0.05; TOL_PT <- 0.5
EMU <- 914400
ns <- c(p = "http://schemas.openxmlformats.org/presentationml/2006/main", a = "http://schemas.openxmlformats.org/drawingml/2006/main",
        r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", rel = "http://schemas.openxmlformats.org/package/2006/relationships")

tmp <- tempfile("conf_"); dir.create(tmp); utils::unzip(pptx, exdir = tmp)
pres <- read_xml(file.path(tmp, "ppt/presentation.xml")); prels <- read_xml(file.path(tmp, "ppt/_rels/presentation.xml.rels"))
rid2t <- setNames(xml_attr(xml_find_all(prels, "//rel:Relationship", ns), "Target"), xml_attr(xml_find_all(prels, "//rel:Relationship", ns), "Id"))
`%||%` <- function(a, b) if (is.null(a) || all(is.na(a))) b else a
slides <- unname(rid2t[xml_attr(xml_find_all(pres, "//p:sldId", ns), "r:id", ns)])

rect_de <- function(n) { off <- xml_find_first(n, ".//a:xfrm/a:off", ns); ext <- xml_find_first(n, ".//a:xfrm/a:ext", ns)
  if (inherits(off, "xml_missing")) return(NULL)
  c(x = as.numeric(xml_attr(off, "x")) / EMU, y = as.numeric(xml_attr(off, "y")) / EMU, w = as.numeric(xml_attr(ext, "cx")) / EMU, h = as.numeric(xml_attr(ext, "cy")) / EMU) }
ph_de <- function(n) { ph <- xml_find_first(n, ".//p:nvPr/p:ph", ns); if (inherits(ph, "xml_missing")) NULL else c(type = xml_attr(ph, "type") %||% "body", idx = xml_attr(ph, "idx") %||% "") }
pt_de <- function(n) { sz <- as.numeric(xml_attr(xml_find_all(n, ".//a:rPr[@sz] | .//a:defRPr[@sz] | .//a:endParaRPr[@sz]", ns), "sz")); if (length(sz)) max(sz) / 100 else NA_real_ }
texto_de <- function(n) paste(xml_text(xml_find_all(n, ".//a:t", ns)), collapse = "")

filas <- list(); add <- function(l, tipo, medida, esperado, real, tol) { d <- real - esperado
  filas[[length(filas) + 1]] <<- data.frame(lamina = l, tipo = tipo, medida = medida, esperado = round(esperado, 3), real = round(real, 3), desvio = round(d, 3),
                                            conforme = !is.na(d) & abs(d) <= tol, stringsAsFactors = FALSE) }
tipo_std <- setNames(est$ppt$tipos_lamina, vapply(est$ppt$tipos_lamina, `[[`, "", "id"))

for (i in seq_along(slides)) {
  f <- file.path(tmp, "ppt", slides[i]); sx <- read_xml(f)
  rel <- read_xml(file.path(dirname(f), "_rels", paste0(basename(f), ".rels")))
  lay <- xml_attr(xml_find_first(rel, "//rel:Relationship[contains(@Type,'slideLayout')]", ns), "Target")
  lx <- read_xml(normalizePath(file.path(dirname(f), lay)))
  lay_ph <- lapply(xml_find_all(lx, "//p:sp", ns), function(n) list(ph = ph_de(n), r = rect_de(n), pt = pt_de(n)))
  hered <- function(ph) { for (q in lay_ph) if (!is.null(q$ph) && identical(q$ph[["type"]], ph[["type"]]) && (ph[["type"]] %in% c("title", "ctrTitle") || identical(q$ph[["idx"]], ph[["idx"]]))) return(q); NULL }
  tipo <- tipos$tipo[match(i, tipos$lamina)] %||% NA_character_
  formas <- xml_find_all(sx, "/p:sld/p:cSld/p:spTree/*[self::p:sp or self::p:pic or self::p:graphicFrame or self::p:grpSp]", ns)
  info <- lapply(formas, function(n) { ph <- ph_de(n); r <- rect_de(n); pt <- pt_de(n)
    if (!is.null(ph)) { q <- hered(ph); if (is.null(r) && !is.null(q)) r <- q$r; if (is.na(pt) && !is.null(q)) pt <- q$pt }
    list(nombre = xml_name(n), ph = ph, r = r, pt = pt, txt = texto_de(n)) })
  # título
  ti <- Filter(function(z) !is.null(z$ph) && z$ph[["type"]] %in% c("title", "ctrTitle"), info)
  if (length(ti) && !is.null(ti[[1]]$r)) { add(i, tipo, "titulo_x", G$margen_izq, ti[[1]]$r[["x"]] + 0.1, TOL_IN); add(i, tipo, "titulo_pt", TP$titulo, ti[[1]]$pt, TOL_PT) }
  # base
  ba <- Filter(function(z) grepl("^\\s*Base", z$txt), info)
  if (length(ba) && !is.null(ba[[1]]$r)) { add(i, tipo, "base_pt", TP$base, ba[[1]]$pt, TOL_PT); add(i, tipo, "base_y", G$base_y, ba[[1]]$r[["y"]], 0.1) }
  # gráficos contra ranuras del tipo
  ts <- if (!is.na(tipo)) tipo_std[[tipo]] else NULL
  if (!is.null(ts)) {
    ran <- Filter(function(z) z$tipo == "grafico", ts$ranuras)
    gr <- Filter(function(z) !is.null(z$r) && z$nombre %in% c("pic", "graphicFrame", "grpSp") && z$r[["w"]] > 1.2 && z$r[["h"]] > 0.8 && z$r[["y"]] > 0.9, info)
    if (length(gr)) { o <- order(round(vapply(gr, function(z) z$r[["y"]], 0), 1), vapply(gr, function(z) z$r[["x"]], 0)); gr <- gr[o] }
    add(i, tipo, "n_graficos", length(ran), length(gr), 0)
    for (k in seq_len(min(length(ran), length(gr)))) for (m in c("x", "y", "w", "h")) add(i, tipo, sprintf("grafico%d_%s", k, m), ran[[k]][[m]], gr[[k]]$r[[m]], TOL_IN * 2)
  } else add(i, tipo, "tipo_en_estandar", 1, 0, 0)
}
res <- do.call(rbind, filas)
utils::write.csv(res, salida, row.names = FALSE)
cat(sprintf("Láminas: %d · medidas: %d · conformes: %d (%.0f %%)\n", length(slides), nrow(res), sum(res$conforme), 100 * mean(res$conforme)))
resumen <- aggregate(cbind(conforme, desvio_abs = abs(desvio)) ~ sub("[0-9]+_", "_", medida), data = res, FUN = function(v) round(mean(v, na.rm = TRUE), 3))
names(resumen)[1] <- "medida"; print(resumen, row.names = FALSE)
cat("Detalle:", salida, "\n")
