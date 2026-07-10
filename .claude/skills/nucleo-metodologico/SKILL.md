---
name: nucleo-metodologico
description: Núcleo metodológico de Prosecnur - reglas de validación (AST + rule factory), codificación de abiertas (flujo híbrido), limpieza (decision/transform engines) y ponderación. Usar al crear o modificar reglas de validación, plantillas de codificación, transformaciones de limpieza, pesos, o al depurar inconsistencias metodológicas en frecuencias/cruces.
---

# Núcleo metodológico

Cuatro subsistemas con convenciones estadísticas propias de PULSO. Antes de tocar cualquiera, carga también `dominio-prosecnur` (valores especiales, multibase, labels por código).

## Validación — dos generaciones conviviendo (trampa mayor)

- **Moderna (autoritativa)**: pipeline AST `validacion_ast_lex.R → parser → normalize → evaluator/compiler_r → runtime/bridge`, con registro `validacion_ast_registry.R` (`register_rule_type()`, `ensure_registry_populated()`).
- **Rule factory**: `validacion_rule_factory.R` — `make_rule()` y constructores tipados `rule_required()`, `rule_skip()`, `rule_range()`, `rule_catalog()`, `rule_outlier()`, `rule_duplicate()`, `rule_coherence()`, `rule_select_multiple_cardinality()`, `rule_pattern_straightline()`, `rule_odk_raw()`… Validar con `validate_rule(rule, instrumento)`, compilar con `compile_rule(rule)`.
- **Legacy**: `construir_plan_limpieza()` (`validacion_construir_plan.R`, config default `acnur_config()`). ⚠️ Sus comentarios citan funciones que no existen con ese nombre (`read_xlsform` → real: `leer_xlsform_limpieza()` en `validacion_read_xlsform.R:496`). Confía en grep, no en los comentarios.
- **Regla**: reglas nuevas van por rule factory + registro AST; el path legacy no se extiende.

## Codificación — flujo híbrido

"Híbrido" = plantilla construida desde XLSForm (survey/choices) + datos crudos + Excel de familias. Entradas: `escribir_plantilla_familias(inst, dat, path)`, `construir_plantilla_desde_familias(inst, dat, split)`, `exportar_plantilla_codificacion_xlsx()`. Aplicación al dato: `instrumento_codificar_xms(inst, data_raw, lang, keep_unmapped, system_cols)` (headers crudos → códigos, dummies 0/1). Convención firme del header del archivo: **datos por código, nunca labels en `attributes`/`names`**; los labels se re-aplican solo al renderizar.

## Limpieza — decision engine + transform engine

- `limpieza_decision_engine.R`: cola de decisiones (`.limpieza_build_decision_queue()`), simulación previa (`.limpieza_simulate()`), aplicación (`.limpieza_apply_decisions_to_data()`), invalidación downstream (`.limpieza_invalidate_downstream(sid, base)` — si tu cambio afecta datos, TODO lo derivado río abajo debe invalidarse).
- `limpieza_transform_engine.R`: transformaciones de `select_multiple` — `complete_select_multiple_hierarchy()` (jerarquías tipo `list("5"=c("1","2","3"))`), `adjust_select_multiple_values()`. **Invariante**: madre tokenizada por espacio y dummies 0/1 siempre sincronizadas; toda edición mantiene ambas.

## Ponderación

`ponderacion_compute(data, config)` en `ponderacion_engine.R`: (1) pesos de diseño share_pob/share_muestra → (2) raking/IPF a mano (`max_iter=50`, `tol=1e-7`, **sin paquete `survey`** — decisión deliberada de trazabilidad) → (3) trim + re-normalización a media=n → (4) diagnósticos: DEFF de Kish (1+CV²), n_eff=(Σw)²/Σw². La columna `peso` se recomputa desde config, nunca se persiste. Contexto metodológico: los diseños cuasi-experimentales (ej. ACNUR) pueden NO necesitar ponderación — no la impongas.

## Reglas de la casa

1. Reglas nuevas → rule factory + AST registry; jamás extender el path legacy.
2. Datos por código; labels solo en render.
3. Códigos especiales 90–99: presentación condicionada a presencia (`codigos_solo_si_presentes`), nunca borrado de data.
4. `select_multiple`: madre y dummies coherentes en cada transformación.
5. Cambio en datos ⇒ invalidar derivados (`.limpieza_invalidate_downstream`).
6. Todo engine de esta capa tiene test testthat; la lógica calculable no se entrega sin test.
