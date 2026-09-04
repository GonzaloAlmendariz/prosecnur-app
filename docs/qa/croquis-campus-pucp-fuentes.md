# Croquis del campus PUCP — fuentes del mapeo letra → posición (B32)

Fecha de consulta: 2026-09-02. Este documento respalda las coordenadas
embebidas en `api/R/collection_render_croquis.R`. El croquis es un **dibujo
estilizado propio** (SVG/grid nuestro, plan view con norte arriba); el mapa
oficial isométrico se usó **solo como referencia posicional**, nunca se
incrusta su bitmap.

## Fuentes consultadas

1. **Mapa interactivo oficial** — https://www.pucp.edu.pe/mapa-campus/.
   La página embebe TODOS sus marcadores inline (título + lat/lng + tipo).
   Existen marcadores directos `Pabellón <letra>` (tipo «Otros») para
   A, B, D, E, F, G, H, I, J, L, M, N, O, P, Q, R, U, X y Z. Es la fuente
   primaria: cuando existe marcador directo, esa es la coordenada usada.
2. **Descubre PUCP** — https://descubre.pucp.edu.pe/poi/ (buscador oficial de
   lugares). Resuelve la identidad letra → unidad (p. ej. `fac005`:
   «Facultad de Arte y Diseño (pabellón Y)») y los vecinos de cada POI.
3. **OpenStreetMap** (Overpass, bbox del campus): edificios con nombre y
   calles. Confirma V («Pabellón V - Sección Electrónica, Informática y
   Telecomunicaciones»), U, O, P, Z y da el marco vial: **Av. Universitaria
   al ESTE** (centroide -12.07038, -77.07857), **Av. José de la Riva Agüero
   al OESTE** (centroide -12.06850, -77.08252).
4. **PDF oficial isométrico** (`mapa-campus-pucp-oficial.pdf`, descargado y
   autorizado): rotula «Pabellón A “Aulario”» y las entradas
   Principal / Unión / Riva-Agüero. Ojo: su vista está rotada (el oeste
   apunta arriba); las coordenadas de 1–3 son las que mandan.

## Pabellones (letra → lat, lng, fuente)

Clasificación: **oficial** = marcador directo `Pabellón <letra>` del mapa
oficial · **osm** = edificio nombrado en OSM · **google** = place público de
Google Maps (barrido 2026-09-03) · **derivada** = centroide de marcadores
oficiales adyacentes que nombran el pabellón · **confirmada** = corregida en
vivo por el dueño con captura · **aproximada** = sin marcador propio en
ninguna fuente; posición inferida y declarada.

| Letra | Lat | Lng | Fuente | Identidad / nota |
|---|---|---|---|---|
| A | -12.072545 | -77.079539 | oficial | Aulario del CIA (Descubre `lug066`; OSM «Pabellón A» -12.072703,-77.079543 ✓) |
| B | -12.072739 | -77.079625 | oficial | Fac. Ciencias e Ingeniería (WIFI oficial «(Pabellón B)» ✓) |
| D | -12.069849 | -77.080512 | oficial | junto a Derecho / CC.SS. |
| E | -12.070985 | -77.079311 | oficial | EEGG Ciencias (Descubre `fac001`; OSM ✓ exacto) |
| F | -12.071556 | -77.080365 | oficial | Física (OSM «Física» -12.071492,-77.080351 ✓) |
| G | -12.071198 | -77.078940 | oficial | Fac. Ciencias Contables (Descubre `fac003`; OSM «Fac. Contabilidad» ✓) |
| H | -12.069614 | -77.081231 | oficial | Fac. Letras y CC.HH. (Descubre `fac012`; marcador «Edificio H» ✓) |
| I | -12.070515 | -77.078737 | oficial | Aulas y talleres de Arte (Descubre `lug010`). OSM ubica ahí a Esc. de Gobierno; la cafetería «(Pabellón I)» oficial está ~80 m al oeste. Se usa el marcador oficial; vecindad ambigua declarada. |
| J | -12.070352 | -77.080311 | oficial | junto a CC.SS. |
| K | -12.072890 | -77.082775 | **google** | «PABELLÓN K (Sec. Mecatrónica PUCP)» — place público, barrido 2026-09-03; el venue real «K301» dejó de caer en desconocido |
| L | -12.067530 | -77.080201 | oficial | EEGG Letras (Descubre `fac002`; OSM ✓ exacto) |
| M | -12.071597 | -77.081676 | oficial | zona Ingeniería (Minas/Civil cerca) |
| N | -12.068663 | -77.078801 | oficial | Complejo Felipe Mac Gregor (marcador oficial del complejo ✓) |
| O | -12.072765 | -77.082621 | oficial | Ing. Industrial (Descubre `lug025`; OSM «Pabellón O» ✓ exacto) |
| P | -12.072239 | -77.078092 | oficial | CEPREPUCP / Idiomas (OSM «Idiomas PUCP» ✓ exacto; OSM «CEPREPUC (Pabellon P)» ~100 m al SO — divergencia declarada, manda el marcador oficial) |
| Q | -12.071231 | -77.078530 | oficial | Depto. Ciencias Contables (marcador oficial del depto ✓ exacto) |
| R | -12.067682 | -77.079144 | oficial | Fac. Educación (Descubre `fac010`; marcador oficial de la facultad ✓) |
| U | -12.072251 | -77.081060 | oficial | Sección Ing. Mecánica (OSM «(Pabellón U)» ✓) |
| V | -12.073125 | -77.081880 | osm | «Pabellón V - Sección Electrónica, Informática y Telecom.» (OSM). Proxies oficiales: bicicletas V (-12.073187,-77.082232) y teléfono V (-12.072885,-77.082083) ✓ |
| X | -12.065333 | -77.078511 | oficial | Fac. Artes Escénicas (Descubre `fac013`), extremo norte |
| Y | -12.066823 | -77.078832 | **derivada** | Fac. Arte y Diseño (Descubre `fac005`). SIN marcador propio en mapa oficial ni OSM. Centroide de tres marcadores oficiales que la nombran: «Cafeta de arte» (-12.066784,-77.078968), «Talleres de la Facultad de Arte» (-12.066941,-77.078994), «bicicletas - Facultad de Arte» (-12.066745,-77.078533). |
| Z | -12.069115 | -77.080909 | oficial | Aulas multiuso (Descubre `lug027`; OSM ✓; fotocopiadora/rotonda Z ✓) |

Letras del operativo HSVG2026 sin edificio en NINGUNA fuente: ninguna
(las 18 letras de la leyenda quedan cubiertas). B, F y U no están en la
leyenda del operativo pero existen en el campus y se dibujan en trazo suave
como referencia.

## Hitos de orientación (no pabellones)

| Hito | Lat | Lng | Fuente |
|---|---|---|---|
| Biblioteca Central | -12.069037 | -77.079997 | oficial |
| Edificio Dintilhac | -12.069530 | -77.079396 | oficial |
| Tinkuy | -12.068131 | -77.079469 | oficial |
| Comedor Central | -12.070422 | -77.081178 | oficial |
| Capilla | -12.069567 | -77.080103 | oficial |
| Coliseo Polideportivo | -12.066931 | -77.079950 | oficial |
| Complejo de Innovación Académica (CIA) | -12.072085 | -77.080308 | oficial |
| Fac. Arquitectura | -12.071692 | -77.080885 | oficial |
| Fac. Derecho | -12.069924 | -77.080494 | oficial |
| Fac. Ciencias Sociales | -12.070623 | -77.080124 | osm |
| Huaca 20 / Museo de Sitio | -12.069530 | -77.082482 | osm |
| Rotonda Letras | -12.067537 | -77.080204 | google (place público) |

## Puertas

| Puerta | Lat | Lng | Lado | Fuente |
|---|---|---|---|---|
| Principal (Av. Universitaria 1801) | -12.069050 | -77.078300 | este | derivada (paradero Plaza Bus «Puerta principal» -12.069205,-77.078404; motos -12.068891,-77.078550) |
| Unión | -12.071500 | -77.078500 | este | derivada (bicicletas/motos/teléfono «Unión» a lat -12.0714…-12.0716) |
| Riva-Agüero | -12.068896 | -77.082009 | oeste | osm (edificio «Entrada» sobre Av. Riva Agüero) + PDF oficial |
| Puerta 8 | -12.066691 | -77.078060 | noreste | **google** — place público «Puerta Nº 8 - Rosales - PUCP» (barrido 2026-09-03) |
| Puerta 10 | -12.067052 | -77.080572 | norte | **aproximada** (marcador oficial de motos «Puerta 10»; el punto cae al interior — se dibuja sobre el borde norte más cercano) |

## Capa de geometría (huellas, caminos, verdes)

Tras el dictado «le falta muchísimo detalle» (2026-09-02), el croquis dibuja
las **huellas reales** de ~248 edificios del campus, ~324 caminos internos
(peatonales y de servicio) y ~86 áreas verdes/canchas. Fuente: extracto de
**© OpenStreetMap contributors (ODbL)** del 2026-09-02, bajado por Overpass y
versionado como fixture deliberado en
`api/inst/croquis/campus-pucp-geometria.json`. El generador reproducible es
`api/scripts/croquis_geometria_osm.py` (consultas Overpass incluidas): filtra
al perímetro estilizado, cose los multipolígonos (EEGGCC, EEGGLL, Idiomas/P,
Z, Coliseo) y asigna letra a la huella de cada pabellón — primero por
contención del marcador oficial (19 de 21 letras), luego por cercanía ≤ 45 m
(B a 6 m, E a 11 m). Conflictos de contención los gana el marcador más
cercano al centroide (así G no se pierde dentro del complejo de E).

## Contraste entre fuentes (oficial ↔ OSM)

Cada letra con marcador oficial se contrastó contra la huella OSM que la
contiene (o la más cercana). Distancia del marcador oficial al centroide de la
huella asignada: I 3 m · Q 5 m · B 6 m · N 6 m · H 7 m · R 8 m · G 9 m ·
X 9 m · Y 9 m · E 11 m · V 11 m · M 12 m · P 13 m · F 14 m · O 14 m · U 15 m ·
Z 15 m · J 16 m · A 18 m · D 24 m · L 26 m. **Todas ≤ 26 m**: las dos
fuentes independientes cuentan la misma geografía. Identidades
verificadas además contra Descubre PUCP (A=lug066, E=fac001, G=fac003,
H=fac012, I=lug010, L=fac002, O=lug025, R=fac010, X=fac013, Y=fac005,
Z=lug027).

## Barrido de places de Google Maps (2026-09-03, pedido del dueño)

«Ahora que estás en Google Maps haz el croquis mejor con la información
real»: cada letra floja y los perdidos se buscaron como place público.
Cosecha: **K existe** («PABELLÓN K, Sec. Mecatrónica», -12.0728901,
-77.0827753 — entra al croquis como letra 22) · **V confirmada** (place a
7 m del edificio OSM) · **Rotonda Letras** (-12.067537, -77.0802042) entra
como hito · **PULSO PUCP** (-12.0675895, -77.081028). Sin place: S, Y,
TAMB, SIMB, «Pabellón I», «Pabellón P», «Aulas Móviles» — sus declaraciones
quedan contrastadas contra CUATRO fuentes (mapa oficial, Descubre, OSM,
Google).

## Plan de edificaciones incompletas (pedido de Gonzalo, 2026-09-02)

Registro vivo de lo que NO tiene fuente firme, con su vía de mejora. Nada de
esta lista se dibuja con seguridad falsa: hoy cae al comportamiento declarado.

| Qué | Estado hoy | Cómo se mejora |
|---|---|---|
| Pabellón **Y** (Arte y Diseño) | posición **derivada** de 3 marcadores vecinos; huella asignada por contención | confirmación de campo en la jornada 1 (el equipo pasa por la zona de Arte) o consulta a Intendencia de Aulas |
| Puerta **10** | posición **aproximada** (marcador de estacionamiento, proyectada al borde; sin place en Google) | confirmar lado y posición en campo. (La 8 salió del plan: place «Puerta Nº 8 - Rosales» 2026-09-03) |
| **Aulas Móviles** | DOS ubicaciones contradictorias: el POI-layer de la captura del dueño lo pinta en la esquina NO de Letras y el place «Aulas Moviles PUCP» está en zona Ingeniería (-12.071862, -77.082221) — son módulos móviles, literal | confirmar en campo si el operativo lo necesita; hasta entonces NO se dibuja |
| Letras **S, T** (venues reales «S204», «TAMB») | sin edificio en NINGUNA de las cuatro fuentes → verso con `croquis_pabellon_desconocido`. (K salió del plan: place de Google la resolvió el 2026-09-03) | pedir a la DTI / Intendencia de Aulas el catálogo aula→edificio. Pista de campo: «X115 · TAMB» sugiere TAMB cerca de Artes Escénicas |
| Venues **numéricos** («101E», «204C», «001E») | sin letra de pabellón → «pabellón por confirmar» declarado | identificar con el equipo a qué aulario pertenecen (posible sufijo de ala); 11 venues |
| Tokens **SIMB / LEDU / LLET** | LEDU/LLET caen a L por primera letra (paridad B31); SIMB → S desconocida | confirmar con el equipo si son salas de Letras/EEGGLL o locales aparte |
| Pabellón **P** | marcador oficial vs OSM-CEPREPUC divergen ~100 m (manda el oficial) | confirmar en campo cuál rotula el edificio donde se aplica |
| Pabellón **I** | oficial ✓, pero OSM ubica ahí a Esc. de Gobierno | confirmar rotulado en campo |
| Edificios OSM **sin nombre** (~160 huellas) | se dibujan grises, sin rótulo | barrido completo de los 342 POIs de Descubre PUCP para nombrar los que orienten |

## La base PULSO PUCP (dictado 2026-09-03)

«Resalta dónde está PULSO PUCP siempre»: la base del equipo se dibuja en toda
lámina y verso, con pin navy propio y quinta entrada de leyenda. Identidad:
**pulso.pucp.edu.pe** declara «Casetas — Pabellón de Estudios Generales
Letras»; el marcador del mapa oficial («Instituto de Analítica Social e
Inteligencia Estratégica - Pulso PUCP») existe pero con **lat/lng vacíos**.
La primera posición se derivó junto al L y el dueño la corrigió EN VIVO
(«está cerca de ahí pero no está allí») con captura de Google Maps: la
coordenada final es la del **place público «PULSO PUCP»**
(**-12.0675895, -77.081028** — extremo norte del edificio largo junto a
CIGA, al oeste del Auditorio de EEGGLL), `fuente = "confirmada"` en ambos
gemelos.

## Marco del croquis

- Bbox geográfico usado: lat [-12.0748, -12.0645], lng [-77.0842, -77.0770].
- Perímetro estilizado de 7 vértices (`.ccx_borde_campus()` — el mismo que
  filtra el generador de geometría).
- El chip de la B se dibuja con un ajuste declarado de +25 m O / +20 m S
  (está a 25 m reales de la A y dos chips legibles no caben sin tocarse); su
  huella usa el marcador sin ajuste.
- **Venues con varias aulas**: 301/1.392 en ULT2 vienen como «A204 · A206» y
  73 cruzan pabellón («H404 · A608»). El verso parte el venue por sus
  separadores reales, resalta TODOS los pabellones resolubles (cada uno con
  su pastilla de aula) y el subtítulo dice «según el horario» cuando hay más
  de uno (dictado 2026-09-02); el token sin edificio se declara
  (`croquis_pabellon_desconocido`), nunca se elige en silencio.
- Proyección plana **girada 180°** (dictado 2026-09-03: «inviertas el mapa
  180 grados»): sur arriba, este a la izquierda; la flecha N del dibujo
  apunta hacia abajo y sigue diciendo la verdad. El factor de aspecto usa
  cos(12.07°) para que 100 m midan lo mismo en ambos ejes.
- Colores por letra: gemelo R del helper B31
  (`frontend/src/features/monitoreo/profiles/aulas/chipDePabellon.ts`):
  tono = (código de la letra − 65) mod 8 sobre la paleta de 8 tonos de
  `aulasCargaDeCampo.css` resuelta a hex en `frontend/src/app/tokens.css`.
  La paridad la fija `test-collection-croquis-campus.R`.
