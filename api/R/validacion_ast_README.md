# Motor de validación AST (Prosecnur-app)

Motor tipado y composicional que reemplaza la generación de reglas
basada en strings. Convive con el motor heredado
(`validacion_rule_factory.R` + `validacion_evaluacion_data.R`) durante
la migración — ambos producen el mismo shape de plan.

## Arquitectura en capas

```
┌────────────────────────────────────────────────────────────┐
│ Capa 7: Bridge + pipeline unificado                         │
│   validacion_ast_bridge.R                                   │
│   - bridge_regla_custom() / bridge_reglas_custom_list()     │
│   - build_unified_rules() — instrumento + custom            │
│   - compile_rules_to_plan() — export al shape legacy        │
├────────────────────────────────────────────────────────────┤
│ Capa 6: Introspección XLSForm                               │
│   validacion_ast_introspect.R                               │
│   - infer_rules_from_xlsform(instrumento, include)          │
│   - build_group_gate_map() — gates acumulativos             │
│   - resolve_label_es() — Spanish-first                      │
├────────────────────────────────────────────────────────────┤
│ Capa 5b: Evaluador directo                                  │
│   validacion_ast_evaluator.R                                │
│   - evaluate_rules(rules, data, collection_date_col)        │
│   - observations_for_rule() — extracción por UUID           │
│   - Inyecta __today__ desde columna de captura              │
├────────────────────────────────────────────────────────────┤
│ Capa 4-5-7: Rule + constructores + registry                 │
│   validacion_ast_rules.R                                    │
│   - make_rule() — única ruta canónica                       │
│   - rule_required, rule_skip, rule_range, rule_catalog,     │
│     rule_outlier, rule_duplicate, rule_coherence,           │
│     rule_select_multiple_cardinality, rule_pattern_*,       │
│     rule_repeat_length, rule_odk_raw                        │
│   - validate_rule(rule, instrumento)                        │
│   - compile_rule(rule) → fila del plan legacy               │
│   validacion_ast_registry.R                                 │
│   - 11 tipos de regla registrados con metadata UX           │
├────────────────────────────────────────────────────────────┤
│ Capa 2b: Parser ODK → AST                                   │
│   validacion_ast_parser.R                                   │
│   - odk_parse_to_ast(expr, context, self_var)               │
│   - Reconoce selected/count-selected/regex/today/not/       │
│     variables/literales/comparaciones                       │
│   - Funciones fuera de scope → ast_odk_raw explícito        │
├────────────────────────────────────────────────────────────┤
│ Capa 2: Compilador AST → R                                  │
│   validacion_ast_compiler_r.R                               │
│   - ast_to_r(x) — genera RHS R ejecutable                   │
│   - Cada op tiene compilador con manejo defensivo de NA     │
├────────────────────────────────────────────────────────────┤
│ Capa 1: Canonicalizador                                     │
│   validacion_ast_normalize.R                                │
│   - Aplana AND/OR, constant-folding, not(not(x))→x          │
│   - OR selected → any_selected                              │
│   - OR == mismo var → in_set                                │
│   - OR == mismo valor vars distintas → any_column_equals    │
│   - AND gte+lte → not(range_numeric) (preserva semántica)   │
├────────────────────────────────────────────────────────────┤
│ Capa 0: Primitivas (27 ops cerrados)                        │
│   validacion_ast_primitives.R                               │
│   - ast(), ast_op(), ast_arg(), is_ast()                    │
│   - ast_hash() determinístico (dedup)                       │
│   - ast_variables(), ast_walk(), ast_map()                  │
│   - ast_is_valid() — chequeo estructural                    │
├────────────────────────────────────────────────────────────┤
│ Capa -1: Normalizador léxico                                │
│   validacion_ast_lex.R                                      │
│   - odk_normalize_lex(expr, report) — smart quotes, NBSP,   │
│     em/en dash, zero-width space → ASCII                    │
│   - Idempotente, reporta findings para educar al usuario    │
└────────────────────────────────────────────────────────────┘
```

## Flujo típico (pipeline unificado)

```r
# 1. Cargar XLSForm
instrumento <- list(survey = read_xlsform_survey("form.xlsx"))

# 2. Leer reglas custom del store (desde la UI)
reglas_custom <- session_get(sid)$reglas_custom

# 3. Pipeline unificado
bundle <- build_unified_rules(
  instrumento = instrumento,
  reglas_custom = reglas_custom,
  include = c("required", "skip", "constraint", "repeat_length")
)

# 4. Evaluar sobre data
ev <- evaluate_rules(
  rules = bundle$rules,
  data = mi_data,
  collection_date_col = "end"  # auto-resuelto si NULL
)

# 5. Consumir resumen + casos
ev$resumen        # tibble por regla
observations_for_rule(ev$data, bundle$rules[[1]])  # casos específicos
```

## Convenciones semánticas

**El predicate de una regla es TRUE cuando hay inconsistencia.**

- `ast_is_missing("v")` → TRUE cuando v está vacía (violación de required)
- `ast_range_numeric("v", 0, 120)` → TRUE cuando v está FUERA de [0, 120]
- `ast_not_in_set("v", [...])` → TRUE cuando v NO está en la lista
- `ast_collection_date_cmp("v", "<=")` → TRUE cuando v <= fecha_captura (ODK
  lo mete como constraint "válido"; el introspector aplica `ast_not()` para
  convertirlo a violación)

## Taxonomía (11 tipos de regla)

| Tipo | categoria_ux | Uso típico |
|------|--------------|------------|
| `required` | completitud | variable debe responderse |
| `skip` | saltos | variable responde/no según condición |
| `constraint` | consistencia | consistencia lógica ODK |
| `range` | rangos | valor numérico/fecha fuera de rango |
| `catalog` | catálogo | valor no en lista permitida |
| `outlier` | outliers | outlier IQR/Z |
| `duplicate` | duplicados | tupla repetida |
| `coherence` | coherencia | si A, entonces B |
| `select_multiple_cardinality` | cardinalidad | max N, exclusividad |
| `pattern` | patrones | straight-lining |
| `repeat_length` | estructura | longitud de repeat |
| `odk_raw` | experto | escape hatch |

## Dedup y detección de gemelos semánticos

- **Dedup exacto**: dos reglas con idéntico `(tipo_regla, variables,
  predicate_hash, gate_hash, fuente)` → mismo `id`, se colapsan a una sola.
- **Gemelos semánticos**: dos reglas con igual `(variables, predicate_hash)`
  pero distinto `tipo_regla` o `fuente` → no se borran, se reportan en
  `dedup_info$semantic_dups` para que la UI advierta al usuario.

## Integración con el motor heredado

**Modo paralelo (actual):**
- El motor AST produce reglas que pueden compilarse al shape del plan
  legacy via `compile_rules_to_plan()`. El pipeline existente
  (`evaluar_consistencia`) las consume sin saber que vinieron del AST.
- El evaluador AST directo (`evaluate_rules`) es una alternativa más
  rápida y con mejor diagnóstico, pero no es requerida.

**Migración gradual recomendada:**
1. Ejecutar ambos motores en paralelo y comparar outputs por regla
   (shadow mode).
2. Migrar la UI para consumir `build_unified_rules` directamente.
3. Deprecar builders heredados de `rule_factory.R` uno por uno.
4. Deprecar `compile_reglas_custom` — reemplazado por `bridge_regla_custom`.
5. Cuando el string `Procesamiento` ya no sea autoritativo, usar el AST
   como fuente de verdad y el Procesamiento como vista compilada.

## Reglas operacionales importantes

- **`pulldata(...)`**: regla descartada silenciosamente — fuera del
  alcance del motor (data externa no es nuestra).
- **`today()`**: NO es la fecha de validación — es la fecha de captura
  de cada encuesta (ODK). El evaluador inyecta `__today__` desde la
  columna `end` / `_submission_time` / `interviewdate` / `today` / `start`
  (primero que exista en el data).
- **Smart quotes**: normalizadas automáticamente pero REPORTADAS en
  `lex_report` para que la UI eduque al usuario a corregir en la fuente.
- **Idioma**: siempre español. El resolver de labels prefiere
  `label::Español (es)` > `label::Spanish (es)` > `label` > cualquier
  `label::*` con contenido.

## Cobertura

Validado contra 4 XLSForms reales (ACNUR ESPP, ACNUR RMS, HST, GIZ):

| Form | Rows | Reglas inferidas | odk_raw | Smart quotes |
|------|------|------------------|---------|--------------|
| ESPP | 122 | 107 | 0 | 0 |
| RMS  | 410 | 339 | 0 | 16 |
| HST  | 162 | 171 | 0 | 1 |
| GIZ  | 97  | 80  | 1 | 12 |

**697 reglas inferidas, 1 fallback al escape hatch (0.14%).**

## Tests

```bash
cd api
Rscript -e 'library(testthat); test_file("tests/testthat/test-validacion-ast.R")'
```

70 tests, 100% pass, cubriendo las 7 capas + el bridge.
