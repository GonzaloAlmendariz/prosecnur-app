# Inventario N7 — 22 tipos de lámina e identidad (ADR 0093)

Fecha: 2026-10-09. Fuente: exploración del repo (recetario `recetario_estructura.json` + `reordenar.py`, cruzado con los
títulos de `recetario-moderna.pptx`, 272 láminas). La identidad es el **capítulo 1 (láminas 4-65)**; las 122-128 son
ejemplos de 3.2 «Un gráfico». El gate de N7 del ADR 0093 son los pares 121-169 y 19-65.

## Orden de trabajo de N7 (por uso real)

| # | Tipo | Uso | Enganche nativo hoy | Estado |
|---|---|---|---|---|
| 1 | `p_slide_2_graficos_narrativo` (ficha 135, ejemplo 136) | 5 láminas en acnur_pdm; lo genera el plan automático (`graficos_plan_coverage.R:1463`) | sí (diseño `graficos_2` + franja) | ☑ aprobado con pendientes |
| 2 | `p_slide_1_grafico_narrativo` (123/124; 76, 99, 225) | plan automático en 4 sitios | sí (franja coral + zona de datos bajada) | ☑ aprobado con pendientes |
| 3 | `p_slide_4_graficos_poblacion` (fuera de los 22; recetario 210, 193, 194) | 6 en acrconta_mazo | sí (4696165c7: disposición `paneles_4` de las mixtas; la 210 trae histograma, que en panel no existe → ruta anterior) | ☑ aprobado con pendientes |
| 4 | Identidad: `p_slide_seccion` (13 en el mazo real; separador B 4/66/116/207/254) — HECHO: separadores 69dfc7d7d (aprobado con pendientes) Top Two Box 19, redondeo 20/21 y portada 23 aprobados; ficha técnica 29 en verificación; falta: objetivo 26, índice 31-50, contraportada 65 (23), índice (31-50), objetivo (26), Top Two Box (19), redondeo (20 y 21: el recetario hace dos láminas), ficha técnica (29), contraportada (65, no existe en el motor) | mazo real | no | ☐ |
| 5 | `p_slide_texto` (129/130) | plan automático, metadata | no | ☐ |
| 6 | `p_slide_grafico_texto_derecha` (125/126; 240, 249) | recetario ×3, metadata | no | ☐ |
| 7 | `p_slide_3_graficos_fila` (153/154; 212) | plan de derecho | no | ☐ |
| 8 | `p_slide_2_graficos_poblacion` (134), `p_slide_6_graficos_poblacion` (163/164) | metadata | no | ☐ |
| 9 | Completar `p_slide_2_graficos` y `p_slide_2_graficos_vertical` (hoy sólo escalas) | psicología ×3, ACNUR | parcial | ☐ |
| 10 | Sin uso fuera del recetario: asimétrico, texto izquierda, 2 gráficos con texto a izquierda/derecha, tira, corona, población con cifras, cifras y gráficos, 5 de población | — | no | ☐ |

## Discrepancias JSON del estándar ↔ láminas de ejemplo (BLOQUEAN el tipo hasta resolverse; manda la lámina)

- Corona (#17): el JSON trae la geometría de 2mas1; la lámina 158 y los slots del constructor son dos arriba y uno ancho abajo.
- 2 gráficos con texto a la izquierda/derecha (#8, #9): en el recetario los paneles van APILADOS, no lado a lado.
- Anchos distintos: texto a la derecha/izquierda (#3, #4: gráfico de 8.6 / panel de 8.4) y asimétrico (#11: principal de 8.4).
- Pasos y separaciones: fila (#15: columnas de 3.874 con 0.45), tira (#16: franjas cada 1.68), 5 y 6 de población (#19, #20:
  columnas de 3.908 con 0.4), banda de cifras (#22: paneles en 3.25).

## Piezas del recetario que faltan en `lamina_*.R`

- `narrativa()` (panel con filete coral, `recetario_piezas.R:30`): hoy sólo dentro del mapa y de la torta.
- `cifra()` (cifra destacada, `recetario_piezas.R:51`): los slots `cifra_*` son gráficos comunes.
- `icono_en_circulo` del antetítulo de población.

## Medidas clave (pulgadas; estilo moderno, `recetario.R:25-31`)

Margen 0.495 · ancho útil 12.523 · separación 0.5 · media columna 6.012 · datos desde 1.65 · contenido hasta 6.72 ·
título y = 0.355 · leyenda 6.42 · base 6.88. Narrativa del 1 gráfico (124): `narrativa(ML, 1.45, 12.523, 0.45)` a 15 pt;
del 2 gráficos (136): `narrativa(ML, 1.60, 12.523, 0.75)`, paneles en 2.65, barras desde 3.30, filete vertical en 6.756.

El detalle completo por tipo (rama del motor con línea, constructor, medidas del recetario) y la tabla de identidad
están en el informe del explorador, resumido en el encargo del loop.
