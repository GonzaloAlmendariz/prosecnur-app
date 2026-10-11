# ADR 0094 — Las fuentes de una base se emparejan por pregunta, con la clave de las equivalencias

- **Estado**: Propuesto — pendiente de revisión de `guardian-contratos` y `revisor-metodologico`
- **Ámbito**: Procesamiento › Carga — bases SurveyMonkey que juntan varias encuestas (fuentes adicionales,
  «Agregar a <base>», refresh multi-fuente, snapshot crudo regenerado)
- **Fecha**: 2026-10-11
- **Relación**: aplica la regla de emparejado de [ADR 0062](0062-matriz-de-equivalencias-entre-publicos.md)
  (clave exacta etiqueta + firma de escala + ordinal; nunca posición ni similitud) a las fuentes de UNA base.
  Checklist: `docs/qa/checklist-codificacion-sm-2026-10-11.md` (ítem 13).

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
6. El resultado se guarda en la base (`sm_alineacion_fuentes`) y se muestra en el diagnóstico del refresh y
   en Carga › Revisión. La clave es la misma que usa Equivalencias, así que lo que se juntó en una base y lo
   que se compara entre bases se lee con una sola regla.

## Consecuencias

- Las bases multi-fuente existentes no cambian hasta su siguiente refresh o regeneración; ese refresh puede
  mover respuestas a la variable correcta. Se declara en el diagnóstico como «preguntas en otro orden».
- Redacciones distintas entre canales («¿Cuántos años tiene?» frente a una variante telefónica) quedan sin
  par. Si son la misma pregunta, la vía es base separada + Equivalencias, que es donde se declara una
  equivalencia; la fuente adicional no la infiere.
- El modo «Unificar bases compatibles» (instrumento guía con reconciliación propia) queda fuera de este ADR.
- Pendiente: el conteo de filas nuevas del plan de refresh (`.sm_mb_fetch_filtered_response_refs`) sigue
  filtrando el consentimiento de cada fuente por la posición de la variable; afecta al conteo, no a la data.
- Límite de la clave: dos matrices con las mismas filas y la misma escala solo se distinguen por el ordinal;
  si una fuente las trae en orden invertido, se emparejan cruzadas.
