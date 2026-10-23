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
| T6 | Control › Respuestas y Avisos | `control/Respuestas.tsx`, `control/Avisos.tsx`; reutiliza `filtroEfectiva/`, `TelefonicoPhoneAlerts.ts` | T2 | ☐ |
| T7 | Insumos | Fuentes, Llave y filtros, Estados (`insumos/Estados.tsx`), reutilizando `fuentes/` | T2 | ☐ |
| T8 | Modelo y Avance restantes | Cuotas y calendario, Ritmo, Entregas; Reserva y Reemplazos condicionales | T2; Reserva y Reemplazos esperan P8–P9 y el contrato de «ACNUR RMS» | ☐ |
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
