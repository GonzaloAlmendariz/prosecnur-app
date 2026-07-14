# ADR 0035: Cálculo de muestra (aulas) — definición de datos manual, exclusiva y por hoja

Estado: Aceptado

Fecha: 2026-07-14

## Contexto

El desk universitario de Cálculo de muestra parte de una base con dos pestañas
de granos distintos (p. ej. `MATRICULADO` = estudiante×matrícula y
`CURSO Y HORARIO` = curso-horario×docente). El motor R construía el marco de
aulas resolviendo el mapeo columna→rol por **heurística difusa** (`.cm_aulas_col`,
listas de candidatos por defecto, `.cm_criterios_col_exacta`). Esto produjo una
cadena de defectos reales en producción:

- `teacher_type` resolvía a una columna "Condición" (condición de matrícula del
  alumno) en vez de "Tipo de docente" → el criterio jerárquico excluía todos los
  cursos-horario (marco elegible = 0).
- `course_level` resolvía a "Curso" (código del curso) en vez de "Nivel del
  curso", porque el nombre "Curso" estaba prependido a los candidatos y ganaba.
- La base tiene **tres columnas homónimas tipo "Condición"** repartidas entre
  las dos hojas; la resolución por scope implícito no las desambiguaba de forma
  robusta.

Además, el flujo hacía trabajo **por adelantado**: presets con números
institucionales hardcodeados (29090/21365/2483/19711 del estudio HST) se
mostraban como si fueran la data real; se aplicaban sugerencias de columna y
selección canónica de criterios **antes** de que el usuario confirmara su mapeo;
y el catálogo de columnas ofrecía a todos los roles la misma lista plana de
ambas hojas (un rol de curso-horario podía mapearse a una columna de alumno).

Fuerzas en tensión: la heurística difusa da un arranque cómodo (el usuario no
mapea nada) pero es **frágil e insegura** — adivina, y adivina mal en bases con
nombres colisionantes. El principio §3.3.1 ya declaraba que la asignación de
columnas debe ser una decisión CONSCIENTE del usuario, pero la implementación lo
trataba como una sugerencia prependida al fuzzy y descartaba la hoja de origen.

## Decisión

La definición de datos del desk universitario es **estrictamente secuencial,
manual y sin adivinación**:

1. **Mapeo manual EXCLUSIVO.** El mapeo columna→rol es una decisión consciente.
   La auto-detección produce solo SUGERENCIAS que el usuario confirma; nada se
   aplica sin confirmación. El motor resuelve cada rol usando **únicamente** la
   columna mapeada, por nombre EXACTO, **sin fuzzy-fallback**. Un rol que el
   usuario no mapeó no tiene columna (no se adivina). Si un rol requerido para
   construir el marco no está mapeado, el build **falla con un mensaje claro**,
   no adivina.

2. **Columnas calificadas por hoja.** Cada rol pertenece a una fuente/hoja
   (roles de alumno → base madre/`MATRICULADO`; roles de aula → catálogo/
   `CURSO Y HORARIO`). El catálogo de columnas que se ofrece para un rol contiene
   **solo columnas de la hoja de ese rol**. El mapeo viaja calificado por hoja
   (`role, column, source`), de modo que columnas homónimas entre hojas nunca se
   confunden; el motor resuelve cada rol dentro de su propia hoja.

3. **Sin data hardcodeada en el flujo real.** Universo, elegibles y marco salen
   ÚNICAMENTE de la base del usuario + el mapeo confirmado + una construcción
   explícita. Los números de ejemplo (29090/21365/2483…) viven solo en un modo
   demo/ejemplo claramente marcado y jamás se muestran como data de un proyecto
   real.

4. **Construcción explícita.** El marco se construye solo cuando el usuario lo
   dispara, después de completar el mapeo. Criterios y conteos no se muestran ni
   se aplican hasta que exista un marco construido de verdad.

## Consecuencias

- **Beneficio:** el mapeo deja de adivinar; los defectos de columna equivocada
  (teacher_type/course_level/condición) desaparecen por construcción, no por
  parches. La base con nombres homónimos deja de ser una trampa.
- **Beneficio:** el usuario ve solo su data; no hay números de ejemplo que
  confundan.
- **Costo:** el arranque exige que el usuario mapee sus columnas antes de ver
  resultados (menos "mágico", más correcto). Se mitiga con sugerencias claras y
  confirmación de a una.
- **Costo/riesgo:** flujos y fixtures que dependían del fuzzy (proyecto de
  referencia, goldens) deben proveer su mapeo explícito. Migración acotada:
  cuando no hay mapeo manual, el motor puede conservar un modo de compatibilidad
  documentado, pero el camino canónico es el manual exclusivo.

## Cumplimiento

- Backend: test que el motor resuelve un rol SOLO por la columna mapeada exacta
  y NO cae a fuzzy; test que un rol requerido sin mapeo produce un `stop_api`
  con código claro; test que columnas homónimas entre hojas se resuelven cada
  una en su hoja.
- Frontend: test de dominio que las opciones de columna de un rol se filtran a
  la hoja del rol (source), y que el payload del mapeo lleva `source`.
- `rg` de guardia: los números `21365|2483|19711` no aparecen en las rutas del
  flujo real (solo en el módulo de ejemplo/demo marcado).

## Notas

Relacionado: [0006](0006-modulos-por-dominio.md) (módulos por dominio),
[0033](0033-reconciliacion-variables-data-xlsform.md) (reconciliación de
variables). Reemplaza la resolución difusa de columnas del desk universitario
introducida junto a la suite de criterios por categoría. Implementación por
fases: (1) columnas por hoja + fin de la data hardcodeada + payload calificado;
(2) resolución backend exclusiva + gate de rol requerido; (3) gating secuencial
completo del flujo.
