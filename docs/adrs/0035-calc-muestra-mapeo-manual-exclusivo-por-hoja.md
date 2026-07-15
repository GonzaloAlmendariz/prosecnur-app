# ADR 0035: Cálculo de muestra (aulas) — definición de datos manual, exclusiva, por hoja y verbatim

Estado: Aceptado

Fecha: 2026-07-14

## Contexto

El desk universitario de Cálculo de muestra parte de una base con dos pestañas
de granos distintos (p. ej. `MATRICULADO` = estudiante×matrícula y
`CURSO Y HORARIO` = curso-horario×docente). El motor construía el marco de aulas
resolviendo el mapeo columna→rol por **heurística difusa**, lo que produjo una
cadena de defectos en producción: `teacher_type` resolvía a una columna
"Condición" (condición de matrícula) en vez de "Tipo de docente"; `course_level`
al código "Curso" en vez de "Nivel del curso"; la base tiene **tres columnas
homónimas tipo "Condición"** entre las dos hojas que el scope implícito no
desambiguaba. Además el flujo hacía trabajo por adelantado (presets con números
hardcodeados, sugerencias y selección canónica aplicadas antes del mapeo manual)
y el catálogo de columnas mezclaba las dos hojas.

Un problema adicional descubierto: los nombres de las categorías se
**reetiquetaban** por heurística (p. ej. "REGULAR" se mostraba como "Elegible"),
y la UI no separaba visualmente los criterios de estudiante de los de
curso-horario. Esto importa porque vendrán OTRAS tablas con las mismas dos hojas
pero columnas de nombres distintos para los mismos roles: preservar los nombres
literales y separar por hoja es lo que hace el mapeo portable y auditable.

## Decisión

La definición de datos del desk universitario es **estrictamente secuencial,
manual, sin adivinación, por hoja y verbatim**:

1. **Mapeo manual EXCLUSIVO.** El mapeo columna→rol es una decisión consciente.
   La auto-detección solo SUGIERE; nada se aplica sin confirmar. El motor resuelve
   cada rol usando ÚNICAMENTE la columna mapeada, por nombre EXACTO, sin
   fuzzy-fallback. Un rol requerido sin mapeo bloquea el build con mensaje claro.

2. **Columnas calificadas por hoja.** Cada rol pertenece a una hoja (roles de
   alumno → base madre; roles de aula → catálogo). El catálogo de columnas de un
   rol contiene SOLO columnas de su hoja. El mapeo viaja calificado por hoja, de
   modo que columnas homónimas entre hojas nunca se confunden.

3. **Sin data hardcodeada en el flujo real.** Universo, elegibles y marco salen
   solo de la base + el mapeo confirmado + una construcción explícita. Los números
   de ejemplo viven solo en un modo demo marcado.

4. **Construcción explícita.** El marco se construye solo cuando el usuario lo
   dispara, tras completar el mapeo. Criterios y conteos no se muestran hasta que
   haya un marco construido de verdad.

5. **Nombres VERBATIM.** Los nombres de columnas, de roles y de CATEGORÍAS se
   muestran tal cual vienen en la data. No se normalizan, no se renombran, no se
   reetiquetan por heurística ("REGULAR" NO se muestra como "Elegible"). El
   significado lo pone el rol al que se mapea la columna, nunca una transformación
   silenciosa del valor. Motivo: otras tablas traerán columnas de otros nombres
   para los mismos roles; preservar los nombres literales hace el mapeo manual
   portable.

6. **Separación por hoja en la UI.** La interfaz separa VISUALMENTE variables y
   criterios por hoja: arriba los del ESTUDIANTE (base madre), abajo los del
   CURSO-HORARIO (catálogo), sin overlap. Toda variable pertenece a una hoja (no
   hay variables "locales" sin hoja). Una misma variable lógica puede aparecer en
   ambas hojas (p. ej. la llave curso-horario), pero cada instancia referencia la
   columna de SU hoja y se mapea por separado.

## Consecuencias

- **Beneficio:** el mapeo deja de adivinar y de mutar nombres; los defectos de
  columna/categoría equivocada desaparecen por construcción. El flujo es portable
  a otras tablas con nombres distintos.
- **Costo:** el arranque exige mapear las columnas antes de ver resultados (menos
  mágico, más correcto), mitigado con sugerencias claras.
- **Riesgo/migración:** flujos y fixtures que dependían del fuzzy o del
  reetiquetado deben proveer su mapeo explícito y aceptar los nombres crudos.

## Cumplimiento

- Backend: test que un rol se resuelve SOLO por su columna mapeada exacta (sin
  fuzzy); test que un rol requerido sin mapeo produce `stop_api` claro.
- Frontend: test que las opciones de columna de un rol se filtran a su hoja; test
  que las categorías se muestran con su nombre CRUDO (sin reetiquetar
  regular→elegible); la UI agrupa roles/criterios en secciones estudiante vs
  curso-horario.
- `rg` de guardia: sin números de ejemplo en el flujo real; sin reetiquetado de
  valores de categoría.

## Notas

Relacionado: [0006](0006-modulos-por-dominio.md), [0033](0033-reconciliacion-variables-data-xlsform.md).
Implementación por fases: (1) columnas por hoja + fin de data hardcodeada +
re-inspección completa de encabezados; (2) resolución backend exclusiva + gate de
rol requerido; (3) nombres verbatim + separación por hoja en la UI + rol
condicion_curso manual; (4) gating secuencial completo del flujo.
