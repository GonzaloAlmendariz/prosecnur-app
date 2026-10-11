# ADR 0098 — La población antigua se borra del motor y su migración queda para siempre

- **Estado**: Propuesto (requiere doble confirmación de Gonzalo: aprobar este ADR y, aparte, autorizar el commit de
  borrado — CLAUDE.md, gate 3)
- **Fecha**: 2026-10-11
- **Ámbito**: Procesamiento › Gráficos (motor PPT, registro de tipos, plantillas de plan, vista previa, informe
  compartido, compartir) y frontend de Gráficos; persistencia `.pulso` sin cambio de `format_version` (B-i de la Meta A)
- **Relación**: ejecuta la decisión «Población antigua» (`docs/qa/decisiones-pendientes-f6-2026-10-10.md:79`) y la
  decisión 33; depende del ADR 0095 (retiro del Editor anterior) para la parte frontend; aplica ADR 0005, 0074, 0092 y
  0093.

## Contexto

`p_slide_2_graficos_poblacion`, `p_slide_3_graficos_poblacion` y `p_slide_4_graficos_poblacion` (ícono del público en
medio de los gráficos) no están en el recetario. El 2026-10-10 salieron del selector (`en_selector = FALSE`) y se migran
al tipo vigente —2 → `p_slide_2_graficos` (o `_narrativo` si traen texto), 3 → `p_slide_3_graficos_fila`, 4 →
`p_slide_4_graficos`— con aviso único y marca de `project_dirty` (`graficos_migrar_poblacion.R`,
`graficos_migrar_poblacion_sesion.R`). El motor viejo siguió registrado «hasta el ADR». No son población antigua y siguen
vigentes `_3_…_tira`, `_corona`, `_cifras`, `p_slide_5_graficos_poblacion` y `p_slide_6_graficos_poblacion`.

`acrconta_mazo` trae 6 láminas `p_slide_4_graficos_poblacion` de 67; los demás proyectos de referencia, ninguna. Hay
`.pulso` de clientes con estos tipos fuera del repo.

La auditoría del borrado (guardian-contratos, 2026-10-11) encontró tres riesgos:
1. La migración lee `.slide_slots()` y `titulo_humano` del registro que se borraría: sin él movería cero gráficos y
   emitiría un aviso vacío (pérdida silenciosa).
2. Entradas que no migran: el borrador del informe compartido (`graficos_consolidado_draft_get`), `/share/import`
   (migra sin avisar) y `/preview-slide`, `/preview-slide-job` y `/miniaturas` (dibujan con el motor viejo; tras el
   borrado, `stop()` crudo en `graficos_miniaturas.R:260`).
3. `.TEMPLATES_META` (`analisis_poblacional`, `acreditacion_multibase`) sigue produciendo tipos viejos por
   `GET /api/graficos/templates`.

## Decisión

**Fase 1 — endurecer (compatible; sin borrar nada):**
1. La migración es autosuficiente: `.GRAFICOS_POBLACION_ANTIGUA` congela, por tipo viejo, su destino, el orden de sus
   ranuras y su rótulo humano como literales. No consulta `.SLIDES_META` para el tipo viejo.
2. Toda entrada que reciba un plan, una config o una lámina migra antes de reconstruir o dibujar: GET y SET del borrador
   del informe compartido, `/share/import` (devuelve `avisos`), `/preview-slide`, `/preview-slide-job` y `/miniaturas`.
   Un tipo inexistente responde `stop_api(422, "E_GRAFICOS_TIPO_LAMINA_DESCONOCIDO", …)`, registrado, nunca `stop()`.
3. Las plantillas de `.TEMPLATES_META` pasan a los tipos vigentes, sin cambio de shape del endpoint.
4. Se congela un golden (plan con los tres tipos viejos → JSON migrado y bases por panel), extraído de `acrconta_mazo`
   anonimizado más los casos sintéticos actuales, aparte de `acrconta_mazo` para no perderlo si se reemplaza (A2).
   Reemplaza las comparaciones que dibujan el tipo viejo en `test-graficos-migrar-poblacion-bases.R`.

**Fase 2 — borrar (tras la segunda confirmación y después de ejecutar el ADR 0095):**
- Backend: constructores `p_slide_{2,3,4}_graficos_poblacion` (`reporte_plan_slides.R`, sin `@export` y
  `roxygen2::roxygenise("api")`); sus entradas en `.SLIDES_META`; bloques `poblacion_{2,3,4}` de `reporte_plan_ppt.R`
  (bajar su línea base en `agentic/manifest.json`); `reporte_slide_poblacion_3.R`; `.PPT_CONTRACT$poblacion_{2,3,4}` y
  sus filas de íconos; `graficos_slide_template_contract.R`; `.POBLACION_4_ALTO_SLOT_IN`. Regenerar
  `api/inst/catalogos/graficos_tipos.json` y `catalogoTipos.generated.ts`.
- Frontend: los tres tipos salen de `SlideType`, `SlideBlueprintKind`, `metadataSanitizers`, `store.ts`,
  `TIPOS_FUERA_DEL_SELECTOR`, `BASE_DERIVADA` y `ALIAS_LAMINA` (y se resuelve la incoherencia `_2mas1`/`_fila` del tipo 3
  a favor de `_fila`).
- Scripts y documentación: `qa_motor_ppt_render.R`, `guia_ppt_plan_aplicada.qmd`.

**Se conserva para siempre:** `graficos_migrar_poblacion.R`, `graficos_migrar_poblacion_sesion.R`,
`.base_por_grafico_migrada`, `meta$base_por_grafico` y `graficosAvisosConfig.ts`. Los layouts `poblacion_{2,3,4}` siguen
dentro de las plantillas `.pptx` (no se reescriben plantillas de cliente).

## Consecuencias

- Un `.pulso` viejo carga con `project_dirty = FALSE`; el primer GET de Gráficos lo migra, avisa una vez y lo marca
  modificado; al guardar queda con los tipos vigentes. Sin cambio de `format_version` ni de claves persistidas.
- Las láminas migradas pierden el ícono central y el tipo 3 pasa a «tres en fila»; la base de cada gráfico se conserva
  por panel.
- Las funciones exportadas `p_slide_{2,3,4}_graficos_poblacion` dejan de existir (cambio de API del paquete, va en
  notas de versión).
- `reporte_plan_ppt.R` baja varios cientos de líneas.

## Cumplimiento

- Fase 1: `make gate-area AREA=graficos GATE_ARGS='--patron "migrar-poblacion|consolidado|share|preview|miniaturas|templates"'`
  verde con los transversales; test con `acrconta_mazo.pulso` (`project_dirty=FALSE` al cargar; el GET migra 6, un
  aviso, `dirty=TRUE`; PPT de 67 láminas con job `callr` real); migración con `.SLIDES_META` sin los tres tipos; test de
  `E_GRAFICOS_TIPO_LAMINA_DESCONOCIDO`.
- Fase 2: `rg -n "p_slide_[234]_graficos_poblacion\b|\bpoblacion_[234]\b|population[234]|POBLACION_4_ALTO" api/R frontend/src scripts`
  sólo deja la migración, sus tests, el golden y la historia; `tsc -b`, `make gate-front AREA=graficos`, `--audit` y
  `test-namespace-contract.R` verdes.
- `revisor-metodologico` confirma las bases por panel del golden contra el mazo aprobado; QA visual de las 6 láminas
  migradas de `acrconta_mazo` (en particular la 13, «PERFIL DEL EGRESADO»).
- Doble confirmación de Gonzalo registrada en `docs/qa/` con fecha; `verificador` como último paso.
