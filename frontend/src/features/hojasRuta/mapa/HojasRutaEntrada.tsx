import { lazyWithReload } from "../../../lib/lazyWithReload";
import { lienzoHojasRutaEncendido } from "./interruptor";

// Cada página en su propio chunk: encender el lienzo no arrastra la vieja y al revés.
const HojasRutaPage = lazyWithReload(() => import("../HojasRutaPage"), "HojasRutaPage");
const HojasRutaMapaPage = lazyWithReload(() => import("./HojasRutaMapaPage"), "HojasRutaMapaPage");

/** `/hojas-ruta`: la página vieja, o la del lienzo si el interruptor está encendido (ADR 0114 §8). */
export default function HojasRutaEntrada() {
  return lienzoHojasRutaEncendido() ? <HojasRutaMapaPage /> : <HojasRutaPage />;
}
