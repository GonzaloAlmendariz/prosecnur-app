# Propuesta: fondo de la pantalla de carga (warm start) — 2026-11-06

Pedido de Gonzalo, textual: «No es que no me guste el fondo pero lo siento muy
sencillo y plano, quizás podemos decirle a otra sesión independiente que diseñe
uno más creativo con más énfasis en los distintos módulos en un artefacto».

Artefacto para elegir (tres direcciones, dos casos cada una, fases y variante
quieta): https://claude.ai/artifact/3cVPEhL8NGz3Nem4vSM5jg

Esta es sólo la propuesta visual. No se tocó código de la app. La decisión es de
Gonzalo.

## Punto de partida (main, d3fe6e522 + 2cf80fd90)

- `frontend/src/app/PantallaDeCarga.tsx` + `pantalla-de-carga.css`: la lámina
  (isotipo que late, ceja en el tono del módulo, título, barra, reloj, fases).
  Recibe el fondo por la prop `fondo` y lo pinta en `.pulso-carga-fondo`
  (opacidad 0,62 y un velo radial al centro).
- `frontend/src/components/VistaSkeleton.tsx` + `vista-skeleton.css`: el fondo
  de hoy. Variante `inicio` (silueta del Home con una tarjeta por módulo) y
  `modulo` (barra, rail y paneles grises).
- Montajes: `BootGate.tsx:1519-1526` (arranque del proyecto, elige `inicio` o
  `modulo`) y `ModuleWarmupBoundary.tsx:472` (arranque de un módulo).
- Tonos: `--pulso-module-*` en `boot.css` (ya replicados para el chunk de
  arranque, incluido `--pulso-module-monitoring`), `MODULE_TONES` y el orden de
  `PROSECNUR_ACTIVE_MODULES` en `lib/modules.ts`. Íconos: `lib/icons.ts`
  (`IconSample`=Calculator, `IconEditor`=FilePen, `IconRoutes`=Map,
  `IconFieldKit`=Backpack, `IconMonitor`=Activity, `IconProcessing`=Workflow,
  `IconDashboard`=LayoutDashboard).

Lo que se mantiene en las tres: la lámina sin cambios, el velo radial detrás de
ella, sólo `transform`/`opacity` con tokens `--motion-*`, variante quieta para
`prefers-reduced-motion` y el fondo `aria-hidden`.

## Dirección A · Constelación (recomendada)

**Idea.** Los siete módulos orbitan el isotipo en el orden real del trabajo
(Cálculo de muestra → Formularios → Hojas de ruta → Material de campo →
Monitoreo → Procesamiento → Dashboard). Cada nodo es un disco en su tono con su
ícono y su nombre, un hilo fino hacia el centro y, detrás, una «nebulosa» con el
motivo del módulo (retícula sorteada, campos de formulario, plano con ruta, QR y
ficha, curva contra meta, barras, tablero con anillo).

**Fases.** Los nodos se encienden en orden según el avance (relleno en su tono e
ícono en blanco); el que se está encendiendo emite una onda corta. Es estado, no
adorno: en la variante quieta se conserva el encendido y sólo desaparecen la
flotación y la onda.

**Abriendo un módulo.** El destino deja la órbita, crece (disco de 104 px) y se
apoya sobre su territorio a pantalla parcial (para Hojas de ruta, un plano de
manzanas con la ruta y sus puntos, enmascarado hacia el centro). Los otros seis
se reacomodan y bajan al 55 % de opacidad.

**Implementación.**
- Nuevo `frontend/src/components/FondoConstelacion.tsx` + `fondo-constelacion.css`
  (no se toca `VistaSkeleton`, que sigue sirviendo al resto de la app).
- Nuevo `frontend/src/components/motivosModulo.tsx`: un SVG pequeño por slug
  (viewBox 120×80, `currentColor`), reutilizable por B si algún día se quiere.
  Uno extra grande por módulo para el «territorio» del destino; se puede empezar
  sólo con Hojas de ruta y caer al motivo escalado para el resto.
- Props: `destino?: ProsecnurModuleSlug`, `avance: number` (0–100, el mismo que
  ya recibe la lámina). Montaje: reemplazar `<VistaSkeleton …/>` en
  `BootGate.tsx` y `ModuleWarmupBoundary.tsx`.
- Posiciones: elipse en porcentajes del contenedor (no píxeles) y nodos sólo en
  los arcos laterales (|cos θ| ≥ 0,72) para no pasar bajo la lámina.
- Tokens: `--pulso-module-*`, `--pulso-bg`, `--pulso-surface`, `--motion-dur-slow`,
  `--motion-ease-in-out`, `--motion-ease-out`, `--motion-ease-productive`. Todos
  están en `boot.css`.
- Tests: contrato de que pinta un nodo por módulo activo y que el destino lleva
  la clase grande; `tokensDefinidos` cubre los `var()`.

**Costo.** 1 a 1,5 días con QA visual en la matriz de viewports.

**Riesgos.**
- Ventanas bajas (1024×600 y la regla `max-height: 820px` que pone la lámina en
  dos columnas de 940 px): no queda periferia. Plan: bajo 820 px de alto, la
  órbita se pliega a dos columnas verticales en los bordes y oculta las
  nebulosas; bajo 900 px de ancho, sólo discos sin rótulo.
- Que el encendido se lea como «módulo listo» cuando sólo es avance de carga.
  Mitigación: el destino es el único que marca algo concreto; en la carga del
  proyecto el encendido acompaña al porcentaje, sin texto que prometa estado.

## Dirección B · Mosaico vivo

**Idea.** La ventana se llena con una grilla 6×4 de teselas (13 en el Home), cada
una una miniatura de la pantalla de un módulo con su ícono, su nombre y su
motivo. Las teselas pasan de silueta gris a miniatura en color en diagonal
mientras avanza la carga; las reveladas respiran en opacidad.

**Abriendo un módulo.** Siete de once teselas son del destino (plano, tablas de
cuotas y manzanas); los demás módulos quedan en una franja al 50 %.

**Implementación.** Evoluciona `VistaSkeleton` (variante `inicio` y `modulo`)
con teselas propias por módulo y layouts declarados por slug. Necesita una
miniatura convincente por módulo y al menos dos variantes del destino.

**Costo.** 2 a 3 días; es la que más dibujo pide y la que más mantenimiento
arrastra cuando cambian las pantallas reales.

**Riesgos.** Es la más cargada: compite con la lámina. Las miniaturas pueden
leerse como datos reales del proyecto (cifras, cuotas), justo lo que el Contrato
de Superficie pide no prometer. Con 13 teselas, el skeleton tiene más DOM que
hoy en el chunk de arranque.

## Dirección C · Paisaje en capas

**Idea.** Siete franjas de terreno superpuestas, una por módulo, cada una con su
relieve: teselas (Dashboard), barras (Procesamiento), curva de actividad
(Monitoreo), pixeles QR (Material), curvas de nivel con ruta (Hojas de ruta),
terrazas con campos (Formularios) y retícula de puntos (Cálculo de muestra). Se
deslizan en horizontal a distintas velocidades (parallax) y suben de adelante
hacia atrás con las fases. Una etiqueta fija por capa nombra el módulo.

**Abriendo un módulo.** La capa del destino sube al primer plano con el relieve
en grande; las demás se comprimen al fondo al 42 %.

**Implementación.** `FondoPaisaje.tsx` con un SVG por capa generado una vez
(periodo de 1280 px duplicado para la deriva sin costura) y animación
`translateX` en CSS.

**Costo.** 2 días.

**Riesgos.** Es la más atmosférica y la que menos identifica cada módulo (el
relieve dice poco sin la etiqueta). El movimiento es continuo aunque lento, y el
ambiente de capas roza lo que la v3 retiró del shell («v3 retira los gradientes
apilados», `boot-ecualizador.css`). SVG anchos en siete capas: hay que medir el
costo de pintura en Windows.

## Recomendación

A · Constelación. Responde al pedido (cada módulo con color, ícono, nombre y su
naturaleza) sin pelear con la lámina, porque vive en la periferia y deja el
centro en calma. El orden de la órbita es el orden real del trabajo, así que el
fondo cuenta cómo está armado Prosecnur. Es la más barata y la que tiene una
respuesta más clara para «abriendo un módulo». Toma de B lo mejor: el motivo de
cada módulo como nebulosa.

## Pendiente de decisión

- Gonzalo elige dirección (o mezcla).
- Si es A: confirmar si el territorio grande se hace para los siete módulos o
  sólo para Hojas de ruta en la primera entrega.
