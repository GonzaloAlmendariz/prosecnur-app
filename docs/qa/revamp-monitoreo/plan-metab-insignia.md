# Meta B · M3 — una sola lectura de avance con su base (L20)

Tipo: Plan de implementación
Estado: Vigente
Fecha: 2026-10-25
Autoridad: Gonzalo: «La auditoría de la Meta B es algo que todos los monitoreos deben tener»

Origen: auditoría de la Meta B, fila 7 y brecha 7. Gonzalo: «La auditoría de la Meta B es algo que todos los
monitoreos deben tener». Maqueta: `docs/qa/maqueta-remasterizacion-2026-10-10/maqueta/m/L20-avance-con-base.html`.
De la maqueta se toma la función (la cifra con su denominador, Home lee el corte guardado), no su prosa con «·».

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | La insignia de Avance de la barra lleva su base | `shell/metricaDeSeccion.ts` (modelo), `shell/MonitoreoModuleChrome.tsx` (píldora), `shell/barraDelModo.css`; Tel en `profiles/telefonico/navegacion/barraTelefonica.ts`, Acr en `profiles/acreditacion/navegacion/barraAcreditacion.ts`; test `shell/avanceConBase.test.tsx` | Hecho en Telefónico y Acreditación |
| 2 | La base es la misma que usa la vista de Avance de cada modo | Tel: `resumenDelModo` (efectivas y meta de las cuotas con meta, el par del chip «423 de 400 efectivas» de Avance › Cuotas). Acr: `avanceDeReports` en `navegacion/resumenDelCorte.ts` (= `totalesDeAvance`, el «418 de 287 meta» de Avance › Resumen) | Hecho, sin pedir nada nuevo al backend |
| 3 | Territorial | `profiles/territorial/navegacion/barraTerritorial.ts` sigue pasando texto | Preparado: `viewMetrics` acepta `{ valor, base, lectura }`; lo cambia quien lleva `profiles/territorial/**` |
| 4 | Home dice «Actualizando» mientras el tablero se regenera y no publica la cifra vieja como actual | `features/home/lecturaDeMonitoreo.ts`, `moduleCardModel.ts`; tests en `moduleCardModel.test.ts` | Hecho. Backend en M6: `regenerando` y `regenerando_desde` en `facts.monitoreo` (ver «Backend M6») |
| 5 | Home lee el corte guardado, no uno a medio armar | `api/R/project_overview.R` (`.overview_monitoreo_facts`) | Verificado por lectura; ver abajo |
| 6 | Regla de escritura: nada de «;» o «·» explicativos | Sub-línea de la tarjeta de Monitoreo; tooltip de las píldoras | Hecho |

## Decisiones

- **Forma de la insignia.** La base va dentro de la misma cápsula, separada por un filete: `106 % | 423/400`, el
  porcentaje en negrita y la base en peso medio y tono suave. Desde 1366 px se ve; entre 1181 y 1365 queda el
  porcentaje; a 1180 o menos la barra ya escondía la cápsula entera (regla previa de la banda angosta). En los tres
  casos el `title` y el `aria-label` dicen la base entera: «Avance, 106 %, 423 efectivas de una meta de 400».
- **Tooltip sin «·».** El `title` de las píldoras era «Avance: 106 % · Cuotas, ritmo y entregas». Ahora es dos
  líneas: la cifra con su base y, debajo, qué hay en la sección.
- **Conteos.** Control «23» sigue siendo un texto: no es un avance y no tiene denominador.
- **Home, sub-línea.** «Meta cumplida · 423 de 400 efectivas» pasa a «423 de 400 efectivas, meta cumplida», y
  «Faltan 99 para la meta · 188 de 287» a «188 de 287 efectivas, faltan 99». El actor rezagado salía encadenado con
  «·» y baja a su propio pie («va último: Docentes al 12%»).
- **Home, «Actualizando».** Con `regenerando = true` la cifra grande dice «Actualizando», el estado también, y la
  base queda como «Corte anterior: 423 de 400 efectivas».
- **No se lee `pending_regeneration`.** Se marca al guardar la configuración (`router_monitoreo.R`) y no encontré
  dónde se pone en `FALSE` al servir el tablero nuevo: lo reemplaza un snapshot nuevo, no el build lazy. El espejo que lee Home (`efectividad_overview_facts`) sí lo reescribe
  la vista viva. Leer ese flag haría decir «Actualizando» a una tarjeta cuya cifra ya está al día. La barra del modo
  lo lee como «Preparando», que es otra cosa.

## Lo que exigía backend (resuelto en M6, ver abajo)

- **`regenerando` en `facts.monitoreo`.** `.overview_monitoreo_facts` debe mandar `regenerando = TRUE` mientras haya
  un job de sync de monitoreo en curso para la sesión, o mientras el tablero quede por rehacer y el espejo de Home
  no se haya reescrito. Hoy no existe un registro de jobs por sesión que el overview pueda consultar
  (`router_jobs.R` sólo responde por `job_id`). Sin ese campo la tarjeta se comporta como antes. Tampoco hay una
  señal de frontend que sirva: al salir de Monitoreo el poll del sync se corta y su store vuelve a reposo aunque el
  job siga.
- **Corte guardado.** Lo que Home lee es `s$monitoreo_snapshot` de la sesión: el espejo `*_overview_facts` que la
  vista viva dejó al servir un corte completo, o el `dashboard` guardado. El sync reemplaza el snapshot entero al
  terminar y el warm start sólo funde cachés de reporte (`project_warmup.R`), así que no hay un corte a medio armar
  a la vista.
- **Pero hay una cifra vieja con fecha nueva.** Al terminar un sync, `monitoreo_sync_incremental.R` (≈ línea 1096)
  copia al snapshot nuevo los `*_overview_facts` del corte ANTERIOR («stale pero informativo») y deja el snapshot
  sin `dashboard`, hasta que el primer GET de la familia re-espeja. En ese intervalo Home muestra el avance viejo y
  `monitoreo_last_cut` ya trae el `synced_at` nuevo: la cifra se publica como del corte nuevo. Ese intervalo es
  exactamente `regenerando`, y es detectable sin registro de jobs: marcar el espejo heredado (por ejemplo
  `overview_facts_heredado = TRUE` en el carry-over y `FALSE` en `monitoreo_snapshot_refresh_overview_facts`) y
  publicarlo como `regenerando` en `.overview_monitoreo_facts`. Con eso la tarjeta dice «Actualizando» y «Corte
  anterior: …» sin cambios en el frontend.

## Backend M6 — el espejo heredado viaja marcado

- **Dónde vive la marca.** `monitoreo_snapshot$overview_facts_heredado`, una lista por campo
  (`efectividad_overview_facts`, `territorial_overview_facts`, `aulas_overview_facts`) cuyo valor es el
  `synced_at` del corte que calculó la cifra. La pone `monitoreo_snapshot_inherit_overview_facts`
  (`api/R/monitoreo_overview_facts.R`), que `monitoreo_sync_apply_deferred` llama en lugar del bucle de copia.
- **Quién la borra.** `monitoreo_snapshot_refresh_overview_facts`, sólo la del campo de su familia, y aunque la
  cifra nueva coincida con la heredada (si no, Home quedaría en «Actualizando» para siempre). Un tablero que no
  trae facts de la familia no la borra.
- **Dos syncs seguidos** sin abrir Monitoreo conservan el corte de ORIGEN, no el intermedio.
- **Qué publica Home.** `.overview_monitoreo_facts` agrega `regenerando` (lógico) y `regenerando_desde` (el corte
  de origen, `""` si el espejo es propio), con el campo de la familia vigente. El `safe()` de respaldo lleva los
  dos en `FALSE`/`""`.
- **Viaja en el `.pulso`.** `monitoreo_snapshot` es persistible entero (`session_schema.R`); no hay sanitizado de
  sus subcampos al guardar. Decisión: que viaje. Un `.pulso` guardado en ese intervalo sigue teniendo la cifra del
  corte anterior, así que reabrirlo debe decirlo igual; la marca se limpia la primera vez que Monitoreo sirve la
  familia. Limpiarla al guardar volvería a publicar la cifra vieja como del corte nuevo.
- **Sin registro de jobs.** No se usa `pending_regeneration`. `regenerando` no significa «hay un job corriendo»,
  significa «la cifra es de un corte anterior al vigente».
- **Frontend.** Lee `regenerando`; `regenerando_desde` queda disponible y aún no se consume. El tipo
  `ProjectOverview` no se tocó (fuera del glob).
- **Verificación.** `api/tests/testthat/test-monitoreo-overview-regenerando.R` (8 casos, sync real por
  `monitoreo_sync_apply_deferred` → overview → `monitoreo_snapshot_store_overview_facts` → overview). Rojo antes
  del fix (9 fallas), verde después (20 pass). `make gate-area AREA=monitoreo GATE_ARGS='--patron
  "sync|snapshot|overview|home"'`: 16 suites, 600 pass, 0 fail. `test-session-schema.R`: 14 pass.

## Verificación

- `pnpm -C frontend typecheck`: verde.
- `make gate-front AREA=monitoreo`: 548 archivos, 6054 tests, verde. `make gate-front AREA=home`: 12 archivos,
  552 tests, verde.
- Capturas en `scratchpad/m3/{tel,acr}`: Telefónico (`pdm.pulso`) y Acreditación (`acred_conta.pulso`), Avance,
  Insumos y Home, a 1440x1000 y 1024x600, `--require-geometry --fail-on-issues --timeout-ms 420000`. Las dos
  corridas `ok=true`, `issues=0`, `geometryIssues=0`, `geometryCoverageMisses=0`, `desplazamientoH=0`; 12 capturas
  distintas.
  - 1440: Tel «106 % | 423/400», igual al chip «423 de 400 efectivas» y al total de Cuotas. Acr «146 % | 418/287»,
    igual a «418 de 287 meta» de Resumen.
  - 1024: la cápsula se esconde como antes y «Avance» se lee entero. La primera corrida mostró la cápsula y
    recortaba «Av…»: el `display` de `.has-base` le ganaba a la regla de la banda angosta. Corregido.
  - Home: «423 de 400 efectivas, meta cumplida» y «418 de 287 efectivas, meta cumplida». En acred_conta salía
    «Administrativos al 100% va último» con el agregado al 145.6 %: un actor que cumplió no es rezagado y ya no se
    nombra.
  - C1 en Home: los pasos de la barra de Dashboard (`home-mc-progress-steps`) no declaraban grupo y daban 2
    `geometry-undeclared` con pdm. Declarado `intrinsic`.

## Pendientes

- Territorial: pasar `{ valor, base, lectura }` desde `barraTerritorial.ts` («cuentan para la meta» sobre la meta).
- Acreditación al abrir en Insumos: la insignia de Avance (y la de Control) no aparece hasta visitar Avance, porque
  `useResumenDelCorte` sólo la arma con `client_report.actors`, que trae el corte de Avance. Pasa igual en main.
- Redondeo: la insignia dice «106 %» y Home «105.8%». Misma base, distinta precisión. No se tocó.
- Home «39 por revisar» y la insignia de Control «23» miden cosas distintas (inconsistencias del overview frente a
  casos que esperan decisión). No es de esta tarea.
