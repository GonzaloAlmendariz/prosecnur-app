# Portadillas de la propuesta de diseño (2026-10-08), desde recetario_estructura.json. El capítulo usa el separador con rótulo
# (variante B, aprobada) y el subcapítulo la alternativa sobria: se lee como subtítulo, no como portada. Se crean al final y
# reordenar.py las pone en su lugar (claves «cap_1:1», «cap_1.1:1»).
EST <- jsonlite::fromJSON("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_estructura.json", simplifyVector = FALSE)
for (c_ in EST$capitulos) {
  SEC <- paste0("cap_", c_$n); MOTOR_ACT <- "p_slide_seccion (separador de capítulo, variante con rótulo)"
  doc <- nueva(doc, "Section Header")
  txt(doc, paste("CAPÍTULO", c_$n), 2.5, 3.85, 6, 0.36, 15, TK$coral, bold = TRUE); caja(doc, 2.6, 4.27, 1.1, 0.04, TK$coral)
  txt(doc, c_$titulo, 2.5, 4.42, 9.8, 0.75, 36, TK$navy, bold = TRUE); txt(doc, c_$sub, 2.5, 5.15, 9.8, 0.4, 15, TK$soft)
  zona("título", 2.5, 4.42, 9.8, 0.75); dibujar_guias(doc)
  for (s_ in c_$secciones) {
    SEC <- paste0("cap_", s_$n); MOTOR_ACT <- "p_slide_seccion (subcapítulo sobrio)"
    doc <- nueva(doc)
    txt(doc, toupper(paste0("Capítulo ", c_$n, ": ", c_$titulo)), XT, 2.75, 9, 0.3, 11, TK$soft, bold = TRUE)
    wn <- ancho_tinta(s_$n, 30, TRUE); txt(doc, s_$n, XT, 3.1, wn + 0.3, 0.6, 30, TK$coral, bold = TRUE)
    txt(doc, s_$titulo, XT + wn + 0.3, 3.1, W - MR - XT - wn - 0.3, 0.6, 30, TK$navy, bold = TRUE)
    txt(doc, s_$sub, XT, 3.72, 10, 0.4, 15, TK$soft)
    zona("subcapítulo", XT, 2.75, 10, 1.4); dibujar_guias(doc) } }
