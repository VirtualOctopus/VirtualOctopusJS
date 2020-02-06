import { createConnection, Connection, Repository } from "typeorm";
import { RuntimeModels, Resource, Content, ResourceProcessStatus } from './models/index';
import EventEmitter from "events";
import { VOParser } from "./parsers/VOParser";
import log4js from "log4js";
import got from "got";
import { VOConsumer } from "./consumers/VOConsumer";

type VORuntimeReadyCallback = (runtime?: VORuntime, error?: Error) => void;

export class VORuntime {

    constructor(cb?: VORuntimeReadyCallback) {

        this.logger = log4js.getLogger("VORuntime");

        // create an in-memory sqlite instance to simplify the query logic
        createConnection({
            name: "runtime",
            type: "sqlite",
            database: ":memory:",
            synchronize: true,
            entities: RuntimeModels
        }).then(conn => {

            this.conn = conn;

            this.resourceRepo = this.conn.getRepository(Resource);
            this.contentRepo = this.conn.getRepository(Content);

            this._setupBus();

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

    private processingCount = 0;

    private conn: Connection;

    private resourceRepo: Repository<Resource>;

    private contentRepo: Repository<Content>;

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
     * destroy runtime & db connection
     */
    public async destroy(): Promise<void> {
        if (this.conn.isConnected) {
            return await this.conn.close();
        }
    }

    /**
     * setup event bus
     */
    private _setupBus(): void {

        this.bus = new EventEmitter();

        this.bus.addListener("onContentReceived", this.onContentReceived.bind(this));

        this.bus.addListener("onQueueResource", this.onQueueResource.bind(this));

        this.bus.addListener("onContentRequest", this.onContentRequest.bind(this));

        this.bus.addListener("onContentParsed", this.onContentParsed.bind(this));

    }

    /**
     * check the uri wether queued
     * 
     * @param uri 
     */
    private async isUriQueued(uri: string): Promise<boolean> {
        const count = (await this.resourceRepo.count({ uri: uri }));
        return (count > 0);
    }

    /**
     * get parser for uri
     * 
     * @param uri uri
     */
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

    /**
     * get consumers for resource
     * 
     * @param uri uri for resource
     */
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

    /**
     * retrieve blob (UPDATE REQUIRED)
     * 
     * @param uri 
     */
    private async _retrieveBlob(uri: string): Promise<Buffer> {
        // need to be update
        const response = await got(uri); // basic impl just for text html
        return Buffer.from(response.body, "utf8");
    }

    private _upProcessingCount(): void {
        this.processingCount += 1;
    }

    private _downProcessingCount(): void {
        this.processingCount -= 1;
    }

    private _getProcessingCount(): number {
        return this.processingCount;
    }

    private async onQueueResource(resource: Resource): Promise<void> {
        if (!await this.isUriQueued(resource.uri)) {
            this._upProcessingCount();
            resource.status = ResourceProcessStatus.PROCESSING;
            await this.resourceRepo.save(resource);
            this.bus.emit("onContentRequest", resource);
        }
    }

    private async onContentRequest(resource: Resource): Promise<void> {
        const content = await this._retrieveBlob(resource.uri);
        this.bus.emit("onContentReceived", resource, content);
    }

    private async onContentReceived(resource: Resource, originalContent: Buffer): Promise<void> {
        const parser = await this._getParser(resource.uri);
        const newContent = new Content();
        newContent.resource = resource;
        newContent.blob = originalContent;

        if (parser) {
            const { links, parsedObject } = await parser.parse(originalContent);
            newContent.setContent(parsedObject);
            if (links) {
                links.forEach(link => {
                    const r = new Resource();
                    r.uri = link;
                    this.bus.emit("onQueueResource", r);
                });
            }

        }

        await this.contentRepo.save(newContent);
        resource.status = ResourceProcessStatus.PROCESSED;
        await this.resourceRepo.save(resource);
        this.bus.emit("onContentParsed", newContent);

    }

    private async onContentParsed(content: Content): Promise<void> {

        const cs = await this._getConsumers(content.resource.uri);

        cs.forEach(c => {
            c.consume(content);
        });

        this._downProcessingCount(); // this resource is process finished

        if (this._getProcessingCount() == 0) {
            const c = await this.resourceRepo.count({ status: ResourceProcessStatus.PROCESSING });
            if (c == 0) {
                this.bus.emit("finished");
                this.bus.removeAllListeners("finished");
            }
        }

    }

    /**
     * start at an entry uri
     * 
     * @param uri 
     * @param cbOnFinished 
     */
    public async startAt(uri: string): Promise<void> {
        return new Promise(resolve => {
            const resource = new Resource();
            resource.uri = uri;
            // resolve on finished
            this.bus.addListener("finished", () => {
                resolve();
            });
            // push resource to bus
            this.bus.emit("onQueueResource", resource);
        });

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