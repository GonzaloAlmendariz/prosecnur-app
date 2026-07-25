# Gramática de layout Prosecnur

Esta guía define una gramática desktop-first para que Prosecnur mantenga una interfaz consistente en escritorios grandes, compactos y bajos. No optimiza para móvil angosto; la matriz base de QA es `1710x1107`, `1440x1000`, `1366x768`, `1280x720` y `1024x600`.

## Jerarquía de navegación

La gramática de layout se apoya en una jerarquía fija de cinco niveles
(ADR 0044):

```
Módulo → [Modo] → Sección → Pestaña → Panel
```

- **Módulo**: familia de trabajo con homepage y paleta propia. Vive en el
  `pathname`.
- **Modo** (opcional): variante que reescribe el juego de secciones. Lo
  determina el estudio del proyecto, no un click — por eso no se navega entre
  modos, se aterriza en el que corresponde. Solo Monitoreo y Cálculo de muestra
  tienen modos.
- **Sección**: el recorrido del módulo; la top bar.
- **Pestaña**: subdivisión dentro de una sección.
- **Panel**: superficie superpuesta (popover, sideover, drawer, diálogo,
  inspector).

Reglas de layout que se derivan:

- UI nueva se cuelga de uno de esos cinco niveles. No se inventa un sexto.
- Nunca se duplica la navegación de un nivel en otro: si el rail de secciones
  ya es el recorrido del módulo, no puede existir una segunda barra de pasos.
- Los cinco niveles son direccionables:
  `/<modulo>?modo=&seccion=&pestana=&panel=`. Un panel nuevo se conecta con
  `usePanelDireccionable`, no con un `useState` suelto — si no está en la URL,
  el QA visual no puede alcanzarlo.

## Breakpoints canónicos

- `desktop`: ancho mayor a `1320px` y alto mayor a `720px`.
- `compact desktop`: `max-width: 1320px` o `max-height: 720px`. Reduce padding, compacta encabezados y permite que toolbars envuelvan controles.
- `narrow desktop`: `max-width: 900px`. Los workbenches apilan rail y contenido.
- `short desktop`: `max-height: 700px`. Los workbenches apilan rail y contenido aunque el ancho sea suficiente.

## Presets de disposición

Prosecnur tiene un selector manual en `Configuración > Apariencia`. El selector no cambia el tamaño real de la ventana; aplica una preferencia local de escritorio que sesga la gramática interna. Se guarda en `localStorage` como `pulso.layoutPreset`, no dentro del archivo `.pulso`.

Presets:
- `auto`: usa el tamaño real de ventana y los breakpoints canónicos.
- `large`: `1710x1107`, densidad cómoda.
- `portable`: `1440x1000`, densidad balanceada.
- `portable-compact`: `1366x768`, densidad compacta con rail lateral.
- `compact`: `1280x720`, shell compacto y rail lateral compacto.
- `short`: `1024x600`, rail apilado arriba y main preservado.

El shell expone el preset activo en `document.documentElement`:
- `data-pulso-layout-preset`
- `data-pulso-layout-density`
- `data-pulso-layout-mode`

## Disposiciones

### Shell

Es la envolvente global de la app: header, selector de módulo, fases y área de trabajo. En `compact desktop`, el rail de fases baja a una segunda fila para preservar el proyecto, el módulo y la navegación sin solapes.

Reglas:
- El shell no debe introducir scroll horizontal global.
- El `body` de la app permanece bloqueado, pero `.pulso-main` debe poder scrollear verticalmente cuando una disposición compacta o baja hace que el contenido exceda el alto disponible.
- Los grupos de navegación pueden envolver o hacer scroll interno horizontal.
- El contenido de fase vive dentro de `PageFrame`.

### Regla No Scroll Jail

Ninguna ruta puede dejar contenido vertical inaccesible por una cadena de `height: 100%` + `overflow: hidden`. Si una pantalla aumenta de alto al compactarse, debe existir un dueño de scroll visible y alcanzable.

Reglas:
- El header global se mantiene fijo; el fallback de scroll vive en `.pulso-main`, no en `body`.
- `scrollOwner="page"` significa que el área principal de la app scrollea.
- `scrollOwner="body"` significa que el body del `PageFrame` scrollea internamente.
- `scrollOwner="panels"` mantiene rail/main con scroll interno, pero en `compact`, `short` o `max-height <= 720px` debe degradar a scroll de `.pulso-main` si headers, toolbars o rails envueltos exceden el alto disponible.
- Los contenedores con `overflow: hidden` solo pueden ocultar contenido decorativo o delegar scroll a un descendiente claramente scrollable.

### PageFrame

Es la envolvente de cada pantalla. Declara intención con `layout` y dueño del scroll con `scrollOwner`.

Layouts:
- `document`: lectura o formularios con scroll de página.
- `workbench`: rail + área principal; rail y main scrollean internamente.
- `canvas`: superficie visual con área mínima preservada; paneles colapsan o bajan.
- `data`: tabla o grilla con scroll interno en la superficie de datos.

Scroll owners:
- `page`: el frame/body puede scrollear.
- `body`: el body del frame scrollea.
- `panels`: los paneles internos son dueños del scroll.

Clases emitidas:
- `pulso-page-frame--layout-document`
- `pulso-page-frame--layout-workbench`
- `pulso-page-frame--layout-canvas`
- `pulso-page-frame--layout-data`
- `pulso-page-frame--scroll-page`
- `pulso-page-frame--scroll-body`
- `pulso-page-frame--scroll-panels`

### Workbench

Es la disposición de trabajo con rail lateral y panel principal. Se implementa con `AdaptiveSplitView`.

Reglas:
- Desktop: dos columnas, rail a la izquierda y main a la derecha.
- `<=1180px`: rail compacto.
- `<=900px` o `<=700px` de alto: layout apilado; el rail queda arriba con altura máxima y el main conserva el resto.
- `scrollOwner="panels"`: el contenedor no scrollea globalmente; rail y main son superficies scrollables.

### Canvas

Es una superficie de dibujo, mapa o interacción visual. El canvas preserva un tamaño mínimo usable. Si el alto no alcanza, los paneles secundarios bajan, colapsan o pasan a menú.

### DataSurface

Es una tabla, matriz o grilla densa. La tabla es dueña del scroll y debe evitar que el body de la página genere scroll horizontal accidental.

Reglas:
- Encabezados y acciones pueden quedar sticky dentro de la superficie.
- La tabla usa scroll interno horizontal/vertical cuando los datos no caben.
- Los filtros envuelven controles antes de romper la tabla.

### SelectorGallery

Es una galería de tarjetas o alternativas seleccionables. En compacto reduce columnas y altura de tarjetas, pero conserva etiquetas completas y estados seleccionados visibles.

### MapPanel

Es un panel cartográfico o geográfico. Debe preservar área mínima del mapa y mover filtros, leyendas y acciones a rail, hoja o bloque apilado cuando el alto sea bajo.

## Foco post-navegación

La app aplica una sola política de foco al cambiar de contexto:

- Una navegación de ruta conserva el foco en el enlace activado. El nuevo
  contexto se anuncia actualizando el título de ventana y
  `aria-current="page"`; no se mueve el foco al canvas ni a un encabezado por
  defecto.
- El enlace activo debe seguir montado después del cambio. Si el estado
  responsivo lo desmonta —por ejemplo, al cerrar un drawer— el foco vuelve al
  control que abre la navegación. Solo cuando ese control también deja de
  existir puede pasar al contenedor principal con `tabIndex="-1"`.
- Atrás/Adelante del navegador y la restauración de una sesión no roban el
  foco a un control que todavía existe.
- Las pestañas ARIA de un panel local conservan el foco en la pestaña
  seleccionada. Las flechas cambian la selección según el patrón roving; no
  mueven el foco al panel.
- Flyouts, popovers y diálogos restauran el foco en su disparador al cerrar.
  Escape debe completar esa restauración antes de devolver el control al
  shell.
- La actualización de foco y atributos accesibles no espera a que termine una
  animación.

Esta política aplica igual en sidebar expandido, colapsado y drawer. Las rutas
usan enlaces con `aria-current`; `role="tab"` se reserva a tabs asociados con
un panel local.

## Reglas de implementación

- No mezclar más de un dueño de scroll por pantalla.
- No aceptar `scroll jail`: si un contenedor de layout puede crecer, debe tener `overflow-y: auto` o un ancestro scrollable dentro de `.pulso-main`.
- Las toolbars envuelven controles; acciones secundarias deben pasar a menú cuando ya no caben.
- Las clases locales de módulo son modificadores visuales, no la base del layout.
- En workbenches, los rails usan `pulso-adaptive-rail` y las áreas principales `pulso-adaptive-main`.
- Dashboard mantiene su gramática `dash-*` hasta una migración dedicada.

## QA rápido de layout

Para comprobar layout sin pelear con servidores o navegación manual, usar `scripts/ui-quick-check.mjs`.

Modos:
- Sin proyecto: arranca Vite en un puerto libre, simula lo mínimo de `/api` y captura layout shell.
- Con `--project`: arranca API real y Vite en puertos libres, precarga el `.pulso` y captura la ruta con datos reales.
- Con `--url`: usa un frontend existente; si además recibe `--project`, abre el `.pulso` por API y siembra el `sid` en Playwright.

Ejemplos:

```bash
node scripts/ui-quick-check.mjs --route /validacion --viewport 1366x768 --layout-preset portable-compact
node scripts/ui-quick-check.mjs --project /ruta/proyecto.pulso --route /analitica --viewport 1024x600 --layout-preset short
node scripts/ui-quick-check.mjs --project /ruta/proyecto.pulso --matrix --fail-on-issues
```

Para llegar a una vista profunda se usa `--ir` con la dirección canónica, no
`--click-tab` con el texto visible:

```bash
node scripts/ui-quick-check.mjs --project /ruta/proyecto.pulso --route /monitoreo --ir monitoreo/territorial/avance
```

`--click-tab` sigue existiendo como fallback y es frágil por diseño: depende de
una etiqueta que puede renombrarse, truncarse en viewport compacto o no existir
todavía porque el warm start no terminó.

El reporte debe revisar además `scrollJails`: contenedores de layout con contenido vertical mayor que su caja, sin scroll propio ni ancestro scrollable dentro del área principal.
