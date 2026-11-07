# Checklist: comentarios de Gonzalo sobre Hojas de ruta (7 nov 2026)

Doc vivo (gate 5 de CLAUDE.md). Un ítem por indicación; sólo Gonzalo da el lote por terminado.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| H1 | Las siluetas se ven de mala calidad y no se alinean (el contorno de Ayacucho no calza con el de sus vecinos; en Lima, la costa del país no calza con los distritos) | `api/inst/hojas_ruta/build_limites_peru.R` → `build_contornos_por_region.R` → `peruDepartamentos.json` (nacional) + `peruDepartamentosDetalle.json` (fino); `mapa/lienzo/limites.ts` (`limitesALaEscala`), `useLimitesFinos.ts` | Hecho y verificado en vivo (acnur_acg): Ayacucho y la costa de Lima con una sola línea; gate del área verde |
| H2 | ¿Por qué ya hay un diseño configurado («6, 6 por ruta, por distrito») si recién entro al estudio? | `mapa/ajustes/BotonDiseno.tsx` (`resumenDiseno`); la página le pasa los distritos confirmados | Hecho: sin distritos dice «Por definir». Test en `barraDiseno.test.ts`; en vivo sólo se vio el caso con distritos (acnur_acg ya tiene 6) |
| H3 | Al entrar a una ciudad en Territorio no deja verla con las capas NSE, viviendas o población | Atlas con ciudad abierta: `territorio/capaDistritos.ts` + `CapaDistritosControles.tsx`; NSE por distrito en `api/R/hojas_ruta_nse_distrito.R` (sumado a los territorios) | Hecho a nivel de distrito (pedido de Gonzalo: nada pesado) y verificado en vivo con Arequipa: Población y NSE |
| H4 | Con una ciudad abierta (la del clic, no una elegida para el estudio) no debería poder alejarme y ver otra; se vuelve con el selector de territorio | `lienzo/camara.ts` (`acotarACaja`), prop `limiteCamara` de `LienzoMapa`; la página la fija con la ciudad abierta en Territorio | Hecho y verificado en vivo con Arequipa: la rueda se detiene apenas pasado el encuadre de la ciudad y la ciudad no sale de la pantalla (ajustado tras la revisión: el primer límite dejaba Lima media fuera a 20 km) y la miga «Perú» vuelve al país; test `limiteCamara.test.ts` |
| H5 | La paleta del mapa se ve tosca y poco elegante (NSE, y en general todas las del mapa). Gonzalo: «con las recomendaciones profesionales y como lo hacen los organismos más profesionales» | `app/tokens-datos.css` (`--pulso-nse-*`, `--pulso-mapa-viv-*`, `--pulso-mapa-tono-*`); densidad y clases en `territorio/capaDistritos.ts`; leyenda por rangos en `CapaDistritosControles.tsx`; bordes en `HojasRutaMapaPage.tsx` | Hecho y verificado en vivo con Lima: NSE divergente, población por densidad con leyenda por rangos, bordes blancos y tonos Tol en «Elegir distritos» (`tmp/paletas-mapa/resultado-paletas.png`) |
| H6 | Al abrir una ciudad y hacer clic en un distrito, el mapa vuelve al Perú | Clic del atlas en `HojasRutaMapaPage.tsx` (antes buscaba el círculo de la ciudad y, si no, el departamento); ficha `FichaDistritoAtlas` en `territorio/CapaDistritosControles.tsx` | Hecho y verificado en vivo: con Lima abierta, clic en Lurigancho y en el Cercado abre la ficha del distrito (con su NSE) y la ciudad sigue abierta |
| H7 | En la ciudad del estudio, con una capa por distrito, el distrito confirmado pinta su fondo y sus manzanas quedan grises encima | `HojasRutaMapaPage.tsx`: el lienzo recibía las manzanas de los confirmados también con la coropleta activa | Hecho y verificado en vivo: con una capa por distrito no se dibujan las manzanas y cada distrito confirmado muestra su color |
| H8 | La ficha del distrito corta la cifra («152,828» contra el divisor) y puede verse más elegante | `mapa/mapaPage.css` (`.hr-ter-ficha-cifras`: columnas al ancho de su cifra), `mapa/nacional/nacional.css` (ficha flotante a la escala del título, ancho al contenido), `FichaDistritoNacional.tsx` (marca de color junto al NSE) | Hecho y verificado en vivo (Cieneguilla en Lima): cifras completas sin corte, NSE con su color y divisor |
| H9 | Con una ciudad abierta, un clic fuera de sus distritos (el mar, el vacío) devuelve al Perú | Clic del atlas en `HojasRutaMapaPage.tsx` | Hecho y verificado en vivo: el clic fuera sólo cierra la ficha; de la ciudad se sale por la miga o «Todo el Perú» |
| H10 | ¿Sería muy pesado añadir una capa de relieve 3D para dar contexto y que no se vea tan vacío? | Maqueta: `tmp/paletas-mapa/maqueta-relieve.png` (Copernicus DEM 90 m, sombreado multidireccional al 14 %, mar celeste). En la app: imagen por ciudad bajo los distritos | **Bloqueado: decisión de Gonzalo** sobre la maqueta (nivel del relieve) |
| H11 | El problema ahora es el rótulo de los nombres | `lienzo/capas.ts` (`dibujarNombresFuera`, `esOscuro`): tinta según el relleno (blanca sobre oscuro, oscura sobre claro), halo fino del color del distrito, peso medio; `territorio/capaDistritos.ts` (`rellenoDistrito`) | Hecho y verificado en vivo (atlas de Lima en las cuatro capas y acercado al centro) |
| H12 | Probar cómo se ve con las otras vistas: viviendas, manzanas y a nivel distrito | Recorrido en `tmp/paletas-mapa/recorrido-capas.png`. Hallazgo corregido: con Viviendas o NSE por manzana el distrito llevaba su color de identidad (el verde de Ate) y competía con las manzanas; ahora queda en gris neutro (`HojasRutaMapaPage.tsx`, `capaContraste`) | Hecho y verificado en vivo (Ate con Manzanas, Viviendas y NSE, a escala de ciudad y de distrito) |

## H1: diagnóstico y arreglo

- **Causa.** `build_contornos_por_region.R` volvía a simplificar **cada departamento por su cuenta** a 3 km y redondeaba a 2 decimales
  (~1,1 km). La frontera entre dos vecinos salía distinta en cada uno: dos líneas que no calzan, más los picos que deja el
  redondeo. El mismo trazo nacional se usaba con un departamento llenando la pantalla (~500 m por píxel), donde 3 km se ven quebrados.
- **Arreglo.** `build_limites_peru.R` parte de las provincias del IGN a resolución completa y simplifica con **topología
  compartida** (mapshaper 0.6.102 vía npx): cada frontera se simplifica una vez y la usan los dos lados; departamentos y
  país salen de disolver las provincias ya simplificadas. Dos niveles del mismo pipeline: nacional (3 km, 55 KB, en el
  bundle) y fino (400 m, 418 KB, chunk aparte que se pide al abrir el mapa). El lienzo usa el fino desde `ESCALA_DETALLE`
  (unos 2 km por píxel), para las líneas grises, el contorno del departamento enfocado y el clic.
- **Test.** `mapa/lienzo/limitesTopologia.test.ts`: ningún tramo de un departamento corre paralelo a la frontera del
  vecino. En rojo con el `peruDepartamentos.json` anterior (25 pares), en verde con el nuevo.
- **Excepción declarada.** El lago Junín (Chinchaycocha) no es de ningún departamento: las orillas de Pasco y Junín son dos
  líneas reales, a unos 150 m en su punta norte.
- **Efecto lateral.** Los paquetes `contornos/<región>.json.gz` se regeneran con las provincias del nivel fino (347 → 463 KB
  gzip en total). Hoy ni el lienzo ni el PDF leen esas provincias.
- **Verificado en vivo** (proyecto de referencia acnur_acg, 1440x1000): con Ayacucho enfocado el contorno del acento es una
  sola línea con sus vecinos y conserva el detalle; alejándose de Lima, la costa del país (IGN) sigue la de los distritos
  (IMP). `make gate-front AREA=hojasRuta`: 89 archivos, 991 tests en verde; `tsc` limpio.

## H2: diagnóstico

El botón resumía `integrated_config` (valores por defecto: 6 entrevistas por ruta) y una n que la calculadora saca sin
distritos. Ahora, sin distritos confirmados, dice «Por definir» (como «Lo decidido»); en barra angosta, «—».

## H3: decisión y arreglo

- **Por qué a nivel de distrito.** Pintar NSE o viviendas por manzana exige leer las manzanas de cada distrito: la primera
  lectura tarda unos 15 s (medido: 150101 en 17 s, 150140 en 16 s; con caché, 0,08 s). Lima tiene 50 distritos: unos
  12 minutos. Gonzalo pidió que no fuera pesado y que, si demora, quede a nivel de distrito.
- **Qué hace.** Con una ciudad abierta en el atlas aparece el selector «Distritos, Población, Viviendas, NSE». Población y
  viviendas van en seis clases por cuantiles de los distritos de esa ciudad (la rampa de viviendas del mapa); NSE es el
  nivel que predomina entre los hogares del distrito (GeoPeru/INEI 2017), con la leyenda de NSE de siempre.
- **Trampa encontrada.** En los CSV de NSE `nse_codigo` 1 es BAJO; el lienzo usa 1 = Alto. El nivel se toma del rótulo
  (`.hojas_ruta_geometria_nivel_nse`), como en la geometría. Leerlo tal cual ponía a Carabayllo y SJL como Alto.
- **Caché.** Los territorios salen del resumen del marco cacheado en disco: se subió su versión a `summary-v5-nse-distrito`
  para que el campo nuevo llegue.
- **Fuera de alcance.** En la ciudad del estudio (`foco=lima`, «Elegir distritos») sigue el selector por manzana, que
  pinta sólo los distritos confirmados.

## H4: arreglo

Con una ciudad abierta en Territorio (atlas o «Elegir distritos»), la cámara no se aleja más que el encuadre de la ciudad
con un 25 % de margen por lado y su centro no sale de la caja de la ciudad. Acercarse sigue libre. Para volver al Perú:
la miga («Perú ›») o «Todo el Perú».

## Verificación del lote (H2 a H4)

- `make gate-front AREA=hojasRuta`: 91 archivos, 997 tests en verde; `tsc` limpio.
- `make gate-area AREA=hojas-ruta GATE_ARGS='--patron "nse-distrito|territorios"'`: 1160 pruebas, 0 fallas (con los
  transversales: errors-registry, namespace-contract y demás).
- En vivo con acnur_acg (backend propio en 8841, 1440x1000): Arequipa abierta en el atlas con Población y NSE por
  distrito; límite de la cámara; regreso por la miga.

## H5: diagnóstico y propuestas

- **Medido** (validador de paletas de la skill dataviz, superficie `#fafbff`, todos contra todos porque es un mapa): la
  paleta actual del NSE falla. Alto (violeta) y Medio alto (azul) son el mismo color para un deuteranope (ΔE 0,4) y casi
  iguales con visión normal (12,4); el verde azulado de Medio casi no tiene croma. Son colores de interfaz a plena
  saturación, sin relación entre sí ni con el terracota del módulo.
- **Forma.** El NSE tiene orden y un centro (Medio): va en divergente, dos tonos que se alejan de un gris cálido. No es
  «intensidad de un solo tono», que Gonzalo descartó para el NSE.
- **A, validada estricta:** Alto `#2c4c84`, Medio alto `#6a8cc0`, Medio `#b9b4aa`, Medio bajo `#bd7a1c`, Bajo `#6f4507`
  (ΔE 15 con daltonismo, 17 con visión normal). Población y viviendas en la secuencia azul de datos v3 sin su escalón
  más claro. En Lima los extremos oscuros pesan: el marrón de Bajo ocupa los distritos grandes.
- **B, más suave:** Alto `#3d5f96`, Medio alto `#86a2cb`, Medio `#c4bfb5`, Medio bajo `#cf9445`, Bajo `#97621f` (ΔE 11
  con daltonismo, 13 con visión normal: se distinguen, con la leyenda y la ficha de apoyo). Población y viviendas
  `#a9c0f0` a `#1d3770`, menos saturada.
- **Al aplicar:** los mismos tokens pintan la capa por manzana (Viviendas y NSE), así que cambia también ahí. Pendiente
  en la misma tanda: bordes blancos finos entre distritos coloreados y bajar la saturación de los tonos de distrito
  del estudio (`--pulso-mapa-tono-*`).

## H5: lo aplicado (decisión: recomendaciones profesionales)

Referencias revisadas: ONS (service manual y guía geoespacial), Banco Mundial (guía de visualización), Datawrapper,
ColorBrewer (Brewer et al., estudio de mapas de mortalidad), CARTOColors, Paul Tol (SRON), INEI (planos estratificados).

- **NSE divergente** (propuesta B): Alto `#3d5f96`, Medio alto `#86a2cb`, Medio `#c4bfb5`, Medio bajo `#cf9445`,
  Bajo `#97621f`; sin dato `#e1e4ea`. Medidas comparables a ColorBrewer BrBG y CARTO Earth, con el centro visible.
- **Población y viviendas por densidad** (por km²), nunca totales: regla de la ONS para coropletas. El área sale del
  contorno del distrito, con los huecos descontados y corregida por latitud (el lienzo usa la escala de Lima).
  Para Lima el contorno es el distrito del IMP; en las demás ciudades, la huella urbana: dentro de una ciudad la base es
  la misma.
- **Cinco clases por cuantiles** (la cifra habitual de la ONS), y la leyenda da el **rango de cada clase**.
- **Rampa de cantidades** en el azul de datos de la dirección v3, menos saturado (`#b7c9ec` a `#253f7a`); la densidad
  usa los cinco escalones más oscuros (el más claro no llega a 2:1 sobre el fondo). La capa de viviendas por manzana
  usa la misma rampa.
- **Bordes blancos finos** entre distritos coloreados.
- **Tonos de los distritos del estudio**: paleta «muted» de Paul Tol, categórica y apta para daltonismo, en el orden que
  maximiza la separación entre vecinos (ΔE 12,9 con daltonismo; 17,8 con visión normal).
