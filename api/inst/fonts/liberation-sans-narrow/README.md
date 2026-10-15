# Liberation Sans Narrow 1.07.5 — procedencia

Fuente del PDF del formulario en papel (ítem 22 del checklist de exportación,
2026-10-15; decisión de Gonzalo: fuente estrecha libre, empaquetada y embebida).
Métrico-compatible con Arial Narrow, la del `.docx`.

- Origen: release oficial de GitHub `liberationfonts/liberation-sans-narrow`, tag 1.07.5
- URL: https://github.com/liberationfonts/liberation-sans-narrow/releases/download/1.07.5/liberation-narrow-fonts-ttf-1.07.5.tar.gz
- Publicado: 2018-04-11 · descargado: 2026-10-15
- Tamaño del tar: 300 803 bytes
- sha256 del tar: `64948564a34858912b746abc7aa239233c0083115c9386c2079ae92764040b22`
- Licencia: GNU GPL v2 con la excepción de fuentes (incrustar la fuente en un
  documento no lo somete a la GPL). Ver `License.txt` y `COPYING`, copiados
  sin cambios del tar.

| archivo | sha256 |
|---|---|
| LiberationSansNarrow-Regular.ttf | `8140663e87a66c1e0dc0cbf06ffcd66cabbb8690da12728d28c3dc711be107d7` |
| LiberationSansNarrow-Bold.ttf | `ce5f9743b441248e7e0cc9edd71c7dc3b42313e7c5f400fc33f35ca2200411e8` |
| LiberationSansNarrow-Italic.ttf | `64682df64b65d7f34632d3620a07005b851b0ea0b5abb353e6f6a0610d90ead1` |
| LiberationSansNarrow-BoldItalic.ttf | `03bb5e6b07bcf9d0cbb339e4a6556d5c4ce28cd913e730ab757e9e413e07bba7` |
| License.txt | `c40dd6adebad817defd68c7edad151d9c13d2ac3b4e1790ce2b727b024438b6d` |
| COPYING | `ab15fd526bd8dd18a9e77ebc139656bf4d33e97fc7238cd11bf60e2b9b8666c6` |

Los TTF no se modifican (nombre ni contenido). El motor los resuelve con
`system.file("fonts", "liberation-sans-narrow", package = "prosecnurapp")` y
falla con la condición `formulario_fuente_error` (que la exportación devuelve como `E_PDF_EXPORT_FAILED` con `error_id`) si falta alguno; nunca cae a una fuente del sistema.
