# Checklist · Monitoreo territorial: Avance, Control y el mapa (2026-10-27)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-27
Autoridad: Pedidos de Gonzalo en la sesión del 2026-10-27; sólo él da por terminado un ítem

Proyecto de prueba: ACNURCG (copia en el scratchpad, nunca el original).

## Ítems

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | «Ritmo del campo» sale deforme | `avance/Resumen.tsx` (fechas fuera del SVG estirado) | Hecho, verificado en captura; falta OK del usuario |
| 2 | Anulaciones: texto desfasado de su tarjeta | `navegacion/chromeTerritorial.css` (rótulo con `flex-basis: 100%` en una columna) | Hecho, verificado en captura; falta OK del usuario |
| 3 | Anulaciones «demasiado plano, no se entiende» | `control/AnulacionesTab.tsx`, `anulaciones.css`, `anulacionesModel.ts` | Hecho, verificado en captura; falta OK del usuario. Queda: a 1024 «Completa con subsanación» obliga a desplazar |
| 4 | Jerga en la leyenda del Ritmo | `avance/Resumen.tsx` | Hecho; falta OK del usuario. Queda la misma jerga en Control › Equipo («Cuentan por día») |
| 5 | El mapa «se ve bastante mal» | `avance/MapaTab.tsx`, `mapa.css` | Rediseño visual hecho; el usuario sigue sin aprobarlo («no se entiende, no está bien pensado») → lo reabren los ítems 7 y 8 |
| 6 | Interactividad: tooltip y filtro desde la leyenda | `avance/TooltipDelMapa.tsx`, `MapaTab.tsx` | Hecho y verificado en vivo. Los formularios y el recorrido salieron de Avance (pasan a Control, ítem 8) |
| 7 | Avance: cómo vamos y qué se hizo en cada manzana; puntos para la vista general, y al ver un distrito las manzanas como áreas | `avance/MapaTab.tsx` (selector «Distrito», clic en el distrito), `avance/useZoomDelMapa.ts` | Hecho, verificado en vivo: a escala de distrito cada UMP es una insignia con su número y el color de su estado; con la rueda se acerca hasta ver la manzana como área entre sus vecinas. Falta OK del usuario |
| 9 | «El mapa no permite hacer zoom ni nada» | `avance/useZoomDelMapa.ts` en Avance › Mapa y Control › Recorrido | Hecho, verificado en vivo: rueda (acerca donde está el puntero), arrastrar para mover, botones + / − / encuadre; un arrastre no abre fichas. Falta OK del usuario |
| 10 | «Los círculos con los números de la UMP no terminan de verse bien» | `avance/MapaTab.tsx`, `mapa.css` (`.mon-mapa-insignia`) | Hecho, verificado en captura: insignia de tamaño fijo en pantalla, color del estado, número en blanco. Falta OK del usuario |
| 8 | Control: el recorrido que registra Kobo con GPS, el camino seguido y qué tan lejos de su manzana estaba; un aplicador puede trabajar varias manzanas | `control/RecorridoTab.tsx`, `recorridoModel.ts` (pestaña nueva Control › Recorrido) | Hecho, verificado en captura con ACNURCG (1440 y 1024, runner sin hallazgos); falta OK del usuario |

## Lo aprendido

- Control › Recorrido lee `response_audit` del corte de Validación: GPS efectivo y distancia a la manzana DE ESE formulario (`advance_block_id`), así que un aplicador con varias manzanas en el día ve cada punto unido a la suya. Los anulados no están (sólo vienen por `casos-ump`).
- `submission_time` cambia de formato entre fuentes: ordenar por él ponía «11:44» antes que «07:49». Se ordena por la hora normalizada.
- El recorrido de la exploración de Avance › UMP se pintaba como polígono relleno (especificidad de `.mon-exp-recorridos .is-aplicador-N`): corregido en `exploracion.css`.

- El registro formulario por formulario (GPS, hora, orden, distancia a la manzana) existe desde el 2026-10-23: endpoint `GET /api/monitoreo/territorial/casos-ump` y vista `avance/ExploracionUmp.tsx`, a la que sólo se llega desde la tabla de Avance › UMP.
- Kobo sólo trae formularios levantados: los intentos fallidos (rechazo, ausente) vienen de los partes de ocurrencias, no del GPS.
- El endpoint es por UMP. Un recorrido por aplicador y día, que cruza UMP, pide otro corte o juntar varias UMP.
- En ACNURCG, la duración del Caso 1 de la UMP 96 sale 984 min: puede ser un formulario abierto horas en Kobo o un error de cálculo. Sin revisar.
