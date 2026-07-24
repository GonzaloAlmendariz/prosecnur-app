# ADR 0041: Shell v3 con sidebar de navegación unificado

Estado: Reemplazado por ADR 0042 (2026-07-24)

Fecha: 2026-07-23

Refinado: 2026-07-24 por la guía creativa vigente del dueño

> **Nota de reversión (2026-07-24)**: el dueño revirtió esta decisión el mismo
> día siguiente (indicación 5). El shell canónico conserva el top bar de
> secciones + rail de pestañas; el foco pasa a uniformidad y pulido
> macOS-like. Ver `docs/adrs/0042-chrome-modulo-uniforme-topbar.md`. Este ADR
> se conserva como registro histórico; no ejecutar.

## Contexto

La identidad visual v1.2 y el ADR 0038 canonizaron un rail centrado para
secciones y rails icon-only para pestañas. La auditoría de la app completa del
23 de julio de 2026 encontró cuatro lenguajes de sección, navegación de tercer
nivel que depende del reconocimiento de iconos, rutas con semántica ARIA de
tabs y múltiples fuentes de verdad para Procesamiento.

La guía general de UI de escritorio adoptada por el plan exige un sidebar de
alto completo, un máximo ordinario de dos niveles, secciones como categorías y
pestañas con icono y label. El usuario decidió explícitamente migrar la
navegación de secciones y pestañas al sidebar unificado. El contrato ejecutable
y sus arbitrajes se resuelven desde
`docs/plan-revamp-ui-2026-07-INDICE.md`.

## Decisión

Prosecnur adopta un shell v3 con sidebar izquierdo unificado:

- solo dos anchos de chrome: 248px expandido y 64px colapsado;
- columna full-height propietaria de la esquina superior izquierda;
- header de 52px para isotipo, módulo activo y switcher;
- zona central scrollable para secciones y pestañas;
- zona inferior separada para utilidades;
- filas de sección de 28px y subfilas de 24px, con máximo dos niveles;
- labels almacenados en sentence case; cualquier mayúscula de sección es solo
  presentación CSS;
- secciones y pestañas con icono, label y links con
  `aria-current="page"`;
- selected con fondo suave, texto, icono e indicador de 2px derivados del
  acento del módulo;
- flyout transitorio accesible de 240px en el estado colapsado;
- los estados persistentes de 248/64 siempre empujan el lienzo; solo el flyout
  transitorio puede superponerse y nunca provoca reflow;
- proyecto/archivo, guardado y Home en el sidebar, sin franja global
  persistente encima de los workbenches ricos;
- command surface local del lienzo para KPIs, chips de estado, fase operativa
  y acciones contextuales, compacta y subordinada a la superficie primaria;
- switcher de módulo en el header del sidebar, con popover-grid para los ocho
  módulos y acceso a «Agregar módulo»;
- gestor de módulos como modal sobre la vista actual, sin expulsar al usuario
  a otra ruta;
- un manifiesto de navegación como fuente de módulos, secciones, pestañas,
  rutas, iconos, badges, locks y política de layout;
- migración detrás de un interruptor de desarrollo hasta pasar la matriz de
  QA, seguida por retiro del shell v2 en la misma fase.

La navegación por rutas usa enlaces. Los tabs ARIA se reservan a paneles
locales asociados. En recorridos secuenciales el sidebar también expresa
progreso, numeración y gating: el sidebar es el stepper y no se duplica esa
navegación dentro del canvas.

El sidebar es una superficie neutral. Cada módulo conserva su acento canónico
en selección, icono, indicador y foco contextual:

- Bitácora `#A16207`;
- Cálculo `#7C3AED`;
- Formularios `#6D5DFC`;
- Hojas `#C2410C`;
- Fichas QR `#0891B2`;
- Monitoreo `#BE123C`;
- Procesamiento/Carga `#0F766E`;
- Dashboard `#2563EB`.

Los estados de éxito, alerta, peligro e información nunca heredan el acento
del módulo.

## Relación con ADR 0038

Esta decisión conserva el isotipo, la marca, la paleta, la economía del chrome,
los acentos modulares, la Física Pulso, el KPI discreto, la procedencia y la
regla No Scroll Jail.

Supersede dos patrones maestros del ADR 0038:

1. El pillbar centrado deja de ser el selector primario de secciones.
2. El rail icon-compressed deja de ser navegación primaria de tercer nivel y
   se convierte en el estado colapsado del sidebar unificado.

El `ModuleSwitcher` icon-only del header también se retira; el cambio de módulo
vive en el selector de contexto del sidebar. La barra superior global no
continúa por encima de la columna izquierda: así se elimina la «L» y la esquina
tiene un único dueño.

## Consecuencias

- `Layout.tsx` y el chrome global deberán reestructurarse alrededor de
  `AppSidebar`.
- `frontend/src/lib/modules.ts` evolucionará a un manifiesto total de
  navegación.
- Los módulos no conservarán steppers en el canvas para recorridos que ya
  pertenezcan al sidebar.
- Procesamiento, Analítica, Monitoreo y Muestra dejarán de depender de rails
  icon-only en estado expandido.
- La zona central del sidebar será propietaria de su scroll en ventanas bajas;
  `body` seguirá sin scroll en workbenches.
- El estado expandido/colapsado será preferencia local y no se persistirá
  dentro de `.pulso`.
- Hojas de Ruta y Cálculo nacen expandidos; Procesamiento y Monitoreo usan
  sidebar según su jerarquía; Editor XLSForm, Dashboard y mapas nacen
  colapsados; el homepage conserva un shell mínimo sin secciones.
- Dentro de Hojas, Territorio y Manzanas declaran preferencia colapsada al
  entrar; Población, Muestra y Entrega conservan preferencia expandida. La
  selección manual permanece hasta el siguiente cambio de sección.
- A 1024×600 el lienzo expandido deberá conservar al menos 712px. Las rutas que
  no puedan cumplirlo declararán `railMode: "collapsed"` en el manifiesto, sin
  lógica ad hoc.
- Los workbenches cartográficos no aprueban solo por evitar overflow: su mapa
  debe conservar al menos `500×250px` útiles a 1024×600 en el rail recomendado
  y sus overlays deben tener intersección cero.
- Cambiar de módulo cambiará el acento contextual del shell a la familia
  canónica de ese módulo; superficies de contenido, series de datos y estados
  semánticos no heredarán ese cambio.
- Expandir o colapsar dura 180ms ease-out; las filas pueden escalonarse 60ms al
  expandir y todo movimiento se apaga con `prefers-reduced-motion`.
- La identidad v3 deberá registrar la excepción local al taste baseline previo
  y la evidencia que la autoriza.

## Cumplimiento

El shell v3 no puede hacerse default hasta demostrar:

- typecheck y vitest en verde;
- contrato de navegación con rutas únicas, labels e iconos;
- cero `role="tab"` sobre rutas migradas;
- teclado completo en expandido, colapsado, switcher, flyout y modal;
- QA visual acumulativa a 1440×1000, 1361×987, 1280×800, 1100×600,
  1024×600 y 900×800, en ambos estados del sidebar para cada ventana
  migrada;
- `data-audit-ready` verdadero antes de capturar evidencia;
- cero scroll global y cero scroll jail;
- consola limpia;
- recorrido de los ocho módulos que demuestre el cambio de acento en contexto,
  selección, icono, tintes/bordes y foco contextual, sin alterar éxito, alerta,
  peligro, información ni superficies de datos;
- esquina superior izquierda con un solo dueño, toolbar sin recortes,
  selección inequívoca, reflow limitado a 248/64, acceso a cualquier pestaña
  desde el flyout en dos interacciones y cero navegación interna duplicada;
- dirección `branding/direccion-creativa-v3.md` redactada y ejecutada con
  evidencia disponible para revisión o veto del dueño dentro del bucle, sin
  pedir permiso intermedio.

Fuente de ejecución y precedencia:
`docs/plan-revamp-ui-2026-07-INDICE.md`.
