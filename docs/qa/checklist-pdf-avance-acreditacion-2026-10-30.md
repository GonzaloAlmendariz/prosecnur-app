# Checklist: PDF de avance de campo, perfil Acreditación (2026-10-30)

Tipo: Checklist de pedido con varias indicaciones
Estado: Vigente
Fecha: 2026-10-30
Autoridad: pedido del 2026-10-30 sobre el PDF de avance que se entrega a la DAA, con la corrección de Gonzalo del ítem 24

Pedido: llevar el PDF de avance que se entrega a la DAA de la PUCP
(Acreditación Institucional PUCP 2026) a un entregable profesional. El cliente
debe leer de un vistazo el avance total y por público, el ritmo, y la fecha y
hora del corte.

Corrección de Gonzalo a mitad de la sesión (ítem 24): en acreditación la cifra
de referencia por público es un **mínimo esperado**, no una meta, y al cliente le
interesa el progreso de cada público en conteo y porcentaje **sobre su total de
invitados**. El documento se reencuadró: el porcentaje que manda es el del
total; el mínimo esperado va al lado como referencia. Contrastado con la app en el mismo corte
(sincronización del 30/10/2026 a las 07:20, hora de Lima).

Motor: `api/R/monitoreo_acreditacion_avance_pdf.R` (nuevo; la versión anterior
era un cierre de 1004 líneas dentro de `monitoreo_engine.R`, que se retiró).
El modelo de datos no cambia: `monitoreo_acreditacion_client_report_model()`.

Línea base: 9 páginas (una de resumen con 4 de 6 públicos, seis de detalle por
público, una de avance general y una de «Corte y fuentes»).

| # | Defecto de la línea base | Dónde vive | Estado |
|---|---|---|---|
| 1 | Título genérico «Reporte de avance»; no nombra el estudio | motor (`pulso_pdf_header` + `.acav_nombre_estudio`) | Hecho: «Avance del trabajo de campo / Acreditación Institucional PUCP 2026» |
| 2 | El corte era la fecha de generación del PDF, sin hora ni zona | router (`.monitoreo_client_report_model_for_snapshot` pasa `synced_at`) + motor (`.acav_corte`) | Hecho: «30 de octubre de 2026, 07:20 (hora de Lima)» en banda de todas las páginas |
| 3 | La lectura principal no se veía: el porcentaje por público iba en anillos sin frecuencia y la referencia («Mínimo a alcanzar») en letra de 6 pt | motor | Hecho: «Avance sobre el total» (2.5%, 1148 de 45120) manda; «Mínimo esperado», «% del mínimo» y «Faltan para el mínimo» al lado (ver ítem 24) |
| 4 | Porcentajes sin frecuencia (anillos, barras, «3%», «96.3%») | motor (`.acav_pct_frec` y filas con «709 de 4542») | Hecho |
| 5 | Miles con coma (22,820; 1,148) | motor (`.acav_n`) | Hecho: punto decimal, sin separador de miles |
| 6 | Fechas en tres formatos («30 Oct 2026», «30 oct. 2026», «2026–10–30») | motor (`.acav_fecha_larga`, `.acav_fecha_corta`) | Hecho: «30 de octubre de 2026» y «30 oct.» |
| 7 | La primera página mostraba 4 de 6 públicos («+2 grupos adicionales en el detalle») | motor | Hecho: los seis en una tabla con fila de total |
| 8 | Botones «Ver detalle» y «Selecciona un grupo…» (texto de interfaz) | motor | Hecho: retirados |
| 9 | Vocabulario interno: actor, efectivas, rechazo, base reportada, grupo | motor | Hecho: público, encuestas completas, invitados, mínimo esperado, faltan |
| 10 | Página «Corte y fuentes» con texto interno («Fuente de verdad», «caso canónico», «XLSX/Sheet cliente e interno», «Apps Script viejo») | motor; tests en `test-monitoreo-publish-qa.R` y `test-monitoreo-engine.R` | Hecho: retirada; tests reescritos |
| 11 | Tabla de fuentes con nombres de encuesta truncados con «...» | motor | Hecho: tabla retirada (un solo canal por público; no informa al cliente) |
| 12 | Gráfico diario con dos ejes sin rotular y altura mínima falsa en barras | motor + kit (`pulso_pdf_serie_partida`) | Hecho: serie partida del kit, acumulado con el mínimo esperado arriba y completas por día abajo, un eje cada caja |
| 13 | «Canales y ritmo reciente» repetido seis veces con un solo canal; «Desde último informe» con dos significados | motor | Hecho: retirado; el ritmo vive en una página |
| 14 | La cifra total estaba en la página 8 de 9 | motor | Hecho: es lo primero de la página 1 |
| 15 | Nueve páginas casi vacías para seis públicos y dos días | motor | Hecho: portada y 4 páginas (resumen, ritmo, ritmo de cada público, completas por día y público); la última pagina sola si el campo se alarga |
| 16 | Cromo fuera del kit Pulso PDF (logo arriba, pie «Avance», fondo gris) | motor (`pulso_pdf_cromo` / `pulso_pdf_pie`) | Hecho: cromo con antetítulo y corte a la derecha, pie con periodo y folio «01 / 04» |
| 17 | Etiquetas de 4.4–5.2 pt dentro de barras de composición | motor | Hecho: escala `pulso_pdf_type("cliente")` |
| 18 | Sin lectura de ritmo (promedio, último día) | motor | Hecho: promedio por día sobre días completos, día en curso marcado como parcial |
| 19 | El día en curso se dibujaba como un día cerrado | motor (`ultimo_en_curso`) | Hecho: barra en tono claro y nota «hasta las 07:20» |
| 20 | Respuestas de prueba (sin token válido) | modelo (`monitoreo_acreditacion_client_report_model`, «Casos reconciliados») | Verificado: 1424 respuestas crudas, 1356 reconciliadas; las de 27 y 28 oct. no entran |
| 21 | Día en hora de Lima | modelo | Verificado: crudos en Lima 29 oct. 1092 / 30 oct. 67; el modelo da 1081 / 67 (sólo reconciliadas). **La app (Avance › Resumen, gráfico «Por día») mostraba 500 / 648, el reparto en UTC**: la sesión de UI confirma que el fix ya está en main (896fbe0f3, `.monitoreo_dia_local`) y que el backend 8826 corría el paquete anterior; se corrige al relanzarlo. No se toca aquí |
| 22 | Alinear con el PDF de avance de aulas (HSyVbG), pedido de Gonzalo en la sesión | motor + kit | Hecho: A4 apaisado, portada navy (`pulso_pdf_portada`), tarjetas `pulso_pdf_kpi`, serie partida, un panel por público y leyenda. `pulso_pdf_serie_partida` gana un parámetro `formato` (por defecto el de siempre: aulas no cambia) para escribir sin separador de miles |
| 23 | Sin «Incluir metas» el documento no publica el mínimo esperado (contrato del interruptor de Salidas, apagado por defecto) | motor | Hecho: sin el interruptor salen sólo invitados, completas y avance sobre el total |
| 24 | Lenguaje: «meta» no es el término; es un mínimo esperado y lo que interesa es el progreso por público sobre su total (Gonzalo, 2026-10-30) | motor + test (`test-monitoreo-acreditacion-avance-pdf.R` exige que «meta» no aparezca) | Hecho |
| 25 | El PDF explicaba cómo se cuentan las cifras (sección de definiciones, notas bajo cada tarjeta, bajadas «Ordenado por…», «Cada panel con su propia escala»): debe sólo informar, y una observación va únicamente como asterisco (Gonzalo, 2026-10-30) | motor + test (prohíbe «se cuentan», «enlace personal») | Hecho: quedan tres asteriscos: parciales, promedio sin el día en curso y día en curso en la tabla |
| 26 | «Invitados» no es el término: es el universo (la base del público); no todo estudio de acreditación se recoge por correo (Gonzalo, 2026-10-30) | motor + test (prohíbe «invitad») | Hecho: «Universo» y «Avance sobre el universo» en tarjetas, tabla, portada y paneles |
| 27 | «Hora de Lima» repetida en títulos, subtítulos y rótulos | motor + test (exige una sola aparición) | Hecho: sólo en el corte de la portada |
| 28 | Faltaban el diario y el acumulado por público | motor | Hecho: página «Avance diario por público», un panel por público con la convención de hostigamiento: acumulado en línea contra el mínimo esperado, completas del día en barras (Gonzalo, 2026-10-30: «el acumulado es una línea y el diario son barras») |
| 29 | El porcentaje sobre el mínimo no tenía nombre propio | motor | Hecho: «Cumplimiento del mínimo» (tarjeta y columna del resumen), siempre con su frecuencia |
| 30 | Los paneles del avance diario repetían cifras y el mínimo bajo el nombre del público | motor | Hecho: sólo el título (Gonzalo, 2026-10-30) |
| 31 | Prueba con más días y más avance (simulación de 18 días, corte 15/11, fuera del repo): rótulos del acumulado montados («3602 3606»), cifra tachada por la línea del mínimo, «hasta 11:40» sobre la fecha vecina en los paneles, tabla partida 14 + 4 | kit (`pulso_pdf_serie_partida`: rótulo pegado al último se calla, cifra bajo el punto si cae sobre una meta, eje de fechas igual) + motor (fecha corta en paneles, tabla de hasta 20 días con reparto parejo) | Hecho; el PDF de aulas re-renderizado se ve igual salvo las cifras que antes tachaba su meta |
| 32 | Barras del día con cifras intercaladas (también en cursos-horario): el kit escribía una de cada tantas cuando no cabían todas | kit (`.ppd_cifras_de_barras` reemplaza a `.ppd_rotulos_de_barras` y `.ppd_cifras_que_caben`) + test | Hecho: toda barra lleva su cifra arriba; cede el cuerpo (piso 4.6 pt) y, si ni así caben, alternan dos alturas por encima (Gonzalo, 2026-10-30) |

## Cifras contrastadas con la app (corte 30/10/2026 07:20)

| Cifra | PDF | App (Avance › Resumen) |
|---|---|---|
| Completas | 1148 | 1,148 |
| Mínimo esperado | 8507 | 8,507 («meta» en la app) |
| Faltan | 7359 | 7,359 |
| Avance sobre el universo | 2.5% (1148 de 45120) | 2.5 % (1,148 de 45,120) |
| Cumplimiento del mínimo | 13.5% (1148 de 8507) | 13.5 % |
| Parciales | 203 | 203 |
| Por público (completas / mínimo esperado) | 709/4542, 79/1125, 200/1115, 61/843, 62/699, 37/183 | idénticas |
| Completas por día | 29 oct. 1081, 30 oct. 67 (Lima) | 500 / 648 (backend sin relanzar, UTC; ver ítem 21) |
