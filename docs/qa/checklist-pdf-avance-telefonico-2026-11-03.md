# Checklist: PDF de avance de campo, perfil telefónico (2026-11-03)

Pedido de Gonzalo: «Sí, corrígelo» (el PDF de avance del RMS 2026 salía con las
encuestas por periodo de llegada en 0 y el rótulo «dim_actor») y «los PDF de
monitoreo de acreditación y aulas han mejorado bastante, lo mismo podemos hacer
aquí». Destino inmediato: adjuntarlo al correo de cierre de campo a ACNUR.

Estudio de prueba: `RMS2026.pulso` sincronizado el 03/11/2026 (barrido de 1200
registros, 489 respuestas de Kobo).

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Las válidas por periodo salían en 0: la reconciliación del PDF reescribía las efectivas del motor (109 / 101 / 101 / 100) con el conteo de una columna `dim_actor` que en las respuestas de Kobo existe y está vacía | `.mtpdf_reconcile_response_counts` (`monitoreo_telefonico_report_pdf.R`) | Hecho: una columna que no trae ningún valor de la cuota se salta; regresión en `test-monitoreo-telefonico-pdf.R` |
| 2 | El rótulo de la dimensión decía «dim_actor» (columna interna) en vez de «Periodo de llegada» | modelo (`build_monitoreo_telefonico_report_model`, `.mtpdf_quota_labels`) | Hecho: la columna del barrido que dice lo mismo fila por fila; «Grupo» si ninguna calza |
| 3 | Reescribir el PDF como entregable de cliente en la familia Pulso PDF de aulas y acreditación: portada, resumen por grupo con conteo y porcentaje con su frecuencia, ritmo en serie partida, un panel por grupo, cobertura de la base y tabla diaria | motor nuevo `monitoreo_telefonico_avance_pdf.R`; el render viejo se retiró | Hecho: portada, resumen, ritmo, avance diario por grupo, cobertura con resultado de los contactados, tabla diaria. La portada toma los campos de Salidas (se habilitan para telefónico en `MonitoreoOutputsWorkbench.tsx`) |
| 4 | Corte en hora de Lima desde la sincronización, números sin separador de miles, fechas «3 de noviembre de 2026» | motor (helpers `.acav_*`) | Hecho |
| 5 | Conservar el vocabulario ya fijado para telefónico: «registros contactados», «no contactados», «resultado de los contactados», «contactos efectivos»; sin «cumplimiento», «de la meta», «mejor día», «margen», «sede», «territorial» | motor + `test-monitoreo-telefonico-pdf.R` | Hecho: el test conserva la lista prohibida y suma «dim_actor» |
| 6 | Encuestas válidas que no cruzan con ningún grupo del barrido (413 válidas, 411 con periodo) no se pierden en silencio | motor (asterisco en el total) | Hecho: «* Incluye 2 encuestas válidas sin periodo de llegada identificado» en el resumen y en la tabla diaria |
| 7 | Regenerar el PDF del RMS, revisarlo visualmente y adjuntarlo al borrador para Jorge Latorre | Gmail (borrador «RMS 2026: cierre de campo…») | Texto corregido; el PDF (`RMS2026_avance_campo_2026-11-03.pdf`, junto al `.pulso`) lo adjunta Gonzalo a mano |
| 8 | El diario contaba por `kobo_fecha_iso`, el día UTC del envío: una entrevista enviada después de las 19:00 de Lima caía al día siguiente (el RMS parecía seguir el 31/10 con 5 encuestas que eran del 30) y la tabla por grupo no cuadraba con el total del día | `.mtpdf_reconcile_response_counts` usa `.monitoreo_report_date_values` | Hecho: regresión en `test-monitoreo-telefonico-pdf.R`; el campo real fue del 23 al 30/10 (8 días) |
| 9 | En la serie partida, la cifra del último acumulado se montaba sobre el rótulo de la meta («413» sobre «Previstas 400») | kit `pulso_pdf_serie_partida` | Hecho: si choca con la caja del rótulo, va bajo el punto, como cuando la tacha la línea |
| 11 | El Total de «Faltan» se neteaba: el exceso de un grupo cubría la cuota de otro (52/50 y 41/50 daban 7, no 9). Hallazgo del verificador | motor (`total_faltan` suma por grupo) + test | Hecho en telefónico; acreditación conserva la convención neta (`monitoreo_acreditacion_avance_pdf.R:318`), sin tocar |
| 10 | En los paneles compactos la línea de lo previsto sale oscura y la leyenda la pinta roja (pasa igual en acreditación) | kit | Pendiente: no se tocó |

## Cifras del RMS 2026 en el PDF (corte 03/11/2026 12:21)

| Periodo de llegada | Previstas | Válidas |
|---|---|---|
| Actualidad | 100 | 109 |
| Pandemia | 100 | 101 |
| Post-pandemia | 100 | 101 |
| Pre visa humanitaria | 100 | 100 |
| Sin periodo identificado | — | 2 |
| Total | 400 | 413 |
