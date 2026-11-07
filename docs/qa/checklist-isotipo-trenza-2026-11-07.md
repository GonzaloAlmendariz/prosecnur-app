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
| 17 | Manual de identidad: 24 figuras del ecualizador y la firma de pastillas | `branding/manual-identidad.html` | **Pendiente** (mirror marcado `stale`) |
| 18 | Ver el ícono nuevo en un build empaquetado (Dock de macOS, instalador de Windows) | `packaging/` | **Pendiente**: no se corrió build de packaging |
| 19 | Mirarlo en la app real con un proyecto abierto (header en contexto, carga del proyecto a pantalla completa) | `/ver-ui` | **Pendiente**: se vio con los componentes montados en Vite, sin proyecto |

## Lo aprendido

- El test de `ModuleWarmupBoundary` prohíbe cualquier `\d+%` en el HTML de la carga corta (no debe haber cifra de
  avance). Por eso la mezcla de color de los hilos no va inline: cada parada lleva `--k` y `isotipo.css` arma el
  `color-mix(... calc(var(--k) * 100%) ...)`.
- En una tinta, los hilos de atrás se leen como manchitas del mismo color que los de adelante; por eso se omiten.
- Node 25 importa el `.ts` de la geometría sin compilar. El archivo no debe tener imports ni sintaxis que no sea
  borrable (`enum`, `namespace`).
