# ADR 0063: El mazo comparativo se deriva de la declaración, y se propone

Estado: Aceptada

Implementacion: En curso

Fecha: 2026-08-06

Fecha de decision: 2026-08-06

Reemplaza: —

Extiende: ADR 0062 (la equivalencia entre públicos se declara), ADR 0018
(Gráficos comparte planes editables como paquete portable)

## Contexto

El ADR 0062 hizo que el estudio declare qué pregunta de un público equivale a
cuál de otro, y su enmienda añadió la lámina del informe a la que va cada
pregunta. La matriz real de Acreditación Contabilidad ya traía ese plan:
**133 de 154 filas asignadas a 44 láminas, 42 de ellas agrupando más de una
pregunta**.

Hoy ese dato se declara, se guarda y no lo usa nadie. El plan de láminas de
Gráficos vive en `graficos_config$plan$slides` y se arma lámina por lámina en el
editor, sin conocer la declaración.

El costo de esa desconexión está medido. En la lámina «prueba 2» del PPT
entregado, un grupo comparaba docentes `p13_2` (¿Conoce bienestar psicológico?,
90 %) contra estudiantes `p12_2` (¿Ha utilizado bienestar psicológico?, 31 %)
bajo un título que no nombraba a ninguna de las dos. **El graficador no tuvo la
culpa**: `p_barras_multiapiladas` es el correcto para comparar públicos. Falló el
emparejamiento, que hasta el ADR 0062 no tenía dónde vivir.

### Lo que ya existe y no hay que duplicar

Tres piezas del sistema actual deciden la forma de esta decisión:

1. **Un ciclo proponer → previsualizar → aplicar ya probado.**
   `POST /api/graficos/plan/sugerido` genera una propuesta **sin persistirla**;
   `SuggestedPlanButton` la muestra y sólo al confirmar hace `loadPlan(...)`. Ya
   sirve a los perfiles existentes (ACNUR).
2. **El graficador que corresponde.** `p_barras_multiapiladas` en modo
   `multilista` toma exactamente la forma que la declaración produce: un `tema`
   por pregunta con las variables de cada público, y `titulos_grupo` con la
   etiqueta estándar.
3. **Dos guards de escala que NO coinciden en el grano.** El del frontend
   (`multiApiladasScaleGroups()` + `evaluateScaleCompat()`) emite un veredicto
   **por tema**. El del motor R, en `modo = "var_cruce"`, comprueba sobre
   **todas las refs de la lámina**, aplanando los temas. Esta decisión se
   escribió creyendo el grano del frontend, y el PPT real lo desmintió: una
   lámina que juntaba género con una pregunta Sí/No moría entera. Por eso el
   generador agrupa por escala y usa `multilista` —que existe justo para apilar
   bloques de escalas distintas— cuando hay más de un grupo.

## Decision

**La declaración de equivalencias es una fuente del plan sugerido de Gráficos, no
un mecanismo de plan aparte.**

1. **Se propone, no se impone.** La derivación reusa `plan/sugerido`: devuelve
   una propuesta que el analista ve antes de aplicar. Tras aplicarla, el plan es
   editable como cualquier otro y **la declaración no lo vuelve a sobrescribir
   por su cuenta**.

   Si la declaración mandara siempre, editar una lámina a mano sería imposible o
   se perdería en la siguiente derivación, en silencio. Un plan que se regenera
   solo destruye trabajo sin dejar rastro, que es la forma más cara de este
   defecto.

2. **Una lámina por `diapositiva` declarada, un tema por pregunta, una barra por
   público.** El graficador es `p_barras_multiapiladas`: `var_cruce` cuando toda
   la lámina comparte escala, `multilista` con un bloque por escala cuando no.

3. **Las filas sin lámina no entran al mazo.** No asignar lámina es una decisión
   del analista, no un olvido que la app deba completar — 21 de las 154 filas de
   la matriz real están así, y rellenarlas produciría láminas que nadie pidió.

4. **Sólo entran al mazo las preguntas de opción —única o múltiple—**,
   directamente o a través de su recodificada. Una numérica entra sólo si
   Codificación le construyó una recodificada de opción, que es lo que el render
   acaba dibujando. Texto abierto, fechas y numéricas sin recodificar se
   reportan como `no_graficable`.

   El alcance importa: esto filtra **el mazo, no la declaración**. Una pregunta
   de texto abierto sigue teniendo etiqueta estándar y sigue siendo equivalente
   entre públicos —Analítica la usa—; lo que no puede es ser una lámina. La
   declaración sirve a dos consumidores con necesidades distintas.

5. **Una pregunta cuyos públicos no comparten escala se reporta y no se grafica.**
   Es un defecto de la declaración o del instrumento, o una diferencia real:
   medido en Acreditación Contabilidad, «¿Cuántos años tiene?» tiene rangos
   distintos por público —docentes 18-51+, egresados 22-36+— y compararlos en un
   mismo gráfico sería incorrecto. Fabricar la lámina lo escondería detrás de un
   gráfico con aspecto correcto, que es exactamente el modo de fallo que el ADR
   0062 vino a cerrar.

6. **El orden del mazo es el declarado**: por `diapositiva`, y dentro por el orden
   de las filas. El generador no reordena por criterios propios.

7. **La derivación no persiste nada.** No escribe `graficos_config`, no toca la
   declaración y no marca el proyecto como sucio. Sólo devuelve una propuesta.

## Consecuencias

**A favor**

- El plan del informe deja de reconstruirse de memoria: sale de lo que el estudio
  ya declaró, con el emparejamiento correcto por construcción.
- El error de «prueba 2» pasa a ser imposible por esa vía: las variables de cada
  tema vienen de una fila de la declaración, no de tres elecciones sueltas en un
  selector que muestra la misma etiqueta doce veces.
- Reusar `plan/sugerido` significa que la previsualización, la validación y el
  aplicar ya existen y ya están probados.

**En contra, y asumido**

- **La propuesta envejece.** Editar la declaración después de aplicar no actualiza
  el plan; hay que volver a proponer y aplicar. Se acepta porque la alternativa
  —regenerar solo— destruye las ediciones manuales sin avisar. La propuesta
  declara de qué revisión de la declaración sale, para que la diferencia sea
  visible en vez de sospechada.
- **Una lámina por `diapositiva` es una convención, no una ley.** Un analista que
  quiera dos láminas para una misma pregunta tendrá que editarlas tras aplicar.
- **Depende de que la declaración esté hecha.** Sin `diapositiva` asignada no hay
  mazo que derivar, y la superficie tiene que decirlo en vez de proponer un plan
  vacío.

**Invalidado por esta decisión**

- Un segundo generador de plan en paralelo a `plan/sugerido`.
- Derivar el mazo escribiendo directamente sobre `graficos_config$plan`.
- Completar láminas no declaradas con heurísticas.
- Graficar una pregunta cuyos públicos no comparten escala.
- Llevar al mazo una pregunta que no sea de opción.

## Cumplimiento

- Un caso comprueba que una declaración con dos láminas y tres preguntas produce
  el plan esperado: una lámina por `diapositiva`, un tema por pregunta, las
  variables de cada público en su tema y la etiqueta estándar como título.
- Un caso comprueba que las filas sin `diapositiva` **no** producen lámina.
- Un caso comprueba que una pregunta cuyos públicos no comparten escala se
  reporta y no aparece en el plan.
- Un caso comprueba la graficabilidad por tipo: opción única y múltiple sí,
  numérica sólo con recodificada de opción, texto abierto no.
- Un caso comprueba que una lámina de escalas mixtas se apila en `multilista` en
  vez de degradarse, y que su spec lo acepta el graficador real
  (`expect_silent(do.call(p_barras_multiapiladas, args))`) — los casos que sólo
  fijan la forma que el generador construye pasaron con un `modo` que el motor
  rechazaba.
- Un caso comprueba que el orden del mazo es el declarado y no el alfabético ni
  el de inserción.
- Un caso comprueba que derivar **no** persiste: ni `graficos_config`, ni la
  declaración, ni la marca de proyecto sucio.
- Verificación sobre estudio real: derivar el mazo de Acreditación Contabilidad y
  comprobar que las láminas de servicios traen las tres baterías en filas
  separadas y con los cuatro públicos correctos.

## Notas

- La propuesta viaja con la lista de lo que quedó fuera y por qué —sin lámina,
  sin escala común, sin variables— porque un mazo más corto de lo esperado sin
  explicación se lee como un fallo del generador.
- Queda fuera de esta decisión, y es trabajo aparte: que el editor de
  equivalencias ofrezca asignar láminas de forma asistida (hoy es un campo de
  texto), y que Gráficos avise cuando la declaración cambió después de aplicar.
