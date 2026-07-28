---
name: ver-ui
description: Abre la UI profunda de Prosecnur en el preview de Claude en UN paso - deep-link de dev que salta el BootGate, abre un .pulso y aterriza en el módulo/pestaña exacto para observar, iterar con HMR y verificar. Usar SIEMPRE que haya que ver, verificar o iterar una vista que vive detrás de un proyecto abierto (monitoreo, analítica, gráficos, dashboard, calc-muestra, etc.).
---

# Ver UI profunda (deep-link de dev)

La app arranca en BootGate → elegir proyecto → clicks. Este skill salta todo eso: el frontend en dev soporta `?pulso=<ruta absoluta al .pulso>` (leído por `readDevProjectPath()` en `BootGate.tsx`, **solo en `import.meta.env.DEV`**) y la ruta profunda sobrevive al warm start. Verificado en vivo el 2026-07-10.

## Receta

1. **Backend**: si el puerto 8787 ya responde (`curl -s localhost:8787/api/system/health` o fetch vía proxy), reutilízalo — suele ser el proceso R del usuario, no lo mates. Si no, `preview_start` con "Backend (Plumber API)".
2. **Frontend**: `preview_start` con "Frontend (Vite dev server)" (puerto 5173, proxy `/api` → 8787).
3. **Proyecto**: el `.pulso` que indique el usuario. Sin indicación, elige según lo que necesites ver (ADR 0043):

   | Necesitas | Usa | Qué trae |
   |---|---|---|
   | Estado real de un módulo | `api/inst/reference_projects/<slug>/<slug>.pulso` | ver tabla abajo |
   | Algo mínimo y determinista | `api/inst/audit_reference/prosecnur_audit_reference.pulso` | semilla sintética |

   Los cuatro proyectos de referencia son **estudios reales anonimizados** y versionados. Elige por lo que aporta, no por su nombre:

   | slug | módulos | úsalo para |
   |---|---|---|
   | `acnur_acg` | 9 | el más completo: carga → validación → codificación → analítica → gráficos, hojas de ruta territorial |
   | `acnur_pdm` | 7 | repeat groups Kobo reales, filtro de universo, dashboard |
   | `acrconta` | 7 | acreditación multiactor (4 actores, 13 fuentes), Sheets, plan de trabajo |
   | `hsvg2026` | 2 | calc-muestra de aulas a escala real (29 mil estudiantes, 5.263 cursos-horario) |

   Son **read-only a propósito** (`0444`) y así están bien para observar: la app los abre sin problema y el permiso impide que un autosave los pise. Solo si vas a *modificar* el proyecto, saca una copia de corrida con
   `Rscript api/scripts/reference_project_prepare_run.R --project <slug>` (imprime un manifest con `project_path` ya escribible).

   Los `.pulso` de cliente sin anonimizar **no se copian al repo** ni se dejan en rutas versionadas.
4. **Navega en un paso** con la dirección canónica (ADR 0044). La jerarquía es
   **módulo → [modo] → sección → pestaña → panel**, y los cinco niveles viven
   en la URL:

   ```js
   window.location.href = '/monitoreo?modo=territorial&seccion=avance&pestana=ump&pulso=' + encodeURIComponent('<ruta absoluta al .pulso>')
   ```

   Params canónicos: `?modo=` `?seccion=` `?pestana=` `?panel=` `?foco=`.
   Los viejos (`tab`, `stage`, `mesa`, `desk`, `step`, `reporte`) todavía se
   leen, pero la app los reescribe a la forma canónica.

   Rutas: `/monitoreo`, `/analitica`, `/graficos`, `/tablero`, `/calc-muestra`,
   `/bitacora`, `/carga`, `/validacion`, `/codificacion`, `/hojas-ruta`,
   `/editor-xlsform`.

   El `?pulso=` se consume al abrir el proyecto; **el resto de la dirección
   sobrevive al warm start** y aterrizas donde pediste.
5. **Espera el warm start** (~15–30 s la primera vez; con proyectos de
   referencia puede pasar el minuto). Sondea `window.__pulsoNav.listo()`, que
   distingue los tres casos que importan:

   | `motivo` | qué significa | qué hacer |
   |---|---|---|
   | `warm-start` | la pantalla de progreso sigue arriba | seguir sondeando |
   | `sin-marca-de-readiness` | la vista no declara `data-audit-ready` | no va a virar sola: reportar y seguir |
   | `marca-en-false` | la vista dice explícitamente que no está lista | seguir sondeando |

   No uses sleeps ciegos.

   **Con proyectos de referencia esto no es opcional, es la trampa principal.** Traen datos de verdad, así que el warm start tarda de verdad, y una captura temprana muestra una vista que parece rota sin estarlo. Medido el 2026-07-24 sobre `acrconta` en `/monitoreo`:

   | | captura temprana | tras el warm start |
   |---|---|---|
   | Fuentes | `0/0` | `13/13` |
   | Registros | `0` | `1.277` |
   | Sync | `Pendiente` | `Listo` |

   Antes de juzgar una vista como vacía, confirma que el header del módulo dejó de decir `Pendiente`/`Preparando` y que los contadores dejaron de ser cero. Si ves la pantalla de progreso con el anillo de porcentaje, todavía estás en warm start: sigue sondeando.
6. **Estado profundo**: ya no hace falta clickear. Todo nivel se pide por URL,
   y la app expone su navegación en `window.__pulsoNav` (dev y QA visual):

   ```js
   window.__pulsoNav.manifiesto           // TODAS las vistas direccionables
   window.__pulsoNav.ir("monitoreo/territorial/avance")  // navega sin recargar
   window.__pulsoNav.describir()          // dónde estoy ahora
   window.__pulsoNav.hijos()              // qué cuelga de aquí
   window.__pulsoNav.listo()              // readiness real, no un sleep
   window.__pulsoNav.paneles()            // overlays declarados vs montados
   window.__pulsoNav.pestanasDeLaSeccion() // catálogo runtime de la sección actual
   ```

   `ir()` conserva el proyecto abierto: saltar entre vistas no vuelve a pagar
   el warm start. Los runners lo consumen con `--ir <clave>`.

   **Clickear por nombre es el fallback frágil**, no el método: depende del
   texto visible, que cambia, se trunca en viewport compacto y no existe hasta
   que termina el warm start.
7. **Itera solo si eres implementador**: con la vista abierta, el owner `frontend-react` puede editar sus globs y aprovechar HMR. Si invoca este skill `qa-visual-desktop` o `verificador`, permanece read-only y limita cualquier evidencia a rutas temporales fuera del árbol versionado.
8. **Evidencia**: cierra con `preview_screenshot` (y `preview_resize` para el viewport compacto 1024x600 si tocaste layout).

## Higiene de servers (obligatoria)

Historial del repo: sesiones que abren previews y no los cierran → 5+ servers simultáneos con la mayoría huérfanos.

- **Antes de levantar nada**: `preview_list` — si ya hay un frontend corriendo en esta sesión, reúsalo. Para el backend, si el 8787 responde (`curl -s localhost:8787/api/system/health`), es el proceso del usuario: reúsalo y NUNCA lo mates.
- **Al terminar la tarea**: si TÚ levantaste el server y el usuario no está iterando activamente sobre la vista, ciérralo con `preview_stop`. Si el usuario sigue mirando, déjalo y dilo explícitamente en el cierre ("dejé el preview corriendo en :5173").
- **Si sospechas huérfanos** (de sesiones anteriores): `make dev-status` lista todos los servers dev con edad y conexiones; `make dev-prune` mata los huérfanos (vites sin puerto de preview) y los stale (>24 h sin conexiones). El prune jamás toca el backend R del 8787.

## Trampas

- **Contaminación de navegación en barridos multi-celda.** Medido en un barrido
  de 21 secciones: el segundo viewport heredaba la última pestaña visitada y el
  lote entero hubo que descartarlo. Si recorres más de una celda: precalienta la
  sección para que monte su catálogo antes de enumerar, exige
  `actual === expectedActual` **en cada captura** (no solo al final) y elimina
  resúmenes residuales antes de reintentar. Una dirección que "resolvió" no
  prueba que la superficie montó: compara la marca de readiness real, no la ruta.
- El catálogo de pestañas **no** es estático: lo publica la vista montada en
  runtime. Enumera con `window.__pulsoNav.pestanasDeLaSeccion()`, nunca desde una
  matriz histórica — duplicar ese catálogo ya produjo una copia desincronizada.
- `?pulso=` solo funciona en dev build; en producción/Electron no existe.
- Si el backend se reinició, el `sid` del browser muere (`E_NO_SESSION`) — la app se auto-recupera, pero el proyecto hay que re-abrirlo: vuelve a navegar con `?pulso=`.
- Vista con datos pesados (monitoreo territorial): el primer render puede tardar; el estado "Pendiente" en el header del módulo es normal hasta el primer refresh.
- Alternativa por script (sin preview tools): `node ~/.claude/skills/prosecnur-project-ui-check/scripts/open-pulso-session.mjs --project <ruta> --route /monitoreo` crea sesión + abre proyecto vía API y devuelve `route_url` + `session_id` (inyectable con `localStorage.setItem("pulso.sessionId", sid)`).
