# Plan: las dos tasas en Monitoreo, del pronóstico a la decisión

Estado: **mapeo, sin ejecutar.** Este documento no propone tocar nada todavía.

Sale de tres preguntas: si Monitoreo distingue las dos tasas, si el esperado de
un aula debe ser un número o un rango, y si lo que importa es el aula o el
agregado. Para responderlas hay que saber primero qué existe, y existe mucho
más de lo que parecía.

## Parte 0 · Lo que ya está construido

Antes de plantear trabajo nuevo, el inventario. Estas piezas ya funcionan y no
hay que rehacerlas.

**El seguimiento de la tasa en campo** (`monitoreo_aulas_efectividad_seguimiento.R`,
ADR 0082). Contrasta por facultad la tasa que el diseño supuso contra la que el
campo está rindiendo, con cuántas aulas se sostiene la medición y cuántos
alumnos de diferencia implica. Tiene banda de incertidumbre al 95 %.

**Y su disparador ya es el agregado, no el aula.** Es una decisión tomada el
2026-08-26 después de un backtest: la primera versión disparaba cuando la banda
excluía la tasa prevista, y sobre el campo 2025 esa regla detectaba caídas de
13,6 puntos de mediana cuando el escenario que preocupaba vale 2 a 4. Cero de
quince facultades lo habrían detectado. Lo que dispara hoy es el consumo del
margen:

```
proyectado      = conseguido + aforo pendiente × tasa observada
margen restante = proyectado − cuota
```

Con backtest publicado: tras la semana 2 señala una facultad, un acierto, cero
falsas alarmas, cero pérdidas. Y la semana 2 es la última con margen para
agendar.

**La calibración por celda** (`monitoreo_aulas_calibracion.R`) responde no si ya
llegaste sino si vas a llegar, por celda de facultad y sexo.

**La cola de trabajo por aula** (`loQueFaltaParaCerrar.ts`). Cuántas encuestas
faltan a cada aula que no cerró, ordenadas por esfuerzo: sobre el corte real,
505 encuestas cierran 79 aulas, la mediana es 6 y 36 cierran con cinco o menos.

**A quién llamar** (`candidatosDeReemplazo.ts`), que ya usa `tasa_efectividad_aula`
para puntuar candidatos, con fallback a 0,55.

**Y las cuatro columnas del esperado** viajan desde hoy al plan de Monitoreo:
las dos tasas y los dos pronósticos.

## Parte 1 · La distinción no está marcada en Monitoreo

Es la respuesta a la primera pregunta, y es que **no**.

En la interfaz de Monitoreo aparecen «tasa prevista», «efectividad»,
«rendimiento» y una serie llamada `serieDeRendimiento`, sin que ninguna diga de
cuál de las dos tasas habla. Y hay un problema mayor que el vocabulario:

**`expected_valid`, que es la meta contra la que se juzga cada aula, se compone
con la tasa del aula.** Eso es correcto para la meta operativa de un salón. Pero
la pantalla que dice «llegaron a su meta: N de M» está juzgando con una vara y
el seguimiento de facultad proyecta con otra, y nada lo declara.

**Trabajo 1.** Auditar las superficies de Monitoreo igual que se hizo en Cálculo
de muestra, renombrar según el vocabulario acordado, y hacer explícito en cada
pantalla con qué vara juzga.

## Parte 2 · Valor único o rango

Es la pregunta abierta de verdad, y tiene tres opciones con consecuencias
distintas.

El problema es el escalón: con los cinco tramos vigentes, un aula de 26
elegibles espera un 16 % menos que una de 25, y **190 de las 1.392 aulas del
marco están a un elegible de un borde**. Un aula cuya matrícula cambia en uno
cruza de tramo y su meta salta.

**Opción A: valor único, como hoy.** Es lo más simple de leer y lo que ya está
implementado. Paga el escalón entero: dos aulas casi iguales reciben metas que
difieren un 16 %, y quien lo note no tendrá explicación.

**Opción B: rango.** El esperado se publica como intervalo. Resuelve la
apariencia del escalón, pero **hoy no hay con qué construirlo honestamente**:
ninguna de las dos tasas modela la dispersión de un aula alrededor de su tramo.
Un rango inventado es peor que un punto, porque parece que sabe algo que no
sabe.

**Opción C: curva continua.** El esperado sigue siendo un número, pero la tasa
deja de escalonar. Ya está medida: empata en precisión con los tramos y elimina
las inversiones de raíz. Es la que resuelve la causa en vez del síntoma.

**Recomendación: C, y B solo después de C si el campo da con qué estimar la
dispersión.** La secuencia importa: con la curva, un rango se puede construir
sobre residuos observados; sin ella, el rango estaría absorbiendo un defecto del
instrumento en vez de medir incertidumbre real.

**Trabajo 2.** Ajustar la curva sobre las 194 aulas de 2025, validarla contra
los tramos, y decidir el reemplazo con ADR.

## Parte 3 · El agregado manda, y ya está así

Tercera pregunta, y la respuesta es que el diseño ya te da la razón: **el
disparador de activación de reservas es el margen agregado por facultad, no el
cumplimiento de un aula.** Se decidió con backtest y la regla por aula se probó
y se descartó por no detectar nada.

Lo que falta no es cambiar el criterio sino **cerrar el circuito**:

**Trabajo 3.** Que la pantalla diga en qué orden mirar. Hoy conviven una vista de
aulas que no cerraron y una de margen por facultad, y no está dicho que la
segunda manda. La lectura correcta es: primero si la facultad va a cerrar,
después qué aula llamar, y el aula individual solo importa como insumo del
primero.

**Trabajo 4.** Que la recomendación de a quién llamar use el margen de la celda,
no solo la puntuación del candidato. Hoy `candidatosDeReemplazo` ordena por
características del aula; falta que priorice la celda de sexo que está más cerca
de no cerrar.

## Parte 4 · La inferencia durante la recolección

Lo que hay hoy es una tasa observada acumulada y su banda. Lo que se planteó es
algo más: **actualizar la creencia sobre la tasa de cada facultad conforme
entran los datos**, partiendo de la prevista como información previa.

No es lo mismo y la diferencia importa al principio del campo, que es cuando se
decide. Con tres aulas aplicadas, la tasa observada es ruido y la banda es
enorme; una estimación que arranque de la prevista y se vaya moviendo con la
evidencia da un número usable desde la primera semana.

**Trabajo 5.** Diseñar la actualización, con dos decisiones de fondo. Cuánto
peso lleva la información previa, y si ese peso depende de cuántas aulas
aplicadas tuvo la facultad en 2025, como ya hace el ajuste con su umbral de
doce. Y qué se hace cuando el campo contradice fuertemente lo previsto.

**Y una advertencia que vale más que el diseño**: el motor ya tiene tres
ejemplos de una cifra que no se recalcula cuando cambia lo que la alimenta. Una
tasa que se actualiza sola es exactamente el tipo de cosa que puede quedar
desincronizada sin avisar. Necesita su invariante antes que su fórmula.

## Parte 5 · Cómo se sostiene esto

Los cinco trabajos no son una lista para hacer de corrido. Tienen orden y
dependencias:

```
1. nomenclatura en Monitoreo        independiente, se puede hacer ya
3. orden de lectura de la pantalla  independiente
2. curva continua                   ADR; bloquea a 2b
4. prioridad por margen de celda    depende de 3
5. inferencia durante el campo      depende de 2 y de un invariante propio
2b. rango sobre residuos            depende de 2 y de datos de campo
```

Y hay un trabajo transversal que no es ninguno de los cinco: **cada pieza que se
agregue necesita su invariante estructural**, no su test de valor. La revisión de
hoy dejó tres ejemplos de por qué, la tasa congelada, la calibración de origen
desconocido y la proporción de otra fuente, ninguna de las cuales rompía un test
pero las tres se cazan con una comprobación que se cumple por construcción.

## Lo que hay que decidir antes de arrancar

Tres cosas, y ninguna es técnica:

**Cuánto de esto entra al estudio en curso.** Los trabajos 1, 3 y 4 mejoran la
lectura sin cambiar ningún número. El 2 y el 5 cambian cómo se calcula y no
deberían tocar un operativo andando.

**Si el rango se descarta o se pospone.** Si se pospone, hay que decir qué dato
del campo lo habilitaría.

**Y con qué frecuencia se revisa.** Esto termina siendo un ciclo que corre
mientras dure el campo, y conviene fijar cada cuánto se mira antes de empezar,
no después.
