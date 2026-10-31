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

Se dibuja en el artefacto, sección «Lo que necesitamos que decidas». Al día de hoy:

1. Visto bueno al plan para construir D1 y D2(a).
2. Conteos del consolidado transcritos en el Excel de asignación.
3. El «Estado» que llena campo: leerlo como declarado o quitarlo (C7).
4. El importador de la lista respeta el código del Excel.
5. Quién revisa el barrido telefónico del RMS (C8).
6. F4: el plan de campo desde la foto.
7. Adelantar «asignado frente a observado» (B3).
8. Dónde vive la lista de encuestadores (Monitoreo, Material o Planner).
9. Abrir el ADR del Planner.

## 4. Reglas del reparto entre módulos

Propuestas por Meta B y la sesión de Monitoreo (31 oct), extienden el ADR 0118. No contradicen el checklist C1–C8.

1. **Material produce lo que sale a campo**: fichas, hojas de ruta, hoja de ruteo, hoja de consolidados, hoja del día,
   Excel de asignación, plantilla del barrido telefónico, plantillas en blanco del libro de aulas y correos.
2. **Monitoreo lee lo que vuelve y calcula**: Kobo, SurveyMonkey, el barrido llenado, el libro de aulas; avance y
   control. Material no calcula avance; Monitoreo no escribe en Material.
3. **Un escritor por archivo**: el Excel que campo devuelve lleno lo lee el módulo que lo generó. Si a Monitoreo le
   sirve, lo consulta después por un endpoint sin efectos (como `GET /api/recopiladores/campaigns/territorial/asignacion`).
4. **Siempre desde la muestra enviada**: todo lo que sale a campo nace de la foto enviada, con su `sample_fingerprint`.
   Si no coincide, Monitoreo dice «de otra muestra» y no compara.
5. **La app no pisa lo que llena campo**: dueño por hoja, como ya rige el libro de aulas.
6. **Datos personales antes de existir**: todo insumo con nombres, DNI o teléfonos declara cómo lo cubre
   `api/scripts/pulso_anonimizar.R`. Hoy faltan `enumerator_roster` y `material_territorial_asignacion`.

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

## 10. Pendiente de estructurar (tablero del loop)

- Formatos con maqueta fiel (L8).
- Datos personales (L9).
- Hoja de ruta por fases y sesiones (L10).
