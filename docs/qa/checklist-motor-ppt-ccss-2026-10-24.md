# Checklist — robustez del motor de Gráficos/PPT con CCSS Perfil 2026 (2026-10-24)

Un solo checklist para los dos frentes que se unieron: **motor PPT** (esta sesión, lead) y **brechas del motor vistas en CCSS**
(rama `claude/keen-diffie-8fc654`, integrada a `main`). Lo da por terminado sólo Gonzalo.

Protocolo de todo ítem: test en rojo primero, render antes y después leído, Arte idéntico (43/43), gate acotado y `--audit`.
Estados: ✅ hecho y commiteado · 🟡 hecho sin commitear · 🔵 en curso · ⬜ pendiente · ⛔ bloqueado (decisión de Gonzalo).

## Frente motor PPT

| # | Ítem | Dónde vive | Estado | Commit / nota |
|---|---|---|---|---|
| M1 | «default» oculto, título de la dicotómica, nota de significancia en la lámina | `lamina_*`, `reporte_plan_ppt.R` | ✅ | `0ee5f6695` |
| M2 | Control numérico acotado en el front | `frontend/…/graficos` | ✅ | `df68f1a88` |
| B | Categórica nativa con pocas categorías usa el alto del área y se centra | `lamina_uso_area.R` | ✅ | `98e6690db` |
| A1–A4 | Marco del estándar en la ruta de respaldo (barra, antetítulo, folio), título de dos líneas (G7), nota vs leyenda (G9), márgenes de la dicotomía partida | `lamina_marco_respaldo.R`, `lamina_dicotomia_margenes.R` | ✅ | `7e10765b8` |
| A5 | Rótulos de columnas con el ancho real de la columna; piso de 8 pt con aviso; la composición pasa el ancho real del marcador | `graficador_rotulos_eje_x.R`, `reporte_slides_composicion_ancho.R` | ✅ | `40cf6e407` |
| C1 | Worker callr hereda la fuente del servidor; falla si la versión no coincide | `jobs_fuente_paquete.R` | ✅ | `a83a687e4` |
| C2 | Grilla rota (fondo de lámina entera por la leyenda ggplot de una dona en cajón chico) | `lamina_panel_circular.R`, `lamina_circular_leyenda.R` | ✅ | `9947637ce` |
| C3 | Dona con un solo modo (nativo) en paneles; leyenda compacta, nunca cortada | `lamina_circular_leyenda.R`, `lamina_grilla_nativa.R` | ✅ | `9947637ce` |
| C4 | Línea guía en tajadas chicas (umbral de las apiladas) | `lamina_circular_guia.R`, `graficador_pie_guia.R` | ✅ | `9947637ce` umbral · `0860e9471` forma radial + arco | Gonzalo: la guía sale **radial a 90°** y luego **sigue un arco concéntrico** para acomodar las cifras (agente C) |
| C5 | Base por panel en grillas (iguales: una; distintas: cada panel la suya, pie vacío) | `lamina_grilla_nativa.R` (`.lam_grilla_base`), `reporte_slides_composicion.R` | ✅ | `9947637ce`; falta revisión metodológica del «pie vacío» |
| C6 | Paleta de marca en columnas de una serie | `graficos_columnas_paleta.R` | ✅ | `9947637ce` |
| D1 | Orden «instrumento» manda (VI–IX con romanos; explícito en dona) | `graficos_orden_categorias.R`, `graficos_orden_romanos.R` | ✅ `8bc71f483` | `args.orden_barras` se pierde en `router_graficos.R:203` (abierto) |
| D2 | No sustantivos (9, 77) en gris, al final y en la leyenda; denominador intacto | `graficos_no_sustantivos.R`, enganche en `reporte_plan_ppt.R` (modo var) | ✅ `8bc71f483` `9947637ce` | cruce, var_cruce y multilista en `bd8fd87b6`; gris `#BFBFBF` vs neutro `#D9D9D9` a revisar |
| P1 | Dona de lámina completa (`p_slide_1_grafico`) sigue en imagen: título rojo duplicado, «2%0%» encimado (CCSS l. 8) | `lamina_circulares.R`, ruta de respaldo | ✅ | `1ea1f788b` |
| P2 | Título del slot choca con título de dos líneas y rótulos en el piso de 8 pt (CCSS l. 37) | `lamina_titulo_lienzo.R`, `graficador_barras_agrupadas_rotulos.R` | ✅ `c0df7056d` | ensanchar la columna antes que encoger (P43) |
| P3 | «(Recodificada)» en la rama de escala en filas | | ⬜ | |
| P4 | Título duplicado en slots de varias láminas | `lamina_titulo_lienzo.R` | ✅ `c0df7056d` | |

## Frente UI (QA visual de Gráficos con CCSS: RECHAZADO, 16 PASS / 8 FAIL / 2 DEBT)

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| U1 ✅ `d0daae8d8` | Exportar bloqueado: 117 bloqueos por pregunta en dos bases, mientras la vista previa resuelve | `frontend/src/features/graficos/avisosPlan.ts`, planValidator | ⬜ prioridad máxima |
| U2 ✅ `d0daae8d8` | Miniatura de la dona con «64%» cuando el dato es 53% | `iconos/ComposicionLamina.tsx` (`sinCifras`) | ⬜ |
| U3 ✅ `d0daae8d8` | Títulos de la maqueta recortados | `.pulso-f6-maqueta-titulo` | ⬜ |
| U4 ✅ `d0daae8d8` | Avisos repetidos con jerga que tapan el inspector | panel de avisos | ⬜ |
| U5 | «0%» con 1 caso; leyenda de dona mal agrupada | motor (donas) | ⬜ |
| U6 | Previsualizar re-dibuja ~20 s cada vez | preview | ⬜ |
| U7 ◐ `d0daae8d8` (falta id «avisos» duplicado) | Textos («otras 1 pregunta», paréntesis anidados, rótulos de capítulo) | varios | ⬜ |
| U9 | «Faltan colores» dice bloquear con Exportar habilitado | panel de avisos | ✅ `e544c718e` |
| U8 | Capacity-drift en índice y ficha técnica | f6 | ⬜ |

## Frente CCSS de cierre (barras, grillas y texto abierto)

| # | Ítem | Dónde vive | Estado | Commit / nota |
|---|---|---|---|---|
| CCSS-8 | Barras de una serie: columna de rótulos acotada (35 %, hasta 3 líneas); eje al máximo sólo con `usar_eje_libre` | `lamina_barras_ancho.R`, `lamina_categorica.R` | ✅ | `a865d7b60`; agrupadas de cruce (CCSS l. 29 y 34) abiertas |
| CCSS-30 | Grilla de seis: filete vertical también en la fila de abajo | `lamina_poblacion_geo.R` | ✅ | `b433855dc` |
| TXT-1–22 | Nube, sugerencia de módulo, citas, diccionario, panel «Palabras» | `texto_abierto_*.R`, `codificacion_*.R`, `features/codificacion` | ✅ | ver bandeja (sync) |
| TXT-20 | Lámina de temas de un texto codificado (`temas_de_texto`) | `reporte_plan_temas_texto.R` | ✅ | `d596bb4f1` `71879da06` |
| TXT-23 | Subtemas «B · …» van bajo su módulo | `reporte_plan_temas_texto.R` | ✅ | `37e9c6ed3` |
| TXT-24 | Renombrar un grupo tras adaptar llega al instrumento adaptado | `codificacion_rotulos_adaptados.R` | ✅ | `04f76e73a`; el front aún no pinta `rotulos_adaptados` ni reaparece «Adaptar» en la sesión |
| TXT-25 | Sugerencia parte preguntas interrogativas seguidas en subtemas | `codificacion_sugerir_seccion.R` | ✅ | `18514fb0b`; CCSS debe volver a sugerir; revisión metodológica de las fusiones pendiente |
| TXT-26 | Jerarquía módulo/subtema y rótulo del analista sin recortar | `lamina_barras_jerarquia.R`, `reporte_plan_temas_texto.R` | ✅ | `eaa599f57`; Word y ruta ggplot sin jerarquía |

## Frente brechas (traspasado a esta sesión; plan completo: `docs/qa/plan-brechas-motor-ccss-2026-10-24.md`, en la rama hasta el ff)

| # | Ítem | Dónde vive | Estado | Commit / nota |
|---|---|---|---|---|
| B0a | Orden parcial de `grupos_recod`, especiales al final | `orden_categorias.R` | ✅ | `fe745aaad`, integrado en main `043f82fb1` |
| G1 | Dummies SM en minúscula | `graficos_plan_coverage.R` | ✅ | `e3b341388` (main `043f82fb1`) |
| G2 | `p_cifra` con SM | `graficos_cifra_sm.R` | ✅ | `f0712b59e` (main `043f82fb1`) |
| G5 | Rangos con unidades distintas | `graficos_orden_rangos.R` | ✅ | `18a8726cf` `f0692fb72` (main `043f82fb1`) |
| G8 | «Otros» sólo para la opción «otro» | `etiqueta_otros.R` | ✅ | `0217376c3` `7d58ff7e9` `f0692fb72` (main `043f82fb1`) |
| G7 G9 | Título dos líneas, nota vs leyenda | | ✅ | `7e10765b8` |
| G3 | `excluir_opciones` como arreglo JSON falla | `reporte_plan_slides.R` `.ppt_norm_chr_vec_arg`, `router_graficos.R` | ⛔ 1H sin aprobar | |
| G4 | Multiapiladas no acepta `excluir_opciones`; argumentos descartados en silencio | `reporte_plan_slides.R:2165`, `graficos_metadata.R`, `router_graficos.R:203` | ⛔ 1H sin aprobar | |
| D13 aviso | Escala con categoría fuera del recorrido no excluida → aviso en la lámina | junto a G4 | ⛔ decidido, implementación en 1H | |
| G6 = P4 | Título duplicado en slots de mixtas (agrupadas canvas dibuja su título con `draw_text`) | `lamina_mixtas.R:452,503`, `reporte_slides_composicion.R:96` | ✅ `c0df7056d` | |
| A12 | Rótulos montados en `p_slide_cifras_y_graficos` con agrupadas de `A12_recod` | `reporte_slides_composicion.R` sin `alto_slot`; envoltorio a 12 pt sin recalcular a 8 | ✅ `c0df7056d` | |
| B1 | Codificación re-adapta desde el origen viejo: N = 467 en vez de 397, en silencio (ALTA) | `router_codificacion.R:55-67` prefiere `original_data_file_id` sin mirar si el actual es adaptado; `original_*` se congela (`session_store.R:1221`) | ✅ `82005becc` | aplicada la regla de Analítica (`router_analitica.R:48-60`) |
| B2 B5 B6 B12–B16 B9 B10 | Ver plan | | ⬜ | sin decisión |
| B0b B3 B4 B7a–c B8 B9pref B11 B17 | Bloqueados por D11, D1–D10, D12 | | ⛔ | |

## Decisiones de Gonzalo que arrastramos

- **CCSS-14/22 (bloqueado):** las cifras chicas de multiapiladas y divergentes que salen juntas arriba de la barra («1% 1%», «6% 5%», el gris del no sustantivo). El reparto sin solape ya está en el motor (`0a3133f60`, `lamina_callouts_sin_solape.R`), pero sólo entra cuando las guías se cruzan, porque aplicarlo siempre cambia 21 láminas del Arte aprobado (su par «2% 6%» sigue el mismo patrón). Decidir: ¿se acepta ese cambio en Arte para aplicarlo siempre?
- Gonzalo decidió: el informe de CCSS va **sin significancia** (apagada en su plan; la de la serie queda opcional y apagada).

- Revisión en PowerPoint y Word reales.
- Hueco entre premisas de 1,27 y 1,29 cm en las láminas 33 y 42 de Arte.
- Si se anonimiza una copia del `.pulso` de Arte para Renzo.
- D13: los no sustantivos salen del denominador sólo si el plan lo declara, con aviso (aprobado).

## Decisiones tomadas en el loop (para revisión de Gonzalo; él pidió no preguntar)

- TXT-11, subtemas de la sugerencia de módulo: el formulario de CCSS no tiene subgrupos formales en el módulo B (sólo «laboral»). Los subtemas saldrán de las baterías del formulario (cada nota `enunciado_*` con sus preguntas) más los grupos formales, fusionados en orden hasta 9 (códigos 21–29), y sólo cuando un módulo se lleva más de la mitad. Sigue siendo una propuesta que el analista confirma. Alternativas: sólo grupos formales («laboral» + «B general»), o un mapa de subtemas declarado por el analista.

- Exportar bloqueado por preguntas que existen en dos bases (QA de UI, 117 bloqueos en CCSS): la exportación resolverá igual que el motor y la vista previa; base principal por defecto con aviso no bloqueante y acción masiva para fijarla. Pendiente de implementar (oleada UI).

- B1 se arregla aunque el plan de brechas lo tenía «sin decisión»: es un error silencioso de datos (N equivocado) y el arreglo sólo hace que Codificación lea la base actual, igual que Analítica. No cambia ninguna regla metodológica.

- Bases distintas por panel → cada panel lleva su «N respuestas» y el pie de la lámina no afirma una base común (C5). Alternativa si no le gusta: pie con «Base: n1 / n2 / …».
- Color de los no sustantivos: pasa de `#BFBFBF` (casi igual al neutro `#D9D9D9`, reportado por ccss-mazo en R6) al gris azulado `texto_tenue` `#8A93A8` del estándar, que se lee como «fuera de la escala» (D2).
- Forma del pie (CCSS-15): sin sufijo declarado en el preset de base, todas las rutas dicen «Base: N» (hoy 50 de 58 láminas de CCSS ya lo hacen); con sufijo, «Base: N <sufijo>» en todas. No se rellena el sufijo con el default de Pulso porque `base` «no configurado» tiene significado (router_graficos.R:1843). Si Gonzalo prefiere «respuestas» por defecto, basta con declararlo en el preset de base del proyecto.
- Base de un cruce (CCSS-16): el pie cuenta los casos válidos en la variable Y en el cruce, que es el denominador real de las barras; los % no cambian.
- `launch.json` (servidores 8822 de Arte) queda sin commitear: lleva rutas locales de un proyecto de cliente.
- TXT-20, temas del comentario final (d596bb4f1, 71879da06): el % se calcula sobre los comentarios con contenido (61), no sobre quienes escribieron algo (93) ni sobre el total. Los 6 comentarios con contenido que no tienen tema cuentan en la base y en ninguna barra. Las barras siguen el orden de los códigos (A–E, con los subtemas de B debajo) y no el `mayor_menor` del plan. B se cuenta por personas: quien toca cualquier subtema. La opción está apagada por defecto y en un cruce avisa y deja la múltiple como siempre. El «Sin datos» del .pulso real no venía del motor: la Adaptación tenía la data vieja, sin `coment_recod`, y hay que volver a aplicarla. Pendiente: el revisor metodológico, el rótulo «B · La relación», que es ambiguo, y la jerarquía visual de la fila B.
- CCSS-8 y el eje de 0 a 100 %: según el recetario p74 («el recetario es la fuente de verdad», Gonzalo, 2026-10-09), las barras de una serie van de 0 a 100 % por defecto, y eso no se revierte. Lo que se arregla siempre es la columna de rótulos: ocupa como máximo el 35 % del ancho y envuelve el texto en hasta 3 líneas, así que las barras ganan el ancho liberado. Escalar el eje al máximo observado × 1.15 (que da barras a todo el ancho) es opcional y se activa con `usar_eje_libre = TRUE` en la lámina. Para CCSS lo decide el plan. Alternativa, si Gonzalo lo prefiere: el eje libre por defecto en el PPT y 0 a 100 % solo con marcas (p75).

## Cierre del loop (2026-10-25)

Gonzalo ordenó cerrar tras TXT-24, TXT-25 y TXT-26. Quedan para un próximo encargo: agrupadas de cruce a todo el ancho (CCSS-8b), CCSS-13/17/18/9b y UI-1/2/3 sin commit identificado, B1 residual (`analitica_script_replica.R:670`, `router_sistema.R:547`, `universe_filter`), el anonimizador sin listas del diccionario, P3 y los ⛔ de arriba. Este checklist lo da por terminado sólo Gonzalo.
