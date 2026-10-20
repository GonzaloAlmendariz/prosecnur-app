# Checklist · Señales del formulario y motor de reglas (2026-10-17)

Tipo: Checklist vivo
Estado: En curso
Fecha: 2026-10-17
Autoridad: Pedido de Gonzalo (íconos e identidad junto con el motor de reglas); sólo él da por terminado un ítem

Pedido de Gonzalo: «Entonces es un trabajo conjunto, hacer el cambio de íconos e identidad y a la vez el motor de
traducción de estados y condiciones». Propuesta aprobada: https://claude.ai/artifact/YTdc4HLE3YqKhXDmE89pcf
(elegidos: **sello** para los tipos y **riel fijo** para las marcas; textos «en términos humanos, no en regex, el
código como opción al final»; y «que el motor sea robusto generando», no frases escritas a mano).

Contrato congelado entre los dos frentes: `frontend/src/features/xlsformEditor/reglas/piezas.ts` (tipos `Pieza`,
`LecturaRegla`, `textoDePiezas`) y la firma `leerRegla(columna, raw, nodo, scope)` en `reglas/leerRegla.ts`.

Línea base medida sobre los seis formularios tipo (1.914 reglas, motor actual):

| Columna | Reglas | Traducidas |
|---|---|---|
| relevant | 1.117 | 1.110 (99 %) |
| calculation | 207 | 194 (94 %) |
| constraint | 318 | 132 (42 %) |
| choice_filter | 22 | 0 (0 %) |
| required (expresión) | 250 | 249 |

## Identidad (frente I)

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| I1 | Sello por tipo: glifo propio en rejilla de 24, silueta blanca sobre color pleno de la familia | `kit/` (glifos, Sello), tokens de familia en `app/tokens.css` | hecho, verificado: 36 glifos como datos tipados; tokens `--pulso-tipo-*` y `--pulso-marca-*` en `app/tokens-formularios.css` (tokens.css es congelado), un solo tema: la app no tiene superficies oscuras |
| I2 | Sección y repetición en dos tonos de la misma familia; par `[ ]` para abrir y cerrar; el cierre en suave | `kit/` | hecho, verificado: pares [ ] de la propuesta; el cierre en suave también en las filas de cierre del esquema |
| I3 | El sello reemplaza a la maqueta y al ícono en todo el editor (vía `TypeIcon`, `MaquetaTipo`, `iconForType`) | `kit/`, `helpers/icons.tsx` | hecho, verificado: TypeIcon, MaquetaTipo e iconForType pintan el sello sin tocar consumidores; maquetas viejas borradas |
| I4 | Riel fijo de 5 casillas (obligatoria, condición propia o heredada, restricción, cálculo, filtro) en el esquema | `kit/` (Riel), `outline/OutlineRow.tsx` | hecho, verificado: riel de 5 casillas en el esquema, fila sigue en 42 px; bajo 1180 px el riel baja a la línea del subtítulo |
| I5 | Panel animado al tocar una casilla: lectura del motor con chips, mensaje real, código plegado, «no la traduce» honesto | `kit/` (PanelMarca) consume `reglas/piezas.ts` | hecho, verificado: panel en portal dentro del marco, flecha, 170/200 ms, Esc devuelve foco; texto sólo de leerRegla; obligatoria «La encuesta no se puede finalizar sin esta respuesta.». Sin pie «Editar en…» (sin navegación disponible: entra con el rediseño del Constructor) |
| I6 | La condición heredada de la sección se ve en cada pregunta | `kit/` (marcas del nodo) | hecho, verificado: bloque «Heredada de la sección» por ancestro; ProveedorReglas conectado en la página por el lead |
| I7 | Una marca, una forma: fuera la mezcla rama/ojo y asterisco ícono/texto | `outline/`, `kit/`, `pestanas/PestanaReglas.tsx` | pendiente: en PestanaReglas no hay íconos de marca que reemplazar y cada ítem es un botón (el riel anidaría controles); se resuelve en el rediseño del Constructor |

| I8 | El sello también llega a Carga (`features/carga/PreguntasPanel.tsx` usa `iconForType`) | `features/carga/` | decidido por Gonzalo («Haz lo que se vea más elegante»): una sola identidad en toda la app; si a 11 px el sello se ve recargado en la lista de Carga, ahí va el glifo sin fondo en el color de su familia. Comparado a tamaño real (sello frente a glifo sin fondo sobre las tarjetas de sección): se queda el sello, nítido y con la misma identidad |

## Motor (frente M)

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| M1 | Frase en piezas (`leerRegla` real, no cadena) y `describeExpression` derivado de ella | `reglas/leerRegla.ts`, `reglas/motor/`, `canvas/reglasHumanas.ts` | hecho, por verificar: piezas pregunta/opción/valor/texto; `depende` siempre; describeExpression y describeValidation derivan del motor. Pendiente: `describeRuleBreakdown` (FocusedWorkspace, ValidacionPaneles) sigue con la voz vieja |
| M2 | Normalizar antes de leer (`today() >= .` se lee como `. <= today()`) | `reglas/motor/normalizar.ts` | hecho, por verificar: voltea comparaciones, `${esta}` como `.`, aplana and/or, De Morgan, dos cotas como rango |
| M3 | Vocabulario por tipo de pregunta: fechas («posterior a», fechas legibles), números, texto (caracteres), múltiple (opciones) | `reglas/motor/` | hecho, por verificar: «No acepta fechas futuras», «Desde hace 396 días hasta hoy», «De 18 a 100», «Máximo 9 caracteres», «Máximo 3 opciones»; regex leído por patrón; `knownValidation` eliminado |
| M4 | Filtros de opciones: traducir los patrones de cascada; siempre lista + de qué depende | `reglas/motor/filtros.ts` | hecho, por verificar: 0 → 21 de 22 (el que queda es la fila rota) |
| M5 | Restricciones: subir de 42 % sin frases fijas por expresión exacta | `reglas/motor/restricciones.ts` | hecho, por verificar: 132 → 317 de 318 (99,7 %). Por pulir: filtros de más de 15 cláusulas y listas largas de preguntas en if() |
| M6 | Aviso de fila rota (todas las columnas repiten el nombre, p. ej. `REG02_Other_recod`) | `parsing/diagnostics.ts` | hecho, por verificar: `fila-rota-<fila>`, salta sólo en REG02_Other_recod |

## Hallazgos abiertos

- Al abrir o recorrer un formulario el proyecto queda «sin guardar» (visto por el verificador en la captura de 1024). No se comprobó si ya pasaba antes de este cambio.
- El runner de QA abre todos los disparadores `aria-haspopup`: con 5 casillas por fila, el barrido del Constructor tarda ~10 min por captura. Falta en `scripts/ui-quick-check.mjs` un muestreo por grupo repetido. Mientras tanto, `--sin-popovers` y medición del panel aparte con Playwright.
- `pestanas/pestanas.css`: columna vacía de 40 px en `.xfp-item` cuando el número viene vacío (Cálculos). Entra con el Constructor.
