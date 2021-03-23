

export enum PluginKind {
    Consumer = "Consumer",
    Parser = "Parser",
    Sender = "Sender",
    ResourceStore = "ResourceStore",
    ErrorConsumer = "ErrorConsumer",
    /**
     * pre-built package with many plugins
     */
    Package = "Package",
}

export abstract class VOPlugin {
    abstract getKind(): PluginKind
}

