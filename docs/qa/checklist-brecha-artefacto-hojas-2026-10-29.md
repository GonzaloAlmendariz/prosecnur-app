# Checklist — brecha de Hojas de ruta con el artefacto (2026-10-29)

Pedido de Gonzalo (textual): «aún veo a la UI muy lejos del artefacto, le faltan muchísimas cosas y las cosas que ya están aún no terminan de verse bien».

Referencia: `tmp/revamp-hojas-material/mapa-artefacto.html` (fuentes `mapa2.src.js`, `mapa2.css`, `mapa.css`). App: lienzo (`frontend/src/features/hojasRuta/mapa/**`) con acnur_acg. Inventario de qa-visual-desktop, 1440×1000 y 1024×600, con capturas pareadas (fuera del repo, scratchpad `brecha/`). Veredicto: **RECHAZADO VISUAL**.

Estado: ☐ pendiente · ◐ en curso · ☑ hecho (con commit) · ⛔ bloqueado (decisión) · — anotado, no es brecha. Sólo Gonzalo da el checklist por terminado.

| # | Dónde | Tipo · impacto | Brecha | Dónde vive | Estado |
|---|---|---|---|---|---|
| B0 | Selección › ficha | bug · alto | «Ver la hoja de ruta» deja el proyecto «sin guardar» (`.register_output_file` escribe `files`) | `api/R/router_hojas_ruta_vista_previa.R` (`.hojas_ruta_vp_registrar`) | ☑ (ficha y hoja del día; test) |
| B1 | Barra superior | falta · alto | Zona de acciones: nombre, fase Piloto/Campo real con su regla, Bitácora con contador, «N por revisar», «Enviar a Material» | `HojasRutaMapaPage.tsx` (`acciones`/`estado` del ModuleCommandBar); Material deshabilitado hasta U19 | ☑ |
| B2 | Indicadores | peor · medio (C5) | Población muestra el total, no la objetivo (2.39 M); sin formato compacto; orden distinto; UMP sin «R» | `chrome/loDecidido.ts` (`poblacionObjetivo`, compacto, orden del recorrido) | ☑ |
| B3 | Secciones | peor · medio (a11y) | Las 5 pastillas llevan `aria-current="page"` (NavLink ignora la query) | `components/SectionPillbar.tsx` usa `Link`; la activa la decide el llamador | ☑ |
| B4 | Indicadores 1024 | peor · bajo | A 1024 esconde 2 de 4; el artefacto esconde los 4 y deja acciones | en el lienzo los indicadores «alta» bajan a «media» (ceden bajo 1080 px de barra, como en el artefacto) y bajo 1280 px de ventana la barra va en densidad «compact» (`useBarraAngosta`; «Enviar a Material» sólo ícono). A 1024 había 3 solapes reales (Manzanas/Selección bajo Campo real y «12 por revisar»): ahora 0; a 1280 entran 3 indicadores y 0 solapes. La página clásica no cambia | ☑ |
| B5 | Secciones | — | Barra superior en vez de rail (D1); sin «Entrega» ni «Avance» (D2) | — | — |
| B6 | Mapa | falta · alto | Cápsula de miga arriba a la izquierda (orientación + instrucción) | `lienzo/flotantes.tsx` → `LienzoMapa` prop `miga` | ☑ |
| B7 | Mapa | falta · alto | Selector de capas Manzanas · Viviendas · NSE (hoy `capa="manzanas"` fijo) | `SelectorCapa` en `lienzo/flotantes.tsx`, `capaMapa` en el store | ☑ |
| B8 | Mapa | falta · alto | Leyenda por sección | `lienzo/flotantes.tsx` → `LienzoMapa` prop `leyenda` (se oculta bajo 1100 px, como el artefacto) | ☑ |
| B9 | Mapa | peor · alto | Paleta de identidad por distrito (relleno, franja del rótulo); rótulos de Territorio sin población | tokens `--pulso-mapa-tono-0..7`, `tonoDistrito`/`mezclar` en `lienzo/capas.ts` | ☑ |
| B10 | Mapa | peor · alto | Anticolisión pierde rótulos (4/6 a 1440, 3/6 a 1024) y monta otros | `elegirRotulos` corre el rótulo con guía, dentro de la franja libre | ☑ (6/6 a 1440 y 1024) |
| B11 | Mapa | peor · medio | Encuadre de Territorio con mucho blanco; sin nombres en gris de los distritos fuera | `lienzo/` | ☐ |
| B12 | Mapa | peor · alto | Foco de UMP no llega a calle (100 m) ni dibuja la manzana; «Acercar» no centra en la UMP | foco encuadra sólo la manzana (pad 2.2) y `anclaZoom` en `LienzoMapa` | ☑ |
| B13 | Mapa | peor · bajo | Fondo #f7f8fa vs #fafbff; encuadrar es «⤢» texto, no ícono | `--pulso-mapa-fondo: #fafbff` (sólo lo usa el lienzo) e ícono `Maximize2` con título en «Encuadrar» | ☑ |
| B14 | Inspector | peor · alto | Cabecera: ícono 40 px en tono de módulo, eyebrow versalitas, título | `mapa/InspectorCabecera.tsx` en los 5 `*Paneles.tsx` + ficha UMP | ☑ |
| B15 | Inspector | peor · medio | Rótulos de sección (LO ELEGIDO, MARCO TERRITORIAL, RESULTADO, MATRIZ) | Territorio: «Lo elegido» y «Marco territorial» (B27); Población: «Resultado» y «Matriz» (`.hr-mapa-subtitulo`) | ☑ |
| B16 | Muestra | peor · medio | Lógica del N, Confianza y DEFF como botones sueltos, no segmentado | `.hr-muestra-opciones` en `mapaPage.css`: riel tenue con píldora blanca que se desliza y texto activo en el tono del módulo; sin borde por opción; a 1024 nada se corta. Aplica también a Población y a los cajones. El DEFF queda como fichas con rótulo (B33): cuatro nombres no caben en un segmentado de 260 px | ☑ |
| B17 | Cajón | falta · alto | Cajón también desde Población («Ver matriz») y Muestra («Ver cuotas») | Población ☑ 767342b07; Muestra ☑ (`muestra/MuestraCajon.tsx`: cuotas por distrito con totales por rango y sexo) | ☑ |
| B18 | Cajón | peor · medio (C2) | Ancho limitado al lienzo; pestañas sin `aria-selected` ni activa visible; «×» texto; desborde 8/284 px; tapa zoom a 1024 | `.hr-sel-cajon` alto fijo 46 % y escala/zoom/leyenda suben encima (`:has`): a 1024 el zoom pasó de quedar bajo el cajón a 8 px sobre él; «×» → ícono; pestañas son radios con `aria-checked` y activa visible (B16); el único desborde es el scroll horizontal legítimo de la tabla. Ancho: se queda en el lienzo (no tapa el inspector) | ☑ |
| B19 | Salidas | peor · alto | Sideover con velo tapa el mapa; en el artefacto es sección con mapa por encuestador | `seleccion/SalidasPanel.tsx` | ☐ |
| B20 | Plan de campo | falta · alto | Lista por día y encuestador con color y «Hoja del día»; cifras derivadas; mapa por encuestador | calendario en `hojas_ruta_plan_campo` (encuestador, día), lista por día en `PlanCampo.tsx`; FALTA el mapa coloreado por encuestador y verlo en vivo | ◐ |
| B21 | Plan / Muestra | peor · alto (C5) | Costos arrancan en 0 → sin costo estimado; Muestra no muestra la tarjeta de costo | defaults del artefacto (S/ 145 por jornada = 120 pago + 25 movilidad, 15 % supervisión) en R y cliente, rotulados como supuestos | ☑ |
| B22 | Salidas | falta · medio | Botón «Ver el informe» (U16), «Enviar a Material», conteos del paquete, sugeridas para reemplazo puntual | `SalidasPanel.tsx` | ☐ |
| B23 | Bitácora | — (C5 legítimo) | Vacía en proyectos previos a U17: decirlo en la UI | `mensajeBitacoraVacia` en `BitacoraSeccion.tsx` (con test): si el proyecto ya tiene muestra y la bitácora está vacía, dice que es anterior a ella y que desde ahora registra; verificado en acnur_acg | ☑ |
| B24 | Territorio | peor · medio | Filtro como segmentado «Todos/Elegidos»; íconos en Agregar/Quitar; rótulo «ZONAS DE LIMA» | segmentado «Todos · 50 / Elegidos · 6» (reemplaza el interruptor), íconos + y − en las acciones, rótulo «Zonas de Lima»; filtra 50 → 6 → 50; sin cortes a 1024 | ☑ |
| B25 | Estructura | bug · medio (C4) | El scroll de la estructura pasa entre secciones (Territorio abre en 1869 px) | `key` por sección en `.hr-mapa-estructura` (verificado: 1500 → 0) | ☑ |
| B26 | Territorio 1024 | peor · bajo | Detalle del catálogo parte en 2 líneas («mz»); «Lima y Callao · 50 distritos» también | bajo 1280 px el detalle dice «mz» (el lector de pantalla sigue oyendo «manzanas») y cabe en una línea; «Agregar/Quitar visibles» envuelven en vez de cortarse; la miga deja sólo «Lima y Callao» junto a las capas; los nombres de la gráfica van sobre su barra (a 1440 también se cortaban). 0 textos ni botones cortados a 1024 y 1440 | ☑ |
| B27 | Territorio | falta · bajo | Fila «Cartografía: Lima 2017 · Callao 2019» | sección «Marco territorial» en el inspector de Territorio (Cobertura · Manzanas INEI 2017 · Cartografía Lima 2017 · Callao 2019), leída de `frame_meta.block_cartography.sources` del motor, no escrita a mano | ☑ |
| B28 | Población | falta · alto | Modo «Cortes poblacionales» (Manual/Cortes); total de personas junto a los rangos | Manual / Por cortes (terciles a deciles, base elegidos o marco) con borrador hasta «Calcular la matriz»; los cortes los pone el motor (`age_range_mode`); «Editar estos rangos a mano»; total de personas en el encabezado | ☑ |
| B29 | Población | peor · alto (C2) | Matriz recortada en el inspector; faltan agrupar filas, columnas, «Ver matriz» y Excel | la matriz va al cajón (767342b07): personas H/M por rango o distribución %, descarga CSV; agrupar filas por distrito, provincia o zona de Lima (`agruparFilas` en `poblacion/matriz.ts`; zona censal no: el INEI viene por distrito) | ☑ |
| B30 | Población | peor · bajo | «De la poblaci…» truncado; 76.8 % vs 77 %; el segmento 60+ pierde su % | «Del total» (con título que explica la base); regla de edades compacta bajo 1280 px: a 1024 pasa de 4 rótulos cortados a 0. El % se muestra con un decimal en todo el módulo (76.8 %); el «77 %» era redondeo del artefacto. El 60+ conserva su % con los rangos actuales | ☑ |
| B31 | Población | — | La app trae tope del último rango y «Calcular la matriz» | — | — |
| B32 | Muestra | falta · alto | «Repartir según población», «Mínimos» y Escenarios guardables | `muestra/repartos.ts` (mismo `repartirPorModo` que el motor, en rutas completas) + `muestra/EscenariosMuestra.tsx` (guardar, aplicar como borrador, quitar; viven mientras el proyecto está abierto) | ☑ |
| B33 | Muestra | falta · medio | Paso a paso de la ruta; atajos de margen; rótulos del DEFF; interruptor de inflar por no respuesta | `MuestraPaneles.tsx`: −/+ de encuestas por ruta, atajos ±3/4/5 % (total) y ±8/10/15 % (distrito), DEFF «Sin ajuste · Ligero · Territorial · Conservador». Inflar el N: NO se agrega — el motor no lo tiene y el ADR 0116 absorbe la no respuesta en las visitas por ruta, no inflando N | ☑ |
| B34 | Muestra | falta · medio | Alternativas sin su margen; ICC medidos a la vista | cada alternativa muestra su margen total (`margenTotalParaN` en `motorTamano.ts`, misma fórmula del motor); la biblioteca de ICC se lee al entrar, sin botón (`IccPanel.tsx`); en esta máquina está vacía y lo dice | ☑ |
| B35 | Muestra | falta · medio | Pie «Ver cuotas / Ir al sorteo» | `MuestraPaneles.tsx`: sin cambios pendientes el pie lleva a las cuotas y al sorteo | ☑ |
| B36 | Muestra 1024 | peor · medio | Lista de reparto con scroll anidado (deuda compartida con el artefacto) | `.hr-muestra-reparto` crece entera (`flex-shrink: 0`, sin overflow propio): a 1024×600 pasaba de una ventana de 86 px sobre 484 a un solo scroll, el de la estructura; a 1440 no hay scroll | ☑ |
| B37 | Muestra | — | La app suma ocupación, visitas P90, aviso MAS, FPC | — | — |
| B38 | Manzanas | falta · alto | «¿Se parece al marco?» (NSE marco vs muestra); deslizador del mínimo con atajos; cifras Elegibles/Fuera/Viviendas | «¿Se parece al marco?» ☑ c2f4b7788; atajos del mínimo ☑ 2f57d7efc; cifras ☑ en `manzanas/MarcoElegiblePanel.tsx`: Elegibles «de N manzanas», Fuera desglosado (mínimo · áreas · piloto), Viviendas % en elegibles; cobertura de población en la nota. Verificado contra la vista previa del motor en acnur_acg: 30,127 + 8,866 + 0 + 6 = 38,999; 838,686 / 839,193 viviendas = 99.9 % | ☑ |
| B39 | Manzanas | falta · medio | Fila «Carga de la ruta»; «Dibujar un área a excluir» visible | sección «Carga de la ruta» (ponderar, «8 encuestas por ruta · Cambiar» → Muestra, semilla) en `manzanas/ManzanasPaneles.tsx`; «Dibujar un área a excluir» a la vista también sin marco adoptado: declara el marco con mínimo 0, sólo con el área (`MarcoElegiblePanel.tsx`) | ☑ |
| B40 | Manzanas | peor · medio | Filas de distrito 16 px sin punto ni cifra a la derecha; historial abajo y truncado | `ManzanasEstructura`: punto con el tono del distrito en el mapa, nombre + «N entrevistas · R reemplazos», «25 UMP» a la derecha (47 px por fila); el historial ya no trunca (0 textos cortados) | ☑ |
| B41 | Manzanas | — | La app trae historial real, exclusiones de piloto y comparar semillas | — | — |
| B42 | Selección | peor · alto | Filas de ruta: insignia numerada con color, código de manzana, dos líneas, viviendas a la derecha | `seleccion/SeleccionPaneles.tsx` (`.hr-sel-num/-copia/-cifra`); a 1024 sin «Zona» (1 de 150 con elipsis) | ☑ |
| B43 | Selección | peor · medio (C5) | «Solo por revisar 12» vs «Por revisar 14» | dos medidas distintas: rutas (12) y UMP observadas incl. reemplazos (14); el inspector ahora dice «UMP observadas» | ☑ |
| B44 | Ficha UMP | peor · alto | Cabecera con insignia, eyebrow y título; chevrons arriba; 0 viviendas en rojo con barra | `InspectorCabecera` (B14) + `OcupacionRuta` en `SeleccionPaneles.tsx` (variante roja sin titular de 0 viviendas en acnur_acg para verla) | ☑ |
| B45 | Ficha UMP | falta · medio | «Reemplazo puntual» y «Tablas» en la ficha; ayuda de orden; R con código de manzana | `SeleccionPaneles.tsx` | ☐ |
| B46 | Ficha UMP | peor · medio | La hoja como miniatura ilegible; modal grande con «Imprimir» | `HojaVista.tsx` | ☐ |
| B47 | Selección | — | La app trae revisión contra el marco más rica, ficha real y `?foco=` | — | — |
| B49 | Territorio | pedido de Gonzalo · alto | Clic en un distrito = ver su ficha, no elegirlo; zonas (Norte, Este…) filtran, no eligen; agregar/quitar sólo sobre lo visible y con su número; elegir sólo con los interruptores | `territorio/TerritorioPaneles.tsx`, `store.ts` (`zonaFiltro`, `distritoEnfocado`), clic del lienzo | ☑ |
| B48 | Territorio › inspector | pedido de Gonzalo · medio | Aprovechar el espacio vacío con gráficas preliminares de la selección: peso de cada distrito en la población y perfil NSE de las viviendas | `territorio/TerritorioGraficos.tsx` | ☑ |

Geometría C1–C3: DEBT (falta `ui-quick-check --require-geometry` y cardinalidad baja).

## Pausa (2026-10-29)

Pausado por Gonzalo; retomado por turnos. B17 Muestra, B35 y el color de Población (tonos por distrito en vez de la rampa azul; rangos de edad en el naranja del módulo, sin franja) quedaron verificados en pantalla y commiteados. B29 cerrado con agrupar filas.

## Lo aprendido

- El artefacto se sirve con un server con hilos y `charset=utf-8`; `python -m http.server` a secas rompe los fetch y los acentos.
- La sesión del navegador integrado es compartida entre pestañas de :5181 (`pulso.sessionId`): lo que muta una pestaña lo ve la otra.
