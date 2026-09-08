# Checklist — «Correcciones Parte 1»: Avance de cursos-horario, de la app y del Sheets

**Fecha:** 2026-09-08 · **Origen:** dictado de Gonzalo en
`/Users/gonzaloalmendariz/Documents/Pulso/HSTVG2026/Corecciones Parte 1.docx`
(ocho puntos con capturas) más dos quejas de la conversación: «el .pulso no se
actualiza a pesar de que aprieto el botón de actualizar» y «no lee efectivas ni
nada». Gonzalo: «no te detengas hasta que esté todo solucionado».

Continúa `docs/qa/checklist-avance-dos-metas-2026-09-08.md` (V1–V3 y V6
cerradas); V4, V5 y A1–A4 de aquel checklist se **absorben** en éste, porque el
dictado los redefine con más detalle. El traspaso previo sigue valiendo para el
contexto: `docs/qa/traspaso-avance-dos-metas-2026-09-08.md`.

## Lo primero, porque bloquea todo lo demás

Gonzalo mira una pantalla que dice **Efectivas 0** y **0 de 2 500**. No es un
error de la vista: **el `.pulso` perdió la base de respuestas**. Medido sobre su
archivo real (`HSVG26ULT2.pulso`, guardado 2026-09-08 12:58 local) contra el
estado del día anterior:

| | `.pulso` de Gonzalo (08/09) | estado del 07/09 |
|---|---|---|
| `monitoreo_snapshot$data` | data.frame **0 × 0** | 273 filas |
| `monitoreo_aulas_snapshot$response_rows` | **0** | — |
| `synced_at` | 2026-09-08T17:17:23Z | 2026-09-07T20:41:25Z |
| `source_mapping$collector_var` | **`""`** | `"collectorID"` |
| `source_mapping$sex_var` | **`""`** | `"datos_demo/P2"` |
| `design_targets` | 2 500 / 3 750 (intacto) | 2 500 / 3 750 |
| plan / partes | 1 392 unidades / 17 partes | 1 392 / 7 |

O sea: **el botón de actualizar sí corrió hoy** (`synced_at` es de hoy y los
partes subieron de 7 a 17), pero dejó el snapshot vacío encima del bueno y de
paso reseteó el `source_mapping` a cadenas vacías. Sin `collector_var` no hay
forma de atribuir una respuesta a su curso-horario y sin `sex_var` no hay
desglose por sexo: por eso toda la pestaña dice cero, «sin medir» y «todavía sin
cursos-horario aplicados con qué comparar». Las metas (2 500 / 3 750) sí salen
porque `design_targets` sobrevivió.

**Ninguna corrección estética se puede verificar hasta que esto esté resuelto**,
porque todos los bloques del dictado se juzgan con datos reales en pantalla.

## Tablero

Un ítem por indicación. **B** = bloqueante, **C** = corrección del documento,
**S** = tabla del prompt del Sheets. Estados: ☐ pendiente · ◐ en curso ·
☑ cerrado · ⛔ bloqueado (necesita decisión de Gonzalo).

| # | Qué pidió | Dónde vive | Estado |
|---|---|---|---|
| B1 | Una sincronización que falla o vuelve vacía **no puede borrar** el snapshot bueno ni el `source_mapping`. Hoy los borró y dejó el estudio ciego | `.monitoreo_sync_empty_source_ids()` (`monitoreo_router_estado.R`) · `empty_source_ids` en `.monitoreo_merge_sync_result_data()` (`router_monitoreo.R`) · las dos llamadas de `monitoreo_sync_incremental.R` · `previous` en `monitoreo_aulas_normalize_config()` y `monitoreo_engine.R` | ☑ — el punto exacto era que Kobo respondiendo 200 con **cero registros** no es `NULL`: entraba como fuente sincronizada con éxito, el merge borraba sus filas previas y no ponía ninguna. El camino de ERROR ya estaba protegido; el del éxito vacío, no. 17 aserciones nuevas en `test-monitoreo-sync-vacio-no-borra.R`; 35 de 36 archivos del área en verde (el rojo restante es de la otra sesión, aislado contra `HEAD` limpio) |
| B2 | Recuperar el estado de Gonzalo y dejarlo **al día de hoy**, no en el respaldo | su `.pulso`, con respaldo fechado al lado | ☑ — la sincronización había borrado TRES cosas, no dos: el snapshot, el `source_mapping` y **la fuente de Kobo** (`monitoreo_sources` de 1 a 0), que es por lo que «actualizar» ya no tenía de dónde traer. Repuestas las tres desde el respaldo del 07/09 y sincronizado contra Kobo EU: **579 respuestas · 494 efectivas · 26 aulas aplicadas · 19,8 % de la muestra** (213 mujeres / 281 hombres), con el plan, las cuotas y los 17 partes intactos. Respaldo previo en «HSVG26ULT2 (respaldo antes de reponer 2026-09-08 13-56).pulso» |
| B3 | Que «actualizar» avise fuerte cuando no trae nada, en vez de dejar ceros que parecen un dato | `.monitoreo_sync_aviso_vacias()` (`monitoreo_router_estado.R`) · el snapshot y el estado lo publican · `AulasMonitoreoPage.tsx` lo enseña con tono de atención | ☑ — conservar en silencio también engaña: con el guard de B1 la pantalla enseñaría las cifras de antes con la fecha de ahora. El aviso dice la CAUSA y su consecuencia («X no devolvió ningún registro, así que se conservan las 273 anteriores: lo que ves es lo de la sincronización previa»), nombra la fuente por su etiqueta y no por su id, y distingue el caso sin datos previos. Vive en el SNAPSHOT, no sólo en el resultado del job, para que también lo vea quien abre la app al día siguiente |
| C0 | La pestaña «Cuotas» se llama **«Metas»** | `lib/navegacion/catalogos/monitoreo.ts` (sólo el rótulo; la clave `cuotas` no cambia para no romper las direcciones ya enlazadas) | ☑ |
| C1 | Quitar el panel «Desempeño del trabajo de campo» (roba alto y no aporta) | `MonitoreoWorkbenchChrome.tsx`: la calidad de campo se queda sólo en Validación | ☑ |
| C2 | Los KPIs **al inicio**, no intercalados, y exactamente estos siete en este orden: Efectivas · Muestra (meta) · Avance (%) sobre la muestra · Sobremuestra · Avance (%) sobre la sobremuestra · Cursos-horario aplicados · Cursos-horario planificados. Se van «Llegaron a su meta», «Cierran con lo agendado» y «Cursos-horario bajo su meta» | `kpisDeAulas.ts`, rama de Avance. Las cinco cifras de meta salen de `avance_cuota`, la MISMA fuente de la tabla y del libro. `cuotaKpi`, `cierreKpi` y `validasKpi` se retiraron: eran sus únicas llamadas | ☑ — los KPIs ya iban arriba; lo que los tapaba era el panel de C1 |
| C3 | Quitar la línea «Libro conversado con el Sheets: 17 partes del equipo entraron…» | `avisoConversacion.ts`: con todo en orden devuelve `null`. Los avisos de ATENCIÓN se quedan enteros — hoja ausente, publicación sin resumen, motivo desconocido | ☑ |
| C4 | El panel «Cuota asignada y encuestas logradas» se rehace entero: fuera el párrafo de arriba, y las tablas pasan a ser las del prompt del Sheets (S1–S5) | `AulasAvanceParaCliente.tsx` | ◐ — **hecho**: fuera el párrafo de cuatro frases de encima (era la tercera copia de las cifras que ya presiden la banda), fila «Total» y fila «Sobremuestra» al cierre de la tabla, y el pie corregido: decía «la sobremuestra **no es una segunda meta**», que contradice la decisión de las dos metas y lo que el test del libro prohíbe. **Pendiente**: montar S1–S5 cuando la otra sesión publique su contrato en el payload |
| C5 | «Hombres y mujeres por facultad»: dos filas bien alineadas (mujeres y hombres), barra rectangular **más ancha**, apilada, del **mismo largo** en ambas filas, verde el porcentaje avanzado y **gris suave** lo que queda, bordes definidos y elegante. Usar **todo el ancho** disponible. Fuera «Va a llegar, con margen» y «sin medir» | `AulasBarrasPorFacultad.tsx` + `barrasPorFacultad.ts` + `aulasBarrasPorFacultad.css` (hoja propia: `aulasMonitoreo.css` está congelada) | ☑ pendiente de que lo veas |
| C6 | La pirámide es **sección propia**, separada de lo de arriba. Ordenada de **facultad más pequeña a más grande**, largo de barra **proporcional a la cantidad de estudiantes**, verde lo conseguido. **Nada de predicción** (eso pertenece a otra pestaña): sólo dos estados, «faltan x» y, al pasarse, «sobran x» — nunca «faltarán x» | `piramideDeCuota.ts` (orden por tamaño; `sobran` nuevo en el modelo) · `AulasPiramideCuota.tsx` (veredicto de dos estados) · sección propia «Tamaño de cada meta» | ☑ pendiente de que lo veas |
| C7 | La tabla FACULTAD / SEXO / META / ESTADO desaparece, **a cambio de** que la pirámide tenga hovers profesionales que muestren todo | `AulasPestanaCuotas.tsx` (tabla fuera) · `AulasPiramideCuota.tsx` (hover con facultad · sexo · conseguidas de meta · % · estado, en `title` y en `aria-label`) | ☑ |
| C8 | El bloque «Cumplimiento de la cuota del estudio» va **al inicio**, antes del desglose por sexo | `AulasPestanaCuotas.tsx` | ☑ |
| S1 | Tabla **AVANCE GENERAL**: columnas Indicadores · Total · Hombres · Mujeres. Filas: Efectivas · Muestra · Avance muestra · Faltantes para la muestra · Sobremuestra · Avance sobremuestra · Faltantes para la sobremuestra · Aulas aplicadas · Aulas asignadas · Aulas planificadas | motor del libro + app | ☐ |
| S2 | Tabla **AVANCE POR FACULTAD**, 17 columnas: Facultad · Efectivas · Efectivas hombres · Efectivas mujeres · Muestra · Faltantes muestra · Muestra hombres · Faltantes hombre muestra · Muestra mujeres · Faltantes mujeres · Sobremuestra · Faltantes sobremuestra · Sobremuestra hombres · Faltantes hombre sobremuestra · Sobremuestra mujeres · Faltantes mujeres sobremuestra · Aulas aplicadas | motor del libro + app | ☐ |
| S3 | Tabla **RENDIMIENTO POR FACULTAD**: Facultad · Aulas aplicadas · Aulas planificadas · Tasa de rendimiento de la facultad esperada · Tasa obtenida hasta el momento · Diferencia · Aulas adicionales solicitadas hasta el momento | motor nuevo + app | ☐ |
| S4 | Tabla **PRODUCCIÓN POR APLICADOR**: Facultad · Aplicador · Aulas aplicadas · Fichas en la base · Fichas faltantes · Tasa de rendimiento esperada en facultad · Tasa de rendimiento obtenido · Aplicaciones regulares · Aplicaciones especial mañana · Aplicaciones especial noche | motor del libro + app | ☐ |
| S5 | Tabla **AVANCE DIARIO**: Facultad · Día · Día de la semana · Efectivas del día · Efectivas esperadas · Diferencia · Efectivas acumuladas · Faltantes para la meta (muestra) · Tasa de rendimiento de la facultad esperada · Tasa de rendimiento de la facultad obtenida (en el día) | motor nuevo + app | ☐ |
| S6 | **Semáforo de diferencias**: diferencia positiva (mejor de lo esperado) en escala de verdes, negativa en escala de rojos. Celda que llega a la meta, verde; que llega a la sobremuestra, azul/celeste | formato del Sheets (otra sesión) + estilos de la app (esta) | ☐ — espera a que existan las columnas de diferencia |
| S7 | Los `(%)` son **formato de celda**, nunca parte del título de la columna | todas las tablas | ☑ en la app — ningún rótulo nuevo lleva «(%)»; los KPIs se llaman «Avance a la muestra» y «Avance a la sobremuestra» |
| S8 | «Tasa de facultad» se llama **«Tasa de rendimiento de la facultad» esperada / obtenida**, sin abreviar | todas las tablas | ☐ — backend (otra sesión); en la app no existe todavía ese rótulo |

## Preguntas que le debo a Gonzalo

Se hacen viendo la pantalla, no antes, y no bloquean el resto del trabajo.

- **Q1 (orden de los sexos).** El dictado del documento pone Hombres antes que
  Mujeres en AVANCE GENERAL, y Efectivas hombres antes que Efectivas mujeres en
  AVANCE POR FACULTAD; el checklist anterior había dejado mujeres→hombres en
  todo el libro y en la app. Son rótulos: se hace lo que diga, pero hay que
  elegir UNO y aplicarlo en las cinco tablas y en las barras.
- **Q2 (aulas asignadas).** S1 pide «Aulas aplicadas · Aulas asignadas · Aulas
  planificadas». «Asignadas» hoy no existe como concepto separado en el motor:
  ¿son las que tienen aplicador asignado en el reparto, o las agendadas?
- **Q3 (aulas adicionales solicitadas).** S3 pide «Aulas adicionales solicitadas
  hasta el momento». ¿De dónde sale ese dato — de los reemplazos, de las
  «Aulas Agendadas (Extra)» del Sheets, o de un campo del parte de campo?
- **Q4 (aplicaciones especiales).** S4 pide «Aplicaciones regulares / especial
  mañana / especial noche». ¿Qué las distingue: la franja horaria del
  curso-horario, o una marca que pone el aplicador en su parte?
- **Q5 (efectivas esperadas por día).** S5 pide «Efectivas esperadas» por día y
  facultad: ¿se reparte la meta de la facultad entre sus días agendados, o hay
  una expectativa diaria declarada en algún sitio?
- **Q6 (la pestaña «Metas»).** Con las cinco tablas dentro, ¿siguen todas en la
  misma pestaña o algunas se van a pestañas hermanas de Avance?

## Reparto acordado con Gonzalo (2026-09-08 ~14:10)

**Ella el backend, yo la app.** La sesión «Asignación de fechas y horarios
aplicadores» estaba construyendo S1–S5 en `carga_aulas_libro_avance_*` a la vez
que yo; Gonzalo repartió así. Yo no toco ninguno de esos archivos. Comprobado a
las 14:35: la tabla por facultad **ya sale con las 17 columnas de S2**, con los
nombres exactos del dictado.

Sus respuestas a las cuatro preguntas de datos, ya enviadas a esa sesión:

| # | Pregunta | Respuesta |
|---|---|---|
| Q2 | Qué son las «aulas asignadas» de S1 | Las que tienen **aplicador asignado**. Y la distribución vive en el Sheets `1-NmlPFRhq2G…`, con **una hoja por semana**: la asignación no es un estado único |
| Q3 | De dónde salen las «aulas adicionales solicitadas» de S3 | **Las dos cosas sumadas**: las «Extra» del Sheets del operativo y los reemplazos activados del banco |
| Q4 | Qué hace «especial» una aplicación en S4 | **La hora de INICIO DE APLICACIÓN**, no la de entrada ni salida de oficina. Regular de **09:00 a 18:00**; antes, especial mañana; después, especial noche |
| Q5 | Cómo se calculan las «efectivas esperadas» por día en S5 | **Suma de las metas (`expected_valid`) de las aulas agendadas ese día** en esa facultad. No hace falta dato nuevo |

## Lo que la otra sesión dejó cerrado en el backend (2026-09-08 ~15:00)

Commits `165e56fd` y `8fae19e3`. Las cinco tablas del prompt están en el motor y
en el Sheets; lo que sigue abierto es montarlas en la app.

**Cambió el modelo del libro y conviene saberlo aunque la app no lo lea:**
`ind$metas` pasó a `ind$general`; `ind$facultades` conserva el nombre pero son
17 columnas con otros rótulos (`Faltantes` → `Faltantes muestra`, etc.) y
**hombres antes que mujeres** en las cinco tablas; `ind$aplicadores` e
`ind$diario` se rehicieron y apareció `ind$rendimiento`. Los rótulos viven en
`carga_aulas_libro_avance_columnas.R` y se leen de ahí, **nunca se copian**.
Comprobado por grep: la pestaña sólo lee `avance_cuota`, `quotas_sex_faculty`,
`avance_por_facultad`, `efectividad_seguimiento` y `reserva_dirigida`, así que
ningún rótulo del libro la ancla.

**Trampa anotada para cuando se monte RENDIMIENTO POR FACULTAD (S3):**
`rendimiento_ref` es **por aula, no por facultad**. Promediarlo da un número que
no es de nadie —dentro de Arquitectura va de 44 % a 80 %, y promediando salía
69,0 % para una persona y 55,0 % para la de al lado—. La tasa esperada de una
facultad es la razón de los agregados, `Σ expected_valid / Σ eligible_n`:
`prosecnurapp:::.calar_tasa_esperada()`, que en Arquitectura da 56,3 %. Si la app
usa otra definición, las dos superficies enseñarán dos cifras para lo mismo.

**Cruce de cifras app ↔ Sheets, 2026-09-08 15:00.** Coinciden las ocho, y
«Faltantes muestra 2 006» por caminos distintos —ella desde el motor del libro,
la app sumando grupo a grupo desde `quotas_sex_faculty`—, que es lo que prueba
que la regla de no netear está igual en los dos lados:

| | Sheets | App |
|---|---|---|
| Efectivas | 494 | 494 |
| Muestra | 2 500 (1 261 H / 1 239 M) | 2 500 (1 261 H / 1 239 M) |
| Avance muestra | 19,8 % | 19,8 % |
| Faltantes muestra | 2 006 | 2 006 |
| Sobremuestra | 3 750 | 3 750 |
| Avance sobremuestra | 13,2 % | 13,2 % |
| Aulas aplicadas | 26 | 26 |
| Aulas planificadas | 174 | 174 |

## Reglas de esta tanda

- Nunca publicar al Sheets del operativo ni al de distribución sin el go
  explícito de Gonzalo. La publicación de esta ronda la coordina la sesión
  «Asignación de fechas y horarios aplicadores», por decisión suya.
- Commit por nombre de archivo, nunca `git add -A`: **este árbol lo comparte
  otra sesión**, que hoy tiene tocados `api/NAMESPACE`,
  `carga_aulas_libro_generar.R`, `carga_base_control.R` y
  `monitoreo_aulas_conteos_control.R`. No tocar esos cuatro. Tampoco
  `.claude/launch.json` ni `docs/qa/checklist-marco-ccss-2026-09-07.md`.
- El 8787 y el 8836 son de Gonzalo: nunca matarlos. El 8837 es de esta sesión;
  relanzarlo reinstala el paquete R, así que sólo con nadie más instalando
  (`pgrep -f "R CMD INSTALL"`, sin `00LOCK-*` en la librería) y sin
  interrumpirlo.
- La suite del área **no** se corre en un solo proceso de R: 104 archivos
  juntos dieron 115 rojos y uno por proceso, 15. Contaminación de estado entre
  archivos; localizar antes de creerle al contador.
- Nunca escribir sobre el `.pulso` de Gonzalo: se trabaja sobre copia.
