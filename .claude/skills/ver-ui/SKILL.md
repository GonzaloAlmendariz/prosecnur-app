---
name: ver-ui
description: Abre y verifica una vista profunda de Prosecnur con un proyecto .pulso, dirección canónica y herramientas locales del repo. Usar siempre que una UI detrás de proyecto deba observarse, iterarse o auditarse.
---

# Ver UI profunda

La ruta local de inspección usa un proyecto abierto, el deep-link de desarrollo
y el puente `window.__pulsoNav`. No requiere scripts fuera del repositorio.

## 1. Elige proyecto

Si el usuario no indica uno, selecciona por cobertura:

| Proyecto | Cobertura principal |
|---|---|
| `acnur_acg` | pipeline completo, gráficos y territorio |
| `acnur_pdm` | repeats, universo y dashboard |
| `acrconta` | acreditación multiactor, Sheets y plan |
| `hsvg2026` | cálculo de muestra de cursos-horario a escala |

Los proyectos reales anonimizados viven en
`api/inst/reference_projects/<slug>/<slug>.pulso`. Verifica cobertura/PII con
`make reference-project-verify`. Para interacción o mutación usa siempre la
copia temporal que prepara:

```bash
make reference-project-run REFERENCE_PROJECT=<slug>
```

Para un estado mínimo sintético y determinista, usa
`api/inst/audit_reference/prosecnur_audit_reference.pulso` y prepara su copia
con:

```bash
make audit-reference-run
```

Para un proyecto dado por el usuario, arranca la pila local con:

```bash
make dev-pulso PULSO=/ruta/absoluta/proyecto.pulso
```

No copies estudios sin anonimizar al repo ni edites un fixture canónico.

## 2. Navega por dirección

La gramática v3 es:

```
módulo → modo → sección → pestaña → panel
```

El módulo vive en el pathname; los demás niveles usan `modo`, `seccion`,
`pestana` y `panel`. `foco` puede señalar una entidad dentro de la vista. Los
aliases heredados sólo se leen para compatibilidad y no se generan.

Ejemplo:

```js
window.location.href =
  "/monitoreo?modo=territorial&seccion=avance&pestana=ump&pulso=" +
  encodeURIComponent("/ruta/absoluta/proyecto.pulso");
```

`pulso` sólo funciona en desarrollo y se consume al abrir el proyecto. La
dirección restante sobrevive al warm start. Las rutas principales se consultan
en `frontend/src/lib/modules.ts`; no mantengas una segunda matriz manual.

## 3. Espera readiness real

Controla la pestaña con el Browser integrado y sondea:

```js
window.__pulsoNav.listo()
```

- `warm-start`: sigue esperando;
- `marca-en-false`: la vista aún declara trabajo pendiente;
- `sin-marca-de-readiness`: reporta una laguna de contrato; un sleep no la
  vuelve válida.

No juzgues una vista mientras el header siga en `Pendiente`/`Preparando`, los
contadores estén en cero o la pantalla de progreso siga montada. Los proyectos
reales pueden tardar más de un minuto.

## 4. Recorre sin clicks frágiles

```js
window.__pulsoNav.manifiesto
window.__pulsoNav.ir("monitoreo/territorial/avance")
window.__pulsoNav.describir()
window.__pulsoNav.hijos()
window.__pulsoNav.paneles()
window.__pulsoNav.pestanasDeLaSeccion()
```

`ir()` conserva el proyecto y evita pagar otro warm start. Enumera pestañas
desde el runtime después de montar la sección. Clickear por texto es sólo un
fallback: puede truncarse, cambiar o no existir durante hidratación.

En barridos, exige que la dirección observada coincida con la esperada antes de
cada captura. No reutilices una pestaña residual del viewport anterior.

## 5. Evidencia reproducible

Para una inspección automatizada puntual:

```bash
node scripts/ui-quick-check.mjs \
  --project /ruta/copia.pulso \
  --route /monitoreo \
  --ir monitoreo/territorial/avance \
  --viewport 1440x1000 \
  --viewport 1024x600 \
  --require-geometry \
  --fail-on-issues
```

Para matriz por estudio:

```bash
make reference-project-visual-matrix REFERENCE_PROJECT=<slug>
```

Guarda evidencia en la ruta temporal reportada por el runner. Registra proyecto,
URL/dirección final, readiness, viewport, screenshot y errores de
página/API/recursos. Quien actúe como QA o gate permanece read-only; sólo el
owner de implementación aprovecha HMR para editar sus globs.

## 6. Higiene

- Antes de levantar procesos usa `make dev-status`; reutiliza la pila de la
  sesión y nunca mates el backend del usuario.
- Detén sólo los procesos que tú iniciaste. `make dev-prune` se reserva para
  huérfanos identificados, no para una sesión activa.
- Si el backend reinicia y el `sid` expira, vuelve a abrir con `pulso`; no
  inyectes una sesión inventada.
- Cierra informando si dejaste una pila local activa y en qué puertos.
