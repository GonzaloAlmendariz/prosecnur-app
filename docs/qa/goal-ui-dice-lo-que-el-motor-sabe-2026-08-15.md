# GOAL — la interfaz dice lo que el motor ya sabe

**Abierto**: 2026-08-15 · **Origen**: revisión del primer entregable de PDM
Medios de Vida 2026 (ACNUR V3), que destapó seis defectos de motor y dos ADR.
**Sólo Gonzalo lo cierra.**

## La calidad que se busca

Los seis defectos de motor están reparados y el ADR 0076 implementado. Lo que
queda no es que el producto calcule mal: es que **calcula bien y no lo dice**.
La base del estudio cambia y la pestaña habla del archivo anterior. Nueve
variables quedan marcadas para codificar y cinco se entregan sin recodificar sin
que nada avise. El analista manda una respuesta a un código que esa persona ya
había marcado, y el recodeo es una operación nula que nadie ve.

El patrón es siempre el mismo: **el estado existe en el backend, viaja al
cliente, y la superficie no lo declara**. Este GOAL cierra cuando el motor no
sabe nada que la interfaz calle.

---

## Vara

| # | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | Ninguna superficie describe un estado que el motor ya cambió. | Recorrer las pestañas de Procesamiento con un proyecto real y contrastar lo que dicen contra el payload que reciben. Cero contradicciones. |
| **V2** | Todo estado que el motor distingue, la interfaz lo distingue. | Por superficie: enumerar los estados del backend y comprobar que cada uno tiene una apariencia propia. Cuatro situaciones con la misma pinta es un fallo de C5. |
| **V3** | Una operación que no hace nada se ve antes de hacerla, no después. | El caso canónico: recodificar a un código ya marcado. La UI lo declara en el momento de elegir destino. |
| **V4** | Lo que el motor no pudo hacer se dice, no se omite. | Forzar cada rama de bloqueo (repeats en la promoción, catálogo a medias) y comprobar que la superficie la nombra con su motivo. |
| **V5** | Una decisión metodológica deliberada tiene dónde vivir. | «No categorizar por n insuficiente» se registra con su motivo y sobrevive al `.pulso`; quien abra el proyecto después no la confunde con un olvido. |
| **V6** | Toda vista es enlazable. ✅ **alcanzada 2026-08-15** | `?pestana=` abre la pestaña y `window.__pulsoNav.ir()` devuelve `true` para cada nodo del manifiesto. Cero `direccionPublicada: false`; el test lo exige. |
| **V7** | Cada estado nuevo de superficie tiene test que lo distingue del vecino. | Test de render por estado, con el control: si el arreglo se revirtiera, el aserto falla. |

---

## Cola

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| **L1** | Limpieza declara qué base rige y deja revertir | `components/PromocionBase.tsx` · `limpieza_decision_engine.R` · endpoint `revertir-promocion` | ☑ hecho — `ce9bd5da`. 1283 → 1281 en acnur_acg, revertir vuelve a 1283, segundo revertir 409. Bloqueo por repeats comprobado en acnur_pdm. |
| **L2** | La pestaña de Validación vive en la URL | `features/validacion/pestanaDireccionable.ts` · `catalogos/procesamiento.ts` | ☑ hecho — `d1e9f32f`. Deep-link, `ir()` y click del rail verificados. |
| **L3** | Codificación distingue los cuatro estados por pregunta | `codificacion_decisiones.R` · `decisionCodificacion.ts` · `DecisionChip.tsx` | ☑ hecho — `878e4adb` + `51346e1f`. ULISESV3: 16 sin decidir de 21 marcadas, donde el conteo viejo decía 18. |
| **L4** | Registrar «no categorizar» con su motivo, y advertir al aplicar | `NoCategorizarAction.tsx` · `AdaptarPane.tsx` · endpoint `no-categorizar` | ☑ hecho — `878e4adb` + `51346e1f`. PastSalary registrado en ULISESV3 y recuperado del state.rds del .pulso guardado. |
| **L5** | El dropdown muestra qué marcó esa persona en la múltiple | `codificacion/marcasPrevias.ts` · `QuickAssignDropdown` · `/api/codificacion/respuestas` | ☑ hecho — `d4273aea`. Medido en ULISESV3: 17 de 45 respuestas abiertas de sus SM vienen de filas con códigos ya marcados. |
| **L6** | Decidir si `recommended_file_id` se usa o se retira | `limpieza_decision_engine.R` · `validacion/types.ts` | ☑ hecho — `8bee2e76`, **se retiró**. Un productor, una declaración de tipo, cero consumidores. La decisión quedó anotada en el ADR. |
| **L7** | Las pestañas del Dashboard no publican dirección | `catalogos/dashboard.ts` · `DashboardRuta.tsx` | ☑ hecho — `ca4fa9c6`. Ya no queda ninguna pestaña sin dirección publicada: **V6 cumplida**. |
| **L8** | Barrido V1: contrastar lo que dice cada pestaña de Procesamiento contra su payload | las cinco secciones | ☑ hecho — las cinco barridas, cero contradicciones. **V1 se sostiene**; el detalle y el límite del método, abajo. |
| **L9** | Barrido V2: por superficie, enumerar los estados que el motor distingue y comprobar que cada uno tiene apariencia propia | Carga y Monitoreo | ◐ a medias — seis ejes probados, ninguno colapsa. Falta el interior de los cuatro perfiles de Monitoreo, que es la superficie grande. |

### L8 — barrido de V1, completo

Medido sobre ULISESV3 el 2026-08-15.

**Codificación: sin hallazgos.** La sospecha era que el landing mostrara como
«respuestas» lo que el motor cuenta como filas respondidas, que no es lo mismo
que las respuestas únicas a codificar: en `UNCHR_improving` son 103 contra 12,
en `MesesReva` 87 contra 9, en `WhyNoCenso` 47 contra 2. No hay contradicción:
`PreguntasLanding.tsx:905` dice «103 respuestas · 12 únicas» y
`CodingConfigActions.tsx:685` dice «103 casos · 12 respuestas únicas». Las dos
cifras están y con su nombre. `CodificarWizard.tsx:327` y
`PreguntaDetalle.tsx:127` dicen sólo «tiene N respuestas», que es escueto pero
no falso —N sí son respuestas— y el detalle muestra las únicas abajo.

Queda anotado para no volver a investigarlo: **el par 103/12 es correcto y
deliberado**, no un bug de denominador.

**Validación: sin hallazgos.** Dos candidatos revisados. `canFinalize` ANDea
`auditoria_corrida` con `ready_to_finalize`, y el backend ya exige `evaluacion`
dentro del segundo: es redundante, no contradictorio. Y los pills de progreso
del panorama leen los mismos `plan_construido` / `auditoria_corrida` que el
payload declara, sin derivarlos por su cuenta.

**Carga: sin hallazgos.** La duda era si la promoción del ADR 0076 dejaba a
Carga mostrando el archivo viejo junto al conteo nuevo. No: `data_file_name` se
deriva del `data_file_id` al serializar (`router_estudio.R:943`), no es un campo
guardado aparte, así que tras promover muestra el nombre de la base limpia. Y
`n_filas` lo actualiza la propia promoción. El `origin$data_file_name` de la
línea 908 sí conserva el original, pero eso es lo correcto: describe de dónde
salió la base, no cuál rige.

**Analítica: sin hallazgos, y es el caso que más importaba.** Si resolviera su
fuente por `original_data_file_id`, el aviso de Limpieza —«Codificación,
Analítica y los entregables ya usan esta base»— sería mentira y la exclusión no
llegaría al entregable, que es el defecto que el ADR 0076 vino a reparar.
`router_analitica.R:165-178` recorre la cadena en orden inverso al aplicado
(limpieza, luego universo) y sólo cae al original cuando no hay depuración
activa. Correcto.

**Gráficos: sin hallazgos, por herencia.** No resuelve la base por su cuenta:
consume `rp_data`, que produce la preparación de Analítica. Lo que hace que eso
sea seguro es la invalidación — `.limpieza_invalidate_downstream()` pone
`analitica_prep_ok` en falso, así que tras promover o revertir la preparación se
rehace y `rp_data` sale de la base vigente. Si esa invalidación se rompiera,
Gráficos serviría la base anterior sin decirlo. Vale la pena saber que ahí
cuelga.

**El límite de este barrido.** Fue a nivel de código y buscando un patrón
concreto: una superficie que afirme o derive por su cuenta un estado que el
payload ya declara distinto. No es un recorrido visual exhaustivo de cada
superficie con cada combinación de datos. V1 se sostiene contra ese patrón, que
es el que produjo los hallazgos de L1, L3 y L5.

### L9 — barrido de V2, primera pasada

La firma que se busca es la que produjo L3: **un booleano del frontend derivado
de un campo del backend que tiene más de dos valores**. Allí eran seis estados
de `status` colapsados en `marcada && status !== "completo"`.

Seis ejes probados en Carga y Monitoreo, ninguno colapsa:

| Eje | Estados del motor | Cómo se ven |
|---|---|---|
| Compatibilidad data↔XLSForm | binario de verdad: `ok` ⟺ `status=="compatible"` ⟺ `n_missing==0` | el triple OR de `CargaReviewSummary.tsx:48-50` es redundante, no un colapso |
| Severidad de calidad de campo | `bloqueante` · `advertencia` | `data-severidad="alta"｜"media"`, binario contra binario |
| Tipo de alerta de calidad de campo | 6 (5 de `monitoreo_calidad_campo.R` + `abierta_sin_contenido` de `monitoreo_abiertas.R`) | `rotuloDeTipo` cubre los 6; el fallback genérico no se alcanza |
| Outcomes del telefónico | ~10 en el catálogo de `monitoreo_engine.R:1538+` | cada uno trae su `label` y el front lo renderiza; no hay ids hardcodeados |
| Estado de camino de Monitoreo | `active` · `planned` | chip y tooltip distintos para cada uno |
| Base con/sin data en Carga | binario | `Boolean(base.data_file_id)` |

**Lo que falta y es lo más grande**: el interior de los cuatro perfiles de
Monitoreo (acreditación, telefónico, territorial, cursos-horario). Cada uno
tiene sus propios tableros y sus propias taxonomías de estado, y el histórico
dice que ahí hubo taxonomías en conflicto —«efectivo» que es `outcome_value` y
no un estado— así que es donde más probable es que V2 se rompa.

### L7 — cómo quedó

Gonzalo decidió publicarlas. Van por wrapper (`DashboardRuta`) y no por hook
dentro de `DashboardPage`, porque el artefacto público monta la misma página
**fuera** del `BrowserRouter` y cualquier `useLocation` adentro reventaría en la
publicación. Una sola fuente por montaje: la dirección en admin, el store en la
publicación, que no cambió en nada.

Con esto **no queda ninguna pestaña de sección sin dirección publicada**, que es
la vara V6. Los tres tests que contaban nodos no publicados ahora exigen la
lista vacía: es lo que obliga a que una pestaña nueva nazca enlazable.

### Descartado a propósito

- **Detalle por caso al expandir una respuesta.** Superficie nueva entera para un
  dato que se consulta una vez cada tanto; L5 resuelve el 90% del problema en el
  momento en que importa. Si se retoma: `uuids` viene truncado a 10 en
  `router_codificacion.R:810` sin avisar que hay más, y el identificador a
  mostrar es `Pulso_code`, no `_uuid`.

### No es de UI, sigue abierto

- **`Enumerator_name` sin normalizar** en el entregable de ACNUR V3: siete
  valores para cinco encuestadores, uno de ellos un número de teléfono. Es
  limpieza del proyecto, no del producto.

---

## Trampas

Lo que ya costó una conclusión falsa. Se lee antes de tocar nada.

1. **`NA_integer_` de R llega al cliente como la cadena `"NA"`, y un `NULL`
   como `{}`.** Con `serializer_unboxed_json`, `list(bloqueo = NULL)` serializa
   `"bloqueo": {}`, que en JS es *truthy*: un cierre normal se habría visto como
   bloqueado. Todo campo opcional se agrega sólo si existe, y todo conteo pasa
   por un normalizador que exige `typeof === "number"`.

2. **El artefacto del cierre y el estado vigente no son la misma cosa.**
   `limpieza_artifacts` se borra al editar cualquier decisión
   (`.limpieza_invalidate_outputs`), pero la base promovida sigue rigiendo. Leer
   el estado del artefacto congelado apagaba el aviso justo cuando más importa.
   Lo vigente se lee de la base.

3. **Recargar el navegador tira la sesión.** El BootGate abre el proyecto de
   nuevo con un `sid` nuevo, y todo lo que hayas sembrado por API se pierde. Para
   iterar hay que navegar dentro de la SPA (`__pulsoNav.ir()`, o el botón
   Recalcular), nunca con `navigate` a la misma URL.

4. **Ningún `.pulso` guardado trae la limpieza cerrada.** El estado de validación
   no se persistió en ninguno de los proyectos de ACNUR V3 del disco: para ver el
   banner hay que reconstruirlo cada vez (plan → auditoría → decisión → finalize).
   La receta rápida está en la nota de abajo.

5. **El warm start de un proyecto real tarda ~2 min** y se queda visualmente
   clavado en 93% mientras corre «Preparando Monitoreo territorial». No es un
   cuelgue. Sondear el job de `project.warmup`, no la pantalla.

6. **El `?sid=` en query no existe: el header es `X-Pulso-Session`.** Pasar
   `?sid=` produce un `E_INTERNAL` con «unused argument (sid = ...)», que parece
   un bug del producto y es la llamada mal formada.

7. **`parsearDireccion` normaliza el token** (minúsculas, `_` a `-`), así que
   `reglas_custom` vuelve como `reglas-custom`. Quien compare un id de catálogo
   contra la URL tiene que normalizar los dos lados.

8. **El código de «Otros» de una select_multiple lo tiene marcado toda fila que
   escribió texto.** Contarlo como «ya marcada» produce el aviso en el 100% de
   los casos y tapa la señal: en ULISESV3 salía 12 de 12 en vez de 7 de 12. Se
   excluye leyendo `other_dummy_col`, que es `<padre>/<codigo>`.

9. **`parent_col` viene vacío en el draft de familias** para los siete
   select_multiple de ACNUR V3, y la columna en la data se llama igual que el
   padre. Cualquier lectura que dependa sólo de `parent_col` sale vacía sin
   error. Kobo además exporta las dos formas: columna única con códigos
   separados por espacios, y dummies `<padre>/<codigo>` 0/1.

10. **El `.pulso` guarda el state de codificación entero menos `inst` y `data`,
    pero eso no exime de comprobarlo.** Al verificar que «no categorizar»
    sobrevivía, el guardado salió vacío: estaba guardando la sesión del
    bootstrap y no la del navegador, que al abrir con `?pulso=` corre en otra
    (trampa 3, otra vez). El sid del navegador está en
    `localStorage["pulso.sessionId"]`.

### Receta para sembrar una limpieza cerrada

```
SID de /api/system/bootstrap · header X-Pulso-Session
POST /api/validacion/v2/instrumento/plan        {}
POST /api/validacion/v2/instrumento/auditoria   {}   → job, sondear
POST /api/validacion/v2/limpieza/decision       exclude_cases con uuids reales
POST /api/validacion/v2/limpieza/finalize
```

Los `_uuid` reales salen de la data de la base; en acnur_acg,
`ACNURCG_data_adaptada_10_07_26.xlsx`. Después, **Recalcular** en la pestaña —
no recargar.
