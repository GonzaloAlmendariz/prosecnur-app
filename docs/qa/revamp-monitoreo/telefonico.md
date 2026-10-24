# Revamp de Monitoreo, Telefónico: arquitectura y fichas por pestaña

Tipo: Especificación de maqueta (copia durable del lienzo)
Estado: En curso
Situación: Lista para revisión de Gonzalo; las piezas que dependen de una pregunta están dibujadas como «Por definir»
Fecha: 2026-10-23
Autoridad: Gonzalo (pedido de sesión)
Lienzo: https://claude.ai/artifact/3TBxyrduztwWp4b3hNS2dh («Revamp de Monitoreo, Telefónico», privado)
Estándar: `docs/qa/revamp-monitoreo/estandar-de-ficha.md` (v2, con «Realismo operativo» en §0)
Procedimientos: `docs/qa/revamp-monitoreo/procedimientos-respondidos.md` manda sobre cualquier supuesto de este documento.
Hermanos: `territorial.md` y `acreditacion.md` (mismo esqueleto, mismo lenguaje; `ColaDeInsistencia` es común con Acreditación).

Proyectos de ejemplo (copias de trabajo en el scratchpad; nunca los originales, sin red):

| Proyecto | Qué es | Corte | Qué es real |
|---|---|---|---|
| `ACNUR_PDM` | PDM telefónico ACNUR 2026: hoja de barrido de 2,296 casos (Muestra 1,111, Backup 1,185), 15 responsables, Kobo con 430 envíos; cuota por sede (5 valores, meta 400) | 27/07/26 09:04 | Todo real. Responsables como `Op-01…Op-15`; enumeradores de Kobo cuyo nombre no aparece en la hoja como `K-01…K-10`; teléfonos enmascarados. |
| `PDM_MedVida2026` | Medios de Vida 2026: listado de 183 casos (Actor: Homologación de Títulos 156, Vinculación Laboral 27), hasta 4 teléfonos por caso, 4 responsables, 75 envíos de Kobo; meta 80 y 20 | sincronizado 30/07/26 09:10 | Es el `.pulso` de `fixtures/`: los envíos llevan fechas del 04/08 al 08/08, posteriores a la sincronización. Se usa porque es el único con `OrdenTelefono` y `TelefonosIntentados`. |
| `RMS 2026` | Sin `.pulso`. Listado `Listado Telefonico - RMS PULSO PUCP.xlsx` (hojas MUESTRA (MAIN) 400 y BACKUP 400) e instrumento RMS 2026 v6 | — | Real: conteos del listado e instrumento. No hay barrido ni respuestas. |

CBI ya no se usa y salió del lienzo. `MEDVID.pulso` (Medios de Vida 2025, 185 filas, columnas `Tef1`, `Tef2`,
`Observación de rebarrido`) se perfiló y sirve para la tabla de columnas reales; no tiene tablero propio.

Cada proyecto de ejemplo es un tablero propio: los «b» (`*-MV.dc.html`, `*-RMS.dc.html`, `*-PDM.dc.html`) son la misma
pestaña con otro proyecto, y el chip del proyecto en la barra superior es lo único que dice qué `.pulso` está abierto.
Actualizar (abierto, corriendo, recibo) y los cuatro estados del modo también son tableros separados. Los tableros no
llevan marcadores numerados: lo que explicaban está en estas fichas.

---

## 0. Preguntas para Gonzalo

Ninguna detiene el resto. Lo que depende de cada una quedó sin dibujar o como «Por definir».

| # | Pregunta | Opciones y qué haría con cada una |
|---|---|---|
| P1 | Mientras una discrepancia entre Kobo y la hoja está pendiente, ¿la efectiva cuenta en el avance? Hoy el avance de PDM cuenta 423, que incluye 204 efectivas de Kobo cuya hoja dice otra cosa. | (a) Cuenta, porque manda Kobo; la decisión solo puede sacarla: Avance queda igual y Discrepancias muestra «cuenta mientras tanto». (b) No cuenta hasta que el supervisor decida: el faltante de PDM pasa a 181 (400 menos 219 coincidentes) y Cuotas muestra «204 por revisar» al lado. (c) Cuenta, pero Cuotas muestra cuántas de cada sede están pendientes: una columna más en Avance, Cuotas. |
| P2 | ¿Qué decide el supervisor en una discrepancia? La maqueta usa las dos acciones que ya existen en el motor de acreditación (`include_with_caveat` y `keep_excluded`, en `reconciliation_decisions`), rotuladas «Cuenta como efectiva» y «No cuenta». | (a) Esas dos, con nota: se reutiliza el contrato tal cual. (b) Además «Corregir la hoja» (marcar que el equipo debe cambiar el status): sería una acción que escribe fuera de la app; iría a Entregas como lista para el equipo. (c) Otras: las dibujo cuando las nombres. |
| P3 | Para «La hoja dice Efectivo y Kobo no tiene envío» (PDM 3, Medios de Vida 3) no hay `response_id` que decidir. ¿Qué se hace con esos casos? | (a) Solo se informan: no cuentan y el equipo debe enviar el Kobo; la cola los muestra sin botones. (b) El supervisor puede declararlos efectivos sin Kobo: hace falta guardar la decisión por `CodPulso`, campo nuevo. (c) Se quitan de Discrepancias y van a Avisos. |
| P4 | ¿El enumerador de Kobo (`Intro/Enumerator_name`) es la misma persona que el responsable de la hoja? En PDM, 8 de 18 nombres coinciden; los otros 10 no aparecen en la hoja. | (a) Sí, solo cambia cómo se escribe el nombre: hace falta una tabla de equivalencias en Insumos, Llave y filtros. (b) No: el responsable asigna y otra persona encuesta; Discrepancias y Supervisión muestran los dos por separado, como ahora. |
| P5 | Supervisión: ¿un enumerador con pocas efectivas puede quedar sin casos? Con 20 casos sobre 423 (4.7 %), 6 de 18 enumeradores de PDM (todos con 7 efectivas o menos) quedan en cero. | (a) Sí, la proporción manda. (b) Al menos un caso por enumerador con efectivas: PDM pasa a 26 casos. (c) Al menos uno solo si tiene N efectivas o más: dime N. |
| P6 | Supervisión: el proyecto hoy guarda una cantidad de casos (`supervision_n`: PDM 20, Medios de Vida 15), no un porcentaje. ¿Se declara porcentaje? | (a) Porcentaje por estudio y la cantidad se calcula: el campo nuevo `supervision_pct` reemplaza a `supervision_n`. (b) Se mantiene la cantidad y se muestra el porcentaje equivalente, como en la maqueta. |
| P7 | ¿Qué columnas trae la hoja de resultados de supervisión y qué se compara con Kobo? No hay ninguna conectada en los proyectos de ejemplo. | Mándame una hoja de un estudio anterior o la lista de columnas. Con eso dibujo la columna «Resultado de la rellamada» y la comparación; hoy queda «Sin hoja de supervisión». |
| P8 | ¿Quién abre un caso de reserva y dónde queda escrito a qué caso de la muestra reemplaza? | (a) En la hoja del equipo, con una columna (por ejemplo `Reemplaza a`): Modelo, Reserva la declara y Avance, Reemplazos empareja. (b) En la app, como decisión auditada del supervisor. (c) No se anota la pareja: Avance muestra solo totales abiertos por sede. |
| P9 | ¿La reserva reemplaza dentro de la misma categoría de cuota (misma sede en PDM, mismo periodo en RMS)? El RMS trae 100 casos por periodo de llegada en cada hoja. | (a) Sí: el aviso «reemplazo de otra sede» se agrega. (b) No necesariamente: no hay aviso. |
| P10 | ¿Cuál es la variable de cuota del RMS 2026? El listado trae `Periodo de Llegada` (4 valores, 100 por hoja) y `Estatus Legal`. | (a) Periodo de llegada, meta 100 por valor. (b) Otra, o el cruce de dos. El tablero vacío del RMS la deja «Por definir». |
| P11 | El instrumento RMS 2026 registra `call_attempt` (número de intento) y `attempt1` (Sí, nadie respondió, el número no existe, apagado). ¿El equipo enviará un Kobo por cada llamada fallida? | (a) Sí: en el RMS sí habría historia de llamadas por caso; se agrega como capacidad condicional «Intentos registrados en Kobo» a la ficha de Insistencia. (b) No, solo cuando contesta: la historia sigue sin existir y nada cambia. |
| P12 | ¿Cómo se ordena por defecto la cola de insistencia? La maqueta ordena por intentos, de más a menos; Acreditación lo dejó «por definir» (su P1). | (a) Por intentos: queda. (b) Por status y luego intentos. (c) Por fecha del último intento, la más antigua arriba. |
| P13 | ¿Qué status forman la cola de insistencia? La maqueta usa los no finales: No contesta, Contactar después, Apagado, Colgó y Contactado por WhatsApp. | (a) Esos: queda. (b) Sin «Contactado por WhatsApp». (c) Lo declara cada proyecto en Insumos, Estados (columna «Cierra»). |
| P14 | La pestaña se llama «Insistencia» aquí y «Reintentos» en Acreditación, con el mismo componente. ¿Un solo nombre? | (a) Insistencia en los dos. (b) Reintentos en los dos. (c) Cada modo el suyo. |
| P15 | ¿Qué lleva la hoja interna que se publica para el equipo? Hoy el motor publica sus bloques. | Dime cuáles usan el coordinador y el supervisor; la maqueta lo deja «Por definir» en Entregas. |
| P16 | `alerts.no_answer_min_attempts` (PDM 4) y `detalle_no_contesta$Intentos objetivo` existen en el motor. Sin regla de agotado, ¿para qué sirven? | (a) Solo como aviso de «mucha insistencia» en Avisos, sin marcar casos. (b) Se quitan del perfil telefónico. La maqueta ya no los muestra en la cola. |
| P17 | La copia de PDM estaba marcada como «Pendiente de recalcular» (cambios sin recalcular). El vocabulario común no tiene ese estado; la maqueta muestra «Al día» en los tableros de uso diario y «Preparando» en su tablero de estado. | (a) Usar «Preparando» también para cambios sin recalcular. (b) Agregar «Por recalcular» al vocabulario común de los tres modos, en ámbar. (c) No mostrarlo en la píldora y avisarlo dentro de Actualizar. |

---

## 1. Arquitectura: hoy → propuesta

Hoy: 5 secciones y 16 pestañas, clonadas de Acreditación (Fuentes, Modelo operativo, Llamadas, Consultas, Avance).
Propuesta: 4 secciones en el orden del operativo, 14 pestañas y 2 condicionales. **El modo aterriza en Avance, Cuotas**
(el faltante por cuota es lo primero que mira el equipo) y el faltante se repite en la barra del modo en todas las
pestañas («FALTAN 0 de 400»).

| Sección | Pestaña | Pregunta que responde | Absorbe | Por qué aquí |
|---|---|---|---|---|
| Insumos | Fuentes | ¿Qué se lee y qué capacidades declara el proyecto? | Fuentes activas, Universo y barrido | Primer paso del operativo; sin fuentes no hay corte. |
| Insumos | Llave y filtros | ¿Qué cuenta y cómo cruza? | Encuestas; llave CodPulso | La llave decide todas las cifras de Control. |
| Insumos | Estados | ¿Qué significa cada status de la hoja? | «Estados y colores» de Fuentes | Vocabulario del cliente, editable con vista previa. |
| Modelo | Cuotas y calendario | ¿Sobre qué variable y cuánto? | Modelo, Cuotas y Cronograma | Una variable, como máximo dos; sin metas por enumerador. |
| Modelo | Reserva (condicional) | ¿Qué casos reemplazan a la muestra? | nueva | PDM y RMS; Medios de Vida 2026 no la declara. |
| Control | Barrido | ¿Cómo rinde la hoja? | Resumen operativo | Lectura del día del coordinador. |
| Control | Insistencia | ¿A quién se sigue llamando? | Sin efectiva | La cola caso por caso con lo que la hoja registra. |
| Control | Equipo | ¿Cómo rinde cada responsable? | Responsables | Carga y status por operador frente a la mediana. |
| Control | Discrepancias | ¿Kobo y la hoja dicen lo mismo? | Consultas CodPulso | La decide el supervisor en la app, auditada. |
| Control | Respuestas | ¿Cuál envío es efectiva? | Efectivas Kobo, Validación de tiempo, Salvedades | Cadena de recibidas a efectivas. |
| Control | Supervisión | ¿Qué efectivas se vuelven a llamar? | nueva aquí | Muestra por enumerador; resultado de su hoja. |
| Control | Avisos | ¿Qué hay que corregir? | Alertas reales | Agrupadas por causa con dónde ir. |
| Avance | Cuotas | ¿Cuánto falta? | Avance, Cuotas | Aterrizaje del modo. |
| Avance | Ritmo | ¿A qué velocidad? | Diario | Kobo y hoja en el mismo eje. |
| Avance | Reemplazos (condicional) | ¿Qué reserva se abrió? | nueva | Solo si Modelo declara reserva. |
| Avance | Entregas | ¿Qué sale? | Salidas | Al cliente solo el avance por cuota. |

Se retira: franja «Sheets, Kobo, Todo»; sub-barras sin dirección; el anillo de Cuotas; la regla de agotado y el
«Intentos objetivo» en la cola; cualquier acción que reasigne, reprograme o marque agotado; la lectura geográfica de
las cuotas (la sede es una categoría, no un mapa).

---

## 1b. Paridad: lo que ya existe y dónde queda

Inventario hecho sobre `TelefonicoMonitoreoPage.tsx` (búsqueda de «insist», «intento», «responsable», «asign»),
`TelefonicoTeamDiagnostics.tsx`, `telefonicoTeamModel.ts`, `TelefonicoPhoneAlerts.ts`, `TelefonicoPhoneDailyTrend.ts`,
`TelefonicoGoalPanel.tsx`, `metasPendientes.ts`, `segmentoDeCuotas.ts`, `avance/`, `fuentes/`, `sync/` y 8 capturas
reales de la app con `ACNUR_PDM` (runner del repo en puertos propios, sobre copia).

| Capacidad de hoy | Dónde queda | Qué mejora |
|---|---|---|
| Resumen operativo: 423, 222, 219 y 204 (Kobo, hoja, coinciden, solo Kobo) | Control, Barrido (cifras) y Discrepancias (matriz 2 × 2) | La reconciliación pasa a ser una cola con decisión, no solo cuatro números. |
| «De dónde sale la cifra» 2,726 → 2,296 → 423 | Avance, Cuotas (panel 3) y Control, Respuestas | Se lee junto al faltante. |
| Cobertura 631 de 2,296 y 13 status | Control, Barrido | Embudo simétrico y status del cliente con su regla. |
| Ratio de incidencias por responsable y producción por responsable | Control, Equipo (carga) | Tabla con días, brecha hoja frente a Kobo y ficha del operador. |
| Validación de tiempo (424 «5 min o más») | Control, Respuestas | Marca los 57 envíos de más de 2 h que hoy se ven como «Normal». |
| Sin efectiva: tarjetas por responsable (sin responsable 1,197; por llamar 468; no contestan 197; promedio 2.4 intentos; escala 1:18, 2:81, 3:95, 4:2) | Control, Insistencia (lista de responsables y cola) e Insumos, Estados (distribución de intentos) | Caso por caso con status, intentos, observación y fecha; «Sin asignar» separado del atraso. |
| Lista desplegable de «no contesta» con intentos «de 4» e intensidad frente a la mediana | Control, Insistencia | Sin «de 4» (no hay regla de agotado); intentos por caso por responsable al lado de su nombre. |
| Responsables: matriz status × responsable en % con desvíos frente a la mediana (18 desvíos, umbral 12 puntos, mínimo 10 casos) | Control, Equipo, vista «Estados por operador» | Misma regla de `telefonicoTeamModel.ts`; celdas teñidas por desvío y fila del equipo. |
| Brecha de plataforma por responsable | Control, Equipo (columna «Brecha») | Igual. |
| Alertas reales (13 observaciones, 1,902 casos) | Control, Avisos | Agrupadas por causa con destino. |
| Consultas CodPulso: explorador con filtros (actor, fecha, canal, fuente, recopilador, respuesta) y ficha | Control, Discrepancias (cola por grupo y ficha) | Solo los casos que no coinciden, con la decisión del supervisor. |
| Avance, Cuotas: anillo por sede, efectivas, sin efectiva y por barrer, ritmo por sede; chips meta, faltan, ritmo 60.4, rendimiento 1.5, reserva 1,665 | Avance, Cuotas | Faltante primero (columna y número grande), curva acumulada por sede, muestra por sede por familia de status, mismos cuatro indicadores. |
| Fuentes: Universo y barrido, «12 de 13 sin confirmar», categorías y confirmar estados | Insumos, Fuentes e Insumos, Estados | Vocabulario editable con familia y vista previa. |
| Supervisión (compartida con Acreditación) | Control, Supervisión | Muestra proporcional por enumerador sobre efectivas, no sobre las 2,726 filas. |
| Salidas: PDF cliente y producción, Publicar en Sheets cliente e interno, validar salida | Avance, Entregas | El cliente recibe solo el avance por cuota. |

---

## 1c. Cola de insistencia: dato, fuente real y columna

La hoja de barrido guarda **una fila por caso** que se sobrescribe. Kobo trae un envío por encuesta, no por llamada
(en PDM y Medios de Vida). No hay historia de llamadas, hora, número marcado por intento ni próximo intento.

| Dato en la cola | Tipo en `ColaDeInsistencia` | Fuente real | Columna | PDM | MEDVID 2025 | Medios de Vida 2026 |
|---|---|---|---|---|---|---|
| Caso | base | Hoja de barrido | `CodPulso` / `CODPulso` | sí | sí | sí |
| Último resultado | base | Hoja de barrido | `Status` | sí | sí | sí |
| Intentos (total acumulado) | base | Hoja de barrido | `Intentos` | sí (634 de 2,296) | sí | sí |
| Observación (una, se sobrescribe) | base | Hoja de barrido | `Observación` / `Observacion` | sí (251) | sí, y `Observación de rebarrido` | sí (41) |
| Responsable | base | Hoja de barrido | `Responsable` | sí (1,099) | sí | sí (164) |
| Fecha del último intento | base | Hoja de barrido | `Fecha` | sí (636) | sí | sí (164) |
| Días sin registro | base, derivada | corte menos `Fecha` | — | sí | sí | sí |
| Efectiva en Kobo | base, derivada | Kobo cruzado por la llave | `Intro/Pulso_code` + filtros | sí | sí | sí |
| Categoría de cuota | propia | Hoja de barrido | `Sede` / `Actor` | sí | `Componente` | sí |
| Teléfono en uso y teléfonos intentados | propia, condicional | Hoja de barrido | `OrdenTelefono`, `TelefonosIntentados` | no | no | sí |
| Teléfonos del caso | propia, condicional | Listado (universo) | `NumTelefonos`, `Telefono1…4` / `Tef1`, `Tef2` | no (uno) | sí | sí |
| Origen (muestra o reserva) | propia, condicional | Hoja de barrido | `Origen` | sí | no | sí (solo «Listado») |

Las columnas propias se muestran solo si la hoja las trae (el lienzo lo enseña con el tablero 2b).

---

## 2. Patrones comunes

- **Esqueleto, idéntico a Territorial y Acreditación**: barra superior con el dock de módulos y el chip del proyecto;
  barra del modo con MODO, EJE DE CUOTA y FALTAN (mismo estilo), píldoras de sección con insignia (Control: casos por
  revisar, 207 en PDM y 6 en Medios de Vida; Avance: porcentaje frente a la meta, 106 % y 70 %), CORTE con fecha y hora
  («27/07/26 09:04»), píldora de estado del vocabulario común («Al día», «Actualizando, paso N de M», «Falló»,
  «Preparando»; «Sin fuentes» en el vacío) y Actualizar. Rail a toda altura con «CORTE» gris y la fecha en dos líneas al
  pie. Cabecera de pestaña de 44 px: ícono carmesí en cuadro suave, antetítulo «SECCIÓN · GRUPO» en versalitas
  («CONTROL · LLAMADAS» para Barrido, Insistencia y Equipo; «CONTROL · CASOS» para Discrepancias, Respuestas, Supervisión
  y Avisos) y el nombre debajo, sin subtítulo; a la derecha, chips de contexto.
- **Escritura**: sin «=», sin flechas en rótulos, sin cadenas de «·», sin abreviaturas improvisadas; cifras es-PE
  («2,296», «35.2 %»).
- **Sin asignar**: un caso sin responsable se rotula «Sin asignar», en gris; no es atraso.
- **Sin escritura de casos**: Monitoreo lee la hoja del equipo. La única escritura de Control es la decisión del
  supervisor sobre una discrepancia, que se guarda en el `.pulso` con quién, cuándo y nota.
- **Capacidades condicionales**: rótulo «condicional» morado (`#5b4b8a` sobre `#f1edfa`); sin declarar, no dejan hueco.
- **Por definir**: caja con borde punteado y chip «Por definir»; remite a la pregunta de §0.

---

## 3. Fichas

### Avance, Cuotas (aterrizaje)

- **Dirección**: `/monitoreo?modo=telefonico&seccion=avance&pestana=cuotas` · readiness `monitoreo-telefonico-avance-cuotas`.
- **Tablero**: `Avance-Cuotas.dc.html` (abre con Medios de Vida 2026; «Ver con» alterna PDM).
- **Reemplaza**: Avance, Cuotas de hoy (anillo por sede) y los chips de `TelefonicoGoalPanel.tsx`.
- **Composición**: grilla `minmax(0,1fr) 360px`, separación 12. Izquierda, tabla con columnas Categoría (196) ·
  **Faltan** (76, número de 26 px, carmesí si falta, verde si cumple) · barra efectivas con marca de meta · efectivas
  sobre meta · % · acumulado por día (sparkline 150 × 40 con meta punteada) · cumplió · sin llamar; fila Total. Con
  pocas categorías (Medios de Vida) la tabla se completa con «Faltante al cierre de cada día» (una línea por categoría,
  rótulos en cada punto). Derecha: (1) «Faltan para la meta» con número de 44 px, efectivas y % y cuatro indicadores
  (Ritmo, Rendimiento, Sin llamar, Sin asignar); (2) muestra por categoría en barras apiladas por familia de status;
  (3) «De dónde sale la cifra».
- **Datos**: bloque `cuotas_variable` (`Valor`, `Meta`, `Efectivas`, `Brecha`, `Estado cuota`); acumulado de
  `avance_efectivo_variable_dia` (`Valor`, `Fecha`, `Efectivas`); faltante = `Meta − Efectivas`, piso 0. PDM: SJL 109 de
  107, SMP 110 de 99, Cercado 100 de 95, Chorrillos 59 de 58, PL 45 de 41; total 423 de 400, cumplida el 06/07.
  Medios de Vida 2026: Homologación 56 de 80 (faltan 24), Vinculación 14 de 20 (faltan 6), total 70 de 100; faltante
  diario 66, 56, 48, 35, 24 y 16, 13, 12, 10, 6. Ritmo = efectivas ÷ días con envíos (60.4 y 14). Rendimiento =
  registros barridos ÷ efectivas (631 ÷ 423 = 1.5; 164 ÷ 70 = 2.3), como `costoPorEfectiva`. Sin asignar: `No barrido`
  sin `Responsable` (PDM 12 de la muestra; Medios de Vida 19). Familias por categoría desde la hoja (PDM SJL: 55 efectiva,
  73 reintentable, 5 rechazo o parcial, 25 terminal, 121 sin llamar). Cadena: 430, 427, 424, 423 (PDM) y 75, 74, 72, 70.
- **Estados**: «Sin metas declaradas: Avance mide cobertura del listado» · «Preparando, paso 3 de 4» · «Parcial: Kobo
  falló» (tablero E).
- **Capacidad condicional**: dos variables de cuota (cruce) se dibujan como filas anidadas; no hay ejemplo real.
- **Contrato**: C1 «Cuánto falta por {variable}» · C2 la tabla mantiene marco con 1 a 10 categorías (con menos de 4 se
  agrega el gráfico de faltante diario) · C3 vacío propio por estado · C4 todo visible a 1440 × 1000 sin desplazar ·
  C5 entrega faltante, efectivas, meta y ritmo por categoría.
- **Responsive**: 1366 y 1280, columna derecha a 320; 1024 × 600, la columna derecha baja bajo la tabla y el
  documento desplaza (layout `document`).
- **Archivos**: nuevo `profiles/telefonico/avance/CuotasFaltante.tsx` (tabla y número), nuevo
  `profiles/telefonico/avance/FaltanteDiario.tsx`; reutiliza `segmentoDeCuotas.ts`, `metasPendientes.ts`,
  `telefonicoGoalModel.ts` y `avance/ritmoDiario.ts`. `TelefonicoGoalPanel.tsx` se reduce a los indicadores.
  `TelefonicoMonitoreoPage.tsx` está congelado (línea base 20,486): solo cambia el montaje.
- **Aceptación**: el número grande de «Faltan» coincide con la suma de la columna; PDM muestra 0 en verde; Medios de Vida
  30 en carmesí; el modo abre aquí al abrir un proyecto telefónico.
- **Decisiones**: P1 (si las discrepancias pendientes cuentan).

### Control, Insistencia

- **Dirección**: `…&seccion=control&pestana=insistencia` · readiness `monitoreo-telefonico-control-insistencia` · panel
  `&panel=caso&foco=<CodPulso>`.
- **Tablero**: `Llamadas-Insistencia.dc.html` (PDM) y `Llamadas-Insistencia-MV.dc.html` (Medios de Vida 2026).
- **Reemplaza**: «Sin efectiva» (`AcreditacionPhonePendingInsistence`, líneas 6285–6530 de la página) y la lista
  desplegable de no contesta.
- **Composición**: cabecera con «N casos por rellamar» y «N ya son efectivas en Kobo». Barra de filtros: buscar
  CodPulso, Responsable, Último resultado, Intentos, categoría, Orden («Más intentos primero», P12) y switch «Ocultar las
  efectivas en Kobo». Grilla `212px minmax(0,1fr) 316px`. Izquierda, «Responsables» con casos en cola, barra y
  «intentos por caso»; al pie «Sin asignar» en gris; con Medios de Vida, debajo, «Teléfonos por caso» (condicional).
  Centro, la cola: CodPulso (72) · Intentos (número y barra a la escala del máximo de la cola) · Último resultado ·
  Observación de la hoja (cita literal, gris si no hay) · categoría o «Teléfono» (2 de 3) · Fecha y «hace N días» ·
  Kobo (Efectiva o Sin envío). Derecha, ficha: «Lo que dice la hoja de barrido» (responsable, atención y trámite o
  actor y departamento, origen, último resultado, intentos, fecha, teléfono en uso), observación, «Kobo y tiempos»
  (envío, días sin registro, llamados del responsable ese día) y «Lo que la hoja no registra». Pie: «El supervisor
  decide si se sigue insistiendo. La asignación se cambia en la hoja del equipo; Monitoreo la lee al actualizar.»
- **Datos**: bloque nuevo `cola_insistencia` del motor (una fila por caso no final con `CodPulso`, `Responsable`,
  `Status`, `Intentos`, `Fecha`, `Observación`, categoría de cuota, `efectiva_kobo`, y si existen `OrdenTelefono`,
  `TelefonosIntentados`, `NumTelefonos`, `Origen`). Hoy `detalle_no_contesta` trae parte (sin observación y solo «No
  contesta»). Lista de responsables desde `reintentos_responsable` (`Casos reintentables`, `Promedio intentos`). PDM:
  324 por rellamar, 38 ya efectivas en Kobo; Op-09 con 36 en cola (6 con 3 intentos, 17 con 2, 12 con 1, 1 sin dato);
  ficha PDM1385: SJL, Sin cita previa, Staff ACNUR, Contactar después, 2 intentos, 02/07, observación literal, 25 días al
  corte del 27/07, Op-09 hizo 43 de sus 62 llamados ese día. Medios de Vida: 92 por rellamar; Op-03 con 23 (9 con 10
  intentos o más, 6 con 5 a 9, 8 con 1 a 4); MVH0037 con 18 intentos en el teléfono 4 de 4.
- **Estados**: vacío «Sin casos por rellamar» · sin hoja de barrido «Conecta la hoja de barrido en Insumos, Fuentes» ·
  preparando y error del modo.
- **Capacidad condicional**: teléfonos por caso, teléfono en uso y teléfonos intentados (Medios de Vida 2026); origen.
  Intentos registrados en Kobo para el RMS, si la respuesta a P11 es sí.
- **Contrato**: C1 «Casos por rellamar, con lo que registra la hoja» · C2 la cola mantiene columnas con o sin
  condicionales · C3 vacío propio · C4 15 filas visibles, la lista desplaza dentro del panel · C5 intentos, status y
  observación juntos, que es lo que el supervisor mira.
- **Responsive**: 1366, ficha 300; 1280, «Responsables» pasa a un selector sobre la cola; 1024 × 600, ficha como
  sideover (`panel=caso`).
- **Archivos**: nuevo componente común `features/monitoreo/core/ColaDeInsistencia.tsx` (columnas base y propias por
  configuración, filtros, ficha); nuevo `profiles/telefonico/control/Insistencia.tsx` que lo monta; nuevo
  `profiles/telefonico/control/insistenciaModel.ts` (agrupa por responsable, días sin registro); reutiliza
  `telefonicoTeamModel.ts` (mediana de intentos) y `fusionDeResponsables.ts`. Backend: bloque `cola_insistencia` en un
  archivo nuevo `api/R/monitoreo_telefonico_cola.R` con su test. Acreditación monta el mismo componente en
  `control/contacto/Reintentos.tsx`.
- **Aceptación**: ninguna celda muestra historia, próximo intento, número marcado, «agotado», «de 4» ni botones de
  reasignar; la observación sale literal; las columnas condicionales aparecen solo en Medios de Vida 2026.
- **Decisiones**: P11, P12, P13, P14, P16.

### Control, Discrepancias

- **Dirección**: `…&seccion=control&pestana=discrepancias&panel=caso&foco=<CodPulso>` · readiness
  `monitoreo-telefonico-control-discrepancias`.
- **Tablero**: `Control-Cruce.dc.html` (PDM) y `Control-Cruce-MV.dc.html` (Medios de Vida 2026).
- **Reemplaza**: Consultas CodPulso y la reconciliación del Resumen operativo.
- **Composición**: cabecera «N por revisar» y «N decididos». Grilla `280px minmax(0,1fr) 320px`. Izquierda: «Cómo
  cruzan» (matriz 2 × 2: hoja efectiva o no por Kobo efectiva o no) y «Por revisar» (grupos con su conteo, uno
  seleccionado). Centro: cola del grupo con CodPulso · La hoja dice (status, intentos y fecha) · Responsable · Envío en
  Kobo (fecha y hora) · Enumerador (en ámbar si no es el responsable) · Decisión (Pendiente). Derecha: «Caso por revisar»
  con la hoja (status, intentos y fecha, responsable, observación) y Kobo (envío, fecha y hora, enumerador, duración),
  «Decisión del supervisor» (dos opciones, nota, «Se guarda en el proyecto con quién decidió, cuándo y la nota»),
  caja «Mientras está pendiente: Por definir» y botón «Guardar decisión».
- **Datos**: `comparacion_codpulso` (`Coincidencia`: «Coincide efectiva por CodPulso» 219, «Efectiva Kobo sin tel.
  efectiva» 204, «Tel. efectiva sin efectiva Kobo» 3, «Sin efectiva Kobo» 1,870), cruzado con la hoja (`Estado
  telefónico`, `Fecha`) y con `control_tiempo_kobo` (`Responsable plataforma`, `Duración`, `Response ID`). Grupos PDM:
  Kobo efectiva y la hoja sigue llamando 38 (22 No contesta, 10 Contactar después, 4 Apagado, 1 Colgó, 1 WhatsApp);
  Kobo efectiva y la hoja dice No barrido 166 (162 con responsable, 4 sin asignar); la hoja dice Efectivo y Kobo no tiene
  envío 3 (PDM1114, PDM1153, PDM1154). Medios de Vida: 69 coinciden; 3 la hoja dice Efectivo sin envío (MVH0006,
  MVH0053, MVH0069); 1 envío con código fuera del listado (MVH9999); 2 códigos con dos envíos (MVH0001, MVH0003).
  Decisión: `monitoreo_profile.reconciliation_decisions.manual_case_reconciliations[response_id]` con `action`
  (`include_with_caveat` o `keep_excluded`), `note`, `decided_at`, `previous_status`, `new_status`; ruta y nota
  obligatoria como en `monitoreo_router_acreditacion.R` (`E_MONITOREO_NOTE_REQUIRED`).
- **Estados**: «Sin discrepancias: Kobo y la hoja coinciden en los N casos» · sin hoja de barrido «Sin hoja no hay con
  qué comparar» · sin llave «Declara la llave en Insumos».
- **Capacidad condicional**: el grupo «dos envíos del mismo CodPulso» solo aparece si hay duplicados.
- **Contrato**: C1 «Casos en que Kobo y la hoja de barrido no dicen lo mismo» · C2 la matriz y los grupos mantienen
  marco con 0 casos · C3 vacío por grupo · C4 cola con desplazamiento propio · C5 lo que dicen las dos fuentes y la
  decisión auditada.
- **Responsive**: 1280, matriz arriba de los grupos en una sola tarjeta; 1024 × 600, ficha como sideover.
- **Archivos**: nuevo `profiles/telefonico/control/Discrepancias.tsx`, `discrepanciasModel.ts` (grupos desde
  `comparacion_codpulso`) y `DecisionDeDiscrepancia.tsx`; API nueva en `src/api/monitoreo.ts`
  (`decidirDiscrepanciaTelefonica`) que reutiliza la ruta de decisiones; backend en `api/R/monitoreo_router_telefonico_decisiones.R`
  (nuevo, delgado) con test. `core/balanceDeCruce.ts` y `core/motivoDeNoCruce.ts` se reutilizan.
- **Aceptación**: la suma de grupos es «por revisar»; la decisión guardada aparece con autor y fecha tras recargar; el
  enumerador distinto del responsable se marca.
- **Decisiones**: P1, P2, P3, P4.

### Control, Supervisión

- **Dirección**: `…&seccion=control&pestana=supervision` · readiness `monitoreo-telefonico-control-supervision`.
- **Tablero**: `Control-Supervision.dc.html` (PDM) y `Control-Supervision-MV.dc.html`.
- **Reemplaza**: la supervisión compartida con Acreditación, que hoy sortea sobre las 2,726 filas (12 nunca llamados,
  4 llamados sin efectiva).
- **Composición**: grilla `330px minmax(0,1fr) 320px`. Izquierda «Por enumerador»: efectivas, dos barras superpuestas
  (parte de las efectivas y parte de los casos, misma escala) y casos asignados; enumeradores `K-` en ámbar. Centro
  «Casos sorteados»: #, CodPulso, enumerador, categoría, envío y «Resultado de la rellamada» («Sin hoja de
  supervisión»). Derecha: «Sorteo» (base, casos, porcentaje equivalente, semilla, regla, «Sortear de nuevo»);
  «Enumeradores sin casos» (Por definir); «Resultados de la rellamada» (condicional, «Hoja de supervisión sin conectar»,
  «Conectar en Insumos»).
- **Datos**: base = efectivas únicas de Kobo (`enumerator_var` = `Intro/Enumerator_name`); tamaño = `supervision_n`
  (PDM 20, 4.7 %; Medios de Vida 15, 21.4 %); semilla `supervision_seed` (20260514; 20260731). Reparto proporcional con
  redondeo por mayor resto; muestra dentro de cada enumerador con la semilla. PDM: Op-14 57 efectivas, 3 casos; Op-15
  46, 2; … 6 enumeradores en cero. Medios de Vida: Op-02 23, 5; Op-04 18, 4; Op-01 17, 4; Op-03 12, 2. Los casos de la
  maqueta salen de ese sorteo corrido sobre la copia (`scripts/sup2.R`); el motor aún no sortea así.
- **Estados**: «Sin efectivas para sortear» · «Hoja de supervisión sin conectar».
- **Capacidad condicional**: hoja de resultados de supervisión (fuente propia de Insumos).
- **Contrato**: C1 «Efectivas sorteadas para volver a llamar, en proporción a cada enumerador» · C2 lista estable con
  1 a 30 casos · C3 resultado vacío explícito · C4 todo visible · C5 reparto verificable a simple vista.
- **Responsive**: 1280, el reparto pasa a una franja horizontal sobre la lista; 1024 × 600, la columna derecha baja.
- **Archivos**: nuevo `profiles/telefonico/control/Supervision.tsx` y `supervisionModel.ts`; backend: cambiar
  `monitoreo_supervision_sample` para estratificar por enumerador sobre efectivas en un archivo nuevo
  `api/R/monitoreo_supervision_estratificada.R`, con test del reparto (mayor resto) y de la semilla.
- **Aceptación**: la suma por enumerador es el tamaño; misma semilla, misma lista; ningún caso fuera de efectivas.
- **Decisiones**: P4, P5, P6, P7.

### Control, Barrido

- **Dirección**: `…&pestana=barrido` · **Tablero**: `Llamadas-Embudo.dc.html`.
- **Reemplaza**: Resumen operativo.
- **Composición**: embudo simétrico de cuatro tarjetas (listado 2,296, muestra 1,111, llamados 631, efectivas en la hoja
  222) con barras de 16 px; matriz sede × familia con filas de 46 px; debajo, «Llamados por fecha del último intento»
  (30/06 59, 01/07 207, 02/07 356, otra o sin fecha 9; la hoja deja de registrar el 02/07) y «Sin llamar» por sede (SJL
  121, SMP 117, Cercado 102, Pueblo Libre 83, Chorrillos 57; asignados 468, sin asignar 12, reserva 1,185); a la derecha
  status del cliente con su regla («sin regla» en ámbar).
- **Datos**: `resumen_telefonico`, `estatus_telefonico`, `estatus_actor_dia`; 13 status; la hoja dejó de registrar el
  02/07 y Kobo siguió hasta el 06/07.
- **Estados / C1–C5 / Responsive**: como el patrón; C1 «Cómo rinde la hoja de barrido».
- **Archivos**: nuevo `profiles/telefonico/control/Barrido.tsx`; reutiliza `conteoDeEquipo.ts`.
- **Aceptación**: las cuatro tarjetas tienen la misma estructura y la barra el mismo grosor (medición h).
- **Decisiones**: ninguna nueva.

### Control, Equipo

- **Dirección**: `…&pestana=equipo` (vista `&panel=estados` para la matriz) · **Tableros**: `Llamadas-Equipo.dc.html`
  (carga) y `Llamadas-Equipo-Estados.dc.html` (status por operador).
- **Reemplaza**: Responsables (`TelefonicoTeamDiagnostics.tsx`).
- **Composición**: selector «Carga | Estados por operador». Carga: 15 filas con asignados, llamados (barra), sin llamar,
  efectivas hoja y Kobo, brecha, % sin efectiva y días; fila «Sin asignar» en gris. Estados: matriz operador × 8 status
  en % y casos, fila del equipo, celdas ámbar (12 puntos o más sobre la mediana) y azules (por debajo). Ficha del
  operador a la derecha (familias, llamados por día, casos por sede).
- **Datos**: `operacion_responsable`, `estatus_responsable`; regla `UMBRAL_DESVIACION_PP = 12` y
  `MINIMO_CASOS_PARA_COMPARAR = 10` de `telefonicoTeamModel.ts`; medianas No barrido 39, Efectivo 22.6, No contesta 15.9;
  18 desvíos (Op-01 No barrido 92.5 %; Op-09 No contesta 30.9 %; Op-15 Apagado 22.7 %).
- **Archivos**: nuevo `profiles/telefonico/control/Equipo.tsx` y `EquipoMatriz.tsx`; reutiliza `telefonicoTeamModel.ts`.
- **Aceptación**: los 18 desvíos coinciden con el modelo de hoy.

### Control, Respuestas

- **Dirección**: `…&pestana=respuestas` · **Tablero**: `Control-Respuestas.dc.html`.
- **Reemplaza**: Efectivas Kobo, Validación de tiempo y Salvedades.
- **Composición**: cadena 430, 427, 424, 423; histograma de duración (mediana 29 min, 57 de más de 2 h); registro con
  filtros y «Por revisar (75)».
- **Datos**: `control_tiempo_kobo` (`Duración segundos`, `Clasificación`); hoy rotula «Normal» a los 57 de más de 2 h.
- **Archivos**: nuevo `profiles/telefonico/control/Respuestas.tsx`; reutiliza `filtroEfectiva/`.

### Control, Avisos

- **Dirección**: `…&pestana=avisos` · **Tablero**: `Control-Avisos.dc.html`.
- **Reemplaza**: Alertas reales (`TelefonicoPhoneAlerts.ts`).
- **Composición**: 8 grupos por causa (PDM) con nivel, conteo, detalle y destino; «Casos sin asignar» (1,197: 1,185 de
  reserva sin abrir y 12 de la muestra).
- **Datos**: `.monitoreo_report_alerts_df`; avisos `cruce_llave_bajo`, `filtro_columna_no_encontrada`,
  `status_desconocido` (84 casos con 6 valores si se activan las reglas), `duracion_muy_larga` (57).
- **Archivos**: nuevo `profiles/telefonico/control/Avisos.tsx`; reutiliza `TelefonicoPhoneAlerts.ts`.

### Insumos, Fuentes · Llave y filtros · Estados

- **Tableros**: `Insumos-Fuentes.dc.html`, `Insumos-Llave.dc.html`, `Insumos-Estados.dc.html` (PDM).
- **Reemplazan**: Fuentes activas, Universo y barrido, Encuestas, «Estados y colores».
- **Composición y datos**: fuentes con mapeo de columnas y validación; switches de capacidades con vista previa (reserva
  encendida: muestra sin llamar 1,665 a 480, sin asignar 1,197 a 12); llave con normalización (420 exactas, 6 sin
  prefijo, 3 con espacio, 1 no cruza: 429 de 430) y variables de control; vocabulario de 13 status con familia y
  switches «Intento», «Contacto» y «Cierra», más «Status por reglas» (6 valores, 84 casos). Estados ya no tiene editor de
  agotado: muestra «Intentos que registra la hoja» (sin dato 2, 1: 76, 2: 126, 3: 115, 4: 4, 5: 1) y la nota «Sin regla
  de agotado».
- **Archivos**: reutilizan `fuentes/` (`CadenaDeFuentes.tsx`, `camposDeFuente.ts`, `eslabonesDelContrato.ts`) y
  `TelefonicoSourcesModel.ts`; nuevo `profiles/telefonico/insumos/Estados.tsx`.

### Modelo, Cuotas y calendario · Reserva (condicional)

- **Tableros**: `Modelo-Cuotas.dc.html` y `Modelo-Reserva.dc.html` (PDM; «Ver con» alterna RMS 2026).
- **Cuotas**: candidatas de eje, metas frente a proporcional, validación y calendario de días y horas. Una variable,
  como máximo dos; sin metas por enumerador. Reutiliza `MetaCuotaInput.tsx`, `TelefonicoActorGoals.ts`.
- **Reserva**: «Cómo se reconoce» (PDM: columna `Origen`, Muestra 1,111 y Backup 1,185; RMS: hojas MUESTRA (MAIN) y
  BACKUP, 400 y 400, sin códigos repetidos), «Lo que ya se sabe» (ocupa el cupo del caso que reemplaza; se abre cuando un
  caso de la muestra no rinde; PDM y RMS; Medios de Vida 2026 sin reserva), muestra y reserva por categoría (PDM por sede;
  RMS 100 y 100 por periodo) y caja «Por definir» (P8, P9).
- **Archivos**: nuevo `profiles/telefonico/modelo/Reserva.tsx`; dato nuevo en el perfil `reserve` (columna y valor que
  la reconocen).

### Avance, Ritmo · Reemplazos (condicional) · Entregas

- **Ritmo** (`Avance-Ritmo.dc.html`): barras diarias apiladas Kobo y hoja (la hoja se detiene el 02/07), mapa de calor,
  hora de inicio (08 a 22 h) y formatos de fecha (7 valores, 2 formatos, 3 con año 2020, 6 en blanco). Reutiliza
  `TelefonicoPhoneDailyTrend.ts` y `avance/ritmoDiario.ts`.
- **Reemplazos** (`Avance-Reemplazos.dc.html`): configuración del RMS «—» y PDM derivado; sin la columna de pareja (P8)
  se muestran totales abiertos.
- **Entregas** (`Avance-Entregas.dc.html`): «Para el cliente: avance por cuota» con vista del PDF (sede, meta,
  efectivas, faltan, avance) y «Publicar en la hoja del cliente»; «Para el equipo»: PDF de producción (faltante,
  insistencia, discrepancias, supervisión, equipo; contenido propuesto) y «Publicar en la hoja interna»; «Por definir»
  (P15). Reutiliza `salidas/MonitoreoOutputsWorkbench.tsx` (`client_last_sheets`, `internal_last_sheets`).

### Paneles y estados

- **Actualizar** (`Panel-Actualizar.dc.html`): pasos por fuente (hoja de barrido relee 2,296 filas, unos 2 s; Kobo
  incremental; recalcular, unos 8 s), lo que no toca, paso en curso y recibo. Publicar no está aquí.
- **Estados** (`Estados.dc.html`): vacío con RMS 2026 (tres pasos: fuentes con el listado de 800, llave Código proGres
  e `Intro01`, eje «Por definir»); preparando y error en Avance, Cuotas de PDM (`E_KOBO_TOKEN_REJECTED`); sin capacidad
  con Medios de Vida 2026 en Avance, Reemplazos («Este proyecto no declara reserva»).

---

## 4. Medición de composición (Playwright sin servidor, 1440 × 1000)

Script: scratchpad `telefonico2/scripts/medir.cjs` (criterios a–i del estándar §2a) y `scripts/recortes.cjs`
(contenido recortado por `overflow`). Corrida final del 23/10, tras la unificación con Territorial y Acreditación: los 30 tableros medidos pasan;
0 recortes; 30 capturas distintas (`md5`). Main es un diagrama y no se mide.

| Tablero | (a) vacío al pie | (b) choques | (c) fuera de escala | (d) columnas | (f) vacío interno | (g) elipsis | (h) simetría | (i) formato es-PE | Resultado |
|---|---|---|---|---|---|---|---|---|---|
| Avance-Cuotas-MV | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Avance-Cuotas | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Avance-Entregas | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Avance-Reemplazos-PDM | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Avance-Reemplazos | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Avance-Ritmo | 0 px | 0 | 0 | 0 px | 17 px | 0 | 0 | 0 | pasa |
| Control-Avisos | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Control-Cruce-MV | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Control-Cruce | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Control-Respuestas | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Control-Supervision-MV | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Control-Supervision | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Estados-Error | 0 px | 0 | 0 | 0 px | 0 px | 0 | 0 | 0 | pasa |
| Estados-Preparando | 0 px | 0 | 0 | 0 px | 0 px | 0 | 0 | 0 | pasa |
| Estados-SinCapacidad | 0 px | 0 | 0 | 0 px | 0 px | 0 | 0 | 0 | pasa |
| Estados | 0 px | 0 | 0 | 0 px | 0 px | 0 | 0 | 0 | pasa |
| Insumos-Estados | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Insumos-Fuentes | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Insumos-Llave | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Llamadas-Embudo | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Llamadas-Equipo-Estados | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Llamadas-Equipo | 0 px | 0 | 0 | 0 px | 1 px | 0 | 0 | 0 | pasa |
| Llamadas-Insistencia-MV | 0 px | 0 | 0 | 0 px | 9 px | 0 | 0 | 0 | pasa |
| Llamadas-Insistencia | 0 px | 0 | 0 | 0 px | 9 px | 0 | 0 | 0 | pasa |
| Modelo-Cuotas | 0 px | 0 | 0 | 0 px | 3 px | 0 | 0 | 0 | pasa |
| Modelo-Reserva-RMS | 0 px | 0 | 0 | 0 px | 9 px | 0 | 0 | 0 | pasa |
| Modelo-Reserva | 0 px | 0 | 0 | 0 px | 9 px | 0 | 0 | 0 | pasa |
| Panel-Actualizar-Corriendo | 0 px | 0 | 0 | 0 px | 0 px | 0 | 0 | 0 | pasa |
| Panel-Actualizar-Recibo | 0 px | 0 | 0 | 0 px | 0 px | 0 | 0 | 0 | pasa |
| Panel-Actualizar | 0 px | 0 | 0 | 0 px | 0 px | 0 | 0 | 0 | pasa |

Solo se midió 1440 × 1000; 1366, 1280 y 1024 × 600 quedan descritos en cada ficha y sin medir.

---

## 5. Datos: origen, derivados y lo que no se pudo obtener

- **Origen**: `state$monitoreo_snapshot$data` de las copias (`.source_role` barrido, respuestas, universo) leído con
  `Rscript`; bloques del motor (`.monitoreo_report_phone_blocks`) de PDM guardados en `work/pdm_blocks.rds`. Sin red, sin
  `R CMD INSTALL`, sin servidores en 8787 ni 5173 (las capturas de hoy usaron el runner en puertos propios).
- **Derivados por mí sobre datos reales**: faltante diario de Medios de Vida; familias por categoría; sorteo
  estratificado de supervisión (algoritmo propuesto, no el del motor); grupos de discrepancia de Medios de Vida
  (cruce exacto por `Intro/Pulso_code` sin la normalización del motor); días sin registro; códigos `Op-` y `K-`.
- **No se pudo obtener**:
  - Historia de llamadas, hora y número marcado por intento: la fuente no los registra (por diseño del operativo).
  - Resultados de supervisión: no hay hoja conectada en ningún proyecto de ejemplo (P7).
  - RMS: barrido, respuestas, cuota y metas; aún no existe el `.pulso` (P10).
  - Tiempo real de Actualizar en Medios de Vida y del warm start: no medidos.
  - Contenido actual del PDF de producción y destino exacto de la publicación interna: no se leyó el motor de salidas.
  - Los grupos de discrepancia de Medios de Vida no pasaron por `comparacion_codpulso` (el `.pulso` no trae bloques
    en caché y no corrí el motor completo sobre él).

---

## 6. Capturas

Renders del lienzo en el scratchpad `telefonico2/render/` (`Avance-Cuotas.png`, `Llamadas-Insistencia.png`,
`Llamadas-Insistencia-MV.png`, `Control-Cruce.png`, `Control-Cruce-MV.png`, `Control-Supervision.png`, …) y capturas
de la app de hoy en `telefonico2/hoy/capturas/`.
