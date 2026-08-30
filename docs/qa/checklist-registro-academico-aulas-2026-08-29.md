# Checklist — registro académico y lectura no técnica de Monitoreo de aulas

Encargo de Gonzalo el 2026-08-29, al reanudar el loop. Nueve indicaciones. Se
dibuja **entero** cada vez que se menciona; sólo él lo da por terminado.

> «evaluar conceptualmente todos los elementos de cada una de las pestañas,
> evaluar si se pueden agregar dos pestañas más, solo sí y solo sí lo amerita,
> ver bien la lógica, ver bien qué se entienda bien en español las cosas, los
> conceptos, los términos que utilizas, tratar de no utilizar demasiadas jergas
> o no utilizar ninguna, dado que estamos en un contexto académico, validar que
> todos los gráficos se vean bien, se entiendan y que avance sirva como un
> mecanismo de revisión no técnica»

## Lo que cambia respecto del loop anterior

Las primeras 51 entradas cazaron **defectos de cifra**: un número que no era el
que su rótulo prometía. Este encargo cambia el criterio de aceptación: ahora una
superficie puede tener todas sus cifras correctas y **seguir sin pasar**, porque
el lector al que va dirigida —una autoridad universitaria, no un analista— no
puede reconstruir qué le están diciendo.

**La vara**: cada elemento de Avance tiene que poder leerlo alguien que no
participó en el diseño muestral. Si para entender una cifra hace falta saber qué
es un estrato, un τ o un *deff*, el elemento no pasa.

## Tabla

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| A | Comprobación visual de cada pestaña, no lectura de código | runner `ui-quick-check` + capturas | ◐ en curso |
| B | Registro académico en todo texto publicable | `monitoreo_aulas_etiquetas.R` + rótulos del perfil | ☐ |
| C | Evaluación conceptual de **cada elemento** de cada pestaña | inventario por pestaña, abajo | ☐ |
| D | ¿Faltan dos pestañas? Sólo si lo amerita | `modules.ts` + secciones del perfil | ☐ |
| E | Revisar la lógica de cada elemento | motores de `api/R/monitoreo_aulas_*.R` | ☐ |
| F | Que se entienda en español: conceptos y términos | todos los rótulos y pistas | ☐ |
| G | Sin jerga, o con la mínima indispensable | ídem | ☐ |
| H | Todos los gráficos se ven bien y se entienden | los seis gráficos del perfil | ☐ |
| I | **Avance como mecanismo de revisión no técnica** | sección `avance` completa | ☐ |

## Inventario de lo que hay que evaluar

Seis pestañas en Avance —`cuotas`, `resumen`, `estratos`, `rendimiento`,
`efectividad`, `salidas`— y trece en el resto del perfil. El inventario elemento
por elemento se va llenando conforme se miran.

## Registro de la evaluación

Se escribe abajo, una entrada por pestaña, con el elemento, el veredicto y la
frase exacta que lo delata.

---

### Vuelta 1 · Avance > Cuotas

Seis hallazgos, todos verificados en pantalla con `HSVG2026_sem15_como_2025`.

| Elemento | Decía | Dice | Por qué |
|---|---|---|---|
| Chip de procedencia | «cuota del diseño · τ 0,53» | «cuota del diseño · tasa de efectividad 53.0 %» | La letra griega sin definición. Cálculo de muestra ya había decidido «la tasa se nombra, no se escribe en griego»; Monitoreo se quedó con ella, así que el mismo número tenía dos presentaciones según el módulo |
| El mismo chip, sin tasa única | «τ —» | «tasa de efectividad sin valor único» | El guion no informaba. En `como_2025` es el caso real: las facultades tienen tasas distintas y el motor deja `NA` para no promediar a escondidas |
| Notación decimal | «88,1%» junto a «88.1 %» | «88.1 %» en las dos | Tres formateadores forzaban la coma española con `.replace(".", ",")`. `es-PE` usa **punto decimal y coma de millar**, así que la coma hacía de decimal en una tarjeta y de millar en la de al lado |
| «celda sexo × facultad» (8 sitios) | «de 30 celdas sexo × facultad» | «de 30 grupos de facultad y sexo» | Jerga de tabla estadística en la pantalla que lee una autoridad |
| Título del panel | «El avance que ve el cliente» | «Cuota asignada y encuestas logradas» | Nombraba al lector en tercera persona desde dentro del equipo, en la pantalla que ese lector abre |
| Cabeceras de columna | «La muestra que le toca» · «Lo que se lleva» | «Cuota asignada» · «Encuestas logradas» | Registro coloquial |
| Pista de Válidas | «respuestas de Kobo que pasan el filtro» | «respuestas de la plataforma que pasan los controles de validez» | «El filtro» no decía cuál; y la marca no se lee sin conocerla —además de volverse falsa en un estudio que recoja por SurveyMonkey |

**Lo que el guard de títulos evitó**: «Avance por facultad y sexo» era el nombre
natural para la tabla, y ya es el del gráfico de Estratos. El guard también
rechaza terminaciones iguales, así que «Cuánto lleva cada facultad» chocaba con
«Encuestas por día de cada facultad».

**Brecha cerrada**: `cifrasConFormato.test.ts` vigilaba cuentas pegadas a su
unidad —«aulas», «respuestas»— y por eso no podía ver un porcentaje. Se añadió
el guard de la coma forzada, que mide la operación y no necesita heurística.

### Vuelta 2 · «celda» estaba en nueve sitios más, y la búsqueda no los vio

La vuelta 1 declaró «cero "celda sexo × facultad"» y era cierto. **También era
incompleto**: se había buscado la frase larga, y quedaron vivos un subtítulo que
decía «30 celdas», la lectura «21 de 30 celdas cumplidas», la leyenda de la
pirámide, el vacío «Sin celdas de cuota que listar», «1 celda de cuota que hoy no
llega», «Misma celda: no concedes nada» y tres avisos de proyección.

**Se busca el término, no la frase.** Es la misma familia de error que las
«falsas ausencias» del loop anterior: la comprobación devuelve verde porque
preguntó por la forma exacta que ya se había corregido.

Título renombrado: «Cuota sexo por facultad» → **«Hombres y mujeres por
facultad»**. Es lo que el panel enfrenta, dicho sin vocabulario de tabla.

**El guard tardó tres intentos y el primero no servía**:

1. *Por línea* — cazaba la prop `{ celdas }` y los comentarios `{/* … */}`.
2. *Por literales entre comillas* — **daba verde con el defecto puesto**. La
   leyenda de la pirámide es texto plano de JSX, suelto entre etiquetas y sin
   una sola comilla, que es exactamente donde se había escapado.
3. *Por la palabra con su determinante* — «30 celdas», «esa celda», «Sin
   celdas». En prosa la palabra siempre lo lleva; en código, nunca.

La versión 3 encontró además **«esas celdas» en una rama que ninguna pantalla
mostraba**: sólo aparece si el plan declara un tercer valor de sexo, que
`como_2025` no tiene. Un guard sobre el fuente ve lo que una captura no puede.

Comprobado que muerde: verde con el código limpio → rojo al reintroducir el
término → verde al restaurar.

`AulasControlDelLibro.tsx` queda exento con su motivo: ahí «celda» es una celda
de hoja de cálculo de verdad, y es la palabra correcta.

### Vuelta 3 · Dos «Cumplimiento» que no decían en qué se diferencian

En la misma sección Avance, dos pestañas publicaban:

| Pestaña | Panel | Cifra |
|---|---|---|
| Cuotas | «Cumplimiento contra el diseño» | 2.668 de 2.500 = **106.7 %** |
| Resumen | «Cumplimiento en respuestas» | 2.336 de 3.227 = **72.4 %** |

**Las dos son correctas y parten de las mismas 2.668 respuestas.** Lo que cambia
es contra qué se miden y qué dejan fuera: Cuotas las cuenta todas contra la cuota
de alumnos del cálculo de muestra; Resumen topa cada aula en su meta, así que las
332 que sobran en aulas ya cumplidas no le suman. La aritmética lo confirma:
**2.336 + 332 = 2.668**.

El defecto no estaba en el cálculo sino en el nombre: «contra el diseño» y «en
respuestas» no separan nada —las dos se miden en respuestas—, así que quien pasa
de una pestaña a otra ve 106.7 % y 72.4 % y concluye, razonablemente, que una de
las dos está mal.

- «Cumplimiento contra el diseño» → **«Cumplimiento de la cuota del estudio»**
- «Cumplimiento en respuestas» → **«Cumplimiento aula por aula»**

### Un anglicismo que hacía de distinción

«Status de aplicación» → «Estado de aplicación», y con eso salió a la luz algo
que llevaba tiempo escondido: en `FIELD_LABELS` había **dos claves distintas**
—`application_status`, la columna que el equipo escribe en el parte, y
`application_state`, el estado que el motor deriva del avance— y **se distinguían
sólo porque una decía «Status» y la otra «Estado»**. Un anglicismo haciendo de
distinción, que no le dice nada a quien lee. Al traducirlo quedaron homónimas y
ningún test se puso rojo.

Ahora cada una nombra su fuente, que es el criterio con que telefónico separó
«Declaradas efectivas» de «Efectivas Kobo»:

- `application_status` → «Estado declarado en el parte»
- `application_state` → «Estado según el avance»

Censo del glosario: **153 entradas, una sola pareja repetida** —la que el propio
cambio creó—, así que el guard nuevo arranca sin deuda. Verificado que muerde:
verde → rojo al reintroducir la colisión → verde al restaurar.

### Vuelta 4 · «Cerrada» y «Faltan 17» en la misma fila

El hallazgo más grave de la sección, y no era de redacción.

El chip de veredicto se decidía con `avance >= 1` —el cociente de los **totales**
de la facultad, que compensa un sexo con el otro— mientras la columna «Faltan»,
en la misma fila, ya sumaba el déficit de cada sexo por separado. Con las dos
reglas conviviendo, la tabla que va al cliente, al PDF y al libro daba tres
facultades por cerradas teniéndolas abiertas:

| Facultad | Chip | Cuota (M/H) | Lleva (M/H) | Avance | Faltan |
|---|---|---|---|---|---|
| Arquitectura | ~~Cerrada~~ | 125 (85/40) | 126 (68/58) | 100.8 % | **17** |
| Ciencias e Ing. | ~~Cerrada~~ | 528 (130/398) | 535 (141/394) | 101.3 % | **4** |
| Educación | ~~Cerrada~~ | 24 (20/4) | 33 (32/1) | 137.5 % | **3** |

A Arquitectura le faltan 17 mujeres y le sobran 18 hombres. Va justo contra el
encargo: «lo que me interesa es que TODAS LAS FACULTADES CUMPLAN CON SU CUOTA DE
SEXO. Ese es lo fundamental de todo esto» — y contra el ADR 0079, que la columna
«Faltan» sí respetaba.

**El veredicto se decide ahora con lo que falta**, y el umbral de «le falta poco»
se mide sobre el hueco y no sobre el avance: un 100.8 % no dice si lo que queda
son 4 personas o 17. Los nombres pasan además a hablar de la **cuota** y no de la
facultad —«Abierta»/«Cerrada» se leían como si la facultad estuviese cerrada
administrativamente—: **Cuota cumplida · Le falta poco · Cuota pendiente**.

En pantalla: Arquitectura y Educación pasan a «Cuota pendiente», Ciencias e
Ingeniería a «Le falta poco», y **ninguna fila dice «cumplida» con gente
faltando**.

**El veredicto no tenía un solo test.** Los siete de este archivo cubrían la
construcción de las filas, no el chip; por eso un cambio de lógica de este
calibre pasó el gate en verde a la primera. Ahora tiene tres, con el caso real
de Arquitectura y un control de que el chip se pinta —sin él, «no contiene Cuota
cumplida» pasaría también con un chip que no apareciera nunca—. Comprobado que
muerde: rojo al devolver el criterio viejo.

### Vuelta 5 · Una tarjeta que no decía de qué

«APLICADAS 152» estaba en una banda donde la tarjeta vecina, «VÁLIDAS 2,668»,
cuenta **personas**. Quien no diseñó el estudio compara 152 con 2.668 sin nada
que le avise de que son cursos-horario contra encuestas. Pasa a **«Cursos-horario
aplicados»**, que es el nombre con que el glosario de columnas ya traducía ese
mismo dato (`aulas_aplicadas`), así que la tarjeta y la tabla lo llaman igual.

**El renombrado debilitaba un guard, y eso se dice en vez de callarlo.** Mientras
el KPI se llamó «Aplicadas» a secas, la comparación de cadena completa del guard
de rótulos impedía además que un tramo se llamara «Aplicada» —el defecto que lo
hizo nacer: `en_aplicacion` significa *tiene respuestas pero todavía no es
aplicada ni cerrada*, o sea EN CURSO—. Con la unidad en el rótulo, esa
protección deja de venir sola. Se reafirma con un contrato propio sobre el tramo
que falló de verdad, en lugar de inventar un guard más listo que nadie ha
necesitado. Comprobado que muerde.

Geometría verificada tras el cambio: el rótulo pasa a dos líneas y la banda
conserva su marco — 12 grupos, 0 incidencias, 0 desbordes, a 1440×1000 y
1280×720.

**Sintaxis del runner para reusar una pila viva** (costó una corrida
descubrirla): `--url http://127.0.0.1:PUERTO/ --api real --api-url
http://127.0.0.1:PUERTO_API`. `--api` es un MODO (`auto` / `stub` / `real`), no
una URL.

### Vuelta 6 · La reparación no había llegado a la tabla

En Avance > Resumen, el mismo recorte del payload se declaraba de dos maneras en
la misma pantalla:

- «Estado de aplicación» y «Cursos-horario por cobertura» → «se ven **500 de
  1,424** cursos-horario»
- «Avance por curso-horario» (la tabla) → «**500 filas**»

Y la nota del primero dice, textual, para qué se creó ese contador: «el motor
manda 500 filas de las 2 615 del plan, y **sin decirlo la pantalla afirmaba que
el estudio tiene 500 aulas**». La reparación se aplicó a los dos gráficos y no a
la tabla — que es donde más pesa, porque una tabla se lee como un censo: quien la
recorre hasta el final cree haber visto el plan entero, y ha visto un tercio.

En Consultas había otro «98 filas», pero ése **no escondía un recorte**: coincide
con el KPI «Brechas» de la banda —98 y 98—, comprobado en pantalla. Ahí «filas»
sólo fallaba en no nombrar la unidad.

Guard: ningún panel del perfil puede resumir su contenido con «filas». No puede
comprobar el recorte —eso no se lee del fuente— pero sí que el subtítulo nombre
lo que hay dentro, que es lo que fuerza a usar `contadorDeCursosHorario` cuando
el payload viene cortado. Verificado que muerde.

### Vuelta 7 · «Brechas» no decía brecha de qué

La banda de Avance ponía juntas dos cifras de «lo que falta» en unidades
distintas y sin decirlo:

- «CUOTA POR RECOGER **170**» · 90 hombres · 80 mujeres → **personas**
- «BRECHAS **98**» · cursos-horario en 15 facultades → **cursos-horario**

Son dos ejes, no dos cuentas del mismo hueco: 170 son alumnos que faltan para la
cuota del estudio; 98, cursos-horario que no llegaron a su propia meta
(`sum(tracked_df$brecha > 0)`, `monitoreo_aulas_universitarias.R:2342`). Pasa a
**«Cursos-horario bajo su meta»**.

Con el nombre completo la banda se vuelve aritméticamente legible: **76
«Llegaron a su meta» + 98 «bajo su meta» = 174 «cursos-horario con meta»**, que
es el denominador que la propia tarjeta vecina declara. Antes esa relación no se
podía ver.

La pista sin desglose decía «cursos-horario por debajo de su meta»; ahora dice
«sin el desglose por facultad», porque `course_status` puede llegar recortado y
negar el reparto contradiría al número grande, que sigue diciendo 98.

**`brechasKpi` tampoco tenía un solo test** —el renombrado pasó el gate en verde,
igual que el veredicto de la vuelta 4—. Ahora tiene tres, verificados en los dos
sentidos.

### Un `equal-frame-drift` que NO es de esta tanda

A 1024×600 la banda se parte en dos filas y las tres de arriba miden 97 px contra
84.5 las de abajo: **C2 roto, delta 12.5 px con tolerancia 2**. Lo destapó el
runner al comprobar mis rótulos largos, así que medí el mismo viewport con los
cambios en `stash`: **las alturas son idénticas antes y después**, o sea que es
preexistente y no lo causaron los rótulos.

Queda como trabajo propio, con su vecino: un `capacity-drift` en «Cursos-horario
vencidos sin aplicar», que aparece en los tres viewports.

### Vuelta 8 · La banda igualaba columnas, no filas (C2)

`equal-frame-drift` en `monitoring-aulas-kpis` a 1024×600: **[97, 97, 97, 84.5,
84.5, 84.5]**, delta 12.5 px con tolerancia 2.

El mecanismo: a ≤1180 px la banda pasa a `repeat(3, minmax(0, 1fr))`, o sea tres
columnas y **dos filas**. En Grid cada fila crece con su propio contenido, y las
pistas de arriba envuelven a más líneas que las de abajo. El comentario del CSS
afirmaba lo contrario —«el marco lo comparten las seis tarjetas, así que crece
parejo (C2)»—, y **es cierto sólo mientras hay una sola fila**.

Reparado con `grid-auto-rows: 1fr` en la regla base de la banda, así vale también
para el reparto de dos columnas con cuatro tarjetas. El sobrante queda dentro de
la tarjeta, bajo su pista: capacidad legítima de un grupo de pares (C3), no
contenido estirado — las tres filas internas de `.aulas-kpi` siguen siendo
`auto`.

Medido antes y después en la misma corrida: **1 `equal-frame-drift` → 0**.

### El `capacity-drift` que queda, caracterizado

Persiste en los tres viewports, sobre «Cursos-horario vencidos sin aplicar», y
señala **4 px de alto interior sin usar en su `.mon-profile-panel-head`**.

Es la trampa que el propio contrato documenta: «declarar el grupo en el `section`
en vez del wrapper de datos hace que 3–4 px de padding de encabezado se lean como
capacidad inflada». El componente del panel (`AulasFrenteDelOperativo`) **sí**
declara su `capacity="owned"` en el contenedor de datos, como los otros noventa
del perfil; lo que el detector coge es el encabezado, que es hermano.

**No se toca por 4 px sin entender el detector**, porque la declaración es del
grupo entero y cambiarla afecta a todos los paneles de Avance. Queda pendiente
con su diagnóstico, no cerrado en falso.

### Vuelta 9 · Un aviso de recorte que había caducado

Los dos gráficos de Resumen llevaban el subtítulo «se ven **500** de 1,424
cursos-horario», y medido en pantalla **los seis tramos de «Estado de aplicación»
suman exactamente 1.424**. El aviso era falso: quien lo leía creía que le faltaba
el 65 % de lo que estaba viendo.

La causa la dice el propio código, en el tipo de la prop que ambos reciben: *«el
reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan»*. El
aviso fue correcto mientras el gráfico repartía `filas`, y **se quedó escrito
cuando pasó a preferir el resumen del motor** — una salvedad que caducó.

Ahora el subtítulo distingue las dos causas, porque el gráfico todavía cae a las
filas recortadas si el motor no manda su reparto:

- con reparto del motor → «**1,424 cursos-horario**»
- sin él → «se ven 500 de 1,424 cursos-horario»

La tabla conserva el aviso de recorte: es el único de los tres que sí pinta las
500. En pantalla, los dos gráficos declaran 1.424 y sus tramos suman 1.424.

**De paso, una sospecha descartada midiendo.** «Vencidos sin aplicar» dice 131 +
1.216 = 1.347 sobre un plan de 1.424, y los 77 que faltaban parecían un hueco sin
explicar. El pie del panel vecino los nombra: son las reservas del banco. No se
escribió nada hasta comprobarlo.

**Y el test se sondeó antes de escribirlo.** La primera versión afirmaba que el
gráfico publica 269 —la suma del resumen— y salió roja: descuenta las 70 del
banco y publica **199 en juego**. Comprobado imprimiendo el render en vez de
deducirlo, con un control en el caso contrario (2, las filas que viajan) para que
la aserción distinga de dónde sale la cifra.

### Vuelta 10 · «Meta» y «cuota» no son lo mismo, y el panel las mezclaba

«Dónde falta más» se rotula «contra la **cuota** del estudio, por sexo» y su
lectura decía «15 facultades · 9 con su **meta** cumplida». En este perfil son
dos denominadores distintos: la meta es por curso-horario y suma 3.227; la cuota
es por facultad y sexo y suma 2.500.

No era sólo una palabra mal puesta: **el panel mide contra una vara u otra según
la rama**. Con el bloque del motor mide contra la cuota —su docstring en R lo
titula «Avance por facultad y sexo contra la cuota del diseño» y sale de
`design_targets`— y sin él cae al cálculo local, que mide contra la meta del plan
(`expected_valid`), como declara la cabecera de su propio módulo. La frase fija
era exacta en una rama e incorrecta en la otra.

Cuál manda está comprobado en las dos puntas: por el motor, y en pantalla, donde
Ciencias Sociales da **63.1 % y faltan 55** tanto en este panel como en la
pestaña de Cuotas. Ahora la palabra sigue a la vara, con test que lo fija en los
dos casos y un control en el contrario.

**Lo que sí cuadraba**, comprobado antes de tocar nada: 28 + 27 = 55 y 10 + 38 =
48 en las filas; 9 cumplidas + 6 con déficit = 15 facultades, coherente con el
«Faltan 170 repartidos en 6 facultades» de Cuotas; y en «Ritmo de la
recolección», 2.668 respuestas en 11 días = 243 al día.

### Vuelta 11 · Avance > Estratos

La pestaña tiene el gráfico «Avance por facultad y sexo» y, debajo, la tabla de
los 72 estratos del sorteo.

**Lo que ya estaba bien**, comprobado antes de tocar: la tabla cuadra en las
cuatro filas verificadas —291 válidas + 147 de brecha = 438 de meta, y 291/438 =
66.4 %, que es lo que publica «% Avance de respuestas» en esa misma fila; 15 de
17 cursos-horario = 88.2 %—. Y el gráfico ya reparte por facultad × sexo **del
alumno** y no por el estrato del sorteo, que fue lo que Gonzalo pidió: «cómo vas
a poner mayoría hombres o mayoría mujeres cuando eso no me interesa; lo que me
interesa es cuántos hombres y cuántas mujeres». El estrato se conserva sólo en la
tabla de abajo, y el subtítulo lo declara: «72 estratos de diseño abajo».

**Lo corregido**: la columna «Brecha». Son **respuestas** que faltan —lo prueba
la aritmética de arriba— y la misma palabra contaba cursos-horario en la banda de
Avance, donde la tarjeta ya pasó a llamarse «Cursos-horario bajo su meta». Ahora
dice «Respuestas que faltan», y con eso la fila se explica sola: válidas + faltan
= meta, y su cociente es el porcentaje de al lado.

Anotado sin cambiar: la pestaña se llama «Estratos» y su primer panel es el
gráfico por facultad y sexo, que no es de estratos. El subtítulo lo salva
—«72 estratos de diseño abajo»— y el nombre de la pestaña pertenece al contrato
de navegación, así que no se toca desde aquí.

### Vuelta 12 · Cuatro paneles con las mismas columnas y sólo uno las explicaba

En Avance > Rendimiento, cuatro paneles comparten la misma tabla —«Qué está
rindiendo más», «Quién consigue más», «Franja horaria del operativo» y «Día de la
semana»— con las columnas **Por visita · Ajustado · De los asistentes · Del
potencial**. Dos de ellas no dicen qué miden por su nombre.

El pie las define bien, pero llega con `explicaLasColumnas={false}` en tres de los
cuatro para no repetir el mismo párrafo cuatro veces. Comprobado en pantalla:
**uno con leyenda, tres sin ella**. Quien abre «Quién consigue más» sin haber
leído antes el pie del otro panel ve dos columnas mudas.

Repetir el párrafo sería el mismo ruido que se quiso evitar, así que la
definición se ató al `title` de cada cabecera —que es como el perfil ya resuelve
el detalle de los KPIs— y viaja con la columna en los cuatro. El pie visible se
conserva donde estaba. Verificado en pantalla: las cuatro cabeceras llevan su
definición en los cuatro paneles.

Guard sobre el fuente, porque en un render de un solo panel no se distingue el
que lleva pie del que no. Comprobado que muerde.

**Lo que cuadró y no se tocó**: «Se cae 12 % de los titulares (18 de 152 ya
resueltos)» → 18/152 = 11.8 % ✓. Y los dos paneles vecinos que ponen a DERECHO
arriba y a LETRAS abajo miden cosas distintas —esperadas contra conseguidas— y
sus subtítulos ya lo distinguen: «y lo que cabe esperar» frente a «encuestas del
parte».

Anotado sin cambiar: «Franja horaria del operativo» dice «Todo el trabajo está en
Sin hora», o sea que el estudio no trae la hora. El vacío está declarado, pero el
panel ocupa una caja entera para decir que no hay dato — triaje C5 pendiente.

### Vuelta 13 · Dos palabras para la unidad del estudio

En Avance > Rendimiento, **35 frases decían «aulas» y 2 «cursos-horario»**; en
Resumen y Estratos era al revés. No son sinónimos: el ADR 0060 fija que «cada vez
que el operativo **visita un curso-horario** se produce un encuentro con cada
estudiante matriculado en él», y un aula física puede albergar varios
cursos-horario.

El repo ya había tomado la decisión —el ADR 0057 documenta la unificación «aula»
→ «curso-horario» en el motor— y advierte contra automatizarla:

> «El mismo término puede ser correcto en una frase e incorrecto en la de al
> lado… Un find-replace la habría convertido en una frase falsa. Los barridos de
> vocabulario se revisan frase por frase.»

Así que se revisaron una a una las **16 frases** con el sentido inequívoco de *lo
que el operativo visita*: los dos subtítulos de panel, la lectura de la tabla de
rendimiento, su fila, el `title` de «Por visita», el pie, la serie del acumulado,
las tres del pronóstico de cierre y las tres de la tabla del cliente —donde
«Aulas aplicadas» era el mismo dato que la banda ya llama «Cursos-horario
aplicados»—. Quedan sin tocar las de Efectividad, que se revisarán con esa
pestaña.

**El defecto lo cometí yo y lo cazó la pantalla.** El pronóstico tiene **dos
ramas** del mismo párrafo —una con variación entre días y otra sin ella— y el
primer barrido cambió sólo la primera, que no es la que se muestra. Es el mismo
patrón que vengo persiguiendo, y la comprobación en pantalla lo destapó: de 35
menciones a 2, luego a 1, luego a 0.

**Lo que cuadró**: 1.347 − 152 = 1.195 ✓ · 132 en 6 días = 22/día ✓ · 18
reemplazados coincide con el tramo «Reemplazada 18» de Resumen ✓ · y la
proyección al 28/12 se reproduce: 1.195 ÷ 14 por día ≈ 85 días de campo, que a
seis días por semana desde el 18/09 caen el 27–28/12 ✓.

Geometría tras el cambio, con rótulos más largos: **24 grupos, 0 incidencias, 0
desbordes** a 1440×1000 y 1024×600.

### Vuelta 14 · Avance > Efectividad

**El panel está bien construido**, comprobado antes de tocarlo: sumadas sus
quince filas dan **2.668 respuestas sobre 5.356 alumnos = 49.8 %**, exactamente
lo que declara su cabecera, y sus cursos-horario suman **152**. Cada fila también
cuadra (355/1.010 = 35.2 %, 92/138 = 66.7 %, 126/246 = 51.2 %). Y su pie explica
«± pts» sin jerga: «cuánto puede moverse todavía el porcentaje con los
cursos-horario que lleva: cuantos menos, más grande».

Aquí sólo tocaba cerrar el barrido de vocabulario: **catorce frases** revisadas
una a una. Dos de ellas eran otra vez **las dos ramas del mismo párrafo**, que es
ya la quinta aparición del patrón.

**Y el barrido destapó un desborde que estaba latente.** «19 cursos-horario
aplicados» es más largo que «19 aulas aplicadas», y el panel pasó de **1
`overflow-x` a 9**. Medido con los cambios en `stash` para separar lo mío de lo
que ya había.

La causa no era la longitud sino un `white-space: nowrap` heredado del botón de
foco: con `nowrap`, el `overflow-wrap: anywhere` del contenedor **no llega a
aplicarse nunca**. La línea de detalle envuelve ahora, que es la reparación que
el contrato admite —es dato operativo y no se recorta ni se le baja el cuerpo—.

Resultado: **de 9 a 0**, incluida la incidencia que ya existía antes del cambio.

### Vuelta 15 · Avance > Salidas · «meta 2.500» y «meta 3.227» a una pestaña

Primero, una corrección de mi propia sonda: leí «pestaña vacía» porque buscaba
`.mon-profile-panel` y Salidas no usa esa clase. Tiene contenido; el error era de
la medición, no de la app.

**El defecto real**: la tarjeta «Válidas» rotulaba «**meta 2,500**» mientras
Avance > Resumen rotula «**meta 3,227** · suma de metas por curso-horario». Dos
cifras distintas bajo la misma palabra, a una pestaña de distancia.

El número es correcto y el nombre mentía: el motor toma esa cifra de
`avance_cuota$total$cuota` y lo dice en su propio comentario —«es el denominador
global de `avance_cuota`: **la cuota del diseño vigente**»—. O sea, 2.500 es la
cuota, no la meta.

La tarjeta vive en `features/monitoreo/salidas/`, **compartida con territorial y
acreditación**, donde «meta» sí es correcto. Por eso no se renombró para todos:
el contrato del corte gana un `metaEtiqueta` que cada perfil declara, con «meta»
por defecto, y sólo `corteAulas` —que es del perfil— dice «cuota».

Test en los dos sentidos, con el control que importa: si «cuota» se pusiera por
defecto en el contrato, la suite también se pone roja, porque afirma que
territorial y acreditación siguen diciendo «meta».

**Lo que ya estaba bien**: 2.817 − 2.668 = 149, y el salto lo declara como
«−149 · Respuestas fuera del filtro declarado para la aplicación en aula» ✓.
«Procesables 2.668» y «Válidas 2.668» coinciden porque no hay descarte entre esos
dos pasos, y el componente tiene una rama que lo explica cuando los tres granos
son iguales.

---

## Indicación D · ¿Se pueden agregar dos pestañas más?

> «evaluar si se pueden agregar dos pestañas más, **solo sí y solo sí lo
> amerita**»

**Respuesta: no lo amerita.** No como contenido nuevo. Lo que sí aparece medido
es un desequilibrio de reparto, que se resuelve moviendo y no añadiendo — y esa
decisión es del contrato de navegación, así que se deja planteada.

### Por qué no

**1. No hay contenido calculado esperando superficie.** El Contrato de Superficie
sólo autoriza añadir en un caso: C5 categoría 3, «el backend ya lo calcula y el
frontend no lo consume». Censados los **34 campos** que el motor publica en el
dashboard de aulas, **ninguno queda sin consumidor**. (El detector señaló
`criterio_aula`; comprobado, sí se consume, por `state.aulas_universitarias.
aula_valida` en vez de por el nombre del campo. Falso positivo del método, no
hueco de la app.)

**2. Las seis pestañas cubren las seis preguntas.**

| Pestaña | Qué contesta |
|---|---|
| Cuotas | ¿cuánto llevamos contra lo comprometido, por facultad y sexo? |
| Resumen | ¿cómo va el conjunto y a qué ritmo? |
| Estratos | ¿cómo se reparte contra el diseño del sorteo? |
| Rendimiento | ¿qué rinde, quién rinde y cuándo cerramos? |
| Efectividad | ¿el campo se comporta como supuso el modelo? |
| Salidas | ¿qué se puede entregar hoy y con qué corte? |

**3. Una pestaña que reagrupe lo que ya existe es duplicar navegación**, que la
casa prohíbe: «UI nueva se cuelga de una de las cinco dimensiones; nunca duplicar
la navegación de una dimensión en otra».

### Lo que sí está desequilibrado

Paneles por pestaña, contados sobre el fuente:

| Pestaña | Paneles |
|---|---|
| Rendimiento | **9** |
| Resumen | 7 |
| Cuotas | 3 |
| Estratos | 1 |
| Efectividad | 1 |
| Salidas | 1 |

Y dentro de Rendimiento conviven dos clases de panel: siete de **diagnóstico**
—qué rinde, quién, cuándo, y cuándo se cierra— y dos de **acción**: «A quién hay
que agendar» y «Consumo de la reserva», que son decisiones de reposición.

Si algo amerita, es **mover esos dos**, no crear contenido. Toca el contrato de
navegación y el registro de `modules.ts`, así que queda como decisión del dueño y
no se ejecuta desde el loop.

Anotado también: «Franja horaria del operativo» y «Día de la semana» son dos
paneles del mismo corte temporal y el primero está vacío en este estudio —el
triaje C5 de ese vacío sigue pendiente de ver `campo_flojo`—.

### Vuelta 16 · El barrido de vocabulario estaba más incompleto de lo que dije

**Corrección de mi propio reporte.** Al cerrar Rendimiento dije «de 35 menciones
a 0». Era cierto **en esa pantalla**, y da a entender algo que no es: medido
sobre el fuente del perfil entero, **quedan 93 frases con «aula» en prosa,
repartidas en 34 archivos** —21 sólo en `AulasSerieDeRendimiento.tsx`—. Lo
cerrado son las 30 frases visibles en Avance con el proyecto de referencia; el
resto vive en Fuentes, Agenda, Validación, Consultas y en ramas que `como_2025`
no activa.

No se cierran de una tanda, y el ADR 0057 prohíbe el atajo: «los barridos de
vocabulario se revisan frase por frase», con un caso vivo que lo justifica —«cinco
aulas con el rendimiento medio» describe unidades imaginarias de un cálculo, no
cursos-horario del plan—.

Así que queda un **ratchet**: `vocabularioDeLaUnidad.contract.test.ts` fija el
tope en 93 y sólo deja bajarlo. Su mensaje de fallo dice qué archivos acumulan
más y que, si vienes de cerrar frases, bajes el tope. Lleva el control de fixture
que este repo ya aprendió a exigir: si el contador diera cero, el tope pasaría
siempre. Verificado que muerde: 93 → 95 al introducir dos frases, rojo.

**Y una comprobación que salió limpia**: barridos los ternarios cuyas dos ramas
son frases casi iguales —la firma del patrón «una reparación llega a una rama y
no a la otra»—, los diez que hay son singular/plural u opuestos deliberados. El
patrón no tiene más casos vivos en el perfil.

---

## Segunda vuelta · `campo_flojo`

El simulacro con rendimiento bajo: mismos **152 cursos-horario aplicados** pero
**2.040 válidas** contra 2.668, y **34 llegaron a su meta** contra 76.

### Las reparaciones se sostienen con datos distintos

| Comprobación | `como_2025` | `campo_flojo` |
|---|---|---|
| «Llegaron a su meta» + «bajo su meta» = «con meta» | 76 + 98 = 174 ✓ | **34 + 140 = 174 ✓** |
| Filas «Cuota cumplida» con gente faltando | 0 ✓ | **0 ✓** (5 cumplidas, todas con «Faltan 0») |
| Filas de Efectividad contra su cabecera | 2.668/5.356 = 49.8 % ✓ | **2.040/5.356 = 38.1 % ✓** |
| Cursos-horario de las filas contra la banda | 152 ✓ | **152 ✓** |
| «Cuota por recoger» desglosada por sexo | 90 + 80 = 170 ✓ | **308 + 241 = 549 ✓** |

**Y activa una rama que `como_2025` no tenía**: el veredicto «**No cierra**», en 7
facultades, donde el otro simulacro sólo llegaba a «Puede no cerrar», «Justo» y
«Cubierta».

**Un falso verde propio, cazado a tiempo.** La primera comprobación de
contradicciones leyó la columna «Faltan» por un índice equivocado; con
`Number(undefined) > 0` siempre falso, **todas las filas habrían pasado**. Se
rehízo leyendo la última celda de cada fila, y ahí sí se ve que las cinco
cumplidas tienen 0.

### Cinco frases más de vocabulario

En la pantalla de Rendimiento quedaban tres subtítulos —«encuestas por aula,
según quién / cuándo / qué día se aplicó»— y dos lecturas de la tabla. Revisadas
una a una y cerradas: el ratchet baja de **93 a 88**.

No se toca «Cumplimiento aula por aula»: ahí «aula por aula» es locución
adverbial —una por una—, no un conteo de unidades. Es exactamente el caso que el
ADR 0057 pone como ejemplo de por qué no se automatiza.

### Triaje C5 de «Franja horaria del operativo»

`campo_flojo` también dice «Todo el trabajo está en Sin hora»: **dos de tres
simulacros sin hora**, y los tres derivan del mismo estudio. El panel declara su
vacío correctamente, que es lo que C5 exige; queda confirmar con `campo_malo` si
la categoría es 1 (el estudio no la trae) o 2 (deuda del fixture).

## Tercera vuelta · `campo_malo`, y el triaje C5 cerrado

El simulacro peor: mismos 152 cursos-horario aplicados y **1.538 válidas**.

### La escala completa, con las tres corridas

| | `como_2025` | `campo_flojo` | `campo_malo` |
|---|---|---|---|
| Válidas | 2.668 | 2.040 | **1.538** |
| Llegaron a su meta | 76 | 34 | **20** |
| Bajo su meta | 98 | 140 | **154** |
| **Suma = 174 con meta** | ✓ | ✓ | **✓** |
| Grupos que cierran (de 30) | 23 | 16 | **7** |
| Cuota por recoger | 170 | 549 | **974** |
| Desglose por sexo suma | ✓ | ✓ | **514 + 460 ✓** |
| Facultades con cuota cumplida | 9 | 5 | **1** |
| Filas «cumplida» con gente faltando | 0 | 0 | **0** |
| Media por curso-horario | 18 | 14 | **10** |
| Aulas por pedir | 14 en 5 fac. | 59 en 9 | **131 en 13** |

Las reparaciones de las quince vueltas anteriores **se sostienen en los tres
escenarios**, incluido el peor. Y en `campo_flojo` se comprobó además la identidad
del cumplimiento: **1.891 cubren meta + 149 de más = 2.040 válidas**, y **1.891 +
1.336 que faltan = 3.227 de meta**, con los «140 cursos-horario» de esa leyenda
coincidiendo con los de la banda — tres superficies diciendo lo mismo.

### C5 de «Franja horaria del operativo»: cerrado, no hay defecto

**Los tres simulacros dicen «Todo el trabajo está en Sin hora».** Es el estudio el
que no trae la hora de aplicación, no una carencia del fixture, y el panel lo
**declara** en vez de pintar una franja inventada o quedarse mudo. Eso es
exactamente lo que C5 pide de un vacío legítimo (categoría 1). Se cierra el
pendiente sin tocar nada.

### Tres frases más

`campo_malo` destapó «10 encuestas **por aula** de media del estudio», la lectura
principal de «Cómo rinde cada facultad, día a día». Sus **dos ramas** —la del
conjunto y la de una facultad elegida— más el aviso de «con tan pocas aulas».
Cerradas las tres; el ratchet baja de **88 a 86**.

---

## Popovers · el `popovers=0` era verde por ausencia

Todas las corridas del runner sobre este perfil reportaban `popovers=0`. Se leía
como «no hay popovers que revisar»; significa otra cosa.

El barrido busca disparadores por `aria-haspopup` y `aria-expanded`. Medido en
pantalla: **cero elementos del perfil declaran ninguno de los dos**. Y sí hay un
overlay real —`AulasPopoverReemplazo`, con `role="dialog"` y `aria-modal="true"`—
que abre el botón «Elegir reemplazo» del registro de campo.

**Reparado el contrato del disparador**: ahora declara `aria-haspopup="dialog"` y
`aria-expanded`. La ganancia es doble y la primera es la que más vale: un lector
de pantalla anunciaba ese botón como uno cualquiera, sin avisar de que abre un
diálogo modal ni de si ya está abierto.

**La cobertura del gate sigue pendiente, y se dice en vez de darla por buena.**
El disparador vive detrás de seleccionar un aula caída: en
`monitoreo/aulas/calidad/registro` no está en el DOM —comprobado, `hayBotonElegir:
false` y sólo tres botones, los del chrome—, así que el barrido automático no
llega a abrirlo. El camino es la dirección canónica con `?foco=aula:<código>`,
que el propio `RegistroDeCampo` documenta; queda anotado.

**El resto del perfil no tiene overlays**: censados los componentes con
`role="dialog"`, `aria-modal` o clase de overlay, el único es el de reemplazo.
`AulasFichaDeAula` parecía uno y no lo es —se monta en línea dentro de Calidad—.

### El popover, abierto y evaluado por primera vez

Para llegar a él hacen falta **tres pasos**, y por eso el barrido automático
nunca lo tocó: entrar en `calidad/registro`, seleccionar un curso-horario de la
lista de 1.347, y poner el formulario en un estado de caída —`sin_acceso`,
`cancelada` o `reemplazo_pendiente`— **con el aula siendo titular o reserva de
cadena** (`aulaPuedeReemplazarse`). Guionizado a mano, el contrato nuevo se
comporta como debe: el botón sale con `aria-haspopup="dialog"` y
`aria-expanded="false"`, y al pulsarlo pasa a **`true`** con el diálogo montado.

**El diálogo está bien construido** y no se toca: tiene nombre accesible
—«Reemplazar CH 43»—, da el contexto del curso-horario, separa los tres orígenes
de reserva, explica el criterio de orden —«el orden que fijó el sorteo; es la
guía: se sigue salvo que no sirva»— y **declara su tope**: «se muestran las 3
mejores de 5».

**Lo corregido**: sus porcentajes pegaban el signo al número —«se parece 100%»,
«cierra brecha 17%»— siendo el único sitio del perfil que lo hacía. Las otras
tres superficies con este mismo formato —la alerta de anticipación, el criterio
de aula y el propio registro de campo desde el que se abre este diálogo— lo
separan. Ahora también.

**No se toca el vocabulario del equipo**: «reservas al aire» y «bolsón extra» son
del operativo y esta superficie la usa el jefe de campo, no la autoridad que lee
Avance. Corregirlos sería el error que el ADR 0057 advierte, en su versión de
registro.

### Deuda de vocabulario · el componente que más acumulaba

`AulasSerieDeRendimiento.tsx` tenía **19 de las 86 frases** con «aula». Revisadas
una a una y cerradas 18; el ratchet baja de **86 a 68**.

**La que no se toca, y es la que da sentido a revisar en vez de reemplazar**: «la
tasa **del aula**». El motor llama así a otra cosa —la fracción de elegibles que
responde según el tamaño del salón—, y ese nombre ya costó una corrección
anterior, cuando la columna «Por aula» de rendimiento se renombró a «Por visita»
justamente porque eran «dos números distintos con el mismo nombre dentro del
mismo módulo». Un find-replace la habría destruido.

Dos frases se resistieron al primer intento por tener un salto de línea en medio,
y una de ellas resultó vivir en un `<title>` de SVG: texto publicable que leen el
navegador y el lector de pantalla, no un comentario. Cerradas las dos.

---

## Viewports pequeños · las seis pestañas a 1366×768, 1280×720 y 1024×600

Dieciocho capturas. **Cuatro pestañas limpias** —Cuotas, Estratos, Rendimiento y
Efectividad: `ok=true`, cero incidencias, cero desbordes—. Y el
`equal-frame-drift` de la banda que se reparó en `ba0a033e` **no reaparece a
1024×600**, que era el viewport donde vivía.

Las otras dos, medidas de verdad y no dadas por buenas:

**Resumen · 3 incidencias**, una por viewport. Reverificadas con salida propia
—el `report.json` se sobrescribe cuando varias corridas comparten carpeta, así
que el detalle del primer barrido se había perdido—: son las tres el
`capacity-drift` ya caracterizado de «Cursos-horario vencidos sin aplicar», con
4–5 px en su `.mon-profile-panel-head`. Nada nuevo.

**Salidas · 1 incidencia a 1024×600, y es un falso positivo del detector.** Un
`scroll-unreachable` que declara `atEnd: true` pero `lastContentReachable:
false`, con el «último contenido» en un `<small>` que dice «en 15 facultades» y
un `lastContentBottom` de **−252 px**: negativo, o sea por encima del viewport.
Ese `small` es la pista de un KPI de la banda, que está arriba del todo; el
detector lo eligió por orden de DOM y no por orden visual.

Comprobado en pantalla a 1024×600: **el contenido sí es alcanzable** — con el
scroll al final se lee «Validación y soporte · Opcional para revisión interna»,
que es el último bloque real. No se toca la app por un rojo que no corresponde a
un defecto, y se deja escrito para que no se persiga otra vez.

### Y cinco frases más de vocabulario

`AulasTrabajoDeLosEquipos.tsx`, incluidas **dos ramas del mismo párrafo**. El
ratchet baja a **64**.

De `aulasPresentation.ts` no se toca ninguna de sus cuatro, y por decisión: «Tasa
del aula» es el nombre que el motor da a otra cantidad, «Tamaño de aula» describe
el salón y «Peso del aula» es el término de ponderación. Revisar frase por frase
significa también dejar las que están bien.

---

## Sección Fuentes · «ya han entrado 174» contra «Cerraron con reemplazo 3»

Primera pasada por una de las cuatro secciones sin evaluar, y el primer método
—leer dos superficies vecinas— da un defecto de dos órdenes de magnitud.

El embudo «Del plan a las encuestas que cuentan» dice, sobre `campo_malo`:

- «174 titulares sorteados · **174 con reemplazo activado**»
- «Las reservas… entran sólo cuando su titular se cae, y **ya han entrado 174**»

Y en Consultas > Reemplazos, la banda dice «**Cerraron con reemplazo 3**». El
tramo «Reemplazada» del estado de aplicación cuenta **18**.

**La causa está documentada en el propio repo**, en `kpisDeAulas.ts:684`:

> «El KPI `reemplazos_usados` del motor **NO sirve aquí**: cuenta reservas cuyo
> estado operativo ya no es "planificada", o sea depende del registro de campo, y
> con el registro vacío decía "0" mientras el panel de al lado decía "3 cerraron
> con un reemplazo".»

Se retiró de ese KPI y **sigue alimentando el embudo de Fuentes**
(`embudoDelOperativo.ts:66` y `:177`). Es, otra vez, una reparación que llegó a
un sitio y no al otro — el patrón que más ha dado en todo el loop.

**No se repara a la carrera, y por un motivo concreto**: hay tres cifras
candidatas y no son sinónimas —3 «cerraron con reemplazo» (la reserva alcanzó la
meta del titular), 18 «reemplazada» (el estado del aula) y 174
(`reemplazos_usados`)—. Sustituir una cifra engañosa por otra que tampoco
signifique «reemplazo activado» sería repetir el defecto con distinto número.
Queda medido y con el análisis hecho.

**Lo que sí cuadra en Fuentes**, comprobado: 174 + 1.173 reservas = 1.347, el
mismo denominador del pronóstico de cierre; los 77 que faltan hasta 1.424 son las
reservas del banco, que el panel vecino nombra. Y el embudo es exacto en sus
restas: 174 − 22 = 152 aplicadas, y 1.595 − 57 = 1.538 que cuentan.

### Reparado · el embudo hablaba con una cifra que cuenta otra cosa

`reemplazos_usados` está definido en el motor como reservas cuyo
`operational_status` ya salió del estado inicial —agendada, en campo, aplicada,
cerrada o parcial (`monitoreo_aulas_universitarias.R:2330`)—, o sea **reservas en
juego**, no titulares sustituidos. Por eso decía 174.

El embudo recibe ahora el conteo del tramo `reemplazada`, que es el estado del
**titular sustituido** y lo que la frase promete. En pantalla: «titulares
sorteados · **18** con reemplazo activado» y «ya han entrado **18**», coherente
con el tramo «Reemplazada 18» de Avance.

**Y el primer intento salió mal de una forma que vale registrar.** Conté el tramo
sobre `dashboard.agenda` con `estadoDeAplicacion()`: dio **0**, la frase entera
desapareció de la pantalla… **y el gate quedó verde** —typecheck en 0 y 2.464
tests—. `agenda` viaja recortada y sin el `application_state` que el motor
deriva; el bloque bueno es `course_status_estados`, el mismo que pinta los tramos
en Avance. Es el patrón que este loop lleva persiguiendo desde la vuelta 9
—confundir la fuente recortada con el reparto del motor— cometido esta vez por mí
y cazado sólo por mirar la pantalla.

Los dos tests del embudo llevan ahora el control que faltaba: se les pasa un
`reemplazos_usados: 174` en el payload junto al conteo real de 7, y afirman que
**el 174 no puede colarse**.

### Corrección · «agenda viaja recortada» era falso

En el commit anterior escribí, dentro del código, que el conteo dio 0 porque
«`agenda` viaja recortada y sin el `application_state` que el motor deriva». **La
primera mitad no es cierta** y la comprobación estaba a un grep:
`visitaComprometida.ts` ya lo decía —«`dashboard.agenda` es **el plan entero**»— y
el motor lo confirma: `agenda = .monitoreo_aulas_records(plan_df)`, sin filtro.

La causa real es sólo la segunda mitad: `application_state` se deriva **después y
sobre otro objeto** (`monitoreo_aulas_universitarias.R:1332`), así que no viaja
en `agenda` y el conteo salía 0.

El payload trae **tres cosas distintas**, y confundirlas es lo que costó el
intento fallido. Queda escrito en el sitio donde se necesita:

| bloque | alcance | estado derivado |
|---|---|---|
| `agenda` | el plan **entero** | **no** |
| `course_status` | recortado a **500** filas | sí |
| `course_status_estados` | reparto sobre **todas** | sí (agregado) |

Escribir una explicación a medias en el código es el mismo defecto que este loop
lleva quince vueltas persiguiendo en la UI: una superficie que declara algo que no
es lo que pasa. Vale igual para un comentario.
