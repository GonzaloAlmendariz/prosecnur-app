# Revisión C40 — argumentos de gráfico sin control en Láminas

Tipo: Revisión metodológica
Estado: Vigente
Fecha: 2026-10-11
Autoridad: Decisión 31 de Gonzalo («habilitar lo recomendado»); revisor-metodologico; lead de la Meta A

Barrido del registro `api/R/graficos_metadata.R` contra la lista blanca `frontend/src/features/graficos/laminas/
argsDatosGrafico.ts:24-48`. Invariantes: I-a códigos 90–99 no se borran y sólo se muestran si están presentes
(dominio-prosecnur §5; nucleo-metodologico regla 3); I-b base en casos, cifras ponderadas (contrato S1–S4); I-c redondeo y
decimales son decisión de informe (`graficos_calculos_gobernados.R:2-27`); I-d lo que el nativo no dibuja se avisa (ADR
0092); I-e controles sin efecto nativo salen del editor (F6.1); I-f default del motor = recetario.

## Defectos del motor que bloquean asignar

- **D1 (denominador).** En radar/tabla, `sm_omit_codes` y `top_n` recortan códigos ANTES del denominador
  (`reporte_plan_helpers.R:2217-2233,2292-2303` → `denominador_validos(codes = codes_row)` `:2318-2325`;
  `reporte_cruces.R:545-561`): con `top_n` el % se infla. El lollipop lo hace bien (`graficador_lollipop.R:99-118,130`).
- **D2 (90–99).** `.tab_freq` pide `freq_table_spss(mostrar_todo = TRUE)` sin `codigos_solo_si_presentes`
  (`reporte_plan_ppt.R:3045-3052`): con `incluir_sin_n` reaparecen especiales ausentes al 0 %; Word lo enciende por
  defecto y PPT no (`:2978-2983`). En escala, `dibujar` con categorías en cero no excluye `especial`
  (`graficos_espec_escala.R:80-81,123-136`). Sin test que lo confirme todavía.

## Veredictos

| Argumento | Veredicto | Destino / guarda |
|---|---|---|
| `metodo_redondeo` | No va en Láminas | Ya vive en Cálculos (global); el motor lo quita por lámina |
| `mostrar_ceros`, `mostrar_categorias_en_cero` | ASIGNAR CON GUARDA tras D2 | Nunca resucita 90–99 ausentes; mismo default PPT/Word; excluir `especial` y SIN INF |
| `invertir_barras` | ASIGNAR CON GUARDA | Dentro de Orden; Top Two Box lo anula |
| `invertir_segmentos` | ASIGNAR CON GUARDA | Declarar en el registro; no mover SIN INF ni 90–99 del final |
| `invertir_leyenda`, `tipo_pie`, `umbral_brecha_pct`, `tabla_ancho_tema`, `tabla_proporcion`, `sm_omit_na`, `umbral_rojo_pct`, `mostrar_tabla_derecha`, `modo_semaforo`, `mostrar_ref_label`, `brecha_*`, `mostrar_n_cruce_x`, `radar_min_ejes`, `bins`, `ancho_bin`, `grupo`, `mostrar_bins_vacios`, `otros_al_final`, `mostrar_saldo`, `umbral_etiqueta_pct`, `mostrar_promedio`, `formato_valor`, FODA | RETIRAR | Los guardados con efecto de ruta dan aviso |
| `cortes_chip` | RETIRAR | Un valor guardado da `[PULSO-AVISO]` (hoy se pierde en silencio en media y rango) |
| `mostrar_brecha` | ASIGNAR CON GUARDA | Brecha calculada desde las cifras rotuladas |
| `etiqueta_brecha` | ASIGNAR | Alinear default del preset «pp» → «pts» (recetario) |
| `orden` (dumbbell/lollipop), `orden_periodos` | ASIGNAR | Orden |
| `eje_min` (radar públicos) | ASIGNAR CON GUARDA | Mostrar el aviso de `.radar_mb_piso` |
| `mostrar_tabla`, `tabla_titulo` | ASIGNAR | Datos del gráfico |
| `top_n` (radar/tabla), `sm_omit_codes` | RECHAZADO hasta D1 | Luego «Máximo de categorías» / «Excluir respuestas» con nota y base declarada |
| `top_n` (lollipop) | ASIGNAR | Mismo rótulo que `max_categorias` |
| `chip_decimales` | ASIGNAR sólo media y rango | — |
| `tipo_rango` | ASIGNAR CON GUARDA | Un solo default (recetario); la leyenda declara el rango |
| `incluir_total` | ASIGNAR en heatmap; RETIRAR en comparativo | — |
| `iter_var`/`iter_level` | ASIGNAR CON GUARDA | El pie declara el subgrupo (Avanzado) |
| `min_n`, `cortes` (mapa) | ASIGNAR CON GUARDA | Aviso existente; `cortes` sin default en el registro |
| `scope`/`ubigeo`/`unit`/`coverage_mode` | ASIGNAR | — |
| `limite_superior` (histograma) | ASIGNAR CON GUARDA | Conservar el rótulo «+» |
| `mostrar_valores`, `max_series_con_cifras` (serie) | ASIGNAR condicional (3+ mediciones) | — |
| `etiqueta_otros` | ASIGNAR | `siActivo: agrupar_resto_en_otros` |

Hallazgo extra: la lista blanca expone `valores_decimales`; para serie temporal contradice I-c (Láminas escribe en
`args`, el saneo sólo limpia `overrides`). Restringir a radar.

## Tests de guarda exigidos

1. n=0 con `mostrar_ceros` on/off: mismo conjunto en PPT y Word. 2. 98/99 ausentes con ceros encendidos: no aparecen
(D2). 3. Radar/tabla con `top_n` < categorías: denominador intacto (D1). 4. `top_n` > categorías: no-op sin nota.
5. `eje_min` sobre el mínimo: piso baja con aviso. 6. `cortes_chip` vacíos/no finitos: aviso. 7. Redondeo que no cierra
a 100 fijado por Cálculos e ignorado por lámina. 8. Brecha rotulada = resta de rotuladas. 9. Base cero en cada familia
asignada. 10. Fixture §6 del contrato S1–S4 (n=55, n_casos=30) en `min_n` del mapa. 11. `iter_var` con nivel vacío.

## Pendientes

1. Tipos por la ruta anterior (puntos comparativos, p_tabla, dim_radar): ¿conservan controles? (lead/Gonzalo).
2. ¿`bins = 8` del preset de histograma (`graficos_metadata.R:3002`) apaga siempre la ruta del recetario?
3. `destacar_ultimo` (serie) y `titulos_grupo`/`prefijo_grupos` (escala) sin verificar.
