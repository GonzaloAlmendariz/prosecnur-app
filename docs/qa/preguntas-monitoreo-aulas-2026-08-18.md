# Las preguntas que el libro permite y la app contesta (o no)

Las tres hojas del operativo están mapeadas campo a campo desde `267db02f`
—agendamiento 20, parte de campo 11, base de control 25—. Ese inventario dice
**qué datos hay**. Este documento dice **qué preguntas permiten**, quién las
hace y si alguna superficie las contesta hoy.

Las dos personas, con las palabras de Gonzalo:

- **CAMPO** — el responsable de campo: llegar a las aulas.
- **ANALISTA** — «el analista que ve el control y la calidad de la información y
  la efectividad de la información».

La vara que ordena la lista: **«que lleguemos a las aulas y que las aulas sean
efectivas»**.

## Hoja 1 · «Aulas Agendadas» — el ciclo de contacto

| # | Pregunta | Quién | Campos | ¿Hoy? |
|---|---|---|---|---|
| P1 | ¿A qué aulas voy hoy y dónde quedan? | CAMPO | FECHA AGENDADA · HORA · SESIONES Y AULA · FACULTAD | ✅ Agenda › «A dónde ir cada día» |
| P2 | ¿A quién llamo hoy, de lo que aún no está agendado? | CAMPO | STATUS MUESTRA · TELÉFONO · MEDIO · N.º INTENTOS | ◐ los campos están en la tabla; **no hay lista de pendientes de contacto** |
| P3 | ¿Cuántos intentos llevo con este docente? | CAMPO | N.º INTENTOS | ◐ columna, sin criterio de corte |
| P4 | **¿Qué medio agenda mejor, llamada o correo?** | AMBOS | MEDIO DE CONTACTO × STATUS MUESTRA | ✗ **nadie lo cruza** |
| P5 | ¿Cuántos intentos hacen falta por facultad? | ANALISTA | N.º INTENTOS × FACULTAD | ✗ |
| P6 | ¿Qué aulas tienen ficha y enlace listos? | CAMPO | ENLACE DE LA FICHA | ✅ «Preparación de campo» (179/196 enlaces · 36/196 fichas) |
| P7 | ¿Qué aulas ya pasaron su fecha sin parte? | CAMPO | cruce hoja 1 × hoja 2 | ✅ «Lo que se quedó atrás» (18 de 119) |
| P8 | ¿Qué facultad se queda sin colchón? | AMBOS | STATUS MUESTRA · cadena | ✅ «Colchón por facultad» (14 de 20 agotaron) |
| P9 | ¿Cuántos alumnos espero encontrar en esa aula? | CAMPO | MATRICULADOS TOTAL DTI · POBLACIÓN | ◐ en tablas; **no en la ruta del día**, que es donde se necesita |
| P10 | **¿Qué anotó quien agendó?** | CAMPO | OBSERVACIONES | ✗ **la columna no se muestra en ninguna superficie** |

## Hoja 2 · «Aulas Aplicadas (Campo)» — lo que pasó en el aula

| # | Pregunta | Quién | Campos | ¿Hoy? |
|---|---|---|---|---|
| P11 | ¿Cuántas efectivas salieron del aula? | AMBOS | CANTIDAD DE EFECTIVAS | ✅ Parte de campo |
| P12 | ¿El parte cuadra con su aritmética? | ANALISTA | ASISTENTES − RECHAZOS − DUPLICADOS | ✅ 2 de 210 no cuadran |
| P13 | **¿Qué aplicador rinde más?** | ANALISTA | APLICADOR × EFECTIVAS/ASISTENTES | ✗ **es literalmente «qué nos está rindiendo más» y no existe** |
| P14 | **¿A qué hora del día se recoge más?** | AMBOS | HORA DE APLICACIÓN × EFECTIVAS | ✗ decide cómo agendar lo que falta |
| P15 | ¿Qué proporción de asistentes acepta responder? | ANALISTA | ASISTENTES · RECHAZOS | ◐ embudo agregado; **no por facultad** |
| P16 | ¿Cuántos duplicados y por qué? | ANALISTA | DUPLICADOS · OBSERVACIONES | ◐ el número sí, el motivo no |
| P17 | **¿El aula real fue la agendada?** | CAMPO | AULA vs SESIONES Y AULA | ✗ **no se cruza**; el fixture siembra 1 de cada 7 cambiada |
| P18 | ¿Se aplicó algún aula que no estaba agendada? | ANALISTA | cruce hoja 1 × hoja 2 | ✗ |
| P19 | ¿Cuál es la asistencia media y cómo se compara con los matriculados? | ANALISTA | ASISTENTES vs MATRICULADOS | ✗ **«cuál es la asistencia» es una de sus tres preguntas y no hay tasa** |

## Hoja 3 · «Base de control» — la calidad de lo recogido

| # | Pregunta | Quién | Campos | ¿Hoy? |
|---|---|---|---|---|
| P20 | ¿El aula fue efectiva? | ANALISTA | 70T · 70P · VÁLIDO TOTAL/POBLACIÓN | ✅ matriz de umbrales (31/33/6/70 + 70 indeterminadas) |
| P21 | ¿Cuántas respuestas cortas o largas? | ANALISTA | TOTAL CORTAS/LARGAS + sus % | ◐ columnas sin lectura |
| P22 | **¿Qué validador revisó y con qué resultado?** | ANALISTA | VALIDADOR 1 · 2 · 3 | ✗ tres columnas **sin ninguna lectura** |
| P23 | ¿La duración se sale del rango? | ANALISTA | NORM-HORARIO · RANGO-HORARIO | ◐ columna; el motor ya declara «Sin llenar en el libro: Duración» |
| P24 | ¿Cómo va la cuota de sexo por facultad? | AMBOS | N.º/% MUJERES-HOMBRES · CUOTA | ✅ pirámide + cuota |
| P25 | ¿Cuánto falta para la cuota? | AMBOS | FALTANTES CUOTA | ✅ |

## Las que ninguna hoja contesta sola y son las que él pidió

| # | Pregunta | Quién | De dónde saldría | Etapa |
|---|---|---|---|---|
| P26 | **¿Cuál es la tasa de efectividad por facultad?** | ANALISTA | efectivas ÷ aulas visitadas, por facultad | **E2** |
| P27 | ¿Qué facultad rinde más por aula visitada? | ANALISTA | P26 ordenada | **E2** |
| P28 | ¿A qué ritmo va cada facultad? | ANALISTA | serie diaria × facultad | **E3** |
| P29 | **¿En qué semana cerramos?** | ANALISTA | ritmo + lo que falta agendar + efectividad | **E4** |
| P30 | ¿Cuántas aulas quedan antes del techo, y qué facultad lo toca primero? | AMBOS | colchón + consumo | **E5** |

## Recuento

**30 preguntas · 8 contestadas · 8 a medias · 14 sin contestar.**

De las 14, **nueve son del ANALISTA**, que es exactamente la persona que Gonzalo
describió como desatendida. Y tres de ellas —P13 aplicador, P14 hora, P19
asistencia— son sus tres palabras textuales: «cuál es la efectividad, cuál es la
asistencia, qué nos está rindiendo más».

**Lo que esto cambia del plan**: E2 no es «un panel de efectividad». Son P13,
P14, P19, P26 y P27, que comparten un mismo eje ausente —**rendimiento por
unidad de esfuerzo**— y hoy no existe ninguno.

**Barato y de propina**: P10 y P22 son columnas que el equipo LLENA y la app no
enseña. No hay que calcular nada: hay que mostrarlas.
