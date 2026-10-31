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

## 8. Pendiente de estructurar (tablero del loop)

- Planner: campos del estudio, dueño, consumidores, dónde viven hoy y cómo se mudan (L5).
- Contratos de lectura entre módulos (L6).
- Formatos con maqueta fiel (L8).
- Datos personales (L9).
- Hoja de ruta por fases y sesiones (L10).
