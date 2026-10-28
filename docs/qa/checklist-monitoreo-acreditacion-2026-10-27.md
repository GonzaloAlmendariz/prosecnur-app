# Checklist · Monitoreo de acreditación: revisión y ajustes (2026-10-27)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-27
Autoridad: Pedido de Gonzalo del 2026-10-27 («revisa monitoreo de acreditación, revisa posibles mejoras y ajusta como aquí», en referencia al pase de Monitoreo territorial del mismo día); sólo él da por terminado un ítem

Proyecto de prueba: ACRDCONTA (`90_Pruebas/pruebas_monitoreo/ACRDCONTA.pulso`, copia en el scratchpad, nunca el original). Captura base: las 20 pestañas a 1440x1000 con `ui-quick-check` (textosFuera=2, cabecerasQueTapan=4, routeDeviations=1).

## Ítems

| # | Hallazgo | Dónde vive | Estado |
|---|---|---|---|
| 1 | La barra de secciones cambia de ancho y de posición según la pestaña (el chip de Avance y la insignia de Control aparecen y desaparecen) | `shell/monitoreoShell.css` (barra común: `grid-auto-columns: max-content`) | Hecho, medido en vivo: con columnas iguales la insignia de Avance ensanchaba las cuatro (420 → 750 px); ahora sólo crece la suya (≈420 → 510). Falta OK del usuario |
| 2 | Control › Barrido: «Efectivas de Egresados por canal» se sale por abajo de su tarjeta | `control/contacto/contacto.css` (la matriz se estira, la tarjeta de canales mide lo suyo; fila de cabeceras a su alto), `Barrido.tsx` (rótulos de celda «Solo al teléfono» / «Solo en la plataforma») | Hecho, verificado en vivo. Falta OK del usuario |
| 3 | Control › Barrido: la curva «Casos barridos, por fecha del último intento» lleva como eje «Efectivas» | `avance/graficosDeAvance.tsx` (`AreaAcumulada` recibe `tituloEje`), `Barrido.tsx` | Hecho: eje «Casos», título «Casos barridos acumulados». Falta OK del usuario |
| 4 | Tablas cuya cabecera fija tapa la primera fila al desplazar (Reintentos, Calidad, Personas, Respuestas) | `control/casos/porResolver.css` (`.acr-pr-cola-marco`), `core/colaDeInsistencia/colaDeInsistencia.css` | Hecho: encaje de filas bajo la cabecera (`scroll-snap`, mismo patrón que Telefónico). Medido en vivo tras desplazar fila y media: tapa 0 en las cuatro. Falta OK del usuario |
| 5 | Identificadores ofrecidos como variables de cuota (N°, Código PUCP, nombres, email, celular, «Teléfono de reemplazo», con tantas categorías como personas) | `api/R/monitoreo_acreditacion_cuotas.R` (`.mcu_variables`) + test | Hecho: una columna donde casi cada persona tiene su propio valor (≥ 90 %, más de 5 valores) no se ofrece como cuota; el 90 % cubre el celular de reemplazo de Egresados (21 números, uno repetido). Test rojo→verde; verificado en vivo y en captura: Administrativos ofrece sólo «Área de trabajo» y Modelo › Cuotas 4 variables. Falta OK del usuario |
| 6 | La misma variable se llama distinto en Modelo › Cuotas («Dedicación», «Categoría») y en Avance › Por cuota («Tipo de dedicación», «Categoría docente») | Motor: `.monitoreo_report_control_specs` (`monitoreo_engine.R`) trae rótulos de fábrica para PUCP; Modelo usa el nombre de la columna | **Bloqueado**: decidir qué nombre manda (el de la base o el rótulo declarado) toca el contrato de cuota |
| 7 | Modelo › Ventana: el bloque «Plan y ejecución de campo» tiene el estilo antiguo, repite datos («Semana del plan» / «Semanas del plan») y muestra fechas ISO | `modelo/PlanDeCampo.tsx` + `planDeCampo.css` (nuevo, sale del page-file congelado) | Hecho, verificado en vivo: plan / ejecutado / lectura en tres fichas, fechas «25 may a 22 jul», formulario en una fila. Falta OK del usuario |
| 8 | Avance › Salidas: rótulos que repiten el título («PDF EJECUTIVO / PDF ejecutivo»), botones rosados a todo el ancho y el ID del spreadsheet en crudo | `salidas/MonitoreoOutputsWorkbench.tsx` (compartido por todos los perfiles) | Pendiente: propuesto aparte, porque rediseñarlo cambia también Telefónico y Territorial |
| 9 | Avance › Por cuota: el título del eje «% del público» se monta sobre el «0» | `avance/avance.css` (`.acr-pc-eje-titulo` centrado) | Hecho. Falta OK del usuario |
| 10 | Control › Personas: «Quienes respondieron» sin tilde, y la fila elegida de «Estado por público» se sale de la tarjeta | `control/casos/Personas.tsx`, `personas.css` (`min-width` de la columna de público 180 → 150) | Hecho, medido en vivo: la tabla pasó de 523 a 518 px dentro de su tarjeta. Falta OK del usuario |
| 11 | Insumos › Fuentes: los padrones dicen «Filas leídas —» aunque Públicos cuenta sus personas | `insumos/fuentesModelo.ts`, `Fuentes.tsx` + test | Hecho: un padrón de Sheets sin contador toma las personas que cuenta Públicos. Verificado en vivo: 16 / 53 / 270. Falta OK del usuario |
| 12 | Control › Correo pedido por dirección cae en Barrido | `navegacion/direccionAcreditacion.ts` | No es defecto: Correo sólo existe con audiencia de Mailchimp (`useAudienciaDeCorreo`) y ACRDCONTA no la tiene |

Captura final (19 pestañas, 1440x1000): ok=true, textosFuera=0, cabecerasQueTapan=0, geometryIssues=0, apiErrors=0, 19 capturas distintas.

## Lo aprendido

- Sin SVG estirados aquí (lo que deformaba el Ritmo territorial no existe en acreditación).
- Las insignias de la barra salen de `useResumenDelCorte`, que guarda lo último de cada corte; el prefetch las llena unos segundos después de abrir. El salto era el cambio de ancho al llegar, no que faltaran.
- `launcher/launch.R` reinstala el paquete si la fuente cambió: un backend de prueba relanzado toca la librería compartida.
