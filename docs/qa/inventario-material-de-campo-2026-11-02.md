# Inventario de Material de campo (2 nov 2026)

Tipo: Censo QA
Estado: Vigente
Fecha: 2026-11-02
Autoridad: Relevamiento de solo lectura del 2026-11-02, fase 1 del revamp visual de Material de campo; ADR 0125

Fase 1 del revamp visual de Material (sesión «Revamp visual de Material de campo»). Es de sólo lectura: no se tocó
código de producto. Sirve de base para el rediseño (fase 2, artefacto de diseño) y para la sesión dueña
(«Hojas de ruta y Material»), que lo implementará cuando Gonzalo lo apruebe.

Fuentes:

- [ADR 0125](../adrs/0125-material-arma-monitoreo-sigue.md): «Material arma, Monitoreo sigue», con los contratos A1–A4.
- El código: `frontend/src/features/recopiladores/` y `api/R/collection_*.R` con `router_recopiladores.R`.
- Las capturas de la matriz D1 (`checklist-mejoras-visuales-2026-11-02.md`): copias `d1_ump`, `d1_cuotas`,
  `d1_aulas` y `d1_telefonico`, a 1440×1000.

## Cobertura

| Superficie | Cómo se vio |
|---|---|
| Territorial UMP: Unidades, Catálogo, Paquetes y Entrega | En vivo (captura D1, `d1_ump`) |
| Territorial cuotas: Unidades y Entrega | En vivo (`d1_cuotas`) |
| Aulas: Unidades, Accesos, Catálogo, Paquetes y Entrega | En vivo, **sólo en vacío** (`d1_aulas`, D17): no hay copia con selección de cursos-horario |
| Telefónica: Casos, Barrido y Entrega | En vivo (`d1_telefonico`) |
| Lista de campañas, Nueva campaña, Supervisión, Correo y Acreditación | **Sólo leídos en el código.** Ninguna copia sembrada los ejercita. Cobertura pendiente declarada, no «está bien» |

## 1. Qué es Material (ADR 0125)

Material **arma y configura**: imprimibles, fichas QR, Excel de asignación, accesos (Kobo, SurveyMonkey y correo) y
las tablas de Google Sheets que campo llena al inicio. **No da seguimiento**: eso lo hace Monitoreo, que lee lo
armado. Monitoreo sólo le entrega insumos a Material cuando el armado los necesita.

## 2. Estructura del módulo

- **Ruta**: `/material-campo` (`/recopiladores` es un alias viejo que se reescribe). Entrada en `lib/modules.ts:470-722`.
  Hay una sola sección de primer nivel, «Campañas», y los modos `aulas`, `territorial`, `telefonica`, `supervision`
  y `correo`.
- **Lista de campañas** (`campanas/ListaDeCampanas.tsx`): `PageFrame` de tipo document, con «Campañas» y
  «+ Nueva campaña». Las tarjetas son todas iguales y las archivadas van en un `<details>`. La tarjeta lleva una
  franja con el emblema del tipo, el chip de tipo, el nombre, el subtítulo, el chip de estado, las cifras y el menú ⋯.
  Lo que dice cada tarjeta sale de `resumenDeTarjeta` (`modeloRegistro.ts:304-410`).
- **Campaña abierta**: ocupa toda la página. Lleva la `ModuleCommandBar` con:
  - la miga «← Campañas / icono Nombre ⋯» y dos indicadores;
  - la `SectionPillbar` con las secciones del tipo;
  - el chip de estado y «Actualizar».

  Debajo va el `ContextTabRail` de pestañas (sólo cuando la sección tiene dos o más) dentro de un `AdaptiveSplitView`.
- **Nueva campaña** (`?panel=nueva-campana`): primero la cuadrícula de tipos que declara el Planner, cada uno con su
  línea de `QUE_ES_EL_TIPO`; después un paso propio de cada tipo.
- **Acento**: Musgo `--pulso-module-fieldkit` `#4f752c`, con sus variantes `-soft` y `-border` (ADR 0108).

## 3. Inventario por tipo de estudio

### 3.1 Territorial aleatorio (UMP)

| | |
|---|---|
| **Entrada** | La foto que envía Hojas de ruta (`runs[[fase]]$envio`, `kind=ump`): UMP, titular o reemplazo, viviendas y huella |
| **Lista de encuestadores** | La lee de **Monitoreo › Territorial** (decisión I3). Sin lista: `E_COLLECTION_TERRITORIAL_SIN_EQUIPO` |
| **Secciones** | Unidades · Catálogo · Paquetes · Entrega |
| **Indicadores / estado** | Titulares · Reemplazos / «Muestra recibida», «Desactualizada», «Sin muestra enviada» |

| Sección › pestaña | Qué hace | Qué produce |
|---|---|---|
| Unidades › lista | Muestra la franja de distritos con «n por revisar», búsqueda y tabla UMP/R con Zona, Manzana, Encuestas, Viviendas, Estado y Hoja; `?panel=hoja` abre la hoja de una UMP | PDF de la hoja de la UMP |
| Catálogo › fichas · zonas · ruteo · consolidados · códigos | Ficha por UMP (cara 1 con datos y cuota; cara 2 con croquis de manzana), PDF de prueba de tres perfiles, hoja de zona y códigos del estudio | PDF de fichas, PDF de prueba, PDF de ruteo y PDF de consolidados |
| Paquetes › armado | Paquete por distrito, hojas de ruteo y de consolidados, y reemplazos puntuales | ZIP por distrito, Excel operativo y PDF de reemplazos |
| Entrega › plan | Asigna encuestadores a columnas del calendario, saca el Excel para campo y sube el Excel llenado; con los supuestos arma el plan de campo y la hoja del día | XLSX `asignacion_encuestadores` y PDF de la hoja del día |

- **A quién va**: el equipo de campo recibe el papel, el ZIP y el Excel.
- **Qué lee Monitoreo**: la asignación (`GET /api/monitoreo/territorial/asignacion-planificada`, en Control › Equipo)
  y la misma foto de Hojas (`muestra-enviada`).

### 3.2 Territorial por cuotas (A1)

- **Entrada**: la foto con `kind=cuotas`: zonas con su N y su cuota por celda (sexo × edad).
- **Unidades**: tabla de zonas con Código, Entrevistas, Cuota por sexo y Celdas. Cada zona abre su hoja de conteo, y
  «Hojas de conteo de todas» saca la de todas. Los indicadores pasan a Zonas · Entrevistas.
- **Catálogo, Paquetes y Entrega no distinguen el modo.** Con cuotas, `units` llega vacío y los vacíos hablan de UMP
  («La muestra enviada no trae UMP con las que armar el plan», «0 UMP asignadas»). `plan` y `hoja-dia` exigen bloques
  y dan SIN_FUENTE. La tarjeta del registro sigue mostrando titulares y reemplazos.
- **Produce**: la hoja de conteo por zona (PDF) y el Excel encuestador ↔ zona, con varias personas por zona y su parte.
- **Monitoreo**: lee la asignación con `id_manzana` = id de la zona. El avance por celda está pendiente del lado de
  Monitoreo.

### 3.3 Aulas (cursos-horario con fichas QR; con o sin marco)

| | |
|---|---|
| **Entrada** | Cursos-horario sorteados en Cálculo de muestra (titulares y banco), o el plan de Monitoreo si el modo es monitoreo (`.collection_seed_source`) |
| **Con o sin marco** | No cambia nada en Material (ADR 0125 §3); la UI no lee `con_marco` |
| **Secciones** | Unidades · Accesos · Catálogo · Paquetes · Entrega (aulas marca las hechas) |
| **Estado** | `deploymentStatusLabel`: «sin plan de recolección», borrador, preparados, entregada |

| Sección › pestaña | Qué hace | Qué produce |
|---|---|---|
| Unidades › lista | Resumen del plan (reservas, banco, origen y sorteo), composición por facultad y tabla paginada del plan congelado | — |
| Unidades › origen | Conexión con la fuente, qué entrega, huella y vigencia, diferencias (altas, bajas y cambios) y resembrado con confirmación | — |
| Accesos › canales · vinculación | Canal de acceso (Kobo existente o SurveyMonkey weblink/recipients), comprobación, vista previa y tabla «Qué aula usa qué acceso» | Enlaces por aula (Kobo `parameterized_link`; el resto `manual_handoff`) |
| Catálogo › tipos · editor | Galería de tres tipos (Ficha de aula con QR, Ficha de campo con croquis, Afiche QR) con familias e inspector; editor de bloques por cara | Receta de la ficha |
| Paquetes › armado | Crear las fichas, ver la imagen, generar el PDF o el paquete (job), ficha de prueba e histórico, y enviar al Drive | PNG, PDF y ZIP de fichas; subida a Drive |
| Entrega › traspaso | Entregar a Monitoreo; construir en Sheets «Las tablas que campo llena» y «La distribución de aplicadores»; recibo de lo entregado | Registro de la entrega y tablas en el Sheets del estudio (R13) |
| Entrega › plantillas | Libro del equipo, disponibilidad de aplicadores y asignación inicial | Tres XLSX |

- **Qué lee Monitoreo**: la entrega (`/api/monitoreo/aulas/entrega{,/traer}`) y las tablas del Sheets
  (`importar-sheets`).
- **Pendiente R7**: Material sólo saca la planilla inicial de aplicadores. La distribución sigue en Monitoreo.

### 3.4 Telefónico: barrido (A2)

| | |
|---|---|
| **Entrada** | La ronda del Modelo de Monitoreo (sin ella, `E_COLLECTION_CAMPAIGN_TELEFONICA_SIN_RONDA`). Los casos y teléfonos los pega el analista |
| **Secciones** | Casos · Barrido · Entrega |
| **Indicadores / estado** | Muestra · Backup / «Por configurar», «Configurada» |

| Sección › pestaña | Qué hace | Qué produce |
|---|---|---|
| Casos › configuración | Casos de muestra y de backup, llave, estratos y responsables; teléfonos por caso, reemplazo desde el backup y rótulo de la observación; columnas sensibles | — |
| Barrido › plantilla · status | Columnas de la plantilla (identidad y cola en ámbar), Excel del barrido y construcción en su propio Sheets; catálogo de Status | XLSX `plantilla_barrido` y Sheets del barrido (sólo crea las pestañas que faltan) |
| Entrega › monitoreo | Lo que lee Monitoreo y las reglas antes de abrir el Sheets al equipo | — |

- **A quién va**: a los enumeradores. Es un documento propio, separado del control.
- **Qué lee Monitoreo**: el Sheets del barrido, conectado a mano en Insumos › Fuentes. Las cuotas las define Monitoreo,
  no Material.

### 3.5 Telefónico: supervisión (A3)

- **Entrada**: un lote de Monitoreo (`monitoreo_supervision_lotes`), que dice a quién supervisar y cuándo. Es una campaña
  por lote, con `viene_de` igual a la campaña telefónica.
- **Secciones**:
  - Columnas › selección: switches «Del barrido», «De los resultados» (con búsqueda) y «De la supervisión» (fijas:
    Observaciones del supervisor, Estatus de la llamada de supervisión y Veredicto).
  - Entrega › base: Excel, Sheets propio (nombre y teléfono por fórmula desde el barrido) y lo que lee Monitoreo.
- **Produce**: XLSX `supervision_<lote>` y el Sheets de supervisión.
- **Qué lee Monitoreo**: las tres columnas por llave (`supervision/resultados/leer`).
- **Hallazgo**: el menú ⋯ de la tarjeta no tiene acciones (`accionesDeCampana.ts:48`). No se puede renombrar ni
  archivar.

### 3.6 Acreditación por público y ronda (A4)

- No es un tipo propio. Son campañas `telefonica`, `aulas` y `correo` con `proposito=acreditacion` y
  `relacion = (publico, ronda, viene_de)`. Los canales los declara el Modelo de Monitoreo.
- Cada ronda telefónica es `telefonica.<público>-r<n>`. El barrido es un solo Sheets con una pestaña por campaña.
  «Acreditación en aulas» es una sola por estudio.
- **En la UI sólo cambia el diálogo de creación**: el nombre por defecto y el radio de ronda («Viene de «X»» o
  «Primera ronda»). **`relacion` y `viene_de` no se pintan** en la tarjeta, la cabecera ni el shell: la secuencia
  «correo → llamadas → correo» de un público no se ve en ningún lado.

### 3.7 Correo

- Es una campaña por envío a un grupo y sale por Mailchimp o SurveyMonkey. No tiene `ModuleCommandBar`: la miga va
  dentro de la barra de cada pestaña.
- **Editor**: bloques del correo, con paneles por `?panel=`: identidad, destinatarios, envíos, revisión, importar y
  borrar. Exporta un ZIP de Mailchimp o crea el borrador por API, o lo prepara para SurveyMonkey. Sincroniza «Quién ya
  respondió» con un job.
- **Contactos**: resumen, enlaces personales y tablero por perfil.
- **Qué lee Monitoreo**: las respuestas, en Control › Correo.

## 4. Traspasos

| De | A | Qué | Estado |
|---|---|---|---|
| Hojas de ruta | Material territorial | Foto de la muestra (UMP o zonas) | Existe |
| Monitoreo | Material territorial | Lista de encuestadores | Existe. Es **un segundo traspaso Monitoreo → Material** que el ADR §1 no cuenta («hoy pasa en un solo caso») |
| Cálculo de muestra | Material aulas | Cursos-horario sorteados y banco | Existe (Origen) |
| Monitoreo (Modelo) | Material telefónica | Rondas y canales | Existe |
| Monitoreo | Material supervisión | Lote | Existe (el ADR todavía lo marca «Nuevo») |
| Material | Monitoreo | Asignación territorial | Existe; en cuotas reusa `id_manzana` |
| Material | Monitoreo | Entrega y tablas de aulas | Existe |
| Material | Monitoreo | Sheets del barrido | Se conecta a mano en Monitoreo, no por traspaso |
| Material | Monitoreo | Veredicto de supervisión | Existe |
| Material | Monitoreo | Aplicadores de aulas (R7) | **Pendiente** |

## 5. Hallazgos para el rediseño

Van por cláusula del Contrato de Superficie cuando aplica.

1. **No se lee qué arma Material y qué pasa a Monitoreo de un vistazo.**
   - Cada tipo lo dice en una frase distinta y en un lugar distinto: el lead de Entrega, un párrafo, un enlace.
   - No existe un patrón común «Entra → Material arma → Sale a Monitoreo».
   - Es C5 en la Lista de campañas y en cada Entrega.
2. **El registro no muestra relaciones.** No se ve la ronda ni el `viene_de` de acreditación, ni de qué telefónica
   viene la supervisión. C5 en la Lista.
3. **Territorial por cuotas habla de UMP fuera de Unidades.**
   - Entrega dice «0 UMP asignadas» y «no trae UMP».
   - Catálogo y Paquetes no distinguen el modo, y la tarjeta muestra titulares y reemplazos.
   - C5 en Cuotas › Entrega, Catálogo, Paquetes y Lista.
4. **Paquetes territorial**:
   - Las tres tarjetas tienen alturas libres y dejan un hueco sin dueño bajo las dos de la derecha (C3).
   - La tabla esconde la columna «Fichas de reemplazo» (D16, C4).
5. **Unidades UMP**:
   - La columna Estado va vacía en todas las filas (D15, C5).
   - La franja de distritos es un grupo par sin declarar (C1). Su última tarjeta «Todos» es de otro rol.
6. **Catálogo territorial**: las dos tarjetas se ven par, pero cada una toma su propio alto. Debajo queda casi todo el
   alto vacío y sin dueño (C3).
7. **Entrega territorial**: el panel de encuestadores mezcla estado y acciones. «Guardar asignación» va en verde
   apagado, pero no es un estado. Además, «Plan de campo» queda deshabilitado sin decir por qué en UMP.
8. **Telefónica › Casos**: los segmentados no marcan bien la opción elegida (D18). Las dos tarjetas tienen alturas
   distintas sin contrato (C2/C3).
9. **Telefónica › Barrido**: la tarjeta «En su propio Sheets» lleva un párrafo de 7 líneas que explica reglas. Va
   contra «no sobreexplicar en la UI».
10. **Aulas**: los vacíos son correctos (C3: caja con dueño, qué falta y a dónde ir). Pero la copia D1 no permite
    juzgar el diseño con datos (D17, C5 categoría 2).
11. **Supervisión**: el menú ⋯ está vacío, y el estado «Sin lote» es el único en tono de aviso dentro del chrome.
12. **Correo**: rompe el chrome común, porque no tiene `ModuleCommandBar` y la miga vive dentro de cada pestaña. Es
    deuda de uniformidad (ADR 0042).
13. **Vocabulario del chrome**: hay mayúsculas inconsistentes («Campaña telefonica» sin tilde en la miga, «sin plan de
    recolección» en minúscula) y los indicadores son de distinto rol según el tipo.

## 6. Lo que el rediseño debe conservar

- La gramática módulo → modo → sección → pestaña → panel, con secciones en la `SectionPillbar` y pestañas en el
  `ContextTabRail`. No se agrega un sexto nivel.
- El acento Musgo, los tokens `--pulso-*`, la tipografía del sistema y los radios 10/14/16.
- Las rutas direccionables (`seccion`, `pestana`, `panel`) y los vacíos con caja, motivo y destino que ya cumplen C3.
- Lo que cada sección produce hoy. El rediseño reordena y hace legible; no quita funciones.
