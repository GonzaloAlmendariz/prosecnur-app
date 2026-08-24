# GOAL — la entrega se explica sola, sin exponer el caso

Tipo: Registro de goal loop
Estado: En curso
Fecha: 2026-08-15
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


**Abierto**: 2026-08-15 · **Doc vivo** · **Sólo Gonzalo lo cierra**
**Origen**: [reproducibilidad-decisiones-pendiente-2026-08-15.md](reproducibilidad-decisiones-pendiente-2026-08-15.md)
**Relación**: [ADR 0076](../adrs/0076-una-base-depurada-se-promueve-no-se-recomienda.md)
**Medido sobre**: `ACNUR_V3_final.pulso` (PDM Medios de Vida 2026) — 103 recibidas, 101 entregadas, 2 excluidas.

La calidad que se persigue: **quien recibe la entrega puede reconstruir la base y
entender su tamaño sin que nadie le cuente qué encuesta se cayó ni por qué.**
Los dos artefactos que acompañan la base —el script R de replicación y el
informe metodológico— tienen que decir lo mismo, cerrar la aritmética y callar
el detalle. El detalle es material de trabajo interno y vive en el Excel de
decisiones de limpieza.

---

## Vara

| | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | El informe metodológico declara la ficha de conteos (recibidas → exclusiones → incluidas) siempre que el proyecto tenga de dónde sacarla, venga del filtro de pruebas o de la depuración. | Generar el PDF sobre un proyecto con base depurada y leerlo con `pdftotext`: los tres números están y la portada no dice `-`. |
| **V2** | La ficha nunca nombra un caso ni un motivo. | `grep` sobre el PDF y el script generados desde un proyecto real: ningún identificador de caso, ningún texto libre del analista. |
| **V3** | El embudo cierra: recibidas − exclusiones = incluidas, en los tres escenarios (sólo filtro, sólo depuración, ambos encadenados). | Aserto aritmético en testthat sobre los valores del embudo de cada escenario. |
| **V4** | El script R reproduce la base entregada partiendo del crudo. | Correrlo sobre el crudo y comparar N e identificadores con la base entregada. |
| **V5** | Reabrir un `.pulso` cerrado y pedir el informe no exige rehacer trabajo ya hecho. | Abrir `ACNUR_V3_final.pulso` y pedir el PDF sin tocar nada: no hay `E_NO_PLAN`. |
| **V6** | Lo que ve el cliente y lo que ve el equipo están separados por diseño, no por olvido. | El informe metodológico no contiene la tabla de decisiones; el informe HTML / Excel de limpieza sí. |
| **V7** | Cada escenario del universo tiene test que distingue el caso bueno del malo. | `test_file` de los dos archivos en verde, y cada aserto falla si se revierte el arreglo. |

---

## Cola

| | Ítem | Dónde vive | Estado |
|---|---|---|---|
| **L1** | La ficha del informe salía vacía con base depurada: dependía sólo del filtro de universo. | `api/R/router_validacion.R` · `api/R/validacion_methodology_report.R` | ☑ hecho — el linaje de la promoción alimenta `total`/`included`/`excluded_cleaning`; PDF verificado con `pdftotext` (portada `101`, embudo `103 · 2 · 101`) |
| **L2** | El embudo mostraba `Reclasificadas 0` y `Pruebas retiradas 0` en un estudio sin filtro de pruebas. | `validacion_methodology_report.R` (embudo de la p. 2) | ☑ hecho — sin filtro el embudo baja a tres columnas y el separador se calcula relativo al paso |
| **L3** | Con filtro **y** depuración a la vez, la columna de exclusiones perdía lo que no fuera rechazo y el embudo no cerraba. | mismo archivo | ☑ hecho — la columna lleva todo lo retirado que no sea prueba; se llama «Rechazos retirados» sólo cuando es lo único que hay |
| **L4** | El script R de replicación: nivel de detalle correcto, reproduce la base exacta. | motor del script de replicación (ADR 0031) | ☑ verificado 2026-08-15 — **no tocar** |
| **L5** | `E_NO_PLAN` al reabrir `ACNUR_V3_final.pulso`. **La premisa era falsa**: el plan sí se persiste. Lo que pasa es que recargar el instrumento borra el workspace entero y deja la promoción en pie. | `session_store.R` (`.invalidate_processing_state`) · `limpieza_decision_engine.R` | ☑ hecho — las exclusiones se conservan en cuarentena y vuelven al borrador cuando su regla reaparece; lo anclado a variables no se rehidrata (trabajo aparte, ver L14) |
| **L14** | Rehidratar lo anclado a variables (`replace_value`, `impute_value`, `recode_map`, `nullify_fields`, `set_value`, `normalize_value`, select_multiple) exige comprobar variable por variable contra el instrumento nuevo. | mismo sitio que L5 | ☑ hecho — se conserva todo lo que tiene ancla y la comprobación se pospone a la rehidratación, que es cuando existen a la vez el instrumento y el catálogo |
| **L15** | Paso visual del aviso de decisiones conservadas, en sus dos tonos. | `LimpiezaTab.tsx` · `router_validacion.R` | ☑ hecho — y encontró que **el aviso no llegaba al cliente**: el router recortaba el payload. Verificado a 1440x1000 y 1024x600 con dos proyectos armados sobre `ACNUR_V3_final` |
| **L6** | El paquete metodológico (ZIP con PDF + R) usa el mismo modelo: confirmar que hereda la ficha y no tiene su propia ruta. | `validacion_methodology_report.R:2715` | ☑ hecho — el runner lee el mismo `model` y llama a los dos mismos renderizadores; no hay ruta paralela que arreglar |
| **L7** | La pestaña Instrumento sólo muestra el resumen del universo si `upstream_universe.applied`; con base depurada y sin filtro no muestra nada. | `InstrumentoOperationalControls.tsx:134` vs `PromocionBase.tsx` | ☑ cerrado sin tocar código — ese aviso pertenece al filtro de pruebas, que es de lo que trata esa superficie; el hecho de la depuración ya lo declara `PromocionBase` en Limpieza, que es su dueña. Repetirlo sería duplicar información entre dimensiones |
| **L8** | Verificar sobre proyectos reales, no sólo con universos sintéticos. | `api/inst/reference_projects/*` · `ACNUR_V3_final.pulso` | ☑ hecho — ficha correcta sobre el `.pulso` real (`103 · 2 · 101`) y sin regresión en `acnur_pdm` (`430 · 2 · 1 · 3 · 426`) |
| **L9** | Gate escalado al diff + commit de la unidad. | — | ◐ a medias — gate en verde (360 + 49 + 42 + 61 asertos); falta commitear |
| **L10** | Un `.pulso` puede quedar declarando «rige la base depurada 103 → 101» sin conservar las decisiones que lo justifican ni el plan. La exclusión sobrevive; su explicación no. | mismo sitio que L5 | ◐ **se avisa**, falta decidir qué hacer — cuarto estado «rige, pero ya no puede explicarse» en `PromocionBase`, verificado sobre `ACNUR_V3_final.pulso` |
| **L11** | Reemplazar la data dejaba el linaje describiendo un archivo que ya no rige — y desde L1 ese número llegaba al PDF del cliente. | `session_store.R` · `estudio_replace_base_files()` | ☑ hecho — cambiar la data descarta el linaje; recargar el XLSForm no lo toca |
| **L12** | El linaje era de un solo salto: depurar dos veces reescribía `n_casos_antes` con el N intermedio y un estudio que recibió 103 declaraba 101. | `limpieza_decision_engine.R` · `.limpieza_promover_base()` | ☑ hecho — se ancla al primer salto; revertir vuelve a lo recibido |
| **L13** | Paso visual del cuarto estado a 1440x1000 y 1024x600. | `PromocionBase.tsx` | ☑ hecho — y encontró un defecto que ningún test veía: salía en el mismo ámbar que la banda rutinaria de «Corre la auditoría», justo debajo. Pasa a tono de peligro |

### Espera a Gonzalo

Nada bloqueado. La decisión de L5/L10 se tomó el 2026-08-15: **conservar las
exclusiones** al recargar el instrumento, en cuarentena y con rehidratación
condicionada a que la regla reaparezca.

#### Lo que cuesta cada opción (medido el 2026-08-15)

El sitio es `estudio_replace_base_files()` (`api/R/session_store.R:1104`), por
donde pasan las once vías de carga. Ya distingue los dos casos: calcula
`pair_changed` en la línea 1117 y lo usa para `choice_code_mapping`. La
invalidación de la línea 1136 no lo mira.

**Hay que separar dos casos, y sólo uno es discutible.**

- **Cambió la data.** El linaje ya no describe nada: la base promovida fue
  reemplazada. Descartarlo (`meta$limpieza <- NULL`) es la única lectura
  coherente y no hay decisión que tomar. Ojo: **no** sirve llamar a
  `.limpieza_revertir_promocion()`, que restauraría `source_data_file_id` y
  pisaría la data recién cargada.
- **Cambió sólo el XLSForm.** Aquí está la decisión. La data promovida sigue
  siendo el mismo archivo y las decisiones de limpieza están tomadas contra esa
  data, no contra el instrumento.
  - *Revertir la promoción*: coherente («si no puedo explicarla, no rige»), pero
    descarta trabajo del analista **en silencio**, justo lo contrario de lo que
    el commit `ce9bd5da` construyó para revertir a mano —con confirmación en
    línea que dice a qué N se vuelve—.
  - *Conservar `limpieza_draft` y `limpieza_artifacts`*: la data no cambió, así
    que las decisiones siguen siendo aplicables; sólo el plan y la auditoría
    dependen del instrumento y ésos sí deben caer. El riesgo es que el
    instrumento nuevo ya no tenga alguna variable sobre la que se decidió, y hoy
    nada lo comprueba al rehidratar.

Medido así, conservar parece lo correcto y revertir en silencio lo peor de los
tres caminos; pero la comprobación de variables que exige conservar es trabajo
nuevo y la llamada es tuya.

**Resuelto** (2026-08-15, commit `c16fdf02`): se conservan las exclusiones. La
trampa que apareció al implementarlo es que **conservar no puede ser devolver al
borrador**: `.limpieza_simulate()` aplica todo el draft en estado `ready` sin
mirar la cola, que se arma por regla desde el catálogo de la auditoría. Una
decisión cuya regla desapareció se habría aplicado sin figurar en ninguna
pantalla. Por eso van a cuarentena y sólo vuelven cuando su regla reaparece.

**Lo que ya se hizo de esa lista** (2026-08-15): el caso «cambió la data» está
cerrado —no era decisión, era bug (L11)—, y el silencio también: el cuarto
estado de `PromocionBase` declara la situación en vez de dejarla pasar (L10).
Lo que sigue esperando es sólo la mitad discutible: **qué pasa con las
decisiones cuando se recarga el XLSForm**. Las decisiones no dependen del
instrumento por igual —una exclusión de casos se ancla en `target_case_ids` y
no tiene ninguna dependencia; una transformación se ancla en `target_variable` y
sí—, así que la respuesta razonable no es binaria: rehidratar lo aplicable y
declarar lo que quedó huérfano, empezando por las exclusiones.

---

## Trampas

- **El detalle no se agrega «porque ayuda».** Una versión anterior del doc de
  origen proponía listar los motivos de exclusión como comentario del script.
  Se descartó: enumerar qué encuestas se cayeron invita a una discusión caso por
  caso que no aporta al estudio y desgasta la confianza en el resto de la base.
  Lo que viaja es el agregado.
- **`applied` no significa «hay conteos».** Significaba «se aplicó el filtro de
  encuestas de prueba». Todas las ramas del informe colgaban de esa bandera, así
  que un estudio que no separa pruebas salía con la sección entera en blanco
  aunque hubiera excluido casos. Hoy la pregunta es
  `.vmr_universe_declares_counts()`, que también mira la depuración y el embudo
  territorial.
- **El linaje puede hablar de otra base.** `n_casos_antes` sólo se encadena al
  filtro si coincide exactamente con las incluidas que dejó el filtro. Si no
  empalma, el embudo no inventa la aritmética: sirve el filtro tal cual.
- **La medición del doc de origen se hizo sin reejecutar los criterios
  personalizados** en esa sesión. Lo que sí es seguro es que las decisiones
  estaban en el proyecto —la base ya tenía 101 casos— y la sección salió vacía
  igual.
- **El CI no instala `poppler-utils`.** Los asertos con `pdftotext` se saltan en
  el runner y sólo corren en local: un verde de CI no prueba el contenido del
  PDF.
- **«No sobrevive al `.pulso`» era una conclusión falsa.** El doc de origen
  atribuyó el `E_NO_PLAN` a que el plan no se persiste. Se persiste: `acnur_acg`
  reabre con 94 reglas y `ACNUR MDV AGOSTO SIN LIMPIAR.pulso` con plan y
  auditoría. La forma de comprobarlo en un minuto es abrir el `.pulso` y leer
  `estudio$bases[[b]]$validacion$plan_result` del `state.rds`, en vez de deducir
  la causa del mensaje de error. Un `E_NO_PLAN` dice que no hay plan, no por qué.
- **Un campo que el motor produce y los tests verifican puede no existir para
  el usuario.** `/api/validacion/v2/limpieza` enumeraba campo por campo, así que
  `decisiones_preservadas` se quedó en el servidor: `build_limpieza()` lo
  devolvía, la suite lo comprobaba llamándolo directo, y la pestaña no lo veía
  nunca. Un test contra el engine no prueba que el dato llegue. Los routers que
  enumeran son la trampa —ya costó la persistencia de Motor/Recorrido—: se arma
  la respuesta desde el payload y se sobreescribe lo que no puede viajar.
- **Decidir qué se conserva y decidir qué se puede aplicar son dos momentos
  distintos.** L5 filtró en el momento de invalidar y por eso sólo pudo salvar
  las exclusiones: ahí no existen ni el instrumento nuevo ni el catálogo de
  reglas. Conservando todo lo que tiene ancla y posponiendo la comprobación a la
  rehidratación, la misma máquina sirve para las tres anclas. Cuando una
  comprobación no se puede hacer todavía, la salida no es descartar: es esperar.
- **`NULL` y «vacío» no son lo mismo, y confundirlos inventa un motivo.** Si
  `.limpieza_variables_del_instrumento()` devolviera `character(0)` al no poder
  leer el XLSForm, todas las decisiones se declararían «sin su variable» —una
  pérdida falsa y definitiva— en vez de «no se pudo comprobar».
- **Restaurar trabajo no es devolverlo al sitio de donde salió.** El borrador de
  limpieza no es una lista inerte: `.limpieza_simulate()` aplica todo lo que
  esté en `ready`, sin mirar la cola. Devolver ahí una decisión conservada la
  vuelve efectiva aunque no exista pantalla que la muestre. La cola se arma por
  regla desde el catálogo de la auditoría, así que «se puede mostrar» y «se
  aplica» son dos preguntas distintas y hay que responder las dos.
- **Un aviso correcto puede ser invisible por el vecino.** El cuarto estado de
  `PromocionBase` pasó los tests de markup —tono `warn`, copia, `data-estado`—
  y en la app real desaparecía: la pestaña ya tiene una banda ámbar rutinaria
  («Corre la auditoría…») justo debajo, y dos del mismo tono pegadas se leen
  como un bloque. Ningún aserto sobre el componente aislado puede ver eso; sólo
  se ve abriendo la vista. Vale para cualquier aviso nuevo: mirar qué tiene al
  lado antes de elegir el tono.
- **Invalidar el workspace no revierte la promoción.**
  `.invalidate_processing_state()` vacía `bases[[b]]$validacion` entero pero deja
  `bases[[b]]$limpieza` y `data_file_id` intactos. Recargar sólo el XLSForm por
  eso deja la base depurada rigiendo sin nada que la explique — y no hay aviso.
