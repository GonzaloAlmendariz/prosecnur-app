# Paquete: Territorio por regiones en el lienzo de Hojas de ruta

Fecha: 2026-10-29 · Encargo de Gonzalo · Amplía ADR 0119 (ciudades principales) y ADR 0114 (el mapa es el lienzo).

## Pedido, textual

> «es mejor no cargar todo el mapa nacional porque sino se va a volver demasiado pesado sino poder marcar las regiones
> primero para que solo carguen esas regiones y la UI debe adaptarse a ello, aun no lo hace, recomiendo generar la
> paquete para ello cuando retomemos primero»

Antes: «limitar el mapa a un mapa nacional, luego departamental para seleccionar las provincias disponibles y de ahí
por ciudad».

## Qué pesa hoy (medido)

El lienzo importa en su chunk, de forma estática, tres geometrías:

| Archivo | KB | Qué trae |
|---|---|---|
| `limaDistrictCoverage.json` | 956 | 50 distritos de Lima y Callao (límite oficial IMP) |
| `ciudadesDistrictCoverage.json` | 384 | 114 distritos de 25 ciudades (huella urbana INEI 2017) |
| `limitesPeru.json` | 332 | país, 25 departamentos y 196 provincias (IGN vía OCHA) |

Son 1,67 MB que se descargan y se proyectan aunque el estudio sea solo de Lima. Cada ciudad nueva del registro suma
más. Las manzanas ya se piden por distrito (`/api/hojas-ruta/geometria?ubigeo=`), así que el problema es solo la
capa de contornos.

`limaDistrictCoverage.json` lo importan también la página clásica, `poblacion/MapaPoblacion.tsx` y tres vistas de
Monitoreo territorial. Esos usos no se tocan: el cambio vale solo para el lienzo.

## Decisión de diseño

### 1. Tres niveles, y las regiones se marcan primero

1. **Perú.** Solo el contorno nacional y los departamentos, con un trazo muy simplificado (presupuesto ≤ 60 KB,
   empaquetado en el bundle porque es lo único que se ve antes de elegir). Los 19 departamentos con cartografía se
   resaltan; el resto se ve apagado y no se puede elegir. Lima Metropolitana y Callao tienen un acceso directo.
   Aquí se **marcan regiones** con interruptores (en la lista y con clic en el mapa). Marcar no elige distritos.
2. **Región marcada → ciudades.** Al marcar una región se piden sus contornos al backend: sus provincias y los
   distritos de sus ciudades. Solo entonces aparecen en el mapa y en la lista.
3. **Ciudad → distritos.** Lo que existe hoy: la lista de distritos con población y captación, interruptores para
   elegirlos y clic para ver la ficha.

Las regiones marcadas son las únicas que el lienzo carga en cualquier sección. Población, Muestra, Manzanas y
Selección ven solo los distritos confirmados, igual que hoy.

### 2. Las regiones son parte del estudio

`integrated_config.regiones`: lista de códigos de departamento (2 dígitos; Lima Metropolitana y Callao se marcan
como `15` + `07`). Se guarda con el estudio y se persiste en el `.pulso`, porque decide qué se carga al abrirlo.

- Si un estudio viejo no tiene `regiones`, se derivan de `territorios` (departamentos de sus distritos
  confirmados). Así ningún `.pulso` existente se abre en blanco.
- Desmarcar una región que tiene distritos confirmados no los borra en silencio: pide confirmación y dice cuántos
  distritos salen (regla de Gonzalo: «ningún atajo elige o borra en bloque sin decir cuántos y sobre qué»).
- Es un cambio de contrato del estado: pasa por `guardian-contratos` antes de implementarse (campo declarado,
  normalizador, test de `estado-normalizado` y `campos-declarados`).

### 3. Los contornos se sirven por región

Endpoint nuevo `GET /api/hojas-ruta/contornos?region=04`, que devuelve un FeatureCollection con:

- los distritos de las ciudades de esa región (Lima y Callao: los 50 del límite oficial);
- las provincias de la región, para el contexto.

Desde dónde se sirve:

- La fuente pasa a `api/inst/hojas_ruta/contornos/<region>.json.gz`, generado por `build_contornos_ciudades.R` y
  `build_limites_peru.R` partidos por departamento.
- El router es delgado: valida `region` contra el registro y lee el archivo. La caché del navegador va por versión
  del registro.
- El mismo archivo sirve al motor de PDF: `.hojas_ruta_pdf_district_context_features` deja de depender del JSON del
  frontend, y el contexto distrital de la ficha y de la hoja de zona funciona también en ciudades (hoy solo en
  Lima).

### 4. La UI se adapta

- **Estructura.** Arriba, una ruta «Perú › Arequipa › Arequipa». La lista cambia con el nivel: regiones con
  interruptor → ciudades de las regiones marcadas → distritos. El buscador encuentra distritos solo dentro de las
  regiones marcadas, y si no hay ninguna lo dice.
- **Mapa.** En Perú, departamentos resaltados y clic para entrar. Una región marcada que aún no cargó se ve con su
  estado de carga en el mapa, no con un vacío mudo (C3).
- **Inspector.** En Perú dice cuántas regiones hay marcadas, qué pesa cargarlas y la cobertura de cada una
  (captación CPV 2025, ADR 0119 §7: «la cobertura se informa antes de elegir»).
- **Dirección.** El nivel va en `foco` (`pe`, `lima`, 2 dígitos = región, 4 dígitos = ciudad). Toda vista se puede
  enlazar.

## Unidades

| # | Unidad | Capa | Depende de | Gate |
|---|---|---|---|---|
| R1 | Partir contornos y límites por región en `inst/hojas_ruta/contornos/`; país + departamentos simplificados ≤ 60 KB para el bundle | R (scripts) | — | pesos medidos, test de esquema |
| R2 | `GET /api/hojas-ruta/contornos?region=` + lectura en el motor de PDF (contexto distrital en ciudades) | R | R1 | testthat del router y del contexto; gate-area hojas-ruta |
| R3 | `integrated_config.regiones`: normalizar, derivar de `territorios`, persistir; revisión de `guardian-contratos` antes | R + TS | — | estado-normalizado, campos-declarados |
| R4 | Cliente: `apiHojasRutaContornos(region)` con caché por región; el lienzo deja de importar las tres geometrías | TS | R2 | vitest; peso del chunk medido antes y después |
| R5 | Territorio por niveles con regiones marcables (rehace el trabajo sin commitear de `territorio/niveles.ts` sobre esto) | TS | R3, R4 | vitest + captura 1440 y 1024 |
| R6 | Estados de carga por región en el mapa (C3) e inspector de cobertura en Perú | TS | R5 | ui-quick-check de Territorio |

## Lo que no cambia

- Las manzanas siguen pidiéndose por distrito.
- La página clásica y Monitoreo siguen con sus imports actuales.
- El registro `territorios.json` sigue siendo la única fuente de qué existe (ADR 0119 §2).

## Trabajo previo que se reaprovecha

Está sin commitear en el árbol (respaldo en el patch `wip-territorio-niveles-2026-10-29.patch` de la carpeta de notas
de la sesión):

- `mapa/territorio/niveles.ts`: catálogo departamento › ciudad, lectura y escritura del `foco`, ruta de migas,
  encuadre por nivel; 7 tests.
- Cambios en `TerritorioPaneles.tsx`, `HojasRutaMapaPage.tsx` y `puntoEnDistrito.ts` (pieza genérica).

R5 parte de ahí. Lo que asumía «todo el país cargado» (encuadre con todos los contornos, resaltado desde
`limitesPeru.json` completo) se rehace contra la carga por región.
