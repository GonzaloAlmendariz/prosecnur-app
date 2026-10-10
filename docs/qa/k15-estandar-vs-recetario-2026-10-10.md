# K15 — estándar contra lo dibujado en el recetario (2026-10-10)

Tipo: Medición QA (estándar contra recetario)
Estado: Vigente
Fecha: 2026-10-10
Autoridad: Decisión K15 de Gonzalo («sí»). Evidencia de QA; no reemplaza un ADR

Decisión de Gonzalo (2026-10-10): «sí». Las ranuras de `api/inst/estandar/estandar_pulso.json` pasan a ser las que dibujan
las láminas de ejemplo de `docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx` (nunca la copia «Repaired»).
Cuando el recetario se contradice, manda lo dibujado: las fichas «TIPO DE LÁMINA n DE 22» (de `recetario_fichas.R`, la
fuente anterior del exportador) dibujaban otra geometría en estos tipos.

## Cómo se midió

- python-pptx sobre la página de ejemplo que sigue a cada ficha «TIPO DE LÁMINA n DE 22» (p124…p171).
- x, y, w: la caja de la pregunta de cada panel (13 pt negrita). En un texto, desde el filete de acento hasta el borde de
  su caja.
- h: hasta el filete o el panel siguiente menos 0.2 in (la regla de la corona, p160). En la última fila, hasta 6.25.
- Tolerancia: 0.05 in, la de `scripts/qa_estandar_conformidad.R`.
- 9 tipos ya calzaban en x, y y w dentro de esa tolerancia y no se tocaron: 1, 2, 5, 6, 7, 10, 12, 15 y 17. La corona
  (17) se alineó antes, en bb2fd2a00. Fuera del Δ de x/y/w quedan diferencias de alto en 12 (filete en 3.8: h 1.95
  contra 2.2) y de 0.05 en 7, 10 y 12, en el borde de la tolerancia; no se tocaron.
- El auditor anterior listaba 12 tipos. Esta medición encuentra 13: falta el tipo 14 (uno ancho arriba, p154), con los
  de abajo en 4.2 contra 4.05 del estándar.

## Antes y después, por ranura (pulgadas)

Fuente del cambio: `docs/qa/motor-ppt-2026-10-06/herramientas/exportar_estandar.R`. El json se regenera byte a byte
desde el exportador. Test: `api/tests/testthat/test-estandar-ranuras-recetario.R`.

| Tipo | Página | Ranura | Antes (x, y, w, h) | Dibujado (x, y, w, h) | Δ antes (x, y, w, h) | Después | Δ después (máx.) |
|---|---|---|---|---|---|---|---|
| 3 `p_slide_grafico_texto_derecha` | p128 | 1 | grafico (0.495, 1.65, 7.6, 4.6) | grafico (0.495, 1.65, 8.6, 4.6) | +0.000, +0.000, +1.000, +0.000 | grafico (0.495, 1.65, 8.6, 4.6) | 0.000 |
| 3 `p_slide_grafico_texto_derecha` | p128 | 2 | texto (8.6, 1.9, 4.418, 3) | texto (9.55, 2.45, 3.468, 3.4) | +0.950, +0.550, -0.950, +0.400 | texto (9.55, 2.45, 3.468, 3.4) | 0.000 |
| 4 `p_slide_grafico_texto_izquierda` | p130 | 1 | texto (0.495, 1.9, 4.2, 3) | texto (0.495, 2.05, 3.45, 3.4) | +0.000, +0.150, -0.750, +0.400 | texto (0.495, 2.05, 3.45, 3.4) | 0.000 |
| 4 `p_slide_grafico_texto_izquierda` | p130 | 2 | grafico (5.2, 1.65, 7.818, 4.6) | grafico (4.55, 1.75, 8.4, 4.5) | -0.650, +0.100, +0.582, -0.100 | grafico (4.55, 1.75, 8.4, 4.5) | 0.000 |
| 8 `p_slide_2_graficos_texto_izquierda` | p140 | 1 | texto (0.495, 1.9, 3.5, 3) | texto (0.495, 2.05, 3.45, 3.6) | +0.000, +0.150, -0.050, +0.600 | texto (0.495, 2.05, 3.45, 3.6) | 0.000 |
| 8 `p_slide_2_graficos_texto_izquierda` | p140 | 2 | grafico (4.4, 1.65, 4.2, 4.6) | grafico (4.55, 1.7, 8.468, 1.6) | +0.150, +0.050, +4.268, -3.000 | grafico (4.55, 1.7, 8.468, 1.6) | 0.000 |
| 8 `p_slide_2_graficos_texto_izquierda` | p140 | 3 | grafico (8.85, 1.65, 4.168, 4.6) | grafico (4.55, 3.7, 8.468, 2.55) | -4.300, +2.050, +4.300, -2.050 | grafico (4.55, 3.7, 8.468, 2.55) | 0.000 |
| 9 `p_slide_2_graficos_texto_derecha` | p142 | 1 | grafico (0.495, 1.65, 4.1, 4.6) | grafico (0.495, 1.7, 8.6, 1.9) | +0.000, +0.050, +4.500, -2.700 | grafico (0.495, 1.7, 8.6, 1.9) | 0.000 |
| 9 `p_slide_2_graficos_texto_derecha` | p142 | 2 | grafico (4.85, 1.65, 4.1, 4.6) | grafico (0.495, 3.8, 8.6, 2.45) | -4.355, +2.150, +4.500, -2.150 | grafico (0.495, 3.8, 8.6, 2.45) | 0.000 |
| 9 `p_slide_2_graficos_texto_derecha` | p142 | 3 | texto (9.25, 1.9, 3.768, 3) | texto (9.55, 2.05, 3.468, 3.4) | +0.300, +0.150, -0.300, +0.400 | texto (9.55, 2.05, 3.468, 3.4) | 0.000 |
| 11 `p_slide_2_graficos_asimetrico` | p146 | 1 | grafico (0.495, 1.65, 7.9, 4.6) | grafico (0.495, 1.6, 8.4, 4.65) | +0.000, -0.050, +0.500, +0.050 | grafico (0.495, 1.6, 8.4, 4.65) | 0.000 |
| 11 `p_slide_2_graficos_asimetrico` | p146 | 2 | grafico (8.85, 1.65, 4.168, 4.6) | grafico (9.35, 1.6, 3.668, 4.65) | +0.500, -0.050, -0.500, +0.050 | grafico (9.35, 1.6, 3.668, 4.65) | 0.000 |
| 13 `p_slide_3_graficos_1mas2` | p151 | 1 | grafico (0.495, 1.65, 6.012, 4.6) | grafico (0.495, 1.65, 6.012, 4.6) | +0.000, +0.000, +0.000, +0.000 | grafico (0.495, 1.65, 6.012, 4.6) | 0.000 |
| 13 `p_slide_3_graficos_1mas2` | p151 | 2 | grafico (7.007, 1.65, 6.012, 2.2) | grafico (7.007, 1.65, 6.012, 1.65) | +0.000, +0.000, +0.000, -0.550 | grafico (7.007, 1.65, 6.012, 1.65) | 0.000 |
| 13 `p_slide_3_graficos_1mas2` | p151 | 3 | grafico (7.007, 4.05, 6.012, 2.2) | grafico (7.007, 3.7, 6.012, 2.55) | +0.000, -0.350, +0.000, +0.350 | grafico (7.007, 3.7, 6.012, 2.55) | 0.000 |
| 14 `p_slide_3_graficos_1arriba` | p154 | 1 | grafico (0.495, 1.65, 12.523, 2.2) | grafico (0.495, 1.6, 12.523, 2.25) | +0.000, -0.050, +0.000, +0.050 | grafico (0.495, 1.6, 12.523, 2.25) | 0.000 |
| 14 `p_slide_3_graficos_1arriba` | p154 | 2 | grafico (0.495, 4.05, 6.012, 2.2) | grafico (0.495, 4.2, 6.012, 2.05) | +0.000, +0.150, +0.000, -0.150 | grafico (0.495, 4.2, 6.012, 2.05) | 0.000 |
| 14 `p_slide_3_graficos_1arriba` | p154 | 3 | grafico (7.007, 4.05, 6.012, 2.2) | grafico (7.007, 4.2, 6.012, 2.05) | +0.000, +0.150, +0.000, -0.150 | grafico (7.007, 4.2, 6.012, 2.05) | 0.000 |
| 16 `p_slide_3_graficos_poblacion_tira` | p158 | 1 | grafico (0.495, 1.65, 12.523, 1.4) | grafico (0.495, 1.65, 12.523, 1.18) | +0.000, +0.000, +0.000, -0.220 | grafico (0.495, 1.65, 12.523, 1.18) | 0.000 |
| 16 `p_slide_3_graficos_poblacion_tira` | p158 | 2 | grafico (0.495, 3.25, 12.523, 1.4) | grafico (0.495, 3.33, 12.523, 1.18) | +0.000, +0.080, +0.000, -0.220 | grafico (0.495, 3.33, 12.523, 1.18) | 0.000 |
| 16 `p_slide_3_graficos_poblacion_tira` | p158 | 3 | grafico (0.495, 4.85, 12.523, 1.4) | grafico (0.495, 5.01, 12.523, 1.24) | +0.000, +0.160, +0.000, -0.160 | grafico (0.495, 5.01, 12.523, 1.24) | 0.000 |
| 18 `p_slide_4_graficos` | p162 | 1 | grafico (0.495, 1.65, 6.012, 2.2) | grafico (0.495, 1.65, 6.012, 2.31) | +0.000, +0.000, +0.000, +0.110 | grafico (0.495, 1.65, 6.012, 2.31) | 0.000 |
| 18 `p_slide_4_graficos` | p162 | 2 | grafico (7.007, 1.65, 6.012, 2.2) | grafico (7.007, 1.65, 6.012, 2.31) | +0.000, +0.000, +0.000, +0.110 | grafico (7.007, 1.65, 6.012, 2.31) | 0.000 |
| 18 `p_slide_4_graficos` | p162 | 3 | grafico (0.495, 4.05, 6.012, 2.2) | grafico (0.495, 4.36, 6.012, 1.89) | +0.000, +0.310, +0.000, -0.310 | grafico (0.495, 4.36, 6.012, 1.89) | 0.000 |
| 18 `p_slide_4_graficos` | p162 | 4 | grafico (7.007, 4.05, 6.012, 2.2) | grafico (7.007, 4.36, 6.012, 1.89) | +0.000, +0.310, +0.000, -0.310 | grafico (7.007, 4.36, 6.012, 1.89) | 0.000 |
| 19 `p_slide_5_graficos_poblacion` | p164 | 1 | grafico (0.495, 1.65, 3.841, 2.2) | grafico (0.495, 1.65, 3.908, 2.285) | +0.000, +0.000, +0.067, +0.085 | grafico (0.495, 1.65, 3.908, 2.285) | 0.000 |
| 19 `p_slide_5_graficos_poblacion` | p164 | 2 | grafico (4.836, 1.65, 3.841, 2.2) | grafico (4.803, 1.65, 3.908, 2.285) | -0.033, +0.000, +0.067, +0.085 | grafico (4.803, 1.65, 3.908, 2.285) | 0.000 |
| 19 `p_slide_5_graficos_poblacion` | p164 | 3 | grafico (9.177, 1.65, 3.841, 2.2) | grafico (9.11, 1.65, 3.908, 2.285) | -0.067, +0.000, +0.067, +0.085 | grafico (9.11, 1.65, 3.908, 2.285) | 0.000 |
| 19 `p_slide_5_graficos_poblacion` | p164 | 4 | grafico (0.495, 4.05, 6.012, 2.2) | grafico (0.495, 4.335, 5.862, 1.915) | +0.000, +0.285, -0.150, -0.285 | grafico (0.495, 4.335, 5.862, 1.915) | 0.000 |
| 19 `p_slide_5_graficos_poblacion` | p164 | 5 | grafico (7.007, 4.05, 6.012, 2.2) | grafico (7.157, 4.335, 5.862, 1.915) | +0.150, +0.285, -0.150, -0.285 | grafico (7.157, 4.335, 5.862, 1.915) | 0.000 |
| 20 `p_slide_6_graficos_poblacion` | p166 | 1 | grafico (0.495, 1.65, 3.841, 2.2) | grafico (0.495, 1.65, 3.908, 2.2) | +0.000, +0.000, +0.067, +0.000 | grafico (0.495, 1.65, 3.908, 2.2) | 0.000 |
| 20 `p_slide_6_graficos_poblacion` | p166 | 2 | grafico (4.836, 1.65, 3.841, 2.2) | grafico (4.803, 1.65, 3.908, 2.2) | -0.033, +0.000, +0.067, +0.000 | grafico (4.803, 1.65, 3.908, 2.2) | 0.000 |
| 20 `p_slide_6_graficos_poblacion` | p166 | 3 | grafico (9.177, 1.65, 3.841, 2.2) | grafico (9.11, 1.65, 3.908, 2.2) | -0.067, +0.000, +0.067, +0.000 | grafico (9.11, 1.65, 3.908, 2.2) | 0.000 |
| 20 `p_slide_6_graficos_poblacion` | p166 | 4 | grafico (0.495, 4.05, 3.841, 2.2) | grafico (0.495, 4.5, 3.908, 1.75) | +0.000, +0.450, +0.067, -0.450 | grafico (0.495, 4.5, 3.908, 1.75) | 0.000 |
| 20 `p_slide_6_graficos_poblacion` | p166 | 5 | grafico (4.836, 4.05, 3.841, 2.2) | grafico (4.803, 4.5, 3.908, 1.75) | -0.033, +0.450, +0.067, -0.450 | grafico (4.803, 4.5, 3.908, 1.75) | 0.000 |
| 20 `p_slide_6_graficos_poblacion` | p166 | 6 | grafico (9.177, 4.05, 3.841, 2.2) | grafico (9.11, 4.5, 3.908, 1.75) | -0.067, +0.450, +0.067, -0.450 | grafico (9.11, 4.5, 3.908, 1.75) | 0.000 |
| 21 `p_slide_3_graficos_poblacion_cifras` | p169 | 1 | cifras (0.495, 1.65, 3, 4.6) | cifras (0.495, 1.65, 3.0, 4.6) | +0.000, +0.000, +0.000, +0.000 | cifras (0.495, 1.65, 3, 4.6) | 0.000 |
| 21 `p_slide_3_graficos_poblacion_cifras` | p169 | 2 | grafico (3.9, 1.65, 4.4, 2.2) | grafico (3.945, 1.65, 4.312, 1.75) | +0.045, +0.000, -0.088, -0.450 | grafico (3.945, 1.65, 4.312, 1.75) | 0.000 |
| 21 `p_slide_3_graficos_poblacion_cifras` | p169 | 3 | grafico (3.9, 4.05, 4.4, 2.2) | grafico (3.945, 3.75, 4.312, 2.5) | +0.045, -0.300, -0.088, +0.300 | grafico (3.945, 3.75, 4.312, 2.5) | 0.000 |
| 21 `p_slide_3_graficos_poblacion_cifras` | p169 | 4 | grafico (8.75, 1.65, 4.268, 4.6) | grafico (8.707, 1.65, 4.312, 4.6) | -0.043, +0.000, +0.044, +0.000 | grafico (8.706, 1.65, 4.312, 4.6) | 0.001 |
| 22 `p_slide_cifras_y_graficos` | p171 | 1 | cifras (0.495, 1.65, 12.523, 1.2) | cifras (0.495, 1.65, 12.523, 1.2) | +0.000, +0.000, +0.000, +0.000 | cifras (0.495, 1.65, 12.523, 1.2) | 0.000 |
| 22 `p_slide_cifras_y_graficos` | p171 | 2 | grafico (0.495, 3.05, 6.012, 3.2) | grafico (0.495, 3.25, 6.012, 3.0) | +0.000, +0.200, +0.000, -0.200 | grafico (0.495, 3.25, 6.012, 3) | 0.000 |
| 22 `p_slide_cifras_y_graficos` | p171 | 3 | grafico (7.007, 3.05, 6.012, 3.2) | grafico (7.007, 3.25, 6.012, 3.0) | +0.000, +0.200, +0.000, -0.200 | grafico (7.007, 3.25, 6.012, 3) | 0.000 |

## El motor

| Tipo | Quién dibuja la geometría | Estado |
|---|---|---|
| 13 1+2 | nativo, `lamina_mixtas.R` (`graficos_3_1mas2`) | ya dibujaba lo de la p151; sólo el json estaba mal |
| 14 1 arriba | nativo, `lamina_mixtas.R` (`graficos_3_1arriba`) | ya dibujaba lo de la p154; sólo el json estaba mal |
| 18 cuatro | nativo, `lamina_mixtas.R` (`paneles_4`) | ya dibujaba lo de la p162; sólo el json estaba mal |
| 21 cifras lateral | nativo, `lamina_mixtas.R` (`poblacion_3_cifras`) | **alineado** (0bf0344c2, 1bfbec8a4): columnas en 3.945/8.707 de 4.312, preguntas en 1.65/3.75, filetes en 3.6, 3.2, 3.715 y 8.487; cifras como la pieza `cifra()` (caja en 0.495 de 3.0, valor de 0.62 en 1.8 y 3.5). Tests a 0.02 in: `test-lamina-cifras-lateral-recetario.R` |
| 22 cifras en banda | nativo, `lamina_mixtas.R` (`cifras_y_graficos`) + `lamina_cifras_pieza.R` | **alineado** (1bfbec8a4): cifras de 3.908 con calles de 0.4 a 32 pt (valor 0.62 en 1.6, rótulo en 2.22, detalle en 2.5), separadores de 1.65 a 2.8, filete en 3.05, gráficos en 3.25, sin filete entre ellos. Test: `test-lamina-cifras-banda-recetario.R` |
| 3, 4, 8, 9, 11, 16, 19, 20 | ruta anterior: layouts de `plantilla_16_9.pptx` | **alineado** (0d48faed3): los placeholders se escriben desde el estándar (`plantilla_layouts_estandar.R`, `api/scripts/plantilla_layouts_desde_estandar.R`); test de conformidad `test-plantilla-layouts-estandar.R` (0.02 in y `type_idx` de officer). En cinco y seis gráficos, desempate de hasta 0.002 in en y para conservar el orden del contrato (`pic1` = arriba al centro). El ícono del público pasa a la cabecera (0.495, 0.18, 0.3), como en p158/p164/p166. **Corrección**: en 0d48faed3 los tipos 19 y 20 no quedaron alineados: la calibración de íconos sólo aceptaba un cuadrado de 1 in centrado y suprimía en silencio el de cabecera. Lo arregla 0c70448ce (`reporte_plan_icono_cajon.R`): el ícono sale en la cabecera y, si un layout no tiene cajón, se avisa. Test de render: `test-poblacion-5-6-render-estandar.R` |

La banda de cifras: p169 y p171 (láminas de composición) dibujan la pieza `cifra()` de recetario_piezas.R:51; p174 y
p175 (cifras solas) dibujan otra banda (caja corrida 0.1, calle de 0.45). Difieren, así que la geometría va por tipo
desde el estándar: `ppt.geometria.cifra_pieza` y `tipos_lamina[].cifras` (`valor_pt`, `calle`). Las láminas de cifras
solas no cambian, y lo fija un test.

## Verificación

- `test-estandar-ranuras-recetario.R`: rojo antes del cambio (93 fallos) y verde después.
- `test-estandar-tokens.R`: el exportador reproduce el json versionado.
- En verde también: `test-lamina-cifras-lateral-recetario.R`, `test-graficos-cifra.R`, `test-lamina-mixtas.R`,
  `test-lamina-corona.R`, `test-graficos-estandar-api.R`, `test-graficos-preview-formas.R`, `test-lamina-paneles.R`,
  `test-estandar-grosor.R` y `test-graficos-recetario-ejemplos.R`.
- acrconta (copia local de `n8/app/acrconta_mazo_trabajo.pulso`, el mismo flujo antes de K15, en 5da1e20c1, y después, en
  0bf0344c2): 93 láminas y **0 distintas** al comparar el XML de cada lámina sin ids. El mazo no usa los tipos 21 ni 22,
  y su tipo 4 nativo ya dibujaba lo de la p162.

## Pendientes

1. ~~Frontend: regenerar `ranurasEstandar.generated.ts`~~. Lo hizo el lead; `--check` al día.
2. **Respaldo de los nativos** (13, 14, 18, 21 y 22 cuando no caben en nativo): sus layouts (`graficos_3_1mas2`,
   `graficos_3_1arriba`, `4_paneles`, `poblacion_3_cifras`, `cifras_y_graficos`) no entraron en la correspondencia de
   `plantilla_layouts_estandar.R`. Se suman con una fila por placeholder.
3. ~~Fichas del recetario~~: hecho en a8fff99fe por decisión de Gonzalo («sí, regenera las fichas del recetario»).
   `TIPOS` lee las ranuras del estándar. Cambian sólo el catálogo (p120, p121) y 14 fichas; ninguna lámina de ejemplo.
   Quedan sin regenerar `recetario-moderna-guias.pptx` y `recetario-fiel.pptx`. El catálogo de ejemplos
   (`api/inst/recetario/ejemplos/catalogo.json`) guarda el sha256 del recetario anterior; los WebP no cambian porque
   ninguna página de ejemplo se movió.
4. **Revisión visual**: en la tira, el ícono de cabecera queda pegado al inicio del título, como en el recetario
   (mosaico en el scratchpad de la sesión).
