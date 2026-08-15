# ADR 0076 — Una base depurada se promueve, no se recomienda

- **Estado**: Aceptado
- **Implementación**: Completa
- **Fecha**: 2026-08-15
- **Ámbito**: Limpieza · Codificación · Analítica · contrato de la base efectiva del estudio
- **Relación**: continúa [ADR 0075](0075-una-base-validada-es-una-base-sin-hallazgos-sin-decidir.md),
  que define cuándo una base está validada. Este define qué pasa con el
  resultado de esa validación.

## Contexto

El ADR 0075 estableció que una base está validada cuando no le quedan hallazgos
sin decidir, y que **excluir el caso** es una de las cuatro decisiones válidas.
Lo que no quedó definido es qué ocurre después: dónde vive la base que resultó
de esas decisiones y quién la consume.

Hoy no la consume nadie.

### Dos mecanismos de exclusión, uno completo y otro a medias

El producto ya sabe excluir casos y propagarlo. El **filtro de universo**
(`carga_universe_filter.R:509-535`) hace cuatro cosas al aplicarse:

```r
meta$data_file_id    <- generated[[nm]]$file_id     # 1. promueve la data filtrada
meta$data_ext        <- generated[[nm]]$ext
meta$universe_filter <- list(
  source_data_file_id    = item$source_fid,          # 2. guarda el linaje
  effective_data_file_id = generated[[nm]]$file_id,  # 3. declara la efectiva
  ...)
s <- .invalidate_processing_state(s, nm)             # 4. invalida aguas abajo
```

Y Codificación lo respeta explícitamente, incluso cuando resuelve por el par
original (`router_codificacion.R:41-47`):

```r
if (slot == "data" && prefer_original && base$universe_filter$enabled) {
  return(s$files[[base$universe_filter$effective_data_file_id]])
}
```

La **exclusión desde Limpieza** (`limpieza_decision_engine.R:1204-1252`) hace
solo la primera mitad:

```r
.bases_write_xlsx(preview$data_final, ..., clean_path)   # escribe el archivo
clean_meta <- .limpieza_register_download(
  kind = "validacion_limpieza_base_limpia", ...)         # lo registra como descarga
artifacts$recommended_file_id <- clean_meta$file_id      # y lo "recomienda"
.limpieza_invalidate_downstream(sid, base_nombre)        # invalida aguas abajo
```

Escribe el archivo e invalida lo que sigue, pero nunca lo promueve a
`data_file_id` ni deja un puntero que alguien aguas abajo consulte. El
`recommended_file_id` es una recomendación que ningún consumidor lee: en el
frontend existe únicamente como tipo (`features/validacion/types.ts:330`), sin
componente que lo use.

### El síntoma

Medido en `ACNUR V3` (PDM Medios de Vida 2026, agosto 2026). Se declararon dos
criterios de revisión —`rango_num` sobre la duración del trámite y `rango_fecha`
sobre la fecha del resultado—, ambos marcaron su caso, ambos recibieron decisión
`exclude_cases` con justificación, y Limpieza produjo la base final:

```
base_limpia_base_20260815_100135.xlsx   →   101 filas (de 103)
H1003 presente: FALSE      H1008 presente: FALSE
```

Al reaplicar Codificación y exportar, la base entregable volvió a salir con
**103 casos**. Los dos casos excluidos reaparecieron, porque Codificación
resuelve su fuente con `prefer_original = TRUE` y vuelve a
`original_data_file_id`, que sigue apuntando a la base sin depurar.

### Por qué es un defecto y no una decisión

Lo delata `.limpieza_invalidate_downstream()`. Al finalizar la limpieza esa
función borra el estado de codificación y pone en falso todos los flags de
analítica, gráficos y dashboard: obliga a rehacer el pipeline completo. Eso solo
tiene sentido si al rehacerlo el insumo fuera distinto. No lo es. **Se invalida
trabajo para rehacerlo idéntico**, y el resultado de la limpieza se queda en un
archivo que el analista tiene que descargar y volver a cargar a mano si quiere
que sirva de algo.

El `prefer_original = TRUE` de Codificación tiene su propia razón de ser y no
está en discusión: existe para que reaplicar no parta del instrumento y la data
que la propia codificación generó, cosa que acumularía columnas `_recod` sobre
sí mismas. Depurar no es adaptar: la base limpia es un insumo legítimo, no un
output de codificación.

## Decisión

**La base efectiva de un estudio la fija la última etapa que la depuró, y esa
etapa la promueve; no la ofrece.**

1. **Promover es responsabilidad de quien depura.** `limpieza_finalize()`
   promueve la base depurada a `data_file_id` de la base y declara su linaje,
   con la misma forma que ya usa el filtro de universo:
   `source_data_file_id` (de dónde salió) y `effective_data_file_id` (la que
   rige). Dejar el archivo como descarga no cuenta como entregarlo.

2. **La cadena de depuración tiene un orden declarado: universo, luego
   limpieza.** El filtro de universo define qué casos pertenecen al estudio;
   la limpieza opera sobre los que quedaron. Cuando ambos están activos, la
   base efectiva es la que produjo la limpieza y su `source_data_file_id`
   apunta a la efectiva del universo, no a la cruda.

3. **Los consumidores resuelven la base por la cadena, no por el archivo que
   conocen.** `.codif_base_file_meta()` y sus equivalentes en Analítica
   consultan la efectiva declarada; `prefer_original` deja de significar «la
   cruda» y pasa a significar «la que no produjo esta etapa».

4. **Promover es reversible y auditable.** El linaje permite volver a la base
   anterior sin rehacer decisiones, y la ficha técnica reporta cuántos casos
   entraron y cuántos quedaron tras cada etapa.

5. **Lo que se promueve tiene la forma de una base del estudio.** No se
   promueve la tabla de trabajo de Validación: se materializa con las columnas
   de la base de origen, sin las derivadas del plan.

## Consecuencias

**Para el analista.** Decidir excluir un caso surte efecto. Hoy la decisión se
registra, se justifica, se exporta al Excel de decisiones y al reporte HTML, y
después no cambia nada de lo que se entrega.

**Para la trazabilidad.** El linaje deja escrito qué base produjo cuál, así que
el `.pulso` puede responder «este entregable salió de 101 de 103 casos, por
estas dos decisiones» sin depender de que alguien lo recuerde.

**Para el pipeline.** La invalidación que ya ocurre pasa a tener sentido: se
rehace porque el insumo cambió.

**Costo: la base limpia actual no sirve como fuente tal cual.** Se materializa
desde `read_validation_data_ast()$principal`, que arrastra las derivadas del
plan de validación. Medido en ACNUR V3: **306 columnas contra las 215 de la
base de origen**. Materializarla con la forma correcta es el trabajo real de
esta decisión, no el promover en sí.

**Riesgo: dos etapas escribiendo sobre `data_file_id`.** Universo y limpieza
pueden pisarse si no se respeta el orden del punto 2. El linaje es lo que evita
que un reintento del universo borre la limpieza sin dejar rastro.

**Riesgo: multibase y repeats.** La promoción debe hacerse por base, y una base
madre depurada no puede dejar huérfanas a sus hijas repeat. El filtro de
universo ya resuelve esto propagando por el árbol (`.cuf_prepare_tree`); la
limpieza tendrá que hacer lo mismo o declarar explícitamente que no aplica.

**Lo que esta decisión no cambia.** El `prefer_original` de Codificación sigue
existiendo para no reaplicar sobre el propio output. Lo que cambia es qué
significa «original»: deja de ser «el archivo que se cargó» y pasa a ser «la
base vigente que no produjo esta etapa».

## Cumplimiento

- **Invariante 1 — la exclusión llega al entregable.** Un test de integración
  que excluya un caso desde Limpieza, reaplique codificación y exporte la base,
  y verifique que el caso no está y que el conteo bajó en uno. Es la prueba que
  hoy falla.
- **Invariante 2 — el linaje no se rompe.** Tras promover, `source_data_file_id`
  debe resolver a un archivo existente en el store, y volver atrás debe
  restituir el conteo original.
- **Invariante 3 — la base promovida tiene forma de base.** El número de
  columnas de la base promovida debe coincidir con el de su origen. Un test que
  compare `ncol()` antes y después de promover; hoy daría 306 contra 215.
- **Invariante 4 — orden de la cadena.** Con universo y limpieza activos,
  `effective_data_file_id` de la limpieza debe tener como origen la efectiva del
  universo, nunca la cruda.
- **Check estático.** `rg "recommended_file_id"` no debe devolver el único uso
  actual como declaración de tipo sin consumidor: o se usa, o se retira.

## Notas

Durante la investigación que originó este ADR se corrigió un defecto que
impedía siquiera llegar a la base depurada: un criterio `rango_num` o
`rango_fecha` declarado con un solo límite —la forma natural de escribir «la
duración no puede ser negativa»— pasaba la validación de schema, se ejecutaba y
marcaba sus casos, pero rompía Limpieza con `E_INTERNAL` al simular o finalizar
(commit `46ff11e0`). Ese arreglo es independiente de esta decisión y ya está en
`main`.

El caso de ACNUR V3 también mostró que el instrumento tenía validación en 7 de
141 preguntas capturables, y que los dos valores imposibles que motivaron todo
esto (`MesesReva = -6` y una fecha de resultado posterior al cierre de campo)
habrían sido bloqueados en campo por un `constraint` de una línea. Eso pertenece
al diseño del formulario, no a este ADR, pero explica por qué los criterios de
revisión importan: son la segunda línea cuando la primera no se escribió.
