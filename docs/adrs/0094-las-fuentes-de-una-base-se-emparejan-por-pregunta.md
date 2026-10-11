# ADR 0094 — Las fuentes de una base se emparejan por pregunta, con la clave de las equivalencias

- **Estado**: Propuesto — pendiente de revisión de `guardian-contratos` y `revisor-metodologico`
- **Ámbito**: Procesamiento › Carga — bases SurveyMonkey que juntan varias encuestas (fuentes adicionales,
  «Agregar a <base>», refresh multi-fuente, snapshot crudo regenerado)
- **Fecha**: 2026-10-11
- **Relación**: aplica la regla de emparejado de [ADR 0062](0062-matriz-de-equivalencias-entre-publicos.md)
  (clave exacta etiqueta + firma de escala + ordinal; nunca posición ni similitud) a las fuentes de UNA base.
  Checklist: `docs/qa/checklist-codificacion-sm-2026-10-11.md` (ítem 13).
  Nota: la firma de escala de Equivalencias compara el código LITERAL, así que dos públicos cuyas listas
  tienen órdenes distintos no calzan entre sí; es correcto (un 1 contra un 2 cambia lo que la barra
  significa) y es la razón de calcular la clave de las fuentes sobre el XLSForm generado.

## Contexto

Una base SurveyMonkey puede juntar varias encuestas: los canales de un mismo público (Egresados
Personalizado, Telefónico y web) o campañas sucesivas. El motor canónico
(`sm_multibase_api_responses_to_canonical_data`) asignaba cada pregunta de la fuente a la variable
`p<posición>` del instrumento de la base. Las encuestas hermanas no tienen la misma posición para la misma
pregunta: en Acreditación Contabilidad las versiones «Personalizado» llevan «Indique su código PUCP» en la
posición 3, y desde ahí toda la numeración se corre.

Medido con los datos reales (2026-10-11), juntando Egresados Telefónico a Egresados Personalizado:

- la columna «¿Cuántos años tiene?» recibía los códigos de género;
- «¿Cuál es su género?» recibía los años de egreso, incluido un `2015` crudo que no es una opción de la
  lista (`.sm_mb_code_for_label` devolvía el código de la fuente cuando la etiqueta no calzaba);
- ningún aviso. La auditoría de estructura también compara posición contra posición: bloqueó este caso por
  casualidad (cambia la familia de pregunta en la posición corrida), y dejaría pasar una inserción entre
  preguntas de igual familia y escala. El import independiente con varias fuentes no compara nada.

## Decisión

1. **Una fuente se empareja con la base pregunta por pregunta, con la clave de las equivalencias**
   (`.equiv_claves_de_base`: etiqueta normalizada @@ firma de escala ## ordinal), calculada sobre el
   XLSForm que la plataforma genera para cada encuesta. Sin posición, sin similitud aproximada.
2. **Cada fuente se codifica contra su propio instrumento** y después se renombra a las variables de la
   base y se recodifica por etiqueta a los códigos de la base (que pueden haber adoptado el orden del
   editor). Ninguna respuesta se escribe en una variable cuya pregunta no es la suya.
3. **Lo que no tiene par no se adivina, se declara**:
   - pregunta de la fuente sin par en la base → no entra a la base y queda listada;
   - pregunta de la base sin par en la fuente → vacía para las filas de esa fuente, listada.
   Ambas son avisos visibles, no bloqueos: no corrompen nada.
4. **Si la fuente calza menos del 80 % de las preguntas de la base, es otro instrumento** y se bloquea con
   la indicación de importarla como base separada y relacionarla en la pestaña Equivalencias (ADR 0062).
   Juntar dos instrumentos en una base no es lo que una fuente adicional promete.
5. **Una opción que no existe en la lista de la variable no se convierte en un código**: queda vacía y se
   cuenta. Devolver el código de otra lista era la mitad silenciosa del defecto.
6. **Misma función de clave que Equivalencias, aplicada sin confirmación.** Las fuentes usan
   `.equiv_claves_de_base`, pero la calculan sobre los XLSForm generados por la plataforma y sin los `_other`
   (que siguen a su pregunta). Equivalencias sugiere y el analista confirma; aquí nadie confirma, así que la
   regla es más estricta: si una clave (sin su ordinal) aparece un número distinto de veces en la base y en
   la fuente —p. ej. la fuente omitió la batería «¿Conoce?» y conserva «¿Ha utilizado?», mismas filas y
   escala—, es **ambigua**: ninguno de sus miembros se empareja ni cuenta como emparejado. El resultado se
   guarda en la base y se muestra en el diagnóstico del refresh y en Carga › Revisión: lo que se juntó en una
   base y lo que se compara entre bases se lee con una sola regla.
7. **El orden de opciones de una base se fija al importarla y cada refresh reaplica el orden GUARDADO, no el
   del editor del momento.** Todo import SurveyMonkey por API (base única, bases separadas, import
   independiente; el integrado queda fuera) adopta el orden del editor y guarda la receta en la base. El
   refresh y la regeneración del snapshot reaplican esa receta por etiqueta contra el XLSForm recién
   generado. Sin receta (base anterior o sin mapas) el refresh no adopta nada: quedan los códigos de la
   plataforma. Si el editor pide hoy otro orden, no se recodifica: se declara `editor_distinto` y Revisión
   avisa.
8. **El consentimiento de cada fuente se evalúa en su propio instrumento, antes de alinear.** Si la
   variable de consentimiento de la base no recibe nada de la fuente, sus filas no se descartan como si no
   hubieran consentido: la fuente se declara con `consentimiento_sin_par`.

### Forma persistida

- `sm_alineacion_fuentes` (por fuente distinta de la principal): `survey_id`, `titulo`, `n_emparejadas`,
  `n_preguntas_base`, `cobertura`, `reordenada`, `instrumento_distinto`, `excluida`, `n_filas_excluidas`,
  `n_filas_incorporadas`, `consentimiento_sin_par`, `n_excluidas_consentimiento`, `sin_par_fuente`,
  `sin_par_base`, `ambiguas` (`[{variable, etiqueta}]`) y `opciones_sin_par` (`[{variable, n}]`).
- `sm_opciones_sin_par_principal`: `[{variable, n}]` de la encuesta principal.
- `choice_order_editor$receta`: `[{variable, list_name, opciones: [{etiqueta normalizada, codigo}]}]`, más
  `editor_distinto` y `editor_distinto_variables` cuando el editor difiere.
- El umbral vive en `.SM_MB_COBERTURA_MINIMA` (0.8, `surveymonkey_multibase_alineacion.R`) y cuenta
  VARIABLES, no preguntas: una matriz de 11 filas pesa 11.
- Se escriben solo cuando la data de la base cambia (`data_file_id` nuevo) y dentro del bloque con
  rollback. Con `keep_current` (la base conserva su data adaptada) el refresh no los sobrescribe: siguen
  describiendo la data vigente.

## Consecuencias

- Las bases multi-fuente existentes (armadas por posición, sin `sm_alineacion_fuentes`) no cambian solas:
  su refresh queda bloqueado con `legacy_positional`, porque sumarles filas alineadas las dejaría mezcladas.
  La ruta es regenerar la base desde el snapshot de SurveyMonkey, que realinea todas las filas y declara
  «preguntas en otro orden» donde corresponde.
- El comparador posicional (`.sm_mb_compare_to_ref_posicional`) sobrevive solo en «Unificar bases
  compatibles».
- Redacciones distintas entre canales («¿Cuántos años tiene?» frente a una variante telefónica) quedan sin
  par. Si son la misma pregunta, la vía es base separada + Equivalencias, que es donde se declara una
  equivalencia; la fuente adicional no la infiere.
- El modo «Unificar bases compatibles» (instrumento guía con reconciliación propia) queda fuera de este ADR.
- Pendiente: el conteo de filas nuevas del plan de refresh (`.sm_mb_fetch_filtered_response_refs`) sigue
  filtrando el consentimiento de cada fuente por la posición de la variable; afecta al conteo, no a la data.
- Límite de la clave: dos matrices con las mismas filas y la misma escala solo se distinguen por el ordinal;
  si una fuente las trae en orden invertido, se emparejan cruzadas.

## Cumplimiento

- Motor: `api/R/surveymonkey_multibase_alineacion.R` (alineación, codificación de fuentes, persistencia,
  comparador y bloqueos del refresh) y `api/R/carga_sm_orden_editor.R` (receta del orden).
- Tests: `test-surveymonkey-multibase-alineacion.R`, `test-surveymonkey-multibase-alineacion-persistencia.R`
  y `test-carga-sm-orden-editor.R`; gate `make gate-area AREA=carga`.
- Contrato de forma: `docs/qa/checklist-codificacion-sm-2026-10-11.md`, «Contrato congelado del ítem 13».

## Notas

- Preexistente, fuera de este ADR: `.sm_mb_consent_yes` toma «1» como sí; si el editor reordena la lista del
  consentimiento, la encuesta principal descarta a quien consintió (checklist, ítem 14).
