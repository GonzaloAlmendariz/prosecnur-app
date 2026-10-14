# ADR 0101 — La campaña complementaria se declara en el instrumento, no se importa como otro formulario

- **Estado**: Aceptado — ratificado por Gonzalo (2026-10-14: «Acepto el ADR 0101»); dirección pedida por Gonzalo (2026-10-14): «debe ser algo que el analista declare o tenga oportunidad de hacerlo, como agregar una campaña complementaria dentro de la ya existente»
- **Ámbito**: Formularios (editor XLSForm) → Procesamiento › Carga
- **Fecha**: 2026-10-14
- **Relación**: escribe el campo `source$variants` que el [ADR 0040](0040-flujo-acreditacion-formularios-monitoreo-procesamiento-ppt.md) ya definía y que nadie producía; empareja con la regla del [ADR 0099](0099-las-fuentes-de-una-base-se-emparejan-por-pregunta.md). Checklist: `docs/qa/checklist-importacion-sm-arte-2026-10-14.md` (H2, U12, U13).

## Contexto

Un estudio suele aplicar el mismo instrumento por más de una encuesta SurveyMonkey: una campaña adicional por correo, un canal telefónico, una versión personalizada. Las encuestas hermanas difieren en poco. En Arte y Diseño 2026, la campaña por correo de Estudiantes (423593924) es el instrumento principal (528294775) sin «¿Cuál es su código PUCP?»: el correo ya identifica a la persona.

Hoy el editor sólo sabe importar esa encuesta como **otro formulario**:

- el traductor nombra por posición, así que desde la pregunta que falta todo se corre (`p5` → `p4`, `p13_1` → `p12_1`): la misma pregunta tiene dos nombres;
- ocupa un espacio del límite de seis formularios por proyecto;
- no aparece ningún aviso de que ya existe un formulario casi idéntico (26 de 27 preguntas iguales);
- Carga no sabe que las dos encuestas son un solo instrumento.

Dos piezas ya existen y no se tocan:

1. **El contrato para declararlo** (ADR 0040): la fuente de un formulario admite `variants`, otros `survey_id` con su mapa `variant_map_draft`, que «Confirmar lógica» sella contra el `content_sha256` del borrador, que reimportar devuelve a pendiente y que publicar exige confirmado y vigente. Carga de acreditación lo consume (`carga_acreditacion_mapping.R`). **Ningún código lo escribe.**
2. **La armonización de la data** (ADR 0099): una base de Carga junta varias encuestas, las empareja por pregunta y deja vacío lo que una fuente no trae.

## Decisión

1. **Una campaña complementaria es una variante del instrumento, no un formulario.** El analista la declara dentro del formulario principal. El XLSForm no cambia: rige el principal. Lo que cambia es la procedencia, que registra que la data de ese instrumento puede venir de la encuesta principal, de la campaña o de ambas.
2. **El emparejado es automático, con la regla del ADR 0099, y el analista revisa el conjunto.** Se usa `.sm_mb_alinear_fuente` sobre el XLSForm del formulario principal (el que rige) y el XLSForm que la plataforma genera para la campaña: clave exacta etiqueta + firma de escala + ordinal, sin posición ni similitud, lo ambiguo no se empareja. El analista ve cuántas preguntas calzan, cuáles del instrumento quedarán vacías para la campaña, cuáles de la campaña no entran y cuáles son ambiguas, y confirma la declaración entera con un clic. No hay confirmación pregunta por pregunta.
3. **Una campaña que calza menos del 80 % no es una campaña** (`.SM_MB_COBERTURA_MINIMA`): se bloquea con la indicación de importarla como formulario propio y relacionarla en Equivalencias (ADR 0062).
4. **El servidor recalcula; no confía en el cliente.** Declarar vuelve a traer la definición de la campaña y a emparejar. La vista previa y la declaración comparten el cálculo.
5. **La declaración queda confirmada y sellada al contenido actual.** Declarar es la revisión del analista: la variante nace `review_status = "confirmed"` con `logic_review = {content_sha256, definition_sha256}` del momento. Si después el borrador cambia, el bloqueo existente `logic_variant_confirmation_stale` pide confirmar de nuevo, y «Confirmar lógica» vuelve a sellar todas las variantes (comportamiento actual de `xlsform_forms_confirm_logic`).
6. **El editor ofrece la declaración en dos puertas**:
   - el menú de la tarjeta del formulario: «Agregar campaña complementaria…»;
   - al importar: si la encuesta elegida calza ≥ 80 % con un formulario SurveyMonkey ya existente, el diálogo pregunta si es una campaña de ese formulario antes de crear uno nuevo.
7. **Carga ofrece las campañas declaradas** al cargar la base de ese instrumento (tanda 2, fuera de este corte). Que una campaña aporte cero respuestas es normal y no un error: la data puede venir sólo de la principal.

### Forma persistida

Cada campaña es un elemento de `s$xlsform_forms[[id]]$source$variants`:

```r
list(
  schema = "survey_campaign/v1",
  rol = "campana_complementaria",
  survey_id = "423593924",
  survey_title = "Acreditación Arte y Diseño PUCP a Estudiantes",
  definition_sha256 = "<huella de la definición de la campaña, mismo cálculo que la principal>",
  translation_profile = "surveymonkey_api_xlsform/v1",
  variant_map_draft = list(list(from = "p4", to = "p5"), ...),   # pregunta madre de la campaña -> del instrumento
  mapa_variables = list(p4 = "p5", p12_1 = "p13_1", ...),       # variable a variable (ADR 0099)
  n_emparejadas = 73L, n_preguntas_base = 74L, cobertura = 0.986,
  sin_par_base = list(list(variable = "p4", etiqueta = "¿Cuál es su código PUCP?")),
  sin_par_fuente = list(), ambiguas = list(),
  declarada_en = "2026-10-14T...Z",
  review_status = "confirmed",
  logic_confirmed_at = "...", logic_confirmation_method = "campaign_declaration",
  logic_review = list(content_sha256 = "...", definition_sha256 = "...")
)
```

`variant_map_draft` mantiene la forma que ya lee `carga_acreditacion_mapping.R` (pregunta madre `p<N>`; las filas de matriz se resuelven por su etiqueta). Si las filas de una misma pregunta madre apuntan a madres distintas, la madre no entra al mapa y la campaña se declara con ese aviso.

### Contrato HTTP

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/xlsform-editor/forms/<id>/campanas/vista-previa` | `{survey_id}` | `{ok, survey_id, titulo, n_emparejadas, n_preguntas_base, cobertura, cobertura_texto, instrumento_distinto, faltan:[{variable, etiqueta}], extra:[{variable, etiqueta}], ambiguas:[{variable, etiqueta}]}` |
| `POST /api/xlsform-editor/forms/<id>/campanas` | `{survey_id}` | `{ok, form: <entrada del formulario>, campana: <variante guardada>}` |
| `DELETE /api/xlsform-editor/forms/<id>/campanas/<survey_id>` | — | `{ok, form}` |
| `POST /api/xlsform-editor/campanas/sugerir` | `{survey_id}` | `{ok, sugerencia: null \| {form_id, form_name, survey_id_principal, cobertura, cobertura_texto, n_emparejadas, n_preguntas_base}}` |

Errores (`stop_api`): `E_FORM_NOT_FOUND` (404), `E_CAMPANA_NO_ENCONTRADA` (404, al quitar), `E_CAMPANA_SIN_PRINCIPAL` (409: el formulario no viene de SurveyMonkey), `E_CAMPANA_ES_PRINCIPAL` (409), `E_CAMPANA_REPETIDA` (409), `E_CAMPANA_OTRO_INSTRUMENTO` (409), `E_SM_API_FAILED` (400).

## Consecuencias

- Una campaña deja de duplicar el instrumento y de gastar un espacio del límite.
- La procedencia dice, antes de que exista data, de qué encuestas puede venir cada instrumento; Carga lo puede ofrecer sin que el analista lo recuerde.
- Se reusa la regla de emparejado de Carga: lo que el editor declara y lo que Carga junta se leen con una sola regla.
- Una campaña que cambia en SurveyMonkey después de declararla deja su `definition_sha256` viejo; detectarlo y pedir revisarla queda para cuando Carga la consuma (tanda 2).
