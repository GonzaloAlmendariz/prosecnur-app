# Monitoreo: criterios generales y prueba con la selección real

Tipo: Checklist de trabajo
Estado: Vigente
Fecha: 2026-08-26
Autoridad: Encargo de Gonzalo del 2026-08-26; los criterios los gobiernan el ADR 0079 (cumplimiento contra la cuota) y el ADR 0082 (τ como supuesto declarado)

Encargo de Gonzalo, textual: **«debe tomar en cuenta no elementos específicos
de que hacerle seguimiento sino criterios generales que tenemos que tomar en
cuenta en Monitoreo»**. El audit anterior iba componente por componente; esto
va por criterio de dominio, y los componentes salen de ahí.

## Los cinco criterios generales

Son las afirmaciones que Monitoreo tiene que sostener siempre. Cada ítem de
trabajo se justifica contra uno de ellos.

| | Criterio | Por qué se rompe |
|---|---|---|
| **C-A** | **La cuota es por facultad, y dentro de ella por sexo.** Nada se compensa entre facultades ni entre celdas. | Pasarse en Derecho no cubre lo que falta en Letras. Un total agregado siempre sale más favorable que la suma de los déficits. |
| **C-B** | **Efectivas y elegibles son dos cosas y nunca comparten rótulo.** | Son numerador y denominador de τ. En el histórico 2025, 8 de 194 aulas rinden efectivas **por encima** de sus elegibles (máximo 1,29): los dos campos ni siquiera comparten universo. |
| **C-C** | **Una encuesta efectiva la definen los filtros iniciales declarados**, no un umbral posterior ni el parte del aplicador. | «La efectiva se define en la plataforma, no en el parte» (`monitoreo_aulas_efectivas.R`). Sin filtros declarados, el motor cuenta todo: medido en la fixture, «la base no trae columna de estado, así que cuentan las 3 700 respuestas». |
| **C-D** | **El seguimiento de efectividad contrasta lo supuesto con lo observado y decide activación de reservas** — no informa una tasa. | Si la señal llega sin fecha límite, sin el sexo que falta o contando de menos el respaldo, informa pero no decide. |
| **C-E** | **Las tres dimensiones del libro se leen y se elaboran bien porque son lo que va a campo.** | Agendación, registro de campo y base de control. Un archivo que se genera sin error pero que nadie entiende no sirve. |

## El estado real medido, 2026-08-26

Sobre `~/Documents/Pulso/HSTVG2026/HSVG26ULT.pulso` (12,1 MB, guardado el
2026-08-26 14:33). **Trabajado siempre sobre copia; el original no se toca y
nunca entra al repositorio** — lleva nombres, correos y teléfonos de docentes.

- Selección cerrada: **174 titulares · 1 259 de cadena · 79 de banco** = 1 512
  filas × 86 columnas. **6 119 elegibles** en titulares, **15 facultades**.
- `calc-muestra: ready` · **`recopiladores: active`** · **`monitoreo: pending`**.
- **`link` vacío en 1 512 de 1 512 filas.** El handoff de Recopiladores no ha
  escrito enlaces pese a que el módulo está activo. Es exactamente la trampa que
  la sesión hermana midió antes (0 de 951): generar el libro sin ese paso deja
  «ENLACE DE LA FICHA» vacío.
- **`monitoreo_config` ausente**: la selección no se ha trasladado a Monitoreo.
  El traslado que hay que probar está sin hacer, así que el punto de partida
  está limpio.

## Checklist

Cada ítem dice **dónde vive** y contra qué criterio responde. Ninguno se cierra
sin verlo en la aplicación.

| # | Ítem | Dónde vive | Criterio | Estado |
|---|---|---|---|---|
| **T1** | Trasladar la selección de 174 aulas de Cálculo de muestra a Monitoreo **desde la UI**, no por script | `SalidasMonitoreoTab.tsx` → import de Monitoreo | C-E | ☐ **SIGUIENTE** |
| **T2** | Fabricar **una semana** de campo sobre ese traslado: agendación, aplicación, respuestas de plataforma y base de control | copia de trabajo, nunca el original | C-C, C-E | ☐ |
| **T3** | Poner a prueba C-A a C-E contra ese estado y anotar qué se rompe | recorrido por la UI | todos | ☐ |
| **T4** | Definición de encuesta efectiva desde los filtros iniciales: comprobar que se declara y que el motor la respeta | `criterio_validez`, `valid_filters` | C-C | ☐ |
| **T5** | Efectivas vs elegibles: buscar dónde comparten rótulo o denominador | perfil de aulas | C-B | ☐ |
| **T6** | Cuotas por facultad y por sexo: que ninguna superficie compense entre celdas | `avance_cuota`, cuotas | C-A | ☐ |
| **T7** | Las tres dimensiones del libro: leerlas y juzgar si se entienden en campo | `carga_aulas_libro_generar.R` (ya existe, **no se construye**) | C-E | ☐ |
| **T8** | **La tabla de avance para el cliente**: avance por facultad × sexo contra **muestra y sobremuestra**, más **aulas aplicadas** | entregable, por definir dónde | C-A | ☐ |
| **T9** | Gráficos y diagramas: mejorar los actuales y proponer los que faltan | perfil de aulas | C-D | ☐ |
| **T10** | Formato y estética del resto del perfil, con el criterio ya aprobado | perfil de aulas | — | ◐ parcial (seis listas y contraste hechos) |

## Lo que ya está cerrado y no se rehace

- Seguimiento de τ (ADR 0082): motor, tabla, disparador por margen, backtest
  2025. Ver `seguimiento-tau-campo-2026-08-26.md`.
- Seis listas con cabecera oculta reparadas; contraste WCAG AA medido (594
  elementos, cero incumplimientos).
- **El libro de las tres dimensiones ya existe**: `aulas_libro_hoja_agendadas()`,
  `aulas_libro_hoja_aplicadas()`, `aulas_libro_hoja_control()`, por
  `POST /api/monitoreo/aulas/generar-libro`. T7 lo audita, no lo construye.

## Decisiones que esperan a Gonzalo

1. **Cinco del libro de agendación**, abiertas desde el 2026-08-20 en
   `checklist-sinergia-agendacion-2026-08-20.md`: banco en hoja propia ·
   columnas de meta en el bloque · re-armado del plan de Recopiladores ·
   botón del libro en Entrega.
2. **E8**: «Del potencial» y la proyección del banco nombran tasas con
   numeradores distintos. No se renombran sin su palabra.
3. **¿El seguimiento de τ entra en algún entregable interno?**
4. **T8**: qué forma tiene la tabla de avance para el cliente y dónde vive
   —¿PDF de avance, hoja del libro, pantalla?—. Se propone y se confirma.
