# Remasterización de la UI de Prosecnur — documento maestro (2026-10-10)

Tipo: Documento maestro
Estado: Vigente
Fecha: 2026-10-10
Autoridad: Consolida, con todo el detalle, el censo (`censo-ui-2026-10-10.md`), el GOAL (`goal-modernizacion-ui-2026-10-10.md`), el plan de trabajo (`plan-trabajo-remasterizacion-ui-2026-10-10.md`) y las 27 maquetas revisadas por el dueño; donde este documento y el GOAL difieran en el estado de una unidad, manda el GOAL, que es la cola viva

---

## 0. Cómo usar este documento

Es el punto de entrada único de la remasterización. Un agente o una persona
que retome cualquier unidad debe poder, leyendo solo esto, saber **qué hay hoy**
(con archivo y línea), **qué se decidió**, **cómo se ve el después** (su
maqueta), **qué archivos cambia**, **qué backend necesita**, **cómo se
verifica** y **de qué depende**.

Secciones:

1. Resumen ejecutivo
2. Vocabulario, gramática y contratos que gobiernan todo
3. Diagnóstico: qué hay hoy (del censo)
4. Decisiones tomadas por el dueño
5. El sistema de diseño objetivo: el kit, pieza por pieza
6. La maqueta: cómo verla y qué muestra cada página
7. Las 37 unidades, una por una
8. El plan: vueltas, dependencias y gates
9. Vara y ledger
10. Trampas, riesgos y lo que no se verificó
11. Referencias

Convenciones: las rutas son relativas a `frontend/src/` salvo que digan
`api/`, `docs/` o `branding/`. Los códigos **L1…L36** son las unidades de la
cola; **D1…D8** las decisiones; **V1…V11** la vara; **C1…C5** las cláusulas del
Contrato de Superficie. Las capturas del «hoy» y del «después» viven en la
maqueta (carpeta temporal del repo, no versionada; ver §6).

---

## 1. Resumen ejecutivo

La app tiene **la columna vertebral correcta y la piel desigual**. El chrome de
la dirección v3 existe y se ve igual en los módulos que lo adoptaron (dock,
command bar, rail de secciones, rail de pestañas de 56 px, cinco niveles
enlazables por URL con un puente de navegación que pocas apps de escritorio
tienen). Por debajo de ese chrome no hay kit: cada módulo arma sus inputs,
tablas, diálogos y cabeceras a mano, y por eso «parece otra app» al cambiar de
módulo.

Cifras que lo demuestran (medidas el 2026-10-10 sobre `main`):

| Qué | Hoy |
|---|---:|
| Módulos · modos · secciones · pestañas | 8 · 9 · 44 · ~186 |
| Paneles direccionables · overlays reales | 10 · ~50 |
| `role="dialog"` artesanales · con focus trap | 61 · 0 |
| Botones crudos · con `PulsoButton` | 1.960 · 39 |
| Inputs crudos · selects crudos · primitiva | 696 · 227 · 0 |
| Patrones distintos de cabecera de pestaña | 12 |
| Copias bespoke del rail de secciones | 5 |
| Hex sin token en CSS de features (Monitoreo) | 4.468 (3.115) |
| `font-size` literal (bajo 10 px) | 8.188 (108) |
| Nota de modernidad (16 dimensiones) | 3,1 / 5 |

La mayor deuda vive en **la quinta dimensión** (lo que abre ventanas) y en
particular en **Carga**: toda la feature sin tocar desde el 17 de agosto, los
wizards de SurveyMonkey y Kobo anteriores a la dirección v3, ningún flujo con
progreso de job ni cancelación, y, visto en pantalla, el carril Plataforma sin
disparador alguno en la estrategia «bases separadas».

El techo es alto y **no toca la marca congelada**: 36 unidades en siete
vueltas, con el kit construido primero y Carga inmediatamente después. El
tema oscuro queda descartado. Formularios gana una segunda sección,
**Documento**, que es un editor fiel del cuestionario en Word con la misma
arquitectura que el editor de láminas F6.

---

## 2. Vocabulario, gramática y contratos

### 2.1 Las cinco dimensiones (ADR 0044)

```
Módulo → [Modo] → Sección → Pestaña → Panel
```

- **Módulo**: familia de trabajo con homepage y paleta propia; vive en el
  `pathname` (`/carga`, `/monitoreo`…). Ocho: Bitácora, Cálculo de muestra,
  Formularios, Hojas de ruta, Recopiladores, Monitoreo, Procesamiento,
  Dashboard.
- **Modo** (opcional): variante que reescribe el juego de secciones y la
  determina el estudio, no un click. Solo Monitoreo (acreditación, telefónico,
  territorial, aulas) y Cálculo de muestra (opinión universitaria, muestra
  general, acreditación, territorial, sin definir).
- **Sección**: el recorrido del módulo; vive en la command bar como píldoras.
- **Pestaña**: subdivisión de una sección; vive en el rail icon-only de 56 px.
- **Panel**: superficie superpuesta (diálogo, sideover, popover, inspector);
  se conecta con `usePanelDireccionable` y se abre por `?panel=`.

Toda vista es enlazable: `/<modulo>?modo=&seccion=&pestana=&panel=&foco=`.
Nunca se duplica la navegación de un nivel en otro. Los nombres viejos
(`tab`, `stage`, `mesa`, `desk`, `step`, `reporte`) se leen y no se escriben.

### 2.2 El Contrato de Superficie (gramática de layout)

| | Cláusula | Qué exige | Cómo falla |
|---|---|---|---|
| **C1** | Declaración | la superficie declara su geometría (`data-qa-geometry-group`, contrato `equal` o `intrinsic`) y su readiness (`data-audit-ready`) | `geometry-undeclared`; readiness de página en vez de pestaña |
| **C2** | Estabilidad | pares y repetidos conservan alto y ancho; el marco no depende de `items.length` | `equal-frame-drift` |
| **C3** | Pertenencia | el vacío vive dentro de un contenedor visible y estable | `capacity-drift`; vacío flotando sin marco |
| **C4** | Alcance | un solo dueño de scroll; cero recorte de dato operativo | `scroll-jail`, `placeholder-clipped` |
| **C5** | Suficiencia | la superficie entrega lo que su `label` y `detail` prometen; el vacío es honesto (legítimo, por fixture o por desconexión) | cifras sin base, estados falsos, copy que promete lo que no está |

Regla de gate: **verde por conformidad, nunca por ausencia**.

### 2.3 Reglas de la casa que este trabajo respeta

- Colores solo con tokens `--pulso-*`; íconos lucide solo por el shim; TS
  estricto; componentes nuevos en archivo propio; nunca crecer un archivo
  congelado (`agentic/manifest.json`); engine nuevo = test nuevo; errores con
  `stop_api`; `NAMESPACE` lo escribe roxygen.
- Gate escalado al diff: typecheck y `make gate-front AREA=…` si se toca TS;
  `make gate-area` si se toca R; chequeo visual con proyecto real si se toca
  UI; `verificador` serial antes de declarar terminado.
- Commits por unidad coherente, en español, conventional commits.

---

## 3. Diagnóstico: qué hay hoy

### 3.1 Mapa por módulo

| Módulo | Ruta | Modos | Secciones | Pestañas | `?panel=` | Overlays en `useState` | Command bar | Rail de secciones | Rail de pestañas 56 px | Título compacto |
|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| Home | `/` | — | 2 | — | 2 | 2 | n/a | n/a | n/a | n/a |
| Bitácora | `/bitacora` | — | 4 | 0 (+sub-tabs locales) | 2 | 3 | sí | **`SectionPillbar`** (único) | n/a | n/a |
| Cálculo de muestra | `/calc-muestra` | 5 | 17 | 46 | 0 | ~9 | sí + `toolbar=` legacy | bespoke sin `aria-current` | `ContextTabRail` + rail bespoke vivo | parcial |
| Formularios | `/editor-xlsform` | — | 1 | 0 declaradas | 0 | 13 | **no** (excepción ADR 0042) | n/a | **no** | no |
| Hojas de ruta | `/hojas-ruta` | — | 5 | 3 (+sub-tabs) | 0 | 0 | sí | bespoke `aria-current="step"` | **no** en Entrega | no |
| Recopiladores | `/recopiladores` | — | 4 | 6 | 0 | 0 | sí | bespoke numerado | **no** | no |
| Monitoreo | `/monitoreo` | 4 | 21 | 87 | 6 | ~8 | sí | bespoke con `<a aria-current>` | sí | **sí** (`MonitoreoWorkbenchHead`) |
| Procesamiento | `/carga` … `/graficos` | — | 5 | 26 (+2) | 3 | ~25 | una en el shell | bespoke con las clases de `SectionPillbar` | sí 5/5 | no |
| Dashboard | `/tablero` | — | 1 | 4 | 0 | 4 | sí | n/a | **no** (`dash-tab-nav`) | no |

### 3.2 Madurez vista en pantalla (133 celdas juzgadas)

Podio: Monitoreo aulas > acreditación > telefónico > territorial > Cálculo de
muestra > Procesamiento > Hojas de ruta ≈ Dashboard > Bitácora > Recopiladores
≈ Formularios ≈ Gráficos. Los tres primeros comparten geometría declarada
hasta las colecciones interiores, Plotly con paleta Pulso y cabeceras
compactas; Monitoreo aulas es el techo visible de la app.

Lectura transversal:

1. El chrome es el acierto; Hojas de ruta, Dashboard, Recopiladores y Bitácora
   quedaron en la generación anterior (barras ad hoc, stepper numerado,
   píldoras inline).
2. Doce patrones de cabecera de pestaña; cuatro conviven dentro de Monitoreo.
3. Las bandas fijas de contexto cuestan de 0 (aulas) a 260 px (territorial)
   del primer viewport en el mismo módulo.
4. Densidad bimodal: Monitoreo y Hojas de ruta aprietan datos reales; Carga,
   Analítica › Datos y Codificación › Preparar dejan la mitad vacía o la
   llenan de prosa y cards con interior muerto.
5. Readiness prematura sistémica: siete capturas con spinner salieron `ok=true`
   (Analítica, Carga, Hojas de ruta, Bitácora, Explorador de Cálculo).
6. Cifras que no cuadran (C5): cinco lecturas de avance sin denominador; la
   card del Home cambia con el warm start; «faltan 1.970.691 envíos» sobre
   1.283 casos; «sin guardar» al solo leer una pestaña.
7. La cultura del vacío honesto es mayoritaria: solo el Lienzo de Bitácora y
   Relaciones del Dashboard flotan sin marco.

### 3.3 La quinta dimensión y Carga

- 61 `role="dialog"` en 56 archivos; 0 `<dialog>`; 0 focus trap; 16 archivos
  sin Escape; 27 sin `aria-modal`; 42 sin restaurar el foco; ~30 envoltorios
  CSS raíz distintos sobre tres mecanismos (portal bespoke 36, `Popover.tsx`
  8, Radix Dialog 9).
- Edad: atajos de Gráficos (abril), asistente de reglas del editor (junio,
  1.917 l.), importador SurveyMonkey del editor (22 de julio, 1.725 l.),
  wizards de Carga (27–29 de julio). La dirección v3 es del 24 de julio.
- Carga, flujo por flujo (siete): ninguno usa `JobProgress`; el integrado y el
  SAV son `await` bloqueantes; el wizard independiente son ~2.260 líneas dentro
  de `BasesPanel.tsx` (6.719) sin stepper; las credenciales se administran
  solo en Home › Configuración sin enlace; `SurveyMonkeyMultibaseWizard.tsx`
  (462 l.) no se monta.
- Visto en pantalla: con «bases separadas» el carril Plataforma monta solo el
  marco (`CargaPlatformImportPanel`, 51 l.) y un banner que promete un botón
  inexistente; Fuentes muestra «Pendiente · 0/1 base» durante ~8 s con
  readiness verde; el diálogo de SurveyMonkey del editor abre con «No pude
  conectar» y un token residual, y el foco no vuelve al disparador.

### 3.4 Hallazgos priorizados (resumen; el detalle con archivo:línea está en el censo §10)

**P0**: Formularios entero fuera de la gramática · readiness idéntica por
página en Acreditación, Telefónico, Territorial y Analítica · 10 paneles
direccionables contra ~50 overlays.

**P1**: sin primitiva de diálogo · Carga sin jobs ni disparador de plataforma ·
`SectionPillbar` con 1 consumidor y 5 copias · 3 módulos sin rail de 56 px y
título compacto solo en Monitoreo · Formularios sin command bar y `toolbar=`
deprecado en 3 páginas · 2 landings sin `PageFrame` y 2 sin `layout` · 42
`useState` de navegación · sin kit de inputs · 4.468 hex y 8.188 `font-size`
literales · `EmptyState` duplicado · Telefónico clon de Acreditación · warm
start sin tiempo · cinco lecturas de avance · cifra absurda en Criterios ·
scroll jail del Home a 1024×600 invisible al detector · chrome de Recopiladores
de otra generación.

**P2/P3**: tres lectores de `?seccion=`, numeración a mano, `style={{}}` en la
primitiva de estados, rutas fuera del manifiesto, rail bespoke duplicado en
Cálculo, dos blurs apilados, deriva documental de catálogos, primitivas
muertas, H1 visibles.

### 3.5 Dirección v3 y modernidad

Cumple: header de identidad, píldoras como links con `aria-current`, overflow
con dignidad, rail con burbuja por hover y foco, H1 sr-only en 13 de 14,
tokens de motion y reduced-motion, mecanismo de acento único, contrato de
error, toasts con acción. Parcial: dos blurs apilados, tooltip del dock por
`title`, command bar en 7 de 8, `backdrop-filter` en 237 sitios, literales de
motion, hex subiendo en Monitoreo. No cumple: título compacto de pestaña como
componente, mensajes del backend en inglés (P5).

Nota de modernidad 3,1/5: mejor en navegación (3,5), motion (3,5), color
(3,5), gráficos (3,5); peor en inputs (2), kit (2,5), densidad (2,5),
onboarding (2,5).

---

## 4. Decisiones tomadas por el dueño (2026-10-10)

| # | Decisión | Texto del dueño o estado | Efecto |
|---|---|---|---|
| D6 | Tema oscuro | «no vamos a hacer dark mode, eso está descartado» | sin unidad; la app es de tema único; no se vuelve a proponer ni maquetar |
| K1 | Todo booleano es un switch; el checkbox no existe en el kit | «reemplazar check por switcher, a veces siento que no te decides por uno u otro» | `PulsoSwitch` maestro 44×24 y variante chica; radios solo para elección excluyente; de 2 a 4 opciones, segmented |
| K2 | Botón de ícono con caja hairline en reposo; variante «quitar» enrojece al hover | señalado con captura («las ×») | regla del kit y contrato |
| K3 | Botón de texto sin subrayado, con caja al hover y separador fino entre vecinos; subrayado solo en prosa | señalado con captura («Ninguna · Todas») | regla del kit |
| K4 | Una acción de navegación nombra su destino y usa la flecha de lucide; «Ir» y «→» tipeado no existen | señalado con captura («Ir →») | regla del kit |
| L35 | El dock del header deja escapar «Agregar» con los ocho módulos | señalado con captura («el más se escapa del borde») | unidad nueva: el dock mide lo que sus módulos |
| L36 | Formularios tiene dos secciones, Editor y Documento, y Documento es un editor fiel del cuestionario en Word | «una sección para el editor en plataforma y otra para su edición en Word… con la lógica completa que ya usamos, pestañas especializadas y un editor con officer profesional y sofisticado»; «lo mismo que el editor de láminas: una versión avanzada, elegante y sofisticada, no superficial» | unidad XL en seis fases con la arquitectura de F6 |
| D1 | Formularios entra a `ModuleCommandBar` | recomendación aplicada salvo veto | métricas a la cabecera, acciones por rango, menú de overflow, excepción retirada |
| D2 | Dashboard: chrome canónico en la administración; el artefacto publicado conserva su capa `dash-*` y pasa a secuencial navy | recomendación aplicada salvo veto | vuelta 3 |
| D3 | Contrato geométrico `banda` (mismo alto, ancho intrínseco) | recomendación A aplicada salvo veto | runner |
| D4 | El marco del vacío es de la superficie; la variante `--panel` se renombra | recomendación B aplicada salvo veto | kit |
| D5 | Cifra hero del Marco conserva «Elegibles por curso-horario» | nada que ejecutar | — |
| D7 | Paleta categórica de Plotly acotada a navy + un acento + grises | recomendación aplicada salvo veto | vuelta 5 |
| D8 | Telefónico ↔ Acreditación: extraer primitivas puras sin fusionar la semántica de familia | recomendación aplicada salvo veto | vuelta 6 |

Regla general que salió de la sesión: **ante dos patrones posibles para lo
mismo, elegir uno y escribirlo**, nunca alternar según la página.

---

## 5. El sistema de diseño objetivo: el kit, pieza por pieza

Lo que ninguna pieza toca: isotipo y las diez variantes de `branding/logo/`,
navy `#002457` + azul señal `#2457D6`, los ocho acentos modulares y su techo
de croma, el stack tipográfico de sistema, los cinco easings y las cinco
duraciones, la jerarquía Prosecnur · PULSO PUCP.

### 5.1 Anatomía final del chrome (lo que ya existe, más lo que falta)

```
┌───────────────────────────────────────────────────────────────┐
│ Header 58 px: isotipo · dock (tile activo con su nombre;       │
│ burbuja por hover y foco en los demás; mide lo que sus módulos)│
│ · chip de proyecto (estado de guardado verificable) · inicio   │
├───────────────────────────────────────────────────────────────┤
│ Command bar 52 px: contexto │ píldoras de sección │ acciones   │
│ (SectionPillbar único; acciones por rango; chips de estado)    │
├──────┬────────────────────────────────────────────────────────┤
│ rail │ TabHeading (único: tile + eyebrow + título + estado +  │
│ 56px │ detalle + control de sección + chips con base)          │
│      │ Superficie: cada región con su scroll                   │
└──────┴────────────────────────────────────────────────────────┘
```

- **Dock**: `nav > ul > li > a`, `aria-current="page"`, label visible del
  activo, burbuja por hover **y** foco (no `title`), sin tope de 328 px;
  estrategia de overflow a partir de nueve destinos.
- **Command bar**: `ModuleCommandBar` en los ocho módulos (Formularios
  incluido); `SectionPillbar` como única implementación del rail de
  secciones (links; numeración solo con pipeline real; punto de «hecho»).
- **Rail de pestañas**: `ContextTabRail` en todo módulo con pestañas
  (Recopiladores, Dashboard admin y Hojas de ruta › Entrega incluidos);
  nunca píldoras inline ni stepper para la dimensión pestaña.
- **TabHeading**: un componente, tres variantes (estándar 62 px, compacta 40
  px, con control de sección). Sustituye a los doce patrones.
- **Bandas fijas de contexto**: viven solo donde se deciden (Piloto/Campo en
  Fuente); los KPIs «—» se colapsan. Contenido propio antes de 300 px a 1440.

### 5.2 Componentes del kit (especificación)

| Pieza | Qué es | Geometría y estados | Accesibilidad | Dónde vive | Contrato de test |
|---|---|---|---|---|---|
| `Dialog` / `Sideover` | la única primitiva de overlay, sobre Radix Dialog | diálogo 480/720/980 de ancho, cabecera (tile + título + subtítulo + cierre), cuerpo con scroll propio, pie con acción primaria a la derecha y ayuda de teclado a la izquierda, stepper opcional; sideover 520 px a la derecha | focus trap, `aria-modal`, Escape, foco de vuelta al disparador; se abre por `?panel=`; re-inyecta `moduleChromeVars` en el portal | `components/Dialog.tsx`, `Sideover.tsx` | falla si existe `role="dialog"` fuera de la primitiva |
| `TabHeading` | cabecera única de pestaña | grid tile · copy · control · chips; eyebrow 11/600 caps, título 16/800, detalle 12; estado como palabra (Listo · Parcial · Bloqueado), nunca punto sobre el ícono | el `h2` es el nombre de la pestaña | `components/TabHeading.tsx` | render; captura por módulo |
| `PulsoSwitch` | el booleano | maestro 44×24 (pista cóncava, perilla elevada); chica 30×17 para filas; chip (etiqueta + conteo) | `role="switch"`, foco con `outline` | `components/Switch.tsx` (evolución) | prohíbe `type="checkbox"` en archivos migrados |
| `PulsoInput` / `PulsoSelect` / `PulsoField` | campos | alturas 36 (md) y 30 (sm), radio 9, foco con anillo `--pulso-primary-focus`; `Field` = label + control + hint + error (el error reemplaza al hint); `Select` sobre Radix (teclado, búsqueda, portal con acento) | nombre accesible por `label`; error con `aria-describedby` | `components/Field.tsx`, `Input.tsx`, `Select.tsx` | prohíbe `<input`/`<select` crudo en archivos migrados |
| `PulsoButton` (reglas nuevas) | botón | primary · secondary · ghost · danger · icon; **icon** con caja hairline y superficie en reposo (28/36 px), hover con más contraste, `data-intent="remove"` enrojece; **texto** (`link`) sin subrayado, caja al hover, separador fino entre vecinos; **navegación** nombra el destino + flecha lucide que se desplaza 2 px | foco por `outline` | `components/PulsoButton.tsx` | contrato: 0 `<a>`/texto subrayado como botón; 0 «Ir»/«→» tipeado |
| `Skeleton` | espera con la silueta de la vista destino | variantes fila/card/kpi/gráfico; shimmer 1,4 s; respeta reduced-motion | **no** publica `data-audit-ready` | `components/states.css`, `States.tsx` | test de que la marca sigue en `false` |
| `EmptyState` (D4) | vacío honesto | sin marco propio: el marco es de la superficie; dice qué falta y cómo se llena | — | `States.tsx` | — |
| `JobProgress` (extensión) | job visible | anillo, fases con tiempo, transcurrido y estimación, cancelar, «seguir trabajando» | `role="progressbar"` | `components/JobProgress.tsx` | testthat de cancelación |
| `PulsoTable` + `PulsoInspector` | datos | react-table + react-virtual; cabecera sticky; anchos declarados por `colgroup`; `tabular-nums`; densidad cómoda/compacta; fila seleccionada abre el inspector (340 px) que edita y no navega | `aria-sort`, foco de fila | `components/Table.tsx`, `Inspector.tsx` | 0 datos recortados en las tablas migradas |
| `Toast` (uso) | resultado de una acción | 540 px, dos acciones máximo («Deshacer», «Ver»), cierre, se va solo a los 8 s o con Escape | `aria-live` | `components/Toaster.tsx` (existe) | ≥ 20 `<Alert>` migrados |
| `CommandPalette` | ⌘K | input «Ir a… o hacer…», grupos Vistas / Acciones del módulo / Recientes / Proyecto, dirección canónica bajo cada ítem, pie con atajos; sin animación de apertura | roving, Escape | `components/CommandPalette.tsx`, `lib/atajos.ts` | saltar a cualquier pestaña por teclado |

### 5.3 Tokens que faltan

- **Tipografía** `--pulso-type-*` por rol: display 28/900 (solo hero Home),
  kpi 21/900 tabular, title 16/800, subtitle 13/600, body 13/400, caption
  11,5/500, eyebrow 11/600 caps, micro 10/700 (piso). Contrato que falla con
  un `font-size` literal nuevo en features.
- **Densidad** `data-density="comoda|compacta"` en `:root`: reescribe
  `--pulso-space-*` (16→8 de base), alturas de control (36→28) y de fila
  (36→30), `--pulso-type-body` (13→12), radio de card (14→12). Se guarda por
  usuario; el control vive en la cabecera.
- **Materiales**: un solo blur (command bar); header opaco con hairline
  `--pulso-border`; `backgroundColor` de la ventana en `--pulso-bg`; sombras
  solo por los seis tokens.
- **Motion**: `--cmv2-ease-*` aliasado a `--motion-ease-*`; 1.108 ms y 119
  beziers literales a tokens; transición de sección y de pestaña con la firma
  de 6 px; press físico en chips, tiles y cards; `motion` fuera de
  `package.json`; FLIP del Home de 460 a 420 ms.

### 5.4 El sistema de movimiento (L37; censo y catálogo en `censo-animaciones-2026-10-10.md`)

Hoy, medido: 233 keyframes únicos (61 en `theme.css`), 54 loops infinitos, 34
transiciones sobre `width`/`height`/`left`, 1.112 ms y 119 beziers literales,
13 presses frente a 1.476 hovers de color, cero transición de sección y de
pestaña, 9 de 14 «ir a» sin suavidad, 78 de 250 hojas con reduced-motion,
`motion` instalado sin usar, FLIP del Home a 460 ms.

Principios: solo `transform` y `opacity`; la frecuencia decide si anima (lo
de cien veces al día no anima); entradas con `ease-out`, movimiento con
`ease-in-out`, color con `ease`, constante con `linear`, nunca `ease-in`;
bajo 300 ms con los cinco tokens; nada aparece de la nada (scale .96);
popovers desde el disparador, modales desde el centro; interrumpible
(transiciones, no keyframes); press .97 en todo lo presionable; scroll con un
dueño, suave cuando lo pide el usuario e instantáneo por teclado, sombra en
cabeceras pegajosas, snap en tiras; escalonado con tope (4 × 30 ms); loops
solo en spinner y skeleton; reduced-motion global.

Catálogo de 22 coreografías (M1–M22) con token y uso: módulo y sección
(firma de 6 px, base 220 out), pestaña (fade 120; nada por teclado), diálogo
(scale .96, 220, cierre 160), sideover (24 px, 280 drawer), popover y tooltip
(160 desde el disparador; siguientes sin retardo), press (.97, 120), hover
físico (2 px), selección (fill desde el centro), switch, insertar y quitar
fila (`grid-template-rows`), reordenar (FLIP 220), skeleton → contenido
(crossfade 160), shimmer (1,4 s), job (anillo por transición), toast (8 px,
transición con `@starting-style`), «ir a» (`smooth`, `nearest`, 16 px),
cabecera pegajosa con sombra, tira con `scroll-snap`, barras con `scaleX`
(420, una vez), reduced motion.

Contrato de movimiento (vitest): cero `transition` sobre layout; cero
literales de ms y bezier fuera de `tokens.css` en archivos migrados; cero
`infinite` fuera de spinner y skeleton; `animation-delay` ≤ 90 ms. Medición
con Playwright: 0 frames largos al cambiar de sección y abrir un diálogo.
La maqueta L37 es un laboratorio interactivo donde cada coreografía se siente
con los tokens reales y un switch simula «reducir movimiento».

### 5.5 Patrones de estado y feedback

- **Readiness**: una marca por pestaña (`<modulo>/<seccion>/<pestana>`),
  publicada tras el render (Plotly `onReady`, mapas, fetch propio); el
  skeleton no la publica; el instrumento marca INVALID si captura spinner y
  exige md5 distinto por pestaña.
- **Esperas largas**: transcurrido + estimación aprendida del `.pulso`
  anterior, fases con duración, skeleton de la vista destino; nunca un
  porcentaje mudo ni un 8 % fijo.
- **Cifras**: toda cifra de avance lleva su base rotulada; una sola definición
  de «válida» por estudio; el Home lee el corte guardado.
- **Guardado**: «sin guardar» solo tras una mutación que viaja en el `.pulso`;
  el chip se abre y lista qué cambió; lo que no cuenta está escrito en el
  panel.
- **Credenciales**: se piden donde ocurre el error, en sideover direccionable,
  con vuelta al mismo paso; nunca en claro; último perfil y encuesta por
  proyecto.

---

## 6. La maqueta

Una página por propuesta, construida con el CSS real del shell (tokens,
command bar, rail, botones, íconos lucide) y un motor (`shell.js`) que dibuja
el chrome desde una configuración, para que cada página solo aporte su
contenido. Se sirve en el puerto 8933 (entrada «Maqueta remasterización UI
(8933)» de `launch.json`, servidor estático en Node). El índice muestra «hoy»
(captura real del censo) y «después» (captura de la maqueta) lado a lado; cada
página tiene «Ver hoy» y «Comparar» (superposición con deslizador de opacidad).
Las miniaturas se regeneran con el script `capturar.mjs` que vive junto a la
maqueta.

| Página | Qué muestra | Unidades |
|---|---|---|
| L01 | El diálogo canónico sobre «Traducir encuesta de SurveyMonkey»: cabecera, pasos, pie, Escape y foco; estado inicial vacío sin token residual | L1, L8 |
| L03 | Carga › Plataforma en «bases separadas»: catálogo con perfil y última importación, importación como job con fases, tiempo y cancelar, bases del estudio | L3, L5 |
| L04 | Carga › Fuentes hidratando: skeleton con la silueta real y marca en `false` | L4, L24 |
| L06 | Wizard multibase independiente con stepper de seis pasos, tabla de alcance con campos del kit, popover de confirmación, resumen del plan | L6 |
| L07 | Sideover de Conexiones abierto desde el strip de token, con vuelta al paso y sin tokens en claro | L7 |
| L10 | El contrato de readiness en tres estados (hoy, cargando, listo) y sus cuatro reglas | L10, L11 |
| L13 | Formularios con Editor y Documento como secciones y las vistas como pestañas del rail; inspector con el kit | L13 |
| L14 | Los doce patrones de cabecera de hoy y el `TabHeading` en sus tres variantes | L14 |
| L15 | Recopiladores con píldoras sin numerar y rail de 56 px; tabla de accesos a la escala real | L15, L16 |
| L16 | Hojas de ruta › Entrega con la barra densa repartida en command bar y cabecera, pestañas en el rail, paquete en filas pares | L16 |
| L17 | Formularios con `ModuleCommandBar` (D1): qué se recoge y a dónde va cada pieza de la banda | L17 |
| D02 | Dashboard › administración con chrome canónico y el artefacto publicado intacto, donuts en secuencial navy | D2, L16 |
| L18 | Monitoreo territorial › Avance sin bandas repetidas: contenido desde 250 px | L18 |
| L19 | Consultas de Acreditación como pestañas del rail; reporte de Salidas como control de sección | L19 |
| L20 | Un KPI maestro con su base y la tabla de las cinco cifras de hoy con su numerador | L20 |
| L21 | Criterios de revisión con cifra, porcentaje y base; la continuidad apagada con su motivo | L21 |
| L22 | El chip «sin guardar» abierto: las dos mutaciones reales y lo que no cuenta como cambio | L22 |
| L23 | Warm start con transcurrido, estimación, fases y skeleton de la vista destino | L23 |
| L25 | Codificación › Preparar con cards de una variante y un toast con «Deshacer» y «Ver base final» | L25 |
| L26 | Analítica › Datos con el kit: tabla compacta de 18 variables por viewport, switch por fila, etiqueta editable inline | L26 |
| L27 | Cálculo › Criterios del estudiante con el kit y una cadena que dice cuánto resta cada filtro | L27 |
| L28 | Reporte UMP con `PulsoTable` (sticky, anchos declarados, densidad) e inspector de la UMP seleccionada | L28 |
| L29 | La misma pestaña Metas en cómoda y compacta, y la escala tipográfica de ocho roles | L29 |
| L30 | La paleta ⌘K sobre el Home atenuado: vistas, acciones del módulo, recientes, proyecto | L30 |
| L31 | Home vivo: bloque «hoy», cards con hecho y base, siguiente acción, job en curso | L31 |
| L32 | Materiales: un blur, header opaco con hairline, ventana en `--pulso-bg`, seis sombras | L32 |
| L36 | Formularios › Documento: páginas reales del cuestionario, bloque P5 seleccionado con inspector contextual, ajustes del documento, generación como job, pestaña Estándar | L36 |
| L37 | Laboratorio de movimiento: nueve demostraciones interactivas (módulo/sección/pestaña, diálogo/sideover/popover, press/hover/selección/switch, insertar/quitar/reordenar, skeleton/contenido/job, toast, «ir a» y cabecera pegajosa, tira con snap, barras), las reglas, lo medido hoy y un switch que simula «reducir movimiento» | L37 |

---

## 7. Las 37 unidades, una por una

Formato de cada unidad: **Hoy** (evidencia) · **Después** (maqueta y
comportamiento) · **Alcance** (frontend, backend, tests) · **Gate** ·
**Depende de** · **Esfuerzo** (S = 1 sesión, M = 2, L = 4, XL = 8).

### Vuelta 0 — Fundaciones del kit

**L1 · `Dialog` y `Sideover` canónicos.**
Hoy: 61 `role="dialog"` artesanales en 56 archivos, 0 focus trap, 16 sin
Escape, 27 sin `aria-modal`, 42 sin restaurar foco; Radix Dialog instalado y
usado en 9 archivos (Codificación, SAV, Gráficos). Después (maqueta L01): una
primitiva sobre Radix con cabecera, cuerpo, pie, stepper opcional y variante
sideover; se declara con id y clase y se abre por `?panel=`; re-inyecta
`moduleChromeVars` en el portal. Alcance: `components/Dialog.tsx`,
`Sideover.tsx`, `lib/navegacion/paneles.ts` (registro de clase de panel);
migrar primero `ReconciliacionExtraDialog`, `EscalaChip` (Carga) y los tres
del Dashboard. Tests: vitest de trap, Escape y foco; contrato que falla con un
`role="dialog"` fuera de la primitiva. Gate: contrato verde, captura de dos
diálogos migrados. Depende de: nada. Esfuerzo: M.

**L14 · `TabHeading`.**
Hoy: doce patrones (Carga «Pestaña 2 de 5», Validación «Vista actual»,
Codificación chips sin título, Analítica título + píldoras, territorial
breadcrumb + 260 px de bandas, aulas y telefónico tres líneas, acreditación
mínima 40 px, Cálculo una fila, Gráficos toolbar, Dashboard barra de estado,
Formularios toolbar doble, Bitácora barra «Entradas»); solo Monitoreo cumple la
norma v3 de identificación persistente. Después (maqueta L14): un componente,
tres variantes; absorbe «Pestaña n de m», «Definido en Plan», «Varias bases» y
los chips truncados. Alcance: `components/TabHeading.tsx` + CSS; props
`eyebrow`, `titulo`, `estado`, `detalle`, `control`, `chips`, `compacta`.
Gate: render test; captura en Carga y Monitoreo. Esfuerzo: M (el montaje en
todas las páginas es L14b, vuelta 3).

**L26 · Kit de inputs y reglas de botón.**
Hoy: 696 `<input`, 227 `<select`, 0 primitiva, 324 familias de clase; 1.960
`<button` contra 39 `PulsoButton`; 104 clases de botón bespoke; checkboxes y
switches conviviendo. Después (maquetas L26, L27): `PulsoSwitch` (maestro y
chica y chip), `PulsoInput`, `PulsoSelect` (Radix), `PulsoField`; reglas K1–K4.
Alcance: `components/`, `theme.css` solo para tokens nuevos; contrato
`inputsDelKit.contract.test.ts` que prohíbe `<input`, `<select`,
`type="checkbox"` y «Ir»/«→» en archivos listados como migrados. Gate:
contrato verde; captura del inspector de Formularios y de Analítica › Datos.
Esfuerzo: M (la migración es L27, vuelta 5).

**L24 · `Skeleton` y el marco del vacío (D4).**
Hoy: skeleton fuera del kit (una clase real en `home-v2.css`); el fallback de
ruta pinta 8 % fijo; `.pulso-empty-state--panel` no dibuja panel y 125
`EmptyState` dependen de él; dos features ya envuelven el vacío con marco
propio. Después (maquetas L04, L23): `Skeleton` con variantes y silueta de la
vista destino; el marco del vacío es de la superficie y la variante se
renombra. Alcance: `components/states.css`, `States.tsx`,
`ModuleWarmupBoundary.tsx:252`. Tests: el skeleton no publica
`data-audit-ready`. Esfuerzo: S.

**L2 · Declarar los overlays en el manifiesto.**
Hoy: `PANELES_POR_MODULO` declara 10 paneles; ~50 overlays viven en
`useState`; Carga, Formularios, Dashboard, Codificación y Validación declaran
cero. Después: todo overlay existente declarado aunque siga bespoke;
`ui-quick-check --panel <id>` lo abre y lo mide. Alcance:
`lib/navegacion/manifiesto.ts`, `scripts/ui-quick-check.mjs`; test
`panelesMontados()` = manifiesto. Gate: una corrida con `--panel` por módulo.
Esfuerzo: M.

**L35 · El dock mide lo que sus módulos.**
Hoy: `theme.css:757` capa el dock a `min(328px, 32vw)` con `overflow: visible`;
con los ocho módulos más «Agregar» (nueve tiles de 39 px = 351 px) el «+»
cruza el borde. Después: sin tope; a partir de nueve destinos, overflow con la
estrategia de la v3; tile activo con su nombre; burbuja por hover y foco.
Alcance: `theme.css`, `Layout.tsx:264-305`. Gate: captura con ocho módulos a
1440 y 1024. Esfuerzo: S.

### Vuelta 1 — Carga

**L3 · Disparador de plataforma en «bases separadas».**
Hoy: `CargaPage.tsx:1280` monta `CargaPlatformImportPanel` (51 l., solo el
marco) y un banner que promete «su botón de actualización»; perfiles, catálogo
e importación viven en `BasesPanel.tsx` y no se montan en esa estrategia.
Después (maqueta L03): catálogo de SurveyMonkey/Kobo con búsqueda, perfil,
última importación recordada, «Importar como base separada». Alcance:
`carga/plataforma/` nuevo (`CatalogoPlataforma.tsx`, `PerfilConexion.tsx`),
`CargaPage.tsx` lo monta. Gate: captura con `acnur_acg` en «separadas».
Depende de: L1 (para L7), L26. Esfuerzo: M.

**L4 · Hidratación honesta de Fuentes.**
Hoy: con readiness verde, Fuentes muestra «Pendiente · 0/1 base» ~8 s en un
proyecto con 1.283 registros. Después (maqueta L04): skeleton con la silueta
de la base y marca en `false` hasta hidratar; «Leyendo las bases del estudio ·
0:03». Alcance: `CargaPage.tsx` (readiness `carga/fuentes`), `Skeleton`.
Gate: 0 capturas con estado falso en tres corridas. Depende de: L24.
Esfuerzo: S.

**L5 · Un solo importador de plataforma con job.**
Hoy: dos handlers casi iguales para Kobo (`CargaPage.tsx:436` y `:508`), el
Kobo «por sugerencia» en `BasesPanel.tsx:4034`; SurveyMonkey y Kobo ya son jobs
con polling pero el handler los `await` y el progreso es un string `busy`;
sin cancelar. Después (maqueta L03): `JobProgress` con anillo, fases
(conectar, descargar, normalizar, materializar), tiempo y cancelar; el usuario
puede irse. Alcance: `carga/plataforma/ImportadorPlataforma.tsx`;
`api/R/jobs.R` cancelación; `importEnSegundoPlano.ts`. Tests: testthat del
job cancelado; vitest del estado. Gate: los tres flujos pasan por
`JobProgress`. Depende de: L3. Esfuerzo: L.

**L9 · Integrado y SAV como jobs.**
Hoy: `apiMultiIntegratedImport` y el import SAV son `await` bloqueantes.
Después: jobs con progreso y cancel. Alcance: `IntegratedInstrumentsWizard.tsx`,
`SavBundleImportPanel.tsx`, `api/R/jobs.R`, routers. Gate: testthat de ambos
jobs. Esfuerzo: M.

**L7 · Credenciales en el sitio del error.**
Hoy: el error «no hay token» aparece en Carga y la solución vive en Home ›
Configuración › Conexiones sin enlace; el catálogo no recuerda perfil ni
encuesta. Después (maqueta L07): sideover `?panel=configuracion&foco=conexiones`
abierto desde el strip de token, con la vuelta escrita («al cerrar vuelves a
Carga › Fuentes › Plataforma con la encuesta seleccionada»), tokens nunca en
claro, último perfil y encuesta persistidos por proyecto. Alcance:
`BasesPanel.tsx:5265`, `IntegratedInstrumentsWizard.tsx:955`, `CargaPage.tsx:387`
→ `carga/plataforma/`; `api/R/project_pulso.R` (preferencias por proyecto sin
secretos, ADR 0005). Gate: ida y vuelta capturada; reapertura recuerda.
Depende de: L1. Esfuerzo: M.

**L8 · El diálogo de SurveyMonkey del editor y los coachmarks.**
Hoy: abre con «No pude conectar» y un token residual; documento de tres
pantallas con scroll interno; Escape devuelve el foco al `body`; el tour de
coachmarks es `role="dialog"` sin `aria-modal` ni foco. Después (maqueta L01):
estado inicial vacío y reproducible; se conecta solo al pulsar «Probar
conexión»; pasos; foco al disparador. Alcance:
`xlsformEditor/shell/ImportSurveyMonkeyDialog.tsx`, `Coachmarks.tsx` sobre
`Dialog`. Gate: captura sin error; test de foco. Depende de: L1. Esfuerzo: S.

**L6 · Wizard independiente con stepper.**
Hoy: `IndependentSiblingsSurveyMonkeyWizard` son ~2.260 líneas dentro de
`BasesPanel.tsx` (6.719) con siete subpaneles apilados, 47 `useState`,
`window.confirm` ×3; auditoría, plan e inspección se pierden al cambiar de
pestaña. Después (maqueta L06): seis pasos con stepper (Perfil, Catálogo y
selección, Alcance por encuesta, Auditar, Importar, Decisiones de lógica),
tabla de alcance con campos del kit, confirmaciones con popover, resumen del
plan, estado en `useCargaStore`, cada paso que trabaja es un job. Alcance:
`carga/independiente/` nuevo; `BasesPanel.tsx` pierde el wizard;
`SurveyMonkeyMultibaseWizard.tsx` se borra. Tests: `autor-regresiones` cubre
el store y la supervivencia al cambio de pestaña. Gate: `BasesPanel.tsx` baja
≥ 2.000 líneas; audit verde. Depende de: L1, L5, L26. Esfuerzo: L.

### Vuelta 2 — Verde por conformidad

**L10 · Readiness por pestaña.**
Hoy: `AcreditacionMonitoreoPage.tsx:18392`, `TelefonicoMonitoreoPage.tsx:20295`,
`TerritorialMonitoreoPage.tsx:2012` y `AnaliticaPage.tsx:119` publican una
marca por página; Hojas de ruta una por módulo. Después (maqueta L10): marca
`<modulo>/<seccion>/<pestana>` (el patrón de Recopiladores). Alcance: por
extracción en los congelados (`profiles/*/readiness.ts`). Gate: md5 distinto
por pestaña en la matriz. Esfuerzo: M.

**L11 · Readiness de render.**
Hoy: la marca dice que montó, no que terminó (N7/N12); siete INVALID en el
censo; sin `--post-click-wait-selector` los Plotly salen en blanco y aprobados.
Después: la marca se publica tras `onReady` de Plotly, mapas y fetch propio;
`ModuleWarmupBoundary` espera la marca compuesta; el runner marca INVALID si
captura spinner. Alcance: `PlotlyChart`, `ModuleWarmupBoundary.tsx`, Hojas de
ruta (mapas), Bitácora (landing), Explorador de Cálculo (marca mixta),
`scripts/ui-quick-check.mjs`. Gate: 0 INVALID repitiendo la matriz del censo.
Esfuerzo: M.

**L12 · El detector y el contrato `banda`.**
Hoy: Home a 1024×600 corta la primera fila sin dueño de scroll y
`scrollJails=0`; el contrato geométrico no sabe decir «mismo alto, ancho
intrínseco» (decisión 8). Después: el detector mide contenedores sin dueño;
contrato `banda` (D3). Alcance: `scripts/ui-quick-check.mjs`, `home-v2.css`.
Gate: `scrollJails=1` antes del fix y 0 después. Esfuerzo: S.

**L13 · Formularios enlazable.**
Hoy: Constructor/Hojas (`XlsformEditorPage.tsx:624`), tabs del foco
(`FocusedWorkspace.tsx:531`), hojas (`SheetsView.tsx:194`) y ocho overlays
(`:619-657`) viven en `useState`; N8: `openWorkbookAsForm` borra el param al
montar. Después (maqueta L13): Constructor, Hojas, Probar formulario, Resumen,
Mapa de lógica, Filtros de opciones y Listas como pestañas del rail con
`?pestana=`; `foco=` identifica la pregunta; «Más vistas» desaparece; importar
no saca de Hojas. Alcance: `XlsformEditorPage.tsx` (por extracción:
`xlsformEditor/navegacion/`), catálogo de pestañas en `lib/navegacion/catalogos/`.
Gate: matriz con ≥ 6 direcciones únicas. Esfuerzo: M.

### Vuelta 3 — Un solo chrome

**L15 · `SectionPillbar` en las cinco copias.**
Hoy: `Layout.tsx:170` (Procesamiento), `MonitoreoModuleChrome.tsx:220`,
`CalcMuestraPage.tsx:2532`, `RecopiladoresShell.tsx:222` (numerado a mano),
`HojasRutaPage.tsx:7748` (`aria-current="step"`); tres con `<button>` sin
href. Después (maquetas L15, L16): links con `aria-current="page"`, punto de
«hecho», sin numeración salvo pipeline. Gate: `pulso-phase-pill` bespoke = 0.
Esfuerzo: M.

**L16 · Rail de 56 px donde faltan.**
Hoy: Recopiladores (`rec-*` horizontal), Dashboard (`dash-tab-nav`), Hojas de
ruta › Entrega (`hojas-ruta-delivery-tabs`); `CalcMuestraContextSidebar`
bespoke sigue montado junto a `ContextTabRail`. Después (maquetas L15, L16,
D02): `ContextTabRail` en los tres; el bespoke de Cálculo se retira. Gate:
tres capturas con rail. Esfuerzo: M.

**L14b · Montar `TabHeading` en todas las páginas con rail.**
Alcance: Carga, Validación, Codificación, Analítica, Gráficos (coordinar con
la sesión de láminas), Cálculo, los cuatro perfiles de Monitoreo (por
extracción), Recopiladores, Hojas de ruta › Entrega, Dashboard admin; retirar
`MonitoreoWorkbenchHead` y `CargaWorkspaceHeader`. Gate: patrones 12 → 1.
Depende de: L14. Esfuerzo: M.

**L17 · Formularios con `ModuleCommandBar` (D1) y `PageFrame` completo.**
Hoy: `XlsformEditorPage.tsx:3109-3110` dibuja `pulso-xlsform-commandbar` por
`toolbar=` deprecado; Cálculo (`:2290`) y Gráficos (`:281`) también pasan
`toolbar=`; Dashboard y Aulas sin `PageFrame`; Gráficos y Formularios sin
`layout`/`scrollOwner`. Después (maqueta L17): contexto = selector de
formulario; píldoras Editor / Documento; chips «1 aviso» y «Guardado 14:02»;
acciones «Documento» (rank 2) y «Exportar .xlsx» (rank 1); menú ⋯ con
Kobo/ODK, Prosecnur, Configurar PDF, Nuevo, Traducir, Importar; las tres
métricas bajan a la cabecera; excepción retirada de `lib/modules.ts:356-365` y
del test de excepciones. Gate: `toolbar=` = 0. Esfuerzo: M.

**L18 · Bandas fijas a un solo costo.**
Hoy: territorial repite «Formato territorial Piloto/Campo» (60 px) y la card de
fuente + banner (200 px) en todas las pestañas; el contenido propio empieza a
420–460 px (62 % de chrome a 1024×600); Cálculo fija ocho KPIs con cuatro en
«—». Después (maqueta L18): la banda y la card viven solo en Fuente; el corte
en el pie del rail; KPIs vacíos colapsados; contenido desde 250 px. Alcance:
`TerritorialMonitoreoPage.tsx` y `profilePage.css` por extracción,
`motor/ResumenDiseno.tsx`. Gate: contenido antes de 300 px en todas las
pestañas a 1440. Esfuerzo: S.

**L19 · Sub-barras sin dirección.**
Hoy: consultas y reportes GS de Acr/Tel (`AcreditacionMonitoreoPage.tsx:11162,
16651`, Telefónico `:12513, 18583`), manzanas y fase de Hojas de ruta (`:8379,
1071`), estructura de Carga, mes/semana de Bitácora (`Calendar.tsx:151`); 42
`useState` de navegación. Después (maqueta L19): las consultas son pestañas
del rail; los reportes de Salidas, un control de sección (`foco=`); mes/semana
y manzanas, `?pestana=` o segmented con `foco=`. Gate: `useState` de navegación
= 0. Esfuerzo: M.

**D2 · Dashboard, chrome canónico en la administración.**
Hoy: capa `--dash-*` (1.247 usos), `dash-tab-nav` con `role="tablist"`, sin
`PageFrame`, `EmptyState` propio (36 usos), donut arcoíris. Después (maqueta
D02): command bar con Datos / Curación / Vista previa / Publicación, rail con
Resumen / Relaciones / Base de datos / Dimensiones, cabecera única; el
artefacto publicado conserva su capa y pasa a secuencial navy. Alcance:
`DashboardPage.tsx`, `dashboard/shared/EmptyState.tsx` → `States`, `KpiCard`.
Gate: captura; el artefacto publicado byte-igual salvo paleta. Esfuerzo: M.

**L36 · Formularios › Documento, editor fiel del cuestionario.**
Hoy: una sola sección; el Word es el botón «Documento» de la toolbar
(`XlsformEditorPage.tsx:3295`, `apiXlsformEditorExportWord` →
`/api/xlsform-editor/export-word`, `router_xlsform_editor.R:1607`) más
`ConfigurarPdfDialog`; el motor `api/R/reporte_formulario_word.R` (380 l.) es el
segundo renderer del modelo del PDF, con officer y flextable, matrices Likert,
listas codificadas y los dos lenguajes de lógica, pero con colores propios
(`.FORM_WORD_NAVY`…) fuera de `estandar_pulso.json`; no hay visor, ni bloques,
ni versiones. Lo que ya existe y se reutiliza: `reporte_word_visor.R` (DOCX →
PDF con LibreOffice → PNG con pdftools, mapa de capítulos por página; F6.0b.4),
`estandar_pulso.json` (claves `ppt` y `word`), `docx_conformar.R`, el patrón
visor + inspector + estructura + ranuras seleccionables de
`features/graficos/laminas/` (F6, aprobado el 2026-10-09).

Después (maqueta L36): sección **Documento** con pestañas Portada e
identidad, Preguntas (patrón impreso por tipo), Lógica impresa (saltos y
filtros como instrucciones al encuestador, restricciones como notas), Estilos,
Estándar (lo que fija el recetario, con candado), Vista previa (páginas reales
rasterizadas) y Versiones; command bar con «Documento al día 14:02»,
«Regenerar» y «Descargar .docx»; bloques seleccionables sobre la página
(`foco=p-02:P5`) con inspector contextual (opciones en columnas, casilla,
instrucción de salto generada de la lógica y editable, nota al encuestador) y
ajustes del documento (plantilla, numeración, columnas, códigos, saltos,
notas, ocultas, idioma); generación como job; versiones ligadas a la versión
del instrumento.

Fases:

- **DOC.0** Dirección de diseño y recetario del cuestionario (como F6: tres
  rondas contra el recetario antes de aprobar): patrón impreso de cada tipo
  (selección única y múltiple con casillas y código, numérica con cajas de
  dígitos, matrices Likert con extremos y columna especial, abiertas con
  líneas, fecha, geopunto, notas), portada e identidad, numeración, pie,
  instrucciones de salto y filtro, notas al encuestador, qué no se imprime
  (ocultas y calculadas). Aprobada por el dueño.
- **DOC.1** Clave `cuestionario` en `estandar_pulso.json` y el motor leyéndola
  (`cuestionario_word_*.R` evoluciona `reporte_formulario_word.R`; cero hex
  propios); `ranurasEstandar` equivalente generado para el frontend.
- **DOC.2** Visor fiel: `reporte_word_visor.R` reutilizado con mapa sección →
  pregunta → página; job de regeneración con hash del instrumento; estados
  «regenerando» y «desactualizada»; «sin renderer» como excepción (LibreOffice
  viaja en el instalador desde la decisión del 2026-10-09).
- **DOC.3** Bloques seleccionables sobre la página e inspector contextual del
  bloque y del documento (calcado de `RanurasSobreLamina.tsx` e
  `InspectorLamina.tsx`).
- **DOC.4** Opciones del documento persistidas en el `.pulso`; versiones
  ligadas a la versión del instrumento (`xlsform_revisions.R`); generación
  cancelable.
- **DOC.5** QA: `expect_report_artifacts_registered`, golden de estructura del
  `.docx`, páginas PNG comparadas con la maqueta, y la regla de que el golden
  manda sobre el PNG porque LibreOffice y Word difieren (trampa documentada
  del PPT).

Alcance: `features/xlsformEditor/documento/` (nuevo), `lib/modules.ts`
(sección `documento` y catálogo de pestañas), `api/inst/estandar/estandar_pulso.json`,
`api/R/cuestionario_word_*.R`, `api/R/reporte_word_visor.R`,
`router_xlsform_editor.R`. Agentes: especialista-entregables (motor y
estándar), frontend-react (sección), revisor-metodologico (qué lógica se
imprime), qa-visual-desktop. Gate: dirección DOC.0 aprobada; seis pestañas
capturadas con `acnur_pdm`; golden del `.docx`; PNG contra la maqueta.
Depende de: L1, L14, L26, L5 (jobs). Esfuerzo: XL.

### Vuelta 4 — Cifras honestas y feedback

**L20 · Una sola lectura de avance con su base.**
Hoy: Home 85,7 % (1.028/1.200) y 106,9 % según el instante del warm start;
badge de Avance 107 % (1.283/1.200); UMPs 116 % (1.393); Cobertura 141 %;
Fuente S/D. Después (maqueta L20): un selector compartido («válidas por
consent / meta declarada»); rótulo de denominador obligatorio bajo cada cifra
(`.mq-kpi .mq-base` en el kit); Cobertura rotulada como cobertura, no avance;
el Home lee el corte guardado. Alcance: `home/moduleCardModel.ts`,
`MonitoreoModuleChrome.tsx`, `TerritorialAdvanceWorkbench.tsx` (extracción),
`TerritorialRouteCoverageAtlas.tsx`; revisor-metodologico fija la definición.
Gate: captura de las cinco superficies. Esfuerzo: M.

**L21 · Criterios de revisión honestos.**
Hoy: «Continuidad · faltan 1.970.691 envíos en la secuencia» sobre 1.283
casos (`_id` de Kobo leído como correlativo). Después (maqueta L21): cada
sugerencia con cifra, porcentaje y base, «Ver casos» y «Crear criterio»; la
heurística se apaga sola cuando el salto supera 10× el N y queda visible en
gris con su motivo. Alcance: motor R de criterios, `tabs/ReglasCustomTab.tsx`.
Gate: test con `acnur_acg` que falla antes. Esfuerzo: S.

**L22 · «Sin guardar» verificable.**
Hoy: visitar Carga › Fuentes, Codificar o Analítica › Base final marca el
proyecto sucio sin editar. Después (maqueta L22): `project_dirty` solo tras
una mutación que viaja en el `.pulso`; el chip se abre (`?panel=guardado`) y
lista cada mutación con origen, delta y hora, con «Abrir en …»; lo que no
cuenta está escrito; «Guardar ahora» y «Descartar cambios». Alcance: backend
lleva la lista de mutaciones (`project_pulso.R`), `CargaPage.tsx`,
`AnaliticaPage.tsx`, chip del header. Gate: un recorrido de lectura deja el
chip limpio. Esfuerzo: S.

**L23 · Tiempo en las esperas.**
Hoy: 0 mensajes de tiempo en `BootGate` y `ModuleWarmupBoundary`; el warm
start de 4–6 min de Monitoreo es un porcentaje; el fallback de ruta pinta 8 %
fijo; `JobProgress` sin tiempo. Después (maqueta L23): transcurrido y
estimación aprendida de la última apertura del mismo `.pulso`, fases con
duración, skeleton de la vista destino, «Avisarme al terminar», la command bar
ya montada con «Regenerando 2:40 · ~1:10». Alcance: backend
`project_warmup_plan` con timestamps por fase y última duración persistida;
`ModuleWarmupBoundary.tsx`, `BootGate.tsx`, `JobProgress.tsx`. Gate: captura
del warm start con tiempo. Esfuerzo: M.

**L25 · Toasts con acción.**
Hoy: `<Alert>` ×49 sin acción ni cierre; `toast()` 7 llamadas. Después
(maqueta L25): resultados de acción como toast con «Deshacer» y «Ver»; el
estado vive en la cabecera. Alcance: 49 usos de `Alert.tsx`. Gate: ≥ 20
migrados. Esfuerzo: S.

### Vuelta 5 — Datos y densidad

**L27 · Migración del kit de inputs.**
Hoy: 324 familias de input en Cálculo; `GlobalSettingsDialog.tsx` 1.496 l.;
cadena de filtros que repite 29.090 cuatro veces. Después (maqueta L27):
`PulsoField` en configuración, Cálculo y Carga; cada criterio dice cuánto
resta. Alcance: `GlobalSettingsDialog.tsx`, `calcMuestra/**` (empezando por
`universidad/criterios/`), `carga/**`. Gate: `<input` crudos bajan ≥ 300;
contrato por archivo. Esfuerzo: L.

**L28 · `PulsoTable` e inspector.**
Hoy: 161 `<table` crudas; decisión 3 abierta (83 datos recortados en Reporte
UMP); `react-table` en 1 uso y `react-virtual` en 3. Después (maqueta L28):
cabecera sticky, anchos declarados, densidad, 151 filas virtualizadas, fila
seleccionada → inspector con KPIs, responsable, cadena titular → reemplazo,
acciones. Alcance: `components/Table.tsx`, `Inspector.tsx`;
`TerritorialModelWorkbench.tsx`, `TerritorialFieldOccurrencesWorkbench.tsx`,
`TerritorialReviewCasesWorkbench.tsx`. Gate: 0 datos recortados. Esfuerzo: L.

**L29 · Tipografía, densidad, motion y hex.**
Hoy: 8.188 `font-size` literales (108 bajo 10 px), 0 por token; sin
`data-density`; `--cmv2-ease-*` copia literal; 3.115 hex en Monitoreo
(subiendo); Plotly categórica de 10 tonos. Después (maqueta L29):
`--pulso-type-*`, `data-density`, alias de easings, lotes 1:1 de hex con QA
por perfil, Plotly acotada (D7). Alcance: `tokens.css`, `monitoreo.css` y
`profilePage.css` por extracción, `universidad/ui/ui.css`,
`validacion/components/plotlyTheme.ts`. Gate: `font-size` < 10 px = 0; hex de
Monitoreo < 2.000; tokens sin definir = 0. Esfuerzo: L.

### Vuelta 6 — Lo que se nota sin abrir un módulo

**L30 · Paleta ⌘K y atajos.**
Hoy: sin paleta, cinco registros locales de atajos, tooltip del dock por
`title`. Después (maqueta L30): `CommandPalette` sobre `__pulsoNav.manifiesto`
(186 pestañas, 10+ paneles) y las acciones declarativas de la command bar;
grupos Vistas / Acciones / Recientes / Proyecto; `⌘1..8`, `⌘⇧[ ]`, «?».
Alcance: `components/CommandPalette.tsx`, `lib/atajos.ts`, `Layout.tsx`.
Gate: saltar a `monitoreo/territorial/avance/ump` por teclado. Esfuerzo: M.

**L31 · Home vivo.**
Hoy: cards cargadas una vez sin listener; gradientes decorativos; ~220 px de
hueco sin dueño; jail a 1024×600; la card de Monitoreo cambia con el warm
start. Después (maqueta L31): bloque «hoy» (corte, cursos agendados, entrega
próxima, importación en curso), cards suscritas a `pulso:session-changed` y a
jobs, hecho con base, siguiente acción, sin gradientes, sin jail. Alcance:
`ProjectModulesContext.tsx`, `MissionControl.tsx`, `ModuleStatusCard.tsx`,
`home-v2.css`. Gate: card de Procesamiento con barra de job en vivo; matriz
1024 limpia. Esfuerzo: M.

**L32 · Materiales.**
Hoy: dos blurs apilados (`theme.css:633-651` y command bar), `backgroundColor`
`#f7f4ee` en `desktop/main.cjs:1866`, 1.586 sombras literales. Después
(maqueta L32): un blur en la command bar, header opaco con hairline, ventana
en `--pulso-bg`, sombras por los seis tokens. Alcance: `theme.css`,
`desktop/main.cjs`. Gate: `backdrop-filter` en el header = 0. Esfuerzo: S.

**L37 · Sistema de movimiento y fluidez.**
Hoy: ver §5.4 y el censo de animaciones. Después (maqueta L37): las 22
coreografías con sus tokens; transición de módulo y sección (firma de 6 px)
y de pestaña (fade 120, nada por teclado); `Dialog`, `Sideover` y popover
con scale .96 y origen en el disparador; press .97 y elevación en todo lo
presionable; listas con `grid-template-rows` y FLIP a 220; skeleton →
contenido por crossfade; toast por transición; scroll con dueño, «ir a»
suave con reserva e instantáneo por teclado, sombra en cabeceras pegajosas,
snap en tiras; las 27 transiciones de `width` de Cálculo a `scaleX`; loops
solo en spinner y skeleton; stagger con tope; reduced-motion global; `motion`
fuera; FLIP del Home a 420. Alcance: `tokens.css`, `theme.css` (61 keyframes
→ catálogo), `nav-states.css`, `components/*`, `calcMuestra/**`, `scripts/`
(medición de frames), `package.json`. Tests: contrato de movimiento en
vitest; Playwright mide frames largos. Gate: contrato verde; 0 frames > 16 ms
en cambio de sección y apertura de diálogo; captura con reduced-motion
emulado donde nada se mueve. Depende de: L1, L26. Esfuerzo: M.

**L33 · Desduplicar Telefónico ↔ Acreditación (D8).**
Hoy: 41 funciones homónimas, `AcreditacionModuleChromeConSync` dos veces, 28
formateadores duplicados. Después: primitivas puras en `monitoreo/core/`,
chrome una sola vez; la semántica de familia no se toca. Alcance: por
extracción de los dos page-files. Gate: duplicados 28 → 0; los page-files
bajan. Esfuerzo: M.

### Fuera de la cola

- **L34** tema oscuro: descartado.
- **Gráficos** (láminas, Word del informe): otra sesión está construyendo
  F6; este trabajo no toca `features/graficos/` salvo montar `TabHeading` en
  coordinación.

---

## 8. El plan: vueltas, dependencias y gates

| Vuelta | Entrega visible | Unidades | Sesiones | Agentes principales |
|---|---|---|---:|---|
| 0 Fundaciones del kit | las piezas que todo lo demás consume | L1 ∥ L14, L26, L24, L2, L35 | 9 | frontend-react, autor-regresiones |
| 1 Carga | importar con catálogo, job, cancelar y credenciales a un clic; wizard con stepper | L3 ∥ L4, L5, L9, L7, L8, L6 | 16 | frontend-react, backend-r, autor-regresiones |
| 2 Verde por conformidad | el instrumento deja de aprobar lo que no vio; Formularios enlazable | L10 ∥ L11, L12, L13 | 7 | frontend-react, autor-regresiones |
| 3 Un solo chrome | los ocho módulos iguales; Formularios con Editor y Documento | L15 ∥ L16, L14b, L17, L18, L19, D2, L36 (XL) | 19 | frontend-react, especialista-entregables, revisor-metodologico, qa-visual-desktop |
| 4 Cifras y feedback | avance con base, criterios honestos, guardado verificable, tiempo en esperas, toasts | L20 ∥ L21, L22, L23, L25 | 7 | frontend-react, backend-r, revisor-metodologico |
| 5 Datos y densidad | kit en Cálculo y Carga, tablas con inspector, tipografía y densidad, hex | L27 ∥ L28, L29 | 12 | frontend-react, qa-visual-desktop |
| 6 Shell | ⌘K, Home vivo, materiales, sistema de movimiento, desduplicación | L30 ∥ L31, L32, L33, L37 | 9 | frontend-react, desktop-packaging, autor-regresiones, qa-visual-desktop |
| **Total** | | 37 unidades | **79** | |

Dependencias que fijan el orden:

```
V0 ─┬─► V1 (Dialog, Skeleton, Switch/Field, JobProgress)
    ├─► V2 (paneles declarados → --panel; Skeleton → readiness)
    ├─► V3 (TabHeading, SectionPillbar; L36 usa Dialog, Field y jobs de V1)
    ├─► V4 (Skeleton, Sideover)
    ├─► V5 (Field para el inspector)
    └─► V6 (Dialog para la paleta)
V2 ─► V3 (readiness por pestaña antes de mover cabeceras)
V3 ─► V5 (las tablas territoriales se migran con el chrome estable)
```

Gate de cada vuelta: typecheck y `make gate-front AREA=…`; `make gate-area`
si toca R; captura con proyecto real de cada superficie tocada comparada con
su maqueta (`--require-geometry`, `--timeout-ms 420000` en Monitoreo,
`--post-click-wait-selector ".js-plotly-plot"` con gráficos, md5 distinto por
pestaña); `node agentic/sync-agentic-os.mjs --audit` en verde; ledger
re-medido con al menos un número más bajo; `verificador` en serie;
`/cerrar-trabajo`.

Modo de operación: loop, no lista; revisión, no permiso; solo el dueño cierra
el GOAL.

---

## 9. Vara y ledger

| # | Afirmación | Medición | Hoy |
|---|---|---|---:|
| V1 | Todo overlay es un panel declarado y enlazable | `role="dialog"` fuera de la primitiva = 0; paneles ≥ overlays | 61 · 10/~50 |
| V2 | Una sola primitiva de diálogo con trap, Escape y foco | contrato de test | 0 primitiva |
| V3 | Carga importa con progreso real y cancelable y ofrece plataforma en toda estrategia | 7/7 con `JobProgress`; disparador en «separadas»; sin estado falso | 0/7 |
| V4 | Toda pestaña publica su readiness y solo al terminar de pintar | marca única por pestaña; 0 INVALID | 7 INVALID |
| V5 | Una cabecera y un rail de secciones en los ocho módulos | `SectionPillbar` único; `TabHeading` en todas; 0 `toolbar=` | 1+5 · 12 · 3 |
| V6 | Las pestañas viven en el rail y toda vista interior es enlazable | rail en los que faltan; 0 `useState` de navegación | 3 · 42 |
| V7 | Toda cifra de avance dice su base | 0 lecturas sin denominador; criterios sin cifras absurdas; dirty solo tras editar | 5 |
| V8 | Formularios e inputs salen del kit | `<input` crudos bajan cada vuelta | 696 |
| V9 | Las esperas largas dicen cuánto falta | tiempo + skeleton | 0 |
| V10 | Cualquier vista se alcanza desde el teclado | ⌘K + atajos | 0 |
| V11 | La deuda de piel baja y no sube | hex, `font-size`, inline, tokens sin definir, congelados | 4.468 · 8.188 · 2.699 · 23 |
| V12 | El movimiento es un sistema | contrato de movimiento verde; 0 layout animado; 0 literales en migrados; 0 frames largos | 233 keyframes · 34 layout · 1.112 ms literales · 13 presses |

Ledger de apertura (2026-10-10): `role="dialog"` 61 · paneles 10/~50 ·
`JobProgress` en Carga 0/7 · INVALID 7 · cabeceras 12 · copias de pillbar 5 ·
módulos sin rail 3 · `useState` de navegación 42 · `toolbar=` 3 · lecturas de
avance 5 · `<input` 696 · `<button` 1.960/39 · hex 4.468 (3.115) ·
`font-size` 8.188 (108) · tokens sin definir 23 · Telefónico 20.397 ·
Acreditación 18.487 · `BasesPanel` 6.719 · audit del OS verde.

---

## 10. Trampas, riesgos y lo que no se verificó

Trampas (ya costaron una conclusión falsa):

- Readiness ≠ render: siete capturas con spinner salieron `ok=true`; sin la
  espera de Plotly los paneles salen en blanco y aprobados.
- `scrollJails=0` no prueba ausencia de jail (Home a 1024×600).
- Una `?pestana=` que no resuelve aterriza muda: md5 antes de juzgar.
- Los fixtures no cubren los módulos aguas abajo (Recopiladores, Bitácora,
  Dashboard sin doble siembra); Monitoreo aulas no tiene fixture (copia de un
  estudio real, nunca commiteada).
- Los page-files congelados se cambian por extracción.
- Los portales salen del alcance de los tokens del módulo.
- Un `grep` crudo de tokens sin definir da 56; el contrato da 23: manda el
  contrato.
- LibreOffice y Word difieren (`vert`/`vert270`, placeholders, TOC vacío): el
  golden del artefacto manda sobre el PNG.
- La maqueta: el servidor estático de Python resetea conexiones bajo carga
  (reemplazado por uno en Node); la primera extracción de `theme.css` dejó
  comentarios truncados que anulaban la regla de la command bar; el `nota` de
  cada página se inyecta como HTML.

Riesgos y mitigación:

| Riesgo | Mitigación |
|---|---|
| Migrar 696 inputs rompe formularios que nadie ve | contrato por archivo migrado + captura por pestaña |
| Documento se construye superficial por prisa | DOC.0 aprobada antes de tocar código, como F6 |
| El visor de Documento muestra lo que LibreOffice pinta | el golden manda; QA abre el `.docx` en Word en los cortes |
| Otra sesión en Gráficos | no tocar `features/graficos/` sin coordinar |
| Readiness nueva aprueba skeletons | L11 antes que cualquier skeleton en producción |
| Fixtures insuficientes | `--sembrar`; fixture de Recopiladores con plan entregado antes de la vuelta 3 |

Sin evidencia todavía: el resto de pestañas de telefónico (7), acreditación
(16), Cálculo (20) y aulas (9); Recopiladores vinculación y paquetes; vistas
interiores de Formularios; viewports 1280/1024 fuera de `acnur_acg`; el
diálogo de normalización SAV; el wizard multiactor de Carga; nada en runtime
de las 27 maquetas más allá de 1440×1000.

---

## 11. Referencias

- `censo-ui-2026-10-10.md` — el diagnóstico completo con archivo y línea.
- `goal-modernizacion-ui-2026-10-10.md` — vara, cola y bandeja; la fuente de
  verdad del estado de cada unidad.
- `plan-trabajo-remasterizacion-ui-2026-10-10.md` — las vueltas con su gate.
- `censo-animaciones-2026-10-10.md` — el censo de movimiento, los principios, el catálogo M1–M22 y el antes/después.
- `direccion-diseno-editor-graficos-f6-2026-10-09.md` — la arquitectura que
  Documento (L36) calca.
- `branding/direccion-creativa-v3.md`, `docs/adrs/0042-chrome-modulo-uniforme-topbar.md`,
  `docs/adrs/0044-jerarquia-y-direcciones-de-navegacion.md`,
  `docs/ui-layout-grammar.md` — la dirección y los contratos que gobiernan.
- `goal-loop-visual-app-2026-07-30.md` — la primera órbita, absorbida.
