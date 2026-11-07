# ADR 0132: Isotipo «Trenza»

Estado: Aceptado. Elegido por Gonzalo el 2026-11-07, tras cuatro rondas de maquetas.

Fecha: 2026-11-07

Relación: reemplaza la geometría del isotipo «ecualizador del pulso» del
[ADR 0038](0038-identidad-visual-v1-1.md) y su regla «dos tintas, nunca el color vivo en el logo». El resto del
ADR 0038 (wordmark, jerarquía Prosecnur · PULSO PUCP, patrones maestros, economía del chrome) sigue vigente.
Identidad 1.5.0, decisión `dec-isotipo-trenza` en `branding/identity.json`. Estado vivo en
`docs/qa/checklist-isotipo-trenza-2026-11-07.md`.

## Contexto

El ecualizador (cuatro pastillas blancas sobre un squircle navy) era limpio y reconocible, pero decía «gráfico de
barras», que es lo mismo que dice el ícono de cualquier producto de analítica. No hablaba de encuestas, opinión
pública, monitoreo, muestras territoriales ni procesamiento, que es lo que hace Prosecnur.

Las condiciones que fijó Gonzalo durante las rondas:

1. Tiene que verse bien **quieto**, porque casi siempre lo está; la animación sale de la pose quieta.
2. Tiene que **llenar bien un contenedor cuadrado**.
3. Tiene que poder tomar **el color de cualquier módulo** y seguir viéndose bien.
4. **Los módulos conservan su ícono.** El isotipo no los reemplaza.
5. En la animación **no desaparece** y se mueve con fluidez.
6. Sin gráficos literales, sin abstracciones que no digan nada y sin copiar el estilo de otras apps.

## Decisión

### 1. La forma

Siete hilos, uno por módulo, torcidos en una sola cuerda: un estudio que es el trabajo de los siete a la vez. La
cuerda cierra en punta a cada lado, la pregunta y el resultado, y cruza el contenedor en diagonal (−35°).

- **Versión: Cuerda abierta.** Dos medias vueltas: la cuerda queda suelta y deja ver el trenzado de atrás. Se
  descartaron Cordón (tres medias vueltas) y Semilla (cuatro).
- **Geometría única** en `frontend/src/app/marca/trenzaGeometria.ts`, sin imports y en TypeScript borrable. La
  app dibuja desde ahí con `IsotipoTrenza`, y `branding/logo/generar-isotipo.mjs` exporta desde ahí los SVG de
  marca y los íconos de escritorio. Nadie redibuja el isotipo a mano.
- Cada hilo es una **cinta continua de ancho variable**: más ancha y más clara adelante, más angosta y más oscura
  atrás. Se parte sólo donde cruza el plano medio. Los hilos de adelante pasan sobre los de atrás con un filo del
  color del contenedor, recortado para que un hilo no se muerda a sí mismo.
- El tono es **opaco**: cada tramo es una proporción de tinta sobre el color del contenedor, nunca una
  transparencia. Así dos hilos superpuestos no forman manchas.
- **32 px o menos:** variante de cinco hilos más gruesos (`prosecnur-isotipo-chico.svg`, `chica` en el
  componente).
- **Una tinta** (mono negro, mono blanco calado, instalador): sólo los hilos de adelante, que se leen como cintas
  diagonales.

### 2. El color

- El contenedor es **navy** en la marca: header, ícono de la app, favicon, instalador, lockups y entregables.
- En la **pantalla de carga de un módulo** el contenedor toma el **acento de ese módulo** y la cuerda queda en
  blanco. Esto rige en la carga de módulo (`CargaDeModulo`, el bloque de carga `LoadingBlock`) y en la carga del
  proyecto cuando el destino es un módulo (`PantallaDeCarga` con `conTono`). Si el destino es el Home, navy.
- Sigue habiendo **dos tintas a la vez** (contenedor y blanco). Lo que cambia respecto del ADR 0038 es que el
  contenedor puede ser el acento de un módulo, y sólo mientras ese módulo carga.
- **Los íconos de módulo no cambian.** El dock del header, los rails y las cards siguen usando sus íconos lucide.

### 3. El movimiento (`IsotipoCarga`)

- **Carga:** los siete hilos parten rectos y se tuercen en 1,4 s. El giro arranca en cero y acelera de forma
  pareja, así que al terminar la entrada ya va a velocidad constante y no hay salto. Desde ahí la cuerda gira sin
  fin, dos séptimos de vuelta cada 3,4 s: con siete hilos la forma se repite cada 1,7 s, así que no hay corte. Una
  respiración de 5,2 s suelta la cuerda un 14 % y la vuelve a apretar. **Nunca desaparece.**
- **Firma de arranque** (`BootBrandMark`, selector de proyecto): la misma entrada, que se asienta exactamente en
  la pose quieta y se detiene.
- Con `prefers-reduced-motion`, o en error (`detenido`), queda en la pose quieta.
- Se anima con `requestAnimationFrame`, no con CSS. Cuesta unos 1,8 ms por cuadro y por isotipo en modo
  desarrollo. El contrato de movimiento (L37) bajó: sin `boot-ecualizador.css` ni el escalonado de las pastillas.

### 4. Lo que se reemplaza

- `BootEcualizador.tsx` y `boot-ecualizador.css` se retiran; sus tres usos pasan a `IsotipoCarga`.
- `BrandMark` (header) y `BootBrandMark` (selector) dibujan la Trenza.
- `branding/logo/`: los diez SVG canónicos se regeneran, y se suman `prosecnur-isotipo-chico.svg` y `modulos/`,
  con una variante por módulo. `preview.html` pasa a ser una hoja de contacto generada.
- `packaging/windows/brand/{icon,header,wizard}.svg`, `desktop/assets/icon.png`,
  `packaging/macos/build-resources/icon.icns` y `frontend/public/favicon.ico` se regeneran con
  `node branding/logo/generar-isotipo.mjs --raster`.

## Consecuencias

- El isotipo dice algo del oficio sin dibujar un gráfico, y el color del módulo deja de ser ajeno a la marca:
  aparece en ella justo cuando el usuario espera a ese módulo.
- Cambiar la forma es cambiar `trenzaGeometria.ts` y regenerar; no hay SVG que editar a mano.
- `branding/manual-identidad.html` queda **desactualizado** (mirror `stale` en `identity.json`). Todavía muestra el
  ecualizador en 24 figuras y describe la firma de pastillas. Su actualización es un pendiente del checklist.
- El instalador de Windows y el `.icns` toman el ícono nuevo en el siguiente build de packaging. Ese build no se
  corrió en este cambio.

## Cumplimiento

- Contratos de la app: `pnpm -C frontend exec tsc --noEmit`, `make gate-front` (incluye el contrato de movimiento
  L37, que bajó) y las suites de `CargaDeModulo`, `LoadingBlock` y `ModuleWarmupBoundary`, que buscan
  `class="pulso-isotipo-carga"`.
- Marca: `node branding/logo/generar-isotipo.mjs` debe dejar `branding/logo/` y `packaging/windows/brand/` sin
  diferencias; `node branding/identity/validate-identity.mjs branding/identity.json` debe dar VALID.
- Ningún archivo vuelve a dibujar el isotipo a mano: `grep -rn "BootEcualizador\|boot-eq" frontend/src` queda vacío.

## Notas

- El movimiento del isotipo supera el tope de 680 ms de la escala (entrada de 1,4 s, giro continuo, respiración
  de 5,2 s). Es la excepción gobernada `motion-isotipo-trenza` de `identity.json`: es un indicador de espera, como
  el spinner, y tiene vía reducida obligatoria.
- El generador importa el `.ts` con el type stripping de Node 25. Con un Node anterior, correrlo con
  `node --experimental-strip-types`.
