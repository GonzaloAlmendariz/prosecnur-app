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

### Paneles y foco: van en `--route`, no en `--ir`

`--ir` sólo acepta claves del manifiesto, que llegan hasta la pestaña
(`procesamiento/graficos/laminas`). Los paneles no son nodos: su clave sería
`procesamiento/graficos/laminas#guias` y `ir()` no la resuelve, por eso
`--ir procesamiento/graficos/laminas/guias` responde que la dirección no existe.
Panel y foco se piden en la query de `--route`, con el pathname de la sección:

```bash
node scripts/ui-quick-check.mjs \
  --project /ruta/copia.pulso \
  --route "/graficos?pestana=laminas&foco=s-equiv-10&panel=guias" \
  --post-click-wait-selector ".pulso-f6-guias-panel" \
  --require-geometry --fail-on-issues
```

Los ids de panel válidos son los de `PANELES_POR_MODULO` en
`frontend/src/lib/navegacion/manifiesto.ts`; `window.__pulsoNav.paneles()`
lista los declarados y los montados.

**No uses `/procesamiento?seccion=…`.** `/procesamiento` es la vista "Estado
del estudio" (readiness `procesamiento-estado`) y no lee la query: la corrida
mide esa pantalla y no la sección pedida. Cada sección se pide por su pathname
(`/carga`, `/validacion`, `/codificacion`, `/analitica`, `/graficos`). El runner
avisa `ruta desviada` con la readiness final, y un `--post-click-wait-selector`
que nunca aparece cuenta en `postClickWaitSelectorMisses` y deja `ok=false`.
Pasa siempre ese selector cuando vengas a ver un panel: es lo único que prueba
que se abrió.

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

## 7. Trampas de medición del QA visual

Cada una costó al menos un ciclo. Vivían en `CLAUDE.md`; su sitio es este skill.

- **El tope por defecto son 30 s y no alcanza para Monitoreo**: su warm start
  con proyecto real tarda 4–6 min, así que el runner se rinde en
  `marca-en-false` antes de capturar nada. Pásale `--timeout-ms 420000` (o
  `UI_QA_TIMEOUT_MS`). Ese motivo ahí no significa "la vista está rota",
  significa "no le diste tiempo": son acciones opuestas y distinguirlas costó
  un ciclo entero el 2026-09-12.
- **Sin `--post-click-wait-selector ".js-plotly-plot"`, todo panel con gráfico
  sale VACÍO**: la readiness dice que la vista montó, no que Plotly pintó. Una
  matriz capturada sin ese flag no sirve para juzgar gráficos, y el gate la da
  por buena —un panel de 250 px en blanco no es recorte, ni derrame, ni
  desborde—. (`--wait-selector` no vale: se evalúa antes.)
- **`overflow-x` sobre un `<td>` con `colSpan` en una tabla `table-layout:
  fixed` es FALSO POSITIVO**: la caja de esa celda mide lo que suman sus
  columnas y el contenido se pinta sobre el ancho real, sin recorte. Mira la
  captura antes de tocar CSS —11 "desbordes" de Avance > Metas resultaron ser
  texto que se lee entero—.
- **Comprueba que las capturas son DISTINTAS antes de darlas por mediciones
  distintas**: `md5 -q out/*.png | sort -u | wc -l`. Una `?seccion=` que no
  existe en ese perfil **no falla**: aterriza muda en la sección por defecto, y
  el gate mide y aprueba la misma pantalla N veces. Pasó el 2026-09-12 con 5
  "vistas" de acreditación que eran un solo archivo byte a byte.
- **`desplazamientoH=N` en el resumen** dice cuántos contenedores esconden
  contenido a la derecha, y el informe trae el selector y los píxeles. No
  falla el gate —desplazarse en horizontal es legítimo—, pero un `0` ahí es
  lo único que permite afirmar que no se está perdiendo una columna.
- **Las corridas NO se paralelizan** —y sus TESTS tampoco: correr
  `node --test scripts/tests/*.test.mjs` con una captura en background fabrica
  rojos por contención (4 tests caídos, los 4 verdes aislados).** Dos a la vez se pisan en el puerto de la
  API y la segunda muere con "/api/system/bootstrap no devolvió sid". Van en
  serie; varias `--route` dentro de UNA corrida sí comparten la pila.
- **`--ir` encadena y captura SÓLO el final.** Varias vistas en una sola pila
  se piden con varios `--route` y query (`--route "/monitoreo?seccion=modelo"`),
  que es para lo que existe la regla de que toda vista sea enlazable; así se
  paga un warm start en vez de uno por vista.
