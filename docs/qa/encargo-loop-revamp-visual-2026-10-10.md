# Meta B — Revamp visual: la remasterización completa de la UI (encargo del loop)

Tipo: Encargo de loop indefinido
Estado: Vigente
Fecha: 2026-10-10
Autoridad: pedidos textuales de Gonzalo en la sesión local «Evaluación completa de UI» (2026-10-10) y el plan de traspaso en tres sesiones; el GOAL, el plan de trabajo y el maestro de la remasterización son los documentos rectores
Situación: traspaso a sesión en la nube; no ha empezado a construirse

## Meta B: vara, alcance y orden (léelo antes que el resto)

Esta es la segunda de las dos metas a largo plazo que fijó Gonzalo el 2026-10-10 (ver
[plan-traspaso-tres-sesiones-2026-10-10.md](plan-traspaso-tres-sesiones-2026-10-10.md)). **No empieza hasta que la Fase 0
deje Quality en verde** ([goal-ci-calidad-2026-10-10.md](goal-ci-calidad-2026-10-10.md)). Trabaja en la rama
`meta-b-revamp` y entra a `main` por PR con Quality verde en el SHA del PR. Es dueña del kit compartido
(`frontend/src/components/**`, `frontend/src/app/theme.css`, `tokens.css`, `branding/`) y de todo `frontend/src/features/**`
**salvo** `features/graficos/**`, que es de la Meta A.

**Documentos rectores, en este orden:**

1. [goal-modernizacion-ui-2026-10-10.md](goal-modernizacion-ui-2026-10-10.md): el GOAL. Vara V1–V13, cola L1–L38 en
   seis oleadas, «Espera al dueño» D1–D13, ledger, trampas y bitácora. **Se redibuja entero en cada vuelta.**
2. [plan-trabajo-remasterizacion-ui-2026-10-10.md](plan-trabajo-remasterizacion-ui-2026-10-10.md): siete vueltas
   (0 kit → 1 Carga → 2 conformidad → 3 chrome → 4 cifras → 5 datos → 6 shell), 38 unidades, 82 sesiones, dependencias y
   gates.
3. [remasterizacion-ui-2026-10-10.md](remasterizacion-ui-2026-10-10.md): el maestro, con vocabulario, decisiones, el kit
   pieza por pieza, la tabla de maquetas y las 38 unidades una por una.
4. Los censos que miden el «hoy»: [censo-ui-2026-10-10.md](censo-ui-2026-10-10.md) (toda la app, 133 celdas visuales),
   [censo-animaciones-2026-10-10.md](censo-animaciones-2026-10-10.md) (L37, sistema de movimiento) y
   [censo-acciones-datos-monitoreo-2026-10-10.md](censo-acciones-datos-monitoreo-2026-10-10.md) (L38, un verbo por
   dirección).
5. La maqueta de 29 páginas en `maqueta-remasterizacion-2026-10-10/`: es la vara visual de cada unidad. Nada se construye
   sin mirar antes su página; si la página no existe o no cubre el caso, se hace la página primero.

**Vara de cierre:** las seis oleadas del GOAL cerradas con verificador independiente, el ledger del GOAL por debajo de su
vara en todos los números, las 29 páginas de la maqueta reproducidas en la app con proyecto real y captura, y las
decisiones D1–D13 resueltas por Gonzalo o anotadas como descartadas. Solo Gonzalo da la meta por terminada.

**Tablero de la meta (dibújalo entero cada vez):**

| # | Unidad | Estado |
|---|---|---|
| B0 | Leer los rectores y la maqueta entera (índice, 29 páginas), levantar el server de la maqueta y regenerar las capturas «después»; abrir la rama `meta-b-revamp`; anotar en el GOAL las D1–D13 que sigan sin respuesta | ☐ primero |
| B1 | Vuelta 0 — fundaciones del kit (9 sesiones): L26/L27 primero (`PulsoSwitch` maestro y chica, `PulsoInput`, `PulsoSelect`, `PulsoField`, reglas de botón; páginas L26 y L27), L1 (`Dialog`/`Sideover` sobre Radix con `usePanelDireccionable`; página L01), L14 (`TabHeading` compartido en toda página con rail; página L14), L24 (`Skeleton` con la silueta de la vista destino; páginas L04 y L23), L2 (los ~50 overlays declarados en `PANELES_POR_MODULO`), L35 (el dock que se escapa del borde) | ☐ |
| B2 | Vuelta 1 — Carga, lo que abre ventanas (16 sesiones): L2–L13, el flujo de SurveyMonkey/Kobo/archivo con el diálogo canónico, skeleton, job y recibo; es la deuda que Gonzalo señaló primero («no es tan fluido y tiene muchos meses de atraso») | ☐ |
| B3 | Vuelta 2 — verde por conformidad (7 sesiones): readiness por vista, vacíos clasificados, `ui-quick-check` que no aprueba por ausencia | ☐ |
| B4 | Vuelta 3 — un solo chrome en los ocho módulos (22 sesiones): L14–L20, L36 (Formularios › Documento, editor fiel del cuestionario en Word, fases DOC.0–DOC.5) y L38 (Monitoreo: un verbo por dirección) | ☐ |
| B5 | Vuelta 4 — cifras honestas y feedback (7 sesiones): L20–L23 y L25 (`<Alert>` de resultado → `toast()` con acción) | ☐ |
| B6 | Vuelta 5 — datos y densidad (12 sesiones): L27 (kit de inputs en configuración, Cálculo y Carga), L28 (`PulsoTable` e inspector), L29 (densidad y tipografía) y el resto de la vuelta | ☐ |
| B7 | Vuelta 6 — lo que se nota sin abrir un módulo (9 sesiones): L30 paleta ⌘K, L31 Home vivo, L32 materiales, L37 sistema de movimiento (22 coreografías, contrato de movimiento), L33 desduplicar Telefónico ↔ Acreditación (D8) | ☐ |
| B8 | Decisiones de Gonzalo: D1–D13 del GOAL (entre ellas D6 tema oscuro **descartado**, D9 si Actualizar en aulas sigue publicando, D10 reabrir cierre, D13 carmesí de Monitoreo frente al rojo de peligro) | ⛔ |
| B9 | Pedidos a A y adopción de A: L17 (`GraficosPage.tsx` con `PageFrame`, sin `toolbar=`) se entrega a A; los tokens de movimiento de L37 se congelan y A migra `laminas/movimiento.css`; los primitivos que A pida se construyen aquí | ☐ |

## Decisiones ya tomadas que no se reabren

- **Sin tema oscuro.** Gonzalo, textual: «no vamos a hacer darkmode, eso está descartado». D6 queda cerrada; la página
  `_descartado-D06-tema-oscuro.html` existe solo como registro.
- **Todo booleano es un switch**, nunca checkbox («a veces siento que no te decides por uno u otro»). Radios solo para
  elección excluyente; segmented para 2–4 opciones.
- **Botones**: el de ícono lleva caja al reposo y rojo solo al pasar sobre un «quitar»; el de texto no se subraya y gana
  caja al pasar; una acción de navegación nombra el destino con `arrow-right`, nunca «Ir →».
- **Formularios tiene dos secciones**, Editor (plataforma) y Documento (edición en Word con officer, «una versión
  avanzada, elegante y sofisticada, no superficial», con la arquitectura del editor de láminas F6).
- **El dock no se escapa del borde** (L35): es un bug real, no una preferencia.
- **Diseñar en grande por defecto**: el mínimo literal decepciona; cada unidad se entrega al nivel de su página de maqueta.

## Traspaso a la nube (léelo primero)

- Gonzalo, textual (2026-10-10): «Lleva todo esto a GitHub para que una sesión tome el control ahora que has dejado todo
  registrado con sumo detalle».
- Copia de este encargo en la sesión: si tu harness tiene scratchpad, crea ahí tu `ENCARGO_LOOP.md` a partir de este
  archivo y reescríbelo cada turno (skill `/preparar-loop-indefinido`). Este archivo versionado se actualiza al cerrar cada
  vuelta.
- Reloj: `sleep 180` con run_in_background, description «TICK DEL LOOP REVAMP — retoma <ruta del encargo>». La cadencia
  de 180 s es la que fijó Gonzalo para el loop F6; si para esta meta pide otra, se reescribe aquí. Un solo TICK.
- La maqueta se sirve con `node docs/qa/maqueta-remasterizacion-2026-10-10/serve.mjs 8933` y se abre en
  `http://127.0.0.1:8933/index.html`. Las capturas «después» no están versionadas: se regeneran con
  `node docs/qa/maqueta-remasterizacion-2026-10-10/capturar.mjs` (Playwright desde `frontend/`; instala Chromium con
  `pnpm -C frontend exec playwright install chromium`). Las capturas «hoy» sí viajan: son la evidencia del censo.
- Lo que NO existe en la nube: los puertos locales 8787/5173 de Gonzalo y sus `.pulso` reales. Para QA visual con proyecto
  real usa los proyectos de referencia versionados (`api/inst/reference_projects/`: `acnur_acg` territorial, `acnur_pdm`
  telefónico, `acrconta` acreditación, `hsvg2026` cálculo de muestra) siempre sobre una COPIA, levanta tu propia pila
  (backend con `load_all` + Vite con `cacheDir` privado) y ciérrala al terminar. Monitoreo necesita `--timeout-ms 420000`
  y los paneles con gráfico `--post-click-wait-selector ".js-plotly-plot"` (ver CLAUDE.md, «Visual»).
- No hay un proyecto de referencia de Monitoreo › aulas: la unidad L38 y las capturas de aulas se verifican con el perfil
  que sí exista en los referencia (territorial, telefónico, acreditación) y se anota «aulas: sin fixture» en el GOAL hasta
  que Gonzalo anonimice uno.

## Primer paso en la nube

1. **B0**: leer los cuatro rectores y la maqueta entera. Abrir `meta-b-revamp` desde el `main` verde que deje la Fase 0.
   Correr `make gate-front` (solo transversales, menos de 1 s) y `node agentic/sync-agentic-os.mjs --audit` para tener el
   punto de partida del ledger.
2. **B1, L26/L27**: construir `PulsoSwitch` (maestro y chica, `is-sm`, `is-chip`), `PulsoInput`, `PulsoSelect` (Radix) y
   `PulsoField` tal como están en la página `L26-kit-inputs.html` de la maqueta, con las reglas de botón; migrar los
   checkboxes booleanos de las vistas que la página lista; contrato vitest que falle ante un `<input type="checkbox">`
   booleano nuevo fuera del kit. Verificador independiente antes de marcar ☑.
3. Luego la cola en el orden del plan: L1 → L14 → L24 → L2 → L35 → vuelta 1 (Carga), siempre con `/contrato-superficie`
   al tocar una superficie, `/ver-ui` para observar con proyecto de referencia, y gate escalado al diff. Cada unidad cierra
   con `/cerrar-trabajo`, commit por nombre de archivo y el GOAL redibujado entero.

## Pedidos a la Meta A

- L17: `frontend/src/features/graficos/GraficosPage.tsx` pasa a `PageFrame` con `layout`/`scrollOwner` y sin `toolbar=`.
  B entrega el diff a A por escrito en el encargo de A, o lo aplica con aviso previo y A revisa.
- L37: cuando B congele los tokens de movimiento globales (duraciones y curvas en `tokens.css`, catálogo M1–M22), A migra
  `laminas/movimiento.css` a esos tokens. Hasta entonces A no crea `--motion-*` nuevos.
- Nada más de `features/graficos/**` se toca desde B; lo que haga falta se pide aquí.

## Pedidos recibidos de la Meta A

- Ninguno todavía. A los anota en su encargo, sección «Pedidos a B», y B los copia aquí al tomarlos.

## Reglas del loop

- Máximo tres trabajadores y dos escritores por oleada; profundidad uno; todo cierra con `verificador`.
- Commits solo por nombre de archivo; nada de datos de cliente; ningún `.pulso` real se versiona sin pasar por
  `api/scripts/pulso_anonimizar.R`.
- `tokens.css` y `api/R/reporte_plan_ppt.R` están congelados a crecimiento; subir su línea base es una decisión explícita
  en el commit.
- Un PR rojo no se fusiona «para ver». Antes de abrir el PR la rama trae `main` y vuelve a pasar su gate.
- El rearme del reloj va antes del cierre de cada turno; el cierre termina con el sello del reloj.
