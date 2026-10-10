# Censo de acciones de datos en Monitoreo y el modelo «un verbo por dirección» (2026-10-10)

Tipo: Censo QA
Estado: Vigente
Fecha: 2026-10-10
Autoridad: Lectura del código el 2026-10-10 (frontend `features/monitoreo/**`, `api/monitoreo.ts`, routers `router_monitoreo*.R` y engines `monitoreo_*.R`) con tres inventarios independientes, uno por familia de perfil; el modelo de §5 es la especificación de la unidad L38 del GOAL y se aprueba mirando la maqueta L38

Pedido del dueño: «en Monitoreo hay varios tipos de monitoreo y los botones para
actualizar la data tienen bastantes funciones distintas, algo confuso con
botones blancos y rojos. Es mejor que entendamos en profundidad qué hace cada
uno y una forma natural y orgánica de ordenarlo».

---

## 1. La respuesta corta

La confusión no es de color. Es de **verbo**. Hoy la barra de mando de
Monitoreo ofrece dos botones, «Avance» (claro) y «Todo» (relleno con el tono
carmesí del módulo), y ninguno de los dos dice lo que hace. Peor: hacen cosas
distintas según el perfil.

| Perfil | «Avance» (claro) | «Todo» (relleno) | Qué más hay en pantalla para lo mismo |
|---|---|---|---|
| Telefónico | Trae lo nuevo de Kobo (incremental) **y además relee las hojas** de universo y barrido | Vuelve a descargar todas las fuentes activas | Franja de Fuentes con «Sheets», «Kobo» y **otro «Todo»** en azul marino |
| Acreditación | Trae lo nuevo de SurveyMonkey/Kobo (incremental); **no** lee Sheets | Vuelve a descargar todas las fuentes activas y trae recopiladores | Franja con «Sheets», «encuestas» (en minúscula) y **otro «Todo»** |
| Territorial | Trae lo nuevo de Kobo de la fase y, sin decirlo, re-descarga el formulario de ocurrencias | Vuelve a descargar **una sola fuente Kobo de una sola fase**; no toca la Hoja de ruta ni las ocurrencias | «Actualizar Campo», «Sincronizar respuestas» y «Sincronizar campo»: **los tres hacen exactamente lo de «Todo»** |
| Aulas | **No trae nada**: recalcula con lo que hay y salta a la sección Avance | Se llama «Traer respuestas» y hace **cuatro cosas**: trae Kobo, lee el Sheets del operativo, **re-publica** las hojas de la app y **borra filas** del Sheets de aplicadores | Un segundo «Traer respuestas» en el panel de Fuentes, idéntico |

El rojo no es peligro: es `--mon-shell-accent`, el tono del módulo. Por
diseño (ADR 0042, paleta por módulo) el primario de cada módulo se retiñe con
su tono, y el de Monitoreo es carmesí, así que **su acción primaria se ve
como un botón de peligro** en el único módulo donde conviven acciones que
de verdad lo son. Y lo verdaderamente destructivo, borrar filas de un Sheets
que editan 22 personas, cambiar el sello del estudio a cierre, podar el
snapshot al cambiar de formulario, va **sin tono de alerta y sin
confirmación**.

La propuesta (§5) es un solo control de actualización en la barra, igual en
los cuatro perfiles, con un diccionario de siete verbos que separa las tres
direcciones en que se mueve la data: **hacia adentro** (Actualizar), **sin
moverse** (Recalcular) y **hacia afuera** (Publicar, siempre con ensayo).

---

## 2. Método

Tres lecturas independientes del código, una por familia de perfil
(telefónico y acreditación comparten página; territorial; aulas), cada una
siguiendo cada botón desde el rótulo hasta el endpoint REST y, cuando hacía
falta saber qué pasa de verdad, hasta el engine R. Se registró rótulo,
variante visual, handler, endpoint, efecto, alcance, condiciones y qué ve el
usuario después. Las cifras de §3 y §4 salen de esas tablas; las referencias
`archivo:línea` se conservan en los inventarios de §3.

Vocabulario: sección › pestaña › panel, según el contrato de navegación v3.

---

## 3. Inventario por perfil

Se listan las acciones que **mueven datos**: traen de una plataforma, releen
una hoja o archivo, recalculan, escriben hacia fuera o borran. Las ediciones
de configuración (metas, estados, cronograma, criterios) se resumen al final
de cada perfil porque comparten un solo efecto: marcan el tablero «pendiente
de regenerar».

### 3.1 Chrome compartido (los cuatro perfiles)

| Rótulo | Visual | Qué hace | Archivo |
|---|---|---|---|
| «Avance» (default del componente: «Actualizar avance») | `mon-command-sync is-advance`, claro | `onSyncAdvance` del perfil; ver cada perfil | `shell/MonitoreoModuleChrome.tsx:333` |
| «Todo» (default: «Actualizar todo»; en aulas «Traer respuestas») | `mon-command-sync is-full`, relleno con `--mon-shell-accent` | `onSyncAll` del perfil | `shell/MonitoreoModuleChrome.tsx:351` |
| Indicadores «Regenerado», «Registros», «Sincronizado», «Estado: Pendiente / Parcial / Fallida» | solo lectura | `pending_regeneration` se enciende con cualquier guardado de config o fuente y **solo se apaga cuando un sync reemplaza el snapshot**; no hay botón «Regenerar» | `MonitoreoModuleChrome.tsx:173-213` |

Dos defectos del propio chrome:

- **Los dos botones giran a la vez.** El chrome decide cuál anima con
  `syncProgress.active`; telefónico y acreditación le pasan un objeto con
  `mode` y sin `active`, y además `syncing = loading || sourceSyncing`, así que
  cargar una vista enciende el spinner de los dos. Aulas no pasa progreso y
  también los enciende a ambos en cualquier mutación. Territorial es el único
  que pasa `active`.
- **El resultado no se ve.** `runProfileSourceSync` escribe su mensaje en
  `actionStatus`, que solo pinta una vista heredada del Modelo; el chrome
  recibe `status={null}`. El usuario ve el error si falla y nada si funciona.

### 3.2 Telefónico

Secciones: Fuentes (Fuentes activas · Universo y barrido · Encuestas), Modelo,
Llamadas, Consultas, Avance.

| # | Dónde | Rótulo | Visual | Endpoint | Qué hace | Alcance | Confirmación |
|---|---|---|---|---|---|---|---|
| T-C1 | Chrome | Avance | claro | POST `/api/monitoreo/sync` modo `advance` (job callr) | Kobo incremental por cursor **y relectura completa de las hojas** de universo y barrido; reconstruye el snapshot | fuentes que «mueven el avance» | no |
| T-C2 | Chrome | Todo | relleno carmesí | POST `/sync` modo `full` (job) | Re-descarga todo y persiste recopiladores | todas las activas | no |
| T1 | Fuentes › las 3 pestañas › franja «Paquete telefónico» | Sheets | contorno, `layers-3` | POST `/sheets/sync` `async` (job) | Relee las hojas de Google Sheets; no toca Kobo | Sheets activas | no |
| T2 | misma franja | Kobo | contorno, `list-checks` | POST `/sync` modo `full` | Re-descarga Kobo **entero** (no incremental) | Kobo activas | no |
| T3 | misma franja | Todo | **relleno azul marino** `--pulso-primary`, `refresh-cw` | POST `/sync` modo `full` | **Lo mismo que T-C2**; recarga el scope `source` en vez del de la vista | todas | no |
| T4–T7 | Fuentes › «Conectar fuente» → sideover | Ver mis formularios · Leer y verificar · Conectar | `pulso-button is-primary` | `/kobo/assets`, `/sheets/inspect`, `/sheets/source` o `/source` | Registra o edita la conexión; **no trae datos**; marca «pendiente» | una fuente | no; el botón final dice «Conectar» aunque se edite |
| T8 | Universo y barrido › tarjetas · Encuestas › Plataforma | Cambiar conexión / Conectar | enlace suave | abre el mismo sideover | — | una fuente | — |
| T9 | Fuentes activas › aside › «Nombre de base» | (input: guarda al salir del foco) | input | POST `/source` | Renombra y **marca todo el snapshot «pendiente»** | una fuente | no |
| T18 | Avance › Salidas | Generar PDF telefónico | `mon-outputs-primary` | POST `/client-report/pdf` (job) | Genera el PDF | el corte | — |
| T19 | Avance › Salidas | Generar PDF de producción telefónica | ídem | POST `/production-report/pdf` (job) | Genera el PDF interno | el corte | — |
| T20 | Avance › Salidas | Publicar Sheets cliente/interno · Actualizar Sheets … | `mon-outputs-publish-button`, `table-2` | POST `/publication/sheets` (**síncrono**) | **Sobrescribe pestañas** en un Sheets externo del cliente | el corte → spreadsheet destino | casilla en «interno»; preflight del backend; **sin diálogo** |
| T21–T22 | Avance › Salidas › «Validación y soporte» | Validar salida · Descargar soporte | secundarios | `/publication/preflight`, `/publication/evidence-pack` | Valida; genera un ZIP (el rótulo dice «descargar») | — | — |

Configuración que marca «pendiente»: «Confirmar estados» (Universo y barrido),
«Guardar filtro» (Encuestas), «Usar para cuotas», «Objetivo total» (**un POST
por tecla**), «Agregar categoría», «Quitar cuota {valor}» (solo ícono, borra y
persiste al instante), «Confirmar N metas», «Guardar cronograma».

### 3.3 Acreditación

Secciones: Fuentes (Actores · Fuentes y universo · Recopiladores), Modelo
(Modelo operativo · Distribución · Cronograma), Consultas, Teléfono, Avance.

| # | Dónde | Rótulo | Visual | Endpoint | Qué hace | Alcance | Confirmación |
|---|---|---|---|---|---|---|---|
| A-C1 | Chrome | Avance | claro | POST `/sync` `advance` (job) | SurveyMonkey/Kobo incremental; **no** lee Sheets | fuentes de respuesta activas | no |
| A-C2 | Chrome | Todo | relleno carmesí | POST `/sync` `full` (job) | Re-descarga todo, trae recopiladores | todas | no |
| A3 | Fuentes › las 3 pestañas › franja «Paquete de acreditación» | Sheets | contorno | POST `/sheets/sync` (job) | Relee todas las hojas | Sheets activas | no |
| A4 | misma franja | encuestas | contorno | POST `/sync` `full` | Re-descarga SurveyMonkey y Kobo, trae recopiladores | plataforma | no |
| A5 | misma franja | Todo | **relleno azul marino** | POST `/sync` `full` | **Lo mismo que A-C2** | todas | no |
| A6 | Fuentes › «Conectar fuente» → sideover (+ «Canal base») | … · Conectar | `is-primary` | `/source`, `/sheets/source` | Registra la fuente; marca «pendiente» | una | no |
| A7 | Fuentes › Actores | Guardar elenco | `pulso-primary` | POST `/actores/rename` por renombrado + POST `/actores` | Persiste el elenco; **el renombrado reescribe el actor en todas sus fuentes** | proyecto | no |
| A10–A11 | Fuentes y universo | Conectar base / Cambiar · Guardar declaración | simples | sideover · POST `/source` | Declara actor y canal; marca «pendiente» | una fuente | no |
| A12 | Fuentes › Recopiladores | Confirmar cambios | `pulso-primary` | POST `/collectors/config` | Persiste incluir/excluir, alias, canal; marca «pendiente». Si faltan nombres pide «actualiza las fuentes», que exige un `full` (Avance no los trae) | encuestas SurveyMonkey | no |
| A14–A16 | Modelo › Distribución | select «Variable de interés» (guarda al elegir) · Quitar · Agrupar por año | select / `mon-dist-quitar` / casilla | POST `/config` | Agrega o **borra al instante** una variable y **recalcula el corte (~2 min)** | proyecto | no |
| A18 | Modelo › Distribución (solo con `acreditacion.enabled`) | Registrar avance | simple | POST `/acreditacion/seguimiento` | Escribe a mano n efectivo e intentos | componente | no |
| A19 | ídem › «Cierre metodológico» | Marcar cierre | simple | POST `/cierre` | **Cambia el sello del estudio a `cierre_campo`**; la UI no ofrece deshacerlo | proyecto | **no** |
| A21–A22 | Consultas › Subsanación › caso | Mantener excluida · Incluir con salvedad | `is-keep` / `is-include` | POST `/acreditacion/case-reconciliation` | Cambia el conteo del avance; deja el proyecto sin guardar | un caso | casilla «Confirmo esta asignación» |
| A23 | Avance › Salidas | PDF ejecutivo · PDF de producción · Publicar/Actualizar Sheets · Validar · Descargar soporte | como T18–T22 | ídem | ídem | ídem | ídem |

Configuración que marca «pendiente»: «Guardar meta» por actor, «Guardar plan»
(que en telefónico se llama «Guardar cronograma» y es la misma acción),
«Confirmar estados» (Teléfono › Estados).

### 3.4 Territorial

Secciones: Fuente, UMPs, Validación, Consultas internas, Avance territorial,
Ocurrencias de campo. Con la fase Piloto solo existe Avance.

| # | Dónde | Rótulo | Visual | Endpoint | Qué hace | Alcance | Confirmación |
|---|---|---|---|---|---|---|---|
| R-C1 | Chrome | Avance | claro | POST `/territorial/occurrences/sync` (sin esperar) + POST `/sync` `advance` (job) | Kobo incremental de la fase; sin cursor cae a completa; **re-descarga ocurrencias sin avisar**; recalcula solo `advance_summary` | Kobo de la fase + ocurrencias; **no** la Hoja de ruta | no |
| R-C2 | Chrome | Todo | relleno carmesí | POST `/sync` `full` (job) | Re-descarga **una** fuente Kobo de **una** fase; no la Hoja de ruta, no ocurrencias, no la otra fase | una fuente | no |
| R3 | Cabecera › «Formato territorial» | Piloto / Campo | toggle | POST `/territorial/phase` + GET `/state` | Cambia la fase activa y vacía cachés; no llama a Kobo | proyecto | — |
| R4 | Alert de error | Reintentar | `pulso-button`, `refresh-cw` | GET `/state?force` | Relee el estado; **no trae nada** | scope de la vista | — |
| R5 | Fuente › banda de la consola | Actualizar Campo | `is-primary`, `refresh-cw` | **= R-C2** (`syncField`) | Lo mismo que «Todo» | una fuente | no |
| R6 | Fuente › Formulario › «Formularios por fase» | tarjetas Piloto / Campo | tarjeta | POST `/territorial/config` | Persiste la fase en la config, marca stale; **la UI no cambia de fase** (la página reaplica la suya) | proyecto | — |
| R7 | Fuente › Formulario › «Hoja de ruta operativa» | Conectar / **Actualizar** (title «Actualizar enlace») | sin clase, `save` | POST `/sheets/source` | **Solo guarda el enlace**; no lee filas | una fuente | no |
| R8 | mismo panel | **Sincronizar** | `is-primary`, `refresh-cw` | POST `/sheets/sync` `async` (job) | Trae las filas de la Google Sheet de Hojas de ruta | una fuente | no |
| R9 | Fuente › Formulario › «Formulario campo» | Actualizar ficha | sin clase, `refresh-cw` | POST `/territorial/inspect-kobo` | Relee el esquema del asset (preguntas, distritos, versión); **no trae respuestas** | una fuente | no |
| R11 | Fuente › lista de formularios | lupa (title «Actualizar listado») · Cargar listado | ícono / `refresh-cw` | POST `/kobo/assets` | Relee el catálogo de formularios de la cuenta | cuenta Kobo | — |
| R13 | misma lista › barra inferior | Aplicar a Campo | `is-primary`, `save` | POST `/territorial/source` | Cambia la fuente Kobo de la fase; **si cambia el asset o la versión, poda del snapshot las filas de la fuente anterior** | fase | **no**; el Historial lo rotula «Sincronización» |
| R14 | Fuente › «Inspección y sincronización» | Inspeccionar Kobo | `pulso-button`, `file-check-2` | **= R9** | Idéntico a «Actualizar ficha», en la misma pantalla | — | — |
| R15 | mismo panel | Sincronizar respuestas | `is-primary`, `refresh-cw` | **= R-C2** | Idéntico a «Todo» y «Actualizar Campo» | — | — |
| R23 | Fuente › Encuestadores | Subir Excel / Actualizar Excel | `pulso-button`, `upload` | POST `/territorial/enumerators/upload` | **Reemplaza el padrón** en cuanto se elige el archivo | proyecto | no |
| R22 | mismo panel | Descargar códigos | `is-code-download` (**ámbar**), `download` | POST `/enumerators/codes` | Regenera el xlsx de códigos; inocuo | — | — |
| R25 | Fuente › Reconciliación | Aplicar | `is-primary`, `circle-check` | POST `/territorial/reconciliation/batch` | Persiste reconciliaciones de código y UMP; recalcula | fase | no |
| R27 | UMPs › Cobertura y Manzanas | Sincronizar campo | `is-primary`, `refresh-cw` | POST `/sync` (sin `syncMode`, el backend asume `full`) con **job y sondeo propios** | **Lo mismo que «Todo»**, por otro camino: el chrome no lo ve y se pueden lanzar dos syncs completos a la vez | una fuente | no |
| R28 | UMPs › Variables | Releer la base | `pulso-button`, `refresh-cw` | GET `/territorial/mapeo` | Relee columnas del snapshot local; no trae nada | local | — |
| R30, R34 | Validación › Reconciliación UMP | Descartar (×3, todos con `trash-2`) | sin clase | local · POST `/spatial-reconciliation/dismiss` · `/dismiss-pattern` | Uno vacía la cola local; dos **persisten el descarte** | — | no |
| R32 | diálogo «Confirmar reconciliaciones» | Aplicar cambios | `is-primary`, `save` | POST `/reconciliation/batch` | Persiste reasignaciones espaciales | fase | **sí** (diálogo) |
| R36 | Validación › Anulación | Anular caso / Anular producción | **`is-danger`** (el único rojo de peligro del módulo) | POST `/territorial/annulments/apply` | Excluye del conteo; reversible | caso o responsable | `window.confirm` + motivo |
| R37 | ídem › Historial | Revertir | sin clase, `refresh-cw` | POST `/annulments/revert` | Restaura | una | `window.prompt` |
| R38 | Consultas › Subsanaciones | Reiniciar | píldora neutra, `refresh-cw` | POST `/operational-adjustments/reset` | **Revierte todas** las subsanaciones activas de la fase | fase | `window.confirm`; parece un «refrescar» |
| R39 | ídem | Aplicar selección · Completar UMP con este paquete | `is-primary` | POST `/operational-adjustments/apply` (una llamada por paquete) | Aplica subsanaciones; recalcula | paquetes | no |
| R42 | Ocurrencias › sideover «Fuente y formulario» | Actualizar | `is-primary`, `refresh-cw` | POST `/territorial/occurrences/sync` (**síncrono**) | Re-descarga completa del formulario de ocurrencias | una fuente | no |
| R43–R44 | mismo sideover | XLSForm · Subir Kobo | `pulso-button` | POST `/occurrences/xlsform` · `/occurrences/upload-kobo` | Genera el XLSForm · **crea y despliega un asset nuevo en Kobo en cada clic** | cuenta Kobo | **no** |
| R47 | sideover › picker | Cargar formularios · Usar | `refresh-cw` / fila | POST `/kobo/assets` · `/occurrences/config` | Relee catálogo · persiste el formulario elegido | — | — |

Además: la pista del estado vacío de Ocurrencias dice «Usa **Actualizar
vista**», y ese botón **no existe**. Los mensajes de éxito de la consola
(`setMessage` en unos 15 sitios) **nunca se pintan**. Todos los botones de la
consola comparten un solo `saving`: mientras corre el job de la Hoja de ruta
giran también «Actualizar Campo», «Actualizar ficha», «Inspeccionar Kobo» y
«Sincronizar respuestas». `RouteSheetStrip` «Releer modelo» está sin montar.

### 3.5 Aulas (cursos-horario)

Secciones: Fuentes, Agenda (Agenda · Por facultad · Contacto · Carga),
Validación, Consultas, Avance.

| # | Dónde | Rótulo | Visual | Endpoint | Qué hace | Hacia fuera | Confirmación |
|---|---|---|---|---|---|---|---|
| U-C1 | Chrome | Avance | claro | GET `/state?force` | **No trae nada**: recalcula con lo que hay y navega a la sección Avance | — | — |
| U-C2 | Chrome | **Traer respuestas** | relleno carmesí | POST `/sync` `advance` (job) + POST `/aulas/sync` | (1) trae Kobo; (2) recalcula el corte; (3) **lee el Sheets del operativo y re-publica** las hojas de la app, adoptando asignaciones en `reparto_fijado`; (4) **borra filas** cerradas de las pestañas «Semana N» del Sheets de aplicadores | lee Kobo; **escribe** en el Sheets del operativo; **borra** en el de aplicadores | **no**; si todo sale bien no dice nada; oculta las hojas `encogidas` |
| U2 | Fuentes › «Operación del plan» | Traer respuestas | `is-primary`, `refresh-cw` | **= U-C2** | Idéntico; su tooltip dice «pide las respuestas nuevas y recalcula» | ídem | no |
| U4 | mismo panel | Importar plan | `download` | POST `/aulas/import-from-calc-muestra` | **Reemplaza el plan** entero; no fusiona agenda, reemplazos ni marcas | — | **no** |
| U5 | mismo panel | Generar libro | `file-spreadsheet` | POST `/aulas/generar-libro` | xlsx local | — | — |
| U6 | mismo panel | Leer libro llenado | `upload` | POST `/files/upload` + `/aulas/importar-libro` | Importa y fusiona un xlsx | — | — |
| U7 | mismo panel | Leer del Sheets | `link-2` | POST `/aulas/importar-sheets` | Lee el Sheets del operativo; solo lectura (el propio comentario admite que sobra en el ciclo normal) | lee | — |
| U8 | mismo panel | Publicar al Sheets | `upload-cloud` | POST `/aulas/publicar-libro` | Lee el libro, lee el Sheets de aplicadores, adopta asignaciones y **escribe** las hojas de la app; siembra las del equipo si están vacías y **siempre les pone formato** | **escribe** Sheets del operativo | **no**; muestra `encogidas` |
| U9 | mismo panel (si hay traslape) | Releer cruce con {X} | `refresh-cw` (el mismo ícono que «Traer respuestas») | POST `/aulas/traslape/recalcular` | Lee el otro estudio; cambia la columna TRASLAPE que después escriben U-C2, U8 y U11 | lee otro estudio | — |
| U10 | Agenda › Carga › Disponibilidad | Importar disponibilidad (.xlsx) | `<label>` | POST `/aulas/disponibilidad` | **Reemplaza la oferta** de aplicadores | — | no |
| U11 | Agenda › Carga › Asignación › «Sheets de los aplicadores» | Publicar distribución | contorno pequeño | POST `/aulas/publicar-distribucion` | Escribe el reparto en pestañas «Semana N» **vacías**; respeta las que tienen citas; 409 si todas tienen dueño | **escribe** Sheets de aplicadores | no; **no mira `busy`** |
| U12 | ídem › «Sincronizar con la hoja» | Revisar cambios | ídem | POST `/aulas/sincronizar-distribucion` (ensayo) | Lee la hoja y dice qué haría; recuerda el enlace | lee | — |
| U13 | ídem, tras un ensayo | Aplicar {N filas y M estados} | ídem (**mismo estilo que el «Aplicar» del rango, que es local**) | mismo endpoint, `aplicar:true` | Añade filas, cambia ESTADO, pisa AULA; adopta asignaciones | **escribe** Sheets de aplicadores | el ensayo es la confirmación; **único flujo con ensayo** |
| U14 | Consultas › Refuerzos | Pintar en el Sheets de agendación | `.aulas-pedidos-lote` | POST `/aulas/publicar-marcas` `aplicar:true` | Escribe «REFUERZO POR CONTACTAR» en STATUS MUESTRA de las hojas del equipo; **se salta el ensayo** que el backend ofrece | **escribe** hojas del equipo | no |
| U15–U16 | Avance › Salidas | Publicar/Actualizar Sheets cliente/interno · PDF | como T20, T18 | `/publication/sheets` · `/client-report/pdf` | Escribe pestañas en un **tercer** Sheets | **escribe** Sheets de publicación | casilla en interno |

Sin red, solo sesión: Guardar registro, Activar reemplazo, Elegir {R X},
Buscar relevo (marca un *complemento*, o no hace nada si el titular cayó),
Reforzar con {X}, Marcar los N mejores, Marcar/Tomar/Pedir, Retirar, Guardar
proyecto, Aplicar (rango), Volver a todo el horizonte, Guardar tramos,
Resortear, Concentrar, selector de aplicador por fila, «no sale este
despliegue», Confirmar duración, Cambiar el eje (**la única confirmación en
línea del perfil**), Guardar criterio (×2 con objetos distintos), Guardar la
facultad declarada, Declarar.

Hacia fuera, resumido:

| Acción | Kobo | Sheets del operativo | Sheets de aplicadores | Otro estudio | Sheets de publicación |
|---|---|---|---|---|---|
| Traer respuestas (chrome y panel) | lee | lee y **escribe** | lee y **borra filas** | — | — |
| Publicar al Sheets | — | lee y **escribe** | lee | — | — |
| Leer del Sheets | — | lee | — | — | — |
| Pintar en el Sheets | — | **escribe** una columna | — | — | — |
| Publicar distribución | — | — | **escribe** pestañas vacías | — | — |
| Revisar cambios · Aplicar N filas | — | — | lee · **escribe** | — | — |
| Releer cruce | — | — | — | lee | — |
| Publicar Sheets cliente/interno | — | — | — | — | **escribe** |

---

## 4. Hallazgos cruzados

### 4.1 Mismo efecto, rótulos distintos

| Efecto | Rótulos que lo disparan | Dónde |
|---|---|---|
| Descarga completa de todas las fuentes (`/sync` full) | «Todo» (chrome) · «Todo» (franja, azul marino) | telefónico, acreditación |
| Descarga completa de la fuente Kobo de la fase | «Todo» · «Actualizar Campo» · «Sincronizar respuestas» · «Sincronizar campo» (job aparte) | territorial |
| Pull + recálculo + publicación + borrado | «Traer respuestas» (chrome) · «Traer respuestas» (panel) | aulas |
| Publicar el libro al Sheets del operativo | «Traer respuestas» (en silencio) · «Publicar al Sheets» (explícito) | aulas |
| Adoptar el reparto del Sheets de aplicadores | «Traer respuestas» · «Publicar al Sheets» · «Aplicar N filas» | aulas |
| Releer el esquema del formulario | «Actualizar ficha» · «Inspeccionar Kobo» (misma pantalla) | territorial |
| Releer el catálogo de formularios | lupa «Actualizar listado» · «Cargar listado» | territorial |
| Guardar `strategy_phases` | «Guardar cronograma» · «Guardar plan» | telefónico / acreditación |
| Abrir el sideover de conexión | «Conectar fuente» · «Cambiar conexión» · «Conectar» · «Conectar base» · «Cambiar» | telefónico, acreditación |

### 4.2 Mismo rótulo, efectos distintos

| Rótulo | Significados en el módulo |
|---|---|
| **Avance** | trae Kobo + relee Sheets (tel) · trae plataforma sin Sheets (acr) · trae Kobo + ocurrencias (ter) · **no trae nada** (aulas) · además es el nombre de una sección |
| **Todo** | todas las fuentes (tel, acr) · **una fuente de una fase** (ter) · en aulas se llama «Traer respuestas» |
| **Actualizar** | sincronizar plataformas (title del chrome) · **solo guardar un enlace** (Hoja de ruta) · descarga completa (Actualizar Campo) · descarga síncrona de ocurrencias · publicar hacia fuera («Actualizar Sheets cliente») · «Actualizar vista», que no existe |
| **Sincronizar** | traer una Google Sheet (Hoja de ruta) · traer Kobo completo (Sincronizar respuestas, Sincronizar campo); los dos en la **misma pestaña** |
| **Aplicar** | guardar un rango local · **escribir en el Sheets de 22 personas** (mismo estilo, misma pantalla) · aplicar subsanaciones · cambiar la fuente Kobo con poda |
| **Descartar** | vaciar una cola local · descartar persistente una candidata · descartar persistente un patrón (los tres con `trash-2`) |
| **Elegir {R X}** | activar un reemplazo A · añadir un complemento B · **no hacer nada** si el titular cayó |
| **Confirmar …** | estados · metas · recopiladores · una casilla que no persiste |
| **Pendiente** | `pending_regeneration` del chrome · audiencia aún no publicada · fuente sin conectar |
| `refresh-cw` (ícono) | traer y borrar fuera (Traer respuestas) · solo leer (Releer cruce) · revertir una anulación · reiniciar todas las subsanaciones |

### 4.3 El tono de peligro está al revés

| Acción | Qué rompe | Tono hoy | Confirmación |
|---|---|---|---|
| Traer respuestas (aulas) | borra filas del Sheets de aplicadores; reescribe el libro | **el botón más destacado** (relleno) | no |
| Marcar cierre (acreditación) | sello `cierre_campo`; sin deshacer en la UI | botón simple | no |
| Aplicar a Campo (territorial) | poda del snapshot las filas de la fuente anterior | `is-primary` | no; el Historial lo rotula «Sincronización» |
| Subir Kobo (ocurrencias) | crea y despliega un asset externo en cada clic | `pulso-button` | no |
| Importar plan · Importar disponibilidad · Actualizar Excel | reemplazan plan, oferta y padrón | simples | no |
| Quitar cuota · Quitar variable de interés | borran config al instante y recalculan (~2 min) | ícono solo | no |
| Descartar (persistente) · Reiniciar subsanaciones | ocultan sospechas · revierten toda la fase | `trash-2` · píldora neutra con `refresh-cw` | no · confirm |
| Publicar Sheets cliente | sobrescribe pestañas en el Sheets del cliente, síncrono en Plumber | `mon-outputs-publish-button` | casilla solo en interno |
| Anular caso / producción | excluye del conteo; **reversible** | **el único `is-danger` del módulo** | confirm + motivo |
| Descargar códigos | nada | **ámbar** `is-code-download` | — |

### 4.4 Densidad por pantalla

| Pantalla | Controles que mueven o escriben datos |
|---|---|
| Territorial › Fuente › Formulario | 11: Avance, Todo, toggle de fase, Actualizar Campo, tarjetas Piloto/Campo, Actualizar (enlace), Sincronizar, Actualizar ficha, Inspeccionar Kobo, Sincronizar respuestas. **Tres idénticos, dos idénticos, dos selectores de fase que no hacen lo mismo** |
| Aulas › Fuentes | 9: Avance, Traer respuestas ×2, Importar plan, Generar libro, Leer libro llenado, Leer del Sheets, Publicar al Sheets, Releer cruce; **cinco contra Sheets** |
| Aulas › Agenda › Carga › Asignación | 10 más un selector y un chip por fila |
| Telefónico › Fuentes › Universo y barrido | 9: cinco de sincronización (dos del chrome y tres de la franja), Conectar fuente, dos Cambiar conexión, Confirmar estados |
| Acreditación › Fuentes › Recopiladores | 7 |
| Avance › Salidas (todos) | 7 |

### 4.5 Defectos de mecánica que la unidad arregla de paso

1. Los dos botones del chrome giran a la vez (falta `active`; `syncing` incluye `loading`).
2. El resultado del sync del chrome no se ve (`actionStatus` sin consumidor); los mensajes de la consola territorial tampoco (`message` sin consumidor).
3. La franja y el chrome no se bloquean entre sí; «Sincronizar campo» tiene job propio: `job_submit` no deduplica y se pueden lanzar dos `monitoreo.sync` a la vez.
4. `pending_regeneration` se enciende hasta por renombrar una fuente y solo se apaga trayendo datos de la plataforma: no existe «Recalcular».
5. «Objetivo total» hace un POST `/config` por tecla (el defecto que `MetaCuotaInput` ya corrigió al lado).
6. Las tarjetas de fase de la consola territorial no cambian la fase de la UI; «Actualizar Piloto», «Aplicar a Piloto» y «Sincronizar piloto» son inalcanzables.
7. «Publicar distribución» y «Revisar/Aplicar» no miran `busy`: se pueden disparar mientras «Traer respuestas» borra en el mismo Sheets.
8. «Traer respuestas» depende de `selection_run_id`; un plan que entró por el libro no puede traer respuestas y el tooltip le pide «importa el plan» aunque ya hay plan.
9. Textos que citan botones que ya no existen: «Recargar» (×4 en Asignación), «Actualizar vista» (Ocurrencias).
10. Código muerto con rótulos de actualización en las páginas de 20k y 18k líneas: `AcreditacionChannelSelectorMatrix`, `AcreditacionSourcePackageConsole`, `AcreditacionActiveSourcesView`, «Registrar avance»/«Marcar cierre» en telefónico, «Buscar»/«Actualizar» de SurveyMonkey.
11. El perfil no usa `PulsoButton` ni `pulso-button--*`: la jerarquía «primario» se escribe de cuatro formas (`is-primary is-full`, `pulso-button is-primary`, `pulso-primary`, `mon-outputs-primary`).

---

## 5. El modelo: un verbo por dirección

La data de Monitoreo se mueve en tres direcciones. Cada dirección tiene **un
verbo, un lugar y un aspecto**, iguales en los cuatro perfiles.

### 5.1 El diccionario (siete verbos)

| Verbo | Dirección | Qué promete | Dónde vive | Aspecto | Guardas |
|---|---|---|---|---|---|
| **Actualizar** | hacia adentro | trae lo nuevo de todas las fuentes que mueven el avance y recalcula; **nunca escribe fuera** | el único control del chrome | primario del módulo (retinta como en todos los módulos), `refresh-cw`, progreso sobre el botón | ninguna; un sync a la vez (deduplicado) |
| **Traer todo de nuevo** | hacia adentro | re-descarga completa; trae nombres de recopiladores | menú de Actualizar y fila de cada fuente | ítem de menú con el costo («vuelve a bajar 1.693 respuestas») | ninguna |
| **Recalcular** | sin moverse | reconstruye el tablero con lo que hay; apaga «pendiente» | menú de Actualizar; la píldora de estado lo ofrece cuando está pendiente | ítem de menú | ninguna |
| **Conectar** / **Cambiar conexión** | configuración | registra o edita una fuente; **no mueve datos**; deja el tablero pendiente | fila de la fuente, un solo sideover | secundario, `plug` | el botón final dice «Conectar» o «Guardar cambios», según el caso |
| **Leer** | hacia adentro, de un archivo u hoja | importa en sesión y fusiona; no escribe fuera | panel de la sección | secundario, `file-input` | ninguna; «Reemplaza …» se declara en el rótulo y pide confirmación |
| **Publicar** | hacia afuera | escribe en un Sheets o en Kobo | panel de la sección, **nunca en el chrome** | secundario con chip del destino, `upload-cloud` | **siempre Revisar → Aplicar**: el ensayo enseña hojas, filas añadidas, cambiadas y **borradas**, y hojas que encogen; borrar exige diálogo con la cifra |
| **Generar** | hacia un archivo | produce PDF, Excel, plantilla, ZIP | panel de la sección | secundario, `download` | ninguna |

Y el tono de peligro, `pulso-button--danger`, queda **solo** para lo que
borra o no se deshace: Anular, Marcar cierre, Retirar filas, Quitar cuota o
variable, Aplicar a Campo cuando poda, Reiniciar subsanaciones. Lo pequeño y
reversible (Quitar cuota) va con toast «Deshacer» en vez de diálogo; lo grande
(Marcar cierre, Retirar 14 filas) con diálogo que nombra la cifra y el
destino. Para que ese rojo signifique algo, `--danger` tiene que distinguirse
del carmesí de Monitoreo a simple vista: hoy no lo hace (D13).

### 5.2 El control de actualización (chrome)

Un solo control, el mismo en los cuatro perfiles, en el sitio donde hoy están
«Avance» y «Todo»:

```
[ ⟳ Actualizar ▾ ]  ● Al día · 07:24
```

- **Click en el cuerpo**: Actualizar (incremental de todas las fuentes que
  mueven el avance + recalcular). El progreso se pinta sobre el botón como
  hoy; al terminar, toast con el recibo: «3 fuentes · 41 respuestas nuevas ·
  tablero regenerado 07:31».
- **Click en el caret** abre un popover que nace del botón:
  - una fila por fuente: nombre, plataforma, último corte, registros, y dos
    acciones por fila, «Traer nuevas» y «Traer todo de nuevo»; en Kobo
    territorial, «Releer ficha»;
  - «Traer todo de nuevo» para todas, con el costo declarado;
  - «Recalcular el tablero», habilitado cuando hay cambios pendientes, con
    el motivo («desde que cambiaste el filtro de efectiva»);
  - pie con «Conectar otra fuente», que abre el sideover.
- **La píldora de estado** reemplaza a «Estado · Regenerado · Sincronizado»
  con una sola lectura: *Al día*, *Pendiente de recalcular* (clic =
  recalcular), *Parcial*, *Falló* (clic = ver el error). «Registros» se
  queda en el contexto.
- **Lo que deja de existir en el chrome**: «Avance», «Todo», «Traer
  respuestas» y cualquier acción que escriba hacia fuera.
- **Por teclado** el control no anima (M3).

### 5.3 Publicar, siempre con ensayo

Todo lo que escribe hacia fuera sigue un solo patrón, que ya existe en Aulas
› Asignación («Revisar cambios» → «Aplicar N filas y M estados») y es el
correcto:

1. Botón **Publicar …** con chip del destino («Sheets del operativo · 4
   hojas de la app»).
2. Diálogo de **ensayo**: tabla hoja por hoja con filas añadidas, cambiadas,
   borradas, y hojas que encogen respecto de lo publicado; lo que no se toca
   se dice.
3. **Aplicar** en primario; si el ensayo incluye borrados, el botón es
   `--danger` y nombra la cifra («Aplicar y retirar 14 filas»).
4. Recibo como toast y entrada en el Historial con el verbo correcto.

### 5.4 Lo que cambia perfil por perfil

| Perfil | Hoy | Después |
|---|---|---|
| **Los cuatro** | «Avance» + «Todo» con tono de módulo | `Actualizar ▾` + píldora de estado; un sync a la vez; recibo visible |
| Telefónico | franja «Sheets · Kobo · Todo» en tres pestañas, más el chrome | la franja desaparece; cada fuente es una fila en Fuentes con «Traer nuevas» y «Traer todo de nuevo»; el chrome incluye las hojas (como hoy «Avance») |
| Acreditación | ídem con «encuestas» | ídem; «Confirmar cambios» de recopiladores ofrece «Traer todo de nuevo» en línea cuando faltan nombres |
| Territorial | «Todo» = una fuente; «Actualizar Campo», «Sincronizar respuestas», «Sincronizar campo», «Inspeccionar Kobo» duplicados; «Actualizar» = guardar enlace | Actualizar incluye Kobo de la fase, Hoja de ruta y ocurrencias; la consola queda con una fila por fuente (Kobo campo: Traer · Releer ficha · Cambiar formulario; Hoja de ruta: Conectar · Traer; Ocurrencias: Traer); «Aplicar a Campo» con poda pasa a `--danger` con la cifra; las tarjetas de fase de la consola se retiran (la fase se cambia arriba) |
| Aulas | «Avance» recalcula; «Traer respuestas» trae, publica y borra | Actualizar = Kobo + leer el Sheets del operativo + recalcular, **sin escribir**; «Publicar al Sheets» con ensayo que incluye las hojas que encogen y las filas a retirar; «Pintar en el Sheets» usa el ensayo que el backend ya ofrece; «Importar plan» e «Importar disponibilidad» confirman el reemplazo; el «Aplicar» del rango pasa a «Aplicar rango» con estilo local |

### 5.5 Reglas de contrato (vitest)

- En `features/monitoreo/**` no hay más de **un** disparador de `/sync` por
  perfil fuera del control del chrome y de las filas de fuente.
- Ningún botón del chrome llama a un endpoint que escriba fuera
  (`/publicar-*`, `/publication/*`, `/upload-kobo`, `/sincronizar-distribucion`).
- Todo endpoint que escribe fuera se llama primero con `aplicar:false` (o su
  equivalente de preflight) desde la UI.
- Los rótulos de acción pertenecen al diccionario de siete verbos; «Avance»,
  «Todo», «Sincronizar» y «Actualizar X» (con X ≠ nada) fallan el contrato.
- `pulso-button--danger` aparece solo en la lista cerrada de §5.1; y cada
  acción de esa lista lo lleva.

---

## 6. Espera al dueño

| # | Decisión | Recomendación |
|---|---|---|
| D9 | ¿Actualizar en aulas sigue publicando el libro y retirando filas en el mismo clic (el ciclo «conversar» de hoy)? | **No.** Actualizar lee; Publicar escribe con ensayo. Si el ciclo de un clic hace falta en campo, va como ítem explícito del menú «Actualizar y publicar», con el ensayo igual |
| D10 | ¿«Marcar cierre» debe poder deshacerse desde la UI? | Sí: «Reabrir campo» con motivo, en el mismo panel; mientras no exista, el diálogo de cierre dice que no se deshace |
| D11 | ¿«Actualizar» en territorial incluye la Hoja de ruta por defecto? | Sí; el menú permite excluirla por fuente |
| D12 | ¿Se retiran las tarjetas de fase de la consola territorial? | Sí; hoy no cambian la fase de la UI y duplican el toggle de la cabecera |
| D13 | El tono carmesí de Monitoreo choca con el color de peligro: ¿se mueve el tono del módulo o se cambia la pieza `--danger` (por ejemplo, contorno rojo con relleno sólo al confirmar, o un rojo más anaranjado)? | Cambiar la pieza `--danger`, no el tono: el tono es identidad de todo el módulo; la maqueta L38 enseña los dos lado a lado para decidir |

---

## 7. Verificación de la unidad

- Contrato de §5.5 en verde.
- Las cuatro pantallas de §4.4 bajan a: chrome (1 control) + una fila por
  fuente + las acciones de Publicar/Leer/Generar de la sección; captura con
  `make ui-quick-check` sobre `acnur_pdm` (telefónico), `acrconta`
  (acreditación), `acnur_acg` (territorial) y la copia de `ccss2026_campo`
  (aulas), con `--timeout-ms 420000`.
- Un sync lanzado desde una fila de fuente deshabilita el control del chrome
  y viceversa (prueba de render).
- Ensayo antes de escribir: testthat para `/aulas/publicar-libro` con
  `aplicar:false` devuelve hojas, filas y encogidas sin tocar el Sheets
  (sin red, con el cliente de Sheets simulado).
- Reduced motion y teclado: el popover no anima por teclado (M3).
