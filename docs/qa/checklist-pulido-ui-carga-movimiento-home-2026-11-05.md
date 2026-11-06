# Checklist — pulido de UI: cargas, fondo, movimiento y Home (2026-11-05)

Pedido de Gonzalo (textual): «Revisa todo lo que hace la app con sumo detalle y revisas cuestiones de UI front end que
podría ser más finas o claras, por ejemplo las ventanas de carga de módulos aún no está estandarizada, el fondo de carga
aún tiene tarjetas como módulos pero puede tener más para que el fondo se vea más completo, puede tener un sistema de
animación más sofisticado y universal, puede tener un homepage más elegante y que ocupe mejor el espacio, en general».
Después: «haz cambios sustanciales y sostenidos durante un loop que vaya toda la noche sin consultarme de 30 min cada uno».

Proyecto de observación: copia `outputs/reference-runs/acnur_acg-20260731-093312/acnur_acg.pulso` (API 8804, Vite 5173).

| # | Ítem | Dónde vive | Hallazgo medido | Estado |
|---|---|---|---|---|
| 1 | Ventanas de carga estandarizadas | `app/BootGate.tsx` (`WarmupView`), `app/ModuleWarmupBoundary.tsx` (`ModuleWarmupScreen`), `components/CargaDeModulo.tsx`, `components/States.tsx` (`LoadingBlock`), `components/CargaDeBloque.tsx` | Tres pantallas distintas para la misma idea: el arranque del proyecto (lámina translúcida + fases con detalle), el arranque del módulo (lámina opaca + fases con reloj propio) y el salto corto (rótulo + barra, sin isotipo). Más 87 `<LoadingBlock>` y 37 `<CargaDeBloque>`. Cada una con su CSS (`boot.css` 1.365 líneas, `module-warmup.css`, `carga-de-modulo.css`). **Hecho para las dos pantallas completas (d3fe6e522)**: `app/PantallaDeCarga.tsx` + `pantalla-de-carga.css` la dibujan el arranque del proyecto y el del módulo; −699/+477 líneas, se retiran `module-warmup.css` y `boot-destino.css`. Verificado en vivo abriendo `/validacion` (tono del módulo, silueta con rail). Pendiente: alinear el salto corto (`CargaDeModulo`) y `LoadingBlock` al mismo lenguaje. | ◐ |
| 2 | Fondo de carga más completo | `components/VistaSkeleton.tsx` + `vista-skeleton.css`; lo montan `BootGate` (`WarmupDestino`) y `ModuleWarmupScreen` | Variante `inicio`: 8 tarjetas grises en 2 filas de 5 columnas que llenan ~⅓ del alto; los ⅔ de abajo quedan vacíos (captura a 1440×900). Las tarjetas no dicen de qué módulo son: sin color ni ícono. **Hecho (2cf80fd90)**: la silueta de inicio es el Home (cabecera, 4 cifras, una tarjeta por cada uno de los 7 módulos activos con filete, ícono y avance en su tono, franja de actividad que baja hasta el borde); la de módulo suma el rail de pestañas y estira los paneles. Verificado en el warm start real a 800 px de pane y typecheck + gate-front (717/717). | ☑ |
| 3 | Sistema de animación sofisticado y universal | `app/tokens.css:92-102` (tokens `--motion-*`), 88 hojas con `@keyframes` | Los tokens existen y se usan (`--motion-dur-fast` 1.283 veces, `--motion-ease-out` 1.057), pero no hay vocabulario compartido de keyframes: **274 nombres distintos** de `@keyframes` en 88 hojas (`cmv2-*-enter`, `dash-*-fade-in`, `home-*-in`, `pulso-av2-fade-up`…, casi todos el mismo «sube y aparece»). 641 duraciones literales en `transition/animation`. Sin transición entre rutas ni entrada coordinada de la vista. | ☐ |
| 4 | Home más elegante que ocupe mejor el espacio | `features/home/HomePage.tsx`, `MissionControl.tsx`, `ModuleCarousel.tsx`, `ModuleStatusCard.tsx`, `home-v2.css` (2.896 líneas) | Pendiente de observación con proyecto abierto (el warm start de `acnur_acg` tarda > 2 min). | ☐ |
| 5 | Selector de proyecto (sin proyecto) | `BootGate.tsx` `ChooserView`, `boot.css` | Caja de ~840×370 centrada en un lienzo de 1440×900: ~75 % de la ventana vacía; el panel «Proyectos recientes» vacío ocupa la mitad de la caja. | ☐ |
| 6 | Fases del warm start del proyecto se contradicen | `BootGate.tsx` `warmupDisplaySteps` | A 93 % la fase en curso se rotula «Listo» con spinner girando (reloj 0:59 → 2:01) y debajo «Listo para trabajar» pendiente. La lista cambia de filas mientras avanza (aparecen y desaparecen pasos) y el reloj de «Ordenando hojas de ruta» volvió de 0:16 a 0:09. La barra queda > 1 min clavada en 93 % sin decir qué falta. | ☐ |
| 7 | Recorrido fino por módulo (claridad y finura) | los siete módulos | Se recorre en el loop, módulo por módulo, con capturas. | ☐ |

Estados: ☐ pendiente · ◐ en curso · ☑ hecho y verificado · ⛔ bloqueado (exige decisión).
Sólo Gonzalo da el checklist por terminado.
