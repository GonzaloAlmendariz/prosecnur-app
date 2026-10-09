# Pares de gráficos de números (ADR 0093, N4): láminas 79-82 del recetario rehechas con los graficadores del
# motor (su especificación) y los renderers nativos de lamina_numericos.R, sobre el proyecto de referencia.
#
# Uso (desde la raíz del repo):
#   OUT=/ruta/numericos.pptx Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_numericos.R
#   printf "recetario,motor,nombre\n79,1,h079\n80,2,n080\n81,3,b081\n82,4,m082\n" > mapa.csv
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
o <- .lam_laminas_histograma(doc, attr(.histograma_recetario(x, modo = "conteo"), "pulso_espec"), "Edad de los estudiantes",
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
print(o$doc, target = OUT); cat("OK\n")
