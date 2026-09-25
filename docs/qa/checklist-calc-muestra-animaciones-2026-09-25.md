# Checklist — Animaciones de aulas llevadas a Muestra general y Acreditación (E16)

Tipo: Checklist vivo · Fecha: 2026-09-25 · Etapa E16 del loop de Cálculo de muestra

Pedido de Gonzalo (textual): «Sigue mejoranod ls estetica, fijte en las
animaciones de aulas y aprende de ellas».

## Lo que aulas enseña (inventario)

- Tokens canónicos (`app/tokens.css:92-102`): `--motion-dur-press` 120 ms,
  `-fast` 160, `-base` 220, `-panel` 280, `-slow` 420; `--motion-ease-out`
  (0.23, 1, 0.32, 1), `-in-out`, `-standard`, `-drawer`.
- Entrada de pestaña: opacity + translateY 4 px, 180 ms ease-out, al montar
  (`universidad/ui/ui.css:30,52`).
- Cascada `cmv2-uni-stagger > *`: sólo opacity, 230 ms, +35 ms por hijo,
  tope 200 ms (`ui.css:35-44`).
- Swap de cifras: blur 3 px + opacity 0.55, 180 ms, sólo entre dos valores
  reales (`useValorSwap`, E15 AD5).
- Barras que crecen: scaleX 350–450 ms con `120 ms + fila·20 ms` de retraso
  (`aulas.css:787-806`).
- Press: scale 0.96–0.97 con `--motion-dur-press`; hover sólo con
  `(hover: hover)`.
- Reduced-motion: movimiento fuera, color/opacity quedan; red global en
  `calcMuestra.css:5389`.

No se copia: animar `width`/`height`/`left`; loops largos (beam 3 s, goo
3.4–5.6 s, pulso del rail 2 s); `scale(1.3)` del stepper; tooltip que
re-renderiza y mide en cada `mousemove`; cascadas en tablas largas.

## Ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| M1 | La banda «Diseño vigente» entra en cascada (la clase `cmv2-uni-stagger` estaba en el contenedor de un único hijo) | `general/BandaDiseno.tsx`, `mesa.css` | ☑ `cmv2-uni-stagger` en la banda; test e16-movimiento |
| M2 | Cambiar de pestaña anima la entrada del cuerpo (Marco no animaba: su wrapper persistía) | `general/PestanasMesa.tsx`, `MesaGeneral.tsx` | ☑ `useEntradaPorCambio` alterna `data-entrada` a/b: la sonda ve `cmg-entra-a/b` en cada cambio de pestaña, sin remontar |
| M3 | Barras del reparto crecen escalonadas por fila y serie (N, a campo, n), con transform; el cambio Tamaño/Fracción transiciona en vez de saltar | `general/RepartoEstratosGrafico.tsx`, `mesa.css` | ☑ `cmg-reparto-crecer` (scaleX) escalonado: 8–12 barras al entrar en Corrida y Resultados |
| M4 | La cadena «cómo sale el n» entra escalonada | `general/MetodoGeneral.tsx`, `mesa.css` | ☑ cadena en cascada (`cmg-funde` en `cmv2-uni-flujo-etapa/arista`) |
| M5 | Pasos de la memoria en cascada; las cifras de la tabla de Resultados cruzan con swap al recalcular | `MemoriaCalculoGeneral.tsx`, `ResultadosComponentes.tsx` | ☑ `cmg-memoria-paso` en cascada de 33–50 ms; `SwapValor` en el n de Resultados |
| M6 | Tarjetas de actor: press (scale 0.97), hover con `(hover:hover)`, entrada en cascada | `general.css`, `SelectorActor.tsx` | ☑ press 0.97 + hover bajo `(hover:hover)`; test e16-movimiento |
| M7 | Chips de estado cruzan (color/opacity) al cambiar | `general.css`, `FichaCorrida.tsx` | ☑ transición de color/opacity en chips de `FichaCorrida` |
| M8 | Hover de fila del reparto con transición 120 ms | `mesa.css` | ☑ hover de fila con `--motion-dur-press` |
| M9 | Todo con tokens `--motion-*`, sólo transform/opacity/filter, ≤ 300 ms, reduced-motion respetado, sin animación en cada render | general/** | ☑ sonda en vivo: todas las animaciones arrancan dentro de ~1,2 s y luego 9 s sin ninguna; con `reduce`, 0 animaciones de entrada |

## Evidencia (2026-09-25)

- Gate front: 269 archivos / 2492 tests, `tsc` 0, `--audit` OK.
- ui-quick-check general (4 rutas × 1440/1024): `geometryIssues=0`; el
  `ok=false` sale sólo de 34 `geometryCoverageMisses` de KaTeX (`vlist-t`),
  que ya existían en HEAD. Acreditación: `ok=true`, 14 capturas.
- Sonda de `animationstart` por dirección (`__pulsoNav.ir`): Ficha, Memoria,
  Estratos, Corrida y Resultados.

Pendiente anotado (fuera del glob de E16): la entrada de pestaña usa 160 ms
(no hay token de 180); la red global de reduced-motion en
`calcMuestra.css:~4881-4888` y `~5392` también aplana transiciones de color.
