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

