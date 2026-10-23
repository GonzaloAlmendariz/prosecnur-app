# Aviso: el runner de capturas reinstaló `prosecnurapp` desde la rama del revamp

Tipo: Incidente operativo
Estado: En curso
Situación: Abierto hasta que Gonzalo lo dé por visto
Fecha: 2026-10-23
Autoridad: Gonzalo (pedido de sesión)

## Qué pasó

En la primera corrida de capturas de T1 (`scripts/ui-quick-check.mjs` con `--project`, desde el worktree
`.claude/worktrees/revamp-monitoreo-telefonico`), el backend se arranca con `launcher/launch.R`. Ese launcher trae una
guarda para los jobs `callr`: si la fuente `api/R/` es más nueva que el paquete instalado, lo reinstala desde la fuente
(`utils::install.packages(api_dir, repos = NULL, type = "source")`). La rama tenía el commit de backend `c797a1a0e`
(`monitoreo_telefonico_cola.R`), más nuevo que lo instalado, así que la guarda reinstaló el paquete **desde el
worktree** en la librería compartida.

Esto equivale al `R CMD INSTALL` que la sesión tenía prohibido. No se pidió: lo hizo el launcher al arrancar el runner.
El log lo deja escrito (`scratchpad/impl/t1/logs/api.log`):

```
[prosecnur-app] Paquete instalado desactualizado vs fuente — reinstalando para que los jobs callr corran código actual...
[prosecnur-app] prosecnurapp reinstalado desde fuente.
```

## Cuándo

2026-10-23, 01:34 (hora de Lima). Es la fecha de `DESCRIPTION` del paquete instalado: `2026-10-23 01:34:31 -05`.

## En qué estado quedó

- La instalación terminó bien. `prosecnurapp` 0.9.3 está en
  `~/Library/R/arm64/4.5/library/prosecnurapp`, carga y no quedó `00LOCK-api`.
- Su código es el de la rama `revamp-monitoreo-telefonico` a esa hora: `main` en `7a301695b` más el bloque
  `cola_insistencia`. Desde entonces la rama no tocó `api/`.
- Los jobs `callr` de cualquier backend que use esa librería (incluido el del usuario en 8787) corren ese código hasta
  la próxima reinstalación. El bloque nuevo sólo agrega `cola_insistencia` y `cola_insistencia_responsables` al reporte
  telefónico; no cambia otros bloques.
- Si `main` recibió commits en `api/R/` después de `7a301695b`, sus jobs `callr` usan, hasta que se reinstale, una
  versión que no tiene esos cambios.
- Las corridas siguientes del runner no volvieron a reinstalar: lo instalado ya era más nuevo que la fuente.

## Cómo volver

1. Que nadie más esté instalando: `pgrep -f "R CMD INSTALL"` vacío y sin `00LOCK-api` en la librería
   (`Rscript -e 'cat(.libPaths()[1])'`).
2. Desde el checkout de `main`, tocar la fuente para que quede más nueva que lo instalado (`touch api/DESCRIPTION`) y
   arrancar el backend con su launcher (`make dev-api`); la misma guarda reinstala desde `main`. También sirve
   `R CMD INSTALL --no-docs --no-multiarch --library="$(Rscript -e 'cat(.libPaths()[1])')" api` desde `main`.
3. No interrumpirla: tarda varios minutos por `inst/`, y una instalación cortada deja la librería vacía.

## Para que no se repita

Antes de correr el runner desde un worktree con cambios en `api/R/`, contar con que el launcher va a reinstalar.
Hacerlo a propósito, cuando nadie más esté usando la librería, o correr el runner sobre la librería de `main`.
