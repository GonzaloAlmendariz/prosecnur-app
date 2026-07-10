---
name: ver-ui
description: Abre la UI profunda de Prosecnur en el preview de Claude en UN paso - deep-link de dev que salta el BootGate, abre un .pulso y aterriza en el módulo/pestaña exacto para observar, iterar con HMR y verificar. Usar SIEMPRE que haya que ver, verificar o iterar una vista que vive detrás de un proyecto abierto (monitoreo, analítica, gráficos, dashboard, calc-muestra, etc.).
---

# Ver UI profunda (deep-link de dev)

La app arranca en BootGate → elegir proyecto → clicks. Este skill salta todo eso: el frontend en dev soporta `?pulso=<ruta absoluta al .pulso>` (leído por `readDevProjectPath()` en `BootGate.tsx`, **solo en `import.meta.env.DEV`**) y la ruta profunda sobrevive al warm start. Verificado en vivo el 2026-07-10.

## Receta

1. **Backend**: si el puerto 8787 ya responde (`curl -s localhost:8787/api/system/health` o fetch vía proxy), reutilízalo — suele ser el proceso R del usuario, no lo mates. Si no, `preview_start` con "Backend (Plumber API)".
2. **Frontend**: `preview_start` con "Frontend (Vite dev server)" (puerto 5173, proxy `/api` → 8787).
3. **Proyecto**: el `.pulso` que indique el usuario; sin indicación, el de referencia: `api/inst/audit_reference/prosecnur_audit_reference.pulso`. Para estudios reales, el `.pulso` del cliente (sin copiarlo al repo).
4. **Navega en un paso** con `preview_eval`:
   ```js
   window.location.href = '/<ruta>?pulso=' + encodeURIComponent('<ruta absoluta al .pulso>')
   ```
   Rutas: `/monitoreo`, `/analitica`, `/graficos`, `/tablero`, `/calc-muestra` (acepta `?mesa=aulas`), `/bitacora` (acepta `?tab=cronograma`), `/carga`, `/validacion`, `/codificacion`, `/hojas-ruta`, `/editor-xlsform`.
5. **Espera el warm start** (~15–30 s la primera vez): sondea con `preview_eval` hasta que aparezca contenido del módulo (o `[data-audit-ready]` donde exista — no todos los perfiles lo exponen). No uses sleeps ciegos largos; sondea.
6. **Estado profundo**: las pestañas internas (ej. secciones de Monitoreo: Fuentes/Agenda/Avance/Validación/Consultas) NO se rutean por URL — usa `preview_snapshot` para ver la estructura y `preview_click` sobre el tab. `calc-muestra` y `bitacora` sí aceptan query params.
7. **Itera**: con la vista abierta, edita el código — **Vite HMR actualiza en vivo sin perder la sesión**. Si necesitas reload completo, recarga sin miedo: el parámetro se limpia tras el boot pero la sesión del backend conserva el proyecto y BootGate re-entra solo (`bootApiProjectStatus().has_project` → warm start automático).
8. **Evidencia**: cierra con `preview_screenshot` (y `preview_resize` para el viewport compacto 1024x600 si tocaste layout).

## Trampas

- `?pulso=` solo funciona en dev build; en producción/Electron no existe.
- Si el backend se reinició, el `sid` del browser muere (`E_NO_SESSION`) — la app se auto-recupera, pero el proyecto hay que re-abrirlo: vuelve a navegar con `?pulso=`.
- Vista con datos pesados (monitoreo territorial): el primer render puede tardar; el estado "Pendiente" en el header del módulo es normal hasta el primer refresh.
- Alternativa por script (sin preview tools): `node ~/.claude/skills/prosecnur-project-ui-check/scripts/open-pulso-session.mjs --project <ruta> --route /monitoreo` crea sesión + abre proyecto vía API y devuelve `route_url` + `session_id` (inyectable con `localStorage.setItem("pulso.sessionId", sid)`).
