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
| F6 | El orden de la serie arranca en el orden de carga (2026 → 2024 → 2025) aunque los nombres son años | Orden de la serie | ☑ d34e8d519: por año en las dos capas + «Ordenar por año» |
| F7 | Ponderación › «Usar una columna» dice «Esta base no tiene columnas numéricas» mientras las variables cargan (~60 s con 409 columnas); tras cambiar de base no las vuelve a pedir | `PesoPorColumna.tsx`, `/api/analitica/variables` | ☑ «Cargando las columnas de la base…» y recarga al cambiar de base; la consulta sigue tardando ~60 s |
| F8 | Cambiar de base activa tarda 20–40 s sin indicador | `ChromeBaseSelector.tsx` | ☑ d34e8d519 «Cambiando a 2024…»; b92c68aab y 667f0d8fa bajan el cambio a ~1 s; 62f7498c6 cierra el menú |
| F9 | Al elegir «Varias bases» en Plan, la tabla dice «Aún no hay bases creadas» con la base 2026 cargada | Plan | ☑ d34e8d519 |
| F10 | Las etiquetas de Kobo se muestran con su marcado (`*de la PUCP*`) en los buscadores | buscadores de Equivalencias | ☑ d34e8d519 |
| F11 | Pie del comparativo distinto de la maqueta: falta el año en «Fuente», falta «Base: …» por pregunta y sigue la línea de ponderación que Gonzalo pidió no poner | `reporte_comparativo.R` | ☑ «Fuente: Pulso PUCP 2026.», «Base: …» por pregunta (declarada o calculada), sin línea de ponderación por año; verificado sobre la matriz real |
| F12 | El título de cada tabla del comparativo es el nombre estándar; la maqueta usa el enunciado de la pregunta | `reporte_comparativo.R` | ☑ título = enunciado declarado (campo «Enunciado en el informe»), sin marcado de Kobo |

## Decisión de Gonzalo (2026-10-15): estándar de N y ponderación

«Sigamos ese mismo estándar»: como en las tablas entregadas en 2024 y 2025, el total de cada tabla es el N
ponderado (2025 cierra en 2 500 con n real 2 471; 2024 en 2 267,97) y el pie no lleva ninguna nota de
ponderación, ni por año ni sobre el N ponderado. Sólo «Fuente: Pulso PUCP <año>.» y «Base: …». Commits
d7085e93f y 5ab1dfcad.

## Segunda tanda (Gonzalo, 2026-10-15): la UI todavía puede ser más clara

Pedido textual: «tratemos de mejorar la UI aún más, por ejemplo aún no te dice las diferencias entre bases o por
ejemplo la base 2024 y 2025 ya tiene los indicadores pero la del 2026 aún no, ¿se pueden armarlos? ¿Qué pasa con la
armonización de opciones? ¿Qué pasa si Ulises ya tiene la base lista limpia y codificada con los 2500 casos
aleatorios, y con los indicadores creados ahí mismo, la app es capaz de reconocerlo? ¿Hace falta que el XLSForm
también tome en cuenta estos indicadores?»

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| G1 | La UI dice qué tiene cada base y qué le falta frente a las otras | por definir (Equivalencias / Plan) | ☑ panel «Mapa de bases» (5fe338e9e); metadatos plegados al final |
| G2 | Armar en 2026 las variables que 2024 y 2025 ya traen recodificadas (`_R`, `facultad`, `unidad`…) | por definir (Codificación / indicador compuesto materializado) | ☑ 47ebfe245, 4724ab5f9: en 2026 «vbg_instancia_pucp» (alguna de P29_2…P29_10) da Sí 122 · No 785 · Sin dato 2 411, igual que el compuesto de la matriz, y aparece en Analítica y en Equivalencias |
| G3 | Armonización de opciones: armonizar una escala una vez y aplicarla a todas las preguntas que la comparten | Equivalencias | ☑ «Aplicar a otras con la misma escala» (5fe338e9e) |
| G4 | Una base 2026 preparada fuera (limpia, codificada, 2 500 casos, con indicadores) se reconoce tal cual | ADR 0100, origen externo | ◐ funcional verificado (panel «Variables de la base», «ya codificada», retiradas pendientes); falta mirarlo con una base que traiga columnas fuera del formulario |
| G5 | ¿El XLSForm tiene que declarar esos indicadores? | Carga (columnas fuera del instrumento) | ☑ con ADR 0106 ya no hace falta tocar el XLSForm |

Aprendido: lo que 2024 y 2025 traen «de más» no son indicadores compuestos sino recodificaciones del procesamiento de
esos años: variables `_R` (P12_R, P13_R… con 100 = «Perdido»), dummies de opción múltiple `P25.1_R`…, sociodemográficas
renombradas (Edad, Sexo, Identidad_genero, lugar_nacimiento, anio_ingreso), `facultad`, `unidad`/`unidad_value`,
`Curso_horario`. 2024: 409 columnas, 100 casan con el XLSForm aplicado. 2025: 278, 115 casan.

## Reporte de Ulises (2026-10-15): textos «Otro» borrados en P11 y P27

Fuente: `01_Estudios/2026_PUCP_HSyVbG/Procesamiento/Segunda semana/Prosecnur_Textos borrados en Otros P11 y P27.docx`.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| H1 | Una pregunta con texto «Otro» vinculado y CERO grupos de codificación pierde todos sus textos al preparar la codificación (P11_otro 2, P27_otro 12; en la muestra de 2 500 faltan 10) | Codificación (preparar / plantilla / adaptar) | ☑ arreglado: lectura de datos Excel con guess_max de toda la hoja (`.read_excel_data`) en todas las lecturas de datos, y el reparador no reescribe el archivo si una columna ajena perdería valores. Sobre la base del 09/10: P11_otro 0 → 2, P27_otro 0 → 12. Los .pulso ya guardados conservan la pérdida: se restaura desde la base limpia por `_uuid` |
| H2 | La base adaptada no trae las 130 columnas dicotómicas de las opciones múltiples (p. ej. P26/1); la información sigue en la columna principal | Codificación › adaptar / exportes | ☑ diseño: `normalize_data_for_xlsform` pliega 129 dummies en 10 madres (data_normalizer.R:873, 960-979); los exportes de BBDD las regeneran (`.expand_multiselect`) |

## Tercera tanda (Gonzalo, 2026-10-15): la app se explica sola

Pedidos textuales: «¿no se pueden llamar de una forma estandarizada como PX_cruce?»; «a Ulises no hay que prepararle un
Word ni nada sino dejarle la app súper fina, entendible y didáctica y sobre todo consistente».

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| I1 | Segmentos de cruce del estudio con nombre estándar `cruce_<clave>` en todas las bases | ADR 0107 (Propuesto) | ◐ backend en construcción; panel después |
| I2 | Recorrido de la serie: pasos, estado y dónde se hace cada uno | Equivalencias (banda superior) | ◐ en construcción |
| I3 | Comparativos dicen el estado de la ponderación por base y avisan si falta | Analítica › Comparativos | ◐ en construcción |
| I4 | Pasada de consistencia sobre las superficies nuevas y tocadas | Carga, Equivalencias, Analítica | ☐ al cerrar I1–I3 |
| I5 | Sin guía externa para el equipo: la app se explica sola | criterio | ☑ registrado |

Aprendido: las `_recod` de 2026 (`P3_recod`, `P4_recod`, `P8_recod`, `P23_recod`, `P52_recod`) las agregó Codificación al
adaptar; son la pregunta con los «Otro» codificados, no segmentos. `indice_vbg`/`indice_hs` son `calculate` del Kobo.
