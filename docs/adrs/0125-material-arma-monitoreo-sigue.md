# ADR 0125: Material arma, Monitoreo sigue

Estado: Aceptado (Gonzalo, 2026-11-02, respuestas textuales a la coordinación, ~06:50)

Implementación: en curso. Este ADR fija los contratos; cada módulo los cumple con su sesión dueña (ver
«Cumplimiento»).

Fecha: 2026-11-02

Fecha de decisión: 2026-11-02

Reemplaza: —

Extiende:

- [ADR 0124](0124-el-planner-sale-como-modulo.md): el tipo declarado en la Ficha del estudio fija el modo de cada
  módulo. Este ADR dice qué hace cada módulo en ese modo. Cambia dos filas de su §3: aulas deja de tener dos
  variantes de selección (pasa a ser un atributo, §3 abajo) y los canales de acreditación los declara el Modelo de
  Monitoreo (§5).
- [ADR 0118](0118-hojas-de-ruta-entrega-a-material-de-campo.md) §3 (la foto que Hojas de ruta envía) y
  [ADR 0111](0111-material-de-campo-se-organiza-por-campanas-tipadas.md) (campañas de Material).

## Contexto

El checklist de responsabilidades del 2/11 (`docs/qa/checklist-responsabilidades-modulos-2026-11-02.md`) encontró
tareas en el módulo equivocado o en dos módulos a la vez:

- **R7**: el equipo de campo se asigna en Material territorial y también en Monitoreo de aulas.
- **R13**: en cursos-horario, Monitoreo construía y publicaba el libro del operativo en Sheets. Ya se movió a Material
  › Entrega (8d9659dfe, 347a18545).
- **R17**: las metas de acreditación se editan en Monitoreo, como excepción declarada.

Gonzalo respondió tipo por tipo. El texto completo está en las notas de la coordinación
(`definicion-material-monitoreo-por-tipo-2026-11-02.md`). Aquí se cita sin parafrasear.

## Decisión

### 1. Principio general

> «Eso debería ser la lógica en todo en realidad: material de campo ayuda al armado y la configuración de las cosas
> mientras Monitoreo le da seguimiento y a veces cuando es necesario le da algo de info para el armado».

- **Material de campo** arma y configura: fichas, planillas, bases que el campo llena y campañas.
- **Monitoreo** lee lo armado y le da seguimiento.
- Monitoreo sólo le **entrega** algo a Material cuando el armado lo necesita. Hoy eso pasa en un solo caso: la
  supervisión telefónica (§4).
- Ningún módulo construye lo que el otro arma ni lo copia. Lee la foto o la tabla del otro y dice de dónde viene.

### 2. Territorial (aleatorio y por cuotas)

> «Se supone que Hojas de ruta deja todo listo y definido para que Material de campo elabora las fichas de
> seguimiento y el excel de asignación. Monitoreo debería recibir cuál es la relación de UMP titulares y reemplazos
> porque sin eso no puede definir avance o la relación de encuestadores y sus asignaciones (que crea material de campo
> pero lee monitoreo)».

En cuotas pasa lo mismo: Hojas de ruta define y envía.

| Entrega | Qué | Lee | Por dónde |
|---|---|---|---|
| Hojas de ruta | La foto de la muestra con huella: UMP, papel titular o reemplazo, viviendas y cuotas | Material | `POST /api/hojas-ruta/envio` guarda `runs[[fase]]$envio`; Material lo lee en `collection_campaigns_territorial.R` (`/api/recopiladores/campaigns/territorial/unidades`, `/plan`) |
| Hojas de ruta | La misma foto: titulares y reemplazos | Monitoreo | `monitoreo_territorial_fuente_muestra.R`; aviso de desfase en `GET /api/monitoreo/territorial/muestra-enviada` |
| Material | Fichas de seguimiento, hoja de consolidados y Excel de asignación | Campo | `/api/recopiladores/campaigns/territorial/{formatos,papel,hoja-dia,asignacion/excel}` |
| Material | Encuestadores y la UMP asignada a cada uno | Monitoreo | Material guarda (`/asignacion`, `/asignacion/importar`, `collection_territorial_asignacion.R`); Monitoreo consulta, sin copiar, en `GET /api/monitoreo/territorial/asignacion-planificada` |

Monitoreo no asigna encuestadores: compara lo asignado con lo que llega del campo.

### 3. Aulas: anónimo o con marco de alumnos

> «La única diferencia entre el anónimo y la de alumnos de un marco es que sabemos quién es y por tanto sus variables
> y metas se definen por su marco. De allí no tiene por qué tener materiales (Fichas QR) diferentes porque las fichas
> son a los cursos horarios seleccionados aleatoriamente... me preocupa que eso no esté claro».

- Aulas es siempre **cursos-horario con fichas QR**. «Personas de un marco» deja de ser una forma de seleccionar.
  Pasa a ser un **atributo** del estudio: anónimo, o con marco de alumnos.
- El marco aporta identidad, variables y metas. No cambia el sorteo de cursos-horario ni el material de campo.
- En la clave `planner` el valor sigue en `perfiles[[1]]$seleccion` (`conglomerados` = anónimo, `marco` = con marco),
  para que ningún `.pulso` se migre. Los módulos lo leen como `aulas$con_marco` en `/api/planner/modos`.
- Cálculo de muestra aterriza en cursos-horario (`opinion-universitaria`) en los dos casos. Un proyecto que ya
  diseñó con «marco disponible» ve la propuesta de cambiar, con confirmación (`AterrizajeDelPlanner`). Nada se cambia
  solo.

| Entrega | Qué | Lee | Por dónde |
|---|---|---|---|
| Cálculo de muestra | Cursos-horario sorteados (titulares y banco) y metas, más el marco de alumnos cuando hay | Material | Unidades › Origen (`collection_origen.R`, `/api/recopiladores/campaigns/aulas/siembra`) |
| Cálculo de muestra | Metas por estrato | Monitoreo | Plan de Cálculo (R6: Monitoreo lo dice en Insumos › Fuentes, `d1f162d1d`) |
| Material | Registro de campo: aulas, accesos, fichas QR y plantillas del equipo | Monitoreo | `/api/recopiladores/campaigns/aulas/entrega` → `GET`/`POST /api/monitoreo/aulas/entrega{,/traer}` |
| Material | Las tablas del operativo en el Sheets del estudio (R13) | Monitoreo | Material › Entrega «Construir las tablas en Sheets» llama a `/api/monitoreo/aulas/publicar-libro`. Monitoreo sólo lee (`/api/monitoreo/aulas/importar-sheets`) |
| Material | Aplicadores asignados (R7) | Monitoreo | **Pendiente**: Material de aulas todavía no tiene dónde asignarlos. Mientras no exista, la asignación sigue en Monitoreo y no se retira |

### 4. Telefónico: tres bases

> «Es que en telefónico son tres insumos diferentes: Base de barrido (lo que manejan los enumeradores), Base de
> control (la que jala la data de kobo y arma los indicadores de avance y control de calidad) y Base de supervisión
> (usada para que el supervisor haga llamada y compruebe la veracidad de las llamadas).»

- **Base de barrido**: la arma Material, como campaña telefónica.
  > «En Materiales cuando se cree el excel base a usar allí se dejan las columnas base pero el analista pone los
  > casos, los números, etc, la deja armada, una vez armada Monitoreo la lee y ya sabe cuántos casos hay, los perfiles
  > de cuotas, etc, pero en modelo Monitoreo define las cuotas.»
- **Base de control**: es de Monitoreo. Jala Kobo y arma avance y calidad.
- **Base de supervisión**: la arma Material como campaña de supervisión de la campaña telefónica. Quiénes se
  supervisan y cuándo lo calcula Monitoreo.
  > «Para supervisión es diferente, monitoreo sabe el avance entonces al querer armar la base de supervisión calcula
  > a quiénes se les supervisa y cuándo de su producción por lote de avance y eso lo manda a Material, material sabe
  > que esta supervisión viene del anterior campo y lo que hace es coger las columnas relevantes de la base de barrido
  > y las columnas relevantes de los resultados (te pregunta qué variable de cada uno quieres usar con un selector
  > profesional no el del browser por defecto) diferenciando las variables del barrido importante para la supervisión
  > como el responsable y el estatus del barrido y las importantes de los resultados como alguna variable que se va a
  > repreguntar a la persona, además le añade sus propias columnas de la supervisión como observaciones del
  > supervisor y estatus de llamada de la supervisión así como el veredicto o resultados de la supervisión, arma todo
  > eso pero quien lo lee es el Monitoreo».

| Entrega | Qué | Lee | Por dónde |
|---|---|---|---|
| Material | Excel o Sheets base del barrido, con columnas base; el analista pone los casos y los números | Monitoreo (casos y perfiles de cuota) | `/api/recopiladores/campaigns/telefonica/{config,plantilla}`, `/api/recopiladores/barrido/plantilla`; Monitoreo lo conecta como fuente (`/api/monitoreo/sheets/{connect,source}`) |
| Monitoreo | Cuotas | Monitoreo | Modelo (`/api/monitoreo/cuotas`). Se definen aquí, no en Material |
| Kobo | Resultados | Monitoreo (base de control) | Fuentes de Monitoreo |
| Monitoreo | Lote de supervisión: a quién supervisar y cuándo, calculado de la producción por lote de avance | Material | Hoy las rondas viven en Monitoreo (`monitoreo_supervision_rondas.R`, clave `monitoreo_supervision_rondas`, `/api/monitoreo/telefonico/supervision/ronda`). **Nuevo**: Material lee la ronda guardada como entrada de la campaña de supervisión |
| Material | Base de supervisión: columnas de barrido (responsable, estatus del barrido…) y de resultados (variables que se repreguntan), elegidas con un selector del kit, no el nativo, y separadas por origen; más las columnas propias de supervisión (observaciones, estatus de la llamada de supervisión, veredicto) | Monitoreo | **Nuevo**: reemplaza a `/api/monitoreo/telefonico/supervision/ronda/publicar`. Monitoreo lee los resultados con `/api/monitoreo/telefonico/supervision/resultados/leer` |

Monitoreo deja de publicar la base de supervisión: calcula el lote y lo entrega.

**El barrido se construye en el Sheets del estudio, con nombres y teléfonos.** Decisión de Gonzalo del 2/11 (textual:
«Sí, en el Sheets»), ante la advertencia de Material de que la plantilla declaraba esas columnas sensibles y fuera
del Sheets compartido. Material arma la base de barrido sobre el enlace del estudio, como las tablas de aulas (R13).

### 5. Acreditación: los canales que declara el Modelo, por público

> «Solo indicando que es de acreditación, o sea es Acreditación telefónica o Acreditación en aulas».

Enmienda del mismo día (Gonzalo, ~07:15, textual):

> «todo es depende del tipo de recolección a veces todo es por correo, a veces es por correo y teléfono y a veces es
> por teléfono, correo y presencial en aula, eso se define en el modelo e incluso a veces hay perfiles como egresado
> que es correo una vez, luego llamadas y al final otra ronda de correos, o sea que hay campañas relacionadas».

- Hay tres canales posibles: **correo**, **telefónico** y **presencial en aula** (fichas QR). No siempre van los
  tres. El **Modelo de Monitoreo** los declara **por público** y pueden ir **en secuencia**, por rondas. Por ejemplo,
  egresados: correo, luego llamadas y al final otra ronda de correos.
- En Material, «Acreditación telefónica» y «Acreditación en aulas» son campañas `telefonica` y `aulas` de siempre,
  marcadas como de acreditación. No son tipos nuevos de campaña.
- `/api/planner/modos` devuelve, para acreditación:
  - `material.proposito = "acreditacion"`;
  - en `material.campanas`, los tipos de campaña de los canales que el Modelo declara.
  - Si el Modelo todavía no declara canales, devuelve sólo `correo`, como antes del ADR. La lista **no** es fija.
- **Las campañas de un mismo público quedan relacionadas**: la ronda 2 dice de qué campaña viene, igual que la
  supervisión telefónica se relaciona con su campaña (§4).
- **Las rondas se agregan sobre la marcha, no son un plan fijo.** Gonzalo, textual:
  > «A veces el orden no es 100% claro, por ejemplo hacemos llamada y no llegamos a la meta y se decide después
  > iniciar una campaña de correo».

  - A un público se le puede sumar una ronda en cualquier momento. Lo típico: Monitoreo ve que no se llega a la meta.
  - La ronda nueva se agrega al final de `canales`, con el número siguiente. Su campaña la abre Material, con
    `viene_de` apuntando a la campaña de la ronda anterior.
  - Las rondas ya abiertas no se rehacen ni se renumeran.
- Las metas siguen en Monitoreo › Modelo › Metas, con porcentajes por público (R17, excepción declarada el 1/11).

**Contrato de los canales (lo escribe Monitoreo, lo lee el Planner y Material).** Hoy el Modelo sólo guarda
`phone$enabled` por público, deducido de las fuentes, sin orden ni rondas. El contrato nuevo:

- Cada unidad del elenco, en `monitoreo_config$monitoreo_profile$units[[i]]` (`POST /api/monitoreo/actores`), trae:
  ```
  canales = list(list(ronda = 1L, canal = "correo"),
                 list(ronda = 2L, canal = "telefonico"),
                 list(ronda = 3L, canal = "correo"))
  ```
  `canal` ∈ `correo` · `telefonico` · `presencial`. `ronda` es el orden: empieza en 1 y no se repite dentro del
  público. La lista sólo crece: una ronda nueva toma el número siguiente y no reescribe las anteriores.
- `.monitoreo_normalize_model_units` conserva `canales`. Hoy descarta los campos que no conoce.
- El Planner lo lee con `.planner_canales_del_modelo(s)` (`planner_modos.R`). La equivalencia con las campañas es
  `correo` → `correo`, `telefonico` → `telefonica` y `presencial` → `aulas`.
- Cada campaña de acreditación en Material guarda su relación en la entrada del registro:
  `relacion = list(publico = <actor>, ronda = <n>, viene_de = <id de campaña o NULL>)`. La supervisión telefónica
  usa el mismo `viene_de`.

| Entrega | Qué | Lee | Por dónde |
|---|---|---|---|
| Monitoreo | Canales por público y su orden en rondas | Planner y Material | `monitoreo_profile$units[[i]]$canales` (contrato de arriba) → `/api/planner/modos` (`material.campanas`) y `/api/recopiladores/campaigns` (`tipos_del_estudio`) |
| Material | Campaña de correo de cada ronda: contactos y envío | Monitoreo | `/api/recopiladores/mail-campaigns`, `mail-sync` |
| Material | Campaña Acreditación telefónica de cada ronda: base de barrido, como en §4 | Monitoreo | Contrato de §4, con `relacion` |
| Material | Campaña Acreditación en aulas: fichas QR por curso-horario, como en §3 | Monitoreo | Contrato de §3, con `relacion` |
| Monitoreo | Metas por público | Monitoreo | Modelo › Metas (R17) |

## Consecuencias

- Una regla para todos los tipos: quien arma es Material, quien sigue es Monitoreo, y el traspaso tiene un endpoint
  o una foto con nombre.
- Aulas deja de tener dos selecciones. La Ficha del estudio pregunta si hay marco de alumnos. Cálculo trata los dos
  casos como cursos-horario.
- Acreditación abre en Material sólo los canales que su Modelo declara. Deja de dar 409 en telefónica o aulas
  cuando el Modelo los declara, y sigue dándolo cuando no.
- Hay tres traspasos que todavía no existen y quedan como trabajo:
  - asignación de aplicadores en Material de aulas (R7);
  - entrega del lote de supervisión de Monitoreo a Material, y base de supervisión armada en Material (§4, A3);
  - territorial por cuotas por zona en Hojas, Material y Monitoreo (A1);
  - los canales por público con sus rondas en el Modelo de Monitoreo, y la `relacion` entre campañas en Material
    (§5).

## Cumplimiento

- `test-planner.R`:
  - aulas con y sin marco aterrizan en `opinion-universitaria`;
  - `aulas$con_marco` sigue a `seleccion`;
  - acreditación abre los canales del Modelo (egresados: correo → telefónico → correo), con
    `proposito = "acreditacion"`, y sólo `correo` si el Modelo no los declara;
  - el oráculo de los proyectos de referencia no cambia.
- `test-collection-campaigns-planner.R`: sin canales, telefónica da 409; con correo y telefónico en el Modelo, se
  crea.
- Frontend (`features/estudio`): la Ficha ofrece «Con marco de alumnos» como interruptor, no como otra selección.
- Por módulo, con su sesión dueña:
  - **Hojas (Material)**: nombres de las campañas de acreditación y su `relacion`; asignación de aplicadores en
    aulas (R7); la campaña de supervisión con su selector.
  - **Monitoreo-Cálculo**: declarar `canales` por público en el Modelo de acreditación y conservarlos al
    normalizar; entregar el lote en vez de publicar la ronda; pasar a lectura la asignación de aulas
    cuando Material la tenga; usar el marco de alumnos como fuente de variables y metas en cursos-horario.

## Anexo A. Contratos de traspaso congelados (2/11)

Propuestos por Hojas/Material (`contratos-material-por-tipo-2026-11-02.md`, notas de la coordinación) y aceptados
por la coordinación como decisión reversible. Cada dueño construye su lado contra esta forma.

### A1. Territorial por cuotas (§2): Hojas → Material → Monitoreo

- **Planner.** `/api/planner/modos` → `hojas_ruta = list(aplica, modo = "ump" | "cuotas")`. Todo territorial
  aplica, también en cuotas, y el Home lo cuenta así (`.overview_hojas_aplica`).
- **Hojas.** En `cuotas` las secciones son Territorio · Población · Muestra · Entrega, sin Manzanas ni Selección.
  La unidad es la **zona** (distrito, o zona censal si el estudio baja a ese nivel), con su N y su cuota por celda
  (sexo × rango de edad, la matriz de Población).
- **Foto del envío** (`runs[[fase]]$envio`): suma `kind = "cuotas"` y, en lugar de bloques, trae
  `zonas = list(list(ubigeo, zona, nombre, n, cuotas = list(list(sexo, edad, n))))`, con la misma huella
  (`sample_fingerprint`) y `envio_meta`.
- **Material.** La campaña territorial lee `kind`. En cuotas:
  - Unidades lista las zonas con su cuota.
  - La ficha de seguimiento es una hoja de conteo por zona, con las celdas de cuota para marcar.
  - El Excel de asignación es encuestador ↔ zona, con su parte de la cuota.
  - La asignación se guarda como hoy (`collection_territorial_asignacion.R`), con `id_zona` en lugar de
    `id_manzana`.
- **Monitoreo.** Lee la foto de cuotas (zonas y metas por celda) y la asignación por zona
  (`asignacion-planificada` con `id_zona`). En cuotas el avance se mide por celda, no por UMP.

### A2. Telefónico: base de barrido (§4)

- Material › Barrido genera la base con sus columnas, y el analista pone los casos y los números.
- Por la decisión de Gonzalo, se construye en el Sheets del estudio, con nombres y teléfonos.
- Monitoreo la conecta como fuente y define las cuotas en su Modelo.

### A3. Telefónico: campaña de supervisión (§4): Monitoreo → Material → Monitoreo

- **Lote (lo arma Monitoreo).** `GET /api/monitoreo/telefonico/supervision/lotes`, de lectura, devuelve
  `list(list(lote_id, creado_en, campana_origen = "telefonica.principal", criterio, casos = list(list(llave,
  responsable, fecha_llamada))))`. `llave` es la del barrido (`cfg$llave` de la campaña telefónica). Monitoreo decide
  a quién y cuándo; Material no recalcula.
- **Campaña (la arma Material).** Tipo nuevo de campaña, `supervision`, una por lote:
  - id `supervision.<lote_id>`;
  - `relacion = list(publico = NULL, ronda = NULL, viene_de = "telefonica.principal")`.
  No puede ser una `telefonica`, porque esa es única por proyecto. `/api/planner/modos` agrega `supervision` a
  `material.campanas` siempre que haya `telefonica`, también en acreditación.
- **Columnas.** Material propone y el analista elige, con el selector del kit, no el nativo:
  - del barrido: sus columnas (por defecto, `Responsable` y `Status`);
  - de los resultados: las variables que se repreguntan;
  - siempre, las de la supervisión, con nombre fijo porque las lee Monitoreo: `Observaciones del supervisor`,
    `Estatus de la llamada de supervisión` y `Veredicto`. El veredicto tiene catálogo cerrado: `Confirmada`,
    `No confirmada`, `No contactado`. Ese catálogo es una propuesta de Hojas, no una decisión de Gonzalo: él puede
    revisarlo. Si cambia, cambian Material, que lo escribe, y Monitoreo, que lo lee.
- **Salida.** Excel o Sheets, con una fila por caso del lote.
- **Lectura (Monitoreo).** Lee esas tres columnas por `llave` y dice de qué lote y de qué campaña viene cada caso.

### A4. Acreditación (§5)

- Material nombra «Acreditación telefónica» y «Acreditación en aulas» cuando `material.proposito = "acreditacion"`.
- `proposito` y `relacion = list(publico, ronda, viene_de)` van en la entrada del registro de cada campaña.
- Se construye cuando Monitoreo exponga `canales` por público (contrato del §5).

## Notas

- Respuestas textuales de Gonzalo: notas de la coordinación, `definicion-material-monitoreo-por-tipo-2026-11-02.md`.
- Checklist: `docs/qa/checklist-responsabilidades-modulos-2026-11-02.md` (R6, R7, R13, R14, R15, R16 y R17).
