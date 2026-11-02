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
  variantes de selección (pasa a ser un atributo, §3 abajo) y acreditación declara tres canales en Material (§5).
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

### 5. Acreditación: tres canales

> «Solo indicando que es de acreditación, o sea es Acreditación telefónica o Acreditación en aulas».

- Material ofrece tres canales en un estudio de acreditación: **correo**, **Acreditación telefónica** y
  **Acreditación en aulas** (presencial, con fichas QR). Las dos nuevas son campañas `telefonica` y `aulas` de
  siempre, marcadas como de acreditación. No son tipos nuevos de campaña.
- `/api/planner/modos` devuelve, para acreditación, `material.campanas = [correo, telefonica, aulas]` y
  `material.proposito = "acreditacion"`. Material usa ese propósito para nombrarlas.
- Las metas siguen en Monitoreo › Modelo › Metas, con porcentajes por público (R17, excepción declarada el 1/11).

| Entrega | Qué | Lee | Por dónde |
|---|---|---|---|
| Material | Campaña de correo: contactos y envío | Monitoreo | `/api/recopiladores/mail-campaigns`, `mail-sync` |
| Material | Campaña Acreditación telefónica: base de barrido, como en §4 | Monitoreo | Contrato de §4 |
| Material | Campaña Acreditación en aulas: fichas QR por curso-horario, como en §3 | Monitoreo | Contrato de §3 |
| Monitoreo | Metas por público | Monitoreo | Modelo › Metas (R17) |

## Consecuencias

- Una regla para todos los tipos: quien arma es Material, quien sigue es Monitoreo, y el traspaso tiene un endpoint
  o una foto con nombre.
- Aulas deja de tener dos selecciones. La Ficha del estudio pregunta si hay marco de alumnos. Cálculo trata los dos
  casos como cursos-horario.
- Acreditación deja de dar 409 al crear campañas telefónica o de aulas.
- Hay tres traspasos que todavía no existen y quedan como trabajo:
  - asignación de aplicadores en Material de aulas (R7);
  - entrega del lote de supervisión de Monitoreo a Material, y base de supervisión armada en Material (§4);
  - nombres de las campañas de acreditación en Material (§5).

## Cumplimiento

- `test-planner.R`:
  - aulas con y sin marco aterrizan en `opinion-universitaria`;
  - `aulas$con_marco` sigue a `seleccion`;
  - acreditación abre `correo`, `telefonica` y `aulas`, con `proposito = "acreditacion"`;
  - el oráculo de los proyectos de referencia no cambia, salvo acrconta en Material, que pasa a las tres campañas.
- Frontend (`features/estudio`): la Ficha ofrece «Con marco de alumnos» como interruptor, no como otra selección.
- Por módulo, con su sesión dueña:
  - **Hojas (Material)**: nombres de las campañas de acreditación; asignación de aplicadores en aulas (R7); la
    campaña de supervisión con su selector.
  - **Monitoreo-Cálculo**: entregar el lote en vez de publicar la ronda; pasar a lectura la asignación de aulas
    cuando Material la tenga; usar el marco de alumnos como fuente de variables y metas en cursos-horario.

## Notas

- Respuestas textuales de Gonzalo: notas de la coordinación, `definicion-material-monitoreo-por-tipo-2026-11-02.md`.
- Checklist: `docs/qa/checklist-responsabilidades-modulos-2026-11-02.md` (R6, R7, R13, R14, R15, R16 y R17).
