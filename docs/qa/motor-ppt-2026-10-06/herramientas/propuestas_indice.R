# Propuestas de índice ilustradas (pedidos de Gonzalo, 2026-10-07: «los focos tenían su toque», «todo está muy plano y
# aburrido», «los libros y los lápices pueden tener íconos, los focos estar mejor definidos», «lo normal es tener sólo 5
# capítulos» y «creativo pero tampoco infantil»). Cuatro ilustraciones (focos, libros, lápices, camino), cada una en
# cuatro situaciones: 5 capítulos, 5 con subíndices, 8 y 13. Las piezas y sus anclas salen de ilustraciones_indice.py.
# Se ejecuta con SOLO=indices desde recetario.R.

ILU <- Sys.getenv("ILU", "docs/qa/motor-ppt-2026-10-06/herramientas/ilustraciones")
PAL6 <- c("#EFD25E", "#E4A34C", "#9688D3", "#7594CC", "#85BB85", "#081F5C")
c13 <- c("Perfil del encuestado", "Características institucionales", "Desarrollo de políticas institucionales",
  "Estructura organizacional, administrativa y financiera", "Cuerpo académico", "Estudiantes y graduados",
  "Infraestructura, instalaciones y recursos de apoyo", "Características del perfil de egreso", "Estructura curricular",
  "Vinculación con el medio y desarrollo sostenible", "Internacionalización integral", "Investigación, desarrollo e innovación (I+D+i)", "Integridad y transparencia")
i13 <- c("users", "building-2", "scroll-text", "network", "presentation", "user-check", "library", "award", "book-open", "handshake", "globe", "flask-conical", "scale")
c5 <- c("Perfil del encuestado", "Características institucionales", "Cuerpo académico", "Características del perfil de egreso", "Estudiantes y graduados")
i5 <- c("users", "building-2", "presentation", "award", "briefcase")
s5 <- list(c("Estudiantes", "Docentes", "Egresados"), c("Misión y propósitos", "Gestión y planificación"), c("Gestión del cuerpo académico", "Orientación y acompañamiento"),
           c("Competencias", "Formulación del perfil"), c("Situación laboral", "Tutoría socioemocional"))
etiqueta <- function(doc, t) if (GUIAS || Sys.getenv("SOLO") == "indices") txt(doc, t, W - MR - 4.6, Y_BASE, 4.0, 0.3, 10, TK$guia, bold = TRUE, align = "right")   # sólo en guías o en el archivo de propuestas

lamina <- function(doc, dibujo, caps, icos, subs = NULL, nombre, situacion, cols = NULL, iconos_lista = FALSE) {
  n <- length(caps); arch <- sprintf("%s_%d", dibujo, if (n <= 5 || startsWith(dibujo, "geo")) 5 else if (n <= 8) 8 else 13)
  MOTOR_ACT <<- sprintf("Propuesta de índice ilustrado: %s, %s", nombre, situacion)
  doc <- nueva(doc)
  invisible(ph_with(doc, external_img(file.path(ILU, paste0(arch, ".png")), width = 6.2, height = 7.5), location = ph_location(left = 0, top = 0, width = 6.2, height = 7.5)))
  an <- jsonlite::fromJSON(file.path(ILU, paste0(arch, ".json")))
  ico_pieza <- if (startsWith(dibujo, "focos") && n > 8) c("users", "building-2", "graduation-cap", "book-open", "lightbulb") else icos
  if (is.data.frame(an)) for (r in seq_len(nrow(an))) icono(doc, ico_pieza[an$k[r]], if (an$claro[r]) "navy" else "blanco", an$x[r] - an$d[r] / 2, an$y[r] - an$d[r] / 2, an$d[r])
  cols <- if (is.data.frame(an) && "fill" %in% names(an)) an$fill[order(an$k)] else cols %||% (if (n <= 5) PAL6[1:5] else PAL6)
  xl <- 6.75; txt(doc, toupper(if (iconos_lista) paste0(sub("^Geometría, ", "", nombre), ": ", situacion) else situacion), xl - 0.1, 0.62, 5.2, 0.26, 10, TK$soft, bold = TRUE)
  txt(doc, "Índice", xl - 0.1, 0.86, 4, 0.62, 30, TK$coral, bold = TRUE, nombre = "Titulo lamina")
  y0 <- 1.75; y1 <- 6.95; alto <- y1 - y0
  ns <- if (is.null(subs)) 0 else sum(lengths(subs))
  if (ns == 0) {
    rh <- min(if (n <= 5) 0.95 else 0.62, alto / n); db <- if (n <= 5) 0.48 else if (n <= 8) 0.38 else 0.3
    fs <- if (n <= 5) 18 else if (n <= 8) 15 else 12.5; fb <- if (n <= 5) 15 else if (n <= 8) 12 else 10.5
    ya <- y0 + (alto - n * rh) / 2
    if (iconos_lista) {   # número, ícono y título: los íconos van antes del título, no en la ilustración (pedido de Gonzalo)
      di <- if (n <= 5) 0.44 else if (n <= 8) 0.34 else 0.26; xi <- xl + (if (n <= 5) 0.75 else 0.6); xt <- xi + di + 0.25
      for (k in seq_len(n)) { y <- ya + (k - 1) * rh
        txt(doc, sprintf("%02d", k), xl - 0.1, y + (rh - fs / 46) / 2 - 0.02, 0.8, fs / 46 + 0.08, fs, TK$coral, bold = TRUE)
        icono(doc, icos[k], "navy", xi, y + (rh - di) / 2, di)
        txt(doc, caps[k], xt - 0.1, y + (rh - fs / 48) / 2 - 0.02, W - MR - xt + 0.1, fs / 48 + 0.08, fs, TK$navy, bold = n <= 5)
        if (k < n) caja(doc, xl, y + rh - 0.003, W - MR - xl, 0.005, TK$rule) }
    } else for (k in seq_len(n)) { y <- ya + (k - 1) * rh; col <- cols[(k - 1) %% length(cols) + 1]
      caja(doc, xl, y + (rh - db) / 2, db, db, col, geom = "ellipse")
      txt(doc, k, xl - 0.08, y + (rh - db) / 2 + (db - fb / 50) / 2 - 0.02, db + 0.16, fb / 50 + 0.06, fb, texto_sobre(col), bold = TRUE, align = "center")
      txt(doc, caps[k], xl + db + 0.18, y + (rh - fs / 48) / 2 - 0.02, W - MR - xl - db - 0.18, fs / 48 + 0.08, fs, TK$navy, bold = n <= 5)
      if (k < n) caja(doc, xl + db + 0.28, y + rh - 0.003, W - MR - xl - db - 0.28, 0.005, TK$rule) }
  } else {
    hm <- 0.5; hs <- min(0.31, (alto - hm * n - 0.12 * (n - 1)) / ns); db <- 0.4; y <- y0
    if (iconos_lista) {   # número, ícono y título; los subcapítulos debajo, alineados con el título
      di <- 0.36; xi <- xl + 0.65; xt <- xi + di + 0.25
      for (k in seq_len(n)) {
        txt(doc, sprintf("%02d", k), xl - 0.1, y + (hm - 0.34) / 2, 0.8, 0.34, 15, TK$coral, bold = TRUE)
        icono(doc, icos[k], "navy", xi, y + (hm - di) / 2, di)
        txt(doc, caps[k], xt - 0.1, y + (hm - 0.34) / 2, W - MR - xt + 0.1, 0.34, 15, TK$navy, bold = TRUE); y <- y + hm
        for (j in seq_along(subs[[k]])) {
          txt(doc, sprintf("%d.%d", k, j), xt - 0.1, y + (hs - 0.28) / 2, 0.55, 0.28, 11, TK$soft, bold = TRUE)
          txt(doc, subs[[k]][j], xt + 0.42, y + (hs - 0.28) / 2, W - MR - xt - 0.42, 0.28, 12, TK$soft); y <- y + hs }
        if (k < n) { caja(doc, xl, y + 0.04, W - MR - xl, 0.005, TK$rule); y <- y + 0.12 } }
    } else
    for (k in seq_len(n)) { col <- cols[(k - 1) %% length(cols) + 1]
      caja(doc, xl, y + (hm - db) / 2, db, db, col, geom = "ellipse")
      txt(doc, k, xl - 0.08, y + (hm - db) / 2 + 0.06, db + 0.16, 0.3, 13, texto_sobre(col), bold = TRUE, align = "center")
      txt(doc, caps[k], xl + db + 0.18, y + (hm - 0.36) / 2, W - MR - xl - db - 0.18, 0.36, 15, TK$navy, bold = TRUE); y <- y + hm
      for (j in seq_along(subs[[k]])) {
        txt(doc, sprintf("%d.%d", k, j), xl + db + 0.18, y + (hs - 0.28) / 2, 0.55, 0.28, 11, TK$soft, bold = TRUE)
        txt(doc, subs[[k]][j], xl + db + 0.7, y + (hs - 0.28) / 2, W - MR - xl - db - 0.7, 0.28, 12, TK$soft); y <- y + hs }
      if (k < n) { caja(doc, xl + db + 0.28, y + 0.04, W - MR - xl - db - 0.28, 0.005, TK$rule); y <- y + 0.12 } }
  }
  zona("ilustración", 0, 0, 6.2, 7.5); zona("lista", xl, y0, W - MR - xl, alto); dibujar_guias(doc); etiqueta(doc, paste0(nombre, ", ", situacion))
  doc
}
if (Sys.getenv("DIRECCIONES") == "geolista") {   # geometría abstracta pura y los íconos antes de cada título, en cinco situaciones
  c6 <- c("Objetivos del estudio", "Metodología", "Perfil de los encuestados", "Resultados", "Conclusiones", "Recomendaciones")
  i6 <- c("target", "clipboard-list", "users", "chart-column", "list-checks", "lightbulb")
  s6 <- list(character(0), c("Diseño muestral", "Trabajo de campo"), character(0), c("Satisfacción con la formación", "Servicios de bienestar", "Inserción laboral"), character(0), character(0))
  for (g_ in list(c("geoarcos", "Arcos"), c("geofacetas", "Facetas"), c("geocirculos", "Círculos"), c("geobloques", "Bloques"))) {
    nm <- paste("Geometría,", tolower(g_[2]))
    doc <- lamina(doc, g_[1], c5, i5, nombre = nm, situacion = "5 capítulos, el caso normal", iconos_lista = TRUE)
    doc <- lamina(doc, g_[1], c5, i5, subs = s5, nombre = nm, situacion = "5 capítulos con subcapítulos", iconos_lista = TRUE)
    doc <- lamina(doc, g_[1], c6, i6, subs = s6, nombre = nm, situacion = "Subcapítulos en dos capítulos", iconos_lista = TRUE)
    doc <- lamina(doc, g_[1], c13[1:8], i13[1:8], nombre = nm, situacion = "8 capítulos", iconos_lista = TRUE)
    doc <- lamina(doc, g_[1], c13, i13, nombre = nm, situacion = "13 capítulos", iconos_lista = TRUE) }
} else if (Sys.getenv("DIRECCIONES") == "geoicono") {   # geometría con un ícono de Lucide por capítulo
  for (g_ in list(c("giarcos", "Arcos"), c("gifacetas", "Facetas"), c("gicirculos", "Círculos"), c("gibloques", "Bloques")))
    doc <- lamina(doc, g_[1], c5, i5, nombre = paste("Geometría con íconos,", tolower(g_[2])), situacion = "5 capítulos")
} else if (Sys.getenv("DIRECCIONES") == "geo") {   # geometría abstracta (elegida por Gonzalo), cuatro composiciones
  azules <- c("#081F5C", "#2F4B7C", "#4F6A9A", "#7387B0", "#9AA9C8")
  for (g_ in list(c("geobloques", "Bloques"), c("geocirculos", "Círculos"), c("geofacetas", "Facetas"), c("geoarcos", "Arcos")))
    doc <- lamina(doc, g_[1], c5, i5, nombre = paste("Geometría,", tolower(g_[2])), situacion = "5 capítulos", cols = azules)
} else if (Sys.getenv("DIRECCIONES") == "1") {   # tres tratamientos sobrios de los focos, para elegir la dirección
  doc <- lamina(doc, "focoslinea", c5, i5, nombre = "Dirección 1, trazo fino", situacion = "5 capítulos", cols = rep(TK$navy, 5))
  doc <- lamina(doc, "focosmono", c5, i5, nombre = "Dirección 2, monocromo azul", situacion = "5 capítulos", cols = c("#081F5C", "#2F4B7C", "#4F6A9A", "#7387B0", "#9AA9C8"))
  doc <- lamina(doc, "focosduo", c5, i5, nombre = "Dirección 3, dos tonos", situacion = "5 capítulos", cols = c("#081F5C", "#9DC3E6", "#081F5C", "#9DC3E6", "#081F5C"))
} else {
disenos <- list(c("focos", "G. Focos"), c("libros", "H. Estante de libros"), c("lapices", "I. Lápices"), c("camino", "J. Camino"))
for (d_ in disenos) {
  doc <- lamina(doc, d_[1], c5, i5, nombre = d_[2], situacion = "5 capítulos, el caso normal")
  doc <- lamina(doc, d_[1], c5, i5, subs = s5, nombre = d_[2], situacion = "5 capítulos con subíndices")
  doc <- lamina(doc, d_[1], c13[1:8], i13[1:8], nombre = d_[2], situacion = "8 capítulos")
  doc <- lamina(doc, d_[1], c13, i13, nombre = d_[2], situacion = "13 capítulos")
}
}
