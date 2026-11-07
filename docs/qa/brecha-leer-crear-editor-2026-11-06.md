# Brecha entre lo que el editor lee y lo que deja crear

Inventario del 6 de noviembre de 2026 (checklist editor-conjoint, E19). Pregunta de Gonzalo: «si el editor ya interpreta varias cosas, ¿por qué no hay UI que ayude y sea igual de intuitiva?».

Rutas relativas a `frontend/src/features/xlsformEditor/`. La lectura de todas las columnas pasa por `reglas/motor/index.ts` (`leerConContexto`).

## Principio

Cada patrón que el editor sabe **decir** en castellano se tiene que poder **armar** con la misma frase, eligiendo sus piezas. La frase de lectura y la de creación son la misma; lo que se arma se relee igual.

## Lo que se lee pero no se puede crear sin escribir

| Columna | Patrón | Ejemplo XLSForm | Cómo se lee | Prioridad |
|---|---|---|---|---|
| relevant | Cuántas opciones marcó | `count-selected(${q}) >= 2` | «‹Q› tiene 2 o más opciones marcadas» | Alta |
| relevant | Fecha frente a hoy | `${f} < today()` | «‹F› es anterior a hoy» | Media |
| relevant | Tiempo desde una fecha | `(today() - ${nac}) >= 365*18` | «han pasado al menos 18 años desde ‹Nacimiento›» | Media |
| relevant | Largo de un texto | `string-length(${q}) > 0` | «‹Q› tiene texto» | Baja |
| relevant | Formato de un texto | `regex(${q}, '…')` | frase del analizador de patrones | Baja |
| constraint | Cuántas opciones, con número propio | `count-selected(.) >= 2`, `<= 5` | «Al menos 2 opciones», «Máximo 5 opciones» | Alta (hoy el atajo trae el 3 fijo) |
| constraint | Regla condicionada a otra pregunta | `if(${p}='1', .='2', true())` | «Si ‹P› es ‹Sí›, sólo acepta ‹No›» | Alta |
| constraint | Restricción con otra pregunta como condición | `. <= ${total} and ${x} >= 6` | «…, sólo si ‹X› es 6 o más» | Media |
| constraint | O vacía | `regex(., '^\d{8}$') or . = ''` | «8 dígitos o vacía» | Media |
| constraint | Largo como cota | `string-length(.) <= 9` | «Máximo 9 caracteres» | Media (la receta usa regex) |
| constraint | Tiene que incluir una opción | `selected(., 'x')` | «tiene que incluir ‹X›» | Baja |
| constraint | Par que no va junto | `not(selected(., a) and selected(., b))` | «‹A› y ‹B› no se pueden marcar juntas» | Baja (cubierto en parte por «van solas») |
| constraint | Sin espacios | `not(regex(., '\s'))` | «Sin espacios» | Baja |
| calculation | Años cumplidos / días desde una fecha | `int((today() - ${nac}) div 365.25)` | «los años cumplidos desde ‹Nacimiento›» | Alta |
| calculation | Texto de la opción elegida | `jr:choice-name(${q}, '${q}')` | etiqueta de la opción | Alta |
| calculation | Sumar o contar filas de una repetición | `sum(${monto})`, `count(${miembro})` | «la suma de ‹Monto›», «cuántas filas de ‹Miembros›» | Alta |
| calculation | Redondear, parte entera, máximo y mínimo | `round(x, 1)`, `int(x)`, `max(a, b)` | «… redondeado a 1 decimal» | Media |
| calculation | Respaldo si está vacío | `coalesce(${a}, ${b})` | «‹A› o, si está vacía, ‹B›» | Media |
| calculation | Fecha relativa y minutos entre horas | `today() - 30`, `(a - b) * 24 * 60` | «hace 30 días», «los minutos entre B y A» | Media |
| calculation | Un valor según varias condiciones | `if()` de más de un nivel | «Si …, vale …. Si …, vale ….» | Alta (lo cubre el armador por intención, E17) |
| calculation | Sorteo | `if(int(${r} * k) = i, …)` | «Sortea con la misma probabilidad entre …» | Alta (hoy sólo desde el panel conjoint) |
| choice_filter | Lo marcado antes | `selected(${medios}, name)` | «Muestra las opciones que se marcaron en ‹Medios›» | Alta |
| choice_filter | Columna marcada en la pregunta madre | `selected(${gasto}, filter_Spent)` | «… cuya columna filter_Spent está marcada en ‹Gasto›» | Media |
| choice_filter | Columna numérica frente a una respuesta | `edad_min <= ${edad}` | «… cuya columna edad_min es menor o igual que la respuesta de ‹Edad›» | Media |
| choice_filter | Filtro que sólo aplica en un caso | `${pais}='PER' and (name=…)` | «… cuando ‹País› es ‹Perú›» | Baja |
| required | Obligatoria según otra respuesta | cualquier expresión | «Obligatoria si …» | Alta (hoy sólo sí o no) |

## Lo que ya se puede crear

- relevant: constructor de condiciones por tipo (`logic/operators.ts`), con otra pregunta como valor, grupos Y/O y el picker al soltar una flecha en el Mapa de lógica.
- constraint: atajos por tipo (`ConstraintBuilder.tsx` ~590-669), rango mínimo y máximo, 14 recetas de texto (`textRules.ts`), armador de formato por bloques, opciones que van solas (E18), mensaje sugerido.
- calculation: cinco recetas (hoy, ahora, copiar respuesta, contar marcadas, años a meses), plantillas de `formulaTemplates.ts`, el bloque `if` con una condición, y los sorteos sólo desde el panel del conjoint.
- choice_filter: asistente de cuatro formas (cascada, por opción, fijo, expresión) y «siempre visible».
- required: sólo sí o no.

## Orden propuesto

1. **required condicional**: «Obligatoria si …» reutiliza el constructor de condiciones de relevant. Brecha grande y arreglo corto.
2. **Cuántas opciones, con número propio** en constraint (al menos N, máximo N, exactamente N) y **cuántas marcó** como condición en relevant.
3. **Armador de cálculos por intención** (E17, modelo hecho), ampliado con: años cumplidos o días desde una fecha, texto de la opción elegida, sumar o contar una repetición, redondear y «o si está vacía».
4. **Regla condicionada** en constraint: «Si ‹P› es …, sólo acepta …».
5. **Filtros**: «lo marcado antes» y la comparación numérica como formas nuevas del asistente.
6. El resto (fechas frente a hoy en relevant, o vacía, largo como cota, sin espacios) con la misma frase editable.
