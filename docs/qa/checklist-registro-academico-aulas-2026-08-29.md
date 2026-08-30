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
