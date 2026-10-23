# Plan de aplicación a la UI: Monitoreo de acreditación

Tipo: Plan de implementación
Estado: Vigente
Fecha: 2026-10-23
Autoridad: Gonzalo autorizó aplicar a la UI el revamp aprobado y pidió rapidez. Diseño:
`docs/qa/revamp-monitoreo/acreditacion.md` (arquitectura de 4 secciones y 20 pestañas, paridad §1b, fichas, G1–G12,
preguntas P1–P6), lienzo «Revamp de Monitoreo · Acreditación», `estandar-de-ficha.md` y
`procedimientos-respondidos.md`, que mandan.

## Reglas de ejecución

- Rama `revamp-monitoreo-acreditacion` en su worktree; nunca se edita `main`. Sin push ni merge: el lead verifica y
  fusiona por partes.
- Se reutiliza lo que Telefónico ya construyó: `shell/BarraDelModo.tsx` (prop `barraDelModo` de
  `MonitoreoModuleChrome`), `useMonitoreoDireccionTraducida`, `core/ColaDeInsistencia.tsx` y el patrón de la tabla de
  direcciones con alias de lectura. Lo que en Telefónico quedó atado a su perfil y hace falta en los dos (cabecera de
  pestaña, tabla de direcciones, corte corto y estado del modo) se pasa a `core/` como archivo nuevo; Telefónico puede
  adoptarlo después sin cambio de comportamiento.
- `AcreditacionMonitoreoPage.tsx` está congelado (línea base 18,514): solo cambia el montaje y lo nuevo va en archivos
  propios dentro de `profiles/acreditacion/`. Lo mismo para `monitoreo_engine.R` y `router_monitoreo.R`.
- Lo que se guarda no cambia: mismos llamados y mismos payloads.
- Ninguna clave técnica cruda en pantalla: todo rótulo sale de un diccionario y un test de render falla si aparece una
  clave (`profiles/acreditacion/clavesSinRotulo.test.tsx`).
- Una cifra, una fuente: efectivas, meta y avance salen de `advanceCardsFromRows` (la función de hoy) en el chrome, en
  Resumen y en Por público.
- Lo que dependa de P1–P6 o de una D abierta no se decide: queda la pieza de hoy o el estado «Por definir».
- Gate por fase: `pnpm -C frontend typecheck`, `make gate-front AREA=monitoreo`, `node agentic/sync-agentic-os.mjs
  --audit`, `make gate-area AREA=monitoreo GATE_ARGS='--patron "acreditacion"'` si se toca R, y capturas de Contabilidad
  e Institucional a 1440 × 1000 y 1024 × 600 con el runner de `ui-quick-check` (puertos propios, en serie,
  `--timeout-ms 420000`, `--require-geometry`, `R_LIBS` aislado), distintas por md5.
- Un commit por pestaña, en español y conventional commits.

## Fases

| # | Fase | Contenido | Depende de | Estado |
|---|---|---|---|---|
| A0 | Preparación | Worktree, copias de `acred_conta.pulso` y `acred_institucional.pulso` en `scratchpad/impl-acred/` | — | ☑ |
| A1 | Navegación y chrome | Catálogo `acreditacion` con Insumos · Modelo · Control · Avance (20 pestañas, 4 condicionales); vistas de hoy en `MONITOREO_PESTANAS_INTERNAS_ACREDITACION`; tabla `navegacion/direccionAcreditacion.ts` con alias de lectura; aterrizaje en Avance › Por público (D2); barra del modo (MODO, PÚBLICOS, insignias de Control y Avance, CORTE, estado, Actualizar ▾); cabecera de pestaña de 44 px con antetítulo «Sección · Grupo»; rail con CORTE al pie y divisor Contacto / Casos en Control; readiness por pestaña (G5) | — | ☑ |
| A2 | Avance › Resumen y Por público | `avance/Resumen.tsx`, `avance/PorPublico.tsx`, `avance/PanelPublico.tsx` y modelos puros con test | A1 | ☑ |
| A3 | Control › Por resolver | Subsanación y asignación asistida con la decisión auditada de hoy, cola por tipo, panel del caso | A1 | ☐ |
| A4 | Control › Reintentos | `ColaDeInsistencia` con las columnas del barrido de acreditación | A1; bloque `cola_insistencia` en acreditación (backend) | ◐ (escrita; falta typecheck, gates y capturas) |
| A5 | Resto de Control | Correo, Barrido, Equipo, Cruce, Calidad, Personas, Respuestas | A1 | ◐ (Barrido, Equipo, Cruce, Calidad, Personas y Respuestas escritas; Correo sigue con la vista de T3) |
| A6 | Insumos | Públicos, Fuentes, Reglas | A1 | ☐ |
| A7 | Modelo | Metas, Cuotas, Ventana de campo | A1 | ☐ |
| A8 | Avance restante | Por cuota, Ritmo, Salidas y Cerrar campo | A1 | ☐ |

## A1: cómo se traduce cada pestaña mientras no tiene contenido propio

Cada pestaña pública monta la vista de hoy que absorbe (columna «Absorbe» de `acreditacion.md` §1). Cuando absorbe
más de una, las demás cuelgan como sub-vista con `panel`.

| Dirección pública | Vista de hoy | Sub-vistas |
|---|---|---|
| `insumos/publicos` | Fuentes › Actores | |
| `insumos/fuentes` | Fuentes › Fuentes y universo | `panel=recopiladores`: Fuentes › Recopiladores |
| `insumos/reglas` | Teléfono › Estados | |
| `modelo/metas` | Modelo › Modelo operativo | |
| `modelo/cuotas` | Modelo › Distribución | |
| `modelo/ventana` | Modelo › Cronograma | |
| `control/correo` ◇ | Avance › Correo | |
| `control/barrido` ◇ | Teléfono › Barrido + Kobo | `panel=ritmo`: Teléfono › Ritmo diario |
| `control/reintentos` ◇ | Teléfono › Sin efectiva | |
| `control/equipo` ◇ | Teléfono › Responsables | |
| `control/resolver` | Consultas › Subsanación | |
| `control/cruce` | Consultas › Cruces efectivos | |
| `control/calidad` | Teléfono › Alertas reales | `panel=supervision`: Teléfono › Supervisión (P3) |
| `control/personas` | Consultas › Estado de la base | |
| `control/respuestas` | Consultas › Registros en plataforma | |
| `avance/resumen` | Avance › Resumen | |
| `avance/publicos` | Avance › Actores | |
| `avance/cuotas` | Avance › Cuotas | `panel=detalle`: Avance › Detalle |
| `avance/ritmo` | Avance › Encuestas | |
| `avance/salidas` | Avance › Salidas | |

◇ condicional: Correo solo si el estudio tiene audiencia de Mailchimp; Barrido, Reintentos y Equipo solo si algún
público declara canal telefónico. Una dirección a una pestaña condicional que el proyecto no tiene aterriza en la
primera pestaña de su sección.

## Notas de A1 y A2

**A1, navegación y chrome.** Catálogo público `MONITOREO_PESTANAS.acreditacion` con 20 pestañas (Correo, Barrido,
Reintentos y Equipo condicionales); las vistas de hoy en `MONITOREO_PESTANAS_INTERNAS_ACREDITACION`. La tabla
`navegacion/direccionAcreditacion.ts` se arma con `core/tablaDeDirecciones.ts`, la forma general de la tabla del
telefónico (que puede adoptarla sin cambio de comportamiento). Lee como alias las secciones `fuentes`, `consultas` y
`telefonico`, las pestañas históricas de `modelo` y `avance` y las claves viejas de Fuentes (`survey`, `collectors`…).
Sin dirección aterriza en Avance › Por público.

- Barra del modo: MODO, PÚBLICOS («4»; «9 + Piloto» cuando un público no tiene meta), insignias de Control (casos que
  esperan decisión: Contabilidad 23) y de Avance (efectivas sobre meta: 146 %), CORTE, píldora de estado y Actualizar
  con «Solo respuestas de las encuestas» en el menú (el sync de avance de hoy). La píldora dice «Pendiente» con cambios
  sin recalcular, como en Telefónico (P17).
- Las cifras de la barra salen de la memoria del corte (`navegacion/resumenDelCorte.ts`): cada sección pide su propio
  `report_scope` y la barra no puede perder la insignia de Control al pasar a Avance. La alimentan el corte a la vista
  y el prefetch de scopes de fondo.
- Correo existe si el estudio tiene audiencia de Mailchimp (`list_id` del estado de Mailchimp, una lectura al montar);
  Barrido, Reintentos y Equipo si algún público declara canal telefónico. Mientras no se sabe, la pestaña se ofrece.
- Rail con «Grupo · Pestaña» en el tooltip de Control y una línea entre Contacto y Casos; CORTE al pie.
- Readiness por pestaña (G5): `monitoreo-acreditacion-<sección>-<pestaña>`.
- Se retiraron del page-file la franja de lectura (G1), el rail y la cabecera anteriores. Lo que la franja decía de
  Modelo › Distribución (públicos con padrón, variables declaradas, públicos sin variable) pasó a chips de la cabecera
  de Modelo › Cuotas; plan, fechas y día de reporte ya los dice el resumen del cronograma. El embudo del corte
  (`AcreditacionEmbudoCorte`) pasó a Avance › Resumen.
- `advanceCardsFromRows` y sus columnas salieron del page-file a `avance/tarjetasDeAvance.ts` sin cambiar lógica; el
  page-file las reexporta. El page-file bajó de 18,494 a 17,709 líneas.
- Fuera del glob, con el mínimo de líneas y solo en lo de acreditación: `lib/modules.ts` (secciones del modo),
  `core/monitoreoRegistry.ts` (`ACREDITACION_WORKBENCH_VIEWS` y una línea en `seccionesPublicasDelModo`) y los contratos
  que fijaban la arquitectura anterior (`modulesNavigation.test.ts`, `MonitoreoNavigationSemantics.test.ts`,
  `ConsultasWorkbenchGeometryLayout.test.ts`, `componentesSinMontar.test.ts`).

**A2, Avance › Resumen y Por público.** `avance/Resumen.tsx`, `avance/PorPublico.tsx`, `avance/PanelPublico.tsx`,
`avance/EstadoDelUniverso.tsx`, `avance/graficosDeAvance.tsx` y el modelo puro `avance/avanceModelo.ts` con test.
Todas las cifras por público salen de las mismas tarjetas que la barra; la serie de `daily_general` y `daily_actor`.

- Resumen: efectivas contra la meta con del universo, parciales, rechazos y sin respuesta; curva acumulada con doble
  eje (acumulado a la izquierda, por día a la derecha), la meta en la escala del acumulado y el día en que se cumplió;
  universo por estado; últimos 14 días con eje; el embudo del corte; públicos con su meta, rezagados primero; y Por
  resolver con lo que espera decisión y lo ya resuelto.
- Por público: tabla ordenada por universo con avance contra la meta, el universo de cada público por estado y el
  inspector del público (`panel=publico&foco=<público>`): embudo, acumulado con eje, por canal, barrido si el público
  lo tiene (de «Operación por responsable») y sus casos.
- Los avisos van en el componente `Alert` del sistema, no como texto suelto.

**Diferencias con el lienzo, por datos o decisiones:**

- El inspector no lleva todavía «Cuota por unidad académica» ni el bloque de correo: necesitan
  `monitoreo_cuotas_modelo` y el estado de Mailchimp por público, que llegan con Avance › Por cuota (A8) y Control › Correo (A5).
- «Esperan decisión» toma los cuatro tipos del lienzo (llave fuera de base, respuesta sin llave, conflicto telefónico,
  parcial no identificable); «Incluido con salvedad» se lee «Asignadas por el supervisor», como en Ctl5.
- La miniatura de 14 días de cada fila es una miniatura de celda, sin ejes; los gráficos de panel sí los llevan.

**Gate de A1 y A2.** Typecheck limpio; `make gate-front AREA=monitoreo` 465 archivos y 5,576 tests en verde (con la
máquina cargada, `componentesSinMontar` llegó a caer por su tope de 5 s; con el candado de corridas pesadas pasa);
auditoría agentic sin hallazgos. Medición de las capturas a 1440 × 1000: las dos columnas terminan en y = 984 en las
cuatro vistas (0 px de diferencia) y el pie queda a 15 px del borde. Capturas a 1440 × 1000 y 1024 × 600 de Contabilidad e Institucional, distintas por md5. Quedan dos avisos del
runner en vistas que A1 solo monta y que se rehacen en sus fases: el placeholder del buscador de Consultas (A3, A5) y
`fuentes-encuestas-actores` sin alturas iguales en Insumos › Fuentes (A6). La readiness de Resumen y Por público espera
los casos (llegan con el corte de Control) o su falla, para no capturar «preparando».

**A3, Control › Por resolver (escrita, sin gate ni capturas por el candado de corridas pesadas).**
`control/casos/PorResolver.tsx`, `control/casos/PanelCaso.tsx`, `control/casos/porResolver.css`, el modelo puro
`control/casos/porResolverModelo.ts` con test y el estado de filtros en `porResolverStore.ts`. Las reglas de la
revisión asistida (`assistedCandidateId`, nivel de evidencia, notas para decidir, `normalizeCaseSearch`) salieron del
page-file a `control/casos/revisionAsistida.ts` sin cambiar lógica, y la vista anterior las sigue usando.

- Filtros a la izquierda: «Esperan decisión», «Decididos por el supervisor» y «Resueltos por regla», cada tipo con la
  cifra del motor (la misma de Resumen y de la insignia), y el público con lo que espera decisión.
- Cola del tipo elegido: respuesta, público, canal, llave enmascarada, cuánto respondió, fecha y estado (Espera,
  Asignada, Descartada, Por regla). Cuando una fila cuenta varios casos (duplicados), la cabecera dice las dos cifras.
- Panel del caso (`panel=caso&foco=<response_id>`): datos, lo que pasó (respondió, cruce con el motivo de
  `core/motivoDeNoCruce`, decisión), la llave por canal, los avisos del motor, lo que encontró y la asignación: buscador
  sobre las personas sin efectiva, switch «Confirmo la asignación», motivo y «Descartar» o «Asignar a esta persona».
- Lo que se guarda no cambió: `response_id`, `action` (`keep_excluded` o `include_with_caveat`), `candidate_id` y
  `note`, por el mismo `apiMonitoreoAcreditacionCaseReconciliation`. Las reglas siguen: solo se asigna una completa o
  parcial, nunca a quien ya tiene efectiva, con confirmación, y la nota es obligatoria si la respuesta es parcial, el
  código contradice o la evidencia no es exacta.

**Diferencias con el lienzo en A3:** el motivo no es obligatorio para descartar (hoy no lo es; ver pregunta). La
franja «205 casos revisables pueden afectar la lista de no respuesta» de la vista anterior no está en Por resolver:
esa lista es más amplia que los casos marcados y su lugar es Control › Personas (A5).

**A4, Control › Reintentos (escrita, sin gate ni capturas).** Backend: el bloque `cola_insistencia` del telefónico
se publica también cuando el barrido es de una acreditación (`monitoreo_telefonico.R`, 8 líneas insertadas después
del bloque del telefónico, sin tocar las suyas), con el público de cada caso como categoría. Test nuevo
`test-monitoreo-acreditacion-reintentos.R` (5 expectativas) y el de la cola del telefónico sigue en verde (44). Front:
`control/contacto/Reintentos.tsx` monta `core/ColaDeInsistencia` con el modelo del telefónico
(`estadoDeInsistencia`, `repartoDelEquipo`) y la ficha del caso (`panel=caso&foco=<código>`). En `core/` se agregó
una prop opcional `plataforma` a la cola (por defecto «Kobo», así Telefónico no cambia): en acreditación las
efectivas vienen de SurveyMonkey y la cola no puede decir Kobo.

**Diferencias con el lienzo en A4:** la columna «Teléfonos registrados» (cuenta de `TELÉFONO 1–3`) no está: el bloque
común solo trae `NumTelefonos` si la hoja la declara. El orden por defecto es «Más intentos primero» (P1, opción a) y
la cola la forman los status que el motor y el vocabulario dejan abiertos (P2 sigue abierta). La distribución de
intentos va en la cabecera de la cola, como en Telefónico, y no en un panel aparte.

**A5, Control › Barrido (escrita, sin gate ni capturas).** `control/contacto/Barrido.tsx` con
`barridoModelo.ts` (test): del padrón al cruce (padrón telefónico, barridos, efectivos al teléfono, conciliados), casos
por fecha de su último intento con las fechas normalizadas (H2) y las de otro año aparte, la matriz barrido y
plataforma (conciliadas, efectiva solo al teléfono, completa sin efectiva al teléfono, de «Operación por
responsable»), efectivas del público por canal con su meta, el estado de los casos por familia con el vocabulario
del proyecto y el acumulado de barridos. «Ritmo diario» sigue como sub-vista (`panel=ritmo`).

- La familia de cada status sale de las reglas declaradas (clasificador del telefónico). Sin regla, la errata
  «Número Incorrrecto» (H7) cae en Reintentable por su nombre; con la regla declarada, en Cerrado sin efectiva.

**A5, Control › Equipo (escrita, sin gate ni capturas).** `control/contacto/Equipo.tsx` con `equipoModelo.ts`
(test): carga y resultado por responsable (estado de sus casos por familia, escalado a la mayor carga; asignados,
barridos, efectivas, conciliadas, % sin barrer y % de barridos sin efectiva), carga frente a efectividad (efectivas
sobre asignados, el tamaño son los barridos, rótulos que no se pisan) y alertas del equipo con los umbrales del perfil
(`monitoreo_profile.alerts`, los del motor). «Sin asignar» va en gris y como información.

- **Diferencia con el lienzo:** el lienzo alerta a Responsable 6 por 25 % sin barrer; con los umbrales del motor (20
  casos o la mitad) no alerta. Se dejan los del motor; el umbral se edita en Insumos › Reglas (A6).
- La columna «Incidencias» del lienzo se rotula «Sin efectiva»: es la proporción de barridos que no terminó en
  efectiva, y «incidencia» se confunde con las alertas.

**A5, Control › Cruce (escrita, sin gate ni capturas).** `control/casos/Cruce.tsx` con la geometría pura
`flujoDeCruce.ts` (test): diagrama de flujo en cuatro columnas (origen, canal, plataforma y resultado) sobre
`internal_queries.flow.links`, con el resultado re-rotulado (H4: Efectiva 418, En el universo sin contar 11, Excluida
32, Pendiente 90 en Contabilidad) y, a la derecha, llave usada, cómo cruzó con el padrón y estrategia por canal, de
`case_rollup`. «Llave en base» se lee «Llave del padrón, sin respuesta» y «Cruzó», «Cruzó por llave».

- **Paridad pendiente:** la vista anterior listaba los cruces caso por caso con su razón; esa lectura por persona va
  en Control › Personas (columna «Cómo cruzó»), que es la siguiente.

**A5, Control › Personas (escrita, sin gate ni capturas).** `control/casos/Personas.tsx` con `personasModelo.ts`
(test), sobre `case_rollup`: estado por público con una fila de todos (Efectiva, Sin respuesta, Parcial, Rechazo y,
si hay, Excluida o En revisión), que filtra la tabla con `foco=<público>`; canal y cómo cruzó de quienes respondieron;
tabla de 50 por página con buscador, estados y exportación. Aquí queda también la lectura caso por caso del cruce que
traía Consultas › Cruces efectivos.

- **Diferencia con el lienzo:** exporta CSV (el mismo formato de la vista anterior), no XLSX. La paginación es en el
  cliente sobre el transporte compacto de T1.6; la paginación en servidor que pide la ficha queda pendiente.

**A5, Control › Respuestas (escrita, sin gate ni capturas).** `control/casos/Respuestas.tsx` con
`respuestasModelo.ts` (test), sobre `internal_queries.cases` sin las personas sin respuesta: facetas con su conteo
(estado de la respuesta, canal, cruce y si cuenta en el avance), tabla más reciente primero con buscador, páginas y
exportación CSV. Con Personas y Respuestas, la sección Consultas de antes ya no monta ninguna de sus pestañas.

- **Paridad a revisar:** las vistas internas de Consultas (efectivas, faltantes, distribución, auditoría y
  reconciliación) quedan cubiertas por las facetas de Respuestas, los estados de Personas y los «Decididos» de Por
  resolver, pero sin sus nombres. Si alguna se usaba como lista propia, conviene decirlo.

**A5, Control › Calidad (escrita, sin gate ni capturas).** `control/casos/Calidad.tsx` con `calidadModelo.ts`
(test): las duraciones fuera de rango de `dashboard.inconsistencies`, cada una con su valor y su lectura (muy corta o
muy larga según los umbrales del proyecto, H1), y las señales de consistencia de la hoja «Alertas» con el modelo de
siempre. La supervisión por rellamada sigue como sub-vista (`panel=supervision`) hasta P3.

- **Diferencia con el lienzo:** no hay histograma de todas las duraciones ni la mediana: el corte solo trae las que
  salen del rango, y la mediana del tablero no dice su unidad en este modo. Publicar la serie de duraciones es un
  cambio del motor.

**A5, Control › Correo: sin rehacer.** Monta la vista de Correo de T3 (`AvanceCorreo*.tsx`) tal cual, con su
cabecera, su lectura de Mailchimp y su readiness propia. La matriz de envíos por público con el embudo por envío del
lienzo Ctl1 queda para una pasada propia: la vista ya trae envíos, embudo, ritmo e inválidos, y rehacerla sin poder
capturar el institucional (único proyecto con Mailchimp) era dibujar a ciegas.

**A6, Insumos › Públicos (escrita, sin gate ni capturas).** `insumos/Publicos.tsx` con `publicosModelo.ts` (test).
El borrador y el guardado del elenco salieron de `ActoresDelEstudio` a `fuentes/useElencoDeActores.ts` sin cambiar
lógica: renombrar arrastra las fuentes del público y luego se guarda el elenco, como siempre. Tabla de públicos
(nombre editable, padrón, personas, encuestas y canales, switch de teléfono, variables para cuotas, quitar), matriz
«Por dónde entra cada público» (público por canal y barrido) y panel del padrón (`panel=publico&foco=<público>`) con su
fuente, la llave de cruce declarada (`key_rules.universe_fields`), las variables para cuotas y sus encuestas.
Personas y variables salen de `GET /api/monitoreo/cuotas` (`useEstadoDeCuotas`).

- **Diferencia con el lienzo:** el panel no lista las columnas del padrón con su completitud ni marca «Trae datos
  personales» (H9): el estado no publica las columnas de cada fuente. Publicarlas es un cambio del motor.
- La llave se muestra como la declara el proyecto, en orden de prueba, no la columna exacta de cada padrón.

**A7, Modelo › Metas (escrita, sin gate ni capturas).** `modelo/Metas.tsx` con `metasModelo.ts` (test): meta por
público con la cobertura editable y la meta que resulta (y al revés), un solo «Guardar», la cobertura exigida de
mayor a menor y el reparto de la meta. Se guarda por `apiMonitoreoConfig` con `upsertAcreditacionActorGoal`, el mismo
contrato (`filters`, `meta`, `meta_pct`) que guardaba cada tarjeta; solo cambian los públicos editados.
`preferredGoalVariable` salió del page-file a `AcreditacionActorGoals.ts`.

- **Diferencia con el lienzo:** la meta se redondea como hoy (`round`), no con `ceiling` como dice la ficha. Cambiarlo
  movería metas guardadas; queda como pregunta. No hay columna «Cuota declarada»: las cuotas se leen en M2.

**A7, Modelo › Cuotas (escrita, sin gate ni capturas).** `modelo/Cuotas.tsx` (test): la lista de cuotas declaradas
y de variables sin cuota (con «Definir cuota», que abre el panel con ese público y esa variable), y la cuota elegida
con sus metas por categoría y el aviso cuando no suman la meta del público (812 frente a 811). La configuración
(lectura, dirección, proponer, guardar y quitar) salió de `AvanceCuotas` a `useConfiguracionDeCuotas.tsx` sin cambiar
lógica; Avance la sigue usando hasta A8. Se edita con el mismo panel de siempre (`panel=cuota`).

- La pestaña se monta sobre la clave interna `modelo/resumen`, que el modo ya no usaba. La declaración de variables
  de control de Distribución queda como sub-vista (`panel=variables`) hasta que A8 decida su lugar en Por cuota.
- D7 sigue abierta: se avisa la diferencia, no se elige cuál manda.

## Preguntas surgidas en la implementación

- **Redondeo de la meta (M1)**: la ficha dice meta = `ceiling(personas × cobertura)`; la app redondea al entero más
  cercano desde siempre. ¿Se cambia?

- **Motivo al descartar (A3)**: el lienzo dice «motivo obligatorio»; hoy solo es obligatorio para asignar en los casos
  dudosos. Se dejó como hoy. ¿Se exige también para descartar?

- **Públicos en la barra**: el lienzo dice «9 + piloto». Se escribe el nombre declarado del público sin meta
  («9 + Piloto») y, si son varios, «9 + 2 sin meta». ¿Sirve así?
- **Insignia de Control**: cuenta lo que espera decisión (23 y 55), no todos los casos marcados (121 en Contabilidad).
  Coincide con el lienzo; queda anotado porque Consultas › Subsanación decía «32 casos sin cruce».
