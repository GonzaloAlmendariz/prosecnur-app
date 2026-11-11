// @vitest-environment happy-dom
/**
 * Caracterización de Carga: grupo "formulario" (antes "estructura"). Ver arnes.tsx.
 * Los escenarios que entraban por `pestana=estructura` siguen como alias.
 */
import {
  escenariosDeAlias,
  escenariosDeMatriz,
  prepararGrupo,
} from "./arnes";

prepararGrupo("formulario");

escenariosDeMatriz("formulario");
escenariosDeAlias("estructura", "formulario");
