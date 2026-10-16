# Checklist: Material de campo (ADR 0108)

Tipo: Checklist vivo
Estado: En curso
Fecha: 2026-10-16
Autoridad: Pedidos de Gonzalo; sólo él da por terminado un ítem

Fecha de apertura: 2026-10-16 · Solo Gonzalo da por terminado un ítem.
Diagnóstico: [diagnostico-material-de-campo-2026-10-16.md](diagnostico-material-de-campo-2026-10-16.md) · ADR:
[0108](../adrs/0108-material-de-campo-catalogo-de-materiales-por-unidad.md)

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
| A7 | «Entrega» de Hojas de ruta se renombra «Selección» y conserva Cuotas, Titulares y Reemplazos | ADR 0108 §5 | hecho (confirmado 2026-10-16) |
| A8 | Aceptar el ADR 0108 | `docs/adrs/` | **bloqueado**: decisión de Gonzalo |

## Diagnóstico y revisión

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| D1 | Capturas reales de Recopiladores > Materiales (hsvg2026) y Hojas de ruta > Entrega (acnur_acg) | capturas locales no versionadas, diagnóstico «Evidencia de UI» | hecho: confirma un solo preset sin catálogo; la ficha de dos caras sale dentro del ZIP |
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
| H1 | Deriva front/back de bloques: el front lista 9, el back acepta 13 | `frontend/src/api/recopiladores.ts:186` vs `api/R/collection_materials.R:11` | pendiente (E1) |
| H2 | `ficha_campo_qr_a4_v1` y `afiche_qr_a4_v1` solo los llaman los tests | `api/R/collection_materials.R:22-52` | pendiente (E1) |
| H3 | `hojas_ruta_generar_zip` sin llamadores de producción, pero con `@export` y test | `api/R/hojas_ruta_engine.R:266`, `api/NAMESPACE`, `test-hojas-ruta-engine.R:58-81` | pendiente (E3, doble confirmación) |
| H4 | Formularios `#7172C1` da 4.30:1 sobre blanco, bajo el 4.5 que exige la dirección creativa v3 | `branding/direccion-creativa-v3.md` | pendiente: no es de este ADR; medido el 2026-10-16 |
| H5 | Monitoreo territorial salta en silencio una unidad sin márgenes de cuota | `api/R/monitoreo_engine.R:9642` | pendiente: hoy afecta a manzanas sin cuota; bloquea E4 |
| H6 | `hojas-ruta/entrega` no tiene documento que la gobierne | `docs/sistema/direcciones/hojas-ruta.md:18` | pendiente (E0a) |
| H7 | El script de la hoja de ruta de Ser Adolescente lee la cartografía de la app por ruta absoluta | `Campo/Generadores/mapa.py` (fuera del repo) | pendiente: desaparece con E2 a E4 |
| H9 | El fixture hsvg2026 no tiene estado de Recopiladores: ningún proyecto de referencia prueba un plan con accesos | `api/inst/reference_projects/` | pendiente (antes de E1) |
| H10 | Entrega > Reemplazos esconde 250 px a la derecha sin indicio y el runner dice `desplazamientoH=0` | `.hojas-ruta-review-table-wrap.is-delivery`, `scripts/ui-quick-check.mjs` | pendiente: detector y tabla |
| H11 | En 1024x600 dos ítems del outline de Materiales desbordan (173 y 182 px en 166) | `features/recopiladores/` | pendiente (E1) |
| H8 | El cronograma de Ser Adolescente dice 1,400 casos; el estudio es de 1.000 | cronograma del estudio (fuera del repo) | pendiente: aviso, no es de la app |

## Etapas (solo después de A8)

| # | Etapa | Dónde vive | Estado |
|---|---|---|---|
| E0a | Renombre, ruta, modos, secciones, redirección con query, migración del slug y de `active_stage`, home | `modules.ts`, `App.tsx`, `direccion.ts`, `project_overview.R`, `router_diseno_estudio.R`, `router_hojas_ruta.R` | pendiente (depende de A8, D7) |
| E0b | Token Musgo, alias, ícono `Backpack`, `branding/` | `tokens.css`, `boot.css`, `branding/identity/tokens.css`, `lib/icons.ts` | pendiente (depende de E0a) |
| E1 | Catálogo, `compatible_unit_types`, dos registros de adapters, `collection_state/v2`, revamp «pliego de imprenta» | `collection_*.R`, `features/recopiladores/` | pendiente |
| E2 | `ump_territorial_v1` y salidas de Hojas de ruta como layout legacy | archivo nuevo junto a `collection_adapters.R` | pendiente |
| E3 | Bloques `quota_grid`, `unit_map`, `place_checklist`, `route_instructions`; port; retiro del legacy | registro de bloques | pendiente |
| E4 | `fichas_cuota_v1`, hojas comunes, alerta en Monitoreo, golden de Ser Adolescente | archivo nuevo, `monitoreo_engine.R` | **bloqueado** (A9, H5) |
| E5 | Seguimiento por ficha desde la lista de unidades (opcional) | Monitoreo | pendiente |
