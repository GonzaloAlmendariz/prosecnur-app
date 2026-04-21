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

Cada sesión contiene **un estudio con 1..8 bases**.

```r
s$estudio = list(
  nombre = "Acreditación PUCP — AMDT",
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
| `GET /api/estudio/codif-source` | Base activa para codificación |
| `POST /api/estudio/codif-source` | Cambiar base activa |

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

## Qué no cubre la v0.2

- **Fase 2 (Validación)** sigue operando sobre la primera base
  solamente. El revamp completo de Validación viene en una iteración
  separada; mientras tanto, no se rompe porque `s$rp_data` legacy
  apunta a la primera.
- **`/analitica/bases/metadata`** (editor de measures SPSS) también es
  single-base. El editor visual por base queda pendiente.
- **`/analitica/spss`** (endpoint legacy) solo corre en la primera base.
  Obsoleto — la UI moderna usa `/analitica/bases/sav` que sí es
  multi-base.
- **Gestor manual de bases** en Fase 1: hoy solo los demos multi-base
  cargan N bases de una. Para subir XLSForm+data a mano, la UI sigue
  siendo single-base (se puede agregar vía `POST /api/estudio/base`
  desde la API directamente, pero no hay UI).
