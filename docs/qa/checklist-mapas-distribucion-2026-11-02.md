# Checklist · mapas de distribución al motor (`p_mapa_distribucion`) — 2026-11-02

Encargo: llevar al motor el diseño de mapas aprobado por Gonzalo (lienzo «Maqueta de mapas territoriales», tableros 2 a 7).
Rama de trabajo: `claude/jovial-burnell-11d3e8`. Fixture sintético; nunca datos del estudio. Trabajo de varias sesiones
(Gonzalo, 2026-11-02: «esto va a requerir varias sesiones, aún falta muchísimo»).

Estados: pendiente · en curso · hecho (a revisar) · bloqueado. Sólo Gonzalo da un ítem por cerrado.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Paleta Blues de 5 clases (Lima) y de 4 (Perú), sin violetas | `.MAPA_DIST` en `graficos_mapa_distribucion_plan.R`; `.mapa_distribucion_clases()` | hecho (a revisar) |
| 2 | «Sin encuestados» #FAF9F6, con borde #C9CED6 sólo en la leyenda | `.MAPA_DIST$vacio`; leyenda en `lamina_mapa_distribucion.R` y `reporte_word_mapa_distribucion.R` | hecho (a revisar) |
| 3 | Bordes blancos de 0,75 pt con uniones redondeadas; contorno #8E98A8 de 2,4 pt debajo de las áreas | `.mapa_dist_panel_gg()` (`graficos_mapa_distribucion_dibujo.R`) | hecho (a revisar) |
| 4 | Mar #E6EEF5 con «Océano Pacífico»; tierra de contexto (dpto. de Lima en Lima; países vecinos rotulados en el Perú) | dibujo + `peru_vecinos.geojson` (Natural Earth admin-0 50m, dominio público; `api/inst/cartografia/`) | hecho (a revisar). Bolivia y Chile apenas asoman y no se rotulan |
| 5 | Cortes en estudiantes (1–2, 3–5, 6–10, 11–20, 21+; Perú hasta 11+); leyenda escalonada en franja propia, centrada, sin tapar el mapa | `.mapa_distribucion_clases()`; `.lam_mapa_dist_leyenda()`; `.word_mapa_dist_leyenda()` | hecho (a revisar) |
| 6 | Tasa por 10 000 habitantes (Censo 2017 de `lima_district_coverage.json`), cortes 0,5·1·2·3, pie «Población: INEI, Censo 2017» | `medida = "tasa"`; `espec$nota_pie` (lámina: al pie; Word: nota del ranking) | hecho (a revisar) |
| 7 | Rótulos en columna sobre el mar con guía horizontal y diagonal; PUCP en rojo #C8463D; sin choques | `.mapa_dist_rotulos_columna()`. **Corrección de Gonzalo (2026-11-02): la guía es SÓLO para los puntos de Google Maps; las áreas no llevan rótulo, se leen por color, leyenda y barras** | hecho (a revisar) con la corrección |
| 8 | Escala gráfica de 5 km abajo a la derecha, gris, sin norte | dibujo; en el Perú 200 km bajo «Océano Pacífico» (en la esquina pisaba Tacna) | hecho (a revisar) |
| 9 | Perú: Lima Metropolitana, Callao y Lima provincias separados; LM en #14213D fuera de escala; recuadro «Zona de Lima, ampliada» unido por una línea | `graficos_mapa_distribucion_carto.R` (uniones con `sf`); `.mapa_dist_zona_lima()` | hecho (a revisar) |
| 10 | Word: rótulos 10,5 pt, leyenda y escala 9 pt al ancho de texto (16 cm); nunca < 8 pt | `.mapa_dist_pt("word")`; `.word_g_mapa_distribucion()` | hecho (a revisar). Pendiente: la figura (~7,4 in con el ranking) deja una página en blanco antes; evaluar ranking más corto o en la página siguiente |
| 11 | Ranking en tarjeta del mismo alto que el mapa, filas repartidas, encabezado, barras del color de su clase, cifras a la derecha | `.lam_mapa_dist_ranking()` (lámina); en el Word va debajo, en dos columnas | hecho (a revisar) |
| 12 | Tests: cortes, separación de Lima, tasa, rótulos sin solaparse | `api/tests/testthat/test-graficos-mapa-distribucion.R` (47 expectativas) | hecho |
| 13 | `make gate-area` del área de gráficos | — | pendiente |
| 14 | Render verificado en imagen del PPT y del Word | scratchpad de la sesión (fixture sintético) | hecho para Lima (número y tasa) y Perú; falta probar con un proyecto de referencia |

## Aprendido (para no reinvestigar)

- **rvg (el dispositivo vectorial del PPT) hace segfault** con: polígonos fuera del recorte, trazados con huecos
  (`geom_polygon(subgroup=)` → `pathGrob`) y anillos degenerados (astillas del recorte). Por eso el panel recorta con `sf`,
  dibuja sólo anillos exteriores y filtra anillos de menos de 4 vértices o área < 1e-5 in².
- El panel se dibuja en **pulgadas** (`coord_fixed` de 0 a ancho/alto): así los rótulos y la escala se espacian en medidas
  físicas (1 px de la maqueta = 1/96 in).
- `system.file()` con varias partes debe ir por `do.call`: con un vector como segundo argumento devuelve la carpeta.
- Hay que llamar a `sf::sf_use_s2(FALSE)` y silenciar sus mensajes: las uniones de distritos son planas.
