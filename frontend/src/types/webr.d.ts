// Shim mínimo para los tipos de @r-wasm/webr.
//
// El paquete tiene los `.d.ts` reales en `dist/webR/webr-main.d.ts`,
// pero su `exports` field del package.json no los expone correctamente
// para TypeScript moduleResolution "node". En lugar de pelear con el
// resolver, declaramos solo lo que usamos del bridge.
declare module "@r-wasm/webr" {
  export interface WebROutput {
    type: string;
    data: unknown;
  }

  export interface RObject {
    bind(name: string, value: unknown): Promise<void>;
  }

  export interface RGlobalEnv extends RObject {
    bind(name: string, value: unknown): Promise<void>;
  }

  export interface InstallPackagesOptions {
    quiet?: boolean;
  }

  export class WebR {
    constructor(opts?: { baseUrl?: string });
    init(): Promise<void>;
    read(): Promise<WebROutput>;
    installPackages(packages: string[], opts?: InstallPackagesOptions): Promise<void>;
    evalRVoid(code: string): Promise<void>;
    evalRString(code: string): Promise<string>;
    objs: { globalEnv: RGlobalEnv };
  }
}
