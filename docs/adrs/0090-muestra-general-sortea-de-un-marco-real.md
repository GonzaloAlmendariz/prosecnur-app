# ADR 0090 — Muestra general sortea de un marco real

- **Estado**: Propuesto
- **Implementación**: Pendiente
- **Ámbito**: Cálculo de muestra, modos `marco-disponible` y `acreditacion` ·
  archivo nuevo `api/R/calc_muestra_general_sorteo.R` · rutas nuevas
  `/api/calc-muestra/general/*` · sección nueva «Selección» en el modo general
- **Fecha**: 2026-09-24
- **Origen**: loop de Cálculo de muestra (encargo de Gonzalo, 2026-09-23). Vara
  aprobada: «Cada modo calcula un n que cuadra con la fórmula de referencia,
  sortea unidades de un marco real con semilla reproducible, publica π y pesos,
  y entrega memoria de cálculo + listado — y un usuario nuevo lo recorre sin
  ayuda.»
- **Relación**: hereda de los ADR 0066 (la π publicada es la del sorteo
  ejecutado) y 0073 (misma muestra en toda máquina). Research:
  [research-calc-muestra-robustez-2026-09-23.md](../qa/research-calc-muestra-robustez-2026-09-23.md)
  (R6, R7, R10, R11, R12; hallazgo H10).

## Contexto

El modo de cursos-horario (aulas) calcula, sortea, arma reemplazos, certifica y
exporta. Muestra general y Acreditación **sólo calculan n**: no aceptan un marco
como archivo (Marco es una ficha de texto libre y N no se declara en ninguna
parte visible), no sortean, no publican π ni pesos y no entregan un listado. El
único endpoint de trabajo es `/api/calc-muestra/calcular`. Un investigador que
llega con un padrón de 5.000 personas se lleva un número y tiene que sortear en
otra herramienta, sin dejar rastro del sorteo en el proyecto.

## Decisión

### 1. El marco es un archivo con tres columnas declaradas

Se reutiliza la subida de archivos existente (`uploads` de la sesión) y su
inspección (`calc_muestra_aulas_inspect_workbook`, el explorador de base). El
usuario declara:

| Rol | Obligatorio | Uso |
|---|---|---|
| `id` | sí | clave única de la unidad; ordena el marco antes de sortear |
| `estrato` | no | estratificación y reparto (`.cm_general_reparto`) |
| `tamano` | sólo para PPS | medida de tamaño (MOS) |

Al declararlo, el motor valida (ids duplicados o vacíos, estratos vacíos,
tamaños no numéricos o ≤ 0) y **escribe** N y los N_h en el componente: el N
del cálculo sale del marco, ya no se teclea. El archivo vive en `files/` del
`.pulso` como cualquier input.

### 2. Métodos de la primera versión

| Método | Selección | π_i |
|---|---|---|
| MAS | sin reemplazo sobre el marco ordenado por `id` | n/N |
| Sistemático | intervalo fraccional k = N/n, arranque U(0, k], sobre el orden declarado (por `id` o por una columna) | n/N |
| Estratificado | reparto `.cm_general_reparto` (mayor resto, piso, tope N_h) + MAS por estrato | n_h/N_h |
| PPS sistemático | π_i = n·x_i/X con certezas iterativas (`.cm_aulas_inclusion_probabilities`, ya verificada contra `sampling::inclusionprobabilities`) | la calculada |

El cubo balanceado queda fuera de la v1: su reproducibilidad entre plataformas
aún es parcial (ADR 0073).

### 3. Reproducibilidad

- El sorteo corre en un bloque que **guarda y restaura** `.Random.seed` y fija
  `RNGkind("Mersenne-Twister", "Inversion", "Rejection")` dentro del bloque
  (patrón de `calc_muestra_perfil.R`).
- El marco se ordena por `id` antes de sortear; su SHA-256 (sobre el marco
  ordenado y las columnas declaradas) y el de la configuración se publican.
- La semilla de cada estrato se deriva de `(semilla, clave del estrato)` por
  hash, no de su posición: reordenar los estratos no cambia la muestra de
  ninguno (a diferencia de `seed + length(rows) + 13L` de aulas).
- Cada corrida publica `{semilla, rng_kind, r_version, metodo, marco_hash,
  config_hash, run_id}`. Misma semilla + mismo marco = mismo listado, byte a
  byte, en cualquier máquina.

### 4. Salida por unidad

`id`, `estrato`, `N_h`, `n_h`, `pi`, `peso_base = 1/pi`, `orden`, `estado`
(`titular` | `reserva`), `lote_reserva`. El n de titulares es `n_operativo`
(ya inflado por respuesta, commit b21c59e1b).

### 5. Reservas como réplicas liberadas, no como reemplazos por puntaje

La sustitución de campo no corrige la no respuesta (Chapman 1983; Vehovar
1999). Las reservas se sortean con la misma semilla, **dentro del estrato**,
en orden aleatorio y en lotes. Si se libera un lote, todos sus casos se
trabajan hasta el final y la π del estrato se recalcula como
(n_h + liberadas)/N_h: la π sigue conocida. No se ofrece «el siguiente más
parecido».

### 6. Superficie

El modo general gana una sección **Selección** entre Método y Resultados
(`?modo=marco-disponible&seccion=seleccion`), y Marco gana la carga del
archivo. Acreditación reutiliza el mismo motor por actor (E5 del loop).
Entrega: listado XLSX con una hoja de metadatos de la corrida (E6).

## Contrato HTTP

| Ruta | Body | Respuesta |
|---|---|---|
| `POST /api/calc-muestra/general/marco` | `{componente_id, file_id, hoja?, columnas: {id, estrato?, tamano?}}` | `{ok, marco: {N, estratos: [{clave, N_h}], validacion: {duplicados, vacios, tamanos_invalidos}, marco_hash}, componente}` |
| `POST /api/calc-muestra/general/seleccionar` | `{componente_id, metodo, semilla?, orden_por?, reservas_por_estrato?}` | `{ok, corrida: {run_id, semilla, rng_kind, r_version, metodo, marco_hash, config_hash, n_titulares, n_reservas}, estratos: [{clave, N_h, n_h, pi}], unidades: [...]}` |
| `GET /api/calc-muestra/general/corrida` | `?componente_id` | la corrida vigente completa, para rehidratar al reabrir |
| `GET /api/calc-muestra/state` (existente) | — | gana `general: {marcos, corridas sin unidades}` |
| `POST /api/calc-muestra/general/exportar` | `{componente_id}` | `{ok, export: {file_id, filename, size}}` — libro con Corrida, Memoria de cálculo (sustituida), Estratos y Listado; patrón de `/aulas/exportar` |

Errores con `stop_api` y códigos `E_CALC_MUESTRA_GENERAL_*` registrados en
`errors_registry.R`.

Las rutas que publican π (`/seleccionar`, `/corrida`) serializan **sin
redondeo** (`digits = NA`): el serializador global deja 4 decimales y una π de
0.0000371 viajaba como 0. Por eso `/state` lleva el resumen sin unidades.

## Consecuencias

- La vara del loop se vuelve alcanzable para Muestra general y Acreditación.
- El N deja de ser un número tecleado cuando hay marco: la fórmula y el sorteo
  miran el mismo universo.
- Aulas no cambia: este motor no toca `calc_muestra_aulas*.R`; sólo **llama**
  a `.cm_aulas_inclusion_probabilities`.
- Queda abierto: cubo balanceado reproducible, sorteo multietápico (el
  territorial vive en Hojas de ruta) y la calibración de pesos posterior al
  campo.
