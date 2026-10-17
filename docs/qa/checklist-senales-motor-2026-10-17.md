# Checklist · Señales del formulario y motor de reglas (2026-10-17)

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
| I1 | Sello por tipo: glifo propio en rejilla de 24, silueta blanca sobre color pleno de la familia | `kit/` (glifos, Sello), tokens de familia en `app/tokens.css` | pendiente |
| I2 | Sección y repetición en dos tonos de la misma familia; par `[ ]` para abrir y cerrar; el cierre en suave | `kit/` | pendiente |
| I3 | El sello reemplaza a la maqueta y al ícono en todo el editor (vía `TypeIcon`, `MaquetaTipo`, `iconForType`) | `kit/`, `helpers/icons.tsx` | pendiente |
| I4 | Riel fijo de 5 casillas (obligatoria, condición propia o heredada, restricción, cálculo, filtro) en el esquema | `kit/` (Riel), `outline/OutlineRow.tsx` | pendiente |
| I5 | Panel animado al tocar una casilla: lectura del motor con chips, mensaje real, código plegado, «no la traduce» honesto | `kit/` (PanelMarca) consume `reglas/piezas.ts` | pendiente |
| I6 | La condición heredada de la sección se ve en cada pregunta | `kit/` (marcas del nodo) | pendiente |
| I7 | Una marca, una forma: fuera la mezcla rama/ojo y asterisco ícono/texto | `outline/`, `kit/`, `pestanas/PestanaReglas.tsx` | pendiente |

## Motor (frente M)

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| M1 | Frase en piezas (`leerRegla` real, no cadena) y `describeExpression` derivado de ella | `reglas/leerRegla.ts`, `canvas/reglasHumanas.ts` | pendiente |
| M2 | Normalizar antes de leer (`today() >= .` se lee como `. <= today()`) | `reglas/` | pendiente |
| M3 | Vocabulario por tipo de pregunta: fechas («posterior a», fechas legibles), números, texto (caracteres), múltiple (opciones) | `reglas/` | pendiente |
| M4 | Filtros de opciones: traducir los patrones de cascada; siempre lista + de qué depende | `reglas/` | pendiente |
| M5 | Restricciones: subir de 42 % sin frases fijas por expresión exacta | `reglas/`, `canvas/reglasFunciones.ts` | pendiente |
| M6 | Aviso de fila rota (todas las columnas repiten el nombre, p. ej. `REG02_Other_recod`) | `parsing/diagnostics.ts` | pendiente |
