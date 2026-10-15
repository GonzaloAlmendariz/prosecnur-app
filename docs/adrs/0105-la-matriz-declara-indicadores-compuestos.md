# ADR 0105 — La matriz declara indicadores compuestos de varias preguntas

- **Estado**: Propuesto — pedido de Gonzalo del 2026-10-15 («asegurémonos por favor que la UI de la matriz de
  equivalencias permita hacer todo lo que Nadia propone incluyendo códigos estándar y etiquetas del tenor estándar y
  hasta variables agregadas o nuevas estándar para los cruces»).
- **Ámbito**: Carga › Equivalencias (editor de filas), motor de armonización y comparativos (simple y de cruces)
- **Fecha**: 2026-10-15
- **Relación**: extiende la fila armonizada de [ADR 0104](0104-la-matriz-se-arma-en-la-app.md) y del contrato E4-E7/R3
  (`api/R/equivalencias_armonizacion.R`). Caso real: matriz HSyVbG PUCP 2022-2026 (OIGD).

## Contexto

La matriz de la OIGD tiene 100 bloques. Su columna «Recomendación» pide cuatro operaciones:

| Operación | Bloques | Ejemplo | ¿La fila armonizada ya la cubre? |
|---|---|---|---|
| Código y etiqueta estándar por categoría | 37 | S-11 «Otro [88]» en todos los años | Sí: `escala` común + `mapa` por base |
| Agrupar categorías | 7 | A-05/A-06 vínculo jerárquico / de confianza / sin vínculo | Sí: varios códigos de la base al mismo código de la escala |
| Recodificar una sola pregunta en otra lectura (dicotomía, tramos, antigüedad) | 4 | T-01 «Nunca» frente a «alguna vez»; S-01 tramos de edad; S-08 antigüedad = año de medición − año de ingreso | Sí: otra fila sobre la misma variable con su propia escala; S-08 con un mapa por base relativo a su año |
| **Indicador que combina varias preguntas** | 6 | AP-12 «recurrió a alguna instancia PUCP»; CO-01 «conoce al menos una instancia disciplinaria»; CO-03 servicio psicológico | **No**: una fila nombra una sola variable por base |

Toda fila armonizada ya puede usarse como variable de cruce, de modo que lo único que falta es la última.

## Decisión

1. **Una fila puede declarar un indicador compuesto** en lugar de una variable: en cada base, la lista de variables
   que lo forman y los códigos que cuentan como «sí». La regla es una sola, `alguna`: el caso vale `1` si al menos una
   de sus variables tiene uno de esos códigos.
2. **Forma en la fila** (se agrega a `EquivalenciaFila`):

   ```json
   "derivada": {
     "regla": "alguna",
     "por_base": { "<base>": { "variables": ["P28_1", "P28_2"], "codigos": ["1"] } }
   }
   ```

   El normalizador del backend escribe en `variables[<base>]` la expresión canónica `alguna(P28_1,P28_2)`, en el orden
   declarado, y es el nombre de la columna que se materializa. Así, todo consumidor que lee `variables[base]` (tabla,
   cobertura, comparativos, cruces) funciona sin saber que la fila es compuesta.
3. **Valor del indicador por caso**:
   - `1` si alguna variable tiene un código de `codigos`;
   - `0` si ninguna lo tiene y al menos una tiene una respuesta válida que no es especial (80–99);
   - `NA` si todas están vacías (la pregunta no se le hizo) o sólo hay especiales.
4. **Escala por defecto** `1 «Sí»` y `0 «No»`, con mapa identidad, editable como cualquier otra fila. La fila se
   armoniza, se declara comparable o no por base y entra a los comparativos y a los cruces como cualquier otra.
5. **Validación**: `regla` sólo `alguna`; al menos una variable y un código por base declarada; una variable que no está
   en los datos de esa base deja la base «n.c.» con el motivo `variable_ausente` (como hoy), no corta el comparativo.
6. **El editor** ofrece «Añadir indicador compuesto» junto a «Añadir pregunta equivalente»: nombre estándar, sección y,
   por base, elegir las preguntas que lo forman y los códigos que cuentan como «sí». El preview muestra cuántos casos
   quedan en `1`, en `0` y sin dato en cada base.

## Consecuencias

- La matriz de la OIGD se puede armar completa en la app, incluidos los agregados que pide para la serie.
- Una fila compuesta no se exporta a SPSS como variable de la base: vive en la matriz y en los comparativos.
- Otras reglas (todas, conteo, suma) quedan fuera hasta que un estudio las pida.

## Cumplimiento

- `api/tests/testthat/test-equivalencias-derivadas.R`: valor por caso (1, 0, NA, sólo especiales), normalización de
  la expresión, validación, preview y su paso por `armonizada_apilar` como pregunta y como cruce.
- Vitest del modelo y del editor del indicador compuesto; `make gate-area AREA=equivalencias`,
  `make gate-front AREA=carga`.
