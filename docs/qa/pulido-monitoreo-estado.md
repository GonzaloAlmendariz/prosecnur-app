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
| acreditación | ~~Fuentes › Resumen~~ → **Actores** | reenumerado 16:40 | La sección monta hoy `actores`, `fuentes` y `recopiladores`; las etiquetas del registro («Resumen», «Universo», «Encuestas y recopiladores») ya no existen. Auditada con los detectores nuevos: 0 recortes, 0 solapes, 0 contenido cortado. Radios 7/8 fuera de escala, pendientes | C1 medía 16 miembros en vez de 3; tarjetas planas de radio 16→14 con materia; título y total duplicados retirados | este commit |
| acreditación | ~~Fuentes › Universo~~ → **Fuentes y universo** | hecho (reenumerada) | 0 recortes, 0 solapes, 0 contenido cortado. Radios 8 de `mon-acr-source-object-*` pendientes | 3 paneles planos sin sombra → radio 16 con sombra baja; antetítulo repetido retirado; en viewport corto el scroll vuelve al contenedor exterior | producto: `d28a6bbf`; registro adelantado en `767eaa42` |
| acreditación | ~~Fuentes › Encuestas y recopiladores~~ → **Recopiladores** | hecho (reenumerada) | 0 recortes, 0 solapes. Los 60 controles en 8 y 9 px —métrica de recopilador, icono de uso y selector de canal— pasan a 10 desde el archivo compartido, sin duplicar por perfil | cobertura con deriva máxima 110 px → cuatro marcos iguales; 4 colecciones quedan medibles; nombres operativos envuelven y 3 minitarjetas métricas se aplanan | producto: `0e421dc3` |
| acreditación | Modelo operativo › Modelo operativo | hecho | 2 KPI ocupaban media franja → 2 columnas completas; roster 4×58 sin elipsis; tarjetas 304→352 y solo Egresados conserva scroll interno; “S/M”/“Ajustar” pasan a lenguaje de tarea; 8 grupos medidos | producto: `89321af3` |
| acreditación | Modelo operativo › Distribución | hecho | contrato comparaba cabecera 44 con rejilla 655 (Δ611) → 4 tarjetas intrínsecas; balance 4×1/2×2; KPI ajenos se retiran; actores recuperan scroll exterior y nombres completos. C5 funcional diferido: una declaración sin catálogo aún se silencia | producto: `943ffa08` |
| acreditación | Modelo operativo › Cronograma | hecho | resumen heredado de metas retirado; plan y ejecución pasan a dos regiones; 4 KPI 2×2 y 5 controles quedan auditables; “Fuera/Dentro del plan” hace explícito el desvío y el vacío sin corte deja de silenciarse; un solo scroll exterior | producto: `cc43dcc9` |
| acreditación | Modelo operativo › Resumen | pendiente |  |  |
| acreditación | Consultas › Registros en plataforma | auditada | 0 solapes, 0 contenido cortado, 1 recorte. **301 botones en radio 8** pendientes de escala | — |
| acreditación | Consultas › Estado de la base | auditada | limpia de recortes y solapes; **519 botones en radio 8** pendientes | — |
| acreditación | Consultas › Cruces efectivos | auditada | 0 solapes. **45 recortes de «Cruzó por llave» dentro de tabla** (2 px cada uno): entra en la decisión de ancho de columna que ya está abierta para territorial | — |
| acreditación | Consultas › Subsanación | hecho | **109 rótulos recortados**: «Estudiantes · 22 julio · Enlace QR Estudiant…» pedía 242 px en 218. No está en tabla, así que envuelve; las filas quedan uniformes en 81 px. Radios 7 y 9 pendientes | este commit |
| acreditación | Monitoreo telefónico › **Barrido + Kobo** | auditada | 0 solapes, 0 contenido cortado. Chips de estado en 8 px pendientes | — |
| acreditación | Monitoreo telefónico › Estados | hecho | conforme: lo único fuera de escala es el chrome de la app (`pulso-command-bar` en 18) | — |
| acreditación | Monitoreo telefónico › **Ritmo diario** | auditada | **1 contenido cortado real**: una columna de barra apilada mide 7,9 px y sus 3 segmentos piden 12. Es codificación de gráfico —qué hacer con un día de muy pocos casos—, no CSS | — |
| acreditación | Monitoreo telefónico › **Sin efectiva** | hecho | 61 filas-tarjeta de 563×57 en 8 px → 10. Confirma que el desajuste de denominador de las barras de insistencia también está aquí, no solo en telefónico | este commit |
| acreditación | Monitoreo telefónico › Responsables | pendiente |  |  |
| acreditación | Monitoreo telefónico › Alertas | pendiente |  |  |
| acreditación | Monitoreo telefónico › Supervisión telefónica | pendiente |  |  |
| acreditación | Avance › Resumen | hecho | `mon-clarity-card` en 7 px → 10. Gana `.mon-profile-canonical-shell .mon-clarity-card` (0,2,0), no la declaración suelta de 9 | este commit |
| acreditación | Avance › Actores | hecho | nodos de flujo y mecanismos de 9 y 8 → 10; el grupo de mecanismos de 11 → 14. 7 recortes de «respuestas» pendientes | este commit |
| acreditación | Avance › Encuestas | hecho | tarjeta de encuesta 12 → 14; chips de estado en 9 pendientes. 0 recortes | este commit |
| acreditación | Avance › Detalle | hecho | fila de variable de control 9 → 10. 0 recortes, 0 solapes | este commit |
| acreditación | Avance › Salidas | auditada | limpia; queda un `input` en 9 px que debería heredar el 8 de la app | — |
| telefónico | Fuentes › Fuentes activas | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Fuentes › Universo y barrido | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Fuentes › Encuestas | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Modelo operativo › Cuotas | hecho (2.ª pasada) | La cadena de decisión se comía los nombres: «Consentimiento informado» pedía 216 px en 82 y se leía «Consen…». Cinco pasos `flex: 1 1 0` iguales → reparto por contenido. Guionación medida en tres intentos: `anywhere` parte a media palabra, sin guionar «filtradas» se recorta, `hyphens: auto` con `lang="es"` acierta. | gobernador radio 9 sin sombra → 14 con materia; eslabones y resumen sin caja; 3 frases de AI slop retiradas; título pasa de la mecánica a la pregunta | este commit |
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
| telefónico | Consultas › Salvedades | hecho | **La fila anterior decía «no existe» y era falsa**: la pestaña se llama «Salvedades» y su clave es `subsanacion`, así que buscarla por etiqueta no la encontraba. Nueve elementos en versalita de verdad —antetítulo, valor y descripción de las tres fichas—, cuando la versalita es solo del antetítulo: quedan 3. Radios 8/12 → 10/14, «Efectivas revisadas» dejaba 4 px en elipsis, y el vacío decía «Kobo no trae efectivas no identificables», doble negativo que ahora se lee en positivo | este commit |
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
| cursos-horario | Fuentes | **parcial (sin datos)** | radios 8/12 → 10/14; «selection_run_id» se mostraba como pista al usuario. Auditada con el modo VACÍO: ver nota abajo | este commit |
| cursos-horario | Agenda de cursos-horario | **parcial (sin datos)** | el aviso de vacío ocupaba ~700 px de blanco y se leía como carga fallida; ahora 79 px | este commit |
| cursos-horario | Avance | **parcial (sin datos)** | idem vacío contenido; escala de KPI a 14 | este commit |
| cursos-horario | Validación | **parcial (sin datos)** | idem | este commit |
| cursos-horario | Consultas | **parcial (sin datos)** | idem | este commit |

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

## Sideover «Conectar fuente» — 2026-07-30

Primer objetivo del pase nuevo, señalado por Gonzalo como lo más flojo. El
componente es **compartido** (`fuentes/ConectarFuente.tsx` y su CSS), así que lo
medido y lo corregido alcanza a telefónico y a acreditación a la vez.

Lo que **no** estaba mal, y conviene no "arreglarlo": el panel ocupa el alto
completo, es direccionable (`panel=conectar-fuente`), el rail es dueño de su
propio scroll, y a 1024×600 el pie queda en pantalla sin contenido cortado ni
scroll anidado. Cero solapes y cero recortes.

Lo que sí: **once valores de `gap` y once combinaciones de `padding`** en un solo
panel, con `12px 13px` junto a `12px 14px` junto a `11px 12px`. Un píxel de
diferencia no se lee como jerarquía, se lee como ruido —el mismo hallazgo que
tuvieron los radios—. Colapsados los pares a 1 px, el padding horizontal pasa de
cuatro valores a **dos**: 20 en el borde del panel, 12 dentro de tarjetas. El
rail y el cuerpo tenían bordes distintos (16 contra 20) y el panel se leía como
dos piezas pegadas.

Y una ausencia vestida de opción: en Google Sheets se pintaba un grupo titulado
«O elige del catálogo de tu cuenta» cuyo único contenido era el aviso de que ese
catálogo no existe. Tapando el bloque entero no se pierde nada —el campo de
arriba es el único camino—, así que no se pinta. Kobo y SurveyMonkey conservan
su catálogo y su botón; comprobado en pantalla, que era el riesgo del cambio.

## Telefónico, segunda pasada con los detectores nuevos — 2026-07-30

Las 14 superficies del modo, medidas sobre `PDM_MedVida2026` —un estudio real y
con datos, no el fixture de la primera pasada— con los criterios que no existían
entonces: solapes, contenido cortado y dueños de scroll.

Resultado: **cero solapes y cero contenido cortado** en las catorce. Un solo
dueño de scroll por superficie (`mon-workbench-content`) salvo **Consultas ›
CodPulso**, que sigue con dos —`mon-query-table-wrap` y `aside.mon-query-detail`—
y confirma el hallazgo que ya estaba abierto.

El único aviso nuevo resultó ser del instrumento y no del modo: cuatro cifras
del embudo de Llamadas › Resumen operativo aparecían como «contenido cortado»
—18 px de contenido en 16 de caja— y se pintan enteras. Ver la sexta corrección.

## Adoptar la escala de espaciado en Monitoreo — medido el 2026-07-30

La escala existe (`--pulso-space-1..9` = 4, 8, 12, 16, 20, 24, 32, 40, 48 sobre
base 4), está gobernada por dos contratos y el kit compartido la usa en 68
sitios. **Monitoreo no la usa en ninguno.** Medido sobre sus declaraciones de
`gap` y `padding`:

| | valores |
|---|---|
| en la escala | 2.115 |
| **fuera** | **4.514 (68 %)** |

Los que más pesan, con su vecino más cercano:

| valor | usos | más cercano | delta |
|---|---|---|---|
| 6px | 814 | 4 u 8 | 2 (empate) |
| 10px | 805 | 8 o 12 | 2 (empate) |
| 7px | 765 | 8 (`space-2`) | 1 |
| 5px | 494 | 4 (`space-1`) | 1 |
| 2px | 474 | 4 (`space-1`) | 2 |
| 9px | 450 | 8 (`space-2`) | 1 |
| 3px | 333 | 4 (`space-1`) | 1 |

Concentración por archivo: `monitoreo.css` 2.108, `profilePage.css` 1.080,
`territorialProfile.css` 689, `telefonicoProfile.css` 229. Es decir, **el 70 %
de la deuda vive en los dos archivos compartidos y congelados**, que es
exactamente por qué colapsar los pares en un perfil no movió la pantalla.

Dos cosas que impiden automatizarlo, y por eso es decisión y no tarea:

1. **6px y 10px empatan** entre dos peldaños (2 px a cada lado) y suman 1.619
   usos. Elegir 4 u 8 para el primero, y 8 o 12 para el segundo, cambia la
   densidad de casi todo el módulo. No hay respuesta mecánica.
2. **1px y 2px no son deuda**: son hairlines y pilas de texto muy juntas. La
   escala arranca en 4, así que forzarlos sería empeorar. Descontados, la
   migración real son ~3.900 declaraciones.

## Telefónico, tercera pasada: composición — 2026-07-30

Aplicados los dos criterios de composición que faltaban —cajas concéntricas y
grupos pares desalineados— a las cinco superficies de Llamadas. **Cero defectos
de producto.** Los tres avisos que salieron eran del instrumento:

- **35 «cajas concéntricas» por superficie** que son la jerarquía sancionada
  `mon-workbench › pulso-panel › tarjeta`, o sea panel › tarjeta › control. El
  umbral de tres marcos marcaba la estructura correcta de la casa.
- **8 tarjetas con 24 px de deriva** en Sin efectiva, en una rejilla de **una
  sola columna**: ahí ceñirse al contenido es lo correcto y no hay borde
  irregular que romper.
- **Zonas de toolbar con alturas 34/42/32**: están centradas verticalmente y sus
  lados miden 388,523 y 388,531 px. El desbalance del `1fr` que registraba la
  memoria **ya está resuelto**; lo que queda es contenido de distinta altura,
  que con `align-items: center` no es defecto.

## Acreditación, desbloqueada sin tocar a nadie — 2026-07-30

Tres iteraciones sin poder llegar a este modo: el tope de cinco dev servers
dejaba un solo slot y hacían falta dos (backend + Vite). La salida no era pedir
un puerto, era **no necesitar Vite**: `make build` y el propio Plumber sirve el
SPA.

Faltaba una pieza. El puente `window.__pulsoNav` está gateado —`import.meta.env.DEV`
**o** `?qaWarmup=skip`, la marca que ya usan los runners de QA visual—, así que
en un build de producción se habilita con ese parámetro. El deep-link `?pulso=`
sí es solo de dev, pero el proyecto se abre desde el propio BootGate.

Receta, para no volver a perder tres pases:

```
make build
# backend propio en un puerto libre, con PULSO_BOOTSTRAP_PROJECT
http://localhost:<puerto>/monitoreo?qaWarmup=skip&modo=<modo>&seccion=<seccion>
```

Aviso: el SPA compilado congela el código del momento del build, así que incluye
el trabajo sin terminar de otra sesión. Antes de arreglar algo medido ahí hay que
comprobar si su CSS está en HEAD o en el diff ajeno.

## Hallazgos no estéticos

| Tipo | Modo | Superficie | Hallazgo | Referencia | Estado |
|---|---|---|---|---|---|
| ~~escala~~ **CORREGIDO** | los cuatro modos | control nativo | Se venía normalizando a 10 px todo lo que midiera 8, y **el 8 de un control nativo es correcto**: `button`, `input`, `select`, `textarea` y `.pulso-button` valen 8 en `theme.css:196`, que es la escala de control de toda la app. `--pulso-radius` (10) es la de la ficha o celda pequeña, con ~180 usos en features. Son dos escalas, no una deriva. Los ~800 «botones fuera de escala» que aparecían en Consultas de acreditación eran simplemente todos los botones de la app. Cinco selectores propios que habían llevado controles nativos a 10 se devuelven a su base | `theme.css:196`; corregido en `escalaDeSuperficies.css` y en la tabla del protocolo | cerrado |
| deuda transversal | todo el frontend | — | **29 tokens `--pulso-*` se usan sin estar definidos** y sin fallback, en ~89 sitios de ocho features (carga, home, gráficos, bitácora, editor XLSForm, calc-muestra, monitoreo). Comprobado en vivo: resuelven a vacío, así que esas declaraciones no llegan a pantalla. Ya hay guard —`tokensDefinidos.contract.test.ts`— que fija la lista como línea base y falla ante uno nuevo; saldarlos exige decidir a qué token real apunta cada uno | `frontend/src/app/tokensDefinidos.contract.test.ts` | abierto, contenido |
| ~~token inventado~~ **RESUELTO** | telefónico y territorial | varias | Cuatro reglas declaraban `box-shadow` con tokens que **no existen** —`--pulso-shadow-subtle` (3 usos) y `--pulso-shadow-xs` (1)—. La casa define `low`, `med`, `high`, `soft`, `lens`, `popover` y `raised`; una `var()` sin definir resuelve a nada, así que la materia se declaraba y las tarjetas renderizaban planas. Apuntadas a `--pulso-shadow-low`. **Conviene un chequeo automático**: hoy nada impide inventarse un token de sombra | medido el 2026-07-30 | cerrado |
| duplicación literal | telefónico | Consultas › CodPulso | Un `<strong>` y un `<small>` adyacentes imprimen **el mismo texto exacto**: «Kobo efectiva; estado telefónico actual: Fuera de base». Los dos se ven. Retirarlo exige decidir cuál de los dos nodos sobra, y eso es estructura del componente | medido el 2026-07-30 en `PDM_MedVida2026` | abierto |
| **denominador** | telefónico | Llamadas › Sin efectiva | Las barras de insistencia por responsable **nunca suman 100 %**: medidas cuatro, dan 130, 129, 129 y 133 %. Los segmentos se apilan en una sola pista, que es la gramática de una distribución, pero cada uno se calcula contra un denominador que **no contiene a sus propios numeradores** —una fila con buckets de 1+2+5 = 8 casos se divide entre 6—. Al pasar de 100 % el apilado desborda y `overflow: hidden` recorta el bucket dominante, justo el que más importa: en la fila de Marco, «6 o más intentos» pierde 223 px de 746. El suelo de 3 % de `Math.max(3, …)` agrava los buckets chicos pero no es la causa. Es cálculo, no CSS: hay que decidir cuál es la población del denominador | `TelefonicoMonitoreoPage.tsx:6695`; medido el 2026-07-30 en `PDM_MedVida2026` | abierto |
| **escala de espaciado** | los cuatro modos | todo el módulo | Telefónico renderiza **13 valores de `gap` en una sola superficie** (Llamadas › Resumen operativo) y prácticamente todos los enteros del 1 al 10; el padding horizontal empata 7 px y 8 px con ~250 elementos cada uno. Pero **la dispersión no vive en el perfil**: colapsar los 31 pares a 1 px de `telefonicoProfile.css` dejó el renderizado casi igual (5 px seguía en 151). Las reglas que ganan son `.mon-commandbar …` y `.mon-profile-canonical-shell …`, de `monitoreo.css` y `profilePage.css` —compartidos y congelados—. Normalizar ahí alcanza a los cuatro modos a la vez, así que **es una decisión de diseño, no del loop**: **CORRECCIÓN (2026-07-30)**: se dijo aquí que la casa no tenía escala de espaciado y era falso —el grep estaba mal acotado—. `tokens.css` define `--pulso-space-1..9` = 4, 8, 12, 16, 20, 24, 32, 40 y 48 px sobre base 4, con **dos contratos** que lo gobiernan (`spacingTokens.contract.test.ts` valida la escala contra `branding/identity.json` y `sharedSpacingAdoption.contract.test.ts` verifica su adopción). La escala existe y el kit compartido la usa en 68 sitios; lo que **ninguna feature ha adoptado**. Así que adoptarla en Monitoreo no es inventar nada: es usar lo que ya está gobernado, y de los 13 valores que renderiza telefónico solo 4, 8 y 12 están en la escala | medido el 2026-07-30 en `PDM_MedVida2026` | abierto — necesita decisión |
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

## Cursos-horario: auditado con el modo vacío — 2026-07-30

Las cinco superficies se auditaron sobre `hsvg2026`, **el único proyecto de
referencia del modo**, y ahí el modo está en cero: 0 cursos-horario, 0
aplicadas, 0 válidas, `S/D` en representatividad, `0/0` en cuotas. El fixture
trae el marco de aulas a escala pero no datos de monitoreo, y la familia
`aulas` ni siquiera venía declarada —hubo que elegirla en el selector inicial,
sobre una copia temporal—.

Consecuencia, y por eso las filas quedan en **parcial**: aquí solo se puede
juzgar el estado vacío y la escala. **Nada de lo denso —tablas con filas,
avance por estrato, brechas, cuotas por sexo/facultad— se ha visto nunca.** El
modo necesita una segunda pasada con datos antes de darse por pulido.

Lo que sí se pudo cerrar es justamente lo que solo se ve vacío, y era el
defecto más visible del modo: los cuatro avisos de vacío se estiraban a ~700 px
de blanco porque `mon-profile-table-wrap` lleva `height: 100%` para que la
tabla llene el panel. Con datos es correcto; sin datos convierte «No hay agenda
importada» en algo que parece no haber cargado. C3 pide contener el vacío, no
agrandarlo.

**Advertencia de método**, que costó una iteración: al elegir el modo en el
selector inicial hay que apuntar al botón exacto. Un selector que buscaba «la
tarjeta que menciona cursos-horario» agarró un ancestro y clicó Acreditación,
que quedó guardada en el proyecto —el modo lo fija el estudio y la ruta no lo
puede sobreescribir, así que no hay vuelta atrás por navegación—. Se resolvió
regenerando la copia. La tarjeta **es** el botón: `button.mon-mode-choice__option`.

Además, este modo se auditó en un stack propio (Plumber 8799 + Vite en puerto
autoasignado) para no cambiarle el proyecto a la sesión de acreditación, que
comparte el 8787. Origen distinto significa `localStorage` distinto y por tanto
`sid` distinto: es la forma de aislar dos loops de verdad, y evita el incidente
que ya está documentado más arriba.

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
