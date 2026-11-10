# Checklist — revamp de Hojas de ruta con el mapa al centro (2026-10-28)

Tipo: Checklist de pedido con varias indicaciones
Estado: Histórico
Fecha: 2026-10-28
Autoridad: indicaciones de Gonzalo sobre el prototipo de Hojas de ruta con el mapa al centro
Consolidado en: [Plan del revamp de Hojas de ruta con el mapa como lienzo](plan-revamp-hojas-mapa-2026-10-29.md)

Prototipo: carpeta temporal del repo, `revamp-hojas-material/mapa2.html` (no versionado), publicado en
https://claude.ai/artifact/RE6A3fibXXzeKMUEX28ZfX. Cartografía INEI 2017 que ya
sirve la API (`/api/hojas-ruta/block-map`, `street-map`, `zone-map`) y
selección real de `acnur_acg`.

Solo Gonzalo da por terminado un ítem.

| # | Indicación de Gonzalo | Dónde vive | Estado |
|---|---|---|---|
| 1 | El mapa es el centro gravitacional; la titular es la protagonista | Prototipo `mapa.js` (lienzo Canvas) | Hecho en prototipo |
| 2 | Los reemplazos (1 a 5, en orden) son contingencia: sin rojo ni líneas que los unan | Prototipo; memoria `feedback_reemplazo_es_contingencia_no_recorrido` | Hecho en prototipo |
| 3 | Que no sea pesado: todo carga bien y rápido, incluso SJL con 16 mil manzanas | Prototipo, capa base | Hecho en prototipo: 9,6 s → 0,6 s (medición abajo) |
| 4 | Poder elegir otro distrito, o empezar sin ninguno y elegirlos | Territorio: mapa de los 50 distritos + catálogo con interruptores y buscador | Hecho en prototipo |
| 5 | El motor de muestra no puede quedar en «entrevistas con + y −»: todo lo que hoy define el módulo, repensado | Muestra › inspector; port del engine que cuadra exacto con R (392 · 624 · 1.200 · ±2,83 % · 1.334) | Hecho en prototipo |
| 6 | El + y el − no explican cuánto suman | Muestra: «− y + quitan o suman una ruta: 8 entrevistas» | Hecho en prototipo |
| 7 | Todo lo que hoy hace el módulo debe estar, y mejor: nada se pierde sin decidirlo | Todas las secciones (tabla §7) | Casi todo en prototipo; quedan los pendientes de §7 |
| 8 | Elegir de una lista con interruptores y buscador, no con casillas | Territorio, Población (sexo), Muestra (FPC); memoria `feedback_elegir_de_una_lista_es_interruptor_con_buscador` | Hecho en prototipo |
| 9 | Comentario: «Agregar los 50» y «Quitar todos» son muy simples | Territorio: botones del kit + atajos por zona de Lima | Hecho en prototipo |
| 10 | Comentario: el scroll o zoom es demasiado lento | Mapa: rueda ×3 y pellizco del trackpad ×6 | Hecho en prototipo |
| 11 | Comentario: la cabecera del Reparto no se ve bien | Muestra: título, tres cifras y acciones con cuerpo de botón | Hecho en prototipo |
| 12 | Comentario: «Encuestas por ruta 8 cambiar» no se ve bien | Sorteo: fila que lleva a Muestra; semilla con botón «Otra» | Hecho en prototipo |
| 13 | Mejorar más y darle más capacidades | Capacidades nuevas (§8) y construir encima (§9) | En prototipo; Gonzalo decide qué va a la app |

## 7 · Paridad: lo que hace hoy el módulo y dónde vive en el diseño nuevo

Inventario completo de HojasRutaPage.tsx, el router y el engine, hecho el 2026-10-28. Esqueleto nuevo: rail (Territorio · Población · Muestra · Sorteo · Selección · Entrega), estructura a la izquierda, mapa al centro, inspector a la derecha y un cajón inferior para las tablas anchas.

| Hoy | En el diseño nuevo | Estado en prototipo |
|---|---|---|
| Fase Piloto / Campo real, regla «Evita titulares / No evita piloto», piloto bloqueado | Barra del documento | Hecho en prototipo |
| Indicadores «lo decidido» clicables | Barra del documento | Hecho en prototipo |
| Mapa de 50 distritos (Lima y Callao) con hover y clic | Territorio › mapa con los 50 contornos | Hecho en prototipo |
| Modo «Selección en mapa» (clic agrega o quita) | Territorio: clic sobre un distrito lo agrega o lo quita del borrador | Hecho en prototipo |
| Buscador, «Agregar visibles», «Limpiar borrador», tarjetas por distrito | Territorio › estructura (catálogo con interruptores y buscador) | Hecho en prototipo |
| Borrador frente a confirmados; «Confirmar selección» invalida lo posterior | Territorio › inspector, con la consecuencia dicha | Hecho en prototipo |
| Empezar sin distritos | Territorio vacío: mapa de los 50 y catálogo | Hecho en prototipo |
| Distrito → Zonas → Manzanas; capas Campo y NSE; ficha de la manzana | Mapa (zoom continuo), capas Manzanas · Viviendas · NSE, ficha al pasar el cursor | Hecho en la app (1 nov): clic en cualquier manzana en Manzanas, o fuera de una titular en Selección, abre su ficha |
| Agrupar filas por distrito, provincia, ubigeo o zona; sexo sí o no | Población › inspector | Hecho en la app: el cajón de Población agrupa por distrito, provincia o zona (B29) |
| Rangos de edad manuales (Desde, Hasta, A más) o por cortes (terciles a deciles; base seleccionados o marco) | Población › estructura (editor de rangos) | Hecho en prototipo |
| Matriz poblacional y proporcional, «Exportar Excel» | Población › cajón inferior | Hecho en prototipo |
| Lógica del N: calculadora, N total o N por distrito (pegar desde Excel, sugerir) | Muestra › inspector; N por distrito editable en la estructura | Hecho en prototipo |
| Encuestas por ruta y chequeo de N compatible | Muestra › inspector, con el paso del + y − explicado | Hecho en prototipo |
| Confianza, margen total, margen distrital y su uso (requisito o máximo) | Muestra › inspector | Hecho en prototipo |
| p, DEFF (presets y guía ICC), tasa de respuesta → contactos | Muestra › inspector | Hecho en prototipo |
| Asignación por tamaño, igualitaria o intermedia (√población); FPC; ajustes por distrito | Muestra › inspector y estructura | Hecho en prototipo |
| Alternativas de N («Usar este N»), curva, «¿De dónde sale este N?» | Muestra › inspector | Hecho en prototipo |
| Matriz de cuotas distrito × edad × sexo | Muestra › cajón inferior | Hecho en prototipo |
| Método PPS, sistemático o conglomerado fijo; ponderar por viviendas o población; semilla | Sorteo › inspector | Hecho en prototipo |
| Recorrido: esquina inicial; salto automático, sin salto o manual, con vista previa de K | Sorteo › inspector | Hecho en prototipo |
| Reemplazos por titular (0–10) y ubicación (otra zona o misma zona) | Sorteo › inspector | Hecho en prototipo |
| «Generar selección», historial de ruteos («Usar ruteo») | Sorteo › inspector y estructura | Hecho en prototipo |
| Tablas de titulares, reemplazos y cuotas | Selección › cajón inferior | Hecho en prototipo |
| Revisión contra el marco | Selección › filtro «Por revisar» y ficha | Hecho en prototipo |
| ZIP de hojas, Excel operativo, reemplazos puntuales, PDF de prueba, entregables | Entrega › inspector | Hecho en prototipo |
| Avisos del motor (E_*, W_*, I_*) | Inspector de cada sección | Hecho en prototipo |

No existen hoy, así que su ausencia no es una pérdida: filtro de manzanas por mínimo de viviendas, Neyman, cuotas que no sean de sexo y edad, regiones fuera de Lima y Callao, y la no respuesta que infla el N (hoy solo da los contactos).

## 8 · Capacidades nuevas (no existen hoy)

| Capacidad | Para qué | Dónde | Estado |
|---|---|---|---|
| Filtro del marco: mínimo de viviendas por manzana | Que no salgan titulares sin viviendas o que no alcanzan la ruta (UMP 71 de Los Olivos) | Sorteo › Manzanas elegibles; el mapa pinta en blanco lo que queda fuera | En prototipo |
| ¿Se parece la muestra al marco? | NSE de las titulares frente al marco pesado por viviendas, que es lo que espera el PPS | Sorteo, tras sortear | En prototipo |
| Capa NSE | Ver el estrato de cada manzana (GeoPerú/INEI); el código numérico iba al revés de lo supuesto: 5 = Bajo | Mapa | En prototipo |
| Plan de campo | Agrupar rutas cercanas en cargas (un encuestador, un día) y estimar los días según encuestadores y rutas por día | Entrega; el mapa colorea por carga | En prototipo |
| Escenarios de muestra | Guardar y comparar N, margen, peor distrito y contactos antes de decidir | Muestra › estructura | En prototipo |
| Atajos por zona de Lima | Norte, Este, Sur, Centro, Moderna y Callao de un clic (agrupación usual de las encuestadoras) | Territorio | En prototipo |

## 9 · Qué construir encima (propuesta 2026-10-29; decide Gonzalo)

Ordenado por valor. «Base existente» dice qué ya hay en el repo y lo hace viable.

| # | Mejora | Qué resuelve | Base existente | Esfuerzo | Estado |
|---|---|---|---|---|---|
| A1 | **El mapa muestra el avance de campo por UMP** (pendiente, en curso, completa, reemplazada) | Hoja de ruta y monitoreo dejan de ser dos mapas distintos: el mismo lienzo acompaña al estudio de principio a fin | Monitoreo territorial ya lee titulares y reemplazos de `hojas_ruta_runs` (`router_monitoreo.R:618`) | Medio | En prototipo (avance simulado; en la app viene de Monitoreo) |
| A2 | **Activar un reemplazo con su motivo** (rechazo, inaccesible, manzana inexistente, peligro) | El reemplazo como contingencia, con trazabilidad: R1 se enciende solo cuando la titular cae, y queda la tasa real de reemplazo para el próximo estudio | Reemplazos ordenados y reemplazos puntuales en el motor | Medio | En prototipo |
| A3 | **Del plan de campo a la campaña de Material** con los nombres reales de los encuestadores | El plan deja de ser una estimación y se vuelve la asignación que se imprime | Campañas tipadas de Material (ADR 0111); falta E2 | Alto (depende de E2) | En prototipo como vista previa del envío; la campaña real espera E2 |
| B1 | **Costo en vivo junto al N** (jornadas × costo por encuestador-día + movilidad) | «Qué compra cada N» en soles, y escenarios comparables por presupuesto | Plan de campo y escenarios del prototipo | Bajo | En prototipo |
| B2 | **Excluir áreas dibujando en el mapa** (lazo sobre zonas peligrosas, industriales o inaccesibles), con motivo | El marco se depura con criterio de campo antes de sortear, y la exclusión queda documentada | Filtro del marco del prototipo; geometría por manzana | Medio | En prototipo |
| B3 | **DEFF medido en un estudio anterior** («usar el DEFF de HSVG 2025») y **N inflado por no respuesta** como opción | El supuesto más débil del cálculo pasa a ser un dato; hoy la tasa de respuesta solo da los contactos | Memoria: DEFF real de HSVG 2025 medido; `response_rate` ya está en el motor | Bajo | En prototipo (se traslada el ICC, no el DEFF) |
| B4 | **Avisar antes de sortear las zonas que no alcanzan** (menos manzanas elegibles que rutas) | `W_FRAME_INSUFFICIENT` y `E_UNASSIGNED_INTERVIEWS` aparecen después; se pueden ver en el mapa antes | Reparto rutas → zonas del engine | Bajo | En prototipo |
| B5 | **Comparar dos sorteos** (dos semillas) en balance de NSE y kilómetros | Elegir el sorteo con criterio sin perder la aleatoriedad: la semilla elegida queda registrada | Comparación con el marco y plan de campo del prototipo | Bajo | En prototipo |
| C1 | **Vista previa de la hoja de ruta de cada UMP** en el inspector (la ficha PDF real) | Ver lo que va a recibir el encuestador sin generar el ZIP | `POST /random-pdf` ya arma una ficha | Medio | En prototipo |
| C2 | **Informe de diseño muestral para el cliente** (Quarto, HTML o PDF) | El informe ya existe en el backend y no tiene botón | `POST /reporte-decisional` (sin UI) | Bajo | En prototipo (HTML imprimible con el estado real) |
| C3 | **Mapa del día por encuestador** (PDF con sus rutas y el orden de visita) | La logística del plan de campo llega impresa | Plan de campo + motor PDF | Medio | En prototipo |
| D1 | **Bitácora de decisiones** (quién cambió el N, la semilla, el territorio; cuándo) | Reproducibilidad de la entrega: cada sorteo se puede reconstruir | GOAL de reproducibilidad de la entrega | Medio | En prototipo |
| D2 | **Marco fuera de Lima y Callao** | Estudios regionales (por ejemplo UNSA en Arequipa) | Requiere empaquetar cartografía y manzanas INEI de otras regiones | Alto | Fuera de alcance: proyecto aparte |

Gonzalo pidió las cinco recomendadas y luego «lo demás también, de forma elegante y creativa» (2026-10-29): quedan todas en el prototipo salvo D2.

## 3 · Rendimiento (medido 2026-10-28, Chrome, 1440×1000)

- Datos: seis distritos, 38.999 manzanas, 13.6 mil tramos de vías mayores, 529 zonas. Pesan 12 MB en JSON plano: unos 250 ms en local, mucho menos con gzip.
- Causa del arranque lento (9,6 s): un único `Path2D` por capa con cientos de miles de subtrazados, que Skia tesela en tiempo superlineal.
- Arreglo: un `Path2D` por manzana y por vía, con su caja; solo se dibuja lo que entra en pantalla; la capa base va a un lienzo aparte y se reutiliza escalada mientras se mueve la cámara si cuesta más de 18 ms.
- Resultado: geometría en 0,37 s y arranque total en 0,6 s. La capa base cuesta 16 ms con los seis distritos y 1–4 ms con zoom en SJL. Heap de 42 MB.
- Para la app: cargar la geometría por distrito al agregarlo (no todo Lima) y servirla con gzip desde el caché local que ya tiene la API.
