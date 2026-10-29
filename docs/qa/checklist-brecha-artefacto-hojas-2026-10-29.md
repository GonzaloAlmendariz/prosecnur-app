# Checklist — brecha de Hojas de ruta con el artefacto (2026-10-29)

Pedido de Gonzalo (textual): «aún veo a la UI muy lejos del artefacto, le faltan muchísimas cosas y las cosas que ya están aún no terminan de verse bien».

Referencia: `tmp/revamp-hojas-material/mapa-artefacto.html` (fuentes `mapa2.src.js`, `mapa2.css`, `mapa.css`). App: lienzo (`frontend/src/features/hojasRuta/mapa/**`) con acnur_acg. Inventario de qa-visual-desktop, 1440×1000 y 1024×600, con capturas pareadas (fuera del repo, scratchpad `brecha/`). Veredicto: **RECHAZADO VISUAL**.

Estado: ☐ pendiente · ◐ en curso · ☑ hecho (con commit) · ⛔ bloqueado (decisión) · — anotado, no es brecha. Sólo Gonzalo da el checklist por terminado.

| # | Dónde | Tipo · impacto | Brecha | Dónde vive | Estado |
|---|---|---|---|---|---|
| B0 | Selección › ficha | bug · alto | «Ver la hoja de ruta» deja el proyecto «sin guardar» (`.register_output_file` escribe `files`) | `api/R/router_hojas_ruta_vista_previa.R` (`.hojas_ruta_vp_registrar`) | ☑ (ficha y hoja del día; test) |
| B1 | Barra superior | falta · alto | Zona de acciones: nombre, fase Piloto/Campo real con su regla, Bitácora con contador, «N por revisar», «Enviar a Material» | `HojasRutaMapaPage.tsx` (chrome) | ☐ |
| B2 | Indicadores | peor · medio (C5) | Población muestra el total, no la objetivo (2.39 M); sin formato compacto; orden distinto; UMP sin «R» | `HojasRutaMapaPage.tsx` | ☐ |
| B3 | Secciones | peor · medio (a11y) | Las 5 pastillas llevan `aria-current="page"` (NavLink ignora la query) | chrome de secciones | ☐ |
| B4 | Indicadores 1024 | peor · bajo | A 1024 esconde 2 de 4; el artefacto esconde los 4 y deja acciones | chrome | ☐ |
| B5 | Secciones | — | Barra superior en vez de rail (D1); sin «Entrega» ni «Avance» (D2) | — | — |
| B6 | Mapa | falta · alto | Cápsula de miga arriba a la izquierda (orientación + instrucción) | `lienzo/LienzoMapa.tsx` | ☐ |
| B7 | Mapa | falta · alto | Selector de capas Manzanas · Viviendas · NSE (hoy `capa="manzanas"` fijo) | `HojasRutaMapaPage.tsx:450`, `lienzo/capas.ts` | ☐ |
| B8 | Mapa | falta · alto | Leyenda por sección | `lienzo/` | ☐ |
| B9 | Mapa | peor · alto | Paleta de identidad por distrito (relleno, franja del rótulo); rótulos de Territorio sin población | `lienzo/capas.ts` | ☐ |
| B10 | Mapa | peor · alto | Anticolisión pierde rótulos (4/6 a 1440, 3/6 a 1024) y monta otros | `lienzo/` rótulos | ☐ |
| B11 | Mapa | peor · medio | Encuadre de Territorio con mucho blanco; sin nombres en gris de los distritos fuera | `lienzo/` | ☐ |
| B12 | Mapa | peor · alto | Foco de UMP no llega a calle (100 m) ni dibuja la manzana; «Acercar» no centra en la UMP | `lienzo/LienzoMapa.tsx` | ☐ |
| B13 | Mapa | peor · bajo | Fondo #f7f8fa vs #fafbff; encuadrar es «⤢» texto, no ícono | `lienzo/lienzoMapa.css` | ☐ |
| B14 | Inspector | peor · alto | Cabecera: ícono 40 px en tono de módulo, eyebrow versalitas, título | `*Paneles.tsx`, `mapaPage.css` | ☐ |
| B15 | Inspector | peor · medio | Rótulos de sección (LO ELEGIDO, MARCO TERRITORIAL, RESULTADO, MATRIZ) | Territorio, Población | ☐ |
| B16 | Muestra | peor · medio | Lógica del N, Confianza y DEFF como botones sueltos, no segmentado | `muestra/MuestraPaneles.tsx` | ☐ |
| B17 | Cajón | falta · alto | Cajón también desde Población («Ver matriz») y Muestra («Ver cuotas») | `seleccion/SeleccionPaneles.tsx` | ☐ |
| B18 | Cajón | peor · medio (C2) | Ancho limitado al lienzo; pestañas sin `aria-selected` ni activa visible; «×» texto; desborde 8/284 px; tapa zoom a 1024 | `.hr-sel-cajon` | ☐ |
| B19 | Salidas | peor · alto | Sideover con velo tapa el mapa; en el artefacto es sección con mapa por encuestador | `seleccion/SalidasPanel.tsx` | ☐ |
| B20 | Plan de campo | falta · alto | Lista por día y encuestador con color y «Hoja del día»; cifras derivadas; mapa por encuestador | `seleccion/PlanCampo.tsx` | ☐ |
| B21 | Plan / Muestra | peor · alto (C5) | Costos arrancan en 0 → sin costo estimado; Muestra no muestra la tarjeta de costo | `PlanCampo.tsx`, `muestra/costo.ts`, `HOJAS_RUTA_PLAN_DEFAULTS` | ☐ |
| B22 | Salidas | falta · medio | Botón «Ver el informe» (U16), «Enviar a Material», conteos del paquete, sugeridas para reemplazo puntual | `SalidasPanel.tsx` | ☐ |
| B23 | Bitácora | — (C5 legítimo) | Vacía en proyectos previos a U17: decirlo en la UI | `BitacoraSeccion.tsx` | ☐ |
| B24 | Territorio | peor · medio | Filtro como segmentado «Todos/Elegidos»; íconos en Agregar/Quitar; rótulo «ZONAS DE LIMA» | `territorio/TerritorioPaneles.tsx` | ☐ |
| B25 | Estructura | bug · medio (C4) | El scroll de la estructura pasa entre secciones (Territorio abre en 1869 px) | `.hr-mapa-estructura` | ☐ |
| B26 | Territorio 1024 | peor · bajo | Detalle del catálogo parte en 2 líneas («mz»); «Lima y Callao · 50 distritos» también | Territorio | ☐ |
| B27 | Territorio | falta · bajo | Fila «Cartografía: Lima 2017 · Callao 2019» | Territorio | ☐ |
| B28 | Población | falta · alto | Modo «Cortes poblacionales» (Manual/Cortes); total de personas junto a los rangos | `poblacion/PoblacionPaneles.tsx` | ☐ |
| B29 | Población | peor · alto (C2) | Matriz recortada en el inspector; faltan agrupar filas, columnas, «Ver matriz» y Excel | `PoblacionPaneles.tsx` | ☐ |
| B30 | Población | peor · bajo | «De la poblaci…» truncado; 76.8 % vs 77 %; el segmento 60+ pierde su % | Población | ☐ |
| B31 | Población | — | La app trae tope del último rango y «Calcular la matriz» | — | — |
| B32 | Muestra | falta · alto | «Repartir según población», «Mínimos» y Escenarios guardables | `muestra/MuestraPaneles.tsx` | ☐ |
| B33 | Muestra | falta · medio | Paso a paso de la ruta; atajos de margen; rótulos del DEFF; interruptor de inflar por no respuesta | `MuestraPaneles.tsx` | ☐ |
| B34 | Muestra | falta · medio | Alternativas sin su margen; ICC medidos a la vista | `MuestraPaneles.tsx`, `IccPanel.tsx` | ☐ |
| B35 | Muestra | falta · medio | Pie «Ver cuotas / Ir al sorteo» | `MuestraPaneles.tsx` | ☐ |
| B36 | Muestra 1024 | peor · medio | Lista de reparto con scroll anidado (deuda compartida con el artefacto) | `.hr-muestra-reparto` | ☐ |
| B37 | Muestra | — | La app suma ocupación, visitas P90, aviso MAS, FPC | — | — |
| B38 | Manzanas | falta · alto | «¿Se parece al marco?» (NSE marco vs muestra); deslizador del mínimo con atajos; cifras Elegibles/Fuera/Viviendas | `manzanas/ManzanasPaneles.tsx`, `MarcoElegiblePanel.tsx` | ☐ |
| B39 | Manzanas | falta · medio | Fila «Carga de la ruta»; «Dibujar un área a excluir» visible | Manzanas | ☐ |
| B40 | Manzanas | peor · medio | Filas de distrito 16 px sin punto ni cifra a la derecha; historial abajo y truncado | Manzanas | ☐ |
| B41 | Manzanas | — | La app trae historial real, exclusiones de piloto y comparar semillas | — | — |
| B42 | Selección | peor · alto | Filas de ruta: insignia numerada con color, código de manzana, dos líneas, viviendas a la derecha | `seleccion/SeleccionPaneles.tsx`, `rutas.ts` | ☐ |
| B43 | Selección | peor · medio (C5) | «Solo por revisar 12» vs «Por revisar 14» | Selección | ☐ |
| B44 | Ficha UMP | peor · alto | Cabecera con insignia, eyebrow y título; chevrons arriba; 0 viviendas en rojo con barra | `SeleccionPaneles.tsx` | ☐ |
| B45 | Ficha UMP | falta · medio | «Reemplazo puntual» y «Tablas» en la ficha; ayuda de orden; R con código de manzana | `SeleccionPaneles.tsx` | ☐ |
| B46 | Ficha UMP | peor · medio | La hoja como miniatura ilegible; modal grande con «Imprimir» | `HojaVista.tsx` | ☐ |
| B47 | Selección | — | La app trae revisión contra el marco más rica, ficha real y `?foco=` | — | — |

Geometría C1–C3: DEBT (falta `ui-quick-check --require-geometry` y cardinalidad baja).

## Lo aprendido

- El artefacto se sirve con un server con hilos y `charset=utf-8`; `python -m http.server` a secas rompe los fetch y los acentos.
- La sesión del navegador integrado es compartida entre pestañas de :5181 (`pulso.sessionId`): lo que muta una pestaña lo ve la otra.
