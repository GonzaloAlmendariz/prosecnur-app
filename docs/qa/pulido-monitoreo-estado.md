# Estado del pulido estético de Monitoreo

Registro iniciado el 2026-07-30 desde un proyecto `acrconta` abierto. El
inventario sigue el orden publicado por `window.__pulsoNav.manifiesto`: cuatro
modos y 26 nodos de modo/sección. **Las etiquetas de sección no son sus claves**
—«UMPs» es `modelo`, «Fuente» es `fuentes`—, así que para navegar hay que mirar
el manifiesto y no esta tabla. Las pestañas corresponden a los catálogos que
esas direcciones montan en el DOM. Una fila representa una superficie concreta;
una sección sin pestañas internas cuenta como una sola superficie.

| Modo | Sección › Pestaña | Estado | Hallazgos | Commit |
|---|---|---|---|---|
| acreditación | Fuentes › Resumen | hecho | C1 medía 16 miembros en vez de 3; tarjetas planas de radio 16→14 con materia; título y total duplicados retirados | este commit |
| acreditación | Fuentes › Universo | hecho | 3 paneles planos sin sombra → radio 16 con sombra baja; antetítulo repetido retirado; en viewport corto el scroll vuelve al contenedor exterior | producto: `d28a6bbf`; registro adelantado en `767eaa42` |
| acreditación | Fuentes › Encuestas y recopiladores | hecho | cobertura con deriva máxima 110 px → cuatro marcos iguales; 4 colecciones quedan medibles; nombres operativos envuelven y 3 minitarjetas métricas se aplanan | producto: `0e421dc3` |
| acreditación | Modelo operativo › Modelo operativo | hecho | 2 KPI ocupaban media franja → 2 columnas completas; roster 4×58 sin elipsis; tarjetas 304→352 y solo Egresados conserva scroll interno; “S/M”/“Ajustar” pasan a lenguaje de tarea; 8 grupos medidos | producto: `89321af3` |
| acreditación | Modelo operativo › Distribución | hecho | contrato comparaba cabecera 44 con rejilla 655 (Δ611) → 4 tarjetas intrínsecas; balance 4×1/2×2; KPI ajenos se retiran; actores recuperan scroll exterior y nombres completos. C5 funcional diferido: una declaración sin catálogo aún se silencia | producto: `943ffa08` |
| acreditación | Modelo operativo › Cronograma | pendiente |  |  |
| acreditación | Modelo operativo › Resumen | pendiente |  |  |
| acreditación | Consultas › Registros en plataforma | pendiente |  |  |
| acreditación | Consultas › Estado de la base | pendiente |  |  |
| acreditación | Consultas › Cruces efectivos | pendiente |  |  |
| acreditación | Consultas › Subsanación | pendiente |  |  |
| acreditación | Monitoreo telefónico › Resumen | pendiente |  |  |
| acreditación | Monitoreo telefónico › Estados | pendiente |  |  |
| acreditación | Monitoreo telefónico › Día | pendiente |  |  |
| acreditación | Monitoreo telefónico › Incidencias de la base | pendiente |  |  |
| acreditación | Monitoreo telefónico › Responsables | pendiente |  |  |
| acreditación | Monitoreo telefónico › Alertas | pendiente |  |  |
| acreditación | Monitoreo telefónico › Supervisión telefónica | pendiente |  |  |
| acreditación | Avance › Resumen | pendiente |  |  |
| acreditación | Avance › Actores | pendiente |  |  |
| acreditación | Avance › Encuestas | pendiente |  |  |
| acreditación | Avance › Detalle | pendiente |  |  |
| acreditación | Avance › Salidas | pendiente |  |  |
| telefónico | Fuentes › Fuentes activas | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Fuentes › Universo y barrido | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Fuentes › Encuestas | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Modelo operativo › Cuotas | hecho | gobernador radio 9 sin sombra → 14 con materia; eslabones y resumen sin caja; 3 frases de AI slop retiradas; título pasa de la mecánica a la pregunta | este commit |
| telefónico | Modelo operativo › Cronograma | hecho | 16 de 17 cajas sin sombra; radios 8/9 → 10/14; versalitas 26 → 14, las que quedan son antetítulos de franja y sí encabezan. Las celdas de estado **conservan** su borde: llevan el color de su estado y ahí el marco es la señal | este commit |
| telefónico | ~~Modelo operativo › Resumen~~ | no existe | El inventario salió del catálogo estático `ACREDITACION_MODEL_TABS`, que trae tres pestañas; telefónico monta solo dos (`void summary` en `localTabsForTelefonicoView`). `window.__pulsoNav.pestanasDeLaSeccion()` lo confirma en runtime | — |
| telefónico | Llamadas › Resumen operativo | hecho | 77 cajas, 76 sin sombra. La composición ya era buena —el embudo y la tabla de mínimos se leen sin esfuerzo—, así que faltaba materia y no estructura: el panel contenedor sube a 16 con sombra y las tarjetas internas a 14 | este commit |
| telefónico | Llamadas › Validación de tiempo | hecho | tres escalas (8/9/10) para tres niveles reales, pero con 1 px de diferencia entre sí: eso no se lee como jerarquía. Queda en 10/14/16 y cero versalitas | este commit |
| telefónico | Llamadas › Sin efectiva | hecho | 224 cajas, la más densa del modo; radios 8/12 → 10/14/16, cero fuera de escala. Las 14 versalitas restantes son antetítulos de cabecera y sí encabezan. Los nueve scrolls anidados del diagnóstico de 2026-07-26 ya no están: medido 0 | este commit |
| telefónico | Llamadas › Responsables | hecho | tres familias de celda en radio 8 —totales de brecha, filas de lista, pie de responsable— a 10; color de estado conservado | este commit |
| telefónico | Llamadas › Alertas reales | hecho | seis radios distintos (0/8/9/10/12/16) en 26 cajas: la mayor dispersión del modo pese a ser de las más pequeñas. Queda en 10/14/16 | este commit |
| telefónico | Consultas › Efectivas Kobo | hecho | 803 cajas, pero es una tabla y ahí la celda va sin radio: lo único fuera de escala eran sus dos contenedores. Versalitas = encabezados de columna, su sitio | este commit |
| telefónico | ~~Consultas › Estado de la base~~ | no existe | Runtime monta 2 pestañas (Efectivas Kobo, CodPulso), no las 4 del catálogo estático |  |
| telefónico | Consultas › CodPulso | hecho | **siete radios distintos** (0/8/9/10/11/12/16) en una pestaña: la mayor dispersión de todo el modo. Queda en 0/10/14/16 | este commit |
| telefónico | ~~Consultas › Subsanación~~ | no existe | Idem: sale del catálogo compartido con acreditación |  |
| telefónico | Avance › Diario | hecho | 6 radios en 22 cajas → 0/10/14/16; «Colgó / Cortó la llamada» se recortaba y es nombre de estado, no etiqueta larga: ahora envuelve | este commit |
| telefónico | Avance › Cuotas | hecho | radios 9/12 → 10/14 | este commit |
| telefónico | Avance › Salidas | hecho | radios 8/9/12 → 10/14. El control deslizante del kit (`pulso-gliding-tab-list`) se deja en 8: su escala la fija el kit compartido y cambiarla por perfil rompería la uniformidad con el resto de la app | este commit |
| territorial | Fuente › Formulario | hecho | 6 radios en 18 cajas → 10/14, y los 2 recortes de T6 resueltos. La clave fue enumerar qué regla gana sobre el elemento real: las ganadoras llevaban `.is-tab-form`, y el recorte vivía en `route-sheet-source-metrics`, no en la clase que se había supuesto | este commit |
| territorial | Fuente › Filtro y distritos | hecho | radios 9/12 → 0/10/14 | este commit |
| territorial | Fuente › Encuestadores | hecho | radios 9/12 → 10/14; el título «Lista de encuestadores» se recortaba y ahora envuelve. **8 recortes quedan abiertos**: son celdas de tabla y envolver ahí cambia el reparto de columnas | este commit |
| territorial | Fuente › Reconciliación | hecho | **seis radios en una pestaña** (9/10/11/12/13/14), con 11 y 13 apareciendo solo aquí en todo el modo. Queda en 10/14. Quedan 3 recortes y 2 scrolls anidados | este commit |
| territorial | Fuente › Historial | hecho | ya estaba conforme: 10/14, sin recortes. Se verificó, no se tocó | — |
| territorial | Modelo › Cobertura | hecho | 5 radios (10/11/12/13/14) → 10/14. **6 scrolls anidados y 7 recortes** quedan abiertos: es la superficie con más scroll del modo | este commit |
| territorial | Modelo › Manzanas | hecho | **siete radios en una pestaña** (0/9/10/11/12/13/14), récord del barrido → 0/10/14. Las 150 versalitas que quedan son los chips «UMP TITULAR» de cada fila: badge, que es patrón de la casa. 3 scrolls anidados abiertos | este commit |
| territorial | Validación › Geolocalización | hecho | **ocho radios** (0/7/8/9/10/12/14/16); el 7 no aparece en ninguna otra superficie de la app. Queda en 0/10/14/16 | este commit |
| territorial | Validación › Reconciliación UMP | hecho | solo el vacío espacial fuera de escala (9 → 14) | este commit |
| territorial | Validación › Duración de tiempo | hecho | radios 8/9 → 0/10/14 y los 11 recortes resueltos. La regla anterior perdía por especificidad: `.mon-duration-daily-value small` (0,1,1) gana a un `> *` (0,1,0) | este commit |
| territorial | Validación › Cuotas | hecho | toda la superficie en radio 8 sin excepción —escala propia de principio a fin— y **156 recortes, el récord del barrido**: «8 encuestas por comple…», «Resta de Hombre · Muje…», que son las razones de cada brecha. Ninguno en tabla, así que envolver fue seguro: 156 → 0 | este commit |
| territorial | Validación › Anulación | hecho | superficie entera en radio 8, como Cuotas: las dos se construyeron con escala propia de principio a fin. Queda en 10/14 | este commit |
| territorial | Consultas internas › Registro | hecho | radios 8/12 → 10/14; rótulos de métrica dejan de recortarse. Las cinco pestañas comparten armazón, así que la escala alcanza a todas | este commit |
| territorial | Consultas internas › GPS con señal | hecho | cubierta por la escala del armazón de revisión | este commit |
| territorial | Consultas internas › Tiempo corto/muy corto | hecho | idem | este commit |
| territorial | Consultas internas › Cruce responsable | hecho | idem | este commit |
| territorial | Consultas internas › Subsanaciones | hecho | idem | este commit |
| territorial | Avance territorial › Resumen | hecho | radios 8/9/13 → 10/14 | este commit |
| territorial | Avance territorial › Distritos | hecho | radios 8/11/13 → 10/14. La tarjeta de distrito la declaran dos reglas —suelta y bajo `.mon-page .pulso-panel`—, hay que replicar las dos | este commit |
| territorial | Avance territorial › Mapa y UMP | **parcial** | 321 cajas y seis radios → 10/14/16. **20 recortes siguen abiertos**: sus contenedores no tienen clase estable, así que el selector no agarra | este commit |
| territorial | Avance territorial › Ritmo diario | hecho | radio 12 → 14; sus 3 «recortes» eran falsos positivos del detector (etiquetas dentro del SVG de Plotly) | este commit |
| territorial | Avance territorial › Salidas | hecho | radios 9/12 → 10/14. Los controles con token propio del kit se dejan | este commit |
| territorial | Ocurrencias de campo › Resumen | hecho | radios 10/12/14 → 10/14; conforme y sin recortes | este commit |
| territorial | Ocurrencias de campo › Distritos | hecho | las 42 casillas de conteo por distrito (87×65, son fichas) estaban en 8 → 10 | este commit |
| territorial | Ocurrencias de campo › Reporte UMP | hecho | cabecera, barra y tabla de 12 → 14; KPI de 9 → 10; «150» dejaba de caber en su caja de 24 px. **83 recortes abiertos**, todos celdas de `register-table` | este commit |
| territorial | Ocurrencias de campo › UMP | hecho | **la superficie del hallazgo**: 148 tarjetas de UMP renderizaban idénticas porque una regla de botones de barra pisaba su diseño. Ver abajo | este commit |
| territorial | Ocurrencias de campo › Alertas | hecho | las 80 filas de alerta eran el único 11 del modo fuera de Reconciliación → 14; «Incompleta sin reporte» salía con elipsis por 2 px en 3 filas y ahora envuelve | este commit |
| territorial | Ocurrencias de campo › Ritmo | hecho | 32 barras diarias en 8 y 4 KPI en 9 → 10. 1 scroll anidado abierto | este commit |
| cursos-horario | Fuentes | pendiente |  |  |
| cursos-horario | Agenda de cursos-horario | pendiente |  |  |
| cursos-horario | Avance | pendiente |  |  |
| cursos-horario | Validación | pendiente |  |  |
| cursos-horario | Consultas | pendiente |  |  |

## Segunda corrección del instrumento — 2026-07-30

El conteo de **recortes** también tenía falsos positivos: incluía elementos
dentro de SVG, donde `scrollWidth > clientWidth` no significa recorte visual
—los `<text>` se dibujan completos—. Lo delató Ritmo diario, con tres etiquetas
de leyenda de Plotly contadas como recortadas y legibles en pantalla.

Los recortes reportados antes de esta corrección **sí eran reales**: los de
Cuotas (156), Duración (11) y las tablas tenían padres HTML, comprobados por su
cadena de ancestros. Pero el detector ahora excluye SVG.

## Riesgo operativo: dos sesiones sobre el mismo backend

Este loop y el de acreditación comparten el Plumber de `:8787`. Dos veces el
proyecto abierto cambió a mitad de auditoría —de `acnur_acg` a `v7_work`— y con
él el **modo**: navegar a `avance` acabó en `monitoreo/acreditacion/avance` en
vez de territorial, porque el perfil lo decide el estudio y no la ruta.

Consecuencia práctica: **confirmar `describir()` antes de medir no basta**, hay
que confirmar también el modo. Una superficie auditada creyendo que era
territorial y medida sobre acreditación produce reglas escritas en el archivo
equivocado, y encima pisa el trabajo de la otra sesión.

Regla para las siguientes iteraciones: reabrir el `.pulso` del modo con `?pulso=`
al empezar cada modo, y comprobar que `describir()` empieza por el modo esperado
—no solo que la sección coincida—.

## Corrección de método — 2026-07-30

El conteo de versalitas de las primeras iteraciones estaba **inflado**. Medía
`text-transform: uppercase` computado, que se hereda, y contaba elementos cuyo
texto no cambia al aplicarlo: «UMP 2» con `uppercase` se ve igual que sin él.
En `Modelo › Manzanas` eso daba 320 cuando las reales eran 168.

El criterio correcto exige las dos cosas: la propiedad **y** que el texto tenga
minúsculas que de verdad se transformen. Los conteos de telefónico anteriores a
esta corrección pueden estar altos por la misma razón; las versalitas que se
retiraron allí sí eran visibles —se comprobaron en captura—, pero el número que
las acompaña no es fiable.

## Hallazgos no estéticos

| Tipo | Modo | Superficie | Hallazgo | Referencia | Estado |
|---|---|---|---|---|---|
| scroll anidado (C4) | territorial | Modelo › Cobertura | **Seis** contenedores con scroll propio en una pestaña, más 7 recortes. La norma pide un solo dueño de scroll; con mapa, rail y listas de distrito conviviendo, resolverlo es rehacer el reparto de alto de la superficie | medido el 2026-07-30 en `acnur_acg` | abierto |
| ~~bug de datos~~ **RESUELTO** `a61b21b8` | territorial | Consultas › Registro | **Sexo y Edad salían «S/D» en las 318 filas** mientras el resto de columnas tiene dato. Dos causas distintas: (1) `sex_var` está **vacía** en la config del proyecto —y en `.monitoreo_territorial_default_mapping` es la **única** de las doce variables cuyo fallback es `""`; las demás caen a un nombre real como `Core/M5_district` o `codigo_pulso`—, así que cuando el instrumento no usa ninguno de los alias previstos (`Core/E2_sex`, `E2_sex`, `sexo`, `sex`, `gender`, `genero`) queda sin mapear **en silencio**. (2) `age_var` sí resuelve a `Core/E1_age` y aun así sale S/D: el motor tiene un relleno desde la fuente (`age_fill`/`sex_fill`, `monitoreo_engine.R:30155`) que recupera el valor cuando el audit no lo trae, pero **solo corre en la ruta de publicación**; el `response_audit` que consume la tabla de la app sale por `.monitoreo_territorial_df_rows(audit)` sin ese paso. La tabla tampoco tiene fallbacks en el front: `row.sex` y `row.age` se leen a pelo mientras las columnas vecinas encadenan dos o tres alternativas | medido el 2026-07-30 en la app y en R sobre `acnur_acg` | **cerrado**: el fallo real no era ninguna de las dos causas que se anotaron primero. La base sí trae `Core/E1_age` y `Core/E2_sex`, la config sí las mapea y el motor sí las resuelve (1.441 de 1.732). La tabla no se construye desde `response_audit` —ese payload solo viaja con `include_validation_payload` y la pestaña pide `queries_summary`— sino desde `internal_queries$review_cases`, y esa función exportaba treinta campos del audit sin incluir estos dos |
| deuda compartida | los cuatro modos | Avance › Salidas | `mon-outputs-*` es un componente compartido y su escala se ha alineado **por perfil**: primero en telefónico, ahora en territorial, con reglas duplicadas. Es el parche que este trabajo quiere evitar. Debería tener una escala única, fuera de los perfiles | 2026-07-30 | abierto |
| contrato | territorial | autodetección de mapeos | `sex_var` es la única de las doce variables cuyo fallback es la cadena vacía; las demás caen a un nombre real (`Core/M5_district`, `codigo_pulso`). Un instrumento que no use ninguno de los alias previstos deja sexo sin mapear **y sin avisar**. Es decisión de contrato, no bug | `monitoreo_engine.R:3415-3416` | abierto |
| recorte en tabla | territorial | Consultas internas | Diez datos recortados dentro de las tablas de revisión («P597 · Vargas Carlos A…»). Mismo caso que Encuestadores: envolver redistribuye columnas | medido el 2026-07-30 | abierto |
| recorte en tabla | territorial | Fuente › Encuestadores | Ocho datos recortados dentro de celdas de tabla («+5 reconciliadas»). La norma prohíbe elipsis en dato operativo, pero permitir el envoltorio en una tabla redistribuye las columnas: hay que decidir el ancho de esa columna, no solo el `white-space` | medido el 2026-07-30 en `acnur_acg` | abierto |
| scroll anidado (C4) | telefónico | Consultas › CodPulso | Dos contenedores con scroll propio dentro de la pestaña. La norma pide un solo dueño de scroll por pantalla; resolverlo exige decidir cuál de los dos cede el alto, y eso cambia el layout | medido el 2026-07-30 en `acnur_pdm` | abierto |
| duplicación estructural | telefónico | Modelo › Cuotas | «Sede» se lee **9 veces** en la misma pantalla y «400» **5**. No es copy repetido sino cuatro superficies que muestran el mismo modelo con distinto formato: la franja de 4 cajas, la cadena de la regla de lectura, la fila de 5 KPIs bajo las categorías y las tarjetas editables. Las 5 categorías se listan **dos veces** —resumen con base·meta·% y tarjetas con universo/meta/efectivas/brecha/tasa/reserva—. Retirar la redundancia exige decidir qué superficie es la de lectura y cuál la de edición, y eso es estructura, no CSS. | medido el 2026-07-30 en `acnur_pdm`, `monitoreo/telefonico/modelo/estructura` | abierto |
| pieza ausente | acreditación | Fuentes › Universo | La fila visible no presenta documento, pestaña y rango simultáneamente; muestra la pestaña, pero el rango prometido por la especificación no está disponible en esta lectura. | `docs/plan-fuentes-legibles-2026-07.md` §4.1 | pendiente; fuera del alcance CSS/texto |
| pieza ausente | acreditación | Fuentes › Encuestas y recopiladores | La especificación promete abrir Recopiladores filtrado por «por clasificar», pero la vista presenta la colección completa. Incorporarlo requiere estado y lógica de filtro, no un ajuste estético. | `docs/plan-fuentes-legibles-2026-07.md` §4.1 | pendiente; fuera del alcance CSS/texto |
| **regla que se come componentes** | todo Monitoreo | cualquier panel | `.mon-page .pulso-panel button` (0,2,1) da forma de botón de barra —32 px de alto, 12 px de fuente, `inline-flex` centrado, radio 6, fondo blanco— a **cualquier** `<button>` dentro de un panel. Alcanza a componentes que no son botones de barra y les borra el diseño escrito, sin que nadie se entere: la declaración perdedora sigue en el archivo y se lee como si aplicara. Confirmados: la tarjeta de UMP (arreglada aquí), el CTA de la barra de fuente (arreglado aquí) y **`.pulso-button` del kit**, que dentro de Monitoreo renderiza en radio 6 en vez de su escala propia. El repo ya lo parcheó tres veces subiendo especificidad con `button.<componente>` (`territorialProfile.css:15513`). Arreglarlo de raíz es acotar el selector a barras de verdad, y eso toca `monitoreo.css`, que está congelado | `monitoreo.css:17082`; medido el 2026-07-30 en `acnur_acg` | abierto |
| deuda compartida | los cuatro modos | chrome de sección | El contenido de cada sección ya está en escala, pero el marco que las envuelve no: `mon-workbench-head-icon` en 9 y los botones de `mon-rail-phase-switch` en 7 y 9. Son chrome compartido (`components/MonitoreoWorkbenchHead.tsx`, declarado 3 veces en `monitoreo.css`), así que arreglarlo dentro de un perfil repetiría el parche de `mon-outputs`. Va con esa misma unidad de unificación | medido el 2026-07-30 en las 6 pestañas de Ocurrencias | abierto |
| recorte en tabla | territorial | Ocurrencias › Reporte UMP | 83 datos recortados dentro de `register-table` («SAN JUAN DE MIRAFLORES · Zona 01…»). Tercera superficie con el mismo caso —Encuestadores y Consultas internas son las otras—: ya no es un defecto suelto sino **una decisión pendiente de ancho de columna en las tablas de territorial**, que conviene tomar una vez para las tres | medido el 2026-07-30 en `acnur_acg` | abierto |
| scroll anidado (C4) | territorial | Ocurrencias › Ritmo | `mon-field-occurrences-history-list` muestra 260 px de 843 y su contenedor `mon-workbench-content` también desborda: dos dueños de scroll. Resolverlo exige decidir cuál cede el alto | medido el 2026-07-30 en `acnur_acg` | abierto |

## Tercera y cuarta corrección del instrumento — 2026-07-30

El detector de recortes tenía otros dos falsos positivos, los dos encontrados
en Ocurrencias:

- **Elementos `pulso-sr-only`**, que existen solo para el lector de pantalla.
  Son 5 de los 89 que reportaba en Reporte UMP y no se ven, así que no pueden
  recortarse. Ahora se excluyen los ocultos por `visibility`, `display` y esa
  clase, y los de área menor a 4×4.
- **`overflow: visible`**. Un elemento puede medir `scrollWidth > clientWidth`
  y pintar el texto entero fuera de su caja: se lee perfectamente. Contarlo
  como recorte es contar el arreglo como si fuera el defecto.

La segunda tiene una trampa que costó una iteración: **pintar fuera de la caja
sí puede solapar al vecino**. Al «arreglar» el «150» de Reporte UMP con
`overflow: visible`, el número pasó a invadir 3 px el rótulo que tiene al lado.
El arreglo bueno era otro —que el ítem flex no encoja bajo su contenido— y solo
apareció al medir la geometría del hermano, no la del propio elemento.

Van cuatro correcciones al instrumento en este barrido. Las cuatro salieron de
contrastar la medición con la pantalla, en un sentido o en el otro.

## Modo territorial — cerrado el 2026-07-30

Veintiocho superficies en seis secciones, todas en la escala 0/10/14/16.

El hallazgo del modo no fue la dispersión de radios sino **reglas muertas**: en
Ocurrencias › UMP, las 148 tarjetas renderizaban idénticas —borde gris, fondo
blanco— pese a que cada una calcula bien su `--occurrence-status-color` y a que
el perfil declara dos veces su borde y su degradado teñidos por estado. Las dos
declaraciones perdían por especificidad frente a una regla pensada para botones
de barra. El color de estado, que es la señal de la superficie, no llegaba a
pantalla y solo se leía en el chip.

Eso convierte una observación de método en la regla central del archivo
`escalaDeSuperficies.css`: **una declaración escrita no es una declaración
aplicada**, y la única forma de saberlo es enumerar qué gana sobre el elemento
real. Sin eso, un radio «ya corregido» en el código puede llevar meses sin
verse.

Lo que se decidió NO tocar en este modo, y conviene que no se «arregle» luego:

- `.pulso-button` dentro de Monitoreo, que rinde en radio 6 por la misma regla.
  Es del kit y se arregla en la raíz, no perfil por perfil.
- El chrome de sección (`mon-workbench-head-icon`, `mon-rail-phase-switch`),
  por lo mismo: es compartido.
- Los bordes de las filas de alerta, que llevan color de estado y sí llegan a
  pantalla —son `<article>`, no `<button>`—.

## Modo telefónico — cerrado el 2026-07-30

Trece superficies reales (el catálogo estático anunciaba dieciséis; tres no se
montan en este modo). Todas en la escala 0/10/14/16 de la casa.

Lo que se repitió en todas y por eso pasó a ser regla de perfil en vez de
parche: radios entre 8 y 12 conviviendo sin jerarquía, y ninguna sombra. La
dispersión máxima fueron **siete radios distintos en una sola pestaña**
(Consultas › CodPulso) y **seis en veintiséis cajas** (Llamadas › Alertas).

Tres cosas que se decidió NO tocar, y conviene que no se «arreglen» después:

- Las celdas del cronograma y los niveles de insistencia **conservan su borde**:
  llevan el color de su estado, y ahí el marco es la señal, no adorno.
- Las versalitas que encabezan un bloque o rotulan una columna se quedan. Solo
  salieron las que rotulaban celdas de dato.
- El control deslizante de Salidas se queda en radio 8: su escala la fija el kit
  compartido y cambiarla por perfil rompe la uniformidad con el resto de la app.

## Evidencia de la última iteración

- Proyecto: copia temporal de `api/inst/reference_projects/acrconta/acrconta.pulso`.
- Dirección: `monitoreo/acreditacion/fuentes/encuestas`.
- Viewports: `1440×1000` y `1024×600`.
- Antes: las cuatro coberturas medían `92/202/99/147 px` en ancho amplio y
  `99/208.99/99/153.99 px` en compacto; las colecciones no tenían contrato QA y
  «Auditoria de la información financiera 2» se recortaba `250 → 212 px`.
- Después: 4 actores, 7 encuestas, 7 selectores y 20 recopiladores miden
  `ΔH = 0` y `ΔW = 0` en ambos viewports; todos los nombres operativos caben y
  el scroll exterior llega al último control (`3546/4740 px`, `atEnd = true`).
- Resultado automatizado: 2 capturas, 0 incidencias visuales, 0 scroll-jails,
  0 desbordes globales, 0 errores de geometría/cobertura y 0 errores de página/API.
- C5: el proyecto hidratado cubre 7 encuestas, 4 actores y 20 recopiladores; los
  vacíos legítimos no aparecen en este fixture y el filtro ausente queda registrado.
