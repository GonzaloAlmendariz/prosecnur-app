# ADR 0109: Material de campo se compone e imprime según el tipo de campo

Estado: Aceptado

Implementacion: No iniciada

Fecha: 2026-10-16

Fecha de decision: 2026-10-16 (Gonzalo, sobre el canvas de E1: «Sí a todo»)

Reemplaza: —

Extiende: [ADR 0108](0108-material-de-campo-catalogo-de-materiales-por-unidad.md) (secciones, etapa E1 y composición
de materiales). Sus cláusulas siguen vigentes salvo las secciones de §5, que este ADR amplía.

Referencia visual: canvas «Revamp de Material de campo» (artifact privado `W7xx1vTeBZE2tkdJtQCcSy`), artboards 1 a 10.
Checklist: [material de campo](../qa/checklist-material-de-campo-2026-10-16.md), sección E1.

## Contexto

El primer canvas de E1 se dibujó con rectángulos y sobre un solo estudio, y Gonzalo lo encontró poco profesional y
sin los recursos ni el manejo de PDF que el campo pide. El segundo canvas se armó sobre las páginas reales de Ser
Adolescente 2026 y de la app (ficha de aula y ficha de campo con croquis). De esa revisión salieron tres hechos:

- **El papel ya resolvió reglas que la app debe sostener**: cabecera y pie que identifican la ficha y su cara, cuota
  por celda con casillas de efectivas, orientación según el uso (consolidados y distribución apaisados, consentimiento
  en media A4 dos por hoja), marca de agua y una carpeta numerada con su instructivo de impresión.
- **Ser Adolescente es un caso, no el molde.** «Urbana» y «periurbana» son variantes de ese estudio; otros estudios
  separan por sede, por actor, por tipo de establecimiento o no separan. Los perfiles de cuota pueden ser de cualquier
  cosa.
- **El material se construyó conversando**: «agrega una tabla de seguimiento con estas columnas», «pon el mapa de este
  distrito». Esa forma de trabajo es la que la app debería ofrecer, sin volverse un editor libre.

## Decisión

### 1. Cuatro capas, ninguna fija en la app

| Capa | Qué es | Quién la define |
|---|---|---|
| Unidad | Lo que recibe material: aula, manzana, ficha, actor, establecimiento, lote de llamadas | El módulo de origen (ADR 0108 §2) |
| Variante | Un tipo de unidad dentro del estudio, con su propia receta (caras, bloques, texto) | El estudio la nombra; la app no trae valores |
| Perfiles y ejes | Las celdas de cuota y lo que exige cada una | El estudio los declara (ADR 0086); un eje puede fijarse por variante |
| Materiales | Recetas compatibles con la unidad y la variante | Material de campo |

La app no conoce «urbano», «periurbano» ni ningún valor de variante o de eje: los lee de la fuente.

### 2. Tipos de campo que el módulo atiende

| Tipo de campo | Fuente de unidades | Materiales típicos | Estado |
|---|---|---|---|
| Aulas con recopilador | Cálculo de muestra · cursos-horario | Ficha con QR, afiche QR, ficha con croquis | Hoy (modo `aulas`) |
| Territorial por manzana | Hojas de ruta · marco | Ficha de dos caras, hoja de zona, reemplazos | E2 |
| Territorial por cuotas | Hojas de ruta · modo sin marco | Hoja de ruta, ruteo, consolidados, consentimiento | E4 |
| Acreditación multiactor | Cálculo de muestra · actores | Invitación con enlace, QR por actor, afiche | A definir |
| Telefónico | Marco disponible · listado | Guion de llamada, hoja de resultados | A definir |
| Establecimientos y servicios | Marco disponible · sedes | Carta de presentación, ficha de visita | A definir (manual) |

### 3. Secciones según el modo

El recorrido base es **Unidades · Catálogo · Imprenta · Paquetes · Entrega**. **Accesos** se agrega solo en los modos
con canal digital (aulas, acreditación y, cuando exista, telefónico); en un campo de papel no aparece. Esto cumple la
regla del ADR 0044: el modo reescribe el juego de secciones.

| Sección | Pestañas |
|---|---|
| Unidades | `lista` · `origen` |
| Accesos (solo con canal digital) | `canales` · `vinculacion` |
| Catálogo | `tipos` · `editor` · `componer` |
| Imprenta | `carpeta` · `pliego` |
| Paquetes | `armado` · `recibos` |
| Entrega | `traspaso` · `archivos` |

La pestaña `prueba` de Paquetes que preveía el ADR 0108 se reemplaza por la sección Imprenta.

### 4. Imprenta es parte del diseño

Imprenta decide cómo sale el papel, no la impresora:

- **Carpeta numerada** 01 a N con el orden de imprenta y su `LEEME_impresion` generado.
- **Por material**: papel (A4 o Carta), orientación, caras (simple o dúplex por el borde largo), páginas por hoja (1, o
  2 con línea de corte), copias (por unidad, por encuesta, por sede o una vez) y marca de agua.
- **Pliego físico**: vista de frente y dorso, o de las dos copias con su corte, sobre las páginas reales.
- **Conteo** de hojas físicas por archivo y de toda la carpeta, en hojas y resmas.

La imposición (dúplex, dos por hoja) es un paso posterior a la compilación y usa las mismas páginas del compilador
`grid`; ningún PDF entra al `.pulso` (ADR 0046 §8 y §12).

### 5. Componer a medida

En Catálogo › Componer se arma un tipo nuevo con bloques **parametrizados** del registro cerrado:

- tabla de seguimiento con columnas elegibles y una fila por encuesta de la meta (las filas siguen a la meta);
- mapa del área que sigue a la unidad (distrito, zona o manzana), con o sin vecinos;
- lista de lugares con casillas y su tope;
- cuotas por celda con los ejes del estudio;
- datos de la unidad en dos columnas;
- recuadro libre para recorrido u observaciones.

Se reordena, se quita, se deshace y se guarda como tipo nuevo del catálogo. No hay cajas libres, coordenadas, HTML ni
CSS (ADR 0046 §11 sigue vigente).

### 6. Pedir un cambio en palabras (etapa propia)

Una barra permite pedir el cambio como se pidió en Ser Adolescente («agrega una columna de distrito de nacimiento»).
El pedido se traduce a un **cambio sobre la receta dentro del registro cerrado**, se muestra como propuesta con su
diferencia y solo se aplica si la persona la acepta; siempre se puede deshacer.

Reglas que este ADR fija ya:

- solo viaja la estructura de la receta (bloques, rótulos, parámetros), **nunca datos de unidades ni personales**;
- una propuesta que no cabe en el registro se rechaza con su motivo, no se improvisa un bloque;
- la app funciona entera sin esta barra.

El proveedor del modelo, el manejo de su credencial (ADR 0005) y el modo sin conexión quedan **bloqueados hasta una
decisión aparte**; la etapa E6 no empieza sin ella.

### 7. Lenguaje visual

Se adopta el del canvas: fondo `--pulso-bg`, superficies blancas con filete y radio de panel, acento Musgo solo en
selección, acción principal y procedencia del dato, y las miniaturas reales del compilador en galería, editor e
imprenta. Se heredan las reglas del revamp de Formularios (contenedores con cabecera y pie, dos niveles neutros, sin
píldoras pastel, container queries, movimiento de 240 ms como máximo, medición de recortes por script).

### 8. Etapas que reemplazan la E1 del ADR 0108

| Etapa | Contenido |
|---|---|
| E1a | Secciones por modo (Imprenta nueva, Accesos solo con canal digital), catálogo con miniaturas reales, cuatro capas en el modelo de unidad |
| E1b | Editor sobre la página real, con zonas por bloque y caras |
| E1c | Componer a medida con bloques parametrizados |
| E1d | Imprenta: carpeta, imposición, pliego físico y conteo |
| E6 | Pedido en palabras (bloqueado por §6) |

## Consecuencias

- Las direcciones de Material de campo suman `imprenta` y la pestaña `catalogo/componer`; `paquetes/prueba` nunca se
  crea.
- El modelo de unidad (`field_unit/v1`, ADR 0108 §2) lleva `variant` y la referencia a los ejes declarados; ningún
  enum de variantes vive en el código.
- La imposición agrega trabajo al job de render y su verificación por página.
- Componer amplía los parámetros de bloques ya registrados; cada parámetro nuevo entra con su validación y su test.
- E6 introduce una dependencia externa: hasta decidirla, la barra no se muestra.

## Cumplimiento

- Ningún valor de variante o de eje aparece como literal en `frontend/src` ni en `api/R` (test de contrato).
- Accesos no aparece en un modo sin canal digital; Imprenta aparece en todos (contratos de navegación).
- La imposición dúplex y dos por hoja se verifica sobre PNG por página (frente, dorso, línea de corte).
- Un tipo compuesto solo usa bloques del registro; uno inválido se rechaza con su código `E_*`.
- E6: un test prueba que la propuesta enviada no contiene datos de unidades.

## Notas

Relacionado con [ADR 0044](0044-jerarquia-y-direcciones-de-navegacion.md),
[ADR 0046](0046-recopiladores-despliegue-recoleccion.md), [ADR 0086](0086-el-eje-de-cuotas-lo-declara-el-estudio.md) y
[ADR 0005](0005-secretos-fuera-del-proyecto.md).
