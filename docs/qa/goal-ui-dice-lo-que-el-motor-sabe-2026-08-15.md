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
| **V6** | Toda vista de Procesamiento es enlazable. | `?pestana=` abre la pestaña y `window.__pulsoNav.ir()` devuelve `true` para cada nodo del manifiesto. Sin `direccionPublicada: false` en pestañas de sección. |
| **V7** | Cada estado nuevo de superficie tiene test que lo distingue del vecino. | Test de render por estado, con el control: si el arreglo se revirtiera, el aserto falla. |

---

## Cola

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| **L1** | Limpieza declara qué base rige y deja revertir | `components/PromocionBase.tsx` · `limpieza_decision_engine.R` · endpoint `revertir-promocion` | ☑ hecho — `ce9bd5da`. 1283 → 1281 en acnur_acg, revertir vuelve a 1283, segundo revertir 409. Bloqueo por repeats comprobado en acnur_pdm. |
| **L2** | La pestaña de Validación vive en la URL | `features/validacion/pestanaDireccionable.ts` · `catalogos/procesamiento.ts` | ☑ hecho — `d1e9f32f`. Deep-link, `ir()` y click del rail verificados. |
| **L3** | Codificación distingue los cuatro estados por pregunta | `codificacion/PreguntasLanding.tsx` | ⛔ bloqueado — ADR 0078 en **Propuesto**. Desbloquea: que Gonzalo lo ratifique. Define vocabulario que va a la interfaz y a los reportes. |
| **L4** | Registrar «no categorizar» con su motivo, y advertir al aplicar | `PreguntaDetalle.tsx` / `CodificarWizard.tsx` · `/api/codificacion/aplicar` | ⛔ bloqueado — mismo ADR 0078. Sin gate: el ADR es explícito en que un gate se satisfaría desmarcando todo. |
| **L5** | El dropdown muestra qué marcó esa persona en la múltiple | `codificacion/marcasPrevias.ts` · `QuickAssignDropdown` · `/api/codificacion/respuestas` | ☑ hecho — `d4273aea`. Medido en ULISESV3: 17 de 45 respuestas abiertas de sus SM vienen de filas con códigos ya marcados. |
| **L6** | Decidir si `recommended_file_id` se usa o se retira | `limpieza_decision_engine.R` · `validacion/types.ts` | ☑ hecho — `8bee2e76`, **se retiró**. Un productor, una declaración de tipo, cero consumidores. La decisión quedó anotada en el ADR. |
| **L7** | Las pestañas del Dashboard no publican dirección | `catalogos/dashboard.ts` · `dashboard/store.ts` | ⛔ bloqueado — necesita tu decisión, ver abajo. |
| **L8** | Barrido V1: contrastar lo que dice cada pestaña de Procesamiento contra su payload | las cinco secciones, con un proyecto real | ☐ sin empezar — es la medición de la vara, no un arreglo. Lo que encuentre entra como ítem nuevo. |

### L7 — lo que encontré y por qué no lo decido yo

`tabActiva` vive en el store de Dashboard (`store.ts:493`), igual que vivía
`activeTab` en Validación antes de L2, y las cuatro pestañas se declaran con
`direccionPublicada: false` **en el tipo**, no como opción: `PestanaDashboard`
lo tiene hardcodeado. Consecuencia medible: el recorrido del QA visual sólo
alcanza Resumen; Relaciones, Base de datos y Dimensiones no se pueden abrir con
`__pulsoNav.ir()`.

Lo que no puedo decidir solo: el mismo catálogo alimenta el editor interno y el
artefacto publicado que ve el cliente del estudio. Si son secciones de un
documento, `direccionPublicada: false` es correcto y el hueco de QA se resuelve
de otra forma; si son pestañas del editor, se publican como las de Validación.

**Mi recomendación**: publicarlas sólo en la ruta de admin. El artefacto público
no cambia —es otra app (`PublicArtifactApp`)— y el editor gana deep-link y
recorrido de QA. Pero toca una superficie de marca y la decisión es tuya.

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
