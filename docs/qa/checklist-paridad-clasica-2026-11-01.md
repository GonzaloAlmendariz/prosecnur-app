# Checklist: lo que hacía la página clásica de Hojas de ruta y ya no está

Fecha: 2026-11-01. Pedido de Gonzalo tras el retiro de la clásica (2c641554b): «Evaluemos que podríamos usar porque
material ya cubre las fichas y el motor actual entiendo que cubre todo lo que antes cubría el antiguo».

Método: inventario de funciones de `HojasRutaPage.tsx` y sus módulos tal como estaban en `2c641554b^` (leídos con
`git show`, sin restaurarlos), contrastado con el atlas (`frontend/src/features/hojasRuta/mapa/**`) y Material de
campo (`frontend/src/features/recopiladores/territorial/**`). Salieron 68 funciones: 49 cubiertas (igual o de otra
forma), 4 nuevas sin equivalente clásico y 15 que faltan o quedaron más pobres. Abajo solo las que faltan, por
importancia para un analista que arma un estudio territorial. Rescatar algo se hace en archivo nuevo del atlas, con
el código viejo como referencia (`git show 2c641554b^:<ruta>`), nunca restaurando la página.

Estados: ☐ pendiente · ◐ en curso · ☑ hecho (con commit) · ⛔ bloqueado (decisión).

| # | Falta o quedó más pobre | Dónde vivía (2c641554b^) | Dónde viviría hoy | Estado |
|---|---|---|---|---|
| P1 | Ver la otra corrida (Piloto ↔ Campo real) y crear la de campo desde el piloto. La etapa del estudio la declara el Planner (ADR 0122, `hojas_ruta_etapa.R`) y el atlas solo la muestra en un chip; `apiHojasRutaSetPhase` y `apiHojasRutaCreateFieldFromPilot` quedaron sin consumidor. Sin Planner que declare la etapa, no hay cómo pasar a campo desde la interfaz | `PhaseHeaderControl`, `changePhase` (C:1050-1125, C:7044) | Chip de fase de la barra (`HojasRutaMapaPage.tsx:557`) como selector | ☑ (este commit) opción (a), decidida por coordinación con la Q3 de Gonzalo y el ADR 0123 §6: la etapa es la corrida que mira Hojas y el Planner propone. `state_payload` ya no aterriza en la del Planner (una sola fase en juego: los cálculos sin `phase`, el envío y la campaña usan la visible); la barra abre la otra corrida, muestra «Planner: X · Alinear» si difieren y «Crear Campo real» con un campo sin muestra ni envío; `/field/from-pilot` responde 409 `E_HOJAS_RUTA_CAMPO_CON_MUESTRA` si lo pisaría. Salidas dice qué corrida se envía. Dos revisiones de guardian-contratos (la segunda halló N1: `planner` NULL salía `{}`; corregido con test HTTP) |
| P2 | Regla de exclusión del piloto en Campo real («Evita titulares» / «No evita piloto») y ver en el mapa las titulares del piloto que se excluyen | `setPilotExclusionMode` (C:1104-1120, C:7058); `pilotTitularIds` (C:8128) | Inspector de Manzanas, junto al método; capa del lienzo | ☑ (este commit) la regla, en el inspector de Manzanas como último paso (sólo en Campo real con piloto): se guarda en la corrida de campo sin borrar la muestra y avisa si la vigente se sorteó con la otra. Verificado en vivo con acnur_acg (6 titulares del piloto). Ver las excluidas en el mapa queda pendiente |
| P3 | Margen y DEFF ajustados por distrito (`margin_district_overrides`, `design_effect_overrides`): se conservan pero no se ven ni se editan | C:6049-6100, C:7496, C:7508 | Inspector de Muestra › reparto por distrito (`MuestraPaneles.tsx`) || ☑ (este commit) «Ajustes por distrito» bajo el reparto de Muestra, sólo en modo calculado: margen (±%) y DEFF por distrito en una `PulsoTable`, al mismo borrador del inspector; vacío vale el general. Un mapa vacío que llega como `[]` se normaliza. En acnur_acg la muestra es por distrito y no aparece |
| P4 | Cuotas antes de sortear: ya no hay «Calcular cuotas»; la matriz de cuotas aparece sólo con el sorteo | `previewQuota` (C:7219), `QuotaMatrixPreview` (C:5233) | Muestra › «Ver cuotas» (`MuestraCajon.tsx`), con `apiHojasRutaQuotaPreview` || ☑ (este commit) el cajón de Muestra ofrece «Calcular cuotas» cuando hay tamaño guardado y todavía no hay cuotas (`/api/hojas-ruta/quota-preview`, que las guarda en las salidas); «Ver cuotas» se habilita con el tamaño guardado, no sólo con la muestra |
| P5 | Avisos de población y de cuotas (`population.alerts`, `quota.alerts`) y el aviso de cuotas que no cuadran en los chips de la selección | C:8045-8052, C:8463-8470, `chipsDeSeleccion.ts` | Inspectores de Población y Selección | ☑ (este commit) `AvisosDelMotor`: los avisos de `population.alerts` en el inspector de Población (con la matriz vigente) y los de `quota.alerts` más «las cuotas reparten X y el N es Y» en el de Selección; sin los de nivel info ni repetidos. En acnur_acg sólo hay info y las cuotas cuadran (1.200/1.200): no aparece nada, como corresponde |
| P6 | Aviso de cartografía del marco: nota del motor y auditoría contra la cartografía oficial (manzanas sólo-oficial / sólo-activa); estado «marco no disponible» | `MarcoCartografiaAviso.tsx`, `marcoCartografia.ts` (C:7673, C:7790) | `MarcoTerritorial` en `TerritorioPaneles.tsx:282` | ☐ |
| P7 | Explicación metodológica del N: cadena de fórmulas (z²pq/e², ×DEFF, FPC, redondeo a rutas, garantía distrital), criterios estadísticos, semáforos de decisión y la recomendación automática de DEFF | C:6126-6190, C:6337-6395, C:5938-6000 | «¿De dónde sale este N?» en `MuestraPaneles.tsx:245` | ☐ |
| P8 | Revisión contra el marco: la tira de viviendas por manzana (escala log) y la tabla por distrito | `seleccion/RevisionContraMarco.tsx` | Inspector de Selección › Revisión (`SeleccionPaneles.tsx:212`) | ☐ |
| P9 | Menores: matriz agrupada por ubigeo y `row_var` en el Excel; quitar un ruteo del historial; capa de contexto OSM; totales del marco (manzanas, viviendas, población); hojas de zona y versión del marco en las descargas | C:7896, C:8445, C:4273, C:7830, C:8717 | Varios | ☐ |
| P10 | Etapas sin marca de «hecho» en el rail | `hojasRutaNavigation.ts` | `SectionPillbar` | ☑ decidido: las etapas no bloquean (ADR 0114 §4, D3); cada inspector dice qué falta |

## Notas

- Las funciones nuevas que no tenía la clásica: atlas de ciudades del Perú, comparar semillas, marco elegible,
  «¿se parece al marco?», cuotas por ficha, bitácora, informe de diseño y plan de campo.
- P1 y P2 son las únicas que impiden hacer algo (no sólo verlo). El resto es información que ya calcula el motor.
