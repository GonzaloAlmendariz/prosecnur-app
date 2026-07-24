# ADR 0041: Shell v3 con sidebar de navegación unificado

Estado: Aceptado

Fecha: 2026-07-23

## Contexto

La identidad visual v1.2 y el ADR 0038 canonizaron un rail centrado para
secciones y rails icon-only para pestañas. La auditoría de la app completa del
23 de julio de 2026 encontró cuatro lenguajes de sección, navegación de tercer
nivel que depende del reconocimiento de iconos, rutas con semántica ARIA de
tabs y múltiples fuentes de verdad para Procesamiento.

La guía general de UI de escritorio adoptada por el plan exige un sidebar de
alto completo, un máximo ordinario de dos niveles, secciones como categorías y
pestañas con icono y label. El usuario decidió explícitamente migrar la
navegación de secciones y pestañas al sidebar unificado y ordenó ejecutar
`docs/plan-revamp-ui-2026-07.md`.

## Decisión

Prosecnur adopta un shell v3 con sidebar izquierdo unificado:

- ancho expandido 224px y colapsado 56px;
- zona superior para marca y selector de contexto;
- zona central scrollable para secciones y pestañas;
- zona inferior separada para utilidades;
- secciones en mayúsculas únicamente por CSS;
- pestañas con icono, label y links con `aria-current="page"`;
- flyout accesible en colapsado y drawer a 900px o menos;
- header global reducido a proyecto, sesión y acciones contextuales;
- un manifiesto de navegación como fuente de módulos, secciones, pestañas,
  rutas, iconos y política de layout;
- migración detrás de un interruptor de desarrollo hasta pasar la matriz de
  QA, seguida por retiro del shell v2 en la misma fase.

La navegación por rutas usa enlaces. Los tabs ARIA se reservan a paneles
locales asociados.

## Relación con ADR 0038

Esta decisión conserva el isotipo, la marca, la paleta, la economía del chrome,
los acentos modulares, la Física Pulso, el KPI discreto, la procedencia y la
regla No Scroll Jail.

Supersede dos patrones maestros del ADR 0038:

1. El pillbar centrado deja de ser el selector primario de secciones.
2. El rail icon-compressed deja de ser navegación primaria de tercer nivel y
   se convierte en el estado colapsado del sidebar unificado.

El `ModuleSwitcher` icon-only del header también se retira; el cambio de módulo
vive en el selector de contexto del sidebar.

## Consecuencias

- `Layout.tsx` y el chrome global deberán reestructurarse alrededor de
  `AppSidebar`.
- `frontend/src/lib/modules.ts` evolucionará a un manifiesto total de
  navegación.
- Los módulos conservarán steppers dentro del canvas únicamente cuando exista
  una secuencia real.
- Procesamiento, Analítica, Monitoreo y Muestra dejarán de depender de rails
  icon-only en estado expandido.
- La zona central del sidebar será propietaria de su scroll en ventanas bajas;
  `body` seguirá sin scroll en workbenches.
- El estado expandido/colapsado será preferencia local y no se persistirá
  dentro de `.pulso`.
- La identidad v3 deberá registrar la excepción local al taste baseline previo
  y la evidencia que la autoriza.

## Cumplimiento

El shell v3 no puede hacerse default hasta demostrar:

- typecheck y vitest en verde;
- contrato de navegación con rutas únicas, labels e iconos;
- cero `role="tab"` sobre rutas migradas;
- teclado completo en expandido, colapsado y drawer;
- QA visual a 1440×1000, 1280×800, 1100×600 y 900×800;
- cero scroll global y cero scroll jail;
- consola limpia;
- aprobación humana de `branding/direccion-creativa-v3.md`.

Fuente de ejecución: `docs/plan-revamp-ui-2026-07.md`.
