# GOAL — Monitoreo de aulas, genuinamente profesional

Tipo: GOAL abierto · **solo Gonzalo lo cierra**
Estado: En curso
Fecha: 2026-08-28
Abierto: 2026-08-28
Autoridad: encargo directo del dueño; es un loop de convergencia, no una lista
que se agota.

## El encargo, textual

> «Ya cálculo de muestra está cubierto, lo que nos importa a partir ya de la
> próxima semana en realidad es que **monitoreo sea algo genuinamente
> profesional, que esté a un nivel increíble de profesionalismo**. Un poco
> parecido a quizás otros monitoreos que van por ese camino y que quizás no han
> llegado, pero que creo que tú sí podrías.»

> «Puede haber hasta un E cuarenta y cinco. Hay muchas cosas que ver: si ya
> tienes curvas de probabilidad, si ya hay una forma de ir prediciendo cómo
> vamos, **si hay formas más accesibles para usuarios no técnicos**, medir el
> tema del rendimiento, de la actualización, si podemos poner a prueba viendo
> los resultados en **Kobo, qué tan rápido se leen**. Hay muchos pulidos
> estéticos, muchos conceptos que hay que ir puliendo, gráficas que hay que ir
> mejorando, tablas que hay que ir afinando, y **no hay algo que amerite que te
> detengas**.»

Y el acotamiento, que manda sobre todo lo anterior:

> «Con monitoreo me refiero **exclusivamente al monitoreo de aulas**. Monitoreo
> tiene otras secciones, pero la idea es que **no se genere un archivo
> gigante**, sino que cada uno tenga el suyo. Y de hecho creo que ya lo tienen.
> Nos centramos exclusivamente en monitoreo de aulas porque **este es nuestro
> scope principal**.»

Y la sinergia, que condiciona todos los frentes:

> «Hay **tres elementos en constante sinergia**: por un lado Kobo, por otro la
> aplicación, y por otro el Excel. El Excel da información sobre la
> **agendación** y el **registro de campo**. La aplicación **lee los primeros
> dos y genera el tercero** —básicamente la base de control, pero puede generar
> otras hojas adicionales— **sin reescribir las primeras dos, que son las que
> constantemente están editándose** y que lee. Esas tres tienen que estar en
> sinergia completa. Y la idea no es que se demoren: **un control y un monitoreo
> prácticamente en tiempo real de cuando el aplicador está en el aula**. A veces
> vamos a tener cien datos y a veces tres mil, **y eso es normal**.»

## El scope, literal

Dentro:

- `frontend/src/features/monitoreo/profiles/aulas/` — 247 archivos, 44.431
  líneas.
- `api/R/monitoreo_aulas*.R` — 26 archivos, 6.719 líneas.
- Endpoints `/api/monitoreo/aulas/*`.
- Las ocho pestañas del perfil: **carga · contacto · cuotas · efectividad ·
  estratos · facultad · rendimiento · resumen**.

Fuera, salvo que un ítem de aulas lo pida y se diga por qué: territorial,
acreditación, telefónico, el monolito `MonitoreoPage.tsx` y el chrome
compartido. Tocar el chrome compartido afecta a los cuatro modos: es un cambio
de otra escala y se declara antes de hacerlo.

**Ningún archivo del perfil de aulas está congelado a crecimiento hoy.** Eso no
es permiso: el dueño pidió explícitamente que no crezcan archivos gigantes, y
dos ya van por ese camino (ver N1 y N2).

## La vara

Un cambio pasa si mejora una de estas cuatro y no empeora las otras:

1. **Frescura**: el dato que se ve es el que hay, y llegó rápido.
2. **Legibilidad operativa**: alguien que no diseñó el estudio entiende qué pasa
   y qué hacer.
3. **Fiabilidad**: lo que la pantalla afirma se sostiene contra el dato.
4. **Materia**: se ve como un producto, no como un panel de depuración.

No cuenta como avance: pulir un archivo sin medir la superficie, ni declarar
verde por ausencia de hallazgos cuando nadie miró.

## De dónde sale este tablero

Cada ítem viene de una medición ya hecha, no de una impresión:
`docs/qa/deuda-monitoreo.md` (secciones 2 a 5),
`docs/qa/pulido-monitoreo-estado.md`,
`docs/qa/goal-monitoreo-calidad-campo-2026-08-13.md`,
`docs/qa/plan-dos-tasas-en-monitoreo-2026-08-28.md` y el ADR 0083.

## El tablero

Ocho frentes. Los frentes no se hacen en orden; dentro de un frente las
dependencias se dicen.

### S · La sinergia Kobo ↔ aplicación ↔ Excel — frente NUEVO y transversal

Lo que hay hoy, verificado el 2026-08-28 sobre el código:

- **Un solo libro con tres hojas**: `Aulas Agendadas`, `Aulas Aplicadas
  (Campo)` y `Base de control` (`AULAS_LIBRO_HOJAS` en `carga_aulas_libro.R`).
- `aulas_libro_importar()` **lee las tres**; ninguna es obligatoria y lo que
  falta se declara en `hojas_ausentes` en vez de mostrar un cero silencioso.
- `aulas_libro_generar()` **escribe las tres y guarda con `overwrite = TRUE`**,
  y **nunca lee el archivo existente**: no hay `read.xlsx`, ni `loadWorkbook`,
  ni `file.exists` en todo el generador. Compone las tres hojas desde el estado
  de sesión.
- Quién edita qué, según el dueño (2026-08-24): la **Base de control no la
  edita nadie**, es salida; la **agendación sí**; el **registro de campo a
  veces**.

| | Ítem | Estado |
|---|---|---|
| S1 | **MEDIDO y luego CORREGIDO el 2026-08-29: mal encuadrado, ver abajo.** Regenerar sin importar borra la edición; importar antes la conserva | ☑ medido, sin reparar |
| S1b | ~~Regenerar el libro pisa las dos hojas que el equipo edita.~~ El generador escribe agendación y registro de campo desde el estado de sesión y sobrescribe el archivo entero; nada compara con lo que hay en disco ni avisa. Si alguien editó después del último import, esas ediciones se pierden **en silencio**. Es el defecto central de este frente | ☐ verificado, sin reparar |
| S2 | **Separar lo que la app escribe de lo que el equipo edita.** El dueño lo pidió literal: generar la base de control y las hojas adicionales **sin reescribir las dos primeras** | ✅ **DECIDIDO 2026-08-31: se conecta.** Textual: «debe ser capaz de preservar como fuente de verdad las hojas de agendación y registro de campo, y las demás la app las sobreescribe porque precisamente es la app la que les crea contenido y actualiza. Las otras dos primeras la app sólo crea el instrumento para que el agendador y el jefe de campo registren toda la información (el excel con columnas y estados por titular y cada reemplazo)». O sea: **dos hojas son del equipo y NO se reescriben nunca; el resto son salida de la app y se regeneran**. ☐ pendiente de implementar |
| S3 | **Robustez a la edición externa**: una corrección en agendación o en registro de campo tiene que llegar a la app sin fricción. La regla del dueño es «lo que produzca la app tiene prioridad», que **no significa ignorar la corrección** sino que la app es la fuente y el Excel un canal de edición acotado | ☐ |
| S4 | **Medir el lazo completo Kobo → app → Excel** con el reloj en la mano. Hoy no existe esa medición para aulas | ☐ |
| S5 | **Escala 100 ↔ 3.000 y que eso sea normal.** Todo lo de este frente se mide en los dos extremos; una solución que sirva a 100 y se caiga a 3.000 no cierra el ítem | ☐ regla del frente |
| S6 | **`Base de control` se lee de vuelta al importar** aunque sea salida pura. Es deliberado —las filas ya registradas vuelven al libro al regenerarlo— pero convierte una salida en entrada y merece revisarse a la luz de S2 | ☐ **depende de S2, que es decisión**. El hecho ya está confirmado y la app lo dice sola: Controles avisa «7 columnas de la Base de control con datos y la cabecera vacía en el Excel, así que no se leyeron», y la pestaña declara que se llenan en el Excel del equipo y vuelven al importar. O sea que el ida y vuelta no es tácito. Lo que falta es la decisión, no la medición |
| S7 | **Casi en tiempo real mientras el aplicador está en el aula.** Es el norte del frente: qué latencia es aceptable, qué se refresca solo y qué exige una acción | ☐ |

#### S1, medido end to end el 2026-08-28

Experimento sobre un plan de dos aulas: generar el libro, editar a mano dos
celdas de «Aulas Agendadas» —la fecha de agendamiento y el número de intentos
de contacto— y volver a generar.

| Camino | Fecha editada | Intentos editados |
|---|---|---|
| Lo escrito a mano | `2026-09-99-EDITADO` | 77 |
| **(A) Regenerar SIN importar** | **vacío** | **2** (el del plan) |
| **(B) Importar y luego regenerar** | `2026-09-99-EDITADO` | 77 |

**El camino seguro existe y funciona; el peligroso no avisa.** Regenerar sin
importar devuelve la hoja al estado del plan y la edición desaparece sin
error, sin comparación con el disco y sin aviso. Nada en la app impone el
orden ni detecta que el archivo es más nuevo que el último import.

**Por qué el round trip existente no lo cazaba.** `test-carga-aulas-libro-roundtrip.R`
tiene veinte tests y varios se llaman «el agendamiento ya registrado NO se
borra al regenerar», pero su ciclo es `generar → importar`: prueban que la app
relee lo que **ella misma** escribió. Ninguno introduce una edición externa
entre medias, que es el caso real —la hoja «está constantemente editándose»—.
Es cobertura que parece cubrir y mide otra cosa.

**La decisión, para que el próximo tick la implemente.** Se toma la vía que
el dueño pidió literalmente: **la app deja de reescribir las dos hojas que el
equipo edita.** El libro se genera entero **la primera vez** —de ahí salen la
cadena, los enlaces QR y la estructura— y a partir de ahí las regeneraciones
escriben sólo «Base de control» y las hojas adicionales, preservando las dos
primeras tal como estén en el disco. Descartadas: fusionar en cada regeneración
(mantiene el archivo único pero deja la fusión como punto de fallo silencioso)
y limitarse a avisar del desfase (pone en el operador la carga de un orden que
la app puede garantizar).

#### CORRECCIÓN del 2026-08-29 — S1 estaba mal encuadrado, y S2 no se activa

Al medir S3 apareció el dato que cambia los dos hallazgos anteriores: **hay un
solo sitio que genera el libro y su destino es siempre una ruta nueva**.

```r
destino <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), nombre))
```

`router_monitoreo.R:4979`. Un UUID por generación, dentro del directorio de
descargas de la sesión. **La app nunca escribe sobre un archivo existente.**

**Qué significa para S1.** Reporté que «regenerar borra la edición sin avisar».
Es cierto en el experimento —que regeneraba sobre la misma ruta— y **falso en
el flujo real de la app**: el archivo que el equipo edita vive en su disco, la
app nunca lo toca, y lo que emite es un archivo nuevo. Nada se destruye. Medir
sobre un escenario que el producto no produce es la forma cara de fabricar un
defecto.

**Qué significa para S2.** El arreglo es correcto a nivel de función y sus once
tests lo prueban, pero **por el único sitio que lo llama no se activa nunca**:
`.calg_del_disco(destino)` recibe siempre una ruta inexistente y devuelve vacío.
Comprobado. Es una capacidad escrita, tipada y testeada que nadie consume.

**El riesgo real, reencuadrado.** No es destrucción, es **divergencia**: el
equipo edita su copia, alguien regenera sin haberla subido, y quedan dos libros
distintos sin que nada diga cuál está al día. El daño no es perder una celda,
es trabajar sobre el libro equivocado.

**Lo que esto abre, y sustituye a S2 y S3 tal como estaban escritos:**

| | Ítem | Estado |
|---|---|---|
| S8 | **El libro generado declara de qué import salió.** El recibo `monitoreo_aulas_libro` ya guarda `importado_en`, y lo consume `AulasFuentesDelEstudio.tsx`; lo que falta es que esa marca viaje DENTRO del libro, para que dos copias se puedan comparar sin adivinar | ☑ **ya viaja** (medido 2026-08-31): `router_monitoreo.R:5029` pasa `procedencia = s$monitoreo_aulas_libro` a `aulas_libro_generar()`, que la lleva hasta `aulas_libro_escribir_indicadores()` y escribe `importado_en` en la hoja de indicadores (`carga_aulas_libro_indicadores.R:352`). O sea, la marca SÍ está dentro del libro y dos copias se pueden comparar |
| S9 | **La app no puede vigilar el archivo del equipo**, y eso es estructural: el libro llega subido o por `file_id`, nunca por una ruta estable del disco del usuario. Cualquier diseño de frescura tiene que partir de ahí en vez de suponer un watcher | ☐ declarado |
| S10 | **Decidir si el arreglo de S2 se conecta o se retira.** Conectarlo exige que la app genere sobre una ruta estable, que es otra decisión. Dejarlo desconectado y sin declarar sería exactamente la deuda que este GOAL persigue | ✅ **DECIDIDO: se conecta** (ver S2) |

#### S4, medido el 2026-08-29 — el lazo dentro de la app NO se degrada con la escala

Banco sintético y determinista (`<scratchpad>/bench_s4.R`, semilla 202), 174
aulas titulares como HSVG2026, cronometrado por tramos porque un total no dice
qué arreglar. Segundos:

| Tramo | 100 resp · 3 col | 3.000 · 3 col | 3.000 · 153 col |
|---|---:|---:|---:|
| Efectivas por aula | 0,18 | 0,14 | 0,13 |
| Dashboard, cálculo completo | 0,34 | 0,25 | 0,27 |
| Dashboard cacheado, miss | 0,65 | 0,25 | 0,26 |
| Dashboard cacheado, **hit** | **0,00** | **0,00** | **0,00** |
| Generar el libro | 0,74 | 0,65 | 0,43 |

**El hallazgo es que no hay hallazgo aquí, y eso vale.** El dueño advirtió «a
veces cien datos y a veces tres mil, y eso es normal»: multiplicar las
respuestas por 30 y las columnas por 51 **no degrada ningún tramo**. El lazo
completo dentro de la app se queda por debajo de 1,3 s en el peor caso, y el
caché sirve en cero. Lo que preocupaba de la escala no está en estos cuatro
tramos.

**Dónde queda entonces el problema de frescura.** En lo que este banco NO puede
medir: el tramo 1, Kobo → sesión, que necesita credenciales, y el bloqueo
intermitente del hilo de plumber (A6, ~178 s en 1 de 3 corridas). Optimizar los
tramos 2 a 4 sería trabajar donde no duele.

**Dos guardas que salvaron la medición**, y por eso el banco las lleva escritas:

- La primera corrida daba **suma 0 de efectivas**: el fixture ponía
  `classroom_id` distinto de `operational_code` y
  `.monitoreo_aulas_contar_por_fila()` empareja por el primero. En el plan real
  **coinciden en las 196 filas** (medido el 2026-08-16, decisión L2). Sin la
  guarda habría cronometrado una tubería vacía y publicado los tiempos.
- El «miss» del tercer escenario era **un hit disfrazado**: el token del caché
  no incluía el ancho, así que los dos escenarios de 3.000 lo compartían.

**Límites declarados, no estimados**: los datos son sintéticos; el tramo Kobo no
se midió; y 3.000 × 153 sigue siendo un archivo pequeño frente a un export real
de un estudio largo.

#### E1, primera pasada el 2026-08-29 — y el tablero decía ocho pestañas cuando son DIECISÉIS

**Corrección de scope antes que nada.** Este GOAL decía «las ocho pestañas del
perfil» porque las deduje de los bloques `pestana !== "…"` del page-file, y eso
sólo cubría parte. El catálogo real
(`frontend/src/lib/navegacion/catalogos/monitoreo.ts`) declara **dieciséis
pestañas en cuatro secciones**, más `fuentes` que es una superficie sin
pestañas: **diecisiete superficies**.

| Sección | Pestañas |
|---|---|
| `fuentes` | — (superficie única) |
| `modelo` | agenda · facultad · contacto · carga |
| `avance` | resumen · estratos · cuotas · rendimiento · efectividad · salidas |
| `calidad` | registro · controles · base · abiertas |
| `consultas` | reemplazos · brechas |

**Lo medido**, sobre las diecisiete, en 1440×1000 y 1024×600:

| | 1440×1000 | 1024×600 |
|---|---:|---:|
| Superficies recorridas | 17 | 17 |
| Recortes | **0** | **0** |
| Grupos no conformes | **0** | **0** |
| Grupos declarados que se montan | 3 a 12 por vista | igual |

**Y el límite, que es la mitad de la noticia: el proyecto trae CERO registros y
cero fuentes activas.** Todas las superficies estaban en estado vacío. Un
contrato `equal` con cero o un miembro no puede derivar, así que ese «0 no
conformes» **no prueba que los marcos cuadren con datos**: prueba que los vacíos
no rompen. Es exactamente la mitad del contrato que sí se puede medir sin datos
—toda superficie contiene su propio vacío— y se declara como tal.

**Qué queda pendiente y por qué**, para que nadie lo lea como aprobado:

- **Recorrido con datos**: importar el plan desde cálculo de muestra y repetir.
  Ahí es donde aparecen los recortes de tabla y la deriva de marcos, que es lo
  que el registro de pulido encontró en acreditación y telefónico.
- **Escala de radios y tipografía**: no medida en esta pasada.
- **Solapes entre hermanos**: el medidor de esta pasada mira recorte y deriva,
  no derrame. El defecto más caro del pulido anterior —151 px de mapa
  encima de una tabla— no lo detecta ningún medidor de scroll.

#### Segunda pasada, 2026-08-29 — CON datos, y tres formas de medir mal

Se consiguió poblar el perfil: el proyecto de referencia `hsvg2026` **no sirve**
—devuelve `E_NO_CALC_MUESTRA`, no trae selección— así que se abrió una copia del
`.pulso` del sorteo real, se eligió el modo y se importó el plan: **174
cursos-horario cargados**, tablas con 174 y 400 filas según la vista.

Lo medido mientras la sesión aguantó, en 1024×600 y ya con datos:

| Superficie | Grupos | Filas | Recortes | Derrames | No conformes |
|---|---:|---:|---:|---:|---:|
| `avance/resumen` | 10 | 400 | 0 | 0 | 0 |
| `avance/rendimiento` | 12 | 0 | 0 | 0 | 0 |
| `avance/cuotas` | 3 | 30 | 0 | 0 | 0 |
| `modelo/contacto` | 2 | 174 | 0 | 0 | 0 |
| `modelo/carga` | 2 | 174 | 0 | 0 | 0 |

**TRES FORMAS DE MEDIR MAL, y las tres dieron el mismo cero tranquilizador:**

1. **Medir antes de que la vista se asiente.** Con 1,4 s de espera todas las
   superficies daban «2 grupos» idénticos; con 4 s, `resumen` daba 10 y 400
   filas. El barrido uniforme era el síntoma: **un resultado que no varía entre
   vistas distintas está midiendo otra cosa.**
2. **Confiar en `data-audit-ready`.** No es un booleano sino un NOMBRE
   (`"monitoreo-aulas"`), así que está presente desde que monta y no dice nada
   sobre si el dashboard terminó. Hubo que estabilizar por contenido: dos
   muestras seguidas con el mismo número de grupos, filas y longitud de texto.
3. **No vigilar el `sid`.** A mitad del barrido la sesión cambió —de `20a3a4e5`
   a `5e1dc6ad`— y con ella se perdió el plan importado: a partir de ahí TODAS
   las vistas daban «2 grupos, 0 filas» y el estabilizador las declaraba
   estables, porque un vacío es perfectamente estable. **El cero de un vacío y
   el cero de un marco correcto se escriben igual.**

**Por eso esta pasada NO cierra E1**: la mitad de las superficies quedaron sin
medir con datos. Lo que sí queda es el método —estabilizar por contenido y
comprobar el `sid` antes y después de cada medición— y las cinco filas de
arriba, que se tomaron con sesión viva.

**Sigue sin medirse**: escala de radios y tipografía, y el resto de superficies
con datos.

#### Tercera pasada, 2026-08-29 — las 17 con datos, y un hallazgo de verdad

Barrido completo con el plan importado (174 cursos-horario) y la sesión
verificada estable en las diecisiete:

| | Resultado |
|---|---|
| Superficies | **17 de 17** |
| Recortes | **0** |
| Derrames entre hermanos | **0** |
| Grupos no conformes | **0** |
| `sid` estable en todas | **sí** |

**EL HALLAZGO: una tabla tarda entre 8 y 11 segundos en aparecer, y mientras
tanto la pantalla parece vacía.**

Cinco de las diecisiete superficies daban resultados distintos al medirlas dos
veces —salir y volver—, y dos de ellas por 174 filas enteras: `modelo/agenda` y
`modelo/carga` pasaban de tabla vacía a tabla llena. La serie temporal sobre una
primera visita a Agenda lo fija:

```
3s: 0 filas · 6s: 0 filas · 8s: 0 filas · 11s: 174 filas · 25s: 174 filas
```

No está rota: **llega tarde**. Pero durante esos once segundos la superficie es
indistinguible de «no hay nada que ver», y el medidor no encontró ningún
indicador de carga montado. Para quien abre Agenda a las 8 de la mañana con el
campo empezando, once segundos de tabla vacía es la respuesta equivocada a la
única pregunta que trae.

Las otras tres discrepancias son del mismo mecanismo en menor escala:
`modelo/facultad` 3→2 grupos, `calidad/controles` 3→2, `calidad/abiertas` 1→2.

**Qué NO es este hallazgo.** No es pérdida de sesión: el `sid` se mantuvo en las
diecisiete. La pasada anterior lo atribuyó a eso y se corrige aquí.

**Consecuencia para el método**, y vale para cualquier QA visual de este perfil:
esperar a que la vista «deje de cambiar» NO basta, porque se está quieta ocho
segundos antes de llenarse. Un vacío es perfectamente estable. Hay que medir dos
veces y exigir que coincidan, que es lo que destapó esto.

#### CORRECCIÓN del 2026-08-29 — el hallazgo de los 11 s estaba mal contado

La pasada anterior publicó que Agenda muestra «once segundos de tabla vacía sin
ningún indicador de carga». **Las dos mitades de esa frase son falsas** y las
dos se comprobaron midiendo, no razonando.

**El indicador existe, y es el propio contrato de QA.** `AulasMonitoreoPage`
declara `data-audit-ready={loading ? "false" : "monitoreo-aulas"}`
(línea ~1236). Medido sobre una primera visita:

```
3s ready=false f=0 · 5s ready=false f=0 · 7s ready=false f=0
9s ready=false f=0 · 11s ready=monitoreo-aulas f=174
```

**La marca vale `"false"` durante los nueve segundos y cambia exactamente cuando
llegan las 174 filas.** El contrato de readiness funciona. Yo lo descarté en la
pasada anterior escribiendo que «no es un booleano sino un nombre» tras UNA sola
observación —hecha, precisamente, cuando ya estaba lista—. Es la forma más cara
de mirar: comprobar un gate una vez, en el único momento en que no puede fallar.

Para la persona tampoco está mudo: durante la carga el chrome muestra
`Avance … Recargar … Sin act.` con puntos suspensivos donde luego van los
valores.

**Y no son «once segundos cada primera visita»: es el camino FRÍO.** Repetida la
medición con el dashboard ya calculado, la vista está lista **a los 4 segundos y
con los 174 datos puestos**. Lo que tarda es la primera computación tras
importar el plan, no cada entrada a la pestaña.

**Qué queda en pie, entonces:** una espera de ~9 s en frío, correctamente
declarada por la app. Es un ítem de rendimiento del frente A/B, no un defecto de
contrato de superficie, y **no justifica tocar el estado vacío de ninguna
superficie** —que era el trabajo que la pasada anterior proponía—.

**Y la consecuencia de método, que es lo que de verdad se llevó esta pasada:**
todas las mediciones de E1 se hicieron sin usar `data-audit-ready` como gate,
teniéndolo delante. El skill `/ver-ui` lo dice literal —`marca-en-false`
significa «la vista aún declara trabajo pendiente»— y se ignoró. Las tres
pasadas siguen siendo válidas en su resultado geométrico porque el doble
muestreo las salvó, pero el gate correcto habría ahorrado dos de ellas.

#### E1b, 2026-08-29 — escala de radios y tipografía, la parte que faltaba

**Tipografía** (`8a834c48`). El perfil declara su escala en su propio CSS —12,
11 y 10 px, el último para «ejes, marcas y rotulos micro»— y tenía **seis
literales por debajo**: un 9,5 px en el badge «Estás aquí» y cinco de 9 px en el
registro y la familia de reemplazos, todos con vecinos que ya usaban el token.

**Radios** (`9b7efc61`). Medidos en la app y **por proporción**: 23 elementos
fuera de la escala de `tokens.css` (10 · 14 · 16 · 20 · 999), de los cuales
**sólo dos son del perfil de aulas**. Los dos caían entre el 10 y el 14.

| | Dentro de aulas | Chrome compartido |
|---|---:|---:|
| Radios fuera de escala | **2** | **21** |

Los 21 restantes —`pulso-module-tile` a 12, `pulso-brand-link` a 15,
`pulso-module-switcher` a 17, `pulso-command-bar` a 18, `pulso-nav-cluster` a
21— son del chrome que comparten los cuatro modos de Monitoreo. **Declarados y
no tocados**, que es lo que el scope de este GOAL pide.

**Lo que se verificó y lo que no**, dicho por separado porque no es lo mismo:

- El badge y las fichas del handoff se comprobaron EN LA APP inyectando el
  cambio y midiendo antes y después. El badge pasa de 67×18 a 70×19 y las
  fichas siguen en 223×40; ninguno recorta.
- Los cinco literales de reemplazos y el radio de su popover **no se pudieron
  ver**: el widget no monta sin reemplazos registrados. Se cambiaron por razón
  de escala, no por comprobación, y así queda escrito en el código.

**Los guards no prohíben cualquier literal**, que daría docenas de falsos
positivos: el de tipografía compara contra el suelo que el propio perfil
declara, y el de radios sólo caza los que caen ENTRE peldaños, que es donde se
cuela una esquina puesta a ojo.

**Deuda declarada fuera de scope:** un `<strong>` a 8 px con el texto «Sin act.»
en `.pulso-context-tab-rail-meta`, del chrome compartido.

#### C1, 2026-08-29 — el inventario de jerga, y sale mejor de lo esperado

Medido sobre el texto VISIBLE de las 17 superficies —entre etiquetas, más
`title`, `placeholder` y `aria-label`, y con los comentarios excluidos, que es
donde este loop ya se equivocó dos veces—.

**La jerga dura NO llega a pantalla.** Cero apariciones visibles de **τ, deff,
p25, π y afijación**. Verificado en crudo, porque un cero es justo lo que un
detector mal escrito devuelve: las 12 apariciones de τ en el perfil están
**todas dentro de comentarios**.

Lo que sí se ve, por frecuencia: cuota (30), reserva (30), efectiva (17),
curso-horario (16), titular (14), brecha (7), elegibles (6), estrato (4),
umbral (3), ponderación (2), banda (1).

**Y la mayoría no hay que tocarla, que es la otra mitad del veredicto:**

- **Vocabulario del operativo, fijado por el dueño o por ADR**: cuota, reserva,
  titular, curso-horario, efectiva —ésta definida en el ADR 0082—. Traducirlas
  sería inventar un segundo idioma para lo que el equipo ya nombra así.
- **Se auto-glosan en su propia frase**: «la banda, la mitad central de…», «el
  umbral de asistentes», «había más presentes que elegibles». No necesitan nada.

**Un solo cambio, y donde no había información.** «Estrato» era la única
palabra técnica sin explicar en ninguna parte: sus VALORES sí se traducen
—`etiquetaDeEstrato()` convierte «GESTIÓN Y ALTA DIRECCIÓN / F / G3» en algo
legible— pero la palabra no. El subtítulo del panel decía «N filas», que es lo
único que la tabla de abajo ya enseña sola; ahora dice qué es un estrato. **No
se nombran las columnas del corte** porque son configurables por estudio
(`estratos_selector`) y escribirlas sería falso en cuanto alguien las cambie.

Queda vivo para C2/C3: `ponderación` aparece en dos rótulos de columna
(«Estado de ponderación», «Advertencia de ponderación») del diccionario, y ahí
no hay sitio para una glosa sin alargar la cabecera.

#### C2, 2026-08-29 — dos detectores fallidos y un hallazgo con ADR detrás

**Los dos primeros detectores fueron malos, y eso es la mitad del resultado.**

1. Buscar «porque / razón / causa / motivo» en las superficies que avisan.
   `AulasConcentracionBrecha` salió con CERO menciones y resultó cumplir de
   sobra: «N de M cursos-horario concentran la mitad de lo que falta · la
   brecha está repartida: no hay unas pocas que lo cierren». **Expresa la causa
   sin decir la palabra.**
2. Buscar avisos que declaren un hecho sin explicarlo. Devolvió **105**, y casi
   todos eran ESTADOS VACÍOS —«el plan no declara estratos que comparar»—, que
   sí dicen su causa: no hay nada que enseñar porque el plan no lo trae.

Leídas a mano, las cuatro superficies que avisan cumplen:
`AulasEfectividadSeguimiento` compone un `porque` explícito y lo añade al
veredicto; `AulasAlertaDeAnticipacion` dice hecho, causa y consecuencia en una
frase —«se están cayendo más que entonces: la lista está pidiendo de menos»—;
`AulasControlDelLibro` y `AulasConcentracionBrecha` igual.

**El hallazgo aparece al leer el ADR en vez de suponerlo.** El 0077 no pide
«causa» en general: su cláusula 4 dice que **toda alerta de calidad nombra a
quién llamar y qué preguntarle, o no se emite** —«Revisar duración» no le sirve
a nadie; «¿Mary ya actualizó el formulario en su equipo?» sí—.

`AulasControles` emite alertas de calidad con severidades `revisar` y
`advertencia`, y sus frases dicen el hecho y su aritmética —«CH 31: 26
asistentes menos 1 rechazos y 3 duplicados dan 22, pero el parte declara 21
efectivas»— **pero no nombran al aplicador**. Y el dato está: `applied_by`
figura entre los campos que `monitoreo_aulas_control.R` declara para el control.

**No se implementa en esta pasada, y por qué:** no se pudo comprobar que
`applied_by` llegue poblado hasta el componente. Los controles salen de la hoja
«Base de control» del libro, y el proyecto disponible no tiene libro importado,
así que la tabla está vacía. Implementar sobre esa suposición es lo que este
loop ya pagó dos veces. **Queda como hallazgo con su cláusula, su dato y su
condición de verificación.**

#### El frente C, cerrado el 2026-08-29

| | Resultado |
|---|---|
| **C1** jerga | La dura —τ, deff, p25, π, afijación— **no llega a pantalla**. Lo que se ve es vocabulario del operativo o se auto-glosa. Una glosa en Estratos (`4bd2bb69`) |
| **C2** causa | Las 4 superficies que avisan **sí** la dicen. El hallazgo real salió del ADR 0077 cl. 4: el descuadre no nombraba al aplicador (`bb02fc40`, `335d7ed8`) |
| **C3** qué hacer | Cubierta por C2: los avisos revisados dicen hecho, causa y acción |
| **C4** denominador | 17 porcentajes revisados; sólo 3 no declaraban su base, con **dos denominadores en pantalla** y ninguno dicho (`a493d68d`) |
| **C5** orden de lectura | Los dos paneles de calidad declaran su procedencia (`cd0e755d`) |

**Lo que este frente enseñó sobre medir, y vale para los que quedan:**

- **Ninguno de los tres hallazgos reales salió de un detector.** Salieron de
  leer el ADR y de seguir el dato hasta su consumidor. Los detectores por
  palabra clave fallaron en las dos direcciones: uno dio CERO en un panel que
  cumplía —expresaba la causa sin decir la palabra— y otro dio 105 falsos
  positivos que eran estados vacíos.
- **Tres veces el defecto era que el código sabía algo que la pantalla no
  decía.** El comentario de Validación avisaba de «que una fila parezca
  respaldar a la otra»; el motor calculaba los porcentajes sobre `contestadas`;
  el parte traía `applied_by`. En los tres, el arreglo fue publicar lo que ya
  existía, no calcular nada nuevo.
- **No inventar jerarquía donde no la hay.** En Avance sí manda un panel sobre
  otro y el ADR 0082 lo sostiene; en Validación son dos fuentes distintas y
  declarar un orden habría sido peor que no declarar nada.

#### G2, 2026-08-29 — las tablas del perfil, medidas con filas reales

Ocho tablas recorridas con el plan cargado, comprobando dos cosas: que las
columnas de cifras lleven dígitos tabulares —sin ellos los números no alinean y
una columna se lee mal— y que ninguna repita el contenido de otra fila a fila.

| Superficie | Tabla | Sin tabular | Redundancia |
|---|---|---|---|
| `modelo/contacto` | 174 × 5 | 0 | 0 |
| `modelo/carga` | 174 × 5 | 0 | 0 |
| `modelo/agenda` | 174 × 12 | 0 | 0 |
| `avance/cuotas` | 30 × 4 | 0 | 0 |
| `avance/estratos` | 73 × 3 | 0 | 0 |
| `consultas/brechas` | 174 × 7 | 0 | 0 |
| `consultas/reemplazos` | 174 × 6 y 400 × 8 | 0 | 0 |

**Limpio.** El patrón que el registro de acreditación midió en Consultas —435
cadenas redundantes, tres columnas repitiendo debajo lo que ya decían arriba— no
aparece en aulas.

**Dos huecos de cobertura, declarados y no inferidos:** `avance/resumen` no se
midió porque su marca de readiness no llegó a limpiarse en 22 s, y
`calidad/base` no tiene tabla porque el proyecto no tiene libro importado. **No
son ceros: son no-medidos.**

**Y el detector dio un falso positivo antes de servir.** La primera corrida
señaló «TELÉFONO ≡ GESTIONES en 40 de 40 filas» en Contacto. Mirado en pantalla,
las dos columnas mostraban «—»: no hay teléfonos ni gestiones en este proyecto,
y comparar dos marcadores de vacío da igualdad perfecta. El detector ahora los
ignora. **Es el tercer detector de este loop que acusa en falso antes de
afinarse**, y los tres se cazaron mirando lo que señalaban en vez de contarlo.

## Cómo se midió, para repetirlo

Pila propia en el **8791** para no tocar el 8787 del usuario, sirviendo el SPA
del build. El medidor se instala una vez en `window.__medir` y se navega
empujando la URL con `history.pushState` más un `popstate`, sin recargar: el
warm start tarda ~3 minutos y repetirlo diecisiete veces por viewport habría
hecho inviable la pasada.

Cuatro trampas que costaron intentos: el bootstrap **no** abre el proyecto solo
aunque el log diga «sesión cargada»; `form_input` no dispara el `onChange` de
React y hay que usar el setter nativo; **`window.__pulsoNav` no existe en el
build servido**, es del dev server con Vite; y Monitoreo pide elegir el modo la
primera vez, que es por qué el `.pulso` traía `monitoreo: pending`.

### N · Que no crezca un archivo gigante — pedido explícito del dueño

| | Ítem | Estado |
|---|---|---|
| N1 | **`aulasMonitoreo.css` tiene 6.149 líneas.** Es la hoja más grande del perfil y ya concentra el estilo de las ocho pestañas. Partirla por superficie, con el kit común aparte | ◐ **5.699 hoy, 450 menos** (medido 2026-08-31). Sigue siendo la hoja más grande del perfil |
| N2 | **`AulasMonitoreoPage.tsx` tiene 2.949 líneas** y monta las ocho pestañas. Cada pestaña debería ser su propio archivo y la página quedarse en el enrutado | ☑ **1.505 hoy, 1.444 menos** (medido 2026-08-31): las ocho pestañas ya viven en su propio archivo (`AulasPestanaCuotas.tsx`, `AulasPestanaEfectividad.tsx`…) y la página quedó en el enrutado |
| N3 | **`monitoreo_aulas_universitarias.R` tiene 2.352 líneas**, más de un tercio del backend de aulas. Regla de extracción en caliente: cada fix que lo toque saca su tema a `monitoreo_aulas_<tema>.R` | ◐ **2.358 hoy** (2026-08-31), a **seis líneas** de las 2.352 que fijó el GOAL. Llegó a subir a 2.691, y 119 de ese crecimiento las puso el loop del registro académico. Dos pagos: `d020f6ff` saca la representatividad efectiva (−94) y `f0780cc9` el criterio de validez (−239). La regla sigue siendo **permanente**: el siguiente fix que entre aquí extrae antes de añadir. Candidato grande que queda: `monitoreo_aulas_normalize_plan`, 400 líneas por sí sola |
| N4 | Cuando N1 y N2 estén hechos, **proponer líneas base de congelamiento** para lo que quede, en `agentic/manifest.json` | ☐ depende de N1, N2 |

### A · Frescura del dato — «el tema central» según el dueño (2026-07-23)

Aulas consume Kobo: la efectiva del estudio **se define en la plataforma, no en
el parte** (`monitoreo_aulas_efectivas.R`, vocabulario fijado por el dueño).

| | Ítem | Estado |
|---|---|---|
| A1 | **Medir qué tan rápido se leen los resultados de Kobo hasta aparecer en el perfil de aulas**, extremo a extremo, y publicarlo. Lo pidió explícitamente y hoy no existe esa superficie | ☐ |
| A2 | **Kobo sin timeout**: un socket colgado deja el sync infinito. Toca el cliente compartido; declararlo | ☑ **ya está** (medido 2026-08-31): `.kobo_api_new_handle()` aplica `timeout` y `connecttimeout` con `curl::handle_setopt`, configurables por `PROSECNUR_KOBO_TIMEOUT_SECONDS`, y hay test en la sección «E. Transporte Kobo: timeout + retry» de `test-monitoreo-sync-incremental.R` |
| A3 | **Incremental de Kobo frágil**: cursor `_id > n` sólo en modo advance, fallback SILENCIOSO a full ante cualquier error, y no ve ediciones ni borrados. Una edición en Kobo no llega a aulas | ☐ · **pista concreta encontrada el 2026-08-31**: en `monitoreo_sync_incremental.R` hay dos `tryCatch` a treinta líneas uno de otro y sólo uno declara su fallo. El de `.monitoreo_sm_collectors_meta` (línea ~285) guarda el mensaje en `collector_sync_error`; el de `sm_api_fetch_collector_detail` (~320) hace `error = function(e) collector` y **descarta el error entero**, así que un recopilador cuyo detalle no se pudo leer llega con el objeto base y nadie se entera. Es de SurveyMonkey, no de Kobo, pero es el mismo patrón que esta etapa persigue. Sin tocar: hay que comprobar antes si el consumidor lo nota |
| A4 | **Paginación secuencial**. Kobo expone `count`: las páginas 2..N pueden ir con `curl::multi` | ☐ |
| A5 | **No existe auto-sync**: todo manual. Con el post-pull en O(delta) nada impide un tick de 1–2 min | ☐ |
| A6 | **Residual 3.10e**: bloqueo intermitente del main thread de plumber, ~178 s en 1 de 3 corridas. Congela la app entera, aulas incluida. Siguiente paso ya definido: logging con timestamps en harvest/on_complete | ☐ abierto, medido |

### B · Velocidad del perfil de aulas

| | Ítem | Estado |
|---|---|---|
| B1 | **Medir el coste real del dashboard de aulas**: `monitoreo_aulas_dashboard_cached` con su token. Cuánto cuesta un hit y cuánto un miss, sobre el `.pulso` de HSVG2026 | ☐ mide primero |
| B2 | **`AulasMonitoreoPage.tsx` sin `React.memo`**: cualquier setState re-renderiza las ocho pestañas | ☐ |
| B3 | **Payloads fila-por-fila**: comprobar si el patrón `lapply(seq_len(nrow(df)))` alcanza los motores de aulas | ☐ |
| B4 | **Invalidación**: qué invalida el token de aulas y si es selectivo o nuclear | ☐ |

### C · Legibilidad para quien no diseñó el estudio — frente NUEVO

| | Ítem | Estado |
|---|---|---|
| C1 | **Inventario de jerga en las ocho pestañas**: τ, elegible, estrato, cuota, afijación, p25. Cuál se dice en castellano y cuál se queda con su glosa al lado | ☐ |
| C2 | **Cada aviso dice su causa**, no sólo el hecho (ADR 0077). Medir cobertura real en aulas | ☐ |
| C3 | **Cada aviso dice qué hacer.** Varios diagnostican sin proponer acción | ☐ |
| C4 | **Todo número con su denominador visible.** Es el defecto más repetido del repo | ☐ |
| C5 | **El recorrido de primera vez** en las ocho pestañas. Hecho para dos superficies en el commit `e863b715`; faltan las demás | ☐ parcial |

### D · Predecir cómo vamos

| | Ítem | Estado |
|---|---|---|
| D1 | **La curva continua del ADR 0083** en el esquema de config | ☐ |
| D2 | **La banda de proyección ya existe** en el seguimiento de efectividad; falta que la serie diaria la use en vez de un esperado puntual | ☐ |
| D3 | **Actualización bayesiana de la tasa durante el campo.** Bloqueado por D1. Su invariante va antes que su fórmula; `porAulaAjustado` ya implementa encogimiento con `PESO_DEL_PRIOR` | ☐ bloqueado |
| D4 | **La ventana de reacción, dicha en pantalla**: con 7 días de anticipación la señal de la semana 2 es la última accionable, y el campo se concentra 86 · 68 · 36 · 4 por semana | ☐ |
| D5 | **Probabilidad de cierre por facultad**, no sólo proyección puntual | ☐ |
| D6 | **Invariante de monotonicidad** sobre el marco entero. Parte de **3.727 de 123.688 pares invertidos** | ☐ |
| D7 | **Invariante del sello**: **3.157,8** sobre los 174 titulares, antes y después | ☐ |

### E · Pulido estético

`pulido-monitoreo-estado.md` cubrió acreditación y telefónico. **Aulas apenas
aparece**, así que aquí el trabajo no es rematar pendientes ajenos sino auditar
por primera vez.

| | Ítem | Estado |
|---|---|---|
| E1 | **Auditar las DIECISIETE superficies de aulas** (el «ocho» era un error de scope) con los detectores medidos: recortes, solapes, contenido cortado, escala de radios y tipografía. Una fila por pestaña, con su cifra | ☐ ninguna auditada |
| E2 | **Declarar el Contrato de Superficie (C1)** en las superficies de aulas que no lo tengan: sin declaración el gate no puede aprobar | ☐ |
| E3 | **Matriz de viewports**: 1440×1000 y 1024×600 mínimo | ☐ |
| E4 | **Un día de muy pocos casos** no puede romper la codificación de una barra apilada. Medido en Ritmo diario de telefónico; comprobar si la serie de aulas tiene el mismo defecto | ☐ |

### F · Conceptos y nomenclatura

| | Ítem | Estado |
|---|---|---|
| F1 | **Tres tasas de la misma forma con tres numeradores distintos** conviven en Monitoreo: `effective_surveys` del parte, `sent_total` de la hoja y la efectiva de plataforma. El ADR 0082 fijó que sólo la de plataforma es τ; comprobar que el perfil de aulas lo respeta en las ocho pestañas | ☐ |
| F2 | **Continuar el barrido de colisiones.** Tres cerradas en `e863b715`; el barrido cubrió dos superficies de ocho | ☐ parcial |
| F3 | **Taxonomías de estado**: que un mismo estado se llame igual en las ocho pestañas | ☐ |

### G · Gráficas y tablas

| | Ítem | Estado |
|---|---|---|
| G1 | **Inventario de los gráficos de aulas** con qué pregunta contesta cada uno. El que no conteste ninguna, fuera | ☐ |
| G2 | **Tablas**: densidad, dígitos tabulares alineados, orden por defecto. En Consultas se midieron 435 cadenas redundantes por repetir abajo lo que ya decía arriba; buscar el mismo patrón en aulas | ☐ |
| G3 | **La serie de rendimiento** es el gráfico más cargado del perfil (1.404 líneas). Revisar si dice más de lo que se puede leer de un vistazo | ☐ |

### H · Calidad de campo y cierre

| | Ítem | Estado |
|---|---|---|
| H1 | **M7 escrito** — la decisión ya está tomada | ☐ |
| H2 | **M5** — bloqueado por si Kobo expone marcas de tiempo por pregunta | ☐ bloqueado |
| H3 | **`candidatosDeReemplazo` prioriza por margen de celda de sexo**, no sólo por puntuación del candidato | ☐ |

## Reglas del recorrido

- **Cada ítem cerrado deja su cifra**, antes y después. Un ítem sin medición no
  se cierra.
- **El gate se escala al diff**: suites del área tocada, nunca la completa.
- **Medir en la app, no leer CSS.** Auditar a ojo es inviable.
- **El proyecto de referencia decide el resultado.** Para aulas, el `.pulso` de
  HSVG2026; hay copia de trabajo en el scratchpad.
- **Todo se mide a las dos escalas**: ~100 y ~3.000 registros. Las dos son
  normales y una solución que sólo sirva a una no cierra su ítem.
- **Verde por conformidad, no por ausencia.** Se reportan tres números:
  conformes, no conformes y **no declaradas**.
- **Un frente terminado no cierra el GOAL.** Sólo Gonzalo lo cierra.
