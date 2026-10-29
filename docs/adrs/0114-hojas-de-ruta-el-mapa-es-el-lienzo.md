# ADR 0114: Hojas de ruta — el mapa es el lienzo

Estado: Aceptado

Implementacion: Pendiente (plan `docs/qa/plan-revamp-hojas-mapa-2026-10-29.md`, unidades U1–U20)

Fecha: 2026-10-29

Fecha de decision: 2026-10-29. Gonzalo aprobó el prototipo (artefacto «Hojas de ruta», versión 8) y respondió las
cuatro decisiones del plan: secciones en la barra superior, avance de campo en Monitoreo, entrar y ver qué falta, y
marco elegible con ADR y revisión metodológica.

Reemplaza: —

Extiende: [ADR 0009](0009-hojas-ruta-fases-piloto-campo-real.md) (fases Piloto y Campo real),
[ADR 0042](0042-chrome-modulo-uniforme-topbar.md) (chrome uniforme con top bar),
[ADR 0044](0044-jerarquia-y-direcciones-de-navegacion.md) (direcciones) y
[ADR 0108](0108-material-de-campo-catalogo-de-materiales-por-unidad.md) §5 (secciones de Hojas de ruta).

## Contexto

Hojas de ruta es hoy una página de 8.908 líneas (congelada) que recorre Territorio → Población → Muestra → Manzanas →
Selección como una secuencia de formularios. El mapa aparece en cada sección como un panel más. El revamp de octubre
de 2026 pasó por cuatro propuestas que Gonzalo rechazó: las tres primeras construían sobre las pantallas existentes y
la cuarta era una ficha en prosa. Al final aprobó una reimaginación con el mapa como centro. El checklist
`docs/qa/checklist-revamp-hojas-mapa-2026-10-28.md` lleva la paridad con el módulo actual (§7) y las capacidades
nuevas (§8 y §9).

Dos hallazgos del prototipo condicionan la implementación:

- **Rendimiento:** dibujar la cartografía INEI de seis distritos (39 mil manzanas) con un único `Path2D` por capa
  tardaba 9,6 s en armarse. Con un `Path2D` por manzana, el recorte a lo visible y una capa base cacheada, baja a
  0,6 s, y cada cuadro cuesta 16 ms o menos.
- **Paridad del cálculo:** el port a JS del cálculo de tamaño de `hojas_ruta_engine.R` dio exactamente lo mismo que R
  sobre `acnur_acg` (392 · 624 · 1.200 · ±2,83 % · 1.334 contactos).

## Decisión

### 1. El mapa es el lienzo y la página tiene cinco regiones

Bajo la top bar uniforme (ADR 0042) la página se organiza en:

1. **Barra del documento:** fase y regla del piloto (ADR 0009), lo decidido (territorio, población, N y margen, UMP),
   las titulares por revisar, la bitácora y el envío a Material.
2. **Estructura** a la izquierda: la lista de la sección (distritos, rangos de edad, reparto, ruteos, rutas).
3. **Lienzo** al centro: un mapa Canvas único que persiste entre secciones y cambia de capa y de encuadre según la
   sección.
4. **Inspector** a la derecha: los controles y la ficha de lo seleccionado.
5. **Cajón inferior** para las tablas anchas (matriz poblacional, cuotas, titulares, reemplazos), abierto como panel.

No hay un rail de secciones dentro de la página: el prototipo lo usaba, pero duplica la dimensión Sección, que vive
en la top bar (ADR 0044). **Decisión D1 de Gonzalo.**

### 2. Las secciones y sus direcciones no cambian

Se mantienen las cinco secciones del ADR 0108 §5, con los mismos ids. No hay migración de estado guardado ni de
enlaces:

| Sección | Id (sin cambio) | Qué hace en el lienzo |
|---|---|---|
| Territorio | `territorio` | Mapa de los 50 distritos de Lima y Callao; clic agrega o quita del borrador |
| Población | `poblacion` | Coropleta de la población objetivo; rangos de edad en la estructura |
| Muestra | `muestra` | Rótulos por distrito con N y margen; motor en el inspector |
| Manzanas | `manzanas` | Sorteo de UMP: marco elegible, áreas excluidas, zonas que no alcanzan |
| Selección | `seleccion` | Titulares protagonistas y reemplazos discretos; ficha de la UMP |

- **«Entrega» no vuelve como sección.** El ADR 0108 la retiró y Gonzalo lo confirmó el 2026-10-16. Lo que el
  prototipo agrupaba en «Entrega» (ZIP, Excel, reemplazos puntuales, PDF de prueba, plan de campo, informe y envío a
  Material) vive en Selección, en el panel `salidas` que ya existe (`?seccion=seleccion&panel=salidas`). El alias
  `entrega → seleccion` sigue leyéndose.
- **Las pestañas de Selección** (Cuotas, Titulares, Reemplazos, Revisión) pasan a ser pestañas del cajón de tablas.
  La revisión queda como filtro «Por revisar» de la lista y en la ficha. Sus direcciones `&pestana=` se siguen
  leyendo y abren el cajón en esa tabla.
- **El rótulo de Manzanas** puede leerse como «Manzanas» en la top bar y como «Sorteo de manzanas» en el
  inspector. El id no cambia.

### 3. Paneles nuevos (todos direccionables, ADR 0044)

| Panel | Clase | Dirección |
|---|---|---|
| Tablas (cajón) | — (pestaña) | `?seccion=seleccion&pestana=<titulares\|reemplazos\|cuotas>` (ver la enmienda abajo) |
| Hoja de ruta de una UMP | `dialogo` | `?seccion=seleccion&panel=hoja&foco=<id_manzana>` |
| Hoja del día de un encuestador | `dialogo` | `?seccion=seleccion&panel=hoja-dia&foco=<n>` |
| Bitácora de decisiones | sección de `salidas` hasta U20 | `?seccion=seleccion&panel=salidas` (luego `&panel=bitacora`) |
| Informe de diseño muestral | `dialogo` | `&panel=informe` |
| Envío a Material | `dialogo` | `&panel=envio` |

La UMP fijada en Selección es `&foco=<id_manzana>`.

*Enmienda de implementación (2026-10-29, revisión de contratos de la fase 3, I3 e I4).* `foco` tenía dos significados
(la UMP y la tabla del cajón), y la ficha y el cajón abiertos a la vez no cabían en una URL. Además solo existe un
`?panel=` a la vez, así que `tablas` y `salidas` se excluían. Queda así:

- la tabla del cajón es la **pestaña** que el manifiesto ya declara (`&pestana=titulares|reemplazos|cuotas`); la
  pestaña `revision` no abre cajón, porque la revisión vive en el inspector;
- `foco` queda **solo** para la UMP;
- `salidas` es el único panel de Selección y se abre sobre lo que haya (cajón o ficha).

*Enmienda de U17.* Mientras la página clásica sea la de por defecto, el QA recorre `PANELES_POR_MODULO` sobre ella,
y un `?panel=bitacora` que solo existe en el lienzo abriría nada. La bitácora vive como sección del panel `salidas`,
que ya está declarado y montado en las dos páginas. Pasa a panel propio con el retiro de la página clásica (U20).

Implementado con `useFoco` (`lib/navegacion/useFoco.ts`) y `useSeleccionDireccion` (`mapa/seleccion/`), con
`replace` para no llenar el historial. La matriz poblacional y el reparto de Muestra no usan cajón: viven en su
inspector y estructura. Los paneles se declaran en `PANELES_POR_MODULO` y se abren con
`usePanelDireccionable`, nunca con un `useState` suelto.

### 4. Las etapas no bloquean la entrada

Se puede entrar a cualquier sección. La que no está lista muestra qué le falta y por qué (por ejemplo: «Confirma al
menos un distrito»), y sus acciones quedan deshabilitadas con el motivo. Nunca aterriza muda en otra sección.
**Decisión D3 de Gonzalo.**

### 5. El avance de campo vive en Monitoreo

El avance por UMP y la activación de reemplazos con motivo (ítems A1 y A2 del checklist) se montan en Monitoreo
territorial, que ya lee `hojas_ruta_runs` (`router_monitoreo.R:618`), sobre el mismo componente de lienzo. Hojas de
ruta enlaza, pero no duplica la navegación. El envío a Material (A3) espera la campaña territorial de E2
(ADR 0111). **Decisión D2 de Gonzalo.**

### 6. El motor de R es la fuente de verdad

- El N, las cuotas y el sorteo salen de `api/R`. El front puede llevar un **espejo en TS del cálculo de tamaño** para
  la vista previa instantánea, siempre que un test de contrato pruebe que cuadra con R en al menos dos proyectos de
  referencia. Al guardar o sortear, manda R.
- Toda lógica nueva va en archivos propios (`api/R/hojas_ruta_<tema>.R`, `features/hojasRuta/mapa/**`):
  `hojas_ruta_engine.R` y `HojasRutaPage.tsx` siguen congelados.
- **Lo que cambia el diseño muestral necesita su propio ADR.** El mínimo de viviendas por manzana, las áreas
  excluidas con motivo y el N inflado por no respuesta llevarán ADR y `revisor-metodologico` antes de implementarse
  (unidad U11). **Decisión D4 de Gonzalo.**

### 7. Contrato de la geometría

`GET /api/hojas-ruta/geometria?ubigeo=` entrega, por distrito y en metros con un origen común para Lima y Callao:

- manzanas: id, viviendas, zona y NSE por nivel en texto (el código numérico va al revés de lo que se supondría: 5 = Bajo);
- vías mayores con su nombre;
- zonas censales.

Las geometrías van simplificadas con Douglas-Peucker; los anillos cerrados se parten en su punto más lejano para que
no colapsen. Va con gzip y desde la caché local de cartografía. El lienzo carga un distrito cuando se confirma, no
todo Lima.

### 8. Convivencia y retiro

La página nueva se monta detrás de un interruptor hasta cubrir la paridad del checklist §7. Al retirarse la página
vieja se aplica el gate 3 (borrado con doble confirmación) y se baja su línea base en `agentic/manifest.json`.

## Consecuencias

- Una sola superficie cartográfica para todo el módulo y, después, para Monitoreo territorial.
- Las direcciones guardadas siguen funcionando: no hay ids nuevos de sección.
- Durante la convivencia hay dos implementaciones. El interruptor y la fecha de retiro (U20) acotan ese costo.
- El espejo en TS agrega un test de contrato que hay que mantener si cambian las fórmulas del engine.
