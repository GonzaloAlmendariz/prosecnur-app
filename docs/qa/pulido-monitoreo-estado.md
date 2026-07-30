# Estado del pulido estético de Monitoreo

Registro iniciado el 2026-07-30 desde un proyecto `acrconta` abierto. El
inventario sigue el orden publicado por `window.__pulsoNav.manifiesto`: cuatro
modos y 26 nodos de modo/sección. Las pestañas corresponden a los catálogos que
esas direcciones montan en el DOM. Una fila representa una superficie concreta;
una sección sin pestañas internas cuenta como una sola superficie.

| Modo | Sección › Pestaña | Estado | Hallazgos | Commit |
|---|---|---|---|---|
| acreditación | Fuentes › Resumen | hecho | C1 medía 16 miembros en vez de 3; tarjetas planas de radio 16→14 con materia; título y total duplicados retirados | este commit |
| acreditación | Fuentes › Universo | pendiente |  |  |
| acreditación | Fuentes › Encuestas y recopiladores | pendiente |  |  |
| acreditación | Modelo operativo › Modelo operativo | pendiente |  |  |
| acreditación | Modelo operativo › Distribución | pendiente |  |  |
| acreditación | Modelo operativo › Cronograma | pendiente |  |  |
| acreditación | Modelo operativo › Resumen | pendiente |  |  |
| acreditación | Consultas › Registros en plataforma | pendiente |  |  |
| acreditación | Consultas › Estado de la base | pendiente |  |  |
| acreditación | Consultas › Cruces efectivos | pendiente |  |  |
| acreditación | Consultas › Subsanación | pendiente |  |  |
| acreditación | Monitoreo telefónico › Resumen | pendiente |  |  |
| acreditación | Monitoreo telefónico › Estados | pendiente |  |  |
| acreditación | Monitoreo telefónico › Día | pendiente |  |  |
| acreditación | Monitoreo telefónico › Incidencias de la base | pendiente |  |  |
| acreditación | Monitoreo telefónico › Responsables | pendiente |  |  |
| acreditación | Monitoreo telefónico › Alertas | pendiente |  |  |
| acreditación | Monitoreo telefónico › Supervisión telefónica | pendiente |  |  |
| acreditación | Avance › Resumen | pendiente |  |  |
| acreditación | Avance › Actores | pendiente |  |  |
| acreditación | Avance › Encuestas | pendiente |  |  |
| acreditación | Avance › Detalle | pendiente |  |  |
| acreditación | Avance › Salidas | pendiente |  |  |
| telefónico | Fuentes › Fuentes activas | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Fuentes › Universo y barrido | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Fuentes › Encuestas | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| telefónico | Modelo operativo › Cuotas | hecho | gobernador radio 9 sin sombra → 14 con materia; eslabones y resumen sin caja; 3 frases de AI slop retiradas; título pasa de la mecánica a la pregunta | este commit |
| telefónico | Modelo operativo › Cronograma | pendiente |  |  |
| telefónico | Modelo operativo › Resumen | pendiente |  |  |
| telefónico | Llamadas › Resumen | pendiente |  |  |
| telefónico | Llamadas › Tiempos | pendiente |  |  |
| telefónico | Llamadas › Sin efectiva | pendiente |  |  |
| telefónico | Llamadas › Responsables | pendiente |  |  |
| telefónico | Llamadas › Alertas | pendiente |  |  |
| telefónico | Consultas › Registros en plataforma | pendiente |  |  |
| telefónico | Consultas › Estado de la base | pendiente |  |  |
| telefónico | Consultas › Cruces efectivos | pendiente |  |  |
| telefónico | Consultas › Subsanación | pendiente |  |  |
| telefónico | Avance › Resumen | pendiente |  |  |
| telefónico | Avance › Actores | pendiente |  |  |
| telefónico | Avance › Salidas | pendiente |  |  |
| territorial | Fuente › Formulario | pendiente |  |  |
| territorial | Fuente › Filtro y distritos | pendiente |  |  |
| territorial | Fuente › Encuestadores | pendiente |  |  |
| territorial | Fuente › Reconciliación | pendiente |  |  |
| territorial | Fuente › Historial | pendiente |  |  |
| territorial | UMPs › Cobertura | pendiente |  |  |
| territorial | UMPs › Manzanas | pendiente |  |  |
| territorial | Validación › Geolocalización | pendiente |  |  |
| territorial | Validación › Reconciliación UMP | pendiente |  |  |
| territorial | Validación › Duración de tiempo | pendiente |  |  |
| territorial | Validación › Cuotas | pendiente |  |  |
| territorial | Validación › Anulación | pendiente |  |  |
| territorial | Consultas internas › Registro | pendiente |  |  |
| territorial | Consultas internas › GPS con señal | pendiente |  |  |
| territorial | Consultas internas › Tiempo corto/muy corto | pendiente |  |  |
| territorial | Consultas internas › Cruce responsable | pendiente |  |  |
| territorial | Consultas internas › Subsanaciones | pendiente |  |  |
| territorial | Avance territorial › Resumen | pendiente |  |  |
| territorial | Avance territorial › Distritos | pendiente |  |  |
| territorial | Avance territorial › Mapa y UMP | pendiente |  |  |
| territorial | Avance territorial › Ritmo diario | pendiente |  |  |
| territorial | Avance territorial › Salidas | pendiente |  |  |
| territorial | Ocurrencias de campo › Resumen | pendiente |  |  |
| territorial | Ocurrencias de campo › Distritos | pendiente |  |  |
| territorial | Ocurrencias de campo › Reporte UMP | pendiente |  |  |
| territorial | Ocurrencias de campo › UMP | pendiente |  |  |
| territorial | Ocurrencias de campo › Alertas | pendiente |  |  |
| territorial | Ocurrencias de campo › Ritmo | pendiente |  |  |
| cursos-horario | Fuentes | pendiente |  |  |
| cursos-horario | Agenda de cursos-horario | pendiente |  |  |
| cursos-horario | Avance | pendiente |  |  |
| cursos-horario | Validación | pendiente |  |  |
| cursos-horario | Consultas | pendiente |  |  |

## Hallazgos no estéticos

| Tipo | Modo | Superficie | Hallazgo | Referencia | Estado |
|---|---|---|---|---|---|
| duplicación estructural | telefónico | Modelo › Cuotas | «Sede» se lee **9 veces** en la misma pantalla y «400» **5**. No es copy repetido sino cuatro superficies que muestran el mismo modelo con distinto formato: la franja de 4 cajas, la cadena de la regla de lectura, la fila de 5 KPIs bajo las categorías y las tarjetas editables. Las 5 categorías se listan **dos veces** —resumen con base·meta·% y tarjetas con universo/meta/efectivas/brecha/tasa/reserva—. Retirar la redundancia exige decidir qué superficie es la de lectura y cuál la de edición, y eso es estructura, no CSS. | medido el 2026-07-30 en `acnur_pdm`, `monitoreo/telefonico/modelo/estructura` | abierto |

## Evidencia de la última iteración

- Proyecto: copia temporal de `api/inst/reference_projects/acrconta/acrconta.pulso`.
- Dirección: `monitoreo/acreditacion/fuentes/resumen`.
- Viewports: `1440×1000` y `1024×600`.
- Antes: el grupo `fuentes-resumen-papeles` mezclaba 3 tarjetas y 13 filas;
  las tarjetas usaban radio de panel, fondo plano y ninguna materia propia.
- Después: C1 mide solo 3 tarjetas; `ΔH = 0` y `ΔW ≤ 0.01 px` en ancho amplio,
  `ΔH = 0` y `ΔW = 0` en compacto; el último contenido es alcanzable.
- Resultado automatizado: 2 capturas, 0 incidencias visuales, 0 scroll-jails,
  0 desbordes globales, 0 errores de geometría y 0 errores de página/API.
- C5: el proyecto tiene 13 fuentes (4 de universo, 8 de respuestas y 1 de
  barrido), por lo que no hay estado vacío que clasificar en esta superficie.
