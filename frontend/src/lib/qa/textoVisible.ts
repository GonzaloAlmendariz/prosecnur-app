// textoVisible.ts — qué texto pinta de verdad una pantalla.
//
// Infraestructura de los guardianes de vocabulario. Vive en un solo sitio porque
// el defecto que más se repite en este dominio es tener la misma regla escrita
// en dos lados: dos extractores acabarían divergiendo, y el que se quedara atrás
// daría verde sin mirar lo mismo.
//
// Dos precisiones que hacen que sirva:
//
// - **Los comentarios quedan fuera.** Ahí SÍ deben usarse los nombres reales del
//   motor: son el rastro hasta el código que manda.
// - **El JSX parte expresiones en varias líneas**, así que el extractor pesca
//   trozos de código —«{adapterId ===», «renderAulasView( seccionActiva,»—. Un
//   falso positivo gasta el crédito del guardián, así que se filtran.

/** Señales de que una línea es código y no copy. */
const PARECE_CODIGO = [
  /[{}]/, /===/, /=>/, /\?\?/, /\|\|/,
  // Llamada a función o continuación de argumentos.
  /[A-Za-z_$][\w$]*\s*\(/, /,\s*$/, /^\s*[A-Za-z_$][\w$]*\s*,/,
  // Una firma genérica deja código entre `>` y `<`: `useState<Foo | null>(null);
  // const [preview, setPreview] = useState<` pescaba «(null); const [preview,
  // setPreview] = useState» como si fuera copy.
  /[;[\]]/, /\w\s*=\s*\w/,
];

/**
 * El texto que la pantalla pinta: literales JSX y atributos de copy.
 *
 * @param fuente contenido del `.tsx`.
 */
export function textoVisibleDe(fuente: string): string[] {
  const limpio = fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const jsx = [...limpio.matchAll(/>\s*([^<>{}\n][^<>{}]{6,160})\s*</g)].map((m) => m[1]);
  const attrs = [...limpio.matchAll(
    /(?:title|label|eyebrow|empty|lead|placeholder|aria-label)=["']([^"']{6,160})["']/g,
  )].map((m) => m[1]);
  // **El copy que vive dentro de una expresión.**
  //
  // `{deployment ? etiqueta(deployment.status) : "sin deployment"}` pinta «sin
  // deployment» en pantalla y ninguno de los dos patrones de arriba lo ve: no
  // está entre `>` y `<` ni es un atributo de copy. Y ahí es justo donde vive el
  // texto de los ESTADOS, que es el que más jerga arrastra —medido el
  // 2026-08-23 en Materiales: «sin deployment» llevaba meses en pantalla con el
  // guardián en verde—.
  //
  // Se piden dos palabras separadas por espacio para no pescar identificadores,
  // clases (`rec-plan-curso`), rutas (`/api/...`) ni claves de diccionario, que
  // son literales de código y no copy.
  const enExpresiones = [...limpio.matchAll(/["']([^"'\n]{6,160})["']/g)]
    .map((m) => m[1])
    .filter((t) => /\s/.test(t.trim())
      && !/[/<>{}]/.test(t)
      // Señales inequívocas de código: el regex de literales pesca trozos
      // cuando hay comillas sueltas en una firma —«(null); const [preview,
      // setPreview] = useState»— y un guardián que grita de más se ignora.
      && !/[;=[\]]/.test(t)
      && !/^[a-z]+([-_][a-z]+)+$/.test(t));
  return [...jsx, ...attrs, ...enExpresiones]
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((t) => !PARECE_CODIGO.some((re) => re.test(t)));
}

/**
 * Términos de arquitectura: significan algo dentro del código y nada fuera.
 *
 * La lista no es una opinión de estilo. Cada uno salió de una pantalla real que
 * lo enseñaba: «ejecuta el preflight», «QR autoritativo del backend», «recibo de
 * artefacto renderizado», «Deployment → Monitoreo».
 */
export const JERGA_DE_ARQUITECTURA = [
  "preflight", "deployment", "idempotente", "payload", "binding",
  "adapter", "backend", "artefacto renderizado", "fingerprint",
  "plantilla semántica", "recipient link", "autoritativo",
  "snapshot", "endpoint",
  // Palabras de herramienta de diseño, no del operativo: el panel de bloques de
  // la ficha se titulaba «Outline».
  "outline", "wireframe", "mockup",
  // Nombres de pasos y objetos del motor que llegaron a la pantalla de Entrega:
  // «Handoff local», «Manifest de entrega y artefactos», «Target».
  "handoff", "manifest", "artefacto", "target",
  // Verbos y objetos de herramienta que llegaron a Materiales > Paquetes:
  // «Preview PNG», «Render PDF», «Render paquete», «Template:
  // template-ficha-aplicacion-a4-v1», «Instancias 0», «Crear instancias».
  // «Instancia» es como el motor llama a la ficha de UN aula; en la pantalla es
  // una ficha.
  "preview", "render", "template", "instancia",
];

/** Los términos de jerga que aparecen en el texto visible de un fuente. */
export function jergaVisibleEn(fuente: string, jerga = JERGA_DE_ARQUITECTURA): string[] {
  return textoVisibleDe(fuente).flatMap((linea) =>
    jerga
      .filter((termino) => linea.toLowerCase().includes(termino))
      .map((termino) => `«${termino}» en: ${linea.slice(0, 80)}`));
}
