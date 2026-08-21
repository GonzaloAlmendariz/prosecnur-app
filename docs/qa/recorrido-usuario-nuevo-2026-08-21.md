# Recorrido del usuario nuevo — Cálculo de muestra (2026-08-21)

Mandato de Gonzalo: «que la experiencia usuaria de un usuario nuevo sea muy
limpia y muy pulcra y no falle… si le paso este motor a otra persona, que sea
capaz de subir la base de estudiantes, la de cursos-horario y la histórica sin
ningún problema… un loop iterativo prolongado, no una comprobación superficial».

**Cómo se testea aquí**: sesión limpia, proyecto creado desde cero, archivos
reales del estudio subidos por la interfaz, y cada hallazgo reproducido en vivo
antes de tocar nada. Leer el código sirve para formular una hipótesis; no cuenta
como verificación.

## Lo que el recorrido atraviesa

Bienvenida → armar proyecto → elegir camino de cálculo → mesa con cinco
secciones (Datos · Marco · Cálculo · Selección · Entrega). La propia app declara
sus seis pasos: Definir → Subir bases → Mapear variables → Construir marco →
Calcular → Seleccionar cursos-horario.

## Hallazgos y reparaciones

| # | Qué le pasa a quien recibe la app | Estado |
|---|---|---|
| 1 | El primer paso mandaba a una pestaña **«Bases» que ya no existe** (se llama Fuentes), y ese panel son seis iconos sin rótulo | ☑ `444ea6d9` — nombre correcto y botón que lleva |
| 2 | Subir la base **inspeccionaba el mismo Excel dos veces** (1.374 ms + 1.087 ms): la mitad de la espera era trabajo repetido | ☑ `5715dc5f` |
| 3 | «Filas (vista previa) 80» sobre una matrícula de 137.930 invitaba a creer que solo entraron 80 | ☑ `debaa24d` — dice por qué son 80 y dónde saldrá el total |
| 4 | Al **reemplazar** un archivo, la tarjeta decía «listo» mientras leía el nuevo, contradiciendo a su propia zona de carga | ☑ `eebf30ca` |
| 5 | El error de la base histórica **volcaba las 140 columnas** del archivo y enterraba el dato accionable | ☑ `8b94da93` |
| 6 | De los **ocho** Excel «históricos» del estudio solo uno sirve, y no había forma de saberlo sin fallar | ☑ `7da1ce15` — la tarjeta declara las 10 columnas exigidas, servidas por el motor |
| 7 | **El marco se construía con un mapeo distinto del que muestra la pantalla**: 847 «cursos-horario» (franjas horarias) en vez de 5.269 | ☑ `38291741` — lo que la pantalla muestra es lo que viaja |
| 8 | Adivinar columnas ausentes cambiaba los números del estudio en silencio (21.920 → 2.461 elegibles) | ☑ revertido en `0aae5fb6`; declarado en `b6764c0a` y `f3efbfc5` |
| 9 | La radiografía por facultad pedía «reconstruir» cuando lo que faltaba era **declarar criterios** (dos builds de 40 s sin efecto) | ☑ `c66a578a` + `4d77d709` (las dos superficies) |
| 10 | Declarar un criterio en **una** facultad mueve las cifras de **todas** (3.142 → 3.402), y nadie lo decía | ☑ `6080b12f` — el cambio de régimen se anuncia |
| 11 | La tasa heredada del estudio anterior se presentaba como propia, con **tres nombres distintos** y con τ | ☑ `8ef56656`, `512aacc0`, `585506a0`, `0eaf6bfd` |
| 12 | Un proyecto recién creado decía **«existe una corrida previa»** (objetos vacíos leídos como contenido) | ☑ `a6386fe2` |
| 13 | **La app perdía de vista un trabajo que seguía corriendo**: recargar durante la comparación (>10 min) devolvía «falta comparar» con el trabajo vivo al 6 % | ☑ `0d4f4a67` + `77e2ab57`; corrección propia en `75a3f1c8` |
| 14 | El aviso de facultad sin aulas nombraba la **clave interna** y no ofrecía salida | ☑ `9359552d` + `ca044197`, corregido en `ce920866` (la salida ofrecida no desbloqueaba) |

## Lo que está bien y conviene no romper

- El **selector de caminos** explica cada opción con «¿a quién representa? / ¿qué
  se calcula? / ¿qué queda listo?» y avisa que cambiar de camino reinicia la mesa.
- La pestaña **Diseño** despliega la fórmula con sus valores sustituidos y explica
  cada parámetro en lenguaje llano.
- **La vara de los criterios se cumple**: se declaran por facultad, viendo su
  radiografía, y la tarjeta separa los tipos que no existen en esa facultad.
- Al cambiar criterios, las cifras se marcan **«criterios cambiados · reconstruye»**
  en vez de fingir estar al día.
- El progreso de un trabajo largo se ve **desde cualquier sección**, con etapa y
  tiempo transcurrido.
- Entrega **declara su vacío con el camino**: «genera la selección… para armar el
  paquete».

## Falsas alarmas descartadas midiendo (y qué enseñan)

- «La UI se traga el error» (×2): en ambos casos el mensaje **sí estaba**, en un
  banner de página. → Antes de decir silencio, leer todas las alertas de la
  página, no la tarjeta que se está mirando.
- «Falta un botón de confirmar»: existía; mi listado estaba truncado. → No
  concluir ausencia desde una lista recortada.
- «El chip miente sobre la decisión»: reproduje otro estado distinto del real. →
  Reproducir el estado exacto antes de acusar.
- «Se perdió el trabajo por navegar»: era **recargar**, y se confirmó sin
  ediciones en caliente de por medio.
- «El alias del tipo de curso desbloqueaba la radiografía»: no era el bloqueo; el
  alcance se corrigió en `a84634c3`.

## Decisiones abiertas de Gonzalo

### 1. El reparto no se regenera y deja el cálculo sin salida

Un estudio cuyo componente declara una facultad que el marco no puede cubrir
**no tiene salida desde la interfaz**: el reparto solo se regenera al calcular, y
calcular es justo lo que el desajuste bloquea.

No es un caso raro. **Se dispara con la acción que la propia app ofrece**:
excluir facultades que no participan (Marco › Cursos-horario). Medido — con el
marco reducido a tres facultades, el cálculo se bloquea porque el componente
sigue declarando quince. Y ocurre igual sin tocar nada, porque el preset declara
una facultad a la que el marco 2026-2 no da aulas elegibles.

Opciones: podar los estratos inexistentes al construir el marco; ignorar con
aviso las facultades sin aulas; o una acción explícita para quitarlas del
reparto. Toca el reparto de cuotas, así que no se ejecuta sin su palabra.

### 2. Comparar métodos no cabe en el techo de tiempo

Con un marco de este tamaño la comparación **no puede completarse**: el
seguimiento del navegador se rinde a los 30 minutos y, al hacerlo, cancela el
trabajo (deliberado: no dejar procesos huérfanos). Medido: 47 % a los ~35 min,
estimado ~75 min para 68 corridas.

Dato para no decidir a ciegas: **el recorte automático ya existe y ya actuó** —
el motor limita el costo a 60.000 (aulas × corridas) con piso de diez, y con
3.490 aulas eso dio 17 corridas, bajando de 500.

**El tamaño sí importa** (medido, corrigiendo una estimación previa mía): sobre
un marco de **57 aulas** la comparación completa —500 corridas por método, sin
recorte— tarda **19,3 minutos** y cabe en el techo. Sobre 3.490 aulas se va a
~75 minutos y no cabe. El presupuesto de 60.000 es un **techo**, no un objetivo:
los marcos chicos quedan por debajo y por eso son más rápidos. El punto de corte
está en algún lugar intermedio y merece medirse si se decide por esta vía.

La interfaz, eso sí, no ofrece elegir menos corridas.

Salidas reales: subir o parametrizar el techo de 30 minutos; bajar el
presupuesto de costo del comparador; o dar control de corridas al usuario.

*Mientras estas dos sigan abiertas, el sorteo y todo lo que va después
(Solidez, Reemplazos, Entrega con selección) no se pueden recorrer de punta a
punta con un marco de este tamaño.*
