# UI v3 — Indicación 4: Lima se compone en vertical y el mapa gobierna

> Indicación del dueño, 2026-07-24. Esta indicación se ejecuta de inmediato y
> se revisa dentro del bucle; no abre un gate de aprobación.

## 1. Hallazgo que origina la indicación

El primer pase de Hojas recuperó superficie y eliminó solapes, pero resolvió el
gate equivocado: a `1024×600`, Territorio dejó un viewport cartográfico de
`512×269px` (`1.90:1`). La cifra superaba el mínimo anterior, pero convirtió a
Lima —una geografía longitudinal— en una figura pequeña dentro de una franja
panorámica. La composición resultó genérica, débil y poco profesional.

La calidad del workbench no se demuestra solo con área, ausencia de overflow o
intersección cero. También debe respetar la forma del territorio, establecer
una jerarquía inequívoca y eliminar chrome visual que compita con la tarea.

## 2. Regla cartográfica: el encuadre sigue la geografía

En Territorio y Manzanas, Lima se presenta prioritariamente en vertical:

- el viewport principal es vertical o casi cuadrado; no se usa una banda
  panorámica para una silueta longitudinal;
- la geometría útil ocupa el encuadre: no queda reducida al centro por espacio
  lateral o superior sin función;
- la columna cartográfica conserva continuidad de arriba abajo y recibe más
  altura que texto, KPIs o explicación;
- títulos, métricas, búsqueda, selección y detalle viven en el inspector
  auxiliar o en una cabecera realmente compacta; no forman un segundo panel
  editorial encima del mapa;
- zoom, escala, leyenda e información se apoyan en esquinas distintas, con
  contraste sereno y sin tapar la geometría focal.

No se estira ni deforma el SVG. Se ajustan layout, `viewBox`/encuadre,
`preserveAspectRatio` y densidad del chrome para que la geografía conserve su
proporción y gane presencia.

## 3. Composición profesional del workbench

El mapa no se rodea de una colección uniforme de tarjetas. La jerarquía es:

1. **superficie primaria** — mapa grande, continuo y con encuadre territorial;
2. **operación inmediata** — selección, búsqueda, fase y acción principal;
3. **evidencia auxiliar** — métricas y estado en una banda discreta;
4. **explicación** — texto breve solo cuando ayuda a decidir.

La segunda pasada visual debe:

- reducir bordes, cápsulas, sombras y radios repetidos;
- evitar “card dentro de card” y filas de mini-KPIs con el mismo peso;
- usar tamaño, alineación y espacio antes que decoración;
- mantener el acento Hojas `#C2410C` en selección, foco y acciones, sin teñir
  el mapa ni reemplazar los colores semánticos;
- conservar los cuatro readiness y la fase, pero como información compacta,
  no como protagonista;
- hacer que la primera captura poblada comunique “cartografía de campo”, no
  “dashboard web”.

## 4. Gate medible que supersede el mínimo cartográfico anterior

Para Hojas, el gate `500×250px` de la indicación 3 ya no basta por sí solo.
Territorio no aprueba hasta demostrar:

1. a `1024×600`, rail recomendado de `64px`, el viewport cartográfico principal
   tiene relación `ancho/alto ≤ 1.25` y al menos `360px` en ambas dimensiones;
2. a `1361×987`, el viewport es vertical (`ancho/alto ≤ 0.95`) o la composición
   demuestra mediante medición que la silueta de Lima ocupa al menos `70%` de
   la altura útil sin quedar visualmente pequeña;
3. el bounding box visible de la geometría focal ocupa al menos `60%` de la
   altura del viewport y no se deforma;
4. zoom, leyenda e información mantienen intersección `0` entre sí y con la
   acción principal;
5. el panel auxiliar no reduce el mapa por debajo de esos límites y tiene un
   recorrido claro, sin mosaico de cards equivalentes;
6. una revisión visual independiente compara antes/después y puede explicar
   por qué la nueva composición se ve deliberada y profesional.

Manzanas aplica el mismo principio a su mapa de inspección. Si el contenido
propio de la etapa exige scroll, el mapa conserva primero un viewport vertical
o casi cuadrado y el resto continúa debajo; no se aplasta en una franja.

## 5. Regla de propagación

Este criterio se extiende a cualquier módulo con geografía longitudinal,
matriz alta, editor de columnas o canvas cuya forma intrínseca no sea
panorámica. “Superficie dominante” siempre significa respetar la anatomía del
contenido, no maximizar un rectángulo indiferenciado.
