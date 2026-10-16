# ADR 0108: Material de campo es un catálogo de materiales sobre una lista de unidades de campo

Estado: Propuesto

Implementacion: No iniciada

Fecha: 2026-10-16

Fecha de decision: —

Reemplaza: parcialmente [ADR 0046](0046-recopiladores-despliegue-recoleccion.md) en el nombre, la ruta, las secciones
(cláusula 9) y la suposición de que la unidad es un curso-horario; parcialmente
[ADR 0009](0009-hojas-ruta-fases-piloto-campo-real.md) en que Hojas de ruta deja de emitir los impresos de campo. Las
demás cláusulas de ambos siguen vigentes.

Extiende: [ADR 0044](0044-jerarquia-y-direcciones-de-navegacion.md) §1 (agrega un tercer módulo con modos) y
[ADR 0019](0019-monitoreo-aulas-universitarias.md) (la proyección de aulas se conserva).

Evidencia: [diagnóstico 2026-10-16](../qa/diagnostico-material-de-campo-2026-10-16.md) ·
checklist [material de campo](../qa/checklist-material-de-campo-2026-10-16.md) · revisiones de contratos y metodología
del 2026-10-16 (sintetizadas en el checklist, sección R).

## Contexto

En Ser Adolescente 2026 todo el material de campo se hizo fuera de la app: 125 fichas de cuota de dos caras (el estudio
las rotula «UMP», pero no son unidades de muestreo: es un diseño no probabilístico con control de cuotas), hoja de
ruteo, hoja de consolidados, consentimiento en media A4, láminas de distribución y un seguimiento por ficha. Fichas y
seguimiento salieron de **una sola lista de unidades** (`hojaruta_v3.fichas()`): esa lista, con su meta, es lo que la app
no tiene.

Hoy la app tiene dos motores de fichas que no se conocen:

- **Recopiladores** (ADR 0046) tiene un sustrato genérico (contratos versionados, registro cerrado de bloques, presets
  con `material_kind`, compilador `grid` único para preview y PDF, job y recibo), pero todo lo que llega al usuario
  supone un curso-horario: el seed lee solo aulas, los bindings son de aula, el ZIP se ordena por facultad, hay un solo
  template por proyecto, dos presets solo los llaman los tests, y `collection_state/v1` admite un solo plan con un solo
  `unit_type` (`collection_contracts.R:198`).
- **Hojas de ruta** dibuja su ficha de manzana de dos caras, la hoja de zona y el ZIP dentro de `hojas_ruta_engine.R`,
  congelado a crecimiento. No usa el registro de bloques ni el kit `pulso_pdf_*`, imprime solo los márgenes de cuota y
  fija los ejes en sexo × edad.

Además, «Recopiladores» traduce los *collectors* de SurveyMonkey: describe la plataforma, no el trabajo.

## Decisión

### 1. El módulo y su identificador

Recopiladores pasa a llamarse **Material de campo**: ruta `/material-campo`, título «Material de campo», etiqueta corta
«Material». Se ubica en el dock entre Hojas de ruta y Monitoreo.

Su responsabilidad: **producir y entregar lo que el equipo lleva a campo para cada unidad**, impreso o digital, desde
una lista de unidades **que otro módulo decidió**. Material de campo no crea, edita ni reparte unidades ni cuotas.

**Slug persistido.** El slug `recopiladores` vive en estado persistido: `project_modules` (filtrado por
`.PROJECT_PRIMARY_SLUGS`, `project_overview.R:14-24`) y el `module_id` de la bitácora (re-normalizado al cargar,
`router_diseno_estudio.R:89-100`). Ambas listas descartan o reasignan en silencio lo que no reconocen. Se decide:

- el slug nuevo es `material-campo`;
- `load_pulso` migra en lectura `recopiladores` → `material-campo` en `project_modules` y en las entradas de bitácora,
  y ambas listas aceptan el alias mientras existan proyectos anteriores;
- ningún código nuevo escribe `recopiladores` como slug de módulo.

**El término se conserva para lo que sí nombra.** «Recopilador» sigue siendo el vocabulario de los *collectors* de
proveedor en Monitoreo y Carga (`acreditacion/fuentes/recopiladores`, `BasesPanel.tsx`, `fuentes/vocabulario.ts`). El
renombre toca solo el módulo.

### 2. Tres ejes separados y dos registros de adapters

1. **Unidad de campo** (`field_unit/v1`). **Proyección derivada, no persistida**, con fingerprint de su fuente y estado
   `stale` cuando la fuente cambia. Cada unidad trae `unit_id`, `unit_type`, `label`, `role` (obligatorio en
   `territorial_ump`: titular o reemplazo; un reemplazo no suma a la meta mientras no se active; en `quota_sheet` no
   aplica y no se inventa), los campos que declara su tipo y una **referencia** a la meta de la fuente, nunca una copia.
   La produce un **source adapter**:

   | Source adapter | Fuente (dueña de la lista y de la meta) | `unit_type` |
   |---|---|---|
   | `aulas_v1` | Cálculo de muestra y Monitoreo de aulas (como hoy) | `classroom_course_schedule` |
   | `ump_territorial_v1` | `hojas_ruta_runs[[fase]]` en el servidor, solo lectura | `territorial_ump` |
   | `fichas_cuota_v1` | asignación de fichas de cuota producida por Hojas de ruta en su modo sin marco (§6) | `quota_sheet` |
   | `manual_v1` | lista libre, para hojas comunes sin fuente | `generic` |

   Los **provider adapters** actuales (`aulas_v1` de accesos, `manual_links_v1`, `kobo_existing_v1` y los de SurveyMonkey,
   `collection_adapters.R:566-575`) producen **accesos**, no unidades, y viven en un registro aparte. Un test rechaza
   cruzarlos. El `compatible_adapters` de las plantillas pasa a `compatible_unit_types`.

   **Cada `unit_type` declara sus bindings.** La allowlist de `collection_materials.R:65` deja de ser global.

2. **Tipo de material** (preset del catálogo): receta versionada de bloques del registro cerrado, con `material_kind`,
   `compatible_unit_types` y la estructura de su paquete.

   | Tipo | `unit_type` | Origen |
   |---|---|---|
   | Ficha de aula con QR | `classroom_course_schedule` | `ficha_aplicacion_a4_v1` (hoy) |
   | Ficha de campo con QR y croquis | `classroom_course_schedule` | `ficha_campo_qr_a4_v1` (hoy solo en tests) |
   | Afiche QR | todos con acceso | `afiche_qr_a4_v1` (hoy solo en tests) |
   | Ficha de manzana de dos caras · Hoja de zona · PDF de reemplazos manuales · Ficha de prueba aleatoria | `territorial_ump` | Hojas de ruta, primero envueltas |
   | Ficha de cuota | `quota_sheet` | nueva (Ser Adolescente) |
   | Hoja de ruteo · Hoja de consolidados · Consentimiento media A4 | todos | nuevas |

   Los accesos (enlaces y QR) son una capacidad que consumen algunos tipos mediante `access_qr`.

3. **Paquete de entrega**: selección de unidades × tipos, render por job, recibo único, ZIP con la estructura que
   declara cada tipo y traspaso a Monitoreo. `collection_deployment/v1` y la proyección de aulas se conservan.

**Persistencia.** Varios modos en un mismo proyecto no caben en `collection_state/v1`. Se crea `collection_state/v2`
con `plans` y `deployments` indexados por `unit_type`, migrado en `project_pulso.R` (junto a
`collection_state_migrate_legacy`) y registrado en `session_schema.R`. Recibos, `file_id` y binarios siguen fuera del
`.pulso` (ADR 0046 §8 y §12).

### 3. La meta: grano, denominador y validación

- **El grano de la cuota (celda conjunta o margen) lo declara la fuente de la unidad.** `quota_grid` imprime ese grano y
  Monitoreo valida **exactamente ese grano**. Imprimir celdas con validación por márgenes está prohibido: una ficha con
  4/0/0/4 cuadra en márgenes y está abierta en celdas.
- El avance de una ficha es la suma de `min(logradas_celda, meta_celda)`: el exceso de una celda no compensa el faltante
  de otra.
- Un eje fijado a nivel de unidad (urbana o periurbana, que define el lugar de nacimiento exigido) es **parte de la
  meta**, no una variante de impresión. Monitoreo verifica por encuesta que coincida con su ficha; la que no coincide no
  cuenta para esa ficha y no se reasigna en silencio. Un eje ausente (Lima) no es un eje en cero.
- **Restricciones que cruzan unidades** (tope de encuestas por centro poblado) son del diseño, al grano sede × lugar, y
  se declaran junto con la asignación. Material de campo las imprime (`place_checklist`); Monitoreo las valida como
  contador compartido con su denominador; un lugar fuera de la lista alerta.
- Una unidad sin definición de meta **alerta**: hoy Monitoreo territorial la salta en silencio
  (`monitoreo_engine.R:9642`, `next`), y eso se corrige antes de habilitar `quota_sheet`.
- Una meta cero se muestra como «no aplica», nunca como 0 %.
- Los reportes de un estudio de fichas de cuota llevan la etiqueta «No probabilístico por conveniencia con control de
  cuotas» y no calculan `deff` ni margen de error tratando las fichas como conglomerados.

### 4. Bloques nuevos del registro cerrado

`quota_grid` (grano declarado por la fuente, casillas por encuesta opcionales), `unit_map` (polígono y contexto con la
cartografía de Hojas de ruta), `place_checklist` (lugares permitidos con su tope), `route_instructions` (esquina,
sentido, inicio, salto), `visit_log` (visitas con códigos de resultado) y `consent_text` (texto del instrumento, N copias
por hoja). Siguen vigentes las reglas del ADR 0046: sin HTML, CSS, JS, expresiones ni URLs arbitrarias, sin canvas libre.

### 5. Navegación (contrato v3)

**Modo = tipo de campo**, y cumple la definición del ADR 0044: cada modo **reescribe el juego de secciones**. Se
determina así, sin clic:

1. el tipo de campo declarado por el estudio (taxonomía de `api/inst/catalogos/` y su fuente presente);
2. si no hay fuente, `manual`;
3. un proyecto tiene un solo modo; una segunda fuente se atiende con hojas comunes en ese mismo modo, no con un segundo
   modo.

| Modo | Secciones |
|---|---|
| `aulas` | Unidades · **Accesos** · Catálogo · Paquetes · Entrega |
| `territorial` | Unidades · Catálogo · Paquetes · Entrega |
| `cuotas` | Unidades · Catálogo · Paquetes · Entrega |
| `manual` | Unidades · Catálogo · Paquetes |

| Sección | Pestañas | Panel |
|---|---|---|
| Unidades (`unidades`) | `lista` · `origen` (fuente, fingerprint, `stale`) | inspector de unidad |
| Accesos (`accesos`, solo `aulas`) | `canales` · `vinculacion` (como hoy) | — |
| Catálogo (`catalogo`) | `tipos` · `editor` | inspector de bloque |
| Paquetes (`paquetes`) | `armado` · `prueba` · `recibos` | diálogo de render |
| Entrega (`entrega`) | `monitoreo` · `archivos` (ZIP y Drive) | — |

`PROSECNUR_NAVIGATION_CONTRACT.modosCoverage` suma `material-campo-v1`. La enumeración «solo Monitoreo y Cálculo de
muestra tienen modos» del ADR 0044 §1 pasa a incluir Material de campo.

**Hojas de ruta** queda con Territorio · Población · Muestra · Manzanas · **Selección** (confirmado por Gonzalo el
2026-10-16). «Entrega» se renombra «Selección» y conserva Cuotas, Titulares y Reemplazos, que dependen de Manzanas y no son material.
`hojas_ruta_ui_state.active_stage = "entrega"` se migra a `"seleccion"` en `.hojas_ruta_ui_state_normalize`, junto con
la profundidad de restauración de la muestra (`HojasRutaPage.tsx:6662`); un valor desconocido no puede volver a caer en
Territorio sin muestra.

**Dueño de cada salida de Hojas de ruta:**

| Endpoint | Dueño después |
|---|---|
| `/generate` (ZIP de fichas, job `hojas_ruta.generate`) | Material de campo (tipo de material); el endpoint queda como alias mientras dure el layout legacy |
| `/random-pdf` | Material de campo, Paquetes > prueba |
| `/manual-replacements-pdf` | Material de campo (tipo de material) |
| `/route-workbook` (XLSX operativo) | Hojas de ruta por ahora; E5 decide si pasa a Monitoreo |
| `/reporte-decisional` | Hojas de ruta (es informe del diseño) |

El source adapter lee la muestra **del servidor** (`hojas_ruta_runs[[fase]]`), la misma que lee Monitoreo territorial
(`router_monitoreo.R:613-628`), con fingerprint igual; nunca acepta `sample_snapshot` del cliente.

**Redirecciones.** `ALIAS_LEGACY` (`direccion.ts`) traduce nombres de parámetro, no valores, y las redirecciones de
`App.tsx` son `<Navigate>` estáticos que pierden la query. Se agrega un componente de redirección que conserva la query y
traduce valores por módulo, con test:

| Dirección vieja | Dirección nueva |
|---|---|
| `/recopiladores`, `?seccion=plan-recoleccion` y `&pestana=unidades` | `/material-campo?modo=<del estudio>&seccion=unidades&pestana=lista` |
| `?seccion=accesos` (con o sin pestaña) | `/material-campo?modo=aulas&seccion=accesos&pestana=<la misma o canales>` |
| `?seccion=materiales` sin pestaña y `&pestana=vista` | `/material-campo?modo=aulas&seccion=catalogo&pestana=editor` |
| `?seccion=materiales&pestana=paquetes` | `/material-campo?modo=aulas&seccion=paquetes&pestana=armado` |
| `?seccion=entrega-campo` y `&pestana=traspaso` | `/material-campo?modo=aulas&seccion=entrega&pestana=monitoreo` |
| `/hojas-ruta?seccion=entrega&pestana=cuotas\|titulares\|reemplazos` | `/hojas-ruta?seccion=seleccion&pestana=<la misma>` |

Los consumidores que hoy escriben direcciones viejas (`ClassroomAuditPanels.tsx:49`, `AulasMonitoreoPage.tsx:2203`,
`SalidasMonitoreoTab.tsx:154`, `router_diseno_estudio.R:463`) pasan a escribir las nuevas.

**Modo público:** Material de campo no existe en `isPublicMode()`.

### 6. La lista de fichas de cuota nace en Hojas de ruta

Decidido por Gonzalo el 2026-10-16. `fichas_cuota_v1` lee una asignación cuya dueña es **Hojas de ruta, en un modo sin
marco**: cuántas fichas por sede y distrito, su eje fijado, la meta por celda, la lista de lugares y sus topes. El
catálogo ya manda los estudios `territorial_hogares` a Hojas de ruta y fuera del calculador. Material de campo no la
crea ni la edita.

Consecuencia: Hojas de ruta pasa a tener modos (`marco`, el de hoy con manzanas INEI, y `cuotas`, sin marco). El
detalle de ese modo (secciones, contrato de la asignación, migración) es un ADR propio, que E4 necesita antes de
empezar.

### 7. Identidad visual

**Línea visual «pliego de imprenta»:**

- el catálogo es una galería de pliegos con miniatura real del mismo compilador del PDF, nunca un ícono genérico;
- el editor es un pliego centrado con el outline de bloques a la izquierda y el inspector a la derecha
  (`PageFrame layout="canvas"`); Paquetes y Recibos usan `layout="data"`;
- el acento marca **procedencia**: lo que llena la unidad se tiñe con el acento y el texto fijo queda neutro;
- el sistema Pabellón sigue siendo el lenguaje de los materiales de aulas dentro de `modo=aulas`;
- los PDF conservan la estética Pulso navy: el acento vive en la UI, no en el papel.

**Color de módulo: tono nuevo.** Se libera `#106E8C` y se modifica `dec-acento-collectors-aa` de
`branding/direccion-creativa-v3.md`. El espectro sigue siendo de ocho acentos. Hueco libre: verde, tono OKLCH 115 a
150°. Candidatos medidos (4.5:1 sobre blanco, croma ≤ 0.12, separación holgada):

| Candidato | Hex | OKLCH (L · C · H) | Contraste sobre blanco | ΔE76 al vecino más cercano |
|---|---|---|---|---|
| Oliva | `#647119` | 0.520 · 0.110 · 118° | 5.36 | Bitácora 38.0 · Procesamiento 48.8 |
| **Musgo** (elegido) | `#4F752C` | 0.516 · 0.111 · 132° | 5.37 | Procesamiento 38.7 · Bitácora 49.9 |
| Helecho | `#3A783E` | 0.516 · 0.110 · 145° | 5.34 | Procesamiento 29.5 · Bitácora 59.7 |

El petróleo actual estaba a ΔE 25.0 de Procesamiento; los tres se separan más. **Gonzalo eligió Musgo `#4F752C` el
2026-10-16**: equilibra sus dos vecinos más cercanos y es el que menos se confunde con un estado de éxito.

**El ícono queda bloqueado hasta que Gonzalo elija.** Se descartan `ClipboardList` (ya es el de Bitácora) y los íconos
de archivo (`Files`, `FileStack`), que chocan con el `FilePen` de Formularios. Candidatos, vía el shim de lucide:
`Backpack` (lo que el equipo se lleva a campo; recomendado), `Stamp`, `PackageOpen`, `Layers2`, `Tickets` y `Printer`.
Reemplaza a `IconCollector = QrCode` en `frontend/src/lib/icons.ts`; el QR sigue como ícono de la sección Accesos. Tokens: `--pulso-module-fieldkit`, `-soft`, `-border`; `--pulso-module-collectors` queda como alias
deprecado en los tres lugares que lo definen (`frontend/src/app/tokens.css`, `frontend/src/app/boot.css`,
`branding/identity/tokens.css`) hasta retirar sus consumidores.

### 8. Etapas, cada una entregable sola

| Etapa | Contenido | Depende de |
|---|---|---|
| E0a | Renombre de módulo y ruta, modos y secciones en `modules.ts` y `App.tsx`, componente de redirección con query, migración del slug persistido, `active_stage` de Hojas de ruta, cards del home, contratos de navegación. Sin color nuevo | aceptación |
| E0b | Token Musgo `#4F752C` con su alias, ícono, `branding/` | E0a, ícono elegido |
| E1 | Catálogo, `compatible_unit_types`, bindings por `unit_type`, dos registros de adapters, `collection_state/v2`, deriva de 9 a 13 bloques, presets ocultos expuestos. Revamp «pliego de imprenta» con geometría congelada antes | E0a |
| E2 | `ump_territorial_v1` y salidas de Hojas de ruta envueltas como layout legacy con paridad visual | E1 |
| E3 | Bloques `quota_grid`, `unit_map`, `place_checklist`, `route_instructions`; port de la ficha de manzana; retiro del layout legacy; retiro de `hojas_ruta_generar_zip` (`@export`, roxygenise, test) con doble confirmación | E2 |
| E4 | `fichas_cuota_v1`, hojas comunes, alerta en lugar del `next` de Monitoreo, validación por celda y por eje fijado, golden de Ser Adolescente | E3 y ADR del modo `cuotas` de Hojas de ruta |
| E5 (opcional) | Seguimiento por ficha desde la misma lista de unidades | Monitoreo |

## Consecuencias

Beneficios:

- un solo motor de fichas para todos los campos; el de Hojas de ruta deja de crecer;
- la lista de unidades y su meta alimentan material y seguimiento con un solo grano;
- un estudio nuevo agrega una fuente o un tipo de material, no un script fuera de la app;
- el nombre describe el trabajo y el modo describe el campo.

Costos y riesgos:

- migración en lectura del slug persistido y de `active_stage`; `collection_state/v2` con su migración;
- consumidores del slug que hay que tocar: `project_pulso.R:2464`, `router_diseno_estudio.R:463`,
  `bitacora_fases.R:49,108`, `features/bitacora/logbook/gramatica.ts`, `ProjectModulesContext.tsx`, `api/overview.ts`,
  `ModuleWarmupBoundary.tsx`, `warmupRegistry.ts`, `Layout.tsx`;
- `RecopiladoresPage.tsx` y `HojasRutaPage.tsx` están congelados: renombrar o mover conserva su línea base en
  `agentic/manifest.json`;
- la publicación a Drive (`collection_drive.R`) sigue usando el token de Google compartido con Monitoreo, fuera del
  `.pulso` (ADR 0005); la carpeta «Fichas QR - <estudio>» de proyectos existentes no se renombra;
- el layout legacy de E2 es deuda deliberada con retiro en E3;
- seis bloques nuevos amplían el compilador y su riesgo de overflow;
- cambiar el color mueve `branding/` y todo componente que lea `--pulso-module-collectors`.

Alternativas descartadas:

- **Renombrar sin generalizar**: deja dos motores y la unidad atada al aula.
- **Dejar las fichas en Hojas de ruta**: el motor está congelado y no comparte nada con el registro.
- **Tipos de campo como filtro y no como modo**: obligaría a Accesos a aparecer y desaparecer dentro de una sección.
- **Mover Cuotas, Titulares y Reemplazos a Muestra**: invierte la dependencia, porque salen de Manzanas.
- **Copiar la meta a la unidad**: crea dos autoridades de la cuota.
- **Editor libre tipo Canva o Acrobat**: ya descartado por ADR 0046 §11.
- **Mover los accesos a Formularios**: los accesos se arman por unidad, no por instrumento.
- **«Preparación de campo»** como nombre: aprobado antes en la sesión de Ser Adolescente y reemplazado el 2026-10-16.

## Cumplimiento

- Round-trip `.pulso` con `project_modules` que contiene `recopiladores`, entradas de bitácora `module_id=recopiladores`,
  `active_stage=entrega` y `collection_state/v1`: nada se pierde ni se reasigna.
- Cada dirección vieja, con y sin pestaña, aterriza en la nueva sin perder la query; ningún consumidor escribe una vieja
  (`destinoDeLosAtajos.contract.test.ts`).
- `modosCoverage` actualizado; `auditReadyRoutes`, `uiQuickCheckNavigation`, `modulesNavigation` y `vaults-check` en
  verde con `## Gobierna` actualizado en el 0046 y el 0108.
- `ump_territorial_v1` y Monitoreo territorial leen la misma muestra (fingerprint igual); el ZIP no acepta `sample` del
  cliente.
- Un binding de otro `unit_type` se rechaza; un source adapter y un provider adapter no se cruzan.
- Códigos `E_*` nuevos (tipo de unidad no compatible, fuente ausente) registrados en `errors_registry.R`.
- Paridad visual de las salidas de Hojas de ruta entre el motor actual y el layout legacy (PNG por página).
- Lo impreso por `quota_grid` y lo que valida Monitoreo tienen el mismo grano (test de paridad); una unidad sin meta
  alerta.
- Casos límite con test: meta cero, eje ausente, celda con exceso, encuesta con eje fijado distinto al de su ficha,
  lugar fuera de lista, tope alcanzado con fichas abiertas, reemplazo no activado, colisión de llaves al normalizar «UMP»
  entre fichas y manzanas (`monitoreo_router_ump.R:20-22`).
- Ningún tipo de ficha nuevo se agrega en `hojas_ruta_engine.R`; las líneas base de congelados se conservan
  (`node agentic/sync-agentic-os.mjs --audit`).
- Ningún token en `state.rds`.
- El acento elegido cumple 4.5:1 sobre blanco y croma ≤ 0.12.
- Golden de Ser Adolescente (E4): la suma de fichas cuadra con la lámina por sede × celda (50 en Lima; 38 urbano y 12
  periurbano en regiones); 19 urbanas y 6 periurbanas por sede regional; rangos de encuesta contiguos 1 a 1.000 sin
  huecos ni solapes; Lima sin eje de nacimiento.

## Notas

Direcciones propuestas (no existen todavía en `frontend/src/lib/modules.ts`; pasan a `## Gobierna` cuando el ADR se
acepte y E0a las cree): `material-campo`, `material-campo/unidades`, `material-campo/accesos`,
`material-campo/catalogo`, `material-campo/paquetes`, `material-campo/entrega`, `hojas-ruta/seleccion`.

Supuestos documentados: el esquema de 2024 de Ser Adolescente se repite en la lista de centros poblados, no hay
evidencia de fichas de cuota en 2024; en Lima, «se controla en el análisis» no implica ponderación (por confirmar); la
definición de periurbano es del estudio, no de la app.

Relacionado con [ADR 0005](0005-secretos-fuera-del-proyecto.md),
[ADR 0043](0043-proyectos-de-referencia-reales-anonimizados.md),
[ADR 0086](0086-el-eje-de-cuotas-lo-declara-el-estudio.md) y la dirección creativa v3 (`branding/`).
