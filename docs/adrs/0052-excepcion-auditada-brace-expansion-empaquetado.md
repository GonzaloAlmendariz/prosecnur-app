# ADR 0052: Excepcion auditada de brace-expansion en el empaquetado

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-07-31

Fecha de decision: 2026-07-31

Reemplaza: —

Extiende: [0050](0050-entorno-r-reproducible-ci-inmutable.md)

## Contexto

El job `frontend` de `quality.yml` corre `pnpm -C desktop audit --audit-level=high`
como gate innegociable. Desde el advisory GHSA-mh99-v99m-4gvg
(`brace-expansion`: DoS por expansion sin cota) ese gate quedo rojo y tumbo
`origin/main` de forma sostenida: el ultimo Quality verde es del 2026-07-24 y
el corte 0.5.19 ya habia rebotado tres veces por deriva de advisories.

El advisory declara vulnerable `<=5.0.7` y parcheado `>=5.0.8`, y no publica
backport para las lineas 1.x ni 2.x: cualquier version por debajo de 5.0.8
cuenta como afectada. El arbol de `desktop/` tiene tres instancias, todas por
debajo de `electron-builder`, que es una **devDependency de build**:

- `app-builder-lib > minimatch@10 > brace-expansion@5` — cerrada subiendo el
  override de `^5.0.7` a `^5.0.8`.
- `app-builder-lib > @electron/asar@3.4.1 > minimatch@3 > brace-expansion@1`
- `app-builder-lib > @electron/universal@2.0.3 > minimatch@9 > brace-expansion@2`

Las dos ultimas no se pueden cerrar desde nuestro `package.json`:
`app-builder-lib` pinea `@electron/asar` y `@electron/universal` a versiones
exactas, de modo que ni actualizando `electron-builder` cambian. Y forzarlas a
la linea 5 rompe el empaquetado, no lo repara: `brace-expansion@5` exporta
`{ EXPANSION_MAX, EXPANSION_MAX_LENGTH, expand }`, mientras `minimatch@3` hace
`require('brace-expansion')` y llama al resultado como funcion. Se verifico
ejecutando esa llamada contra 5.0.9: `TypeError: m is not a function`. Un
override global habria puesto el gate en verde y roto la generacion de
instaladores, que es exactamente el fallo que el gate existe para evitar.

Queda entonces una tension real: sostener el gate tal cual bloquea toda
publicacion por una condicion que no esta en nuestra mano corregir, y relajar
el umbral a `moderate` apagaria tambien los advisories que si nos tocan.

## Decision

Se declara una excepcion **por advisory**, no por umbral, en
`desktop/package.json`:

```json
"auditConfig": { "ignoreGhsas": ["GHSA-mh99-v99m-4gvg"] }
```

El gate sigue siendo `--audit-level=high` y sigue siendo bloqueante para todo
lo demas. La excepcion se admite porque se cumplen las cuatro condiciones:

1. El paquete afectado es una dependencia de build; no se distribuye al usuario
   final ni entra en el bundle de la app.
2. La superficie de ataque exige controlar los patrones glob que recibe
   `electron-builder`, que en este repo son literales versionados.
3. No hay version corregida alcanzable sin romper el empaquetado.
4. El bloqueo es sostenido, no transitorio: no es una caida del servicio de
   audits, que se reintenta.

Una excepcion de este tipo caduca. Se revisa en cada corte de version, y se
retira en cuanto `app-builder-lib` suba sus pines a `@electron/asar` y
`@electron/universal`.

## Consecuencias

- `pnpm -C desktop audit --audit-level=high` vuelve a exit 0 sin tocar el
  umbral, y `origin/main` puede volver a verde por meritos propios.
- Cualquier advisory `high` nuevo —incluido uno futuro sobre estas mismas
  dependencias con otro GHSA— sigue rompiendo el gate.
- Queda constancia de una deuda con dueño externo: mientras la excepcion siga
  viva, el arbol de build contiene una version afectada.
- El overhead de la revision recae en `/preparar-release`, que ya inspecciona
  los audits antes de cortar.

## Cumplimiento

- La lista `ignoreGhsas` no acepta entradas sin un ADR que las justifique.
- En cada corte de version se ejecuta `pnpm -C desktop why brace-expansion`; si
  las rutas por `@electron/asar` y `@electron/universal` ya resuelven a
  `>=5.0.8`, la entrada se elimina en el mismo commit.
- Bajar `--audit-level` por debajo de `high`, o añadir un GHSA sin ADR, es una
  violacion de este ADR aunque deje el CI verde.

## Notas

El diagnostico partio de leer el exit code equivocado: `pnpm audit | tail`
devuelve 0 aunque el audit falle, porque en un pipe el exit es el del ultimo
comando. La medicion valida fue con redireccion y `$?`.

La verificacion de incompatibilidad no se infirio del changelog sino
ejecutando la llamada real de `minimatch@3` contra `brace-expansion@5.0.9` en
un directorio aparte.
