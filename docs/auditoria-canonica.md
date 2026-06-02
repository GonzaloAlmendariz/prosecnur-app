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

`audit-run.json` es la fuente de verdad de la corrida. Debe contener, como
minimo:

- `sid`: sesion real que cargo Electron o el stack dev.
- `port`: puerto real del backend.
- `project_path`: copia `.pulso` abierta.
- `project_sha256`: checksum de esa copia.
- `app_version` y `git_sha`.
- `screenshots`: capturas producidas por el smoke.

Si una captura no proviene de un run con `audit-run.json`, no se considera
evidencia canonica para diagnostico de regresiones.

## Cobertura

La semilla incluye:

- XLSForm editable con secciones, `select_one`, `select_multiple`, numericas,
  fechas, abiertas, `otro`, relevancias y constraints.
- Estado del Editor XLSForm persistido en el `.pulso`, de modo que el smoke
  entra al workbench editable y valida la exportacion.
- Data sintetica con filas validas y filas intencionalmente auditables.
- Estudio `.pulso` con base cargada para Carga, Validacion, Codificacion,
  Analitica y Graficos.
- Fuente de Dashboard cargada y curada para recorrer sus pestanas.
- Estudio de calculo muestral precomputado.
- Snapshot demo de Monitoreo sin tokens reales.
- Configuracion inicial de Hojas de ruta basada en recursos locales.

Las integraciones salientes reales (SurveyMonkey, Kobo, Hugging Face) no se
ejecutan en la auditoria automatica. Solo se verifica que sus superficies
locales no contaminen el proyecto con secretos ni dependan de credenciales.

## Regla de diagnostico

Cuando alguien reporte "no funciona":

1. Pedir `audit-run.json` y las capturas de `screenshots/`.
2. Comparar el `sid` del manifest con `localStorage.pulso.sessionId` y con las
   respuestas API.
3. Comparar `project_status.path` con `audit-run.json.project_path`.
4. Reproducir con `make desktop-audit` y luego `make audit-reference-smoke`.
5. Si el bug solo aparece en un proyecto privado, abrirlo como caso aparte; no
   mezclar sus capturas con las de auditoria canonica.
