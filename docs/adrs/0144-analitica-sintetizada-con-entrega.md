# ADR 0144: Analítica sintetizada, con la pestaña Entrega

Estado: Aceptado
Fecha: 2026-11-12
Autoridad: ADR 0142 (aceptado el 2026-11-11), decisiones D5 y D6 de `docs/qa/plan-revamp-procesamiento-2026-11-10.md`, y el pedido de Gonzalo del 2026-11-12: "Revisa cada una y [...] termina el diseño según artefacto de ellas y de cualquier otra pestaña faltante". Antes había preguntado si el prototipo buscaba sintetizar las pestañas para integrarlas; la respuesta es sí.

## Contexto

El ADR 0142 decidió el mapa de Procesamiento. Carga, Validación y Codificación ya montaron sus pestañas nuevas; Analítica seguía con 13, de las cuales Base final, Bases e instrumentos, Libro de códigos y Ficha técnica no tienen pantalla propia en el prototipo aprobado: el prototipo las sintetiza en la vista "Analítica, Entrega" (`tmp/revamp-procesamiento/vistas.js`, `RAIL_ANA` y `analitica-entrega`). Tablas multibase y Base panel tampoco tienen pantalla: el 0142 las funde en Comparativos, con la base panel como base derivada (D6), y eso es un cambio de motor que no está hecho.

## Decisión

El riel de Analítica sigue al prototipo, en tres grupos:

| Grupo | Pestaña | Slug | Rótulo antes |
|---|---|---|---|
| (sin nombre) | Variables | `datos` | Datos |
| | Categorías | `orden` | Orden de categorías |
| | Dimensiones | `dimensiones` | |
| | Ponderación | `ponderacion` | |
| Tablas | Frecuencias | `frecuencias` | |
| | Cruces | `cruces` | |
| | Comparativos (condicional) | `comparativos` | |
| | Tablas multibase (condicional, transitoria) | `multibase` | |
| | Base panel (condicional, transitoria) | `panel` | |
| Entrega | Entrega | `entrega` | nueva |

1. **Entrega** lista los entregables de la base en tres grupos (Base de datos, Documentación, Tablas). Cada uno abre su panel en la misma mesa (`foco=<entregable>`): Base final (SAV, CSV y Excel, con la lectura para SPSS), Script de réplica, Formulario final, Libro de códigos (la vista del archivo que ya existía) y Ficha técnica (sus campos, con cuántos faltan). Las tablas (Frecuencias, Cruces, Comparativo) se generan en su pestaña; Entrega las lista con su estado y las abre.
2. **Los slugs `datos` y `orden` se conservan**; solo cambia el rótulo a Variables y Categorías. El 0142 proponía los slugs `variables` y `categorias`; se conservan porque los usan los recorridos del QA visual, las marcas de readiness (`analitica-datos`, `analitica-orden`) y los enlaces "Abrir" de otras pestañas, y renombrarlos no cambia nada que vea el usuario. Codificación hizo lo mismo con `organizar` y `adaptar`.
3. **Las claves retiradas se leen como alias** y no se escriben (`features/analitica/pestanaAnalitica.ts`): `base_final` y `bases` abren Entrega en Base final, `codebook` en Libro de códigos y `ficha` en Ficha técnica.
4. **Tablas multibase y Base panel siguen como pestañas condicionales y transitorias** en el grupo Tablas. Retirarlas hoy perdería funciones que Comparativos no tiene (las hojas por llave del Excel multibase; el armado de la base panel con su control antes de exportar y sus frecuencias, cruces, libro y ficha propios). Salen del riel cuando el motor haga de la base panel una base derivada (D6). Base panel, que se ofrecía siempre, pasa a ofrecerse solo con dos o más bases: el motor ya la declara no disponible con una sola (`.analitica_panel_info`, "Base panel requiere al menos dos bases/mediciones").
5. **Matrices, en Codificación, se retira** como decidió el 0142 (D14 y fila 30 del plan): se codifica en la vista de tabla de Codificar, que ya está montada, y sus salidas pasan a Aplicar, bajo "Archivos para entregar": Matriz de codificación (la matriz para el cliente), Registro de codificación (la auditoría interna) y Respaldo (el JSON), con el mismo generador. La ida y vuelta por Excel y su mesa de conflictos se retiran con ella; traer una columna ya codificada sigue entrando por Carga › Variables y por "Ya viene codificada" en Preguntas. `matrices` se lee como alias de Codificar.

Analítica pasa de 13 a 10 pestañas, Codificación de 4 a 3 y Procesamiento, con Gráficos, de 33 a 29.

## Lo que el motor no publica

- **Al día o desactualizado, y la fecha.** La sesión publica por base activa si se generaron el libro de códigos, las frecuencias, los cruces y la ficha técnica (`analitica_codebook_ok`, `analitica_frecuencias_ok`, `analitica_cruces_ok`, `analitica_ficha_tecnica_ok`), y el motor apaga cada uno cuando cambia algo de lo que depende. Entrega dice "Generado" o "Por generar" con ese dato. Pedido al motor (E1): publicar por entregable `generado_en` y la huella de sus insumos, para decir "Al día, 9 nov 17:02" o "Desactualizado: cambió el orden de filas".
- **Base final, Script de réplica, Formulario final y Comparativo** no llevan estado. El motor guarda `analitica_bases_sav_ok`, `analitica_bases_csv_ok`, `analitica_bases_xlsx_ok`, `analitica_bases_script_r_ok` y `analitica_bases_instrumento_ok`, pero no los apaga cuando cambia la limpieza, la codificación o la configuración (solo los de `analitica_status_por_base` al aplicar la codificación), así que publicarlos diría "Generado" de un archivo viejo. Pedido (E2): apagarlos con los demás en `limpieza_decision_engine.R`, `session_store.R` y el cambio de configuración de `router_analitica.R`, publicarlos en `GET /api/state`, y un indicador para el comparativo. Hallazgo de paso: `analitica_spss_ok` no se enciende en ningún lugar del motor, así que la columna "Base en SPSS" de "Archivos del estudio" dice siempre "Por generar".
- **"Generar lo que falta" y "Armar el paquete"**, las acciones de la cabecera del prototipo, necesitan un job que genere los pendientes en serie y un ZIP con todo. Pedido (E3). Mientras tanto, cada entregable se genera desde su panel.

## Consecuencias

- Cambian el catálogo (`frontend/src/lib/navegacion/catalogos/procesamiento.ts`), `TOTAL_PESTANAS_PROCESAMIENTO` y las firmas de `catalogos.test.ts` y `manifiesto.test.ts`.
- `CodebookPane.tsx`, `BasesPane.tsx`, `FichaTecnicaPane.tsx`, la vista de Base final con `ProcessingSheetViewer` y `CodingConfigActions.tsx` (Matrices) quedan sin montar. No se borran: su borrado espera la confirmación de Gonzalo.
- La vista tabla de la base final (`ProcessingSheetViewer` sobre `apiAnaliticaBaseSheet`) no tiene lugar en el prototipo; sus respuestas se consultan en Carga › Respuestas. Queda listada como función a confirmar antes del borrado.

## Cumplimiento

Las pruebas de contrato del catálogo fijan el orden, los grupos y el conteo; `pestanaAnalitica.test.ts` fija los alias; el barrido de `direccionesRenombradasNoSeEscriben.contract.test.ts` impide escribir una clave retirada.
