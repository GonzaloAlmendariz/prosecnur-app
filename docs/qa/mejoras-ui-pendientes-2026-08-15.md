# Mejoras de UI pendientes — salidas de la revisión de ACNUR V3

**Fecha**: 2026-08-15 · **Origen**: revisión del primer entregable de PDM Medios
de Vida 2026, que destapó seis defectos de motor y dos ADR.

Todo lo de backend está cerrado y verificado. Lo que queda es superficie: cosas
que el motor ya sabe y la interfaz todavía no dice. Cada ítem indica dónde vive,
por qué importa y cómo comprobar que quedó bien.

Los tres primeros son consecuencia directa de decisiones ya tomadas y tienen su
ADR detrás. El cuarto es independiente y el quinto está descartado a propósito.

---

## 1 · Limpieza: la base depurada ya rige, y la UI la sigue ofreciendo

**Estado**: **hecho** (2026-08-15) · **ADR**: [0076](../adrs/0076-una-base-depurada-se-promueve-no-se-recomienda.md) (Aceptado, implementación completa)

**Cómo quedó.** `PromocionBase.tsx` declara el hecho arriba de la cola de
hallazgos, con tres estados y un mismo marco: **rige** («Pasó de 1283 a 1281
casos… Codificación, Analítica y los entregables ya usan esta base») con botón
Revertir y confirmación en línea que dice a qué N se vuelve y qué obliga a
rehacer; **bloqueada**, que nombra el motivo y avisa que la exclusión no llegó;
y **revertida**, que recuerda que las decisiones siguen guardadas. Sin linaje no
hay superficie.

El backend suma `POST /api/validacion/v2/limpieza/revertir-promocion`
(`limpieza_revertir_promocion()` → restituye + invalida aguas abajo; 409
`E_LIMPIEZA_SIN_PROMOCION` si no hay nada que revertir). Dos trampas que se
arreglaron por el camino: `build_limpieza()` ahora lee el linaje **vigente** de
la base y no el congelado del cierre —editar una decisión limpia
`limpieza_artifacts` mientras la base promovida sigue rigiendo—, y `bloqueo`
sólo viaja si existe, porque el serializer unboxed convierte un `NULL` en `{}`.

**Verificado**: `acnur_acg` con dos casos excluidos — banner, revertir, vuelta a
1283 y 409 al revertir dos veces; el bloqueo por repeats se comprobó sobre
`acnur_pdm` (madre `bloqueada=TRUE` con 1 hija, hija `FALSE`) y su copy con test
de render. Suites: `test-limpieza-*`, `test-validacion-v2-limpieza-builder`,
vitest de `features/validacion`, typecheck.

**Qué pasa.** `limpieza_finalize()` ahora promueve la base depurada a data
vigente del estudio y declara su linaje. La pestaña sigue presentándola como
antes: un archivo llamado «Base final limpia» en la lista de descargas, y un
`recommended_file_id` que ya no describe lo que ocurre. El analista excluye dos
casos, ve un archivo para bajar, y no tiene forma de saber que la base del
estudio **ya cambió**.

**Dónde vive**: `frontend/src/features/validacion/tabs/LimpiezaTab.tsx`
(`extractArtifacts`, ~línea 2690) · el backend ya devuelve
`artifacts.promocion` con `enabled`, `n_casos_antes`, `n_casos_despues`,
`source_data_file_id` y `bloqueo`.

**Qué debería decir.** El hecho, no el archivo: «la base del estudio pasó de 103
a 101 casos». Y ofrecer **revertir**, que el backend ya soporta con
`.limpieza_revertir_promocion()` pero no tiene endpoint ni botón.

**Caso que no puede quedar mudo**: cuando la base tiene grupos repetibles la
promoción se bloquea y el linaje trae `bloqueo` con el motivo. Hoy eso no se ve
en ninguna parte y el analista creería que su exclusión rigió.

**Cómo verificar**: abrir `ACNUR_V3_final.pulso`, ir a Limpieza y comprobar que
la pestaña declara el cambio de N y permite volver atrás.

---

## 2 · Codificación: el contador de variables sin decidir

**Estado**: pendiente · **ADR**: [0078](../adrs/0078-marcar-una-variable-abre-una-decision-no-la-cierra.md) (Propuesto — ratificar antes de construir)

**Qué pasa.** Marcar una variable declara la intención de codificarla y nada
avisa si nunca se crean las categorías. En ACNUR V3 eran 9 marcadas, 3 con
categorías y 5 pendientes que se entregaron sin recodificar.

**Dónde vive**: `frontend/src/features/codificacion/PreguntasLanding.tsx` es la
lista donde hoy se ve el estado por pregunta.

**Lo que la UI tiene que distinguir**, y hoy no:

| Estado | Cómo se ve hoy | Cómo debería verse |
|---|---|---|
| Marcada, con respuestas, sin categorías | igual que las demás | **pendiente**, con cuántas respuestas tiene |
| Marcada, sin respuestas | igual | cerrada sola, sin ruido |
| Catálogo creado, respuestas sin asignar | parece resuelta | **pendiente parcial** |
| Marcada y decidida «no categorizar» | imposible de expresar | cerrada, con su motivo visible |

**Contrato de superficie**: es un caso de C5 (suficiencia). La lista promete
decir en qué estado está cada pregunta y hoy no puede cumplirlo, porque cuatro
situaciones distintas comparten la misma apariencia.

**Cómo verificar**: con el `.pulso` original de Ulises
(`ACNUR_V3_Ulises.pulso`), la pestaña debe reportar 4 pendientes entre las
marcadas y no contar las dos sin respuestas.

---

## 3 · Codificación: registrar «no categorizar» y advertir al aplicar

**Estado**: pendiente · **ADR**: [0078](../adrs/0078-marcar-una-variable-abre-una-decision-no-la-cierra.md)

**Qué pasa.** En esta misma revisión decidimos no categorizar `NowSalary` (16
respuestas) ni `PastSalary` (4) por `n` insuficiente. Es una decisión
metodológica correcta y **no tiene dónde vivir**: quien abra el proyecto después
verá dos variables marcadas sin categorías y no podrá distinguirla de un olvido.

Son dos piezas:

- **Registrar la decisión** con su motivo, como Validación registra «conservar».
- **Advertir al aplicar**: declarar qué variables se van a entregar sin
  recodificar. Sin bloquear —el ADR es explícito en que un gate aquí se
  satisfaría desmarcando todo.

**Dónde vive**: la acción en `PreguntaDetalle.tsx` o `CodificarWizard.tsx`; la
advertencia en el punto donde hoy se dispara `/api/codificacion/aplicar`.

---

## 4 · Codificación: qué marcó la persona en las preguntas de opción múltiple

**Estado**: pendiente · **Sin ADR** — es mejora de ayuda a la decisión, no cambia contratos

**Qué pasa.** Al clasificar una respuesta abierta de un `select_multiple`, el
analista no ve qué opciones marcó esa misma persona en la pregunta. Y eso
cambia la decisión correcta: si la manda a un código que la persona **ya
marcó**, el recodeo es una operación nula y el matiz que escribió se pierde; si
la manda a uno que no marcó, le suma una mención y mueve el porcentaje de esa
categoría.

En ACNUR V3, **18 de las 47 respuestas abiertas** de preguntas múltiples venían
de filas que ya tenían otros códigos marcados: el 38%.

**Alcance acordado — solo el dropdown.** En `QuickAssignDropdown`, marcar con un
«ya marcada» las opciones que esa fila ya tiene. Aparece únicamente al elegir
destino, que es donde se comete el error, y no agrega nada a la lista de
siempre.

**Descartado a propósito**: chips en la fila de respuesta. Se verían casi iguales
a los `GrupoMembershipChips` y significan lo contrario —uno es lo que hizo el
analista, otro lo que hizo el encuestado—, y la fila ya carga texto, frecuencia,
variantes y grupos asignados.

**Detalle que hay que resolver**: la lista agrupa por texto único, no por fila.
Cuando una respuesta viene de varias personas con marcas distintas, el aviso
tiene que ir en proporción («2 de 3 ya marcaron esta opción»). En ACNUR V3 todas
tenían frecuencia 1, pero el motor debe soportar ambos casos o miente.

**Backend**: `/api/codificacion/respuestas` hoy devuelve `texto`, `label`,
`variantes`, `frecuencia` y una muestra de `uuids`; hay que sumar los códigos ya
marcados por las filas que aportan a cada respuesta.

**Dónde vive**: `frontend/src/features/codificacion/RespuestasCodificador.tsx`
· tipo `RespuestaUnica` en `frontend/src/api/codificacion.ts:223`.

---

## 5 · Descartado: detalle por caso al expandir una respuesta

Se evaluó mostrar, al expandir una respuesta abierta, la lista de casos que la
dieron con su `Pulso_code` y lo que marcó cada uno. **Se descarta**: es una
superficie nueva entera para un dato que se consulta una vez cada tanto, y el
ítem 4 resuelve el 90% del problema en el momento en que importa.

Si alguna vez se retoma, dos cosas a saber: `uuids` viene **truncado a 10** en
`router_codificacion.R:810` sin avisar que hay más, y el identificador a mostrar
debería ser `Pulso_code` y no `_uuid`, que es el hash de Kobo e ilegible para
quien revisa.

---

## Estado

| # | Ítem | Estado |
|---|---|---|
| 1 | Limpieza declara qué base rige y deja revertir | **hecho** (2026-08-15) |
| 2 | Codificación distingue los cuatro estados por pregunta | **bloqueado** — ADR 0078 en Propuesto |
| 3 | Registrar «no categorizar» y advertir al aplicar | **bloqueado** — ADR 0078 en Propuesto |
| 4 | Qué marcó la persona al clasificar una abierta múltiple | pendiente — sin dependencias |
| 5 | Detalle por caso al expandir una respuesta | descartado a propósito |

## Orden sugerido

1. ~~**Ítem 1**~~ — hecho.
2. **Ítem 4** — independiente, no espera ratificación de nadie, y evita errores
   de codificación en cada estudio con preguntas múltiples.
3. **Ítems 2 y 3** — juntos, y **después de ratificar el ADR 0078**, porque
   definen vocabulario que va a la interfaz y a los reportes.

## Lo que no es de UI y sigue abierto

- **`Enumerator_name` sin normalizar** en el entregable de ACNUR V3: siete
  valores para cinco encuestadores, incluido un número de teléfono en el campo
  del nombre. Es limpieza del proyecto, no del producto.
- **`recommended_file_id`**: con la promoción del ADR 0076, el campo quedó como
  legado. El Cumplimiento del ADR pide decidir explícitamente si se usa o se
  retira.
