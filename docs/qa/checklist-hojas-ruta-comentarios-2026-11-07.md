# Checklist: comentarios de Gonzalo sobre Hojas de ruta (7 nov 2026)

Doc vivo (gate 5 de CLAUDE.md). Un ítem por indicación; sólo Gonzalo da el lote por terminado.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| H1 | Las siluetas se ven de mala calidad y no se alinean (el contorno de Ayacucho no calza con el de sus vecinos; en Lima, la costa del país no calza con los distritos) | `api/inst/hojas_ruta/build_limites_peru.R` → `build_contornos_por_region.R` → `peruDepartamentos.json` (nacional) + `peruDepartamentosDetalle.json` (fino); `mapa/lienzo/limites.ts` (`limitesALaEscala`), `useLimitesFinos.ts` | Hecho y verificado en vivo (acnur_acg): Ayacucho y la costa de Lima con una sola línea; gate del área verde |
| H2 | ¿Por qué ya hay un diseño configurado («6, 6 por ruta, por distrito») si recién entro al estudio? | `mapa/ajustes/BotonDiseno.tsx` (`resumenDiseno`); la página le pasa los distritos confirmados | Hecho: sin distritos dice «Por definir». Test en `barraDiseno.test.ts`; en vivo sólo se vio el caso con distritos (acnur_acg ya tiene 6) |
| H3 | Al entrar a una ciudad en Territorio no deja verla con las capas NSE, viviendas o población | Atlas con ciudad abierta: `territorio/capaDistritos.ts` + `CapaDistritosControles.tsx`; NSE por distrito en `api/R/hojas_ruta_nse_distrito.R` (sumado a los territorios) | Hecho a nivel de distrito (pedido de Gonzalo: nada pesado) y verificado en vivo con Arequipa: Población y NSE |
| H4 | Con una ciudad abierta (la del clic, no una elegida para el estudio) no debería poder alejarme y ver otra; se vuelve con el selector de territorio | `lienzo/camara.ts` (`acotarACaja`), prop `limiteCamara` de `LienzoMapa`; la página la fija con la ciudad abierta en Territorio | Hecho y verificado en vivo con Arequipa: la rueda se detiene en el encuadre de la ciudad, el arrastre no la saca y la miga «Perú» vuelve al país; test `limiteCamara.test.ts` |

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
