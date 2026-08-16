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
| **V3** | Una operación que no hace nada se ve antes de hacerla, no después. ✅ **alcanzada 2026-08-15** | El caso canónico: recodificar a un código ya marcado. La UI lo declara en el momento de elegir destino. |
| **V4** | Lo que el motor no pudo hacer se dice, no se omite. | Forzar cada rama de bloqueo (repeats en la promoción, catálogo a medias) y comprobar que la superficie la nombra con su motivo. |
| **V5** | Una decisión metodológica deliberada tiene dónde vivir. ✅ **alcanzada 2026-08-15** | «No categorizar por n insuficiente» se registra con su motivo y sobrevive al `.pulso`; quien abra el proyecto después no la confunde con un olvido. |
| **V6** | Toda vista es enlazable. ✅ **alcanzada 2026-08-15** | `?pestana=` abre la pestaña y `window.__pulsoNav.ir()` devuelve `true` para cada nodo del manifiesto. Cero `direccionPublicada: false`; el test lo exige. |
| **V7** | Cada estado nuevo de superficie tiene test que lo distingue del vecino. ✅ **alcanzada 2026-08-15** | Test de render por estado, con el control: si el arreglo se revirtiera, el aserto falla. |

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
| **L9** | Barrido V2: por superficie, enumerar los estados que el motor distingue y comprobar que cada uno tiene apariencia propia | Carga y los cuatro perfiles de Monitoreo | ☑ hecho — diez ejes probados, **un hallazgo** reparado y visto (`a29629e7`). **V2 se sostiene** en el resto. |
| **L11** | Barrido V4: forzar cada rama de degradación del motor y comprobar que la superficie la nombra | vocabulario de degradación del backend | ☑ hecho — **dos hallazgos**, reparados (`894bbbb0`, `ee4b308d`). Tres de los seis «flags» eran falsos amigos. |
| **L14** | Barrido V5: apagar una regla exige motivo | `router_validacion.R` · `ReglaDrillPanel.tsx` · informe | ☑ hecho — `f08ff427`. El mismo hueco del ADR 0078, en Validación. |
| **L15** | `variables_excluidas` tampoco lleva motivo | `router_validacion.R` · `InstrumentoTab.tsx` · informe | ☑ hecho — `c695c9f1`. Motivo exigido sólo para las que se agregan. |
| **L16** | Barrido V7: cada estado nuevo con test que lo distinga | los diez módulos y componentes que agregó este GOAL | ☑ hecho — `6a89b22f`. Cinco sin test, tres eran gaps reales. |
| **L17** | Pasar las varas por lo que este GOAL agregó | las diez superficies nuevas | ☑ hecho — `3aa93906`. **Un hallazgo, contra mi propio arreglo de V4.** |
| **L13** | Barrido V3: la operación nula se ve antes de hacerla | `impactoDecisiones.ts` · `ImpactoDecisiones.tsx` | ☑ hecho — `66982997`. La pestaña de Limpieza declara el impacto antes de cerrar, y atrapa el identificador que no existe. |
| **L12** | El informe metodológico redacta lo no cubierto | `validacion_methodology_report.R` | ☑ hecho — `6d938bed`. Sección «LO QUE ESTE PLAN NO CUBRE», verificada sobre un PDF renderizado y leído con pdftotext, con su control. |
| **L10** | Confirmar en pantalla el tono de la tarjeta de actor | panel Modelo de acreditación | ☑ hecho — visto en `acrconta`: Egresados y Administrativos en `is-complete` verde, Docentes (14/38) y Estudiantes (2/126) en `is-low` vino. Antes los dos últimos caían en `is-base`, sin regla. |

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

### L17 — las varas contra lo que el propio GOAL agregó

Valió la pena: **el hallazgo es contra el arreglo que estableció el patrón**.

`ee4b308d` hizo que las degradaciones del motor de PPT avisaran por
`.pulso_aviso()`. De los tres exports de gráficos, dos cosechan esos avisos
—`graficos.ppt` y `graficos.word`— y **`graficos.ppt_all` no**. Es el peor sitio
para callarse: en el mazo de todas las bases, con sesenta y siete láminas por
base, una lámina en blanco es exactamente lo que no se nota. El aviso se emitía
y moría en el stderr.

O sea, la propia trampa que este GOAL había anotado —«no preguntes si el motor
lo registra, pregunta por dónde sale»— mordiendo al arreglo que la estableció.
Reparado en `3aa93906`, con test que trocea el router por `job_submit(`: buscar
«avisos» en todo el archivo habría dado verde por los vecinos.

**Trampa nueva, medida de paso**: dentro del mismo `impact` de Limpieza,
`cases_excluded` es **declarativo** (cuenta ids escritos) y `rules_resolved` es
un **delta medido** (`before$reglas_con_casos - after$reglas_con_casos`). Dos
campos vecinos con confiabilidad opuesta: leer el primero como si fuera el
segundo es el error que L13 casi comete.

Del resto de las superficies nuevas, nada. `PromocionBase` cubre los cuatro
estados que el backend puede emitir —incluido el `sin_respaldo` que agregó la
otra sesión—, la proporción de `marcasPrevias` usa el denominador correcto, y
los chips derivan del mismo módulo puro que alimenta sus contadores, así que no
pueden contradecirlos.

### L16 — barrido de V7

Medido sobre las diez superficies que agregó este GOAL. Cinco sin test, y sólo
tres eran gaps reales:

- `resolverPestana` y `resolverPestanaDashboard` cargan la costura más fácil de
  romper —el token normalizado, `reglas_custom` → `reglas-custom`— y nadie la
  probaba. Si esa comparación se rompiera, el deep-link aterrizaría en otra
  pestaña sin decir nada.
- `NoCategorizarAction` tiene sus tres estados sólo en el componente, sin
  módulo puro detrás.

Los otros dos —`DecisionChip` e `ImpactoDecisiones`— tienen sus estados
cubiertos en el módulo puro que los alimenta, que es donde el aserto distingue
de verdad. Contarlos como deuda habría sido cumplir la forma de la vara y no su
intención.

**De paso**: el resolver del tablero vivía dentro de `DashboardRuta`, que
importa `DashboardPage` y arrastra plotly. Una función de tres líneas no puede
costar eso para poder probarse; se movió a `pestanaDashboard.ts`.

### L14 — barrido de V5

El caso canónico ya estaba cerrado (L4, «no categorizar»). Barriendo el resto
aparecieron dos decisiones metodológicas guardadas como **vectores pelados de
identificadores, sin motivo ni fecha**: `reglas_desactivadas` y
`variables_excluidas`.

Apagar una regla es la más grave de las dos porque **silencia un control**, y el
informe metodológico la listaba sin poder justificarla — un entregable que
menciona la decisión y obliga a asumir buena fe. Reparado en `f08ff427` con el
mismo criterio del ADR 0078: motivo obligatorio al desactivar, no al reactivar
—volver a lo que el instrumento declara no necesita justificación—, y reactivar
limpia el motivo en vez de conservar uno que ya no aplica.

Los `.pulso` anteriores traen el id y nada más; el informe lo declara con
`sin_motivo` en vez de inventar un porqué.

**Queda L15**, el hermano: `variables_excluidas`. Excluir una variable del plan
también cambia lo que se revisa.

### L13 — barrido de V3

`before_after_preview` llegaba a `LimpiezaTab` en cada carga y en cada guardado
—con filas, inconsistencias, casos excluidos y celdas corregidas— y **la
pestaña no lo referenciaba en ninguna parte**. Se declaraban decisiones a
ciegas: el resultado aparecía al cerrar la base, cuando ya se invalidó
codificación y analítica.

**Lo que la medición cambió respecto del plan.** Iba a avisar cuando el impacto
fuera cero. Al sembrar el caso sobre `acrconta` —una exclusión a un uuid que no
existe— el motor devolvió `cases_excluded: 1` con `filas_base` en **172 → 172**:
el contador cuenta lo que el analista escribió, no lo que el motor pudo sacar.
Una banda que leyera ese contador habría dicho «1 caso excluido» y habría dejado
pasar justo el error de tipeo que existe para atrapar.

La verdad es el delta de filas. De ahí salen los tres estados: resumen tranquilo
con impacto real, aviso cuando nada cambia, y aviso específico —«los
identificadores que elegiste no aparecen en la base»— cuando el problema son los
ids. Sin decisiones listas no hay banda.

**Anotado como trampa**: `impact.cases_excluded` es declarativo, no efectivo.
Cualquier lectura que lo tome como «filas que se van» miente.

### L11 — barrido de V4, primera pasada

Los 559 `tryCatch` que devuelven vacío son demasiados para barrer a ciegas, así
que la pregunta se dio vuelta: **el motor ya tiene vocabulario de degradación
—¿llega a la pantalla?** Seis flags, y cuatro no aparecen en el frontend:
`plan_elemento_degradado`, `degraded_to_raw`, `semaforo_anclas_degradado`,
`anclas_degradado`.

Tirando de `degraded_to_raw` salió el hallazgo. Cuando el parser AST no puede
traducir una expresión ODK, emite la regla en «modo experto» y eso **sí** se ve
en el nombre de la regla. Pero si la expresión depende de `pulldata()`, la regla
se descarta —correcto, no hay dataset externo— y el registro de ese descarte
(`bundle$discarded`, con fila, campo, origen y expresión) **no salía del
backend**: el endpoint del plan sólo exponía `no_soportadas`. Un plan que deja
preguntas sin cubrir se leía igual que uno completo. Reparado en `894bbbb0`,
en lista aparte porque un límite declarado y una expresión rota no son lo mismo.

**Cómo apareció, que importa para la próxima pasada**: la primera lectura fue
que el descarte era silencioso en el motor, y llegué a parchear el
introspector. Al medir —imprimir el resultado real de `infer_rules_from_xlsform`
en vez de leer el código— resultó que el motor sí registraba y el silencio
estaba una capa más arriba. El parche se revirtió antes de commitear. La
lección: en V4 hay que mirar el payload, no la rama del `if`.

**L12, en la misma pasada.** El hallazgo anterior dejaba las dos listas
viajando y sin redactar. Ahora el informe tiene una sección «LO QUE ESTE PLAN
NO CUBRE» que las narra por separado —una expresión rota se reporta, una regla
sobre `pulldata` se revisa a mano contra el padrón— y nombra hasta cuatro
preguntas para poder ir a buscarlas. No aparece si no hay nada que declarar:
dibujar «todo cubierto» afirmaría más de lo que el dato soporta.

Verificado sobre un PDF renderizado y leído con `pdftotext`, y con el control
que le falta a la mitad de los tests visuales: el mismo informe sin nada
descartado **no** dibuja la sección.

**Los otros cinco flags: tres eran falsos amigos.** `degradado_manual`,
`degradado_automatico` y `anclas_degradado` no son degradación: son el nombre
del **gradiente de color** del semáforo en los graficadores. Queda anotado para
no volver a perseguirlos.

**El segundo hallazgo real, y el más caro.** El motor de PPT degrada bien —una
lámina que no se puede renderizar sale como canvas «Sin datos» y el resto del
mazo se salva— pero avisaba con `warning()`, y el propio `jobs.R` explica por
qué eso no sirve: *el renderer se traga los `warning()`*. Para eso existe
`.pulso_aviso()`, que viaja por `message()` con sello, lo cosecha
`.pulso_avisos_de_job()` y `router_graficos.R` ya lo expone al cliente.

El mazo salía con una lámina en blanco y la razón moría en el stderr del
subproceso. Cinco sitios: render abortado, renderer que devuelve NULL, slot
mangleado, caption incalculable, y el boxplot —donde el analista pedía
`degradado_manual`, le salía `degradado_automatico` y leía el resultado como si
fuera lo que pidió—. Reparado en `ee4b308d`; el `warning()` se conserva como
rastro del log y el aviso se suma.

**El patrón de V4, ya con dos casos**: en los dos, el motor sabía y registraba;
lo que faltaba era el último tramo hasta la pantalla. En el plan, una lista que
no salía del backend; en el PPT, un canal equivocado. Buscar «¿registra?» da
falsos negativos: hay que preguntar «¿por dónde sale?».

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

**Y en los perfiles apareció el primero.** La firma dio resultado apenas se
aplicó al interior de acreditación y telefónico:

`statusTone` distingue cuatro estados —`muted` (sin meta), `complete`,
`steady` (≥70% del objetivo) y `low` (por debajo)— y la tarjeta del panel
Modelo los reducía a tres con un ternario local, mandando `steady` y `low` al
mismo `is-base`, **que no tiene ninguna regla CSS**. Un actor al 95% de su meta
y uno al 20% se veían idénticos, y el único que recibía color de alarma era el
que no tiene meta configurada: el tono estaba invertido respecto de la urgencia.

Lo que lo delata como accidente y no como decisión: la misma data se pinta con
sus cuatro colores en `mon-actor-card`, tres mil líneas más abajo en el mismo
archivo. Reparado en `a29629e7` pasando el tono canónico y dándole al CSS los
acentos que faltaban, los mismos de la otra tarjeta.

**Territorial y cursos-horario: sin hallazgos**, y territorial además tiene el
mejor ejemplo del repo de cómo se hace bien.

*Cuota territorial* (`TerritorialQuotaConsistencyPanel.tsx:375`) parecía un
colapso: normaliza `exceeded` a `complete` y `partial` a `pending`. No lo es —
`quota_status()` en `monitoreo_engine.R:10154` emite exactamente seis valores y
**ninguno de los dos** está entre ellos. Son ramas defensivas para estados que
este motor no produce. Los seis que sí produce tienen sus seis etiquetas.

*Ocurrencias de campo* es el ejemplo a copiar: siete estados, un
`Record<OccurrenceUmpAttentionStatus, …>` que TypeScript obliga a completar, y
siete reglas CSS con siete colores distintos —los verifiqué uno por uno—. El
ícono sí se comparte entre las cuatro variantes de «sin reporte», pero eso es
agrupar una familia, no perder la distinción: etiqueta y color siguen separando.

*Cursos-horario* no tiene taxonomía que colapsar: su único `status` es
`package_status`, que viene de una columna de la hoja de cálculo del usuario y
se usa como heurística para detectar si hay PDF, no como estado del motor.

**Cierre de L9**: diez ejes probados entre Carga y los cuatro perfiles, un solo
hallazgo. La firma funciona y es barata de aplicar; lo caro fue distinguir el
hallazgo real de las tres redundancias que se le parecen.

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

11. **Vite escucha en IPv6.** `http://127.0.0.1:5173` da error de conexión y
    `http://localhost:5173` responde 200. Sondear la pila por `127.0.0.1` hizo
    dar por muertas varias pilas que estaban vivas, y por eso un bucle de espera
    que use `127.0.0.1` para el front no termina nunca. El backend R sí escucha
    en 127.0.0.1.

12. **El 8787 puede no ser tuyo.** La regla de la casa dice no matarlo, y hay
    razón doble: además de ser el del usuario, en este árbol corre más de una
    sesión. Para levantar una pila propia sin tocar nada:
    `make dev-pulso PULSO=... PULSO_PORT=8801 VITE_DEV_PORT=5183`.

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
