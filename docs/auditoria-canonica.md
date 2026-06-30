# Auditoria canonica de Prosecnur

## Proposito

La auditoria canonica existe para diagnosticar Prosecnur con una referencia
unica, local y reproducible. Evita validar un proyecto alternativo mientras la
ventana del usuario falla con otro `sid`, otro puerto o caches de un `.pulso`
distinto.

El proyecto de referencia se llama **Auditoria Canonica Prosecnur**. Es un
`.pulso` sintetico, no sensible, generado desde codigo y guardado en:

```text
api/inst/audit_reference/prosecnur_audit_reference.pulso
```

Ese archivo es semilla read-only. Cada corrida copia la semilla a
`outputs/audit-runs/<timestamp>/project/` y abre esa copia.

## Comandos

Generar o regenerar la semilla:

```bash
make audit-reference-build
```

Levantar API + frontend con una copia aislada del proyecto:

```bash
make audit-reference-run
```

Abrir Electron con la copia aislada y puerto CDP para smoke:

```bash
make desktop-audit
```

Capturar evidencia desde la ventana Electron ya abierta:

```bash
make audit-reference-smoke
```

Generar todas las semillas minimas por familia:

```bash
make audit-projects-build
```

Generar, abrir o auditar visualmente una familia:

```bash
make audit-project-build PROJECT=territorial_lima_manzanas
make audit-project-run PROJECT=acreditacion_multiactor
make audit-project-visual-matrix PROJECT=procesamiento_multibase
make audit-project-deliverables PROJECT=telefonico_cuotas
```

Por defecto, la auditoria usa el puerto local `8799` para el backend y el
puerto CDP `9334` para Electron. Se pueden cambiar con `AUDIT_PORT` y
`AUDIT_CDP_PORT`. `desktop-audit` usa un `userData` de Electron propio de la
corrida y permite multi-instancia solo en modo auditoria, para no quedar
secuestrado por una ventana normal ya abierta.

## Artefactos

Cada corrida crea:

```text
outputs/audit-runs/<timestamp>/
  audit-run.json
  project/
    prosecnur_audit_reference_<timestamp>.pulso
  screenshots/
    01-home.png
    ...
```

Las semillas por familia se generan en:

```text
outputs/audit-projects/seeds/<slug>/
  <slug>.pulso
  inputs/
    <slug>_xlsform.xlsx
    <slug>_<base>_data.xlsx
  manifest.json
```

Los entregables de familia se generan fuera del `.pulso`:

```text
outputs/audit-projects/deliverables/<slug>/
  report.json
  manifest.json
  validation-report.html
  *-evidence-pack.zip
  ...
```

## Flujo Real De Encuesta Con Campo

Los proyectos canonicos declaran `audit_project$canonical_flow` y
`audit_project$module_order` en el mismo orden metodologico que deberia leer el
analista dentro de la app:

1. `diseno_planificacion`: alcance, objetivos, poblacion, actores, metodologia,
   cronograma, responsables, hitos y productos.
2. `diseno_muestral`: marco, estratos, cuotas, conglomerados, aulas, manzanas o
   actores, tamano de muestra, titulares y reemplazos.
3. `instrumento`: cuestionario, XLSForm, SurveyMonkey/Kobo, logica, saltos,
   constraints, diagnosticos y versiones.
4. `preparacion_operativa_campo`: hojas de ruta, fichas QR, recopiladores,
   materiales, paquetes imprimibles y enlaces.
5. `levantamiento_monitoreo`: fuentes activas, sincronizacion con
   Kobo/SurveyMonkey/Sheets, avance, calidad, alertas, reemplazos y
   subsanaciones.
6. `carga_consolidacion_data`: bases recibidas o sincronizadas, normalizacion,
   estudio multibase y trazabilidad de archivos fuente.
7. `validacion_limpieza`: auditoria de instrumento/data, reglas,
   inconsistencias, revision de casos, decisiones y base final validada.
8. `codificacion`: preguntas abiertas, familias, codigos, grupos y aplicacion a
   la base adaptada.
9. `analitica`: codebook, frecuencias, cruces, dimensiones, bases finales y
   panel wide cuando aplica.
10. `productos_analisis`: graficos, reportes PPT/Word/PDF, dashboard
    interactivo y HTML autosuficiente cuando aplica.
11. `cierre_auditoria_general`: expediente, evidencias por etapa, entregables,
    pendientes, riesgos y trazabilidad final.

`audit-run.json` es la fuente de verdad de la corrida. Debe contener, como
minimo:

- `sid`: sesion real que cargo Electron o el stack dev.
- `port`: puerto real del backend.
- `project_path`: copia `.pulso` abierta.
- `project_sha256`: checksum de esa copia.
- `app_version` y `git_sha`.
- `screenshots`: capturas producidas por el smoke.
- `smoke.deepWalks`: recorrido jerarquico de modulos, paths, secciones internas
  y pestanas detectadas por el smoke. Cada entrada expone `module`, `path`,
  `activePath`, `availablePaths`, `sections`, `tabs` y
  `moduleSectionTabCoverage` ademas de los detalles tecnicos del clic.

Si una captura no proviene de un run con `audit-run.json`, no se considera
evidencia canonica para diagnostico de regresiones.

## Cobertura

La semilla incluye:

- XLSForm editable con secciones, `select_one`, `select_multiple`, numericas,
  fechas, abiertas, `otro`, relevancias y constraints.
- Estado del Editor XLSForm persistido en el `.pulso`, de modo que el smoke
  entra al workbench editable y valida la exportacion.
- Data sintetica con filas validas y filas intencionalmente auditables.
- Estudio `.pulso` con dos olas (`auditoria` y `auditoria_ola2`) para Carga,
  Validacion, Codificacion, Analitica, base panel y Graficos.
- Fuente de Dashboard cargada y curada para recorrer sus pestanas.
- Codificacion sembrada con familias, respuestas y grupos de recodificacion
  para preguntas abiertas.
- Plan editable de Graficos con slides de portada, seccion y barras. El PPTX
  no se guarda como output generado dentro del `.pulso`.
- Estudio de calculo muestral precomputado para acreditacion, con catalogo de
  cobertura de marco propio y seleccion de aulas universitarias.
- Marco, seleccion, comparacion metodologica y reemplazos de aplicacion en
  aulas universitarias.
- Monitoreo activo en la ruta de aulas universitarias, mas escenarios
  disponibles de acreditacion territorial, monitoreo territorial y aulas.
- Hojas de ruta con poblacion, tamano de muestra, cuotas y muestra ya
  seleccionadas sobre recursos locales.
- Analitica con dimensiones e informacion de base panel usando `response_id`
  como llave entre las dos olas.
- Smoke profundo de UI: ademas de abrir cada ruta, la auditoria recorre
  controles semanticos de navegacion (`tablist`, rails, sidebars y bloques de
  lectura) y reporta el resultado con el vocabulario de Prosecnur:
  modulo -> path/familia -> seccion -> pestana. En rutas con familias
  canonicas, como Monitoreo y Muestra, tambien reporta `activePath` y
  `availablePaths`, sin activar acciones destructivas o de exportacion.

La matriz de proyectos canonicos agrega:

- `territorial_lima_manzanas`: distritos, UMP, manzanas, Kobo-like rows, GPS,
  duraciones, cuotas, tachas/subsanaciones, Hojas de ruta y paquetes de
  evidencia.
- `acreditacion_multiactor`: estudiantes, docentes, egresados y empleadores,
  SurveyMonkey/Kobo/Sheets simulados, correo, llamada, enlaces personalizados,
  parciales, rechazos y sin respuesta.
- `procesamiento_multibase`: tres bases sinteticas SurveyMonkey/Kobo/Sheets,
  XLSForm comun, panel/waves, validacion, limpieza, codificacion, analitica,
  graficos, dashboard y exportaciones CSV/XLSX/SAV/HTML/ZIP.
- `telefonico_cuotas`: barrido telefonico, responsables, intentos, estados,
  cuotas por distrito/grupo, no contesta, rechazo, cita y efectiva.

Cada familia incluye fuentes Google Sheets simuladas con `spreadsheet_id`,
pestana, rango y modo de integracion, pero sin OAuth, tokens ni credenciales.
Esto permite probar visualmente los flujos de monitores que trabajan conectados
a Sheets sin depender de red o cuentas reales.

## Playwright

`make audit-project-visual-matrix PROJECT=<slug>` usa `scripts/ui-quick-check.mjs`
con Playwright, API real y el `.pulso` generado. Recorre las rutas canonicas en
orden de proyecto:

- `/diseno-estudio`
- `/plan-trabajo`
- `/calc-muestra`
- `/editor-xlsform`
- `/hojas-ruta`
- `/recopiladores`
- `/monitoreo`
- `/carga`
- `/validacion`
- `/codificacion`
- `/analitica`
- `/graficos`
- `/tablero`

La matriz usa viewports desktop y portables, `--fail-on-issues` y prefetch de
datos de ruta cuando aplica. Es la via preferida para detectar overflow,
clipping, pantallas vacias, errores de hidratacion y regresiones entre modulos.

Las integraciones salientes reales (SurveyMonkey, Kobo, Hugging Face) no se
ejecutan en la auditoria automatica. Solo se verifica que sus superficies
locales no contaminen el proyecto con secretos ni dependan de credenciales. El
`.pulso` conserva insumos y estado editable; los entregables regenerables
(dashboard renderizado, PPTX, PDFs o exportaciones de procesamiento) se vuelven
a producir desde la aplicacion cuando se auditan esas pantallas.

## Regla de diagnostico

Cuando alguien reporte "no funciona":

1. Pedir `audit-run.json` y las capturas de `screenshots/`.
2. Comparar el `sid` del manifest con `localStorage.pulso.sessionId` y con las
   respuestas API.
3. Comparar `project_status.path` con `audit-run.json.project_path`.
4. Reproducir con `make desktop-audit` y luego `make audit-reference-smoke`.
5. Si el bug solo aparece en un proyecto privado, abrirlo como caso aparte; no
   mezclar sus capturas con las de auditoria canonica.
