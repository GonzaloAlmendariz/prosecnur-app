# Checklist: Material de campo (ADR 0108)

Tipo: Checklist QA vivo
Estado: En curso
Fecha: 2026-10-16
Autoridad: Seguimiento del [ADR 0108](../adrs/0108-material-de-campo-catalogo-de-materiales-por-unidad.md); solo Gonzalo da por terminado un ítem
Diagnóstico: [diagnostico-material-de-campo-2026-10-16.md](diagnostico-material-de-campo-2026-10-16.md)
Plan de acción: [plan-material-de-campo-2026-10-16.md](plan-material-de-campo-2026-10-16.md)
Pendientes al integrar a main: [pendientes-material-de-campo-2026-10-16.md](pendientes-material-de-campo-2026-10-16.md)

Estados: **hecho** · **pendiente** · **bloqueado** (exige decisión) · **en revisión**.

## Decisiones

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| A1 | Nombre «Material de campo», ruta `/material-campo`, reemplaza «Preparación de campo» | ADR 0108 §1 | hecho (decidido 2026-10-16) |
| A2 | Hojas de ruta diseña la muestra y no imprime | ADR 0108 §5 | hecho (decidido 2026-10-16) |
| A3 | El tipo de campo es el modo (`aulas`, `territorial`, `cuotas`, `manual`) | ADR 0108 §5 | hecho (decidido 2026-10-16) |
| A4 | Color nuevo: Musgo `#4F752C` | ADR 0108 §7, `branding/` | hecho (decidido 2026-10-16) |
| A5 | Ícono del módulo: `Backpack` (mochila) | ADR 0108 §7, `frontend/src/lib/icons.ts` | hecho (decidido 2026-10-16) |
| A6 | La lista de fichas de cuota nace en Hojas de ruta, en un modo sin marco | ADR 0108 §6 | hecho (decidido 2026-10-16) |
| A9 | ADR propio del modo `cuotas` de Hojas de ruta (secciones, contrato de la asignación, migración) | `docs/adrs/` | pendiente; frena E4 |
| A10 | Imprenta como sección propia; Accesos solo con canal digital; Componer a medida en el alcance | ADR 0109 §3 a §5 | hecho (decidido 2026-10-16) |
| A11 | Canvas de E1 aprobado como referencia visual | artifact `W7xx1vTeBZE2tkdJtQCcSy` | hecho (aprobado 2026-10-16) |
| A12 | Conexiones con los vecinos y correos para Mailchimp | ADR 0110 | hecho (decidido 2026-10-16) |
| A7 | «Entrega» de Hojas de ruta se renombra «Selección» y conserva Cuotas, Titulares y Reemplazos | ADR 0108 §5 | hecho (confirmado 2026-10-16) |
| A8 | Aceptar el ADR 0108 | `docs/adrs/` | hecho (aceptado 2026-10-16) |

## Diagnóstico y revisión

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| D1 | Capturas reales de Recopiladores > Materiales (hsvg2026) y Hojas de ruta > Entrega (acnur_acg) | diagnóstico «Evidencia de UI» (capturas locales no versionadas) | hecho: confirma un solo preset sin catálogo; la ficha de dos caras sale dentro del ZIP |
| D2 | Revisión de contratos del ADR | guardian-contratos | hecho: REQUIERE MIGRACIÓN; integrado (sección R) |
| D3 | Revisión metodológica | revisor-metodologico | hecho: aprobado con supuestos E0–E3, rechazado E4 hasta A6; integrado (sección R) |
| D4 | ¿`fichas_cuota_v1` es general? | diagnóstico §5.1 | hecho: el patrón es general, el contenido es del estudio |
| D5 | ¿De quién es el tope por centro poblado? | diagnóstico §5.2 | hecho: del diseño; Material imprime, Monitoreo valida |
| D6 | ¿Quién posee las láminas de distribución? | diagnóstico §5.3 | hecho: Hojas de ruta > Selección > Cuotas, motor de entregables |
| D7 | Medir si los `.pulso` de referencia tienen `project_modules` curado con `recopiladores` | `api/inst/reference_projects/` | pendiente (antes de E0a) |

## R. Síntesis de las revisiones (qué cambió en el ADR)

| # | Hallazgo | Origen | Cómo quedó |
|---|---|---|---|
| R1 | El slug persistido se borraría en silencio (`project_overview.R:14-24`, `router_diseno_estudio.R:89-100`) | contratos B1 | §1: migración en lectura + alias en ambas listas |
| R2 | `collection_state/v1` admite un solo plan y un solo `unit_type` | contratos B2 | §2: `field_unit/v1` derivada; `collection_state/v2` con migración |
| R3 | Mover Cuotas, Titulares y Reemplazos a Muestra invierte la dependencia y rompe `active_stage` | contratos B3 | §5: «Entrega» pasa a «Selección»; migración de `active_stage` |
| R4 | «Secciones iguales en todos los modos» contradecía el ADR 0044 | contratos B4 | §5: cada modo reescribe secciones (Accesos solo en `aulas`); regla de precedencia; `modosCoverage` |
| R5 | Colisión entre adapter de fuente y adapter de proveedor | contratos I1 | §2: dos registros; `compatible_unit_types` |
| R6 | Las redirecciones pierden la query y la tabla estaba incompleta | contratos I2 | §5: componente de redirección y tabla completa |
| R7 | «Recopilador» también es vocabulario de SurveyMonkey | contratos I3 | §1: se conserva fuera del módulo |
| R8 | Cinco salidas de Hojas de ruta y el ADR decidía tres; `sample` del cliente | contratos I4 | §5: dueño por endpoint; muestra leída del servidor |
| R9 | Drive, secretos y congelados no estaban declarados | contratos I5, I6 | Consecuencias |
| R10 | Token y modo público; E0 dependía del color | contratos M2 | E0a sin color, E0b con color; modo público excluido |
| R11 | La lista de fichas de cuota no tenía dueño | metodología 1 | §6 bloqueado (A6) |
| R12 | No se decía con qué grano valida Monitoreo | metodología 2 | §3: el grano lo declara la fuente y se valida ese mismo |
| R13 | Llamar UMP a una ficha de cuota | metodología 3 | Contexto y diagnóstico: «ficha de cuota»; etiqueta de no probabilístico |
| R14 | El tipo de ficha es eje de cuota, no variante | metodología 4 | §3 |
| R15 | Faltaba `role` titular o reemplazo y la meta se copiaba | metodología 6, 7 | §2: `role`; meta por referencia |
| R16 | Golden de E4 casi tautológico; compensación entre celdas | metodología 9, 10 | Cumplimiento; §3 `min(logradas, meta)` |

## Hallazgos sueltos (fuera del ADR, para no perderlos)

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| H1 | Deriva front/back de bloques: el front lista 9, el back acepta 13 | `frontend/src/api/recopiladores.ts:186` vs `api/R/collection_materials.R:11` | hecho (E1a: `COLLECTION_BLOCK_TYPES` 13 con test de paridad R↔TS) |
| H2 | `ficha_campo_qr_a4_v1` y `afiche_qr_a4_v1` solo los llaman los tests | `api/R/collection_materials.R:22-52` | hecho (E1a: los tres presets en Catálogo › Tipos con «Usar este tipo») |
| H3 | `hojas_ruta_generar_zip` sin llamadores de producción, pero con `@export` y test | `api/R/hojas_ruta_engine.R:266`, `api/NAMESPACE`, `test-hojas-ruta-engine.R:58-81` | pendiente (E3, doble confirmación) |
| H4 | Formularios `#7172C1` da 4.30:1 sobre blanco, bajo el 4.5 que exige la dirección creativa v3 | `branding/direccion-creativa-v3.md` | pendiente: no es de este ADR; medido el 2026-10-16 |
| H5 | Monitoreo territorial salta en silencio una unidad sin márgenes de cuota | `api/R/monitoreo_engine.R:9642` | pendiente: hoy afecta a manzanas sin cuota; bloquea E4 |
| H6 | `hojas-ruta/entrega` no tiene documento que la gobierne | `docs/sistema/direcciones/hojas-ruta.md:18` | pendiente (E0a) |
| H7 | El script de la hoja de ruta de Ser Adolescente lee la cartografía de la app por ruta absoluta | `Campo/Generadores/mapa.py` (fuera del repo) | pendiente: desaparece con E2 a E4 |
| H9 | El fixture hsvg2026 no tiene estado de Recopiladores: ningún proyecto de referencia prueba un plan con accesos | `scripts/qa/material_campo_sembrar_plan.R` | hecho en la rama (5589e3cef): sembrador reproducible → un `.pulso` no versionado (2.373 unidades, accesos sintéticos, plantilla y paquete), sin tocar los proyectos de referencia |
| H21 | Accesos no rehidrata el despliegue Kobo preparado (adapter y URL se pierden en `.ca_preview_deployment`) | `api/R/collection_adapters.R:465`, `AccessSection.tsx:144` | hecho en la rama (7a8664488, 2072f1bf4; verificador APROBADO CON PENDIENTES 2026-10-16) |
| H22 | Paquetes dice «Fichas 0 de N» con las fichas creadas; cada visita crea una instancia nueva | `MaterialsSection.tsx:247,288,419` | hecho en la rama (7a8664488, 2072f1bf4; verificador APROBADO CON PENDIENTES 2026-10-16) |
| H23 | Entrega ofrece descargar un recibo cuyo archivo no viaja en el `.pulso` (404 al reabrir); «1 páginas» | `DeliverySection.tsx:37,139`, payload de `collection_state` | hecho en la rama (7a8664488, 2072f1bf4; verificador APROBADO CON PENDIENTES 2026-10-16) |
| H25 | En Entrega, la tarjeta «Recibo firmado» sale con Fecha, Revisión, Plan y Accesos vacíos sin que haya traspaso | `DeliverySection.tsx`, `readiness.receipt`/`payload.handoff` | hecho en la rama (59b601462, 7aeeb5662; verificador APROBADO CON PENDIENTES 2026-10-16) |
| H26 | Volver a sembrar el plan borra en silencio plantilla, fichas y recibos; la UI no confirma ni lee `descartado` | `collection_engine.R:660-693`, `PlanSection.tsx:212-223` | hecho (83bbeb44a, e43e0ff81; verificador APROBADO CON PENDIENTES 2026-10-17: dry_run no muta, descartado idéntico al real, plantilla conservada) |
| H27 | Accesos no distingue los campos derivados al leer (`deployment_derived_fields`) y los reenvía como observados | `AccessSection.tsx`, `providerRules.ts` | hecho (b13564464; verificador APROBADO CON PENDIENTES 2026-10-17) |
| H24 | El fixture anonimizado muestra facultades y cursos como nombres de persona | `api/inst/reference_projects/hsvg2026` | pendiente: trampa del anonimizador, no de la app |
| H10 | Entrega > Reemplazos esconde 250 px a la derecha sin indicio y el runner dice `desplazamientoH=0` | `.hojas-ruta-review-table-wrap.is-delivery`, `scripts/ui-quick-check.mjs` | pendiente: detector y tabla |
| H11 | En 1024x600 dos ítems del outline de Materiales desbordan (173 y 182 px en 166) | `features/recopiladores/` | hecho en la rama (5 mejoras, 2026-10-16): filas alineadas, sin overflow a 1024 |
| H12 | Hojas de ruta > Selección no declara ningún grupo geométrico (C1); el outline del Catálogo tampoco | `features/hojasRuta/HojasRutaPage.tsx`, editor de Materiales | outline hecho en la rama (`material-catalogo-outline`, equal); Selección de Hojas de ruta sigue pendiente |
| H13 | Selección a 1024x600: scroll anidado con 173 px de ventana interior; alcanzable pero estrecho (C4) | `.hojas-ruta-stage-shell.is-delivery-stage` | pendiente (preexistente) |
| H14 | Los botones de sección de Material de campo no exponen `aria-current`; el tile «Agregar» del dock lleva `aria-current="page"` | top bar de módulo, dock | hecho en la rama: `aria-current="step"` en la sección activa; el tile «Agregar» del dock sigue pendiente |
| H15 | El ítem 7 del outline repite el rótulo («Registro de aplicación Registro de aplicacion») | editor de Materiales | hecho en la rama: sin subtítulo repetido y con tilde (también en la ficha impresa) |
| H16 | La card del home dice «Material» (etiqueta corta), su subtítulo se corta y el cuerpo habla solo de aulas | `features/home/moduleCardModel.ts`, `ModuleStatusCard.tsx` | hecho en la rama: «Material de campo», «Fichas, accesos y paquetes», cuerpo por unidades |
| H17 | Los íconos de sección declarados (QR en Accesos, plantilla en Catálogo) no los dibuja ninguna vista: el top bar usa chips numerados | `lib/modules.ts` | pendiente (E1) |
| H18 | Musgo queda a ΔE76 18.2 del verde de éxito `--pulso-success-fg` #166534; ningún gate mide esa cercanía | `branding/identity.json` | pendiente: vigilar en E1 junto a los estados |
| H19 | Las pestañas de Accesos (Canales, Vinculación) son píldoras horizontales, no el rail de pestañas de la casa | `features/recopiladores/AccessSection.tsx` | hecho en la rama: Accesos usa `ContextTabRail` |
| H20 | Los vacíos sin plan (Unidades, Accesos, Paquetes, Entrega) eran cajas punteadas de una frase | `VacioSinPlanCard.tsx`, `vacioSinPlan.ts` | hecho en la rama: título, qué falta y una acción al paso que lo resuelve |
| H8 | El cronograma de Ser Adolescente dice 1,400 casos; el estudio es de 1.000 | cronograma del estudio (fuera del repo) | pendiente: aviso, no es de la app |

## Etapas (solo después de A8)

| # | Etapa | Dónde vive | Estado |
|---|---|---|---|
| E0a | Renombre, ruta, secciones, redirección con query, migración del slug y de `active_stage`, home, bóveda, agentic OS | rama `feat/material-campo-e0a` | hecho en la rama (Gonzalo lo dio por cerrado el 2026-10-16); merge a main pendiente, no se hace mientras se publica la 0.9.3 |
| E0b | Token Musgo, alias, ícono `Backpack`, `branding/` (identidad 1.4.0) | `tokens.css`, `boot.css`, `branding/identity.json`, `lib/icons.ts` | hecho en la rama (Gonzalo lo dio por cerrado el 2026-10-16) |
| E1 | Reemplazada por E1a a E1d del ADR 0109 | ADR 0109 §8 | hecho (decidido 2026-10-16) |
| E1a | Secciones por modo (Imprenta nueva, Accesos solo con canal digital), catálogo con miniaturas reales, cuatro capas en la unidad, `compatible_unit_types`, dos registros de adapters, `collection_state/v2` | `modules.ts`, `collection_*.R`, `features/recopiladores/` | Catálogo › Tipos hecho en la rama: verificador APROBADO CON PENDIENTES (2026-10-16; gate R 1722, front 628, «Usar este tipo» con PUT 200 en los 3 presets, capturas miradas). Pendiente: captura del editor con la ficha de campo (form_lines, croquis) en árbol limpio. El resto de E1a (cuatro capas, `collection_state/v2`, Imprenta) sigue pendiente |
| E1b | Editor sobre la página real, con zonas por bloque y caras | `features/recopiladores/`, compilador | hecho en main (fixes 653e50510, 24bfc10ad, 8bb10f721, c67e1a272); falta el verificador final sobre el doble guardado |
| E1i | Imágenes de línea gráfica dentro del correo (banners intermedios, imágenes del cuerpo) que se vean en el envío; alojamiento: ZIP importable en Mailchimp («Code your own → Import zip», rutas relativas; Mailchimp las sube solo) como camino principal y URL pública https como alternativa a GitHub (pedido 2026-10-20) | `collection_mail_*.R`, export ZIP, editor de correos | pendiente: en el contrato de E1g/E1h; verificar el tope de peso del ZIP de Mailchimp |
| E1j | Plataforma de envío por campaña: SurveyMonkey (invitación del recopilador con [FirstName], [SurveyLink], [PrivacyLink], [OptOutLink]) o Mailchimp (ZIP importable, *\|FNAME\|*); mismo editor, cambia el dialecto de etiquetas, el pie obligatorio y lo exportado (decidido 2026-10-20) | `collection_mail_render.R`, export, campaña | backend en main (9e6ce99cf, e29366c8b; revisor-metodologico APROBADO CON SUPUESTOS); frontend en curso |
| E1k | Envíos dentro de la campaña: cuerpo común e Invitación, Recordatorio 1, 2… con asunto, fecha y línea de apertura propios; se exporta cada envío (decidido 2026-10-20; ejemplo Arte y Diseño: invitación 02/09 a 125, recordatorio 08/09 a 106) | `collection_mail_campaigns.R` | backend en main (9e6ce99cf, e29366c8b); frontend en curso |
| E1l | Importar un HTML existente (p.ej. el de Arte y Diseño PUCP) y convertirlo en bloques editables, con sus etiquetas SurveyMonkey como campos; lo no reconocido se marca para revisar (decidido 2026-10-20) | parser nuevo, editor de correos | backend en main (9e6ce99cf, e29366c8b); frontend en curso |
| E1m | El editor de correos es intuitivo: affordance visible, una forma obvia por acción, lenguaje del usuario, estado visible, errores con «Ir al bloque», deshacer anunciado, primeros pasos y teclado; se mide con un recorrido de tarea real (importar Contabilidad → alt → recordatorio → exportar SurveyMonkey) y una revisión de usabilidad independiente (pedido 2026-10-20) | `features/recopiladores/correos/` | en curso |
| C1 | Control inicial: al entrar a Material de campo se ve primero la lista de campañas del proyecto como tarjetas (tipo, nombre, estado, avance) y «Nueva campaña»; al abrir una solo se ven sus secciones (pedido 2026-10-20: «debe haber ese control inicial primero») | ADR 0111 · `modules.ts` · `features/recopiladores/` | contrato congelado en ADR 0111 |
| C2 | Tres tipos de campaña que no se confunden: aulas (campo presencial con fichas QR), territorial (UMP de Hojas de ruta) y correo; cada una con sus elementos y su juego de secciones | ADR 0111 · `modules.ts` (modo = tipo) | pendiente |
| C3 | Cada campaña de correo por actor es una campaña del proyecto de tipo «correo» (decisión 2026-10-20); deja de colgar de Catálogo › Correos | `collection_mail_campaigns.R` → registro de campañas | pendiente |
| C4 | Registro `material_campaigns/v1` y migración aditiva: el plan de aulas existente pasa a ser la campaña de aulas y cada correo existente pasa a ser una campaña de correo; los `.pulso` viejos abren igual | backend (`collection_*`) | pendiente |
| C5 | Dirección enlazable de la campaña (`?campana=<id>` como alcance, el tipo como `modo`); los enlaces viejos redirigen | `direccion.ts` · `navegacion.ts` | pendiente |
| C6 | Campaña territorial: depende de E2 (`ump_territorial_v1`); mientras no exista se ofrece con su motivo, sin fabricar secciones vacías | ADR 0111 · E2 | bloqueado por E2 (en «Nueva campaña» deshabilitada con su motivo) |
| C7 | Las cards del home del proyecto y los vecinos (Monitoreo, Cálculo de muestra) leen la campaña correcta | home · `avisoMaterialCampo.ts` | pendiente |
| E1c | Componer a medida con bloques parametrizados | registro de bloques, editor | pendiente |
| E1d | Imprenta: carpeta numerada, imposición dúplex y dos por hoja, pliego físico, conteo y LEEME | job de render, `features/recopiladores/` | pendiente |
| E6 | Pedido de cambios en palabras | ADR 0109 §6 | **bloqueado**: proveedor del modelo, credencial y modo sin conexión |
| E1e | Unidades › Origen: huella, diferencias y «Actualizar desde la fuente» (aulas) | ADR 0110 §1 | hecho en main (200684c67, 4ff4c7727, f3d388a8f, 09769d7e9; verificador APROBADO CON PENDIENTES 2026-10-17: una sola vigencia por huella en Origen, Lista y Cálculo de muestra; 409 si la fuente cambia al revisar). Pendiente: medir geometría del aviso de Cálculo de muestra con `--post-click-wait-selector 'div[role="status"][aria-label="Material de campo"]'` |
| E1f | Correos: editor, campos, vistas y exportación para Mailchimp | ADR 0110 §2 | hecho en la rama: verificador APROBADO CON PENDIENTES (2026-10-16) sobre 7ee56e7ee…01ce8b57e; revisor-metodologico APROBADO CON SUPUESTOS (en ADR 0110); guardian-contratos cerrado. Gate R 1854, front 697; export en vivo con CSV CP1252, logos persisten al reabrir, `.pulso` sin correos. Pendiente: probar el HTML en Mailchimp real; chequeo de modo oscuro; sombra y ancho 640 px los decide Gonzalo |
| E1g | Correos: edición visual profesional y didáctica directamente sobre el correo (escribir en el bloque, estilos, arrastrar, insertar campos), con HTML generado y siempre válido para Mailchimp (decidido 2026-10-20: «Visual sobre el correo») | `features/recopiladores/correos/`, `collection_mail_*.R` | hecho en main (f50152644, 25315f5cb); falta verificador final y revisión de usabilidad (E1m) |
| E1h | Varias campañas de correo por proyecto, para distintos actores, cada una con plantilla, audiencia y export propios, duplicables (decidido 2026-10-20) | `collection_state$mail_template` → lista de campañas, ADR 0110 | hecho en main (bff880635, 35da94c6d); se reubica como campañas tipo correo (C3) |
| E7 | API de Mailchimp para plantilla o campaña en borrador (opcional) | ADR 0110 §3 | **bloqueado**: credencial y autorización |
| E2 | `ump_territorial_v1` y salidas de Hojas de ruta como layout legacy | archivo nuevo junto a `collection_adapters.R` | pendiente |
| E3 | Bloques `quota_grid`, `unit_map`, `place_checklist`, `route_instructions`; port; retiro del legacy | registro de bloques | pendiente |
| E4 | `fichas_cuota_v1`, hojas comunes, alerta en Monitoreo, golden de Ser Adolescente | archivo nuevo, `monitoreo_engine.R` | **bloqueado** (A9, H5) |
| E5 | Seguimiento por ficha desde la lista de unidades (opcional) | Monitoreo | pendiente |

## F. Coordinación con el revamp de Formularios (2026-10-16)

Consultado a la sesión «Generador de formularios» (rama `feat/revamp-formularios`, canvas
`XkpdPVxW4CN7Gthdx1HaQV`). Lo que quedó establecido:

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| F1 | Formularios no asume nada del generador de fichas ni del motor de materiales: su Impreso usa otro motor (`formulario_pdf_build_model`) | `api/R/collection_*.R` sigue siendo de Material de campo | hecho (confirmado) |
| F2 | `consent_text` y cualquier bloque que lea el instrumento leen del modelo del formulario, sin reimplementar el parser (`parsing/detectConsentQuestions.ts`) | E4 | pendiente |
| F3 | El kit de Formularios (`PanelCard`, `PropRow`, `Segmented`) se importa tal cual desde `xlsformEditor/kit/`; se promueve a `src/components/kit` una sola vez, en un commit aparte, según el orden de merge que decida Gonzalo | E1 | **bloqueado**: orden de merge, lo decide Gonzalo |
| F4 | Reglas que se heredan: contenedor con cabecera y pie y dos niveles neutros; color solo en íconos y estados; `flex-shrink:0` dentro de columnas flex y último contenedor con fill; container queries para paneles; movimiento ≤ 240 ms sin rebote y apagado con reduced-motion; medir recortes por script contra datos reales a escala | E1 (canvas y gate) | pendiente |
| F5 | No se heredan la barra ni el rail de su canvas (son de Formularios; el chrome sigue el ADR 0042) | — | hecho (decidido) |
| F6 | Único choque posible al mergear: `frontend/src/app/theme.css` (su rama borra ~100 líneas muertas) | merge | pendiente: esta rama no toca `theme.css` |
