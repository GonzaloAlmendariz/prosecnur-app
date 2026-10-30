# Checklist · flujo del analista en Hojas de ruta → Material de campo → Monitoreo

Fecha: 2026-10-30 · Encargo de Gonzalo (loop indefinido de Hojas de ruta).

> «es una gran oportunidad para que revises en profundidad y no arregles cosas de forma superficial, sino que en
> verdad construyas una interfaz que esté en condiciones… Todo lo relacionado con el módulo de campo también pueden
> entenderse mejor con el de monitoreo… que la interfaz usuaria pueda usarlo un analista para seleccionar las
> ciudades en las que va a hacer sus investigaciones y todo funcione perfecto, sea intuitivo, sea dinámico y sea algo
> que valga la pena exponer, presentar y que sea utilizable.»

Método: recorrer la app real (Vite 5181 + backend 8841, proyecto de referencia `acnur_acg`, lienzo encendido) como un
analista que arranca un estudio. Cada ítem dice dónde vive, su severidad (**bloquea** · **confunde** · **pule**), la
evidencia y la propuesta. Sólo Gonzalo da un ítem por terminado.

Estados: ☐ pendiente · ◐ en curso · ☑ hecho (con commit) · ⛔ bloqueado (decisión).

## Recorrido 1 · Territorio, Población, Muestra (2026-10-30)

| # | Hallazgo | Dónde vive | Severidad | Evidencia | Propuesta | Estado |
|---|---|---|---|---|---|---|
| F1 | Agregar o quitar una ciudad tarda ~10 s y la única señal es el botón deshabilitado | `cambiarCiudades` en `mapa/HojasRutaMapaPage.tsx` → `POST /api/hojas-ruta/workspace` | confunde | medido en vivo al agregar Arequipa | medir el endpoint (¿re-normaliza o recalcula el marco?); respuesta optimista en la UI con estado «Guardando…» en la tarjeta y en la columna | ◐ (este commit) causa medida: cada guardado subía el ui_state entero (656 KB: el historial de ruteos guarda la muestra completa de cada uno) y bajaba ~3 MB (eco de runs y salidas), y después se releía el estado (~3 MB, ~2 s). Agregar una ciudad ahora usa `ligero` sin ui_state ni salidas y actualiza la config con la respuesta: en R, de 3,45 s / 3 MB a 1,08 s / 2 KB, sin el GET. Falta verlo en vivo: el 8841 no tiene el cambio de R (relanzar con visto bueno). Pendiente de fondo: el historial de ruteos no debería guardar muestras completas en ui_state |
| F2 | Con una ciudad abierta, el inspector de Territorio sigue global: «Del marco de Lima Metropolitana», peso de los 6 distritos de Lima aunque se mire Arequipa | `TerritorioInspector` en `mapa/territorio/TerritorioPaneles.tsx` | confunde | captura con Arequipa abierta | inspector por ciudad: cifras de la ciudad abierta, sus elegidos, su captación, y un resumen del estudio entero aparte | ☑ (este commit) con una ciudad abierta la cabecera dice «Lima y Callao · 6 de 50 distritos en el estudio», las cifras y el % del marco son de la ciudad, y los distritos de otras ciudades van en una línea aparte |
| F3 | En una ciudad abierta, las líneas de departamento (y el límite Lima–Callao) cruzan la ciudad en negro; las provincias vecinas de Lima se dibujan junto a la ciudad | `dibujarLimites` en `mapa/lienzo/limites.ts`, llamado siempre en `dibujarFondo` | pule | captura de Lima abierta | a escala de ciudad, el país y los departamentos van tenues o fuera; sólo el contorno de la ciudad y sus distritos | ☑ (este commit) país y departamentos sólo se trazan a escala regional o nacional (`ESCALA_SIN_LIMITES`) |
| F4 | Los distritos de una ciudad abierta se ven blancos con borde gris tenue: no hay jerarquía entre elegidos, disponibles y fuera de la ciudad | estilo de `dibujarContornos` en `dibujarFondo` | confunde | captura de Arequipa abierta | elegidos con su tono (B9), disponibles con borde del acento, el resto del mapa apagado | ☑ (este commit) disponibles con tinte y borde del acento; los del estudio con su tono; los que cambian con borde fuerte |
| F5 | Abrir la app sin `foco` aterriza en el atlas aunque el estudio tenga una sola ciudad con distritos | `ciudadAbiertaDeFoco` + página | pule | — | **decidir con Gonzalo**: con una sola ciudad, entrar a ella (el atlas queda a un clic con «Todas las ciudades») | ⛔ |
| F6 | Población, Muestra, Manzanas y Selección dicen «Lima · 6 distritos» en la miga aunque el estudio sea de otra ciudad | `migaLienzo` en `mapa/lienzo/flotantes.tsx` (texto fijo «Lima») | confunde | capturas de Población y Muestra | la miga nombra las ciudades del estudio («Lima y Callao · 6 distritos», «Arequipa · 4») | ☑ (este commit) la miga nombra las ciudades del estudio («Lima y Callao · 6 distritos»; con 3 o más, «N ciudades»). De paso: la matriz de Población agrupada por provincia mandaba a «Lima» todo lo que no era Callao, también Arequipa; ahora usa la provincia real |
| F7 | A ancho de panel (~800 px) «Otras ciudades con cartografía 25» se parte y el contador cae en dos líneas | `.hr-atlas-lista h3` en `mapa/territorio/atlas.css` | pule | captura a ancho de panel | contador en su propia columna sin cortar (`white-space: nowrap`) o subtítulo más corto | ☑ (este commit) el contador va en su propia caja sin cortarse |
| F8 | El inspector de Población deja media columna vacía bajo «Ver la matriz» | `PoblacionInspector` | pule | captura de Población | llevar ahí la pirámide de la población objetivo por sexo y edad (idea abierta desde B48) | ☑ (este commit) pirámide de la población objetivo por sexo y edad bajo «Ver la matriz» (sólo con matriz vigente y dividida por sexo); cifras fuera de las barras |
| F9 | `/api/project/status` se consulta en ráfagas (decenas de veces por minuto) y `/api/hojas-ruta/state` dos veces por carga | polling del shell (`BootGate` / estado del proyecto) y efecto de la página | pule | registro de red de la pestaña | revisar el intervalo del sondeo y deduplicar la lectura de estado | ☐ |
| F10 | Dos errores 500 en consola durante la carga que no quedaron en el registro del backend ni en el buffer de red | sin localizar | confunde | consola de la pestaña | reproducir con red limpia desde el arranque y localizar el endpoint | ☐ |

## Recorrido 2 · Manzanas, Selección, Entrega (2026-10-30)

| # | Hallazgo | Dónde vive | Severidad | Evidencia | Propuesta | Estado |
|---|---|---|---|---|---|---|
| F11 | La muestra de acnur_acg está sorteada con `zona_mayor_resto_v1` (ADR 0117): en Ate el 50,2 % de las viviendas del marco elegible quedó sin probabilidad de salir, y lo mismo en los otros cinco distritos. El backend lo avisa (`W_SAMPLE_DRAWN_WITH_V1`, seis avisos), pero el lienzo lo pinta al fondo del inspector de Manzanas, a ~1.790 px, debajo de toda la configuración del sorteo | `ManzanasInspector` (avisos al final), `hojas_ruta_sorteo_aviso_v1` en `api/R/hojas_ruta_sorteo_pps.R` | **bloquea** | `state.workspace_outputs.sample.algoritmo_sorteo = "zona_mayor_resto_v1"`; posición medida del primer aviso | un aviso v1 va arriba de todo en Manzanas, en la miga del lienzo y en el chip «por revisar» de la barra, con la acción «Sortear de nuevo con el método vigente» | ☑ (este commit) banda «Esta muestra no debe ir a campo» arriba del inspector, chip «Re-sortear» en la barra, «Sortear de nuevo» habilitado aunque no haya cambios |
| F12 | «¿Se parece al marco?» culpa a la semilla («revisa la semilla o compara con otra») cuando la diferencia (Medio 38 → 51 %, Bajo 16 → 4,7 %) la explica el algoritmo v1 | `ParecidoAlMarco` en `mapa/manzanas/` | **confunde** | inspector de Manzanas | si la muestra es v1, el diagnóstico nombra la causa y no ofrece cambiar de semilla | ☑ (este commit) con muestra v1 el diagnóstico nombra el reparto anterior, no la semilla |
| F13 | «Enviar a Material» está habilitado con una muestra v1 sesgada: el punto de no retorno no mira los avisos del sorteo | `SalidasPanel` (Entrega) y acción de la barra | **bloquea** | panel Entrega abierto | con avisos `W_SAMPLE_DRAWN_WITH_V1` el envío pide volver a sortear (o confirmación explícita que diga qué se manda) | ☑ (este commit) Entrega deshabilita el envío con el motivo e «Ir a Manzanas»; el backend rechaza con E_HOJAS_RUTA_ENVIO_SORTEO_V1 (409) |
| F14 | La tercera cifra del inspector de Selección sale cortada: «UMP observ… 14» | `SeleccionInspector`, cifras de cabecera | pule | captura de Selección | rótulo corto («Observadas») o cifra en dos líneas | ☑ (este commit) la tercera cifra se llama «Por revisar» |
| F15 | «12 por revisar» en la barra y «14 observadas» en el inspector siguen sin explicarse uno al otro: el analista ve dos números para lo mismo | chip de la barra vs inspector (B43 los unificó en definición, no en lectura) | confunde | barra + inspector de Selección | un solo número visible; el otro como desglose («12 rutas · 14 UMP con reemplazos») | ☑ (este commit) un solo número, el de la barra y la lista (12 rutas); debajo, «12 rutas con su titular o algún reemplazo observado: 14 UMP en total» |
| F16 | Entre secciones, la estructura y el inspector quedan vacíos un momento y la barra de secciones se redibuja con una mancha antes de asentarse | `key` por sección en `.hr-mapa-estructura` + carga de cada sección | pule | capturas a medio cambio en Muestra y Selección | mantener el marco del panel (C2) con un esqueleto en vez de vaciarlo | ☑ no reproducible: medido con MutationObserver en las cinco secciones, ningún instante con paneles vacíos; lo que se veía eran capturas del panel del navegador oculto (`visibilityState: hidden`, sin requestAnimationFrame) |

## Recorrido 3 · Material de campo territorial y Monitoreo territorial (2026-10-30)

Evidencia: sesión del 8841 sin envío (el `.pulso` de referencia no lo trae). Monitoreo territorial cargó en ~3 min con
1.283 de 1.200 casos, faltante por UMP, cuota por distrito y celda, y sugerencias de reemplazo cercano: es la pieza más
madura del recorrido.

| # | Hallazgo | Dónde vive | Severidad | Evidencia | Propuesta | Estado |
|---|---|---|---|---|---|---|
| F17 | El enlace de Hojas a la campaña territorial (`/material-campo?modo=territorial&campana=territorial.principal`) redirige en silencio a la lista de campañas cuando no hay envío, y esa lista dice «Todavía no hay campañas · un campo en aulas o un correo»: no menciona el territorial ni que Hojas tiene una muestra lista | lista de campañas de Material, redirección del modo territorial | confunde | captura de `/material-campo` | si no hay campaña territorial, el vacío lo dice y ofrece «Enviar la muestra desde Hojas de ruta» con enlace; el modo territorial sin envío muestra su propio vacío en vez de redirigir | ◐ (este commit) el vacío de la lista nombra el material territorial; falta que el modo territorial sin envío no redirija mudo a la lista |
| F19 | Volver de Monitoreo a Hojas de ruta repite el precalentamiento del módulo («Acomodando rutas», ~30 s) aunque el proyecto ya esté caliente | BootGate / warm start por módulo | confunde | navegación Monitoreo → Hojas | el precalentamiento de un módulo ya visitado en la sesión no se repite | ☐ |
| F18 | En «Nueva campaña», Territorial está deshabilitado con «Primero envía la muestra desde Hojas de ruta», pero sin enlace para ir; «Campo en aulas» promete «entrega a Monitoreo» y Territorial no dice qué pasa después | diálogo `panel=nueva-campana` | confunde | texto del diálogo | enlace directo a Hojas › Selección › Entrega; describir el ciclo territorial completo (muestra → material → campo → Monitoreo) | ☑ (este commit) el territorial se describe con su ciclo («desde la muestra de Hojas de ruta; el avance se sigue en Monitoreo») y, sin envío, el diálogo enlaza a Hojas › Selección › Entrega |

### Capítulo · integración Hojas de ruta ↔ Material de campo ↔ Monitoreo

| # | Hallazgo | Dónde vive | Severidad | Evidencia | Propuesta | Estado |
|---|---|---|---|---|---|---|
| I1 | No hay ida y vuelta por UMP entre módulos: Monitoreo habla de «UMP 96» (manzana, aplicador, lo que falta) y su «Ver en el mapa» abre el mapa de Monitoreo; la ficha de esa UMP en Hojas no dice cómo va en campo ni enlaza a Monitoreo | ficha UMP de Selección (`SeleccionInspector`), filas de Monitoreo territorial | **confunde** | Monitoreo › Avance › Faltante por UMP | enlaces direccionables en los dos sentidos (`/monitoreo?modo=territorial&…&foco=<id_manzana>` ↔ `/hojas-ruta?seccion=seleccion&foco=<id_manzana>`); en la ficha de Hojas, una línea de avance leída de Monitoreo (sin duplicar su vista, D2) | ◐ ida ☑ (este commit): la ficha de la UMP en Selección lleva «Ver su avance en Monitoreo» → `/monitoreo?modo=territorial&seccion=avance&pestana=mapa&panel=ump&foco=<n.º de UMP>` (verificado: UMP 96 abre su ficha con aplicador y cuota; el n.º de UMP es la llave común). Vuelta ☐: «Ver en Hojas de ruta» en `FichaDeUmp` de Monitoreo — es de `features/monitoreo/**`, pedido de coordinación a Meta B |
| I2 | Material de campo no aparece en la barra de módulos del proyecto: se ve sólo cuando se entra por enlace (en Hojas y Monitoreo la barra lista 7 módulos sin Material) | barra de módulos / módulos habilitados del proyecto | **confunde** | texto de la barra en Monitoreo y en Material | revisar si Material debe habilitarse al enviar la muestra (o siempre en estudios territoriales) y declararlo; un estudio que envió a Material no puede esconderlo | ◐ (este commit) causa: la barra lista sólo los módulos agregados al proyecto (`addedSlugs`, `ProjectModulesContext`) y acnur_acg nunca agregó Material. Ahora «Enviar a Material» lo agrega (`addModule("material-campo")`). Sin verificar en vivo: en acnur_acg el envío está bloqueado por la muestra v1 (F13) |
| I3 | El plan por encuestador (Material › Entrega › Plan, M3 pendiente) y el aplicador real que Monitoreo lee del campo («P844 · Ejemplo Prueba Dieciocho») no se cruzan: nadie ve si el plan se cumplió | Material territorial › Entrega; Monitoreo territorial › Avance | confunde | filas de Monitoreo con aplicador | definir una sola asignación UMP → encuestador (en Material) que Monitoreo compare con lo observado: «asignada a X, la hizo Y» | ☐ |
| I4 | Monitoreo lee la muestra viva de Hojas, no la foto enviada a Material (ADR 0118 §3 dejó a Monitoreo fuera de F1): si se re-sortea después del envío, Material y Monitoreo hablan de muestras distintas | lectura de la muestra en Monitoreo territorial | confunde | ADR 0118 §3, F4 sin decidir | atado a F4 (decisión de Gonzalo): que Monitoreo también lea la foto, o que avise si la muestra viva difiere de la enviada | ⛔ |

## Orden propuesto

1. **Lo que bloquea**: F11 + F13 (la muestra v1 se ve y frena el envío) y F12 (el diagnóstico nombra la causa). Sin
   esto el flujo puede mandar a campo una muestra sesgada.
2. **Integración**: I1 (ida y vuelta por UMP), I2 (Material visible), F17 + F18 (los vacíos de Material guían).
3. **Territorio por ciudad**: F2 (inspector por ciudad), F4 (jerarquía de distritos), F6 (la miga nombra la ciudad),
   F3, F1 (guardar con respuesta inmediata).
4. **Pulido y rendimiento**: F7, F8, F9, F10, F14, F15, F16.
5. **Decisiones de Gonzalo**: F5 (aterrizar en la ciudad única) e I4/F4 (Monitoreo y Material sobre la foto).

## Ya resuelto en esta línea de trabajo

- ☑ 4e7676cd9: Territorio es un atlas de ciudades (dirección A); carga por región; huecos de huellas urbanas.
- ☑ f4d6bafeb: «PPS con tope» en el selector de métodos.
