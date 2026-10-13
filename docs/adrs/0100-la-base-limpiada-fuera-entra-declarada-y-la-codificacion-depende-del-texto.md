# ADR 0100 — La base limpiada fuera entra declarada y la codificación depende del texto

- **Estado**: Propuesto — definición aprobada por Gonzalo el 2026-10-13 («Hazlo así»); falta ratificar este texto
- **Ámbito**: Procesamiento › Carga, Limpieza, Codificación y la exportación de la base de entrega
- **Fecha**: 2026-10-13
- **Implementación**: Pendiente — piezas P1 a P3 (abajo). Seguimiento en
  `docs/qa/checklist-limpieza-codificacion-base-externa-2026-10-13.md`
- **Relación**: extiende [ADR 0076](0076-una-base-depurada-se-promueve-no-se-recomienda.md) (la base depurada
  se promueve) a la limpieza hecha fuera de la app, y [ADR 0078](0078-marcar-una-variable-abre-una-decision-no-la-cierra.md)
  (lo que se entrega sin recodificar se declara) a las preguntas cuyo catálogo deja de poder aplicarse.

## Contexto

En HSyVBG 2026 la limpieza no se hizo entera dentro de Prosecnur. Un script en R quitó los casos de burla y
las variables meta que no van al cliente, y la base resultante (`HOSTIGAMIENTO_LIMPIO.xlsx`, 3 318 casos =
3 327 efectivas de Monitoreo menos 9 encuestas sospechosas) se cargó con su XLSForm para codificar. Gonzalo
planteó dos preguntas que el producto no respondía:

1. Si la limpieza se avanza al 90 %, se codifica, y después hay que quitar una variable o imputar un valor,
   ¿qué pasa con la codificación?
2. Si la limpieza se hizo en un script aparte y la base ya no coincide con el instrumento, ¿en qué afecta al
   Procesamiento?

«Definirlo es sumamente importante.»

### Lo que hace hoy el producto (verificado el 2026-10-13)

Leyendo código:

- Re-finalizar Limpieza con casos excluidos o celdas cambiadas llama a `.limpieza_invalidate_downstream()`
  (`api/R/limpieza_decision_engine.R:23`). Conserva el catálogo de codificación (`grupos_recod`, familias,
  marcadas) y quita sólo el estado aplicado de Codificación, Analítica y Gráficos.
- Reemplazar la data de una base llama a `.invalidate_processing_state()` (`api/R/session_store.R`): conserva
  el catálogo de codificación y descarta la limpieza hecha dentro de la app, que hablaba de la base anterior.
- La codificación se asigna por **texto normalizado** (`.normalize_text()` en `router_codificacion.R`), no
  por caso. Por eso sobrevive a cualquier cambio de casos.
- Limpieza tiene `exclude_cases`, `set_value`, `replace_value` y `recode_map`, trazados en el Excel de
  decisiones. No tiene ninguna acción para quitar o esconder una variable.

Aplicando la codificación de HSyVBG sobre una copia, con el handler de `/aplicar` corrido en proceso:

- Tal como está, salen 19 columnas `_recod`. P29_10, cuyo catálogo no le corresponde, se omite.
- Quitando `P66_otro` de la base antes de aplicar, **P66 también se omite entera y no se crea `P66_recod`**.
- En ambos casos la omisión sólo existe en el `$skipped` de `.bridge_grupos_to_plantilla()`
  (`router_codificacion.R:1711`), que el handler llama sin leer (`:3183`, `:2211`). No llega a la respuesta
  ni a la pantalla.
- Un texto sin código se queda en 88 sin aviso (P4 «Hombre» → `P4_recod` 88).

El costo de cambiar la limpieza después de codificar es bajo (volver a aplicar). El riesgo está en otra
parte: **lo que deja de aplicarse no lo dice nadie**, y la base que vino de fuera no explica de dónde viene.

## Decisión

- **D1. Cada decisión de limpieza vive en un solo lugar.** Lo que hizo el script en R se queda en el script.
  Lo que se decida después se hace en la Limpieza de Prosecnur sobre esa base, donde queda trazado. Una misma
  decisión no se repite en los dos sitios.
- **D2. La base del script entra como base de partida declarada.** Junto a ella se registra la lista de
  casos excluidos fuera (`_uuid` y motivo) y la versión del script. La ficha técnica puede así explicar el
  paso de N a N' sin depender de la memoria del equipo.
- **D3. La codificación depende del texto, no de la limpieza.** Se puede codificar con la limpieza a medias.
  Cualquier cambio posterior, en la app o recargando la base del script, obliga sólo a volver a aplicar la
  codificación y a regenerar los insumos; el catálogo nunca se pierde. Al aplicar, el producto **dice** lo que
  quedó fuera: las preguntas del catálogo que se omitieron y por qué, y los textos nuevos que quedaron sin
  código.
- **D4. Las variables meta no se borran de la base de trabajo.** Se declaran en `variables_excluidas` de la
  config de Analítica, que ya las quita de todos los insumos del cliente (bases, codebook, frecuencias, cruces y
  SPSS). Validación y Monitoreo las siguen teniendo.

## Implementación

| Pieza | Qué | Dónde | Coordinación |
|---|---|---|---|
| P1 | `/aplicar` devuelve y la pantalla muestra las preguntas omitidas (`$skipped` con su motivo) y los textos sin código por pregunta | Codificación | La sesión de entregables HSyVBG edita `router_codificacion.R` y `codificacion_aplicar_data.R`: la lógica nueva va en archivo propio y se avisa antes de tocar el handler |
| P2 | Declarar en la base su origen externo con la lista de exclusiones y la versión del script; la ficha técnica lo lee | Carga / linaje de la base | — |
| P3 | Ya existe: `variables_excluidas` de la config de Analítica | `router_analitica.R` la aplica al codebook (~3935), cruces (~4317), bases SAV (~4622), CSV (~4707) y XLSX (~4805), sintaxis SPSS (~4887) y frecuencias (`analitica_frecuencias_export.R:~33`) | Sin código nuevo: la decisión D4 se cumple declarando ahí las variables meta en vez de borrarlas en el script |

## Consecuencias

- Reabrir la limpieza deja de ser una decisión con miedo: su costo es volver a aplicar.
- Quitar una variable de la base deja de ser una forma silenciosa de perder un catálogo de codificación.
- La base que vino de un script deja de ser una caja negra en la ficha técnica.
- Lo que no cubre: no se reproduce dentro de Prosecnur lo que hizo el script. Si una decisión del script
  cambia, se cambia en el script y se recarga la base (D1).
