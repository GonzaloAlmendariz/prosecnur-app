---
tipo: modo
padres:
  - "[[Monitoreo]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico"
tags:
  - Modo
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/TelefonicoMonitoreoPage.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/telefonicoGoalModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/telefonicoTeamModel.ts"
  - "frontend/src/features/monitoreo/core/monitoreoRegistry.ts"
  - "api/R/monitoreo_telefonico.R"
  - "docs/plan-monitoreo-telefonico-2026-07.md"
---
# Telefónico

> Gobierna una operación de llamadas sobre un marco contactable, conciliando lo que registra el equipo con lo que registra la plataforma.

## Propósito de esta guía

Este modo se usa cuando el estudio se levanta por teléfono sobre una base de contactos. Su unidad de trabajo es la **llamada**, y su dificultad característica es que hay **dos registros de la misma realidad**: la hoja donde el equipo anota lo que pasó en cada llamada, y la plataforma donde queda la encuesta. Buena parte del modo existe para conciliar ambas.

Es un modo independiente del de Acreditación aunque compartan vocabulario: sus fuentes, sus estados y sus salidas son propios.

## El contrato que hay que entender antes de leer cualquier cifra

**1. La cuota es un mínimo, y lo que falta por barrer es reserva.** La meta la declara el usuario y es un piso, no un techo ni un objetivo exacto. De ahí que superar el 100 % sea un cierre limpio y no una anomalía, y que *por barrer* no sea el titular de ninguna pantalla: es la base disponible que aún no se ha trabajado. La reserva sólo asciende a primer plano cuando hay brecha, y entonces con la lectura que decide: cuántas faltan, cuánta base queda y si alcanza al ritmo actual.

**2. Los estados telefónicos se leen en cruz.** Es la información más rica del campo telefónico, y sólo funciona si se miran las dos direcciones a la vez:

```mermaid
flowchart LR
    A["Matriz estado × encuestador"] --> B["Hacia abajo: calidad de la base"]
    A --> C["Hacia el lado: desempeño del equipo"]
    B --> D["Números que no existen, incorrectos o suspendidos concentrados en un tramo"]
    C --> E["Rechazo alto: trato o guion · No contesta alto: franja horaria"]
```

Sin el corte por encuestador **y** el general en la misma pieza, ninguna de las dos lecturas es posible.

**3. La diferencia entre plataforma y barrido es una señal temprana, no un dato de cierre.** Cuando la plataforma registra más efectivas que la hoja, significa que alguien está entrevistando sin registrar el estado. Se corrige pidiéndoselo a quien tiene los casos sin marcar, y por eso el corte relevante es **por responsable**, no el total del equipo.

**4. El enlace equivocado existe y hay que distinguirlo.** Cuando un encuestador abre el enlace de otro caso, el código que viajaba en el enlace y el que escribió a mano no coinciden, y el cruce apunta a la persona equivocada. Hay dos familias que no deben mezclarse: una diferencia de **formato** del código es cosmética; un código que **no cruza o cruza contra el caso equivocado** es crítico.

## Antes de recorrer este nivel

Confirma que existe un marco contactable con responsables asignados, que la plataforma tiene su encuesta activa y que sabes qué se declaró como cuota. Si no hay cuotas, el modo sigue funcionando: cambia el contenido de la pantalla, no su forma.

## Mapa de navegación

Desde el revamp de 2026-10-23 el modo se recorre en cuatro secciones, en el orden del operativo, y aterriza en Avance › Cuotas.

```mermaid
flowchart TD
    N["Telefónico"]
    N --> C1["Insumos telefónicos"]
    N --> C2["Modelo operativo telefónico"]
    N --> C3["Control telefónico"]
    N --> C4["Avance telefónico"]
```

## Guía de destinos

| Destino | Cuándo entrar | Qué hacer allí | Qué deja listo |
|---|---|---|---|
| [[Insumos telefónicos]] | Al montar el estudio y cuando una cifra no cuadre | Declarar fuentes, llave, filtros y status | El corte y el cruce Kobo–hoja |
| [[Modelo operativo telefónico]] | Al fijar qué se espera del operativo | Declarar cuotas y calendario | El criterio de cumplimiento |
| [[Control telefónico]] | Durante el campo, todos los días | Revisar barrido, insistencia, equipo, discrepancias, respuestas, supervisión y avisos | El gobierno diario de la operación |
| [[Avance telefónico]] | Para leer cumplimiento y entregar | Revisar el faltante y el ritmo, y generar entregas | El reporte del corte |

Las notas de las secciones y pestañas anteriores (Consultas, Validación de tiempo, Salvedades y Cronograma) se conservan como históricas en `Retiradas/`.

## Recorrido recomendado

1. **Avance › Cuotas** al abrir: lo primero es cuánto falta.
2. **Control** en el día a día: Insistencia y Discrepancias son las colas que se trabajan.
3. **Insumos** cuando una cifra no cuadra o cambia una fuente.
4. **Modelo** al declarar o corregir la cuota.

## Cómo interpretar avance y estados

La regla que evita el malentendido más común: **la plataforma manda las efectivas**. La hoja de barrido describe el intento y su resultado; la encuesta acredita la respuesta. Que la primera muestre menos efectivas que la segunda no es un error de cálculo, es trabajo sin registrar.

Un mínimo cubierto es un estado terminal limpio. Si el estudio ya superó su cuota, la lectura correcta no es *quedan mil casos por barrer* sino *la meta está cubierta y queda esa reserva por si aparece una brecha*.

## Cómo se llega a cada pantalla

Este modo publica su ubicación: `/monitoreo?modo=telefonico&seccion=<sección>&pestana=<pestaña>`. El modo aparece escrito pero lo determina el estudio, no un click.

## Resultado de este nivel

Al completar Telefónico queda una operación de llamadas gobernada: qué se contactó y con qué resultado, quién lo hizo, qué diferencia hay entre lo registrado y lo acreditado, y si el cumplimiento se alcanzó con la reserva que quedó disponible.

## Ubicación en la jerarquía

- Padre: [[Monitoreo]].
