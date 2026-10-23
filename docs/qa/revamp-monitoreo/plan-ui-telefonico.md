# Plan de aplicación a la UI: Monitoreo telefónico

Tipo: Plan de implementación
Estado: Vigente
Fecha: 2026-10-23
Autoridad: Gonzalo, textual: «la idea es aprobar los diseños cuando todo se vea bien y coherente y aplicarlo a la UI,
con prioridad por el telefónico» y «una vez ya lo veas bien, aplícalo; no voy a poder dar aprobación explícita».
Diseño: `docs/qa/revamp-monitoreo/telefonico.md` (fichas), lienzo «Revamp de Monitoreo · Telefónico»,
`estandar-de-ficha.md` y `procedimientos-respondidos.md`.

## Reglas de ejecución

- Rama `revamp-monitoreo-telefonico` en un worktree propio; nunca se edita `main` directamente. Al cerrar cada fase con
  gate verde y verificador conforme, la rama se fusiona en `main` local. Nunca push, tag ni release.
- Antes de tocar `frontend/src/features/monitoreo/profiles/telefonico/` se avisa a la sesión «ACNUR RMS», que trabaja
  el backend de reemplazos del telefónico.
- `TelefonicoMonitoreoPage.tsx` está congelado (línea base 20,486 en `agentic/manifest.json`): solo cambia el montaje;
  todo lo nuevo va en archivos propios. Lo mismo para `monitoreo_engine.R` y `router_monitoreo.R`.
- Máximo dos escritores a la vez con globs sin solape (frontend-react en `frontend/`, backend-r en `api/`).
- Nada que dependa de una pregunta abierta de `telefonico.md` §0 se implementa: queda el estado «Por definir» del
  diseño o la pieza actual sin cambios.
- Gate por fase: `pnpm -C frontend typecheck`, `make gate-front AREA=monitoreo`, `make gate-area` del área R tocada
  con `GATE_ARGS='--patron "telefonico"'`, captura a 1440 × 1000 y 1024 × 600 con el runner de `ui-quick-check` sobre una
  copia de `ACNUR_PDM.pulso` en puertos propios (nunca 8787 ni 5173), y agente `verificador`.

## Fases

| # | Fase | Contenido | Depende de | Estado |
|---|---|---|---|---|
| T0 | Preparación | Worktree, `pnpm install`, copia de `ACNUR_PDM.pulso` y de `PDM_MedVida2026.pulso`, capturas «antes» de las pestañas actuales, aviso a «ACNUR RMS» | diseño conforme | ☐ |
| T1 | Navegación | Catálogo `telefonico` en `lib/navegacion/catalogos/monitoreo.ts` con Insumos · Modelo · Control · Avance y sus pestañas; alias de las direcciones viejas (se leen, nunca se escriben); aterrizaje en Avance › Cuotas; contratos `modulesNavigation`, `auditReadyRoutes`, `direccion` | T0 | ☑ |
| T2 | Chrome común | Cabecera de pestaña de 44 px, CORTE y FALTAN en la barra del modo, insignias en las píldoras, píldora de estado común, pie del rail con CORTE, switch `#002457` | T1 | ☑ |
| T3 | Avance › Cuotas | `avance/CuotasFaltante.tsx`, `avance/FaltanteDiario.tsx`; reutiliza `segmentoDeCuotas.ts`, `metasPendientes.ts`, `telefonicoGoalModel.ts`, `avance/ritmoDiario.ts` | T2 | ☑ |
| T4 | Control › Insistencia | Backend: bloque `cola_insistencia` en `api/R/monitoreo_telefonico_cola.R` con test. Front: `core/ColaDeInsistencia.tsx`, `control/Insistencia.tsx`, `control/insistenciaModel.ts` | T2 | ☑ |
| T5 | Control › Barrido y Equipo | `control/Barrido.tsx`, `control/Equipo.tsx`, `control/EquipoMatriz.tsx`; reutiliza `conteoDeEquipo.ts`, `telefonicoTeamModel.ts` | T2 | ☑ |
| T6 | Control › Respuestas y Avisos | `control/Respuestas.tsx`, `control/Avisos.tsx`; reutiliza `filtroEfectiva/`, `TelefonicoPhoneAlerts.ts` | T2 | ☑ |
| T7 | Insumos | Fuentes, Llave y filtros, Estados (`insumos/Estados.tsx`), reutilizando `fuentes/` | T2 | ☑ |
| T8 | Modelo y Avance restantes | Cuotas y calendario, Ritmo, Entregas; Reserva y Reemplazos condicionales | T2; Reserva y Reemplazos esperan P8–P9 y el contrato de «ACNUR RMS» | ◐ (Cuotas, Ritmo y Entregas hechas; Reserva y Reemplazos esperan) |
| T9 | Control › Discrepancias y Supervisión | Discrepancias con decisión auditada; supervisión estratificada | **Bloqueada** por P1–P7 | ⛔ |

Orden de la noche: T0, T1, T2, T3, T4, y luego T5 a T7 si el tiempo alcanza. Cada fase cierra en su propio commit en
español (conventional commits) con el diseño citado.

## T4 backend: contrato de `cola_insistencia` (commit c797a1a0e)

Archivo `api/R/monitoreo_telefonico_cola.R`, enganchado en `.monitoreo_report_phone_blocks` (`monitoreo_telefonico.R`,
+9 líneas; ningún congelado crece). Los bloques viven en `reports.sheets[id="monitoreo_telefonico"].blocks`, solo en
la familia `telefonico`. Vacío o NA llega como `""`.

`cola_insistencia`, una fila por caso barrido no final (tope 5000; la nota dice el corte):
`CodPulso` · `Responsable` («Sin asignar» si vacío) · `Sin asignar` (bool) · `Status` (literal) · `Intentos` (int o
"") · `Fecha` (ISO o "") · `Observación` (literal) · `Variable cuota` · `Cuota` · `efectiva_kobo` (bool) ·
`dias_sin_registro` (int o "") · `Criterio cola` · condicionales `OrdenTelefono`, `TelefonosIntentados`,
`NumTelefonos`, `Origen`. Orden neutro; el frontend ordena (P12 abierta).

`cola_insistencia_responsables`: `Responsable` · `Sin asignar` · `Casos en cola` · `Ya efectivas en Kobo` ·
`Promedio intentos` · `Sin dato de intentos` · `Por llamar`.

«No final»: fuera los efectivos y «No barrido»; si el status casa con `state_rules`, manda la familia declarada
(salen `stop_contact`, `complete`, `refusal`, `excluded`); si no, la clasificación `reattempt_mask` del motor.

Cifras reales: PDM 374 por rellamar (el diseño decía 324 con una lista cerrada; la diferencia es Número suspendido 31,
No efectivo 11, «Número Incorrrecto» 6 y Encuesta parcial 2), 38 ya efectivas en Kobo, Op-09 42; Medios de Vida 2026
82 (el diseño decía 92; salen los Rechazo, declarados `stop_contact`), Op-03 23. Gate: 398 pass, 0 fail.

Para el frontend: bloque ausente en snapshots viejos se trata como «Preparando» con invitación a Actualizar; sin hoja de
barrido, bloques vacíos con nota. El worker `callr` usa el paquete instalado y no tendrá el bloque hasta reinstalar.

## Preguntas surgidas en la implementación

- **P13 (qué forma la cola)**: hoy decide el vocabulario del proyecto; si Gonzalo quiere sacar «Número suspendido» o
  «No existe el número», basta con marcar «Cierra» en Insumos › Estados.
- **Corte**: el reporte no recibe `synced_at` (pasarlo exige tocar `monitoreo_engine.R`, congelado); usa la fecha de
  armado. En Medios de Vida 2026 hay fechas de la hoja posteriores al sync y `dias_sin_registro` sale negativo.
- **«Sin asignar» por origen**: separar Muestra de Backup depende de P8–P9 y del contrato de «ACNUR RMS»; hoy va el
  total (PDM 1,197).
- **Acreditación con barrido**: el bloque no se publica ahí todavía; montarlo en `Reintentos.tsx` es una línea cuando
  se unifique.
- **MEDVID 2025**: «Observación de rebarrido» no entra en la cola.
- **Llave y mapeo de columnas sin editor**: ninguna superficie de la app edita `monitoreo_profile.key_rules` (columnas
  candidatas de la llave, en orden) ni las `dimensions` de una fuente; el panel de conexión sólo elige la pestaña.
  Insumos los muestra en lectura. ¿Hace falta editarlos desde la app, o basta con el perfil del estudio?
- **Hallazgo, tarjeta de Kobo «sin respuestas»**: en la copia de PDM la tarjeta de la encuesta decía «Conectada, sin
  respuestas todavía. Sincroniza Kobo.» con 424 efectivas en el corte: cuenta las respuestas con la metadata del sync
  (`response_count`), que la copia no trae. Insumos ya no pinta esa frase, pero la cuenta de la tarjeta sigue
  dependiendo de esa metadata.
- **P18 (dos vocabularios de familia)**: el definidor de estados guarda en `state_rules` familias de acreditación
  (`efectivo`, `sin_contacto`, `numero_invalido`, `rechazo`, `otro`, `sin_barrer`), que gobiernan colores y agrupación
  de los gráficos. El motor cuenta con `complete`, `partial`, `refusal`, `pending`, `non_effective` y `excluded`
  (`monitoreo_status_reglas.R`). Un status confirmado en el definidor casa con una regla que no decide nada, así que
  deja de dar `status_desconocido` sin contar. Opciones: (a) traducir al guardar; (b) que el definidor del telefónico
  use las familias del motor; (c) dejarlo así y sólo avisar. Hoy Insumos › Estados muestra las dos: la que se guarda,
  editable, y la del motor en lectura, con la marca «difiere» cuando no corresponden.

## Notas de T1 a T3 (frontend)

**T1, navegación.** Catálogo público `MONITOREO_PESTANAS.telefonico` con Insumos (Fuentes, Llave y filtros, Estados),
Modelo (Cuotas y calendario), Control (Barrido, Insistencia, Equipo, Discrepancias, Respuestas, Avisos) y Avance
(Cuotas, Ritmo, Entregas): 13 pestañas. Las vistas que la página monta siguen con su clave histórica en
`MONITOREO_PESTANAS_INTERNAS_TELEFONICO`; la tabla `profiles/telefonico/navegacion/direccionTelefonica.ts` traduce en las
dos direcciones y lee las claves viejas como alias (`seccion=telefonico&pestana=incidencia` termina en
`seccion=control&pestana=insistencia`). Cuando una pestaña absorbe más de una vista, las demás cuelgan como sub-vista
direccionable con `panel`: Respuestas (`tiempos`, `salvedades`; Salvedades sólo si hay efectivas no identificables) y
Cuotas y calendario (`calendario`). Sin dirección, el modo aterriza en Avance › Cuotas.

- **Supervisión no se declaró**: hoy no existe en el modo telefónico (la página la oculta) y su diseño está bloqueado
  por P4–P7 (T9). Queda para T9.
- Reserva y Reemplazos no se declararon (P8–P9), como pide el plan.
- `scripts/build-visual-catalog.mjs` y `scripts/monitoreo-performance-check.mjs` todavía nombran las secciones viejas
  del telefónico; están fuera del glob del frontend. Funcionan por alias, pero conviene actualizarlos.

**T2, chrome común.** La barra del modo dice MODO, EJE DE CUOTA («Sede, 5 valores») y FALTAN («0 de 400», verde si
cumple y carmesí si falta); las píldoras llevan insignia (Control: casos en que Kobo y la hoja no coinciden, PDM 207;
Avance: efectivas sobre la meta, 106 %); a la derecha CORTE («27/07/26 09:04»), la píldora de estado y Actualizar
partido (el menú ofrece «Sólo respuestas de Kobo», que es el sync de avance de hoy). Cabecera de pestaña de 44 px con
antetítulo «CONTROL · LLAMADAS» / «CONTROL · CASOS»; rail con «CORTE» gris al pie; switch encendido azul marino con el
token nuevo `--pulso-brand-navy`. Se retiró la franja de lectura (Efectivas Kobo, CodPulso, Base tel.): FALTAN va en la
barra y el resto vive en Respuestas, Discrepancias y Barrido.

- El chrome es compartido: `MonitoreoModuleChrome` gana la prop opcional `barraDelModo` (piezas en
  `shell/BarraDelModo.tsx`); Acreditación, Territorial y Cursos-horario no la pasan y se pintan igual que antes.
- **Píldora «Actualizando, paso N de M»**: el job de sincronización sólo publica porcentaje y fase, no pasos; la píldora
  dice «Actualizando» y el avance va en el `title` del botón. Contar pasos exige que el backend los publique.
- **P17 sigue abierta**: con cambios sin recalcular la píldora dice «Pendiente» (ámbar), como hoy, y no «Al día» como
  dibuja el lienzo. Por eso PDM muestra «Pendiente» en las capturas.
- A 1024 × 600 las insignias ceden (se ocultan) para que los rótulos de sección no se recorten.

**T3, Avance › Cuotas.** `profiles/telefonico/avance/CuotasFaltante.tsx` (tabla y columna derecha),
`FaltanteDiario.tsx` (faltante al cierre de cada día, con menos de cuatro categorías), modelo puro
`cuotasFaltanteModel.ts` con test y `entradaDeCuotas.ts`, que arma la entrada desde bloques que ya viajan
(`cuotas_variable`, `avance_efectivo_variable_dia`, `no_barridos_responsable`, `control_tiempo_kobo`). Ritmo y
rendimiento salen de `buildTelefonicoCumplimiento`. Verificado en vivo: PDM 0 de 400 en verde, 423 efectivas, 105.8 %,
cumplida el 06/07, ritmo 60.4, rendimiento 1.5; Medios de Vida 31 de 100 en carmesí (el corte de la copia trae 69
efectivas, no las 70 del lienzo), faltante diario 68, 57, 49, 36, 25 y 16, 13, 12, 10, 6.

Diferencias con el lienzo, por datos que el payload no trae (no se inventaron):

- **Muestra por categoría**: el lienzo separa Muestra de Backup y reparte por familia de status de la hoja (efectiva
  en la hoja, reintentable, rechazo o parcial, terminal). Ningún bloque trae status por cuota ni el origen
  (`estatus_actor_dia` viene por fuente, no por sede). El panel se llama «Listado por sede» y reparte el listado completo
  con lo que `cuotas_variable` sí trae: efectivas, rechazos o parciales, llamados sin efectiva y sin llamar.
- **Sin llamar y Sin asignar** cuentan el listado entero (PDM 1,665 y 1,197), no sólo la muestra (480 y 12): separar
  Muestra de Backup depende de P8–P9.
- **De dónde sale la cifra**: el lienzo tiene cuatro pasos (recibidas 430, reales 427, con consentimiento 424, únicas
  423). El corte trae «pasan el filtro de efectiva» (filas de `control_tiempo_kobo`, 424, con los criterios del filtro)
  y las únicas (423). «Recibidas en Kobo» sale sólo si la metadata del sync trae `response_count`; en las copias no
  viene. Para los cuatro pasos el motor tendría que publicar la cadena.
- El chip de proyecto, el dock y la píldora «Pendiente» (P17) difieren por el proyecto y su estado, no por la vista.
- `TelefonicoGoalPanel.tsx` no se tocó: no está montado en esta pestaña.

**T4 frontend, Control › Insistencia.** `features/monitoreo/core/ColaDeInsistencia.tsx` (común: filtros, responsables,
cola y ficha, con sus piezas en `core/colaDeInsistencia/` y el modelo puro `core/colaDeInsistenciaModel.ts`),
`profiles/telefonico/control/Insistencia.tsx` (lo monta con los bloques `cola_insistencia` y
`cola_insistencia_responsables`) e `insistenciaModel.ts` con test. La ficha es `panel=caso&foco=<CodPulso>`
(`usePanelDireccionable`); al cambiar de pestaña el panel y el foco se cierran. Orden por defecto «Más intentos primero»,
configurable (P12). Filtros en un store de zustand. Verificado en vivo: PDM 374 por rellamar y 38 ya efectivas en Kobo;
Medios de Vida 82 por rellamar y ninguno efectivo en Kobo.

- **Paridad con la vista anterior**: la escala de intentos va en la cabecera de la cola, en una frase; los casos por
  responsable y la intensidad frente a la mediana del equipo (mismos umbrales, ±25 %), en la lista de responsables
  (barra de intentos por caso con la marca de la mediana); «Sin asignar» va aparte y en gris; los casos por llamar ya
  asignados y los casos repartidos, en la línea bajo «Responsables»; los «no contesta» se filtran por Último resultado.
- **Días sin registro** se cuentan contra el CORTE (`synced_at`) en el frontend: el bloque los resta contra la fecha de
  armado y daba 113 días en PDM donde la hoja lleva 25. En Medios de Vida las fechas son posteriores al corte y la cola
  dice «después del corte».
- **Kobo** se rotula «Efectiva» o «Sin efectiva» y no «Sin envío»: el bloque dice si hay efectiva, no si hubo envío.
- **No están** (el bloque no los trae): Atención y Trámite en la ficha de PDM, «Llamados del responsable ese día» y
  «Sin envío hasta el 06/07». «Teléfonos por caso» cuenta los casos de la cola, no el listado de 183.
- **Preparando**: si el corte no trae el bloque, la pestaña lo dice e invita a Actualizar. En la práctica el motor lo
  arma en vivo al pedir el scope (la copia con caché viejo también lo trajo); las copias sin caché están en el
  scratchpad (`impl/pdm_cola.pulso`, `impl/mv_cola.pulso`).
- `scripts/build-visual-catalog.mjs` y `scripts/monitoreo-performance-check.mjs` ya nombran Insumos, Modelo, Control y
  Avance.

**T5, Control › Barrido.** `profiles/telefonico/control/Barrido.tsx` con `barridoModel.ts` (test) y
`familiasDelCliente.ts`, que ubica cada status de la hoja en Efectiva, Parcial, Rechazo, Reintentable o Terminal según
`state_rules` (mismo emparejamiento que el motor) y marca «sin regla» lo que el vocabulario no declara. Embudo de cuatro
tarjetas simétricas (Listado, Llamados, Efectivas en la hoja, Sin llamar), listado por categoría, llamados por fecha del
último intento (PDM 59, 207, 356 y 9 en «otra o sin fecha», igual que el lienzo), sin llamar por categoría con asignados
y sin asignar, y status del cliente con su regla. Datos de `resumen_telefonico`, `estatus_telefonico`, `estatus_dia`,
`no_barridos_responsable` y `cuotas_variable`.

- **No viaja y no se inventó**: la tarjeta «Muestra 1,111» y la reserva 1,185 (columna `Origen`, P8–P9), y la familia de
  status por categoría (Reintentable y Terminal por sede): la tabla por categoría reparte con parciales, rechazos, sin
  llamar y efectivas en Kobo de `cuotas_variable`.
- Las familias siguen el vocabulario declarado, como la cola: en PDM «Número suspendido» es Reintentable
  (`non_effective`) y no Terminal como en el lienzo; en Medios de Vida «Rechazo» cae en Terminal porque su regla cierra.
- El resumen anterior (conciliación Kobo y hoja, embudo de la cifra y tarjetas por responsable) sigue en Discrepancias,
  Respuestas, Avance › Cuotas y Equipo.

**T5, Control › Equipo.** `profiles/telefonico/control/Equipo.tsx`, `EquipoMatriz.tsx` y `equipoModel.ts` (test con
`estatus_responsable` real de PDM anonimizado en `control/fixtures/`). Selector «Carga | Estados por operador»
(`panel=estados`) y ficha del operador elegido (`foco=<operador>`). Carga por persona (suma las filas de dos actores):
asignados, llamados, sin llamar, efectivas en la hoja y en Kobo, brecha (efectivas de Kobo que la hoja no marca), sin
efectiva sobre llamados e intentos por caso reintentable; fila «Sin asignar» aparte. Estados por operador con
`buildTelefonicoStatusMatrix`: los 18 desvíos de PDM coinciden con el modelo de hoy (test).

- **No viaja y no se inventó**: la columna «Días» y «Llamados por día» del operador (no hay status por responsable y
  fecha) y «Casos por sede» del operador (no hay responsable por cuota). En su lugar la ficha lista los status de la
  hoja del operador con su familia, que sí viajan en `estatus_responsable`, y su insistencia (`reintentos_responsable`).
- La paridad con Responsables se conserva: la matriz con desvíos, la brecha con Kobo por responsable y las cifras de las
  tarjetas (asignados, barridos, efectivas, sin efectiva, por barrer) están en Carga y en la ficha.

**T6, Control › Respuestas.** `profiles/telefonico/control/Respuestas.tsx` con `respuestasModel.ts` (test), sobre
`control_tiempo_kobo` y `comparacion_codpulso`. Cadena (pasan el filtro 424, efectivas 423 con «1 envío repetido»),
duración de las efectivas en tramos con la mediana (PDM 29 min) y los de más de 2 h en rojo (PDM 56, que hoy se rotulan
«Normal (5+ min)»), «Qué cuenta» con los criterios del filtro y la regla de un envío por CodPulso, y el registro de cada
efectiva con llave (exacta, normalizada por dígitos o no cruza), lo que dice la hoja, responsable y marcas, con chips
Por revisar, Todas, Más de 2 h, Menos de 5 min, Repetidas y No cruzan. Integra «Validación de tiempo»: `panel=tiempos`
se lee como la pestaña y se limpia de la dirección. Salvedades sigue como sub-vista condicional.

- **No viaja y no se inventó**: «Recibidas en Kobo 430» y «Reales 427» (el bloque ya trae los envíos filtrados; los
  recibidos sólo aparecen si la metadata del sync trae `response_count`), y los chips «Prueba» y «Sin consentimiento».
  Por eso el histograma es de 424 efectivas y no de 430 envíos, y los de más de 2 h son 56 y no 57.
- La llave «normalizada» se calcula en la vista (dígitos que señalan un único caso de la hoja); el motor normaliza por
  su cuenta y su regla exacta no viaja.

**Pulido de T5.** Barrido: el panel «Status del cliente» lleva al pie «Lo que la hoja no registra». Barrido y Equipo:
un status que la regla del proyecto pone en otra familia que su nombre (en Medios de Vida «Rechazo» cierra) se rotula
«Terminal por su regla».

**T6, Control › Avisos.** `profiles/telefonico/control/Avisos.tsx` con `avisosModel.ts` (test). Lee las alertas reales con
`TelefonicoPhoneAlerts.ts`, como la vista anterior, y las agrupa por causa con nivel, cuántos, detalle y dónde se
corrige (enlace a la pestaña, o «Hoja del equipo» cuando se corrige fuera de la app). Las alertas que venían una por
responsable («Responsable con casos por iniciar», 11 en PDM) se agrupan en una causa con desglose por persona en la
ficha. Los avisos fuertes del RMS (`cruce_llave_bajo`, `filtro_columna_no_encontrada`, `status_desconocido`) se agregan
cuando el bloque los trae; en las copias de PDM y Medios de Vida no vienen y no se dibujan. «Casos sin asignar» va
aparte y en gris. Además se leen de bloques que ya viajan cuatro avisos que el motor no emite como alerta: efectivas
en Kobo cuyo caso sigue «No barrido» (PDM 166), duración mayor a 2 h (56), CodPulso repetido en Kobo (1) y fecha de la
hoja irregular (9).

- **No viaja**: el «Formato de CodPulso» como sugerencia de formulario y el último envío de Kobo frente al último día de
  la hoja como fechas (el lienzo los dibuja en la ficha); la causa sí está.

**Pulido de Avisos.** La ficha lista los casos afectados del aviso elegido (CodPulso, responsable, fecha y nota, con
scroll visible y degradado al pie) cuando el corte los nombra, o su desglose (por responsable, o por cómo vino escrita la
fecha); si no nombra ninguno, lo dice. La lista de causas reparte el alto entre sus filas. La clave interna del aviso ya
no se ve (queda en `title` y `data-aviso`). El nivel pasa a un punto junto al título y la fila elegida se marca con
fondo y borde azul marino, para que no compitan. La ficha declara su grupo de geometría (`telefonico-avisos-ficha`):
antes el pie anclado con `margin-top: auto` hacía que el panel llegara al borde y el vacío intermedio no se medía.

**Corrección de Avisos (rechazo del verificador).** Un grupo de alertas sólo se cuenta por persona cuando la señal es de
asignación o cuando cada alerta nombra a un responsable distinto y ningún caso. En Medios de Vida, «Efectivo telefónico
sin efectiva Kobo» decía «3 responsables» con «Lucía 1 / Lucía 1 / Marco 1». Ahora dice 3 casos y lista MVH0006,
MVH0053 y MVH0069 con su responsable. El código llega del motor como `codigo:MVH0006` y la ficha quita el prefijo. El
desglose junta a cada persona en una sola línea. Con empate no se dice «el más marcado». La cifra del motor manda sobre
los códigos nombrados: en PDM, el formato de CodPulso son 287 alertas y 286 códigos distintos. La clave interna ya no
sale en el `title`, sólo en `data-aviso`.

**Composición de Avisos.** Las filas de causas ya no reparten el alto del panel: miden lo que pide su contenido, y la
columna desplaza si no cabe. Debajo va «Por dónde se corrige», que reúne los avisos por destino con sus casos (o
responsables) y un enlace; la hoja del equipo va al final. En PDM: Discrepancias 453 (166 y 287 de formato),
Respuestas 57, Equipo 11 responsables y hoja del equipo 9. En la ficha, los afectados o el desglose ocupan lo que tienen
y «Qué hacer» va pegado. Sólo una lista de más de ocho casos lleva barra visible y degradado.

**T7, Insumos › Estados.** `profiles/telefonico/insumos/Estados.tsx` con `estadosModel.ts` (test). El borrador y el
guardado del definidor salieron a `estados/useDeclaracionDeEstados.ts`; el definidor de Acreditación lo usa igual y lo
que se guarda no cambió. Vocabulario de Status con valor del cliente, casos, familia en los gráficos (editable, como
hoy) y cómo lo cuenta el motor (lectura, «sin regla» en ámbar, «difiere» si no corresponde; P18). A la derecha:
«Status por reglas» en lectura (`status_from_rules`, apagado en PDM y Medios de Vida) con los valores sin regla (PDM 6
valores y 84 casos, como el lienzo; Medios de Vida «Número equivocado», 6), «Intentos que registra la hoja» sobre la
cola de insistencia (PDM 374 casos: sin dato 2, 1: 107, 2: 136, 3: 122, 4: 5, 5: 2; el lienzo contaba sólo la muestra),
el color de cada familia (paridad) y la nota «Sin regla de agotado». Las tarjetas de universo y barrido, que vivían en
esta pestaña, pasan a Fuentes.

- **No va**: los interruptores Intento, Contacto y Cierra, y encender «Status por reglas» desde la app: no existen hoy.

**Avisos usa el alto.** Debajo de «Por dónde se corrige» va «Casos por revisar»: una tabla con todos los casos que nombran
los avisos (CodPulso, aviso, responsable y dónde se corrige). Crece hasta el pie y desplaza dentro con barra visible. Con
muchos avisos, como en PDM, queda en su mínimo de 280 px y la columna desplaza. La ficha llega al pie del área: la lista
de afectados crece y «Qué hacer» queda pegado al pie del panel.

**T7, Insumos › Llave y filtros.** `profiles/telefonico/insumos/Llave.tsx` con `llaveModel.ts` (test). La llave va en
lectura: la primera columna candidata de la base y de las respuestas (primero la que declara la encuesta) con cuántas
más se prueban, ejemplos de cada lado y distintos en la base (PDM 2,296). El cruce de las efectivas sale de
`respuestasModel`, como en Control › Respuestas: PDM 418 exactas, 6 por sus dígitos, 424 de 424, 100.0 % (el lienzo
dice 429 de 430 porque cuenta los envíos antes del filtro de prueba); Medios de Vida 72 de 72. El editor del filtro de
efectiva es el de siempre, con lo que además queda fuera (prueba o real en Medios de Vida, un envío por CodPulso).
Abajo, cada efectiva con cómo cruzó y su caso en la hoja; a la derecha, la tarjeta de la encuesta («Cambiar conexión») y
lo que no cruzó tal cual («1218 se lee PDM1218»).

- **No va**: interruptores de normalización, «Variables de control» (no hay pares que el motor compare) y la caja de
  discrepancia del lienzo; el conteo «Quedan» por criterio, que el corte no publica.
- En Medios de Vida «Por revisar en la llave» queda vacío legítimo: todas las efectivas cruzan tal cual.

**T7, Insumos › Fuentes.** `profiles/telefonico/insumos/Fuentes.tsx` con `fuentesModel.ts` (test). En una columna: la
franja de lectura y sincronización de siempre (Sheets, Kobo, Todo y Conectar fuente), la cadena del corte (universo,
barrido y encuesta, con su cifra y enlace), las fuentes del proyecto (papel en el contrato, servicio, nombre editable
como antes, lo que se lee, volumen si la metadata lo trae, última lectura y «Cambiar conexión», que abre el panel de
conexión sobre esa fuente) y, al pie, las columnas que cada pieza espera con la que la fuente declara (PDM: llave
CodPulso y sede, atención, trámite y origen; el resto se busca por nombre). Las tarjetas de universo y barrido que
vivían en la vieja «Universo y barrido» quedan cubiertas por la cadena y las filas.

- **Diferencias con el lienzo**: una columna y no dos, porque la columna derecha del lienzo («Capacidades del
  proyecto» y «Qué cambia al guardar») no tiene capacidad detrás y dejaba un vacío; sin vista previa ni validación por
  columna (el corte no publica qué trae cada columna; `state.variables` mezcla la hoja con Kobo); sin «Traer nuevas» y
  «Todo de nuevo» por fuente (la franja sincroniza por servicio, como hoy).
- A 1024 la cadena queda en fila dentro de Fuentes: apilada, la pieza con cifra quedaba más alta que las otras dos y
  rompía su contrato de marcos iguales.
- El volumen por fuente sale de la metadata del sync (`row_count`, `fetched_count`); las copias no la traen y la fila no
  pinta cifra. La del corte está en la cadena (2,726 en PDM).

**Rechazo del verificador sobre `0e965bb13`.** «Columnas que se leen» pintaba claves internas del contrato (atencion,
tramite, telefono). Ahora usa el diccionario `insumos/rotulosDeColumna.ts`, con un test que falla si el contrato agrega
una clave sin rótulo. Avisos quita el prefijo `codigo:` de título, detalle, desglose y notas, no sólo de los afectados.
Con la señal de asignación se cuentan personas distintas. Renombrar una fuente vuelve a decir «Guardando…» y
«… actualizado.».

**Repetidas con su unidad.** En Respuestas el chip contaba envíos marcados («Repetidas (2)») y la cadena, envíos que
sobran («1 envío repetido»). Ahora cada rótulo dice qué cuenta: el chip «Repetidas: 1 caso, 2 envíos» y la cadena «1
envío repetido de 1 caso» (Medios de Vida: 2 casos, 4 envíos y 2 envíos repetidos de 2 casos). Llave y filtros usa la
misma frase.

**Claves sin rótulo (segundo rechazo).** Barrido de todo lo que pintan Control, Insumos y las tarjetas que montan:

- El cruce de la llave tiene un único mapa en `control/respuestasModel.ts` (`ROTULO_DE_LLAVE`: Exacta, Por sus dígitos,
  No cruza), que usan Respuestas y Llave y filtros.
- Las marcas pasan a mayúscula inicial (Más de 2 h, Menos de 5 min, Repetida, No cruza, Efectiva), igual que el tipo de
  regla de «Qué cuenta» (Filtro, Regla, Aviso, no excluye) y «Apagada» en Fuentes.
- Las columnas esperadas de la tarjeta de cada fuente salen del page-file a `insumos/ColumnasEsperadas.tsx` y pasan
  por `rotuloDeDato` (Consentimiento, Fecha, Respuesta…).
- En «Todas», Respuestas pone primero lo que no cruzó tal cual (en PDM, los 6 por sus dígitos).
- Test transversal `profiles/telefonico/clavesSinRotulo.test.tsx`: renderiza Barrido, Insistencia (con ficha), Equipo
  (con estados), Respuestas, Avisos, Estados, Llave y filtros, Fuentes y las tarjetas de fuente con un corte de prueba.
  Falla si un texto visible es una clave conocida en minúscula o tiene forma de clave (`snake_case`, `kebab-case`). El
  contenido de `<code>` queda fuera: son nombres de columna. Se comprobó que falla si se revierte cualquiera de los dos
  defectos.
- **Fuentes, columna «Columna»**: la cabecera real de la hoja no viaja en la metadata de la fuente
  (`sheet_binding` trae `spreadsheet_id`, `sheet_name`, `header_row`, `range`, `last_read_at` y `snapshot_hash`; sin
  encabezados). Se muestra el valor guardado en `dimensions` tal cual, en monoespaciado, porque es el nombre de columna
  que la fuente declaró.

**T8, Modelo › Cuotas y calendario.** `profiles/telefonico/modelo/Cuotas.tsx` con `cuotasModel.ts` (test). El estado y lo
que se guarda siguen en el editor de cuotas del page-file (`AcreditacionPhoneQuotaEditor`), que ahora sólo pinta
`Cuotas`: se edita lo mismo que antes (variable, metas por categoría con confirmación, agregar o quitar categoría y
objetivo total). Lo nuevo es la lectura: cada meta sobre su universo y frente al reparto proporcional (PDM: Chorrillos
+15 y Pueblo Libre −18, como el lienzo), la validación (suma contra el objetivo, categorías con meta en la hoja,
desvío mayor) y la tarjeta del calendario con los días de campo con efectivas y el enlace a la sub-vista.

- **No va**: «Repartir en proporción al universo» (no existe y escribiría metas), la columna «Muestra» (P8–P9), el
  horario y los días de llamada (el proyecto no los declara; el calendario guarda semanas, fechas y día de reporte) y
  las candidatas sin universo en el corte: el motor sólo publica cuotas de la variable en uso, así que «Atención»,
  «Trámite» y «Origen» no aparecen con sus valores.
- Sin metas por enumerador.

**T8, Avance › Ritmo.** `profiles/telefonico/avance/Ritmo.tsx` con `ritmoModel.ts` (test), sobre
`avance_efectivo_variable_dia`, `avance_efectivo_dia` y `estatus_dia`. Las efectivas de Kobo por día apiladas por
categoría de la variable de cuota, con el acumulado y la línea de la meta, y los llamados de la hoja apilados por familia
del status en el mismo eje de fechas: en PDM la hoja se detiene el 02/07 y Kobo sigue hasta el 06/07, y la pestaña lo
dice. Debajo, el mapa de calor categoría por día (PDM 110, 109, 100, 59 y 45). A la derecha: el promedio (PDM 60.4 por
día, 423 en 7 días), el día a día con Kobo, acumulado y hoja, y cómo vienen escritas las fechas de la hoja (PDM: 7
valores, 560 con el día de un dígito, 62 con dos, 6 sin fecha y 3 del año 2020, que corresponden a 3 días). Chips de
cabecera: el pico (133 el 03/07) y el día en que se cruza la meta (04/07).

- **No va**: la hora de inicio de las efectivas (el corte sólo trae la fecha de Kobo) y la ventana de llamada, que el
  proyecto no declara.
- La vista anterior llevaba además la base telefónica (barridos, por barrer, efectivas por sede) y el contraste entre
  Kobo y la hoja: están en Control › Barrido y Control › Discrepancias.
- Las clases del Ritmo usan el prefijo `mon-cadencia-` y las de Cuotas `mon-metas-`: `mon-ritmo-*` y `mon-cuotas-*` ya
  existían en otras hojas y se pisaban.

**T8, Avance › Entregas.** `profiles/telefonico/avance/Entregas.tsx`. A la izquierda, «Para el cliente: avance por
cuota»: la vista del PDF del cliente con las cifras del corte (categoría, meta, efectivas, faltan y avance, del mismo
modelo que Avance › Cuotas; PDM 400, 423, 0 y 105.8 %). A la derecha, las salidas de siempre
(`MonitoreoOutputsWorkbench`) apiladas en una columna: el PDF del cliente, el de producción para el equipo, la base
para Procesamiento y la publicación en las hojas del cliente e interna, con su revisión antes de aplicar. La vista no
publica ni genera nada por su cuenta; los bloqueos de readiness siguen igual (PDM «Bloqueado» porque el corte quedó
desactualizado).

- **Diferencias con el lienzo**: los botones «Publicar en la hoja del cliente» y «Descargar PDF» no se duplican en la
  cabecera de la vista previa (viven en las salidas, con su ensayo); la lista numerada del PDF de producción no se
  dibuja porque el contenido real del PDF lo dice su tarjeta («Resumen por responsable, estados de llamada y
  trazabilidad del barrido contra Kobo»); «Por definir» (P15) queda en este plan.
- La vista previa es HTML con las cifras del corte, no el PDF renderizado.

**Tarjeta de fuente fuera del page-file.** `AcreditacionPhoneSourceSlotCard` vive en `insumos/TarjetaDeFuente.tsx` y la
prueba de claves sin rótulo la monta para universo, barrido y encuesta; el contrato que leía su markup en la página
(`TelefonicoSubsanacionGuia.test.ts`) lee también el archivo nuevo. La prueba cubre ya Barrido, Insistencia, Equipo,
Respuestas, Avisos, Estados, Llave y filtros, Fuentes, las tarjetas de fuente, Cuotas, Ritmo y Entregas.

**Composición de T8.** Cuotas: bajo la tabla de metas va «Avance de cada meta» (efectivas frente a su meta, con el
faltante), que usa el alto que la tabla no pide; con muchas categorías baja y la tabla desplaza; el total y «Agregar»
quedan al pie. Ritmo: las dos gráficas reparten el alto que el mapa de calor no pide; «Día a día» mide lo que pide y la
tarjeta de fechas de la hoja llega al pie con cada valor de la columna de fecha (lo que hay que corregir en la hoja); el
acumulado lleva su valor final rotulado («69 de 100», «423 de 400»). Entregas: la vista del PDF lleva también el ritmo
diario, que el PDF del cliente incluye, y mide lo que pide.

**Una sola serie diaria (rechazo del verificador).** En Medios de Vida, Ritmo daba 16 el 04/08 y 69 en total, y el chip,
el calendario de Cuotas y la vista del PDF daban 17 y 70: leían `avance_efectivo_variable_dia` y `avance_efectivo_dia`,
y una efectiva de Kobo no tiene actor. Ahora las cuatro vistas leen `serieDiariaDelCorte` (`avance/ritmoModel.ts`): la
serie por categoría de cuota, que es la que suma Avance › Cuotas (69) y la barra FALTAN (31 de 100). La efectiva sin
categoría se declara aparte («1 efectiva de Kobo sin actor no entra a la serie») en Ritmo, en el calendario de Cuotas y
en la vista del PDF. `segmentoDelCorte` delega en `segmentoDeCuotas`, para que el segmento también sea uno solo. Test
`avance/serieDiariaCoherente.test.tsx`. La prueba de claves sin rótulo cubre además el estado de la tarjeta de fuente
(lista, inactiva y pendiente).

**Pulido después de T8.** (1) Bajo «Válidas» de las salidas, el telefónico pasa una nota opcional que explica la
diferencia con la serie (Medios de Vida: «69 con cuota y 1 sin actor»); los demás modos no la reciben. (2) La serie
diaria compartida cuenta sólo los valores del eje con cuota, como el diario de Avance › Cuotas, y declara aparte lo
que queda fuera («No entran a la serie: 1 efectiva de Kobo sin actor y 2 en «Sin dato», que no tiene cuota»). (3) La
columna derecha de Cuotas y de Ritmo mide lo que piden sus tarjetas (el botón del calendario pegado a la lista de días)
y la hoja del PDF de Entregas se centra en la mesa con su sombra de papel.

## Tercer proyecto de prueba: ACNUR RMS 2026 (solo lectura)

**Cómo se armó.** Copia de trabajo en el scratchpad (nunca en el repo: hay nombres y teléfonos reales). Una sola
fuente de Google Sheets, pestaña «Barrido», leída por la ruta de lectura (`monitoreo_sheets_read_source`, GET); nada
se publicó, formateó ni sincronizó hacia la hoja. Sin encuesta de Kobo conectada. Forma del corte: 800 filas, las 800
en «No barrido», Fecha e Intentos vacíos; `Origen` Muestra 400 y Backup 400; «¿Se reemplaza con el Backup?» No 400 y
vacío 400; `Periodo de Llegada` 4 × 200; Responsable vacío en 400; Tef2 en 110 y Tef3 en 13.

**Lo que RMS destapó y se corrigió** (commits `746626295` y `bd705173c`):

- **Eje de cuota sobre un identificador.** Cuotas tomaba «Código proGres» (800 valores) como eje y lo rotulaba
  «CÓDigo ProGres» (el `\b` de JavaScript corta en la vocal tildada). `modelo/variablesDeCuota.ts`: no se ofrecen
  códigos, nombres, teléfonos ni columnas con más de 30 valores salvo que ya estén guardadas o con metas; las columnas
  operativas (responsable, estado, origen, intentos…) van al final; un encabezado escrito por una persona se respeta
  tal cual. En RMS el eje propuesto es «Periodo de Llegada».
- **Cuotas antes de guardar la variable.** El motor sólo publica el universo de la variable en uso: sin guardarla, la
  tabla marcaba «sin base» en las cuatro categorías. Ahora se dice que el universo se calcula al usar la variable y
  actualizar; «Avance de cada meta» y el calendario dicen su vacío.
- **Ritmo sin serie.** Un panel suelto sobre un vacío; ahora el marco se conserva (panel con EstadoVacio y el motivo:
  «Las 800 filas de la hoja de barrido están en «No barrido» y ninguna tiene fecha de llamada. Kobo no trae efectivas
  en este corte.») y la lateral lista los estados de la hoja.
- **Insistencia.** «Ningún caso de la cola cumple los filtros» con la cola vacía; «0 responsables, 400 casos
  repartidos; 0 por llamar, ya asignados». Ahora: «La cola está vacía…» y «Ningún responsable tiene casos en cola. La
  hoja reparte 400 casos.»; la ficha vacía es dueña de su alto (era el `capacity-drift` del runner).
- **Llave y filtros.** «Por revisar» decía en verde «Todas las efectivas cruzan tal cual» con cero efectivas (verde por
  ausencia). Y la base mostraba `rms_barrido` como ejemplo con 1 distinto en 800 filas: la llave no encontró columna
  CodPulso y el motor usa el id de la fuente. Ahora hay aviso cuando todas las filas comparten el mismo código.
- **Barrido.** Sin eje de cuota se pintaba una fila Total en 0 contra un listado de 800; la fecha, lo que falta llamar
  y el status dicen su vacío.
- **Estados.** Con un solo status el vocabulario medía una fila y la lateral terminaba 300 px antes: el vocabulario es
  dueño del alto y la nota del modo va al pie.

**Lo que RMS destapó y queda anotado (no se tocó):**

- **C5, desconexión del motor:** la llave de RMS es «Código proGres», no CodPulso. `key_rules` no se edita desde la
  app; mientras no se declare, todo cruce con Kobo casará contra `rms_barrido`. Pide decisión (editor de llave o
  declaración en el proyecto).
- **C5, limitación del fixture:** «Qué cuenta para la meta» y el filtro de efectiva muestran «Intro/Consent: Yes»,
  heredado del estado con que se armó la copia de prueba; no es del estudio RMS.
- **Discrepancias:** el buscador recorta su placeholder («Buscar código, nombre, correo o response_id...», 266 px en
  243 y 135 px). Componente compartido de Acreditación; no se tocó.
- **Entregas:** la cabecera del workbench compartido parte «7:33 a. m.» en dos líneas y usa píldoras en versalitas
  («SALIDAS DEL AVANCE», «INCLUIR METAS»). Componente compartido de salidas; no se tocó.
- **Equipo:** en la ficha del operador, «Status en la hoja» reparte una sola barra (No barrido 15) al pie de un hueco.
- **Avisos:** «Responsable con casos por iniciar: 19 responsables» repite «19 responsables» en el título, el número
  grande y la línea de abajo.
- **Fuentes:** la tarjeta Barrido no lleva cifra cuando la Universo sí (800); la tarjeta de Kobo trunca «Sin fuente
  vin…».
- «No barrido» sin responsable ya se lee «Sin asignar» en Barrido («400 asignados y 400 sin asignar»), Insistencia y
  Avisos («Casos sin asignar 400»).
