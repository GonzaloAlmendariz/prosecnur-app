# ADR 0081 — La facultad de un aula no es la de sus alumnos

- **Estado**: aceptada
- **Fecha**: 2026-08-25
- **Contexto**: comparación del marco de HSVG PUCP 2026-2 construido por la app
  contra el marco independiente de Ramiro (`Ramiro_Agosto_Muestra HSyVBG
  2026-2.xlsx`), sobre el mismo universo de 5.269 cursos-horario, más los
  comentarios de José Magallanes sobre cursos compartidos y docentes repetidos.

## Contexto

Comparacion del marco de HSVG PUCP 2026-2 construido por la app contra el marco
independiente de Ramiro, sobre el mismo universo de 5.269 cursos-horario, mas
los comentarios de Jose Magallanes sobre cursos compartidos y docentes
repetidos.

## El hecho que lo motiva

Dos marcos construidos del **mismo insumo exacto** coincidían sólo en el 48%:
1.533 aulas la app, 1.754 el revisor, 1.066 en común. La diferencia no era un
defecto de cálculo. Eran dos preguntas distintas sobre la misma aula.

Un curso-horario pertenece a la facultad que lo **dicta**; sus alumnos
pertenecen a la facultad en la que están **matriculados**. En PUCP 2026-2 esas
dos respuestas difieren en el 14% de los cursos-horario, y **1.636 de 5.269
(31%) sirven a dos o más facultades** —algunos hasta a ocho—. La concentración
no es uniforme: Escuela de Estudios Especiales 99,3% compartidos, Consorcio
100%, Gestión 54%, EE.GG. Letras 46,6%.

Caso medido, aula `cis111_0204` («Realidad Social Peruana»): el catálogo la
adjudica a Escuela de Estudios Especiales; de sus 67 matriculados, **62 son de
EE.GG. Letras y 2 de Estudios Especiales**. Llamarla «aula de Estudios
Especiales» y sacarla del marco borra a 52 elegibles que sí son población del
estudio.

## Decisión

**1 · La facultad de un aula es la de sus alumnos, no la de su curso.** Para un
estudio de estudiantes, la unidad de análisis es la persona. El aula es el
vehículo de contacto, no el objeto de medición.

**2 · Esa atribución sólo es legítima bajo dominancia declarada.** Atribuir por
mayoría simple sería arbitrario cuando el aula está repartida (el caso 30/30).
Por eso el criterio «misma facultad del curso ≥ X%» no es un filtro accesorio:
es **la condición que hace válida la atribución**. Medido en el marco vigente
con umbral 70%: mediana de dominancia 100%, mínimo 70,0%, y sólo 5 de 1.756
aulas por debajo de 70% sobre elegibles. Fuera del marco quedan 280 de 3.513
(8%) — el criterio está sacando exactamente las de atribución ambigua.

**3 · La facultad del curso sigue gobernando el MARCO.** El criterio de
facultades declaradas opera sobre la facultad del curso y corta 197 aulas, de
las cuales 192 son de Estudios Especiales. Las dos lecturas conviven con
funciones separadas: la del curso decide **qué entra al marco**, la del alumno
decide **a qué estrato pertenece lo que entró**.

**4 · Excluir una facultad no saca las aulas de sus cursos.** El bloque
«Facultades excluidas» filtra por la facultad del ALUMNO. Marcar Estudios
Especiales ahí quita 0 aulas, porque las 23 que entran tienen alumnos de
facultades declaradas. Además la lista de la UI se arma con
`perfil.facultades`, que sólo contiene facultades **con alumnos elegibles**, así
que una facultad sin población ni siquiera es ofrecible: no se puede excluir lo
que ya no tiene alumnos. Para sacar aulas concretas el instrumento correcto es
la selección manual por `classroom_id`.

**5 · La facultad de RESULTADO la declara el encuestado, no el aula.** El
instrumento (`Instrumento2026_v2.xlsx`, 161 preguntas) trae la **P7 «¿De qué
facultad eres?»** con 15 opciones que incluyen «Estudios Generales Ciencias» y
«Estudios Generales Letras» como categorías propias — el mismo vocabulario que
el marco. Así, el 30% de un aula que no es de la facultad dominante **cuenta en
su propia facultad**, no en la del aula. No hay sesgo en la estimación; hay
imprecisión en el REPARTO, que se corrige por ponderación y es verificable en
campo cruzando P7 contra la facultad del aula por `collectorID`. Medido en 2025:
esa imprecisión fue del 5,5% de las respuestas.

## Consecuencias

- El marco de la app y el de un revisor que atribuya por facultad del curso
  **no van a coincidir, y no deben**. Con las correcciones aplicadas la
  coincidencia subió de 48% a 62% (1.756 contra 1.754, 1.343 en común); el resto
  es diseño, no error.
- El criterio de misma facultad **no se puede apagar sin invalidar la
  atribución**. Bajarlo tiene precio conocido: entre 70% y 80% casi no hay masa
  (la distribución es bimodal, o ~100% o <20%), así que el umbral es poco
  sensible; lo que se decide es si se aceptan los cursos genuinamente
  compartidos, no dónde se pone la raya.
- **Monitoreo cuenta las efectivas por aula y las atribuye a la facultad del
  aula.** Eso es correcto para el AVANCE —lo que se mide es cobertura de la
  operación, no composición de la muestra— y además es lo que se hizo en 2025.
  El error que introduce **está medido, no supuesto**: cruzando las 3.303
  respuestas cruzables de HSVG 2025 (`collectorID` → aula → facultad, contra la
  P7 declarada), **el 94,5% coincide y el 5,5% declara otra facultad**. Por
  facultad del aula: EE.GG. Letras 15% (el peor), EE.GG. Ciencias 8%, Comun.
  8%, Ciencias e Ingeniería 3%, Derecho y Psicología 0%. El error se concentra
  donde el ADR predice: Estudios Generales. **No se toca en esta unidad**;
  queda declarado y cuantificado.
- **La base de respuestas SÍ identifica el aula.** El export de Kobo trae
  `collectorID` con la clave del curso-horario (`FIL108-0202`), poblado en el
  99,7% de los casos de 2025, con 195 recopiladores que empatan con los 196
  cursos-horario aplicados. Por tanto el cruce P7 ↔ facultad del aula es
  **registro a registro**, no agregado: cualquier corrección de composición
  puede hacerse caso por caso y verificarse al cierre de campo.
- Riesgo de respuesta abierto: un alumno de Estudios Generales puede
  autopercibirse por su carrera de destino y marcar Gestión en vez de Estudios
  Generales. La lista de la P7 ya es correcta, así que la mitigación es de
  enunciado o de instrucción en campo, y es medible al cierre.

## Cumplimiento

- `.cm_criterios_valores_aula` distingue `faculty` (efectiva, del curso cuando
  el catálogo la trae) de `faculty_aula` (la del alumno); ambas viajan al
  evaluador y no deben colapsarse.
- `.cm_criterios_eval_course_ranges` juzga la exención y la ausencia de tramo
  contra la facultad DEL AULA, y los pares (facultad del curso, nivel) contra la
  del curso. Ver ADR de esa decisión y sus tests.
- `filters$excluded_faculties` filtra por facultad del alumno
  (`calc_muestra_aulas.R`, `faculty_ok`). No es el instrumento para sacar aulas
  por la facultad que dicta el curso.
- La cifra `faculty_match_share` del `aula_frame` es la que acredita la
  dominancia; se mide sobre ELEGIBLES, no sobre matriculados. Medirla sobre
  matriculados da números distintos y no es la métrica del criterio.

## Notas

- Los cursos compartidos son también el origen de los docentes repetidos que
  señaló José: medido en su Muestra Principal, 15 de 227 docentes (6,6%)
  aparecen en dos cursos-horario y **ninguno en tres o más**. Riesgo real pero
  acotado; no requiere cambio de diseño.
- Este ADR no decide sobre la condición del curso en Estudios Generales, que es
  un problema distinto —esa columna registra el ÁREA del curso, no su
  condición— y se documenta en
  `docs/qa/checklist-nivel-curso-vacia-marco-2026-08-25.md`.
