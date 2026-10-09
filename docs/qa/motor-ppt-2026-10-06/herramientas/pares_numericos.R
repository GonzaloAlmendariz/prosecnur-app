# Pares de gráficos de números (ADR 0093, N4): láminas 79-82 y 85-87 del recetario rehechas con los graficadores del
# motor (su especificación) y los renderers nativos de lamina_numericos.R, sobre el proyecto de referencia.
#
# Uso (desde la raíz del repo):
#   OUT=/ruta/numericos.pptx Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_numericos.R
#   printf "recetario,motor,nombre\n79,1,h079\n80,2,n080\n81,3,b081\n82,4,m082\n85,5,p085\n86,6,p086\n87,7,s087\n" > mapa.csv
#   Rscript scripts/qa_pares_recetario.R /ruta/numericos.pptx mapa.csv /ruta/pares
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
OUT <- Sys.getenv("OUT", file.path(tempdir(), "numericos.pptx"))
SP <- normalizePath("tmp/motor-ppt-diag-2026-10-06/catalogo_ppt")
r <- suppressMessages(load_pulso(file.path(SP, "acrconta_mazo.pulso"))); src <- suppressMessages(.graficos_processing_sources(r$session_id))
est <- src$data_sources$estudiantes; ch <- src$inst_sources$estudiantes$choices
cc <- ch[!is.na(ch$list_name) & ch$list_name == "lst_p6", ]
ciclo <- factor(as.character(est$p6), levels = cc$name, labels = cc$label); edad <- suppressWarnings(as.numeric(est$p3))
doc <- officer::read_pptx("api/inst/plantillas/plantilla_16_9.pptx")

# 79: histograma de la edad (el recetario dibuja de 16 a 32 años).
x <- edad[is.finite(edad) & edad >= 16 & edad <= 32]
o <- .lam_laminas_histograma(doc, attr(.histograma_recetario(x, modo = "conteo", unidad = "años"), "pulso_espec"), "Edad de los estudiantes",
                             ante = "Histograma", base = "Base: 172 estudiantes que declararon su edad", folio = 79)
# 80: edad promedio por ciclo, con la espec que sella el motor.
ok <- is.finite(edad) & !is.na(ciclo)
dw <- tibble::tibble(categoria = droplevels(ciclo[ok]), x = edad[ok]) |>
  dplyr::group_by(.data$categoria) |> dplyr::summarise(N = dplyr::n(), Media = mean(.data$x), .groups = "drop")
e80 <- attr(.numerico_sellar(ggplot2::ggplot(), "mean", "Media", dw, "Media", list(decimales = 1)), "pulso_espec")
o <- .lam_laminas_numerico(o$doc, e80, "Edad promedio por ciclo", ante = "Indicador numérico", base = "Base: 172 estudiantes", folio = 80,
                           unidad_n = "estudiantes", encabezado = "Edad promedio, en años")
# 81: diagrama de caja de la edad por ciclo.
e81 <- attr(graficar_boxplot(data.frame(categoria = ciclo, valor = edad), "categoria", "valor"), "pulso_espec")
o <- .lam_laminas_boxplot(o$doc, e81, "Distribución de la edad por ciclo", ante = "Diagrama de caja", base = "Base: 172 estudiantes", folio = 81,
                          encabezado = "Edad, en años", unidad = "años", etiqueta_caja = "50 % central de las edades")
# 82: media y rango de la edad por público.
pub <- list(Docentes = c("docentes", "p4"), Estudiantes = c("estudiantes", "p3"), Egresados = c("egresados", "p4"), Administrativos = c("administrativos", "p3"))
d82 <- do.call(rbind, lapply(names(pub), function(nm) { z <- pub[[nm]]; v <- suppressWarnings(as.numeric(src$data_sources[[z[1]]][[z[2]]])); data.frame(categoria = nm, valor = v[!is.na(v)]) }))
d82$categoria <- factor(d82$categoria, levels = names(pub))
e82 <- attr(graficar_media_rango(d82, "categoria", "valor", tipo_rango = "minmax"), "pulso_espec")
o <- .lam_laminas_media_rango(o$doc, e82, "Edad por público", ante = "Media y rango", folio = 82, encabezado = "Edad, en años",
                              base = "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos", etiqueta_rango = "Rango de edades (mínimo a máximo)")
# 85: puntos comparativos, dos indicadores de la misión por público (las filas son públicos: casos por fila).
si <- function(b, v) { d <- as.character(src$data_sources[[b]][[v]]); d <- d[!is.na(d) & d != ""]; c(pct = round(100 * mean(d == "1")), n = length(d)) }
act <- c("Docentes", "Estudiantes", "Egresados", "Administrativos"); bs <- c("docentes", "estudiantes", "egresados", "administrativos")
ind <- c("Conoce la misión y los propósitos", "Sabe dónde consultarlos")
d85 <- do.call(rbind, lapply(1:4, function(i) { a <- si(bs[i], c("p9", "p7", "p14", "p6")[i]); b <- si(bs[i], c("p10", "p8", "p15", "p7")[i])
  data.frame(eje = act[i], grupo = ind, valor = c(a[["pct"]], b[["pct"]]), n = a[["n"]]) }))
d85$grupo <- factor(d85$grupo, levels = ind)
e85 <- attr(graficar_dumbbell(d85, orden = "declarado", mostrar_brecha = FALSE, limite_x = c(50, 100), titulo_eje = "% que responde Sí",
                              colores_grupos = c(.std_color("azul"), .std_color("azul_medio"))), "pulso_espec")
o <- .lam_laminas_pesas(o$doc, e85, "Conocer la misión frente a saber dónde consultarla", ante = "Puntos comparativos", folio = 85,
                        base = "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos")
# 86: brecha entre docentes y estudiantes por competencia (Top Two Box impresos en el recetario, recetario_m3c.R:29-45).
comp <- c("Auditoría", "Estados financieros", "Finanzas", "Costos y presupuestos", "Tributación", "Visión empresarial")
d86 <- data.frame(eje = rep(comp, 2), grupo = factor(rep(c("Docentes", "Estudiantes"), each = 6), levels = c("Docentes", "Estudiantes")),
                  valor = c(96, 98, 96, 92, 94, 92, 91, 96, 95, 94, 96, 94), n = rep(c(51, 109), each = 6))
e86 <- attr(graficar_dumbbell(d86, limite_x = c(80, 100), titulo_eje = "Top Two Box (De acuerdo + Totalmente de acuerdo)"), "pulso_espec")
o <- .lam_laminas_pesas(o$doc, e86, "Competencias: docentes frente a estudiantes", ante = "Brecha entre dos públicos", folio = 86,
                        base = "Base: 51 docentes y 109 estudiantes")
# 87: serie de dos mediciones (cifras del recetario).
d87 <- data.frame(eje = rep(c("Docentes", "Estudiantes"), each = 2), grupo = rep(c("2021", "2026"), 2), valor = c(98, 83, 84, 53))
e87 <- attr(graficar_serie_temporal(d87, colores_series = unname(.std_paleta("actores"))[1:2]), "pulso_espec")
o <- .lam_laminas_serie2(o$doc, e87, "Tutoría académica, 2021 y 2026", ante = "Serie temporal de dos mediciones", folio = 87,
                         encabezado = "Top Two Box", base = "Base 2026: 52 docentes y 172 estudiantes. 2021: informe consolidado anterior")
print(o$doc, target = OUT); cat("OK\n")
