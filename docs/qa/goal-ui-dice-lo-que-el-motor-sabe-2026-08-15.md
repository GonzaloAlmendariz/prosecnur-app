# GOAL — la interfaz dice lo que el motor ya sabe

Tipo: Registro de goal loop
Estado: En curso
Fecha: 2026-08-15
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


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
| **L18** | Barrido de módulos sin tocar: Hojas de ruta, Recopiladores y Bitácora | `RecopiladoresShell.tsx` | ☑ hecho — **un hallazgo** (`22713e67`). Cálculo de muestra queda fuera mientras la otra sesión lo trabaje. |
| **L20** | Barrido de Analítica y Dashboard | — | ☑ hecho — **sin hallazgos**, con una limitación de medición anotada. |
| **L22** | Analítica sobre payload poblado (lo que L20 no pudo medir) | `coberturaVariable.ts` | ☑ hecho — «0 con dato» decía tres cosas distintas. |
| **L23** | Recontar Validación y Codificación con el criterio de fixture de L22 | `decisionCodificacion.ts` | ☑ hecho — la única con decisión abierta era la única sin chip. |
| **L24** | Validación no tiene ningún caso real en el corpus de referencia | ADR 0043 | ⛔ bloqueado — exige decidir si se enriquece un proyecto de referencia (necesita la sal) o se acepta que Validación es sólo de tests. |
| **L25** | Barrido de Hojas de ruta | `marcoCartografia.ts` | ☑ hecho — la auditoría del marco contra la cartografía oficial no tenía consumidor. |
| **L26** | Recopiladores sin casos en el corpus | `audit_reference_gobierno.R` | ☑ hecho — el sintético trae un deployment `prepared` que cubre las 12 unidades. |
| **L27** | Barrido de Monitoreo territorial | `filasDeFase.ts` | ☑ hecho — cuatro respuestas se perdían entre la consola y el tablero. |
| **L28** | Bitácora sin casos en el corpus | `audit_reference_gobierno.R` | ☑ hecho — tres entradas en tres tonos. |
| **L29** | Barrido de Gráficos | `coberturaBases.ts` | ☑ hecho — la etapa se daba por hecha con la mitad del estudio sin mazo. |
| **L31** | Segunda pasada sobre lo que este GOAL reparó | `filasDeFase.ts`, `marcoCartografia.ts` | ☑ hecho — dos arreglos míos tapaban un aviso más urgente. |
| **L32** | Pasada de cierre: verificar en pantalla y auditar mis propios tests | — | ☑ hecho — los tres arreglos limpios; un test nacido neutralizado, reparado. |
| **L21** | Barrer Gráficos y Cálculo de muestra | — | ☑ hecho — Gráficos en [L29], Cálculo de muestra en [L30] **sin hallazgos**. |
| **L19** | ~~`/api/diseno-estudio/state`~~ | — | ☑ retirado el 2026-08-16 con sus tres endpoints, tres funciones de cliente y cuatro tipos. |
| ~~L19b~~ | `/api/diseno-estudio/state`: usarlo o retirarlo | `router_diseno_estudio.R` · `api/disenoEstudio.ts` | ⛔ **te espera** — el ADR 0029 ya retiró lo que ese endpoint sirve, y nadie lo llama. Retirarlo es implementar el ADR, pero borrar un endpoint pide tu visto bueno. |
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

### L34 — el sintético trae las decisiones que nadie podía mirar

Cerrado L26 y L28, y el resto angosto de L24. El `.pulso` sintético canónico
—que se construye desde el XLSForm del propio repo, sin datos de cliente, sin
anonimizar y sin sal— ahora trae:

| Fenómeno | Antes | Ahora |
|---|---|---|
| Plan de validación por base | vacío | **24 reglas** |
| Reglas apagadas con motivo | 0 | **2 por base** |
| Variables excluidas con motivo | 0 | **2 por base** (`fecha`, `region`) |
| Deployment de Recopiladores | `NULL` | **`prepared`, 12 de 12 unidades cubiertas** |
| Entradas de bitácora | 0 | **3, en tres tonos** |

Y el informe metodológico, corrido sobre ese estado, ya narra las dos listas
con el **nombre humano** de cada regla y su motivo, no con el id crudo.

**Dos cuidados del fixture, ambos con test propio**, porque un fixture
degenerado aparenta cobertura sin darla:

- Los ids apagados salen del plan recién construido. Con un id inventado el
  informe caería al id crudo justo donde debe ir el nombre — que es el defecto
  que esto existe para poder ver.
- Las variables excluidas se eligen **fuera** de las que tocan las reglas
  apagadas. Si coincidieran, las dos listas dirían lo mismo, y apagar una regla
  sobre una variable ya excluida es redundante.

El deployment se arma con `collection_deployment_put` + `_prepare`, que es lo
que hace la app: fabricarlo a mano se saltaría el validador del contrato. Costó
cuatro vueltas —`target`, `capabilities.remote_write`, `sensitivity`, `prefill`
por binding— y cada una la dijo el propio validador cuando le pedí los
problemas en vez de adivinar.

**La trampa:** `collection_state_get()` **deriva** el estado para leer pero no
lo guarda. Durante el build el plan llegaba vacío y el sembrado se saltaba en
silencio; hace falta `collection_state_seed()` explícito. Un helper que
devuelve datos correctos sin persistirlos se comporta distinto según quién lo
llame.

### L33 — L24 era un error mío: Validación sí tiene casos

Al reabrir los pendientes para decidirlos, `reference_projects.R:218` delató el
fallo: `validacion = alguna_base(function(b) lleno(b$validacion$plan_result))`.
**El estado de validación vive por base, no en la raíz de la sesión**, y yo
censé la raíz. Lo que medí como «cero» era mi consulta, no el corpus.

Lo que hay de verdad:

| Proyecto · base | Plan | Descartadas | Evaluación |
|---|---|---|---|
| `acnur_acg` · Monitoreo territorial | 192 reglas | — | no |
| `acnur_pdm` · post_distribution | **192 reglas** | **2** | **sí** |
| `acnur_pdm` · rep_servicios | — | — | no |
| `acrconta_mazo` · 4 bases | claves creadas, vacías | — | no |

Y la sección «LO QUE ESTE PLAN NO CUBRE», corrida sobre el bundle real de
`acnur_pdm`, produce:

> «2 reglas del formulario se apoyan sobre un dato externo (pulldata), que este
> plan no puede evaluar porque el archivo de referencia no viaja con la base —
> «telephone», «censo_2025_inei». Deben revisarse a mano.»

Es exactamente el caso pulldata que antes de la compactación había dado por
irreproducible. **Verificado sobre datos reales, sin construir nada.**

Lo que sí falta, mucho más angosto que lo que L24 declaraba: **reglas
desactivadas** y **variables excluidas** siguen en cero en las siete bases del
corpus, así que esas dos listas del informe nunca se vieron con contenido.

**La trampa, y es la tercera de la misma familia:** medir en el sitio
equivocado produce un cero que parece un hallazgo. Ya sabía que un
«sin hallazgos» vale lo que el fixture [L22] y que un campo sin consumidor
puede ser una retirada [L30]; falta la tercera — **antes de declarar que algo
no existe, verificar dónde vive**. El modelo multibase guarda por base casi
todo lo del pipeline, y buscar en la raíz da vacío siempre.

### L32 — cierre: el GOAL convergió

**En pantalla, sobre el proyecto que corresponde a cada caso:**

| Arreglo | Proyecto | Lo que se ve |
|---|---|---|
| Cobertura de variable | `acnur_acg` | 1 marca en 77 tarjetas; `whynotconsent` «0 de 1283», `D1_information` «llega repartida en sus opciones», `gps_inicio` «1241 de 1283» |
| Decisión de codificación | `acnur_acg` | «A medias · 48 sin asignar», sin «Motivo:» espurio, y la cabecera «1 variable marcada sin decidir» concuerda con el único chip |
| Riel de Gráficos | `acrconta_mazo` | «Faltan los mazos de egresados, administrativos», `done: false`, **sin** `is-blocked`, con el escalar `graficos_ppt_ok` todavía en `true` |

**Auditoría de mis propios tests.** Uno estaba neutralizado, y es el mismo que
dejó pasar el defecto de L31: pasaba `report_rows: null` en el escenario de
`sync_error`, así que el desglose se apagaba por el guardia de nulos y no por
el de estado. Verde sin ejercitar la precedencia que decía cubrir. Ahora los
tres estados urgentes se prueban **con** la diferencia de filas encima, que es
la combinación peligrosa. Los demás pasan la revisión: sus fixtures alcanzan la
rama que declaran.

**Gate de cierre:** typecheck 0 · **4 109 tests verdes** en las 505 suites del
frontend.

**El GOAL convergió.** El barrido cubrió los ocho módulos, la segunda pasada
revisó los arreglos entre sí y esta tercera no encontró nada que reparar salvo
un test flojo. Lo que queda no es trabajo pendiente: son **cuatro decisiones de
Gonzalo**, y tres de ellas son la misma —tres módulos enteros sin un solo caso
real en el corpus de referencia—.

### L31 — la lección de L30 al revés, aplicada a mis propios arreglos

L30 enseñó que un campo sin consumidor puede ser una retirada deliberada. El
reverso: **una frase nueva puede tapar una anterior que importaba más**. Revisé
con ese criterio los nueve arreglos de este GOAL. Dos fallaban, y los dos son
míos y de la misma forma.

**Monitoreo.** `territorialPhaseStatusLabel` devuelve mi desglose de conteos
*antes* que `item.message`, y `describirFilasDeFase` no miraba el `status`. Con
`dashboard_stale`, `sync_error` o `source_snapshot_mismatch` **y** diferencia de
filas, el mensaje del motor —«Actualiza Campo para reconstruir el corte»— se
habría reemplazado por aritmética. Ahora sólo narra sobre
`source_synced_with_rows`. Mi propio test lo dejaba pasar: usaba
`report_rows: null` para el caso de `sync_error`, así que nunca ejercitaba la
combinación peligrosa.

**Hojas de ruta.** La banda del marco piloto pasó a leerse «117 352 manzanas
coinciden…; 1 056 sólo en la oficial. Marco empaquetado para el piloto
funcional…», dejando lo urgente —que las manzanas siguen limitadas al piloto—
detrás de una pared de números. Y era engañoso además: `frame.audit` audita
**siempre** la cartografía empaquetada completa, no el subconjunto del piloto,
así que describía un marco que no está en uso. En piloto vuelve la nota sola.

Los otros siete pasan: Analítica no compite con ningún mensaje por ese hueco;
en Codificación motivo y nota son excluyentes por estado; en Gráficos
`blockedReason` quedó separado de `faltaReason` y hay test; y en Monitoreo la
repetición de «1 693 de 1 697» en el riel y en la tarjeta ya existía antes
—cambié el texto de las dos, no agregué superficie—.

**La trampa, y es sobre cómo se prueba:** los dos defectos vivían en la
precedencia, no en el cálculo, y mis tests del módulo puro no podían verlos. El
de Monitoreo lo tapé yo mismo eligiendo un fixture que esquivaba la
combinación. Un test que cubre el caso peligroso con datos que lo desactivan da
verde y no prueba nada.

### L30 — Cálculo de muestra: sin hallazgos, y un falso positivo que casi cometo

Censo: sólo `hsvg2026` tiene marco de aulas construido (22 bloques, 136 284
filas de entrada); `acnur_acg` trae la carcasa del estudio y los otros tres,
nada. Un único proyecto donde el defecto puede caber.

**El campo huérfano existe y no es una brecha.** `frame.warnings` está
declarado como `warnings: string[]`, el motor lo escribe en ocho sitios
—«no se pudo excluir posgrado», «no se pudo empatar con la base principal»,
«requiere revision»— y **no lo lee ningún componente**. Encaja perfecto con el
patrón que dio once hallazgos, así que llegué a escribir el módulo, el panel,
el CSS y los tests.

Y entonces la suite existente lo rechazó, con un test cuyo nombre dice el
porqué: *«explica una coincidencia sólida con revisión pendiente **sin duplicar
el banner del motor**»*, que prohíbe explícitamente el string
`requiere revision` y la clase `cmv2-frame-warning-list`. Es decir: **ese panel
ya existió y se retiró a propósito**. `decidirConsistenciaMarco()` narra los
avisos de relación en castellano propio —«La relación requiere revisión.
Resuelve los hallazgos y reconstruye el marco antes de continuar a Diseño»— en
vez del crudo del motor sin tildes.

Sobre datos reales el único aviso que `hsvg2026` trae es exactamente ése. Mi
panel habría mostrado, en el único proyecto donde se puede ver, justo lo que
la decisión previa quitó. Revertido entero.

**La trampa, que es nueva y vale para todo el método:** «campo del payload sin
consumidor» detecta bien, pero **no distingue un olvido de una retirada
deliberada**. La prueba de que es una brecha no es que nadie lo lea; es que la
información no esté en ninguna otra parte de la pantalla. Antes de construir
hay que buscar quién más narra ese hecho —aquí, un test lo decía en su propio
nombre—.

Menor y no reparado: `.cmv2-sal-reporte-stale` quedó en `salidas.css` sin
ningún componente que la use, residuo de esa misma retirada. Es deuda de CSS,
no un aviso perdido.

### L29 — la etapa hecha con la mitad del estudio vacía

La otra sesión soltó Gráficos, así que L21 se desbloquea a medias. El censo
mandó al proyecto rico: `acrconta_mazo`, cuatro bases y 67 láminas, frente a
`acrconta` y `acnur_acg` con una sola base cada uno —donde este defecto **no
puede aparecer**—.

`graficos_ppt_ok` y `graficos_word_ok` son escalares de la base **activa**: se
escriben al generar y `.estudio_apply_stage_flags()` los intercambia al cambiar
de base. La verdad por base está en `graficos_status_por_base`, se persiste en
el `.pulso`, y **no salía al cliente**.

| Base | PPT | Word |
|---|---|---|
| docentes | ✔ | ✘ |
| estudiantes | ✔ | ✘ |
| **egresados** | ✘ | ✘ |
| **administrativos** | ✘ | ✘ |

Con `estudiantes` activa el escalar decía TRUE, y el riel de etapas marcaba
«Gráficos: sección lista» con la mitad del estudio sin un solo mazo. Ahora el
estado de sesión expone `graficos_bases_sin_mazo` —los nombres, no el conteo:
«faltan 2» obliga a ir a buscar cuáles— y el riel lo dice en su `title` y a los
lectores de pantalla.

**La trampa, y casi se me pasa:** reusé `blockedReason` para «faltan los mazos»
y eso pintó `is-blocked` sobre una sección que sí se puede abrir. El texto salía
bien y la clase estaba mal; sólo se vio mirando el DOM. Una etapa **incompleta
no es una etapa bloqueada**, y el riel las distingue con clase, no sólo con
texto. Campo aparte y test de cableado.

### L27 — cuatro respuestas entre la consola y el tablero

El censo primero, y otra vez decidió dónde mirar: `acnur_acg` tiene 25 claves de
Monitoreo (territorial, con historial de actualizaciones, ocurrencias y
publicación), `acrconta` 8, `acnur_pdm` 5 y `hsvg2026` 4 —sólo caches—.

`territorial_phase_coherence` trae **dos** conteos por fase:

| | Piloto | Campo |
|---|---|---|
| `local_rows` — en el snapshot | 35 | **1 697** |
| `report_rows` — tras el corte de la fase | 35 | **1 693** |

La consola decía «Campo tiene 1,697 respuestas locales sincronizadas» y el badge
«1,697 locales»; el tablero contaba 1 693. **`report_rows` no estaba ni
declarado en el tipo del cliente**: el único que lo miraba era el motor, para
decidir si el tablero está desactualizado.

Medido en R antes de escribir la frase: las cuatro son del 4 de junio,
anteriores al inicio declarado de Campo (2026-06-12 10:00Z). El filtro de fase
descarta lo enviado antes del arranque. Ahora el badge dice «1 693 de 1 697» y
el estado explica que cuatro quedaron fuera del corte.

**Lo que apareció al verificar en pantalla**, y que no se veía leyendo código:
la píldora de la cabecera llama «recibidas» a las filas del reporte (1 693) y la
banda de la consola llamaba «recibidas» a las locales (1 697), **a dos
centímetros una de otra**. Dos cifras distintas con el mismo nombre en la misma
pantalla. La banda pasa a decir «locales».

**Las dos trampas.** `Number(null)` es 0, así que un `report_rows: null` —lo que
manda un `.pulso` viejo— habría afirmado que se cayeron las 1 697; lo atrapó el
test. Y la costura importaba más que el cálculo: la consola devolvía
`item.message` antes de mirar nada más, así que la frase nueva no se habría
visto nunca. Por eso hay un test de las etiquetas además del módulo puro.

### L28 — Bitácora tampoco tiene con qué medirse

Cero claves de bitácora, cronograma, calendario o canvas en los cuatro
proyectos de referencia. **Tercer módulo entero fuera del corpus**, junto con
Validación [L24] y Recopiladores [L26]. Misma decisión pendiente.

### L25 — la auditoría del marco estaba registrada y callada

El censo primero. De los cuatro proyectos de referencia, tres tienen estado de
Hojas de ruta y sólo `acnur_acg` lo tiene rico: dos corridas (piloto y campo),
cuatro salidas y una auditoría del marco. Los otros dos tienen config y una
corrida vacía. Otra vez: medir sobre el proyecto equivocado habría dado verde.

Dos hallazgos, ambos del patrón conocido.

**La nota que sólo se veía en piloto.** `frame_meta.note` explica qué
cartografía está activa y que la oficial INEI 2017 queda disponible para
auditoría. Se renderizaba dentro de `{frame?.pilot && …}`, y en cualquier
proyecto normal `pilot` es falso: la nota **no aparecía nunca**.

**La auditoría sin consumidor.** Los doce campos de `frame_meta.audit` estaban
declarados en `api/hojasRuta.ts` y no los leía nadie. Sobre 118 410 filas:

| | Manzanas | Viviendas | Población |
|---|---|---|---|
| Marco activo | 117 409 | 2 626 758 | 9 031 584 |
| Cartografía oficial | 118 408 | 2 880 173 | 9 045 962 |
| Coinciden | 117 352 | | |
| Sólo en la oficial | **1 056** | | |
| Sólo en la activa | 2 | | |

El propio motor lo resume como «diferencias registradas sin bloquear el
motor». Registradas se quedaban. Es material de defensa del marco: quien
sustente la muestra debería poder citarlo sin abrir un CSV de 118 410 filas.

**La trampa**, y esta la puso la casa: `HojasRutaPage.tsx` está congelado a
crecimiento y el gate lo atrapó en 9003 sobre 9001. Extraer el aviso a
componente propio no fue una concesión al gate —es lo que la regla pide— y de
paso dejó el chip testeable por separado.

### L26 — Recopiladores tampoco tiene con qué medirse

Cero claves de recopiladores en los cuatro proyectos de referencia:
`collection_state`, deployment, materiales y handoff no existen en ninguno. El
módulo entero está fuera del corpus, igual que Validación en [L24]. Misma
decisión pendiente y por eso nace bloqueado.

### L24 — Validación no tiene con qué medirse

El mismo censo, del lado de Validación, sobre los cuatro proyectos de
referencia:

| Fenómeno | Casos |
|---|---|
| Reglas custom | 0 en `acnur_acg` y `acnur_pdm`; la clave ni existe en `acrconta` ni `hsvg2026` |
| Reglas desactivadas | 0 |
| Variables excluidas | 0 |
| Artefactos de limpieza | ninguno en los cuatro |

Es decir: **la sección «LO QUE ESTE PLAN NO CUBRE» del PDF, la lista de reglas
desactivadas, la de variables excluidas, la banda de impacto y el cartel de
promoción no tienen un solo caso real en el corpus**. Todo eso está verificado
por tests unitarios y por planes armados a mano, nunca contra un proyecto.

No lo arreglo por mi cuenta: la salida es enriquecer un proyecto de referencia
con un plan de validación de verdad, y regenerar uno exige la sal
(ADR 0043). Es una decisión, no una tarea. La alternativa —dejarlo escrito y
aceptar que Validación se verifica sólo con tests— también es legítima, pero
tiene que ser deliberada y no por defecto.

### L23 — el censo de estados, y lo que destapó

Aplicando L22 al revés: antes de dar por conforme lo que cerré en Codificación,
conté cuántos casos de cada estado del ADR 0078 contienen los proyectos de
referencia. El censo, sobre los cuatro:

| Estado | Casos en los 4 proyectos |
|---|---|
| `sin_marcar` | 29 |
| `pendiente_parcial` | 1 |
| `categorizada`, `no_categorizar`, `sin_material`, `pendiente`, `requiere_config` | **0** |

Cinco de los siete estados **no existen en ningún proyecto de referencia**, y
sólo `acnur_acg` tiene draft de codificación: `acrconta`, `acnur_pdm` y
`hsvg2026` no tienen ninguno. Todo el trabajo del ADR 0078 estaba verificado
por tests unitarios y nunca contra una pantalla con datos.

Y el único caso real que sí existe destapó el defecto. De las cinco variantes
de tarjeta, **la emparejada era la única que no montaba `stats`**, y por tanto
la única sin chip de decisión. `D1_information` —la única de las 30 con
decisión abierta— mostraba un «En codificación automáticamente» en verde y nada
más, mientras el encabezado decía «1 sin decidir» sin que ninguna tarjeta
dijera cuál.

Debajo había un segundo hallazgo del patrón de siempre: `n_codificadas` llega
en el payload y **no tenía ningún consumidor**. El chip decía «A medias» y el
motor sabía que eran 27 de 75. Una pregunta a la que le queda una respuesta se
veía igual que ésta, en la lista donde se decide qué atender primero.

**La trampa**, esta vez cara: el chip pinta motivo y nota en la misma ranura, y
colapsarlos en una variable produjo un `title` que decía «Motivo: 48 sin
asignar». Los tests del módulo puro no llegan al markup, así que no lo vieron.
Un estado nuevo en un componente sin test de render se verifica solo mirándolo.

### L22 — el mismo «0 con dato» para tres situaciones opuestas

L20 se cerró sin hallazgos midiendo sobre `acrconta`, y dejó anotado que sólo
había visto la forma del contrato. Repetido sobre `acnur_acg` y `acnur_pdm`,
que sí traen Analítica preparada, apareció lo que `acrconta` no podía mostrar:
**tiene cero casos de los tres estados**. La limitación no era retórica.

La tarjeta de Datos leía `n_non_missing` y descartaba `n_missing`. Sin
denominador, «1241 con dato» no dice si es casi todo o la mitad. Y en el
extremo, tres situaciones opuestas escribían la misma frase:

| Variable | Qué pasa de verdad | Decía |
|---|---|---|
| `whynotconsent` (acnur_acg) | llegó y sus 1283 filas están vacías | `0 con dato` |
| `SPACE_nolabel` (acnur_pdm) | está en el formulario, no llegó en la base | `0 con dato` |
| `D1_information` (acnur_acg) | select_multiple repartido en sus dummies | `0 con dato` |

Las dos primeras entran **incluidas por defecto** en el reporte. La tercera es
el funcionamiento normal, y avisar ahí habría sido un falso positivo caro: hay
seis en los proyectos de referencia.

**El motor ya las distinguía** —columna ausente devuelve `0/0`, columna vacía
devuelve `0/n`— y el único dato que faltaba leer era `n_missing`. Arreglo de
frontend, sin tocar el engine.

**La trampa**, que es la de siempre en este GOAL con una vuelta más: el fixture
que se elige decide lo que se puede encontrar. `acrconta` no tenía ninguno de
los tres estados, así que el barrido dio verde por composición de la muestra y
no por conformidad del producto. Un «sin hallazgos» vale lo que valga el
proyecto sobre el que se midió, y eso hay que escribirlo al lado del resultado.

### L20 — Analítica y Dashboard, sin hallazgos

**Dashboard: V4 se cumple, y mejor de lo que parecía.** Una pestaña no
disponible no sólo aparece deshabilitada: lleva el motivo del motor en `title`,
en `aria-label` y en `data-audit-disabled-reason`, **en todos los modos**,
incluido el artefacto publicado. La banda extra de avisos que sí es sólo del
editor es un resumen, no el único portador de la razón. Un lector de pantalla
recibe «Relaciones. Carga la base y el instrumento primero».

**Analítica: los campos que pude alcanzar tienen consumidor.** `fields`, `kpis`,
`sources`, `tables` y `layout` de la ficha técnica se usan todos. Y los 409 de
`data-review` y `reconciliacion` explican la precondición en castellano llano
—«Primero corre el Paso 1»— en vez de fallar mudos.

**La limitación, que importa más que el resultado.** `acrconta` no tiene
Analítica preparada, así que esos dos endpoints devolvieron 409 y **medí la
forma del contrato, no un payload poblado**. Un campo puede tener consumidor y
aun así mostrarse mal cuando trae datos. Este barrido no descarta eso.

### L18 — módulos que el GOAL no había tocado

**Recopiladores: hallazgo de V3.** El motor declara `noop` en siete puntos
—guardar un plan idéntico, preparar un deployment sin cambios, sembrar cuando ya
hay estado— y el campo llegaba **tipado y normalizado** hasta el shell sin que
ningún componente lo leyera. Guardar y que no pase nada se veía igual que
guardar. Es el mismo patrón que `before_after_preview` en L13: el dato correcto,
llegando bien, sin consumidor.

La trampa que hace frágil el arreglo, y por eso el aviso vive en el embudo de
mutaciones y no en el estado: `collection_state_get` **también** devuelve
`noop: true` —leer nunca cambia nada— así que leerlo en la carga mostraría el
aviso cada vez que entras al módulo.

Hay precedente de hacerlo bien en la casa: Carga ya dice «Sin nuevas; se
conserva la base actual» para su propio noop.

**Hojas de ruta: sin hallazgo, y valió la pena descartarlo.** El payload trae
`has_data: false` junto a `territories: 50`, que leído rápido es una
contradicción de manual. No lo es: `has_data` habla de la data de población y
`territories` del marco cartográfico. Anotado para no volver a levantarlo.

**Bitácora: sin hallazgo.** Su canal de avisos (`bitacora_avisos_v1`) distingue
cuatro buckets —pendientes, silenciadas, pospuestas, historial— y el frontend
consume los cuatro. Es el módulo mejor cubierto de los barridos hasta ahora:
tiene su propio directorio `avisos/` y tests de semántica propios.

**Lo que sí apareció, y no es de vara.** `GET /api/diseno-estudio/state` calcula
protocolo, readiness, fuentes, decisiones, riesgos, próximas acciones, timeline
y biblioteca. `apiDisenoEstudioState()` existe en el cliente y **no la llama
nadie**: del módulo sólo se importan tipos.

No es una superficie que mienta: es un endpoint sin superficie. Y tiene dueño
documental — lo declaró el **ADR 0027**, que está *Reemplazado por 0029*, y el
0029 retiró explícitamente Expediente, Fuentes y Biblioteca y movió el agregador
de estado por módulo a `GET /api/project/overview`. Es decir: el payload que
sirve es exactamente lo que el 0029 dio de baja.

Retirarlo sería implementar un ADR aceptado, no tomar una decisión nueva. Pero
borrar un endpoint montado es un cambio de contrato y la regla de la casa pide
doble confirmación, así que queda como **L19** esperando tu visto bueno.

**Cálculo de muestra queda fuera**: lo está trabajando la otra sesión sobre este
mismo árbol.

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
