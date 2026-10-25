# Plan de aplicación a la UI: Monitoreo territorial

Tipo: Plan de implementación
Estado: Vigente
Fecha: 2026-10-23
Autoridad: Gonzalo autorizó aplicar a la UI el revamp aprobado de los cuatro modos, con rapidez («una vez ya lo veas
bien, aplícalo»). Diseño: `docs/qa/revamp-monitoreo/territorial.md` (fichas y 11 preguntas), lienzo «Revamp de
Monitoreo · Territorial», `estandar-de-ficha.md` y `procedimientos-respondidos.md`, que mandan.

## Reglas de ejecución

- Rama `revamp-monitoreo-territorial` en su worktree; nunca se edita `main`. Un commit por pestaña, en español y con
  conventional commits; sin push ni merge.
- Se reutiliza el patrón ya probado en Telefónico (`profiles/telefonico/navegacion/`, `shell/BarraDelModo.tsx`,
  `clavesSinRotulo.test.tsx`); no se reinventa.
- `TerritorialMonitoreoPage.tsx` no está congelado, pero supera las 2,000 líneas: sólo cambia el montaje y la
  navegación; todo lo nuevo va en archivos propios bajo `profiles/territorial/{navegacion,avance,control,insumos,modelo}/`.
  `territorialProfile.css` está congelado y no crece; el CSS nuevo va en hojas propias.
- Nada que dependa de una de las 11 preguntas abiertas de `territorial.md` se decide aquí: queda como está en el diseño o
  sin dibujar, y la pregunta se repite abajo si la implementación la vuelve a tocar.
- Las cifras salen de una sola fuente: la lectura de avance es `advance$validas / advance$meta` (1,283 / 1,200) en la
  insignia, la cabecera y las pestañas; la cuota por celda sale de `route_quota_progress`.
- Datos de prueba: copia de `ACNURCG 2` (`acnurcg2.pulso`, proyecto principal desde T2; T1 se midió sobre
  `territorial_acnurcg.pulso`), servida en puertos propios con una librería de R
  aislada (`R_LIBS`), nunca 8787 ni 5173.
- Gate por fase: `pnpm -C frontend typecheck`, `make gate-front AREA=monitoreo`, `node agentic/sync-agentic-os.mjs --audit`,
  `make gate-area AREA=monitoreo GATE_ARGS='--patron "territorial"'` si se toca R, y capturas a 1440 × 1000 y
  1024 × 600 con el runner de `ui-quick-check`, distintas por md5.

## Fases

| # | Fase | Contenido | Estado |
|---|---|---|---|
| T1 | Navegación y chrome | Catálogo `territorial` con Insumos · Modelo · Control · Avance y 19 pestañas; tabla de direcciones con los alias de §1 (se leen, nunca se escriben); barra del modo con MODO, selector `FASE ▾` (A4), insignias, CORTE, píldora de estado y Actualizar partido; rail con divisores entre los grupos de Control y CORTE al pie; cabecera de pestaña de una línea; llegada en Avance › Faltante por UMP | ☑ 62dc8ee1b |
| T2 | Avance › Faltante por UMP y Resumen | `avance/FaltantePorUmp.tsx` (falta en la manzana en uso, mapa de calor por distrito, cuota de cada UMP con detalle desplegable que conserva la matriz observada, la falta real y «aporta a / resta de»); `avance/Resumen.tsx` (cifra con base y embudo del corte, por qué están en observación, ritmo del campo y distritos) | ☐ |
| T3 | Avance › Mapa y UMP explorable | `avance/MapaTab.tsx` sobre la cartografía real, ficha al costado; `avance/UmpDetalle.tsx` e `HistoriaUmp.tsx` (UMP 107) | ☐ |
| T4 | Control › Calidad | Bandeja, Señales y Equipo | ☐ |
| T5 | Control › Correcciones | Subsanaciones con decisión del coordinador, Anulaciones, Conciliación | ☐ |
| T6 | Control › Ocurrencias (condicional) | Ocurrencias y Reportes UMP | ☐ |
| T7 | Modelo | Metas y muestra, Cuotas | ☐ |
| T8 | Insumos | Conexiones, Mapeo y filtro, Padrón, Historial | ☐ |

Mientras una pestaña no tiene su contenido propio monta, dentro del chrome nuevo, la vista que absorbe (columna
«Absorbe de hoy» de §1). Cuando absorbe más de una, las demás cuelgan de ella como sub-vista direccionable con
`panel`, como en Telefónico.

## Preguntas abiertas que la implementación toca

Se conservan las 11 de `territorial.md`; aquí sólo las que una fase vuelve a tocar.

| # | Pregunta | Opciones | Mientras no se responda |
|---|---|---|---|
| T-1 | En Faltante por UMP, ¿el aplicador se muestra sólo por su código (P132), con el nombre en el `title`, o como hoy, con código y nombre? | (a) Sólo código. (b) Código y nombre. | (b), como hoy: `rotuloDeAplicador` devuelve «P132 · Nombre». |

## Hallazgos para Gonzalo

| # | Hallazgo | Dónde vive | Estado |
|---|---|---|---|
| H-1 | Las aprobaciones de observaciones se guardan y nadie las lee. La config acepta `validation_decisions.approved_response_ids`, pero `.monitoreo_territorial_validation_decision_ids` no tiene llamadores y la auditoría deja `validation_decision` vacío, así que una observación «aprobada» sigue igual. Por eso Control › Bandeja no dibuja «Aprobar observación». | `api/R/monitoreo_engine.R` (congelado) | Llevado por el lead; roza la pregunta 3 |
| H-2 | El tipo del cliente no coincide con lo que el motor publica en `production_annulments.affected_blocks`. El tipo dice `id_manzana`, `respuestas_anuladas` y `validas_anuladas`; el motor envía `block_id`, `responses_annulled`, `valid_annulled`, `district` y `latest_activity`. Corregido con el tipo `MonitoreoTerritorialAnnulledBlock` (autorizado por el lead). La lectura doble se quitó porque `affected_blocks` lo recalcula el motor en cada reporte y no se guarda en ningún `.pulso`; los nombres viejos solo existen en `impact.blocks`, que es otra estructura. | `frontend/src/api/monitoreo.ts` · `.monitoreo_territorial_annulled_blocks_payload` | Corregido |

## Notas por fase

(Se completan al cerrar cada fase.)

**T1.** El popover de FASE medía 84 px: `theme.css` acota con `max-width: 100%` todo `span` dentro de
`.pulso-command-bar` (regla `:where`, especificidad cero), y el ancla del popover es el botón. La lista declara su
propio `max-width`. Archivos compartidos tocados sólo en su bloque territorial: `lib/modules.ts`,
`lib/modulesNavigation.test.ts`, `core/monitoreoRegistry.ts`, `shell/BarraDelModo.tsx`, `shell/MonitoreoModuleChrome.tsx`,
`profiles/MonitoringDireccionPestanaContract.test.ts`, `corte/corteContractSemantics.test.ts`. `ChromeTerritorial.tsx`
reusa `telefonico/navegacion/chromeTelefonico.css`; la mudanza a `core` la hace el lead al fusionar.

**T2.** Faltante por UMP y Resumen montados como pestañas propias. Una pestaña propia puede pedir un corte distinto de
la vista a la que regresa (`corte` en `direccionTerritorial.ts`): Faltante regresa a Validación › Cuotas pero pide el
corte de Avance, porque `validation_summary` no trae `operational_adjustments` y con él la llegada habría dicho «Sin
excedente compatible cerca» en todas las UMP. Si aun así llega un corte sin subsanaciones (`reason` de scope), el
modelo deja «Quién la cubre» en «—». En Resumen, «Por qué están en observación» se cuenta caso por caso con
`observation_reasons`. `advance_summary` omite `response_audit` (C5, desconexión), así que Resumen pide el corte de
Validación (`calidad/geolocalizacion`, el mismo de Control › Señales), que trae `advance`, `response_audit` y
`route_quota_progress`. Si un corte llega sin respuestas una a una, el bloque lo dice y enlaza a Control › Señales; nunca
usa los conteos globales de GPS, que tienen otra base. Distritos y Ritmo diario siguen como sub-vistas heredadas.

Pendiente de T2 (bloqueado por el candado de corridas pesadas, que tiene prioridad Telefónico): typecheck y
`gate-front` sobre el estado final, y capturas de cierre a 1440 × 1000 y 1024 × 600 sobre `acnurcg2.pulso`. La última
captura completa (antes del cambio de corte de Resumen) dio C1 limpio en Señales y popover de FASE sin hallazgos;
Faltante y Resumen tenían `geometry-undeclared`, ya declarados en el código (`intrinsic`/`equal`, `capacity="owned"`) y
sin re-medir. En la corrida siguiente Resumen no llegó a readiness en 420 s; coincidió con la máquina trabada y la API
caída, así que no se sabe aún si es un defecto: es lo primero que se mide al reanudar.

**T3 (en curso).** Avance › UMP montada como pestaña propia (`avance/UmpsTab.tsx`), con la tabla de §3.16 (segmentado,
buscador, CSV y columnas de ocurrencias sólo si el proyecto declara el parte, E4) y, al elegir una UMP
(`panel=ump&foco=<UMP>`), la ficha (`FichaDeUmp.tsx`, la misma que usará el P1 del Mapa) y la historia de la UMP
(`HistoriaUmp.tsx`) al costado, sin tapar la tabla. Las filas son las de Faltante por UMP, así que cuentan, cuota y
estado coinciden entre pestañas (lo verifica `umpsModel.test.ts`).

La ficha necesita dos cortes: la subsanación sólo viaja en `advance_summary` y los casos sólo en `validation_summary`.
La página le pasa los dos desde `monitoreoScopeCache` (la precarga de fondo ya pide ambos); si el de Validación aún no
llegó, la ficha lo dice en vez de mostrar «0 casos».

La historia se arma en el frontend con lo que el motor ya publica: formularios del corte, filas anuladas con su
consentimiento, fecha de la anulación y subsanaciones aplicadas; la curva cuadra contra lo que cuenta hoy y avisa si
no.

Exploración de la UMP (§3.16b), con un endpoint propio autorizado por el lead:
`GET /api/monitoreo/territorial/casos-ump?ump=<UMP>` (`api/R/monitoreo_territorial_casos_ump.R`, solo lectura).
- Trae cada formulario de la UMP con GPS y hora, incluidos los anulados. Para eso pide la auditoría de Validación con
  una copia de la config sin anulaciones y marca los anulados con la misma máscara del motor; el motor, congelado, no
  crece.
- Guarda la auditoría por sesión, con la invalidación en la clave: huella de la base, fase y config territorial.
- El frontend lo lee con `api/monitoreoCasosUmp.ts` y su normalizador. Al elegir una UMP, Avance › UMP pasa a
  `ExploracionUmp.tsx`: mapa de su entorno con un punto numerado por formulario (los que comparten GPS se separan en
  espiral), vistas Titular, Reemplazo o Ambas y capas Recorrido, Estado o Cuota.
- Al costado van la tarjeta del caso (hora, aplicador, tiempo desde el anterior, celda, distancia a su manzana), la
  ficha y los casos de la jornada.
- Debajo va la historia con «Ver cada formulario»: marcas por hora con el ancho de lo que duró cada formulario. Elegir
  un capítulo, un punto, una fila o una marca elige el mismo caso en los tres lugares.

El test R (`test-monitoreo-territorial-casos-ump.R`, fixture sintética) está escrito pero sin correr: va en el
`gate-area` del cierre, cuando el lead devuelva el candado.

Avance › Mapa (§3.15) montado (`avance/MapaTab.tsx`) sobre la cartografía y la proyección del atlas, con su caché.
- Vista general: distritos PlanMet con su nombre rotulado y la manzana en uso de cada UMP como punto por estado; las que
  ya no se usan van como anillo.
- Al elegir una UMP (`panel=ump&foco`) acerca a ≈ 520 m: vecinas INEI, calles OSM del entorno, la manzana resaltada y
  la flecha de la subsanación sugerida.
- Barra arriba (capa Avance/Ocurrencias si hay parte, ir a una UMP, acercar, alejar, encuadrar) y leyenda con fuente
  abajo, en flujo: `mapaSinSuperpuestos.contract.test.ts` impide hijos absolutos en `mapa.css`.
- Lateral con Completas, Subsanadas y Pendientes, las UMP con celda pendiente y las sin parte, o la `FichaDeUmp`.
- Readiness: `false` mientras la cartografía no se resuelve (nunca «sin cartografía» antes de pedirla),
  `vacio:sin-cuota` sin UMP y `vacio:sin-cartografia` si Hojas de ruta no la tiene.

Diferencias con §3.15, sin dibujar todavía: límites y rótulos de zona, escala gráfica y la hoja inferior *plegable* a
1024 × 600 (hoy el lateral pasa debajo del mapa con su propio desplazamiento). Los puntos del mapa se eligen con el
mouse; desde el teclado se llega por «Ir a la UMP» y las listas del lateral. En la historia los aplicadores se rotulan como hoy (código y nombre); el diseño pide
«Aplicador 1 / 2». Queda atado a la pregunta T-1.

**T4 (código listo, sin gate).** Control › Calidad: Bandeja, Señales y Equipo son pestañas propias (`control/`).
- **Señales** (`SenalesTab.tsx`): histogramas de distancia del GPS a su manzana (10 tramos, marcas en 150 y 300 m) y de
  duración (cortes en 2 y 5 min, los de `territorialDuration.ts`), cada uno con su base y su mediana, y la matriz por
  distrito, que declara los casos del corte sin distrito.
- **Equipo** (`EquipoTab.tsx`): una fila por código, con recibidas, cuentan, UMP y distritos de las anulaciones; GPS
  observado con su base, menos de 5 min y cuentan por día de la auditoría; lo que tiene en bandeja. El inspector
  (`panel=codigo&foco=<código>`) muestra sus señales y sus UMP, y al pie «Anular producción».
- **Bandeja** (`BandejaTab.tsx`): filtros por motivo (en `foco`, como en el diseño) y por distrito; segmentado En
  bandeja / Anulados (los anulados uno a uno); inspector con el esquema de distancia (anillos de 150 y 300 m, sin
  coordenadas) y «Anular caso».
- **P2** (`DialogoDeAnulacion.tsx`, `panel=anular`): `<dialog>` modal nativo con la vista previa del motor en frases
  con base («UMP 145: 8 → 7 de 8», «Estudio: 1,283 → 1,282 que cuentan»), motivo obligatorio y botón de peligro. Al
  aplicar, el estado devuelto pasa por `applyTerritorialPageState`, que invalida los cortes de la fase.
- Los cortes vienen de la caché de la página: Consultas (`review_cases`, anulaciones) y Validación (auditoría).

Bloqueado: «Aprobar observación». La config guarda `validation_decisions.approved_response_ids`, pero el motor no las
consume (`.monitoreo_territorial_validation_decision_ids` no tiene llamadores y la auditoría deja `validation_decision`
vacío). Dibujar el botón prometería algo que no ocurre; conectarlo exige tocar `monitoreo_engine.R`, que está
congelado. También queda atado a la pregunta 3. Sin dibujar: «Aprobados» en el segmentado y las acciones de lote con
selección múltiple, porque la vista previa del motor es por caso. La sub-vista Duración de Señales y GPS/Duración de
la Bandeja siguen montando las vistas heredadas.

**T5 (código listo, sin gate).** Control › Correcciones: Subsanaciones, Anulaciones y Conciliación son pestañas propias.
- **Subsanaciones** (`SubsanacionesTab.tsx`): a la izquierda, las celdas con déficit por UMP (elegibles primero, las
  bloqueadas sin motivo porque el motor no lo publica, pregunta 8). Al centro, el paquete sugerido (de dónde, a dónde,
  qué celda, a qué distancia), con nota de la decisión y «Aplicar paquete». Si la nota queda vacía se guarda una que
  dice qué se movió (pregunta 1). A la derecha, activas por distrito, revertidas e historial con «Revertir» en dos
  pasos. `foco=<UMP>` desde Faltante pone ese paquete primero.
- **Anulaciones** (`AnulacionesTab.tsx`, lee `affected_blocks` con su tipo corregido, H-2): casos fuera del conteo por distrito (los sin distrito al final), una tarjeta
  por anulación activa con su impacto, su motivo y «Revertir» en dos pasos, y la tabla de UMP afectadas con su estado
  actual («No está en la ruta» si la UMP no figura en `ump_groups`).
- **Conciliación** (`ConciliacionTab.tsx`): Códigos y UMP declarada, con cifras, los pendientes con su selector (el
  padrón sin DNI, la ruta) y las conciliaciones hechas. Cada conciliación va al lote del motor con un cambio auditado
  por respuesta. Pide el corte de Validación.

«Rechazar» el paquete sugerido (autorizado por el lead): `api/R/monitoreo_territorial_rechazos.R`, con
`GET …/subsanaciones/rechazos` y `POST …/subsanaciones/rechazar`.
- El rechazo guarda nota, autor y fecha en la clave de sesión persistible `monitoreo_territorial_rechazos`, que viaja
  en el `.pulso` y está censada en `session_schema.R`.
- No vive en la config territorial por dos razones. La normalización del motor, que está congelado, arma esa config
  como lista explícita y descarta claves nuevas. Y una entrada de `operational_adjustments` con estado distinto de
  active/reverted se normaliza a «active», con lo que el rechazo se aplicaría.
- La UI lo muestra en el historial y marca «ya rechazado» si el motor vuelve a sugerir el mismo paquete (misma clave:
  bloque origen, bloque destino, sexo y edad, con la misma receta en R y en TS). El motor de sugerencias no lo filtra:
  eso exigiría tocar `monitoreo_engine.R`.
- Enganche: una línea en `plumber_app.R`, `E_MONITOREO_TERRITORIAL_RECHAZO_INVALIDO` en `errors_registry.R` y una fila
  en `session_schema.R`.
- El test R (`test-monitoreo-territorial-rechazos.R`) va en el `gate-area` del cierre.

El mapa de movimientos de §3.11 está en `control/MapaDeMovimientos.tsx`, al centro de Subsanaciones. Muestra cada movimiento activo como línea de la manzana que cede a la que recibe y el sugerido punteado, con la cartografía y la caché de Avance › Mapa. Si alguna manzana no está en la cartografía, lo dice.

**T6 (código listo, sin gate).** Control › Ocurrencias y Reportes UMP, propias y condicionales: solo existen si el
proyecto declara el parte (`tieneOcurrencias`, E4).
- **Ocurrencias** (`OcurrenciasTab.tsx`): la banda trae intentos, efectivas declaradas, tasa y no efectivas, con la barra
  de motivos y la base «partes de ocurrencias de campo · N UMP». El rótulo dice siempre que las efectivas son las
  declaradas y no las que cuentan. Debajo van los motivos por cada 100 intentos por distrito (mapa de calor), el ritmo
  por día y el histograma de la tasa por UMP con su mediana.
- **Reportes UMP** (`ReportesTab.tsx`): una baldosa por UMP de la ruta, agrupadas por distrito: sin parte en punteado
  ámbar, un parte, dos o más, y borde ámbar si lo declarado no cuadra con lo recibido en Kobo. El lateral muestra la
  UMP elegida (`foco`), las UMP sin parte y los partes de UMP fuera de la ruta. «No cuadra» compara contra lo recibido,
  como la maqueta (pregunta 7).

Sin dibujar: «Traer nuevas» en el vacío de Ocurrencias (el vacío remite a «Actualizar») y el tamaño fijo de 46 × 54 de
las baldosas (se usa 46 × 40 para que quepan los seis distritos a 1440).

**T7 (código listo, sin gate).** Modelo › Metas y muestra y Cuotas son pestañas propias (`modelo/`). Se leen aquí y se
editan en Hojas de ruta.
- **Metas** (`MetasTab.tsx`): meta por distrito con UMP, reemplazos, meta por UMP, y viviendas y población de las
  manzanas titulares. Debajo, las dos fases (las mismas opciones del selector FASE) y «Cómo se arma la muestra»
  (unidad, método, entrevistas y rango, reemplazos por UMP, eje). A la derecha, el mapa de la muestra
  (`MapaDeLaMuestra.tsx`), con la misma cartografía y caché de Avance › Mapa: titulares con relleno, reemplazos como
  anillo.
  - El mapa de cobertura del atlas heredado no se reusó: pinta los distritos con la clave cruda del motor (lo detectó
    `clavesSinRotulo`).
  - Su readiness `false` mientras carga quedó declarada en `FALSE_TRANSITORIO`.
- **Cuotas** (`CuotasTab.tsx`): las variables de cuota con su columna, la plantilla por UMP (la que usan las manzanas,
  avisando cuántas traen otra), la cuota por distrito con su total y las reglas de flexibilidad que publica el motor
  en los déficits (o «sin dato en este corte»).

Sin dibujar, por falta de dato en los cortes que se piden:
- La población 18+ del distrito y «Cuota frente a población 18+» (Censo 2017): `route_population` solo viaja en el
  corte completo.
- El aviso de contradicción entre celdas cruzadas y marginales: es la pregunta 6, y `route_quota` también solo viaja
  completo.
- Las reglas se muestran como lectura y no como interruptores: no hay endpoint para cambiarlas.

**T8 (código listo, sin gate).** Insumos: Conexiones, Mapeo y filtro, Padrón e Historial tienen vista principal propia
(`insumos/`). Las acciones que todavía no se rehicieron siguen en la vista heredada, como sub-vista con `panel`, así
que no se pierde ninguna capacidad.
- **Conexiones** (`ConexionesTab.tsx`): una tarjeta por fuente (Kobo Campo, Kobo Piloto atenuado si no es la fase
  activa, Ocurrencias si se declaran y la hoja de ruta de Sheets si existe), con estado, formulario, respuestas,
  preguntas y opciones de la ficha, última lectura, ficha leída, fase desde y la serie de lecturas. «Traer nuevas» y
  «Traer todo de nuevo» son las mismas de la barra. Al costado, la muestra de Hojas de ruta.
  - Releer ficha, cambiar formulario y conectar siguen en «Administrar fuentes» (`panel=consola`).
  - El vacío E2 publica `vacio:sin-fuente`.
- **Mapeo y filtro** (`MapeoTab.tsx`): cada rol con su columna y si está en la base (con el motivo de la falta), el
  filtro de efectivas con cuántas pasan sobre su base, los umbrales en sus unidades y el cruce de distritos. Editar
  sigue en `panel=editar` y `panel=filtro`.
- **Padrón** (`PadronTab.tsx`): archivo, personas, formato y fecha de subida; tabla con código, nombre, casos, UMP con
  casos, último y estado; al costado, los códigos fuera del padrón con enlace a Conciliación. El DNI no sale del
  modelo (lo verifica `clavesSinRotulo`). Reemplazar sigue en `panel=archivo`.
- **Historial** (`HistorialTab.tsx`): cada lectura con respuestas, nuevas (la diferencia con la lectura anterior de la
  misma fuente) y resultado, en hora de Lima (`fechaYHoraDeLima`, sin depender del ICU). Al costado, la serie de la
  fuente activa y las otras acciones (subsanaciones agrupadas por minuto y anulaciones).

Sin dibujar:
- El ensayo de «Reemplazar padrón» (cuántos códigos entran, salen y cambian): el backend no tiene modo de ensayo.
- La edición en línea del mapeo con «Guardar y recalcular» de §3.2.
- El diálogo P3 «Cambiar formulario» con la cifra de filas que se quitan.

Los tres siguen alcanzables en sus sub-vistas heredadas.

**Regla de Gonzalo para el control de tiempo (2026-10-23):** «el control de tiempo no debe controlar tanto las
encuestas largas, sino controlar las cortas».
- Las cortas son lo que se revisa: menos de 5 min y, aparte, menos de 2 min. Cada una lleva su alerta y entra en el
  conteo de la Bandeja, de Señales y de Equipo.
- Las largas no cuentan como problema:
  - en Señales sus tramos se pintan neutros, y la leyenda lo dice («5 min o más: sin alerta, también las largas»);
  - en la Bandeja, un caso de duración que no es corto no entra a la cola ni a sus conteos (test en
    `bandejaModel.test.ts`);
  - en Mapeo, el umbral de duración máxima se muestra como dato y no como alerta.
- El motor ya marcaba para revisión solo `muy_corto` y `corto`, y la sub-vista heredada de Duración trata las largas
  como «normal». El cambio en el frontend blinda que una larga no se lea como problema.
- Se verifica en el gate y las capturas del cierre.


### Cierre para la 0.9.5 (2026-10-24)

**Cabecera de pestaña (§2a-bis).** En las pestañas propias la cabecera de una línea ya no ocupa fila: el rótulo
«SECCIÓN · GRUPO / Pestaña» (`navegacion/RotuloDePestana.tsx`) entra en la barra de la pestaña o encabeza su primera
tarjeta, también en los estados vacíos, y lleva las sub-vistas cuando hay más de una. Las sub-vistas heredadas
siguen con `CabeceraTerritorial`.

**Cortes que cada pestaña lee** (`navegacion/cortesDePestana.ts`). Equipo, Reportes, Conexiones, Padrón, Mapa, UMP,
Cuotas, Historial, Subsanaciones, Bandeja y Conciliación leen cortes además del suyo. La página los pide al entrar y
no marca la vista lista hasta tenerlos. Antes, la captura las tomaba con «—» o ceros que el motor sí sabía: Equipo
sin GPS, Reportes «sin partes» con 84, Conexiones sin meta y Padrón con casos en 0.
- Reportes elige el corte cuya ruta trae UMP. El de consultas trae `route_quota_progress` vacío, no ausente.
- Padrón muestra «—» sin el corte de Validación.

**Hallazgos de las capturas, corregidos:**
- **Sexo en la tarjeta del caso.** Decía «Celda: 2, 30 años». El endpoint de casos por UMP lo rotula con la misma
  regla que la cuota (`.monitoreo_territorial_quota_sex_label`), con un test.
- **Faltante.**
  - El alto de la fila superior lo pone el mapa de calor; las pendientes desplazan dentro, así que con 29 la cuota
    por UMP ya no sale de la vista.
  - Cada tarjeta pasa a dos líneas, con la acción a la derecha.
  - A 1024×600, la pestaña desplaza entera con un solo dueño de desplazamiento.
- **Tablas.** Una regla común (`tablasTerritoriales.css`): cabecera sobre la superficie alterna, filas de 42 px y
  cifras tabulares.
- **Estado de fila.** Va en chip (`mon-ter-chip`): la cuota de UMP, el estado del Padrón y «Con excedente compatible»
  en Subsanaciones.
- **Bandeja.**
  - Anchos fijos con puntos suspensivos en aplicador, distrito y motivo (el texto entero va en el `title`). Antes la
    tabla escondía distancia y duración.
  - Los filtros miden lo que traen y sus conteos ya no tocan el borde.
- **Ocurrencias.**
  - Las cabeceras de motivo van en dos líneas, con el color de su tramo y «por cada 100 intentos» en el subtítulo.
  - «Sin Cruce Ump» pasa a «UMP sin cruce con la ruta».
  - «Por día» lleva eje con título y marcas.
- **Ritmo de Resumen.** Lleva eje Y con título («Acumulado que cuenta») y tres marcas.
- **Mapa de la muestra (Metas).** Los nombres de distrito van encima de los puntos, con halo, y en el candidato de
  su caja que menos manzanas pisa (`modelo/rotulosDelMapa.ts`, con test).
- **Subsanaciones.** El mapa de movimientos pasa a la tercera columna y llena su alto; las aplicadas van debajo.
- **Huecos.** La última tarjeta de cada columna toma el alto sobrante (exploración, lateral del mapa, Modelo, Mapeo,
  Historial); los laterales cortos (muestra y fuera del padrón) miden lo que traen.
- **C1.** Se declararon las colecciones que el runner encontró sin contrato (filtros de la Bandeja, barras de
  Señales, déficit y chips de Subsanaciones, paneles de Conciliación, columna derecha y barra de Ocurrencias, columnas
  de Modelo, Mapeo e Historial, e identidad de la ficha). Las celdas de cuota de la ficha van a filas iguales.

### Pasada de contenedores (2026-10-24, §2a-bis)

Referencia antigua capturada antes de tocar nada: Validación › Cuotas de `main` (tarjeta por UMP con cabecera de
zona y manzana, chip de estado, responsable y actividad en celdas, sub-tarjetas de Sexo y Edad y la tabla de
encuestadores) y Avance › Distritos (contorno del distrito como sello). Decisiones:

- **Tarjeta de UMP.** El detalle desplegable de Faltante por UMP pasa a ser esa tarjeta: cabecera con distrito, zona,
  manzana y tipo; estado en chip y borde lateral sólido de su tono; responsable, actividad y «cuentan» en sus celdas;
  una sub-tarjeta por variable de cuota (`CuotaPorVariable.tsx`, con la suma de cada variable en `faltanteModel`);
  «Encuestadores» con levantado, subsanado y falta real, y la matriz sexo por edad. La ficha de UMP (Mapa y UMP) usa
  las mismas sub-tarjetas.
- **Contorno de distritos.** La geometría existe: `limaDistrictCoverage.json` (PlanMet), la misma de Avance › Mapa.
  `siluetaModel.ts` (con test) encuadra un distrito en su caja; `SiluetaDeDistrito.tsx` lo pinta como sello en las
  tarjetas de pendientes, la ficha, la tarjeta de UMP y las celdas con déficit de Subsanaciones, y junto al nombre del
  distrito en el mapa de calor, Resumen, Señales, Reportes, Cuotas y Mapeo. Sin geometría para un distrito no se pinta
  nada (no se inventa). En los mapas el contorno va marcado y los nombres con halo, donde menos puntos pisan
  (`rotulosDelMapa.ts`, la regla de Metas, ahora también en Avance › Mapa).
- **Estado sin bisel ni tinte.** Ninguna franja con sombra `inset` sobre caja redondeada (13 reglas heredadas de
  `territorialProfile.css` pasan a anillo de 1 px, sin crecer el archivo) y ningún fondo teñido para un estado que no es
  error (fuente activa, fase activa, elegibles, pendientes de Conciliación, conteo de pendientes del Mapa, celdas de la
  ficha). El borde lateral sólido sí vale (es el de la referencia).
- **Hueco al pie.** Causa común: `.mon-workbench-main.is-territorial.has-report-status` (`auto auto minmax(0, 1fr)`)
  le ganaba a `.sin-cabecera`; el contenido caía en una fila `auto` y dejaba ~150 px vacíos. Con la regla corregida,
  Resumen, Señales, Cuotas y Mapeo reparten el alto entre sus filas y los laterales llegan al pie con su acción abajo.
- **Rótulo con título de tarjeta.** Si la tarjeta trae su propio título, el rótulo de la pestaña va en su fila y el
  título debajo (antes el título se iba al extremo derecho). En los vacíos el rótulo va arriba a la izquierda.
- **Bandeja.** Un caso de UMP entera se rotulaba con la clave del motor (`ump:ump_iniciada_incompleta:1501…`); ahora
  «UMP 38» (`etiqueta`, con test). Sin elipsis: los textos largos pasan a dos líneas. A 1024 la tabla desplaza en
  horizontal dentro de su marco.
- **1024 × 600.** Faltante dejaba las pendientes en 45 px y Conexiones cortaba las fuentes con dos desplazamientos
  anidados; ahora la pestaña desplaza entera con el dueño del área de trabajo.

Pendiente: la tarjeta de UMP vive en el detalle de la cuota de cada UMP; una vista de «tarjetas de todas las UMP» en
rejilla (como la lista antigua) no se dibujó porque Avance › UMP ya es la tabla de §3.16 y duplicaría la navegación.

## Ronda 2 (2026-10-24): fix de cifras y mejora visual sostenida

### Defecto C5 en Avance › Faltante por UMP (corregido)

Síntoma: con la carga fresca, la UMP 7 dice «Falta 1» y «Cubre UMP 25, a 0.96 km». Tras una mutación que devuelve
`validation_summary` (anular o revertir una anulación, descartar o restaurar una sospecha espacial), Faltante pasaba a
«Falta 0» y «Cubre —», y no se corregía solo.

Causa: `territorialReportsCoverSelection` acepta `validation_summary` para Avance a propósito (Resumen lo usa), así
que el último estado aplicado (`rawReports`) le ganaba a la caché del corte de avance. Faltante era la única pestaña
propia de Avance que no leía `options.cortes.avance` (Mapa, UMP y Cuotas sí), y `cortesDePestana.ts` no la declaraba.
El corte de validación trae `operational_adjustments` vacío con `reason: "validation_scope"`, así que la falta salía
de `missing_total` del bloque: 0. Origen: `9c47faba0` (T2).

Corrección:
- Faltante lee `options.cortes?.avance ?? reports` y declara `"avance/faltante": ["avance"]`. La página lo pide y no
  marca la vista lista hasta tenerlo. `territorialReportsCoverSelection` no se toca.
- `faltanteModel`: sin subsanaciones calculadas, la falta de la UMP sale de sus celdas (la variable que más debe,
  porque sexo y edad reparten la misma cuota; sumarlas contaría dos veces) y nunca de un 0 que el corte no midió.
  «Quién cubre» queda en «—» porque ese corte no lo midió.
- Test: `avance/faltanteLeeElCorteDeAvance.test.tsx`, que renderiza la pestaña real (`renderPestana`) con el corte de
  validación como último estado y el de avance en la caché.

### Hallazgo para Gonzalo (sin arreglar)

| # | Hallazgo | Dónde vive | Estado |
|---|---|---|---|
| H-3 | `casos-ump` tarda de 14 a 26 s la primera vez que se abre una UMP: arma un `validation_summary` completo y síncrono dentro del request, con una copia de la config sin anulaciones. Las siguientes UMP de la sesión salen de la caché. Opciones: precalentar la auditoría en el recorrido de fondo, moverla a un job `callr` con progreso, o reutilizar la auditoría del corte de validación ya cacheado y marcar las anuladas aparte. | `api/R/monitoreo_territorial_casos_ump.R:224-242` | Anotado |
| H-4 | Conciliación dice «14 conciliados» en la cabecera de Códigos y lista 15 conciliaciones: el código escrito «P514» está conciliado con dos personas distintas (P198 y P524, en respuestas distintas), así que cuenta como un código y dos conciliaciones. Puede ser legítimo o un error de conciliación: decide coordinación. | `control/conciliacionModel.ts` | Anotado |

### Modelo › Metas decía «Sin muestra de Hojas de ruta» (H11, corregido)

Caso: ni (b) ni (c). Es una variante de (a): un vacío publicado como listo con un corte que no trae la muestra.
`reportScopesForTerritorialView("modelo")` acepta `advance_summary`, y la cabecera del modo pide ese corte al entrar.
Si llega último, pasa a ser el estado aplicado y Metas lee de él `route_blocks`. Sonda directa a
`/api/monitoreo/state` sobre la misma copia de `acnurcg2.pulso`: `route_summary` trae `route_blocks 300` y
`advance_summary` trae `route_blocks 0`. La ronda 1 (v3) lo esquivó por orden de llegada; el riesgo era anterior a
`f680e38e7`.

Corrección: Metas declara `"modelo/metas": ["ruta", "avance"]` y lee `options.cortes.ruta` (`route_summary` de la
caché). Nunca cae a otro corte. Mientras el de ruta no llega, la pestaña muestra «Leyendo la muestra de Hojas de
ruta…» con `aria-busy`, y la página no se marca lista porque le falta un corte declarado. Recapturas
`terr-r2/m2`, `terr-r2/c` y `terr-r2/e`: el mapa sale pintado a 1440 y a 1024.

### Mapa de la muestra (pedido de Gonzalo, `f680e38e7`)

- Reemplazos: sólo se pintan los que están en uso. El criterio es el de Faltante: la manzana vigente de la UMP es de
  tipo reemplazo y la UMP tiene su titular. La reserva se cuenta en el pie («146 de reserva sin usar»). En ACNURCG
  quedan 4 en uso. Avance › Mapa deja de pintar la reserva; el anillo pasa a «Titular reemplazada».
- Contexto: los demás distritos de Lima Metropolitana (`limaDistrictCoverage.json`) van tenues y sin rótulo, en Metas y
  en Avance › Mapa.
- Encuadre: se calcula con la proporción medida de la tarjeta, con margen parejo, y abarca a los vecinos.
- Rótulos: dos candidatos más, encima y debajo de la caja del distrito. Los nombres ya no tapan puntos (Chorrillos y
  San Martín de Porres).

### Pasada visual de la ronda 2

Maqueta consultada como vara (Meta B, `docs/qa/maqueta-remasterizacion-2026-10-10/maqueta/m/`): L18, L20, L28, L29,
L26, L10, L21 y L38. Mandan los pedidos posteriores de Gonzalo: contenedores, rótulo en la barra, leyendas y nada de
explicaciones tras «;». Todo booleano del perfil ya es switch (L26): el único es «Incluir reemplazos».

| Pestaña | Antes (terr/v3, v5) | Después (terr-r2/e) |
|---|---|---|
| Avance › Faltante | 1024: 21 `overflow-x` en «Cubre»; subtítulo «Manzana en uso. El signo indica…» y «Otras 14 celdas…» | el chip de «Cubre» parte en dos líneas; «Manzana en uso» y «14 celdas más en manzanas sin usar», con la explicación en el tooltip |
| Avance › Resumen | 1024: `scroll-unreachable` en Distritos; chip «Meta alcanzada el 23/06 · +95»; «Un caso puede tener dos motivos.»; «Cruzó la meta…» repetido | a 1024 la pestaña desplaza entera y ninguna tarjeta se encoge; chip «Meta alcanzada el 23/06» con el excedente en el tooltip; sin frases sueltas |
| Avance › UMP (ficha e historia) | `equal-frame-drift` en las sub-tarjetas de cuota; tira de formularios sin contrato; capítulo desbordado a 1024; elegido teñido | sub-tarjetas a su alto natural; la tira es de átomos en línea; los capítulos parten línea; el elegido lleva borde, sin tinte |
| Avance › Mapa | se pintaba la reserva; ficha con casos cortados (`scroll-unreachable`) y sexo «2, 30 años» | sólo los reemplazos en uso, Lima de contexto; casos que llenan la ficha; sexo con su rótulo (misma regla que el motor) |
| Control › Señales | `capacity-drift` en las barras; «Base: … ; 289 sin distrito quedan fuera» | las celdas llenan su fila; base y mediana en chip, criterio en tooltip, «289 sin distrito» en conteo |
| Control › Bandeja | «Esquema sin coordenadas: …», «(manzana …)», «· duró» | «A 26 m de su manzana», «manzana 0200», duración en su línea |
| Control › Equipo | «N códigos; señales sobre los casos del corte», «Su producción ya está anulada; …» | «N códigos», «Producción anulada», con tooltip |
| Control › Subsanaciones | 33 `capacity-drift` en chips; 1024: `scroll-unreachable` del historial; «Mz  · Varios» con la manzana vacía; historial con «·» y «→» | chips en línea; a 1024 dos columnas y la tercera debajo, un solo dueño; «manzana 0430, P132 · …» sin «Mz» vacío; «Aplicada: de la UMP 142 a la UMP 143, 1 caso de …, por …» |
| Control › Anulaciones | «N casos fuera del conteo · M UMP» | «N casos fuera del conteo en M UMP» |
| Control › Conciliación | `equal-frame-drift` y `equal-frame-width-drift` (el pie contaba como tercer par); cadenas «·»; enlace azul subrayado | el grupo son los dos paneles; cifras en celdas; pie «0 sospechas espaciales en cola» y botón secundario |
| Control › Ocurrencias | `capacity-drift` en la barra; un 7.º motivo repetía color y la leyenda lo callaba; «Base: … · …. Las efectivas son…»; tabla con la tercera columna cortada | cinco motivos y «Otros N motivos»; «84 partes en 83 UMP» con la aclaración en tooltip; la tabla toma 1.9 fr y reparte el alto |
| Control › Reportes | lateral con 363 px vacíos; 180 px vacíos sobre la leyenda; retícula sin contrato | distritos que se reparten el alto (contrato `equal`); lateral de alto natural; subtítulo sin «·» ni «:» |
| Modelo › Metas | «Cómo se arma» con 64 px vacíos; «Campo · activa»; vacío falso (H11) | la tabla toma el alto; chip «Activa»; lee el corte de ruta |
| Modelo › Cuotas | Reglas con 145 px vacíos; «Plantilla por UMP · 8 entrevistas, marginales» | cada regla en su tarjeta, repartiendo el alto; «Plantilla por UMP de 8 entrevistas» |
| Insumos › Conexiones | lateral estirado con la acción al pie; última fuente con 160 px vacíos; «Kobo · Campo», «Desde Hojas de ruta · muestra de campo» | lateral y fuentes de alto natural, cifras en celdas; «Kobo de Campo», «Muestra de campo» |
| Insumos › Mapeo | distritos con 164 px vacíos y sin contrato; «Falta: sin columna elegida»; «(dato, no se revisa)» | filas repartidas (contrato `equal`); chips «Sin columna» y «Columna ausente»; «Duración larga desde, sin alerta» |
| Insumos › Padrón | «N personas · códigos … · subido …» | «N personas, códigos …, subido el …»; conteo en chip |
| Insumos › Historial | «Otras acciones» con 529 px vacíos; «Lecturas de las fuentes · 34» | la serie toma el alto; conteo en chip |

Pendientes que quedan:
- Subsanaciones a 1024: las dos listas de arriba desplazan dentro de un tope de 460 px y la tarjeta del paquete queda
  cortada a media altura hasta desplazar. No es una trampa de scroll (`scrollJails=0`), pero se lee apretado.
- Avance › Mapa acercado: la readiness no espera la cartografía rica (calles y vecinas). En `terr-r2/c` la UMP 2 salió
  sin calles y en `terr-r2/b` con calles. Hace falta decidir si la vista debe esperarlas.
- Modelo › Metas a 1024: la tabla de meta por distrito desplaza en horizontal (Viviendas y Población) dentro de su
  marco.
- H-3 (`casos-ump` síncrono) y H-4 (P514 conciliado con dos personas): anotados arriba.

## Ronda 3 (2026-10-25): pendientes de la ronda 2 y repaso L10/L11

Decisiones tomadas con el estándar (§2a-bis) sin volver a preguntar:

- **Metas, «Cómo se arma la muestra».** Deja de ser prosa con «;» y paréntesis. Cada parámetro es una celda con su
  rótulo corto y su valor: UMP (Manzana titular), Selección (PPS por territorio), Entrevistas por UMP (8), Rango de
  viviendas (1 a 8), Reemplazos por UMP (1) y Reparto de la meta (Por distrito). Lo que necesita explicación
  («probabilidad proporcional al tamaño», «si la titular no rinde, se pasa a su reemplazo») va en el tooltip, con
  subrayado punteado (`metasModel.ts`, con test que prohíbe «;», «:», «(» y «·» en los valores).
- **Metas a 1024.** La columna de la tabla toma 1.6 fr frente al mapa (que se encuadra con su proporción medida),
  las celdas se compactan y «Por UMP» y los nombres de distrito largos parten línea. La tabla ya no desplaza.
- **Subsanaciones a 1024.** Causa del apretón: la pestaña era un hijo flexible del área de trabajo y su fila se
  encogía a ~230 px aunque el tope fuera 460. Ahora (`flex: 0 0 auto`) mide lo que trae y desplaza entera; una columna:
  déficit a todo el ancho en dos columnas de tarjetas (alto natural, sin `capacity-drift`), paquetes con la ruta a
  la izquierda y nota y acciones a la derecha, y debajo el mapa y las aplicadas. Cada lista tiene un alto que cabe en
  la ventana (`clamp(340px, 100vh − 180px, 560px)`).
- **Mapa acercado.** `useCartografiaDelMapa` expone `ricaPendiente`. Avance › Mapa con `panel=ump` y la exploración de
  Avance › UMP no se marcan listas hasta tener calles y vecinas (o saber que fallaron); mientras tanto el lienzo va
  con `aria-busy` y el chip «Cargando calles». Se decidió esperar: la captura sin calles medía otra pantalla.
- **Ocurrencias.** `rotuloCortoDeMotivo` (con test): quita el paréntesis y se queda con la primera alternativa
  («Fuera de cuota», «Vivienda abandonada», «Hogar ausente», «No cumple criterios»); el texto del formulario va en el
  `title`. Se quitó el `line-clamp`: ningún encabezado se recorta. La leyenda usa el mismo rótulo. A 1024 la tabla por
  distrito va a todo el ancho con sus cuatro motivos (antes quedaban fuera, a la derecha) y Por día y la tasa por UMP
  lado a lado debajo.
- **Repaso L10/L11 (20 vistas, 1440 y 1024).** Vacíos de Ocurrencias, Reportes y Subsanaciones sin frase tras «;» ni
  oración relativa; «Subsanación revertida y avance recalculado»; ficha de UMP «Preparando el corte de Validación…»
  (`aria-busy`); «Parte fuera de la ruta: UMP 1437» con la explicación en el tooltip; «Duración larga desde» sin
  «, sin alerta» (va al tooltip); «La cartografía está incompleta» y «N sin GPS» pasan a chip; el diálogo de anulación
  dice «Se revierte en Control › Anulaciones». Última columna de Señales, Equipo, Ocurrencias y Anulaciones con 16 px
  (antes 8 px contra el borde).

| Pestaña | Antes (terr-r2/e) | Después (terr-r3/b) |
|---|---|---|
| Modelo › Metas | cinco viñetas con «;» y paréntesis; a 1024 la tabla desplazaba (Viviendas y Población) | seis parámetros rotulados con tooltip; a 1024 la tabla cabe |
| Control › Subsanaciones | 1024: dos listas de ~230 px y el paquete cortado a media altura | una columna, déficit en dos columnas, paquete en dos mitades; `geometryIssues=0` (en `terr-r3/a` hubo un `capacity-drift`, corregido) |
| Avance › Mapa (UMP 2) | readiness lista sin calles (`terr-r2/c`) | espera la cartografía rica; sale con calles en las dos medidas |
| Avance › UMP (exploración) | misma carrera | misma espera |
| Control › Ocurrencias | «Fuera de cuota (sexo,…» recortado con `line-clamp`; a 1024 los motivos fuera de vista | rótulos cortos enteros; a 1024 tabla a todo el ancho |
| Control › Reportes | «UMP 1437 tiene parte pero no está en la ruta.» | «Parte fuera de la ruta: UMP 1437» |
| Insumos › Mapeo | «Duración larga desde, sin alerta» | «Duración larga desde», aclaración en tooltip |
| Control › Señales / Equipo | última columna a 8 px del borde | 16 px |
| Demás pestañas | sin hallazgos nuevos | sin cambios |

Corrida final: `terr-r3/b` (42 capturas, 42 distintas por md5) `ok=true issues=0 scrollJails=0 geometryIssues=0
desplazamientoH=5` (Faltante 13 px, UMP, filtros y tabla de Bandeja, Equipo: tablas anchas legítimas; Metas ya no
figura). `terr-r3/c` a 1024 × 1400 muestra Subsanaciones y Ocurrencias enteras.

Incidente de medición: dos corridas parciales (`b-fallida.log`, `c-fallida.log`) se quedaron en `marca-en-false` 420 s
en Reportes y en Subsanaciones como primera ruta: la API no respondió el corte pedido tras el arranque frío (sólo
registró el estado ligero). Con el orden completo de rutas (Faltante primero) pasan todas. Parece costo del corte en
frío (familia de H-3), no de esta ronda; queda anotado para la ronda 4.

### Para la ronda 4 (la última de Territorial)

- **Ocurrencias › Distritos y Ritmo** siguen montando la vista heredada (`TerritorialFieldOccurrencesWorkbench`): otra
  cabecera, cadenas «·» en mayúsculas y rótulos partidos a media palabra («INCOMPLETA S SIN OCURRENCIA S»). Rehacerlas
  como pestañas propias o, al menos, rótulos cortos sin partir palabras.
- **Arranque frío con una ruta de corte pesado primero** (Reportes, Subsanaciones): la readiness espera más de 420 s.
  Revisar con H-3 si el corte de Consultas se precalienta.
- **Avance › Resumen**: «Por qué N están en observación» deja ~110 px vacíos entre la lista y el pie a 1440.
- **Modelo › Metas, fases**: «1,594 en el corte y meta de 1,200, desde el 12/06» podría pasar a celdas como los
  parámetros.
- **Ficha de UMP**: la fila de caso parte «Hombre, 51 años» en dos líneas a 1440.
- H-3 y H-4 siguen anotados arriba.

## Ronda 4 (2026-10-25): la última de Territorial

Sólo los pendientes de la ronda 3; ningún frente nuevo. `components/**` y `core/**` no se tocaron (quedan para el
botón único «Actualizar»).

- **Ocurrencias › Distritos y Ritmo.** Dejan de montar `TerritorialFieldOccurrencesWorkbench` (que sigue montando
  Reportes › UMP y Alertas, por eso no se borra nada): son pestañas propias (`control/OcurrenciasPaneles.tsx`, modelo
  puro `ocurrenciasPanelesModel.ts` con test). El rótulo de la pestaña encabeza la primera tarjeta, como en Resumen.
  - *Distritos*: una tarjeta por distrito con su contorno, la cobertura de partes en barra («7 de 25 UMP con parte»),
    seis cifras rotuladas una por fila (intentos, efectivas declaradas, no efectividad, completas, incompletas y
    válidas sin parte; el último ingreso sin parte va en el tooltip) y los tres motivos en chips con su rótulo corto.
    Las tarjetas reparten el alto (contrato `equal`) y reparten su aire por dentro; los grupos que no son distrito
    («UMP sin cruce con la ruta») van al final. Antes: cadena «19 REPORTADAS · 4 COMPLETAS SIN OCURRENCIAS · …» en
    mayúsculas y celdas que partían «INCOMPLETA S SIN OCURRENCIA S».
  - *Ritmo*: a la izquierda la tabla por día (intentos en barra, con el tramo de efectivas declaradas; los encabezados
    llevan el color de su serie, así que no hace falta leyenda) cuyas filas reparten el alto; a la derecha las cuatro
    cifras (intentos, días con parte, pico diario, último día) y las lecturas del formulario, con tipo y estado en
    chip («Lectura de partes», «Correcta») en vez de «sync», «ok» y la fecha pegada con «·».
- **Avance › Resumen.** «Por qué N están en observación» era la última tarjeta y crecía, pero su lista medía lo
  suyo y dejaba ~110 px sobre las fechas. Ahora las filas de la lista toman ese alto (contrato `equal`), la regla de
  las demás columnas.
- **Modelo › Metas, fases.** La frase «1,594 en el corte y meta de 1,200, desde el 12/06» pasa a celdas rotuladas
  (Respuestas, Meta, Desde), tres columnas en las dos tarjetas para que casen; «Respuestas» lleva en el tooltip que
  son las del corte. `opcionesDeFase` publica `cifras` además de `detalle` (el selector de fase del chrome sigue
  usando la frase). Test: `navegacion/fase.test.ts`.
- **Ficha de UMP.** Las filas de «Casos de la UMP» comparten columnas (`subgrid`): «Hombre, 51 años» no parte y la
  distancia se alinea a la derecha en todas las filas. Si la ficha es angosta, quien parte es el estado.
- **Arranque en frío (diagnóstico).** No se reproduce. Con pila propia y Reportes como primera ruta, la vista quedó
  lista en 53 s: la página pidió el estado ligero y luego `queries_summary` (19 s en frío) y `validation_summary`
  (20 s), los dos cortes que declara Reportes, y se marcó lista. Subsanaciones como primera ruta pasó igual en la
  corrida `terr-r4/a`. Las dos corridas de la ronda 3 que se quedaron 420 s en `marca-en-false` usaban la pila
  compartida de `terr/sesion.sh` (frontend y API «existentes», con el navegador vivo `vivo.mjs` sobre la misma
  sesión y el mismo puerto, mientras se editaba el árbol): dos navegadores sobre una API de un solo hilo y el HMR
  reiniciando el arranque. No es un corte que nunca llega ni un defecto del frontend; no hay nada que corregir aquí.
  H-3 (`casos-ump` síncrono) sigue siendo el costo real de la primera UMP abierta y queda anotado arriba.

| Pestaña | Antes (terr-r3/b) | Después (terr-r4) |
|---|---|---|
| Control › Ocurrencias › Distritos | vista heredada: otra cabecera, «19 REPORTADAS · 4 COMPLETAS SIN OCURRENCIAS · …», celdas «INCOMPLETA S SIN OCURRENCIA S», motivo «Vivienda abandonada/sin vivencia/inaccesible» | rótulo en la primera tarjeta; tarjeta por distrito con contorno, cobertura en barra, seis cifras rotuladas y tres motivos con rótulo corto; contrato `equal`, sin «…» (`terr-r4/c`) |
| Control › Ocurrencias › Ritmo | vista heredada: barras con «pico diario · 15/06», «ultimo dia», historial «sync / ok» con «·» | tabla por día con barra de intentos y tramo de efectivas; cuatro cifras en celdas; lecturas con tipo y estado en chip (`terr-r4/c`) |
| Avance › Resumen | ~110 px vacíos entre la lista de motivos y las fechas | la lista toma el alto; fechas al pie sin hueco (`terr-r4/a`) |
| Modelo › Metas (fases) | «1,594 en el corte y meta de 1,200, desde el 12/06» | celdas Respuestas, Meta y Desde en las dos fases (`terr-r4/c`) |
| Avance › Mapa y UMP (ficha) | «Hombre, 51 años» en dos líneas; distancias desalineadas | una línea, columnas comunes (`terr-r4/a`) |

Corridas: `terr-r4/a` (Subsanaciones primero en frío; 14 capturas, 14 distintas) `issues=0 scrollJails=0`, con
`equal-frame-drift` de 5 px y 16 colecciones sin contrato en la primera versión de Distritos, corregidos;
`terr-r4/c` (6 capturas, 6 distintas) `ok=true issues=0 scrollJails=0 geometryIssues=0 geometryCoverageMisses=0
desplazamientoH=0`. Metas a 1024 × 600 da la misma imagen en `a` y `c` porque las fases quedan bajo el pliegue (la
geometría sí las mide, sin hallazgos).

Pendientes que quedan (fuera del alcance de la ronda):
- H-3 (`casos-ump` síncrono, backend) y H-4 (P514 conciliado con dos personas, decide coordinación), arriba.
- Reportes › UMP y Reportes › Alertas siguen en la vista heredada; no estaban en la lista de esta ronda.
- El botón único «Actualizar» (`components/**`, `core/**`) viene después.
