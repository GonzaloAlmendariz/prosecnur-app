# ADR 0123: El Planner sólo define el estudio, sus tipos, el camino entre módulos y el cronograma

Estado: Aceptado (Gonzalo, 2026-11-01: «Aprobado»)

Implementación: En curso — Q0 hecha (338745126, 0dd24b6bb); Q3 hecha (Material d4b8b3cb1: lee primero su catálogo de códigos y el roster de Monitoreo, con el Planner de respaldo; Planner 05a19eca9: secciones retiradas con su alias y aviso); Q1 hecha (este commit: clave `calc_muestra_representatividad`, el declarar deja de escribir en el Planner, la foto `design_targets.representatividad` con sello del sorteo y Monitoreo la lee con el Planner de respaldo); Q2 hecha (13b9923ad; el Home, sin nombre declarado, nombra el proyecto por su archivo, la regla que ya tenía, en vez de «Estudio sin definir»: decidido por la coordinación el 1/11, reversible, porque identifica el proyecto y no rompe nada; anotado en el plan conjunto para que Gonzalo pueda revertirlo); Q4–Q6 pendientes

Fecha: 2026-11-01

Fecha de decisión: 2026-11-01

Reemplaza: [ADR 0122](0122-el-planner-define-el-estudio-y-fija-los-modos.md), **en parte**:

- §1: alcance y tabla de secciones.
- §2 y §3: las filas que hacen del Planner el dueño del universo, las variables de cuota, el equipo, los códigos y los
  insumos.
- §6: el bloque `equipo`/`codigos`/`insumos` del schema pasa a ser sólo de lectura.
- §7: la proyección deja de mostrarse y de alimentar al Planner. Sobrevive sólo como deducción interna del modo (§5).

Sigue vigente:

- Que el perfil de recojo fija los modos (§4), con la precedencia de §7 como deducción interna mientras el estudio no se
  declare.
- El sello (§5) y la clave `planner/v1` con su `revision` y el candado por capacidad (§6–§7).
- La cardinalidad (§8) y el modo público (§9).
- La cobertura del anonimizador mientras existan proyectos con equipo guardado (§10).
- El ciclo X7/X8 (§11) y el reparto entre módulos (§12).
- La enmienda que el 0122 le hizo al [ADR 0111](0111-material-de-campo-se-organiza-por-campanas-tipadas.md) §3.

Extiende: —

Enmienda:

- [ADR 0121](0121-la-representatividad-la-declara-el-estudio-universo-y-variables.md) §2 y su F4: universo y
  variables vuelven a ser de Cálculo de muestra (§2).
- [ADR 0047](0047-bitacora-cronograma-canvas-vinculado.md): el lienzo cambia de propósito y pasa a dibujar el camino
  entre módulos; el registro de decisiones pasa a vivir dentro del cronograma (§3, §4).
- [ADR 0044](0044-jerarquia-y-direcciones-de-navegacion.md): los alias por valor pasan a aceptar una pareja
  sección/pestaña y a llevar un aviso (§3).
- [ADR 0029](0029-reorientacion-por-proyecto-bitacora-y-overview.md): la Bitácora deja de ser una sección, y el Home dice «estudio sin definir»
  cuando no hay identidad declarada (§5).

Origen: sesión de definición del Planner con Gonzalo, 1/11/2026, en tres rondas. Las respuestas están en
`docs/qa/inventario-planner-2026-11-01.md` («Respuestas de la sesión de definición»). Revisión de
`guardian-contratos` sobre el primer borrador: aprobado con cambios, incorporados (ver Notas).

> «el planner define el tipo de monitoreo o el tipo de cálculo de la muestra pero no define el universo o no define el
> equipo, eso lo hacen sus módulos especializados»

> «el planner ya no es bitácora, solo sirve para definir el nombre del estudio, sus tipos, cronograma (opcional) y
> definir la relación entre los módulos y alguna otra cosa más pero nada más»

> «el lienzo podría utilizarlo para indicar cómo se conectan los módulos y definir los paths […], pero ojo, los mismos
> módulos pueden mostrar su camino, el planner solo es un camino»

## Contexto

El ADR 0122 hizo del Planner el lugar único de cada dato del estudio. En dos días se construyó así:

- Las secciones Muestra, Equipo, Códigos e Insumos.
- Una proyección que, si el Planner no tiene nada declarado, lo deduce todo de Cálculo, Monitoreo, Material, Hojas de
  ruta, el Dashboard y las bases de Procesamiento.

El 1/11 Gonzalo fijó otro rumbo, con cuatro principios:

1. El Planner es la herramienta inicial: ayuda a decidir qué hacer con el estudio y a ordenarlo.
2. Va primero en el tiempo y no lee nada de un módulo posterior.
3. No quita responsabilidades: cada módulo define lo suyo.
4. Define el tipo de estudio, no su contenido.

Hoy el Planner choca con estos principios en tres puntos:

- **Muestra lo que deduce de módulos posteriores.** Medido el 1/11 sobre los cinco proyectos de referencia:
  - El tipo de estudio se deduce bien.
  - El nombre sale mal las tres veces que se deduce, porque es el título de otra cosa: «Encuesta a estudiantes» (de
    Cálculo) en `acnur_acg`, «Muestra de cursos-horario» (de Cálculo) en `hsvg2026` y el título del Dashboard en
    `acnur_pdm`.
  - `/api/planner/calendario` también lee Hojas de ruta y Monitoreo para sus avisos (`planner_calendario.R:49-97`).
- **Guarda lo que es de otros módulos.**
  - Material lee del Planner los códigos (`collection_territorial_formatos.R:83-104`) y el equipo
    (`collection_territorial_asignacion.R:20-38`, `collection_aulas_material.R:49-58`).
  - Cálculo escribe el universo en el Planner (`router_calc_muestra_representatividad.R:70-84`).
  - Monitoreo de aulas lee el universo del Planner (`monitoreo_aulas_representatividad_declarada.R`,
    `monitoreo_aulas_cache.R:300-314`).
- **Sigue siendo la Bitácora.** Conserva el registro de decisiones y el lienzo como sección propia.

Sin embargo, **los modos dependen de la deducción.** Con el estado propio de cada módulo, sin la deducción del Planner:

| Proyecto de referencia | Qué pasaría con su modo |
|---|---|
| `hsvg2026` | Monitoreo no tiene familia guardada y se quedaría sin el modo aulas en pleno operativo |
| Los cinco | Material no tiene campañas guardadas y se quedaría sin campaña |
| `acnur_acg` | Cálculo guarda `encuesta_estudiantes` con `opinion_universitaria`, un diseño de aulas que el estudio no usa, y caería en él |

Por eso la decisión separa lo que el Planner **muestra** de lo que el servicio de modos **deduce** (§5).

## Decisión

### 1. Qué define el Planner, y nada más

| Definición | Qué guarda | Obligatoria |
|---|---|---|
| Identificación | Nombre, código, cliente y objetivo en una línea | Sólo el nombre |
| Tipos de estudio | Perfiles de recojo con su rama (`seleccion`), quién diseña la muestra (`diseno`), sus `canales` y, dentro de cada perfil, sus poblaciones o públicos (`id`, `etiqueta` y `bases` opcional) | Sí: al menos un perfil con su rama y su diseño |
| Camino entre módulos | El lienzo: cómo se conectan los módulos en este estudio (§4) | No |
| Cronograma | Fases y fechas, ventana de campo, etapa operativa (piloto o campo) y, como opción dentro, el registro de decisiones | No |

- **Quién diseña la muestra deja de ser una definición aparte.** Es la rama de cada perfil (`perfiles[].diseno`,
  0122 §6). Se mantiene la regla de que a lo más un perfil diseña en Cálculo.
- **Una declaración por perfil, con públicos dentro** (confirma el 0122 §8).
- Cliente, código, objetivo, camino y cronograma no bloquean nada.
- **«Nada más».** El Planner no guarda universo, variables de cuota, celdas, equipo, códigos, insumos ni avance.

### 2. Lo que sale y a dónde vuelve

| Dato | Dueño | Lo que cambia | «El dueño tiene el dato» cuando… |
|---|---|---|---|
| Universo y variables de cuota | **Cálculo de muestra** | Cálculo los guarda en una clave propia, que define y censa la sesión dueña del 0121 al implementar (schema, `session_schema.R`, dirty). `POST /api/calc-muestra/representatividad/declarar` deja de escribir en el Planner. Monitoreo los lee de la **foto con sello en `design_targets`** (0122 §2), no del estado vivo de Cálculo | `design_targets.representatividad` trae `universo` |
| Equipo de campo | **Monitoreo** | Material lee el roster de Monitoreo. El Excel del equipo se va del Planner con el revert de 9b3380299 | El roster de Monitoreo tiene al menos una persona |
| Códigos de resultado y status del barrido | **Material de campo** | Material vuelve a ser la única fuente. La regla «sólo agrega» (0122 §6) se queda con su catálogo | Material tiene un catálogo **guardado**, no el de fábrica |
| Insumos del cliente | **Nadie** | «No es necesario saber cuáles son sus insumos». Cada módulo pide y lee el archivo que usa | — |
| Registro de decisiones | Planner, dentro del cronograma | Deja de ser sección propia (§3) | — |

**La precedencia se invierte, con respaldo de lectura.**

- Hoy Material lee primero el Planner. Con este ADR lee primero al dueño.
- Si el dueño no tiene el dato (columna de la derecha) y el `.pulso` lo tiene **declarado** en el Planner, toma el del
  Planner como respaldo.
- No se borra nada de los `.pulso` guardados. El anonimizador sigue cubriendo `planner$equipo$personas` mientras haya
  proyectos con ese campo (0122 §10).

**Escrituras que se cierran.**

- `equipo`, `codigos` e `insumos` pasan a una lista nueva, `PLANNER_SECCIONES_LECTURA`.
  - El normalizador las sigue recorriendo, para que el respaldo funcione.
  - `PUT` sobre ellas responde 409 con un código nuevo, `E_PLANNER_SECCION_RETIRADA` («esa sección ya no se declara en
    el Planner; vive en <módulo>»). Se registra en `errors_registry.R`.
  - No se reusa `E_PLANNER_SECCION_PENDIENTE`, porque dice «todavía no» y no corresponde.
- `PUT /api/planner/perfiles` **conserva del valor previo** `poblaciones[].representatividad`, `canales` y
  `poblaciones[].bases` cuando el cliente no los manda, e **ignora** `representatividad` si viene. Así la pantalla
  nueva no borra el respaldo ni el canal `correo` que abre campañas (`planner_modos.R:83-84`).

**Orden de cada mudanza.** Primero el dueño escribe y el lector cambia. En el mismo commit en que el Planner retira la
sección, entra su alias con aviso (§3). Ninguna sección se quita mientras alguien la lea.

### 3. Secciones y direcciones

`/planner` queda con tres secciones. El slug `diseno-estudio` y la ruta no cambian (0122 §1).

| Sección | Contiene |
|---|---|
| `estudio` | Identificación y tipos de estudio, en una sola vista. Es el landing |
| `camino` | El lienzo del camino entre módulos (§4) |
| `cronograma` | Fases, ventana y etapa, con el registro de decisiones como pestaña opcional `registro` |

**Alias.** Toda dirección vieja sigue siendo alcanzable (C4). Ninguna cae muda en el landing:

| Dirección vieja | Va a | Aviso |
|---|---|---|
| `seccion=bitacora`, `seccion=bitacora&pestana=registro` | `cronograma&pestana=registro` | — |
| `seccion=bitacora&pestana=lienzo`, `seccion=canvas` | `camino` (`canvas` se encadena) | — |
| `seccion=estudio&pestana=identidad\|perfiles` | `estudio` | — |
| `seccion=estudio&pestana=insumos` | `estudio` | «Los insumos del cliente ya no se registran en el Planner» |
| `seccion=muestra` | `estudio` | «El universo y las cuotas viven en Cálculo de muestra», con enlace |
| `seccion=equipo` | `estudio` | «El equipo vive en Monitoreo», con enlace |
| `seccion=codigos`, `seccion=codigos&pestana=resultado\|barrido` | `estudio` | «Los códigos viven en Material de campo», con enlace |

- Hoy `SECCIONES_RENOMBRADAS` (`direccion.ts:121-126`) sólo traduce un valor de `seccion` a una pareja, sin aviso.
  **Cambia de forma**: acepta una pareja de entrada y un aviso opcional. Se lee y nunca se escribe. Esto enmienda el
  0044.
- **Los nodos del lienzo se reescriben al cargar**, como en el 0122 §1. Un destino `bitacora`/`lienzo` pasa a
  `camino` y uno `bitacora`/`registro` pasa a `cronograma`/`registro`. La reescritura es idempotente y no marca dirty.
- La forma y el orden de la pantalla **no los fija este ADR**. Se dibujan en el prototipo navegable y Gonzalo los
  valida antes de construir (Contrato de Superficie C1 y C3).

### 4. El camino entre módulos es un camino, no un mando

El lienzo muestra por qué módulos pasa cada perfil del estudio y en qué orden conviene abrirlos.

- **No manda.** Cada módulo sigue mostrando su propio camino. El lienzo no bloquea ni reordena nada.
- **No lee avance.** El avance lo muestra el Home (Q8).
- **Lo que decide ya está en los tipos.** El modo de cada módulo (0122 §4) y quién diseña la muestra salen de ahí. El
  camino se deriva de los tipos y no guarda otra verdad.

### 5. El Planner se ve vacío; el modo se sigue deduciendo por dentro

Un proyecto sin declaración abre el Planner **vacío**. El payload de `GET /api/planner` trae sólo lo declarado: no
muestra nombre, perfiles, ventana, etapa, poblaciones, códigos ni equipo deducidos. Tampoco hay «completar desde el
proyecto».

Para no romper modos (ver Contexto), **el servicio de modos sigue deduciendo por dentro**, decisión de Gonzalo del 1/11:

- `/api/planner/modos` usa lo declarado. Mientras el estudio no se declare, usa la deducción interna con la
  precedencia del 0122 §7.
- La deducción es **sólo para el modo**. No se muestra en el Planner ni alimenta otras lecturas, salvo las tres de
  abajo.
- Es la única excepción a «va primero». Se retira cuando el estudio se declara, porque entonces manda lo declarado.

Las mismas reglas de modo alimentan tres lecturas, que no cambian:

- `iniciar-estudio` de Cálculo (`router_calc_muestra.R:390-396`): sigue arrancando como hoy.
- El «Hojas de ruta aplica» del Home (`project_overview.R:336-340`).
- La variante territorial de Material (`collection_territorial_registro.R:32`).

**Identidad sin declaración.** El nombre deducido no se usa en ningún lado:

| Lector | Lo que muestra con el Planner vacío |
|---|---|
| Home (`router_diseno_estudio.R:338`) | «Estudio sin definir», con el enlace a `/planner?seccion=estudio` |
| Ficha de Cálculo (`usePlannerIdentidad.ts:19`) | Su vacío, con el mismo enlace |
| Reporte metodológico de Cálculo (`calc_muestra_identidad.R:13`) | El título que guarda Cálculo, que es su propio estado |
| Siembra de aulas (`collection_aulas_siembra.R:16`) | Hoy detecta HSVG por el nombre. La sesión de Material cambia ese criterio antes de Q1 a uno que no dependa de un nombre deducido |

**Calendario.**

- Salen los avisos de `/api/planner/calendario` que leen a Hojas de ruta y Monitoreo: `etapa_modulo_desfasado`,
  `ventana_*_distinta` y `campo_no_coincide`.
- El desfase lo dicen esos módulos desde su lado con «Alinear», que ya lee sólo lo declarado (`etapaDelPlanner.ts`,
  `hojas_ruta_etapa.R:12-27`).
- La ventana se propone sólo desde la fase Campo del propio cronograma (acota 265abc9de).

**Frontend.** El normalizador de `frontend/src/api/planner.ts` acepta una sección ausente o con `origen` declarado, y
deja de convertir lo desconocido en «proyectado».

### 6. Cronograma: opcional y propuesta

- Es opcional. Un estudio sin cronograma no bloquea ningún módulo.
- Fase y ventana son una **propuesta** (Q3). Monitoreo y Hojas de ruta ofrecen «Alinear» con un clic, y nada cambia
  sin ese clic. Sin cronograma declarado no hay nada que alinear.

### 7. Schema y modo público

- La clave sigue siendo `planner`, con schema `planner/v1`, la misma `revision` y el mismo candado
  (`requiere = {planner: "planner/v1"}`).
- **`estudio.objetivo`** es un campo opcional nuevo y no sube a `planner/v2`.
  - Condición: debe entrar **antes del primer corte publicado que traiga `planner/v1`**. Hoy ninguno lo trae:
    `DESCRIPTION` dice 0.9.6 y `PULSO_VERSION_PLANNER` es 0.9.7. Si no alcanza, sube a `planner/v2`.
  - Una app que conozca `planner/v1` sin `objetivo` lo perdería al escribir cualquier sección del Planner
    (`.planner_norm_estudio`, `planner_modelo.R:89-96`).
- **El objetivo no se publica** (decisión de Gonzalo del 1/11). `.planner_para_publicar` (`planner_publico.R:24-29`)
  publica nombre, código y cliente, como fija el 0122 §9, y deja fuera `objetivo`.
- `equipo`, `codigos`, `insumos` y `poblaciones[].representatividad` se leen y no se escriben (§2).
- `poblaciones[].bases` es opcional y lo declara el analista. El Planner no lo siembra desde las bases de
  Procesamiento: se revierte la siembra de 8ba68bce5.
- El censo de `planner` en `session_schema.R:462` deja de decir «lo demás se proyecta».

### 8. Reverts aprobados

Gonzalo aprobó revertir dos unidades del 1/11 que van contra estos principios. Cada una va en su commit, por nombre,
después de que este ADR se acepte. Ningún commit posterior tocó sus archivos.

- `9b3380299`: Equipo se baja y se sube en Excel.
- `e3666de17`: Muestra dice qué módulo la lee.

## Fases

| Fase | Qué | Quién | Depende de |
|---|---|---|---|
| Q0 | Reverts de 9b3380299 y e3666de17 | Sesión del Planner | Aceptación |
| Q1 | Universo y variables a Cálculo: clave propia, el declarar deja de escribir en el Planner, Monitoreo lee la foto con respaldo | Sesión de Monitoreo y Cálculo (dueña del 0121) | Aceptación |
| Q2 | El Planner se ve vacío: el payload trae sólo lo declarado, la deducción queda dentro de `/modos`, los lectores de identidad pasan a lo de §5, salen los avisos del calendario y el normalizador del front cambia | Sesión del Planner. El criterio de la siembra de aulas, la sesión de Material, antes | Q1 (`.planner_declarar_representatividad` arma perfiles con lo deducido, `planner_modelo.R:438`) |
| Q3 | Códigos a Material y equipo a Monitoreo, con respaldo. Cada sección retirada del Planner lleva su alias con aviso en el mismo commit | Sesión de Material; sesión de Monitoreo; la del Planner al final de cada una | Aceptación |
| Q4 | Se retiran la pestaña Insumos (con su alias) y la Bitácora como sección (registro al cronograma, lienzo a camino, con migración de nodos) | Sesión del Planner | Aceptación |
| Q5 | Pantalla nueva: Estudio, Camino y Cronograma | Sesión del Planner, con el prototipo validado por Gonzalo | Q2–Q4 |
| Q6 | Se retiran los respaldos de lectura | Quien corte la versión | Q1, Q3 y un corte estable (como la P6 del 0122) |

## Consecuencias

- **El Planner vuelve a ser corto.** Nada de lo que muestra viene de un módulo posterior y nada de lo que guarda es de
  otro módulo.
- **Queda una excepción declarada y acotada.** La deducción interna del modo lee módulos posteriores hasta que el estudio
  se declara. Es el precio de no romper los modos de los proyectos viejos, y se ve en un solo lugar: `/modos`.
- **Un proyecto viejo pierde el nombre deducido.** El Home dice «Estudio sin definir» hasta que alguien lo escriba. Lo
  que se pierde se deducía mal.
- **Cada mudanza cuesta un respaldo de lectura** mientras existan `.pulso` con el dato en el Planner. La precedencia se
  invierte: un proyecto con el dato en el Planner y también en su dueño pasa a leer el del dueño.
- **El ADR 0121 vuelve a su forma original** para universo y variables. La F4 ya construida se mueve, y es trabajo de
  la sesión dueña del 0121.

## Cumplimiento

- **`test-planner.R`**:
  - Los cinco proyectos de referencia, sin declaración, devuelven un payload sin secciones.
  - Cambiar `calc_muestra_*`, `monitoreo_config`, `material_*`, `hojas_ruta_*`, `dashboard_config` o `estudio$bases`
    **no cambia** el payload de `GET /api/planner` ni el de `/api/planner/calendario`. Se prueba por comportamiento,
    no por regex.
  - `PUT` a `equipo`, `codigos` o `insumos` responde `E_PLANNER_SECCION_RETIRADA`.
  - Un `planner` guardado con esas secciones se sigue normalizando igual.
  - `PUT perfiles` sin `representatividad`, `canales` ni `bases` los conserva del valor previo. Lo prueba un fixture
    donde el valor previo y el enviado difieren.
- **Los modos no se mueven.** Con el Planner vacío, cada proyecto de referencia aterriza en el mismo modo que el 1/11:

  | Proyecto | Cálculo | Monitoreo | Material | Hojas de ruta aplica |
  |---|---|---|---|---|
  | `acnur_acg` | `territorial-handoff` | territorial | territorial | sí |
  | `acnur_pdm` | ninguno (diseña el cliente) | telefónico | telefónica | no |
  | `hsvg2026` | `opinion-universitaria` | aulas | aulas | no |
  | `acrconta` | ninguno (diseña el cliente) | acreditación | correo | no |
  | `acrconta_mazo` | ninguno | ninguno | ninguno | no |

  - El oráculo hoy está escrito a mano en `test-planner.R:226-227`. Pasa a un campo `modos_esperados` en cada
    `reference-project.json`.
  - Se suma `.overview_hojas_aplica` por proyecto de referencia.
- **Identidad**: con el Planner vacío, el título del Home es «Estudio sin definir» y el reporte de Cálculo usa el
  título de Cálculo.
- **Respaldo de lectura**, uno por dato mudado, con fixtures de **dos fuentes distintas**: Material con catálogo
  guardado y otro en el Planner, roster con personas y otro equipo en el Planner, `design_targets` con universo y otro
  en el Planner. Cada test comprueba que se lee al dueño, y que sin dato del dueño se lee el Planner.
- **`test-planner-publico.R`**: `objetivo` no sale al publicar.
- **`test-bitacora-migraciones.R`**: los nodos con destino `bitacora` salen con `camino` o `cronograma`/`registro`, sin
  huérfanos y de forma idempotente.
- **`test-pulso-anonimizar*.R`**: sigue encontrando nombres en `planner$equipo$personas`.
- **`errors-registry`**: `E_PLANNER_SECCION_RETIRADA` registrado.
- **Frontend**:
  - `modulesNavigation` y `auditReadyRoutes` exigen `/planner` con `estudio`, `camino` y `cronograma`.
  - Un test de `direccion.ts` cubre cada fila de la tabla de alias del §3, con su aviso.
  - Un test de `api/planner.ts` comprueba que una sección ausente no se lee como «proyectada».
- **Gates por fase**: `make gate-area AREA=planner` y `make gate-front AREA=bitacora`, más los del módulo que cambia
  en Q1 y Q3. QA visual del Home, Cálculo, Material y Monitoreo con el Planner vacío en `hsvg2026` y `acnur_acg`.

## Notas

- Inventario por sección y respuestas de la sesión: `docs/qa/inventario-planner-2026-11-01.md`.
- Artefactos: guía https://claude.ai/artifact/Rya7P5jZfN4cjLN6vDRJ5Q y prototipo
  https://claude.ai/artifact/4FGYFbie5F4JeUdLAc88k9. Ya reflejan las cuatro definiciones, el camino en el lienzo y el
  Planner vacío.
- **Al aceptar**: la cabecera del 0122 y su fila del índice (`docs/adrs/README.md`) enlazan a este ADR como «reemplazado
  en parte por 0123», y este ADR entra al índice.
- **Revisión de `guardian-contratos` (1/11): aprobado con cambios.** Incorporados:
  - El código de sección retirada.
  - Las dos puertas reales de escritura del universo.
  - La forma nueva del alias, con la tabla completa.
  - La conservación de `representatividad`, `canales` y `bases` en `PUT perfiles`.
  - La foto `design_targets` como fuente de Monitoreo.
  - La definición de «el dueño tiene el dato».
  - Los lectores de identidad, `aplica` e `iniciar-estudio`.
  - Los avisos del calendario.
  - La justificación de `objetivo` y su exclusión del modo público.
  - El orden Q1 → Q2.
  - Los alias en el mismo commit que retira la sección.
  - Las enmiendas a 0044, 0047, 0029 y 0121 F4.
  - Los nombres de tests y la fecha de los reverts.

  La contradicción del modo de Cálculo en `acnur_acg` la resolvió Gonzalo con la deducción interna (§5).
- Medición del 1/11 que sostiene el §5: estado propio de cada módulo en los proyectos de referencia.

  | Proyecto | `calc_muestra_estudio` | Familia de Monitoreo | Campañas de Material |
  |---|---|---|---|
  | `acnur_acg` | `encuesta_estudiantes` / `opinion_universitaria` | territorial | ninguna |
  | `hsvg2026` | `encuesta_estudiantes` / `opinion_universitaria` | ninguna | ninguna |
  | `acnur_pdm` | ninguno | telefónico | ninguna |
  | `acrconta` | ninguno | acreditación | ninguna |
  | `acrconta_mazo` | ninguno | ninguna | ninguna |
- «Alguna otra cosa más»: este ADR asume que es el objetivo dentro de la identificación (respuesta de Gonzalo a la
  segunda ronda: «sí, esas cuatro»).
