# Arquitectura multi-base (v0.2+)

## Por qué

Hasta v0.1 la app asumía que cada sesión trabajaba con **una sola base
de datos** (un XLSForm + una tabla). Eso calzaba bien con encuestas
simples, pero dejaba afuera un patrón frecuente:

> Un solo *estudio* que recolecta datos desde **varios instrumentos
> paralelos**, cada uno con su propio XLSForm, y se analiza como un
> todo cruzando variables entre ellos.

El caso canónico es la acreditación PUCP (carrera AMDT), donde el mismo
estudio tiene tres bases:

- `docentes`
- `estudiantes`
- `administrativos`

Cada rol responde un instrumento distinto, pero el reporte final los
presenta juntos en el mismo slide con notación `fuente$variable`:

```r
p_slide_1(
  title = "MISIÓN Y PROPÓSITOS INSTITUCIONALES",
  plot = p_barras_multiapiladas(
    modo = "var_cruce",
    vars = list(
      mision = c("docentes$p6_1", "estudiantes$p6_1", "administrativos$p4_1"),
      ...
    )
  )
)
```

A partir de v0.2 la app modela ese caso de primera clase.

## Modelo de datos

Cada sesión contiene **un estudio con 1..16 bases**.

```r
s$estudio = list(
  nombre = "Acreditación PUCP — AMDT",
  processing_mode = "multibase",
  active_base = "docentes",
  bases = list(
    docentes        = list(nombre, xlsform_file_id, data_file_id, data_ext,
                           n_filas, n_columnas, added_at),
    estudiantes     = list(...),
    administrativos = list(...)
  )
)

s$rp_data_sources = list(docentes = <df>, estudiantes = <df>, ...)
s$rp_inst_sources = list(docentes = <rp_inst>, ...)
```

`processing_mode` define cómo se consume el estudio:

- `multibase`: comportamiento histórico. Las bases se procesan como un
  conjunto; Analítica empaqueta ZIP cuando hay más de una fuente y
  Gráficos puede referenciar variables con `fuente$variable`.
- `independent_siblings`: familia de formularios hermanos, como
  Ingeniería SurveyMonkey. Cada base conserva XLSForm, data, validación,
  codificación y entregables propios. La configuración metodológica de
  Analítica/Gráficos es común, pero se ejecuta sobre `active_base`.
  Cuando una familia declara `logic_policy = "shared_template"`, el
  estudio conserva una `template_base` y copia la lógica compartida a los
  hermanos nuevos: tanto estado de codificación como columnas XLSForm de
  reglas (`relevant`, `constraint`, `required`, `choice_filter`,
  `calculation`, etc.) cuando la variable existe por nombre en la base
  destino. Las diferencias de fraseo/filas quedan como auditoría
  informativa, no como una integración en una sola base.

Las bases importadas desde SurveyMonkey como hermanas independientes
guardan metadata de origen:

```r
source_kind, survey_id, source_title, sibling_family_id,
imported_at, response_filter
```

`response_filter` describe el alcance real importado, no un ajuste por
meta. Puede registrar `response_statuses`, `collector_ids` por fuente,
cortes por `date_modified_gte`/`date_modified_lte` y, cuando una base hermana agrupa
varias campañas SurveyMonkey, `kind = "surveymonkey_multi_source_response_filter"`
con una entrada por fuente. Cada fuente puede declarar además
`collection_strategy`, `validation_exclusion_profile` y
`excluded_validation_vars`. Esto permite casos como Ingeniería Geológica,
donde una carrera se procesa como un solo hermano aunque sus respuestas
provengan de más de una campaña y una de ellas haya sido WhatsApp/link
autoadministrado sin preguntas administrativas de campo.

En `validation_exclusion_profile = "admin_autoadministrado"`, Validación
enmascara por fila las reglas cuyo objetivo está en `excluded_validation_vars`;
la regla sigue existiendo para las filas de campo, pero no genera falsos
positivos en fuentes donde esas preguntas no aplicaban por modalidad de
recojo.

El estudio puede guardar además:

```r
estudio$independent_siblings = list(
  sibling_family_id, template_base, logic_policy,
  shared_logic, status, audit, updated_at
)
```

La estructura canónica del motor (`prosecnur::reporte_ppt_plan`) ya
acepta `data = list(...)` + `instrumento = list(...)` nativamente —
solo hubo que empezar a pasarle listas en lugar de dataframes sueltos.

### Back-compat con single-base

Sesiones de v0.1 que solo tenían `s$rp_data` / `s$rp_inst` siguen
funcionando. `estudio_data_sources(sid)` las envuelve en `list(default =
rp_data)` al vuelo. Y si el analista agrega la primera base, ese mismo
campo legacy queda espejando la primera para compat durante la transición.

## Notación `fuente$variable`

Cuando un slide tiene que referenciar una variable de una base
específica, usa el formato `"docentes$sexo"` o `"estudiantes$p5"`. El
motor parsea con `.parse_ref_parts()` y resuelve la fuente con
`.resolve_ref()` → eso ya estaba en prosecnur v0.1, solo lo estamos
usando más.

### En la UI

El `VariablePicker` de Gráficos tiene dos modos:

- **Single-base** (1 fuente): el dropdown de fuente se oculta. El value
  se guarda sin prefijo (`"sexo"`). Look & feel idéntico a v0.1.
- **Multi-base** (2+ fuentes): dropdown "Fuente" visible arriba. El
  value se guarda con prefijo (`"docentes$sexo"`).

Los helpers `parseVarRef` / `formatVarRef` en
`frontend/src/features/graficos/useVariables.ts` encapsulan el parsing.

## Endpoints nuevos (v0.2+)

### Gestión del estudio

| Endpoint | Descripción |
|---|---|
| `GET /api/estudio` | Metadata del estudio + bases |
| `PATCH /api/estudio` | Renombrar estudio |
| `POST /api/estudio/base` | Agregar base (body: `{nombre, xlsform_file_id, data_file_id}`) |
| `DELETE /api/estudio/base/<nombre>` | Eliminar base |
| `PATCH /api/estudio/base/<nombre>` | Renombrar base |
| `GET /api/estudio/active-base` | Base activa común del estudio |
| `POST /api/estudio/active-base` | Cambiar base activa común |
| `POST /api/estudio/independent-siblings/promote` | Convertir un estudio existente a `independent_siblings` sin reimportar sus bases |
| `POST /api/estudio/independent-siblings/apply-template-logic` | Aplicar la lógica XLSForm de la `template_base` a bases hermanas compatibles ya cargadas |
| `GET /api/estudio/codif-source` | Base activa para codificación |
| `POST /api/estudio/codif-source` | Alias compatible de `active-base` |

### SurveyMonkey

| Endpoint | Descripción |
|---|---|
| `POST /api/surveymonkey/multibase/surveys` | Catálogo local de encuestas recientes. Por defecto filtra desde cache de sesión; con `force_refresh = true` vuelve a consultar SurveyMonkey. |
| `POST /api/surveymonkey/multibase/import` | Flujo integrado: N surveys → 1 base integrada |
| `POST /api/surveymonkey/multibase/import-independent` | Flujo independiente: N especificaciones de hermano → N bases hermanas; cada especificación puede incluir una o varias fuentes/campañas SurveyMonkey, con `collection_strategy` y perfil de exclusión de validación por fuente |

El catálogo de encuestas SurveyMonkey es metadata regenerable de sesión:
`id`, título, nickname, fecha de modificación y país inferido. Sirve para que
Carga, Monitoreo y los flujos multibase no repitan consultas al API cada vez
que el usuario cambia de etapa o abre un selector. No guarda tokens, respuestas
ni XLSForms dentro del `.pulso`; si el usuario necesita nuevas encuestas, la UI
fuerza un refresco explícito.

En `import-independent`, las diferencias estructurales entre surveys se
reportan como auditoría informativa. Solo bloquean errores reales de API,
XLSForm inválido, data incompatible o ausencia de respuestas dentro del
filtro declarado.

Si el estudio ya tiene una base independiente existente, esa base puede
funcionar como plantilla. Al importar hermanas nuevas, el importador
intenta sincronizar automáticamente las reglas XLSForm compatibles desde
la plantilla hacia los XLSForms recién creados y reporta variables
omitidas o referencias huérfanas. El usuario también puede re-ejecutar
esa sincronización desde Carga mediante
`/api/estudio/independent-siblings/apply-template-logic`, útil cuando una
base ya tenía XLSForm, data normalizada y procesos iniciados antes de
sumar más hermanas.

### Variables por fuente

`GET /api/graficos/variables` devuelve `{sources: [{name, variables}], multi}` en vez de la lista plana de v0.1.

## Distribución por reporte multi-base

Cada endpoint de Analítica (Fase 4) decide cómo empaquetar su output:

| Endpoint | Single-base | Multi-base (N>1) |
|---|---|---|
| `/codebook` | `codebook.xlsx` directo | ZIP con `docentes__codebook.xlsx`, `estudiantes__codebook.xlsx`, ... |
| `/frecuencias` | `frecuencias.xlsx` | ZIP con N xlsx |
| `/cruces` (async) | `cruces.xlsx` | ZIP con N xlsx |
| `/enumeradores` (async) | `enumeradores.pdf` | ZIP con N pdfs (skip bases sin col) |
| `/bases/sav` | `datos.sav` (+ sps si toggle) | ZIP con N sav (+ N sps si toggle) |
| `/bases/csv` | `datos.csv` | ZIP con N csv |
| `/bases/xlsx` | `datos.xlsx` | ZIP con N xlsx |

El helper `run_report_multibase()` en `api/R/helpers_multibase.R`
encapsula la iteración por base + zip. Las funciones del motor
(`reporte_codebook`, `reporte_frecuencias`, etc.) **no se tocaron**:
siguen siendo single-base internamente y el wrapper las llama N veces.

En `processing_mode = "independent_siblings"`, Analítica filtra las
fuentes a `active_base` antes de llamar al helper. Por eso codebook,
XLSForm final, frecuencias, cruces, CSV, XLSX y SAV salen como archivo
directo de la base activa, con nombre prefijado por base. El ZIP se
mantiene para el multibase normal.

Para `cruces` y `enumeradores` (async, worker callr) la iteración vive
dentro del worker (serializa `rp_data_sources` como RDS lista nombrada).

## Codificación con state scoped (Sprint 4.B)

Cada base tiene su propio progreso de codificación:

```r
s$codif_por_base = list(
  docentes    = list(familias_draft, grupos_recod, marcadas, ...,
                     plantilla_codigos_file_id, codigos_sheets_meta),
  estudiantes = list(...),
  administrativos = list(...)
)
s$codif_source_active = "docentes"
```

`s$codif_source_active` se mantiene como alias de compatibilidad; el
selector común persistente es `s$estudio$active_base`. Validación,
Codificación, Analítica y Gráficos escriben el mismo valor.

Helpers `codif_get(sid, key)` / `codif_set(sid, key, value)` leen y
escriben al `codif_source_active`. Cambiar la base activa es un
`POST /api/estudio/codif-source` — el frontend despacha el evento
`pulso:codif-source-changed` y los componentes hijos de
`CodificacionPage` se remontan con `key={codifActive}` para refetchear
el estado scoped de la base nueva.

El instrumento y la data CRUDA que usa codificación (distintos a
`rp_inst` / `rp_data` del motor) se cachean on-demand en
`codif_por_base[[src]]$inst` / `$data` vía `codif_inst_cached` /
`codif_data_cached`.

## Eventos globales del frontend

Tres eventos `CustomEvent` coordinan state entre SessionContext, hooks
con cache, y páginas:

| Evento | Emite | Escucha |
|---|---|---|
| `pulso:session-lost` | `client.ts` cuando recibe `E_NO_SESSION` | `SessionContext` → banner global "Recargar página" |
| `pulso:session-changed` | `client.ts` cuando `X-Pulso-Session` header difiere del anterior (nuevo demo cargado) | `SessionContext`, `useVariables`, `useGraficosAutosave`, `useAnaliticaAutosave` — rehidratan |
| `pulso:codif-source-changed` | `useCodifSource.setActive()` | `CodificacionPage` via `key={active}` remount |
| `pulso:active-base-changed` | Validación/Codificación/Analítica/Gráficos | Hooks con cache de variables y fuentes activas |

El header del workbench de Procesamiento también escucha
`pulso:active-base-changed`: muestra el hermano activo, permite cambiarlo
globalmente y resume estados por base desde `/api/estudio`.

## Patrones a mantener

1. **El motor es puro single-base**. Las funciones `reporte_*` reciben
   dataframes. La multi-base vive en la capa API (routers +
   `helpers_multibase.R`).
2. **Campos legacy se preservan como alias**. `s$rp_data` apunta a la
   primera base para que rutas no migradas sigan funcionando. La
   migración es incremental.
3. **Frontend usa key-remount para invalidar**. En vez de meter
   listeners en cada componente, `key={active}` desmonta y remonta el
   árbol cuando el scope cambia. Cada `useEffect([])` hijo corre de
   nuevo con el state fresh.
4. **La UI detecta `multi` y ajusta el copy**. `n_bases > 1` activa el
   `EstudioPanel` en Fase 1, el dropdown de fuente en `VariablePicker`,
   el selector de base en `CodificacionPage`, y los chips de descarga
   por base en `GenerateFooter`. Con 1 sola base, toda esa UI está
   oculta → flujo idéntico a v0.1.
5. **`independent_siblings` usa base activa, no batch**. El usuario elige
   una carrera/base y genera entregables para esa fuente. No existe en v1
   un ZIP de PPT/Word/codebook para todas las carreras.

## Qué no cubre la v0.2

- **Batch independiente de entregables**: v1 no genera PPT/Word/Excel para
  todas las carreras en una sola acción. El usuario trabaja por base
  activa.
- **Configuraciones analíticas por base**: `analitica_config` y
  `graficos_config` siguen siendo compartidas. Si una base no tiene una
  variable del plan, el error debe nombrar base y variable faltante.
