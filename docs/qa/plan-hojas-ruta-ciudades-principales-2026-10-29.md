# Plan — Hojas de ruta en las ciudades principales, con el marco al año más reciente posible

Tipo: Plan de implementación
Estado: En curso
Fecha: 2026-10-29
Autoridad: ADR 0119

Decisión: [ADR 0119](../adrs/0119-hojas-de-ruta-cobertura-ciudades-principales.md) (Propuesto)

## Pedido

1. Actualizar los datos por manzana (NSE, viviendas, población) al año más reciente posible.
2. Sumar todas las ciudades principales del Perú, no solo Lima y Callao.

## Lo que ya se sabe (no reinvestigar)

- **NSE por manzana:** solo existe el de CPV 2017 + ENAHO 2017-18. La capa nacional de GeoPeru
  (`https://descargas.geoperu.gob.pe/peru_estrato_nacional_.zip`, 35 MB, archivo del 28-05-2026) trae 267 846 filas
  en 231 distritos y 71 provincias, con campos `IDMZ18, PERSON, HOG, INGR_PER, ESTR_N1, DESC_INGPE`. Su readme
  permite reutilizarla citando a INEI y GeoPeru.
- **CPV 2025:** el REDATAM (`CPV2025DI`) llega solo a distrito. Lima Metropolitana viene como `27xxxx`. Los conteos
  por distrito de Lima y Callao ya están extraídos (ver la memoria `reference_censo_2025_inei_nivel_distrital`).
- **Viviendas 2017 por manzana fuera de Lima:** `MANZANAS PRINCIPALES CIUDADES CENSO 2017 con provnro.sav` en
  `~/Documents/Pulso/01_Estudios/2025_GIZ_Estudio_Institucional/drive_insumos_descarga_relevante/CARTOGRAFÍAS CENSO 2017 INEI/MARCOS MUESTRALES INEI 2017/`
  trae 135 115 manzanas, 126 distritos, `VIVIENDAS` y `NSE`.
- **La ruta por defecto de los scripts está vieja:** `build_inei2017_layers_lima_callao.R` apunta a
  `~/Documents/Pulso/GIZ/...`; la carpeta real está en `01_Estudios/2025_GIZ_Estudio_Institucional/`.
- **Peso medido:** la geometría de 128 157 manzanas fuera de Lima pesa 16,1 MB (15 decimales) o 7,5 MB
  (6 decimales). Lo nacional agrega unos 40–60 MB sobre un instalador de 846 MB a 1,1 GB.
- **Código atado a Lima:** `.hojas_ruta_cartografia_profile_for_ubigeo` (`hojas_ruta_engine.R` ~1082; el archivo
  está congelado a crecimiento); en el front, `limaDistrictCoverage.json`, `HojasRutaPage.tsx` y los tests de
  `mapa/`.

## Aprendido en la oleada A

- **El SAV de «principales ciudades» no sirve como marco**: 57 427 de sus 135 115 manzanas traen `VIVIENDAS` vacío,
  la columna `NSE` es «-» en todas, y solo calza con el 68 % de los ids de GeoPeru. El conteo sale del REDATAM CPV 2017
  por manzana (unos 5 s por distrito, cacheado en `redatam_manzana_cache`, dentro de la carpeta temporal del repo).
- **Los «Sin Data» de la capa GeoPeru son polígonos sin `IDMZ18`**, no manzanas censales sin estrato: quedan fuera del
  marco. Entre las manzanas con id, todas traen estrato.
- **Una manzana sin fila en REDATAM es una manzana sin viviendas censadas** (parques, plazas, comercio): 28 % en el
  Cercado de Arequipa. Va como `viviendas = 0` y `match_level = sin_conteo_redatam`, igual que en Lima (ADR 0115).
- **La capa trae anillos inválidos** que el motor esférico (s2) rechaza al unir: el builder trabaja en plano y mide
  el área en una cónica equivalente.
- **Prueba en dos distritos** (Arequipa y Chaupimarca): mediana de 3 044 m² por manzana (Lima: 2 599) y 25 viviendas
  por manzana con conteo (Lima: 17).

- **Cobertura por provincia medida contra el CPV 2025** (`cobertura_provincias.csv` en el scratchpad de la sesión):
  de las 71 provincias, solo 9 pasan los tres umbrales del ADR 0119 §1. Cuatro tienen más población 2017 en la capa
  que en el CPV 2025 de sus distritos (Paita, Talara, Mariscal Nieto, Yauli): hay que revisar el cruce de ubigeo antes
  de usarlas. En el CPV 2025, el código 26 es Lima provincias y el 27 es Lima Metropolitana (ambos son `15` en 2017).

- **La captación se mide con el REDATAM, no con `PERSON`**: el campo de la capa subestima la población y dejaba
  fuera a Cusco (54 % contra 77 % real). Huaral quedó justo bajo el corte (54,9 % / 64,6 %).
- **El ingreso per cápita de GeoPeru viene como texto con separador de miles** («1,027»): `as.numeric` lo volvía NA
  desde 1 000. Corregido en el builder; el paquete de Lima no tenía el defecto.
- **La cobertura varía dentro de una provincia**: en Cusco, San Jerónimo capta 50 % y el Cercado 93 %. Por eso el
  registro la publica por distrito.

- **La geometría de ciudades usa el esquema de propiedades de Lima** (`ID_MANZANA`, `FTE_MZNA`, `AREA_M2`…): el
  engine normaliza y enriquece por `ID_MANZANA` = `id_manzana` del marco. Con otro esquema, el id salía vacío.
- **Empaquetar no basta para sortear**: el engine solo lee el marco y el NSE de Lima. Eso es el ítem 7b (B2).

- **Combinar marcos exige el esquema del histórico**: el marco `current` de Lima no trae `id_manzana_norm` (el
  engine la deriva) y el de ciudades sí; al combinarlos Lima quedaba sin NSE. Las ciudades se recortan a las columnas
  del archivo histórico.
- **El resumen del marco se cachea en disco** con una firma que solo mira el archivo de Lima: hubo que subir la versión
  de las cachés del marco, del resumen y de la edad.
- **Por defecto se ve la vista heredada de Territorio**: el lienzo del ADR 0114 está detrás del interruptor
  `prosecnur:hojas-ruta:lienzo` en `localStorage`. El runner de QA lo siembra con `UI_QA_LOCAL_STORAGE`.

## Checklist

| # | Ítem | Dónde vive | Responsable | Estado |
|---|---|---|---|---|
| 0 | Ratificar el ADR 0119 (dentro del instalador, registro, `anio_dato`, `sin_estrato`, marco 2025 opcional) | ADR 0119 | Gonzalo | hecho — ratificado el 2026-10-29 (§5 sigue propuesto) |
| 1 | Definir la lista de ciudades | ADR 0119 §1 | Gonzalo | hecho — niveles 1 y 2: 25 provincias (Cusco y Tarapoto incluidas); el builder calcula el nivel |
| 2 | Script reproducible de insumos (incluye CPV 2025 por distrito): capa GeoPeru, SAV de ciudades, REDATAM 2017 por manzana para los distritos que falten, CPV 2025 por distrito con traducción `27→1501` | `api/inst/hojas_ruta/build_inei2017_ciudades.R` + `redatam2017_manzana.R` (nuevos) | backend-r | hecho — 26→25 provincias, 92 057 manzanas, salida determinista (dos corridas, 120 archivos idénticos) |
| 3 | Corregir la ruta por defecto del Drive en los scripts de build existentes | `api/inst/hojas_ruta/build_inei2017_*.R` | backend-r | hecho |
| 4 | Registro `territorios.json` y lector; migrar Lima y Callao sin tocar sus archivos | `api/R/hojas_ruta_territorios.R` (nuevo) + `api/inst/hojas_ruta/territorios.json` | backend-r | hecho — `territorios.json` con 27 provincias (Lima y Callao + 25), lector en `api/R/hojas_ruta_territorios.R`; Lima y Callao conservan sus archivos y perfiles |
| 5 | Reemplazar los regex `^1501` / `^0701` por consultas al registro | `hojas_ruta_engine.R` (sin crecer) | backend-r | hecho — `.hojas_ruta_cartografia_profile_for_ubigeo` consulta el registro; el engine no creció |
| 6 | `anio_dato` y `descargado` obligatorios; corregir `year: 2026` del NSE GeoPeru | manifiestos en `api/inst/hojas_ruta/` | backend-r | hecho — NSE con `anio_dato: 2017`; el engine lee `anio_dato` y cae en 2017, no en 2026 |
| 7 | Empaquetar las ciudades: manzanas (6 decimales, salida determinista), marco 2017, NSE con `sin_estrato`, zonas derivadas de `IDMZ18`, calles OSM (Geofabrik Perú) | `api/inst/hojas_ruta/cartografia/*` | backend-r | hecho (parcial) — manzanas, marco 2017 y NSE de 25 provincias en el paquete (~11 MB, `api/inst/hojas_ruta` pasa de 68 a 77 MB); salida determinista. Faltan zonas derivadas y calles OSM de las ciudades (opcionales en el registro) |
| 8 | Tests de contrato del ADR 0119 (registro↔archivos, `anio_dato`, `sin_estrato`) | `test-hojas-ruta-anio-dato.R` (verde) + `test-hojas-ruta-territorios.R` (rojo hasta la oleada B) | autor-regresiones | hecho — `test-hojas-ruta-territorios.R` en verde (5 tests) |
| 7b | **B2 — el engine carga marco y NSE de las ciudades**: `hojas_ruta_inei_frame` y `hojas_ruta_nse_inei` suman los archivos del registro; cambian contratos (`n_distritos == 50` en `test-hojas-ruta-engine.R`, la lista de territorios que lee el selector), así que va junto con el ítem 9 y revisión de `guardian-contratos` | `api/R/hojas_ruta_territorios.R` + cargadores | backend-r | hecho — marco (current y oficial), NSE y edad simple suman las ciudades del registro; Lima y Callao idénticos a antes (comparado contra HEAD~2); sorteo en Arequipa: 20 manzanas + 20 reemplazos, 120 entrevistas, 0 sin asignar, PPS v2 con NSE |
| 9 | Front: el selector de territorio y el encuadre del mapa salen del registro, no de `limaDistrictCoverage.json`; se muestra el año del dato | `frontend/src/features/hojasRuta/` | frontend-react | en curso — el catálogo de Territorio del lienzo agrupa por provincia, cada distrito dice «capta X %», el marco de un porcentaje es el de su provincia; falta que el mapa dibuje las ciudades (hoy solo Lima) y que la vista heredada (`HojasRutaPage`, la que se ve sin el interruptor del lienzo) también agrupe |
| 10 | `sin_estrato` con color y conteo propios en el mapa y en las salidas | front + PDF de hojas | frontend-react / especialista-entregables | pendiente |
| 11 | QA visual con una ciudad fuera de Lima (Arequipa) en la matriz de viewports | `make ui-quick-check` / `/ver-ui` | qa-visual-desktop | pendiente |
| 12 | Crecimiento edificado 2017→2023 por manzana con Open Buildings Temporal (vía Earth Engine o descarga de HDX) | script de build (nuevo) | backend-r | **bloqueado: acceso** (definir si se usa cuenta de Earth Engine o el archivo de HDX) |
| 13 | Marco `inei2017_calibrado_cpv2025`: viviendas × crecimiento, rastrillado a los totales CPV 2025 por distrito; brecha de cobertura por distrito | `api/R/hojas_ruta_marco_2025.R` (nuevo) | backend-r | pendiente (después de 12) |
| 14 | Revisión metodológica del marco 2025 (cambia `M_i` del PPS del ADR 0117) | ADR 0119 §5 | revisor-metodologico | pendiente (después de 13) |
| 15 | Opcional: rehacer la cartografía de Lima a 6 decimales (de 23 MB a ~11 MB), comprobando que el sorteo y las exclusiones del ADR 0115 dan lo mismo | `cartografia/manzanas_inei2017_lima_callao` | backend-r | **bloqueado: decisión** |
| 17 | **Cobertura en el mapa** (ADR 0119 §7): el selector de Territorio pinta cada provincia y distrito por nivel y muestra cobertura cartográfica y captación antes de elegir; aviso bajo 55 %; el informe de diseño y la ficha técnica repiten la cobertura de lo sorteado | `frontend/src/features/hojasRuta/mapa/territorio/` + informe | frontend-react / especialista-entregables | en curso — la captación por distrito se ve en la lista y en la ficha, con aviso bajo 55 %; falta pintar el nivel en el mapa del Perú y repetirla en el informe y la ficha técnica |
| 16 | Gate: `make gate-area AREA=hojas-ruta`, `make gate-front AREA=hojasRuta`, `verificador` | — | verificador | pendiente |

## Orden y oleadas

1. **Oleada A (después del 0 y el 1):** ítems 2, 3, 6 (backend-r) en paralelo con 8 (autor-regresiones, en rojo).
2. **Oleada B:** 4, 5 y 7 (backend-r); revisión de `guardian-contratos` sobre el registro.
3. **Oleada C:** 9 y 10 (frontend-react), luego 11 (QA visual).
4. **Oleada D, independiente de B y C:** 12 → 13 → 14. No bloquea las ciudades: el marco 2025 es una fuente
   opcional.
5. Cierre: 16 y `/cerrar-trabajo`, un commit por oleada.

## Fuera de alcance

- NSE por manzana posterior a 2017: no existe. Se reemplaza cuando el INEI publique el CPV 2025 por manzana.
- Rasters WorldPop dentro del instalador: si se usan, solo como insumo del build, no empaquetados.
