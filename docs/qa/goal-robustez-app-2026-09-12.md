# GOAL — Robustez: que la app no falle al usarse

Tipo: GOAL (marco de robustez)
Estado: En curso
Fecha: 2026-09-12
Autoridad: Encargo de Gonzalo; una clase sólo se cierra con un guard probado matando un mutante

> **Hay DOS documentos de robustez con fecha del 12/09 y es a propósito.**
> Éste es el **MARCO**: el catálogo de clases de defecto y el listón —una clase
> sólo está cerrada con un guard que la caza, probado matando un mutante, y un
> barrido con su cifra—. El otro, `goal-robustez-2026-09-12.md`, es el **DIARIO**
> de la noche del 11 al 12: qué se midió, qué se arregló y las recetas que
> costaron encontrar. Si buscas «cómo se cierra una clase», estás en el bueno;
> si buscas «qué pasó y cómo reproducirlo», ve al otro.
>
> El puntero lo puso primero el diario; éste no lo devolvía, así que quien
> llegara aquí no sabía que el otro existe. Dos sesiones trabajan este árbol y
> los dos documentos se escribieron a la vez.

Encargo de Gonzalo del 2026-09-12: «deja la app robusta y sólida en un loop
definido de mejora continua».

## La vara, y de dónde sale

La jornada del 2026-09-11 cerró con **20 commits, 9 de ellos fixes** de defectos
que sólo aparecieron al mirar la app en vivo. No los vio ningún test, ningún
typecheck y ningún build. Ésa es la medida de fragilidad: **el código pasa sus
gates y falla al usarse.**

**Una clase de defecto sólo está cerrada con tres cosas**: un guard automático
que la caza, **probado matando un mutante**, y un **barrido con su cifra** que
diga cuántos hermanos vivos quedaban. Sin las tres, no está cerrada. No vale
«revisé y parece que no hay más».

## El catálogo — las clases y su guard

| # | Clase | Guard | Mutante |
|---|---|---|---|
| 1 | Un endpoint no existe hasta que se le llama | regla de trabajo, no guard | — |
| 2 | Una lista cerrada se traga el campo en silencio | `test-monitoreo-aulas-campos-declarados.R` | 27→25/2 |
| 3 | Dos vocabularios para el mismo estado | `test-monitoreo-aulas-estado-normalizado.R` | 9→6/3 |
| 4 | Un paso que puede no ocurrir y no lo cuenta | `test-monitoreo-aulas-publicar-marcas.R` | 55→54/1 y 51/4 |
| 5 | Anclar por igualdad exacta lo que el libro escribe con sufijo | (en publicar-marcas) | 55→49/1 |
| 6 | Un gate que no se corre | `make gate-area` (R) + `make gate-front` | 108/2 · 2 guards |
| 7 | Un concepto con dos implementaciones | `test-helpers-sin-duplicar.R` | 2→1/1 |
| 8 | Un estado de React que se escribe y nadie pinta | `estadoQueNadieLee.contract.test.ts` | 2→1/1 |
| 9 | **Un guard que deja de guardar** | `guardsQueGuardan.contract.test.ts` + `test-guards-que-guardan.R` | 2→1/1 en ambos |
| 11 | Un respaldo que se usa SIEMPRE | `brechaDeLaFacultad.test.ts` | 12→11/1 |
| 10 | La mitad que ESCRIBE se queda sin migrar | `test-monitoreo-aulas-distribucion-mantenimiento.R` | 4 fallos |
| 12 | **Un singular que se hizo plural deja consumidores atrás** | `test-monitoreo-aulas-distribucion-ciclo.R` + los de sincronización | 1 y 4 rojos |
| 13 | Cambié lo que el sistema HACE y no lo que CUENTA | recibos de publicar/sincronizar/adoptar | 3 rojos |
| 14 | **Una identidad comparada literalmente** | `test-aulas-libro-produccion.R` + `test-monitoreo-aulas-distribucion-aula.R` | 3 y 10 rojos |
| 15 | Una cadena vacía no es una celda vacía | `test-monitoreo-aulas-plan-dia-formato.R` | 2 rojos |
| 16 | Encoger y actualizar se ven igual en el recibo | `test-monitoreo-aulas-publicar-libro.R` + `avisoLibroPublicado.test.ts` | 1 rojo por capa |
| 17 | Un default que degrada en silencio (estatus, código) | `test-monitoreo-aulas-estados-desconocidos.R` | 7, 6, 2 y 1 rojos |

La 10 la cerró la otra sesión (`1ca67233`) y entra aquí porque este documento es
el catálogo común: cuando un cambio enseña a la mitad que LEE y la que ESCRIBE
se queda apuntando a lo viejo. El guard no comprueba el helper sino el defecto
en su forma observable —una cita del 16/09 cae en «Semana 2», «Semana 1» queda
intacta byte a byte y la cita nueva no aparece en ella—.

Las 12 a 17 las cerró la otra sesión el 2026-09-12 por la tarde, trabajando el
operativo de aulas contra datos reales. Las tres que más rindieron:

**12 — el plural.** `83d98403` hizo que el Sheets de los aplicadores llevara una
pestaña por semana. El productor quedó bien; los consumidores que leían «la
hoja» en singular, no, y aparecieron **cinco**: el aviso de publicar, el recibo
de sincronizar, `pestanas_ajenas` (declaraba «Semana 2» como hoja ajena),
`filas_del_equipo` y **la adopción**, que fijaba sólo la semana 1 — y adoptar es
lo que impide que el sorteo mueva asignaciones ya comunicadas a diecinueve
personas. Barrido: `grep` del nombre en singular y visita a todos.

**14 — la identidad literal.** Tres instancias el mismo día. El nombre del
aplicador partía a dos personas en cuatro en la hoja de producción (`Aquino
Dulanto, Alejandro` y `Aquino Dulanto Alejandro`) porque se agrupaba por
`aulas_nombre_aplicador()`, que su propia cabecera declara **presentación, no
identidad**. Y el código del aula: la ADOPCIÓN normaliza «CH164»→«CH 164» y la
CORRECCIÓN DE AULA comparaba literal, así que cinco filas de «Semana 1»
conservaban su aplicador y se quedaban sin la corrección del aula. Barrido de
los demás índices por código: partes y Base de control **0 fuera del plan**,
porque esas hojas las siembra la app con los códigos puestos — la exposición
está donde la gente teclea.

**15 — la cadena vacía.** El `#REF!` del «Plan del día» que se arrastró una
jornada. La hoja se escribe como RECTÁNGULO y Sheets rellena las filas de
reserva con cadena vacía; `ISBLANK` la da por ocupada y `FILTER` no se expande.
Invisible desde fuera: `values.get` devuelve `""` para una celda vacía y para
una con cadena vacía, e `includeGridData` no le ve `userEnteredValue`. Sólo una
fórmula evaluada DENTRO de la hoja lo delata (`COUNTA` de una fila «vacía» dio
20). Costó tres hipótesis falsas, una de ellas comunicada al lead como causa.

La 9 es la más cara: apaga la infraestructura que sostiene a las demás y **no
deja rastro** —no hay rojo, no hay aviso, sólo deja de proteger—. La forma es
enumerar un directorio, filtrar y afirmar que la lista de culpables está vacía:
si el filtro deja de casar, la lista sale vacía *porque no se miró nada*. La
vacuna es una línea: comprobar que el barrido encontró algo antes de afirmar que
no encontró nada malo.

### El patrón que une a los peores

**No es el paso que calla: es el que da la razón equivocada.** Un paso mudo deja
buscando; uno que miente manda al sitio equivocado, y eso cuesta mucho más.

- «Esa hoja no está en el libro» cuando fue la red.
- «Credenciales inválidas» cuando fue el secreto ilegible.
- «Cero respuestas» cuando fue un portal cautivo.
- «Traspaso verificado» cuando no se verificó nada.

## Los defectos vivos que encontró, con su cifra

1. **Marcar un refuerzo era imposible sobre el plan real** — el plan de sesión
   guarda «SIN CONTACTAR» y el motor comparaba `sin_contactar`: **1.213 de
   1.218** reservas inalcanzables.
2. **Activar un reemplazo decía «no quedan reservas» teniéndolas todas** — doble
   causa: la cadena se resolvía por `replacement_for` (de 202 valores, **cero**
   coincidían con un titular) y el estado se comparaba crudo.
3. **El sello de la marca se caía camino al tablero** — `activation_origin` y
   `activated_for` no estaban declarados; después, `replaced_by`.
4. **La segunda publicación no habría encontrado ninguna marca** — tras releer
   el libro, el estado vuelve a su forma de Excel. Lo cazó el guard solo.
5. **El paquete de defensa se armaba con una selección de otro escenario.**
6. **Una hoja que falla por red se reportaba como «no está en el libro».**
7. **Renovar el acceso a Google fallaba en silencio** y salía el 401 crudo.
8. **Un 200 de Kobo con cuerpo ilegible** podía leerse como **cero respuestas**.
9. **Un XLSForm ilegible dejaba pasar el traspaso sin verificar** — fallar
   abierto en la puerta que existe para cerrar.

## Medidas que no conviene volver a pagar

- Tablero de aulas: **5,45 MB**, 56 claves; `agenda` sola **4 MB** (1.392 filas
  × 107 campos, 21 vacíos en todas — `section` entre ellos).
- `/state`: **8,1 s** la primera vez, **~2,6 s** desde caché. O sea **~5,5 s de
  construcción** y ~2,6 de serializar y transportar.
- Los cuatro `report_scope` de aulas devuelven el mismo payload **byte a byte**.
  `scopeForView()` los varía por sección, así que cambiar de sección reconstruye
  el tablero que ya se tenía. **El token que decide es el general**
  (`monitoreo_router_estado.R:57`), compartido por todas las familias: no se
  toca. El arreglo vive en el frontend y es **decisión de Gonzalo**.
- Helpers de texto en el backend: **69 distintos, sólo 5 con cuerpo repetido**.
  El conteo bruto (61 archivos) exagera: la mayoría tiene comportamiento propio.
- `useState` en el frontend: **1.754**, uno huérfano.
- Guards que leen fuentes: **300** (94 en R, 206 en el frontend). Con la firma
  peligrosa —enumerar, filtrar y afirmar vacío sin centinela— **26, todos en el
  frontend; en R, cero**. Ocho llevan ya centinela. **Y la cifra bajó de 18 a 11
  al afinar la firma**: contar `.filter(`/`.flatMap(` marcaba guards que sólo
  iteran una lista LITERAL —ésos fallan cerrado, porque `readFileSync` revienta
  si el archivo no está—. El riesgo sólo existe con `readdirSync`/`globSync`:
  preguntarle al sistema de archivos qué hay y filtrar. **Siete de dieciocho
  eran falsos positivos del propio barrido** — tercera vez en este loop.
  **Tope 2** (de 26 al abrir la clase). Los dos que quedan están en cálculo de
  muestra —`cssHuerfano` y `plegadoCriterios`—, área de la otra sesión: medidos
  y sin tocar. **En R: 9 guards enumeran `api/R`, 6 ya tenían centinela, 1 no lo
  necesita y 1 era real** (`test-graficos-negrita-render`, que afirma dentro de
  un bucle: sin coincidencias no ejecutaba **ni una sola aserción**). Tope **0**
  en el backend, y el meta-guard entra al `gate-area` como transversal.
  **Variantes ya barridas y en cero**: bucles que afirman sin comprobar que hay
  algo que recorrer (R y frontend), e `it.each` sobre una lista del disco —que
  con la lista vacía no ejecuta ni un caso—. Y un agujero del propio meta-guard:
  miraba `.test.ts` y dejaba fuera **210** archivos `.test.tsx`.
  El centinela tiene DOS formas y el meta-guard reconoce las dos: contar lo
  encontrado, o declarar la lista de archivos a vigilar y comprobar que siguen
  existiendo —así lo hacía ya `capacidadDeclarada`, y el meta-guard lo acusó por
  la sintaxis: **cuarto falso positivo suyo**—. El más silencioso era
  `nombresNormalizados`, con
  `it.each(fuentes)`: con la lista vacía no corre ni un caso y la suite pasa sin
  un solo rojo NI un solo test ejecutado.
- Claves del tablero consumidas por el perfil: **52, cero huérfanas**.
- **La suite COMPLETA de R, la que nunca se corre**: `test_dir` entero tarda
  **~1 h 25 min** en este equipo (con gates en paralelo) y da **36.093 pass, 0
  fail, 0 error** (2026-09-12). Es la clase 6 en su forma extrema —el gate que
  cuesta una hora es el que puede esconder un rojo semanas— y hoy está limpia.
  El frontend completo: **935 archivos, 8.949 tests, 0 fallos**.

## Trampas del propio método, aprendidas aquí

- **Un barrido estático no cierra una clase.** 3 falsos positivos de 52 (6 %) en
  un barrido por regex. Cada señal se verifica contra el dato vivo.
- **Un mutante mal hecho no prueba nada.** Dejar la variable citada en código
  muerto no reprodujo el defecto; hubo que borrar el bloque entero.
- **Explicar sin medir.** Dije dos veces que el endpoint de marcar reconstruía
  el tablero. Era falso: sólo invalida cachés. Y el arreglo de caché que hice
  después **no cambió el tiempo**, medido.
- **Un «Abierto» puede estar cerrado.** Con dos sesiones en el árbol, un
  pendiente se reverifica en el código antes de trabajarlo.
- **Un guard que da un falso rojo se acaba ignorando** — `tokensDefinidos` se
  cazaba a sí mismo al escanear los tests.
- **Una exclusión sin su motivo escrito** es por donde se cuela el caso real.
- **Un test guardado bajo el nombre de OTRA área no se corre cuando hace falta.**
  El gate por área filtra por patrón: quien toca el handoff filtra por
  «handoff». Metí tres áreas en un archivo llamado de una sola y dos quedaron
  fuera de su gate.
- **Mirar la app sin saber qué build sirve es mirar el pasado.** El bundle era
  de las 04:07 y el arreglo de «planificados 74 → 174» de las 04:19: la pantalla
  seguía enseñando el defecto y estuve a punto de reportarlo como vivo, con el
  código arreglado doce minutos antes. Primo del warm start que recicla un
  worktree viejo y de los dos backends sobre el mismo `.pulso`. **`make
  build-al-dia` lo contesta en un segundo**, y hay que preguntárselo ANTES de
  creerle a la pantalla. Corolario incómodo: releer el código tampoco basta para
  cerrar un defecto —hay que mirar la app— pero mirar la app sin esto tampoco.
- **`querySelector` DESCIENDE.** Medir los paneles de una vista con
  `section` + `querySelector("h3")` cuenta también cualquier contenedor que sea
  `<section>` —el `mon-workbench` lo es— y devuelve el título de su primer hijo:
  parecía un panel DUPLICADO y un hueco de 1.334 px, y no había ni una cosa ni
  la otra. Para contar paneles hay que anclarse a `.mon-profile-panel`, que es
  lo que declara «esto es un panel», no a la etiqueta.

## La pestaña Refuerzos, medida (2026-09-12)

Tres paneles, sin desbordes: «dentro del techo» **1.728 px**, «de una en una»
621, «pedidos» 103 (vacío). El viewport del banco de trabajo son **550 px**, así
que la vista mide 2.630 y se recorre casi entera con scroll. El primero se lleva
el 66 % del alto porque lista 15 filas + el mando + las dos lecturas. Si hay que
tocar algo de diseño, es ése: **el orden de lectura es correcto —propone,
decide, rinde cuentas— pero la proporción no lo acompaña.**

## Las tarjetas del Resumen, barridas (2026-09-12, con el build al día)

**7 tarjetas, las 7 leen la fuente que su rótulo promete.** Efectivas 1.390 =
`respuestas_validas`; los dos avances cuadran con su división (55,6 % y 37,1 %);
planificados **174** = titulares del plan, ya corregido.

**El matiz que queda, y es decisión de contenido, no defecto**: «CURSOS-HORARIO
APLICADOS · 75» y «PLANIFICADOS · 174 · titulares del plan» están una al lado de
la otra e invitan a leer **75/174 como una tasa**, y no lo es — el numerador y
el denominador son poblaciones distintas. Medido sobre el operativo:

| Cifra | Qué cuenta |
|---|---|
| **75** | con parte **o** con respuestas (lo dice su subtítulo) |
| **74** | con respuestas: 73 titulares + 1 reserva de cadena |
| **73** | titulares con respuestas (`rol.titulares.aplicado`) |

Las tres son correctas para su definición y la tarjeta declara la suya. Lo que
no hay es una pareja numerador/denominador del mismo grano. Emparejarla —75 con
el total de lo aplicable, o 73 con 174— es decisión de Gonzalo.

## La clase 11: un respaldo que se usa siempre

`brechaDeLaFacultad` leía `celda.achieved` con un respaldo `target - missing`.
**El motor no publica `achieved` en ninguna parte**: las 30 celdas traen
`observed`. La rama principal era código muerto y todo pasaba por el respaldo,
que da el mismo número — por eso nunca se vio.

La firma de la clase: **un respaldo que se usa siempre no es un respaldo, es la
única vía**, con una rama delante que sugiere dos fuentes donde hay una. Y el
día que falte lo que alimenta al respaldo, devuelve un número plausible y falso
—aquí, la meta entera como logrado—.

**Barrido hecho** (contra el payload vivo, no contra el código): **299 campos
snake_case que el perfil lee**, 64 fuera del tablero —casi todos de OTROS
objetos: config, estado, respuestas de endpoints— y **sólo dos con la firma**:

- `achieved`: muerto en todo el backend → arreglado a `observed` (`efa3bd98`).
- `sex_key`: **vivo, pero en otra estructura** —lo publica
  `calc_muestra_distribucion.R`— y ausente de `quotas_sex_faculty`, que es lo
  que este código lee. Se deja el orden y se documenta (`5a73cac3`): si algún
  día llegara es más fiable, pero hoy quien sostiene esto es el respaldo.

La diferencia entre los dos es la que importa: **un alias muerto se arregla; uno
vivo en otro sitio sólo necesita decirse.** Cambiar el segundo habría sido tocar
por tocar.

## La clase 12: dos respaldos del mismo dato ausente, en la misma pantalla

Hermana de la 11, y peor: la 11 es un respaldo que se usa siempre; ésta son DOS
respaldos que se contradicen a la vista.

`Casos asignados` es una columna opcional del libro. Los dos perfiles que pintan
el panel de barrido resolvían su ausencia de dos maneras distintas **en la misma
superficie**: la cabecera con `row.assigned ?? 0` («0 personas asignadas») y
cada fila con `row.assigned ?? row.pending` (tantas asignadas como le faltan por
barrer). Un responsable que barrió 98 de 100 salía «2 personas asignadas · 0
casos barridos · 100 % pendiente», bajo una cabecera que decía 0.

Arreglado en `837e3194` con `barridoDelResponsable()` + `totalDeAsignadas()`:
sin la columna no hay asignadas ni porcentaje, se muestra «S/D» y cuántos
responsables no traen el dato. Mutante: revertir el cableo deja 4 rojos.

**El guard va acotado a propósito.** Lo intenté genérico —agrupar por campo los
respaldos divergentes de todo `features/monitoreo`— y da **129 casos en 415
archivos**, casi todos legítimos (`?? ""` al normalizar y `?? otro.campo` al
mostrar son contextos distintos). Un guard que nace con 129 en su línea base no
guarda nada. También quedan fuera los `?? 0` que sólo ORDENAN listas: no
publican ninguna cifra. Si alguien retoma la idea genérica, el filtro que le
falta es «¿este valor se publica o sólo se compara?», y eso no sale de un regex.

## El desnivel entre familias, medido (2026-09-12)

El barrido de las 11 clases se hizo **entero sobre cursos-horario**. Lo que las
otras tres familias tienen hoy:

| familia | contract tests | .tsx | `data-qa-geometry-capacity` |
|---|---|---|---|
| aulas | **31** | 116 | 79 |
| territorial | **0** | 15 | 0 |
| acreditación | **0** | 12 | 4 |
| telefónico | **2** | 11 | 0 |

Territorial y telefónico tienen operativo real. La primera consecuencia concreta
es que `ui-quick-check --require-geometry` no puede aprobar por conformidad en
esas vistas: no hay nada declarado que comprobar. **El QA visual sigue sin
correrse en todo el loop**, y es el candidato natural del próximo tramo.

**Falso positivo registrado** para no volver a perseguirlo:
`item.duplicate_count ?? item.duplicate_group_size` aparece 9 veces entre
acreditación y telefónico y NO es defecto — el motor asigna los dos nombres al
mismo vector (`monitoreo_engine.R:19143-19144`).

## Territorial, barrido entero (tick 40) — y salió limpio

Tres clases sobre las 15 vistas del perfil. **Ningún defecto vivo.** Vale
anotarlo con su cifra porque un «sin hallazgos» sin barrido detrás no vale nada:

- **Clase 3 (dos vocabularios)**: 57 estados comparados, **los 57 atados**. Nueve
  son vocabulario propio del perfil, ahora declarado con su procedencia en
  `territorial/estadosAtadosAlMotor.contract.test.ts` (`7c1dd4b4`), el PRIMER
  contrato de esta familia. Dos mutantes muertos.
- **Clase 1 (endpoint sin invocar)**: 87 rutas de monitoreo declaradas, **1 sin
  rastro** — `/api/monitoreo/sheets/oauth/exchange`. No es defecto vivo: la
  función ya se invoca desde `router_connections.R:596`; el endpoint de
  monitoreo es un duplicado muerto. Deuda menor, anotada y no arreglada.
- **Clase 11 (respaldo que se usa siempre)**: `row.validas ?? row.response_count`
  en la tabla «Válidas» **no es defecto** — el motor asigna `validas` siempre
  (`monitoreo_engine.R:14049`, `as.integer`, nunca nulo) y `response_count` no
  existe en el territorial. El respaldo es código muerto.

### Tres falsos positivos, para no volver a perseguirlos

1. `sin_gps`/`without_gps`, `sin_cruce`/`without_cross`,
   `fuera_distrito`/`outside_frame` **no son un vocabulario duplicado**: son dos
   union types deliberados —estado del caso vs tipo de sección— con conversión
   explícita en `TerritorialValidationGeoWorkbench.tsx:2608-2641`.
2. `en_zona`/`en_distrito`/`fuera_distrito` no están en R porque **los calcula el
   frontend** desde `geo_estado` (mismo archivo, 1851-1860).
3. **El sesgo del propio barrido**: en R los nombres de campo van SIN comillas
   (`outside_route = ...`), así que contrastar contra `"literal"` fabrica
   huérfanos falsos. Corregirlo bajó los huérfanos de 11 a 9, y los 9 restantes
   eran todos legítimos.

**Lo que esto dice del método**: en estático, territorial ya está sano. El
rendimiento que queda en esta familia no está en barrer más clases a mano — está
en el QA visual, que sigue sin correrse y que en territorial no puede aprobar
por conformidad (0 de 15 vistas declaran geometría).

## La clase 13: ausente y «en falso» significan cosas opuestas (tick 41)

`estadoListo()` (`lib/navegacion/runtime.ts:67-71`) responde dos motivos que se
leen al revés: **sin** `[data-audit-ready]` dice `sin-marca-de-readiness` —«esta
vista no participa del contrato»— y quien mide **corta**; con la marca en
`"false"` dice `marca-en-false` —«hay contrato y aún no se cumple»— y **espera**.

React no renderiza un atributo cuyo valor es `undefined`. Los TRES perfiles de
monitoreo publicaban `data-audit-ready={cargando ? undefined : "..."}`: durante
toda la carga afirmaban el primer motivo. **El QA visual daba por no medibles
territorial, acreditación y telefónico enteros —38 vistas— y el gate no fallaba,
simplemente no llegaba.** Verde por ausencia, en el propio instrumento que existe
para impedirlo.

Arreglado en `1183ef8d`. **Prueba de punta a punta**, que es lo que vale aquí: con
`ui-quick-check` sobre `acnur_acg`, el motivo de `monitoreo/territorial/avance`
pasó de `sin-marca-de-readiness` a `marca-en-false`. La vista aún no alcanza
readiness con ese proyecto —eso queda abierto— pero ahora el runner la espera y
el motivo dice dónde mirar.

Guard: `app/readinessQueSeDeclara.contract.test.ts`. **Barre**, que es lo que
faltaba: el contrato hermano `auditReadyRoutes` nombra páginas UNA A UNA, así que
una página que nadie añadió nunca se entera. Declara los dos sitios donde borrar
la marca sí es correcto (PageFrame delegando al panel interior; `isRoster`, que
no es carga), verificados uno a uno.

### Un contrato que fotografía la forma acaba defendiendo el defecto

`TerritorialReadinessContract` se llamaba «no publica monitoreo mientras la vista
sigue cargando» —intención correcta— pero afirmaba la FORMA exacta
`/\{activeLoading \? undefined :/`. Cuando el defecto ES la forma, el contrato lo
congela: estuvo en verde todo el tiempo. Reescrito sobre la intención. **Es la
clase 9 en su forma más incómoda**: el guard no dejó de guardar, guardaba lo
contrario de lo que debía.

### Corrección de una cifra del tick 40

El tick 40 publicó «territorial: 0 contract tests». **Es falso**: tenía uno,
`TerritorialReadinessContract.test.ts`, que mi barrido no vio porque contaba sólo
`*.contract.test.ts` y ése usa otro patrón de nombre. La tabla del desnivel entre
familias está medida con ese sesgo y **cuenta de menos en todas**. El conteo que
no miente es por `readinessQueSeDeclara`-style: barrer, no listar.

## El QA visual CAPTURA por fin, y el tope era la otra mitad (tick 42)

Dos causas, no una. El tick 41 arregló la marca borrada; faltaba ésta:
**`DEFAULT_TIMEOUT_MS` son 30 s** (`scripts/ui-quick-check.mjs:18`) y el warm
start de Monitoreo con proyecto real tarda **4-6 min**. Con el tope por defecto,
`make ui-quick-check` sobre cualquier vista de Monitoreo **no puede pasar nunca**.

Medido sobre `monitoreo/territorial/avance` con `acnur_acg`:

| tope | resultado |
|---|---|
| 30 s (defecto) | se rinde en `marca-en-false` |
| **420 s** | **ok=true · captures=1 · issues=0 · geometryGroups=1 · geometryIssues=0 · geometryCoverageMisses=0** |

Con `--require-geometry --fail-on-issues` también aprueba, así que **es verde por
conformidad, no por ausencia**. Es la primera vista de Monitoreo que el QA visual
mide en todo el loop. Matiz honesto: aprueba con **1 grupo** de geometría
declarado en una pantalla de ~10 paneles; aulas declara 79 de 116 archivos. Pasar
el gate y estar instrumentado no son lo mismo.

`acnur_acg` **sí** trae monitoreo (`modules_summary.states.monitoreo = "ready"`):
la hipótesis del proyecto equivocado queda descartada.

El aviso se arregló en `cb7de8e2`: decía el hecho y no la causa, y distinguir
«está rota» de «no le diste tiempo» costó un ciclo entero. La pista va en helper
único porque el mismo aviso ciego estaba en los TRES sitios que esperan readiness.

### Hallazgo de la pantalla: tres respuestas a «¿qué falta?» (para Gonzalo)

En Avance territorial, a la vez y sin base común visible:

- «ESTADO GENERAL DEL CAMPO»: 1.283 de 1.200 válidas · 107 % · «Meta superada,
  +83» · **PENDIENTES 0**.
- «UMP pendientes»: **21**, cada una con «FALTAN 8» (≈168 encuestas).
- «ESTADO UMP · CUOTA OPERATIVA»: 147 completas · **3 cuota pendiente** · 0 no
  iniciadas.
- «Distritos con brecha: 0 — Sin distritos rezagados».

**Cada cifra puede ser correcta en su base** —válidas, UMPs, cuota operativa— y
por eso no lo llamo defecto. Pero la pantalla responde 0, 3 y 21 a la misma
pregunta, con la meta ya superada. Es la pareja 75/174 otra vez: emparejarlas
cambia lo que la tarjeta significa, así que **lo decide él**.

**Rama muerta anotada, sin arreglar**: `dimensions.survey_source_id` (primera de
tres alternativas en `Acreditacion/TelefonicoSourcesModel.ts`) no existe en
`api/R`. No hace daño porque `sourceId` siempre viene de `source.id`; si algún
día llegara vacío, `"" === ""` casaría con el primer candidato que hubiera.

## La geometría declarada, medida con los DOS mecanismos (tick 43)

El tick 41 dijo «territorial: 0 de 15 declaran geometría» contando sólo
`data-qa-geometry-capacity`. **Esa cifra estaba sesgada**: hay dos mecanismos y el
gate acepta los dos. Con ambos:

| familia | `-capacity` | `-group` | `-member` |
|---|---|---|---|
| aulas | 79 | 19 | 78 |
| territorial | **0** | 2 | 1 |
| acreditación | 4 | 5 | 5 |
| telefónico | **0** | 1 | 0 |

Y el detalle que importa: el grupo que hace aprobar a territorial es
`monitoring-workbench-rows`, declarado en **`components/MonitoreoWorkbenchChrome.tsx`
—el chrome compartido—**, no en ninguna vista de territorial. El gate comprueba de
verdad que las filas del workbench sean consistentes entre sí (contrato
`intrinsic`, tolerancia 2 px), y eso es genuino; pero **ningún panel de territorial
declara su propia capacidad**. Aprobar el gate y estar instrumentado no son lo
mismo, y ahora está medido en vez de intuido.

**Nota de método, tercera vez en tres ticks**: cada cifra que publiqué sobre
cobertura salió sesgada por contar UN patrón donde había varios —`*.contract.test.ts`
frente a `*Contract.test.ts`, `"literal"` frente al nombre desnudo en R, y ahora
`-capacity` frente a `-group`—. Antes de publicar un conteo de cobertura, enumerar
primero los mecanismos que cuentan como cobertura.

## Territorial medido entero, 6 de 6 secciones (tick 43)

Primera familia completa por el QA visual. Una sola pila para las 5 secciones que
faltaban: `ok=false captures=5 issues=1 · popovers=15 popoverIssues=0 ·
geometryGroups=6 geometryIssues=0 geometryCoverageMisses=0 · scrollJails=0
derrames=0 solapes=0 desbordes=0 · pageErrors=0 apiErrors=0 resourceErrors=0`.

**El issue, arreglado y reverificado en el mismo tick** (`6942ea10`): en Consultas,
el placeholder «Buscar UUID, UMP, distrito, manzana o encuestador...» medía
**323 px en 294 disponibles** y se cortaba a media palabra — `placeholder-clipped`.
El input usaba el placeholder como etiqueta y no tenía nombre accesible, así que
la enumeración pasó al `aria-label` (que no se recorta) y el campo dice lo justo.
Reverificado con el mismo instrumento: `ok=true issues=0`.

### Cómo se corre esto sin desperdiciar tiempo

**Varios `--route` SÍ comparten una sola pila** —una API, un Vite, una sesión—,
así que 5 secciones caben en una corrida. Lo que no comparten es la hidratación
de cada página: **~12 min para 5**. En este tick estuve a punto de darla por
colgada a los 10 min y escribir en el encargo la conclusión contraria; la corrida
terminó bien. **No la des por muerta antes de ~15 min.**

Lo que NO funciona para esto es `--ir` repetido: encadena las direcciones y
captura sólo la última (`runCaptures`: el bucle `for (const destino of
opts.direcciones)` corre entero antes de la captura). Las vistas se piden por
`--route` con query, que es para lo que existe la regla de que toda vista sea
enlazable.

## Las tres familias bloqueadas, medidas (tick 44)

16 vistas. Las tres que el defecto de readiness dejaba fuera del gate ya miden y
aprueban con `--require-geometry --fail-on-issues`:

| familia | vistas | resultado | grupos de geometría |
|---|---|---|---|
| territorial | 6 | 1 issue, arreglado y reverificado | 6 |
| acreditación | 5 | **ok=true, 0 issues** | 10 |
| telefónico | 5 | **ok=true, 0 issues** | 6 |

En las tres: 0 pageErrors, 0 apiErrors, 0 resourceErrors, 0 scrollJails, 0
derrames, 0 desbordes, 0 geometryIssues, 0 geometryCoverageMisses.

### El defecto que el gate NO cazó, y salió de mirar la captura

En Validación territorial, «Cargando cartografia» y «Completando cartografia
local» se anclaban en `top:10px; right:10px` — la misma esquina que
`.mon-territorial-map-tools`, que lleva `z-index: 4`. La barra de zoom se les
montaba encima y sólo asomaban **dos letras** («Co»). El usuario ve un mapa a
medias y la explicación está debajo del control.

`ui-quick-check` reportó **`solapes=0`**. Arreglado en `36b4d5ed` (los dos a
`top: 58px`) con guard propio que lee el CSS, porque **un detector que no lo vio
no puede ser el único que lo vigile**. Mutante muerto.

**Esto acota lo que el gate visual prueba**: mide recortes, derrames, desbordes,
scroll jails y consistencia geométrica de los grupos declarados. NO cazó dos
elementos absolutos superpuestos en la misma esquina. Un `ok=true` es una cota
inferior de calidad, no un certificado — las capturas siguen valiendo la pena
mirarlas.

### Lo que se ve en las capturas y es decisión suya

En Validación territorial, «RECONCILIACIÓN UMP — **Sin sospechas espaciales**»
encabeza una lista donde UMP 1, 2 y 3 muestran «8 fuera distrito», «10 fuera
distrito», «8 fuera distrito» en rojo. Son dos comprobaciones distintas —el GPS
sugiere otra UMP vs el punto cae fuera del distrito— pero se leen como una
contradicción. Misma familia que las tres cifras de «¿qué falta?» en Avance.

### Trampa del método, propia

Revertí un mutante con `git checkout --` sobre un archivo que **ya tenía mi
arreglo sin commitear**, y me llevé por delante el arreglo junto con el mutante.
Para deshacer un mutante hay que revertir LA LÍNEA, no el archivo.

## Las 16 capturas del tick 44 están tomadas ANTES de que Plotly pinte (tick 45)

Abrí la captura de telefónico/avance y el panel «Ritmo general Kobo» tenía el
gráfico **completamente vacío**: marco de ~250 px, eje X con sus valores (14, 74,
109, 133, 75, 15, 3), leyenda, y ni una barra. Estuve a punto de reportarlo como
defecto del producto.

**No lo es.** Recapturado con `--post-click-wait-selector ".js-plotly-plot"`, el
gráfico sale perfecto: barras, línea de acumulado, los dos ejes rotulados y la
línea de corte. Era artefacto de mi captura — exactamente lo que advierte la
ayuda del runner: *el puente de readiness dice que la vista montó, no que su
contenido asíncrono terminó de pintarse*.

**Corrección del tick 44**: dije «16 vistas medidas y aprueban». Se midieron **en
un estado intermedio**: cualquier panel con Plotly estaba vacío al capturar. El
`ok=true` vale para lo que midió, pero la cobertura es menor de lo que afirmé, y
las capturas no sirven para juzgar gráficos. **Hay que rehacerlas con el flag.**

Y una laguna del gate que esto deja a la vista: **un panel de 250 px vacío no
produce ningún issue**. No es recorte, ni derrame, ni desborde. `ok=true` con un
hueco donde debía haber un gráfico.

### Verificado y NO arreglado: clases muertas en el mini de ritmo

`is-plotly-ready` / `is-plotly-loading` aparecen **una sola vez en todo el repo**
(`telefonico/avance/AcreditacionAdvanceDailyMini.tsx:117`) y **ningún CSS las
define**; tampoco las consulta ningún test ni script. El `useState` + `useEffect`
+ `useCallback` + `chartSignature` que las alimentan trabajan en cada render para
componer una clase que no pinta nada.

**Matizado en el tick 46, y conviene leerlo antes de tocar nada**: la maquinaria
NO está muerta. `onReady` existe de verdad en `frontend/src/lib/PlotlyChart.tsx:102`
y se invoca (líneas 140 y 185); el `dashboard/shared/PlotlyChart.tsx` es sólo un
re-export, y por buscar ahí estuve a punto de escribir que el callback no se
llamaba nunca. Lo único que falta es **el CSS que aprovechaba esas dos clases** —
casi seguro un fade-in mientras Plotly monta, que es un parpadeo real: mis propias
capturas del tick 44 lo demuestran. Elegir entre reponer el estilo o retirar las
clases es decisión de diseño, no de robustez: queda para Gonzalo.

**Además, el componente está DUPLICADO y divergido**: `acreditacion/avance/` y
`telefonico/avance/AcreditacionAdvanceDailyMini.tsx`, mismo nombre, 479 y 477
líneas; sólo la de telefónico tiene `compactHeight` y el estado de Plotly. Un
arreglo en una no llega a la otra.

### Barrido de clases sin CSS: medido, NO publicado

Clases `is-*`/`mon-*` compuestas en TSX de monitoreo cuyo bloque no existe en
ningún CSS: el barrido da 46 sobre 1.626, pero **al menos 10 son artefactos**
(prefijos de plantilla como `mon-mode-`, que terminan en guion). No publico la
cifra hasta afinarlo; sí queda el criterio: el límite correcto es
`\.clase(?![\w-])`, porque `\b` no distingue el bloque de su variante BEM
`__elemento` ni de un `-sufijo`.

**Cuarta vez que un barrido mío sale sesgado**, y esta vez el sesgo estaba en la
herramienta con la que verifiqué el barrido: un `grep` con `[a-z0-9-]*` truncaba
`.mon-vacio-con-salida__accion` y mostraba el prefijo como si fuera el bloque, lo
que me hizo creer que el barrido daba un falso positivo. **Dos herramientas con el
mismo sesgo dan conclusiones opuestas y ninguna avisa.**

## Las corridas de ui-quick-check NO se paralelizan (tick 46)

Lancé territorial y acreditación a la vez para ganar tiempo y territorial murió
con **«La API arrancó con proyecto, pero /api/system/bootstrap no devolvió sid»**:
las dos pilas se pisan en el puerto de la API. Van **en serie**. Varias `--route`
dentro de UNA corrida sí comparten pila, que es la forma de ahorrar warm start.

Anotado en CLAUDE.md junto a la trampa del flag de Plotly (`aabf6173`).

## El flag de Plotly rompe las vistas SIN Plotly (tick 47)

`--post-click-wait-selector ".js-plotly-plot"` aplicado a toda una familia mató la
corrida de acreditación en la primera ruta:

> La ruta "/monitoreo?seccion=actores" no alcanzó readiness final antes de la
> captura: **sin-marca-de-readiness**. Esa vista no declara `data-audit-ready`:
> es una laguna de contrato, y esperar más no la arregla.

Esa misma sección capturó bien en el tick 44 **sin** el flag, así que el flag es
lo que cambia. Por qué exactamente, sin determinar — no teorizo. Lo práctico:
**el flag sólo a las vistas que montan Plotly**, que son pocas y están
localizadas:

| familia | importa Plotly | ¿lo MONTA de verdad? |
|---|---|---|
| territorial | `TerritorialAdvanceWorkbench.tsx` | **NO** — `waitSelectorMisses=1` |
| acreditación | página + mini + `PhoneDailyTrend` | sin confirmar |
| telefónico | página + mini | **SÍ**, en avance (hecha, tick 45) |

**Corrección del tick 47: el import NO prueba el render.** Armé esa tabla leyendo
imports y di por hecho que territorial/avance tenía gráficos. La corrida con el
flag lo desmiente: `ok=false ... waitSelectorMisses=1` con `issues=0` — el
selector nunca apareció. Coincide con la captura, que tiene círculo de progreso
SVG y barras CSS, ningún Plotly. **`waitSelectorMisses` es la forma barata de
saber si una vista monta gráficos**; adivinarlo por imports no lo es.

Para el resto, las capturas del tick 44 valen: lo único que no se puede juzgar en
ellas son los gráficos.

De paso, **el aviso del tick 42 hizo su trabajo**: dijo que la vista no declara
readiness y que esperar no lo arregla, en vez del escueto
`sin-marca-de-readiness` que en el tick 41 me costó un ciclo entero.

### Observado en acreditación/actores, con cifra y sin atribuir

El chip de cabecera dice **«ENCUESTAS 7»** y las cuatro tarjetas de actor suman
**8**: Administrativos 1 · Docentes 2 · Egresados 4 · Estudiantes 1. La
explicación probable es encuestas ÚNICAS arriba frente a asignaciones por actor
abajo —una encuesta compartida por dos actores cuadraría 7 y 8—, en cuyo caso
ninguna cifra está mal y lo que falla es que la pantalla no deja verlo.

**Atribuido en el tick 48, y la sospecha era correcta**: son dos conteos de cosas
distintas con la MISMA palabra, uno al lado del otro.

- El chip: `<FranjaDeFuentes encuestas={surveyCount} …>` en
  `AcreditacionMonitoreoPage.tsx`, con
  `surveyCount = activeSources.filter(isPlatformResponseSource).length` — fuentes
  de respuesta **activas y únicas**.
- La tarjeta: `plural(cuenta.respuestas, "encuesta", "encuestas")` en
  `profiles/acreditacion/fuentes/ActoresDelEstudio.tsx:257` — fuentes de respuesta
  **atribuidas a ese actor**, de modo que una compartida por dos actores cuenta
  dos veces.

**Ninguna de las dos cifras está mal**: 7 fuentes activas y 8 atribuciones son
ambas ciertas. Lo que falla es que la pantalla no deja verlo, y eso cambia lo que
la cabecera significa → **decisión de Gonzalo**, no arreglo de robustez. Evidencia:
`qa-acred/quick-monitoreo-seccion-actores-1440x1000-auto.png`.

Segunda cosa de esa vista: **todo el contenido cabe en el tercio superior** y
quedan ~500 px en blanco a 1440x1000. El gate no lo reporta —no es recorte ni
desborde— y no es defecto, pero es la tercera vista del loop donde el gate
aprueba una pantalla medio vacía.

## Cinco «vistas» de acreditación eran UNA, byte a byte (tick 49)

Abrí la captura de `seccion=resultados` y era idéntica a `seccion=actores`: misma
top bar («Fuentes» activa), mismo título, mismo contenido. El `md5` lo confirmó:

| familia | capturas | distintas |
|---|---|---|
| territorial | 6 | **6** |
| telefónico | 5 | **5** |
| acreditación | 5 | **1** (`fdcf0325`, las cinco) |

**Causa: mía.** Saqué los ids de sección (`actores`, `contexto`, `resultados`,
`hojas-ruta`, `pathways`) del bloque `id: "acreditacion"` de `modules.ts`, que es
el modo de **Cálculo de muestra**, no el de Monitoreo. Las de Monitoreo son
`fuentes`, `modelo`, `consultas`, `telefonico`, `avance`.

**Corrección del recuento**: no eran 16 vistas medidas sino **12** (6+5+1).

**NO es defecto de producto.** Una `?seccion=` que no existe en el modo activo
cae a la de por defecto, y eso es coherente con la gramática: `direccion.ts:148-154`
dice que en un módulo con modos «el juego de secciones lo reescribe el modo
activo». Asumí que una URL inválida fallaría; no tiene por qué.

**Sí es una trampa del gate**, y de las caras: la dirección inválida no falla, la
vista por defecto monta, declara readiness y **el gate la mide y la aprueba**. Se
miden N veces la misma pantalla creyendo que son N vistas, con `ok=true` en todas.
Ninguna cifra del informe lo delata.

La defensa cuesta un comando y queda en CLAUDE.md (`33643579`):
`md5 -q out/*.png | sort -u | wc -l`. Si sale menos que el número de rutas, no
mediste lo que creías.

## AULAS no se puede medir con el QA visual: no hay fixture (tick 49)

Pregunta de Gonzalo a mitad del tick: «¿qué has hecho para Monitoreo de aulas?».
Al ir a medirla salió el hueco:

| proyecto de referencia | perfil | monitoreo |
|---|---|---|
| acnur_acg | territorial | ready |
| acnur_pdm | telefónico | ready |
| acrconta | acreditación | ready |
| acrconta_mazo | — | pending |
| **hsvg2026** | **aulas** | **pending** |

`hsvg2026` trae Cálculo de muestra listo y **Monitoreo sin configurar**, así que
las 5 secciones caen a la misma pantalla: `ok=true captures=5 issues=0` y
**1 sola imagen distinta**. Sin la regla del `md5` (`33643579`, escrita veinte
minutos antes) habría informado «aulas medida, 0 issues».

**La familia mejor instrumentada del repo —31 contract tests, 79 de 116 archivos
con geometría declarada, gate de 3.888 tests— es la única que el QA visual no
puede cubrir**, porque no hay `.pulso` versionado con su Monitoreo configurado.
La memoria `reference_pulso_por_perfil_de_monitoreo` ya lo insinuaba: mapea
telefónico, territorial y acreditación, y no menciona aulas.

Dos salidas, y la elige Gonzalo: usar su `.pulso` real de HSVG2026 en local (sin
commitear), o construir un proyecto de referencia de aulas con Monitoreo listo
(`api/scripts/pulso_anonimizar.R` + `make reference-project-verify`).

### Balance de aulas en el loop, para no adornarlo

- **Fase 1**: todo el trabajo fue aulas. Las 13 clases del catálogo NACIERON
  barriéndola, y los defectos vivos que se arreglaron eran casi todos suyos
  (marcar refuerzo rechazaba 1.213 de 1.218; el sello perdido; activar reemplazo;
  las reservas de cadena al Sheets; el formato con dos salidas mudas; `achieved`
  como alias muerto).
- **Ticks 39-49: CERO cambios míos en aulas.** Fui a las familias que estaban a
  cero contratos con el criterio de que aulas ya estaba barrida. Defendible, pero
  le quitó el foco al operativo real.
- La otra sesión sí está en aulas: **23 commits hoy** (Plan del día, distribución,
  recibo de sincronización). No son míos.

## El sello perdido: dos defectos en el circuito de refuerzos (ticks 50-51)

Salieron de una petición operativa de Gonzalo —recuperar sus 15 refuerzos del
Sheets y guardar— y de ir a MIRAR la pestaña después.

**La raíz**: al publicar sólo viaja `STATUS MUESTRA`; `activation_origin` —el
sello de «lo pidió la app»— se queda en la sesión. Todo el circuito se apoyaba en
ese sello, así que lo recuperado del libro era invisible para la app.

| superficie | decía | con los 15 dentro |
|---|---|---|
| pestaña Refuerzos | «Marcar los 15 mejores» | **no los veía** (`5284a71c`) |
| reparto del techo | «La app lleva **0** de 15» | 4 sitios contando por sello (`4b7374e6`) |

El segundo es el peligroso: invita a pedir 15 MÁS sobre los 15 que ya hay, y su
filtro de candidatos los devolvía al pool.

Criterio único en `esRefuerzoPedido()`: sello **o** estado `refuerzo_*`
(inequívoco). `agendada`/`en_contacto` NO —los tiene cualquiera de las 1.392—.
`origen` dice el sello real, o «libro» cuando no hay ninguno, así que la
distinción que el contrato viejo protegía **no se pierde, cambia de sitio**.

**Verificado en pantalla con el proyecto real**: embudo en «15 espera llamada ·
0 en contacto · 0 con fecha · 0 aplicado», los 15 códigos listados con su
facultad y su botón Retirar, y «La app lleva **15** de un techo de 15: el techo
está gastado». Las pedidas por facultad suman 15.

**No recupera** un refuerzo que ya avanzó a EN CONTACTO/AGENDADA **y** perdió el
sello: ése es indistinguible de un aula normal, y se dice en el código.

### Cuarto barrido genérico descartado, y ya es un patrón del método

Al verificar salió «1 pedidas» y «1 la cierran» (arreglado, `935a6928`). Barrí
aulas buscando plural fijo tras una cifra: **125 candidatos en 55 archivos**, y
la mayoría son ruido —«más», «en», «con», «según», «están», «esperan»: preposiciones
y verbos que no concuerdan con el número—. Saber si una cifra **puede valer 1**
pide análisis de flujo, no un regex.

Van cuatro: respaldos divergentes (129), clases sin CSS (46), y ahora plurales
(125). **El patrón**: un barrido genérico sobre lenguaje natural o sobre
convenciones opcionales nace con una línea base inservible. Los que SÍ han
funcionado en este loop miran una relación verificable de dos lados —el estado
contra lo que publica el motor, el token contra su declaración, la marca contra
lo que lee el puente—.

## Abierto en el diario, y es decisión suya

Una **cuarta definición de «aplicado»**: `monitoreo_aulas_aula_aplicada.R` dice
ser la única y que «las tres la llaman», pero `monitoreo_aulas_rol_y_estado()`
no la llama — deriva `application_state` del tablero y **nunca pregunta por el
parte**. Detalle y medida en el diario. Es la clase «una palabra para dos cosas»
y no se arregla sin decidir cuál manda.

## Lo que queda, y qué necesita

- **Decisión de Gonzalo**: que `report_scope` deje de variarse en aulas (una
  línea en `scopeForView`, `AulasMonitoreoPage.tsx:143`), o que el backend acote
  de verdad.
- **Permiso de Gonzalo**: activar un reemplazo real en vivo. Es lo único que le
  falta al arreglo del camino A, y mutaría el operativo.
- Bajar el TOPE 4 de `test-helpers-sin-duplicar.R` si se cierra alguna de las
  cuatro parejas restantes (analítica, gráficos, monitoreo) — de acuerdo con la
  otra sesión.
