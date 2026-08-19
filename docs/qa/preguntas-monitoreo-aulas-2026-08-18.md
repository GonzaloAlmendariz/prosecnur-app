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

> **ACTUALIZACIÓN 2026-08-19 — las 14 están en 0.** Ocho se cerraron en la tanda
> del rendimiento (P13, P14, P19, P26, P27, P28, P29, P30) y las tres últimas
> —P4 el medio de contacto, P17 el aula real, P2 la cola— en la madrugada. Las
> que quedaban «a medias» se resolvieron con las superficies nuevas. El detalle,
> en `goal-campo-aulas-qr-registro-2026-08-16.md`, L122 en adelante.

De las 14, **nueve son del ANALISTA**, que es exactamente la persona que Gonzalo
describió como desatendida. Y tres de ellas —P13 aplicador, P14 hora, P19
asistencia— son sus tres palabras textuales: «cuál es la efectividad, cuál es la
asistencia, qué nos está rindiendo más».

**Lo que esto cambia del plan**: E2 no es «un panel de efectividad». Son P13,
P14, P19, P26 y P27, que comparten un mismo eje ausente —**rendimiento por
unidad de esfuerzo**— y hoy no existe ninguno.

**Barato y de propina**: P10 y P22 son columnas que el equipo LLENA y la app no
enseña. No hay que calcular nada: hay que mostrarlas.

---

# Las hojas que la app NO lee (2026-08-18, tras el aviso de Gonzalo)

El libro real de 2025 tiene **19 hojas**. La app lee **tres**. Gonzalo apuntó a
«la hoja que tiene tablas dinámicas… para el recorrido diario, la producción por
encuestador, las metas y las cuotas por facultad», y ahí estaba media respuesta
a las 14 preguntas sin contestar.

**PII**: estas hojas llevan nombre, teléfono y correo PUCP de los docentes, y la
planilla lleva nombres de encuestadores. Se leyó ESTRUCTURA, no datos. **Ninguna
copia entra al repo** (regla de siempre).

## Las 19 hojas, y qué lee la app

| | Hoja | ¿La app? |
|---|---|---|
| 1 | Muestra - Full Data | ✗ |
| 2 | BD Agenda - Matriz | ✗ |
| 3 | En Reserva | ✗ (el banco vive en el plan) |
| 4 | **Aulas Agendadas** | ✅ |
| 5 | Copia de Aulas Agendadas | ✗ (copia) |
| 6 | **Base de control** | ✅ |
| 7 | Actualizar datos | ✗ (mecánica de Excel) |
| 8 | **Aulas Aplicadas (Campo)** | ✅ |
| 9 | **Tabla - Resumen** | ✗ ← serie por fecha |
| 10 | **Progreso General** | ✗ ← metas y cuotas por facultad |
| 11 | Fechas normalizadas | ✗ (auxiliar) |
| 12–17 | **aplicación del día 23·24·25·26·29·01** | ✗ ← el recorrido diario |
| 18 | aulas adicionales | ✗ (el banco) |
| 19 | **planilla** | ✗ ← producción por encuestador y franja |

## Qué contesta cada una de las cuatro que importan

### 9 · «Tabla - Resumen» — la serie por fecha

Columnas: `MUESTRA · FACULTAD · CURSO-HORARIO · POBLACIÓN · 70% POBLACIÓN ·
ENCUESTAS VÁLIDAS · N° MUJERES · N° HOMBRES · REGISTRO POR FECHA` y después
**una columna por fecha de campo** (08/09, 09/09, 10/09…) con el conteo de ese
día.

Es **la materia prima del ritmo y del pronóstico**: encuestas por aula y por
día, con la facultad al lado. Contesta **P28** y alimenta **P29**. Y trae el
umbral escrito —`70% POBLACIÓN`—, que es la vara de efectividad que Gonzalo ya
había explicado.

### 10 · «Progreso General» — metas y cuotas por facultad

Cabecera de dos filas: `FACULTAD · TOTAL/MUJERES/HOMBRES` (meta) ·
`TOTAL/MUJERES/HOMBRES` (logrado) · **`AULAS`** · `TOTAL · PROGRESO ·
FALTANTES · MUJERES · PROGRESO · FALTANTES`.

Una fila real: Arquitectura, meta 123 (84 M / 39 H), logrado 184, **6 aulas**,
171 válidas, progreso **1,39** y faltantes **−48**.

Tres cosas que la app no tiene:
1. **`PROGRESO` como ratio** y **`FALTANTES` en negativo cuando se sobrecumple**
   — hoy la app satura la brecha en cero y el sobrecumplimiento desaparece.
2. **`AULAS` por facultad junto a las válidas** → efectividad por facultad sale
   de dividir: 171 ÷ 6. Es **P26** servida en bandeja.
3. Meta y logrado **desglosados por sexo**, no sólo el total.

### 19 · «planilla» — producción por encuestador y por franja

Columnas: `N° · Apellido Paterno · Apellido Materno · Nombres completos` y luego
**tres bloques de franja horaria** —`7:00–9:00`, `9:01–19:00`, `19:01–22:00`—
cada uno con `N CURSO-HORARIO · APLICADOR · RANGO-HORARIO`.

Contesta **P13** (qué aplicador rinde más) y **P14** (a qué hora se recoge más),
las dos que marqué como inexistentes. Y `RANGO - HORARIO` es la MISMA columna
que aparece en la Base de control: el turno es un eje que cruza dos hojas.

### 12–17 · «aplicación del día N» — el recorrido diario

Cada día su hoja, con la agenda completa filtrada a esa fecha. Es **P1**, que la
app ya contesta con «A dónde ir cada día» — pero el Excel lo hacía **por día y
con el contacto del docente al lado**, que es lo que se lleva a campo.

## Lo que esto cambia

**Cinco de las 14 preguntas sin contestar ya estaban resueltas en el Excel** —
P13, P14, P26, P28 y parte de P29—, en hojas que la app nunca leyó. El diseño de
E2, E3 y E4 **no hay que inventarlo**: hay que leer estas cuatro hojas y decidir
qué se calcula en el motor.

**Y una diferencia de criterio, medida**: «Progreso General» conserva el
sobrecumplimiento (`−48` faltantes, progreso `1,39`) mientras la app satura la
brecha en cero. Las dos decisiones son defendibles, pero **no son la misma**, y
hoy nadie dice cuál usa el estudio.

---

# P22 resuelta: los tres VALIDADOR no son revisores, son motivos de descarte

Medido sobre las 194 filas de la «Base de control» del libro real. **Dos
identidades, sin una sola excepción:**

| Identidad | Se cumple en | Totales |
|---|---|---|
| `VALIDADOR 1 + 2 + 3 = TOTAL CORTAS` | **194 / 194** | 236 + 98 + 60 = **394** |
| `CORTAS + LARGAS = TOTAL ENVIADAS` | **194 / 194** | 394 + 3 304 = **3 698** |

De ahí sale la semántica, que no había que adivinar:

- Toda encuesta enviada es **corta** (descartada) o **larga** (válida).
- Toda corta cae por **exactamente uno** de tres validadores.
- **10,7 %** de las 3 698 encuestas se descartaron; **el 60 % de ellas por el
  validador 1**, el 25 % por el 2 y el 15 % por el 3.

Y la cabecera de grupo lo confirma: las tres viven bajo **`CONTROL - CUENTA`**,
junto a TOTAL ENVIADAS y TOTAL CORTAS/LARGAS, no en un grupo de supervisión.

**Lo que la app puede decir sin preguntar nada**: «de N encuestas, X se
descartaron por cortas; de ésas, tantas por cada validador». La lectura no
necesita saber cómo se llaman las reglas.

**PREGUNTA PARA GONZALO**: ¿qué regla es cada validador? Con el nombre, la
lectura pasa de «validador 1» a decir el motivo, que es lo que el analista
necesita para corregir el campo.

## El fixture violaba las dos identidades

Sembraba `validator_1 = i %% 2`, `validator_2 = 0` —**siempre cero**— y
`validator_3 = i %% 3` contra un `short_total = i %% 4` sin relación, y
`long_total` tampoco completaba las enviadas. Cualquier lectura construida sobre
eso habría sido falsa **y ninguna comprobación la habría pillado**, porque la
app no conocía la identidad.

Corregido con las proporciones del real (10,7 % de descarte, repartido 60/25/15)
y el tercer validador **por resta**, para que la identidad no dependa del
redondeo. Verificado en pantalla: **140 de 140** filas cumplen las dos.

**La lección**: un fixture que no respeta las identidades del dato real no es
«datos de prueba», es una fuente de conclusiones falsas. Es la decimoquinta vez
en esta serie que el fixture decide lo que se puede ver — y la primera en que lo
que enseñaba era directamente incoherente.

---

# CORRECCIÓN DE PREMISA (Gonzalo, 2026-08-18): la validez por aula no es un veredicto

Textual: «que una aula o la intervención de un curso-horario sea válido o no
válido es un valor que en el Excel se agregó, pero que **técnicamente no es algo
que nosotros verifiquemos**… no importa si cumple o no el 70 % de asistencia,
porque si es un aula con cien elegibles, no importa que sea el 50 o el 40 %,
igual son bastantes alumnos y hay que ir a aplicar». Y: «más que medir la validez
por curso-horario, **hay que medir el rendimiento y la efectividad**… no hay un
valor exacto para determinar que algo es válido o inválido; depende del criterio
del encuestador y del analista en el momento en que se aplique».

**Esto invalida una premisa que esta serie llevaba enshrined**: el 70T/70P
figuraba como «LA VARA» desde que él mismo lo explicó, y la matriz de umbrales
(`29fcab4c`) presentaba cuatro celdas con colores de acierto y fallo. Con esas
palabras, esas celdas se leían como **un veredicto de la app sobre cada aula**, y
no lo son.

**Lo reparado ya**: la matriz conserva las cuatro celdas —el equipo SÍ escribió
ese corte en su libro y hay que poder verlo— y declara de quién es y qué no
decide: «Es el corte que el equipo escribió en el libro, no un criterio que la
app verifique. No dice a qué aula conviene ir: un aula con 100 elegibles al 40 %
rinde 40 encuestas, y una con 20 al 70 % rinde 14».

**Lo que reordena hacia adelante**:

1. **El eje deja de ser válido/inválido y pasa a ser RENDIMIENTO.** La unidad
   útil son **encuestas conseguidas**, en absoluto y por unidad de esfuerzo, no
   un porcentaje contra un umbral.
2. **El tamaño manda sobre el porcentaje.** Un aula grande a media asistencia
   rinde más que una pequeña que «cumple». Cualquier orden de prioridad que use
   el % como criterio está mal ordenada.
3. **Sólo lo extremo es señal**: él menciona «una asistencia mínima del 20 %,
   que haya muy pocas personas». Eso es un aviso, **no un veredicto**.
4. **La decisión es del encuestador y del analista en el momento.** La app pone
   las cifras delante; no decide por ellos.

**Consecuencia para `VALIDO TOTAL` NO CUMPLE en 149 de 194**: deja de ser una
alarma. Es lo que el equipo anotó con un corte que él mismo describe como no
verificado. La pregunta abierta se cierra sola.

---

# P4 medida en el libro real: qué medio agenda mejor

Cruce `MEDIO DE CONTACTO` × `STATUS MUESTRA` sobre las 194 filas de «Aulas
Agendadas» del libro de 2025.

| Medio | n | Agendadas | Intentos (mediana) | p90 | máx |
|---|---|---|---|---|---|
| **Llamada** | 123 | 98 = **80 %** | **2,0** | 4 | 7 |
| **Correo electrónico** | 31 | 20 = **65 %** | **3,0** | 4 | 7 |

La llamada agenda mejor y con un intento menos de mediana. **Es una preferencia
leve, no una regla**: el correo agenda dos de cada tres.

## Una trampa del dato, y de las caras

La **media** de intentos del correo sale **19,65**. Es falsa: la columna
`NÚMERO DE INTENTOS` tiene **fechas de Excel filtradas** —45909, 23252— que
inflan la media nueve veces. Con los valores absurdos fuera, la mediana es 3.

Creerse el 19,65 llevaría a prohibir el correo; con 2 contra 3 la decisión es
«prefiere llamar cuando puedas». **La diferencia entre las dos lecturas es una
decisión operativa distinta**, y la separa una sola línea de filtrado.

De paso: la columna `MEDIO DE CONTACTO` también tiene basura —un `45909.0` y un
`-`— y la de estado un `45917.0`. Son 16 filas de 194 con algún campo corrido.

## El fixture no podía contestarla

Repartía 50/50 y daba **exactamente el mismo desenlace** a los dos medios: 13
reemplazadas, 80 agendadas y 5 en reserva cada uno. Cualquier vista habría
enseñado dos columnas idénticas. Sembrado ahora con la relación medida —llamada
mayoritaria, mejor tasa y un intento menos—. **Sexta vez esta noche.**
