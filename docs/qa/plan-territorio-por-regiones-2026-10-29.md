# Paquete: Territorio por ciudades en el lienzo de Hojas de ruta

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

## Decisión de diseño (revisada: dirección A · Atlas)

La primera maqueta (`tmp/revamp-hojas-material/territorio-regiones.html`, regiones con interruptores) se descartó:
«Se ve horrible, necesitamos repensar por completo». La segunda
(`tmp/revamp-hojas-material/territorio-ciudades.html`) comparó dos direcciones y Gonzalo eligió **A · Atlas**
(2026-10-29).

### 1. Se elige la ciudad, no la región

El investigador decide por ciudad (Arequipa, Piura, Lima y Callao). La región es un detalle de carga: el mapa de una
ciudad se pide al abrirla, nunca antes.

1. **Atlas del Perú.** El país en blanco, con trazo fino y departamentos tenues. Las 26 ciudades con cartografía son
   círculos de área proporcional a su población; las del estudio van rellenas en el tono del módulo. Sobre el atlas,
   «¿Dónde se hace el estudio?».
2. **Tarjeta de ciudad.** Clic en un círculo: silueta real de la huella urbana, habitantes, distritos, manzanas y la
   captación del marco contra el CPV 2025 (ADR 0119 §7; bajo 55 % se avisa). Acciones explícitas: «Agregar al
   estudio», «Elegir distritos» y «Quitar con sus N distritos» (dice cuántos salen).
3. **Ciudad abierta.** Mapa de sus distritos y, al lado, la lista con interruptores, población, manzanas y captación.
   Clic en el mapa = ficha del distrito; elegir es con el interruptor. «‹ Todas las ciudades» vuelve al atlas.
4. **Columna del estudio**, siempre visible: cifras de lo elegido (habitantes, viviendas, manzanas) y cada ciudad del
   estudio con su silueta y «N de M distritos» o «Elige sus distritos»; Deshacer / Confirmar.

### 2. Las ciudades son parte del estudio

`integrated_config.ciudades`: lista de códigos de ciudad (`lima` para Lima Metropolitana y Callao, o el código de
provincia de 4 dígitos). Se guarda con el estudio y se persiste en el `.pulso`, porque una ciudad puede estar en el
estudio antes de tener distritos elegidos.

- Si un estudio viejo no la tiene, se deriva de `territorios`. Ningún `.pulso` existente se abre en blanco.
- Quitar una ciudad con distritos confirmados lo dice en el botón y saca sus distritos al confirmar.
- Es un cambio de contrato del estado: pasa por `guardian-contratos` antes (campo declarado, normalizador, contratos
  `estado-normalizado` y `campos-declarados`).

### 3. Qué va en el bundle y qué se pide

- En el bundle: el país y los departamentos (`peruDepartamentos.json`, 42 KB) y un **índice de ciudades** con código,
  nombre, departamento, centro y silueta simplificada para la tarjeta y la columna (presupuesto ~1 KB por ciudad).
- Bajo demanda, al abrir una ciudad: los contornos de distritos de su región
  (`GET /api/hojas-ruta/contornos?region=`, ya hecho en R2). Lima y Callao pide `15` y `07`.
- El contexto distrital de los PDF lee los mismos archivos (R2): en una ciudad trae vecinos.

### 4. Dirección

El nivel va en `foco`: `pe` para el atlas, `lima` o 4 dígitos para una ciudad abierta. Toda vista se puede enlazar.

## Unidades

| # | Unidad | Capa | Depende de | Gate |
|---|---|---|---|---|
| R1 ☑ 3c011e8b3 | Contornos partidos por región en `inst/hojas_ruta/contornos/`; país + departamentos ≤ 60 KB | R (scripts) | — | pesos medidos, test de esquema |
| R2 ☑ ec3f7c2b2 | `GET /api/hojas-ruta/contornos?region=` + contexto distrital de los PDF desde la región | R | R1 | testthat router y contexto |
| R1b | Índice de ciudades para el bundle: código, nombre, departamento, centro, población y silueta simplificada | R (script) + JSON | R1 | peso ≤ 40 KB, test de cobertura del registro |
| R3 | `integrated_config.ciudades`: normalizar, derivar de `territorios`, persistir; `guardian-contratos` antes | R + TS | — | estado-normalizado, campos-declarados |
| R4 | Cliente: `apiHojasRutaContornos(region)` con caché; el lienzo deja de importar 1,67 MB; contornos con todos los anillos (11 de 114 huellas tienen huecos) | TS | R2 | vitest; peso del chunk antes y después |
| R5 | Atlas + tarjeta de ciudad + ciudad abierta + columna del estudio, según la maqueta A | TS | R1b, R3, R4 | vitest + captura 1440 y 1024 |
| R6 | Estados de carga de la ciudad (C3), foco direccionable, QA visual | TS | R5 | ui-quick-check de Territorio |

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

R5 aprovecha el catálogo y la lectura del `foco`; la navegación por niveles departamento › ciudad no sobrevive: en
la dirección A se va del atlas a la ciudad directamente.
