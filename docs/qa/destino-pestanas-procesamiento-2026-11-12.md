# Destino de las pestañas de Procesamiento sin pantalla propia en el prototipo (2026-11-12)

Pedido de Gonzalo: revisar una por una las pestañas que el prototipo aprobado no dibuja y terminar su diseño según el artefacto. Decisión: ADR 0144, que implementa el 0142 para Analítica y Codificación. Prototipo: `tmp/revamp-procesamiento/vistas.js` (`RAIL_ANA`, `analitica-entrega`, `RAIL_COD`) y el plan `docs/qa/plan-revamp-procesamiento-2026-11-10.md` (secciones 5.3 y 5.4, decisiones D5, D6 y D14).

## Pestañas y su destino

| Pestaña (slug) | Qué hacía (componente, endpoints) | Dónde queda | Estado |
|---|---|---|---|
| Analítica, Datos (`datos`) | Etiquetas, secciones e inclusión de variables (`DataReviewPane`) | Misma pestaña, rótulo "Variables" (prototipo); slug sin cambio | hecho |
| Analítica, Orden de categorías (`orden`) | Orden de listas, ordinales, especiales al final (`OrdenCategoriasPane`) | Misma pestaña, rótulo "Categorías"; slug sin cambio | hecho |
| Analítica, Base final (`base_final`) | Vista tabla de la base final (`ProcessingSheetViewer` sobre `apiAnaliticaBaseSheet`) | Entrega › Base final genera los archivos; la vista tabla de respuestas se consulta en Carga › Respuestas. Alias `base_final` → Entrega, foco Base final | hecho; la vista tabla de la base final con recodificadas resaltadas no tiene lugar en el prototipo: confirmar antes de borrar |
| Analítica, Bases e instrumentos (`bases`) | SAV con lectura para SPSS y respaldo .sps, CSV (contenido, varias opciones, separador), Excel (contenido, varias opciones, columna legible), bases unidas limpio y trazable, respuestas y formulario de la fuente, script de réplica (`BasesPane`, `/api/analitica/bases/*`) | Entrega › Base final (SAV, CSV, Excel, bases unidas, respuestas sin formato de análisis, lectura de cada variable con `MetadatosEditor`), Entrega › Script de réplica, Entrega › Formulario final. Alias `bases` → Entrega, foco Base final | hecho |
| Analítica, Libro de códigos (`codebook`) | Vista del libro, Excel y PDF, XLSForm final, códigos especiales del libro (`CodebookPane`, `/api/analitica/codebook`) | Entrega › Libro de códigos (el entregable por defecto, como el prototipo). Los códigos especiales del libro siguen con el libro: deciden qué códigos salen en él. Alias `codebook` → Entrega | hecho |
| Analítica, Ficha técnica (`ficha`) | Campos con sugerencia, formato del documento, evidencia, Word (`FichaTecnicaPane`, `/api/analitica/ficha-tecnica/*`) | Entrega › Ficha técnica; la lista dice "Faltan N campos por completar" con el dato real. Alias `ficha` → Entrega | hecho |
| Analítica, Tablas multibase (`multibase`) | Excel con hoja global y hojas por llave (`MultibaseTablasPane`, `/api/analitica/multibase/*`) | Sigue como pestaña condicional en el grupo Tablas, transitoria hasta D6 | sin cambio de diseño: espera el cambio de motor D6 |
| Analítica, Base panel (`panel`) | Armado de la base panel, control antes de exportar, frecuencias, cruces, libro y ficha propios (`PanelBasePane`, `/api/analitica/panel/*`) | Sigue como pestaña en el grupo Tablas, ahora condicional a dos o más bases (el motor ya la declaraba no disponible con una); transitoria hasta D6 | sin cambio de diseño: espera D6 |
| Analítica, Entrega (`entrega`, nueva) | | Riel en el grupo Entrega; lista de entregables en tres grupos, panel por entregable, "Se construye con" y Archivos | hecho; ver lo que falta por causa 1 |
| Codificación, Matrices (`matrices`) | Generar matriz Excel, importarla, mesa de conflictos app contra matriz, matriz de trabajo, para el cliente e interna, respaldo JSON (`CodingConfigActions`, `/api/codificacion/matrices/*`) | Retirada (D14, fila 30 del plan): se codifica en la vista de tabla de Codificar. Matriz para el cliente, registro (auditoría interna) y respaldo se generan en Aplicar, "Archivos para entregar". Alias `matrices` → Codificar | hecho; la ida y vuelta por Excel se retira por decisión |

## Lo que falta por causa 1 (el motor no da el dato)

- E1: "Al día" o "Desactualizado" de cada entregable con su fecha. Pedido: publicar por entregable `generado_en` y la huella de sus insumos.
- E2: estado de Base final, Script de réplica, Formulario final y Comparativo. Los indicadores `analitica_bases_*_ok` existen pero no se apagan cuando cambian limpieza, codificación o configuración, así que no se publican. `analitica_spss_ok` no se enciende nunca (afecta también "Archivos del estudio").
- E3: "Generar lo que falta" y "Armar el paquete" (job en serie y ZIP).

## Archivos sin montar que esperan confirmación de borrado

`frontend/src/features/analitica/panes/CodebookPane.tsx`, `BasesPane.tsx`, `FichaTecnicaPane.tsx` y sus estilos; `frontend/src/features/codificacion/CodingConfigActions.tsx` y lo que solo él usa; la vista de Base final con `ProcessingSheetViewer` en Analítica (el componente lo sigue usando Carga). Varias pruebas de contrato los leen por ruta: el borrado va con su ajuste.
