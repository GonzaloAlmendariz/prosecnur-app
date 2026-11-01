# ADR 0122: El Planner define el estudio una sola vez y su perfil de recojo fija los modos

Estado: Aceptado (Gonzalo, 2026-10-31: «sí»)

Implementación: En curso — P1 backend 14ffb0a63, P1 frontend a40635f8a, candado del §7 (unidad 5) en el commit que suma esta línea

Fecha: 2026-10-31

Fecha de decisión: 2026-10-31

Reemplaza: —

Reemplazado en parte por: [ADR 0123](0123-el-planner-solo-define-el-tipo-y-el-camino-del-estudio.md) (2026-11-01). Ya no rigen: el alcance y las secciones de §1, las filas de §2 y §3 que hacen del Planner dueño de universo, variables, equipo, códigos e insumos, la escritura de esos bloques en §6 y la proyección visible de §7 (sobrevive sólo como deducción interna del modo). El resto sigue vigente; el detalle está en la cabecera del 0123.

Extiende: [ADR 0044](0044-jerarquia-y-direcciones-de-navegacion.md) (dice quién determina el modo) y
[ADR 0118](0118-hojas-de-ruta-entrega-a-material-de-campo.md) (la foto con huella se generaliza a todos los perfiles).

Enmienda:

- [ADR 0121](0121-la-representatividad-la-declara-el-estudio-universo-y-variables.md) §2 (quién declara el universo y
  las variables de cuota, y qué es la copia a `design_targets`) y su cláusula de coordinación (§3 y fase P2 de abajo).
- [ADR 0047](0047-bitacora-cronograma-canvas-vinculado.md): Bitácora pasa a ser el Planner, y Calendario y Lienzo
  dejan de ser secciones para ser pestañas (§1). El 0047 está Propuesto pero implementado; se enmienda, no se extiende.
- [ADR 0111](0111-material-de-campo-se-organiza-por-campanas-tipadas.md) §3: el modo sigue siendo el tipo de la
  campaña abierta, pero «Nueva campaña» ya no ofrece cualquier tipo, sólo los de los perfiles declarados (§4).

Origen: pedido de Gonzalo del 2026-10-31 y decisiones P9 y P11 del doc vivo
`docs/qa/arquitectura-campo-planner-2026-10-31.md` (Gonzalo dio el «go»). Este ADR toma las diez decisiones que la
revisión de `guardian-contratos` (§12 del doc vivo) exigió antes de escribir código.

> «definir bastante bien qué va a ser monitoreo, material, cálculo de muestra, el planner, el editor de formularios,
> y cómo todo termina en procesamiento y en dashboards»

> «¿qué tipo de monitoreo es? ¿qué tipo de cálculo de muestra es? Todo eso ya se puede definir en el planner […] ya
> no necesitamos que cálculo de muestra tenga como caminos»

> «bitácora en vez de llamarse bitácora puede llamarse planeador o algo más profesional como planner y puede ayudar a
> definir los campos, y un poco todo para que todos los módulos se conecten entre sí»

## Contexto

Las definiciones del estudio no tienen casa. Cada módulo guarda la suya y la pide de nuevo:

- **El tipo de estudio se elige tres veces.** Cálculo de muestra lo pregunta en su modo `sin-definir` con
  `SelectorTipo` (sección `pathways`, `POST /api/calc-muestra/iniciar-estudio`, que escribe
  `calc_muestra_estudio$macro_familia`; el modo lo infiere `inferDesk`, `CalcMuestraPage.tsx:295-305`). Monitoreo lo
  pregunta con `MonitoreoModeChoice` mientras `route_selected` no es verdadero y lo guarda en
  `monitoreo_config$monitoreo_profile$family` (`POST /api/monitoreo/config`), y lo fija también al importar desde
  Cálculo (`router_monitoreo.R:5461-5467`). Material deja elegir cualquier tipo en «Nueva campaña»
  (`DialogoNuevaCampana.tsx:58`). El ADR 0044 ya dijo que «el modo lo determina el estudio, no un click», pero no dijo
  **dónde** declara el estudio su tipo.
- **Las cuotas viven en tres lugares con tres formas**: el escenario de Cálculo de muestra (aulas, copiado a
  `design_targets.representatividad` por el ADR 0121 §2), `monitoreo_cuotas` (acreditación) y la muestra de
  `hojas_ruta_runs` (territorial).
- **El equipo de campo no tiene una sola lista**: `monitoreo_config$territorial$enumerator_roster` en territorial, el
  libro del operativo y `monitoreo_aulas_disponibilidad` en aulas, texto libre («Responsable») en el barrido
  telefónico.
- **Los códigos de resultado de la visita no existen en la app**: cada hoja de Word trae los suyos.
- **Dos cruces escriben o mutan estado ajeno**: la entrega de Material de aulas escribe `monitoreo_aulas_plan`
  (`collection_engine.R:150`), y la semilla de Material prefiere ese mismo plan (`.collection_seed_source`,
  `collection_engine.R:175-182`): un ciclo que hoy contiene `.collection_origen_circular`. La lectura de la muestra
  territorial desde Monitoreo llama a `.hojas_ruta_ensure_runs(sid)` (`router_monitoreo.R:620`), y también la cobertura
  del plan en Gráficos (`graficos_plan_coverage.R:285`). `ensure_runs` crea la corrida `field` si falta y
  `.hojas_ruta_store_runs` marca dirty cuando hay `cambio_real` (`router_hojas_ruta.R:301`): una lectura escribe en
  Hojas de ruta.

La Bitácora (`/bitacora`, slug `diseno-estudio`, ADR 0029 y 0047) ya es el lugar donde se registra y se planifica el
estudio, pero no declara nada que otro módulo lea. Es el candidato natural: no se agrega un noveno módulo, se le da a
uno existente el trabajo que falta.

La decisión toca persistencia del `.pulso`, el contrato de navegación v3, el modo público, datos personales y la
frontera entre cinco módulos. Por eso necesita un ADR antes de código.

## Decisión

### 1. La Bitácora se renombra Planner y declara el estudio para todos

**Nombre, ruta y secciones (decisión 10 de §12).**

- Nombre visible: **Planner** (título largo «Planner del estudio»). Ruta canónica: **`/planner`**.
- `/bitacora` y `/diseno-estudio` quedan como alias: se leen y redirigen, nunca se escriben (ADR 0044 §3).
- El slug interno **`diseno-estudio` no cambia**. Es contrato: lo usan los tonos `--pulso-module-*`, el manifiesto de
  navegación, los tests de contrato y los consumidores que lo nombran (`scripts/build-visual-catalog.mjs`,
  `warmupRegistry.ts`, `moduleCardModel.ts`, `TabSemanticsAudit` y los contratos de movimiento). Es el mismo criterio
  que el ADR 0044 aplicó a `family`: el concepto cambia de nombre en la UI, el cable no. La ruta sí cambia sin
  romper nada: `TABLA_RUTAS` sale de `modulo.to` (`direccion.ts:150-178`).
- **El redirect conserva la query.** El de hoy (`<Navigate to="/bitacora">`, `App.tsx:159`) la descarta; los de
  `/bitacora` y `/diseno-estudio` a `/planner` la pasan entera, o `/bitacora?seccion=cronograma` caería en el landing.
- Secciones, en este orden (top bar, ADR 0042):

| Sección | Qué declara o muestra | Pestañas |
|---|---|---|
| `estudio` | Identidad (nombre, código, cliente), **perfiles de recojo** y sus poblaciones, insumos del cliente | `identidad` · `perfiles` · `insumos` |
| `muestra` | Universo y variables de cuota de cada población (§3) | — |
| `equipo` | La lista de personas del equipo de campo con su código y rol (§7) | — |
| `codigos` | Códigos de resultado de la visita y status del barrido telefónico | `resultado` · `barrido` |
| `cronograma` | Fases y fechas (ADR 0047) | `gantt` · `mes` · `semana` |
| `bitacora` | Registro de decisiones y lienzo (ADR 0047) | `registro` · `lienzo` |

  El Calendario y el Lienzo del ADR 0047 dejan de ser secciones y pasan a pestañas de Cronograma y Bitácora. El landing
  del módulo es `estudio`. Dos cosas lo hacen posible sin perder enlaces ni nodos:
  - **Alias por valor.** `ALIAS_LEGACY` de `direccion.ts` sólo renombra parámetros. Se agrega un alias por valor,
    declarado por módulo: `seccion=calendario&pestana=X` → `seccion=cronograma&pestana=X`, `seccion=calendario` →
    `seccion=cronograma&pestana=mes`, `seccion=canvas` → `seccion=bitacora&pestana=lienzo`. Se lee, nunca se escribe.
  - **Los nodos del lienzo se reescriben al cargar.** Las claves de destino de `bitacora_canvas` usan ids de sección
    (ADR 0047): un nodo guardado con destino `calendario` o `canvas` quedaría huérfano. `.bitacora_migrar_estado`
    reescribe esas claves a `cronograma` + pestaña `mes` y `bitacora` + pestaña `lienzo`, de forma idempotente y sin
    marcar dirty (el `.pulso` se actualiza en el siguiente guardado).
- La fase «Diseño» del cronograma sigue retirada (ADR 0047): el Planner no se planifica a sí mismo.

**Qué hace y qué no.** El Planner **declara**. No calcula muestras, no sortea, no genera archivos de campo y no mide
avance. Todo lo que declara lo consultan los demás; ninguno lo copia salvo como foto con sello (§2).

### 2. Qué se toma como foto con sello y qué se consulta directo (decisión 2)

Regla general: **se consulta directo lo que define; se toma como foto lo que se mide o se imprime contra ello.** Una
meta de campo no puede moverse en medio del campo (ADR 0079), y un formato impreso no cambia aunque el Planner cambie.

| Dato | Dueño | Quién lo usa | Cómo | Por qué |
|---|---|---|---|---|
| Identidad del estudio | Planner | Todos, Home | Consulta directa | No hay nada que medir contra el nombre |
| Perfiles de recojo y poblaciones | Planner | Cálculo, Hojas, Material, Monitoreo, Home | Consulta directa | Fija los modos (§4); cambiarlo cambia la navegación en el acto |
| Universo y variables de cuota | Planner | Cálculo y Hojas de ruta (los diseñadores) | Consulta directa | Son la entrada del diseño |
| Celdas con cuota (el reparto) | Cálculo de muestra (aulas, telefónico, acreditación); Hojas de ruta (territorial) | Monitoreo | **Foto con sello** en `design_targets` | Es la meta del campo: se congela (ADR 0079) |
| Equipo (código, nombre, rol) | Planner | Material (asignación, distribución), Monitoreo (atribución) | Consulta directa | Atribuye por código; un código que sale del equipo se muestra «fuera del equipo», no se borra |
| Códigos de resultado y status del barrido | Planner | Material (formatos), Monitoreo (lectura) | Consulta directa al catálogo; **cada formato impreso lleva la versión del catálogo en su sello** | El catálogo sólo agrega (§6): un código nunca cambia de significado, así que la consulta directa es segura y el sello dice con qué versión se llenó |
| Cronograma y fechas | Planner | Home, Monitoreo (ventana de campo) | Consulta directa | Informa, no mide |
| Insumos del cliente | Planner (registro) | Cálculo, Material, Monitoreo | Consulta directa al registro; el archivo sigue en `files/` | El registro dice qué es y de dónde vino |
| Muestra enviada (territorial) | Hojas de ruta | Material, Monitoreo | **Foto con sello** (ADR 0118 §3) | Lo que salió a campo |
| Aulas sorteadas | Cálculo de muestra | Material | **Foto con sello** (§8) | Lo que salió a campo |
| Entrega de Material (aulas) | Material | Monitoreo | **Foto con sello** (§8) | Lo que se repartió |

Una consulta directa es una función pura: no escribe, no marca `project_dirty` y no llama a nada que escriba. Eso
también rige para las dos lecturas de Hojas de ruta que hoy escriben: la de Monitoreo territorial, que lee la foto
enviada con su `sample_fingerprint` (cruce X5), y la de `graficos_plan_coverage.R:285`. Ninguna vuelve a llamar a
`.hojas_ruta_ensure_runs`; si la corrida no existe, la lectura lo dice y no la crea.

### 3. Relación con el ADR 0121: quién declara, quién reparte, quién congela (decisión 1)

Se enmienda el ADR 0121 §2. El bloque `representatividad_v1` no cambia de forma; cambia quién escribe cada parte.

| Parte del bloque | Dueño hoy (0121 §2) | Dueño con este ADR |
|---|---|---|
| `universo`, `variables` | Escenario activo de Cálculo de muestra | **Planner**, por población (`planner.poblaciones[].representatividad`) |
| `celdas`, `agrupacion_operativa` | Cálculo de muestra | Cálculo de muestra (sin cambio). En territorial, Hojas de ruta |
| `design_targets.representatividad` | Copia de Monitoreo | **Foto con sello** de Monitoreo: el bloque completo más `sello` (§5) |

- **La copia se queda.** `monitoreo_aulas_from_calc` y `monitoreo_acreditacion_from_calc` siguen copiando, porque la
  copia congela la meta (ADR 0079). Lo que cambia es que la copia lleva sello: la revisión de la declaración del
  Planner y la huella de la selección de Cálculo. Si cualquiera de las dos diverge, Monitoreo dice «el diseño cambió
  desde la importación del dd/mm» y no compara contra el diseño nuevo hasta que se reimporte. Nunca reimporta solo.
- **Las dos importaciones leen el estado persistido, no el body.** Hoy
  `POST /api/monitoreo/aulas/import-from-calc-muestra` acepta `estudio`, `selection` y `frame`
  (`router_monitoreo.R:5447-5449`) y `config` (`:5458`) desde el cliente, y
  `POST /api/monitoreo/import-from-calc-muestra` (acreditación) hace lo mismo (`:5650`). Con este ADR el body de ambas
  sólo confirma (`expected_selection_run_id`); el plan, el estudio, el marco y la configuración salen del estado
  persistido. Un cliente no puede inyectar un plan que no es el persistido.
- **La importación de aulas deja de fijar el perfil** (`router_monitoreo.R:5461-5467`): el perfil lo declara el
  Planner.
- **Ownership de sesiones.** La cláusula de coordinación del ADR 0121 («ninguna otra sesión toca `calc_muestra_*`,
  `design_targets` ni el foco») sigue vigente y se extiende a este ADR: el Planner no escribe ninguna de esas claves, y
  **todo cambio de este ADR que toque `calc_muestra_*` lo hace la sesión dueña del 0121**. Eso incluye la parte de
  Cálculo de la fase P2 (`iniciar-estudio` escribe `calc_muestra_estudio`), que va después de la F4 del 0121. La F4 la
  hace esa misma sesión, pero **escribe universo y variables en el Planner** (con la función de escritura del motor
  del Planner) y no en el escenario; por eso espera a la fase P1 de este ADR. Las celdas sí van al escenario, como ya
  decía el 0121.
- **Compatibilidad del 0121.** Un `design_targets` sin sello (importado antes) se lee como «sello desconocido»: se
  muestra y se compara como hoy, con el aviso de que no se puede comprobar si el diseño cambió. El traductor v1 → bloque
  del 0121 §2 no cambia.

### 4. El perfil de recojo fija el modo de cada módulo (P11)

El Planner declara los perfiles del estudio. Cada módulo con modos aterriza en el que le corresponde; nadie vuelve a
preguntar el tipo de estudio.

| Perfil de recojo (Planner) | Cálculo de muestra | Hojas de ruta | Material de campo | Monitoreo |
|---|---|---|---|---|
| `territorial` | `territorial-handoff` (puntero a Hojas de ruta) | Sí: el mapa, el marco y el sorteo de manzanas | campaña `territorial` | `territorial` |
| `aulas` | `opinion-universitaria` (selección `conglomerados`) o `marco-disponible` (selección `marco`) | — | campaña `aulas` | `aulas` (cursos-horario) |
| `telefonico` | `marco-disponible` | — | campaña `telefonica` (P10) | `telefonico` |
| `acreditacion` | `acreditacion` | — | campaña `correo` | `acreditacion` |

- El perfil `aulas` lleva un atributo `seleccion` (`conglomerados` | `marco`) porque dos diseños comparten perfil. Es
  la única subdivisión: no se abren más atributos para elegir modo.
- **Cada perfil dice quién diseña su muestra** (`diseno`: `calc-muestra` | `hojas-ruta` | `cliente`). Territorial es
  siempre `hojas-ruta`. Un telefónico cuya lista entrega el cliente (ACNUR acogida) es `cliente`: Cálculo no tiene
  nada que hacer y lo dice en su vacío propio. **A lo más un perfil del estudio tiene `diseno = calc-muestra`**, porque
  `calc_muestra_estudio` es un solo objeto; el Planner rechaza un segundo con su motivo. Así el modo de Cálculo sale de
  un solo perfil y no hay ambigüedad entre `aulas` con `seleccion = marco` y `telefonico`, que caen los dos en
  `marco-disponible`.
- **Mapeo total de `macro_familia`** (`.CM_MACRO_FAMILIAS`, `calc_muestra_engine.R:123-131`), para la proyección de §7
  y para que `iniciar-estudio` la derive del perfil:

| `macro_familia` | Perfil | Nota |
|---|---|---|
| `acreditacion` | `acreditacion` | — |
| `encuesta_estudiantes`, `hsvg_universitario` | `aulas` | `seleccion = marco` si `workspace.frame_mode` es `marco_disponible`; con `opinion_universitaria` o sin marco, `conglomerados` |
| `territorial` | `territorial` | — |
| `listado_telefonico` | `telefonico` | Los estudios que ya la tienen conservan su desk `legacy`; los nuevos aterrizan en `marco-disponible` |
| `linea_base_servicios`, `estudio_propio`, vacía (`mode = "general"`) | Sin equivalente | Se proyectan con el conflicto «perfil sin equivalente»; Cálculo conserva su desk actual hasta que el estudio se declare |
- **Selectores de camino que desaparecen:**
  - Cálculo de muestra: el modo `sin-definir`, su sección `pathways` y `SelectorTipo`. `macro_familia` deja de
    elegirse: `iniciar-estudio` la toma del perfil del Planner. Sin perfiles declarados, Cálculo muestra su vacío
    propio (C3): «El estudio todavía no declara cómo se recoge» con el enlace a
    `/planner?seccion=estudio&pestana=perfiles`.
  - Monitoreo: `MonitoreoModeChoice` y la bandera `route_selected`, y la fijación del perfil al importar desde Cálculo.
    El `family` del cable (ADR 0044) lo deriva el motor del perfil del Planner (`aulas` → `aulas_universitarias`); el
    resto de `monitoreo_profile` (`variant`, `units`, `segments`, que escriben actores, territorial y aulas) sigue
    siendo de Monitoreo. La familia `digital_general` no tiene perfil en el Planner v1: un proyecto que la tenga se
    proyecta con el conflicto «perfil sin equivalente» y Monitoreo la conserva hasta que el estudio se declare; ningún
    otro módulo deriva un modo de ella.
  - Material de campo: «Nueva campaña» (`DialogoNuevaCampana.tsx`) ofrece sólo los tipos de los perfiles declarados
    (más `correo` cuando un perfil declara ese canal). Una campaña existente de un tipo no declarado se sigue abriendo
    y se marca «fuera del estudio».
  - Home: deja de leer la familia por `router_diseno_estudio.R:357` y la `macro_familia` (`project_overview.R:302`), y
    lee los perfiles del Planner.
- **Hojas de ruta conserva su mapa.** Es su identidad (pedido de Gonzalo: «es algo muy identitario de hojas de
  ruta»). No gana modos: existe para el perfil territorial. Sin ese perfil, el módulo muestra su vacío propio y el Home
  lo presenta como «no aplica a este estudio»; no se oculta de la navegación.
- **Territorial.** Cálculo de muestra no reparte el tamaño a Hojas de ruta: ese cruce no existe en el código (§12.7) y
  este ADR no lo crea. En territorial el diseñador es Hojas de ruta: lee universo y variables del Planner y calcula
  tamaño, reparto y celdas. El modo `territorial-handoff` sigue siendo un puntero.
- Editor de formularios, Procesamiento y Dashboard no tienen modos y no cambian.

### 5. El sello: una forma, una huella por perfil (decisión 3)

Todo lo que se toma como foto lleva el mismo objeto:

```
sello = {
  schema: "sello/v1",
  origen: "<modulo>/<objeto>",     # p. ej. "hojas-ruta/muestra-enviada", "calc-muestra/seleccion-aulas"
  huella: "sha256:…",              # se compara SÓLO esto
  revision: 7,                     # informativa: revisión del dueño al tomar la foto
  tomado_en: "2026-10-31T15:04:00Z"
}
```

Una función compartida (`sello_v1()`, archivo nuevo `api/R/sello.R`) arma y compara sellos. Una huella sin la forma
`sha256:` se descarta, como en el ADR 0118.

| Perfil | Qué se sella | Huella | Existe hoy |
|---|---|---|---|
| Territorial | Muestra enviada a Material y a Monitoreo | `sample_fingerprint` (`.hojas_ruta_sample_fingerprint`: identidad de los bloques, semilla y algoritmo) | Sí (ADR 0118) |
| Aulas | Selección de Cálculo (metas y semilla de Material) | `selection_run_id` de `calc_muestra_aulas_selection` | Sí |
| Aulas | Entrega de Material a Monitoreo | `deployment_fingerprint` del recibo `collection_handoff/v1` (`collection_engine.R:1140-1146`) | Sí |
| Telefónico | Muestra y respaldo que salen al barrido | `sha256:` sobre la columna identificadora declarada del marco (ordenada, separando muestra y respaldo), la semilla y el método; si la lista viene del cliente, sobre la columna identificadora del insumo registrado | **No: nace con este ADR** |
| Acreditación | Selección por actor | La misma regla que telefónico, por población | **No: nace con este ADR** |
| Todos | Declaración del Planner que entra en una meta | `sha256:` de la `representatividad` de la población, sin `celdas` | **No: nace con este ADR** |

Las huellas nuevas siguen la regla del ADR 0118: se calculan sobre la identidad de las unidades más la semilla y el
algoritmo, nunca sobre el contenido completo, para que un cambio de rótulo no invalide la foto. En telefónico y
acreditación, «rótulo» es toda columna que no sea la identificadora declarada: nombre, teléfono, carrera, facultad. Cada Excel de campo
lleva su sello en la hoja «Control» oculta (regla de los Excel de campo del doc vivo §0).

### 6. Clave, schema y versión propios (decisión 4)

- Clave de sesión nueva **`planner`**, persistible, schema **`planner/v1`**, dueño `api/R/planner_engine.R` (archivo
  nuevo) y rutas en `api/R/router_planner.R` (archivo nuevo, montado en `plumber_app.R`). Se censa en
  `session_schema.R` en el mismo commit.
- **No se usa `estudio`**: es el contenedor multibase de Procesamiento (`session_store.R:195`) y mezclar los dos
  ataría la declaración del estudio al ciclo de vida de las bases.
- `revision` entera: cada escritura la sube en uno. Las escrituras llevan `expected_revision` y responden 409
  `E_PLANNER_DESACTUALIZADO` si no coincide (código nuevo en `errors_registry.R`).
- Las claves que ya son de la Bitácora (`plan_trabajo` con su `plan_trabajo_v<N>`, `diseno_estudio_bitacora`,
  `bitacora_canvas`, `bitacora_avisos`, `bitacora_preferencias`) **no se funden** en `planner`: conservan sus schemas y
  sus migraciones (`.bitacora_migrar_estado`). El módulo pasa a ser dueño de las dos familias.

```
planner = {
  schema: "planner/v1",
  revision: 12,
  estudio: { nombre, codigo, cliente },
  perfiles: [                                         # a lo más uno por tipo (§8)
    { tipo: "territorial" | "aulas" | "telefonico" | "acreditacion",
      seleccion: "conglomerados" | "marco" | null,     # sólo aulas
      diseno: "calc-muestra" | "hojas-ruta" | "cliente",   # a lo más un perfil con "calc-muestra"
      canales: ["presencial" | "telefono" | "correo" | "qr"],
      poblaciones: [
        { id: "estudiantes", etiqueta: "Estudiantes", bases: ["estudiantes"],   # bases: opcional (§8)
          representatividad: { schema: "representatividad_v1", universo: {…}, variables: [ … ] } }  # sin celdas
      ] }
  ],
  equipo: { schema: "planner_equipo/v1", code_format: "libre" | "DNI",
            personas: [ { codigo, nombre, rol: "encuestador" | "aplicador" | "supervisor" | "operador",
                          perfiles: ["territorial"], activo: true } ] },
  codigos: {
    version: 3,
    resultado: [ { codigo: 1, etiqueta, efectiva: true, retirado_en_version: null } ],
    status_barrido: [ { codigo, etiqueta, efectiva, retirado_en_version } ]
  },
  insumos: [ { id, tipo: "padron" | "listado" | "marco" | "otro", etiqueta, archivo: "files/…", origen, registrado_en } ]
}
```

- **El catálogo de códigos sólo agrega.** Un código nuevo sube `codigos.version`; uno que ya no se usa se marca
  `retirado_en_version` y deja de ofrecerse en formatos nuevos, pero se sigue leyendo. Nunca se reusa un número con
  otro significado. Por eso Monitoreo puede consultarlo directo (§2).
- **Los códigos que nazcan antes del Planner** (D1 de Material los necesita ya) nacen con esta misma forma dentro de
  Material, y se mudan con la fase P3 con lectura de respaldo. D1 no espera a este ADR.

### 7. Compatibilidad hacia atrás de los `.pulso` (decisión 5)

- **Un `.pulso` anterior abierto en la app nueva**: no trae `planner`. El normalizador lo **proyecta al leer** desde los
  lugares viejos (identidad de `estudio`, `calc_muestra_estudio` y `project_modules`; perfiles según la precedencia de
  abajo; equipo de `enumerator_roster` en territorial y de `monitoreo_aulas_disponibilidad` en aulas; universo y
  variables de `design_targets.representatividad` o del escenario; en un estudio multibase sin actores, una población
  por base). La proyección **no marca `project_dirty`** (precedente: `material_campaigns`,
  `material_territorial_asignacion`) y lleva `origen: "proyectado"`. La primera edición en el Planner la escribe con
  `origen: "declarado"`.
- **Precedencia de la proyección del perfil**, de más fuerte a más débil:
  1. La familia de Monitoreo **cruda** (no la normalizada: `monitoreo_normalize_profile` convierte cualquier familia
     desconocida en `acreditacion`, `monitoreo_engine.R:543`) con `route_selected = TRUE`. Es la única elección
     explícita que hizo una persona.
  2. Los tipos de las campañas de `material_campaigns`.
  3. La `macro_familia` de Cálculo con `workspace.frame_mode` declarado.
  4. La `macro_familia` sin `frame_mode`: es débil, sólo propone si no hay nada más fuerte y nunca abre conflicto con
     una fuente de los pasos 1–3.

  Sólo hay conflicto cuando dos fuentes **del mismo nivel** dicen perfiles distintos; el Planner lo muestra para que se
  resuelva y no elige. Una fuente de nivel menor que contradice a la ganadora no abre conflicto, pero **tampoco se
  descarta en silencio**: el Planner la muestra como aviso con su origen («Cálculo tiene un diseño de aulas que el
  perfil declarado no usa»). Ejemplo verificado: `acnur_acg` tiene en Monitoreo `family = territorial` con
  `route_selected = TRUE` y en Cálculo `macro_familia = encuesta_estudiantes` con `frame_mode =
  opinion_universitaria`; proyecta `territorial` (nivel 1) con el aviso de Cálculo (nivel 3). El perfil esperado de cada
  proyecto de referencia se fija en su `reference-project.json` (§Cumplimiento).
- **Un campo a la vez, sin mudanza en bloque** (doc vivo §8): cuando una fase muda un campo, el lugar viejo deja de
  escribirse y sus lectores consultan el Planner con respaldo al lugar viejo. El lugar viejo **no se borra** mientras
  exista una versión publicada que lo lea; se congela.
- **Un `.pulso` nuevo abierto en una app anterior**: no hay doble escritura (sería volver a tener dos dueños, lo que
  este ADR elimina). Hoy el manifest sólo trae `format_version = 1` y `app_version`, y nadie los valida
  (`project_pulso.R:2601-2603`, `:2688-2692`). La app anterior pone el `state.rds` entero en la sesión (`:2761`) y lo
  vuelve a escribir al guardar (`.pulso_strip_caches`, `:507`): **no pierde la clave `planner`**, pero ve los lugares
  viejos congelados y puede editarlos. Se decide:
  - El `manifest.json` gana `min_app_version`, que la app nueva escribe al guardar un proyecto con `planner`
    declarado. Desde la versión que introduce P1, al abrir un `.pulso` con `min_app_version` mayor que la propia la
    app **avisa y bloquea el guardado de esa sesión**: un candado por `sid` en el estado de la sesión, que los
    endpoints de guardado (`/api/fs/save*`) rechazan con un código nuevo `E_PULSO_VERSION_SUPERIOR`. No se usa
    `forbid_mutations`, que es global y depende de `PULSO_PUBLIC_MODE`. Se puede explorar y exportar; no se puede
    sobrescribir el `.pulso`. `format_version` no cambia: el formato del zip es el mismo.
  - **La app vieja borra `min_app_version`**: reescribe el manifest entero al guardar. Desde ese guardado sólo queda la
    detección por `app_version`, que la app vieja sí escribe con su propia versión.
  - Al abrir, la app nueva compara el `app_version` del manifest con la versión que introdujo P1. Si lo guardó una app
    anterior y el proyecto tiene `planner`, compara cada lugar viejo con el Planner y muestra como conflicto lo que
    difiera, en vez de dejar que el Planner pise en silencio lo que se editó en la app vieja. Un `app_version = "dev"`
    (`project_pulso.R:2598`) o ausente cuenta como desconocido: no activa el candado y **sí** corre la comparación,
    que es barata y del lado seguro.
  - Las versiones anteriores a P1 no conocen nada de esto. El riesgo (editar en la app vieja un valor que el Planner ya
    no lee) se acepta, lo detecta la regla anterior y se documenta en las notas de la versión que introduzca P1.
- **Enmienda de implementación (2026-10-31, revisión de `guardian-contratos`): el candado compara capacidades, no
  números de versión.** La 0.9.6 ya estaba publicada sin Planner y el build de desarrollo también decía 0.9.6:
  comparar números bloqueaba a la propia app o dejaba pasar a la vieja. Queda así (`api/R/pulso_version_minima.R`):
  - El manifest de un proyecto con secciones declaradas en el Planner lleva `requiere = {planner: "planner/v1"}`;
    `min_app_version` (`0.9.7`) va al lado, sólo como dato para personas y notas de versión.
  - Al abrir, si el `.pulso` exige una capacidad o un schema que esta app no conoce, el candado se pone para ese
    `sid` (en memoria, fuera de la sesión y del `.pulso`) y `build_pulso` responde 409 `E_PULSO_VERSION_SUPERIOR`:
    guardar, guardar como, duplicar y publicar quedan cerrados; revisar, no. El candado sigue a la sesión si cambia
    de `sid` (abrir «en el lugar», duplicar abriendo la copia) y se borra con `session_delete`. Duplicar con
    `overwrite` consulta el candado antes de borrar el destino.
  - «Lo guardó una app anterior» se detecta por capacidad y no por `app_version`: estado con secciones declaradas en
    el Planner y manifest sin `requiere`. El Planner lo dice en sus avisos; no bloquea. La comparación campo por
    campo contra los lugares viejos queda para P2, cuando los módulos lean el Planner.
  - **Lo que no cubre**: la 0.9.6 publicada (y anteriores) no trae el candado y sí puede guardar encima de un
    `.pulso` con Planner. Contra ella sólo queda la detección después del hecho.
- **Fin del respaldo**: las lecturas de respaldo se retiran en la fase P6, no antes de que la versión que exige
  `requiere` lleve un corte estable publicado.

### 8. Cardinalidad: multiperfil, multiactor y multibase (decisión 6)

- **Un estudio, uno o más perfiles, a lo más uno por tipo.** ACNUR acogida es territorial + telefónico; no hay caso
  real de dos perfiles del mismo tipo en un estudio. Dos operativos del mismo tipo son dos estudios.
- **Multiactor = varias poblaciones dentro de un perfil.** Contabilidad (estudiantes, docentes, egresados) es un perfil
  `acreditacion` con varias poblaciones; cada una declara su universo y sus variables. Los actores de Monitoreo
  (ADR 0045), cuando existen, se emparejan con las poblaciones por `id`.
- **Multibase no cambia de dueño**: las bases de Procesamiento (`estudio$bases`) siguen siendo de Procesamiento. El
  vínculo va del Planner a las bases (`poblaciones[].bases`), no al revés, porque en la práctica el multiactor suele
  ser multibase sin actores: `acrconta_mazo` tiene cuatro bases y ningún perfil, y `acrconta` tiene `units` vacío. En
  esos casos la proyección propone una población por base. Con una sola base el vínculo es opcional.
- **Cómo se ve con más de un perfil**: con un perfil, cada módulo aterriza directo en su modo. Con dos o más, el
  landing del módulo (sección de primer nivel, como la lista de campañas de Material) lista **sólo los perfiles
  declarados** y cada uno abre su modo. No es un selector de camino: no ofrece nada que el estudio no declaró. En
  Monitoreo y Material, como hay a lo más un perfil por tipo, `modo` identifica al perfil y la gramática del ADR 0044
  no gana parámetros. En Cálculo no hace falta: lo usa un solo perfil (§4).
- **Monitoreo hoy guarda un solo perfil** (`monitoreo_normalize_profile` reduce `family` a un valor,
  `monitoreo_engine.R:543`; los actores, cuando hay, viven como `units` dentro de esa familia). Mientras su estado no se separe por
  perfil, Monitoreo opera un perfil activo por proyecto y el landing ofrece cambiarlo entre los declarados. Separar
  `monitoreo_config` por perfil es trabajo de la sesión de Monitoreo y queda fuera de este ADR; lo que este ADR fija es
  que el valor activo sale del Planner y no de un click libre.

### 9. Qué ve el modo público (decisión 7)

- El modo público **no expone el Planner**: ni la ruta `/planner` ni `GET /api/planner*`. No entra a
  `PUBLIC_MODE_WHITELIST` (`forbid_mutations.R:21-55`) y `mount_planner` va en la rama no pública de
  `plumber_app.R`, junto a `mount_plan_trabajo` y `mount_bitacora` (`:131-133`), como hoy la Bitácora.
- Lo único del Planner que puede aparecer en un artefacto público es la **identidad del estudio** (nombre, cliente),
  y sólo porque el artefacto la publicó al exportarse. El equipo, los códigos, los insumos y el cronograma nunca.
- `GET /api/monitoreo/public-report`, que sí está en la whitelist, **nunca resuelve código → nombre del equipo**:
  publica códigos o agregados.

### 10. Datos personales del equipo centralizado (decisión 8)

Regla del doc vivo (§4.6): todo insumo con nombres, DNI o teléfonos declara cómo lo cubre el anonimizador **antes** de
existir.

- **Qué guarda**: código, nombre, rol, perfiles y si está activo. **No guarda teléfonos, correos ni DNI como campo.**
  Si el estudio usa `code_format = "DNI"`, el código es el DNI; la persona queda marcada como dato personal y ninguna
  vista fuera de Equipo muestra el código sin enmascarar (como ya hace Material con la asignación).
- **Anonimizador**: la lógica vive en `api/R/pulso_anonimizar_proyecto.R` (la CLI es `api/scripts/pulso_anonimizar.R`).
  Trata `planner$equipo$personas` como trata el padrón (`:479-488`): el gate `pulso_detectar_pii` lo recorre aunque
  sea una lista de registros. Se corrigen a la vez los puntos ciegos que hoy tienen `enumerator_roster$assignments`
  (verde por ceguera, §12.10 del doc vivo) y `monitoreo_aulas_disponibilidad` (nombres de aplicadores, que también
  es fuente del equipo de aulas en §7). El test que lo exige entra **en la fase P1, antes de que el Planner guarde su
  primera persona**.
- **Retención y purga**: el equipo viaja en el `.pulso` porque la atribución histórica lo necesita. El Planner ofrece
  «Purgar nombres del equipo» (reemplaza nombres por códigos, conserva la atribución); la exportación a proyecto de
  referencia la aplica siempre. Los nombres nunca van a logs ni a mensajes de error (`E_INTERNAL` ya lo garantiza).
- **El Excel de asignación devuelto** se sigue leyendo sin guardarse (lectura pura,
  `collection_territorial_asignacion_importar`).
- **Mientras dure el respaldo** (§7), el roster viejo y el equipo del Planner pueden coexistir con los mismos nombres:
  el anonimizador cubre los dos.
- **Ejemplos**: tests, docs y maquetas usan nombres ficticios evidentes (doc vivo §11).

### 11. El ciclo X7/X8 de aulas se rompe como una sola unidad (decisión 9)

Hoy: Cálculo → (copia X6) → `monitoreo_aulas_plan` → semilla de Material (que lo prefiere) → (la entrega escribe X8)
→ `monitoreo_aulas_plan`. La regla: **el ciclo se rompe en las escrituras; las lecturas pueden ir en los dos sentidos
si son puras y selladas.**

| Paso | Hoy | Con este ADR |
|---|---|---|
| Semilla de Material | Prefiere `monitoreo_aulas_plan`; cae a `calc_muestra_aulas_selection` | Lee **sólo** la selección de Cálculo, con sello `selection_run_id` |
| Reemplazos activados en campo | Llegan a Material por el plan de Monitoreo | Material los **consulta** a Monitoreo con una lectura pura y genera sus fichas; no los guarda como plan |
| Entrega de Material | Escribe `monitoreo_aulas_plan` (`collection_engine.R:150`) | Escribe sólo `collection_state` con su recibo `collection_handoff/v1` |
| Plan de Monitoreo | Mezcla de la copia de Cálculo y la escritura de Material | Lo escribe **sólo** Monitoreo: la importación desde Cálculo (X6, foto sellada), la lectura del recibo de la entrega y la carga del libro del operativo (`carga_aulas_libro.R:164,176`), que ya es de Monitoreo y se confirma como escritor legítimo |
| `.collection_origen_circular` | Contiene el ciclo | Se retira en el mismo cambio |

Es un solo cambio, de la sesión de Monitoreo coordinada con la de Material, después del ADR 0121 F3 (etapa 3 del doc
vivo). No se parte: arreglar sólo X7 deja a Material sin reemplazos; arreglar sólo X8 deja a Material leyendo un plan
que ya nadie actualiza.

### 12. Reparto entre módulos que este ADR ratifica

Ratifica las reglas de §4 del doc vivo, ya corregidas por la revisión:

1. Material produce lo que sale a campo; Monitoreo lee lo que vuelve y calcula. Material no calcula avance; Monitoreo no
   escribe en Material.
2. Material genera cada plantilla. El archivo que campo devuelve lleno lo lee el módulo que mide con él (asignación →
   Material; barrido y libro de aulas → Monitoreo), y lo expone sin efectos al otro.
3. Lo que va a campo y las metas se toman como foto con sello (§5). Si la huella diverge, el módulo lo dice y no
   compara.
4. La app no pisa lo que llena campo: dueño por hoja.

## Fases

| Fase | Qué | Quién | Depende de |
|---|---|---|---|
| P1 | Clave `planner/v1` con proyección desde lo viejo, censo, `GET`/`PUT /api/planner/*`, `E_PLANNER_DESACTUALIZADO`, `min_app_version` en el manifest, anonimizador que ve el equipo. Ruta `/planner` con sus seis secciones; Calendario y Lienzo como pestañas; alias de `/bitacora`. Ningún módulo lee todavía | Meta B asigna | Aceptación |
| P2 | Perfiles → modos: Material, Monitoreo y Home leen los perfiles; se retiran los selectores de camino (§4). La parte de Cálculo (`SelectorTipo`, `iniciar-estudio`) la hace la sesión dueña del 0121 | Sesiones de cada módulo, en serie | P1; la parte de Cálculo, además, ADR 0121 F4 |
| P3 | Equipo y Códigos: Material y Monitoreo leen del Planner con respaldo; mudanza de los códigos que nacieron en Material | Sesión de Material + sesión de Monitoreo | P1 y D1 |
| P4 | Muestra: universo y variables en el Planner; ADR 0121 F4 escribe ahí; X6 importa del estado persistido y sella | Sesión de Monitoreo (dueña del 0121) | P1 y ADR 0121 F3 |
| P5 | Ciclo X7/X8 (§11); X5 y la cobertura de Gráficos puras (§2) | Sesión de Monitoreo + sesión de Material | ADR 0121 F3 |
| P6 | Retiro de las lecturas de respaldo | Quien corte la versión | P2–P5 y un corte estable con `min_app_version` |

## Consecuencias

- El tipo de estudio se declara una vez. Cálculo, Material y Monitoreo dejan de preguntarlo y aterrizan en su modo; el
  ADR 0044 queda completo.
- Las cuotas, el equipo y los códigos tienen un dueño. Los formatos de campo y las metas saben con qué versión de cada
  cosa se hicieron, y lo dicen cuando cambió.
- El Planner es un módulo con más responsabilidad: si su declaración está mal, se equivocan todos a la vez. Lo mitiga
  que las metas y lo impreso son fotos selladas: un cambio en el Planner no reescribe el campo en curso, lo marca.
- Mientras dure el respaldo hay dos lugares por campo mudado (el viejo congelado y el Planner), y una app anterior
  puede abrir un proyecto nuevo con el valor viejo. Es el costo de no hacer doble escritura.
- Los proyectos de referencia (ADR 0043) se re-verifican al cerrar P1 y P4: su proyección debe dar el mismo perfil y
  las mismas cifras que hoy.
- Las maquetas de las seis secciones se dibujan antes de P1 (Contrato de Superficie C1; cada sección declara su vacío,
  C3).

## Cumplimiento

- `test-planner-schema.R`: el normalizador es idempotente; proyectar un `.pulso` sin `planner` no marca
  `project_dirty`; cada uno de los **cinco** proyectos de referencia (`acnur_pdm`, `acnur_acg`, `hsvg2026`, `acrconta`,
  `acrconta_mazo`) proyecta el perfil y las poblaciones que declara su `reference-project.json` (campo nuevo
  `perfil_esperado`, que es el oráculo); ninguno proyecta un conflicto que su ficha no declare.
- `test-session-schema.R`: `planner` censada, persistible, dueño `planner_engine.R`.
- `test-planner-lectura-pura.R`: `GET /api/planner` y cada consulta directa de §2 dejan el estado idéntico y no marcan
  dirty. «Idéntico» es `digest::digest` de la sesión sin `last_access` y sin las claves que `.pulso_strip_caches`
  quita. Incluye la lectura territorial de Monitoreo (X5) y la de `graficos_plan_coverage.R`.
- `test-sello.R`: `sello_v1()` rechaza huellas sin `sha256:`; las huellas de telefónico y acreditación no cambian al
  cambiar una columna que no sea la identificadora (nombre, teléfono, carrera), y sí cambian al cambiar un
  identificador, la semilla o el método.
- `test-pulso-version.R`: una app sin la capacidad (o un `planner/v2`) abre el `.pulso` y no lo pisa: guardar y
  guardar como responden `E_PULSO_VERSION_SUPERIOR` y el archivo queda con la misma huella; duplicar con
  `overwrite` no borra el destino; el candado sigue al `sid` y se va con la sesión; un manifest sin `requiere` con
  Planner declarado da el aviso.
- `test-bitacora-migracion.R`: un lienzo con destinos `calendario` y `canvas` sale con `cronograma`/`mes` y
  `bitacora`/`lienzo`, sin nodos huérfanos; la migración es idempotente.
- `test-pulso-anonimizar*.R`: `pulso_detectar_pii` encuentra nombres en `planner$equipo$personas` y en
  `enumerator_roster$assignments`. Entra en P1.
- Escritura ajena (P5), por comportamiento y no por regex (un guard de regex muere al renombrar): un test hace el
  handoff de Material y comprueba que `monitoreo_aulas_plan` queda idéntico, y que la semilla de Material no cambia al
  cambiar `monitoreo_aulas_plan`. El parámetro `monitoring_plan` de `.collection_store` desaparece.
- `errors-registry`: `E_PLANNER_DESACTUALIZADO` y `E_PULSO_VERSION_SUPERIOR` registrados.
- Frontend: `modulesNavigation` y `auditReadyRoutes` exigen `/planner` con las seis secciones; un test de
  `direccion.ts` comprueba los alias por valor (`seccion=calendario`, `seccion=canvas`) y que `/bitacora?seccion=…`
  llega a `/planner` con la query intacta; un contrato nuevo falla si `calc-muestra` vuelve a declarar el modo
  `sin-definir` o la sección `pathways`.
- Modo público: un test de `forbid_mutations.R` falla si un prefijo `/api/planner` entra a la whitelist.
- Gates por fase: `make gate-area` del área tocada y `make gate-front AREA=…`, más QA visual de cada módulo que
  pierde su selector.

## Notas

- Doc vivo y su revisión: `docs/qa/arquitectura-campo-planner-2026-10-31.md` (§0 carta de módulos, §8 Planner, §9
  cruces, §12 revisión). Artefacto: https://claude.ai/artifact/Rw3NyeQv5kF6UXizMpkYV7.
- Relacionados: ADR 0005 (secretos fuera del `.pulso`: el Planner no guarda credenciales), ADR 0026 (guardado
  explícito), ADR 0029 (Bitácora y overview), ADR 0043 (proyectos de referencia), ADR 0045 (actores de Monitoreo),
  ADR 0079 (la meta se congela), ADR 0086 (catálogo de dimensiones), ADR 0108 y 0111 (campañas de Material).
- Revisión de `guardian-contratos` sobre este borrador (2026-10-31): aprobado con cambios. Incorporados: los dos
  endpoints de importación y `config`, las enmiendas a 0047, 0111 y la cláusula del 0121, la precedencia de la
  proyección (caso `acnur_acg`), el mapeo total de `macro_familia`, un solo perfil con diseño en Cálculo, el candado de
  guardado por `sid` en lugar de un «sólo lectura» sin mecanismo, el alias por valor con la query preservada, la
  migración de los nodos del lienzo, la lectura de Gráficos que escribe en Hojas, `carga_aulas_libro.R` como escritor
  de Monitoreo, `monitoreo_aulas_disponibilidad` en el anonimizador y el Cumplimiento con oráculos verificables.
- Evidencia cerrada por esa revisión: `.hojas_ruta_store_runs` sí marca dirty cuando lo dispara una lectura
  (`router_hojas_ruta.R:301`). Queda abierto el inventario de consumidores frontend de `design_targets` y
  `monitoreo_profile`; P2 y P4 lo levantan antes de tocar código.
