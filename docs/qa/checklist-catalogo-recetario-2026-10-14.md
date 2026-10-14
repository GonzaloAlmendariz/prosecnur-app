# Checklist · proyecto catálogo del recetario (.pulso de prueba)

Tipo: Checklist y hallazgos de QA
Estado: Vigente
Fecha: 2026-10-14
Autoridad: Gonzalo: «crear un .pulso que contemple absolutamente todos los gráficos posibles según el recetario». Sólo Gonzalo da por terminado un ítem

Pedido de Gonzalo (2026-10-14): «crear un .pulso que contemple absolutamente todos los gráficos posibles según el
recetario para poder poner a prueba cómo se ven todos a nivel de la maqueta, UI y personalización disponible».
Alimenta `checklist-configuraciones-graficos-2026-10-13.md` (inventario) y el ítem 9 de `checklist-maqueta-ficha-2026-10-13.md`.
Sólo Gonzalo da por terminado un ítem.

## Por qué sintético y no `acrconta_mazo`

`acrconta_mazo` (referencia anonimizada, 4 bases) no trae lo que el recetario necesita: **cero** preguntas de opción
múltiple (p72–p73, p191, radar por selección), texto abierto sólo en los «Otro, especifique» (nube p101–p104), una
sola numérica por base y ninguna dimensión calculada. El catálogo del motor (`docs/qa/motor-ppt-2026-10-06/herramientas/
catalogo_motor.R`) lo suplía en memoria y la app no lo ve. Un estudio generado por script es reproducible bit a bit,
no tiene datos de cliente y cubre cada tipo de variable a propósito.

## Ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| K1 | Instrumento y datos sintéticos de tres públicos (docentes ~52, estudiantes ~172, egresados ~178, como el recetario): escalas de acuerdo con SIN INF, utilidad, satisfacción; categóricas (ciclo, sexo, grado); dicotómicas; opción múltiple (mejoras, canales); numéricas (edad, años, ingreso); texto abierto con frases reales de encuesta; competencias comunes a los tres públicos; semilla fija | `api/R/catalogo_recetario_datos.R` (nuevo) | hecho, por verificar por Gonzalo: 5 bases (52 docentes, 172 estudiantes, 178 egresados y los procesos 2018 y 2021); acreditación con la misma escala, con escalas de 5 y 4 puntos (servicios) y con otra caja en las etiquetas y otros nombres de variable (egresados `p40_*`) |
| K2 | Estudio con las tres bases y sus equivalencias por la ruta de la app (carga, `estudio_add_base`), dimensiones calculadas por Analítica | `api/R/catalogo_recetario.R` (nuevo) | hecho, por verificar: por la ruta de la carga; las dimensiones viajan en la base de estudiantes |
| K3 | Plan: una lámina por variante del recetario (cap. 2, p68–p112) agrupadas por sus capítulos 2.1–2.8 con separadores, y las configuraciones que cambian lo dibujado (multiapiladas en sus cinco lecturas, Top/Bottom Two Box, ancho de temas, respuestas por público, significancia, 0–100 % con marcas, promedio, formato de cifra, top N, saldo, brecha…) | `catalogo_recetario.R` | hecho, por verificar: 119 láminas por capítulos del recetario |
| K4 | Láminas de estructura en todas sus variantes: portada ×3, índice ×4 composiciones con y sin subcapítulos, separador ×7, objetivo ×3, ficha técnica, top two box, redondeo, cierre ×5, texto; y las 22 composiciones de gráficos | `catalogo_recetario.R` | hecho, por verificar: las 33 láminas del registro, con portada ×3, índice ×4, separador ×7, objetivo ×3 y cierre ×5 |
| K5 | Lo que el motor no produce (p69 torta con leyenda de cifras, p85 conteos por año, p98 peso en la satisfacción, p103–p104 frases y temas, mapas territoriales) entra como lámina de texto que dice qué falta, no se omite | `catalogo_recetario.R` | hecho, por verificar: 8 láminas de texto dicen qué falta |
| K6 | Script y Makefile: `make catalogo-recetario-build` escribe `api/inst/reference_projects/recetario_catalogo/` con su manifiesto | `api/scripts/`, `Makefile` | hecho: `make catalogo-recetario-build` escribe `api/inst/recetario_catalogo/recetario_catalogo.pulso` (175 KB). No va en `reference_projects/`: no tiene origen de cliente ni pasa por el anonimizador |
| K7 | Verificación: el plan valida, el PPT y el Word exportan, y la lista de avisos por lámina queda en el manifiesto (ningún «Sin datos» sin explicar) | test `test-catalogo-recetario.R` | PPT hecho (122 láminas, ninguna «Sin datos»); falta el Word. Antes: `test-catalogo-recetario.R` exige que el plan valide y cubra los 26 gráficos vigentes y los 33 tipos de lámina. El PPT sale con 124 láminas; 6 salen «Sin datos» (ver hallazgos) |
| K8 | Recorrido en la app con `/ver-ui`: cada lámina en el editor (maqueta, pestaña Gráfico, ajustes disponibles); hallazgos al inventario de configuraciones | QA en vivo | hecho, por verificar: maqueta de las 115 láminas (M1–M8) y pestaña Gráfico de los 24 tipos (I1–I6) |

## Hallazgos del catálogo (2026-10-14)

| # | Hallazgo | Estado |
|---|---|---|
| H1 | «Una pregunta por grupos» y «Barras apiladas por grupos» salían «Sin datos» en todo estudio de varias bases: la rama `modo = "cruce"` resolvía `var` sin su base (`reporte_plan_ppt.R`, `.tab_freq`) | arreglado; `test-plan-multibase-cruce.R` rojo antes y verde después. La prueba vieja usaba `expect_no_error`, que no ve el «Sin datos» porque el motor atrapa el error |
| H2 | Los gráficos de dimensiones (p95–p99) salen «Sin datos» **en cualquier estudio, no sólo en el catálogo**: Analítica › Dimensiones guarda las dimensiones con su trazabilidad en `s$rp_dim` (POST /api/analitica/dimensiones/build) y Gráficos lee las bases del estudio (`.graficos_processing_sources`), que no las traen; el render exige `recodificacion_items_meta`. Reproducido por la ruta de la app (2026-10-14): `rp_dim` trae `idx_comp2` y el atributo; Gráficos no ve ninguno de los dos | **hecho, por verificar.** Eran dos defectos: (1) Gráficos no leía `rp_dim`: ahora une las dimensiones a la base de la que salieron (`graficos_dimensiones_fuente.R`; el build anota `rp_dim_base`; si las filas no coinciden, avisa y no las pega); (2) al exportar, el job calificaba `objetivo` con la base activa («estudiantes$idx_comp») y el motor ya no lo encontraba (`graficos_jobs.R`). El catálogo construye sus dimensiones por Analítica y su PPT completo sale sin ninguna lámina «Sin datos» |
| H3 | Públicos por tema con escalas distintas (docentes en 5 puntos, estudiantes en 4) salía «Sin datos» si se exportaba por otra vía que el editor | **hecho, por verificar.** Decisión final de Gonzalo (2026-10-14): «normalmente si es la misma pregunta, a pesar de ser diferente actor, van en la misma escala»; las escalas distintas van en bloques separados. Se revirtió la unión de escalas (172b2bf0b). La exportación a PPT y Word rechaza con su motivo una multiapilada con escalas distintas y sugiere «Combinar bloques» (`.plan_errores_escalas`, misma firma que el editor). El catálogo lo muestra resuelto en bloques |
| H4 | El ranking con puntos (p72) no aceptaba opción múltiple, que es justo como lo dibuja el recetario | **hecho, por verificar**: rama propia para opción múltiple (`.ola4_lollipop_sm`), con el porcentaje sobre las personas que respondieron (verificado contra el dato crudo: 41,0 %); el catálogo la dibuja |
| H5 | La misma escala con otra caja en las etiquetas y otros nombres de variable sí se grafica junta | verificado |

## Hallazgos del recorrido en la app (K8, 2026-10-14)

Pila propia: backend 8854 con copia del catálogo, front 5196. Maqueta de cada lámina leída del DOM (tipo, preguntas, ajustes y avisos de la ficha).

| # | Hallazgo | Láminas | Estado |
|---|---|---|---|
| M1 | La maqueta no refleja la configuración fuera de las multiapiladas: formato de cifra, saldo y neutro, top N y resaltada, 0–100 % con marcas, histograma por grupos, media o mediana salen idénticos a su variante (ítem 9 de la ficha) | 22–23, 27–28, 29–30, 32–34, 53–54, 55–56 | hecho, por verificar (ítem 9 de la ficha): 27–28 (neutro) y 29–30 (primeras N y destacada) cambian de dibujo y transitan; 22–23, 53–54 y 55–56 siguen iguales porque la lámina nativa no dibuja esos ajustes (I3, I5, I6); 32–34 esperan `marcas_eje` en el editor (inventario, ítem 3). El dato de la lámina 30 destacaba «5» (código): el motor compara por rótulo y no pintaba nada; ahora «Noveno ciclo», y `test-catalogo-recetario.R` exige que lo destacado sea rótulo y entre en las primeras N |
| M2 | La ficha promete «Top Two Box» donde el PPT lo omite: sin respuestas declaradas, el motor quita la columna y avisa, pero la maqueta lo muestra y el editor dice «0 avisos» | 48, 49, 50, 87 | hecho, por verificar: la ficha avisa «Top Two Box sin respuestas elegidas» y el panel lo cuenta como aviso (no bloquea) |
| M3 | «Temas anchos» no aparece cuando se elige con el control vigente (`ancho_tema`): la ficha sólo lee el `canvas_w_grupo` viejo | 47 | hecho, por verificar: «Temas anchos» / «Temas angostos» desde `ancho_tema`, y la columna se dibuja con el ancho del motor |
| M4 | El índice que toma sus capítulos de los separadores sale vacío en la maqueta | 2 | hecho, por verificar: sin capítulos propios lista los separadores de capítulo, como el motor |
| M5 | «Falta elegir la pregunta» en gráficos que sí la tienen: la ficha no lee `temas` (matriz de cuadrantes) ni `objetivo` (dimensiones) | 66, 73–76 | hecho, por verificar: la ficha lee `temas`, `objetivo` («Dimensiones de Analítica») y los criterios |
| M6 | Cifras inventadas en las fichas: toda dona dice «64 %» y toda cifra destacada «31 %» (el número de ejemplo del glifo) | 26, 60, 100–110 | hecho, por verificar: en la maqueta las cifras de ejemplo son un renglón neutro; el selector conserva sus ejemplos |
| M7 | «Por grupos» no aparece en las barras apiladas con cruce, ni «Diferencias significativas» cuando está encendida | 50, 86, 87 | hecho, por verificar: «Por grupos» con `cruces`, `cruce` o `grupo` en cualquier tipo, y «Diferencias significativas» |
| M8 | Recién abierto, el proyecto se marca «sin guardar» | — | por diagnosticar, acotado (2026-10-14): no pasa abriendo por la API (open + las mismas lecturas del editor); abriendo por la interfaz el inicio del proyecto queda limpio; aparece al entrar a Gráficos, antes de su primera escritura (coverage/miniaturas ya lo encuentran marcado). Siguiente paso: registrar `project_dirty` tras cada lectura en una sesión nueva abierta por la interfaz. Trampa: un rastreo en `session_store.R` lo reinstala el lanzador en la librería compartida; no hacerlo así |

## Hallazgos de la pestaña Gráfico (K8, 2026-10-14)

Inspector › Gráfico de una lámina por tipo, leído del DOM (`.pulso-f6-inspector-cuerpo`).

| # | Hallazgo | Láminas | Estado |
|---|---|---|---|
| I1 | El inspector no mostraba qué preguntas tiene el gráfico (divergentes decía «Elige una pregunta…» con 6 preguntas; serie temporal y tabla no las listaban) | 27, 64, 71 | **hecho, por verificar**: control «Preguntas» para `variables_list` (`ListaPreguntas.tsx`): una lista se edita (cambiar, quitar, agregar); los temas por base o medición se muestran. Con `vars`, la «Pregunta» suelta no aparece. La serie temporal muestra sus temas y mediciones sólo para leer: se genera desde la matriz de equivalencias (decisión fijada en test-graficos-metadata.R). El radar entre públicos también lista sus temas |
| I2 | Mapa de calor por criterio: no se ven ni se editan sus criterios (`config_criterios`) | 74 | hecho, por verificar: «Criterios» en la pestaña Gráfico (`CriteriosGrafico.tsx`), cada uno con su nombre y sus preguntas; agregar y quitar preguntas y criterios. Las columnas 0–100 de Analítica (`r100_*`) se nombran por su pregunta, con «(0–100)». Verificado en vivo en la lámina 74 |
| I3 | Barras categóricas sin «Mostrar promedio» ni formato de la cifra | 22 | **no es un control olvidado**: `mostrar_promedio` y `formato_valor` están en `RETIRADOS` porque la lámina nativa no los dibuja. Va al inventario de configuraciones como función que falta en el dibujo nativo |
| I4 | Ranking con puntos: falta «Resaltar» (el registro lo declara) | 29 | hecho, por verificar: control «Destacar» con las respuestas de la pregunta como botones (`DestacarRespuestas.tsx`); escribe rótulos, que es lo que compara la lámina nativa. Verificado en vivo en la lámina 30 |
| I5 | Diagrama de caja sin ajustes propios (media, atípicos, puntos) | 57 | función que falta en el dibujo nativo (los formales del graficador ggplot no llegan a la lámina nativa); al inventario |
| I6 | Histograma sin elegir el grupo | 53, 54 | **no es un control olvidado**: `grupo` está en `RETIRADOS` porque la lámina nativa no dibuja el histograma por grupos; al inventario. Lo mismo `mostrar_saldo` de las divergentes (lámina 28 del catálogo sale igual que la 27) |
