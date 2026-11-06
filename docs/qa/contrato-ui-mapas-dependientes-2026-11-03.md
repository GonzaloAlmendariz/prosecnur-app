# Contrato UI ↔ motor: mapas dependientes (3 de noviembre de 2026)

Gonzalo aprobó las láminas de variables geográficas del Perfil CCSS 2026-II. La especificación visual está en la carpeta del estudio: `7. Entregables/…/Maqueta de mapas dependientes (2026-11-03)/Especificación aprobada para el motor.md`.

- **S2** (rama `claude/jovial-burnell-11d3e8`) lleva la especificación al motor y al PPT.
- **Esta sesión** (rama `claude/ui-mapas-dependientes`, creada desde la anterior) arma los controles en Gráficos › Láminas.

Este documento fija los campos del plan que ambas partes leen. **Todo campo nuevo es opcional y su ausencia conserva el comportamiento de hoy**: la UI solo muestra un control si el registro (`graficos_metadata.R`) declara su argumento, así que puede llegar antes que el motor sin prometer nada que la lámina no dibuje (C5).

## 1. `p_mapa_distribucion`: argumentos

| Argumento | Estado | Tipo y valores | Qué hace | Control en la UI |
|---|---|---|---|---|
| `var` | existe | `variable` | Pregunta con el área | «Área del encuestado» |
| `juntar` | **nuevo** | `variables`: otras preguntas de área de la misma base | Suma sus conteos por área a los de `var` (A10_1 + A10_2: Lima y Callao en un mapa, base 287) | «Juntar con» |
| `area` | existe | `lima_callao` · `peru` | Cartografía | «Mapa» |
| `medida` | existe | `conteo` · `tasa` | — | «Qué se pinta» |
| `unidad` | **nuevo** | `estudiantes` (defecto) · `personas` | Leyenda «Encuestados…» o «Personas…» y escala por defecto. **Personas: cortes 6, 11, 21, 51** (1–5, 6–10, 11–20, 21–50, 51 o más) | «Se cuentan» |
| `excluir_opciones` | existe | `codigos_list` | Saca respuestas del total y del mapa (A5 sin Lima Metropolitana ni Callao → base 126) | «Quitar del mapa», como selector de respuestas |
| `otra_respuesta` | **nuevo** | `codigos_list` de áreas del mapa | Áreas que pertenecen a otra respuesta del filtro: se pintan en gris con rayado y llevan su propia entrada en la leyenda | «Áreas de otra respuesta» |
| `otra_respuesta_rotulo` | **nuevo** | `string`; vacío = «Lima y Callao» | Rótulo de esa entrada en la leyenda | «Rótulo en la leyenda» |
| `cortes` | existe | `codigos_list` | Inicio de cada clase desde la segunda, **en la unidad** (no en %) | «Dónde empieza cada clase», con la ayuda de su unidad |
| `encuadre` | existe | `datos` · `completo` | — | «Encuadre» |
| `puntos` | existe | `textarea` | Puntos de referencia (PUCP) | «Puntos de referencia» |
| `zona_lima`, `rotulo` | existen | — | La especificación aprobada quita el recuadro y el título del ranking | **Sin control**; el valor guardado se respeta |

**Grupos con nombre en `otra_respuesta`** (motor `455e9d111`): además de la lista simple, el motor acepta `{"Lima Metropolitana y Callao": [...], "Lima provincias": [...]}`. Así cada grupo lleva su propio rayado y su entrada en la leyenda, como pidió Gonzalo («no confundir Lima provincias con Lima Metropolitana y Callao»). La tarjeta solo edita la lista simple: cuando el valor guardado son grupos, oculta el campo para no borrarlos, y esos grupos se editan en el plan.

Reglas de motor que la UI no controla: nada va «fuera de escala» (se retira `fuera_desde`), la lista va con barras de 11 px, las bases van al pie y no hay notas grises ni avisos de base menor de 30.

## 2. Lámina con filtro y dos mapas

La lámina es `p_slide_3_graficos_fila`, que ya existe con las ranuras `izquierda`, `centro` y `derecha`. La UI y el motor reconocen la dependencia en ella con esta forma:

```json
"meta": { "dependencia": { "de": "izquierda", "habilita": { "centro": ["En Lima Metropolitana", "En Callao"], "derecha": ["En otra región del Perú"] } } }
```

- En la lámina de dos gráficos, `habilita` sigue siendo una lista: no cambia.
- En la de tres es un **objeto por ranura dependiente**. Una ranura que falta en ese objeto no depende del filtro.
- El motor compone la forma V4 de dos mapas cuando las dos ranuras dependientes son `p_mapa_distribucion`, y la de un mapa cuando hay uno solo.
- `frase` y `rotulo` no aplican a los mapas.

## 3. Lo que hace el motor (S2)

1. Declarar `juntar`, `unidad`, `otra_respuesta` y `otra_respuesta_rotulo` en `p_mapa_distribucion` (formals y `graficos_metadata.R`).
2. Leer la dependencia de tres ranuras en `graficos_dependencia.R`.
3. Componer las láminas de la especificación aprobada.

## 4. Lo que hace la UI (esta sesión)

1. Lista blanca y controles de los argumentos de la sección 1 en la tarjeta del gráfico, con ayudas correctas (los cortes en estudiantes o personas, no en %).
2. «Dependencia» en `p_slide_3_graficos_fila`, con un juego de respuestas por ranura dependiente.
3. «Quitar del mapa» y «Áreas de otra respuesta» como selectores de respuestas y de áreas, no como texto libre.
