---
name: estudio-real
description: Auditoría metodológica y técnica de estudios reales, proyectos de referencia anonimizados y seeds sintéticos en Prosecnur. Usar para validar instrumento, base procesable, repeats, cuotas, ponderación, pipeline o reproducir en UI un defecto de un proyecto concreto.
---

# Estudios reales y proyectos de referencia

Un mismo hallazgo puede observarse en tres carriles de evidencia. No los
mezcles:

1. **Proyecto de cliente**: evidencia más fiel; permanece fuera del repo.
2. **Proyecto de referencia anonimizado**:
   `api/inst/reference_projects/<slug>/`; preserva geometría y rarezas reales.
3. **Seed sintético canónico**: `api/inst/audit_reference/` y fábrica de
   `api/R/audit_projects.R`; determinista y construido para gates.

El catálogo, anonimización y verificación de referencias viven en
`api/R/reference_projects.R`, `api/R/pulso_anonimizar*.R` y ADR 0043. La
trazabilidad entre un seed reducido y su referencia es dato ejecutable, no una
nota suelta.

## Flujo de auditoría

1. **Congela procedencia y alcance.** Registra tipo de proyecto, versión,
   familia metodológica/modo, bases, instrumentos, fuente de datos y módulos a
   auditar. Carga `dominio-prosecnur`.
2. **Instrumento.** Comprueba que el XLSForm persistido conserva lógica ODK,
   choices, repeats y labels ES; el instrumento es la fuente de verdad.
3. **Grano y relaciones.** Inventaría una fila por qué entidad en cada base,
   claves, repeats y uniones. Nunca compares totales de granos distintos.
4. **Base procesable.** Distingue bruto, elegible, completo, descartado y
   analítico. Toda cifra lleva denominador. Revisa variables de duración,
   universo y valores especiales 90–99 antes de interpretar alertas.
5. **Diseño y cuotas.** Compara plan vs ejecución al grano donde la cuota fue
   definida. Si el redondeo destruye celdas pequeñas, sube al nivel metodológico
   válido y documenta la pérdida; no “arregles” la evidencia sumando granos
   incompatibles.
6. **Ponderación.** Decide primero si el diseño necesita pesos. Si sí, verifica
   `ponderacion_compute()`, trim, DEFF de Kish y `n_eff`; distingue peso
   calculado por la app de una columna recibida.
7. **Pipeline.** Recorre Carga → Validación → Codificación → Analítica →
   Gráficos y, cuando aplica, Monitoreo → Procesamiento. Identifica la primera
   divergencia causal, no solo la pantalla final.
8. **Reproducción UI.** Usa el skill local `/ver-ui` con una copia de ejecución
   y una dirección v3 estable. No edites el fixture read-only ni navegues por
   clicks de texto si existe `window.__pulsoNav.ir(...)`.
9. **Veredicto.** Separa bug de app, decisión metodológica, limitación del
   fixture y dato fuente. Los cambios de producto empiezan después con
   `/scope-lock`.

## Referencias disponibles

- `acnur_pdm`: repeats Kobo reales.
- `acnur_acg`: pipeline completo hasta analítica.
- `hsvg2026`: marco de aulas a escala.
- `acrconta`: estado multiactor fusionado y Google Sheets.

Consulta `reference-project.json` y
`reference_project_matriz_cobertura()` antes de elegir. “Cubre el módulo” no
significa que cubra el mismo estado profundo.

## Ejecución segura

- Verifica referencias con `make reference-project-verify`.
- Prepara una copia temporal con los targets `reference-project-*` del
  `Makefile`; los fixtures instalados son read-only.
- Si el caso aún solo existe en un proyecto de cliente, anonimiza con
  `api/scripts/pulso_anonimizar.R` y ejecuta el detector de PII antes de
  proponer versionarlo. La sal permanece fuera del repo.
- Los datos de cliente no se copian a fixtures, logs, capturas ni entregables
  sin anonimización y autorización explícita.
- Nunca incluyas secretos, rutas privadas o identificadores de personas en la
  evidencia del diagnóstico.

## Formato del informe

Tabla por eje: fuente/carril, grano, denominador, esperado, observado, evidencia,
veredicto y siguiente acción. Cierra con:

- cobertura ejercida y huecos;
- primera divergencia causal;
- bug de app vs decisión metodológica;
- checks ejecutados y artefactos reproducibles;
- datos que no se inspeccionaron y por qué.
