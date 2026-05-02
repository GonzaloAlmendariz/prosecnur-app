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
│   /data/proyecto.pulso  ← bootstrap (volume / committed) │
│   :7860                  ← Plumber + frontend            │
└──────────────────────────────────────────────────────────┘
```

- **Modo público**: el frontend se buildea con `VITE_PULSO_PUBLIC_MODE=true`
  → oculta admin bar y agrega `noindex,nofollow`. El backend activa
  `PULSO_PUBLIC_MODE=1` → middleware whitelist deja pasar solo endpoints
  read-only del dashboard (ver `api/R/forbid_mutations.R`).
- **Bootstrap obligatorio**: `launch_server.R` falla rápido si no encuentra
  un `.pulso` en `PULSO_BOOTSTRAP_PROJECT` (default `/data/proyecto.pulso`).

## Targets

### Hugging Face Spaces (gratis, primera opción)

1. Crear Space en [hf.co/spaces](https://huggingface.co/spaces) — SDK
   = Docker, visibility = Public.
2. Renderizar `hf-space-README.md.template` con los valores reales y
   commitearlo como `README.md` en la raíz del Space.
3. Subir vía `huggingface_hub` API o git push:
   - `Dockerfile` (raíz)
   - `api/`, `frontend/`, `launcher/`, `tsconfig.json` (todo el repo
     menos lo del `.dockerignore`)
   - `data/proyecto.pulso` (el dump del proyecto a publicar)
4. HF buildea el Dockerfile (~10-15 min primera vez, ~2 min cached).

### Fly.io (mejor latencia, ~$5/mes si pasa el free tier)

1. `cp deploy/fly.toml.template fly.toml` y reemplazar `{{APP_NAME}}`.
2. `flyctl launch --no-deploy --copy-config`
3. `flyctl volumes create pulso_data --size 1 --region scl`
4. `flyctl deploy`
5. Subir el `.pulso` al volume vía `flyctl ssh sftp`.

## Endpoints expuestos en modo público

Whitelist en `api/R/forbid_mutations.R::PUBLIC_MODE_WHITELIST`. Cualquier
otro path → 403 `E_FORBIDDEN_PUBLIC`.

Si necesitas exponer un endpoint nuevo (ej. una descarga del dashboard),
agregalo a la whitelist y rebuildea.

## Privacidad

- URL pública pero `noindex,nofollow` → no aparece en buscadores.
- Para mayor restricción: Cloudflare Tunnel + Access (auth por email
  gratis hasta 50 usuarios). Documentar acá si lo activamos.
