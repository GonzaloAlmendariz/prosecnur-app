# ADR 0021: Arranque con proyecto y warm start

Estado: Aceptado

Fecha: 2026-06-24

## Contexto

Prosecnur carga una suite local con modulos pesados: mapas, graficos,
dashboard, monitoreo, hojas de ruta y editores. En computadores modestos, una
entrada rapida a Home podia trasladar el costo de carga a cada cambio de
modulo, produciendo loaders largos cuando el analista ya estaba trabajando.

El formato `.pulso` es el contenedor canonico del proyecto y la app de
escritorio es local-first. Por tanto, la aplicacion puede aceptar una espera
inicial mayor si esa espera ocurre despues de escoger el proyecto y antes de
montar la suite completa.

## Decision

El arranque interactivo de Prosecnur se divide en dos capas:

1. `BootGate`: puerta minima que solo negocia health/session, obliga a abrir o
   crear un `.pulso`, muestra recientes y errores de apertura, y dispara el
   warmup.
2. `AppSuite`: suite principal cargada dinamicamente despues de tener proyecto
   activo y de iniciar la precarga local.

La app principal no debe montar `Layout`, Home ni rutas de modulo sin proyecto
activo. Cerrar proyecto vuelve al `BootGate`.

Se agrega `POST /api/project/warmup` con contrato:

```json
{ "mode": "full", "budget_ms": 90000 }
```

La respuesta inmediata es:

```json
{ "ok": true, "job_id": "...", "kind": "project.warmup" }
```

El resultado del job reporta tareas por modulo con estado `ready`, `skipped`,
`timeout` o `error`. El warmup solo prepara caches locales y estados derivados:
no sincroniza SurveyMonkey/Kobo/Sheets, no genera entregables finales y no
persiste secretos. Las caches persistidas deben ser compactas y aprobadas por
arquitectura, como las caches territoriales de Monitoreo.

## Consecuencias

La espera inicial puede crecer por defecto hasta 90 segundos. El warmup no
precarga todos los modulos indiscriminadamente: primero calcula un plan liviano
segun el contenido del `.pulso` y prepara el nucleo mas los modulos probables
del proyecto. Los modulos no incluidos cargan bajo demanda la primera vez que se
abren, con pantalla de carga propia.

Los proyectos con Monitoreo de acreditacion preparan el scope compacto
`advance_summary` durante el warmup para que Avance, tarjetas, grafico general
y lectura por actores no paguen ese costo en el primer ingreso. Este scope no
sincroniza fuentes externas, no genera entregables y no persiste secretos.

El proyecto pasa a ser obligatorio para el uso normal de escritorio. Esto
reduce estados efimeros ambiguos y alinea el arranque con el formato `.pulso`.

Si el presupuesto inicial se agota, la app entra igualmente y las tareas no
criticas continuan en background con estado discreto. Los errores parciales no
bloquean la entrada si otras caches quedaron listas. Ninguna tarea individual
debe monopolizar el arranque; cartografia y reportes pesados tienen limites
propios y pueden continuar como trabajo local posterior. Monitoreo territorial
puede preparar piloto y campo cuando el perfil lo justifica, restaura la fase
activa original y conserva solo caches compactas de reportes y mapas.

El modo publico/exportado queda fuera de esta puerta: puede cargar la suite
directamente porque no representa una sesion de edicion local.

## Cumplimiento

- `frontend/src/main.tsx` no debe importar la suite principal ni `theme.css` de
  forma estatica.
- `BootGate` debe ser el primer render en modo escritorio y debe cargar
  `AppSuite` mediante `import("./app/AppSuite")`.
- `POST /api/project/warmup` debe devolver un job `project.warmup`.
- `GET /api/project/warmup-plan` debe devolver los modulos backend/frontend que
  el proyecto sugiere precargar.
- `Layout` debe envolver las rutas principales con una frontera de warmup por
  modulo. Si un modulo no fue preparado por el plan inicial, esa frontera debe
  preparar sus chunks y caches locales al primer ingreso, mostrar avance real y
  marcarlo como listo para no repetir la espera en la misma sesion.
- Las pruebas deben cubrir que el registry de precarga frontend enumera todos
  los modulos instalados.
- El warmup backend debe tener pruebas que verifiquen que reporta tareas por
  modulo y no genera entregables.
- Revision de PR: cualquier cache nueva en warmup debe declarar que no contiene
  secretos ni datos externos nuevos.

## Notas

Relacionado con ADR 0002 (`.pulso`), ADR 0005 (secretos fuera del proyecto),
ADR 0011 (cache persistida de mapas de Monitoreo territorial) y ADR 0016
(Monitoreo publica solo Google Sheets, sin sincronizacion implicita en warmup).
