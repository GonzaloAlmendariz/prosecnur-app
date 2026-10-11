# Checklist — Códigos de respuesta en imports SurveyMonkey por API (2026-10-11)

Tipo: Checklist
Estado: Abierto
Origen: traspaso `docs/qa/traspaso-codificacion-surveymonkey-2026-10-11.md` (rama `meta-b-revamp`)
y revisión metodológica sobre `main` (`88ea0a8c9`, PR #10). Estudio en campo:
Acreditación Arte y Diseño PUCP (Docentes, Administrativos, Estudiantes).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Llevar N4 (mapas solo de la misma encuesta) y «bases separadas» a `main` | `carga_platform_separate.R`, `router_carga.R` | Hecho antes de esta sesión: PR #10 (`88ea0a8c9`) ya los trae |
| 2 | Triple aplicación de mapas en base única (preview y `rp_data` invertidos) | `.carga_codigos_ya_aplicados` (`router_carga.R`), `project_pulso.R` | Hecho en PR #10; test l.906/l.923 de `test-carga-platform-jobs.R` |
| 3 | Gate de Carga sobre `main` | `make gate-area AREA=carga …` | Verde: 1491 pass, 0 fallos (janitor instalado) |
| 4 | **H2**: los mapas del editor se aplican contra el instrumento generado y no contra el del editor; una pregunta reordenada queda con la etiqueta equivocada | `.carga_sm_prepare_import` | En curso: el instrumento generado adopta códigos y orden del editor por etiqueta, sin recodificar después |
| 5 | **H3**: `select_multiple` no recibe el reordenamiento (libros de códigos distintos en la misma base) | ídem | En curso: cubierto por el mismo arreglo (codificación por etiqueta) |
| 6 | **H1**: la confirmación de Carga › Revisión quedó sin efecto tras PR #10 | `carga_review.R`, `CargaPage.tsx` | Se resuelve por diseño si el import ya no recodifica (nada que confirmar); verificar |
| 7 | **H4**: la marca no registra qué mapas se aplicaron | metadata de la base | Pendiente: registrar las listas adoptadas del editor en la base |
| 8 | **H5**: handoff de Monitoreo hereda mapas sin procedencia | `carga_monitoreo_handoff_general.R:378/452` | Pendiente (baja, no toca SM) |
| 9 | Prueba de punta a punta con las tres encuestas reales | script local, fuera del repo | Hecho para A/B/C (ver informe); repetir tras el arreglo |
| 10 | Usar el formulario del editor (con su lógica) como instrumento de la base | contrato de instrumento | Bloqueado: requiere decisión/ADR |

## Aprendido

- Los mapas de códigos nacieron para el import por `.sav` (SM exporta códigos por posición).
  En el import por API las respuestas se codifican por **etiqueta** contra el instrumento
  (`.sm_mb_code_for_label`), así que recodificar después con mapas solo puede desalinear.
- El reordenamiento manual del editor existe porque la API devolvía «Otro»/«Ninguna» en un
  orden distinto al del constructor y la lógica por posición fallaba (Gonzalo, 2026-10-11).
- Prueba real sin mapas: Docentes 91/91, Administrativos 30/30 y Estudiantes 72/72 variables
  coinciden con el conteo crudo de SM en archivo, preview, base `default`, Ver base, Analítica
  y reapertura. Las únicas diferencias de Estudiantes se explican: «Otro» con texto
  (7/19/15) y una respuesta sin consentimiento filtrada a propósito.
