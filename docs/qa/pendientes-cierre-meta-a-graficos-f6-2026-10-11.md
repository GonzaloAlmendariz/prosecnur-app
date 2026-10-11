# Pendientes al cierre de la Meta A (Gráficos)

Tipo: Registro de deuda
Estado: Vigente
Fecha: 2026-10-11
Autoridad: Gonzalo («necesito que cerremos con todo funcional», decisión 4a); lead de la Meta A

Gate final (verificador, HEAD e543458): R área graficos 225 suites, 12345 pass / 0 fail; gate-front 1584 pass; src/api y
src/app 640 pass; tsc limpio; build de producción OK; agentic audit/check/tests 60/60; gobernanza de docs 0 errores.

## Pendientes (cada uno con dónde vive y qué lo bloquea)

| # | Pendiente | Dónde vive | Bloqueo |
|---|---|---|---|
| 1 | Retiro del Editor anterior (ADR 0095): PPT/Word por huella vs. editor anterior, matriz de viewports con md5, latencia de vista previa, extraer CSS de `editor-v2.css` y reubicar FiltersPanel/GraficadorPicker/getSlotLabel/SlidePicker, quitar `useShortcutsV2` | `docs/qa/paridad-retiro-editor-anterior-f6-2026-10-11.md` (checklist del ADR 0095) | Confirmación de Gonzalo + coordinación con la Meta B |
| 2 | Borrado de la población antigua: Fase 1 (migración autosuficiente, migrar en borrador compartido / share import / preview / miniaturas, `E_GRAFICOS_TIPO_LAMINA_DESCONOCIDO`, plantillas, golden) y Fase 2 (borrado) | `docs/adrs/0098-…` (Propuesto) | 1.ª y 2.ª confirmación de Gonzalo; Fase 2 tras el ADR 0095 |
| 3 | Prueba en vivo del informe compartido `independent_siblings` (decisión 19) y job `/consolidado/ppt` con el plan del ADR 0096 | `docs/qa/contrato-consolidado-laminas-f6-2026-10-11.md` | Deuda por decisión 4a |
| 4 | QA visual menor (qa-f6-4): doble cabecera en Línea visual (`SeccionLineaVisual.tsx:31-40`), foco tras «Volver al recetario» (`CabeceraSeccion.tsx:30-35`), drift de 10 px en «Lo fija el recetario», 7 colecciones C1 no declaradas, la confirmación de vaciar enfoca «Vaciar» (`ConfirmacionCompartir.tsx:17`), Escape con la propuesta generándose (`SuggestedPlanButton.tsx:323`), placeholder de multilista «Un gráfico» | Evidencia en el reporte qa-f6-4 | — |
| 5 | Re-QA visual de los arreglos 1fadf01 (espacios en la ficha, «/», lista de Paletas) y de las paletas por lista (ADR 0097) en PPT y Word | — | Presupuesto |
| 6 | Paletas: contador de Paletas cuenta huérfanas (`PestanaEstiloInforme.tsx:129`); contraste de cifras navy sobre paleta oscura (divergentes, dicotomía Word); vínculos en el consolidado sin verificar; precedencia preset > paleta en radar; `.graficos_mk_palette` en ruta ggplot; lámina de pesas | ADR 0097, estudio de paletas | — |
| 7 | C40 restos: `invertir_barras/invertir_segmentos` formales; `iter_level_label` en el pie nativo; nota «Se muestran X de Y» en radar antes de habilitar `top_n`/`sm_omit_codes`; avisos de retirados guardados; `p_boxplot` chip_decimales→decimales_promedio; motor desnudo media_rango en `iqr` | `docs/qa/revision-c40-args-sin-control-f6-2026-10-11.md` | — |
| 8 | Anonimizador avisa el nombre del cliente en títulos/etiquetas (decisión 7a) | `api/R/pulso_anonimizar_proyecto.R` | — |
| 9 | JSON por secciones: comprobar logo contra el file store real; el backend acepta `file_id` inexistente en `estilo_cliente` | `compartir/accionesCompartir.ts`, `.graficos_estilo_cliente_validar` | — |
| 10 | KPI de cobertura «0/0» con el perfil Equivalencias; heatmap (`graficador_dimensiones.R`, congelado) lee base ponderada | QA qa-f6-3; contrato S1–S4 | Revisor metodológico |
| 11 | Gobernanza: ADR 0094 sin `## Cumplimiento`/`## Notas`; 0096–0098 sin `## Notas`; IDs duplicados 0080–0082 | `docs/adrs/` | — |
| 12 | Verificación con worker `callr` real (R CMD INSTALL): Word «Otros», enganches de ponderación, paletas | CI backend-r | Lo cubre el CI |

## Para las notas de versión

- Media y rango sin tipo elegido pasa de P25–P75 a mínimo–máximo (lámina 82 del recetario).
- Escalas sin paleta pasan de la rampa con rojo a la Likert del recetario; paletas que no calzan dejan de pintar por
  posición (gris con aviso); con paleta del usuario, barras/torta/divergentes/comparativo salen con sus colores.
- Los ceros en Word siguen el default (apagados), igual que en PPT.
- La base de los gráficos se cuenta en casos sin ponderar; sello «Resultados ponderados (n efectivo = X)».
- El informe compartido se siembra desde la matriz de equivalencias; la heurística por etiqueta se retira también del
  plan por base (revisar comparativos «Comparativo por actor» en informes guardados antes).
- Los proyectos de referencia toman leyenda de 8 pt y Top Two Box en barras apiladas (ADR 0094).
