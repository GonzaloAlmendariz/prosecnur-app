# Seguimiento de cuotas en cursos-horario — método y motores

Cómo se mide el avance de un operativo de aulas, con qué motor sale cada cifra
y qué trampas ya nos costaron un ciclo. Destilado del campo de HSVG2026
(07/09 → 01/10/2026); las cifras citadas son de ese estudio y sirven de orden
de magnitud, no de constante.

Vocabulario y arquitectura general: `docs/arquitectura-prosecnur.md` y el mapa
de módulos de `CLAUDE.md`. Aquí sólo el seguimiento de cuotas.

---

## 1. La unidad de medida es la celda facultad × sexo

**El porcentaje global miente por diseño.** HSVG llegó a estar en 112,2 % de la
muestra con **siete celdas abiertas**, y EE.GG. Letras tenía 292 mujeres sobre
una cuota de 240 y aun así le faltaban 4 hombres. El excedente de una celda no
compensa el déficit de otra: son cuotas independientes.

Con 15 facultades son **30 celdas**. Una facultad cierra cuando cierran sus dos.

- Motor: `.calaf_avance_por_facultad()` — `api/R/carga_aulas_libro_avance_facultad.R:111`
- Devuelve por facultad: `Efectivas`, `Muestra`, `Avance muestra` y `Faltantes`,
  cada uno en total / hombres / mujeres. La brecha de una celda es
  `Muestra hombres − Efectivas hombres`, nunca el total.
- Las cuotas vienen de `cfg$aulas_universitarias$design_targets`
  (`api/R/monitoreo_aulas_universitarias.R:516`). **Sin cuotas no hay reporte**:
  el modelo corta con `E_AULAS_SIN_CUOTAS` en vez de publicar ceros.

## 2. De dónde sale cada número

### La efectiva la cuenta Kobo, no el parte

El parte de la ficha reporta lo que el aplicador ve; la fuente de verdad es la
plataforma. En HSVG había **175 partes y 151 aulas con efectivas, y no eran el
mismo conjunto**: aulas aplicadas sin parte, y al menos un parte declarando 23
efectivas con cero en Kobo.

- `monitoreo_aulas_efectivas_por_aula(plan, responses, cfg)` — `api/R/monitoreo_aulas_efectivas.R:27`
- El aula se identifica por **`collectorID`**, no por código de curso-horario.

### Qué cuenta como respuesta válida

- `.monitoreo_aulas_valid_response(data, cfg)` — `api/R/monitoreo_aulas_criterio_validez.R:114`
- Los filtros los **declara el estudio** en `cfg$source_mapping$valid_filters`
  (`monitoreo_aulas_universitarias.R:694`) y se exigen TODOS.
  `monitoreo_aulas_filtros_de_validez()` (`criterio_validez.R:64`) los lee.
- `.monitoreo_aulas_descartada()` (`criterio_validez.R:100`) quita lo marcado a
  mano, y eso manda sobre cualquier otra rama.

Cadena real de HSVG al 18/09: **3.051 descargadas → 2.806 efectivas**. Se caen
195 por consentimiento (`inicio/consent_1`, `inicio/consent_2`) o por
`inicio/filtro`, y 37 descartadas — entre ellas los envíos con collector
`PRUEBA_2026` y `CAPACITACION`.

**Trampa documentada en el propio código**: `_status` de Kobo vale
`submitted_via_web` en todas las filas. Si se toma como estado de validación,
el avance cae a CERO en silencio. El criterio lo excluye a propósito.

### Aula aplicada

- `api/R/monitoreo_aulas_aula_aplicada.R:33` — definición única.
- Con efectivas > 0 es aplicada. Si no, exige estado `aplicada` **y** parte
  firmado (`applied_date` o `applied_by`): un parte sin firma no prueba que se
  fuera a campo.

## 3. Las clases de aula y su rendimiento

Lo que permite proyectar en vez de adivinar. Medido en HSVG:

| Clase | Rinde |
|---|---|
| Titular | 53 % |
| Reemplazo (caso A) | 50 % |
| Adicional (caso C) | **32 %** |
| Banco de extras | **27 %** |

**Un refuerzo rinde la mitad que un titular.** Para dimensionar cuántas aulas
pedir se usa el 32 %, no el 53 %. Para proyectar las ya agendadas usamos el
**38 %** observado en los refuerzos que ya fueron.

- `monitoreo_aulas_refuerzos(plan, responses, cfg, hoy)` — `api/R/monitoreo_aulas_refuerzos.R:230`
  Devuelve `{ok, motivo, hoy, techo, diseno, activadas, rendimiento, disponibles}`.
  `rendimiento` trae `n`, `elegibles`, `efectivas` y `tasa` por clase.

### A / B / C

Vocabulario del operativo: **A** es reemplazo porque el titular no concretó,
**B** complementa un curso-horario concreto, **C** es un aula adicional que
refuerza la cuota de una facultad.

**Sólo A es deducible.** B y C los decide quien eligió el aula; el motor no los
adivina y por eso 14 de 24 quedaron sin letra. La procedencia se sella con
`monitoreo_aulas_sellar_procedencia()` (`refuerzos.R:713`) en tres grados:
`declarada`, `sellada`, `reconstruida`.

## 4. Cómo se elige un refuerzo

1. **Qué celda falla y de qué sexo.** No basta la facultad: Psicología
   necesitaba 8 hombres y 20 mujeres y estaba al filo *en hombres*, con 7,6
   proyectados. Elegir por «más elegibles» habría fallado.
2. **La composición del aula**: `sex_top_1` / `sex_top_1_n` / `sex_top_2` del
   plan. Un aula de 26 con 21 hombres cierra una brecha de 4 hombres; una de 25
   con 21 mujeres, no.
3. **Elegibles únicos y solape.** La encuesta es anónima: el solape se
   dimensiona **por aula**, nunca por persona.
4. **El techo de aulas** (`cfg$techo_aulas_campo`,
   `monitoreo_aulas_universitarias.R:749`): cuántos cursos-horario admite el
   operativo en total, contra los que ya fueron más los que están por delante.

Motores de apoyo, todos en `api/R/monitoreo_aulas_refuerzos.R`:
- `monitoreo_aulas_cuotas_urgentes(riesgo, hoy, dias_de_reaccion)` — `:399`
  ordena por cantidad, tiempo y respaldo, cada eje con su motivo legible.
- `monitoreo_aulas_candidatos_refuerzo(...)` — `:535`, una lista con
  `dentro_del_techo`, elegidos por su aporte a la celda que falla.

Marcar uno: `monitoreo_aulas_marcar_refuerzo()` —
`api/R/monitoreo_aulas_refuerzo.R:31`, o desde la UI en
`frontend/src/features/monitoreo/profiles/aulas/AulasRefuerzoPorCodigo.tsx`
(lógica en `refuerzoPorCodigo.ts`).

La hoja «Facultades en riesgo» sale de
`monitoreo_aulas_riesgo_facultades()` — `api/R/carga_aulas_libro_riesgo.R:311`.

## 5. Cómo se verifica que el operativo cierra

No basta con «alcanza». Se miden tres cosas:

**Celdas abiertas en tres escenarios**: hoy sin nada más, con lo agendado, y con
los refuerzos. En HSVG fue `7 → 1 → 0`.

**El punto de quiebre**: a qué tasa de rendimiento deja de cerrar. Con los
refuerzos aguantaba hasta el **22 %** y se rompía al 20 % — casi la mitad del
38 % observado. Eso es margen medido, no una sensación.

**Que el refuerzo esté donde falta.** Llegamos a tener 88 elegibles agendados en
una facultad ya cerrada mientras otra necesitaba 4 encuestas y no tenía nada
programado.

Reporte de avance para cliente:
- Modelo: `build_monitoreo_aulas_report_model(snapshot, cfg, include_targets)` —
  `api/R/monitoreo_aulas_report_pdf.R:35`. **Exige el plan dentro de
  `cfg$aulas_universitarias$plan`**; si el plan vive sólo en
  `state$monitoreo_aulas_plan` hay que inyectarlo.
- Render: `monitoreo_aulas_advance_report_pdf()` — `report_pdf.R:233`.
- Serie diaria: `.calad_avance_diario()` —
  `api/R/carga_aulas_libro_avance_diario.R:71`, resumida por
  `monitoreo_aulas_ritmo_de_avance()` — `api/R/monitoreo_aulas_report_ritmo.R:32`.
- Por HTTP: `POST /api/monitoreo/production-report/pdf`.

Qué entra en un PDF de avance y qué no: `feedback_pdfs_avance_vs_estructurales`.

## 6. Agenda, reparto y publicación

### Sincronizar con el libro del operativo

El `.pulso` guardado **no sabe lo que hizo el agendador**. En HSVG, 14 aulas
marcadas el 18/09 seguían en «sin contactar» cuatro días después porque nadie
había sincronizado.

- `POST /api/monitoreo/aulas/importar-sheets` — `api/R/router_monitoreo.R:5491`
- `aulas_libro_importar_sheets_en_sesion(sid, id, pestanas)` — `api/R/carga_aulas_libro.R:240`
- Lee cinco pestañas: «Aulas Agendadas», «Aulas Agendadas (Extra)»,
  «Aulas Aplicadas (Campo)», «Aulas Aplicadas (Extra)» y «Base de control»
  (`aulas_libro_leer_de_sheets()` — `api/R/carga_aulas_desde_sheets.R:211`).
  **«Plan del día» NO se lee**: es salida, no fuente.
- El traductor recorre los bloques `R1…R11` de cada fila:
  `aulas_agendadas_a_plan()` — `api/R/carga_aulas_agendadas.R:297`.
- La fusión con el plan de sesión es un UPSERT por código:
  `aulas_libro_fusionar_plan()` — `api/R/carga_aulas_libro_fusion.R:83`.
  Sólo pisa los campos que el libro posee (`AULAS_LIBRO_CAMPOS_PROPIOS`).

**Leer no es publicar.** «Traer respuestas» re-publica el libro; para sólo leer,
«Leer del Sheets» (`importar-sheets`).

### El reparto de aplicadores

- `monitoreo_aulas_reparto(plan, disponibilidad, fijadas, duracion_min, rango, semilla, concentrado)`
  — `api/R/monitoreo_aulas_reparto.R:184`
- Una sola traducción config→reparto: `monitoreo_aulas_reparto_de_config()` —
  `api/R/monitoreo_aulas_distribucion_semanas.R:198`.
- Claves en `cfg$aulas_universitarias` (`monitoreo_aulas_universitarias.R`):
  `reparto_fuera` (`:809`), `reparto_rango` (`:791`), `reparto_concentrado`
  (`:782`), `reparto_semilla` (`:774`), `reparto_fijado`,
  `duracion_aplicacion_min` (`:760`).

**La disponibilidad del proyecto no es quién sale esta semana.** HSVG tenía 31
personas cargadas y salieron 12. Sin declarar `reparto_fuera` el motor asigna
citas a gente que no viene — pasó, y seis de la semana 3 no estaban en la lista
real. Se declara desde Disponibilidad, con
`monitoreo_aulas_disponibilidad_sin()` (`distribucion_semanas.R:226`) quitándolos
**antes** de repartir, no después.

### Publicar la distribución

- `POST /api/monitoreo/aulas/publicar-distribucion` — `api/R/router_monitoreo.R:4981`
- `monitoreo_aulas_publicar_distribucion(destino, plan, disponibilidad, config_reparto, partes)`
  — `api/R/monitoreo_aulas_publicar_distribucion.R:52`
- Parte por semana y nombra la pestaña sola:
  `monitoreo_aulas_reparto_por_semana()` (`distribucion_semanas.R:110`) +
  `.mads_hoja_para_semana()` (`:159`), contra
  `monitoreo_aulas_inicio_de_campo()` (`:58`). No hay que crear la pestaña.
- Respeta las semanas que ya tienen trabajo del coordinador; siembra las que
  faltan. **Publicar no pisa lo manual.**

**Siembra también filas con el aplicador en blanco** para las aulas sin cita
confirmada, con la ventana de su clase marcada «(clase)» —
`aulas_libro_filas_plan_aplicadores()` — `api/R/aulas_libro_plan_aplicadores.R:351`.
Son la invitación a ir **sin agendación**. Un estudio que ya no hace eso las
tiene que borrar a mano, y **reaparecen si alguien republica**. Hacerlo opcional
está pendiente.

Tramos con nombre: `monitoreo_aulas_tramos(cfg, plan)` —
`api/R/monitoreo_aulas_tramos.R:63`. Con `cfg$tramos` declarado los usa; si no,
deduce «Semana N» del calendario del plan. UI en
`AulasTramosDelOperativo.tsx`, dentro de la caja «Cómo se reparte».

## 7. Convivencia con otro estudio sobre la misma población

- **El traslape informa, no descuenta.** Nunca toca cuotas ni tamaño de muestra.
- **Traslape de AULA** = mismo curso **y mismo horario** → mismos alumnos.
  **Traslape de DOCENTE** = otro curso → alumnos distintos; es un aviso de trato
  con la persona, no una prohibición de entrar. No se mezclan en una columna.
- **Los códigos no cruzan entre estudios.** `ID MATCH` y `CH n` / `R n.m` son
  correlativos por documento: parecen llaves, devuelven resultado y emparejan
  aulas ajenas. Se cruza por **docente + curso + horario**.
- **Un aula que vive en dos estudios tiene dos estados**, y el del otro lado se
  pregunta a quien lo lleva; no se deduce del propio `.pulso`.
- **Sólo se publica lo consumado.** «Está en el plan del otro estudio» es una
  hipótesis sobre el futuro y envejece: publicarla llenó 27 de 42 filas de
  avisos, y un aviso en dos de cada tres filas deja de leerse.
- Un bloque de traslape fechado es **hipótesis por aula**: el de CCSS se calculó
  el 15/09 y dio 2 falsos de 15 verificadas.

Detalle: `feedback_codigos_correlativos_no_cruzan_dos_estudios` y
`feedback_traslape_informa_no_descuenta` en la memoria del proyecto.

## 8. Trampas que ya costaron un ciclo

- **Un aula sin parte no es un aula sin aplicar**, y al revés. El parte se teclea
  tarde: cuatro aulas de una semana aparecían en cero y sin parte, y eso no
  prueba que no se fuera.
- **Dos personas pueden compartir apellido.** En HSVG coexistían «Chamorro
  Rodríguez» y «Puchuri Chamorro». Nombre completo siempre, en hojas y en
  mensajes.
- **Sincronizar en una sesión y guardar otra** deja el proyecto igual y parece un
  bug del sync. Por HTTP, el `sid` va en la cabecera `X-Pulso-Session`; la
  cookie no basta (`POST /api/project/save` — `api/R/router_proyecto.R:18`).
- **El `.pulso` extraído es una foto.** Si el usuario vuelve a guardar, hay que
  re-extraer: comparar `mtime` antes de medir.
- **Levantar un backend puede disparar `R CMD INSTALL`** si el paquete instalado
  quedó por detrás de la fuente. No se interrumpe y no se lanzan dos a la vez.

## 9. Rutas del operativo HSVG2026

- Proyecto: `HSTVG2026/Segundo sorteo 27 agosto/HSVG26ULT2.pulso`
- Reportes de avance: `HSTVG2026/Reportes de avance/`
- Libro del operativo (agenda y partes): `11HV4-gmCGMfnWSczkkuO1f3yD0xG_wlwSh2jQtVrdPc`
- Distribución de aplicadores (la ven ellos): `1-NmlPFRhq2G-JgNNEh_kOSFnZeTLKzpw9DrbZyCOBmE`

Los dos Sheets tienen dueños distintos y reglas distintas; ver
`project_traspaso_operativo_aulas_hsvg2026` y
`reference_sheets_distribucion_aplicadores_hsvg2026`. **Nunca se tocan las hojas
de agenda**: hay alguien agendando en vivo.
