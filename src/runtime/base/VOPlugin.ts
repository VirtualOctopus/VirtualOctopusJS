

export enum PluginKind {
    Consumer,
    Parser,
    Sender,
}

export abstract class VOPlugin {
    abstract getKind(): PluginKind
}

