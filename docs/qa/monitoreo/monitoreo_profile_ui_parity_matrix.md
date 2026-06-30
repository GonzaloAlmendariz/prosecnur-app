# Monitoreo profile UI parity matrix

Fecha: 2026-06-29

## Arquitectura esperada

Monitoreo debe comportarse como mini-app:

1. Perfil activo.
2. Ruta/path activo.
3. Topbar con secciones del perfil.
4. Sidebar/rail con tabs locales.
5. Workbench con el contenido activo.

No se acepta una pagina larga unica ni un sidebar decorativo. Aulas universitarias y Telefonico deben tener calidad equivalente a Territorial y Acreditacion. Aulas ya tiene cobertura `tab-scope all` en fixture local; Acreditacion real ya tiene cobertura `tab-scope all` con ACRDCONTA y sin duplicados de state, aunque conserva costo de preparacion/render; Telefonico standalone queda focalizado como acceso directo al telefono de Acreditacion, con una sola seccion superior y cuatro tabs locales verificados. Territorial real ya tiene cobertura `tab-scope all` con ACNURCG y, en flujo BootGate production-like, entra a la miniapp ya hidratada para Validacion. El workbench compartido de salidas queda empaquetado en `monitoreo-core`, sin ciclo circular entre chunks de Acreditacion y Territorial en build.

## Matriz

| Perfil | Perfil/path visible | Topbar secciones | Rail/sidebar tabs | Workbench activo | Cobertura medida | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Territorial | existente en capturas `tmp/perf/territorial-final-20260629/territorial/screenshots/`, `tmp/perf/territorial-bootgate-client-cache-final-20260629/screenshots/`, `tmp/perf/territorial-map-detail-ready-v3/territorial/screenshots/` y loading real `tmp/perf/territorial-progress-mapped/ui-loading/` | si | si | si | ACNURCG real: 24/24 tabs declaradas hidratadas en corrida all; flujo BootGate production-like: `/monitoreo` 0.126 s, `Geolocalizacion` 0.496 s, 0 state requests en ruta, `full=false` | cumple en cobertura all y entrada post-BootGate |
| Acreditacion | existente en capturas `tmp/perf/acrdconta-scope-cache-final-20260629/acreditacion/screenshots/` | si | si | si | ACRDCONTA real `tab-scope all`: 22/22 tabs hidratadas en `tmp/perf/acrdconta-scope-cache-final-20260629/report.json`; `full=false`, 0 errores, 0 state duplicates | cumple cobertura y dedupe; performance de preparacion/render pendiente |
| Aulas universitarias | si, `Aplicacion en aulas` | si: Avance, Agenda, Validacion, Consultas, Fuentes | si, rail numerado del perfil | si, `.mon-profile-content` | 5/5 tabs declaradas hidratadas en `tmp/perf/monitoreo-aulas-telefonico-all-v3`; `HSVG2026.pulso` inspeccionado y descartado como Monitoreo porque no tiene `monitoreo_config` | cumple en fixture; falta proyecto real Monitoreo Aulas |
| Telefonico | si, `Monitoreo telefonico` / `Path Telefonico` | si: `Telefono` como unica seccion del standalone | si, 4 tabs locales iguales a Acreditacion/Telefono | si, workbench canonico de Acreditacion/Telefono | harness focal vigente: `tmp/perf/monitoreo-telefonico-focal-contract-20260629/report.json`, 4/4 tabs declaradas hidratadas sin loaders, `full=false`, 0 duplicados | cumple en fixture; los datos del fixture son limitados |

## Tabs declaradas vs medidas

| Perfil | Declaradas | Medidas hidratadas | No medidas en esta pasada |
| --- | --- | --- | --- |
| Acreditacion | Fuentes/Encuestas, Fuentes/Sheets, Fuentes/Fuentes activas, Modelo/Metas y modalidades, Modelo/Base de barrido, Modelo/Enlaces y envios, Modelo/Estados validos, Modelo/Calendario, Consultas/Casos, Consultas/Efectivas, Consultas/Faltantes, Consultas/Duplicados, Consultas/Diferencias, Telefono/Resumen, Telefono/Dia, Telefono/Responsables, Telefono/Alertas, Avance/Resumen, Avance/Actores, Avance/Encuestas, Avance/Detalle, Avance/Salidas | 22/22 hidratadas en ACRDCONTA real | ninguna; queda costo residual de preparacion/render all, especialmente `Modelo/Enlaces` |
| Aulas universitarias | Avance/Resumen, Agenda/Aulas, Validacion/Alertas, Consultas/Brechas, Fuentes/Plan | Avance/Resumen, Agenda/Aulas, Validacion/Alertas, Consultas/Brechas, Fuentes/Plan | ninguna en fixture all |
| Telefonico | Telefono/Resumen, Telefono/Dia, Telefono/Responsables, Telefono/Alertas | Telefono/Resumen, Telefono/Dia, Telefono/Responsables, Telefono/Alertas | ninguna en fixture focal |
| Territorial | Fuente/Formulario, Fuente/Filtro y distritos, Fuente/Encuestadores, Fuente/Reconciliacion, Fuente/Historial, UMPs/Cobertura, UMPs/Manzanas, Validacion/Geolocalizacion, Validacion/Reconciliacion UMP, Validacion/Duracion de tiempo, Validacion/Cuotas, Validacion/Anulacion, Consultas/Registro, Consultas/GPS por revisar, Consultas/Duracion por revisar, Consultas/Cruce responsable, Consultas/Subsanaciones, Avance/Resumen, Avance/Mapa y UMP, Avance/Ritmo diario, Avance/Salidas, Ocurrencias/Estados general, Ocurrencias/Por UMP, Ocurrencias/Observaciones | 24/24 hidratadas en ACNURCG real; detalle UMP profundo 6/6 probes OK | sin tabs pendientes; queda optimizar primer visual dev/import |

## Capturas

| Perfil | Capturas relevantes |
| --- | --- |
| Aulas universitarias | `tmp/perf/monitoreo-aulas-telefonico-all-v3/aulas_universitarias/screenshots/tabs/01-avance-resumen.png` a `05-fuentes-plan.png` |
| Acreditacion | `tmp/perf/acrdconta-scope-cache-final-20260629/acreditacion/screenshots/tabs/01-fuentes-encuestas.png` a `22-avance-salidas.png`; revisar especialmente `06-modelo-enlaces-y-envios.png`, `09-consultas-casos.png` y `15-telefono-dia.png` |
| Telefonico | `tmp/perf/monitoreo-telefonico-focal-contract-20260629/telefonico/screenshots/tabs/01-telefono-resumen.png` a `04-telefono-alertas.png` prueban el contrato automatico vigente; `tmp/visual-qa/telefonico-standalone-parity-20260629/telefonico-standalone-after.png` queda como captura manual de contraste |
| Territorial | `tmp/perf/territorial-final-20260629/territorial/screenshots/territorial-entry-hydrated.png`, `territorial-advance-summary.png`, `territorial-interaction.png`, `territorial-warm-interaction.png`, `tabs/08-validacion-geolocalizacion.png`, `tabs/24-ocurrencias-observaciones.png`, `tmp/perf/territorial-bootgate-client-cache-final-20260629/screenshots/monitoreo-entry.png`, `validacion-geolocalizacion.png`, `tmp/perf/territorial-progress-mapped/ui-loading/warmup-mid.png`, `warmup-late.png` |
| Acreditacion | `tmp/perf/monitoreo-hydration/acreditacion/screenshots/acreditacion-entry-hydrated.png` |

## Hallazgos

- Aulas ya expone jerarquia de mini-app, no una lista larga: topbar del perfil, rail local y workbench de avance/agenda.
- Telefonico reutiliza el flujo canonico de Acreditacion/Telefono, pero como standalone ya no expone Fuentes/Modelo/Consultas/Avance en la topbar: entra directo a `Telefono` con el mismo rail local de Resumen, Dia, Responsables y Alertas.
- `project.warmup` ya prepara Telefonico como perfil completo de Monitoreo, no como modulo secundario que termina de hidratarse despues de entrar.
- La evidencia historica `tmp/perf/monitoreo-telefonico-screenshot-settle-v8/report.json` queda como prueba del contrato anterior de perfil completo; la evidencia vigente del standalone es `tmp/perf/monitoreo-telefonico-focal-contract-20260629/report.json`.
- El harness ya recentra el viewport antes de guardar tabs: las capturas de `Telefono/Resumen`, `Telefono/Dia` y `Consultas/Casos` muestran contenido real en lugar de una vista vacia por scroll residual.
- Validacion de harness 2026-06-29: `node --check scripts/monitoreo-performance-check.mjs` y `node scripts/monitoreo-performance-check.mjs --help` pasan; el helper de estabilizacion de viewport queda al menos cubierto por sintaxis/CLI antes de usarlo en nuevas capturas.
- Acreditacion ACRDCONTA real ya no esta pendiente de `tab-scope all`: 22/22 tabs declaradas hidratan sin loaders, sin `full` y sin duplicados de `/api/monitoreo/state`; queda costo residual de preparacion/render all.
- El build de produccion ya no advierte ciclo circular `monitoreo-acreditacion -> monitoreo-territorial`: `salidas/` se agrupa con `monitoreo-core` para que el workbench compartido no dependa de un chunk de perfil.
- Aulas sigue sin proyecto real de Monitoreo localizado: `HSVG2026.pulso` es real y tiene estructuras de calculo de aulas, pero no estado/configuracion de Monitoreo; la paridad visual de Aulas se sostiene por fixture canonico.
- El harness `PROFILE_COVERAGE.telefonico` ya coincide con el contrato focal de 4 tabs; queda pendiente conseguir un proyecto telefonico real con datos ricos, porque el fixture actual ejercita estados vacios.
- Territorial queda validado en paridad de cobertura all con ACNURCG real: 24/24 tabs medidas e hidratadas, sin loaders bloqueantes, sin `full` y sin errores page/resource. En flujo BootGate production-like, la miniapp entra en 0.126 s y `Validacion/Geolocalizacion` queda usable en 0.496 s sin requests de state en ruta.

## Checklist de salida

- Perfil activo visible en los cuatro perfiles: si en Acreditacion real, Territorial real, Aulas fixture y Telefonico fixture focal.
- Secciones y tabs locales: si en Territorial/Acreditacion all, Aulas fixture all y Telefonico standalone focal.
- Workbench activo por tab: si para la cobertura medida; Territorial ademas queda probado tras BootGate con cache de cliente; quedan pendientes proyectos reales de Aulas/Telefonico con datos ricos.
- Sin full scope en fixtures: si.
- Empaquetado compartido: `pnpm --dir frontend build:fast` sin ciclo circular Acreditacion/Territorial.
- Sin duplicados de `/api/monitoreo/state`: si en fixtures y en Acreditacion ACRDCONTA scope-cache; Territorial queda con 1 duplicado light residual pero sin duplicados de scopes pesados.
