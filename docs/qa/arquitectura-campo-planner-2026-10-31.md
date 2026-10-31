# Arquitectura de campo: formatos, límite Material / Monitoreo y Planner

Doc vivo del loop de diseño y arquitectura que pidió Gonzalo el 2026-10-31. Lo mantiene la sesión de Hojas de ruta /
Material de campo. La versión para leer es el artefacto «Papel y Excel de campo»
(https://claude.ai/artifact/Rw3NyeQv5kF6UXizMpkYV7); este doc es su fuente y su memoria.

Fuentes que lo alimentan: `docs/qa/checklist-formatos-campo-2026-10-31.md` (C1–C8, D1, D2),
`docs/qa/contrato-equipo-territorial-2026-10-31.md`, ADR 0118 (y su enmienda del 31 oct), ADR 0121, y los aportes de
las sesiones «Monitoreo: cierre de Aulas y pendientes del loop» y «Meta B: revamp completo de la app».

## 1. Lo que dijo Gonzalo (textual)

Sobre cómo trabaja campo:

- «la asignación no suele hacerse desde la aplicación, sino que hay que generar una especie de documento Excel»
- «el equipo de campo no usa la app, o por lo menos le va a costar mucho aprenderla. Entonces, a veces es mucho más
  sencillo crear Excels en cierto formato que ellos puedan llenar y que nosotros luego podamos leer»
- «Esto es algo que hay que definir bien si va a ser finalmente monitoreo o lo vas a hacer tú. O lo vas a hacer tú y
  se lo vas a dar a monitoreo, porque a veces hay reasignaciones, las cosas pueden cambiar»
- «con respecto también al Excel o al PDF del recorrido o el PDF de consolidado, creo que has inventado tus propios
  mecanismos y tus propios PDFs, lo cual no está mal, pero también te sugiero que revises este ACNUR territorial»

Sobre el alcance:

- «hay mucho por hacer y no sé si necesariamente todo le pertenece a tu sesión»
- «esto afecta a todos los monitores y sus hojas o insumos para aplicar en campo o hacer seguimiento y su relación con
  el módulo de materiales»
- «bitácora en vez de llamarse bitácora puede llamarse planeador o algo más profesional como planner y puede ayudar a
  definir los campos, y un poco todo para que todos los módulos se conecten entre sí»

Sobre Material:

- «Material no tiene que ver con costos y precios, de eso se encarga otra persona»
- «ese módulo solo recibe la lista entonces debe mostrar mejor cada pestaña de una forma más profesional»

Sobre la forma de trabajar:

- «antes dame el plan de lo que piensas hacer en un artefacto porque no entiendo»
- «Arma un loop de diseño y arquitectura sólido, aprovecha para organizar todo lo que te he dicho muy bien y no pares
  de mejorarlo y hacerlo más intuitivo y ordenado cada 3 mins»

## 2. Lo que ya decidió

| Decisión | Respuesta de Gonzalo | Dónde quedó |
|---|---|---|
| I3: dónde se escribe el equipo de campo | «I3: equipo en Material» | Asignación UMP → código en Material (500e7a372) |
| Qué lista de encuestadores manda | «La de Monitoreo» | `enumerator_roster`; Material sólo la lee, sin DNI |
| C2: quién genera y lee el Excel de asignación | «Sí, Material» | Excel de asignación (6adbef00e) |
| D1 y D2: hojas de ruteo y consolidados; Hoja del día | «Sí, D1 y D2(a)» | Aprobado, sin construir: espera el visto bueno al plan |

## 3. Lo que falta decidir

Mismo número que en el artefacto (pestaña «Resumen y decisiones»; P9 en la pestaña «Planner»). Sólo P1 bloquea.

| # | Decisión | Recomendación | Quién la ejecuta |
|---|---|---|---|
| P1 | Visto bueno al plan para construir D1 y D2(a) | Sí | Esta sesión |
| P2 | Campo transcribe los conteos del consolidado en el Excel de asignación | Sí, una columna por código | Material lee; Monitoreo consulta |
| P3 | El «Estado» que llena campo (C7): leerlo como declarado o quitarlo | Leerlo como declarado, sin usarlo para el avance | Sesión de Monitoreo |
| P4 | El importador de la lista respeta el código PXXX del Excel | Sí | Sesión de Monitoreo |
| P5 | Quién revisa el barrido telefónico actual del RMS (C8) | La sesión «ACNUR RMS» (Meta B) | Esa sesión |
| P6 | Plan de campo desde la muestra enviada (antes «F4») | Sí (Meta B) | Esta sesión, tras la etapa 1 |
| P7 | Dónde vive la lista de encuestadores (Monitoreo, Material o Planner) | Dejarla en Monitoreo y arreglar el importador, o moverla al Planner | Ambas sesiones |
| P8 | Adelantar «asignado frente a observado» (B3) | Se puede: no comparte archivos con ADR 0121 F2 | Sesión de Monitoreo |
| P9 | Abrir el ADR del Planner | Sí, como propuesta; debe resolver las 10 decisiones de §12 antes de código | Meta B coordina |

## 4. Reglas del reparto entre módulos

Propuestas por Meta B y la sesión de Monitoreo (31 oct), extienden el ADR 0118. No contradicen el checklist C1–C8.

1. **Material produce lo que sale a campo**: fichas, hojas de ruta, hoja de ruteo, hoja de consolidados, hoja del día,
   Excel de asignación, plantilla del barrido telefónico, plantillas en blanco del libro de aulas y correos.
2. **Monitoreo lee lo que vuelve y calcula**: Kobo, SurveyMonkey, el barrido llenado, el libro de aulas; avance y
   control. Material no calcula avance; Monitoreo no escribe en Material.
3. **Plantilla y archivo lleno con dueños claros** (corregida tras §12): Material genera la plantilla; el archivo que
   campo devuelve lleno lo lee el módulo que mide con él (asignación → Material; barrido y libro de aulas → Monitoreo) y
   lo expone sin efectos al otro (como `GET /api/recopiladores/campaigns/territorial/asignacion`).
4. **Todo sale de una foto con sello** (corregida tras §12): lo que va a campo y las metas se toman como foto con la
   huella de su origen; copiar está bien si lleva huella (la copia de `design_targets` del ADR 0121 congela la meta, ADR
   0079). Si la huella diverge, el módulo lo dice y no compara. Huella por perfil: territorial `sample_fingerprint` de la
   foto enviada; aulas `selection_run_id` / `plan.input_fingerprint` / `deployment_fingerprint`
   (`collection_engine.R:1140-1146`); telefónico, por definir. Excepción vigente: el plan por encuestador de Material
   sale de la muestra viva y lo protege el 409 hasta F4.
5. **La app no pisa lo que llena campo**: dueño por hoja, como ya rige el libro de aulas.
6. **Datos personales antes de existir**: todo insumo con nombres, DNI o teléfonos declara cómo lo cubre
   `api/R/pulso_anonimizar_proyecto.R` (CLI: `api/scripts/pulso_anonimizar.R`). Hoy faltan `enumerator_roster` (lista de registros, ciega para el anonimizador y el gate) y `material_territorial_asignacion`.

## 5. Perfil por perfil (verificado en el código por la sesión de Monitoreo, 31 oct)

Cursos-horario es el mismo perfil que aulas.

| Perfil | Sale a campo (Material) | Vuelve (Monitoreo) | Quién | Cuándo |
|---|---|---|---|---|
| Territorial | Ficha UMP y Excel operativo (existen); Excel de asignación (6adbef00e); hoja de ruteo y de consolidados (hoy en Word, a mano: D1); Hoja del día sin grilla (D2a) | Kobo y ocurrencias (`/territorial/source`, `/occurrences/sync`); lista de encuestadores (`/territorial/enumerators/upload`); asignado vs observado (B3, aún no); declarado vs Kobo | Material: esta sesión. Monitoreo: sesión de Monitoreo | Ahora |
| Aulas / cursos-horario | Fichas QR y afiche (ya en Material). Pasarían a Material las plantillas en blanco que campo llena: «Aulas Agendadas», «Aulas Aplicadas», disponibilidad, parte en papel | Kobo por API; libro en Sheets (`/aulas/importar-sheets`; el parte se lee sólo de ahí); Excel del libro; disponibilidad; hoja de aplicadores (`/aulas/sincronizar-distribucion`). Se quedan en Monitoreo las hojas que la app reescribe (avance, base de control, riesgo) | Monitoreo: sesión de Monitoreo (ADR 0121). Material de aulas: esta sesión | Después del ADR 0121 F3 |
| Telefónico | Hoy el barrido se arma a mano en Sheets. Material lo generaría desde la muestra + backup del cliente, con columnas fijas (código, status, intentos, observación, responsable, fecha, sede, muestra/backup) y el catálogo de status del estudio | Barrido desde Sheets (`/api/monitoreo/sheets/source|sync`); Kobo; publica a Sheets | Plantilla: esta sesión. Lectura: sesión de Monitoreo. Revisar el Excel del RMS (C8): por decidir (Meta B recomienda la sesión «ACNUR RMS») | Después de D1 y D2a |
| Acreditación | Correos para SurveyMonkey y Mailchimp (ya en Material). Propuesta: barrido telefónico como en telefónico; padrones siguen siendo del cliente | SurveyMonkey por API; padrones y barrido desde Sheets; Mailchimp | Sesiones de Acreditación y de correos | Fuera de este plan |

## 6. Mapa de módulos (texto del diagrama del artefacto)

- Planner (propuesta) → todos los módulos: define el estudio una vez.
- Cálculo de muestra → Hojas de ruta: tamaño y reparto.
- Hojas de ruta → Material: muestra enviada.
- Material → Campo: fichas, hojas, Excel. Campo → Material: Excel llenado.
- Campo → Monitoreo: respuestas en Kobo.
- Material → Monitoreo: la asignación (consulta sin efectos).
- Monitoreo → Procesamiento: base de campo.

## 7. Glosario (una palabra por cosa)

| Término | Significa | No confundir con |
|---|---|---|
| UMP | Unidad de trabajo territorial: una manzana con su rango de encuestas | «Ruta»: en el plan de campo una jornada agrupa varias UMP |
| Titular / reemplazo | La UMP sorteada y la que va en su lugar | — |
| Muestra enviada (foto) | La muestra que Hojas de ruta pasa a Material, con su huella | La muestra viva de Hojas de ruta, que puede cambiar después |
| Código de resultado | El número con que campo anota qué pasó en cada visita (1–8, 99) | Las «disposiciones» de la Hoja del día, que se retiran (D2a) |
| Encuestador / aplicador | Quien hace la encuesta: encuestador en territorial y telefónico, aplicador en aulas | Responsable (columna del barrido) |
| Hoja de ruteo | Papel donde se anota cada vivienda visitada y su código | Hoja de ruta (la ficha de la UMP) y Hoja del día (portada de la jornada) |
| Hoja de consolidados | Resumen de la UMP: visitas por código y registro de encuestados | — |
| Excel de asignación | Excel donde campo escribe quién hace cada UMP; la app lo lee de vuelta | Excel operativo de Hojas de ruta |
| Planner | Propuesta: la Bitácora renombrada, donde se define el estudio para todos los módulos | Plan de campo (jornadas por encuestador) |

## 8. Planner: qué definiría y dónde vive hoy (L5, verificado en `session_schema.R` y ADR 0121)

Principio de mudanza: **un campo a la vez, sin mudanza en bloque**. El Planner pasa a ser el único que escribe ese
campo; el lugar viejo deja de escribirlo y sus lectores consultan el Planner con respaldo al lugar viejo para los
`.pulso` anteriores. Nada se copia de un módulo a otro.

| Campo del estudio | Hoy vive en (clave de sesión) | Lo usan | Cómo se muda |
|---|---|---|---|
| Identidad del estudio (nombre, código, cliente) | `estudio`, `calc_muestra_estudio`, `project_modules` | Todos | El Planner escribe; los demás leen con respaldo |
| Perfil de recojo y canales (territorial, aulas, telefónico, correo) | `monitoreo_config$monitoreo_profile`, `material_campaigns` (tipos) | Monitoreo, Material, Home | El perfil lo declara el Planner; Monitoreo y Material lo leen |
| Universo y variables de cuota | Aulas: escenario de Cálculo de muestra, **copiado** a `design_targets.representatividad` (ADR 0121 §2). Acreditación: `monitoreo_cuotas`. Territorial: cuotas del censo dentro de la muestra de `hojas_ruta_runs` | Cálculo de muestra, Hojas de ruta, Monitoreo | Una sola declaración (el bloque `representatividad_v1` del ADR 0121) que todos consultan; la copia a `design_targets` pasa a ser lectura |
| Códigos de resultado de la visita | En ningún lado: cada hoja de Word trae los suyos | Material (hojas de ruteo y consolidados), Monitoreo (lectura) | Nacen en Material con D1 y se mudan al Planner cuando exista |
| Status del barrido telefónico | En el Sheets de campo, a mano | Material (plantilla), Monitoreo (lectura) | Igual que los códigos de resultado |
| Equipo de campo con códigos | Territorial: `monitoreo_config$territorial$enumerator_roster`. Aulas: libro del operativo y `monitoreo_aulas_disponibilidad`. Telefónico: columna «Responsable» del barrido | Material (asignación, distribución), Monitoreo (atribución) | Una lista por estudio en el Planner; cada perfil la filtra |
| Cronograma y fases | `plan_trabajo` (cronograma de la Bitácora), `hojas_ruta_active_phase` y `hojas_ruta_runs` (piloto/campo), marcas de piloto en Monitoreo | Hojas de ruta, Monitoreo, Material | El Planner dice qué fase está activa y sus fechas; los módulos la leen |
| Insumos del cliente (padrones, listados) | `monitoreo_aulas_padron`, `monitoreo_sources`, `files/` | Monitoreo, Material | Se registran en el Planner como insumos con su origen; el archivo sigue en `files/` |

**Hallazgos de L5**

- **Las cuotas viven en tres lugares** según el perfil (escenario de Cálculo de muestra, `monitoreo_cuotas`, muestra de
  Hojas de ruta). Es el mismo concepto con tres formas.
- **El ADR 0121 copia** el bloque de Cálculo de muestra a `design_targets` (§2). Va contra la regla 3 de §4 («nunca se
  copia estado»). No es urgente: el ADR del Planner debería convertir esa copia en una consulta.
- **El equipo de campo no tiene una sola casa**: lista territorial en Monitoreo, aplicadores de aulas en el libro y la
  disponibilidad, operadores telefónicos como texto libre.

## 9. Cómo se leen los datos entre módulos (L6, verificado en el código)

Regla (§4): un módulo **consulta** al otro, con la huella de la muestra cuando aplica; nunca copia ni escribe en el
estado ajeno.

| # | Cruce | Cómo pasa hoy | Dónde | ¿Cumple? | Debería |
|---|---|---|---|---|---|
| X1 | Hojas de ruta → Material: muestra enviada | Hojas de ruta guarda la foto con huella; Material la lee | `POST /api/hojas-ruta/envio`; `GET /api/recopiladores/campaigns/territorial/unidades` | ✓ consulta con huella | — |
| X2 | Material → Monitoreo: asignación UMP → encuestador | Material la publica; Monitoreo todavía no la lee | `GET /api/recopiladores/campaigns/territorial/asignacion` | ✓ (falta el lado de Monitoreo, B3) | — |
| X3 | Material → Monitoreo: consolidados declarados por campo | No existe | Por crear con D1 | — | Consulta con huella y con el catálogo de códigos |
| X4 | Monitoreo → Material: lista de encuestadores | Material la lee en el mismo proceso, sin DNI | `.mta_equipo` (collection_territorial_asignacion.R) sobre `monitoreo_config$territorial$enumerator_roster` | ✓ consulta | Mudarla al Planner (§8) |
| X5 | Hojas de ruta → Monitoreo territorial: muestra | Monitoreo lee la muestra **viva**, no la enviada | `router_monitoreo.R` ~618 (`hojas_ruta_runs[[fase]]$workspace_outputs`) | ✗ lee la muestra viva | Leer la muestra enviada (ADR 0118 §3 lo dejó para después de F1) |
| X6 | Cálculo de muestra → Monitoreo (aulas, acreditación): plan y cuotas | Monitoreo **copia** al importar | `POST /api/monitoreo/aulas/import-from-calc-muestra` (`monitoreo_aulas_from_calc`), `POST /api/monitoreo/import-from-calc-muestra` (`monitoreo_acreditacion_from_calc`) | ✗ copia (el ADR 0121 §2 la mantiene) | Consulta a la declaración de `representatividad` |
| X7 | Cálculo de muestra → Material (aulas): aulas sorteadas | Material las lee | `collection_origen.R:237` (`s$calc_muestra_aulas_selection`) | ✓ consulta | — |
| X8 | Material → Monitoreo (aulas): plan de monitoreo | La entrega de Material **escribe** el plan de Monitoreo | `collection_engine.R:150` (`fresh$monitoreo_aulas_plan <- …`), `collection_origen.R:255` | ✗ escribe en estado ajeno | Monitoreo consulta la entrega de Material |
| X9 | Material → Monitoreo: plantilla del barrido telefónico | No existe | Por crear | — | Material la genera; Monitoreo lee el barrido llenado |

**Hallazgos de L6**: X5, X6 y X8 no cumplen la regla. Ninguno es urgente ni lo arregla esta sesión (X5, X6 y X8 tocan
`monitoreo_*` o el ADR 0121). Van como insumo del ADR del Planner y de la cola de Monitoreo.

## 10. En qué orden (L10)

Se dice «etapa» para no confundir con las fases de los ADR (F1–F5 del ADR 0121, F4 «plan desde la foto»).

| Etapa | Qué | Quién | Espera |
|---|---|---|---|
| 0 | Decisiones de Gonzalo (§3); sólo el visto bueno al plan bloquea | Gonzalo | — |
| 1 | Códigos de resultado, hoja de ruteo y de consolidados por UMP (D1), Hoja del día sin grilla (D2a), regla CSS de ModuleChrome | Esta sesión | Visto bueno al plan |
| 2 | Asignado vs observado leyendo la foto enviada (B3, X5); consolidados declarados → Material los lee y publica, Monitoreo los cruza con Kobo (X3) | Sesión de Monitoreo + esta sesión | Etapa 1; decisiones «conteos en el Excel» y «Estado» (C7) |
| ∥ | ADR 0121 F2–F3 (aulas) | Sesión de Monitoreo | — (no depende de este plan) |
| 3 | Aulas en Material: plantillas en blanco del libro y disponibilidad; X8 (Material deja de escribir `monitoreo_aulas_plan`) | Esta sesión, coordinada con Monitoreo | ADR 0121 F3 |
| 4 | Barrido telefónico: plantilla en Material (X9), lectura en Monitoreo; revisión del RMS (C8) | Esta sesión + Monitoreo + la sesión que elija Gonzalo | Etapa 1; elección de C8 |
| 5 | ADR del Planner y mudanzas campo a campo (§8); X6 pasa a consulta | Meta B coordina | OK de Gonzalo para abrir el ADR |
| — | F4 «plan de campo desde la muestra enviada» | Esta sesión, tras la etapa 1 | Aprobación de Gonzalo |

**Hallazgo de L10**: la etapa 4 depende de una revisión (C8) que nadie tiene asignada hasta que Gonzalo elija; la etapa 5
asume que Meta B redacta el ADR, y eso aún no está confirmado por Gonzalo.

## 11. Datos personales (L9)

| Insumo | Trae | Dónde vive | ¿Lo cubre `api/scripts/pulso_anonimizar.R`? |
|---|---|---|---|
| Lista de encuestadores territorial | Nombres y DNI | `monitoreo_config$territorial$enumerator_roster` | No |
| Asignación UMP → encuestador | Códigos de encuestador | `material_territorial_asignacion` | No (sólo códigos, pero se cruzan con la lista) |
| Libro del operativo de aulas | Nombres de aplicadores | Sheets del operativo, `monitoreo_aulas_libro` | Por verificar |
| Barrido telefónico y listados del cliente | Nombres y teléfonos de personas refugiadas | Archivo del operativo (Drive) | No debe entrar nunca al repo |
| Excel de asignación descargado | Nombres de encuestadores (desplegable) | Descargas del proyecto | Se genera al vuelo; no se versiona |

**Hallazgo de L9 (corregido en este tick)**: el nombre de ejemplo que usaban los tests y docs de esta sesión era el de un
aplicador real del operativo de aulas. Se reemplazó por «Encuestador Ejemplo Uno» y «Encuestadora Ejémplo Dos» en los
archivos de esta sesión. Sigue en el historial de git y en dos archivos de otras sesiones
(`docs/qa/checklist-asignacion-aplicadores-2026-09-04.md`, `api/tests/testthat/test-monitoreo-aulas-fijaciones-desfasadas.R`),
junto a otros nombres reales; se avisa a Meta B.

**Regla para lo que viene**: los ejemplos de tests, docs y artefactos usan nombres ficticios evidentes, nunca nombres
copiados de una base, un Sheets o un parte de campo.

## 12. Revisión independiente de guardian-contratos (L11, 31 oct)

**Veredicto: con cambios; el Planner exige ADR antes de construir.** Lo que corrige de este doc (las secciones de arriba
quedan como estaban; esta sección manda sobre ellas donde difieren):

1. **«Nunca se copia» no es una regla de §4** y choca con el ADR 0121 §2 (aceptado) y con su cláusula de ownership
   (sólo la sesión de Monitoreo toca `calc_muestra_*`, `design_targets` y el foco). La copia de X6 **cumple un papel**:
   congela la meta del diseño durante el campo (ADR 0079). Modelo correcto: **foto con huella de su origen**, igual que
   la muestra enviada; si la huella diverge, Monitoreo lo dice. Se enmienda el ADR 0121 §2, no se reemplaza la copia
   por una consulta viva. Corrige la columna «Debería» de X6 y la fila «Universo» de §8.
2. **Regla 3 vs §5**: hay que elegir entre «quien genera, lee y expone sin efectos» y «la plantilla es de Material y el
   archivo llenado es de Monitoreo» (barrido, libro de aulas). Decisión abierta.
3. **La regla 4 sólo existe para territorial**: aulas usa `selection_run_id`, `plan.input_fingerprint` y
   `deployment_fingerprint` (`collection_engine.R:1140-1146`); telefónico no tiene huella. Material tampoco la cumple del
   todo: el plan por encuestador sale de la muestra viva y lo protege el 409 (excepción hasta F4).
4. **X5** además **muta estado ajeno**: la lectura llama a `.hojas_ruta_ensure_runs(sid)` (`router_monitoreo.R:620`), que
   puede escribir en Hojas de ruta (`.hojas_ruta_store_runs`, `router_hojas_ruta.R:375`).
5. **X6** también **fija el perfil** de Monitoreo (`router_monitoreo.R:5461-5467`) y acepta `estudio`, `selection` y
   `frame` desde el body (`:5447-5449`, `:5650`): el cliente puede inyectar un plan que no es el persistido.
6. **X7 estaba mal**: la semilla de Material (`.collection_seed_source`, `collection_engine.R:175-182`) **prefiere
   `monitoreo_aulas_plan`** y sólo cae a `calc_muestra_aulas_selection` como respaldo; la línea 237 de
   `collection_origen.R` sólo lee el `run_id` para el desfase. Es un **ciclo**: Cálculo → (copia X6) →
   `monitoreo_aulas_plan` → semilla de Material → (escritura X8) → `monitoreo_aulas_plan`, contenido hoy por
   `.collection_origen_circular`. **X7 y X8 se arreglan como una sola unidad.** (`collection_origen.R:255` es comentario,
   no código.)
7. **«Cálculo → Hojas de ruta: tamaño y reparto» no existe en el código**: ningún `hojas_ruta*.R` lee `calc_muestra_*`;
   `TerritorialHandoff.tsx` es un puntero de UI. En territorial, universo y cuotas viven sólo en Hojas.
8. **X4** se acopla a un helper privado de un archivo congelado (`.monitoreo_territorial_normalize_enumerator_roster`,
   `monitoreo_engine.R:2459`), no a un contrato.
9. **Home** (`project_overview.R`) consume todos los campos del Planner y faltaba en §8.
10. **Datos personales (§11)**:
    - El barrido telefónico **sí entra al `.pulso`** (`/api/monitoreo/sheets/sync` → `monitoreo_sources`/snapshot); si
      Material lo genera desde la muestra + backup, entra a `files/`.
    - La lógica del anonimizador vive en `api/R/pulso_anonimizar_proyecto.R` (la CLI es `api/scripts/pulso_anonimizar.R`).
      Recorre sólo `data.frame` (`:9-13`, `:32-56`) y `pulso_detectar_pii` igual (`:475`): `enumerator_roster$assignments`
      es lista de registros, así que **ni se anonimiza ni lo ve el gate** (verde por ceguera). Hay que tratarla como el
      padrón (`:479-488`).
    - Faltan filas: `monitoreo_aulas_disponibilidad` (nombres de aplicadores), snapshot y fuentes con respuestas de
      Kobo/SurveyMonkey, `monitoreo_aulas_padron` (se purga al exportar, `:209`), el Excel original de la lista en
      `files/` (lo barre el escaneo XLSX).
    - Falta decir dónde queda el Excel de asignación devuelto: hoy se lee del upload y no se guarda (lectura pura,
      `collection_territorial_asignacion_importar` escribe a un temporal y lo borra).
    - A favor: con `code_format = "DNI"` la asignación se bloquea sin exponer DNI.

**El ADR del Planner debe decidir antes de escribir código**: (1) relación con el ADR 0121 (enmienda §2 y ownership de
`representatividad`/`design_targets`); (2) foto con huella vs consulta viva, campo por campo; (3) huella por perfil;
(4) clave, schema y versión propios (`planner/v1`; no `estudio`, que es el contenedor multibase de Procesamiento:
`session_store.R:195`); (5) compatibilidad hacia atrás (un `.pulso` nuevo abierto en 0.8.0: doble escritura temporal o
versión mínima en `manifest.json`); (6) cardinalidad multibase, multiactor y multiperfil (acrconta, MDV, varios perfiles;
`monitoreo_profile` hoy es un solo valor); (7) qué expone el modo público (whitelist `forbid_mutations.R:61-65`);
(8) política de PII del equipo centralizado (retención, purga, exclusión del modo público); (9) romper el ciclo X7/X8
como una unidad; (10) nombre y ruta del módulo (ADR 0047, navegación v3, `plan_trabajo_v<N>`).

**Evidencia que falta**: si `.hojas_ruta_store_runs` marca dirty cuando lo dispara una lectura de Monitoreo; inventario
de consumidores frontend de `design_targets` y `monitoreo_profile`.

## 13. Pendiente de estructurar (tablero del loop)

- Formatos con maqueta fiel (L8).
