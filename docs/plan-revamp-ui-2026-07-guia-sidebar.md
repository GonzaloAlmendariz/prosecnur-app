# UI v3 — Guía creativa del shell: el sidebar unificado y la resolución de la "L"

Anexo de dirección de diseño para `plan-revamp-ui-2026-07.md`. Responde la preocupación
central del dueño (2026-07-23): "ya hay una barra superior con el logo — ¿cómo hacemos el
sidebar sin que se vea como una L?" Fundada en la gramática de la casa
(`prosecnur-design-system`, ADR 0038) y verificación en vivo del shell actual.

## 1. El diagnóstico creativo: la "L" no se decora — se elimina

La "L" (barra superior global + sidebar izquierdo debajo) es un artefacto de **mezclar dos
gramáticas**: la de web-admin (top bar dueña del ancho) y la de escritorio (sidebar dueño
del alto). Cuando conviven, la esquina superior izquierda queda muerta y el chrome se paga
dos veces (alto + ancho).

**La gramática macOS no tiene "L"**: en Finder, Mail, Notas y Música el sidebar es
**full-height y es dueño de la esquina superior izquierda**. No existe una barra que cruce
por encima: el toolbar pertenece al **área de contenido** y empieza a la derecha del
sidebar. Esa es la respuesta a "el sidebar tiene que alinearse con la parte superior de la
barra": no se alinea con ella — **la reemplaza en su columna**.

## 2. Decisión creativa central: «columna de app, lienzo de trabajo»

```
┌─────────────┬──────────────────────────────────────────────────────┐
│ ⬛ Prosecnur │  [KPIs · chips de estado · fase Piloto/Campo]  📁 ● │  ← toolbar DEL LIENZO
│ ─────────── │──────────────────────────────────────────────────────│
│ 🗺 Hojas ▾  │                                                      │
│             │                                                      │
│ ① Territorio│                It fits: el workbench                 │
│ ② Población │                dispone de todo el alto               │
│ ③ Muestra   │                y el ancho restante                   │
│ ④ Manzanas  │                                                      │
│ ⑤ Entrega ▾ │                                                      │
│    · Cuotas │                                                      │
│    · Titular│                                                      │
│    · Reempl.│                                                      │
│ ─────────── │                                                      │
│ ＋ Módulos   │                                                      │
│ ⚙ Config    │                                                      │
└─────────────┴──────────────────────────────────────────────────────┘
```

- **La columna izquierda ES la app**: identidad (isotipo), switcher de módulo, navegación
  (secciones → pestañas), gestor de módulos, configuración.
- **El lienzo es el trabajo**: su toolbar lleva lo que HOY colisiona en la banda — KPIs,
  chips de estado, el selector de fase (Piloto/Campo real: es fase de datos, no
  navegación) y la píldora de proyecto/guardado (identidad del DOCUMENTO, no de la app).
- La esquina deja de ser un problema porque tiene un solo dueño: el isotipo, arriba del
  sidebar. Identidad de marca siempre visible, sin competir con nada.

## 3. Anatomía y métricas (gramática macOS traducida a tokens de la casa)

**Expandido — 248px** (rango source list 240–260):
- Header 52px: isotipo squircle 28px + nombre del módulo activo + chevron (switcher).
- Filas de sección 28px (control md de la casa), texto 13px/500; pestañas anidadas con
  disclosure: sub-filas 24px, indent 28px, texto 12.5px. **Máximo 2 niveles** — nada de
  árboles infinitos (regla de la matriz de decisión).
- Footer: "＋ Módulos" y "⚙ Configuración" como filas normales, separadas por hairline.

**Colapsado — 64px** (icon rail, el patrón ya validado en pestañas nivel 3):
- Isotipo arriba (también es botón "menú principal"), íconos de sección debajo, badges de
  estado como puntos.
- **Hover sobre una sección → flyout de 240px** con el nombre y sus pestañas, click
  navega. El flyout es un MENÚ transitorio (popover, z-1400): la única superposición
  permitida, porque no es navegación persistente — el estado persistente siempre EMPUJA.

**Estados** (taxonomía del UI Kit traducida):
- Selected: tinta del módulo (`--module-accent-soft` de fondo + texto/ícono accent +
  indicator bar de 2px al borde izquierdo). Hover: fill neutro sutil. Focus: ring estándar.
- Los estados semánticos (gating de Procesamiento, alertas) usan success/warn/danger de la
  casa — **jamás** la tinta del módulo.
- Transición expandir/colapsar: 180ms ease-out (token `med`), con stagger de 60ms en las
  filas al expandir — cita discreta a la firma de marca (el latido del isotipo);
  `prefers-reduced-motion` la apaga.

**Firma de superficie**: el sidebar es material de navegación (over-glass sutil / tinte de
fondo), el lienzo es superficie sólida de contenido; separación por hairline de 1px, sin
sombra dura. El sidebar NO se pinta del color del módulo — la paleta del módulo vive en
la selección, el ícono del header y los acentos, sobre base neutra.

## 4. El switcher de módulos y el nuevo hogar del "+"

- El header del sidebar (ícono + nombre del módulo + chevron) abre un **popover-grid** con
  los 8 módulos (cada uno con su paleta) + "Agregar módulo".
- "Agregar módulo" abre el **gestor en overlay modal sobre la vista actual** — se acabó el
  `/?agregar=1` que te expulsa a otra ruta: cierras el overlay y estás exactamente donde
  estabas. (El carrusel actual puede vivir dentro del overlay; su dock debe mostrar los 8+
  módulos completos.)
- El homepage sigue siendo el mission control (nivel 1 pleno); el popover es el acceso
  rápido. No se duplica navegación: el strip de íconos del top bar actual **desaparece**.

## 5. Adopción por ventana (la regla del dueño, operacionalizada)

**Regla: módulo con secciones → sidebar; sección con pestañas → disclosure anidada.**

| Clase | Ventanas | Tratamiento |
|---|---|---|
| A (recorrido + KPIs) | Hojas de Ruta, Calc-muestra | Sidebar expandido default; KPIs+chips+fase al toolbar del lienzo |
| B (gating profundo) | Procesamiento (5 secciones) | Sidebar con badges de estado/candado por sección |
| C (chrome operativo) | Monitoreo (4 perfiles) | Secciones al sidebar; el chrome operativo (Avance/Todo/Corte) se queda en el toolbar del lienzo |
| D (canvas total) | **Editor XLSForm (3 columnas)**, Tablero, mapas | **Rail colapsado (64px) por defecto** — identidad y switcher presentes sin robar lienzo; su estructura interna (canvas/inspector/columnas) queda INTACTA y jamás se duplica en el sidebar |
| E (homepage) | Mission control | Sin sidebar de secciones (no tiene); solo el shell mínimo |

La clase D responde directamente la duda del dueño sobre el XLSForm: **sí lleva la columna
(por identidad y consistencia), pero nace colapsada y no participa de su navegación
interna**. Un editor de 3 columnas + rail de 64px sigue teniendo más lienzo que hoy
(64px < banda superior actual de ~96-120px de alto convertida a ancho útil).

## 6. Contrato anti-deformación del workbench

1. **Solo existen 2 anchos de chrome: 248 y 64.** El workbench se diseña contra dos
   breakpoints conocidos, nunca contra un continuo.
2. **Ancho mínimo garantizado del lienzo**: a 1024×600 con sidebar expandido, lienzo ≥
   712px; si una ruta no puede, declara auto-colapso (`railMode: "collapsed"` por ruta en
   el registry — declarativo, no ad-hoc).
3. El flyout de hover jamás reflowea el lienzo (popover).
4. Cada ventana migrada re-verifica `data-audit-ready` + matriz visual **en ambos estados
   del rail** y en 1024×600. Los chips de estado no pueden volver a desaparecer: si no
   caben, colapsan a un resumen con popover, nunca a la nada.

## 7. Alternativas descartadas (y qué se supersede del ADR 0038)

- **A. Top bar global + sidebar debajo (la "L" clásica)**: esquina muerta, chrome doble,
  y en compacto reproduce el problema actual. Descartada — es exactamente lo que preocupa
  al dueño, con razón.
- **B. Doble rail (apps + secciones, estilo Teams)**: 64+248px permanentes de chrome, no
  es gramática de escritorio Apple, roba lienzo a las clases A/B. Descartada; el switcher
  en el header del sidebar cumple el rol con costo cero.
- **Elegida: source list full-height.** Supersede el patrón maestro #2 del ADR 0038 (rail
  central de secciones) y reforma el #3. La advertencia de la matriz ("no usar sidebar
  para 3-7 secciones planas") queda superada por diseño: el sidebar v3 carga jerarquía
  real —secciones + pestañas + estado— que es exactamente el caso que la propia matriz
  reserva para sidebars. **Requiere el ADR nuevo antes de la Oleada 1** (plan §4.5).

## 8. Definición de "se ve perfecto" (gate creativo por ventana)

Una ventana migrada aprueba solo si: (1) la esquina superior izquierda tiene UN dueño y
cero elementos huérfanos; (2) el toolbar del lienzo muestra KPIs + estado + fase sin
recortes en 1361 y 1024; (3) la selección del sidebar respira la paleta del módulo sin
teñirlo entero; (4) expandir/colapsar no produce saltos de layout en el workbench (solo el
reflow entre los 2 anchos); (5) el flyout colapsado permite llegar a cualquier pestaña en
2 interacciones; (6) nada de la navegación interna del módulo quedó duplicada.
