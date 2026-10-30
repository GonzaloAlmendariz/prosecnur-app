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
| F1 | Agregar o quitar una ciudad tarda ~10 s y la única señal es el botón deshabilitado | `cambiarCiudades` en `mapa/HojasRutaMapaPage.tsx` → `POST /api/hojas-ruta/workspace` | confunde | medido en vivo al agregar Arequipa | medir el endpoint (¿re-normaliza o recalcula el marco?); respuesta optimista en la UI con estado «Guardando…» en la tarjeta y en la columna | ☐ |
| F2 | Con una ciudad abierta, el inspector de Territorio sigue global: «Del marco de Lima Metropolitana», peso de los 6 distritos de Lima aunque se mire Arequipa | `TerritorioInspector` en `mapa/territorio/TerritorioPaneles.tsx` | confunde | captura con Arequipa abierta | inspector por ciudad: cifras de la ciudad abierta, sus elegidos, su captación, y un resumen del estudio entero aparte | ☐ |
| F3 | En una ciudad abierta, las líneas de departamento (y el límite Lima–Callao) cruzan la ciudad en negro; las provincias vecinas de Lima se dibujan junto a la ciudad | `dibujarLimites` en `mapa/lienzo/limites.ts`, llamado siempre en `dibujarFondo` | pule | captura de Lima abierta | a escala de ciudad, el país y los departamentos van tenues o fuera; sólo el contorno de la ciudad y sus distritos | ☐ |
| F4 | Los distritos de una ciudad abierta se ven blancos con borde gris tenue: no hay jerarquía entre elegidos, disponibles y fuera de la ciudad | estilo de `dibujarContornos` en `dibujarFondo` | confunde | captura de Arequipa abierta | elegidos con su tono (B9), disponibles con borde del acento, el resto del mapa apagado | ☐ |
| F5 | Abrir la app sin `foco` aterriza en el atlas aunque el estudio tenga una sola ciudad con distritos | `ciudadAbiertaDeFoco` + página | pule | — | **decidir con Gonzalo**: con una sola ciudad, entrar a ella (el atlas queda a un clic con «Todas las ciudades») | ⛔ |
| F6 | Población, Muestra, Manzanas y Selección dicen «Lima · 6 distritos» en la miga aunque el estudio sea de otra ciudad | `migaLienzo` en `mapa/lienzo/flotantes.tsx` (texto fijo «Lima») | confunde | capturas de Población y Muestra | la miga nombra las ciudades del estudio («Lima y Callao · 6 distritos», «Arequipa · 4») | ☐ |
| F7 | A ancho de panel (~800 px) «Otras ciudades con cartografía 25» se parte y el contador cae en dos líneas | `.hr-atlas-lista h3` en `mapa/territorio/atlas.css` | pule | captura a ancho de panel | contador en su propia columna sin cortar (`white-space: nowrap`) o subtítulo más corto | ☐ |
| F8 | El inspector de Población deja media columna vacía bajo «Ver la matriz» | `PoblacionInspector` | pule | captura de Población | llevar ahí la pirámide de la población objetivo por sexo y edad (idea abierta desde B48) | ☐ |
| F9 | `/api/project/status` se consulta en ráfagas (decenas de veces por minuto) y `/api/hojas-ruta/state` dos veces por carga | polling del shell (`BootGate` / estado del proyecto) y efecto de la página | pule | registro de red de la pestaña | revisar el intervalo del sondeo y deduplicar la lectura de estado | ☐ |
| F10 | Dos errores 500 en consola durante la carga que no quedaron en el registro del backend ni en el buffer de red | sin localizar | confunde | consola de la pestaña | reproducir con red limpia desde el arranque y localizar el endpoint | ☐ |

## Recorrido 2 · Manzanas, Selección, Entrega

Pendiente.

## Recorrido 3 · Material de campo territorial y Monitoreo territorial

Pendiente. Capítulo propio: qué ve Material de la muestra enviada, qué ve Monitoreo del material entregado, y cómo
vuelve el avance de campo a Hojas de ruta (U18 quedó en Monitoreo, ADR 0118).

## Ya resuelto en esta línea de trabajo

- ☑ 4e7676cd9: Territorio es un atlas de ciudades (dirección A); carga por región; huecos de huellas urbanas.
- ☑ f4d6bafeb: «PPS con tope» en el selector de métodos.
