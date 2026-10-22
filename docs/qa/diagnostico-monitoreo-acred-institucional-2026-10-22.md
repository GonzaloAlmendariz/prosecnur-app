# Diagnóstico · Monitoreo para «Acreditación Institucional PUCP 2026» (2026-10-22)

Estudio para la DAA (firma el Vicerrectorado Académico). Nueve públicos, 45,078
personas invitadas por correo (Mailchimp, dominio `enviospulso.pucp.edu.pe`),
encuestas en SurveyMonkey con enlace personal `?t=<token>`. Meta: **8,503
encuestas**.

Pregunta: ¿el módulo Monitoreo (perfil acreditación) puede dar seguimiento a
este campo? Y, si puede, ¿cómo traer los reportes de Mailchimp?

**Respuesta corta.** El modelo del perfil sirve: se probó con las bases reales y
cruza bien por token, separa parciales, rechazos, duplicados y respuestas sin
cruce. Pero **hoy no aguanta la escala** (el cruce crece casi cuadrático: unos 30
min solo en el cruce con 45 mil contactos), **no tiene metas por cuota**
(facultad, dedicación, puesto) y **no sabe nada del correo** (rebotes, bajas,
quejas). Las tres cosas tienen arreglo acotado y en archivos nuevos. Sin el
primero, no conviene abrir el campo sobre la app.

---

## 1. Cómo se probó

Todo con datos reales y en copias de trabajo; ninguna escritura en Mailchimp ni
en SurveyMonkey.

| Insumo | Qué es | Dónde |
|---|---|---|
| Nueve bases de envío | 45,078 filas, un token por persona (10 caracteres `[a-z0-9]`, únicos entre los nueve públicos, también tras pasar a mayúsculas) | `Bases de envío_21.10.26/01…09` |
| Metas | `00 Resumen…xlsx`, hoja «Metas de encuestas». Las fórmulas no traen valor guardado; se recalcularon: personas × cobertura, redondeo hacia arriba → **8,503** (coincide) | ídem |
| Universos del experimento | Las nueve bases reducidas a **token + variables de cuota** (sin nombre, correo ni código) | scratchpad de la sesión, fuera del repo |
| Respuestas reales | SurveyMonkey «Prueba Mailchimp – versión corta» (`528810615`): 4 completas, `t` = 2 tokens del piloto + `prueba01`/`prueba02` | lectura con la clave guardada |
| Campañas reales | Mailchimp, audiencia «PULSO PUCP» (8 contactos): invitación `6d3c158034` (7 envíos) y primer recordatorio `eb505ad1d8` (5) | lectura con la clave guardada |
| Respuestas simuladas | Por público: 60 % de la meta en completas, +15 % parciales, 3 % duplicadas (otra duración), 2 % sin consentimiento, 1 % con token ajeno | generadas en el experimento, rotuladas como simuladas |

El experimento arma una sesión con el perfil acreditación tal como lo
configuraría un usuario (9 fuentes `universo` con `dimensions.actor`, 9 fuentes
`respuestas`, la encuesta real del piloto, `key_rules` Token ↔ `cv_t`, metas por
actor) y corre el mismo camino que la app: `monitoreo_sync_sources` →
`monitoreo_sync_apply_deferred` → `.monitoreo_acreditacion_internal_queries_impl`
→ `monitoreo_build_dashboard`. La única pieza sustituida es la lectura de Google
Sheets, que se reemplazó por la lectura local de los mismos universos (ver §2.1).

## 2. Diagnóstico de viabilidad

### 2.1 Qué funciona hoy (verificado)

| Capacidad | Evidencia |
|---|---|
| **Cruce por token** | Con `key_rules = {universe_fields: ["Token"], response_fields: ["cv_t"]}` el piloto da exactamente lo esperado: 2 efectivas (los dos tokens del piloto que respondieron) y 2 «en revisión» (`prueba01`, `prueba02`, que no están en la base). En lo simulado, Estudiantes de pregrado al 10 %: 273 completas − 5 sin consentimiento = **268 efectivas**; 8 duplicados colapsados; 3 tokens ajenos en revisión. Cuadra fila por fila con lo generado. |
| **Separación de estados** | Completa / Parcial / Rechazo / Sin respuesta por actor, y pendientes = universo − respondidos. Los parciales no cuentan como efectivas. |
| **Deduplicación** | Gana la de mayor prioridad (Completa > Parcial > …) por `actor + token`. |
| **Consentimiento** | Regla de rechazo por pregunta (`rejection_rules`), o filtro de efectiva (`platform_effective_filter`). |
| **Metas por público** | `config$goals` por actor (8,503 repartidos en los nueve públicos). Avance total = efectivas / universo, avance contra mínimo = efectivas / meta. |
| **SurveyMonkey** | La variable `t` llega sola como columna `cv_t`; no hace falta tocar el conector. |

### 2.2 Qué falta

| # | Brecha | Gravedad | Detalle |
|---|---|---|---|
| B1 | **Escala del cruce** | **Bloqueante** | Ver §2.3. Con 45 mil contactos el cruce tarda del orden de media hora y el tablero bastante más; cada sincronización y cada apertura del `.pulso` en frío lo vuelve a pagar. |
| B2 | **La llave `t` no se detecta sola** | Menor (se configura) | Los alias automáticos reconocen `cv_id`, `custom_value`, código, correo y teléfono, pero no `cv_t` ni la columna `Token`. Hay que declararlos en `key_rules`. Ojo con `declared_person_code_var`: exige 2–14 caracteres y descarta en silencio lo que no calce (los tokens de 10 pasan). |
| B3 | **El universo solo entra por Google Sheets** | Decisión | `monitoreo_normalize_sources` acepta `kobo`, `surveymonkey`, `google_sheets` y `aulas_libro`. No hay universo desde archivo local. Para este estudio implica subir nueve hojas (o una con columna de público vía `actor_var`) a Sheets. Si se hace, **solo token + variables de cuota**, sin nombres ni correos: el token ya es la llave y la DAA conserva la base nominal. |
| B4 | **No hay metas por cuota** | Alta | Las cuotas del estudio (Docentes Campus por dedicación, pregrado por facultad, administrativos por puesto, egresados de pregrado por facultad) no tienen dónde vivir como meta. «Distribución» compara la composición de efectivas contra la del universo (representatividad), sin meta por categoría. La variante `segmentada_por_carrera` convertiría cada facultad en un actor de primer nivel, lo que rompe el reporte por público. Lo que hace falta es pequeño porque **la categoría sale de la base, no de la respuesta**: el caso cruzado por token ya trae su facultad o dedicación. |
| B5 | **Nada del correo** | Alta | Monitoreo no conoce entregados, aperturas, clics, rebotes, bajas ni quejas. El denominador es «filas de la base», así que un correo inválido cuenta como «no respondió» (justo lo que no debe pasar). «Actualizar quién respondió» (Material de campo › Envíos) etiqueta «Respondió» en Mailchimp, pero no alimenta Monitoreo. |
| B6 | **Secciones que sobran** | Menor | El perfil trae la sección Teléfono (barrido, supervisión, responsables) que este estudio no usa. No bloquea, pero el tablero debería poder ocultarla cuando no hay fuentes de barrido. |
| B8 | **Consultas reclasifica efectivas como «Fuera de base» al reabrir el proyecto** | **Bloqueante** (bug) | Visto en la app: Consultas marca 449 de 617 respuestas como «Fuera de base · la llave cruzaba contra una base de otro actor», mientras Avance cuenta 505 efectivas y el `case_rollup` del mismo payload dice «Cruzó». Causa: `.monitoreo_acreditacion_case_base_actor` (`api/R/monitoreo_router_acreditacion.R:8`), que se aplica al servir un tablero desde caché, deduce el actor de la base buscando cuatro palabras fijas («administrativos», «docentes», «egresados», «estudiantes») y lo compara **exacto** con el actor: «estudiantes» ≠ «estudiantes de pregrado». Solo Administrativos se salva. Con nueve públicos de nombre compuesto, 8 de 9 quedan afectados cada vez que se abre el `.pulso`. Arreglo chico: comparar contra el actor de la fila base (que el cruce ya conoce), no contra una lista fija. |
| B9 | **Rótulos del embudo de Resumen** | Menor (C5) | «Recibidas 5,132» suma filas de universo y respuestas, y «−617 Registros fuera del universo declarado por actor» son justamente las 617 respuestas, no registros fuera del universo. Con un universo de 45 mil la cifra «recibidas» pierde sentido. |
| B10 | **Distribución ofrece el token como variable** | Menor | En públicos chicos (Docentes CENTRUM, Egresados de posgrado CENTRUM al 10 %) el selector propone «Token · 7 categorías». Un identificador nunca es variable de interés. |
| B7 | **Archivos congelados** | Restricción | `monitoreo_engine.R` (38,692 líneas), `router_monitoreo.R` y `AcreditacionMonitoreoPage.tsx` (18,487) están congelados a crecimiento. Todo lo nuevo va en archivos propios; montar una pestaña nueva en la página exige subir su línea base de forma deliberada (unas pocas líneas). |

### 2.3 Escala (B1), medida

Mismo experimento a distintas fracciones de las bases reales (las respuestas
escalan con la meta):

| Fracción | Universo | Respuestas | Cruce (`internal_queries`) | Tablero (`build_dashboard`) |
|---|---|---|---|---|
| 10 % | 4,508 + 7 del piloto | 613 + 4 reales | 31 s | 82 s |
| 30 % | 13,524 | 1,826 | 227 s | 1,414 s (23.5 min)* |
| 100 % (extrapolado) | 45,078 | ~6,100 (60 % de la meta) | ≈ 30 min | varias horas |

\* Medido con otra corrida de R en paralelo; aun descontando la contención, el
tablero crece más rápido que el cruce.

Dos costos más, medidos con la copia de trabajo abierta en la app (10 %):

- **Arranque en frío** del proyecto: 127 s (`project.warmup`), de los cuales el
  Avance tomó 1 min 18 s.
- **Payload de Consultas**: `GET /api/monitoreo/state?report_scope=queries_summary`
  pesa **115 MB** (124 MB son `internal_queries`: un objeto por caso, también por
  cada persona del universo que aún no responde). A 45 mil contactos serían del
  orden de 1 GB hacia el navegador. T1 tiene que paginar o resumir esos casos, no
  solo acelerar el cruce.

Pasar de 10 % a 30 % multiplica el tiempo del cruce por 7.3: exponente ≈ 1.8,
casi cuadrático. La causa más probable, que señala la lectura del código y queda
por confirmar con perfilado: el índice de la base es una lista R con nombres que
se copia entera en cada inserción (`.monitoreo_report_base_index_add`), más
bucles por fila sobre `as.list(df[i, ])` al construir llaves y al deduplicar. Con
`match()` sobre vectores o un environment como tabla hash, el cruce de 45 mil
debería bajar a segundos. Es un arreglo localizado, pero dentro de un archivo
congelado: se hace extrayendo esas funciones a un archivo nuevo.

### 2.4 Veredicto

**Viable, no hoy.** El modelo de datos y el cruce son los correctos para este
estudio (token → público → estado → efectiva), y la evidencia lo muestra con los
datos reales. Antes de abrir campo sobre la app hacen falta B1 (escala y peso del
payload), B8 (Consultas contradice al Avance) y B4 (metas por cuota); B5 (correo)
es lo que la DAA va a pedir apenas empiecen los rebotes.

Lo visto en pantalla (copia de trabajo al 10 %, `/monitoreo?modo=acreditacion`):
Avance › Resumen muestra 505 efectivas de 4,515, 76 parciales, 8 rechazos y los
nueve públicos con su mínimo («Estudiantes de pregrado: 268 efectivas · faltan 187
para el mínimo 455»); Teléfono declara bien su vacío («Ningún actor participa en
Teléfono»); Consultas lista las 617 respuestas con los filtros de actor, estado,
cruce y fecha, pero con la contradicción de B8.

## 3. Diseño: reportes de Mailchimp en Monitoreo

### 3.1 Qué se puede leer (probado con las campañas del piloto)

| Endpoint (Marketing API) | Qué da | Uso |
|---|---|---|
| `GET /campaigns?status=sent` | Campañas enviadas, `send_time`, `recipients.segment_opts` (el id de la etiqueta del público y, en recordatorios, la exclusión «Respondió»), título | Catálogo de envíos y su público |
| `GET /lists/{id}/segments?type=static` | id → nombre de etiqueta | Etiqueta → público |
| `GET /reports/{campaign_id}` | Enviados, rebotes duros y blandos, bajas, quejas (`abuse_reports`), aperturas únicas (también **sin aperturas automáticas de Apple**: `proxy_excluded_*`), clics únicos | Fila agregada por envío |
| `GET /reports/{id}/sent-to` | Por destinatario: estado `sent / hard / soft`, `open_count` y **`merge_fields`**: el campo `ENLACE` trae `?t=<token>` | **Llave correo → token**, rebote por persona |
| `GET /reports/{id}/email-activity?since=` | Por destinatario: acciones `open`, `click` (con URL), `bounce` | Clic en el enlace de la encuesta; lectura incremental |
| `GET /reports/{id}/unsubscribed` | Bajas con fecha y motivo | Bajas por envío y público |
| `GET /reports/{id}/abuse-reports` | Quejas | Quejas por envío |
| `GET /lists/{id}/members?status=cleaned` | Correos que Mailchimp ya dio por inválidos (acumulado) | **Lista de rebotes para la DAA** |

Prueba real (solo lectura, 22/10):

```
6d3c158034 | Prueba Interna Acreditación | público=PRUEBA ACREDITA
  reporte: enviados=7 rebotes=0/0 bajas=0 quejas=0 aperturas únicas=7 (sin proxy 7) clics únicos=2
  por token: 7 destinatarios, 7 con token, entregados=7, abrieron=7, clic=2, respondieron=2
eb505ad1d8 | Primer recordatorio: Prueba Interna Acreditación | público=PRUEBA ACREDITA
  reporte: enviados=5 rebotes=0/0 bajas=0 quejas=0 aperturas únicas=4 (sin proxy 4) clics únicos=0
  por token: 5 destinatarios, 5 con token, entregados=5, abrieron=4, clic=0, respondieron=0
```

El recordatorio salió a 5 y no a 7 porque excluyó la etiqueta «Respondió»: la
pieza de Material de campo ya funciona y el reporte lo deja ver.

### 3.2 Modelo

La unidad es **(envío, token)**. El token une las tres fuentes:

```
Mailchimp sent-to ──ENLACE ?t=──► token ◄──cv_t── SurveyMonkey
                                    │
                                    └──Token──► base del público (actor, facultad, dedicación…)
```

- **Envío** = campaña de Mailchimp. Su público sale de la etiqueta del segmento
  (la sesión de Material de campo crea una etiqueta por público y los
  recordatorios excluyen «Respondió»). Su orden (invitación, recordatorio 1…8)
  sale de `send_time` dentro del público.
- **Persona** (por token): último estado de entrega (entregado / rebote duro /
  rebote blando), abrió alguna vez, hizo clic en el enlace, se dio de baja, se
  quejó, envío en que hizo clic por primera vez.
- **No se guardan correos.** El `.pulso` guarda tokens y conteos. Para el listado
  de rebotes a la DAA hay dos caminos (decisión D3): exportar token + público y
  que la DAA cruce con su base, o resolver el correo en el momento de exportar
  (desde la base de envío o desde Mailchimp) sin persistirlo.

### 3.3 Reglas de dominio

1. **Rebote duro = correo inválido, no «no respondió».** Sale del denominador.
   Se agrega una cifra: **base alcanzable = universo − rebotes duros**, y la tasa
   de respuesta se calcula sobre la alcanzable. La de universo se sigue
   mostrando: las dos, rotuladas. El rebote blando no se descuenta (puede
   entregarse en el siguiente envío); si se repite, Mailchimp lo pasa a `cleaned`
   y entonces sí.
2. **Rebotes para la DAA**: listado por público con token, motivo (duro, o
   blando repetido → limpiado) y envío en que ocurrió. Va al Sheets interno
   (ADR 0016: el interno admite identificadores) y como XLSX.
3. **Aperturas con cautela.** Las aperturas automáticas de Apple inflan la cifra:
   se reporta la apertura **sin proxy** como principal. El indicador que
   importa es el clic en el enlace de la encuesta y, sobre todo, la respuesta.
4. **Embudo por envío y público**: entregados → abrieron → clic en la encuesta →
   respondieron (efectiva atribuida). La respuesta se atribuye al envío cuyo
   enlace se clickeó; si no hay clic registrado, al último envío anterior a la
   respuesta.
5. **Bajas y quejas para decidir el ritmo** de los recordatorios (previstos 2 por
   semana durante 4 semanas). Por cada envío y público:
   - tasa de baja = bajas / entregados;
   - tasa de queja = quejas / entregados;
   - rendimiento marginal = respuestas atribuidas al envío / entregados.

   Propuesta de semáforo (decisión D4): **espaciar** a uno por semana en un
   público cuando la baja del último envío supera 0.5 %, o la queja supera
   0.1 % (umbral de Google y Yahoo para remitentes masivos; 0.3 % es el tope
   duro), o cuando el envío trae menos respuestas que bajas. **Detener** si la
   queja pasa 0.3 %. Aviso: Gmail y Google Workspace no informan quejas
   individuales, así que en correos `@pucp.edu.pe` (si están en Google) la cifra
   de quejas de Mailchimp subestima. La señal real de reputación del dominio
   `enviospulso.pucp.edu.pe` está en Google Postmaster Tools, fuera de la app.
6. Cada recordatorio sale solo a quienes no respondieron. El reporte muestra a
   cuántos llegó cada recordatorio, que es la medida del esfuerzo que queda.

### 3.4 Lectura y costo

- **Una vez por campaña**, al terminar el envío: `sent-to` completo (páginas de
  1,000; pregrado son 23 llamadas). Da la llave correo → token y el estado de
  entrega.
- **En cada sincronización**: `reports/{id}` de las campañas de los últimos días
  (1 llamada cada una), `email-activity?since=<último corte>`, `unsubscribed` y
  `abuse-reports` (pocas filas).
- **Bajas y limpiados acumulados**: `lists/{id}/members?status=cleaned|unsubscribed`.
- Volumen máximo del estudio: 9 públicos × 9 envíos = 81 campañas. Con lectura
  incremental, una sincronización diaria son decenas de llamadas, no miles.
- Va como job (`callr`) con avance, reutilizando `.mc_call` (reintentos ante
  429/5xx los está agregando la sesión de Material de campo). Todo índice por
  token con `match()` o environment: el `.mc_token_index` actual crece igual que
  el índice de Monitoreo y no sirve a 45 mil.

### 3.5 Dónde vive

| Pieza | Archivo | Nota |
|---|---|---|
| Lectura de Mailchimp para Monitoreo | `api/R/monitoreo_mailchimp_lectura.R` (nuevo) | Solo GET. Usa `.mc_call` del cliente existente sin editarlo. |
| Modelo por (envío, token) y agregados | `api/R/monitoreo_mailchimp_modelo.R` (nuevo) | Puro, testeable sin red. |
| Rutas `GET /api/monitoreo/mailchimp/estado`, `POST …/sync` (job) | `api/R/router_monitoreo_mailchimp.R` (nuevo) + montaje en `plumber_app.R` | Router delgado. |
| Estado en sesión | `s$monitoreo_mailchimp` | Tokens y conteos; sin correos. Viaja en el `.pulso`. |
| Configuración | `monitoreo_config$mailchimp = {list_id, publico_por_etiqueta}` | Etiqueta → actor; por defecto, por nombre igual. |
| Cliente front | `frontend/src/api/monitoreoMailchimp.ts` (nuevo) | Con normalizador defensivo. |
| Pestaña «Correo» | `profiles/acreditacion/AvanceCorreo.tsx` (nuevo) en Avance | Embudo por envío y público, semáforo de ritmo, base alcanzable. |
| Rebotes | Consultas › «Correos inválidos» (nuevo componente) | El listado para la DAA. |

## 4. Recomendación y plan

Orden propuesto; cada tramo cierra con su gate y su commit.

| Tramo | Qué | Por qué en este orden | Archivos |
|---|---|---|---|
| **T0** | Arreglar B8: la reparación de caché compara el actor del caso con el actor real de su fila base. Test con actores de nombre compuesto. | Es un bug que ya afecta, chico y aislado (`monitoreo_router_acreditacion.R`, no congelado). | `monitoreo_router_acreditacion.R` + test |
| **T1** | Cruce lineal y payload acotado (casos paginados o solo los que requieren revisión; el universo pendiente como conteo): reescribir índice de base, llaves y deduplicación con `match()`/environment, extraídos a un archivo nuevo. Test de equivalencia: mismo `case_rollup` que hoy sobre acrconta y sobre el experimento al 10 %. Meta: 45 mil contactos en menos de 1 min. | Sin esto nada de lo demás se puede usar con el estudio real. | `monitoreo_acreditacion_cruce_indexado.R` (nuevo) + llamada desde el engine (baja líneas, no sube) |
| **T2** | Metas por cuota: `goals` con `{actor, variable, categoria, meta}`; efectivas por categoría tomando la variable **del universo** del caso cruzado. Carga desde la hoja «Metas de encuestas». | Es lo que la DAA mira para saber si un público está cubierto. | `monitoreo_acreditacion_cuotas.R` (nuevo) + vista en Avance |
| **T3** | Mailchimp en Monitoreo: lectura, modelo, job, pestaña Correo (embudo, bajas, quejas, semáforo) y base alcanzable. | Rebotes y ritmo de recordatorios desde la primera semana de campo. | §3.5 |
| **T4** | Listado de correos inválidos para la DAA (Sheets interno + XLSX). | Depende de T3 y de D3. | Consultas |
| **T5** | Ocultar la sección Teléfono cuando el estudio no tiene fuentes de barrido. | Pulido. | perfil |

T3 se puede construir en paralelo con T1 (archivos distintos); T2 necesita el
cruce de T1 para probarse a escala.

Cómo reproducir: los scripts del experimento (`preparar_universos.R`,
`experimento.R`, `mc_embudo.R`) quedaron en el scratchpad de la sesión
`monitoreo-acred-inst`; reducen las bases a token + variables de cuota antes de
tocarlas y sustituyen solo la lectura de Sheets.

### Lo que falta decidir (Gonzalo)

| # | Decisión | Opciones |
|---|---|---|
| D1 | ¿Cómo entra el universo? | (a) Nueve hojas en Google Sheets con token y variables de cuota, sin datos personales (no requiere código); (b) habilitar universo desde archivo local en Monitoreo (código nuevo, evita Sheets). |
| D2 | ¿Una encuesta de SurveyMonkey por público o una sola con el público en una variable? | Cambia cuántas fuentes `respuestas` se configuran; el cruce funciona igual. |
| D3 | Listado de rebotes para la DAA | Solo token + público (la DAA cruza) o con correo resuelto al exportar. |
| D4 | Umbrales para espaciar recordatorios | Propuesta en §3.3.5; se ajustan antes del primer recordatorio. |
| D5 | ¿Qué cuenta como efectiva? | Completa + consentimiento + cruza con la base + sin duplicado (la regla de acrconta). ¿Algún filtro adicional, como la duración mínima? |
| D6 | Primer tramo a implementar | Recomendado: **T0 + T1** (T0 es de una hora). Si la urgencia es el correo, T3 en paralelo con T1. |
