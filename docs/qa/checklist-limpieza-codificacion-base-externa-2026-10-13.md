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
| P2 | Base de partida declarada con su lista de exclusiones externas | `api/R/carga_origen_externo.R`, `router_origen_externo.R` (GET y POST `/api/carga/origen-externo`) | ◐ motor y endpoint ☑ (489eabecb, 86db03199): sobre la copia de HSyVBG declara 3 327 → 9 (3 críticas, 6 ambiguas) → 3 318 sin avisos y sobrevive a guardar y reabrir el .pulso. Ficha del universo ☑ con el total (`.validacion_upstream_universe` y el informe metodológico: «de N encuestas recibidas se retiraron k»). Falta: categorías en la ficha (espera la decisión de Gonzalo), la página PDF del informe y la pantalla de Carga |
| P3 | Variables marcadas «no van al cliente», excluidas al exportar | Ya existe: `variables_excluidas` de la config de Analítica (codebook, cruces, frecuencias, bases SAV/CSV/XLSX y SPSS en `router_analitica.R`) | ☑ sin código nuevo: el script deja de borrar las variables meta y se declaran ahí |

## Hallazgos de la codificación HSyVbG (para el equipo)

1. P29_10 (Sí/No/No sé, sin texto) tiene un catálogo de 13 textos de P29_10_otro: quitarla de Codificación.
2. Preguntas paralelas con códigos distintos: P23/P52, P26/P55, P29_10_otro/P58_10_otro, P29_11_otro/P58_11_otro, P30_otro/P59_otro.
3. Asignaciones dudosas: «a el programa de violencia de genero de la universidad» → Representante estudiantil (P29_10_otro); P66 código 11 «Observaciones» con 7 no respuestas; P58_11_otro 88 «Ninguno» con sólo «.»; «safica» → Bisexual (P4); «transmasculino» → Género no binario (P3).
4. Menores: 4 casos sin código (P4 «hombre», P55 «cristalito» por emoji distinto, P60 «.» ×2); P60 con dos textos en dos códigos; P8 código «1» vacío y años ≤2017 como «Otro»; etiqueta «Pansexual /Queer».

## Diseño de P2 — base de partida declarada (2026-10-13, sin código todavía)

**Qué ya existe y se reusa.** La ficha del universo declara cuántas encuestas
se recibieron y cuántas quedaron. Desde el ADR 0076 lee el linaje de Limpieza
en `estudio$bases[[b]]$limpieza` (`n_casos_antes`, `n_casos_despues`) con
`.validacion_universe_cleaning()` (`api/R/router_validacion.R:~79`), y saca
**sólo el agregado**: los identificadores y motivos son material interno.

**Qué falta.** Cuando la depuración se hizo en un script, la base llega ya
recortada y la ficha arranca en 3 318 como si se hubieran recibido 3 318.

**Propuesta.**

1. Un bloque nuevo `estudio$bases[[b]]$origen_externo`, hermano de `limpieza`:
   `script` (nombre o ruta declarada), `version` (texto libre o hash),
   `n_recibidas`, `n_entregadas` (= filas de la base cargada), `exclusiones`
   (lista de `_uuid`, `motivo`, `categoria`), `data_file_id` (la base a la que
   se refiere) y `declarado_at`.
2. Se declara subiendo junto a la base un xlsx o csv de exclusiones con
   columnas `_uuid` y `motivo` (y `categoria` opcional, por ejemplo «crítico» o
   «ambiguo»). Es un endpoint nuevo de Carga en archivo propio
   (`carga_origen_externo.R`), registrado en `plumber_app.R`.
3. Al declararlo se comprueban dos cosas y se dicen, no se callan:
   - Ningún `_uuid` excluido está en la base cargada. Si alguno está, el
     script no hizo lo que dice la lista.
   - `n_recibidas = n_entregadas + exclusiones`. Si no cuadra, se publica la
     diferencia.
4. La ficha del universo gana un tramo antes de los de siempre:
   «Recibidas 3 327 → depuración externa −9 → 3 318 → limpieza en la app …».
   Igual que hoy, sólo el agregado y los motivos agrupados por `categoria`
   (3 críticos y 6 ambiguos), nunca los `_uuid`.
5. Si la data de la base cambia (`data_file_id` distinto del declarado), el
   bloque no se borra en silencio: pasa a «declarado para otra base», como el
   estado «rige pero ya no puede explicarse» de `PromocionBase`, hasta que se
   vuelva a declarar.

**Caso HSyVBG.** Recibidas 3 327 efectivas de Monitoreo, 9 exclusiones
(3 críticos y 6 ambiguos, lista ya conocida con sus `_uuid`), entregadas
3 318. Los 11 casos de observación menor se mantienen y no entran a la lista.

**Pregunta para Gonzalo antes de construir.** ¿La ficha técnica del cliente
debe mostrar el tramo de depuración externa con sus categorías (críticos y
ambiguos), o sólo el total excluido?
