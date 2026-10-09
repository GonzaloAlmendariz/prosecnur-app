# Checklist — Remasterización de los motores de PPT y Word, y su editor (2026-10-08)

Vara y plan en [goal-remasterizacion-motor-2026-10-08.md](goal-remasterizacion-motor-2026-10-08.md). ADR [0092](../adrs/0092-el-recetario-es-el-estandar-del-motor.md).

## Indicaciones de Gonzalo

| # | Indicación (textual) | Dónde vive | Estado |
|---|---|---|---|
| R1 | «el recetario moderno de PPT, y el recetario moderno de Word… son la base fundamental y central en la cual debe basarse la completa remasterización de los actuales motores» | ADR 0092, `estandar_pulso.json` | ◐ estándar exportado |
| R2 | «cuando me refiero al motor, no solo me refiero al motor que genera los gráficos, sino a la interfaz que permite la generación de los mismos gráficos» | F6 | ☐ |
| R3 | «la UI… tiene muchos fallos, como por ejemplo el selector dinámico que te permite ampliar o disminuir el tamaño de ciertos placeholders» | F6, `ChartLayoutPopover.tsx` | ☐ |
| R4 | «un repensamiento completo, pero manteniendo todo lo bueno que ya tiene ProSecNur a nivel de interfaz usuaria» | F6 | ☐ |
| R5 | «de PPT y de Word, las paletas, los diseños» | F1 a F4; F1 llevó colores y Likert al estándar | ◐ |
| R6 | «que sea muy fino, muy cuidadoso, que respete las proporciones, que respete los estándares que ya están establecidos en los recetarios» | banco de conformidad F0, todas las fases | ☐ |
| R7 | Estilos: «El recetario es el estándar»; perfiles de cliente sólo cambian logo y paleta | F1, `estandar_presets.R` impone tamaños y fuente; colores quedan al perfil | ◐ |
| R8 | Proyectos: «Migran solos», con aviso de lo que no tenga equivalente | F5; adelantado en F1 para el estilo base (`[PULSO-AVISO]` con cada clave cambiada) | ◐ |
| R9 | Word: «El documento completo» | F4 | ☐ |
| R10 | Ritmo: «Loop con hitos y commits»; tick de 60 s («deja el loop a un minuto no 5») | loop | ☑ abierto |
| R11 | «estas comaprandolo con el recetario?» · «deja de comparar solo de forma numérica, tienes que también comparar de forma visual» | `scripts/qa_pares_recetario.R`; gate visual por pares (ADR 0093, decisión 4) | ☑ banco; se aplica en cada fase |
| R12 | «estamos cambiando fundamentalmente absolutamente toda la estructura de todos los graficadores que pasan de usar ggplot a … elementos nativos de PowerPoint… tómalo con la importancia que merece» | ADR 0093 (aceptado: «Lo apruebo»), fases N0-N9 | ◐ N0 ☑, N1 en curso |
| R13 | «Debe ser 100% fiel al recetario, el motor ahora debe replicar le recetario» | ADR 0093 punto 2: redondeo láms. 20-21, Top Two Box = suma de lo rotulado (lám. 19), SIN INF en la barra, orden por Top Two Box | ◐ escalas en N1 |
| R14 | Top Two Box: «Mantener, que el analista las declare, pero para armarlo debe pedirle dos y la UI debe ser intutiva» | motor: `.box_decidir` sin deducción (sigue); UI: selector de exactamente dos categorías de la escala al encender el Top Two Box (N9, editor) | ☐ |

## Fases

> Desde el 2026-10-08 22:3x las fases F2 a F6 se rehacen con el plan del ADR 0093 (motor nativo, N0 a N9). F0 y F1 siguen valiendo:
> son la fuente de verdad (`estandar_pulso.json`) que las piezas nativas leen.

| Fase ADR 0093 | Contenido | Estado |
|---|---|---|
| N0 | ADR 0093 (revisado por guardian-contratos y revisor-metodologico, aceptado), banco de pares `scripts/qa_pares_recetario.R` (línea base del motor ggplot: 16 a 29 % de píxeles distintos) | ☑ |
| N1 | `preparar_escala` (30 tests de invariantes), primitivas agrupadas `lamina_piezas.R`, bloque de escala `lamina_escala.R`, compositor `lamina_compositor.R` (pares 216 1.0 %, 221 0.9 %, 222 1.0 %), enganche en el graficador y en la rama `slide_1`, migración del coral de fábrica | ◐ falta gate amplio, commit y verificador. Deuda declarada: `n_slides` y vista previa no cuentan las partes de «(cont.)» |
| N2-N9 | Escalas en paneles, proporciones, números, dimensiones, ggplot con estilo del recetario, 22 tipos e identidad, Word, editor | ☐ |

Plan anterior (F0-F7):

| Fase | Contenido | Estado |
|---|---|---|
| F0 | Contrato: `estandar_pulso.json` (☑), ADR 0092 (☑), banco `scripts/qa_estandar_conformidad.R` (☑, línea base 39 % de 530 medidas) | ☑ |
| F1 | Tokens en el motor: `estandar_tokens.R`, imposición del estándar sobre lo guardado (`estandar_presets.R`, base_pt 0 % → 100 %, conformidad 39 % → 45 %), colores de la casa y Likert del núcleo desde tokens en graficadores y láminas de identidad; contrato de colores. Tamaños de firma pasan a F2 (Word pasa los suyos). Verificador APROBADO 2026-10-08 | ☑ |
| F2 | Graficadores conformes (grosor por filas, cifras chicas, Top/Bottom Two Box, leyendas, dicotómica, dumbbell, serie, histograma, radar, calor, mapas) y gráficos nuevos (metas, matriz, forest, cambio, peso, competencias) | ☐ |
| F3 | Lámina PPT: plantilla `plantilla_pulso_2026.pptx`, antetítulo, pregunta fuera de la imagen, 22 tipos, láminas de identidad | ☐ |
| F4 | Word completo: `reporte_word_documento.R` e identidad, estilos, SEQ, índices, secciones, «Cómo leer» | ☐ |
| F5 | Migración de planes y `.pulso`, con avisos | ☐ |
| F6 | Editor: selector de 22 tipos, distribución del espacio estable, vista previa fiel, «Estilo global» reducido | ☐ |
| F7 | Cierre integral con proyectos de referencia, verificador y notas | ☐ |
