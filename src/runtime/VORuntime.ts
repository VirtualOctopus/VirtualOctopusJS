import { createConnection, Connection } from "typeorm";
import { RuntimeModels, Resource, Content, ResourceProcessStatus } from './models/index';
import EventEmitter from "events";
import { VOParser } from "./parsers/VOParser";
import log4js from "log4js";
import got from "got";
import { VOConsumer } from "./consumers/VOConsumer";

type VORuntimeReadyCallback = (runtime?: VORuntime, error?: Error) => void;

export class VORuntime {

    constructor(cb?: VORuntimeReadyCallback) {
        createConnection({
            name: "runtime",
            type: "sqlite",
            database: "runtime.db",
            synchronize: true,
            entities: RuntimeModels
        }).then(conn => {

            this.conn = conn;

            this.logger = log4js.getLogger("VORuntime");

            this.bus = new EventEmitter();

            this.bus.addListener("onContentReceived", this.onContentReceived);

            this.bus.addListener("onQueueResource", this.onQueueResource);

            this.bus.addListener("onContentRequest", this.onContentRequest);

            this.bus.addListener("onContentParsed", this.onContentParsed);

            try {
                if (cb) {
                    cb(this, undefined);
                }
            } finally {
                // nothing
            }

        }).catch(err => {
            if (cb) {
                cb(undefined, err);
            }
        });
    }

    private logger: log4js.Logger;

    private conn: Connection;

    private bus: EventEmitter;

    private parsers: Array<VOParser> = [];

    private consumers: Array<VOConsumer> = [];

    public addParser(p: VOParser): VORuntime {
        this.parsers.push(p);
        return this;
    }

    public addConsumer(c: VOConsumer): VORuntime {
        this.consumers.push(c);
        return this;
    }

    /**
     * destroy
     */
    public async destroy(): Promise<void> {
        if (this.conn.isConnected) {
            return await this.conn.close();
        }
    }

    private async isUriQueued(uri: string): Promise<boolean> {
        return (await Resource.count({ uri }) > 0);
    }

    private async _getParser(uri: string): Promise<VOParser> {
        for (let index = 0; index < this.parsers.length; index++) {
            const parser = this.parsers[index];
            const accepted = await parser.accept(uri);
            if (accepted) {
                return parser;
            }
        }

        this.logger.error(`Not found parser for uri: ${uri}`);

        return null;

    }

    private async _getConsumers(uri: string): Promise<VOConsumer[]> {
        const rt = [];
        for (let index = 0; index < this.consumers.length; index++) {
            const consumer = this.consumers[index];
            const accepted = await consumer.accept(uri);
            if (accepted) {
                rt.push(consumer);
            }
        }

        return rt;
    }

    private async _retrieveBlob(uri: string): Promise<Buffer> {
        const response = await got(uri);
        return Buffer.from(response.body, "utf8");
    }

    private async onQueueResource(resource: Resource): Promise<void> {
        if (!this.isUriQueued(resource.uri)) {
            resource.status = ResourceProcessStatus.PROCESSING;
            resource.save();
            this.bus.emit("onContentRequest", resource);
        }
    }

    private async onContentRequest(resource: Resource): Promise<void> {
        const content = await this._retrieveBlob(resource.uri);
        this.bus.emit("onContentReceived", resource, content);
    }

    private async onContentReceived(resource: Resource, originalContent: Buffer): Promise<void> {
        const newContent = new Content();
        newContent.resource = resource;
        newContent.blob = originalContent;
        const parser = await this._getParser(resource.uri);
        if (parser) {
            const { links, parsedObject } = await parser.parse(originalContent);
            newContent.setContent(parsedObject);
            if (links) {
                links.forEach(link => {
                    const r = new Resource();
                    r.uri = link;
                    r.status = ResourceProcessStatus.NOT_PROCESS;
                    this.bus.emit("onQueueResource", r);
                });
            }

        }
        newContent.save();
        this.bus.emit("onContentParsed", newContent);
    }

    private async onContentParsed(content: Content): Promise<void> {
        const cs = await this._getConsumers(content.resource.uri);
        cs.forEach(c => {
            c.consume(content);
        });
    }

    public async startAt(uri: string): Promise<void> {
        const resource = new Resource();
        resource.uri = uri;
        this.bus.emit("onQueueResource", resource);
    }

}

export const createVORuntime = async (): Promise<VORuntime> => {
    return new Promise((resolve, reject) => {
        new VORuntime((runtime, err) => {
            if (err) {
                reject(err);
            } else {
                resolve(runtime);
            }
        });
    });
};