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
| P1 | Dona de lámina completa (`p_slide_1_grafico`) sigue en imagen: título rojo duplicado, «2%0%» encimado (CCSS l. 8) | `lamina_circulares.R`, ruta de respaldo | ⬜ | |
| P2 | Título del slot choca con título de dos líneas y rótulos en el piso de 8 pt (CCSS l. 37) | `lamina_titulo_lienzo.R`, `graficador_barras_agrupadas_rotulos.R` | ✅ `c0df7056d` | ensanchar la columna antes que encoger (P43) |
| P3 | «(Recodificada)» en la rama de escala en filas | | ⬜ | |
| P4 | Título duplicado en slots de varias láminas | `lamina_titulo_lienzo.R` | ✅ `c0df7056d` | |

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

- Revisión en PowerPoint y Word reales.
- Hueco entre premisas de 1,27 y 1,29 cm en las láminas 33 y 42 de Arte.
- Si se anonimiza una copia del `.pulso` de Arte para Renzo.
- D13: los no sustantivos salen del denominador sólo si el plan lo declara, con aviso (aprobado).

## Decisiones tomadas en el loop (para revisión de Gonzalo; él pidió no preguntar)

- B1 se arregla aunque el plan de brechas lo tenía «sin decisión»: es un error silencioso de datos (N equivocado) y el arreglo sólo hace que Codificación lea la base actual, igual que Analítica. No cambia ninguna regla metodológica.

- Bases distintas por panel → cada panel lleva su «N respuestas» y el pie de la lámina no afirma una base común (C5). Alternativa si no le gusta: pie con «Base: n1 / n2 / …».
- Color de los no sustantivos: pasa de `#BFBFBF` (casi igual al neutro `#D9D9D9`, reportado por ccss-mazo en R6) al gris azulado `texto_tenue` `#8A93A8` del estándar, que se lee como «fuera de la escala» (D2).
- Forma del pie (CCSS-15): sin sufijo declarado en el preset de base, todas las rutas dicen «Base: N» (hoy 50 de 58 láminas de CCSS ya lo hacen); con sufijo, «Base: N <sufijo>» en todas. No se rellena el sufijo con el default de Pulso porque `base` «no configurado» tiene significado (router_graficos.R:1843). Si Gonzalo prefiere «respuestas» por defecto, basta con declararlo en el preset de base del proyecto.
- Base de un cruce (CCSS-16): el pie cuenta los casos válidos en la variable Y en el cruce, que es el denominador real de las barras; los % no cambian.
- `launch.json` (servidores 8822 de Arte) queda sin commitear: lleva rutas locales de un proyecto de cliente.
