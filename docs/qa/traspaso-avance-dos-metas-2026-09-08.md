# Traspaso — Avance con las dos metas, por sexo, en el Sheets y en la app

Tipo: Traspaso de sesión
Estado: Histórico
Consolidado en: [Checklist — Correcciones Parte 1](checklist-avance-correcciones-parte1-2026-09-08.md)
Fecha: 2026-09-08
Autoridad: Evidencia de QA; no reemplaza un ADR

**Hora:** ~10:15 · **De:** sesión `87ed0566` (la del loop de estética,
detenido) · **Para:** la sesión que continúe. Gonzalo: «una vez que cierres eso
dejamos un mensaje para enviárselo a otra sesión y cerramos esta».

Checklist vivo (dibujarlo entero cada vez que se mencione):
`docs/qa/checklist-avance-dos-metas-2026-09-08.md`. Este documento explica lo que
el checklist no puede: por qué está cada cosa como está y por dónde seguir.

## 1. En dos líneas

HSVG2026, Monitoreo › cursos-horario. Gonzalo detuvo el loop de estética
(`docs/qa/checklist-loop-estetica-sheets-app-2026-09-07.md`) para ver en
conversación **el Avance, en el Sheets y en la app**. Contestó cuatro preguntas y
dictó las columnas de la tabla por facultad. La tabla ya está en `main`
(`ed17d4ee`); el bloque de meta, el diario por facultad y la app siguen.

## 2. Lo que Gonzalo decidió (textual, no interpretar de nuevo)

1. **La meta:** «Dos metas una real y otra referencial (aunque no debe decir que
   lo es), la de 2500 y la de 3750. Además debe estar clarísimo la meta de hombres
   y mujeres en total y por facultad en muestra y sobremuestra. Debe haber una
   fila de total al final y todo debe estar muy estético e intuitivo.»
   → Se llaman **Muestra** (2 500) y **Sobremuestra** (3 750). Mismo trato para
   las dos: meta, efectivas, avance, faltantes; en total, por sexo y por
   facultad. Ninguna nota dice «referencial», «margen», «segunda meta» ni
   «techo» (hay test que lo prohíbe).
2. **Facultades:** «Barras por facultad» (una fila por facultad, barra partida en
   mujeres y hombres, cifras al lado, chips sólo cuando algo cambia).
3. **El día:** «Por día y por facultad».
4. **Qué preside Avance:** «Efectivas sobre la cuota (212 de 2,500 · 8,5 %)».
5. **Columnas de la tabla por facultad** (con pantallazo del Sheets vivo):
   «Facultad, muestra, muestra mujeres, muestra hombres, efectivas, efectivas
   hombres, efectivas mujeres, faltantes (sobre muestra), faltantes hombre,
   faltantes mujeres, aulas aplicadas, sobremuestra, sobremuestra mujeres,
   sobremuestra hombres, faltantes (sobre la sobremuestra)». Se fueron «Aulas
   del plan», «Avance» (%) y «Techo con sobremuestra». **Decisión propia a
   confirmar con él:** el dictado alterna el orden de los sexos; quedó
   mujeres→hombres en los cuatro grupos. Si lo quiere al revés son rótulos.

## 3. Lo que ya está en `main` (`ed17d4ee`)

- `api/R/carga_aulas_libro_avance_facultad.R`: las 15 columnas;
  `.calaf_repartir()` (resto mayor) y `.calaf_sobremuestra_reparto()`: la
  sobremuestra por facultad y por sexo suma exactamente la del diseño (3 750 =
  1 859 + 1 891). Faltantes por sexo y contra la sobremuestra con
  `monitoreo_aulas_brecha_facultad()` (ADR 0079, la misma del tablero).
- `api/R/carga_aulas_libro_avance_total.R` (nuevo): `.calaf_fila_total()` y
  `.calaf_nota_metas()`, UNA función para el xlsx y el Sheets.
- xlsx (`aulas_libro_escribir_indicadores`, bloque de facultades) y Sheets
  (`aulas_libro_hoja_avance`) escriben la fila «Total» y la nota; el formato del
  Sheets viste toda fila «Total» como cierre (`.maaf_FILA_TOTAL`).
- PDF (`monitoreo_aulas_report_pdf.R`) lee la misma tabla: 15 columnas con
  grupos; `total$aulas_del_plan` ya no existe.
- Medido sobre el estado real: Total 2 500 (1 239 M / 1 261 H) · Efectivas 212
  (77 / 135) · Faltantes 2 288 (1 162 / 1 126) · Aulas aplicadas 9 ·
  Sobremuestra 3 750 (1 859 / 1 891) · Faltantes para la sobremuestra 3 538.
- Gates: facultad 79, xlsx 67, Sheets 90, indicadores 43, formato 58, paridad,
  conteos, report-model 14, despacho 10, todo en verde; `sync-agentic-os --audit`
  OK; render real revisado y enviado a Gonzalo.
- **No publicado a ningún Sheets.** La pestaña «Avance de campo» sale con la
  próxima publicación del libro desde la app (exige build + relanzar backend).

## 4. Lo que falta, en orden sugerido, con dónde vive

**V3 — bloque «Avance contra la meta».** Hoy abre con «Encuestas de la meta 3 158»
(Σ `expected_valid` del plan, una tercera cifra que Gonzalo no pidió). Debe abrir
con Efectivas 212 de 2 500 (8,5 %) y traer las dos metas por sexo. Diseño
propuesto: tabla `Por sexo | Total | Mujeres | Hombres` con filas Efectivas ·
Muestra · Avance a la muestra · Faltantes (muestra) · Sobremuestra · Avance a la
sobremuestra · Faltantes (sobremuestra); debajo, «Aulas del operativo» y «Aulas
que llegaron a SU meta» (siguen siendo por curso-horario); sin cuotas del diseño,
el bloque actual (meta del plan). Todo se deriva de `.calaf_fila_total(ind$facultades)`
más los faltantes por sexo ya en la tabla. Hooks: `aulas_libro_indicadores()`
devuelve `metas` (archivo nuevo `carga_aulas_libro_avance_metas.R`); writer xlsx
(bloque meta, `filas_meta`, ~línea 400) y renderer Sheets (`fila_meta`, ~línea
116); `.maaf_CABECERAS_TABLA` gana «Por sexo» (`monitoreo_aulas_avance_formato.R`);
las filas «Avance…» se formatean como porcentaje POR FILA (hoy `.cala_tabla_filas`
sólo sabe por columna). Tests que pinean el bloque viejo y SIGUEN valiendo porque
sus fixtures no traen cuotas: `test-carga-aulas-libro-avance-sheets.R` (`.cas_modelo`),
`test-carga-aulas-libro-indicadores.R` (A9-B6). `test-monitoreo-aulas-formato-avance.R`
pinea `.maaf_TITULOS_BLOQUE` y `.maaf_CABECERAS_TABLA`.

**V4 — «Avance diario» por día y facultad.** Matriz: una fila por día, una
columna por facultad (mismo orden que la tabla de arriba), «Sin curso-horario»
sólo si hay, «Total del día», «Efectivas acumuladas», «Faltantes para la
muestra» y «Faltantes para la sobremuestra» (por celdas, ADR 0079), fila «Total».
Facultad de cada respuesta: `.maac_atribucion(plan_df, validas,
.monitoreo_aulas_response_classroom(responses, cfg))$facultad` con `plan_df <-
.monitoreo_aulas_df(monitoreo_aulas_normalize_plan(unidades), "plan")` (tres
claves, la misma del tablero); sexo con `monitoreo_aulas_columna_sexo()` +
`monitoreo_aulas_sexo_key()`; día como hoy (`MONITOREO_AULAS_COLUMNAS_TIEMPO`,
hora local). `.cali_cierre_diario()` se generaliza: suma todo salvo
acumulados/faltantes, que toman el último. Sin diseño: «Falta para la meta» del
plan como hoy. Pregunta Q6 abierta: días como filas (propuesto) o como columnas.
Pins que cambian: S5 en `test-carga-aulas-libro-avance-sheets.R` y
`test-carga-aulas-libro-avance-xlsx.R` (columnas 2:4 del «Total»).

**V5 — cabeceras agrupadas** (Muestra / Efectivas / Faltantes / Sobremuestra)
fusionadas sobre sus columnas: xlsx con `mergeCells`; Sheets con una fila de
grupo en `.maaf_requests`. Trampa: `.maaf_es_fila_de_datos()` contaría una fila
de grupo como datos y apagaría la alineación a la derecha de las cifras; hay que
detectarla (fila con primera celda vacía justo antes de una cabecera).

**A1 — banda de Avance.** Primera tarjeta «Efectivas sobre la cuota», valor
«212 de 2 500», pista «8,5 % de la muestra · 5,7 % de la sobremuestra (3 750)»;
sustituye a «Efectivas» a secas (`validasKpi`). `kpisDeAulas.ts`, `aulasKpis()`,
rama de Avance (~línea 900: `registroKpi, validasKpi, Llegaron, cierreKpi,
cuotaKpi, brechasKpi`). Datos: `cuotasResumen(quotas_sex_faculty).general`
(meta 2 500, logrado 212) y `avance_cuota.meta_operativa`. Test
`kpisDeAulas.test.ts`.

**A2 — barras por facultad** en el panel «Cuota asignada y encuestas logradas»
(`AulasPestanaCuotas.tsx` monta `AulasAvanceParaCliente.tsx`, hoy una tabla).
Componente nuevo `AulasBarrasPorFacultad.tsx` + view-model + css: un carril por
sexo contra SU cuota, con la sobremuestra como tramo extra; colores
`--cmv2-sex-mujer` / `--cmv2-sex-hombre` (`features/calcMuestra/sexoPalette.ts`);
cifras al lado (las mismas 15 columnas); chip sólo «Cuota cumplida» o «Le falta
poco» (`veredicto()` ya existe); fila Total; encabezado con las dos metas por
sexo. Datos en el payload: `avance_cuota` (`facultades[]`: cuota,
respuestas_validas, brecha; `meta_diseno`, `sobremuestra`, `meta_operativa`),
`quotas_sex_faculty` (30 celdas: faculty, sex, target, observed, missing),
`efectividad_seguimiento.facultades[].aulas_aplicadas`. La sobremuestra por
facultad y sexo NO viaja al front: publicarla desde R en `avance_cuota.facultades[]`
(`sobremuestra`, `sobremuestra_f`, `sobremuestra_m`) usando
`.calaf_sobremuestra_reparto()`, para que haya una sola definición. Diseñar en
grande (memoria «diseñar en grande por defecto»), sin rayas largas en textos,
unidad «curso-horario» (ratchet `vocabularioDeLaUnidad.contract.test.ts`, TOPE
12), «celda» prohibida como unidad de cuota (`cifrasConFormato.test.ts`), títulos
de panel no pueden colisionar (`rotulosNoColisionan.contract.test.ts`).

**A3 — avance diario por facultad en la app.** Bloque `avance_diario_facultad` en
`aulas_universitarias_reports` (`monitoreo_aulas_universitarias.R`, donde se arma
`avance_cuota`, ~línea 1746), la MISMA función de V4; tipo en `api/monitoreo.ts`;
panel nuevo en Avance › Cuotas.

**A4 / Q5 — la pirámide** (`AulasPiramideCuota.tsx`) dirá lo mismo que A2 en
otra forma; preguntarle a Gonzalo si se retira. No borrar archivos sin su ok.

Loop de estética: S6 (Q3), S9, A7 (Q4) y A6c siguen abiertos en su checklist;
sólo si Gonzalo reabre el loop.

## 5. Cómo verlo

- **xlsx real:** en el scratchpad de la sesión `87ed0566`, `render_v1/avance_v1.R`
  (rutas absolutas dentro; lee `disk_1559/state.rds` del scratchpad `83ff848b`,
  la copia `HSVG26ULT2_loop.pulso` extraída el 07/09). Render: LibreOffice con
  perfil propio `soffice -env:UserInstallation=file:///private/tmp/claude-501/lo_profile_83ff
  --headless --convert-to pdf`, luego `pdftoppm -png -r 110`. Sin el perfil
  propio, soffice choca con el de otras sesiones y no produce PDF.
- **App:** `.claude/launch.json` (compartido, NO commitear) tiene «Backend loop
  estetica (8837)», que bootstrapea la copia del `.pulso`, y «Frontend loop
  estetica (dev vs 8837)». El panel del navegador es la ventana: la app de
  Gonzalo (8787) no muestra cambios hasta build y relanzar. Relanzar el 8837
  reinstala el paquete R (el launcher compara mtimes): sólo con nadie
  instalando (`pgrep -f "R CMD INSTALL"`, sin `00LOCK-*` en la librería) y sin
  interrumpirlo. El 8787 y el 8836 son del usuario: nunca matarlos.
- **Estado por HTTP:** `curl -H "X-Pulso-Session: <sid>"
  "http://127.0.0.1:8837/api/monitoreo/state?include_reports=1&report_scope=advance_summary"`
  (10 MB, ~9 s en frío); `avance_cuota` y `quotas_sex_faculty` viven en
  `/dashboard/aulas_universitarias_reports/`. El `sid` sale de
  `/api/system/bootstrap` al abrir el frontend con el deep link `?pulso=`.

## 6. Reglas que no se negocian

- Nunca publicar al Sheets del operativo ni al de distribución sin el go
  explícito de Gonzalo; nunca `force`; las pestañas del equipo son `respetada`;
  nunca tocar las hojas de agenda.
- Commit por nombre de archivo, nunca `git add -A` (el 08/09 otra sesión barrió
  un diff ajeno en verde). No tocar `.claude/launch.json` ni
  `docs/qa/checklist-marco-ccss-2026-09-07.md` (otra sesión).
- `api/NAMESPACE` se genera (roxygen); nada de lo nuevo se exporta.
- Rojo primero, gates escalados al diff, verificar en vivo antes de declarar.
- En el LIBRO Gonzalo dictó «Aulas aplicadas»: se respeta; en la app la unidad
  es «curso-horario».
