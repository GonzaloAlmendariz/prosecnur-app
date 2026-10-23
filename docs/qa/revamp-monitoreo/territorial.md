# Revamp de Monitoreo · Territorial

Tipo: Especificación de maqueta (estándar de ficha v2, §5)
Estado: Propuesta para revisión de Gonzalo
Fecha: 2026-10-22
Lienzo: https://claude.ai/artifact/3XUDDUWpFbUwsuzdiYaDXQ («Revamp de Monitoreo · Territorial», 32 tableros)
Proyecto de datos: copia de trabajo de `ACNURCG` (ACNUR Comunidad de Acogida, territorial por UMP/manzana, Kobo), corte
guardado el 9/07/26 07:24. Cifras recalculadas sin red con `.monitoreo_dashboard_for_session()` del motor sobre la copia
(36 s). Cartografía real: manzanas y zonas INEI 2017, distritos PlanMet 2040 y vías OSM empaquetadas en
`api/inst/hojas_ruta/cartografia/` (las 300 manzanas de la ruta casan con `IDMANZANA`).

Este documento reemplaza entero el intento anterior. Nombres de personas, DNI y coordenadas GPS de hogares no aparecen:
se usan códigos PXXX, conteos, manzanas y prefijos de 8 caracteres del `_uuid`.

---

## Preguntas para Gonzalo

Lo que depende de estas respuestas quedó sin dibujar o como «Por definir»; nada se inventó. Ya respondido en
`procedimientos-respondidos.md` y aplicado: el modo aterriza en el faltante por UMP (Avance › Faltante por UMP); la
subsanación la decide el coordinador en la app, aplicando o rechazando la sugerencia del motor con decisión auditada;
en territorial ACNUR el parte de ocurrencias por UMP es parte del protocolo y sigue siendo condicional para otros clientes.

| # | Pregunta | Opciones | Qué haría según la respuesta |
|---|---|---|---|
| 1 | Al aplicar o rechazar una subsanación, ¿la nota de la decisión es obligatoria? | (a) Obligatoria. (b) Opcional. | (a) «Aplicar» y «Rechazar» se habilitan solo con nota. (b) Queda como está: la nota es opcional y el historial guarda autor y fecha. Hoy la maqueta la deja opcional, con «Queda en el historial con autor y fecha». |
| 2 | ¿El faltante por UMP debe mostrar las 17 celdas de manzanas que la UMP ya no usa? | (a) Solo como cifra, como hoy en la maqueta. (b) No mostrarlas en la llegada; solo en Subsanaciones. (c) Listarlas también en la llegada. | (a) Se mantiene. (b) Se quita la frase de la llegada. (c) Se agrega una lista plegada bajo las dos UMP pendientes. |
| 3 | `count_review_in_official_progress` no lo lee el motor y las 255 en observación cuentan. | (a) Retirarlo. (b) Conectarlo. | (a) No se dibuja. (b) Switch en Insumos › Mapeo y filtro, y Avance muestra las dos lecturas al cambiarlo. |
| 4 | El padrón guarda DNI en el `.pulso`. | (a) Dejar de guardarlo. (b) Guardarlo cifrado. (c) Seguir igual. | (a) Padrón sin columna de DNI. (b) Igual en pantalla, con un aviso de cifrado. (c) Solo se oculta en pantalla. |
| 5 | Base de cuotas: el motor de cuotas suma 1,296 y el avance cuenta 1,283. | (a) Manda el avance. (b) Manda el motor de cuotas. | (a) Se alinea el motor de cuotas y desaparece el rótulo de base distinta. (b) Se rotulan las dos bases en Avance. |
| 6 | Cuota por UMP: Hojas de ruta reparte 1 por celda sexo × edad; el progreso usa 2/3/2/1 por edad. | (a) Celdas cruzadas de Hojas de ruta. (b) Marginales 2/3/2/1. | (a) Modelo › Cuotas y Faltante por UMP pasan a celdas cruzadas. (b) Se quita el aviso de contradicción. |
| 7 | «No cuadra» en Reportes UMP: ¿contra recibidas o contra las que cuentan? | (a) Recibidas. (b) Las que cuentan. | (a) Se mantienen las 66. (b) Se recalcula y cambia la cifra. |
| 8 | ¿El motor debe publicar por qué una celda está bloqueada? | (a) Sí. (b) No. | (a) Chip con el motivo en Subsanaciones. (b) Solo «bloqueada». |
| 9 | ¿El control de GPS mide contra la manzana asignada o contra la más próxima de la ruta? | (a) Asignada. (b) Más próxima, como hoy. | (a) El caso 1 de la UMP 107 pasa a «GPS fuera» también en el motor. (b) La exploración de UMP muestra la distancia a la asignada como dato aparte. |
| 10 | ¿El piloto se ve en Insumos › Conexiones cuando la fase activa es Campo? | (a) Atenuado, como hoy. (b) Solo en el selector de fase. | (a) Se mantiene. (b) Se retira la fila del piloto. |
| 11 | Rojo de peligro distinto del carmesí del módulo (D13). | (a) `#b42318`, como la maqueta. (b) Carmesí. | (a) Se mantiene. (b) Se cambia en Anular, Rechazar y Cambiar formulario. |

## 0. Gramática común a los cuatro modos (estándar §2b)

Vale para todos los tableros y no se repite en cada pestaña.

| Pieza | Regla |
|---|---|
| Barra del modo | `MODO`, selector `FASE ▾`, píldoras Insumos, Modelo, Control y Avance con insignia (Control 265 en bandeja, Avance 107 %) · `CORTE dd/mm/aa hh:mm` y una píldora de estado que dice solo «Al día», «Actualizando, paso N de M», «Falló» o «Preparando»; la fecha vive en CORTE · `Actualizar ▾`. Siempre en ese orden y lugar. |
| Rail | A la izquierda, ocupa todo el alto del área de trabajo; íconos de pestaña arriba, con divisor entre grupos de Control y al pie el sello `CORTE 09/07 07:24` (siempre ahí; `—` sin fuente). |
| Cabecera de pestaña | Una línea: ícono 36 px, sobrelínea con la sección, título 18 px; a la derecha filtros (segmentado), buscador y el sello del corte. Nada de bandas debajo (cierra L14, L18, 15g). |
| Contenedores | `panel` blanco, borde `#e2e7f0`, radio 18 px. Inspector a la derecha (340–380 px), nunca flotante. Tablas densas con números alineados a la derecha y barras en celda. |
| Cifra con base | Toda cifra lleva su base en el mismo bloque: «1,283 / 1,200», «base: partes de ocurrencias · 138 UMP», «base: 1,693 recibidas». Una sola lectura de avance en todo el modo (L20, 15b). |
| Verbos | Un verbo por dirección (L38): Actualizar, Traer nuevas, Traer todo de nuevo, Releer ficha, Recalcular, Conectar, Publicar, Generar. Lo que escribe afuera (Publicar) nunca va en el chrome. Rojo de peligro (`#b42318`, distinto del carmesí del módulo, D13) sólo para Anular, Revertir, Cambiar formulario. |
| Booleanos | Switch; encendido en azul marino `#002457`. |
| Notas | Los marcadores numerados se retiraron del lienzo para que nada choque (§2a); las notas de cada pestaña viven aquí. |

---

## 1. Arquitectura

Esqueleto común de Monitoreo (estándar §1): **Insumos · Modelo · Control · Avance**, en ese orden. Primero de dónde sale
cada dato, después qué hay que lograr, luego lo que se revisa y corrige, y al final cómo vamos.

| Sección | Pregunta del equipo | Pestaña | Pregunta de la pestaña | Absorbe de hoy | Por qué aquí |
|---|---|---|---|---|---|
| **Insumos** | ¿De dónde sale cada dato y con qué reglas se lee? | Conexiones | ¿Qué fuentes alimentan el modo y están al día? | Fuente › Formulario | Una fila por fuente con sus verbos; retira los 11 controles duplicados del censo L38. |
| | | Mapeo y filtro | ¿Qué columna es cada cosa y qué cuenta como efectiva? | Fuente › Filtro y distritos, UMPs › Variables | Variables, filtro, umbrales y distritos son la misma configuración de lectura. |
| | | Padrón | ¿Quiénes son los actores declarados? | Fuente › Encuestadores | El padrón es un insumo; su conciliación es Control. |
| | | Historial | ¿Qué se leyó y cuándo cambió la cifra? | Fuente › Historial | Rastro de las lecturas de cada insumo. |
| **Modelo** | ¿Qué hay que lograr y con qué cuotas? | Metas y muestra | ¿Cuánto, dónde y en qué fase? | UMPs › Manzanas (definición), Avance › Distritos (meta), banda Piloto/Campo (fase) | Meta 200 por distrito, 150 UMP titulares y 150 reemplazos, fases Campo y Piloto: hoy repartidos en tres pestañas y una banda. |
| | | Cuotas | ¿Qué cuota declara el proyecto y por qué variable? | Validación › Cuotas (definición) | Variables sexo y edad, plantilla por UMP, cuota por distrito y frente a la población; la lectura del logro queda en Avance › Cuotas. |
| **Control** | ¿Qué hay que revisar, qué no cruza y qué se corrigió? | Bandeja · grupo Calidad | ¿Qué reviso hoy y qué decido? | Consultas › Registro, GPS con señal, Tiempo corto/muy corto | Las cinco consultas eran la misma tabla con filtro; una cola con filtros. |
| | | Señales · Calidad | ¿La calidad es pareja entre distritos? | Validación › Geolocalización, Duración de tiempo | Distribuciones y matriz distrito × señal. |
| | | Equipo · Calidad | ¿Quién produce cuánto y con qué señales? | Consultas › Cruce responsable | Producción y calidad por código. |
| | | Ocurrencias · grupo Ocurrencias ◇ | ¿Por qué no se logra la entrevista? | Ocurrencias › Resumen, Distritos, Ritmo | Es la operación propia del modo territorial; condicional. |
| | | Reportes UMP · Ocurrencias ◇ | ¿Qué UMP no reporta y cuál no cuadra con Kobo? | Ocurrencias › Reporte UMP, UMP, Alertas | Un cruce que no cruza, en una retícula de 150. |
| | | Subsanaciones · grupo Correcciones | ¿Qué celda falta y de dónde se cubre? | Consultas › Subsanaciones | Corrección auditada. |
| | | Anulaciones · Correcciones | ¿Qué salió del conteo y quién lo decidió? | Validación › Anulación | Corrección auditada. |
| | | Conciliación · Correcciones | ¿Qué códigos y UMP escritos a mano se corrigieron? | Fuente › Reconciliación, Validación › Reconciliación UMP | Cruces de identificadores. |
| **Avance** | ¿Cómo vamos y se cumplen metas y cuotas? | Resumen | ¿Cuánto cuenta, con qué base y a qué ritmo? | Avance › Resumen, Ritmo diario, Distritos (lectura) | Embudo del corte, curva y distritos. |
| | | Mapa | ¿Dónde está el campo y qué manzana falta? | Avance › Mapa y UMP, UMPs › Cobertura | Mapa real; la ficha va al costado. |
| | | UMP | ¿Qué UMP están completas y por qué no las otras? | UMPs › Manzanas (estado), Ocurrencias › UMP | Tabla maestra de 150 con inspector. |
| | | Faltante por UMP, pantalla de llegada | ¿Qué celdas faltan, en qué UMP y quién las cubre? | Validación › Cuotas (lectura), consistencia de cuotas por manzana | Respuesta de Gonzalo: el equipo ve primero las cuotas faltantes por UMP. Va primera en el rail de Avance. |
| | | Salidas | ¿Qué entrego y a quién? | Avance › Salidas | Libro de salidas con su estado. |

Resultado: 6 secciones y 29 pestañas → 4 secciones y 19 pestañas. Control agrupa sus ocho pestañas en tres grupos con
divisor en el rail (Calidad · Ocurrencias ◇ · Correcciones) y la sobrelínea de la cabecera dice «Control · Calidad»,
etc. No hace falta una quinta sección. Retiros del chrome: banda «Formato territorial Piloto/Campo» (pasa a `FASE ▾`,
definida en Modelo › Metas y muestra), tarjetas de fase de la consola (D12), «Avance»/«Todo»/«Actualizar Campo»/
«Sincronizar respuestas»/«Sincronizar campo» (pasan a `Actualizar ▾`), cabecera de cinco líneas y breadcrumb.

Slugs: `insumos/{conexiones,mapeo,padron,historial}`, `modelo/{metas,cuotas}`,
`control/{bandeja,senales,equipo,ocurrencias,reportes,subsanaciones,anulaciones,conciliacion}`,
`avance/{faltante,resumen,mapa,umps,salidas}` (el modo aterriza en `avance/faltante`; `avance/cuotas` es alias). Alias de lectura (nunca se escriben): `fuentes/*→insumos/*` (`form→conexiones`,
`filter→mapeo`, `roster→padron`, `history→historial`), `fuentes/reconciliation→control/conciliacion`,
`modelo/variables→insumos/mapeo`, `modelo/resumen→avance/mapa`, `modelo/tabla→avance/umps`,
`calidad/geolocalizacion|duracion→control/senales`, `calidad/reconciliacion→control/conciliacion`,
`calidad/cuotas→avance/cuotas`, `calidad/anulacion→control/anulaciones`, `consultas/registro|gps|duracion→control/bandeja`
(con `?foco=`), `consultas/responsable→control/equipo`, `consultas/subsanaciones→control/subsanaciones`,
`avance/distritos|ritmo→avance/resumen`, `avance/ump→avance/mapa`, `ocurrencias/states|distritos|rhythm→control/ocurrencias`,
`ocurrencias/registro|ump|alerts→control/reportes`. Ojo: el slug `modelo` hoy significa «UMPs»; pasa a ser la sección Modelo
y sus pestañas viejas se redirigen como arriba.

Readiness: una marca por pestaña, `monitoreo-territorial-<seccion>-<pestana>`, que se publica en `true` sólo cuando la
pestaña pintó su contenido o su vacío clasificado (cierra hallazgo 2 y 15f).

---

## 1b. Paridad con lo que Territorial ya hace (estándar §0)

Inventario leído del código de `profiles/territorial/` y de las capturas de hoy. Ninguna capacidad se pierde; donde dice «mejora» es lo que el revamp agrega.

| Capacidad de hoy | Dónde vive hoy | Dónde queda | Qué mejora |
|---|---|---|---|
| Cuota por manzana con llenado observado por sexo y edad, falta real, «aporta a» y «resta de» | `TerritorialQuotaConsistencyPanel.tsx` (Validación › Cuotas) | Avance › Faltante por UMP, tabla «Cuota de cada UMP» | Una fila por UMP con las seis celdas como «logrado de cuota», el signo de lo recibido o cedido por subsanación, la falta y quién la cubre; filtros Con celda pendiente, Subsanadas, Todas y switch de reemplazos |
| Filtros por estado de cuota, buscador y reemplazos visibles u ocultos | mismo panel | Avance › Cuotas y Avance › UMP | Mismos filtros con conteos en el segmentado |
| Celda faltante, UMP, responsable del faltante y del sobrante | `TerritorialOperationalAdjustmentsWorkspace.tsx` | Control › Subsanaciones | Déficit separado en «manzana en uso» (2) y «manzanas que la UMP ya no usa» (17), con manzana y aplicador |
| Paquete sugerido con movimientos, cercanía y «cierra la UMP» | mismo | Control › Subsanaciones | Origen y destino lado a lado, mapa real del movimiento sobre las manzanas |
| Contabilidad del paquete, reglas de seguridad (sexo, rango y distrito; sin duplicar respuestas; excedentes reales; origen ok) y evidencia con ID fuente | mismo | Control › Subsanaciones | Tabla «de 11 a 10» y «de 8 a 9» por celda, reglas como chips, caso fuente con hora y aplicador, nota de la decisión |
| Historial de subsanaciones con filtro y revertir con confirmación | mismo | Control › Subsanaciones | Activas por distrito y línea de historial; «Revertir activas…» con confirmación |
| Subsanación sugerida en la ficha de la UMP | Avance › Mapa y UMP | Avance › UMP y Avance › Mapa, ficha | Celda que falta con «+1 subsanado», origen y distancia, y ficha operativa (hoja, viviendas, esquina, reemplazo) |
| Estado general del campo, anillo, corte operativo, distribución por sexo y edad | `TerritorialAdvanceWorkbench.tsx` | Avance › Resumen y Avance › Cuotas | Una sola lectura con su base y embudo del corte |
| Mapa de UMP con capas, búsqueda, detalle de manzana y GPS dentro o fuera de zona | Avance › Mapa y UMP | Avance › Mapa (capas Avance, Zonas, Puntos GPS, Ocurrencias) y la exploración de una UMP | Cartografía real y la ficha al costado; la exploración de UMP agrega puntos GPS, hora y recorrido |
| Atlas de cobertura con zonas con cierre de avance y leyenda por distrito | `TerritorialRouteCoverageAtlas.tsx` | Avance › Mapa (capa Zonas) y Modelo › Metas y muestra | Manzanas titulares y reemplazos en Modelo |
| Ficha técnica de UMP, ruta titular y reemplazos, cuotas requeridas | `TerritorialModelWorkbench.tsx` | Modelo › Metas y muestra y ficha de UMP | Plantilla de cuota y cuota frente a la población en Modelo › Cuotas |
| Cobertura de reportes de ocurrencia, completas sin reporte, esperada en ruta, Excel de UMP, copiar enlace del formulario | `TerritorialFieldOccurrencesWorkbench.tsx` | Control › Reportes UMP e Insumos › Conexiones | Retícula de 150 UMP, filtros Sin parte, No cuadra, Dos partes y Completas sin parte (8), botón «Excel de UMP» |
| Estados efectivos y no efectivos por distrito y ritmo | mismo | Control › Ocurrencias | Barra de composición, mapa de calor por distrito y efectividad por UMP |
| Mapa de geolocalización con GPS de inicio y de fondo, manzana vecina, cola de reconciliación espacial e impacto en cuotas | `TerritorialValidationGeoWorkbench.tsx` | Control › Señales, Control › Conciliación y la exploración de UMP | Distancias en histograma y matriz; los puntos reales se ven por UMP. Falta dibujar el impacto preliminar en cuotas de la cola espacial, que hoy está vacía (0 candidatas) |
| Tabla de registros por validar con filtros GPS y tiempo, búsqueda por UUID | `TerritorialReviewCasesWorkbench.tsx` | Control › Bandeja | Una cola con decisiones y lote; filtro combinado «Corta y con GPS observado» (11) |
| Duración por encuestador, ritmo diario por estado de duración, «Corta + GPS» | `TerritorialDurationControl.tsx` | Control › Señales, Control › Equipo y Control › Bandeja | Histograma con cortes 2 y 5 min y columna por aplicador. El ritmo diario por estado de duración queda por dibujar en Señales |
| Anular producción o caso por UUID, previsualizar impacto, motivo obligatorio, historial y revertir | `TerritorialProductionAnnulmentWorkspace.tsx` | Control › Anulaciones, Control › Equipo y P2 | Impacto con cifra y base antes de anular |
| Consola de fuentes, formularios por fase, filtro de efectivas, encuestadores, conciliación por lote, Hoja de ruta | `TerritorialSourceConsole.tsx` | Insumos › Conexiones, Mapeo y filtro, Padrón; Control › Conciliación | Un verbo por dirección; «Cargar lote» y «Aplicar» en Conciliación |
| Salidas PDF y Sheets | `TerritorialOutputsPanel.tsx` | Avance › Salidas | Libro de salidas con destino, estado y última publicación |

## 2. Las cifras del corte y su origen (vale para todas las pestañas)

| Cifra | Valor | Origen | Base |
|---|---|---|---|
| Recibidas · Campo | 1,693 | filas de la fuente `kobo_at5qpj937nmuro9azgbxaa` tras `.monitoreo_territorial_filter_data_for_phase(field)` | snapshot 9/07 07:24 (1,697 en Kobo; 4 fuera de fase) |
| Anuladas | 342 | `territorial_reports$production_annulments$summary$annulled_responses` (P702 311 + P446 31) | recibidas |
| En el corte | 1,351 | `nrow(response_audit)` | recibidas − anuladas |
| No cuentan | 68 | `advance$no_validas` (66 sin consentimiento, 2 UMP sin cruce, de `issues`) | en el corte |
| Cuentan para la meta | 1,283 | `advance$validas` | en el corte |
| de ellas en observación | 255 | `advance$observacion` (`validation_status == "revision"`) | cuentan |
| sin observación | 1,028 | `kpis$validas` | cuentan |
| Meta | 1,200 | `advance$meta` (Hojas de ruta · muestra Campo, 150 UMP × 8) | — |
| Avance | 106.9 % → «107 %» | `advance$avance_pct` | 1,283 / 1,200 |
| Pasan filtro de consentimiento | 1,404 de 1,693 | `source_validity` | recibidas (sólo en Insumos › Mapeo y filtro) |

Las otras cuatro lecturas de hoy (85.7 % del Home con `kpis$validas`, S/D, 116 % con «pasan filtro», 141 % con
«recibidas») desaparecen: la insignia, el Home y la cabecera leen `advance$validas / advance$meta` (L20).

---

## 2a. Composición medida

Script reutilizable: `scripts/medir.js` (se inyecta en la vista previa) con `scripts/medir.sh` y `scripts/medir_tabla.py`, en la carpeta de trabajo del lienzo. Mide con `getBoundingClientRect` en Chrome sin interfaz a 1440 × 1000: (a) vacío al pie del área de trabajo ≤ 24 px; (b) choques entre textos, marcadores y paneles; (c) huecos y rellenos de paneles en la escala 4/8/12/16/24/32; (d) columnas vecinas que terminan a la misma altura; (e) texto que sale de su contenedor; (f) vacío interno de cada panel ≤ 24 px salvo scroll propio; (g) texto con elipsis; (h) simetría de rótulo, cifra y barra entre hermanos. Por qué no se vieron antes las filas cortadas a media línea en la UMP 107 y en Faltante por UMP: (e) eximía a propósito el desborde vertical dentro de una lista con scroll y (g) solo mide elipsis horizontal. Se agregó (e2): toda lista cuyo contenido no cabe debe llevar una barra de scroll visible (clase `con-sbar`), y una lista que cabe no puede llevarla. Resultado final: los 31 tableros de pantalla pasan todos los criterios (pie de 16 px en todos); el de Arquitectura no tiene chrome.

---

## 3. Pestañas

### 3.1 Insumos › Conexiones

**Dirección**: `/monitoreo?modo=territorial&seccion=insumos&pestana=conexiones` · readiness `monitoreo-territorial-insumos-conexiones`
**Tablero**: «1 · Insumos › Conexiones» (variantes «E2 · Sin fuente», «E3 · Actualizar falló», «P3 · Cambiar formulario»).
**Reemplaza**: Fuente › Formulario. Cierra L38 (territorial), D11, D12, censo de acciones R-C1, R-C2, R6, R9, R13, R27, R42.
**Composición**:
1. Columna principal (flex 1): una tarjeta por fuente, 16 px de radio, rejilla `44px | 1fr | auto`.
   - Kobo · Campo (resaltada, fase activa): estado, nombre del formulario, KPIs (Respuestas 1,697 · Preguntas 79 · Opciones 61 · Ficha leída 18/06 15:53 · Fase desde 12/06 05:00), gráfico «Respuestas en cada lectura» (26 lecturas, 216 → 1,697, 660 × 120). Botones en columna: Traer nuevas · Traer todo de nuevo · Releer ficha · Cambiar formulario… (peligro).
   - Kobo · Ocurrencias (condicional): Partes 158 · UMP citadas 139 · Última lectura 9/07 07:23. Traer nuevas · Traer todo de nuevo.
   - Kobo · Piloto: Respuestas 35 · Última lectura 25/06 18:01 · Ficha 12/06 18:50. Estado «Fase no activa».
   - Hoja de ruta operativa · Sheets (condicional, no conectada): tarjeta punteada con Conectar.
2. Lateral 330 px «Desde Hojas de ruta · Muestra de campo»: Meta 1,200 · Distritos 6 · UMP titulares 150 · Reemplazos 150; ventanas de fase; botón Abrir Hojas de ruta.
**Notas**: 1 botones por fuente (un verbo por dirección); 2 la fuente de ocurrencias es módulo condicional; 3 la muestra se lee, no se edita aquí.
**Datos**: `state$monitoreo_sources`, `monitoreo_config$territorial$phase_sources`, `phase_windows`, `source_coherence` (79/61, `deployment_active`), `monitoreo_territorial_update_history` (lecturas), `occurrences_history`, `route_overview`.
**Estados**: vacío «Sin formulario de campo · Kobo · fase Campo» con [Conectar Kobo] (tablero E2, que además atenúa Avance, Calidad y Correcciones, deshabilita Actualizar y muestra `CORTE —`); error «E_KOBO_API_FAILED · Kobo no respondió. El corte del 9/07 07:24 sigue vigente.» en la fila y píldora «Falló · hh:mm» (E3); preparando: esqueleto de las tarjetas.
**Capacidad condicional**: Ocurrencias y Sheets aparecen sólo si el proyecto los declara; Sheets no conectado se muestra como invitación punteada sólo en esta pestaña.
**Contrato de Superficie**: C1 «Fuentes del modo y su estado»; C2 la columna mantiene su ancho con 1–4 fuentes; C3 vacío propio (E2); C4 todos los botones visibles sin menú; C5 cada fuente dice cuántas filas trajo y cuándo.
**Responsive**: 1366 igual; 1280 el lateral baja a 300; 1024×600 el lateral pasa debajo y los KPIs de Campo envuelven en dos filas; el gráfico se oculta bajo 1100 px.
**Archivos**: nuevo `profiles/territorial/insumos/ConexionesTab.tsx`, `FilaDeFuente.tsx`; retira `TerritorialSourceConsole.tsx` (1,847 líneas) por partes; `territorialProfile.css` congelado no crece (CSS nuevo en `insumos/conexiones.css`).
**Aceptación**: un solo botón por verbo; «Cambiar formulario…» abre P3 con la cifra de filas que se quitan; ninguna tarjeta de fase en la consola.
**Decisiones**: Pregunta abierta, ver «Preguntas para Gonzalo»: ¿Piloto se muestra en Conexiones cuando la fase activa es Campo? (a) sí, atenuado como hoy en la maqueta; (b) sólo en el selector de fase.

### 3.2 Insumos › Mapeo y filtro

**Dirección**: `…&seccion=insumos&pestana=mapeo` · readiness `monitoreo-territorial-insumos-mapeo`
**Tablero**: «2 · Insumos › Mapeo y filtro».
**Reemplaza**: Fuente › Filtro y distritos, UMPs › Variables. Retira «Releer la base» (R28) a «Leer columnas».
**Composición**: izquierda tabla de 12 roles (Rol · Columna en selector · En la base); derecha arriba «Filtro de efectivas» (`consent` es Sí · 1 / No · 0, barra 1,404 / 289, base 1,693 recibidas); derecha abajo «Umbrales» (GPS cerca 150 m · revisión 300 m · duración mín. 60 s · máx. 7,200 s · edad a revisar desde 95) y «Distritos · código Kobo → ubigeo» (6 filas ok), pie [Descartar] [Guardar y recalcular].
**Notas**: 1 roles → columnas; 2 el filtro rotula su base; 3 los umbrales cambian la Bandeja.
**Datos**: `monitoreo_config$territorial$*_var`, `platform_effective_var/values`, `source_validity`, `geo_thresholds_m`, `min/max_duration_seconds`, `high_age_review`, `district_crosswalk`.
**Estados**: «Sin formulario de campo» si no hay fuente (enlace a Conexiones); rol sin columna: fila con chip «falta» en ámbar.
**Capacidad condicional**: roles de Hoja de ruta sólo si Sheets está conectado.
**Contrato**: C1 «Reglas de lectura del formulario»; C2 la tabla mantiene columnas con 12 o 20 roles; C3 rol vacío clasificado; C4 la tabla es el dueño del scroll; C5 el filtro dice cuántas pasan.
**Responsive**: 1024 apila las dos columnas.
**Archivos**: nuevo `insumos/MapeoTab.tsx`; absorbe `TerritorialVariableMappingWorkbench.tsx` y el filtro de `TerritorialSourceConsole.tsx`.
**Aceptación**: 12 roles con estado; guardar recalcula una sola vez.
**Decisiones**: Pregunta abierta, ver «Preguntas para Gonzalo»: `count_review_in_official_progress` (hoy `FALSE`) no tiene consumidor en el motor y, sin embargo, las 255 en observación cuentan. (a) retirarlo; (b) conectarlo y dibujarlo como switch «Contar observación en el avance». No se dibujó para no mostrar un control que no hace nada.

### 3.3 Insumos › Padrón

**Dirección**: `…&seccion=insumos&pestana=padron` · readiness `monitoreo-territorial-insumos-padron`
**Tablero**: «3 · Insumos › Padrón».
**Reemplaza**: Fuente › Encuestadores. Cierra R23 (el reemplazo del padrón deja de aplicarse al elegir el archivo).
**Composición**: cabecera con el archivo («Lista de encuestadores - ACNUR KOICA 12-06-26.XLS», 26 personas, PXXX, subido 12/06 17:59); tabla Código · Nombre · Casos · UMP con casos · Último · Estado (Con casos / Producción anulada / Sin casos); lateral «Códigos fuera del padrón» (16, con enlace a Conciliación). Acción «Reemplazar padrón…» con ensayo (cuántos códigos entran, salen, cambian).
**Datos**: `enumerator_roster$assignments` (26), `production_annulments$responsibles` (42 códigos en la base).
**Estados**: «Sin padrón» con [Subir padrón]; códigos de la base sin padrón listados igual.
**Contrato**: C5 el nombre se muestra en la app; la maqueta lo oculta. El DNI del archivo nunca se muestra.
**Archivos**: nuevo `insumos/PadronTab.tsx` (reusa `formatoDelPadron.ts`).
**Decisiones**: Pregunta abierta, ver «Preguntas para Gonzalo»: el padrón guarda DNI en el `.pulso`: (a) dejar de persistirlo; (b) persistirlo cifrado; (c) seguir igual.

### 3.4 Insumos › Historial

**Dirección**: `…&seccion=insumos&pestana=historial` · readiness `monitoreo-territorial-insumos-historial`
**Tablero**: «4 · Insumos › Historial».
**Composición**: tabla Cuándo · Acción (Traer / Releer ficha) · Fuente · Respuestas · Nuevas · Resultado (20 de 50); lateral gráfico «Respuestas en cada lectura · Campo» y «Otras acciones registradas» (28 subsanaciones aplicadas 03/07 20:22, 40 revertidas 03/07 20:21, anulaciones de P446 29/06 07:48 y P702 26/06 16:51).
**Datos**: `monitoreo_territorial_update_history` (33 traer + 9 releer), `occurrences_history` (4 traer + 4 formularios), `operational_adjustments$applied`, `production_annulments$entries`. Horas en Lima (UTC−5).
**Aceptación**: «Nuevas» es la diferencia con la lectura anterior de la misma fuente.

### 3.5 Modelo › Metas y muestra

**Dirección**: `…&seccion=modelo&pestana=metas` · readiness `monitoreo-territorial-modelo-metas`
**Tablero**: «5 · Modelo › Metas y muestra».
**Reemplaza**: la definición de meta que hoy viven en UMPs › Manzanas, Avance › Distritos y la banda Piloto/Campo.
**Composición**: izquierda «Meta por distrito» (Distrito · Meta 200 · UMP 25 · Reemplazos 25 · 8 por UMP · Viviendas y Población de las manzanas titulares · Población 18+ del distrito, Censo 2017; total 1,200 · 150 · 150 · 12,700 · 43,167 · 2,391,902), debajo dos tarjetas de fase (Campo activa: meta 1,200, 150 UMP, desde 12/06; Piloto: meta —, 35 respuestas, inicio —) y «Cómo se arma la muestra» (UMP = manzana titular · PPS por territorio muestral · 8 entrevistas, rango 1–8 · 1 reemplazo por UMP · eje distrito). Derecha mapa real de las 300 manzanas (titular relleno azul, reemplazo anillo carmesí) con escala. Botón «Editar en Hojas de ruta»: el Modelo se lee aquí y se edita allá.
**Notas**: 1 meta con su base; 2 la fase vive aquí y el chrome sólo la elige; 3 mapa real de la muestra.
**Datos**: `route_overview`, `route_blocks` (viviendas, poblacion, metodo, entrevistas, tipo_manzana), `route_population$table`, `phase_sources`, `phase_windows`.
**Estados**: «Sin muestra de Hojas de ruta» con [Abrir Hojas de ruta]; Piloto sin meta muestra «—».
**Contrato**: C1 «Qué hay que lograr»; C5 la meta de la insignia de Avance sale de aquí.
**Archivos**: nuevo `profiles/territorial/modelo/MetasTab.tsx`; lee el contexto que ya arma `.monitoreo_territorial_context`.

### 3.5b Modelo › Cuotas

**Dirección**: `…&seccion=modelo&pestana=cuotas` · readiness `monitoreo-territorial-modelo-cuotas`
**Tablero**: «6 · Modelo › Cuotas».
**Reemplaza**: la parte de definición de Validación › Cuotas.
**Composición**: «Variables de cuota» (Sexo ← `Core/E2_sex`: Hombre, Mujer · Edad ← `Core/E1_age`: 18–29, 30–44, 45–59, 60+), plantilla por UMP de 8 entrevistas (H 4 · M 4 · 18–29 2 · 30–44 3 · 45–59 2 · 60+ 1, marginales) y aviso de contradicción; «Cuota por distrito» (100 · 100 · 50 · 75 · 50 · 25 = 200; total 600 · 600 · 300 · 450 · 300 · 150 = 1,200); a la derecha «Cuota frente a población 18+» (Censo 2017, 2,391,902: H 48.4 % vs 50 %, M 51.6 % vs 50 %, 18–29 30.8 % vs 25 %, 30–44 32.3 % vs 37.5 %, 45–59 21.7 % vs 25 %, 60+ 15.3 % vs 12.5 %) y «Reglas para cubrir una celda» con switches (sexo flexible: sí; edad flexible: no).
**Datos**: `route_quota_progress$blocks[*]$sex/age` (las 300 manzanas con la misma plantilla), `districts[*]` (metas), `route_population`, `operational_adjustments$deficits$sex_flexible/age_flexible`.
**Decisiones**: Pregunta abierta, ver «Preguntas para Gonzalo»: `route_quota` (Hojas de ruta) reparte cada UMP en 8 celdas sexo × edad de 1 (2 por tramo de edad), pero el progreso usa 2/3/2/1. ¿Cuál es la cuota del estudio?

### 3.6 Control › Bandeja

**Dirección**: `…&seccion=control&pestana=bandeja&foco=gps_muy_lejos` · readiness `monitoreo-territorial-control-bandeja`
**Tablero**: «7 · Control › Bandeja» y «P2 · Anular un caso».
**Reemplaza**: Consultas › Registro, GPS con señal, Tiempo corto/muy corto (y su barra sobre la cabecera, 15h).
**Composición**: filtros a la izquierda (200 px: GPS > 300 m 89 · GPS 150–300 m 87 · Sin GPS 35 · Duración < 5 min 42 · < 2 min 2 · UMP iniciada incompleta 10; por distrito), tabla central con selección múltiple (Caso, Día, Distrito, UMP, Resp., Motivo, Distancia, Duración) y acciones de lote, inspector a la derecha (340 px) con esquema de distancia a la manzana (anillos 150 y 300 m, sin coordenadas), señales del caso y motivo obligatorio; [Aprobar observación] [Anular caso].
**Datos**: `internal_queries$review_cases` (265). Caso del tablero: `dcb2051a`, S. M. de Porres, UMP 145 (Mz 0200), P222, 16/06 11:30, 628 m, 14:55.
**Estados**: «Sin casos en esta cola» enmarcado; Aprobados 0 y Anulados 0 como pestañas del segmentado.
**Panel P2**: diálogo modal con impacto en cifras con base (UMP 145 8 → 7 de 8 · S. M. de Porres 215 → 214 · Estudio 1,283 → 1,282), motivo, switch «Recalcular el avance ahora» y [Anular 1 caso] en rojo de peligro. Escape cierra y devuelve el foco a la fila.
**Archivos**: nuevo `control/BandejaTab.tsx` sobre `PulsoTable` + `PulsoInspector` (GOAL vii); retira `TerritorialReviewCasesWorkbench.tsx`.

### 3.7 Control › Señales

**Dirección**: `…&seccion=control&pestana=senales` · readiness `monitoreo-territorial-control-senales`
**Tablero**: «8 · Control › Señales».
**Reemplaza**: Validación › Geolocalización (y su zoom que tapaba el chip, 15h), Duración de tiempo.
**Composición**: dos histogramas (distancia GPS a la manzana, 10 tramos, mediana 19 m, 1,250 cruzables; duración, cortes en 2 y 5 min, mediana 13.5 min) y matriz «Señales por distrito» (casos, en manzana, ≤ 150 m, 150–300 m, > 300 m, sin GPS, < 5 min, < 2 min, con total).
**Datos**: `response_audit$distance_m`, `duration_seconds`, `geo_estado`, `duration_operational_status`. Base de la matriz: 1,285 casos del corte con distrito.

### 3.8 Control › Equipo

**Dirección**: `…&seccion=control&pestana=equipo` · readiness `monitoreo-territorial-control-equipo`
**Tablero**: «9 · Control › Equipo».
**Reemplaza**: Consultas › Cruce responsable.
**Composición**: tabla por código (Estado, Recibidas, Cuentan, UMP, Distritos, GPS observado con barra, < 5 min, sparkline de cuentan por día, Último), inspector del código (P198: 74 cuentan, 9 UMP, 45 en bandeja, señales y sus UMP) y pie con [Anular producción].
**Datos**: `production_annulments$responsibles` (42 códigos), señales de `response_audit` por `pulso_code`.

### 3.9 Control › Ocurrencias ◇

**Dirección**: `…&seccion=control&pestana=ocurrencias` · readiness `monitoreo-territorial-control-ocurrencias`
**Tablero**: «10 · Control › Ocurrencias».
**Reemplaza**: Ocurrencias › Resumen, Distritos, Ritmo. Cierra 15h (KPI partidos letra a letra).
**Composición**: banda superior con Intentos 10,649 · Efectivas 1,313 · Tasa 12.3 % · No efectivas 9,336 y barra 100 % por motivo; izquierda «Por distrito» (intentos, partes, efectivas y cuatro motivos por cada 100 intentos, mapa de calor) y «Motivos de no efectividad» (barras); derecha «Por día» (intentos vs efectivas) y «UMP por tasa de efectividad» (histograma, mediana 14.8 %).
**Datos**: `monitoreo_territorial_occurrences_snapshot$data` (158 partes, columnas `estados/*`), UMP → distrito por la ruta. Base rotulada: «partes de ocurrencias de campo · 138 UMP». Las efectivas declaradas (1,313) no son las que cuentan (1,283): el rótulo dice «declaradas».
**Estados**: sin partes: «Sin partes de ocurrencias» con [Traer nuevas]; capacidad no declarada: la sección no existe (E4).
**Capacidad condicional**: respuesta de Gonzalo, en territorial ACNUR el parte de ocurrencias por UMP es parte del protocolo y estas pestañas siempre están; para otros clientes dependen de `field_occurrences.enabled` (tablero E4).
**Archivos**: nuevo `control/OcurrenciasTab.tsx`; retira las vistas equivalentes de `TerritorialFieldOccurrencesWorkbench.tsx` (2,047 líneas).

### 3.10 Control › Reportes UMP ◇

**Dirección**: `…&seccion=control&pestana=reportes` · readiness `monitoreo-territorial-control-reportes`
**Tablero**: «11 · Control › Reportes UMP».
**Reemplaza**: Reporte UMP, UMP, Alertas.
**Composición**: retícula de 150 baldosas (6 bloques de 25 por distrito, 46 × 54 px): 1 parte (verde), 2 partes (verde oscuro), sin parte (punteado ámbar), borde ámbar si «efectivas del parte ≠ recibidas en Kobo»; lateral con la UMP seleccionada (UMP 131: 49 efectivas en partes, 9 recibidas, 115 intentos, «No cuadra · +40»), lista «Sin parte» (12: 22, 23, 24, 25, 55, 67, 68, 102, 105, 106, 137, 143) y aviso «UMP 1437 no está en la ruta».
**Datos**: 119 UMP con 1 parte, 19 con 2, 12 sin parte, 66 no cuadran (43 con menos, 23 con más). Recibidas por UMP: `response_audit$advance_block_ump`.
**Decisiones**: Pregunta abierta, ver «Preguntas para Gonzalo»: ¿«no cuadra» compara con recibidas (como en la maqueta) o con las que cuentan?

### 3.11 Control › Subsanaciones

**Dirección**: `…&seccion=control&pestana=subsanaciones` · readiness `monitoreo-territorial-control-subsanaciones`
**Tablero**: «12 · Control › Subsanaciones».
**Reemplaza**: Consultas › Subsanaciones.
**Composición**: izquierda «Celdas con déficit · 19 en 6 UMP» (UMP 143 elegible; 96, 115, 66, R 144, 51 bloqueadas, con chips sexo/edad · faltan); centro «Paquete sugerido» (UMP 142 Mz 0440 P824 → UMP 143 Mz 0590 P132, 1 caso, Hombre 30–44, 0.45 km) con [Descartar] [Aplicar paquete] y mapa real con los 28 movimientos activos y el sugerido; derecha activas 28 (por distrito), revertidas 40 e historial.
**Decisión**: respuesta de Gonzalo, la subsanación la decide el coordinador en la app: el motor sugiere el paquete y el coordinador lo aplica o lo rechaza; las dos acciones quedan en el historial con autor, fecha y nota (si la nota es obligatoria es la pregunta 1).
**Datos**: `operational_adjustments$deficits` (19), `suggestions` (1), `applied` (28 activas del 03/07 20:22, 40 revertidas el 03/07 20:21), `surplus` (55 casos elegibles).
**Decisiones**: Pregunta abierta, ver «Preguntas para Gonzalo»: el motor marca «bloqueada» sin decir por qué; ¿se exige que publique la razón (sin excedente compatible, distancia, otro distrito)? Y: UMP 51, 66 y 115 figuran completas o subsanadas en `ump_groups` pero con déficit aquí (ver §4).

### 3.12 Control › Anulaciones

**Dirección**: `…&seccion=control&pestana=anulaciones` · readiness `monitoreo-territorial-control-anulaciones`
**Tablero**: «13 · Control › Anulaciones».
**Reemplaza**: Validación › Anulación (el único `is-danger` de hoy).
**Composición**: izquierda 342 casos fuera del conteo · 18 UMP con barras por distrito (Los Olivos 145, S. J. de Miraflores 135, S. M. de Porres 54, sin distrito 8) y una tarjeta por anulación (P702 producción completa, 311 casos, 88 válidos, 13 UMP, «Caso anulado» 26/06 16:51; P446, 31, 31, 5, «Tacha» 29/06 07:48) con [Revertir]; derecha tabla de UMP afectadas con su estado actual (UMP 1301, 220 y 230 «no está en la ruta»).
**Datos**: `production_annulments$entries`, `affected_blocks`, `rows`.

### 3.13 Control › Conciliación

**Dirección**: `…&seccion=control&pestana=conciliacion` · readiness `monitoreo-territorial-control-conciliacion`
**Tablero**: «14 · Control › Conciliación».
**Reemplaza**: Fuente › Reconciliación, Validación › Reconciliación UMP (tres «Descartar» con el mismo ícono, R30/R34).
**Composición**: dos paneles iguales. Códigos (42 en la base · 26 reconocidos · 14 conciliados · 2 sin reconocer: «109», «P4461» con selector del padrón; 15 conciliaciones Escrito → Asignado). UMP declarada (163 valores · 161 cruzan · 8 conciliados · 2 sin cruce: «UMP 285», «01900»). Pie: «Sospechas espaciales · 0 candidatas en cola».

### 3.14 Avance › Resumen

**Dirección**: `…&seccion=avance&pestana=resumen` · readiness `monitoreo-territorial-avance-resumen`
**Tablero**: «15 · Avance › Resumen» (y base de A1–A4 y E1).
**Reemplaza**: Avance › Resumen, Ritmo diario, Distritos (tabla). Cierra L18, L20, 15b, 15g.
**Composición**: izquierda 400 px: «1,283 / 1,200» con anillo 107 %, chip «Meta alcanzada el 26/06 · +83», embudo «Del Kobo a la meta» (§2), «Por qué 255 están en observación» (GPS > 300 m 89 · 150–300 m 87 · sin GPS 35 · < 5 min 52 · < 2 min 3; un caso puede tener dos), pie Primer registro 13/06 · Último 03/07 · Días con campo 20. Derecha: «Ritmo del campo» (acumulado que cuenta, cuentan por día y de ellas en observación, línea de meta 1,200, cruce el 26/06 con 1,204) y tabla «Distritos» (cuentan / meta con barra, avance, observación, no cuentan, 25 UMP en tiras de estado, sparkline por día, último; total 1,283 / 1,200 · 106.9 % · 255 · 68 con 2 sin distrito · 148/150).
**Notas**: 1 una sola cifra con base; 2 el ritmo lee la misma base; 3 las UMP por distrito salen de `ump_groups`.
**Datos**: `advance` del motor, `route_quota_progress$ump_groups` para las tiras.
**Estados**: preparando E1 («0:21 transcurridos · ≈ 0:15 restantes · estimado con la preparación anterior: 0:36» y pasos); sin fuente E2.
**Archivos**: nuevo `avance/ResumenTab.tsx`, `EmbudoDelCorte.tsx`; retira las vistas de `TerritorialAdvanceWorkbench.tsx` (3,147 líneas) por partes.

### 3.15 Avance › Mapa

**Dirección**: `…&seccion=avance&pestana=mapa&panel=ump&foco=143` · readiness `monitoreo-territorial-avance-mapa`
**Tablero**: «16 · Avance › Mapa» y «P1 · Mapa con ficha de UMP 143».
**Reemplaza**: Avance › Mapa y UMP (card «UMP foco», chips «Cargando…» y leyenda sobre el mapa, 15h), UMPs › Cobertura.
**Composición**: barra superior del mapa (capa Avance UMP / Ocurrencias, acercar, alejar, Encuadrar campo), lienzo del mapa a todo el alto (956 × 714 a 1440), barra inferior con leyenda, escala y fuente cartográfica. Vista general: seis distritos PlanMet, vías principales OSM, las 150 manzanas seleccionadas como punto por estado y las 150 sin usar como anillo. Lateral 380 px: Completas 128 · Subsanadas 20 · Pendientes 2, «Celda de cuota pendiente» y «Sin reporte de ocurrencias».
**P1**: al elegir una UMP el mapa acerca a 520 m con manzanas INEI 2017, límites y rótulos de zona, calles OSM, la manzana coloreada, las vecinas de la ruta y la flecha de la subsanación sugerida (142 → 143); la ficha reemplaza al lateral: estado, Cuentan 8/8 (7 + 1 subsanada), En el corte 9 (2 no cuentan), cuota por celda (30–44: 2/3, falta 1), subsanación sugerida y casos de la UMP. Nada se superpone al mapa.
**Datos**: geometría servida por `hojas_ruta_block_map_preview(ubigeo)` y `hojas_ruta_zone_map_preview(ubigeo)` (ya empaquetadas); estado por manzana de `route_quota_progress$ump_groups`; las coordenadas GPS de hogares no se dibujan.
**Responsive**: 1280 lateral 340; 1024×600 el lateral se vuelve hoja inferior plegable y la barra del mapa se compacta a íconos.
**Archivos**: nuevo `avance/MapaTab.tsx` sobre `TerritorialRouteCoverageAtlas.tsx` y `cartographyWarmup.ts`; contrato `avisosDelMapaNoSeTapan.contract.test.ts` se amplía a «ningún hijo absoluto dentro del lienzo».

### 3.16 Avance › UMP

**Dirección**: `…&seccion=avance&pestana=umps&panel=ump&foco=143` · readiness `monitoreo-territorial-avance-umps`
**Tablero**: «17 · Avance › UMP» y «E4 · Proyecto sin ocurrencias».
**Reemplaza**: UMPs › Manzanas, Ocurrencias › UMP.
**Composición**: segmentado Todas 150 · Pendientes 2 · Subsanadas 20 · Completas 128 · Sin parte 12, buscador y CSV; tabla (UMP, Distrito, Mz, Tipo, Resp., Cuentan con barra, Obs., Cuota, Efect./intentos, Tasa) ordenada con pendientes primero; inspector de la UMP igual al de P1.
**Capacidad condicional**: sin ocurrencias declaradas (E4) desaparecen la píldora Ocurrencias, el filtro «Sin parte» y las dos columnas; la tabla no reserva su espacio.

### 3.16b Avance › UMP · exploración de una UMP

**Dirección**: `…&seccion=avance&pestana=umps&panel=ump&foco=107` · readiness `monitoreo-territorial-avance-umps-detalle`
**Tablero**: «18 · Avance › UMP 107, exploración» (interactivo).
**Por qué la 107**: es la más rica en eventos del ACNURCG: manzana titular 0170 (zona 022) con 28 formularios del Aplicador 1 el 17 de junio, tacha de su producción el 26 de junio, reemplazo 0180 (zona 002) con 8 casos del Aplicador 2 el 28 de junio, dos partes de ocurrencias y una subsanación el 3 de julio.
**Composición**:
1. Mapa real de la UMP y su entorno (manzanas INEI 2017, límites y rótulos de zona, calles OSM) con un punto por formulario en su GPS de Kobo, numerado por orden. Segmentado de vista: Titular, Reemplazo o Ambas (las dos manzanas están a 2.3 km). Segmentado de capa: Recorrido (línea por aplicador), Estado (cuenta, GPS fuera de su manzana, anulado efectiva, anulado sin consentimiento) o Cuota (color por sexo). Puntos con el mismo GPS se separan en espiral para no chocar.
2. Panel derecho: tarjeta del caso elegido (hora, aplicador y tiempo desde el anterior, celda de sexo y edad, distancia a su manzana, estado), cuota de la UMP en seis celdas y lista de casos de la jornada.
3. «Historia de la UMP»: una sola curva escalonada de formularios que cuentan frente a la meta de 8, sobre un eje de días a la misma distancia (17 de junio a 3 de julio), con cuatro momentos numerados sobre la curva y debajo cuatro capítulos en lenguaje llano, cada uno con su fecha, una tira de sus formularios coloreados por resultado y el estado de la cuota: 1) 17 de junio, el Aplicador 1 levanta 28 formularios en la manzana titular (7 aceptan, 21 rechazan; cuota con 7 de 8); 2) 26 de junio, se anula su producción por tacha y el conteo vuelve a cero; 3) 28 de junio, el Aplicador 2 completa 8 en la manzana de reemplazo (falta una mujer); 4) 3 de julio, una subsanación trae una mujer de 60 años o más desde la UMP 101 (cuota completa, 9 casos). El control «Ver cada formulario» reemplaza los capítulos por las marcas de la jornada elegida con su hora; el ancho de cada marca es lo que duró el formulario cuando se conoce.
**Interacción**: elegir un capítulo marca su día en el eje, cambia la vista del mapa a su manzana y selecciona su primer caso; elegir un punto, una fila o una marca actualiza la tarjeta del caso y lo resalta en los tres lugares.
**Datos**: `state$monitoreo_snapshot$data` filtrado por `_uuid` de la UMP (28 anulados de `production_annulments$rows` y 8 de `response_audit`): `_geolocation`, `start`, `end`, `consent`, `Core/E1_age`, `Core/E2_sex`, `closing_group/code_pulso`; partes de `monitoreo_territorial_occurrences_snapshot`; subsanación de `operational_adjustments$applied`; cuota de `route_quota_progress$blocks`. La hora es la de apertura del formulario en Kobo; el primer caso del Aplicador 2 estuvo abierto desde el 27/06 16:08 y se ubica a su cierre. Los aplicadores aparecen como «Aplicador 1» y «Aplicador 2»; no se muestran nombres ni DNI.
**Hallazgos de los datos**: el parte del Aplicador 1 declara 8 efectivas, pero Kobo tiene 7 con consentimiento; el caso 1 del Aplicador 2 quedó a 1.8 km de su manzana y el motor lo da por «cerca» porque mide contra la manzana de la ruta más próxima (la 0070 de otra UMP), no contra la asignada. Que el control de GPS mida contra la manzana asignada es una decisión pendiente (pregunta 9).
**Archivos**: nuevo `avance/UmpDetalle.tsx`, `avance/HistoriaUmp.tsx`, endpoint de casos por UMP con GPS (vista interna).

### 3.17 Avance › Faltante por UMP, pantalla de llegada

**Dirección**: `/monitoreo?modo=territorial` aterriza en `…&seccion=avance&pestana=faltante` · readiness `monitoreo-territorial-avance-faltante`
**Tablero**: «15 · Avance › Faltante por UMP, pantalla de llegada».
**Por qué**: respuesta de Gonzalo, lo primero que ve el equipo son las cuotas faltantes por UMP.
**Reemplaza**: Validación › Cuotas y la consistencia de cuotas por manzana (`TerritorialQuotaConsistencyPanel.tsx`), sin perder detalle (ver §1b).
**Composición**: arriba a la izquierda, «Falta en la manzana en uso»: una tarjeta por UMP pendiente con la celda que falta, el aplicador, el último caso, quién la cubre y su acción (UMP 143: falta una persona de 30 a 44 años, sugerencia desde la UMP 142 a 0.45 km, «Revisar sugerencia»; UMP 96: falta una de 45 a 59, sin excedente compatible cerca, «Ver en el mapa»), y la línea «Las otras 148 UMP tienen su cuota completa, 20 de ellas con subsanación». Arriba a la derecha, el mapa de calor «Logrado frente a la cuota, por distrito». Abajo, a todo el ancho, «Cuota de cada UMP»: una fila por UMP con su manzana en uso, aplicador, las seis celdas con lo logrado y el signo de lo recibido o cedido por subsanación, la falta, el saldo de subsanaciones y quién la cubre (por ejemplo «UMP 142, a 0.45 km»). Segmentado Con celda pendiente, Subsanadas y Todas; switch «Incluir reemplazos».
**Datos**: `route_quota_progress$districts[*]` y `$blocks[*]$sex/age` con `operational_adjustment_delta`; `operational_adjustments$applied` (activas) y `$suggestions`.
**Estados**: sin cuota configurada: «Sin cuota territorial configurada» con enlace a Modelo › Cuotas.

### 3.18 Avance › Salidas

**Dirección**: `…&seccion=avance&pestana=salidas` · readiness `monitoreo-territorial-avance-salidas`
**Tablero**: «19 · Avance › Salidas».
**Composición**: libro de salidas, una fila por salida (PDF de avance territorial, generado 9/07 09:56 · Sheets interno, 15 pestañas, 10 publicaciones 19/06 → 02/07, última 02/07 13:45 · Sheets para el cliente, sin destino · Tablero publicado en Hugging Face, privado, 18/06 19:28 · Paquete del corte · Solicitud operacional CSV/JSON) y vista del PDF a la derecha. Publicar va aquí, con ensayo Revisar → Aplicar (L38), nunca en el chrome.
**Datos**: `monitoreo_client_report_pdf$generated_at`, `monitoreo_publication_sheet_events_internal`, `monitoreo_publication$last_deploy`.

---

## 4. Actualizar, fase y paneles

### A1–A3 · Actualizar (abierto, corriendo, recibo)

Tableros «A1», «A2», «A3». Popover anclado al botón, 600 px.

| Paso | Qué hace | Tarda | Dato real |
|---|---|---|---|
| 1 Kobo · Campo | trae las respuestas nuevas desde el cursor | sin medición | última 9/07 07:25 · 1,697 |
| 2 Kobo · Ocurrencias | trae los partes nuevos | sin medición | última 9/07 07:23 · 158 |
| 3 Hoja de ruta · Sheets | se omite: no conectada | — | `route_sheet$reason = sin_fuente` |
| 4 Cartografía | manzanas INEI 2017 empaquetadas, sin red; puntos GPS se rehacen si hay nuevas | vigente | capa del 15/06; puntos del 06/07 |
| 5 Recalcular | avance, cuotas, bandeja, subsanaciones sugeridas, cruce de partes | ≈ 0:36 | medido en esta copia |

«No toca»: Sheets interno, Tablero publicado, Formulario de la fase, Anulaciones, Subsanaciones, Fase Piloto, Ficha del
formulario. Pie: [Traer todo de nuevo…] [Solo recalcular] [Actualizar]. A2 muestra cada paso hecho con su resultado
(+0 · 1,697; +0 · 158; vigente) y el paso en curso con barra; la píldora del chrome dice «Actualizando · 5/5». A3 deja el
recibo: Traído (por fuente) y Recalculado (Cuentan / meta 1,283 / 1,200, En observación 255, Celdas con déficit 19 en 6
UMP, UMP sin parte 12) con «sin cambio», y [Ver en Historial].
Datos que faltan: la duración de cada paso no se guarda hoy en el `.pulso`. Los tiempos de A2 (0:41, 0:22) son
ilustrativos; el recibo no muestra duración. Requisito: `jobs.R` registra la duración por paso y el siguiente Actualizar
la usa como estimación.

### A4 · Fase

Popover desde `FASE ▾`: Piloto (35 respuestas, Kobo «Perú 2026», sin meta, última 25/06) y Campo (1,693 en el corte, meta
1,200, desde 12/06). «Cambia todas las secciones del modo». Reemplaza la banda Piloto/Campo y las tarjetas de fase.

### P1 Ficha de UMP · P2 Anular · P3 Cambiar formulario

P1 y P2 en §3.15 y §3.6. P3: diálogo con buscador de formularios Kobo, el actual y el del piloto, aviso «Al aplicar se
quitan del corte las 1,697 respuestas del formulario actual», casilla de confirmación y botón «Cambiar y quitar 1,697»
deshabilitado hasta marcarla (cierra R13: hoy poda sin avisar).

### Estados

E1 Preparando (L23, con tiempo transcurrido y estimado de la preparación anterior), E2 Sin fuente (pasos de puesta en
marcha; la muestra de Hojas de ruta aparece «Lista»), E3 Falló (`E_KOBO_API_FAILED`; la hora 07:31 es ilustrativa),
E4 Sin ocurrencias (capacidad no declarada).

---

## 5. Lo que no se pudo obtener o no cuadra

| Qué | Estado | Razón |
|---|---|---|
| Duración de cada paso de Actualizar y del sync Kobo | — | El `.pulso` no la guarda. Sólo se midió el recálculo (36 s). |
| Razón de «bloqueada» en déficits | — | `operational_adjustments$deficits$match_status` no trae motivo. |
| UMP 51, 66, 115, R 144 | explicado | Sus 17 celdas con déficit están en manzanas que la UMP ya no usa: la UMP se completó en otra manzana. No es una contradicción; la pantalla separa «manzana en uso» de «manzanas que la UMP ya no usa». |
| Base del motor de cuotas | 1,296 ≠ 1,283 | `route_quota_progress` suma 1,296 por sexo; el avance cuenta 1,283. Rotulado en la pantalla; falta decidir cuál manda. |
| Válidos anulados | 119 ≠ 110 | Por responsable/manzana suman 119; por estado de fila (validada + revisión) 110. La maqueta muestra 119 con su rótulo. |
| UMP 143: casos que cuentan | 7 + 1 | 7 observados + 1 subsanado = 8 (`validas_operativas`). Se muestra así. |
| Nombre de encuestadores, DNI y GPS de hogares | omitidos | Datos personales. |
| Ventana de fase Piloto | — | `phase_windows$pilot$start_at` vacío. |
| Hora del error y tiempos en curso | ilustrativos | Estados sin dato real. |

---
