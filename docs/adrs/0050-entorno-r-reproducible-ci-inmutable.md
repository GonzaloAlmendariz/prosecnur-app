# ADR 0050: Entorno R reproducible y entradas CI inmutables

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-07-30

Fecha de decision: 2026-07-30

Reemplaza: —

Extiende: [0003](0003-motor-r-integrado.md) y
[0048](0048-identidad-version-y-canales-distribucion.md)

## Contexto

El motor R vive en el mismo monorepo que la API y el empaquetado, pero
`DESCRIPTION` sólo expresa rangos y relaciones entre dependencias: no fija la
resolución completa que debe restaurar una máquina de desarrollo, CI o un
bundle de escritorio. El launcher instalaba los paquetes ausentes desde el
estado corriente de CRAN y los descargadores offline resolvían otra vez las
dependencias de Windows y macOS. Dos ejecuciones podían obtener versiones
distintas aun partiendo del mismo commit.

Los workflows también seguían etiquetas móviles para runners y acciones.
Aunque las etiquetas mayores sean convenientes, no identifican de forma
inmutable el código ejecutado. Las cachés de binarios R aceptaban además
restauraciones parciales basadas sólo en `DESCRIPTION`, sin demostrar que su
contenido correspondía al grafo exacto.

La auditoría inicial del paquete sí pudo ejecutar el flujo real de
`R CMD build` y `R CMD check`: termina sin errores, pero mantiene cinco
advertencias y dos notas heredadas sobre portabilidad de nombres, licencia,
texto no ASCII, declaración/documentación de objetos y variables globales.
Ese inventario es deuda de higiene del paquete, no una razón para resolver
dependencias de forma no determinista.

## Decision

1. `api/renv.lock` es la fuente canónica de la resolución R usada para
   desarrollo, CI y empaquetado. Fija R 4.5.1, el grafo directo y transitivo,
   versiones, repositorio y checksum de fuente.
2. `api/DESCRIPTION` conserva un contrato distinto: declara la superficie
   pública del paquete y un mínimo de R 4.2, exigido por la sintaxis que ya usa
   el código. No sustituye el lock ni promete que otra versión de R reproduzca
   el entorno de release.
3. `launcher/install-r-deps.R` falla si el runtime o el lock divergen,
   instala una versión exacta y verificada de `renv`, restaura todo el grafo y
   compara las versiones instaladas antes de declarar el entorno listo.
4. Los bundles offline de Windows y macOS descargan exactamente las versiones
   del lock. Cada archivo debe tener checksum autoritativo y aparecer en un
   `manifest.csv`; el instalador vuelve a verificar lista y checksums antes de
   instalar.
5. Una caché de binarios sólo puede podarse si contiene el sentinel de
   propiedad correspondiente a plataforma, arquitectura y versión de R. Una
   caché histórica sin sentinel sólo se adopta cuando todas sus entradas tienen
   el formato antiguo conocido; cualquier archivo, directorio o enlace ajeno
   produce un fallo sin borrarlo.
6. Las cachés de GitHub Actions se identifican con el hash completo del lock y
   no usan `restore-keys`. Los runners usan etiquetas de versión explícitas y
   cada acción de terceros se referencia por un SHA completo; el comentario de
   versión es informativo.
7. Quality restaura el lock, carga el paquete, construye el tarball y ejecuta
   `R CMD check` contra ese tarball. Un error rompe el gate. Las advertencias y
   notas heredadas se miden como deuda separada y no se describen como un check
   limpio.

## Consecuencias

El mismo commit ya no depende de la última resolución disponible en CRAN ni de
una caché aproximada. CI, el launcher y los empaquetadores comparten una
identidad verificable de R y del grafo de paquetes; los bundles rechazan
archivos faltantes, sobrantes o alterados.

Actualizar una dependencia deja de ser implícito: exige regenerar y revisar el
lock, y vuelve a invalidar las cachés. Mantener runners y acciones inmóviles
también requiere una actualización deliberada cuando GitHub retire una imagen
o aparezca una revisión necesaria.

El lock no congela bibliotecas del sistema operativo, el propio sistema
operativo ni herramientas externas como Quarto o LibreOffice. Esas piezas
siguen bajo los scripts de packaging y la imagen explícita del runner. Tampoco
elimina la deuda histórica de `R CMD check`; esa limpieza necesita iteraciones
focales sin mezclarla con el contrato de reproducibilidad.

## Cumplimiento

- `node scripts/check-r-lock.mjs` compara R, dependencias directas, grafo
  cerrado, checksums, cachés, runners y SHA completos en ambos workflows.
- `node --test scripts/tests/check-r-lock.test.mjs` prueba el contrato feliz y
  fallos por versión, dependencia, checksum, acción móvil y caché laxa.
- `Rscript launcher/install-r-deps.R` restaura y verifica el lock exacto.
- Los tests focales de los descargadores cubren caché propia, migración antigua
  segura, entrada ajena, checksum y versión divergente.
- El gate de paquete ejecuta:

  ```bash
  R CMD build --no-build-vignettes api
  R CMD check --no-manual --no-build-vignettes prosecnurapp_<version>.tar.gz
  ```

- `node scripts/check-docs-governance.mjs` verifica que este ADR esté indexado
  y sea alcanzable desde la portada documental.

## Notas

La identidad de versión y la publicación stable siguen bajo el
[ADR 0048](0048-identidad-version-y-canales-distribucion.md). Este ADR fija los
inputs técnicos del build, pero no autoriza crear tags, firmar ni publicar un
release.
