---
name: estudio-real
description: Auditoría metodológica de un proyecto real de cliente (.pulso) en Prosecnur - instrumento, cuotas, base procesable, ponderación y coherencia del pipeline, como en los estudios ACNUR/UNSA/Polarización. Usar cuando el usuario traiga un estudio o proyecto concreto de cliente para validar, revisar cuotas, diagnosticar datos de campo o certificar que el pipeline lo procesa bien.
---

# Estudio real (auditoría con datos de cliente)

Flujo para las sesiones tipo "ACNUR territorial cuotas", "ACNURCG instrument validation", "Polarización panel": un proyecto de cliente con datos reales que hay que validar metodológicamente contra la app. Diferente de la auditoría canónica (seeds sintéticos, skill global `prosecnur-project`): aquí los datos son reales y el veredicto es metodológico.

## Flujo

1. **Contexto primero**: carga `dominio-prosecnur` (multibase, valores especiales, taxonomía de estudios) y determina la familia del estudio (territorial/acreditación/telefónico/aulas) — define qué perfil de Monitoreo y qué acción del evaluador de muestra aplican.
2. **Instrumento**: ¿el XLSForm está persistido en el `.pulso` con su lógica ODK completa? (trampa vista en ACNURCG: instrumento no persistido con lógica → validaciones ciegas). ¿Labels ES detectables (`.detect_label_es_col`)?
3. **Base procesable**: dimensiona la base real vs registros descartables. Trampa conocida: falsos positivos de duración cuando `duration_var` apunta a la variable equivocada (ACNURCG: `duracion_core_seg` → 1135 FP). Verifica valores especiales remapeados al estándar 90–99.
4. **Diseño muestral y cuotas**: cuadra cuotas planificadas vs ejecutadas al nivel correcto de agregación. Trampa conocida: cuotas por celda pequeña colapsan por redondeo (ACNUR: cuota de edad por manzana con n=8 colapsa a 2/3/2/1; el nivel distrital sí se preserva) — audita al nivel donde el redondeo no destruye la señal.
5. **Ponderación**: ¿el diseño la necesita? (cuasi-experimental → probablemente no). Si sí, ¿la app la genera (`ponderacion_compute`) o solo consume `peso`? Reporta DEFF y n_eff.
6. **Pipeline end-to-end**: recorre Carga→Validación→Codificación→Analítica con la base real y anota dónde se rompe el puente (gap histórico: Monitoreo→Procesamiento). Si hay UI que verificar con el proyecto abierto, usa el skill global `prosecnur-project-ui-check`.
7. **Entregable del diagnóstico**: informe con veredicto por eje (instrumento/base/cuotas/pesos/pipeline), hallazgos con evidencia numérica, y qué es fix de la app vs decisión metodológica del estudio. Los fixes de app salen como tareas separadas (`/scope-lock`), no se mezclan con el diagnóstico.

## Reglas

- Los datos de cliente NO se copian al repo ni a fixtures sin anonimizar y sin pedido explícito.
- Distingue siempre "bug de la app" de "decisión metodológica del estudio" — se resuelven en carriles distintos.
- Cifras siempre con su denominador (base procesable, no base bruta).
