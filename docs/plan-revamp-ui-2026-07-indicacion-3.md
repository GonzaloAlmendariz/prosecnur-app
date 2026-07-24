# UI v3 — Indicación 3: el workbench protege su superficie primaria

> Indicación del dueño, 2026-07-24. Esta indicación se ejecuta de inmediato y
> se revisa dentro del bucle; no abre un gate de aprobación.

## 1. Hallazgo que origina la indicación

El sidebar no puede considerarse correcto si, al ganar navegación, empobrece
la superficie que sostiene el trabajo. Hojas de Ruta hace visible el problema:
el mapa es una de sus piezas fundamentales y, con chrome horizontal residual y
el sidebar expandido, pierde ancho y alto hasta volverse secundario; sus
controles, leyenda y tarjetas terminan compitiendo entre sí.

El baseline del piloto lo confirmó en vivo a `1024×600`:

- mapa de `328×192px` con rail de `248px`;
- solape de `174×31px` entre leyenda e información;
- stepper horizontal fuera de su caja e interceptando controles;
- toolbar operativa de `156px` de alto aun después de retirar navegación.

La robustez del workbench significa conservar y mejorar estas vistas ricas, no
solo evitar overflow global.

## 2. Chrome global: el archivo y Home viven en el sidebar

En workbenches ricos (clases A–D) no existe una franja horizontal persistente
de shell encima del lienzo.

- Proyecto/archivo, estado de guardado, acceso a Home y utilidades globales
  migran al sidebar.
- Los `52px` siguen siendo la altura del **header del sidebar**; dejan de
  reservar una fila horizontal sobre el canvas.
- La esquina superior izquierda continúa teniendo un único dueño y el canvas
  comienza en `y=0`.
- Mission control y pantallas no-workbench pueden declarar otra composición,
  pero no reintroducen una «L» global sobre estas ventanas.

Esto supersede, para workbenches ricos, la lectura previa de la guía/ADR que
reservaba un header contextual horizontal de `52px` para proyecto, sesión,
archivo y Home.

## 3. Navegar sigue separado de operar

Mover el chrome global no convierte controles operativos en navegación:

- etapas, secciones y pestañas viven en el sidebar;
- KPIs, readiness, avisos y Piloto/Campo real pertenecen al lienzo;
- esa command surface local debe ser compacta, puede envolver de forma
  deliberada y nunca ocultar readiness;
- ninguna acción operativa se mueve al árbol del sidebar solo para ganar
  espacio.

En Hojas, la banda local ya no contiene el stepper ni los tabs de Entrega. Su
único trabajo es resumir el marco y permitir operar la fase.

## 4. Superficie primaria y preferencia de rail por sección

El manifiesto/runtime puede declarar una preferencia de rail por sección:

- Hojas `territorio` y `manzanas`: `railMode: "collapsed"` al entrar, porque el
  mapa es la superficie primaria;
- Hojas `poblacion`, `muestra` y `entrega`: `railMode: "expanded"`;
- la preferencia se aplica al cambiar de sección; el usuario puede expandir o
  colapsar manualmente mientras permanezca en ella.

No es un tercer ancho ni un overlay: siguen existiendo únicamente `248px` y
`64px`, ambos empujando el lienzo.

## 5. Gate medible del piloto Hojas

Hojas no aprueba hasta demostrar, en `1361×987` y `1024×600`, ambos estados
del rail y las etapas cartográficas:

1. el mapa es la superficie visual dominante y, a `1024×600` con rail
   recomendado, conserva al menos `500×250px` útiles;
2. controles de zoom, leyenda, información y selector cartográfico tienen
   regiones propias, con intersección `0`;
3. el canvas empieza en `y=0`, sin header global persistente;
4. proyecto/archivo, guardado y Home son alcanzables desde el sidebar;
5. KPIs, readiness y Piloto/Campo real permanecen visibles, sin navegación
   duplicada ni intercepción de puntero;
6. Hojas conserva su acento canónico `#C2410C` sin teñir el mapa ni los estados
   semánticos.

El mismo criterio se aplica después a cualquier workbench cuyo mapa, editor,
tabla o canvas sea su razón de ser.
