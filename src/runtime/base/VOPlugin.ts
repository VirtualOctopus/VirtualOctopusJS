

export enum PluginKind {
    Consumer,
    Parser,
    Sender,
    ResourceStore,
}

export abstract class VOPlugin {
    abstract getKind(): PluginKind
}

