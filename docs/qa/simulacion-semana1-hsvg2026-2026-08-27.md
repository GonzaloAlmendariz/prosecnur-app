# Simular la primera semana de HSVG2026 con el campo real de 2025

Tipo: Checklist de trabajo
Estado: Vigente
Fecha: 2026-08-27
Autoridad: Encargo de Gonzalo del 2026-08-27; las cuotas son las de 2026 y de 2025 sólo se toma el rendimiento de una primera semana. Gobiernan el ADR 0079 (cumplimiento contra la cuota) y el ADR 0082 (τ como supuesto declarado)

**Encargo de Gonzalo (2026-08-27)**: «inventar de forma temporal esta información
de una semana para poder poner a prueba todos nuestros casos», y luego, al ver la
primera corrida: «tiene el detalle de cada uno de los cursos-horario […] podemos
suponer: iremos a tales cursos-horario de nuestra selección a 2026 y nos irá de
esta forma. Y cómo eso se entiende dentro del monitoreo».

**Las cuotas son las de 2026.** Lo único que se toma de 2025 es *cómo rinde una
primera semana*.

## Cómo se calibra

Del libro real `Hostigamiento PUCP 2025_BD Aulas Agendadas-6.xlsx`, hoja «Base de
control», leída por índice porque siete columnas tienen datos y la cabecera
vacía. Validado contra cifras conocidas: **194 aulas**, 192 aplicadas,
1 741 mujeres + 1 563 hombres = **3 304 válidas** (las 3 303 del informe), campo
del **8/09 al 1/10 de 2025**.

| semana | aulas | población | válidas | efectividad | por aula |
|---|---|---|---|---|---|
| **1** | **86** | 2 756 | **1 520** | **55,2 %** | 17,7 |
| 2 | 68 | 2 121 | 1 062 | 50,1 % | 15,6 |
| 3 | 34 | 1 109 | 628 | 56,6 % | 18,5 |
| 4 | 4 | 176 | 56 | 31,8 % | 14,0 |

La semana 1 aplicó **86 de 192 aulas: el 45 % del operativo entero**. Su ritmo
diario fue 9 · 16 · 18 · 12 · 24 · 7 (lunes a sábado).

**Nivel y dispersión se separan a propósito.** El nivel es la τ de esa facultad
en la semana 1; la dispersión es un choque multiplicativo *agrupado* sobre las
192 aulas (`ef_aula / τ_de_su_facultad`), porque hay facultades con **una sola
aula** esa semana y su varianza propia no se puede estimar. La dispersión real
por aula es ancha: p10 = 0,31 · mediana = 0,59 · p90 = 0,93, y **tres aulas
pasaron de 1,0** (responde gente que no está en la lista).

## Qué saldría

Sobre las **174 titulares reales** de `HSVG26ULT.pulso`, mismo ritmo absoluto que
2025 → **78 aulas la primera semana**, 2 953 elegibles, **1 811 encuestas**,
efectividad **61,3 %**.

Proyectando el resto de las aulas de cada facultad a su propio rendimiento de esa
semana:

| Facultad | Cuota | Aulas | S1 | Enc. S1 | Al cerrar | % | |
|---|---|---|---|---|---|---|---|
| Letras y CC.HH. | 61 | 4 | 2 | 14 | 28 | **46 %** | no llega |
| Arte y Diseño | 372 | 15 | 7 | 101 | 216 | **58 %** | no llega |
| Educación | 67 | 3 | 1 | 13 | 39 | **58 %** | no llega |
| Ciencias Sociales | 389 | 12 | 5 | 103 | 247 | **64 %** | no llega |
| Gastronomía | 59 | 3 | 1 | 13 | 39 | **66 %** | no llega |
| CC. y Artes de la Comun. | 211 | 7 | 3 | 65 | 152 | **72 %** | no llega |
| Ciencias Contables | 48 | 3 | 1 | 12 | 36 | **75 %** | no llega |
| Artes Escénicas | 193 | 8 | 4 | 78 | 156 | **81 %** | no llega |
| Psicología | 204 | 6 | 3 | 85 | 170 | **83 %** | no llega |
| Gestión | 195 | 7 | 3 | 73 | 170 | 87 % | ajustado |
| Ciencias e Ingeniería | 665 | 37 | 17 | 306 | 666 | 100 % | llega |
| Arquitectura | 336 | 8 | 4 | 190 | 380 | 113 % | llega |
| Derecho | 489 | 19 | 8 | 243 | 577 | 118 % | llega |
| EE.GG. Letras | 426 | 20 | 9 | 285 | 633 | 149 % | llega |
| EE.GG. Ciencias | 335 | 22 | 10 | 230 | 506 | 151 % | llega |

**El hallazgo metodológico**: no es que el estudio vaya mal en total —cerraría
por encima—, es que **nueve de quince facultades no llegarían con sus titulares**
mientras cinco se pasan largo. Y las que no llegan son **las pequeñas**: las que
tienen 3, 4, 6 aulas, donde un aula floja no se compensa con nada. Ahí es donde
se activa reserva, y ahí es donde el seguimiento por facultad —no el global—
decide.

**Salvedad del modelo**: Psicología sale con efectividad 1,149 en la semana 1.
Es consecuencia legítima del choque agrupado sobre un pozo de 3 aulas (en 2025
hubo aulas por encima de 1,0), pero a nivel de facultad se lee raro. Con pozos
pequeños el modelo tiene esa cola.

## Cómo se ve en Monitoreo

El `.pulso` simulado (`sim/HSVG2026_semana1_simulada.pulso`, fuera del repo)
lleva las **1 512 filas reales** del plan —174 titulares + 1 259 de cadena + 79
de banco—, 78 partes, 78 filas de control y 1 811 respuestas individuales.
**Sin datos de contacto**: nombre, correo y teléfono del docente no viajan.

### Lo primero fue un defecto MÍO, no del producto

La pantalla mostró **«APLICADAS 0»** junto a «VÁLIDAS 1 811». No era la vista:
el KPI lee `operational_status` (`monitoreo_aulas_universitarias.R:1910`) y mi
generador sólo sembraba `sample_status`, así que las 1 512 caían al default
«planificada». Corregido, marca **78**. Es exactamente la trampa que este loop
lleva toda la sesión persiguiendo: **medir el generador antes que el producto**.

### Lo que sí es del producto

| # | Qué | Medido |
|---|---|---|
| **S1** | «1 307 de **25 922** respuestas que pide el plan · 5 %» | 25 922 = 3 150 (titulares) **+ 22 772 (las 1 259 reservas de cadena)**. Una reserva dormida no pide nada. La vara legítima es 3 150, o la cuota de 4 050. |
| **S2** | Dos metas en la misma pantalla | Arriba, 25 922. Cuatro bandas abajo, «Faltan 2 239 para la meta total de **4 050**». Factor **6** entre las dos, sin que nada lo diga. |
| **S3** | Decimales sobre personas | «1 306,3 cubren meta», «504,7 de más». |
| **S4** | «Cursos-horario vencidos sin aplicar» mide contra el reloj equivocado | Dice «al **27 de agosto**» con el estudio sincronizado al **12/09/2026**, y declara «los 174 con fecha están por delante del corte · 174 aún por venir» **con 78 ya aplicadas**. Usa `dashboard.generated_at` —cuándo se calculó el tablero— creyendo que es el corte del estudio. El comentario en `AulasMonitoreoPage.tsx:1572` dice «El día del corte y NO `new Date()`», y `generated_at` tiene el mismo defecto que `Date.now()` para un estudio reabierto: es justo lo que `alertaDeAnticipacion.ts:134` documenta y evita. **Dos capas, dos lecturas de la misma regla.** |
| **S5** | Los denominadores de «llegaron a su meta» y «brechas» | «43 de **1 433** cursos-horario con meta» y «brechas **1 390**»: mismo problema que S1, cuentan reservas. |

## Criterio C-F — procedencia: nada inventado, nada hardcodeado

**Encargo de Gonzalo (2026-08-27)**: «asegurarnos de que todo lo que se esté
mostrando depende del plan que se haya configurado en cálculo de muestra, depende
de la selección de aulas, depende de lo agendado. No es nada inventado, no es
nada hardcodeado. Eso es muy importante.»

**La maquinaria ya existe y está en uso**: `porQueEsaMeta.ts` reconstruye de dónde
sale la meta de un aula, y los KPIs llevan `hint`/`detalle` («declaradas en el
registro de campo», «respuestas de Kobo que pasan el filtro»). Un `grep` de
«procedencia» da 0 de 19 y **sería el séptimo conteo engañoso de la sesión**: el
campo no se llama así.

**El criterio real es más fino, y lo enuncia el propio `kpiConProcedencia.test.ts`**:

> «La pista de Monitoreo decía sólo QUÉ se cuenta —"titulares y sus reservas
> encadenadas"—, que resuelve un equívoco de denominador real y hay que
> conservar, pero **no de qué sorteo salen**. Con dos corridas en el mismo
> estudio, ésa es justo la pregunta.»

Así que C-F se audita en tres preguntas por cifra, y sólo la tercera está
mayormente sin responder:

1. **¿De qué se compone?** — el `hint` lo dice en casi todas.
2. **¿Sobre qué universo?** — es donde fallan S1 y S5: el universo incluye
   reservas que nadie pidió.
3. **¿De qué corrida del sorteo sale?** — sólo el KPI «Cursos-horario» estampa
   el `selection_run_id`. El resto no.

Barrido de defaults fabricados en el perfil: **tres**, y los tres legítimos
(`factorFacultad ?? 1`, `repeticiones ?? 1`, escala de eje). El perfil está
limpio en ese eje; donde falla es en el **universo** y en la **corrida**, no en
números inventados.

**Relacionado**: el `n_aulas: 30` que `classroomComparisonSelectorSnapshot`
fabricaba sí era invención —y está persistido en HSVG26ULT—; y el **165** que la
UI publica contra las **174** sorteadas es la misma familia vista desde Cálculo.

## Los reemplazos de 2025: qué se cayó, dónde, y qué lo anunciaba

**Encargo de Gonzalo**: «los reemplazos que hubieron, en qué facultades, a qué se
debió. Yo sé que no se sabe exactamente, pero podemos intuirlo».

Hoja «Aulas Agendadas», los **170 titulares** de Muestra 01:

| estado final | aulas | |
|---|---|---|
| AGENDADA | 119 | 70 % |
| **REEMPLAZADA** | **24** | 14,1 % |
| **EN RESERVA 1** | **19** | 11,2 % |
| REAGENDADA | 8 | 4,7 % |

**43 de 170 titulares (25 %) no se sostuvieron.**

### Dónde: en las pequeñas

| Facultad | titulares | no se sostuvieron | |
|---|---|---|---|
| Artes Escénicas | 7 | 4 | **57 %** |
| Gestión y Alta Dirección | 6 | 3 | **50 %** |
| Educación | 4 | 2 | **50 %** |
| Gastronomía | 2 | 1 | **50 %** |
| Arte y Diseño | 9 | 3 | 33 % |
| Ciencias e Ingeniería | 39 | 12 | 31 % |
| Derecho | 16 | 4 | 25 % |
| … | | | |
| Contables · Letras y CC.HH. · Psicología | 2 · 4 · 6 | 0 | 0 % |

**Y es el mismo grupo.** Las facultades donde más titulares se caen —Artes
Escénicas, Gestión, Educación, Gastronomía— son **las mismas** que la simulación
de la primera semana enseña que no llegarían a su cuota con sus titulares. Doble
castigo sobre las mismas: pocas aulas, y de esas pocas se cae la mitad.

### Qué lo anunciaba: la contactabilidad, no el motivo

Las 133 observaciones son sobre todo **coordinación logística** —a qué minuto de
la clase aplicar, confirmaciones—: sólo 26 mencionan «no responde» y 11 una
reprogramación. El motivo del reemplazo casi nunca está escrito.

Pero **sí hay señal, y está en el plan antes de que el aula se caiga**:

| señal | no se sostuvo | |
|---|---|---|
| observación menciona problema de contacto (apagado, equivocado, restringido, sin número) | 18 de 41 | **44 %** |
| sin ese problema | 25 de 129 | 19 % |
| | | **riesgo 2,3×** |

| gestiones | no se sostuvo | |
|---|---|---|
| 1 | 12 de 64 | 19 % |
| 2 | 7 de 41 | 17 % |
| **3** | 11 de 29 | **38 %** |
| **4–7** | 12 de 33 | **36 %** |

| medio de contacto | no se sostuvo |
|---|---|
| **ninguno anotado** | **14 de 14 · 100 %** |
| Correo electrónico | 24 % |
| Llamada | 17 % |

**La tercera gestión es el punto de quiebre**: hasta la segunda, una de cada
cinco se cae; desde la tercera, dos de cada cinco. Y las que no tienen por dónde
ser llamadas se cayeron todas.

### Lo que entra en el producto

`agendamiento.ts` ya leía `contact_attempts` y `contact_medium`, pero sólo para
**describir** (`conInsistencia`, `intentosMedianos`). Con la medición pasa a
**avisar**: dos tiles nuevos, **«Van por la tercera»** y **«Sin medio de
contacto»**, contados sólo sobre las que siguen sin fecha —una que costó cuatro
llamadas pero ya está agendada es una historia, no un pronóstico— y sin tocar
las reservas dormidas. La constante `UMBRAL_DE_RIESGO = 3` lleva la medición en
su comentario: **no es un umbral elegido**.

### Una nota sobre S1 que sale de aquí

La cabecera de `agendamiento.ts` documenta que ese módulo **ya sufrió y reparó
S1**: «contaba las 507 reservas encadenadas como aulas por agendar, así que el
KPI decía "0 de 700 que se van a visitar" al pie de una tabla de 193». Su
función `seVaAAgendar()` encierra la regla correcta —una reserva dormida no la
agenda nadie—. **La reparación de S1 es aplicar esa misma regla a la meta**, y
tiene precedente en el propio perfil.

## Lo que el proyecto simulado destapó en la sección de Agenda

Con `contact_attempts` y `contact_medium` sembrados con la distribución real de
2025 —64/41/29/17/4/8/4 gestiones y 123 llamada · 33 correo · **14 sin medio**—
y dejando sin fecha la misma proporción que 2025 (119 de 170 llegaron a
AGENDADA), la sección de Agenda enseña:

**Los dos avisos nuevos funcionan**: «VAN POR LA TERCERA · 29 · gestiones y
siguen sin fecha», en ámbar, junto a «Agendadas 145» y «Por agendar 29».

**S6 · La tabla afirmaba una contradicción sin señalarla.** 78 de 174 filas
decían **«Aplicada»** en «qué toca» y **«Sin contactar»** en status. La causa
está medida y documentada en `monitoreo_aulas_estados_no_reconocidos.R`: el
normalizador es una lista cerrada y las seis palabras reales —«aplicada»,
«contactada», «en campo», «cerrada», «parcial», «efectiva»— caen todas al
default. La consecuencia que ese módulo nombra es grave y es de otra sección:
**una reserva marcada «aplicada» se cuenta como reserva LIBRE** y la cola de
contacto la manda a llamar otra vez.

Reparado en la capa que muestra, no en el mapeo: `estadoDeMuestraLegible.ts`.
Verificado en pantalla: **78 marcadas, 0 sin señalar**. Abrir la lista cerrada
sigue pendiente y es decisión con su propio gate.

**Pendiente de mirar en esa misma pantalla** (medido, sin diagnosticar):

- «18 días de campo · de Lunes 07/09 a Viernes 25/09 · **355 sin fecha**» — el
  plan tiene 1 512 filas y 145 con fecha, así que sin fecha son 1 367. De dónde
  sale 355 no está claro.
- La leyenda dice «Agendada 96 · En cierre 78 · **En reserva 326**» y el
  proyecto tiene 1 338 reservas. Otro denominador recortado, misma familia que
  S1 y S5.

## Los tres denominadores recortados: no era una causa, eran dos

**Encargo de Gonzalo**: «mide los tres denominadores recortados juntos».

| cifra | cuánto debería ser | causa |
|---|---|---|
| «355 sin fecha» | 29 (el tile de al lado) | **recorte del payload** |
| «En reserva 326» | 1 338 | **recorte del payload** |
| «25 922 respuestas que pide el plan» | 3 150 o 4 050 | **universo equivocado** |

**Los dos primeros son la misma causa y se prueban con la aritmética**:
`course_status` viaja topeado a 500 filas (`MONITOREO_AULAS_COURSE_STATUS_TOPE`).
Los tres tramos de la leyenda —**96 + 78 + 326 = 500** exactos— y **500 − 145 con
fecha = 355**. Todo el panel dibuja 500 de 1 512 sin decirlo.

**El tercero no**: 25 922 = 3 150 (titulares) + 22 772 (las 1 259 reservas de
cadena). Ahí no falta nada, sobra: cuenta reservas dormidas como si el plan las
pidiera.

Reparado el primero declarando el recorte donde se leen sus cifras. El backend ya
publica `course_status_estados` y `course_status_cobertura` —su comentario dice
que son «los dos repartos que la vista sumaba sobre el payload recortado»— y
`AulasEstadoChart` ya los consume; migrar este panel repararía **el conteo** y no
sólo la afirmación.

## Las tres fuentes, semana 1 contra semana 2 (campo real de 2025)

**Encargo de Gonzalo**: «hay tres hojas del Excel que hay que revisar: la de
agendación, cómo va el campo, y la base de control».

### 1 · Agendación — para la semana 2 ya no se agendaba

Las llamadas corrieron del **2 al 16 de septiembre**; el campo arrancó el **8**.

| cuándo se llamó | llamadas | agendada | reserva | reagend. | **reemplazada** | no se sostuvo |
|---|---|---|---|---|---|---|
| **antes del campo** | 95 | 76 | 10 | 3 | 6 | **16 %** |
| **durante la semana 1** | 74 | 43 | 9 | 4 | **18** | **36 %** |
| semana 2 | **1** | — | — | 1 | — | — |

**Respuesta directa a la pregunta**: en la semana 2 **no se seguía agendando** —
una sola llamada. El esfuerzo se concentró en la semana previa al campo y en la
primera.

**Y el hallazgo nuevo**: un titular llamado **durante** el campo se cayó
**2,3 veces más** que uno llamado antes (36 % contra 16 %). Llamar tarde es en sí
un factor de riesgo, y se acumula con el umbral de la tercera gestión.

**Consecuencia para el producto**: `TASA_DE_CAIDA = 0.235` es un promedio global
que **esconde ese abanico**. La misma constante vale 0,16 para lo agendado con
antelación y 0,36 para lo agendado sobre la marcha.

**Lo que sí está bien calibrado**: `DIAS_DE_ANTICIPACION = 7` dice ser «la
mediana de los titulares, 2025» y la medición independiente da **exactamente 7**
(p10 = 2 · p90 = 13 · máx 21). Confirmado.

### 2 · Registro de campo — el ritmo y su caída

| semana | aulas | acum. | población | enviadas | válidas | efectividad |
|---|---|---|---|---|---|---|
| 1 | 86 | 86 | 2 756 | 1 666 | 1 520 | **55,2 %** |
| 2 | 68 | 154 | 2 121 | 1 217 | 1 062 | **50,1 %** |
| 3 | 36 | 190 | 1 179 | 754 | 666 | 56,5 % |
| 4 | 4 | 194 | 176 | 61 | 56 | 31,8 % |

La semana 2 aplica **21 % menos aulas** y rinde **5 puntos menos**. No es
agotamiento monótono —la 3 recupera— pero la 2 es el valle.

### 3 · Base de control — se llena entera y a tiempo

De las 190 aulas de las tres primeras semanas, **todas** traen reparto por sexo,
enviadas y asistentes. La base de control no va por detrás del campo.

**Lo que sí revela es una tercera tasa**: entre **enviadas** y **válidas** se
pierde el 9-13 %.

| semana | enviadas | válidas | pasa |
|---|---|---|---|
| 1 | 1 666 | 1 520 | 91 % |
| 2 | 1 217 | 1 062 | **87 %** |
| 3 | 754 | 666 | 88 % |

Es la cuarta cifra de la familia «cuántas encuestas hay»: **asistentes → enviadas
→ válidas → efectivas del parte**. Cada una tiene su denominador y las cuatro
conviven en el perfil.
