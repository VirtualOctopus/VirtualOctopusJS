

export enum PluginKind {
    Consumer,
    Parser,
    Sender,
    ResourceStore,
    ErrorConsumer,
}

export abstract class VOPlugin {
    abstract getKind(): PluginKind
}

