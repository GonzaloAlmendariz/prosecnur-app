# Checklist — Limpieza, Codificación y base limpiada fuera de la app (2026-10-13)

Pedido de Gonzalo, 2026-10-13, a partir de una nota de Procesamiento y de la
revisión de `01_Estudios/2026_PUCP_HSyVbG/Procesamiento/Hostigamiento_Recodificacion.pulso`.
Lo cierra sólo el usuario. Se dibuja entero cada vez que se menciona.

| # | Indicación (textual o resumida fiel) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «Qué pasa si avanzamos la limpieza al 90 % … y procedimos con la codificación … cuando queramos cerrar la limpieza quitando una variable o imputando manualmente, qué pasa con la codificación» | Definición D1 y D3 · ADR 0100 · `api/R/limpieza_decision_engine.R:18-55` | ◐ conducta actual medida, falta ADR |
| 2 | «La limpieza se hizo a parte en un script en R donde se quitaron casos de burla o variables meta … el instrumento y la base limpia ya no coinciden, ¿en qué afecta al Procesamiento?» | Definición D2 y D4 · ADR 0100 · `api/R/session_store.R:1053-1070` | ◐ conducta actual medida, falta ADR |
| 3 | «Definirlo es sumamente importante» | `docs/adrs/0100-la-base-limpiada-fuera-entra-declarada-y-la-codificacion-depende-del-texto.md` | ◐ Propuesto, falta ratificación |
| 4 | «Revisar la codificación de aquí …/2026_PUCP_HSyVbG/Procesamiento» | Hallazgos abajo · correcciones las hace el equipo en su .pulso | ☑ revisada (2026-10-13) · ☑ aplicación verificada en copia |
| 5 | «Hazlo así» (aprobar la definición D1–D4 y avanzar las piezas que faltan) | Piezas P1–P3 abajo | ☐ |

## Definición aprobada («Hazlo así», 2026-10-13)

- **D1. Cada decisión de limpieza vive en un solo lugar.** Lo que hizo el script
  en R se queda en el script. Lo que se decida después se hace en la Limpieza de
  Prosecnur sobre esa base. No se repite una decisión en los dos sitios.
- **D2. La base del script entra como base de partida declarada**, con la lista
  de casos excluidos (`_uuid` y motivo) y la versión del script, para que la
  ficha técnica explique el paso de N a N'.
- **D3. La codificación depende del texto, no de la limpieza.** Cualquier cambio
  posterior de limpieza (en la app o recargando la base) obliga sólo a volver a
  aplicar la codificación y regenerar los insumos. Al aplicar se avisan los
  textos nuevos sin código y las preguntas del catálogo cuya variable ya no
  está.
- **D4. Las variables meta no se borran de la base de trabajo**: se marcan como
  «no van al cliente» y se quitan sólo al exportar la base de entrega.

## Conducta actual (verificada leyendo código)

- Re-finalizar Limpieza con casos excluidos o celdas cambiadas llama a
  `.limpieza_invalidate_downstream()`: conserva el catálogo (`grupos_recod`,
  familias, marcadas) y quita sólo el estado aplicado de Codificación,
  Analítica y Gráficos.
- Reemplazar la data de una base llama a `.invalidate_processing_state()`:
  conserva el catálogo de codificación y descarta la limpieza hecha en la app.
- La codificación se asigna por texto normalizado (`.normalize_text()` en
  `router_codificacion.R`), no por caso.
- Limpieza tiene `exclude_cases`, `set_value`, `replace_value` y `recode_map`.
  No tiene acción para quitar o esconder variables.
- **Medido aplicando la codificación sobre una copia (2026-10-13)**, con el
  handler de `/aplicar` corrido en proceso (`router_codificacion.R:3097-3209`
  más `.codif_apply_job_runner`):
  - Tal como está, salen 19 columnas `_recod`. P29_10 se omite: el puente
    `.bridge_grupos_to_plantilla()` (`router_codificacion.R:1711`) la devuelve
    en `$skipped` y el resto en `$patched`.
  - Quitando `P66_otro` de la base antes de aplicar, P66 también cae en
    `$skipped` y **no se crea `P66_recod`**: su catálogo entero deja de
    aplicarse. La inferencia anterior («crea una `_recod` vacía») era falsa.
  - En los dos casos el handler llama a `.bridge_grupos_to_plantilla(sid)` sin
    leer su resultado (`router_codificacion.R:3183` y `:2211`), así que la
    omisión no llega a la respuesta ni a la pantalla.
  - Un texto sin código se queda en 88 sin aviso (P4 «Hombre» → `P4_recod` 88).
  - El código 11 «Observaciones» de P66 sí entra a la base como categoría.

## Piezas que faltan

| # | Pieza | Dónde vivirá | Estado |
|---|---|---|---|
| P1 | Aviso al aplicar: textos sin código y preguntas del catálogo sin su variable | Codificación: `api/R/codificacion_omitidas.R` y respuesta de `/aplicar` (`omitidas`, `textos_sin_codigo`) | ◐ backend hecho y verificado sobre la copia de HSyVBG sin `P66_otro` (omitidas P29_10 «sin_modo» y P66 «sin_columna_texto»; sin código P4 1, P55 1, P60 2). Falta mostrarlo en la UI (coordinar con la sesión de entregables) |
| P2 | Base de partida declarada con su lista de exclusiones externas | Carga / linaje | ☐ |
| P3 | Variables marcadas «no van al cliente», excluidas al exportar | Analítica / export de base | ☐ |

## Hallazgos de la codificación HSyVbG (para el equipo)

1. P29_10 (Sí/No/No sé, sin texto) tiene un catálogo de 13 textos de P29_10_otro: quitarla de Codificación.
2. Preguntas paralelas con códigos distintos: P23/P52, P26/P55, P29_10_otro/P58_10_otro, P29_11_otro/P58_11_otro, P30_otro/P59_otro.
3. Asignaciones dudosas: «a el programa de violencia de genero de la universidad» → Representante estudiantil (P29_10_otro); P66 código 11 «Observaciones» con 7 no respuestas; P58_11_otro 88 «Ninguno» con sólo «.»; «safica» → Bisexual (P4); «transmasculino» → Género no binario (P3).
4. Menores: 4 casos sin código (P4 «hombre», P55 «cristalito» por emoji distinto, P60 «.» ×2); P60 con dos textos en dos códigos; P8 código «1» vacío y años ≤2017 como «Otro»; etiqueta «Pansexual /Queer».
