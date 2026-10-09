# ADR 0088 — El numerador de una celda es la persona cuando el eje lo declara

- **Estado**: Aceptado
- **Implementación**: Completa en el motor y en la pantalla del perfil aulas
- **Ámbito**: Monitoreo de cursos-horario (perfil aulas) ·
  `monitoreo_aulas_eje_atribucion.R` · `monitoreo_aulas_avance_cuota.R` · la
  pestaña Metas
- **Fecha**: 2026-09-17 · **Ratificado**: 2026-09-17 (Gonzalo, plan del eje de
  cuotas declarable, decisiones 3 y 12)
- **Reemplaza parcialmente**: el supuesto de atribución del
  [ADR 0079](0079-el-cumplimiento-se-mide-contra-la-cuota-del-diseno.md) —«la
  atribución es por aula del plan y no por auto-reporte»— y su premisa de que el
  doble conteo por traslape es indespreciable porque las respuestas son
  anónimas. Todo lo demás del 0079 sigue vigente, incluido su contrato
  congelado.
- **Relación**: aplica al avance la cláusula 5 del
  [ADR 0081](0081-la-facultad-de-un-aula-no-es-la-de-sus-alumnos.md) («la
  facultad de RESULTADO la declara el encuestado, no el aula»); depende del
  [ADR 0087](0087-el-padron-del-eje-se-persiste-y-revierte-el-f114.md); y se
  activa sólo para los ejes que el
  [ADR 0086](0086-el-eje-de-cuotas-lo-declara-el-estudio.md) marca con
  `atribucion = "persona"`.

## Contexto

El ADR 0079 fijó que el numerador de una celda son «las respuestas atribuidas a
aulas del eje X». Eso es correcto mientras el valor del eje sea una propiedad del
AULA. Con el eje en `nivel` deja de serlo: el nivel es de la persona, y dos
alumnos de niveles distintos pueden estar en la misma aula —de hecho lo están,
porque el piso de 50 % dejó dentro aulas mixtas a propósito—.

El ADR 0081 ya había visto esta grieta y la dejó cuantificada: su cláusula 5 dice
que «la facultad de RESULTADO la declara el encuestado, no el aula», y declara la
atribución por aula como «correcta para el AVANCE […] queda declarado y
cuantificado», con el error medido —5,5 % en 2025, 5,8 % en HSVG2026—. Este ADR
no lo contradice: lo aplica al avance para el eje que lo declare.

Y hay una premisa del 0079 que el padrón elimina. Decía, literalmente, que «el
doble conteo por traslape (~1,55 aulas por alumno) se asume despreciable: **las
respuestas son anónimas y no se pueden deduplicar** entre aulas distintas». Con
código declarado sí se pueden — y el efecto cambia de naturaleza, no sólo de
tamaño: hoy dos respuestas de la misma persona caen en dos aulas, quizá de
facultades distintas, y se diluyen; con eje `nivel` **caen en la MISMA celda**,
porque la persona tiene un solo nivel. Una cuota de personas contaría a la misma
persona dos veces: exactamente el fallo que la cuota existe para impedir.

## Decisión

**1 · Con `atribucion = "persona"`, el numerador se resuelve por persona.** El
valor del eje de una respuesta sale de su código declarado cruzado contra el
padrón. **Sin cruce, la respuesta no tiene valor de eje y no cuenta para ninguna
celda**: va a una bolsa declarada. **No hay fallback a lo autodeclarado.** Una
respuesta cuyo código no resuelve y cuyo ciclo autodeclarado dice «séptimo» no
entra en el nivel 7: el auto-reporte es lo que este ADR deja de usar como
atribución, y usarlo «sólo cuando falta el otro» sería usarlo.

**2 · El paso del AULA se conserva íntegro y PRIMERO.** `fuera_universo` y
`huerfanas` no cambian de significado: siguen siendo lo que el 0079 definió
—respuestas de un aula fuera de universo, y respuestas sin aula del plan—, y se
resuelven antes de mirar a la persona. Es lo que permite que las cifras del 0079
y las de aquí se lean en la misma tabla.

**3 · El orden es normativo, y sin él una respuesta se cuenta dos veces:**
**exclusiones del aula → asignación por persona → deduplicación.** Una huérfana
con código resoluble contada después de deduplicar entraría por los dos lados.

**4 · La celda cuenta PERSONAS, no respuestas.** Se deduplica por código dentro
de la celda, portando la lógica de `monitoreo_acreditacion_deduplicate()`
([monitoreo_engine.R:991](../../api/R/monitoreo_engine.R)) —que ya corre en
producción— sin acoplar los dos mundos: `monitoreo_aulas_universitarias.R` no
referencia `monitoreo_sources`.

**5 · Las cuatro bolsas se publican, y la pantalla las dice.** `fuera_universo`,
`huerfanas`, `sin_eje` y `duplicadas`. Un campo que el motor publica y ninguna
pantalla consume no es una capacidad: es deuda. Medido en el simulacro de CCSS
con 64 respuestas, la pantalla decía «Efectivas 58 de 400» y **ni una palabra de
las otras seis** durante el tiempo que las bolsas vivieron en un componente
desconectado. Hoy dice: «6 respuestas más llegaron y no entran en ninguna meta:
3 fuera de universo · 1 sin curso-horario del plan · 1 sin nivel · 1 persona que
respondió dos veces».

**6 · El invariante se publica, y se pinta al revés que las bolsas.**

```
respuestas_validas = Σ celdas + duplicados + sin_eje + fuera_universo + huerfanas
```

Las bolsas se dicen siempre que existan; el invariante **sólo cuando NO cuadra**.
Un «las partes suman» permanente es ruido; un bloque cuyas partes no suman su
total no se puede leer y ninguna otra pantalla lo va a decir. El motor lo
comprueba y publica también `solapadas`, para que un doble conteo entre bolsas
no se esconda en una suma que casualmente cierre.

**7 · La bolsa es un estado declarado, nunca un cero medido.** Mismo criterio que
`estado = "sin_cuota"`: «0 sin nivel» no se pinta —con el eje en facultad las dos
bolsas de persona valen 0 siempre—, pero «no lo sabemos» y «medimos cero» se
dicen distinto. La bolsa `sin_eje` viaja con el motivo por el que la respuesta
cayó ahí, no sólo con su cuenta.

## Consecuencias

- El numerador de una celda **depende del padrón**, así que purgarlo cambia lo
  que el tablero puede afirmar. Por eso el corte congelado del ADR 0087 no es un
  adorno: es la única forma de que purgar no borre la medición.
- Un estudio con eje por persona tiene **dos poblaciones con la misma palabra**:
  el nivel de un curso-horario es su nivel modal
  ([calc_muestra_aulas.R:1432](../../api/R/calc_muestra_aulas.R) lo colapsa a la
  moda) y el de una celda es el de cada persona. Toda superficie donde las dos
  conviven tiene que decirlo; «Nivel 7: 1 reemplazado» y «Nivel 7: faltan 103
  personas» no son dos cifras del mismo grupo.
- La deduplicación hace que el avance **pueda bajar** al llegar una respuesta
  repetida. Es correcto y hay que esperarlo.
- El traslape docente y de aula **informa, no descuenta ni excluye**: eso no lo
  cambia este ADR. Lo que se deduplica son personas dentro de una celda, no
  aulas ni docentes.

## Cumplimiento

- **El satélite y su invariante**: `monitoreo_aulas_eje_atribucion()` devuelve
  una fila por respuesta con su motivo, y `monitoreo_aulas_eje_invariante()`
  cierra la suma. Suite `test-monitoreo-aulas-eje-atribucion.R`, 57 aserciones.
- **Los cuatro casos, sobre datos**: simulacro de CCSS con 64 respuestas
  fabricadas a propósito para cubrir cruza / no cruza / fuera de universo /
  huérfana / repetida. Medido: 58 en celdas, `fuera_universo` 3, `huerfanas` 1,
  `sin_eje` 1, `duplicadas` 1, invariante 64 = 58 + 1 + 1 + 3 + 1, `solapadas` 0.
- **Que la pantalla las diga**: `AulasBolsasDelAvance.test.tsx` renderiza la
  PESTAÑA y no sólo el componente, con un fixture que trae la forma real del
  estudio (`proyeccion_metas: null`). Comprobado en rojo: con el montaje
  apagado, la aserción cae.
- **Que el conteo no salga de una resta**: el mismo test fija `fueraDeCelda` con
  un invariante roto a propósito, porque `total − validas` daría el número
  correcto mientras el invariante cuadre y uno inventado justo cuando no.
- **Identidad del eje facultad**: las 136 aserciones de
  `test-monitoreo-aulas-avance-cuota.R` en verde sin tocar una.
- **Lo que no está probado**: que el código declarado sea el de quien responde.
  Es auto-reporte de identidad y no hay forma de verificarlo desde aquí; la hoja
  «Control de nivel» lo contrasta contra el ciclo autodeclarado y publica el
  desacuerdo, que es lo más cerca que se puede llegar.

## Notas

- Para la hoja «Control de nivel», «Otros» del ítem de ciclo **no es una
  discrepancia** con el padrón: es coincidencia si el padrón también pone a esa
  persona fuera de 6–9. Tratarlo como desacuerdo inflaría el conflicto justo en
  las aulas mixtas, que son las que el piso de 50 % dejó dentro a propósito.
  Y quien marca «Otros» es fuera de universo declarado por la persona, no una
  no-respuesta: no entra al denominador como si se le hubiera perdido.
- Commits: `6d9e84c5`, `ca3d581b`, `22dc6ea2`, `e63ddb5e`.
