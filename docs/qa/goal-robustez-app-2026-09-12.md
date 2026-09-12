# GOAL — Robustez: que la app no falle al usarse

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

La 10 la cerró la otra sesión (`1ca67233`) y entra aquí porque este documento es
el catálogo común: cuando un cambio enseña a la mitad que LEE y la que ESCRIBE
se queda apuntando a lo viejo. El guard no comprueba el helper sino el defecto
en su forma observable —una cita del 16/09 cae en «Semana 2», «Semana 1» queda
intacta byte a byte y la cita nueva no aparece en ella—.

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
