# ADR 0087 — El padrón del eje se persiste, y revierte el F114 dentro de su alcance

- **Estado**: Aceptado
- **Implementación**: Completa — carga, filtros, persistencia, purga manual,
  purga al exportar y corte congelado
- **Ámbito**: Monitoreo de cursos-horario (perfil aulas) · `carga_aulas_padron.R`
  · `monitoreo_aulas_padron_purga.R` · `session_schema.R` ·
  `pulso_anonimizar_proyecto.R`
- **Fecha**: 2026-09-17 · **Ratificado**: 2026-09-17 (Gonzalo, plan del eje de
  cuotas declarable, decisiones 3, 4, 5 y 6)
- **Relación**: es la condición de posibilidad del
  [ADR 0088](0088-el-numerador-de-una-celda-es-la-persona.md) y del eje
  `atribucion = "persona"` del
  [ADR 0086](0086-el-eje-de-cuotas-lo-declara-el-estudio.md); revierte
  deliberadamente, y sólo dentro de su alcance, la sanitización F114 de
  `project_pulso.R`; obedece el [ADR 0005](0005-secretos-fuera-del-proyecto.md)
  en lo que le toca —el padrón no es un secreto de integración y por eso sí vive
  en la sesión, pero no sale del equipo—.

## Contexto

Con el eje en `nivel`, el valor de una celda es una propiedad de la **persona**,
no del aula: el nivel de una respuesta se resuelve cruzando el código PUCP que
el encuestado declara contra un padrón de matriculados. Sin ese padrón el eje no
puede medir, y con él la app pasa a guardar **códigos de alumno reales** en el
proyecto — exactamente lo que el F114 existe para impedir.

El F114 no es un descuido que se pueda deshacer a la ligera. En
[project_pulso.R:556-616](../../api/R/project_pulso.R) los ids de alumno se
subrogan a enteros densos y **el mapa se descarta**; rechaza explícitamente el
hash con sal «porque sobre un espacio de códigos de 8 dígitos se invierte en
segundos», y pone `population`, `population_pool` y `exclusions` a `NULL`. Está
censado en [session_schema.R:364](../../api/R/session_schema.R).

Hay además un hecho incómodo que conviene dejar escrito antes que después:
**nada puede comprobar que el padrón cargado sea la misma población de la que se
construyó el marco.** El F114 ya destruyó el mapa de códigos del `aula_frame`,
así que no hay con qué comparar. Un archivo equivocado —la universidad entera, o
una extracción vieja— resolvería niveles para personas que no son del estudio, y
las garantías que sí se pueden dar lo harían *sospechoso*, no *imposible*.

## Decisión

**1 · El padrón se persiste en el `.pulso`, y contiene lo mínimo.** Código →
nivel, carrera, sexo. Nada más: ni nombre, ni correo, ni teléfono, ni notas.
Clave `monitoreo_aulas_padron`, censada como `persistible` con su motivo escrito.

**2 · No existe una versión anónima que sirva.** Es el punto entero. El cruce es
por el código que el encuestado declara: cualquier transformación que impida
invertir el código impide también cruzarlo. Un hash con sal no sirve por lo que
el propio F114 dice de él. Persistirlo es la única alternativa a no medir el eje.

**3 · El estudio se declara `anonymous_responses = FALSE`, con motivo escrito.**
Es un cambio de lo que la app afirma de sí misma y se publica en pantalla y en el
PDF como «la regla de atribución» del estudio
(`AulasFuentesDelEstudio.tsx`): con `FALSE`, esa glosa dice otra cosa, y mirarla
antes de declararlo es parte de la decisión, no una consecuencia.

**4 · El padrón se purga por dos caminos, y uno no se puede olvidar.** Manual
(`DELETE /api/monitoreo/aulas/padron` → `monitoreo_aulas_padron_purgar()`) y
**automático en toda copia que salga** (`pulso_anonimizar_proyecto.R:206`, con su
propia comprobación de que la purga ocurrió). El automático es el que importa:
una purga que dependa de acordarse no es una garantía.

**5 · Al purgar, el avance por eje queda congelado en su último corte, y
declarado.** Clave `monitoreo_aulas_padron_corte`: conteos por celda, **sin
códigos**. Un tablero que se queda en blanco al purgar empuja a no purgar; uno
que sigue publicando cifras sin decir que están congeladas miente. La tercera
opción —conteos con su fecha de corte y el hecho de que el padrón ya no está— es
la única que no obliga a elegir entre privacidad y medición.

**6 · Lo que NO se reintroduce.** `population`, `population_pool` y `exclusions`
siguen en `NULL`, y `unique_student_ids` del `aula_frame` sigue subrogado. Este
ADR abre **una** clave con códigos reales, acotada a la población del estudio, y
no reabre el F114 en general.

**7 · La carga declara su columna y rechaza lo que no entiende.** La columna del
nivel se declara explícitamente en la carga, para que no la elija el orden de los
alias. Y los filtros tienen lista cerrada (`.CAP_FILTRO_CLAVES`): una clave de
filtro desconocida es `E_AULAS_PADRON_FILTRO_CLAVE`, no un filtro ignorado.
**Esto costó una medición**: con la clave mal escrita la carga trajo **25.403
personas de toda la universidad** en vez de las 822 de la facultad, y lo informó
como «sin filtro» en un aviso que nadie iba a leer contra el número esperado.

## Las garantías que sí se pueden dar

El padrón no se puede validar contra el marco. Lo que sí se puede medir, y se
publica con motivo escrito cuando no cuadra:

- conteo de elegibles del padrón contra los que el marco declara;
- cuántos códigos del padrón caen en aulas seleccionadas;
- coherencia del periodo académico;
- avisos **declarados, no silenciosos**, cuando alguna no cuadra.

Medido en CCSS: **822 personas**, niveles 6 → 246, 7 → 249, 8 → 196, 9 → 131,
vigencia 2026-09-07, 15 s para 25 MB. Y tres denominadores distintos que hay que
citar por su nombre y nunca confundir: **822** en el padrón crudo, **800** en
`category_profiles` de la config, **783** en el marco tras el piso de 50 %.

## Consecuencias

- El `.pulso` de un estudio con eje por persona **no es compartible** sin pasar
  por el anonimizador. Es un cambio de categoría del archivo y hay que decirlo
  donde se comparte, no sólo aquí.
- La purga es destructiva y deja el estudio sin poder recalcular el avance por
  eje: se recupera volviendo a cargar el padrón, no desde el `.pulso`.
- El riesgo del archivo equivocado queda **abierto y declarado**. Cerrarlo del
  todo exige derivar el padrón durante la construcción del marco, que es trabajo
  de la segunda entrega y no de este ADR.
- El coste de arranque es real: 15 s y 25 MB por carga. No se cachea el archivo
  de origen, sólo su derivado mínimo.

## Cumplimiento

- **Que el `.pulso` exportado no lleve padrón**: `test-monitoreo-aulas-padron-purga.R`
  (39 aserciones) y la comprobación propia de
  `pulso_anonimizar_proyecto.R:464`, que falla si la purga no ocurrió.
- **Que la purga congele y lo declare**: misma suite, sobre
  `monitoreo_aulas_padron_corte`.
- **Que un filtro desconocido no se trague en silencio**: `E_AULAS_PADRON_FILTRO_CLAVE`
  registrado en `errors_registry.R:133` y cubierto por
  `test-errors-registry.R`.
- **Que la clave esté censada**: `test-monitoreo-aulas-campos-declarados.R` y
  `session_schema.R:339`.
- **Lo que no está probado y hay que decirlo**: que el padrón cargado sea la
  población del estudio. No hay test posible hoy; la evidencia es el conteo
  contra el marco y es indicio, no prueba.

## Notas

- El detector de PII y el gate de los proyectos de referencia
  (`make reference-project-verify`) siguen siendo los que impiden que un padrón
  llegue al repositorio.
- ADR hermano en su espíritu:
  [ADR 0076](0076-una-base-depurada-se-promueve-no-se-recomienda.md) —lo que
  entra al estado se promueve con su declaración, no se recomienda—.
