# Recetario v2, Parte VII: alternativas de índice (pedido de Gonzalo, 2026-10-07: «lleva todos al recetario como
# alternativas de índice con todos los casos, es una sección al final»). Cuatro composiciones geométricas abstractas
# (arcos, facetas, círculos, bloques), con los íconos de Lucide antes de cada título, en cinco situaciones cada una.
# Las láminas las arma propuestas_indice.R; aquí sólo se elige el conjunto y se agrega la portadilla.
MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "VII", "Alternativas de índice", "Cuatro composiciones geométricas en cinco situaciones, de 5 a 13 capítulos, y cuatro cierres con el logo centrado", icono = "list-checks")
Sys.setenv(DIRECCIONES = "geolista")
source("docs/qa/motor-ppt-2026-10-06/herramientas/propuestas_indice.R", local = TRUE)
Sys.unsetenv("DIRECCIONES")
