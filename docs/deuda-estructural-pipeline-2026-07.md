# Deuda estructural del pipeline de datos (constancia — 2026-07-10)

Registro de soluciones de **largo plazo** identificadas mientras se depuraba el
puente Monitoreo→Procesamiento y un falso positivo masivo de validación en
`ACNURCG.pulso`. **Se difieren a propósito** (hoy se parchearon los síntomas);
este doc deja constancia para retomarlas. Priorizadas por impacto.

> Contexto de origen: falso positivo de 1120 inconsistencias sobre `D1_information`
> (select_multiple vaciado en la evaluación), y la dificultad para que un fix del
> evaluador "apareciera" en la app por evaluación cacheada. Ver
> `[[project_auditoria_acnurcg_introspectiva]]` en memoria del agente.

## 1. Invalidar la evaluación por versión del motor (alto impacto)

**Síntoma:** se corrige el código del evaluador, pero la app sigue mostrando el
resultado viejo (p.ej. 1120) porque la evaluación se cachea/persiste por
**inputs (data + plan)**, no por **versión del código**. Un fix nunca toma efecto
solo; hay que forzar un re-cómputo a mano (regenerar base, togglear reglas…).

**Solución:** incluir un `engine_version` (commit o versión del evaluador) en el
`plan_result` / `evaluacion`. Al servir un resultado guardado, comparar versión;
si difiere → marcar obsoleto y recomputar. Barato, alto retorno: cualquier fix
futuro del motor aterriza sin gimnasia de cache-busting.

**Primer paso:** agregar `engine_version` al persistir la evaluación y compararlo
en `GET .../resultado`; si no coincide, recomputar o marcar "stale" en la UI.

## 2. Contrato canónico de `select_multiple` en la frontera de ingesta (raíz del FP)

**Síntoma:** `D1_information` llegó como **madre con tokens separados por espacio**
(`"1 4 7"`) + variantes con prefijo de grupo (`D/D1_information`) y de caso
(`d1_information`), **sin dummies**. La reconstrucción del normalizador solo sabía
armar la madre **desde dummies** → la madre quedó vacía → las reglas required/skip
dispararon sobre todos los que sí respondieron. Se parcheó río abajo en el lector
de validación (`.restore_instrument_case_aliases`), pero es un parche, no la raíz.

**Solución:** que **toda ingesta** (handoff local, carga manual de un export Kobo
descargado, API) converja a **una sola representación canónica** del
select_multiple —madre tokenizada por espacio + dummies 0/1 sincronizadas, nombres
planos sin prefijo de grupo— **antes** de que validación / codificación / analítica
la consuman. Es el workstream "fuente única" ya anotado.

**Primer paso:** mover al `data_normalizer` el parseo de la madre space-separated
cuando no hay dummies (con golden test), de modo que el hack del lector deje de ser
necesario. Amerita **ADR** (toca la frontera de datos de varios módulos).

## 3. El handoff debe emitir columnas limpias (no flat + prefijadas)

**Síntoma:** el paquete del handoff escribió `D1_information` **y**
`D/D1_information` (duplicado con prefijo de grupo) — la colisión que confundió al
lector.

**Solución:** el handoff (`.monitoreo_processing_handoff_*`) colapsa el prefijo de
grupo y no duplica columnas al escribir la base. Elimina la ambigüedad en origen
(complementa el #2).

## 4. Guard de escritor único sobre el `.pulso` (lección de un incidente)

**Síntoma:** correr un **segundo backend** contra un `.pulso` **abierto** provocó
que su warm-start + autosave **sobrescribiera la base** (`estudio` a 0 bases). Se
recuperó porque la app viva conservaba el estado y se re-guardó.

**Solución:** lock / ownership sobre el `.pulso` (un backend "dueño" a la vez), o
autosave que no persista una sesión a medio warm-startear. Ningún proceso paralelo
debería poder pisar un proyecto abierto.

**Regla operativa mientras tanto:** nunca levantar un segundo backend contra un
proyecto vivo; las verificaciones se hacen a nivel R sobre **copias extraídas**.

## Red de seguridad — test de regresión con proyecto real

Un fixture de **proyecto real** (ACNURCG-style) en CI que corra el pipeline
completo (handoff → validación → codificación) y **falle si aparecen falsos
positivos**. Hoy esto se detectó a mano; un fixture real lo caza solo y protege
los cuatro puntos de arriba de regresiones.

---

**Arranque recomendado cuando se retome:** #1 (invalidación por versión, acotado,
rápido) + #2 (contrato canónico, vía ADR). Cierran el grueso del dolor.
