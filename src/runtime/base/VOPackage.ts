import { PluginKind, VOPlugin } from "./VOPlugin";


export class VOPackage extends VOPlugin {

  constructor(plugins: Array<VOPlugin>) {
    super();
    this._plugins = plugins ?? [];
  }

  private _plugins: Array<VOPlugin>;

  getKind() {
    return PluginKind.Package;
  }

  getPlugins() {
    return this._plugins;
  }
}

