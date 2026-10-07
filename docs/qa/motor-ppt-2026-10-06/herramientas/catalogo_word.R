# Catálogo editable de láminas y gráficos del motor PPT (Word).
# Fuente: .SLIDES_META y .GRAFICADORES_META del paquete (exportados a catalogo.json),
# censo de uso de planes reales y el recetario remasterizado.
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages({ library(officer); library(flextable); library(jsonlite) })
N <- "docs/qa/motor-ppt-2026-10-06"
cat_ <- fromJSON(file.path(N, "herramientas", "catalogo.json"))
G <- cat_$graficadores; S <- cat_$laminas
limpia <- function(x) trimws(gsub("\\s*[\u2014\u2013]\\s*", ", ", gsub("\u00b7", ",", x)))
S$desc <- limpia(S$desc); G$desc <- limpia(G$desc)
NAVY <- "#081F5C"; CORAL <- "#CA5651"; SOFT <- "#5A6480"; ZEBRA <- "#EEF1F5"; LINE <- "#C9D0DB"; FONT <- "Arial"

# ---- uso real (censo sin duplicados: 6 estudios, 402 láminas, 365 gráficos)
uso_g <- c(p_barras_apiladas = "42,2 %", p_barras_agrupadas = "41,9 %", p_barras_multiapiladas = "13,7 %", p_pie = "1,1 %",
           p_radar = "0,5 %", p_donut = "0,3 %", p_histograma = "0,3 %")
uso_s <- c(p_slide_1_grafico = "78,1 %", p_slide_seccion = "10,7 %", p_slide_1_grafico_narrativo = "3,5 %", p_slide_2_graficos_narrativo = "1,7 %",
           p_slide_portada = "1,5 %", p_slide_tabla_tecnica = "1,0 %", p_slide_indice = "0,7 %", p_slide_3_graficos_poblacion = "0,7 %",
           p_slide_4_graficos_poblacion = "0,7 %", p_slide_top_two_box = "0,5 %", p_slide_2_graficos = "0,2 %", p_slide_objetivo_icono = "0,2 %",
           p_slide_texto = "0,2 %")
# ---- presencia en el recetario moderno (número de lámina)
rec_s <- c(p_slide_portada = "1", p_slide_objetivo_icono = "2", p_slide_tabla_tecnica = "3", p_slide_indice = "4", p_slide_seccion = "5, 11",
           p_slide_top_two_box = "6", p_slide_redondeo = "7", p_slide_4_graficos_poblacion = "8", p_slide_3_graficos_poblacion = "9",
           p_slide_3_graficos_fila = "10", p_slide_1_grafico = "12 a 21, 23", p_slide_1_grafico_narrativo = "22, 24", p_slide_texto = "25",
           p_slide_2_graficos = "sólo en la fiel")
rec_g <- c(p_barras_agrupadas = "8, 9, 10, 22", p_histograma = "8", p_pie = "sólo en la fiel (9, 23)", p_barras_multiapiladas = "12, 13, 15 a 20, 23, 24",
           p_barras_apiladas = "14", p_radar = "sólo en la fiel (21)", p_tabla = "21 (propuesta)", p_puntos_comparativos = "21 (propuesta)")
fam_g <- c(distribution = "Distribución", text = "Texto", territory = "Territorio", numeric = "Numérico", comparison = "Comparación", dimensions = "Dimensiones")
fam_s <- c(estructural = "Estructural", `1grafico` = "Un gráfico", `2graficos` = "Dos gráficos", `3graficos` = "Tres gráficos", `4graficos` = "Cuatro gráficos", poblacion = "Población (con ícono)")

val <- function(v, k, def = "") ifelse(k %in% names(v), v[k], def)
ANCHO_UTIL <- 10.4   # A4 horizontal con márgenes de 0,55 in
SEC_H <- block_section(prop_section(page_size = page_size(orient = "landscape"),
  page_margins = page_mar(left = 0.55, right = 0.55, top = 0.6, bottom = 0.6, header = 0.3, footer = 0.3)))
SEC_V <- block_section(prop_section(page_size = page_size(orient = "portrait"),
  page_margins = page_mar(left = 0.9, right = 0.9, top = 0.9, bottom = 0.9, header = 0.4, footer = 0.4)))
tabla <- function(df, anchos, editable = c()) {
  anchos <- anchos * ANCHO_UTIL / sum(anchos)
  ft <- flextable(df) |> font(fontname = FONT, part = "all") |> fontsize(size = 9, part = "body") |> fontsize(size = 9.5, part = "header") |>
    bold(part = "header") |> color(color = "#FFFFFF", part = "header") |> bg(bg = NAVY, part = "header") |>
    color(color = NAVY, part = "body") |> bold(j = 1, part = "body") |> valign(valign = "top", part = "all") |>
    bg(i = seq(2, nrow(df), 2), bg = ZEBRA, part = "body") |> border_remove() |>
    hline(border = fp_border(color = LINE, width = 0.5), part = "body") |> padding(padding = 4, part = "all") |> width(width = anchos)
  if (length(editable)) ft <- ft |> bg(j = editable, bg = "#FFF8E6", part = "body") |> bg(j = editable, bg = CORAL, part = "header")
  ft |> set_table_properties(layout = "fixed")
}
p <- function(txt, size = 10.5, color = NAVY, bold = FALSE, italic = FALSE)
  fpar(ftext(txt, fp_text(font.family = FONT, font.size = size, color = color, bold = bold, italic = italic)), fp_p = fp_par(padding.bottom = 4))
h <- function(doc, txt, nivel = 1) body_add_fpar(doc, fpar(ftext(txt, fp_text(font.family = FONT, font.size = if (nivel == 1) 16 else 12.5,
  color = if (nivel == 1) CORAL else NAVY, bold = TRUE)), fp_p = fp_par(padding.top = 10, padding.bottom = 6)))
vin <- function(doc, items) { for (x in items) doc <- body_add_fpar(doc, fpar(ftext("•  ", fp_text(font.family = FONT, font.size = 10.5, color = CORAL, bold = TRUE)),
  ftext(x, fp_text(font.family = FONT, font.size = 10.5, color = NAVY)), fp_p = fp_par(padding.left = 12, padding.bottom = 3))); doc }

doc <- read_docx()
doc <- body_add_fpar(doc, p("Catálogo de láminas y gráficos del motor PPT", 22, CORAL, TRUE))
doc <- body_add_fpar(doc, p("Base para el recetario remasterizado de Prosecnur. Documento de trabajo, editable. 6 de octubre de 2026.", 11, SOFT))
doc <- h(doc, "Para qué sirve este documento")
doc <- body_add_fpar(doc, p(paste("Reúne todo lo que el motor de PPT de Prosecnur sabe generar: los 32 tipos de lámina y los 24 tipos de gráfico,",
  "con su nombre en la app, su constructor en el código, para qué sirve, cuánto se usa en los planes reales y si ya está en el recetario.",
  "Las columnas en amarillo están vacías a propósito: sirven para decidir qué entra al recetario moderno y con qué variante.")))
doc <- h(doc, "Cómo completarlo", 2)
doc <- vin(doc, c("«¿Entra?»: Sí, No o Variante. Una lámina o gráfico que no se usa en los informes reales puede quedar fuera aunque el motor lo tenga.",
  "«Variante o comentario»: cómo debe verse, qué caso real lo justifica o qué evitar.",
  "Uso real: porcentaje sobre 365 gráficos y 402 láminas de 6 estudios con plan guardado (ACRD CONTA, ACRD ING, SELLO MUJER trabajadoras y directivas, ACNUR PDM, GIZ). Vacío significa que no aparece en ningún plan.",
  "Recetario: número de lámina en el recetario moderno de esta fecha."))
doc <- h(doc, "Criterios ya acordados", 2)
doc <- vin(doc, c("Paleta validada: escala F4B183, FFD965, ADD493, 70AD47 y BFBFBF (SIN INF); texto 081F5C; títulos CA5651. No se cambia.",
  "No se agregan notas que el informe no trae (base chica, notas de lectura, subtítulos explicativos). El Top Two Box conserva su nombre.",
  "Los porcentajes de 1 % se ven: fuera del segmento, con una guía, sin taparse entre sí.",
  "Si no cabe, la lámina se parte con «(cont.)»; la letra no encoge.",
  "Los comparativos entre años no son habituales: se catalogan como uso excepcional, no como caso típico.",
  "El recetario sólo incluye lo que el motor genera; lo que el equipo arma a mano en el informe final (tarjetas cualitativas, resumen ejecutivo) no es parte del motor.",
  "Sin punto medio, rayas largas ni comillas inglesas como separadores en textos visibles."))

# ---------------- A. láminas (horizontal)
doc <- body_end_block_section(doc, SEC_V)
doc <- h(doc, "A. Tipos de lámina (32)")
S <- S[order(match(S$cat, names(fam_s))), ]
dfS <- data.frame(`Lámina` = S$nombre, Constructor = S$id, Familia = unname(fam_s[S$cat]), `Para qué sirve` = S$desc,
  Huecos = ifelse(nzchar(S$slots), S$slots, "ninguno"), `Uso real` = val(uso_s, S$id, "no se usa"), Recetario = val(rec_s, S$id, "no"),
  `¿Entra?` = "", `Variante o comentario` = "", check.names = FALSE)
doc <- body_add_flextable(doc, tabla(dfS, c(1.45, 1.75, 0.95, 2.45, 1.15, 0.7, 1.0, 0.75, 1.6), editable = 8:9))
doc <- body_end_block_section(doc, SEC_H)

# ---------------- B. gráficos
doc <- h(doc, "B. Tipos de gráfico (24)")
para_que <- c(p_barras_agrupadas = "Selección múltiple, nominal y rangos de perfil. También cruces simples.",
  p_barras_categoricas = "Perfil de hasta 10 categorías con un solo color.", p_barras_apiladas = "Likert de una afirmación y un público; nominal corta en una barra.",
  p_barras_multiapiladas = "Baterías Likert o Sí/No, por actor (var_cruce), por afirmación (var), por cruce o multilista; con Top Two Box.",
  p_pie = "Dicotomía de un solo público.", p_donut = "Dicotomía o pocas categorías con cifra central.", p_numerico = "Cifra clave (media, %, N).",
  p_histograma = "Edad u otra numérica por intervalos.", p_boxplot = "Numérica comparada entre grupos.", p_media_rango = "Promedio con su rango por grupo.",
  p_barras_divergentes = "Likert centrada en el punto neutro.", p_puntos_comparativos = "Un porcentaje comparado entre grupos.",
  p_dumbbell = "Brecha entre dos bases u olas (uso excepcional).", p_lollipop = "Ranking con muchas opciones.", p_serie_temporal = "Tres o más olas (uso excepcional).",
  p_radar = "Indicadores por tema y actor.", p_tabla = "Tabla de indicadores, nativa.", p_nube_palabras = "Texto abierto sin codificar (ilustrativa).",
  p_mapa_cobertura_territorial = "Cobertura territorial del operativo.", p_dim_radar = "Índices por dimensión (Analítica).", p_dim_heatmap = "Dimensiones por grupo.",
  p_dim_comparativo_radarbar = "Dimensiones con radar y barras.", p_dim_foda = "Matriz FODA dimensional.", p_dim_heatmap_criterios = "Criterios por dimensión.")
G <- G[order(-as.numeric(sub(",", ".", sub(" %", "", val(uso_g, G$id, "0 %")))), match(G$cat, names(fam_g))), ]
dfG <- data.frame(`Gráfico` = G$nombre, Constructor = G$id, Familia = unname(fam_g[G$cat]), `Para qué datos` = unname(para_que[G$id]),
  Opciones = G$nargs, `Uso real` = val(uso_g, G$id, "no se usa"), Recetario = val(rec_g, G$id, "no"),
  `¿Entra?` = "", `Variante o comentario` = "", check.names = FALSE)
doc <- body_add_flextable(doc, tabla(dfG, c(1.45, 1.95, 0.95, 2.4, 0.7, 0.75, 1.1, 0.75, 1.75), editable = 8:9))

# ---------------- C. situaciones
doc <- body_add_break(doc)
doc <- h(doc, "C. Situaciones que el recetario debe cubrir")
doc <- body_add_fpar(doc, p("Cada fila es un caso real de los informes. El recetario está completo cuando cada situación que se marque «Sí» tiene su lámina.", 10.5, SOFT))
sit <- data.frame(
  `Situación` = c("Likert, una afirmación, un público", "Likert, afirmación por actor", "Likert, batería de un público", "Sí/No por actor",
    "Dicotomía de un público", "Nominal corta (hasta 5)", "Rangos ordinales (edad, sueldo, ciclo)", "Nominal larga (más de 8)", "Selección múltiple",
    "Abierta codificada (_recod)", "Numérica (edad declarada)", "Perfil en 2, 3, 4, 5 o 6 paneles", "Segmentos de 1 a 3 %", "SIN INF en la escala",
    "Pregunta larga (más de 120 caracteres)", "Más premisas de las que caben", "Base menor a 30", "Top Two Box entre años", "Perfil entre años",
    "Indicador por tema y actor, valores altos y parejos", "Índices y dimensiones", "Gráfico con texto narrativo", "Lámina metodológica",
    "Texto abierto sin codificar", "Cobertura territorial"),
  `Cómo lo hace el motor` = c("p_barras_apiladas en p_slide_1_grafico", "p_barras_multiapiladas var_cruce con top2box", "p_barras_multiapiladas modo var",
    "p_barras_multiapiladas con escala Sí/No", "p_pie o p_barras_agrupadas", "p_barras_agrupadas o p_barras_apiladas", "p_barras_agrupadas, orden del instrumento",
    "p_barras_agrupadas con max_categorias", "p_barras_agrupadas, % de encuestados", "p_barras_agrupadas sobre la variable recodificada", "p_histograma",
    "p_slide_2 a 6_graficos_poblacion", "rótulo fuera del segmento", "último segmento gris", "ajuste del título de grupo", "partición «(cont.)»",
    "N por barra o en el pie", "overrides$comparativo y Top Two Box comparativo", "overrides$comparativo en agrupadas", "p_radar con tabla nativa",
    "p_dim_* (requiere Analítica)", "p_slide_1_grafico_narrativo y variantes", "p_slide_top_two_box, p_slide_redondeo, p_slide_tabla_tecnica",
    "p_nube_palabras", "p_mapa_cobertura_territorial"),
  Frecuencia = c("muy frecuente", "frecuente", "frecuente", "frecuente", "poco frecuente", "frecuente", "frecuente", "poco frecuente", "frecuente", "frecuente",
    "rara", "frecuente", "muy frecuente", "muy frecuente", "muy frecuente", "frecuente", "frecuente", "excepcional", "excepcional", "rara", "no usada", "frecuente",
    "en cada informe", "no usada", "no usada"),
  Recetario = c("14", "15, 16, 24", "17 a 20", "12, 13, 23", "fiel 9", "no", "8, 9", "no", "22", "22", "8", "8 (4), 9 (3)", "varias", "varias", "17, 18", "12-13, 17-20",
    "17, 18", "16", "10", "21", "no", "24", "6, 7, 3", "no", "no"),
  `¿Entra?` = "", `Variante o comentario` = "", check.names = FALSE)
doc <- body_add_flextable(doc, tabla(sit, c(2.3, 3.2, 1.1, 1.1, 0.75, 3.35), editable = 5:6))
doc <- body_end_block_section(doc, SEC_H)

doc <- h(doc, "D. Qué gráfico entra en qué lámina")
doc <- body_add_fpar(doc, p(paste("El motor no tiene una regla de compatibilidad: cualquier gráfico entra en cualquier hueco y la interfaz no lo impide.",
  "Lo que cambia es el ancho con que se dibuja cada gráfico según la lámina, y si sabe adaptarse a ese ancho.",
  "Sí: se ve bien. Se degrada: sale, pero pierde algo (se indica qué). No: no tiene sentido o se rompe."), 10.5, SOFT))
fam <- c("Un gráfico (12,5 in)", "Dos o cuatro paneles, con texto (6,1 in)", "Población 2 a 4 (5,2 in)", "Población 5 y 6 (3,95 in)", "Composiciones y cifras (siempre 5,2 in)")
cm_ <- function(nombre, id, a, b, c, d, e, nota) data.frame(`Gráfico` = nombre, Constructor = id, A = a, B = b, C = c, D = d, E = e, Nota = nota, check.names = FALSE)
mx <- rbind(
  cm_("Barras apiladas y multi-apiladas", "p_barras_apiladas, p_barras_multiapiladas", "Sí", "Se degrada", "Se degrada", "Se degrada", "Se degrada", "Sólo se adaptan al ancho en un gráfico, dos paneles y narrativos; en cuatro paneles, población y composiciones se ven mal (prueba renderizada)."),
  cm_("Barras agrupadas", "p_barras_agrupadas", "Sí", "Sí", "Sí", "Se degrada", "Se degrada", "Recalcula el corte de etiquetas bajo 9 in; en 3,95 in quedan apretadas."),
  cm_("Torta y dona", "p_pie, p_donut", "Sí", "Sí", "Sí", "Se degrada", "Sí", "Bajo 9 in las etiquetas escalan con piso de 8 pt; bajo 5 in la leyenda pasa abajo."),
  cm_("Radar con tabla", "p_radar (públicos o con tabla)", "Sí", "Se degrada", "Se degrada", "Se degrada", "Se degrada", "La tabla nativa sólo sale en la lámina de un gráfico; en cualquier otra desaparece sin aviso."),
  cm_("Radar solo", "p_radar (sm o box)", "Sí", "Sí", "Sí", "Se degrada", "Sí", "Sin tabla."),
  cm_("Tabla", "p_tabla", "Sí", "Sí", "Se degrada", "No", "No", "Siempre nativa, letra fija de 11 pt sin escalar al hueco: en huecos chicos se desborda."),
  cm_("Categóricas, boxplot, media y rango, divergentes, numérico", "p_barras_categoricas, p_boxplot, p_media_rango, p_barras_divergentes, p_numerico", "Sí", "Se degrada", "Se degrada", "Se degrada", "Se degrada", "Leen el ancho pero sin regla de lámina compartida; categóricas y divergentes se ven mal en cuatro paneles. p_numerico es un gráfico de barras, no una cifra destacada."),
  cm_("Ranking, puntos, nube, mapa", "p_lollipop, p_puntos_comparativos, p_nube_palabras, p_mapa_cobertura_territorial", "Sí", "Se degrada", "Se degrada", "No", "No", "No se adaptan al ancho: tipografía de lámina completa, riesgo de choque o recorte."),
  cm_("Dimensiones", "p_dim_radar, p_dim_heatmap, p_dim_heatmap_criterios, p_dim_comparativo_radarbar", "Sí", "Se degrada", "Se degrada", "No", "No", "Requieren Analítica (dimensiones calculadas). No se adaptan al ancho."),
  cm_("FODA dimensional", "p_dim_foda", "Sí", "Sí", "Se degrada", "No", "No", "Bajo 9 in escala las tarjetas (texto mínimo 5,5 pt)."),
  cm_("Brecha entre bases y serie temporal", "p_dumbbell, p_serie_temporal", "Sí", "Se degrada", "Se degrada", "No", "No", "No se insertan desde la UI: los arma el plan de equivalencias. Uso excepcional."))
names(mx)[3:7] <- fam
ftm <- tabla(mx, c(1.5, 1.9, 0.8, 0.85, 0.8, 0.8, 0.85, 2.8)) |> align(j = 3:7, align = "center", part = "all")
for (j in 3:7) { ftm <- ftm |> bg(i = which(mx[[j]] == "Sí"), j = j, bg = "#D9EBCB") |> bg(i = which(mx[[j]] == "Se degrada"), j = j, bg = "#FFF0B8") |>
  bg(i = which(mx[[j]] == "No"), j = j, bg = "#F9D5C0") }
doc <- body_add_flextable(doc, ftm)
doc <- body_add_fpar(doc, p(paste("Prueba renderizada: los 24 gráficos en 6 disposiciones (144 combinaciones). El motor no rechazó ninguna;",
  "el radar perdió su tabla en las 5 disposiciones que no son de un gráfico, y en cuatro paneles se ven mal apiladas, multiapiladas, categóricas,",
  "divergentes, heatmaps, tabla, puntos comparativos y nube. El detalle está en compatibilidad.csv, junto a este documento."), 10, SOFT))
doc <- body_add_fpar(doc, p(paste("Huecos de cifra (en «Tres gráficos + cifras» y «Banda de cifras + dos gráficos»): el motor no tiene un gráfico de cifra;",
  "cualquier gráfico que se ponga ahí se dibuja calculado para 5,2 in aunque el hueco sea pequeño. Huecos de ícono: sólo aceptan un ícono subido."), 10, SOFT, italic = TRUE))
doc <- body_end_block_section(doc, SEC_H)

doc <- h(doc, "E. Pendientes y decisiones abiertas")
doc <- vin(doc, c("Si el radar se mantiene o se reemplaza por tabla con puntos (p_tabla y p_puntos_comparativos) cuando los valores son altos y parejos.",
  "Si los comparativos entre años quedan en el recetario como uso excepcional o salen.",
  "Qué familias sin uso (dimensiones, nube, mapa, boxplot, serie temporal) se documentan igual en el recetario para no perder la capacidad.",
  "Qué disposiciones de 3 gráficos (2+1, 1+2, fila, 1 arriba) son las preferidas, si alguna.",
  "Si la interfaz debe advertir o impedir combinaciones que se degradan (radar con tabla fuera de la lámina de un gráfico, tabla en huecos chicos)."))
print(doc, target = file.path(N, "3-catalogo", "catalogo-laminas-y-graficos.docx"))
cat("OK\n")
