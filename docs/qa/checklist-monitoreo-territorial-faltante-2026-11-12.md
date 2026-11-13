# Checklist: Monitoreo territorial, carga y Faltante por UMP (2026-11-12)

Tipo: Checklist QA fechado
Estado: En curso
Fecha: 2026-11-12
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados

Pedido de Gonzalo sobre ACNURCG (`Monitoreo > Avance`, modo territorial).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | La pantalla "Preparando avance territorial" sigue propia aunque las cargas ya estaban estandarizadas | `TerritorialMonitoreoPage.tsx` (`TerritorialLoadingView`), su par en Acreditación (`mon-acr-loading-card`) y la lista `DECLARADAS` de `vaciosYCargasDelKit.contract.test.ts` | Hecho, falta que Gonzalo lo dé por terminado |
| 2 | El switch "Incluir reemplazos" se ve mal | `avance/FaltantePorUmp.tsx` + `avance/faltante.css` (`mon-falt-switch*`) y `monitoreo.css` (regla `.mon-page .pulso-panel button:not(...)`) | Hecho, falta que Gonzalo lo dé por terminado |
| 3 | Desplegar una UMP en "Cuota de cada UMP" tapa la tabla; mejor en un panel lateral | `avance/FaltantePorUmp.tsx` (`TablaDeCuotas`), `avance/DetalleDeUmp.tsx` | Hecho, falta que Gonzalo lo dé por terminado |

## Notas

- 1: la excepción entró en `e7324f7bc` (cierre de P5) con el motivo "pantalla diseñada". Desde `a925fb0c3`, `LoadingBlock variant="panel"` ya lleva isotipo, rótulo y barra en el tono del módulo, así que la excepción no se sostiene. Los pasos que mostraba eran texto fijo, no progreso real.
- 2: causa. El interruptor del kit mide 44x24, pero la regla genérica `.mon-page .pulso-panel button:not(.pulso-button)` de `monitoreo.css` (fondo blanco, radio 6, `min-height: 32px`) tenía más especificidad que `.pulso-switch` y lo dejaba en 44x32, con la pista blanca y el botón en cuadro. Se comprobó midiendo con Playwright (antes 44x32, después 44x24, apagado y encendido). La regla ahora excluye `.pulso-switch` (base, hover y disabled).
- 3: el detalle sale en un `Sideover` con `foco` en la dirección (`&foco=102`), con anterior y siguiente sobre las UMP del filtro activo. Se vio a 1366x768 y 1024x600; a 1024x600 el cuerpo del panel desplaza solo (un dueño de scroll).
- Rojo del gate: `clavesSinRotulo.test.tsx` "el detalle abierto es el de la UMP enfocada" esperaba la fila de detalle bajo la tabla; el comportamiento real cambió a panel (el portal de Radix no se pinta en render estático), así que el test estaba obsoleto y ahora comprueba la fila marcada y la ausencia de filas de detalle. Además `corteContractSemantics.test.ts` ("la banda territorial no llama registros") pasaba solo porque la pantalla de carga propia contenía la palabra "recibidas"; se quitó esa aserción obsoleta y se conserva la negativa.
- Pendiente: a 1366x768 la tabla de "Cuota de cada UMP" queda con una sola fila visible y la cabecera fija tapa 21 px de la primera (aviso del runner); el diff no toca ese layout, se anota como deuda previa.
