# Checklist — el criterio de nivel vaciaba el marco (2026-08-25)

Tipo: Checklist QA fechado
Estado: Vigente
Fecha: 2026-08-25
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


Reproducido sobre `HSVG26DEF.pulso` con las bases reales de PUCP 2026-2:
`classroom_included_n = 0` de 5.269. El pedido traía cuatro indicaciones; una
de ellas exigía decisión y se resolvió con Gonzalo durante la sesión.

## Estado

| # | Indicación | Dónde vive | Situación |
|---|---|---|---|
| 1 | `faculty_curso` no debe depender del mapeo de `faculty` | motor · `api/R/calc_muestra_aulas_catalogo.R` (`.cm_catalogo_signal_candidates`) | ✅ cerrado |
| 2 | El fallback de `course_pairs` debe detectar el par SIN FACULTAD, no sólo el vacío | motor · `api/R/calc_muestra_aulas_criterios.R` (`.cm_criterios_pares_con_facultad`) | ✅ cerrado |
| 3 | Alinear la promesa de la UI con el evaluador | contrato cross-layer · `.cm_criterios_eval_course_ranges` + 3 goldens del backend | ✅ cerrado — **decidido: «sin entrada» = no filtra** |
| 4 | El criterio que vacía el marco debe decirlo | motor · `calc_muestra_perfil.R` (`.cm_perfil_embudo_aviso`) → UI · `embudoEtapas.ts` | ✅ cerrado |
| 5 | Regresión mínima (catálogo con columna de facultad distinta + `faculty` a mano + rango en una sola facultad) | `api/tests/testthat/test-calc-muestra-criterios-nivel-vacia-el-marco.R` | ✅ cerrado |

## 1 · `faculty_curso` derivaba del mapeo del ALUMNO

El vector era `c("facultad_del_curso", "facultad del curso", mapping$faculty)`.
Con `faculty` en defaults arrastraba el genérico `"facultad"` y por ahí resolvía
la columna `FACULTAD` del catálogo — **por accidente**. Al mapear `faculty` a
mano (ADR 0035, mapeo exclusivo) el genérico desaparecía y la señal quedaba
vacía.

Medido con el fixture de la regresión: candidatos
`facultad_del_curso ; facultad del curso ; NOMBREFAC` → columna resuelta `""`.
Con `faculty` en automático → `FACULTAD`. Mismo estudio, mismo catálogo, 0 vs
1.222 aulas en el proyecto real.

`faculty_curso` pasa a declarar sus propios genéricos. A diferencia de
`condicion_curso`, aquí no hay homónima sucia que temer: un catálogo de
curso-horario no tiene estudiantes, así que su «Facultad» es la del curso por
construcción. `mapping$faculty` se conserva al final, para el catálogo que
nombra su columna igual que la base.

## 2 · El par degradado sobrevivía al fallback

Con la facultad vacía los pares salían `"<FLD>2"` en vez de
`"CIENCIAS E INGENIERIA<FLD>2"`. El par **no estaba vacío** —traía el nivel— así
que `ifelse(is.na | !nzchar, fallback_pair, …)` no se activaba, y el evaluador
buscaba la facultad del par en el mapa, no la encontraba y devolvía `FALSE` para
todas las aulas. La reparación es **por par**, no por set: conserva los pares
buenos cuando sólo algunas filas del catálogo traen la facultad en blanco.

## 3 · La contradicción de contrato (lo que hubo que decidir)

El repo sostenía las dos lecturas a la vez, cada una en tres sitios deliberados:

**«No filtra» (frontend)**
- `criterios/facultades.tsx:54` — «Sin rango, la facultad admite todos los niveles y no filtra»
- `FacultadDecisionBloque.tsx:388` — «sin esto, la facultad admite todos»
- `CriterioCard.tsx:106` — «sin rango (no filtra)»
- y el toggle «Aplica», al apagarse, **borra la clave** (`setRangosFacultad(…, [])`)

**«Excluye» (backend)**
- golden de `test-calc-muestra-criterios.R` — «A8 cae por nivel (Consorcio no está en el mapa → fuera)»
- oráculo `.a_level_range` de `test-calc-muestra-aulas-validacion-combinaciones.R` — «facultad ausente del mapa no acredita»
- aviso de `calc_muestra_aulas_llegada.R` — «EXCLUIDA ENTERA del marco»

**Decisión de Gonzalo: gana la UI.** El mapa sólo gobierna lo que nombra. Dos
argumentos la sostienen: la discontinuidad (con CERO facultades declaradas
pasaban todas, y bastaba declarar UNA para que las demás desaparecieran — un
mapa vacío y un mapa que no te nombra tienen que significar lo mismo), y que un
criterio de NIVEL que borra facultades enteras promete un número y entrega otro:
para dejar una facultad fuera del estudio está el criterio de FACULTAD.

No colapsa la **exención**, que sigue siendo otra cosa: se juzga contra la
facultad DEL AULA y salva sus aulas aunque sus cursos estén catalogados en una
facultad declarada y fuera de rango. Hay test que lo fija.

El toggle «Aplica» queda **correcto tal como está**: apagarlo borra la clave,
que ahora significa exactamente «no filtra».

## 4 · El cero silencioso

`course_level` pasaba de 3.630 a 0 en el paso 11 y el analista lo leía en los
pasos 12-18 (`session_type`, `teacher_type`…), que ya heredan un marco vacío y
no recortan a nadie: nueve criterios por debajo de la causa. En la UI, además,
un paso en 0 se pintaba `estado: "pending"` —el mismo estado que un paso que aún
no corrió— y su cifra desaparecía.

Ahora el embudo trae `vacia_marco` + `aviso` por paso, los declara **sólo el
primero** que pasa de N>0 a 0, y la UI lo pinta en estado `alerta` conservando el
0 (el 0 es el dato). El veredicto lo emite el motor, que es el único que ve el
conteo de entrada: en el front un `conteo === 0` no distingue al criterio que
mató el marco de los que heredaron su cero.

## Lo que el gate `verificador` devolvió (y por qué importa)

La primera versión del fix pasaba las 114 suites del área y aun así fue
**RECHAZADA**. Vale la pena dejar por qué:

1. **El `return(TRUE)` quedó DENTRO del bucle por par.** Un solo curso
   catalogado en una facultad sin tramo acreditaba al aula entera — incluso con
   el nivel de ese par ilegible, y con independencia del orden de los pares. Con
   1609/5262 aulas sirviendo a ≥2 facultades y Consorcio/Posgrado/EE.GG. siendo
   justo las que nadie declara, declarar un tramo en Ciencias habría dejado de
   filtrar en cuanto el aula tocara una facultad no declarada.
   **Peor**: dejaba la ausencia MÁS permisiva que la exención explícita, que
   deliberadamente no libra a aulas ajenas — lo contrario de lo que argumentaba
   el propio comentario del fix. Ningún test lo fijaba.
   *Reparado*: la ausencia se decide arriba, contra la facultad DEL AULA, igual
   que la exención; el par ajeno vuelve a `next`.
2. **La doc canónica de la propia función** seguía diciendo «facultad AUSENTE
   del mapa NO aporta (el mapa es la whitelist…)», 50 líneas encima del código
   que la contradecía. Era la cuarta superficie con la lectura vieja; había una
   quinta en `.cm_criterios_rango_es_exencion`. Ambas actualizadas.
3. **El test de la exención pasaba por construcción**: borrando la clave
   `"exenta"` del fixture, `included` salía idéntico. No probaba nada.
   *Reparado*: ahora usa el normalizador real (el centinela tiene forma propia,
   `list(list(exenta = TRUE))`, y `es_rango_exento` sobre el string crudo da
   FALSE) y mide el caso que sí distingue: aula de una facultad con su curso
   catalogado en otra.
4. **El seam `vacia_marco` → `vaciaMarco` no tenía candado** en `adaptador.ts`.
   Un renombre del campo habría apagado el aviso en silencio.
5. **Las superficies con la lectura vieja eran SIETE, no tres.** A las tres del
   pedido original se sumaron: la doc canónica de `.cm_criterios_eval_course_ranges`,
   el comentario de `.cm_criterios_rango_es_exencion`, el bloque «una exención NO
   se confunde con sin rango declarado» de `test-calc-muestra-aulas-criterio-por-facultad.R`
   (que afirmaba literalmente «sin rango la facultad se EXCLUYE (comportamiento
   vigente)») y el comentario de «la exención sobrevive a normalizar DOS veces».
   Las dos últimas sólo aparecieron corriendo la suite entera **dos veces más**;
   la séptima ni siquiera fallaba —era prosa que contradecía al motor—. Lección:
   `grep` de las frases del contrato, no sólo el gate.
6. **Rompí un gate del CI**: `node scripts/check-docs-governance.mjs` daba
   `Errores: 5` por este mismo documento (sin cabecera canónica y no alcanzable
   desde `docs/README.md`). El baseline en el mismo commit era 0.

Nota: tras la decisión, **exención y ausencia coinciden en el evaluador** — las
dos dicen que esa facultad no tiene tramo. No es un descuido: es la decisión. Lo
que las separa es el aviso de `llegada.R`, que reconoce a la exenta y anuncia a
la ausente como facultad nueva. Ese es el valor que le queda al centinela.

## Verificación

- `test-calc-muestra-criterios-nivel-vacia-el-marco.R` — 23 asserts, rojo antes del fix (10 fallos) y verde después
- Suite del área `^calc-muestra` (114 archivos)
- `tsc --noEmit` limpio · vitest del área calcMuestra
- `embudoAvisaQuienVacia.test.ts` — 4 casos

Atribución medida: con los fixes 1+2 solos el marco pasa de 0 a poblado y el
área queda verde; los 3 goldens del backend sólo se mueven por la decisión del
punto 3.
