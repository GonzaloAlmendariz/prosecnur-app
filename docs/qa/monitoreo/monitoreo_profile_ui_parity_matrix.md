# Monitoreo profile UI parity matrix

Fecha: 2026-06-29

## Arquitectura esperada

Monitoreo debe comportarse como mini-app:

1. Perfil activo.
2. Ruta/path activo.
3. Topbar con secciones del perfil.
4. Sidebar/rail con tabs locales.
5. Workbench con el contenido activo.

No se acepta una pagina larga unica ni un sidebar decorativo. Aulas universitarias y Telefonico deben tener calidad equivalente a Territorial y Acreditacion. Aulas y Telefonico ya tienen cobertura `tab-scope all` en fixtures locales; Territorial y Acreditacion reales siguen pendientes de cierre completo por costo de scopes pesados.

## Matriz

| Perfil | Perfil/path visible | Topbar secciones | Rail/sidebar tabs | Workbench activo | Cobertura medida | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Territorial | existente en capturas `tmp/perf/territorial-bootgate-cache-hit-final-v2/territorial/screenshots/`, `tmp/perf/territorial-map-detail-ready-v3/territorial/screenshots/` y loading real `tmp/perf/territorial-progress-mapped/ui-loading/` | si | si | si | BootGate real + entrada critica verificados; `Avance/Mapa y UMP` visible frio/warm y detalle UMP profundo verificados; tabs all y costo de capas ricas/GPS pendientes | parcial, remedir navegacion completa |
| Acreditacion | existente en capturas `tmp/perf/monitoreo-hydration/acreditacion/screenshots/` | si | si | si | intento real no cerrado en JSON por scopes pesados | pendiente de remedir completo |
| Aulas universitarias | si, `Aplicacion en aulas` | si: Avance, Agenda, Validacion, Consultas, Fuentes | si, rail numerado del perfil | si, `.mon-profile-content` | 5/5 tabs declaradas hidratadas en `tmp/perf/monitoreo-aulas-telefonico-all-v3` | cumple en fixture |
| Telefonico | si, `Monitoreo telefonico` / `Path Telefonico` | si: Fuentes, Modelo, Consultas, Telefono, Avance | si, tabs locales/pills operativas compartidas con Acreditacion | si, workbench canonico de Acreditacion/Telefono | 8/8 tabs declaradas hidratadas en `tmp/perf/monitoreo-telefonico-parity-v4`; `Consultas/Casos` ya activa su propio rail/workbench | cumple en fixture; falta optimizar tiempo all |

## Tabs declaradas vs medidas

| Perfil | Declaradas | Medidas hidratadas | No medidas en esta pasada |
| --- | --- | --- | --- |
| Aulas universitarias | Avance/Resumen, Agenda/Aulas, Validacion/Alertas, Consultas/Brechas, Fuentes/Plan | Avance/Resumen, Agenda/Aulas, Validacion/Alertas, Consultas/Brechas, Fuentes/Plan | ninguna en fixture all |
| Telefonico | Telefono/Resumen, Telefono/Dia, Telefono/Responsables, Telefono/Alertas, Fuentes/Encuestas, Modelo/Base de barrido, Avance/Resumen, Consultas/Casos | Telefono/Resumen, Telefono/Dia, Telefono/Responsables, Telefono/Alertas, Fuentes/Encuestas, Modelo/Base de barrido, Avance/Resumen, Consultas/Casos | ninguna en fixture all |
| Territorial | Fuente/Formulario, Fuente/Filtro y distritos, Fuente/Encuestadores, Fuente/Reconciliacion, Fuente/Historial, UMPs/Cobertura, UMPs/Manzanas, Validacion/Geolocalizacion, Validacion/Reconciliacion UMP, Validacion/Duracion de tiempo, Validacion/Cuotas, Validacion/Anulacion, Consultas/Registro, Consultas/GPS por revisar, Consultas/Duracion por revisar, Consultas/Cruce responsable, Consultas/Subsanaciones, Avance/Resumen, Avance/Mapa y UMP, Avance/Ritmo diario, Avance/Salidas, Ocurrencias/Estados general, Ocurrencias/Por UMP, Ocurrencias/Observaciones | Fuente/Formulario, Avance/Resumen, Avance/Mapa y UMP; detalle UMP profundo 6/6 probes OK | 21 tabs sin medir en esta pasada; capas ricas/GPS tardan 54.468 s |

## Capturas

| Perfil | Capturas relevantes |
| --- | --- |
| Aulas universitarias | `tmp/perf/monitoreo-aulas-telefonico-all-v3/aulas_universitarias/screenshots/tabs/01-avance-resumen.png` a `05-fuentes-plan.png` |
| Telefonico | `tmp/perf/monitoreo-telefonico-parity-v4/telefonico/screenshots/tabs/01-telefono-resumen.png` a `08-consultas-casos.png`; `08-consultas-casos.png` prueba que `Consultas` ya no queda atrapado en el tablero de `Telefono` |
| Territorial | `tmp/perf/territorial-bootgate-cache-hit-final-v2/territorial/screenshots/territorial-entry-hydrated.png`, `territorial-advance-summary.png`, `territorial-interaction.png`, `territorial-warm-interaction.png`, `tmp/perf/territorial-map-detail-ready-v3/territorial/screenshots/territorial-interaction.png`, `territorial-interaction-detail.png`, `territorial-warm-interaction.png`, `tmp/perf/territorial-progress-mapped/ui-loading/warmup-mid.png`, `warmup-late.png` |
| Acreditacion | `tmp/perf/monitoreo-hydration/acreditacion/screenshots/acreditacion-entry-hydrated.png` |

## Hallazgos

- Aulas ya expone jerarquia de mini-app, no una lista larga: topbar del perfil, rail local y workbench de avance/agenda.
- Telefonico reutiliza el flujo canonico de Acreditacion/Telefono: mismas secciones topbar, mismo rail local, mismos scopes declarados y `queries_summary` disponible para `Consultas`.
- El fallo anterior de `Consultas/Casos` en Telefonico se corrigio: la captura nueva muestra `Consultas` activa, rail con 5 modos y tabla de casos visible.
- Aulas y Telefonico ya tienen `--tab-scope all`; la siguiente vuelta debe cerrar Territorial/Acreditacion con la misma cobertura cuando los scopes reales no bloqueen el proceso.
- Territorial y Acreditacion no deben considerarse validados en paridad completa en esta corrida: Territorial ya tiene warmup/loading real, entrada critica post-warmup, mapa visible `Avance/Mapa y UMP` y detalle UMP profundo sin loaders verificados, pero falta cerrar navegacion completa por tabs y reducir el costo de capas ricas/GPS; Acreditacion tiene entrada post-warmup, pero falta `tab-scope all`.

## Checklist de salida

- Perfil activo visible en los cuatro perfiles: parcial; Aulas/Telefonico medidos all en fixtures, Territorial medido en entrada critica, Acreditacion capturado pero no cerrado.
- Secciones y tabs locales: parcial; Aulas/Telefonico OK en fixtures, perfiles reales pendientes de corrida completa.
- Workbench activo por tab: parcial; Aulas/Telefonico OK en all fixtures.
- Sin full scope en fixtures: si.
- Sin duplicados de `/api/monitoreo/state` en fixtures: si.
