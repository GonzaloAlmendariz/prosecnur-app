# GOAL — Monitoreo de aulas, genuinamente profesional

Tipo: GOAL abierto · **solo Gonzalo lo cierra**
Abierto: 2026-08-28
Autoridad: encargo directo del dueño; es un loop de convergencia, no una lista
que se agota.

## El encargo, textual

> «Ya cálculo de muestra está cubierto, lo que nos importa a partir ya de la
> próxima semana en realidad es que **monitoreo sea algo genuinamente
> profesional, que esté a un nivel increíble de profesionalismo**. Un poco
> parecido a quizás otros monitoreos que van por ese camino y que quizás no han
> llegado, pero que creo que tú sí podrías.»

> «Puede haber hasta un E cuarenta y cinco. Hay muchas cosas que ver: si ya
> tienes curvas de probabilidad, si ya hay una forma de ir prediciendo cómo
> vamos, **si hay formas más accesibles para usuarios no técnicos**, medir el
> tema del rendimiento, de la actualización, si podemos poner a prueba viendo
> los resultados en **Kobo, qué tan rápido se leen**. Hay muchos pulidos
> estéticos, muchos conceptos que hay que ir puliendo, gráficas que hay que ir
> mejorando, tablas que hay que ir afinando, y **no hay algo que amerite que te
> detengas**.»

Y el acotamiento, que manda sobre todo lo anterior:

> «Con monitoreo me refiero **exclusivamente al monitoreo de aulas**. Monitoreo
> tiene otras secciones, pero la idea es que **no se genere un archivo
> gigante**, sino que cada uno tenga el suyo. Y de hecho creo que ya lo tienen.
> Nos centramos exclusivamente en monitoreo de aulas porque **este es nuestro
> scope principal**.»

Y la sinergia, que condiciona todos los frentes:

> «Hay **tres elementos en constante sinergia**: por un lado Kobo, por otro la
> aplicación, y por otro el Excel. El Excel da información sobre la
> **agendación** y el **registro de campo**. La aplicación **lee los primeros
> dos y genera el tercero** —básicamente la base de control, pero puede generar
> otras hojas adicionales— **sin reescribir las primeras dos, que son las que
> constantemente están editándose** y que lee. Esas tres tienen que estar en
> sinergia completa. Y la idea no es que se demoren: **un control y un monitoreo
> prácticamente en tiempo real de cuando el aplicador está en el aula**. A veces
> vamos a tener cien datos y a veces tres mil, **y eso es normal**.»

## El scope, literal

Dentro:

- `frontend/src/features/monitoreo/profiles/aulas/` — 247 archivos, 44.431
  líneas.
- `api/R/monitoreo_aulas*.R` — 26 archivos, 6.719 líneas.
- Endpoints `/api/monitoreo/aulas/*`.
- Las ocho pestañas del perfil: **carga · contacto · cuotas · efectividad ·
  estratos · facultad · rendimiento · resumen**.

Fuera, salvo que un ítem de aulas lo pida y se diga por qué: territorial,
acreditación, telefónico, el monolito `MonitoreoPage.tsx` y el chrome
compartido. Tocar el chrome compartido afecta a los cuatro modos: es un cambio
de otra escala y se declara antes de hacerlo.

**Ningún archivo del perfil de aulas está congelado a crecimiento hoy.** Eso no
es permiso: el dueño pidió explícitamente que no crezcan archivos gigantes, y
dos ya van por ese camino (ver N1 y N2).

## La vara

Un cambio pasa si mejora una de estas cuatro y no empeora las otras:

1. **Frescura**: el dato que se ve es el que hay, y llegó rápido.
2. **Legibilidad operativa**: alguien que no diseñó el estudio entiende qué pasa
   y qué hacer.
3. **Fiabilidad**: lo que la pantalla afirma se sostiene contra el dato.
4. **Materia**: se ve como un producto, no como un panel de depuración.

No cuenta como avance: pulir un archivo sin medir la superficie, ni declarar
verde por ausencia de hallazgos cuando nadie miró.

## De dónde sale este tablero

Cada ítem viene de una medición ya hecha, no de una impresión:
`docs/qa/deuda-monitoreo.md` (secciones 2 a 5),
`docs/qa/pulido-monitoreo-estado.md`,
`docs/qa/goal-monitoreo-calidad-campo-2026-08-13.md`,
`docs/qa/plan-dos-tasas-en-monitoreo-2026-08-28.md` y el ADR 0083.

## El tablero

Ocho frentes. Los frentes no se hacen en orden; dentro de un frente las
dependencias se dicen.

### S · La sinergia Kobo ↔ aplicación ↔ Excel — frente NUEVO y transversal

Lo que hay hoy, verificado el 2026-08-28 sobre el código:

- **Un solo libro con tres hojas**: `Aulas Agendadas`, `Aulas Aplicadas
  (Campo)` y `Base de control` (`AULAS_LIBRO_HOJAS` en `carga_aulas_libro.R`).
- `aulas_libro_importar()` **lee las tres**; ninguna es obligatoria y lo que
  falta se declara en `hojas_ausentes` en vez de mostrar un cero silencioso.
- `aulas_libro_generar()` **escribe las tres y guarda con `overwrite = TRUE`**,
  y **nunca lee el archivo existente**: no hay `read.xlsx`, ni `loadWorkbook`,
  ni `file.exists` en todo el generador. Compone las tres hojas desde el estado
  de sesión.
- Quién edita qué, según el dueño (2026-08-24): la **Base de control no la
  edita nadie**, es salida; la **agendación sí**; el **registro de campo a
  veces**.

| | Ítem | Estado |
|---|---|---|
| S1 | **MEDIDO el 2026-08-28, ver abajo.** Regenerar sin importar borra la edición; importar antes la conserva | ☑ medido, sin reparar |
| S1b | ~~Regenerar el libro pisa las dos hojas que el equipo edita.~~ El generador escribe agendación y registro de campo desde el estado de sesión y sobrescribe el archivo entero; nada compara con lo que hay en disco ni avisa. Si alguien editó después del último import, esas ediciones se pierden **en silencio**. Es el defecto central de este frente | ☐ verificado, sin reparar |
| S2 | **Separar lo que la app escribe de lo que el equipo edita.** El dueño lo pidió literal: generar la base de control y las hojas adicionales **sin reescribir las dos primeras** | ☐ |
| S3 | **Robustez a la edición externa**: una corrección en agendación o en registro de campo tiene que llegar a la app sin fricción. La regla del dueño es «lo que produzca la app tiene prioridad», que **no significa ignorar la corrección** sino que la app es la fuente y el Excel un canal de edición acotado | ☐ |
| S4 | **Medir el lazo completo Kobo → app → Excel** con el reloj en la mano. Hoy no existe esa medición para aulas | ☐ |
| S5 | **Escala 100 ↔ 3.000 y que eso sea normal.** Todo lo de este frente se mide en los dos extremos; una solución que sirva a 100 y se caiga a 3.000 no cierra el ítem | ☐ regla del frente |
| S6 | **`Base de control` se lee de vuelta al importar** aunque sea salida pura. Es deliberado —las filas ya registradas vuelven al libro al regenerarlo— pero convierte una salida en entrada y merece revisarse a la luz de S2 | ☐ |
| S7 | **Casi en tiempo real mientras el aplicador está en el aula.** Es el norte del frente: qué latencia es aceptable, qué se refresca solo y qué exige una acción | ☐ |

#### S1, medido end to end el 2026-08-28

Experimento sobre un plan de dos aulas: generar el libro, editar a mano dos
celdas de «Aulas Agendadas» —la fecha de agendamiento y el número de intentos
de contacto— y volver a generar.

| Camino | Fecha editada | Intentos editados |
|---|---|---|
| Lo escrito a mano | `2026-09-99-EDITADO` | 77 |
| **(A) Regenerar SIN importar** | **vacío** | **2** (el del plan) |
| **(B) Importar y luego regenerar** | `2026-09-99-EDITADO` | 77 |

**El camino seguro existe y funciona; el peligroso no avisa.** Regenerar sin
importar devuelve la hoja al estado del plan y la edición desaparece sin
error, sin comparación con el disco y sin aviso. Nada en la app impone el
orden ni detecta que el archivo es más nuevo que el último import.

**Por qué el round trip existente no lo cazaba.** `test-carga-aulas-libro-roundtrip.R`
tiene veinte tests y varios se llaman «el agendamiento ya registrado NO se
borra al regenerar», pero su ciclo es `generar → importar`: prueban que la app
relee lo que **ella misma** escribió. Ninguno introduce una edición externa
entre medias, que es el caso real —la hoja «está constantemente editándose»—.
Es cobertura que parece cubrir y mide otra cosa.

**La decisión, para que el próximo tick la implemente.** Se toma la vía que
el dueño pidió literalmente: **la app deja de reescribir las dos hojas que el
equipo edita.** El libro se genera entero **la primera vez** —de ahí salen la
cadena, los enlaces QR y la estructura— y a partir de ahí las regeneraciones
escriben sólo «Base de control» y las hojas adicionales, preservando las dos
primeras tal como estén en el disco. Descartadas: fusionar en cada regeneración
(mantiene el archivo único pero deja la fusión como punto de fallo silencioso)
y limitarse a avisar del desfase (pone en el operador la carga de un orden que
la app puede garantizar).

### N · Que no crezca un archivo gigante — pedido explícito del dueño

| | Ítem | Estado |
|---|---|---|
| N1 | **`aulasMonitoreo.css` tiene 6.149 líneas.** Es la hoja más grande del perfil y ya concentra el estilo de las ocho pestañas. Partirla por superficie, con el kit común aparte | ☐ |
| N2 | **`AulasMonitoreoPage.tsx` tiene 2.949 líneas** y monta las ocho pestañas. Cada pestaña debería ser su propio archivo y la página quedarse en el enrutado | ☐ |
| N3 | **`monitoreo_aulas_universitarias.R` tiene 2.352 líneas**, más de un tercio del backend de aulas. Regla de extracción en caliente: cada fix que lo toque saca su tema a `monitoreo_aulas_<tema>.R` | ☐ permanente |
| N4 | Cuando N1 y N2 estén hechos, **proponer líneas base de congelamiento** para lo que quede, en `agentic/manifest.json` | ☐ depende de N1, N2 |

### A · Frescura del dato — «el tema central» según el dueño (2026-07-23)

Aulas consume Kobo: la efectiva del estudio **se define en la plataforma, no en
el parte** (`monitoreo_aulas_efectivas.R`, vocabulario fijado por el dueño).

| | Ítem | Estado |
|---|---|---|
| A1 | **Medir qué tan rápido se leen los resultados de Kobo hasta aparecer en el perfil de aulas**, extremo a extremo, y publicarlo. Lo pidió explícitamente y hoy no existe esa superficie | ☐ |
| A2 | **Kobo sin timeout**: un socket colgado deja el sync infinito. Toca el cliente compartido; declararlo | ☐ |
| A3 | **Incremental de Kobo frágil**: cursor `_id > n` sólo en modo advance, fallback SILENCIOSO a full ante cualquier error, y no ve ediciones ni borrados. Una edición en Kobo no llega a aulas | ☐ |
| A4 | **Paginación secuencial**. Kobo expone `count`: las páginas 2..N pueden ir con `curl::multi` | ☐ |
| A5 | **No existe auto-sync**: todo manual. Con el post-pull en O(delta) nada impide un tick de 1–2 min | ☐ |
| A6 | **Residual 3.10e**: bloqueo intermitente del main thread de plumber, ~178 s en 1 de 3 corridas. Congela la app entera, aulas incluida. Siguiente paso ya definido: logging con timestamps en harvest/on_complete | ☐ abierto, medido |

### B · Velocidad del perfil de aulas

| | Ítem | Estado |
|---|---|---|
| B1 | **Medir el coste real del dashboard de aulas**: `monitoreo_aulas_dashboard_cached` con su token. Cuánto cuesta un hit y cuánto un miss, sobre el `.pulso` de HSVG2026 | ☐ mide primero |
| B2 | **`AulasMonitoreoPage.tsx` sin `React.memo`**: cualquier setState re-renderiza las ocho pestañas | ☐ |
| B3 | **Payloads fila-por-fila**: comprobar si el patrón `lapply(seq_len(nrow(df)))` alcanza los motores de aulas | ☐ |
| B4 | **Invalidación**: qué invalida el token de aulas y si es selectivo o nuclear | ☐ |

### C · Legibilidad para quien no diseñó el estudio — frente NUEVO

| | Ítem | Estado |
|---|---|---|
| C1 | **Inventario de jerga en las ocho pestañas**: τ, elegible, estrato, cuota, afijación, p25. Cuál se dice en castellano y cuál se queda con su glosa al lado | ☐ |
| C2 | **Cada aviso dice su causa**, no sólo el hecho (ADR 0077). Medir cobertura real en aulas | ☐ |
| C3 | **Cada aviso dice qué hacer.** Varios diagnostican sin proponer acción | ☐ |
| C4 | **Todo número con su denominador visible.** Es el defecto más repetido del repo | ☐ |
| C5 | **El recorrido de primera vez** en las ocho pestañas. Hecho para dos superficies en el commit `e863b715`; faltan las demás | ☐ parcial |

### D · Predecir cómo vamos

| | Ítem | Estado |
|---|---|---|
| D1 | **La curva continua del ADR 0083** en el esquema de config | ☐ |
| D2 | **La banda de proyección ya existe** en el seguimiento de efectividad; falta que la serie diaria la use en vez de un esperado puntual | ☐ |
| D3 | **Actualización bayesiana de la tasa durante el campo.** Bloqueado por D1. Su invariante va antes que su fórmula; `porAulaAjustado` ya implementa encogimiento con `PESO_DEL_PRIOR` | ☐ bloqueado |
| D4 | **La ventana de reacción, dicha en pantalla**: con 7 días de anticipación la señal de la semana 2 es la última accionable, y el campo se concentra 86 · 68 · 36 · 4 por semana | ☐ |
| D5 | **Probabilidad de cierre por facultad**, no sólo proyección puntual | ☐ |
| D6 | **Invariante de monotonicidad** sobre el marco entero. Parte de **3.727 de 123.688 pares invertidos** | ☐ |
| D7 | **Invariante del sello**: **3.157,8** sobre los 174 titulares, antes y después | ☐ |

### E · Pulido estético

`pulido-monitoreo-estado.md` cubrió acreditación y telefónico. **Aulas apenas
aparece**, así que aquí el trabajo no es rematar pendientes ajenos sino auditar
por primera vez.

| | Ítem | Estado |
|---|---|---|
| E1 | **Auditar las ocho pestañas de aulas** con los detectores medidos: recortes, solapes, contenido cortado, escala de radios y tipografía. Una fila por pestaña, con su cifra | ☐ ninguna auditada |
| E2 | **Declarar el Contrato de Superficie (C1)** en las superficies de aulas que no lo tengan: sin declaración el gate no puede aprobar | ☐ |
| E3 | **Matriz de viewports**: 1440×1000 y 1024×600 mínimo | ☐ |
| E4 | **Un día de muy pocos casos** no puede romper la codificación de una barra apilada. Medido en Ritmo diario de telefónico; comprobar si la serie de aulas tiene el mismo defecto | ☐ |

### F · Conceptos y nomenclatura

| | Ítem | Estado |
|---|---|---|
| F1 | **Tres tasas de la misma forma con tres numeradores distintos** conviven en Monitoreo: `effective_surveys` del parte, `sent_total` de la hoja y la efectiva de plataforma. El ADR 0082 fijó que sólo la de plataforma es τ; comprobar que el perfil de aulas lo respeta en las ocho pestañas | ☐ |
| F2 | **Continuar el barrido de colisiones.** Tres cerradas en `e863b715`; el barrido cubrió dos superficies de ocho | ☐ parcial |
| F3 | **Taxonomías de estado**: que un mismo estado se llame igual en las ocho pestañas | ☐ |

### G · Gráficas y tablas

| | Ítem | Estado |
|---|---|---|
| G1 | **Inventario de los gráficos de aulas** con qué pregunta contesta cada uno. El que no conteste ninguna, fuera | ☐ |
| G2 | **Tablas**: densidad, dígitos tabulares alineados, orden por defecto. En Consultas se midieron 435 cadenas redundantes por repetir abajo lo que ya decía arriba; buscar el mismo patrón en aulas | ☐ |
| G3 | **La serie de rendimiento** es el gráfico más cargado del perfil (1.404 líneas). Revisar si dice más de lo que se puede leer de un vistazo | ☐ |

### H · Calidad de campo y cierre

| | Ítem | Estado |
|---|---|---|
| H1 | **M7 escrito** — la decisión ya está tomada | ☐ |
| H2 | **M5** — bloqueado por si Kobo expone marcas de tiempo por pregunta | ☐ bloqueado |
| H3 | **`candidatosDeReemplazo` prioriza por margen de celda de sexo**, no sólo por puntuación del candidato | ☐ |

## Reglas del recorrido

- **Cada ítem cerrado deja su cifra**, antes y después. Un ítem sin medición no
  se cierra.
- **El gate se escala al diff**: suites del área tocada, nunca la completa.
- **Medir en la app, no leer CSS.** Auditar a ojo es inviable.
- **El proyecto de referencia decide el resultado.** Para aulas, el `.pulso` de
  HSVG2026; hay copia de trabajo en el scratchpad.
- **Todo se mide a las dos escalas**: ~100 y ~3.000 registros. Las dos son
  normales y una solución que sólo sirva a una no cierra su ítem.
- **Verde por conformidad, no por ausencia.** Se reportan tres números:
  conformes, no conformes y **no declaradas**.
- **Un frente terminado no cierra el GOAL.** Sólo Gonzalo lo cierra.
