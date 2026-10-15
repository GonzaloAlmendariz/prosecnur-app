# Checklist — la matriz de equivalencias permite todo lo que propone la OIGD (2026-10-15)

Tipo: Checklist de lote
Estado: En curso
Fecha: 2026-10-15
Autoridad: Pedido de Gonzalo del 2026-10-15; decisión de diseño en ADR 0105 (Propuesto)

Pedido de Gonzalo: «asegurémonos por favor que la UI de la matriz de equivalencias permita hacer todo lo que Nadia
propone incluyendo códigos estándar y etiquetas del tenor estándar y hasta variables agregadas o nuevas estándar para
los cruces», y luego «lánzala» (prueba real con 2024, 2025 y 2026 en una copia).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| M1 | Códigos estándar por categoría (37 bloques) | `armonizacion.escala` + `mapa` por base (`equivalencias_armonizacion.R`, `ArmonizacionFilaEditor.tsx`) | ☑ ya existía |
| M2 | Etiquetas estándar | `etiqueta_estandar` de la fila y `escala[].etiqueta` | ☑ ya existía |
| M3 | Agrupar categorías (7 bloques: A-05, A-06, S-05…) | varios códigos de la base al mismo código de la escala | ☑ ya existía |
| M4 | Otra lectura de una sola pregunta: dicotomía T-01, tramos S-01, antigüedad S-08 | otra fila sobre la misma variable; S-08 con mapa por base relativo al año | ☑ S-08 hecho en la prueba real (mapa por base, 4 tramos); dicotomía y tramos usan el mismo mecanismo |
| M5 | Indicador compuesto de varias preguntas (AP-12, CO-01, CO-03…) | ADR 0105 (Propuesto), `equivalencias_derivadas.R`, editor «Añadir indicador compuesto» | ☑ f90a96a01; probado en pantalla: «VBG: recurrió a alguna instancia de la PUCP» (P28_2…P28_10 / P29_2…P29_10) da 81/74/122 «sí» y entra al comparativo simple y al de cruces |
| M6 | Toda fila armonizada sirve de cruce | `armonizada_apilar(cruces=)` | ☑ ya existía |
| M7 | Prueba real: cargar 2024, 2025 y 2026 en una copia, armar la matriz, generar entregables 2, 5, 6, 8 y 9 y comparar con la maqueta | copia en el scratchpad de la sesión (`prueba_matriz/out/hsyvbg_2024_2026_matriz.pulso`) | ◐ 8 y 9 generados en pantalla; cifras 2024 y 2025 idénticas a la maqueta. 2, 5 y 6 no dependen de la matriz y esperan la base 2026 de 2 500 |
| M8 | Insumos 2024 y 2025 para Ulises | `01_Estudios/2026_PUCP_HSyVbG/Procesamiento/Insumos 2024-2025 para la matriz/` | ☑ (XLSForm reemplazados por los aplicados: 2024 v5, 2025 Instrumento2025) |

## Aprendido

- La matriz de la OIGD clasifica sus recomendaciones así: 37 recodificar/homologar, 7 agrupar, 14 nueva variable o
  derivada (de ellas 6 combinan varias preguntas), 2 no comparar, 1 relativa al año.
- En la carpeta de insumos había quedado el XLSForm 2024 v2 y una versión de 2025 sin `banner_1` ni «Fuera del país»;
  los aplicados son `HSYVBG2024_v5.xlsx` y `Historico 2025/Instrumento2025.xlsx`.

## Fricciones encontradas en la prueba real (2026-10-15)

| # | Fricción | Dónde | Estado |
|---|---|---|---|
| F1 | Un `.sav` que llega como segunda base no declaraba bases separadas: Equivalencias quedaba apagada y Plan mostraba «Elegida» sin haberlo guardado | `carga_sav_registrar_base` | ☑ corregido (declara `separate` si no había topología) |
| F2 | Agrupar 26 departamentos × 3 bases exige 78 selectores uno por uno; no hay «marcar varios → categoría» | `ArmonizacionFilaEditor.tsx` | ☑ barra «N marcados → categoría · Asignar» por base |
| F3 | El aviso «N códigos con etiqueta distinta a la de su destino» salta en toda agrupación, donde es lo esperado | mismo editor | ☑ sólo avisa destinos 1:1; las agrupaciones se resumen aparte |
| F4 | Una variable numérica sin etiquetas (2024 `anio_ingreso`) no muestra sus valores hasta guardar la escala, sin decir que hay que guardar | preview de armonización | ☐ |
| F5 | Las filas «Misma escala» no entran al comparativo hasta abrirlas y confirmarlas una por una | Equivalencias | ☑ botón «Confirmar las N de misma escala» (no toca compuestas ni filas sin guardar) |
| F6 | El orden de la serie arranca en el orden de carga (2026 → 2024 → 2025) aunque los nombres son años | Orden de la serie | ☐ |
| F7 | Ponderación › «Usar una columna» dice «Esta base no tiene columnas numéricas» mientras las variables cargan (~60 s con 409 columnas); tras cambiar de base no las vuelve a pedir | `PesoPorColumna.tsx`, `/api/analitica/variables` | ☑ «Cargando las columnas de la base…» y recarga al cambiar de base; la consulta sigue tardando ~60 s |
| F8 | Cambiar de base activa tarda 20–40 s sin indicador | `ChromeBaseSelector.tsx` | ☐ |
| F9 | Al elegir «Varias bases» en Plan, la tabla dice «Aún no hay bases creadas» con la base 2026 cargada | Plan | ☐ |
| F10 | Las etiquetas de Kobo se muestran con su marcado (`*de la PUCP*`) en los buscadores | buscadores de Equivalencias | ☐ menor |
| F11 | Pie del comparativo distinto de la maqueta: falta el año en «Fuente», falta «Base: …» por pregunta y sigue la línea de ponderación que Gonzalo pidió no poner | `reporte_comparativo.R` | ☑ «Fuente: Pulso PUCP 2026.», «Base: …» por pregunta (declarada o calculada), sin línea de ponderación por año; verificado sobre la matriz real |
| F12 | El título de cada tabla del comparativo es el nombre estándar; la maqueta usa el enunciado de la pregunta | `reporte_comparativo.R` | ☑ título = enunciado declarado (campo «Enunciado en el informe»), sin marcado de Kobo |
