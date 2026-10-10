# Checklist — registro académico y lectura no técnica de Monitoreo de aulas

Tipo: Checklist de encargo
Estado: En curso
Fecha: 2026-08-29
Autoridad: Encargo de Gonzalo; sólo él lo da por terminado

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
| A | Comprobación visual de cada pestaña, no lectura de código | runner `ui-quick-check` + capturas | ☑ **19/19 a 1440x1000** el 2026-08-31 sobre el `.pulso` de simulación de 15 días, más Efectividad en 1366x768 y 1024x600. Antes eran 16: faltaban `modelo/carga`, `modelo/facultad` y `avance/efectividad`. **Toda pestaña con gráfico exige `--post-click-wait-selector ".js-plotly-plot"`**: sin eso el runner da `ok=true issues=0` con el gráfico sin pintar, y por poco declaro roto Estratos, que estaba perfecto. El runner sigue sin detectar recorte por elipsis: eso lo encuentra el ojo |
| B | Registro académico en todo texto publicable | `monitoreo_aulas_etiquetas.R` + rótulos del perfil | ◐ ratchet de «aula» **de 93 a 13**, que es su suelo útil: las 13 restantes son la locución «aula por aula» y el aula como ESPACIO, donde la palabra está bien · guard de género con cuatro brazos · 5 listas atadas al motor |
| C | Evaluación conceptual de **cada elemento** de cada pestaña | inventario por pestaña, abajo | ☑ **barrida entera** en `fuentes`/`modelo`/`calidad`/`consultas`: rótulos, vacíos (30 frases), mapas de etiquetas (16 participios), etiquetas cortadas, saltos, tooltips, orden de tablas, pistas, cifras y los 12 componentes que dibujan. ~14 defectos sobre ~100 elementos |
| D | ¿Faltan dos pestañas? Sólo si lo amerita | `modules.ts` + secciones del perfil | ☑ **no lo amerita**: 39 de 39 claves del dashboard ya tienen consumidor |
| E | Revisar la lógica de cada elemento | motores de `api/R/monitoreo_aulas_*.R` | ◐ invariantes de cuota, calibración y `avance_cuota` cuadrando · 192 campos del payload con sólo 2 sin consumidor · pipeline `plan→seguidas→tracked_df` instrumentado · **1 divergencia real entre motor y pantalla** («reserva libre») · 6 defectos reparados y **3 preguntas abiertas** |
| F | Que se entienda en español: conceptos y términos | todos los rótulos y pistas | ☐ |
| G | Sin jerga, o con la mínima indispensable | ídem | ☐ |
| H | Todos los gráficos se ven bien y se entienden | los seis gráficos del perfil | ☑ los 22 de Avance (7 reparados) y los 12 de las otras secciones **sin defecto**; el embudo de Fuentes declara su cambio de unidad. El 2026-08-31 se comprobaron además con Plotly ya montado: el de estratos separa los tres tramos y la marca de cuota, y el de carga por aplicador dibuja las bandas que impiden atribuir a un equipo una diferencia que no se sostiene |
| I | **Avance como mecanismo de revisión no técnica** | sección `avance` completa | ◐ tres defectos de lectura reparados el 2026-08-31, todos del tipo «el número está bien y el rótulo miente»: la columna «Avance» no decía de qué total hablaba y convivía con «Cuota pendiente» en la misma fila (`b49333db`); el bloque de calidad mandaba a declarar quién recolecta con los 152 partes ya firmados (`9551aff0`); y el banco salía «S/D» en 12 facultades donde el dato es cero, lo que además impedía que se disparara nunca la única alerta que manda a Cálculo de muestra (`729a9fa1`). Falta el barrido de F y G sobre los rótulos de `avance` |
| K | Columnas de sexo por «mayoritario/minoritario» | `FIELD_LABELS` + ADR 0082 | ✅ **DECIDIDO 2026-08-31: columnas fijas de mujeres y hombres.** Textual: «las columnas de sexo del plan nos sirven para ver las cuotas por sexo de cada facultad; a nivel operativo no nos importa a qué segmentos pertenezca el aula, eso sólo es a nivel de la selección del aula». O sea: mayoritario/minoritario es vocabulario del SORTEO y no del operativo. ☑ **implementada** en `0045de1b`: las cuatro columnas salen de las tablas del operativo y el test fija además que donde el sexo SÍ decide se siga resolviendo a mujeres y hombres. El modelo no cambia, el ADR 0082 tampoco |
| L | Una «parcial» promete otra vez lo ya recogido | `monitoreo_aulas_calibracion.R` | ✅ **DECIDIDO 2026-08-31: la parcial CUENTA.** Textual: «en principio una aplicación en un aula que se cataloga como parcial sí cuenta». Entonces no se le sigue esperando aforo: debe liberar la cadena y contar como aplicada, igual que «cerrada», y su `previsto` deja de ser NA para que la celda se pueda calibrar. ☐ pendiente de implementar |
| M | Los 9 con estados en desacuerdo | `agendamiento.ts` + `monitoreo_aulas_en_juego.R` | ✅ **DECIDIDO 2026-08-31: manda lo operativo, y `sin_contactar` en un titular es un ERROR DE DATO.** Textual: «se supone que en las aulas titulares se agendan a primer momento antes del campo». Un titular agendado no puede estar sin contactar: la agenda es previa al campo por diseño. Los reemplazos y extras sí tienen procedimiento propio, y no es «ir así porque sí»: se mapea a cuál ir, se envía correo ese mismo día y **al día siguiente se llama** para agendar según lo que diga el docente. ☑ **implementada** en `d98bd6af`: el KPI pasa de «13 con cita · 9 sin contactar todavía» a «22 con cita · 9 sin actualizar en la muestra», y el aviso dice cuál manda en vez de dejar la elección al lector |
| J | **Separar meta / lo diseñado / el rendimiento**, y medir lo que falta SIEMPRE contra la meta | `avanceCuota.ts`, `cuotasResumen.ts`, `avance_sexo_facultad` | ☑ **cerrada**, cuatro piezas (`1d4b087a`, `d4da4407`, `89c54c7b` y una descartada por premisa falsa). Comprobado además que `brecha` suma 1 y `missing` 170: la que se mide contra la meta es `missing` |

## Los dos insumos para la capacitación del 2026-08-31

Ambos en `~/Desktop/prosecnur-demo/`. Ninguno se versiona: son artefactos.

**`HSVG2026-simulacion-15dias.pulso`** · 1,9 MB. Sale del corte real de la
semana 15 con dos cosas añadidas.

1. **Las metas del diseño.** Sin ellas la vigencia decía «El estudio importado
   no publica metas del diseño» y `tau_previsto` era **NA en las 15
   facultades**: la pestaña Efectividad existe para comparar diseño contra
   campo y no tenía contra qué. Se extraen del estudio de calc-muestra con
   `.monitoreo_aulas_metas_diseno()` y se sellan con `selection_run_id` /
   `frame_hash` de la selección real (`sel_aulas_20260827160944_f5c12730`,
   semilla 202). El sello es legítimo, no inventado: los 1.392 códigos de esa
   selección están todos en el plan.
2. **Rendimiento distinto por facultad**, para que se vean los tres casos a la
   vez. Se reescalan las respuestas reales de cada aula por un factor de su
   facultad: Estudios Generales Letras 0,72, Ciencias Sociales 0,88, Derecho
   1,12. Resultado: **2 por debajo, 2 por encima, 11 conformes**.

Trampa que costó dos intentos: **el parte de campo se reescala con las
respuestas, y vive en dos sitios.** La app lee
`monitoreo_config$aulas_universitarias$partes_campo`, no el del nivel superior.
Sin reescalarlo, «El parte contra la plataforma» pasaba de 92 descuadres a 98
con las diez peores TODAS de la facultad simulada peor y diferencias de +18:
parece un problema de datos de esa facultad y es artefacto. Reescalado queda en
**89 con máximo +4**, por debajo del corte real. `asistentes` no se toca: la
historia es que respondieron menos, no que fuera menos gente.

**`Guia-Monitoreo-cursos-horario.pdf`** · 7 páginas, sección por sección y
pestaña por pestaña, sin em-dash. Lleva la tabla de los tres casos con qué
hacer en cada uno, la fila de Educación como ejemplo de por qué un 137,5 % de
avance convive con «cuota pendiente», y por qué la señal la dispara la banda y
no el punto.

## Bloqueado: exige tu decisión, no lo reparo por mi cuenta

**K · Las columnas de sexo del plan se presentan como «mayoritario / minoritario».**

`FIELD_LABELS` rotula cuatro columnas que la tabla del plan SÍ pinta —comprobado
que `sex_top_*` no está en `COLUMNAS_DE_INFRAESTRUCTURA`, así que no se filtran—:

| Columna | Cabecera hoy | Qué trae la celda |
|---|---|---|
| `sex_top_1` | Sexo mayoritario | «F» o «M» |
| `sex_top_1_n` | Estudiantes del sexo mayoritario | el conteo |
| `sex_top_2` | Sexo minoritario | el otro |
| `sex_top_2_n` | Estudiantes del sexo minoritario | su conteo |

**Por qué lo levanto**: dijiste textual «cómo vas a poner mayoría hombres o mayoría
mujeres cuando eso no me interesa; lo que me interesa es cuántos hombres y cuántas
mujeres». Para leer cuántas mujeres hay en un curso-horario, hoy hay que cruzar
dos columnas y ver cuál de las dos dice «F». Y ya hay precedente de que esta
construcción se malinterpreta: `sub_a` es el sexo MÁS FRECUENTE y se leyó como
«mujeres», lo que invirtió una tabla de cuotas entera.

**Por qué NO lo toco**: `sex_top_1` no es sólo un rótulo. Es variable de
estratificación y de balanceo (ADR 0082, `balance_vars`), y el motor lo calcula
como `names(sex_tab)[1]`, la categoría más frecuente. Reordenarlo a columnas
fijas de mujeres y hombres es un cambio de modelo, no de presentación.

**Lo que sí está comprobado y juega a favor de poder hacerlo**: el motor de
Monitoreo YA resuelve `sex_top_1` a «F»/«M» para el avance de cuota
(`monitoreo_aulas_avance_cuota.R:90-95`) y el frontend hace lo mismo en
`candidatosDeReemplazo.ts:287`. El dato para presentar «Mujeres» y «Hombres» como
columnas fijas existe; falta decidir si se hace.

**La pregunta**: ¿quieres que la tabla del plan muestre columnas fijas de mujeres
y hombres en vez de mayoritario/minoritario? Si sí, es una vuelta con cambio en
el motor y en el ADR 0082, no un cambio de rótulo.

**L · Una aula «parcial» promete otra vez lo que ya recogió.**

Medido en R el 2026-08-30 con un aula que prometía 40 efectivas y una celda que
ya lleva 30 logradas:

| `operational_status` | `previsto` | `aporte_pendiente` | `proyeccion` |
|---|---|---|---|
| aplicada | 20 | 0 | 30 |
| cerrada | 20 | 0 | 30 |
| agendada | NA | 20 | 50 |
| **parcial** | **NA** | **20** | **50** |

Una «parcial» ya pasó por campo, y el motor la trata igual que a una «agendada»
que todavía no ha ido: le sigue esperando 20 efectivas. Además deja `previsto` en
NA, así que **esa celda no puede calibrarse**: la calibración es
`logrado / previsto` y sin previsto no hay razón que medir.

**Hoy no se manifiesta**: este estudio tiene 152 aplicada, 18 reemplazada, 22
agendada y 1.232 planificada, **ninguna parcial**. `kpis.aulas_parciales` existe y
vale 0.

**Por qué no lo reparo solo**: la respuesta depende de si una parcial se
reintenta. Si se reintenta, esperarle más es correcto y lo que falta es sólo el
`previsto`. Si no se reintenta, debería contar como aplicada —igual que
«cerrada», que sí se corrigió— porque lo que iba a dar ya lo dio.

**La pregunta**: cuando un curso-horario queda «parcial», ¿se vuelve a él?

**Y decide DOS sitios, no uno** (medido el 2026-08-30 cruzando las listas de los
dos lados): además del aporte pendiente, `ESTADOS_QUE_LIBERAN` en
`candidatosDeReemplazo.ts` resuelve si «su cadena ya se resolvió: alguien de ella
salió», y hoy son sólo `aplicada` y `cerrada`. El motor, contando reservas
gastadas, sí incluye `parcial`.

  · Si una parcial **se reintenta**: la cadena NO está resuelta, no debe liberarse
    —lo de hoy es correcto— y lo que falta es sólo el `previsto` de la
    calibración.
  · Si **no se reintenta**: debería liberar la cadena Y contar como aplicada,
    como ya hace «cerrada».

**M · Nueve curso-horario con los dos estados en desacuerdo.**

La tabla los listaba como bloqueados sin el material para decidir, que es lo que
convierte una decisión de dos minutos en otra sesión. Medido el 2026-08-31 sobre
la simulación de 15 días, cruzando los dos campos en los 174 titulares:

| `sample_status` (muestra) | `operational_status` (operativo) | Cuántos |
|---|---|---|
| agendada | aplicada | 134 |
| reemplazada | reemplazada | 18 |
| agendada | agendada | 13 |
| **sin_contactar** | **agendada** | **9** |

Los nueve son `CH 8, 12, 20, 24, 32, 38, 50, 58, 67`. Uno de los dos campos dice
que a ese curso-horario todavía no lo ha llamado nadie, y el otro que ya tiene
día y hora.

**Cuánto cuelga.** Los nueve suman **351 elegibles**, el **48 %** de los 727 que
quedan por aplicar (los otros 13, que sí concuerdan, suman 376). Y caen en las
tres facultades que peor van: Ciencias e Ingeniería 5, Estudios Generales
Ciencias 3, Estudios Generales Letras 1.

**Por qué importa cuál manda.** Los dos campos tienen consumidores distintos y
ninguno consulta al otro:

| Campo | Quién lo lee | Qué decide |
|---|---|---|
| `sample_status` | `monitoreo_aulas_en_juego.R`, `_reemplazos.R`, `_banco_extras.R` | Si la unidad está dormida, o sea si se puede activar como reemplazo |
| `operational_status` | `monitoreo_aulas_calibracion.R`, el KPI de aplicadas | Si ya pasó por campo |

Con `sin_contactar` mandando, esos nueve están **dormidos** y por tanto
disponibles para reemplazar a otro. Con `agendada` mandando, están comprometidos
y no se pueden tocar. Hoy conviven las dos lecturas: para la agenda están
agendados y para el motor de reemplazos siguen libres.

**La pregunta**: cuando los dos estados se contradicen, ¿cuál manda? Las dos
respuestas son defendibles y llevan a código distinto:

  · Manda **lo operativo** (`agendada`): alguien ya consiguió la cita y el campo
    de muestra se quedó sin actualizar. Entonces hay que dejar de ofrecerlos como
    reemplazo, porque activarlos pisaría una cita ya acordada.
  · Manda **la muestra** (`sin_contactar`): la cita es un dato viejo o un error
    de carga. Entonces siguen disponibles, y lo que falta es limpiar la agenda.

Lo que **no** es defendible es lo de hoy, que es responder las dos cosas según
quién pregunte. La app ya lo dice en Agenda con el indicador «Estados que se
contradicen», así que el conflicto está nombrado; falta resolverlo.

Ninguna de las tres se toca hasta que lo digas.

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

### Fuentes · el resto de la sección, y una falsa alarma mía

**Los tres chips de estado** —«Selección · Conectada», «Marco institucional ·
Registrado», «Metodología · Trazable»— parecían el caso de «Ajustado» otra vez:
tres palabras abstractas sin decir de qué. Medido en el panel del navegador, sus
pistas salían con **`display: none`**.

**No es un defecto.** Esa regla vive dentro de una media query para anchos
pequeños, con su motivo documentado —el grid se desbordaba 103 px y «Trazable»
quedaba debajo del botón «Importar plan», solapados 70×5—. A **1440 las tres
pistas se ven**: el id de la corrida de selección, el hash del padrón y «semilla,
cuotas y bitácora». Comprobado redimensionando.

El error era mío y de método: **medir en un viewport y concluir sobre todos**. El
panel del navegador es estrecho y disparaba la media query. Queda anotado junto a
las otras trampas de medición.

**Lo que sí quedó verificado de la sección**: el aviso de la fuente dice su causa
—«No se puede abrir en Kobo: la fuente no declara qué formulario es»—, el libro
declara su cobertura —«3 DE 3 HOJAS»— y sus cifras cuadran con el resto: 1.424
cursos-horario, 15 facultades, 174 titulares.

**Anotado sin resolver**: el libro dice «152 partes de campo · **304** filas de
control», y 304 es exactamente el doble. En `como_2025` eran 152 y 152. Puede ser
el grano propio de la Base de control —dos filas por curso-horario— o un
duplicado del simulacro; no se afirma ninguna de las dos sin medirlo.

## Sección Agenda (`modelo/agenda`)

**Lo corregido**: «Cuánto cuesta cerrar un aula» → «Cuánto cuesta cerrar un
curso-horario», y sus dos lecturas —«contado sobre 500 de 1.424 **filas** del
plan» y «63 de 156 **aulas** con gestión anotada»— pasan a nombrar la unidad.

**Lo que el guard impidió, y tenía razón**: renombré «Aulas agendadas» a
«Cursos-horario agendados» y `titulosDePanel.test.ts` se puso rojo con su motivo
escrito: *«Agenda y registro no son vistas nuestras: son las dos hojas que el
equipo llena en Excel, traídas a la app. Que se llamen como la hoja es lo que
deja reconocerlas sin explicación.»*

Es cierto y verificable: Fuentes enumera las tres hojas del libro —«Aulas
Agendadas», «Aulas Aplicadas (Campo)», «Base de control»—. **Revertido**, con la
razón anotada en el propio sitio para que no se vuelva a intentar.

Que el título nombre la hoja y su subtítulo diga «174 cursos-horario» no es una
contradicción: son dos cosas distintas, cada una en su sitio.

**Lo que cuadra**: 174 + 1.173 reservas = 1.347, igual que en Fuentes; el panel
declara su recorte —«500 de 1.424»—; y la comparación histórica dice su fuente:
«en 2025 ésas se cayeron el doble que las cerradas en una o dos».

## Sección Validación · `calidad/base`

**Resuelta la anotación de las 304.** No había contradicción: el panel declara
«**304 filas de la hoja**», que son las de la hoja «Base de control» del Excel y
no tienen por qué ser una por parte. En `campo_malo` son 304 contra 152 partes de
campo, y el subtítulo lo dice.

**Pero el mismo componente se contradecía a cuatro líneas de distancia.** La
lectura de arriba dice «Reparto de las 304 **filas de la hoja**» y la de abajo
decía «304 **aulas** sin sus dos umbrales» — mismo denominador, dos unidades.

Y la decisión ya estaba tomada en el panel que lo envuelve, con su motivo:

> «"filas de la hoja" y no "aulas": son las que trae el libro que llena el
> equipo, y no tienen por qué ser las del plan —aquí 210 contra 196—. Llamarlas
> "aulas" ponía dos cifras con el mismo nombre en un perfil cuya unidad es el
> curso-horario.»

Otra reparación que llegó a un sitio y no al de al lado. Corregido; en pantalla
las dos frases dicen ya «filas de la hoja».

**Corrección sobre el ratchet**: escribí que bajaba a 62 y **sigue en 63**. La
frase corregida era `"aula sin sus dos umbrales" : "aulas sin sus dos umbrales"`,
con la palabra al principio del literal y **sin determinante delante**, y el
detector exige uno —«las aulas», «304 aulas»— para no cazar identificadores de
código. Nunca la contó.

Es una limitación real del contador, no un fallo del arreglo: **el ratchet mide
menos de lo que hay**. Sirve igual para lo que se creó —impedir que la deuda
crezca— pero su número es un piso, no un censo.

**Lo que está bien y no se toca**: el panel declara que el veredicto es del
equipo y no de la app —«es el corte que el equipo escribió en el libro, no un
criterio que la app verifique»—, dice qué columnas faltan por llenar y por dónde
vuelven, y avisa de lo que ese corte **no** decide: «no dice a qué aula conviene
ir: un aula con 100 elegibles al 40 % rinde 40 encuestas, y una con 20 al 70 %
rinde 14».

## Validación · `calidad/controles` · el verbo en plural con un solo caso

La lectura decía «**1 piden revisión** · 1 advertencia · 9 correctos». Las dos
vecinas concuerdan con su ternario y **ésta no**, en la misma frase.

Buscada la firma en todo el perfil —una cifra en `<strong>` seguida de verbo
plural sin ternario—, aparecieron **dos más**: «1 faltan, en N cursos-horario» y
«1 están a cinco o menos». Las tres corregidas.

**La regla al repararlo, que no es la obvia**: el verbo concuerda con el número
**que se muestra**, no con el valor interno. `fmtCuenta` redondea hacia arriba, y
0,4 se pinta «1»; un `valor === 1` habría dejado «1 faltan» exactamente igual. Se
compara contra el texto ya formateado.

Guard sobre esa firma exacta, verificado que muerde. La concordancia en general
no se puede comprobar desde el fuente; esta forma sí, y es la que se ha visto
tres veces.

**Lo que cuadra en la pestaña**: «2 alertas» = 1 revisión + 1 advertencia ✓, y el
control que pide revisión dice su causa y su remedio —«7 columnas de la Base de
control tienen datos pero su cabecera está vacía en el Excel, así que no se
leyeron. Ponles nombre en la hoja para que entren»—.

## Validación · `calidad/abiertas` · afirmar una ausencia que no se sabe

El panel decía, en dos frases seguidas:

> «Este estudio **no tiene preguntas abiertas que revisar**. Este estudio **no
> trae instrumento, así que no se sabe** qué preguntas son abiertas.»

Son incompatibles: si no se sabe, no se puede afirmar que no las hay. Y las dos
empiezan igual, así que además se leen como un tartamudeo.

La primera frase la pone el frontend, fija; la segunda la produce el motor. Y el
motor tiene **tres** motivos posibles (`monitoreo_texto_abierto.R:145-158`):

| motivo | ¿permite afirmar que no las hay? |
|---|---|
| «no trae instrumento, así que no se sabe qué preguntas son abiertas» | **no** |
| «el instrumento no declara tipo y nombre de sus preguntas» | **no** |
| «el instrumento no tiene ni una pregunta de texto abierto» | sí |

La frase fija era correcta en **uno de tres** casos. Retirada: los tres motivos
se explican solos, y ahora el panel dice sólo lo que se puede afirmar, seguido de
qué se vería con el instrumento cargado.

Es el mismo defecto que este loop viene cazando en las cifras —afirmar más de lo
que el dato permite—, aquí sobre un vacío: **la diferencia entre «no hay» y «no
se sabe» es justo la que un lector no técnico no puede reconstruir solo**.

## Consultas · la última sección

**`consultas/parte`** · El panel está bien construido y no se toca. Declara lo que
**no** se puede leer y por qué: «la cadena hasta las efectivas no se puede leer:
ningún parte declara los que no quisieron responder ni los que ya habían
respondido», y «no se puede saber si alguna aula se aplicó en otro salón: el plan
agendado no trae salón para ningún curso-horario, así que no hay contra qué
comparar los 152 partes». Las dos son causa + consecuencia, que es el patrón
correcto.

Sus columnas —«CANTIDAD DE ASISTENTES», «CANTIDAD DE EFECTIVAS»— parecían
candidatas a simplificarse. **No se tocan**: son los títulos literales del Excel
que el equipo llena; el motor las lee y las escribe por ese nombre
(`carga_aulas_aplicadas.R`, `carga_aulas_libro_generar.R`). Cambiarlas rompería
la lectura del libro, además de contradecir la instrucción de no normalizar lo
que viene del equipo.

**`consultas/extras`** · Todo cuadra, y cuadra **entre secciones**:

- «77 extras» coincide con los 77 del banco que ya nombraban Fuentes y Resumen
- 1.805 mujeres + 910 hombres = **2.715 alumnos** ✓
- explica qué son y qué no: «no reemplazan a ningún curso-horario: son aulas
  adicionales para cerrar la cuota de hombres y mujeres de cada facultad»
- y declara su límite sin saltárselo: «para saber si el banco alcanza hace falta
  la hoja "Base de control"… sin ella proyectar sus alumnos sería inventar»

«Aulas extra» queda como está: es el término del operativo —el mismo «bolsón
extra» del popover de reemplazo— y no hay nada que indique lo contrario. Tras
tres frenos del repo por renombrar términos establecidos, la carga de la prueba
está en cambiar, no en dejar.

## Deuda de vocabulario · los cuatro archivos que más acumulaban

Quince frases revisadas una a una. **Doce cambiadas, tres se quedan** y cada una
con su motivo:

- «Duración de la aplicación **dentro del aula**, en minutos» — ahí el aula es el
  **espacio físico** donde dura la sesión, no la unidad de muestreo.
- «"Banco" son **las aulas extra** de esa facultad» — término del operativo, el
  mismo «bolsón extra» del popover.
- «el banco de extras no tiene **las aulas** que se piden» — habla del banco, así
  que arrastra el mismo vocabulario. Se deja por prudencia.

El ratchet baja de **63 a 53**.

**Y de paso, una concordancia que el cambio destapó**: «Ninguna aula evaluada se
quedó **corta**» pasa a «Ningún curso-horario evaluado se quedó **corto**». El
género venía del sustantivo viejo y habría quedado descolgado.

## Comprobación cruzada del embudo entre simulacros

`como_2025`: 174 titulares · **18 con reemplazo activado** · −22 → 152 aplicadas ·
2.817 recibidas · −149 → 2.668 que cuentan. Todas las restas cierran, y el «18»
es **el mismo que en `campo_malo`** — correcto, porque los reemplazos dependen del
registro y no del rendimiento. La reparación del «174» se sostiene en los dos.

## Deuda de vocabulario · segundo lote

Nueve frases más: las tres de observaciones de campo —dos de ellas **las dos
ramas del mismo párrafo**—, las tres de `avanceCuota` y las tres del gráfico de
sexo por facultad, incluida su leyenda. **Verificado en pantalla que la leyenda
más larga cabe entera, sin recorte.**

Se quedan las cuatro de `aulasPresentation.ts` —«Tamaño de aula», «Tasa del
aula», «Peso del aula», «Meta de efectivas del aula»—, que son términos técnicos
con significado propio, y las tres de `AulasCriterioDeAula`, donde «aula válida»
es el nombre del criterio que el estudio declara (`aula_valida` en el estado) y
renombrar sólo el texto crearía un desajuste con el campo.

El ratchet baja a **44**.

### Un test que se rompió al renombrar, y por qué merecía arreglarse

`celdasPorFacultad.test.ts` anclaba su comprobación con
`slice(indexOf("Aplicando todas las aulas"))`. Al cambiar esa frase, `indexOf`
devolvió −1, `slice(-1)` dejó `"\n"` y el fallo salió como **«expected '\n' to
contain 'fmt(conDeficit)'»** — que no dice nada de lo que pasó.

Ahora comprueba que el ancla existe **antes** de usarla, con un mensaje que dice
qué hacer. Un test frágil no es un defecto del producto, pero un test que falla
con un mensaje ilegible cuesta la misma media hora que un defecto.

## Deuda de vocabulario · tercer lote

Once frases más, repartidas en seis archivos: los tres avisos históricos de
`kpisDeAulas` —«en el campo de 2025, un curso-horario que llegaba a la tercera
gestión…»—, las dos del avance en respuestas, las dos de la proyección, las dos
del control del libro y las dos de la sección de calidad.

**El ratchet baja a 33**, desde los 93 iniciales. Verificado en pantalla con los
siete paneles de Resumen montados: cero «aulas» en la sección.

Dos detalles del método que se repiten y ya son rutina:

- **El género sigue al sustantivo**: «un aula **corta**» → «un curso-horario
  **corto**».
- **Los saltos de línea rompen la búsqueda**: tres frases de este lote no casaron
  al primer intento por tener el corte en medio. Se localizan por `grep -n` y se
  sustituyen con el salto incluido.

## Deuda de vocabulario · lote final

Dieciocho frases más, en diecisiete archivos. **El ratchet baja de 33 a 15**, y
lo que queda es prácticamente la lista de intocables.

**Un error de español que salió de paso**: `AulasParteContraPlataforma` decía
«**Ningún** aula tiene parte y respuestas a la vez». *Aula* es femenino —lleva
«el/un» sólo por su *a* tónica, pero el determinante concuerda en femenino: «ninguna
aula»—. Al pasar a «Ningún curso-horario» se resuelve solo, pero conviene dejarlo
anotado: el masculino aparente de «el aula» arrastra concordancias equivocadas.

Otras concordancias del lote: «ninguna aula **sola**» → «ningún curso-horario
**solo**», «Un aula se sale» → «Un curso-horario se sale», «Esta aula espera» →
«Este curso-horario espera», «Todas las aulas del plan **tienen**» → «Todos los
cursos-horario del plan tienen».

**Se quedan, además de las ocho familias ya declaradas**: las dos locuciones
adverbiales —«Cumplimiento aula por aula», «Cada cadena, aula por aula»— y
«formulario de aplicación en aulas», que nombra un formulario concreto.

### Vuelta 17 · Un panel que perdía su miembro justo cuando todo iba bien

El `capacity-drift` que Avance > Resumen arrastraba desde el turno anterior no
señalaba un defecto de la cabecera: señalaba que **el contenedor de datos del
panel no se estaba reconociendo como miembro**, y el auditor caía a los hijos del
grupo hasta medir el `mon-profile-panel-head` y sus 4-5 px de padding.

La causa está en qué rama de `AulasFrenteDelOperativo` se renderiza. El
componente declaraba `data-qa-geometry-member` en **dos** de sus tres ramas:

| Rama | ¿Declaraba miembro? |
|---|---|
| Estado vacío (`mon-profile-muted`) | sí |
| Hay vencidos **con** pendientes (`ul.aulas-frente-lista`) | sí |
| Hay vencidos y **cero** pendientes | **no** |

La tercera es justo la del proyecto en `como_2025` —«los 131 cursos-horario que
ya pasaron su fecha tienen su parte en el libro»—: no es el estado vacío, y
`f.pendientes.length` es 0, así que no se pinta la lista. El panel quedaba sin un
solo miembro explícito **precisamente en el caso en que el operativo va al día**.

La declaración pasa al contenedor `div.aulas-frente`, que es lo único presente en
las tres ramas y lo que el contrato pide («el contenedor visible de datos»); la
lista deja de declararla para no anidar dos miembros midiendo lo mismo.

**Es la segunda avería de esta familia con causa distinta.** La primera, ya
reparada en el runner, era un `<details>` cerrado cuyo miembro el filtro
descartaba; aquí el miembro no existe en esa rama. El síntoma es idéntico —el
auditor mide la cabecera— y por eso conviene leerlo siempre como «falta un
miembro», nunca como «sobra padding en el head».

**Comprobado que el gate muerde**, que era obligatorio porque las 16 direcciones
del repaso salieron en cero y un pleno así no distingue «conforme» de «no mide»:

| | `ok` | `geometryIssues` |
|---|---|---|
| Con la declaración | `true` | **0** |
| Revertida | `false` | **1** |

**Y el detector con que leí esa prueba dio un falso vacío**: extraía
`issues=N geometryIssues=N` como si fueran contiguos, y en la línea real van
separados por diez campos. Devolvió cadena vacía en vez de rojo. Es la tercera
vez en este loop que un grep mío afirma «no hay» cuando lo que pasa es que no
casa — y las tres veces el patrón fue el mismo: **buscar la forma exacta que
esperaba encontrar en vez del término**.

### Indicación D · Ninguna de las dos pestañas nuevas está justificada por el payload

La pregunta «¿faltan dos pestañas?» se contesta con evidencia, no con criterio:
la única categoría del triaje C5 que autoriza añadir superficie es la **3, vacío
por desconexión** —el backend ya lo calcula y el frontend no lo consume—.

Censo de `MonitoreoAulasDashboard`: **39 claves de primer nivel, las 39 con al
menos un consumidor** fuera de `api/monitoreo.ts`. Cero huérfanas.

De modo que **no hay ningún dato ya calculado esperando una pestaña**. Queda
acotado a lo que mide: el payload del dashboard, no los demás endpoints del
perfil. Si aparece una pestaña justificada, tendrá que salir de un motor que hoy
no publica al dashboard, y eso se dice como tal.

### Vuelta 18 · El ratchet de vocabulario estaba ciego a la mitad de su trabajo

Al empezar la indicación H salió primero un defecto del **detector**, no de la
pantalla: el regex del ratchet declaraba cubrir las frases con la cifra
interpolada —«`${fmt(f.vencidas)} aulas`»— y **no casaba ni una**.

La causa es un `\b` mal colocado. El patrón era
`\b(?:la|las|…|\d+|\$\{…\})\s+aulas?\b`, con el `\b` delante del grupo **entero**,
así que la alternativa `${…}` exigía un carácter de palabra inmediatamente antes
del `$`. En un template literal al `${` siempre lo precede un espacio, un backtick
o un paréntesis: la alternativa sólo casaba en `x${n} aulas`, que no existe en el
código real.

| | frases contadas |
|---|---|
| Detector con el `\b` mal puesto | **15** |
| Detector reparado | **34** |

Las veinte invisibles eran justo las **más visibles en pantalla**, las que llevan
una cifra delante. El `(?!-)` añadido descarta además `${className}
aulas-foco-boton`: el guion cuenta como frontera de palabra, así que un nombre de
clase CSS se contaba como prosa.

**Por qué el control de fixture no lo vio, que es la lección.** El test ya tenía
un guard contra el verde por ausencia: «si el contador diera cero, el ratchet no
protegería nada». Pero el regex **no daba cero** —daba 15 por las otras
alternativas—, así que un control de «no da cero» no puede ver una alternativa
muerta dentro de un patrón compuesto. Ahora hay un caso por alternativa:

| Alternativa | Muestra | Casa |
|---|---|---|
| cifra interpolada | `` `${fmt(f.vencidas)} aulas vencidas` `` | sí |
| interpolada tras preposición | `` `de ${fmt(p.universo)} aulas` `` | sí |
| cifra literal | `30 aulas de la facultad` | sí |
| determinante | `ninguna aula tiene parte` | sí |
| nombre de clase CSS | ``className={`${c} aulas-foco-boton`}`` | **no** |
| identificador de código | `const aulasPorFacultad = 1` | **no** |

Comprobado que muerde: con el regex viejo, **rojo exactamente en las dos
alternativas interpoladas** y verde en las otras cuatro.

**Una segunda forma de ceguera, y ésta sigue viva**: cuando la cifra y el
sustantivo están separados por un ternario de singular/plural
—`${f.actualizadas} ${f.actualizadas === 1 ? "aula del plan se actualizó" : …}`—
el patrón `${…} aulas` nunca llega a formarse. Esa frase se reparó a mano; el
detector todavía no la habría encontrado.

**Ocho frases reparadas**, todas texto de pantalla y varias contradiciéndose
dentro del propio archivo —`cargaDeCampoExcel` decía «aulas» en la línea 104 y
«cursos-horario» en la 115—:

| Archivo | Decía | Dice |
|---|---|---|
| `avisoLibroImportado` ×3 | «Entraron 269 aulas» · «Ninguna de las 190 aulas del libro» | «Entraron 269 cursos-horario» · «Ninguno de los 190 cursos-horario» |
| `avisoLibroImportado` (ternario) | «188 aulas del plan se actualizaron» | «188 cursos-horario del plan se actualizaron» |
| `cargaDeCampoExcel` | «190 aulas tienen hora pero no fecha» | «190 cursos-horario tienen hora pero no fecha» |
| `AulasFrenteDelOperativo` | aria-label «aulas vencidas con parte» | «cursos-horario vencidos con parte» |
| `AulasLoQueFalta` | aria-label «cierran N aulas» | «cierran N cursos-horario» |
| `AulasObservacionesDeCampo` | «Ninguna de las N aulas gestionadas» | «Ninguno de los N cursos-horario gestionados» |

**El ratchet queda en 27**, y esta vez el número es el real. Los cinco contratos
que afirmaban el texto viejo se actualizaron: ninguno era una regresión.

### El inventario de gráficos decía seis y son veintitrés

La indicación H hablaba de «los seis gráficos del perfil», que es lo que sale al
contar los archivos con `Chart` en el nombre. Censo por lo que hacen, no por cómo
se llaman:

- **4 gráficos Plotly** (`AulasBrechaEstratoChart`, `AulasCoberturaChart`,
  `AulasEstadoChart`, `AulasSexoPorFacultadChart`), ninguno de los cuales aparece
  al buscar `role="img"` o `<svg>`.
- **19 componentes con 26 elementos `role="img"`**, gráficos construidos con
  divs: carriles, barras, pirámides, embudos.

Contar por el nombre en vez de por la función es la misma falsa ausencia que este
loop ya pagó tres veces. El inventario de H pasa de 6 a 23.

**Anotado para la vuelta de H**: el aria-label de `AulasLoQueFalta` abre con
«Escalera de esfuerzo», que es una metáfora, no un término. Se decide con el
elemento delante, no ahora.

### Vuelta 19 · Avance > Cuotas · la pirámide, y una equivalencia que era del grano

Primer elemento de la indicación H. La geometría de `AulasPiramideCuota` está
bien resuelta y el motivo está escrito en el propio componente: el carril es la
escala y la pista lo contiene, así que el 100 % no puede desbordar; y la sombra
de lo agendado se recorta a `100 − relleno`, de modo que **relleno + previsto
nunca pasa de la meta**. Sumar lo que pinta da lo que promete el rótulo.

Lo que sí apareció es la firma del defecto de la vuelta 4, un nivel más abajo:

    const cumple = observadas >= meta;                              // suma el lado
    faltan: propias.reduce((s, f) => s + Math.max(0, target - observed), 0)  // por fila

Dos reglas distintas para la misma pregunta, y una de ellas compensa. **Pero
verificado antes de acusar, y resultó no morder hoy**: `quotas_sex_faculty` sale
de `merge(targets, observed, by = c("fac_key", "sex_key"))`
(`monitoreo_aulas_avance_cuota.R` ~571), con `targets` construido en un
`for (sx in names(celdas))`. Hay **exactamente una fila por facultad y sexo**, así
que `propias.length === 1` y las dos expresiones dan lo mismo.

**La equivalencia es del grano del payload, no de la regla.** Es justo la forma
de acotamiento que caduca sin avisar: el día que estas filas se abran por estrato
o por nivel —que es la clase de cambio que se hace sin mirar este componente—,
`observadas >= meta` volvería a declarar «cumplida» una celda con gente
faltando. Un comentario que lo advierta no lo detecta; un invariante sí.

`cumple` pasa a ser `faltan === 0`, que es lo que el ADR 0079 dice de verdad y no
depende del grano. **No cambia una sola cifra hoy** —los 14 tests existentes
siguen verdes sin tocarlos—, y el test nuevo fija el caso que hoy no puede
ocurrir: dos filas del mismo par, una con 60 sobre 40 y otra con 10 sobre 30, que
suman 70 sobre 70 debiendo 20 personas. Comprobado que muerde: con la regla vieja,
rojo en ese test y sólo en ése.

Es la segunda vez en este loop que la reparación correcta no es cambiar un
número, sino **atar dos expresiones que hoy coinciden por casualidad**.

### Vuelta 20 · Dos brechas del mismo payload, en la misma pantalla, con reglas contrarias

El hallazgo más grave desde la vuelta 4, y esta vez está en el motor.

`avance_por_facultad` y `avance_cuota` viajan **en el mismo payload** y se pintan
**en la misma sección de Avance**. Medido contra la pila con
`HSVG2026_sem15_como_2025`:

| Facultad | meta | válidas | `avance_por_facultad` | `avance_cuota` | déficit real por sexo |
|---|---|---|---|---|---|
| Arquitectura y Urbanismo | 125 | 126 | **17** | **0** | 17 mujeres |
| Ciencias e Ingeniería | 528 | 535 | **4** | **0** | 4 |
| Educación | 24 | 33 | **3** | **0** | 3 |

La primera suma los déficits de sus celdas de sexo; la segunda restaba
`max(0, cuota − válidas)` sobre el total de la facultad, que **deja que un sexo
compense al otro**. Su panel contaba esas tres entre las «cumplidas»
—`cumplida = estado === "ok" && brecha === 0`— y su cabecera publicaba
**brecha 0 con avance 106.7 %** mientras tres filas de abajo debían 24 personas.

**La doctrina ya estaba escrita, aplicada y con un caso observado… en la otra
estructura.** El comentario de `monitoreo_aulas_universitarias.R` ~1936 dice
«la brecha es la SUMA DE LAS CELDAS, no la resta del total» y cita Gastronomía,
con dos mujeres cortas publicadas como cero. Esa reparación **nunca se propagó
a la superficie gemela**, y nada lo detectaba porque cada una tiene sus propios
tests y ninguno las compara.

La reparación pasa `quotas_sex_faculty` —ya calculado unas líneas antes, en el
mismo llamador— a `.monitoreo_aulas_avance_cuota()`, y la brecha de cada
facultad sale de sus celdas. **El fallback sigue vivo y tiene su test**: una
facultad sin desglose de sexo cae a la resta simple, porque fabricarle un cero
sería peor. El total pasa a sumar las brechas de sus filas, que es lo que
permite que la columna cuadre con la cabecera.

Dos tests nuevos, con las cifras exactas de Arquitectura (125 = 85 F + 40 M,
logradas 126 = 68 F + 58 M). Comprobado que muerden: con la resta simple, rojo
en los dos asserts del caso —`brecha` y `total$brecha`— y verde en el del
fallback.

**Cómo apareció, que es lo replicable**: no leyendo código, sino midiendo el
payload real y **cruzando dos estructuras que dicen lo mismo con nombres
distintos**. El primer intento de sonda devolvió «0 facultades y 0 celdas»
porque el dashboard del perfil vive en `dashboard.aulas_universitarias_reports`
y yo leía un nivel más arriba. Ese cero era un fallo de sonda, no una ausencia:
darlo por bueno habría cerrado la pestaña como conforme.

**Pendiente de esta vuelta**: verlo en pantalla. El backend de la pila lleva el
código anterior cargado —un cambio en R no se ve sin relanzar—, así que la
evidencia de hoy es el payload medido antes de la reparación más los tests
después. Queda relanzar y capturar la pestaña.

### Vuelta 21 · La reparación verificada en pantalla, y la contradicción que destapó

Relanzado el backend —arrancó a las 08:02 y el motor se tocó a las 08:43, así que
llevaba 41 minutos con el código anterior— la misma sonda sobre el payload real
devuelve:

| | antes | después |
|---|---|---|
| Arquitectura, `avance_cuota.brecha` | 0 | **17** |
| Facultades cumplidas debiendo por sexo | **3** | **0** |
| Total, brecha | 0 | **170** |

En pantalla el KPI publica ya «Cuota por recoger: 170 — 2.668 de 2.500 personas ·
21 de 30 grupos de facultad y sexo», y la vista sale con `ok=true`, cero issues y
cero avisos de geometría.

**Y esa reparación destapa una contradicción aparente**: la cabecera dice
**106.7 %** y a su lado **170 por recoger**. Las dos son ciertas —el estudio
lleva 168 personas de más y le faltan 170 donde la cuota no cierra— pero nada lo
explicaba, y quien no diseñó el estudio concluye que una de las dos está mal. Es
justo el fallo que este loop lleva cazando: un hecho publicado sin su causa.

Se añade una línea que sólo aparece cuando de verdad chocan —cuota superada **y**
algo por recoger—: «Se ha recogido de más en unas facultades y todavía falta en
otras: pasarse en un grupo no cubre al que va corto». Con la cuota a medias o
cerrada de verdad no se pinta, porque ahí no hay nada que explicar.

**El QA visual no podía comprobar esa línea, y eso es del instrumento.** El
`report.json` sólo lista los elementos que llevan atributos de geometría: la
`ol.aulas-facultades-lista` aparece y `p.aulas-cuota-lectura` no, así que buscar
la frase ahí devolvía «no está» tanto si se pintaba como si no. Se comprueba con
un test de componente —tres casos: chocan, a medias, cerrada— y no con el
barrido visual. **Un "no aparece" en el report no es una ausencia en pantalla**:
es una pregunta hecha al instrumento equivocado.

### Vuelta 22 · Avance > Resumen · un rótulo que contaba lo que reparte el gráfico de al lado

Los dos gráficos de Resumen reparten universos distintos, y eso es correcto:

| panel | reparte | qué es |
|---|---|---|
| Estado de aplicación | **1.424** | el plan entero, con 1.232 en reserva |
| Cursos-horario por cobertura | **174** | los que tienen meta |

Lo que no era correcto es que **los dos rotulaban 1.424**. El helper se llamaba
`contadorDeLoQueReparte` y no miraba lo que reparte: sólo comprobaba que el
resumen fuese un array no vacío y devolvía el total en los dos casos.

```ts
const contadorDeLoQueReparte = (resumenDelMotor: unknown) =>
  contadorDeAulas(
    Array.isArray(resumenDelMotor) && resumenDelMotor.length ? totalAulas : aulaRows.length,
  );
```

**Y ese helper es una reparación mía anterior.** Los dos paneles decían «se ven
500 de 1.424», falso desde que el motor reparte sobre todas las filas. Verifiqué
la suma —«los seis tramos de Estado de aplicación suman exactamente 1.424»,
está escrito en el comentario— **en un panel**, y apliqué la conclusión a los
dos. Es la misma falta que ya costó una vuelta al medir un solo viewport, un
nivel más fino: **comprobar en una superficie y concluir sobre su vecina.**

Reparar sólo la suma no bastaba: `contadorDeCursosHorario` dispara «se ven X de
Y» en cuanto el total supera lo visible, así que cobertura habría pasado de
«1.424» a **«se ven 174 de 1.424»** — un aviso de recorte igual de falso, porque
a cobertura no le faltan 1.250 filas: es que 1.250 no tienen meta que cubrir. Un
reparto con universo propio se rotula con el suyo y sin denominador ajeno, y el
banco sólo se nombra cuando el universo es el que lo contiene.

La función sale del page-file a `contadorDeLoQueReparte.ts` con firma explícita
—era lógica calculable enterrada en un componente— y tiene sus cuatro casos:
reparto del plan entero, reparto de universo propio, sin reparto (donde el aviso
de recorte **sí** corresponde) y reparto con todo a cero, que se trata como
ausente y no como un universo de cero. Comprobado que muerde: con la regla
vieja, rojo sólo en el caso de cobertura.

Vista con `ok=true`, 0 issues y 0 avisos de geometría. 146 archivos / 1.726
tests.

### Vuelta 23 · El pie del ritmo no publicaba una cifra mala: se callaba

Cuarta superficie con la resta simple, y la más difícil de ver porque su síntoma
es un silencio.

`AulasRitmoDiario` calculaba `falta = max(0, metaEntera − total)` y **todo el pie
vive tras un `falta > 0`**. Con 2.668 acumuladas sobre una cuota de 2.500 la
resta da cero, así que el panel se quedaba en «2.668 respuestas en 12 días» y
**no decía nada de las 170 personas que faltaban** en los grupos que no cierran.
Un número equivocado se caza leyendo; una frase que no aparece, no.

El motor pasa a publicar `brecha` dentro de `ritmo_diario`, tomada del mismo
`avance_cuota$total` del que ya salía `meta`. Verificado en el payload tras
relanzar: **`brecha: 170`** donde la resta da 0.

**Y la brecha aquí no es de volumen, es de composición.** Cuando el total ya
supera la meta y aun así falta gente, las respuestas que quedan tienen que caer
en los grupos cortos, no en cualquiera: prometer «N días más al ritmo de estos
12» sería falso, porque al ritmo medio no se cierra una cuota por sexo. En ese
caso el pie dice qué falta y de qué se trata —«Faltan 170 en los grupos de
facultad y sexo que aún no cierran, aunque el total ya pasa la meta de 2.500»— y
**se calla los días**. Por debajo de la meta, todo sigue como estaba.

**Mi propia reparación traía un bug y lo cazó el test del fallback.** Escribí
`Number.isFinite(Number(ritmo.brecha))`, y `Number(null)` es **cero**, no `NaN`:
un payload sin brecha se leía como brecha cero y apagaba el pie: exactamente el
silencio que la reparación venía a quitar. El `== null` va delante. Es la tercera
vez en este loop que una coerción numérica de JavaScript convierte un ausente en
un cero con significado.

Tres tests: brecha de composición (dice la cifra y no promete días), por debajo
de la meta (dice los días) y sin brecha del motor (cae a la resta, conducta
anterior). Vista con `ok=true`, 0 issues, 0 de geometría. 147 archivos / 1.729
tests, y las tres suites de R del área en verde.

**El patrón, ya en cuatro sitios.** `avance_cuota`, la pirámide, el veredicto de
la tabla del cliente y ahora el pie del ritmo: cada uno calculaba por su cuenta
«lo que falta» restando totales. La cifra correcta la publica el motor en un solo
sitio; cada superficie que la recalcula es una oportunidad de contradecirlo.

### Vuelta 24 · El barrido del patrón, cerrado con evidencia

Cuatro superficies habían recalculado «lo que falta» restando totales, así que
tocaba barrer las demás antes de seguir. Siete sitios restan meta menos logrado
en el perfil, y **los siete están bien**:

| Sitio | Resta | Veredicto |
|---|---|---|
| `avanceParaCliente.ts:176` | por sexo, con la resta sólo de respaldo | correcto |
| `avanceProyectado.ts:116` | dentro de `porqueDeLaCelda`, grano de celda | correcto |
| `AulasSerieDeRendimiento:576` y `:609` | por sexo (`proyeccionDelSexo`, `c.sexo`) | correcto |
| `perfilPorFacultad.ts:126` | deriva al revés: `cubierto = meta − brecha` del motor | correcto |
| `proyeccionPorAgenda.ts:226` | por celda de sexo | correcto |
| `AulasRitmoDiario.tsx:99` | el respaldo de la vuelta 23 | correcto |

El barrido se repitió **sin** `Math.max` y con la resta invertida, porque exigir
la forma exacta es la falsa ausencia que este loop ya pagó varias veces. Sólo
salieron comentarios.

Y apareció el sitio canónico que ya tenía la doctrina escrita:
`brechaDeLaFacultad.ts` lee el `missing` del motor «en vez de restar
`target − observed` por su cuenta: el backend ya aplicó ahí el `max(0, …)` y dos
restas del mismo dato empiezan a discrepar». Sus dos consumidores son los
correctos.

**Los cuatro defectos eran los únicos que restaban a nivel de facultad o de
total.** Todo lo demás resta por celda, que es el grano en que la resta sí
equivale a la brecha.

### Avance > Resumen, cerrada: los cinco gráficos

| Gráfico | Veredicto |
|---|---|
| `AulasEstadoChart` | conforme — usa el reparto del motor sobre todas las filas, no las 500 recortadas |
| `AulasCoberturaChart` | reparado en la vuelta 22 (rotulaba 1.424 sobre un gráfico de 174) |
| `AulasRitmoDiario` | reparado en la vuelta 23 (el pie se callaba) |
| `AulasPerfilPorFacultad` | conforme — barra y rótulo pintan el mismo `cubierto/meta`, el excedente va fuera de la meta y `celdaCorta` declara el corte por sexo |
| `AulasAvanceEnRespuestas` | conforme — `anchoCubierto + pendiente = 100`, el excedente pegado fuera, y el `<li>` concuerda con el número mostrado y no con `a.falta` |

**Observado y no reparado, dicho**: `anchoExcedente` lleva un `Math.max(2, …)`
que fuerza dos puntos de ancho mínimo, así que un excedente de una respuesta
sobre 3.227 se dibuja como si fuera el 2 %. Es una decisión de visibilidad
razonable —sin ella no se vería— pero exagera lo pequeño y no está justificada en
el código. Queda anotada, no tocada.

## Indicación J — tres cantidades que hay que dejar de mezclar

Encargo de Gonzalo el 2026-08-30, a mitad de la vuelta 25:

> «tenemos que hacer una diferencia bastante sólida y consistenciada entre a lo
> que tenemos que llegar, que son las metas, y lo que se espera llegar con las
> aulas, que es lo diseñado al principio del estudio […] y también contrastarlo
> con el rendimiento que se está viendo hasta el momento. […] **¿Cuánto nos falta
> para llegar a la meta?** Y no nos importa cuánto nos falte para llegar a lo
> calculado, sino cuánto nos falta para llegar a la meta simplemente. Y por otro
> lado es cuánto esperamos llegar por un lado en base al diseño y cuánto
> esperamos llegar en base a […] cómo va el rendimiento en aquella facultad.»

**Las tres cantidades, y el motor ya las tiene separadas.** Una celda de
`avance_sexo_facultad` trae hoy:

```json
{"cuota":290, "logrado":252, "previsto":294.2, "aporte_pendiente":40.3,
 "proyeccion":292.3, "brecha":0, "calibracion":0.857,
 "previsto_origen":"composicion_del_aula",
 "etiqueta_calibracion":"El campo está rindiendo un 14 % menos de lo previsto"}
```

| Cantidad | Campo | Qué es |
|---|---|---|
| **La meta** | `cuota` | a lo que hay que llegar. **La única contra la que se mide lo que falta.** |
| **Lo diseñado** | `previsto` (`previsto_origen`) | lo que se esperaba aportar con las aulas calculadas al inicio |
| **El rendimiento** | `proyeccion`, `calibracion` | lo que se espera ahora, calibrado con lo que el campo está rindiendo |

**Lo primero, la parte dura de su indicación: comprobada y sin defecto.** Ningún
sitio mide «lo que falta» contra lo previsto. El único que resta contra lo
esperado es `proyeccionPorAgenda.ts:244`, y calcula otra cosa
—`faltanAlCerrarAgenda`, lo que faltará **cuando la agenda se acabe**—, que es
justamente una de las distinciones que él pide. Barrido hecho en front y en R,
con la resta en los dos sentidos.

**Donde sí hay materia: los nombres.** La misma cantidad se llama de dos maneras
en dos superficies de la misma sección, y una de las dos pierde información:

| Sitio | Rótulo | ¿Dice de dónde sale la meta? |
|---|---|---|
| `avanceCuota.ts:277` | «Cuota del diseño», o **«Meta del plan»** si el sello degradó | sí |
| `AulasCuotasResumen.tsx:109` | «Cuota del estudio», fijo | **no** |

`AulasCuotasResumen` recibe sólo las filas de cuota, así que **la procedencia no
le llega**: no puede decirlo aunque quiera. Y es un componente compartido por
cuatro pestañas —Cuotas, Resumen, Rendimiento y Efectividad—, así que el rótulo
inconsistente se repite en las cuatro.

**Y «diseño» hace de dos cosas a la vez**: en «Cuota del diseño» dice de dónde
salió la meta; en «lo diseñado» dice lo que se esperaba aportar. Son cosas
distintas y comparten palabra, que es el patrón «una palabra para dos cosas».

### Vuelta 25 · Estratos · un color que significaba dos cosas

`AulasSexoPorFacultadChart` apila Recogidas + Aportarán + Déficit proyectado y
marca la Cuota con un `line-ns-open` encima, que es el diseño correcto: la barra
llega a la proyección y la marca dice dónde está la meta. Medido: 27 de 30 celdas
no suman la cuota, y **debe ser así** —`logrado + aporte_pendiente` es la
proyección, que puede pasarse—.

Lo que no era correcto: la marca de «Cuota» y el segmento «Déficit proyectado»
usaban **el mismo `COLOR_RESULTADO.pendiente`**. Dos cosas distintas del mismo
gris, y una de ellas es el dato que decide si una facultad cumple su cuota por
sexo.

El propio `coloresDeResultado.ts` lleva la doctrina escrita —«una vista que se
quedara atrás pintaba dos cosas distintas del mismo color»— y el precedente:
`COLOR_ACUMULADO` existe aparte porque «no es un resultado: es la serie que los
suma». La marca de una meta es igual de no-resultado, así que ahora tiene
`COLOR_MARCA_DE_META`, con nombre propio para que un cambio en la serie acumulada
no mueva las marcas de las metas.

**Los dos guards de color no podían verlo.** Vigilan que el hex no se escriba a
mano y que la paleta no tenga duplicados; ninguno vigila que **una constante
signifique dos cosas dentro del mismo gráfico**, que es el hueco que este caso
destapa. Queda anotado como pendiente.

Vista con `ok=true`, 0 issues, 0 de geometría. 249 archivos / 2.550 tests de
Monitoreo en verde.

### Vuelta 26 · J.1 · La cantidad tiene un nombre; de dónde sale lo dice el chip

Primera pieza de la indicación J. En la cabecera del panel de Cuotas convivían
**tres rótulos para dos cosas**:

| Elemento | Decía |
|---|---|
| Título del panel | «Cumplimiento de la cuota **del estudio**» |
| Chip de procedencia | «cuota **del diseño** · tasa de efectividad 53.0 %» |
| Etiqueta de la barra | «Cuota **del diseño**» (o «Meta del plan» si degradaba) |

Y `AulasCuotasResumen` —compartido por otras cuatro pestañas— llamaba «Cuota del
estudio» a **la misma cantidad**. Comprobado antes de tocar nada, porque dos
nombres pueden esconder dos cifras: `avance_cuota.total.cuota` = **2.500** y la
suma de `quotas_sex_faculty.target` = **2.500**; válidas **2.668** en las dos. Es
un problema de rótulo, no de cálculo.

La etiqueta pasa a **«Cuota del estudio»** siempre. La cantidad no cambia de
nombre según de dónde salga: eso lo dice el chip, que está en la misma cabecera y
a dos centímetros. **Verificado que el aviso de degradación no se pierde**: el
chip dice «contra la meta del plan» y está visible junto a la barra; y como quien
no ve la pantalla tampoco ve el chip, la procedencia entra ahora en el
`aria-label` de la barra.

**Y esto es lo que desatasca la indicación J**: «diseño» hacía de dos cosas a la
vez —de dónde salió la META, y lo que se esperaba aportar con las aulas
calculadas, que es lo que el motor llama `previsto` y el encargo llama «lo
diseñado»—. Reservar la palabra para lo segundo es lo que permite separar las
tres cantidades sin que se pisen.

Los dos contratos que afirmaban el texto viejo pasan a fijar el invariante: **la
etiqueta es la misma con el denominador vigente y con el degradado, y lo que
cambia es el chip y el aria**. En pantalla: «Cuota del estudio» sí, «Cuota del
diseño» ya no como etiqueta, y «cuota del diseño ·» sobrevive sólo en el chip.
Vista `ok=true`, 0 issues, 0 de geometría; 147 archivos / 1.729 tests.

**Pendiente de J, anotado**: `AulasCuotasResumen` sigue sin recibir la
procedencia, así que en Resumen, Rendimiento y Efectividad la meta se publica sin
decir de dónde sale. Y falta lo principal: **contrastar las tres cantidades donde
el lector las necesita juntas**, que es Rendimiento.

### Vuelta 27 · J.3 · Las dos expectativas estaban en la misma vista y nunca en la misma frase

Lo que la indicación J pide de las dos expectativas **ya se calculaba, y bien**:

- **Lo diseñado**: la vara sale de `expected_valid`, y el módulo documenta que esa
  columna «colapsa tres cosas distintas» —`diseno`, `declarada` y `elegibles`, que
  *no es una meta, es el techo*—, así que la vara **sólo cuenta las aulas con
  `meta_origen === "diseno"`** y se divide entre ésas.
- **El rendimiento**: el esperado es «bayesiano de verdad», media posterior de un
  Gamma-Poisson, `(efectivas + peso × media) / (aulas + peso)`. Con un aula
  observada se apoya en la media del estudio; con treinta, en lo suyo. La
  intuición del encargo —«lo que yo intuyo que ya calculamos de forma
  bayesiana»— era correcta.

Lo que faltaba es que se pudieran **comparar**. Estaban repartidas así:

| Cantidad | Dónde se decía |
|---|---|
| Lo diseñado | Rendimiento, en la leyenda del gráfico |
| Lo esperado según el rendimiento | Rendimiento, en el titular, tres bandas más arriba |
| La comparación de las dos | **Cuotas**, en un `<small>`: «El campo está rindiendo un 14 % menos de lo previsto» |

Tres sitios, dos pestañas, y para contrastarlas había que recordar una cifra
mientras se busca la otra.

El titular pasa a llevar las tres en la misma frase y en la misma unidad:

> ARQUITECTURA deja **14.2** encuestas por curso-horario en 12 · el diseño pedía
> **20.3** · se espera **14.5** de la siguiente

En ese orden porque es el de la lectura: lo que se pidió, lo que se logra, lo que
se espera. **Sin vara del diseño no se escribe nada** —la leyenda ya declara ese
caso y una frase que dijera «el diseño pedía —» afirmaría más de lo que se sabe—,
y eso tiene su propio test.

Comprobado que muerde: quitando la cifra del diseño, rojo en el test del titular
y sólo en ése. Vista `ok=true`, 0 issues, 0 de geometría. 147 archivos / 1.731
tests.

**Una tercera ceguera del ratchet de vocabulario, anotada**: «Aulas por pedir, por
facultad» no la cuenta ningún detector, porque el sustantivo abre la frase sin
determinante delante. Ampliar el regex a ese caso exige distinguirlo de los
identificadores de código (`AulasAlertaDeAnticipacion`), así que la forma es
detectar el término al principio de un literal de texto. Queda pendiente.

### Vuelta 28 · J.2 era falsa y J.4 era real

**J.2 no existe, y la premisa la puse yo.** Escribí que `AulasCuotasResumen` es
«compartido por cuatro pestañas» y que en tres de ellas la meta se publica sin
decir de dónde sale. Comprobado: **se monta sólo en `AulasPestanaCuotas`**, donde
el chip de procedencia está en la misma cabecera. Lo que vi fue el `import` en
las otras tres, y es `import type { FocoDeCuota }` —sólo el tipo, no arrastra
componente—.

El error es el de siempre en este loop: **contar apariciones de un nombre y
llamarlas usos**. Un `import` no es un montaje, igual que un campo del payload no
es una capacidad y un archivo con «Chart» en el nombre no es un gráfico.

*(Deuda menor anotada: `FocoDeCuota` se declara en `AulasCuotasResumen.tsx` y lo
usan tres pestañas que no usan el componente. El tipo vive en el archivo
equivocado.)*

**J.4 sí era real.** En `serieDeRendimiento.ts`, `meta` nombraba dos cantidades:

| Sitio | `meta` era | En el vocabulario del encargo |
|---|---|---|
| `:249`, `metaPorCodigo`, `metaDelDisenoPorCodigo` | `expected_valid` de **un aula** | **lo diseñado** |
| `:394`, `celda.meta` | la **cuota** de una celda de sexo | **la meta** |

En pantalla nunca colisionaron —«Meta» es siempre la cuota y lo del aula se dice
«el diseño pedía»— pero en el código sí, y **me confundió a mí al auditarlo**,
que es la prueba de que confunde.

`meta` queda para la cuota. Lo del aula pasa a `esperadoPorAula`,
`esperadoDelDisenoPorAula`, `esperadoDeLoVisitado`, `esperadoPorAulaDelDiseno` y
el acumulador `esperado`. Renombrado puro: las 1.731 pruebas siguen verdes sin
tocar ninguna.

**Y como el defecto vuelve solo** —basta que alguien escriba
`const metaX = fila.expected_valid`—, lleva guard sobre la fuente, que es donde
se ve: ningún identificador `meta…` puede leer `expected_valid`. Con su control
de fixture, porque un regex roto daría cero infractores para siempre.

Comprobado que muerde, y **el primer intento de comprobación no valía**: renombrar
la variable dejaba usos huérfanos y rompía cuatro tests por otra causa, que no
prueba nada sobre el guard. Introducir el patrón **sin romper el código** da el
rojo limpio: uno solo, señalando `metaDelAula` por su nombre.

### Vuelta 29 · Rendimiento · el pronóstico proyectaba mil trescientas aulas que nadie va a aplicar

El panel «Cuándo se termina de aplicar el plan» excluía del universo el banco
—con un comentario que lo justifica: «los extras no son aulas que haya que
aplicar para cerrar, son respaldo del estrato»— y **dejaba dentro las reservas
encadenadas**, que son respaldo por el mismo motivo y con el mismo argumento.

Composición real del plan, medida:

| Rol | Filas |
|---|---|
| `titular` | **174** |
| `chain_reserve` | **1.173** |
| `extra_reserve_pool` (banco, ya excluido) | 77 |

| | decía | dice |
|---|---|---|
| Universo | **1.347** | **174** |
| Aplicadas | 152 | 152 |
| Faltan | **1.195** | **22** |

Un factor de 54 en «lo que falta», y una fecha de cierre proyectada al ritmo
observado sobre mil trescientas aulas que sólo salen a campo si cae su titular.

**El universo son los slots, uno por titular** — y una reserva aplicada cuenta,
pero **por el slot del suyo**. De las 152 aplicadas, 134 son titulares y 18 son
reservas que cubrieron al suyo: exactamente las 18 que el motor cuenta como
`reemplazada`, y 134 + 18 = 152 cuadra con lo que el panel ya publicaba. Contar
sólo titulares habría dado 134 y perdido las que sí se aplicaron.

Cuatro casos nuevos, ninguno cubierto antes —el fixture del archivo sólo tenía
aulas sin rol y un extra del banco—: las reservas fuera del universo, la reserva
aplicada que cubre a su titular, el titular **y** su reserva aplicados contando
como **un** slot, y la reserva sin titular declarado, que no se atribuye a
ninguno porque no se sabe cuál cubre. Comprobado que muerden: con la regla vieja,
los cuatro rojos y los seis anteriores verdes.

En pantalla: «152 de 174»; «1,347» ya no aparece. Vista `ok=true`, 0 issues, 0 de
geometría.

**Por qué no lo vio nadie antes**: el cambio de lógica pasó el gate en verde a la
primera. Ningún test tocaba roles, así que el universo podía valer 174 o 1.347 y
las diez pruebas del archivo decían lo mismo. Es la tercera vez en este loop que
un verde a la primera en un cambio de lógica señala un hueco de cobertura y no un
acierto.

### Vuelta 30 · Avance > Rendimiento, cerrada: los seis

| Gráfico | Veredicto |
|---|---|
| `AulasSerieDeRendimiento` | vuelta 27: las tres cantidades juntas en el titular |
| `AulasPronosticoDeCierre` | vuelta 29: el universo eran 1.347 y son 174 |
| `AulasAlertaDeAnticipacion` | **conforme** — dimensiona con el rendimiento observado y `null` cuando no se sabe; y el contraste supuesto-contra-observado que pide la indicación J **ya existe**: `tasaDeCaida.ts` compara la caída real contra la de 2025 (0,235) con la banda calculada «con la p de referencia, no con la observada, que es lo que hace que la banda sea la del supuesto y no la del dato» |
| `AulasConsumoDelBanco` | conforme |
| `AulasRendimientoPorFacultad` | conforme — el plan sólo se usa como *lookup* de `eligible_n`; cuenta sobre partes, así que el rol no le afecta |
| `AulasRitmoPorFacultad` | conforme |

**El barrido del universo, cerrado.** Tras el defecto del pronóstico tocaba
preguntar quién más cuenta filas del plan sin mirar el rol. Trece módulos usan el
plan sin `sample_role`, y **ninguno lo necesita**: o lo usan como *lookup* por
código (`rendimientoPorFacultad` con `eligible_n`, `serieDeRendimiento` con
`expected_valid`) o cuentan partes, no aulas del plan. El defecto estaba sólo en
`pronosticoDeCierre`.

### Observado y no tocado: ocho mínimos de ancho sin criterio común

Ocho gráficos fuerzan un ancho o alto mínimo para que un valor pequeño se vea, y
el mínimo va de 1 a 8 puntos sin regla:

| Gráfico | Mínimo | Se aplica a |
|---|---|---|
| `AulasConcentracionBrecha` | 1 % | el dato |
| `AulasPopoverReemplazo` · `AulasAvanceEnRespuestas` | 2 % | el dato |
| `AulasMedioDeContacto` · `AulasRendimientoPorFacultad` | 4 % | el dato |
| `AulasAgendaPorDia` | 6 % | el dato |
| `AulasPiramideCuota` | 6 % | **la pista**, no el dato |
| `AulasPerfilPorFacultad` | 8 % | **la pista**, no el dato |
| `AulasRitmoPorFacultad` | 8 % | el dato |

Los dos de la pista son legítimos sin discusión: el mínimo evita que la escala de
una facultad pequeña sea invisible, y el dato se dibuja **dentro**. El resto es un
compromiso real —sin mínimo, un 0,5 % no se ve y el lector cree que no hay dato—
pero con un 4 % o un 8 %, un 0,5 y un 4 se dibujan igual.

**Un caso que parecía el peor y no lo es**: `AulasRitmoPorFacultad` pinta un 3 %
de altura cuando las efectivas son **cero**. No miente, porque ese caso va en
`--pulso-border` y no en el verde de efectiva: es una marca de posición, y su
comentario lo justifica —«una facultad parada tres días es lo que hay que ver»—.
Distinguir por color es lo que lo salva.

**No se toca ninguno.** Unificar ocho mínimos visuales sin ver cada gráfico en
pantalla, a varios viewports, sería cambiar ocho decisiones de diseño a ciegas, y
el resultado probable es que valores pequeños desaparezcan. Queda declarado como
deuda de consistencia con su tabla, que es lo que permite decidirlo de una vez
cuando toque.

### Vuelta 31 · Efectividad cierra Avance, y un gráfico que se bautizaba a sí mismo

**`AulasEfectividadSeguimiento` es el panel modelo de la indicación J**, y ya lo
era antes de que ella existiera: contrasta lo supuesto contra lo observado
—«Se esperaba 69,3 % y va responiendo X %», «rinde por debajo de la tasa prevista
para su facultad»— y lo hace con cautela estadística: «con un solo curso-horario
todavía no se puede afirmar una diferencia».

Comprobado además que **la letra griega no llega a pantalla**: `τ` aparece
sólo en comentarios de código, ni en el JSX ni en los textos que publica el motor.
Su propio módulo lo dejó escrito —«"0.693" no significa nada para quien no diseñó
la muestra»—.

**Con esto Avance queda cerrada entera: 12 de 12 gráficos.**

### El gráfico de «Lo que falta para cerrar» se bautizaba a sí mismo

Su `aria-label` abría con **«Escalera de esfuerzo»**. Dentro del código la
metáfora se entiende —los peldaños son aulas que se van cerrando, y el módulo lo
explica— pero quien no ve la pantalla oye un nombre propio que nadie le ha
definido, **y es lo único que oye del gráfico**. El panel ya se llama «Lo que
falta para cerrar»; el `aria-label` tiene que decir qué se está mirando, no
ponerle nombre:

> Cursos-horario que se cierran según lo que cuestan: con N encuestas cierran los
> M; K necesitan cinco o menos

**Censo de «esfuerzo» antes de tocar, porque la palabra está por todo el
módulo**: casi todos los usos son nombres de variable y comentarios. En pantalla
sólo hay dos, y el otro **se define solo** —«Con la mitad del esfuerzo —N
encuestas— se cierran…»—, así que se queda.

**Y de paso, un error mío que el gate cazó en el acto**: puse el comentario JSX
*entre los atributos* del `<svg>`, que no es sintaxis válida. Typecheck en 2 y
seis archivos rotos. El comentario va antes del elemento.

147 archivos / 1.738 tests, typecheck limpio.

### Vuelta 32 · Barrido de metáforas, y una función que se contradecía entre sus ramas

Tras el «Escalera de esfuerzo» tocaba preguntar qué otros gráficos se bautizan en
vez de describirse. De los siete que quedaban, **cinco describen bien** —«N
cursos-horario, M cumplen», «N cursos-horario cubren el X % de lo que falta»,
«Efectivas»/«Faltan» con el eje en «respuestas»— y tres llevan metáfora **en el
nombre del componente**: colchón, embudo, cadena.

| Metáfora | ¿Llega a pantalla? |
|---|---|
| embudo | **no** — sólo símbolos y comentarios |
| colchón | sí, en un subtítulo; es de uso común en español administrativo y se entiende |
| cadena | sí, y **está definida en su panel**: «Cadena de reemplazos» |

**Tres falsas ausencias de mis propios greps en un solo barrido**, y la tercera es
nueva: `grep -v "Aulas[A-Z]"` se aplica a la **línea entera de salida, que
incluye el path**, así que borró todas las líneas de `AulasCadenaChart.tsx` —el
archivo que buscaba— y me devolvió «no aparece» sobre un `aria-label` que empieza
por «Cadenas». Un filtro que casa con el nombre del archivo elimina el archivo
entero.

**El hallazgo real está en `dondeEstanLasOtras`**, y es de los que se ven leyendo
la función entera: sus **tres ramas explican lo mismo y una se desvía**.

| Rama | Decía |
|---|---|
| dormidas + banco | «esperan en reserva —**sólo entran si cae su titular**— y N están en el banco» |
| **sólo banco** | «están en el banco, **sin asignar a ninguna cadena**» |
| sólo dormidas | «esperan en reserva: **sólo entran si cae su titular**» |

Dos ramas explican el mecanismo con palabras que no exigen saber nada del diseño;
la del medio lo nombra con un término del modelo de datos que **sólo se define
tres secciones más allá**, en el panel «Cadena de reemplazos» de Consultas. Quien
lee este pie está en Resumen. Pasa a «sin un titular al que respalden», que es lo
mismo dicho como lo dicen sus hermanas.

**El fixture del test costó dos intentos y eso enseña algo del componente**: la
rama del medio no se alcanza poniendo `en_reserva = banco`, porque `enJuegoDe`
descuenta las dormidas **y** el banco, así que `fuera` acaba siendo el doble. Se
alcanza con banco y **sin** reservas encadenadas: un estudio con banco y ninguna
cadena montada. Comprobado que muerde: con la frase vieja, rojo en ese test y
sólo en ése.

147 archivos / 1.740 tests, typecheck limpio.

### Vuelta 33 · Aritmética de los de fuera de Avance, y un inventario mío que sobraba en uno

**Los dos de reserva, conformes.** `consumoDeCadena` distingue los roles con su
motivo escrito —«El banco NO es una cadena»— y la aritmética cierra sobre datos
reales: 174 titulares + 1.173 reservas encadenadas + 77 de banco = 1.424, que es
la agenda entera; las 174 cadenas tienen reserva, ninguna se queda sin, y las 18
reservas con parte son exactamente las 18 que el motor cuenta como `reemplazada`.

**`AulasBrechaEstratoChart` no se pinta, y el repo ya lo sabía.** Está declarado
en `componentesSinMontar.test.ts`, un guard que existe precisamente porque «un
componente definido y nunca referenciado no lo ve nadie: ni el typecheck, ni los
tests, ni el gate visual, que sólo mira lo que se dibuja».

De modo que **mi inventario de la indicación H sobraba en uno**: son **22
gráficos en pantalla**, no 23. Conté por definición y no por montaje — el mismo
error de leer imports como usos que ya me pasó con `AulasCuotasResumen`, ahora al
revés.

**Lo que la medición sí aporta, y va a su marca.** El componente ya explicaba por
qué se retiró —el estrato del sorteo lleva el sexo *dominante del aula* y no el
del alumno; «cómo vas a poner mayoría hombres o mayoría mujeres cuando eso no me
interesa»— y que no se borra sin decidirlo aparte. Le faltaba la cifra que hace
peligroso volver a montarlo:

| | |
|---|---|
| Brecha sumada sobre los 72 estratos | **891** |
| Brecha del estudio entero | **170** |
| Válidas, en los dos | **2.668** |

No es un error de cuenta: el estrato es `facultad / sexo / tamaño` y sus brechas
no se compensan entre grupos de tamaño, mientras la cuota se mide sobre
`facultad / sexo`. Como el componente publica `brechaTotal`, montado tal cual la
pantalla diría «faltan 891» a dos paneles de un «faltan 170». Queda escrito en su
cabecera, que es donde lo leerá quien decida montarlo.

249 archivos / 2.561 tests de Monitoreo en verde.

### Vuelta 34 · «Qué medio agenda mejor» hablaba de 121 de 152 sin decirlo

El módulo descartaba en silencio toda fila sin `contact_medium`:

```ts
const medio = texto(fila.contact_medium);
if (!medio) continue;
```

**Pero el descarte no era todo ilegítimo, y eso hubo que medirlo antes de
repararlo.** De las 1.188 filas contactables sin medio declarado:

| Rol | Filas | ¿Es un fallo? |
|---|---|---|
| `chain_reserve` | **1.173** | **no** — una reserva dormida no se ha contactado y no tiene por qué declarar medio |
| `titular` | **15** | sí en 13 de ellas, que **ya están aplicadas** |

Acotado a lo que de verdad es un hueco: **de las 152 filas con parte, 31 no
declaran por qué medio se agendaron** —13 titulares y 18 reservas activadas—.
Alguien las contactó y no dejó por dónde. El panel decía «Llamada agenda el X %»
sobre las otras 121 **como si fueran todas**: una de cada cinco fuera del cálculo
y ni una palabra.

Ahora el panel abre diciendo sobre cuántas se mide y cuántas quedan fuera. Va
arriba y no al pie: quien lee un porcentaje necesita saber antes sobre cuántos
casos se calcula.

**El módulo ya tenía la disciplina y no la había aplicado a este descarte**:
contaba `intentosDescartados` para los intentos fuera de rango. La misma idea, un
descarte más arriba.

Tres casos nuevos: la aplicada sin medio cuenta; la que no tiene parte **no**
cuenta —es el caso de las 1.173 dormidas, y contarlas sería una falsa alarma—; y
el banco no entra ni aplicado, porque no se contacta. Comprobado que muerde: sin
la cuenta, rojo en el primero.

Vista `ok=true`, 0 issues, 0 de geometría. 147 archivos / 1.743 tests.

**Los otros tres de la tanda, conformes**: el embudo tiene su guarda de cero una
línea antes de dividir y publica `descuadre` y `pasosSinDeclarar` en vez de
inventar pasos; `agendaPorDia` y `concentracionBrecha` cierran sus cuentas.

### Vuelta 35 · El barrido de descartes silenciosos: cero muerden hoy, y por qué eso no basta

Tras el defecto del medio de contacto tocaba preguntar quién más tira filas sin
contarlas. Treinta módulos del perfil usan `continue`; medidos sobre el corte
real, **ninguno de los descartes se lleva un solo caso**:

| Módulo | Descarta por | Casos en este corte |
|---|---|---|
| `produccionPorAplicador` | sin `applied_by`, sin efectivas | **0** |
| `ritmoPorFacultad` | parte sin fecha | **0** |
| `parteContraPlataforma` | parte sin código | **0** |
| `registroPorFacultad` | fila del plan sin facultad | **0** de 1.424 |

**Y varios de los que parecían no contar, sí cuentan**: `coberturaPorAula` lleva
`sinMeta`, `perdidaDelControl` lleva `sinRevisar`, `consumoDelBanco` lleva
`sinFecha` y `aulaRealVsAgendada` lleva `sinSalonAgendado`. Mi detector los
marcó como infractores porque buscaba otras palabras: **un barrido por
vocabulario del código encuentra lo que su autor llamó igual que yo**, no lo que
hace lo mismo con otro nombre.

**Dos errores de medición míos en el mismo barrido**, y el segundo casi produce
un hallazgo falso de los grandes: medí «partes sin facultad» sobre
`partes_campo` y salió **152 de 152**, que leído deprisa es «el panel de registro
sale vacío». `facultadesDelRegistro` itera el **plan** —donde `faculty` está en
las 1.424 filas— y usa los partes sólo como conjunto de códigos. Medir el
conjunto equivocado da una alarma perfecta.

**Lo que este cero no dice.** Que ningún descarte muerda hoy no prueba que la
disciplina esté: los cuatro siguen sin contar lo que tiran, y el día que un
estudio traiga partes sin aplicador o sin fecha desaparecerán del panel igual que
desaparecían las 31 del medio de contacto. Queda declarado como **vacío por
fixture**, no como conformidad: es la diferencia entre «comprobado que no pasa» y
«comprobado que no puede pasar».

Los descartes legítimos —el banco, las dormidas, las reemplazadas en la cola de
contacto— se quedan como están: descartar lo que no pertenece al universo no es
lo mismo que perder un caso que sí.

### Vuelta 36 · El badge de «Reemplazos» decía 1.347 y los reemplazos son 18

Primer hallazgo de la indicación C fuera de Avance, y salió de cruzar los badges
del rail entre sí —que es el método 1 de este loop: dos superficies que dicen lo
mismo con nombres distintos—.

Los cinco badges del rail, medidos a la vez:

| Pestaña | Badge | Qué cuenta |
|---|---|---|
| Avance > Resumen | 98 | `kpis.brechas`, cursos-horario bajo su meta |
| Avance > Cuotas | 9 | celdas de cuota sin cerrar (30 − 21) |
| Avance > Estratos | 43 | estratos con brecha |
| Consultas > Brechas | 98 | el mismo 98, desde `dashboard.brechas` — coherente |
| **Consultas > Reemplazos** | **1.347** | `dashboard.reemplazos.length` |

**`dashboard.reemplazos` trae el plan entero sin banco**: 1.347 filas, de las que
1.155 son reservas dormidas y 165 están agendadas sin haberse movido nunca. Los
reemplazos que de verdad ocurrieron son **18**, y en eso coinciden tres fuentes
independientes: las filas con `replaced_at`/`activated_at`, las que están en
estado `reemplazada`, y el reparto `course_status_estados` del motor.

**La intención estaba escrita en el propio comentario** —«Pendiente = cadenas
movidas; sin ninguna, no hay nada que revisar»— y la cuenta decía otra cosa. Un
badge es un número desnudo al lado de una etiqueta: 1.347 junto a «Reemplazos» se
lee como mil trescientos reemplazos.

El archivo **no tenía ningún test**; ahora tiene tres, incluido el que distingue
«reagendada» de «reemplazada» para que un estado parecido no se cuele por el
prefijo. Comprobado que muerden: con la cuenta vieja, los tres rojos.

**Comprobado además dónde queda el 1.347 en pantalla**: sólo en «Mostrando 400 de
1.347 filas», el aviso de recorte de la tabla, que es correcto y honesto.

**Anotado sin tocar**: esa tabla lista las 1.347 filas bajo una pestaña llamada
«Reemplazos». Puede ser deliberado —para elegir un reemplazo hay que ver las
cadenas disponibles— y cambiar qué lista una tabla es decisión de producto, no de
QA. Queda dicho.

147 archivos / 1.746 tests, typecheck limpio, vista sin issues.

### Vuelta 37 · «Reemplazos usados: 174» en la hoja que ve el cliente

El badge de la vuelta 36 llevó al patrón, y el patrón llevó fuera del perfil.

`reemplazos_usados` **no cuenta reemplazos**: suma reservas con
`replacement_for` en estado agendada / en campo / aplicada / cerrada / parcial,
o sea reservas **en juego**. Sobre HSVG2026 «como 2025» vale **174** —el número
de titulares— mientras los titulares que de verdad se cayeron y fueron
sustituidos son **18**.

**Y el frontend ya lo sabía, en tres sitios**: `embudoDelOperativo.ts` lo dice
con todas las letras —«`reemplazos_usados` no cuenta reemplazos»— y recibe en su
lugar el tramo `reemplazada`; `kpisDeAulas.ts` repite la advertencia; y el badge
del rail cayó en él y se reparó ayer. **Ninguna de las tres advertencias llegó al
motor de publicación**, que seguía escribiendo en la hoja del cliente:

| Indicador | Valor |
|---|---|
| Aulas planificadas | 1.347 |
| Aulas aplicadas | 152 |
| **Reemplazos usados** | **174** |
| Respuestas validas | 2.668 |

Ahora esa fila dice **«Cursos-horario reemplazados: 18»**, tomando el tramo
`reemplazada` del reparto que el motor ya publica. **También cambia el rótulo**:
«Reemplazos usados» nombraba una cantidad que la hoja no publicaba, y dejarlo con
la cifra nueva sólo cambiaría de qué mentía.

Cuatro casos nuevos en una suite propia, incluido el mutante —si alguien
devolviera el KPI, el test lo ve porque le pone 999— y el de un payload viejo sin
reparto, donde la cifra honesta es **cero** y no el KPI. Comprobado que muerden:
con la versión anterior, los cuatro rojos y el de las demás cifras verde.

**El recorrido completo, que es la lección**: badge del rail → el módulo que ya
advertía del KPI → quién más lo usa → el entregable. Tres advertencias escritas
en el frontend no protegen al backend, y la que llega al cliente es la del
backend.

Suites verdes: la nueva, `test-monitoreo-publish-qa.R` y
`test-monitoreo-aulas-universitarias.R`.

### Vuelta 38 · Un universo con respaldo dentro, en dos sitios más — y una rama muerta

Tirando del hilo del KPI, el mismo universo apareció otras dos veces.

**`total_aulas` cuenta el plan sin banco: 174 titulares más 1.173 reservas.** Y
el propio motor ya separa las dos cosas —`seguidas` es el plan sin banco y
`tracked_df` sólo las que están en juego—, con un comentario que lo explica
entero: «fuera el banco y fuera los eslabones dormidos de cada cadena: de `CH 5`
→ `R 5.1` → `R 5.2` sólo una está en juego a la vez». El KPI usa `seguidas`.

**1. La hoja del cliente.** Publicaba «Aulas planificadas 1.347» junto a «Aulas
aplicadas 152»: quien lo lee hace 152 de 1.347 y ve un **11 %** donde va un
**87 %**. Ahora publica las dos con su nombre —«Cursos-horario a aplicar: 174» y
«Cursos-horario del plan, con reservas: 1.347»—, porque quitar la segunda
perdería información real.

**2. El badge de «Registro de campo».** Decía `total_aulas − aplicadas` =
**1.195** donde esperan parte **22**. Y al ir a repararlo apareció que **nunca se
pintaba**: la rama comprobaba `seccion === "modelo"` y la pestaña se declara en
el catálogo como `calidad/registro`. La medida estaba escrita, con su comentario
y su intención —«Nunca "listo": siempre puede entrar otra aplicación»— y no
casaba jamás.

**Barrido de las siete ramas del rail contra el catálogo**: seis casan, una
—`modelo/registro`— no existía. Es la única. Ahora hay un guard que lo comprueba
sobre la fuente, porque **una rama muerta no se ve de ninguna otra forma**: no
rompe el typecheck, no rompe ningún test, y en pantalla sólo falta un número que
nadie echa de menos. Comprobado que muerde: nombra al infractor por su clave.

**Tres superficies con el mismo universo en tres vueltas** —el pronóstico de
cierre, la hoja del cliente y este badge—, todas con la misma forma: contar el
respaldo como si fuera trabajo pendiente. Cuando el motor tiene dos variables
para el mismo conjunto (`seguidas` y `tracked_df`), la pregunta útil es cuál
usa cada consumidor.

147 archivos / 1.750 tests, typecheck limpio, suites de R verdes.

### Vuelta 39 · El barrido de `total_aulas`, cerrado — y un espejo que no lee nadie

Aplicada la regla de la vuelta 38 —cuando el motor tiene dos variables para el
mismo conjunto, la pregunta es cuál usa cada consumidor—, los cinco consumidores
de `total_aulas`:

| Consumidor | Veredicto |
|---|---|
| `railDeAulas` (badge de Registro) | reparado en la vuelta 38 |
| `monitoreo_engine` (hoja del cliente) | reparado en la vuelta 38 |
| `kpisDeAulas.ts` | **ya estaba bien**, y con el mismo razonamiento: usa `aulas_titulares` y publica las reservas aparte en la pista |
| `handoffSummary` | **correcto con el universo grande**: es la entrega a campo, y todas las aulas necesitan su ficha, reservas incluidas |
| `router_monitoreo.R` (espejo al home) | **sin consumidor** |

**`kpisDeAulas` ya llevaba la reparación y tampoco se propagó.** Su comentario
describe el mismo defecto —«dos cifras casi con el mismo nombre a un dedo de
distancia»— y la misma solución. Van tres veces en este loop que una doctrina
escrita en un módulo no llega a sus vecinos: la brecha por celdas, el KPI de
reemplazos y ahora ésta.

**El espejo del router no lo lee nadie**: ni el frontend ni R consumen
`kpis$aulas_total`, `kpis$aulas_aplicadas` ni `kpis$respuestas_validas_aulas` de
este dashboard —los `aulas_total` que aparecen en el frontend son de Cálculo de
muestra, otro campo con el mismo nombre—. No es defecto, pero sí un riesgo
latente: quien lo conecte al home publicará 1.347 junto a 152. Queda anotado
**donde se escribe**, con la cifra y con qué campo usar en su lugar.

**Lo que NO pude verificar, y lo digo**: el badge no aparece en el `report.json`
del QA visual, porque ese informe sólo lista elementos con atributos de
geometría y el rail queda fuera del panel medido —lo mismo que pasó en la vuelta
21 con la línea del avance—. La evidencia del badge son sus siete tests con
prueba del reverso, no una captura.

147 archivos / 1.750 tests, typecheck limpio, suite de publicación verde.

### Vuelta 40 · La doctrina «contra la cuota, no contra el pronóstico», barrida

Aplicado el patrón más productivo del loop —una doctrina escrita en un comentario
no llega sola a sus vecinos— sobre el índice de decisiones documentadas del
perfil. La primera candidata era de denominador, y es de Gonzalo, textual:

> «el avance se mide sobre las cuotas del plan, no sobre lo que nosotros hemos
> pronosticado que va a suceder… nos interesa llegar a dos mil quinientos con las
> cuotas que hemos establecido por sexo en cada facultad. Esa es nuestra meta».

El pronóstico se sigue publicando como `meta_prevista` «porque dimensiona el
operativo, pero no es la vara del avance».

**Nadie lo usa como denominador**: `meta_prevista` no tiene un solo consumidor en
el frontend. La doctrina se cumple.

Y de paso la medición deja la cifra, que no estaba escrita en ningún sitio:

| | |
|---|---|
| Suma de cuotas (la meta) | **2.500** |
| Suma de `meta_prevista` (lo diseñado) | **3.146** |
| Facultades donde difieren | **15 de 15**, siempre al alza |

O sea, el diseño compró aforo para 3.146 personas para asegurar 2.500.

**Parecía un vacío por desconexión —el motor lo calcula y nadie lo muestra— y no
lo es.** La relación entre lo observado y lo previsto **sí llega al lector**, por
otra vía y mejor: `etiqueta_calibracion` la publica en porcentaje y **por celda**
—«El campo está rindiendo un 14 % menos de lo previsto», 18 % en Ciencias
Sociales mujeres, 7 % en EE.GG. Letras mujeres— y se pinta en Cuotas. Un total de
estudio en personas sería la misma información, menos accionable y en una
pantalla que ya recibió una línea nueva en este loop.

**Un campo sin consumidor no es una brecha si su información llega por otro
camino.** Comprobarlo cuesta una medición y evita añadir una cifra redundante a
una pantalla densa.

### Vuelta 41 · «Cumple quien no debe nada», barrida — y un caso límite sin definir

Segunda doctrina del índice, y toca el norte del encargo. Cinco sitios deciden si
algo cumple:

| Sitio | Criterio | Veredicto |
|---|---|---|
| `piramideDeCuota` | `faltan === 0` | correcto (vuelta 19) |
| `serieDeRendimiento` | `celda.faltan === 0` | correcto |
| `perfilPorFacultad` ×2 | `falta === 0` | correcto |
| `historiaDeCadena` | `validas >= meta` | **correcto**, y aquí está el matiz |

El quinto parecía el infractor —usa la suma y no lo que falta— pero **su grano es
un aula**, y un aula no tiene sub-celdas de sexo: no hay nada que compensar
dentro. La doctrina prohíbe sumar por encima de las celdas, no sumar dentro de
una. Cinco de cinco.

**Leyendo la función entera aparece otra cosa**, que es el método que más ha
dado: `queCerro` busca el primer eslabón que cumple **por sí solo**, mientras las
`validas` de la cadena **suman todos los eslabones**. Si un titular dejara 10 de
20 y su reserva 15, la cadena tendría 25 sobre 20 y saldría como **«abierta»**.

**Medido: 0 casos en las 174 cadenas de este corte.** Y no lo reparo, porque no
está claro que sea un defecto: «qué eslabón cerró» tiene una respuesta legítima
—ninguno— cuando ninguno llegó solo, y decidir si una cadena «cerró» por la suma
de sus intentos parciales es una decisión de dominio, no de QA. Queda declarado
con su cifra para que se decida cuando aparezca el primer caso.

**Vacío por fixture, otra vez, y por eso se dice**: cero hoy no es cero siempre.
Un titular parcial más una reserva parcial es un escenario perfectamente posible
en un operativo con aulas que se cortan a medias.

### Vuelta 42 · Un vacío que mandaba a revisar el enlace cuando lo que falta es el sexo

Tercera doctrina del índice: **hay dos atribuciones distintas y confundirlas
manda a revisar lo que no es**. La respuesta se atribuye a una celda sexo ×
facultad —que necesita el sexo— y a un curso-horario —que va por el enlace del
recopilador—, y una puede fallar con la otra funcionando.

`kpisDeAulas` documenta el caso ya cometido y corregido en su tarjeta:

> «la tarjeta decía "ninguna atribuida a un curso-horario" mientras dos paneles
> más abajo se contaban 1.471 respuestas cubriendo la meta de sus aulas y 20
> aulas en meta. Las dos cifras eran correctas y el rótulo era el que mentía:
> faltaba el sexo, no el aula, y mandaba a revisar el enlace en vez del mapeo de
> la variable.»

**Y esa corrección no había llegado al vacío de la serie por sexo**, que decía
«Sin respuestas atribuidas a un curso-horario no hay serie por sexo». Su
condición es `hayObservadasPorSexo`, que sale de las celdas de cuota con
`observadas > 0` —y esas celdas se llenan con el sexo—. Si están todas en cero,
lo que falta es el sexo; el enlace puede estar perfecto.

Ahora dice **«Ninguna respuesta trae el sexo declarado»**, que es lo que hay que
ir a arreglar.

**Los otros dos sitios que hablan de atribución al curso-horario son correctos**:
el estado vacío de la tabla de aulas y el comentario que explica por qué el
pronóstico proyecta aulas y no respuestas. Ahí el enlace **sí** es el tema.

**Cuarto caso del patrón en el loop**: una doctrina escrita en un módulo no llega
a sus vecinos. Van la brecha por celdas, el KPI de reemplazos, el universo con
respaldo y ahora las dos atribuciones. El método que los encuentra es siempre el
mismo —leer el comentario que explica una decisión y preguntar quién más debería
cumplirla— y ya es lo que más ha rendido.

Dos casos nuevos; comprobado que muerden: con el texto viejo, rojo en el primero.
147 archivos / 1.752 tests, typecheck limpio.

### Vuelta 43 · Los tres numeradores de «lo conseguido», y dos sondas mías que midieron mal

Cuarta doctrina del índice, y es de la familia que más ha rendido:

> «lo conseguido recorre tres numeradores distintos: la efectiva de plataforma
> —la única que el ADR 0082 reconoce como τ—, la cuenta del aplicador en el
> parte, y lo que la hoja da por enviado. Con más de uno en juego, el faltante de
> un aula NO es comparable con el de su vecina.»

`loQueFaltaParaCerrar` los recorre en orden y **declara cuál usó**, y
`AulasLoQueFalta` avisa cuando se mezclan: «Ojo al comparar: N miden con las
respuestas de la plataforma, M con lo que anotó el aplicador…».

**Sobre este corte no hay mezcla, y el panel está vacío diciendo por qué**: «El
libro todavía no evalúa ningún curso-horario, así que no se puede decir cuáles se
quedaron cortas». Vacío legítimo con su causa declarada, que es lo que C5 pide.

**Comprobado además el caso que ya mordió dos veces en este loop**: `num("")`
devuelve `null` y no cero —`Number.parseFloat("")` es `NaN`—, así que una cadena
vacía en `effective_surveys` no se lee como «cero conseguidas». Aquí está bien
resuelto.

**Dos sondas mías midieron mal antes de dar con esto**, y las dos con la misma
falta: preguntarle a la estructura equivocada.

1. Conté los tres orígenes sobre `control_calidad` y me salió «hoja: 304», que
   parecía un dato. **Esa estructura no trae ninguno de los tres campos**: es el
   control por sexo —`operational_code, faculty, sexo, n, cumple_total,
   cumple_poblacion, cumple_meta, criterio, efectiva`— y todo caía en la última
   rama por ausencia, no por origen.
2. Repetí sobre `agenda` y salió lo mismo, porque ahí `effective_surveys` viaja
   como **cadena vacía**; los partes sí la traen con valor.

Es la tercera vez en el loop —tras «152 de 152 partes sin facultad» y el reparto
de badges— que una sonda contra el conjunto equivocado produce una alarma
perfecta. **Antes de leer un conteo, mirar si la estructura tiene el campo.**

### Vuelta 44 · «Casi todas descuadran → no es el campo, es el mapeo», barrida

Quinta doctrina del índice, y es la que más se parece a la indicación I: un panel
que liste «151 de 152 descuadran» **estaría acusando al equipo de un error de
configuración**.

Los cuatro módulos que comparan dos fuentes, comprobados:

| Módulo | Cómo cumple |
|---|---|
| `parteContraPlataforma` | es donde la doctrina está escrita, con su umbral |
| `aulaRealVsAgendada` | **la cumple y la mejora**: nombra cuál de las dos hojas falla |
| `embudoDelAula` | sólo publica descuadre si los pasos están declarados |
| `loQueFaltaParaCerrar` | declara el origen de cada numerador |

**`aulaRealVsAgendada` es el ejemplar.** Cuando no hay nada comparable dice «el
plan agendado no trae salón para ningún curso-horario, así que no hay contra qué
comparar», y su comentario guarda el defecto anterior: «"N sin salón reconocible
en una de las dos hojas" manda a revisar el libro de campo cuando el que falta es
el plan». La rama general también nombra cuál falla **cuando una sola lo
explica**, y sólo dice «una de las dos» cuando de verdad fallan las dos.

**`embudoDelAula` cierra el mismo hueco por otro lado**: su descuadre sólo se
publica `conRechazos && conDuplicados`, porque —según su propio comentario—
«producía un descuadre de 2.791 que era el hueco de los pasos que faltan». Un
descuadre calculado sobre pasos sin declarar no mide el campo: mide lo que no se
anotó.

**Medido en el corte**: cero aulas comparables por salón —ninguna fila trae
`actual_room`— y el panel lo dice con su causa. Vacío legítimo declarado.

**Cinco doctrinas barridas, un defecto encontrado** (el vacío de la serie por
sexo, vuelta 42). Las otras cuatro se cumplían, y tres de ellas con más cuidado
del que el índice prometía. El método sigue valiendo: es más barato comprobar una
doctrina que buscar defectos a ciegas.

### Vuelta 45 · «Aplicada sin fecha agendada», barrida — y una pregunta que no me toca a mí

Sexta doctrina, y es una regla del operativo tuya: «si no se agenda un aula, no se
aplica; esa situación no puede suceder». Por eso la combinación no es un estado
sino un **descuadre**: se cuenta, no se bloquea, y no suma a `agendadas`.

**Cumplida, y el KPI la publica bien**: el tile «Aplicadas sin agenda» aparece
**sólo cuando las hay**, porque —dice su comentario— «un "0 descuadres"
permanente entrena a no mirarlo». Medido en el corte: **0 descuadres**, las 152
aplicadas tienen fecha.

**Lo que apareció al medir es otra cosa, y es de dominio.** «Agendada» se define
de dos maneras en el perfil:

| Criterio | Cuántas (sobre las 174 en juego) |
|---|---|
| Por **fecha** (`agendamiento`) | **174** |
| Por **estado** (`medioDeContacto`) | **165** |
| Discrepan | **9** |

Las nueve están en estado `sin_contactar` **y tienen fecha, medio declarado y 3 a
5 intentos**. O sea: se intentó contactarlas varias veces y no se logró.

El módulo elige la fecha con un criterio explícito —«manda el hecho»— y excluye a
esas nueve del tile de riesgo con otro igual de razonado: «una que costó cuatro
llamadas pero ya está agendada no es un pronóstico, es una historia». **Están
declaradas** en «Cuestan más de una gestión», así que no desaparecen.

**La pregunta que queda, y es tuya, no mía**: esas nueve tienen fecha pero nadie
logró contacto. Si `scheduled_date` sale de una cita cerrada, «Agendadas 174 ·
Por agendar 0» es correcto. Si sale del horario en que ese curso se dicta —y algo
apunta a eso: **las 1.347 filas la traen, incluidas las 1.173 reservas dormidas
que nadie ha agendado**—, entonces esas nueve no están agendadas, y el panel dice
que no queda nada por agendar cuando quedan nueve con cinco intentos fallidos.

No lo cambio: el criterio actual está razonado y documentado, y sustituirlo por
otro sin saber de dónde sale la fecha sería cambiar una decisión tuya por una
suposición mía. Queda como **bloqueado**, no pendiente.

### Vuelta 46 · La pregunta bloqueada, contestada por evidencia — y «Por agendar 0» escondía nueve

La vuelta anterior dejó bloqueada una pregunta de dominio: ¿`scheduled_date` es
una cita cerrada o el horario del curso? **Se podía contestar sin preguntar, y
así se hizo.**

| Evidencia | Qué dice |
|---|---|
| El campo se lee de la columna «FECHA AGENDADA» / «FECHA DE APLICACIÓN» del Excel | parecía una cita |
| Las **1.173 reservas dormidas** la traen, y nadie agenda una reserva dormida | no puede ser sólo cita |
| **1.137 de esas 1.173 tienen fecha DISTINTA de la de su titular** | no es herencia: es la fecha de **su propio** curso-horario |

O sea: **la columna llega pre-rellenada con la fecha prevista de cada
curso-horario**, y el agendador la confirma o la cambia. Tener fecha **no prueba
que haya cita**.

**Y ahí el panel se contradecía consigo mismo.** `kpisDeAulas` abre diciendo que
«agendar es llamar al docente y cerrar una cita» y contaba «Agendadas» por tener
fecha. Con las nueve del corte —fecha, medio declarado y de tres a cinco
gestiones, estado `sin_contactar`— publicaba **«Agendadas 174 · Por agendar 0»**:
cero por agendar mientras nueve llevan cinco intentos sin lograr contacto.

**No se cambia el criterio, se añade lo que faltaba.** Contar por fecha sigue
siendo correcto para «cuántas se pueden visitar», que es lo que `agendamiento`
mide y lo que su comentario declara. Lo que no puede pasar es que «Por agendar 0»
las esconda, así que hay un tile nuevo —**«Sin contacto logrado: 9 · tienen fecha
prevista y nadie ha confirmado con el docente»**— que sigue el patrón del propio
archivo: aparece sólo cuando las hay, porque «un "0" permanente entrena a no
mirarlo».

Tres casos nuevos, incluido el que evita la doble cuenta: una **sin** fecha y sin
contactar no entra aquí, porque ésa ya está en «Por agendar». Comprobado que
muerden. Verificado en pantalla: el tile sale junto a «Agendadas» y «Por
agendar».

**La lección**: dejé la pregunta como bloqueada y era contestable con tres
mediciones. Antes de escalar una decisión de dominio, conviene agotar lo que el
dato ya dice.

### Vuelta 47 · Dos cursos-horario comparten enlace y nada lo dice

Del patrón nuevo —campos que llegan pre-rellenados y se leen como hechos— salió
primero un barrido limpio y después un hallazgo que no esperaba.

**El barrido, limpio.** De los campos que traen las 1.155 reservas dormidas, sólo
`scheduled_date` engañaba (vuelta 46). `contact_attempts` viene como **cero
explícito**, no como pre-relleno: los 174 titulares sí tienen intentos > 0.
*(Mi primera medición dijo «100 %» porque contaba la presencia del campo y `"0"`
es una cadena presente. Cuarta vez que una sonda mía mide lo que no es.)*

**El hallazgo**: los enlaces del recopilador **colisionan entre cursos-horario
distintos**.

| | |
|---|---|
| Filas que salen a campo | **192** |
| Enlaces distintos | **158** |
| Enlaces compartidos por cadenas distintas | **25** |

El enlace lleva el `classroom_id` **truncado**:

```
CH 11   id="1ind53_0833"   link=".../1ind53_0"
CH 35   id="1ind53_0832"   link=".../1ind53_0"
```

Dos aulas que sólo difieren en el último dígito reciben **el mismo formulario**.
Los `classroom_id` **no** colisionan —192 distintos para 192 filas—, así que el
truncamiento ocurre al construir el enlace, fuera de la app: ni el anonimizador
ni el motor tocan ese campo, viene del proyecto.

**Lo que sí es de la app: nadie lo detecta.** Comprobado en tres sitios —los
motores de `monitoreo_aulas_*`, la carga de `carga_aulas_*` y el catálogo de
reglas del control de calidad, cuyas siete claves son `campo`, `cuenta`,
`cuotas`, `curso`, `duracion`, `esperado`, `horario`—. Ninguna mira el enlace.

**Por qué importa**: la atribución de una respuesta a su curso-horario va por el
enlace del recopilador. Con 25 enlaces sirviendo a dos aulas cada uno, esas
respuestas no se pueden separar, y el estudio lo descubriría al cuadrar — o no lo
descubriría.

**SIGUIENTE, con el diseño ya hecho**: una regla de control que compare los
enlaces de las filas en campo y declare los repetidos, con su lista. Va en el
control de calidad junto a las otras siete, no en un panel nuevo. No se construye
en esta vuelta para no dejar el motor a medias con el turno cerrándose.

### Vuelta 48 · El detector de enlaces compartidos, construido y medido

La regla número doce de `validation`, con el hallazgo de la vuelta anterior
convertido en control permanente.

**Sobre el proyecto real dice**:

> 51 cursos-horario comparten 23 enlaces con otro: sus respuestas entran por la
> misma puerta y no se pueden separar después (CH 20 y CH 21; CH 94 y CH 97;
> **R 110.1 y CH 109**). Revisa el enlace en el plan antes de que entre más campo.

Son más de los 25 que conté a mano, porque el motor mide sobre `tracked_df` y
algunos enlaces sirven a tres aulas. **El tercer ejemplo es el peor caso**: la
reserva de una cadena comparte enlace con el titular de otra.

**El aviso dice a dónde ir.** Sin los códigos, «23 enlaces repetidos» obliga a
buscarlos a mano en un libro de mil filas; ésa fue la razón de llevar ejemplos en
la cifra.

**Sólo mira las filas en juego**: una reserva dormida comparte enlace con su
titular por construcción —es su respaldo— y contarla sería una alarma permanente
sobre algo que no puede pasar.

**`sin_datos` cuando no hay enlaces**, no «ok»: es la regla que el resto de la
lista ya había aprendido —«"No se puede comprobar" NO es "correcto"»— y la nueva
nace con ella. Cinco casos, incluido el de los enlaces vacíos, que **no** cuentan
como repetidos entre sí: tres aulas sin enlace comparten la cadena vacía, y eso
es no tenerlo, no compartirlo.

**Dos correcciones a mi propio diagnóstico de la vuelta 47**, las dos por leer
deprisa:

1. Dije que la regla iba «en el catálogo de reglas del control, cuyas siete
   claves son campo, cuenta, cuotas…». **Eso no son reglas**:
   `MONITOREO_AULAS_CONTROL_GRUPOS` son los grupos de columnas de la Base de
   control. Las reglas viven en `validation`, que tenía once.
2. Al ver que `CHECK_LABELS` no traía la clave nueva lo llamé «lista cerrada».
   **Tiene fallback** —`CHECK_LABELS[key] ?? fallbackLabel(key)`— así que una
   clave nueva se degrada, no desaparece. La etiqueta se añade igual, porque
   «Shared collector link» no es el vocabulario de la casa.

**Lo que no pude verificar y lo digo**: el `report.json` del QA visual no captura
la lista de validación —sólo lista elementos con atributos de geometría, el mismo
límite de la vuelta 21—. Lo comprobado es que la fila viaja en el payload con
`status=review`, que `summarizeAulasValidation` **no filtra por clave** y por
tanto la cuenta entre las alertas, y que la etiqueta existe.

147 archivos / 1.755 tests, typecheck limpio, tres suites de R verdes.

### Vuelta 49 · «Nunca jamás debería pasar» — severidad y rastreo del origen

Gonzalo el 2026-08-30, al ver el hallazgo: «**cada curso-horario debe tener un
enlace al forms**».

**El control sube a `warning`.** Lo dejé en `review` y eso lo ponía al nivel de
«conviene comprobar esto»: dos aulas con el mismo enlace no producen una duda que
mirar, producen respuestas que ya no se pueden separar. Verificado en el payload:
`status=warning`.

**El rastreo del origen, hasta donde llega la evidencia:**

| Eslabón | Qué hace | ¿Trunca? |
|---|---|---|
| `pulso_anonimizar.R` | no menciona `link` ni `classroom_id` | no |
| Motor de monitoreo | no escribe `link` | no |
| Generador del libro (`carga_aulas_libro_generar`) | escribe `u$link` **tal cual** | no |
| Carga del Excel (`carga_aulas_agendadas`) | lee la columna «ENLACE DE LA FICHA» | no |
| Búsqueda de `substr`/`strtrim` sobre `link` o `classroom_id` en todo `api/R` | **cero coincidencias** | no |

**Ningún punto de la app trunca el enlace**: entra ya así por la columna «ENLACE
DE LA FICHA». El formato es de un formulario Enketo de Kobo
(`ee.kobotoolbox.org/x/<id>`), donde ese `<id>` es del formulario en Kobo, **no**
el `classroom_id` —aunque en este corte se parezcan—.

**Lo que NO pude comprobar, y lo digo**: si el estudio real colisiona igual. El
proyecto de referencia versionado `hsvg2026` **no trae operativo** —0 filas de
plan, es el de marco de aulas a escala— así que no sirve de contraste, y el único
dato es el simulacro. Con el control ya puesto, el estudio real lo dirá en cuanto
se abra.

**Dos preguntas que quedan del lado del operativo, no del código**: si los
enlaces se generan en Kobo por formulario y varios cursos-horario comparten
formulario, la colisión es de configuración allá; y si se pegan a mano en la
columna, es de transcripción. El aviso ya nombra los pares —«CH 20 y CH 21; CH 94
y CH 97; R 110.1 y CH 109»— para poder ir a mirarlos.

### Vuelta 50 · La causa del enlace compartido, probada: se truncó a ocho caracteres

Con «nunca jamás debería pasar» sobre la mesa, el aviso tenía que decir **cómo se
arregla**, no sólo que hay un problema.

**Medido, y es sistemático**: las **1.424 filas** del plan tienen la cola de su
enlace igual a los **8 primeros caracteres** de su `classroom_id`, **sin una sola
excepción**.

```
1ind53_0833  →  .../1ind53_0
1ind53_0832  →  .../1ind53_0
```

No es un error aislado: **quien generó los enlaces cortó el identificador a
ocho**, y con identificadores de once eso colisiona en cuanto dos aulas comparten
ese prefijo. El aviso ahora lo dice: «El enlace lleva sólo los 8 primeros
caracteres del identificador del curso-horario, así que dos que empiecen igual
caen en el mismo».

**No se inventa la causa cuando no se puede probar.** El diagnóstico exige que la
relación se cumpla en más del 90 % de las filas y con un único largo; si no,
devuelve `NA` y el aviso se queda en la consecuencia. Tres casos nuevos, incluido
el de enlaces que no derivan del identificador.

**Lo que quedó sin poder comprobarse, y por qué**: el `.pulso` sólo trae
`state.rds` y `manifest.json` —**sin `files/`**— así que el Excel original no está
y no se puede saber si llegó ya colisionado o si algo lo rompió al importar. Lo
que sí está descartado es que lo trunque la app: ni el anonimizador, ni el motor,
ni el generador del libro, ni la carga, y no hay un solo `substr`/`strtrim` sobre
`link` o `classroom_id` en `api/R`.

**Estado del control**: `warning`, con los pares nombrados y la causa. Doce reglas
en `validation`.

### Vuelta 51 · Mi control daba una alarma falsa, y lo corregí

**El hallazgo de las vueltas 47-50 estaba mal interpretado, y el error es mío.**

`captureUrl.ts` —y su espejo en R— define el modelo: una URL de captura es «la
dirección sobre la que se **cuelgan los parámetros de personalización por
unidad** (`?d[campo]=valor` en Kobo) y que después se convierte en QR». Es decir:
**dos aulas pueden compartir la dirección base** si cada QR lleva su
`collectorID`. Lo que separa las respuestas es el parámetro, no la URL.

Medido sobre el simulacro:

| | |
|---|---|
| Enlaces con `?` (algún parámetro) | **0** de 1.424 |
| Con `collectorID` en la URL | **0** |
| Filas con campo `qr` | **0** |
| Con `collection_unit_id` | **0** |

O sea: **el estudio está en el paso anterior**. Todavía no se han generado los
enlaces personalizados ni sus QR, y mi control declaraba **51 cursos-horario en
conflicto** sobre un estado perfectamente normal.

**Construí un control sin entender el modelo de datos completo**, y lo peor que
puede hacer un control es gritar sobre lo que está bien: entrena a no mirarlo, y
el día que avise de verdad nadie le hace caso.

**Corregido, con los tres estados que el dato admite:**

| Estado del plan | Qué dice |
|---|---|
| Enlaces base, sin parámetro | **`sin_datos`** — «Los 174 enlaces del plan son direcciones base, sin el parámetro por unidad que distingue a cada curso-horario. Se comprobará cuando se generen los enlaces personalizados y sus QR.» |
| Personalizados y distintos | `ok` |
| **Personalizados y colisionando** | `warning` con los pares y la causa |

Verificado en el payload real: `status=sin_datos` con ese detalle.

Cuatro casos nuevos, incluido el de la **mezcla** —si alguno está personalizado,
se comprueban ésos y una base sin parámetro no tapa el conflicto—. Y el
diagnóstico del truncamiento pasa a comparar la dirección **sin** el parámetro.

**Lo que sigue en pie del hallazgo**: los enlaces base se generaron truncando el
identificador a 8 caracteres —1.424 de 1.424—, así que si los QR se generan
colgando el parámetro sobre esa base, funcionarán; pero si algún flujo usa la
base como identificador, colisiona. El control lo dirá cuando lleguen los
parámetros.

### Vuelta 52 · Mi segundo aviso también afirmaba de más, y la corrección da un hallazgo mejor

Aplicada a mis propios avisos la lección de la vuelta anterior —**buscar si el
repo ya define qué es correcto para ese campo antes de avisar**— el de la vuelta
46 no aguantó el examen.

`MONITOREO_AULAS_ESTADOS_DORMIDOS` incluye `sin_contactar`, y
`monitoreo_aulas_estados_no_reconocidos.R` avisa de que ese mismo valor es
**el que sale por defecto cuando el estado no se reconoce**: «"aplicada",
"contactada", "en campo", "cerrada", "parcial" y "efectiva" salen las seis como
`sin_contactar`».

Miradas de cerca, las nueve traen **dos estados que se contradicen**:

```
sample_status      = "sin_contactar"
operational_status = "agendada"          ← dice lo contrario
contact_date       = ""                    con 3 a 5 gestiones
```

Los tres pares que existen en el plan en juego:

| `sample_status` / `operational_status` | Filas |
|---|---|
| agendada / aplicada | 152 |
| agendada / agendada | 13 |
| **sin_contactar / agendada** | **9** |

**Mi tile decía «Sin contacto logrado · nadie ha confirmado con el docente», y
eso elige uno de los dos estados como verdadero sin poder probarlo.** Uno está
desactualizado y desde el frontend no se puede decidir cuál.

Ahora dice lo que sí es un hecho: **«Estados que se contradicen · el estado de
muestra dice "sin contactar" y el operativo, que ya está agendada»**. Es más
corto, es comprobable, y manda a corregir el registro en vez de a llamar a un
docente que quizá ya confirmó.

Tres casos nuevos: la fila donde los dos estados dicen «sin contactar» —que **no**
es contradicción, es una por agendar—, la que el operativo da por aplicada o
cerrada —contradicción mayor—, y la que no trae estado operativo, donde no se
afirma nada. Verificado en pantalla: el tile nuevo sale y el anterior ya no.

**Dos avisos míos corregidos en dos vueltas seguidas**, los dos por lo mismo:
afirmar una causa cuando el dato sólo soporta un hecho. El patrón para no
repetirlo: *si para escribir el aviso hay que elegir entre dos campos que
discrepan, el aviso es la discrepancia*.

147 archivos / 1.758 tests, typecheck limpio.

### Vuelta 53 · Tercer aviso mío corregido, y el patrón que los explica todos

Pasada la misma vara al último de mis avisos de este loop, el de la vuelta 34
tampoco aguantó. De las 31 «aplicadas sin medio»:

| | |
|---|---|
| `chain_reserve` con **cero intentos** | **18** |
| titulares con 1 a 7 gestiones | **13** |

**Las 18 reservas no tenían por qué declarar medio**: entraron al caer su titular
y heredaron la cita, así que nadie las contactó. Contarlas como hueco de registro
era una falsa alarma sobre el 58 % del aviso.

Ahora sólo cuenta las que **tuvieron gestión** —parte, `contact_attempts > 0` y
sin medio—: **13**, que sí son un hueco real. Verificado en pantalla: «Se mide
sobre 159 cursos-horario: 13 se gestionaron y no dejaron dicho por qué medio».

### Los tres avisos, y qué tenían en común

| Vuelta | Decía | Dice |
|---|---|---|
| 47-50 | «51 cursos-horario comparten enlace» | `sin_datos`: son bases sin personalizar, el paso anterior |
| 46 | «Sin contacto logrado · nadie ha confirmado» | «Estados que se contradicen» |
| 34 | «31 ya aplicados no dejaron dicho por qué medio» | «13 se gestionaron y no dejaron dicho por qué medio» |

**Los tres cometían la misma falta con tres disfraces**: contar dentro de una
alarma casos que son normales. El enlace base compartido es el paso previo; una
reserva activada no se contacta; un `sin_contactar` puede ser un estado sin
mapear. En los tres, el conteo era correcto y **el universo estaba mal
delimitado**.

Y los tres se cazaron con la misma pregunta: **¿qué son exactamente los casos que
estoy contando?** Repartirlos por rol, por estado y por gestiones cuesta una
medición y deshace la alarma o la confirma.

**El coste de no hacerlo es alto y asimétrico**: un aviso que grita sobre lo
normal entrena a no mirarlo, y el día que avise de verdad ya nadie le hace caso.
Es peor que no tener el aviso.

147 archivos / 1.759 tests, typecheck limpio.

### Vuelta 54 · El ratchet de vocabulario sólo vigilaba la mitad de la pantalla

Aplicada la pregunta de la vuelta anterior a los avisos que **ya existían**, la
lista de validación tenía dos activos y el primero traía un escape:

> `warning` · `sex_faculty_quota` · «**9 celdas sexo x facultad** con brecha.»

**«Celda» es exactamente el término que el vocabulario retiró de la pantalla** en
las vueltas 1 y 2 —jerga de tabla estadística para quien lee un tablero— y el
ratchet que lo vigila **mira los archivos del frontend**. Este texto sale del
motor, y `presentDetail` lo pinta tal cual: ya traducía «sexo x facultad» → «sexo
por facultad», pero no «celdas».

**Medido el alcance del hueco**: **14 textos** de `monitoreo_aulas_*.R` usan
«aula» o «celda» y ninguno está cubierto por ese ratchet. No todos son
infractores —«aula» es la palabra justa cuando se habla del salón físico— pero
ninguno estaba vigilado.

Reparado **en R y no en `presentDetail`**: traducir en la presentación es tapar,
y el texto vive en el motor. Ahora dice «**9 grupos de facultad y sexo con
brecha**», verificado en el payload.

Con su guard, que fija lo corregido sin perseguir los catorce: comprueba que
ninguna línea de `sprintf` publicable diga «celda(s) sexo», con su control de
fixture.

**El patrón, que es el mismo de todo este tramo**: un guard declara que vigila
algo y cubre sólo una parte del camino. Ya pasó con el ratchet ciego a las cifras
interpoladas (vuelta 18) y con el control de fixture que no veía una alternativa
muerta del regex. **Un ratchet vale lo que su alcance, y el alcance hay que
medirlo, no suponerlo.**

### Vuelta 55 · El último aviso preexistente también afirmaba «tienen datos» sin mirarlos

`unnamed_control_columns` publica «**7 columnas de la Base de control tienen
datos** pero su cabecera está vacía en el Excel, así que no se leyeron», y
`base_control_mapa()` **sólo mira los títulos**: una columna vacía con cabecera
vacía entraba en la cuenta igual que una llena.

Una columna del todo vacía no es un dato que se esté perdiendo —es una columna de
sobra en la hoja— y avisar de ella manda a buscar algo que no existe. **Cuarto
aviso con la misma falta**, y el primero que no había escrito yo: el conteo bien,
el universo mal delimitado.

Ahora se comprueba que la columna traiga algún valor. Y el filtro va **antes de
la salida temprana**, porque por ahí se devolvía `sin_nombre` sin filtrar: una
hoja cuyo `CURSO-HORARIO` no se reconoce seguía afirmando «tienen datos».

Cuatro casos: la columna sin cabecera **con** datos cuenta, la vacía no, la hoja
sin cuerpo no tiene nada que perder, y una columna de `NA` tampoco cuenta.

**Y una advertencia sobre la cifra en pantalla**: sigue diciendo 7, y es
correcto que lo haga. `control_sin_nombre` se calcula **al importar el libro** y
se guarda en el `.pulso`; el tablero lo lee de ahí sin recalcular. La reparación
vale para la próxima importación, no reescribe un proyecto ya guardado. **No se
puede saber si esas 7 tenían datos**: haría falta el Excel, y el `.pulso` no lo
lleva dentro.

**Dos errores míos de método en esta vuelta**, los dos por probar con un fixture
mal armado: usé «CODIGO OPERATIVO» como título del código cuando los que el mapa
reconoce son «CURSO-HORARIO» y «CURSO HORARIO», así que la función salía por el
`return` temprano y parecía que el filtro no funcionaba. **Un fixture que no casa
con el lector produce exactamente el mismo síntoma que un bug.**

### Vuelta 56 · Un rótulo que promete un universo y cuenta otro

Aplicada la pregunta del universo a los **22 tiles de KPI** del perfil, el que
saltó fue «Sin medio de contacto · ni teléfono ni correo anotado».

| | |
|---|---|
| En juego | 174 |
| **Sin medio declarado** | **33** |
| Lo que el tile cuenta | **0** |

La cuenta exige **además** que sigan sin fecha —`else if (!tieneFecha)`— y eso es
deliberado y defendible: una que ya está agendada no necesita que la llamen. Su
docblock lo respalda con la medición de 2025, «14 de 170 y se cayeron las
catorce».

**Pero ni el rótulo ni el docblock lo decían.** Con 33 aulas sin medio y un
contador en 0, quien compare las dos cifras no puede reconciliarlas sin leer el
código. No es un defecto de cálculo: es un rótulo que promete un universo y
cuenta otro.

Cambia sólo lo que dice, no lo que cuenta: «ni teléfono ni correo anotado, **entre
las que aún hay que agendar**». Tres casos que fijan el criterio: la sin medio ya
agendada no cuenta, la sin medio y sin fecha sí, y la que tiene medio no cuenta
aunque siga sin fecha.

**Quinta variante de la misma familia en este tramo**, y la más sutil: las cuatro
anteriores contaban de más, ésta cuenta de menos. En las cinco, el número era
correcto y **el nombre describía otro conjunto**.

147 archivos / 1.759 tests, typecheck limpio.

### Vuelta 57 · La tercera ceguera del ratchet, cerrada — y un título de panel escapado

La tercera ceguera estaba anotada desde la vuelta 27 y sin reparar. Al mirar los
títulos de los paneles fuera de Avance apareció lo que dejaba pasar:
**«Aulas extra disponibles»**, un `<h3>` visible, con su prosa debajo diciendo
«son **aulas** adicionales». Ninguna de las dos la contaba el ratchet.

**Las dos formas que el detector no podía ver**, y por qué: `EN_PROSA` exige un
determinante o una cifra **delante**, y en prosa hay dos sitios donde el
sustantivo no lo lleva.

| Forma | Ejemplo | Cuántas |
|---|---|---|
| Al abrir un literal | `<h3>Aulas extra…`, `aria-label="Aulas por pedir…"` | **10** |
| Tras verbo copulativo o de existencia | «son aulas adicionales», «no quedan aulas», «hay aulas gestionadas» | **3** |

El `["`>]` del primer patrón es lo que lo separa de un identificador de código:
`AulasSeccionModelo` no va precedido de comilla ni de `>`.

**Seis frases reparadas**, entre ellas dos `aria-label` —lo único que oye quien no
ve la pantalla— y el título del panel. **Cinco se quedan y por qué**: «Aulas
agendadas» y «Aulas aplicadas (campo)» son **nombres de hoja del libro**; «Aula
real», «Aula» y el `<span>Aula {venue}</span>` nombran el **salón físico**, que es
justo la palabra correcta.

**El ratchet pasa de 27 a 34**, y es la tercera vez en este loop que ampliarlo
sube el número: 15 → 34 → 27 → 34. Cada ampliación destapa frases que llevaban
ahí desde el principio. **Un ratchet mide lo que ve, y lo que ve hay que
comprobarlo, no suponerlo** — es la misma lección que la vuelta 54 dio con los
textos del motor.

148 archivos / 1.762 tests, typecheck limpio. Un contrato actualizado, que
afirmaba el texto viejo.

### Vuelta 58 · Once frases más, el ratchet a 23, y las 16 direcciones limpias

Con el detector ya viendo las tres formas, quedaban 34 frases y **once eran
reparables**. `AulasCriterioDeAula` acumulaba cuatro —«Un aula cumple con el
X %», «qué es un aula válida»— y era el panel que **define qué cuenta**, así que
publicaba la unidad equivocada justo donde se explica el criterio.

| Archivo | Reparadas |
|---|---|
| `AulasCriterioDeAula` | 4 |
| `AulasPronosticoDeCierre` | 2 (`aria-label` y `title`) |
| `AulasAlertaDeAnticipacion` | 2 |
| `AulasSerieDeRendimiento`, `AulasCargaDeCampo`, `AulasAvanceProyectado` | 1 cada uno |

Con las concordancias que arrastra el cambio: «Un aula» → «Un curso-horario»,
«Ninguna aula» → «Ningún curso-horario», «un aula válida» → «un curso-horario
válido».

**El ratchet baja de 34 a 23**, y esta vez baja de verdad: no es una ampliación
del detector sino once frases menos. De las 23 que quedan, la mayoría son las
familias ya declaradas intocables —el salón físico («dentro del aula, en
minutos», «Aula real»), los nombres de hoja del libro («Aulas agendadas»,
«Aulas aplicadas (campo)»), las locuciones «aula por aula» y el «formulario de
aplicación en aulas»—.

### El repaso visual completo, tras veinticinco vueltas de cambios

**Las 16 direcciones del perfil, sin un solo hallazgo**: `ok=true`, `issues=0` y
`geometryIssues=0` en todas. Se lanzó a propósito después de acumular tantos
cambios —motor, KPIs, avisos, vocabulario y dos reparaciones de geometría— y es
la comprobación que faltaba para que la indicación A siga en pie.

### Vuelta 59 · Barrido de tecnicismos en Avance: uno solo, y estaba en un vacío

La indicación I tiene un test comprobable: **buscar en los textos de Avance los
términos que exigen saber de diseño muestral**. Barridos quince —estrato, deff,
ponderación, cuantil, posterior, bayesiano, dispersión, percentil, varianza,
sesgo, desviación, calibración, mediana, tau, τ— sobre los archivos de la
sección **sin sus comentarios**, que es lo que se publica:

| Término | Apariciones | Veredicto |
|---|---|---|
| `tau` | 46 | **nombres de campo** (`f.tau_previsto`), no texto; la letra griega no llega a pantalla (vuelta 31) |
| `estrato` | 17 | «Estratos» es el **nombre de una pestaña**, así que el término es del producto… salvo uno |
| `dispersi` | 7 | campo del payload, en un `title` |
| `mediana` | 2 | «días que pasaron de mediana entre llamar y tener cita»: se entiende |
| `calibra` | 2 | `etiquetaCalibracion`, texto del motor ya revisado |

**El único escape real** estaba en el vacío del gráfico de cobertura: «77 son
reservas del banco y tampoco entran: **esperan en su estrato** y contarlas como
"sin respuestas" las volvería una alarma». Ahí «estrato» es el grupo del sorteo,
y quien lee no tiene por qué saberlo. Pasa a «**esperan disponibles para su
facultad y sexo**», que es la misma información en el registro llano que el perfil
ya usa para el banco —«sin un titular al que respalden»—.

**Cuatro greps míos fallaron antes de este barrido**, todos por el shell: `-r` con
lista explícita de archivos, un archivo inexistente que hace fallar el comando
entero, y dos bucles que devolvían cero sin error. Lo resolvió hacerlo en Node.
**Un barrido que devuelve cero hay que probarlo con un término que se sabe que
está** — «estrato» en la pestaña de Estratos era ese control, y es lo que
destapó que el comando no funcionaba.

148 archivos / 1.762 tests, typecheck limpio.

### Vuelta 60 · Términos del producto: todos definidos donde se usan

Segundo test de la indicación I: **términos propios del producto usados donde no
se definen**, que es lo que destapó «cadena» en Resumen (vuelta 32). Barridos
trece sobre los archivos de Avance sin comentarios:

| Término | Veredicto |
|---|---|
| «el plan» (14 archivos), «reserva» (8) | del dominio y comprensibles sin definición |
| «el banco» (5) | se define al lado: «los cursos-horario extra de esa facultad» |
| «el corte» (3) | **definido en su propio KPI**: «último día con parte; todo el atraso se mide contra él» |
| «cadena», «dormidas» | nombres de clase CSS y de variable, no texto |

**Sin hallazgos**, y esta vez el cero está comprobado con un control: «estrato»
—que sí tenía un escape— salió del mismo barrido en la vuelta anterior, así que
el método muerde.

### Balance de la indicación I

Lo que se ha hecho para que Avance se lea sin haber diseñado el estudio:

| Frente | Estado |
|---|---|
| Vocabulario de la unidad | ratchet de 93 → **23**, con las tres cegueras del detector cerradas |
| Tecnicismos de diseño muestral | 15 barridos, **1 escape** reparado; la letra griega no llega a pantalla |
| Términos del producto | 13 barridos, **todos definidos** donde se usan |
| Los 22 gráficos en pantalla | rótulo y aritmética, **7 reparados** |
| Avisos y KPIs | 5 con el universo mal delimitado, **los 5 corregidos** |
| Contradicciones entre paneles vecinos | 4 resueltas: los dos «Cumplimiento», la brecha de `avance_cuota`, el universo del pronóstico, el reparto de Cobertura |
| Comprobación visual | **16 de 16 direcciones limpias** |

**Lo que queda abierto y por qué**: la indicación C —evaluar elemento por
elemento las 10 direcciones fuera de Avance— sigue en curso, y ahí es donde
aparecerán los defectos que este loop aún no ha tocado. **La cierra Gonzalo, no
yo.**

### Vuelta 61 · Los bloques que alimentan las secciones fuera de Avance, cuadrados

Primer barrido de la indicación C con el método de cruzar cifras. Los dieciocho
bloques del payload que alimentan `fuentes`, `modelo`, `calidad` y `consultas`:

| Bloque | Filas | Cuadra con |
|---|---|---|
| `agenda` | 1.424 | el plan entero |
| `reemplazos` | 1.347 | 1.424 − 77 del banco ✔ |
| `partes_campo` | 152 | las aplicadas ✔ |
| `control_calidad` | **304** | **152 × 2 sexos** ✔ (152 códigos distintos, sexos F/M) |
| `course_status` | 500 | recorte declarado ✔ |
| `brechas` | 98 | `kpis.brechas` ✔ |
| `quotas_sex_faculty` | 30 | 15 facultades × 2 ✔ |
| `avance_por_estrato` | 72 | facultad × sexo × tamaño ✔ |

**Sin descuadres.** El único bloque vacío es `criterio_aula`, y es **vacío
legítimo con su causa dentro del propio código**: «Gonzalo: "ni siquiera hemos
definido si un aula es válida al 70 % o no"». El módulo devuelve `NULL` cuando el
estudio no lo declara y el panel lo dice —«Este estudio no ha declarado qué es un
curso-horario válido»—, con la asimetría explicada: el criterio de **respuesta**
válida sí se declara en la app, el de **aula** válida no existía en ninguna parte.

Y su decisión de diseño, que conviene no perder: el criterio propio **no
reemplaza** al veredicto de la hoja, «lo pone al lado […] donde las dos difieren,
eso es lo que hay que mirar. Sustituir uno por otro sería cambiar de dueño la
decisión sin que nadie lo pida».

**Lo que este barrido no cubre**: mide que las cifras cuadren entre bloques, no
que cada panel diga lo que su cifra significa. Eso es lo que queda de la
indicación C, panel por panel.

### Vuelta 62 · Un peldaño de la escalera en masculino entre dos femeninos

Buscadas las funciones de texto con tres o más ramas —el método que destapó
`dondeEstanLasOtras`— salieron cuatro en el perfil, y **`bandaEnPalabras` está
bien construida**: sus cuatro ramas comparten registro, cada una dice qué falta y
la tercera lleva la cautela estadística que corresponde —«con un solo
curso-horario: todavía no se puede afirmar una diferencia»—.

**El hallazgo está justo encima**, en la escalera de veredictos del mismo panel.
Es deliberada y está documentada —«una escalera de cuatro peldaños —Cubierta ·
Justo · Puede no cerrar · No cierra— dice cuánto correr; una de tres, no»— pero
**mezcla géneros**:

| Peldaño | |
|---|---|
| Cubierta | femenino |
| **Justo** | **masculino** |
| Puede no cerrar / No cierra | verbos |

El sujeto es la facultad de la fila, y «Cubierta» ya concuerda con ella. Un
adjetivo en masculino entre dos femeninos hace dudar de a qué se refiere: pasa a
**«Justa»**.

Es el mismo tipo de defecto que el «Ningún aula» de la vuelta 13 —el masculino
aparente de «el aula» arrastrando concordancias— y aparece por la misma vía:
**leer la escala entera en vez de cada rótulo por separado**.

Dos contratos actualizados, que afirmaban el texto viejo. 148 archivos / 1.762
tests, typecheck limpio.

### Vuelta 63 · Dos redacciones vivas del mismo tramo, y el test que faltaba

Aplicada la lección de la vuelta anterior —**leer la escala entera**— a los seis
conjuntos de etiquetas del perfil, saltó la de cobertura:

| Tramo | Motor | Respaldo del frontend |
|---|---|---|
| ≤50 % | «Muy por debajo (menos de la mitad)» | «Crítico (≤50 %)» |
| 50–75 % | «Se quedó a medias» | «Insuficiente» |
| 75–90 % | «Llegó a la mayor parte» | «Parcial» |
| 90–100 % | «Casi llegó» | «Satisfactorio» |
| ≥100 % | «Llegó a lo esperado» | «Pleno» |

**El gráfico ya elegía bien**: usa la del motor cuando el payload la trae y la
local sólo como respaldo. Y su comentario había predicho esto con exactitud:

> «con dos redacciones vivas, la del gráfico y la del motor, la pantalla acabaría
> diciendo dos cosas del mismo tramo **y ningún test lo vería**».

Era literal. El respaldo se quedó en vocabulario técnico mientras el motor pasaba
al llano, así que **la misma escala se leía de dos maneras según el estado del
proyecto**.

Alineado el respaldo, y **puesto el test que el propio comentario echaba en
falta**: lee `monitoreo_aulas_etiquetas.R` —copiar la lista al test sería crear la
tercera— y compara tramo por tramo, con control de fixture para que un parseo
roto no lo deje pasar en vacío. Comprobado que muerde: cambiando un solo tramo,
el fallo nombra el desajuste completo.

**Es el patrón de «dos listas que nadie ata»**, y aquí el aviso estaba escrito en
el código desde antes. Un comentario que predice un defecto no lo evita: hace
falta el guard.

**Anotado y no reparado**: las escalas de `estadoDeAplicacion` y
`AulasColaDeContacto` llevan participios en femenino —«Agendada», «Reemplazada»,
«Aplicadas»— que concuerdan con «aula» y no con «curso-horario». Es el mismo
arrastre de género de las vueltas 13 y 62, pero tocarlo cambia rótulos que
aparecen en varias pestañas y merece su propia vuelta.

149 archivos / 1.764 tests, typecheck limpio.
