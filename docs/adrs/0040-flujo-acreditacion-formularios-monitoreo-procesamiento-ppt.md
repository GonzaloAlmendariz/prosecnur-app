# ADR 0040: Flujo de acreditacion desde formularios versionados hasta un PPT consolidado

Estado: Aceptado

Fecha: 2026-07-20

## Contexto

Los estudios de acreditacion pueden tener varios instrumentos paralelos —por
ejemplo Docentes, Estudiantes, Egresados y Administrativos— y un solo informe
final. Cada instrumento puede provenir de SurveyMonkey, contener logica propia y
recibir ajustes en el Editor XLSForm. Las respuestas, entretanto, ya fueron
cruzadas contra el universo, deduplicadas y clasificadas por Monitoreo.

Prosecnur ya ofrece piezas importantes de este flujo:

- el Editor conserva una coleccion de formularios en `s$xlsform_forms`;
- SurveyMonkey puede traducirse a XLSForm y recibir reglas por encuesta;
- `independent_siblings` aisla instrumento, data y estados metodologicos por
  base;
- `normalize_data_for_xlsform()` normaliza la data contra el instrumento;
- Monitoreo de acreditacion persiste el `case_rollup` reconciliado;
- el motor PPT acepta listas nombradas de datos e instrumentos y referencias
  `actor$variable`.

Faltan contratos explicitos entre esas piezas. El workbook del Editor es
mutable, una base de Procesamiento requiere el par completo instrumento+data,
el handoff general actual no promueve la reconciliacion multi-actor de
acreditacion y el export `ppt-all` produce varios PPT dentro de un ZIP, no un
informe unico.

## Decision

Se adopta un flujo de seis contratos encadenados.

### 1. El Editor es dueno de la autoria; una revision publicada es inmutable

`s$xlsform_forms` sigue siendo la fuente de verdad de los borradores. Para usar
un formulario fuera del Editor se publica una revision local e inmutable:

```r
s$instrument_revisions[[revision_id]] <- list(
  schema = "instrument_revision/v1",
  revision_id = revision_id,
  form_id = form_id,
  revision_no = revision_no,
  content_sha256 = content_sha256,
  choice_code_maps = choice_code_maps,
  choice_code_maps_sha256 = choice_code_maps_sha256,
  xlsform_file_id = xlsform_file_id,
  source = source,
  logic_audit = logic_audit,
  published_at = published_at
)
```

La revision se materializa como XLSX en el file store local. El origen puede ser
SurveyMonkey, pero en el handoff el instrumento es siempre este archivo local,
en concordancia con el ADR 0032. Editar, activar o renombrar el borrador no
modifica una revision publicada. No se infiere un vinculo por nombres ni por el
formulario activo.

La procedencia del borrador es parte del contrato, no metadata decorativa. El
Editor conserva una `source` saneada con el proveedor, `survey_id`, actor,
hashes de definicion, variantes y estado de revision de logica. Los autosaves
parciales fusionan esta procedencia con la ya persistida y no pueden eliminarla;
las claves de credenciales, autorizacion, cookies o secretos se descartan antes
de llegar a `s$xlsform_forms`, localStorage o `.pulso`.

Una fuente versionada con `logic_status = "pending_manual_confirmation"` no es
publicable. La confirmacion es una accion explicita del Editor, registrada por
el servidor y ligada al `content_sha256` exacto del workbook y al hash de sus
`choice_code_maps`. Si el workbook o ese mapa cambia, la confirmacion queda
obsoleta y debe repetirse. La revision conserva el mapa SurveyMonkey
`codigo_fuente -> codigo_XLSForm` que gobierna la normalizacion de respuestas;
un mapa no firmado o cuyo hash no coincide bloquea el ingreso. Las revisiones
legacy sin mapas, `schema` o `logic_status` conservan compatibilidad. Al
publicar, el backend revalida workbook y procedencia inmediatamente antes del
commit y fija en `logic_audit` el estado, timestamp, metodo, hash del workbook,
hash de mapas y hash de la fuente saneada.

### 2. Los instrumentos listos se preparan en un plan de ingreso

No se crean bases incompletas dentro de `s$estudio`. Antes de que exista data,
Carga guarda un plan liviano y persistente:

```r
s$processing_intake <- list(
  schema = "processing_intake/v1",
  processing_mode = "independent_siblings",
  family_id = family_id,
  revision = revision,
  entries = list(
    list(
      entry_id = entry_id,
      base = "docentes",
      base_label = "Docentes",
      actor_key = "docentes",
      actor = "Docentes",
      instrument_revision_id = revision_id
    )
  )
)
```

Procesamiento > Carga muestra este plan como instrumentos listos y datos
pendientes. Una base real se crea solo cuando instrumento y data fueron
validados juntos.

`entry_id`, `base` y `actor_key` son identidades tecnicas estables;
`base_label` y `actor` son etiquetas visibles. El estado de readiness no es
autoritativo en el payload enviado por el cliente: el servidor lo deriva desde
la revision publicada, sus archivos, los previews vigentes y las bases ya
materializadas. Una revision historica valida se conserva vinculada y se marca
`stale`; nunca se sustituye silenciosamente por el formulario activo ni por la
ultima revision.

### 3. Monitoreo entrega el corte reconciliado, no un filtro por fuente

Para acreditacion, la fuente de verdad de seleccion es el `case_rollup`
persistido y vigente respecto del snapshot/configuracion. Un caso entra cuando,
simultaneamente:

- `counts_in_advance == TRUE`;
- `platform_state == "Completa"`;
- `advancement == "effective"`;
- tiene `response_row` y `response_id` validos;
- es unico por `actor + case_key`, `response_row` y `response_id`;
- la fila original coincide en actor, fuente e identificador.

La seleccion recupera la fila original mediante `response_row` y la comprueba
con `response_id`. No se regenera la deduplicacion, no se filtra solamente por
`response_status` o `.source_role` y no se reordenan filas para resolver empates.
Las distintas campanas o canales se agrupan dentro del actor correspondiente.

El preview fija `pins.cache_token`, `pins.intake_revision`, `pins.family_id` y
`pins.preview_fingerprint`; este ultimo resume el corte, los conteos, el
checksum de seleccion y las revisiones de instrumento. El commit recibe los
cuatro valores con sus nombres publicos, vuelve a derivarlos y falla si alguno
quedo obsoleto.

### 4. La promocion multi-actor es atomica

El handoff prepara todas las bases en memoria o archivos temporales antes de
mutar la sesion. Para cada actor:

1. selecciona sus filas oficiales efectivas;
2. normaliza contra la revision XLSForm asignada;
3. valida compatibilidad data-instrumento;
4. calcula la reconciliacion de columnas extra;
5. construye `rp_inst`, `rp_data` y la auditoria de procedencia.

La decision del ADR 0033 forma parte del commit: `variables_extra_incluidas`
se excluye por defecto, se confirma explicitamente por base y se fija junto con
su checksum en el preview, la metadata de la base y el fingerprint del commit.

Solo si todas pasan se crean o reemplazan juntas como
`independent_siblings`. Un fallo deja intactos `s$estudio`, las bases y los
estados derivados. Cada base conserva la revision del instrumento, el token del
corte, el checksum de seleccion, conteos incluidos/excluidos y el reporte de
normalizacion. Reemplazar una base invalida exclusivamente sus derivados.

#### 4.1. Un bundle SAV reemplaza la fuente original vigente

El ingreso offline ZIP-SAV usa la revision publicada de cada actor y sus
`choice_code_maps`; nunca infiere el catalogo desde los valores observados. El
SAV normalizado se convierte en el nuevo `original_data_file_id`. Los IDs
anteriores se conservan solo dentro del linaje de la importacion y no pueden
seguir actuando como fuente de Codificacion o Analitica.

Si la base tenia un `universe_filter` habilitado, el commit rematerializa el
universo efectivo sobre el SAV nuevo antes de publicar el lote. El
`source_data_file_id`, el `effective_data_file_id` y `data_file_id` quedan
alineados con esa nueva fuente. La importacion, la reaplicacion del filtro y la
publicacion de artefactos forman una sola operacion atomica: cualquier fallo
restaura sesion y manifiesto fisico sin archivos huerfanos.

### 5. Procesamiento publica una revision aprobada por base

Validacion, Codificacion y Analitica siguen ejecutandose de manera independiente
sobre la base activa. Cuando una base esta metodologicamente lista, Procesamiento
publica:

```r
s$processing_releases[[processing_intake_entry_id]] <- list(
  schema = "processing_release/v1",
  release_id = release_id,
  processing_intake_entry_id = processing_intake_entry_id,
  sibling_family_id = sibling_family_id,
  base_at_approval = base,
  instrument_revision_id = instrument_revision_id,
  input_fingerprint = input_fingerprint,
  pins = list(
    data = data_file_pin,
    instrument = instrument_file_pin,
    validation = validation_and_cleaning_pins,
    coding = coding_pins,
    analytics = analytics_and_weighting_pins,
    sample = sample_pin,
    extras_sha256 = extras_sha256,
    provenance = provenance,
    provenance_sha256 = provenance_sha256
  ),
  approved_at = approved_at
)
```

`status` no se persiste: el catalogo lo deriva como `approved` cuando el
`input_fingerprint` guardado coincide con el actual, o como `stale` cuando ya
no coincide. Cualquier cambio posterior en instrumento, data, Validacion,
limpieza, Codificacion, ponderacion o configuracion analitica cambia el
`input_fingerprint` y vuelve obsoleta esa revision.

### 6. El PPT consolidado compone fuentes; nunca fusiona las bases

Graficos incorpora una receta global `graficos_consolidado/v1` que fija las
revisiones aprobadas participantes, su etiqueta y orden. Un adaptador de solo
lectura carga esas bases sin cambiar `active_base`, arma listas nombradas y
valida todas las referencias `actor$variable` antes de iniciar el job.

El job invoca una sola vez `reporte_ppt_plan(data = list(...), instrumento =
list(...))` y registra un unico PPTX consolidado y su manifest. No apila filas,
no copia estados entre bases y no reutiliza `ppt-all`.

Las barras multiapiladas solo comparan escalas compatibles por firma
`codigo=etiqueta`. Cada barra conserva denominador, filtros, codigos especiales
y ponderacion de su actor; nunca se suman ni promedian denominadores entre
bases. Una incompatibilidad bloquea o exige bloques separados, nunca una
recodificacion implicita.

#### 6.1. La autoria compartida usa un borrador global propio

El editor distingue el plan de cada base del plan del informe compartido. Este
ultimo se persiste como `graficos_consolidado_draft/v1`, con configuracion,
plan y revision optimista, y no depende de `active_base`. Los proyectos que no
tienen el estado nuevo parten de un borrador vacio; ninguna configuracion por
base se migra o copia implicitamente.

Abrir, editar y guardar el borrador no exige releases aprobadas. El catalogo de
variables del modo consolidado expone todas las hermanas y las referencias se
guardan como `actor$variable`. El preview usa esas mismas fuentes sin cambiar la
base activa. El preflight y el job final consumen exactamente el plan autorado;
solo si el borrador no contiene slides se permite derivar el plan sugerido.

La aprobacion vigente de todas las bases participantes sigue siendo un gate de
generacion, no de autoria. Inmediatamente antes de encolar, el backend vuelve a
validar releases, referencias, escalas, denominadores y revision del borrador.
El ZIP por bases conserva su contrato independiente y el modo consolidado solo
ofrece PPTX, pues Word permanece scopeado por base.

## Consecuencias

- **Reproducibilidad**: cada analisis queda fijado a hashes de instrumento,
  data, configuracion y corte de Monitoreo.
- **Aislamiento**: el procesamiento sigue siendo independiente por actor aunque
  el informe sea unico.
- **Auditabilidad**: se puede explicar por que entro cada caso y que revision de
  formulario lo interpreto.
- **Costo**: se agregan revisiones de instrumento, un plan de ingreso, una
  promocion batch, aprobaciones de Procesamiento y una receta consolidada.
- **Persistencia**: la migracion `.pulso` es aditiva. Proyectos antiguos sin los
  estados nuevos siguen funcionando; las revisiones referenciadas deben
  conservar sus `file_id`.
- **Tamano**: en `.pulso` persisten recetas, hashes y XLSForms de entrada. No
  persisten data combinada, RDS de jobs ni entregables generados.
- **Seguridad**: la promocion usa el snapshot local; no requiere red ni guarda
  credenciales. La data con identificadores personales conserva tratamiento
  interno restringido.

## Alternativas descartadas

- **Leer el formulario activo del Editor desde Procesamiento**: introduce un
  vinculo mutable y puede seleccionar el formulario equivocado.
- **Crear bases con instrumento pero sin data**: rompe el invariante de que una
  base es un par procesable.
- **Inferir logica desde valores observados**: no reconstruye saltos,
  restricciones ni categorias ausentes.
- **Filtrar respuestas solo por fuente o estado `completed`**: pierde la
  reconciliacion oficial, duplicados y cruces entre canales.
- **Convertir las hermanas a una base integrada**: debilita validacion,
  codificacion y denominadores independientes.
- **Unir PPTX ya renderizados o reutilizar `ppt-all`**: produce varios informes
  y no habilita graficos multifuente reales.

## Cumplimiento

La implementacion debe demostrar:

- round-trip `.pulso` de borradores, revisiones, plan de ingreso, bindings y
  recetas sin secretos ni outputs;
- control de concurrencia por hash/revision y fallos atomicos;
- fixture de acreditacion con conteos por actor y motivos de exclusion;
- normalizacion y compatibilidad por instrumento, sin transformaciones
  silenciosas;
- aislamiento de Validacion, Codificacion y Analitica entre bases;
- invalidacion de `processing_release` ante cualquier cambio upstream;
- un solo PPTX con al menos tres fuentes, denominadores independientes y
  referencias `actor$variable`;
- verificacion estructural con `officer` y visual por render de slides.

El plan ejecutable y sus gates estan en
[`../qa/carga/acreditacion_editor_monitoreo_procesamiento_plan.md`](../qa/carga/acreditacion_editor_monitoreo_procesamiento_plan.md).

## Notas

ADRs relacionados: [0013](0013-importacion-workbook-surveymonkey-offline.md),
[0030](0030-grupos-repeat-end-to-end.md),
[0032](0032-handoff-instrumento-siempre-local.md),
[0033](0033-reconciliacion-variables-data-xlsform.md),
[0035 — Editor multi-formulario](0035-editor-xlsform-coleccion-multi-formulario.md)
y [0036](0036-filtro-universo-manual-en-carga.md).
