# Plan M4 de Meta B: warm start con tiempo (L23)

Tipo: Plan de implementación
Estado: Vigente
Fecha: 2026-10-25
Autoridad: Gonzalo: «La auditoría de la Meta B es algo que todos los monitoreos deben tener»

Fuente: auditoría de Meta B, fila 8 y brecha 4. Maqueta:
`docs/qa/maqueta-remasterizacion-2026-10-10/maqueta/m/L23-warmstart.html`.
El warm start es intencional: se mantiene y se explica mejor.

## Checklist

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Tiempo transcurrido visible mientras dura el arranque | `app/WarmupReloj.tsx` (BootGate y ModuleWarmupBoundary) | hecho |
| 2 | Tiempo restante aprendido de la apertura anterior, sin inventar sin dato | R: `api/R/project_warmup_duraciones.R`; front: `app/warmupTiempo.ts` | hecho en BootGate; en el boundary sólo transcurrido (ver decisión D3) |
| 3 | Fases con su duración, sin prosa | `BootGate.tsx` (`warmupStepDetail`) y `ModuleWarmupBoundary.tsx` (lista de fases) | hecho |
| 4 | Skeleton de la vista destino detrás del indicador | `components/VistaSkeleton.tsx` | hecho |
| 5 | Copy con rótulos cortos, sin «·» ni explicaciones | ambos archivos | hecho |

## Decisiones

**D1. Dónde se guarda la duración.** En `s$warmup_duraciones`, un campo más del
estado de sesión: `aperturas` (total por juego de módulos pedido) y `tareas`
(última duración de cada fase que terminó en `ready` o `skipped`). Lo anota
`.project_warmup_on_complete()` en el proceso del backend, sin marcar
`project_dirty`. No es un cache derivable (una duración medida no se recalcula
desde los inputs), así que `.pulso_strip_caches()` no lo toca y viaja en
`state.rds` en el próximo guardado explícito.

No toca el contrato del `.pulso`: el manifest, el formato y la migración no
cambian. Es un campo aditivo y opcional; un `.pulso` sin él publica «sin
estimación» y una versión anterior de la app lo carga sin usarlo. Si no se
guarda tras abrir, la estimación vive sólo en esa sesión.

**D2. Qué se publica.** `POST /api/project/warmup` devuelve además
`ultima_apertura` (`{elapsed_ms, at}` o `null`) y `tareas_ms`.
`GET /api/project/warmup-plan` devuelve lo mismo en `estimacion`. La clave es
el juego de tareas ordenado: la apertura completa y el warmup de un módulo no
se estiman entre sí. La estimación es el `elapsed_ms` del job de backend, que
es lo que gobierna la espera de BootGate. No incluye el arranque del worker
`callr` ni los módulos de interfaz que se calientan después (unos segundos).

**D3. El boundary de módulo no muestra restante.** `ModuleWarmupBoundary` no
espera al job de backend: hace una sola consulta de estado
(`waitForWarmupJob`) y libera cuando cargan los módulos de interfaz. La
duración del job no es su espera, y usarla prometería un restante falso. Por
eso el boundary muestra sólo el transcurrido y sus fases. Cambiar esa espera
queda fuera de M4 (ver pendientes).

**D4. Fases.** Una fase terminada muestra lo que tomó (`0:31`) y una en curso
lo que lleva (`0:17`). Los rótulos de estado («En espera», «No aplica a este
proyecto», «Continuará al entrar») se conservan. Se quitó
`friendlyWarmupDetail`, que agregaba una frase explicativa bajo el titular, y
el detalle «3 de 14 pasos · 45 %». El anillo de avance de BootGate se
conserva.

**D5. Skeleton.** `VistaSkeleton` tiene dos variantes: `modulo` (barra de
secciones con tantas píldoras como secciones declara el módulo, cifras y dos
paneles) e `inicio` (la grilla del Home). BootGate elige según la ruta del
enlace (`/monitoreo?pulso=…` lleva a `modulo` con el tono de Monitoreo; abrir
un proyecto lleva al Home). Es `aria-hidden` y no publica `data-audit-ready`,
porque no es la vista. Sólo usa tokens que `boot.css` replica, porque también
se pinta desde el chunk de arranque.

**D6. Accesibilidad.** El reloj y la lista de fases llevan `aria-live="off"`
dentro del `role="status"`: un cronómetro anunciado cada segundo sería ruido.
El titular sí se anuncia. Las animaciones de brillo y giro se apagan con
`prefers-reduced-motion`.

**D7. CSS.** `theme.css` está congelado a crecimiento: sólo pierde las reglas
muertas de la barra de porcentaje. Lo nuevo va en `app/module-warmup.css`,
`app/warmup-reloj.css` y `components/vista-skeleton.css`.

## Archivos fuera del glob inicial

- `frontend/src/app/warmupTiempo.ts` y su test: la lógica pura del reloj.
- `frontend/src/app/WarmupReloj.tsx` y `warmup-reloj.css`: el reloj, que comparten BootGate y el boundary.
- `frontend/src/app/module-warmup.css`: los estilos nuevos del boundary (theme.css congelado).
- `frontend/src/api/bootClient.ts`: dos tipos opcionales (`estimacion`, `BootWarmupStart`).
- `api/R/project_warmup_duraciones.R`: los helpers de R, en archivo propio.

## Pendientes

- Las fases de backend que todavía esperan no muestran su duración prevista
  (`~0:40`). El progreso del job publica el nombre del módulo y no el id de la
  tarea, y el orden real cambia cuando corre el bloque territorial en paralelo.
  `tareas_ms` ya se publica; falta que el progreso de R lleve el id de la tarea.
- El boundary de módulo no espera al job de backend (D3). Si se decide que
  espere, puede usar la misma estimación.
- La maqueta propone «Avisarme al terminar» y «Volver al inicio» durante el
  warm start. No entran en M4: la función de aviso depende del sistema de
  toasts que hoy Monitoreo no tiene (brecha 3).

## Verificación

- `pnpm -C frontend typecheck`: limpio.
- `vitest run src/app`: 18 archivos, 603 pruebas, todas verdes.
- `make gate-front` (sólo transversales): 7 archivos, 503 pruebas, todas verdes.
- `make gate-area AREA=warmup GATE_ARGS='--patron "warmup|bootstrap"'`: 261 pass, 0 fail.
- Capturas con `pdm.pulso` (telefónico, `/monitoreo?pulso=…`), API propia en
  8796 con librería de R aparte (para no reinstalar `prosecnurapp` en la
  compartida):
  - antes, a 1440x1000, a los 20 s y 60 s: porcentaje, frase explicativa y
    «8 de 11 pasos · 62%».
  - después, primera apertura: transcurrido y fases con duración, sin
    restante. Se guardó el proyecto.
  - después, segunda apertura: «Transcurrido 0:18», «Restante ~0:33». A
    1024x600 el indicador pasa a dos columnas y el skeleton se ve detrás.
  - con este proyecto el warm start dura unos 50 a 70 s. Por eso la captura de
    los 60 s de la segunda apertura ya muestra la vista.
