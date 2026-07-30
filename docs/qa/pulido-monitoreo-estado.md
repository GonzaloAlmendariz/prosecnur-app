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
| acreditación | Modelo operativo › Modelo operativo | pendiente |  |  |
| acreditación | Modelo operativo › Distribución | pendiente |  |  |
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
| territorial | Consultas internas › Registro | pendiente |  |  |
| territorial | Consultas internas › GPS con señal | pendiente |  |  |
| territorial | Consultas internas › Tiempo corto/muy corto | pendiente |  |  |
| territorial | Consultas internas › Cruce responsable | pendiente |  |  |
| territorial | Consultas internas › Subsanaciones | pendiente |  |  |
| territorial | Avance territorial › Resumen | pendiente |  |  |
| territorial | Avance territorial › Distritos | pendiente |  |  |
| territorial | Avance territorial › Mapa y UMP | pendiente |  |  |
| territorial | Avance territorial › Ritmo diario | pendiente |  |  |
| territorial | Avance territorial › Salidas | pendiente |  |  |
| territorial | Ocurrencias de campo › Resumen | pendiente |  |  |
| territorial | Ocurrencias de campo › Distritos | pendiente |  |  |
| territorial | Ocurrencias de campo › Reporte UMP | pendiente |  |  |
| territorial | Ocurrencias de campo › UMP | pendiente |  |  |
| territorial | Ocurrencias de campo › Alertas | pendiente |  |  |
| territorial | Ocurrencias de campo › Ritmo | pendiente |  |  |
| cursos-horario | Fuentes | pendiente |  |  |
| cursos-horario | Agenda de cursos-horario | pendiente |  |  |
| cursos-horario | Avance | pendiente |  |  |
| cursos-horario | Validación | pendiente |  |  |
| cursos-horario | Consultas | pendiente |  |  |

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
| recorte en tabla | territorial | Fuente › Encuestadores | Ocho datos recortados dentro de celdas de tabla («+5 reconciliadas»). La norma prohíbe elipsis en dato operativo, pero permitir el envoltorio en una tabla redistribuye las columnas: hay que decidir el ancho de esa columna, no solo el `white-space` | medido el 2026-07-30 en `acnur_acg` | abierto |
| scroll anidado (C4) | telefónico | Consultas › CodPulso | Dos contenedores con scroll propio dentro de la pestaña. La norma pide un solo dueño de scroll por pantalla; resolverlo exige decidir cuál de los dos cede el alto, y eso cambia el layout | medido el 2026-07-30 en `acnur_pdm` | abierto |
| duplicación estructural | telefónico | Modelo › Cuotas | «Sede» se lee **9 veces** en la misma pantalla y «400» **5**. No es copy repetido sino cuatro superficies que muestran el mismo modelo con distinto formato: la franja de 4 cajas, la cadena de la regla de lectura, la fila de 5 KPIs bajo las categorías y las tarjetas editables. Las 5 categorías se listan **dos veces** —resumen con base·meta·% y tarjetas con universo/meta/efectivas/brecha/tasa/reserva—. Retirar la redundancia exige decidir qué superficie es la de lectura y cuál la de edición, y eso es estructura, no CSS. | medido el 2026-07-30 en `acnur_pdm`, `monitoreo/telefonico/modelo/estructura` | abierto |
| pieza ausente | acreditación | Fuentes › Universo | La fila visible no presenta documento, pestaña y rango simultáneamente; muestra la pestaña, pero el rango prometido por la especificación no está disponible en esta lectura. | `docs/plan-fuentes-legibles-2026-07.md` §4.1 | pendiente; fuera del alcance CSS/texto |
| pieza ausente | acreditación | Fuentes › Encuestas y recopiladores | La especificación promete abrir Recopiladores filtrado por «por clasificar», pero la vista presenta la colección completa. Incorporarlo requiere estado y lógica de filtro, no un ajuste estético. | `docs/plan-fuentes-legibles-2026-07.md` §4.1 | pendiente; fuera del alcance CSS/texto |

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
