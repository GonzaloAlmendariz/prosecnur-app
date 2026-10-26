# Revamp de Monitoreo y Meta B — cierre de jornada y pendientes

Tipo: Cierre de jornada
Estado: Vigente
Fecha: 2026-10-25
Autoridad: Gonzalo

Estado de `main` al cerrar: `83762c038` (sin push).

## Lo que quedó en `main` hoy (validado)

| Frente | Estado | Evidencia |
|---|---|---|
| Revisión visual Telefónico (rondas 1–4 + cierre de QA) | Cerrado | Re-QA independiente: todas las vistas rechazadas pasan (`final/re-qa.md`) |
| Revisión visual Acreditación (rondas 1–4 + cierre de QA) | Cerrado | Ídem |
| Revisión visual Territorial (rondas 1–4 + cierre de QA) | Cerrado | Ídem |
| Lector de hoja RMS por bloques Muestra \| Backup | Hecho | `bd915a3fd`, gate R 1683 |
| Rondas de supervisión (motor + UI) | Hecho | `e419d1e4a`, `02c5472b5` |
| Fix C5 Faltante por UMP (corte de avance tras mutación) | Hecho | `4c5d283d2`, test rojo → verde |
| Barras vacías de Acreditación › Por cuota (C5) | Hecho | paleta `--cuota-*` en el detalle |
| Meta B L38: «Actualizar ▾» único en Tel, Acr y Ter, paso N de M, recibo | Hecho | `793f6c7c7`, `1cb009e41` |
| Meta B L38: un sync a la vez en el backend | Hecho | `cb9268b7e`, test 8 FAIL → 31 PASS |
| Meta B L20: insignia de Avance con su base; Home sin cifra vieja tras un sync | Hecho | `be9dbd429`, `ae81d72e8` |
| Meta B L23: warm start con transcurrido, restante aprendido, fases y skeleton | Hecho | `90b5a5236` |
| Meta B L10: readiness por pestaña (Tel, Acr, Ter, Cursos-horario) | Hecho | marcas por pestaña con test |
| Meta B L33 parte 1: chrome de sync común a Tel y Acr | Hecho | `beabeb8c3` |
| «Color de cada familia» como editor compacto común | Hecho | `e974a0d4d` |

Verificador independiente sobre `2a1b4ed52`: tsc 0; gate-front monitoreo 6066 y home 552; gate-area R 14297; warmup 376; agentic `--audit`/`--check` OK; NAMESPACE idéntico. Gates posteriores de cada fusión en verde (último: monitoreo 6098).

## Pendientes

### Sin terminar (no está en `main`)

- **M8 · Publicar con ensayo Revisar → Aplicar** (Salidas a Sheets de Tel, Acr y Ter). WIP sin gate en la rama `metab-publicar-ensayo` (`918db51b4`, worktree `.claude/worktrees/metab-publicar-ensayo`). Contrato completo en `docs/qa/revamp-monitoreo/plan-metab-publicar.md` y en este encargo: grano = pestañas propias completas; clave = primera columna si es única, si no multiconjunto con `sin_clave`; el ensayo es síncrono y de solo lectura; Aplicar usa `monitoreo_sheets_publish_dispatch` sin cambios; escenarios sin red 429 / timeout / 401 / respuesta parcial / pestaña inexistente / hoja que encoge. **No fusionar sin gate.**
- **L33 parte 2 · desduplicar Telefónico ↔ Acreditación.** 242 declaraciones idénticas movibles (~2,930 líneas por página) en lotes: (1) formato y rótulos, 75 declaraciones; (2) fuentes y canales, casos, teléfono, modelo, otros helpers; (3) componentes, uno por commit con captura. Rama `metab-l33-lote1` creada, sin trabajo. Scripts de medición: `scratchpad/l33a/dups.mjs` y `cierre.mjs`. Bajar líneas base en `agentic/manifest.json` al cerrar cada lote.

### Meta B que falta (auditoría: `scratchpad/auditoria-meta-b.md`)

- L26 kit `PulsoInput` / `PulsoSelect` / `PulsoField` (214 `<input>` y 102 `<select>` crudos en Monitoreo).
- L29 densidad y tipografía con tokens (0 usos de `--pulso-type-*`; 3,779 `font-size` literales).
- L37 movimiento: 162 ms literales y transiciones de layout.
- L25: avisos sueltos a toast (Acr conserva ~39 `<Alert>`).
- L19: sub-barras con `useState` sin dirección.
- L28: `PulsoTable` e inspector común.
- L22 guardado honesto: no medido.
- L30 paleta ⌘K (transversal, fuera de Monitoreo).
- L38 fila 13: `--danger` solo para lo destructivo (depende de D13).

### Decisiones de Gonzalo

- **D13**: carmesí de Monitoreo frente al rojo de peligro (`--pulso-danger-fg #991b1b` vs `#a0464e`).
- **P17**: la píldora de estado dice «Preparando» en reposo cuando hay cambios sin recalcular (antes «Pendiente»).
- **H-3**: `casos-ump` tarda 14–26 s en frío (`api/R/monitoreo_territorial_casos_ump.R:224-242`, `validation_summary` síncrono).
- **H-4**: «P514» conciliado con dos personas distintas en Territorial › Conciliación.
- **Dos definiciones**: Home «39 por revisar» frente a Control de Acreditación «23».

### Cursos-horario (fuera de hoy, por decisión de Gonzalo)

- Esqueleto Insumos · Modelo · Control · Avance y rediseño visual: esperan las preguntas §0 de `docs/qa/revamp-monitoreo/aulas.md`.
- «Actualizar» único (M1 fase 2b): antes hay que separar la re-publicación al Sheets de «Traer respuestas» (va en Publicar).
- Selector B/C al agendar (`RegistroDeCampo.tsx:471`).
- Ensayo en `/aulas/publicar-distribucion` y `/aulas/sync`.
- QA visual: la copia de `hsvg2026` no trae plan importado; hace falta un `.pulso` de referencia con plan.

### Residuos menores del re-QA

- Acreditación › Salidas: «Publicaciones» deja ~45 px al pie; «Casos por resolver» dice texto distinto a 1440 y 1024.
- Institucional › Personas: sangría desigual de los nombres.
- Territorial › Faltante a 1024: «Cubre» cortada (alcanzable con desplazamiento).
- Territorial › Salidas: «Base final del corte» encadena cifras con «·»; tarjeta de Sheets con aire al pie.
- Territorial › Ocurrencias › Distritos: la tarjeta de San Juan de Lurigancho descuadra filas por el nombre largo.
- Aviso «…; revisa estos casos…» se escribe en el motor (`api/R/monitoreo_acreditacion_cruce_escala.R:243`); el frontend lo recorta.
- `pollSourceSync.ts` de Territorial sigue duplicado del común.
- Reportes › UMP y Alertas de Territorial siguen en la vista heredada.

### Verificaciones que no se pudieron hacer aquí

- El paso N de M, la estimación del warm start y el dedupe de syncs corren en el worker de R: solo se prueban de punta a punta con el paquete instalado y el backend relanzado (no se corrió `R CMD INSTALL`).
- QA visual solo en macOS con Chromium; Windows sin verificar.
- Estabilidad del marco (C2) con distinta cardinalidad en el mismo viewport.
- La 0.9.5 no se preparó (Gonzalo: «aún hay varias cosas por cambiar»). Nada se publicó.
