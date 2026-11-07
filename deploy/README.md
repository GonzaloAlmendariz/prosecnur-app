# Deploy web del Dashboard

Documentación operativa para publicar el Dashboard de un proyecto a la
web. La app de Prosecnur (local, Electron) tiene un botón **Deploy**
(Fase 4 del plan) que automatiza este flujo, pero los archivos de acá
también sirven para hacerlo manual.

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│  Hugging Face Space (Docker SDK) o Fly.io machine        │
│                                                          │
│   Dockerfile (multi-stage)                               │
│      ├─ Stage 1: pnpm build (modo público)               │
│      └─ Stage 2: rocker/r-ver + paquete prosecnurapp     │
│                                                          │
│   /data/proyecto.pulso  ← bootstrap committed or mounted │
│   :7860                  ← Plumber + frontend            │
└──────────────────────────────────────────────────────────┘
```

- **Modo público**: el frontend se buildea con `VITE_PULSO_PUBLIC_MODE=true`
  → oculta admin bar y agrega `noindex,nofollow`. El backend activa
  `PULSO_PUBLIC_MODE=1` → middleware whitelist deja pasar solo endpoints
  read-only del dashboard (ver `api/R/forbid_mutations.R`).
- **Bootstrap obligatorio**: `launch_server.R` falla rápido si no encuentra
  un `.pulso` en `PULSO_BOOTSTRAP_PROJECT` (default `/data/proyecto.pulso`).
- **Sólo un `.pulso` PREPARADO para publicar** (ADR 0122 §9). Nunca se sube el
  `.pulso` del proyecto: trae la lista de encuestadores con nombres y DNI, la
  base completa con todas sus columnas y lo demás. El botón Deploy y el script
  `api/scripts/publicacion_preparar.R` arman la misma copia: sólo lo que el
  dashboard lee, con la base podada a las columnas que usa, y una marca
  (`publicacion_preparada`). `launch_server.R` **no arranca** con un `.pulso`
  sin esa marca.

  ```bash
  Rscript api/scripts/publicacion_preparar.R --project /ruta/MiProyecto.pulso --out data/proyecto.pulso
  ```

  El script no toca el proyecto y termina con error si el detector de datos
  personales encuentra algo en el resultado.
  En Hugging Face el `.pulso` viaja dentro de la imagen; no se declara
  `VOLUME /data` para evitar que el runtime lo tape con un volumen vacío.

## Targets

### Hugging Face Spaces (gratis, primera opción)

Para Dashboards generales se usa Docker SDK:

1. Crear Space en [hf.co/spaces](https://huggingface.co/spaces) — SDK
   = Docker, visibility = Public.
2. Renderizar `hf-space-README.md.template` con los valores reales y
   commitearlo como `README.md` en la raíz del Space.
3. Subir vía `huggingface_hub` API o git push:
   - `Dockerfile` (raíz)
   - `api/`, `frontend/`, `launcher/`, `tsconfig.json` (todo el repo
     menos lo del `.dockerignore`)
   - `data/proyecto.pulso`: el `.pulso` PREPARADO con
     `api/scripts/publicacion_preparar.R` (o el que arma el botón Deploy),
     nunca el del proyecto
4. HF buildea el Dockerfile (~10-15 min primera vez, ~2 min cached).

Monitoreo no usa este flujo. Sus salidas vigentes son workbooks de Google
Sheets cliente e interno, publicados desde el modulo Monitoreo.

### Fly.io (mejor latencia, ~$5/mes si pasa el free tier)

1. `cp deploy/fly.toml.template fly.toml` y reemplazar `{{APP_NAME}}`.
2. `flyctl launch --no-deploy --copy-config`
3. `flyctl volumes create pulso_data --size 1 --region scl`
4. `flyctl deploy`
5. Preparar el `.pulso` con `api/scripts/publicacion_preparar.R` y subir ESE
   archivo al volume vía `flyctl ssh sftp`. El del proyecto no arranca.

## Endpoints expuestos en modo público

Whitelist en `api/R/forbid_mutations.R::PUBLIC_MODE_WHITELIST`. Cualquier
otro path → 403 `E_FORBIDDEN_PUBLIC`.

Si necesitas exponer un endpoint nuevo (ej. una descarga del dashboard),
agregalo a la whitelist y rebuildea.

## Privacidad

- URL pública pero `noindex,nofollow` → no aparece en buscadores.
- Para mayor restricción: Cloudflare Tunnel + Access (auth por email
  gratis hasta 50 usuarios). Documentar acá si lo activamos.
