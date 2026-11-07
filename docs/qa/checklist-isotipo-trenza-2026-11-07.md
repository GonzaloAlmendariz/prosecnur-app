# Checklist · isotipo «Trenza» a vector y a la app (2026-11-07)

Tipo: Checklist de pedido
Estado: En curso
Fecha: 2026-11-07
Autoridad: Seguimiento del ADR 0132; no reemplaza al ADR

Pedido de Gonzalo: «Sí, a vector». Es decir, pasar la Cuerda abierta a vector final y llevarla a la app. Decisión
en el [ADR 0132](../adrs/0132-isotipo-trenza.md). Sólo Gonzalo da este checklist por terminado.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Geometría única de la Cuerda abierta (siete cintas continuas, filos, huso diagonal, variante chica) | `frontend/src/app/marca/trenzaGeometria.ts` | Hecho |
| 2 | Generador de la suite de marca desde esa geometría | `branding/logo/generar-isotipo.mjs` | Hecho |
| 3 | Diez SVG canónicos regenerados, más `isotipo-chico` y `modulos/` (siete colores) | `branding/logo/` | Hecho, revisado en Chrome |
| 4 | Variantes en una tinta (mono negro, mono blanco calado) sin manchas: sólo hilos de adelante | `generar-isotipo.mjs` | Hecho, revisado |
| 5 | Instalador de Windows: `icon.svg`, `header.svg`, `wizard.svg` | `packaging/windows/brand/` | Hecho, revisado con rsvg |
| 6 | Íconos raster: `icon.png` de Electron, `favicon.ico`, `icon.icns` | `desktop/assets/`, `frontend/public/`, `packaging/macos/build-resources/` | Generados; `.ico` de Windows se deriva en su build |
| 7 | Componente estático `IsotipoTrenza` (colores por CSS, sin hex de módulo) | `frontend/src/app/marca/IsotipoTrenza.tsx`, `isotipo.css` | Hecho |
| 8 | `IsotipoCarga`: entrada que acelera hacia un giro continuo, respiración, nunca desaparece; firma que se asienta; quieto con movimiento reducido | `frontend/src/app/marca/IsotipoCarga.tsx` | Hecho, medido 1,8 ms/cuadro |
| 9 | Carga del proyecto: isotipo en el tono del módulo destino, navy hacia el Home | `PantallaDeCarga.tsx` | Hecho, visto en Vite |
| 10 | Carga de módulo y bloque de carga en el tono del módulo | `CargaDeModulo.tsx`, `States.tsx` | Hecho, visto en Vite |
| 11 | Header (`BrandMark`) y selector de proyecto (`BootBrandMark`, firma) | `BrandMark.tsx`, `BootGate.tsx`, `boot.css` | Hecho |
| 12 | Los íconos de módulo no cambian | dock, rails, cards | Sin cambios, por decisión |
| 13 | Retirar `BootEcualizador` y bajar el contrato de movimiento | `movimiento.contract.test.ts` | Hecho (infinitas −1, retardo 5 → 3) |
| 14 | Tests que buscaban `boot-eq` | `CargaDeModulo.test`, `LoadingBlock.test`, `ModuleWarmupBoundary.test` | Hecho |
| 15 | ADR 0132, índice de ADR y nota en la dirección creativa | `docs/adrs/`, `branding/direccion-creativa-v3.md` | Hecho |
| 16 | `identity.json` 1.5.0: decisión `dec-isotipo-trenza`, reglas de marca y hash; tokens y referencia regenerados | `branding/identity.json`, `branding/identity/` | Hecho, validador VALID |
| 16b | Excepción de movimiento `motion-isotipo-trenza` y la firma de marca actualizada | `branding/identity.json` | Hecho, validador VALID |
| 17 | Manual de identidad: 24 figuras del ecualizador y la firma de pastillas | `branding/manual-identidad.html` | Hecho: las celdas de variantes incrustan los SVG generados, el resto de figuras y la firma animada usan la misma geometría (sin errores de consola); mirror de vuelta a `current` |
| 18 | Ícono en el build empaquetado (Dock de macOS, instalador de Windows) | `packaging/` | Pasos de ícono de `build-dmg.sh` y `build-self-contained.sh` reproducidos: en 16 px los siete hilos se empastaban, así que 16 y 32 px salen ahora de la variante de cinco hilos (`prosecnur-appicon-chico.svg`, `icon-chico.svg`). No se corrió el build completo ni se instaló |
| 19 | Mirarlo en la app real con un proyecto abierto (header en contexto, carga del proyecto a pantalla completa) | `/ver-ui` | Hecho por `qa-visual-desktop` con acrconta y acnur_acg: header navy y alineado en 1440 y 1024; carga del proyecto en el tono del destino (Monitoreo, Hojas de ruta) y navy hacia el Home, girando y sin desaparecer (539 y 1.279 muestras, 0 ausencias); carga de módulo en los siete tonos; firma que termina en la pose quieta; contraste mínimo 4,3:1; 0 errores de consola e ids únicos |

## Lo que el QA encontró fuera del isotipo

No vienen del cambio de isotipo; quedan anotados para otra unidad.

- **Barra de `CargaDeModulo` casi invisible:** el bloque se encoge al ancho de su contenido (194 px), así que la
  barra queda en 92 px, y su pista no contrasta con el fondo (~1,0). Pasa también con la barra determinada de
  la carga del proyecto cerca del 1 %. Vive en `components/carga-de-modulo.css` y en la barra del kit.
- **Ceja y rótulo repetidos** en `CargaDeModulo` («CÁLCULO DE MUESTRA / Cálculo de muestra») en el primer instante.
- **`PantallaDeCarga`:** la lámina se recentra y baja unos 86 px cuando colapsa la lista de fases (C2), y a
  1024x600 hay 14 px de scroll de página.
- No se observó `LoadingBlock` en vivo, y Windows no se probó (sólo Chromium en macOS).

## Lo aprendido

- El test de `ModuleWarmupBoundary` prohíbe cualquier `\d+%` en el HTML de la carga corta (no debe haber cifra de
  avance). Por eso la mezcla de color de los hilos no va inline: cada parada lleva `--k` y `isotipo.css` arma el
  `color-mix(... calc(var(--k) * 100%) ...)`.
- En una tinta, los hilos de atrás se leen como manchitas del mismo color que los de adelante; por eso se omiten.
- Los SVG del isotipo se arman con `branding/logo/isotipo-svg.mjs`, que también sirve para incrustarlo en documentos.
- Node 25 importa el `.ts` de la geometría sin compilar. El archivo no debe tener imports ni sintaxis que no sea
  borrable (`enum`, `namespace`).
