# Checklist — Limpieza, Codificación y base limpiada fuera de la app (2026-10-13)

Tipo: Checklist de QA (pedido con varias indicaciones)
Estado: Vigente
Fecha: 2026-10-13
Autoridad: Evidencia de QA; no reemplaza un ADR

Pedido de Gonzalo, 2026-10-13, a partir de una nota de Procesamiento y de la
revisión de `01_Estudios/2026_PUCP_HSyVbG/Procesamiento/Hostigamiento_Recodificacion.pulso`.
Lo cierra sólo el usuario. Se dibuja entero cada vez que se menciona.

| # | Indicación (textual o resumida fiel) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «Qué pasa si avanzamos la limpieza al 90 % … y procedimos con la codificación … cuando queramos cerrar la limpieza quitando una variable o imputando manualmente, qué pasa con la codificación» | Definición D1 y D3 · ADR 0100 · `api/R/limpieza_decision_engine.R:18-55` | ☑ conducta medida y definida en el ADR 0100 (D1, D3) |
| 2 | «La limpieza se hizo a parte en un script en R donde se quitaron casos de burla o variables meta … el instrumento y la base limpia ya no coinciden, ¿en qué afecta al Procesamiento?» | Definición D2 y D4 · ADR 0100 · `api/R/session_store.R:1053-1070` | ☑ conducta medida y definida en el ADR 0100 (D2, D4) |
| 3 | «Definirlo es sumamente importante» | `docs/adrs/0100-la-base-limpiada-fuera-entra-declarada-y-la-codificacion-depende-del-texto.md` | ◐ Propuesto, falta ratificación |
| 4 | «Revisar la codificación de aquí …/2026_PUCP_HSyVbG/Procesamiento» | Hallazgos abajo · correcciones las hace el equipo en su .pulso | ☑ revisada (2026-10-13) · ☑ aplicación verificada en copia |
| 5 | «Hazlo así» (aprobar la definición D1–D4 y avanzar las piezas que faltan) | Piezas P1–P3 abajo | ◐ P1, P2 y P3 construidas y verificadas (verificador: aceptado con pendientes); faltan las decisiones de Gonzalo: ratificar el ADR y categorías en la ficha |

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

## Piezas

| # | Pieza | Dónde vivirá | Estado |
|---|---|---|---|
| P1 | Aviso al aplicar: textos sin código y preguntas del catálogo sin su variable | Codificación: `api/R/codificacion_omitidas.R` y respuesta de `/aplicar` (`omitidas`, `textos_sin_codigo`) | ☑ backend (ba2c0afed, 72341b1e8, 66092f0e4, 0180e46f7) y pantalla Adaptar (161bfefde, 9f1305538, aec82a61a, 3116c8554); QA visual: pasa, C1–C5 conformes |
| P2 | Base de partida declarada con su lista de exclusiones externas | `api/R/carga_origen_externo.R`, `router_origen_externo.R` (GET y POST `/api/carga/origen-externo`) | ◐ motor, endpoint, ficha (total) y pantalla de Carga ☑ (489eabecb, 86db03199, 69f53e176, 8512c2025, f8bc82876, 99e23257d, 7fca20ca1); QA visual pasa. Falta: categorías en la ficha (decisión de Gonzalo) y propagar a las hijas en bases con repeat |
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

## Hallazgos abiertos de la QA visual (2026-10-13)

- **P1, C5: el aviso de omitidas se perdía al terminar el job.** Al llegar
  `pulso:session-changed`, `CodificacionPage` cambia el subárbol por un
  `LoadingBlock` y `AdaptarPane` se monta de nuevo sin su estado (el aviso duró
  unos 25 s). Ya ocurría antes del aviso: también se perdían `sin_recodificar`
  y las descargas. ☑ Resuelto en 9f1305538 (store por sesión y base) y aec82a61a (el aviso vuelve a la vista una vez).
- **El plan de adaptación no ve las columnas que faltan.** Con la base sin
  `P66_otro`, el plan dice «1 pregunta quedará fuera» (sólo P29_10) y
  `/aplicar` omite 2. `.compute_plan_adaptacion()` (`router_codificacion.R`)
  no comprobaba si la columna de texto está en la base. ☑ Resuelto en 66092f0e4 y 0180e46f7: plan y aviso usan la misma regla y el mismo texto.

## Cierre del verificador (2026-10-13)

Aceptado con pendientes. Gates: codificación R 320/0, carga R 664/0, tsc 0,
gate-front codificación 407/407 y carga 690/690, `sync-agentic-os --audit`
sin hallazgos. Pendientes que dejó y cómo quedaron:

- Checklist desactualizado: ☑ este documento.
- Diagnóstico de omitidas que fallaba en silencio: ☑ ahora va a stderr y la
  respuesta de `/aplicar` lo declara en `avisos_incompletos`. Falta que la
  pantalla lo muestre.
- Ida y vuelta del `.pulso` sin test automático: ☑ test en
  `test-carga-origen-externo.R` (guarda, reabre y sigue vigente).

## P2b — la base preparada fuera difiere en casos y en variables (Enmienda 1, 2026-10-13)

Pedido de Gonzalo: «no siempre van a ser casos de burla […] una base con x menos casos o una base con menos
variables […] una metavariable como inicio de la encuesta que de cara al cliente no es útil».

| # | Pieza | Estado |
|---|---|---|
| P2b.1 | Detectar solas las variables del instrumento que no llegan en la base; metadatos marcados solos | ☑ c874192f0 (HSyVBG: `start`, `end`) |
| P2b.2 | Declarar sólo variables, sólo casos o ambos; motivo de casos en texto libre | ☑ c874192f0, 5e2633dd4 |
| P2b.3 | Las de motivo Metadato o No va al cliente se suman a `variables_excluidas` de Analítica | ☑ c874192f0 |
| P2b.4 | Ficha e informe: «se retiraron k variables del instrumento (m metadatos)» | ☑ c874192f0 (la frase verificada; el PDF no se renderizó: el proyecto no tiene plan de validación) |
| P2b.5 | Panel «Base preparada fuera de la plataforma» con dos partes | ☑ 5e2633dd4, 9251b0b3d; QA visual pasa con observaciones, corregidas |
| P2b.6 | Analítica no tenía un lugar visible para ver o editar `variables_excluidas` | ☑ la sesión de entregables lo creó (644c39c44) y el panel de Carga lo enlaza con la base en foco |
| P2b.7 | La pregunta que falta se sigue recreando vacía en la base de trabajo (backfill); ahora queda declarada y fuera de los entregables | ◐ no se tocó: el backfill está en todas las rutas de carga (`router_carga.R:288` y 8 llamadas más); cambiarlo es una decisión aparte |
