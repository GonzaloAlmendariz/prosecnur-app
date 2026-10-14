# ADR 0102 — La base nace del formulario publicado: primero el instrumento, después los datos

- **Estado**: Aceptado — pedido y aprobado por Gonzalo (2026-10-14: «a pesar de que tengamos instrumentos publicados, estos no pueden ser utilizados en procesamiento… es un tema muy importante»; «Sí, con las tres fuentes»)
- **Ámbito**: Procesamiento › Carga (Fuentes) ← Formularios (revisiones publicadas)
- **Fecha**: 2026-10-14
- **Relación**: extiende el [ADR 0040](0040-flujo-acreditacion-formularios-monitoreo-procesamiento-ppt.md) (revisión publicada como instrumento de una base) a cualquier proyecto, no sólo acreditación multiactor; usa el emparejado por pregunta del [ADR 0099](0099-las-fuentes-de-una-base-se-emparejan-por-pregunta.md) y las campañas del [ADR 0101](0101-la-campana-complementaria-se-declara-en-el-instrumento.md); la base de un formulario con lógica declarada fuera entra como base de partida declarada ([ADR 0100](0100-la-base-limpiada-fuera-entra-declarada-y-la-codificacion-depende-del-texto.md)). Checklist: `docs/qa/checklist-importacion-sm-arte-2026-10-14.md`.

## Contexto

Probado de punta a punta con Arte y Diseño 2026: tres formularios importados desde SurveyMonkey, editados (escalas unificadas, nombres comunes entre formularios, salto del consentimiento) y publicados. En Carga, ninguna vía los usa:

- el enlace base↔revisión (`instrument_revision_binding.R`) es por hash exacto del XLSForm cargado, y es correcto que sea conservador;
- pero toda vía de Carga trae su propio XLSForm: SurveyMonkey lo genera desde la encuesta, un `.sav` trae el suyo, un Excel el que se suba. Nunca coincide con la revisión editada, así que la base queda con `instrument_revision_id` vacío;
- la única vía que elige una revisión publicada es la de acreditación multiactor dentro de Monitoreo (`ProcessingIntakePanel`), visible sólo con perfil `multi_actor`.

Resultado: en cualquier otro proyecto publicar no tiene efecto en Procesamiento, y el trabajo hecho en Formularios se pierde al cargar datos. Además, el caso más frecuente —el analista ya limpió en SPSS— trae un `.sav` del export de SurveyMonkey con nombres `q0010_0001` y códigos por posición («SIN INF» = 5), distinto del instrumento publicado (`p10_1`, «SIN INF» = 99).

## Decisión

1. **Se invierte el orden: primero se elige el instrumento, después se traen los datos.** Carga › Agregar base ofrece en primer lugar «Usar un formulario publicado». La base se crea con el XLSForm de esa revisión (`revision$xlsform_file_id`) y queda ligada a ella desde el inicio (`instrument_revision_id`, estado `matched` del binding). No hay coincidencia por hash que adivinar: lo eligió el analista.
2. **Tres fuentes de respuestas para ese instrumento**, todas llevadas a SUS variables y SUS códigos:
   - **SurveyMonkey por API**: la encuesta principal de la revisión (`source$survey_id`) y, si el analista lo marca, sus campañas complementarias declaradas (`source$variants` con `rol = campana_complementaria`). Cada encuesta se empareja por pregunta contra el instrumento (`.sm_mb_codificar_fuente`, ADR 0099) y sus filas se suman con su canal; una campaña con 0 respuestas aporta 0 filas, sin error.
   - **`.sav`**: el export SPSS de SurveyMonkey o uno limpiado en SPSS. Los nombres se traducen al instrumento (`q0010_0001` → `p10_1`, con el remapeo del traductor SM para esa encuesta cuando la revisión viene de SurveyMonkey; si no, por nombre igual o etiqueta de variable) y los valores se recodifican **por etiqueta** contra las opciones del instrumento («SIN INF» 5 → 99). Nunca por posición.
   - **Excel** (`.xlsx`/`.csv`) con columnas del instrumento: se normaliza contra él (`normalize_data_for_xlsform`).
3. **Lo que no calza se declara, no se adivina** (ADR 0099): variables de la fuente sin par (no entran, listadas), variables del instrumento sin par (vacías, listadas), etiquetas de opción sin par (quedan vacías y se cuentan por variable). La vista previa lo muestra antes de crear la base; si menos del 80 % de las variables del instrumento calzan, se bloquea («esa base no es de este formulario»).
4. **Lógica declarada fuera** (formulario con `logic_status = external_declared`): la base entra como **base de partida declarada** (ADR 0100), registrando herramienta y que Validación/Limpieza se hicieron fuera; Procesamiento no aplica reglas de salto ni de limpieza sobre ella y permite ir directo a Gráficos.
5. **No reemplaza las vías existentes**: SurveyMonkey/Kobo/Archivos/`.sav` sin formulario siguen como están para quien no publica en Formularios.

## Contrato HTTP

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/carga/formularios-publicados` | — | `{ok, formularios: [{form_id, form_name, revision_id, revision_no, published_at, survey_id, campanas: [{survey_id, titulo}], logic_status, logic_external, n_campos}]}` (última revisión publicada de cada formulario) |
| `POST /api/carga/formulario-publicado/vista-previa` | `{revision_id, fuente: "surveymonkey"\|"sav"\|"excel", file_id?, incluir_campanas?}` | `{ok, n_filas, fuentes: [{tipo, titulo, survey_id?, n_filas}], n_emparejadas, n_variables_instrumento, cobertura, cobertura_texto, sin_par_instrumento: [{variable, etiqueta}], sin_par_fuente: [{variable, etiqueta}], recodificaciones: [{variable, etiqueta, desde, hacia}], opciones_sin_par: [{variable, n}], bloqueo: null\|{codigo, mensaje}}` |
| `POST /api/carga/formulario-publicado/importar` | `{revision_id, base_name, fuente, file_id?, incluir_campanas?}` | `{ok, base_name, n_filas, n_columnas, instrument_revision_id, origen_declarado: bool}`; con `fuente = "surveymonkey"` corre como job (`carga_platform_jobs`, kind `carga.formulario_publicado_sm`) y devuelve `{job_id}` |

El `file_id` es el del archivo subido con el endpoint de subida existente de Carga (kind `sav`/`data`). Errores con `stop_api` y códigos `E_*` registrados: `E_REVISION_NOT_FOUND` (404), `E_FUENTE_NO_CALZA` (409, < 80 %), `E_BASE_EXISTE` (409), `E_SM_API_FAILED`, `E_SAV_READ_FAILED`.

## Consecuencias

- Publicar por fin tiene efecto en cualquier proyecto: Validación y Analítica leen los contratos de la revisión (`instrument_validation_contract`, `instrument_analysis_contract`).
- El trabajo de Formularios (escalas unificadas, nombres comunes entre públicos, saltos, campañas) llega a Procesamiento y a Gráficos.
- El caso del analista que limpió en SPSS queda cubierto sin rehacer nada en la app.
- Las campañas declaradas se consumen (cierra la tanda 2 del ADR 0101 para este camino).

## Cumplimiento

- `api/tests/testthat/test-carga-formulario-publicado.R`: las tres fuentes llevadas a variables y códigos de la revisión (recodificación por etiqueta, nunca por posición; etiquetas sin par contadas y nombradas), bloqueo bajo el 80 %, base ligada con `binding = matched`, `origen_externo` cuando la lógica se declaró fuera, campañas con 0 respuestas sin error y el token fuera del cuerpo del job.
- `frontend/src/api/cargaFormularioPublicado.test.ts` y `frontend/src/features/carga/fuentes/formularioPublicado*.test.ts(x)`: normalización defensiva del contrato, veredicto con umbral, rótulos de la tarjeta (formulario, revisión, programa declarado).
- Gates: `make gate-area AREA=carga GATE_ARGS='--patron "formulario-publicado|carga-platform-jobs"'` y `make gate-front AREA=carga`.

## Notas

- Verificado en vivo (2026-10-14) con Arte y Diseño 2026 › Estudiantes: `.sav` limpiado en SPSS (279 filas, 74/74, 63 recodificaciones, 18 respuestas con categorías creadas al recodificar «Otro» que el formulario no tiene) y SurveyMonkey por job (289 filas, 74/74, campaña con 0 filas).
- Pendiente: que Validación y Limpieza lean `origen_externo.logica_y_limpieza_fuera` (§4) y que la auditoría guardada en `formulario_publicado` sea visible después de crear la base.
