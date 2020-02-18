import { createConnection, Connection, Repository } from "typeorm";
import { RuntimeModels, Resource, Content, ResourceProcessStatus } from './models/index';
import EventEmitter from "events";
import { VOParser, ParserAcceptOptions } from "./parsers/VOParser";
import log4js from "log4js";
import { VOConsumer, ConsumerAcceptOptions } from "./consumers/VOConsumer";
import { VOSender, RetrieveResponse } from "./senders/VOSender";
import { VOPlugin, PluginKind } from "./base/VOPlugin";

type VORuntimeReadyCallback = (runtime?: VORuntime, error?: Error) => void;

export interface VORuntimeOptions {

    /**
     * limit pages to be processing
     */
    pageLimit?: number;

    /**
     * check finish interval
     */
    checkFinishInterval?: number;

}

const DefaultVORuntimeOptions: VORuntimeOptions = {
    pageLimit: Number.MAX_SAFE_INTEGER,
    checkFinishInterval: 300,
};

export class VORuntime {

    constructor(options?: VORuntimeOptions, cb?: VORuntimeReadyCallback) {

        this.logger = log4js.getLogger("VORuntime");

        // create an in-memory sqlite instance to simplify the query logic
        createConnection({
            name: "runtime",
            type: "sqlite",
            database: ":memory:",
            synchronize: true,
            entities: RuntimeModels
        }).then(conn => {

            this.options = Object.assign(DefaultVORuntimeOptions, options);

            this.conn = conn;

            this.resourceRepo = this.conn.getRepository(Resource);

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


    private options: VORuntimeOptions = {};

    private logger: log4js.Logger;

    private processingCount = 0;

    private processedCount = 0;

    private conn: Connection;

    private resourceRepo: Repository<Resource>;

    private bus: EventEmitter;

    private parsers: Array<VOParser> = [];

    private consumers: Array<VOConsumer> = [];

    private senders: Array<VOSender> = [];

    public with(p: VOPlugin | ArrayLike<VOPlugin>): VORuntime {
        if (Array.isArray(p)) {
            p.forEach(ap => this.with(ap));
        }
        else if (p instanceof VOPlugin) {

            switch (p.getKind()) {
                case PluginKind.Consumer:
                    if (p instanceof VOConsumer) {
                        this.addConsumer(p);
                    }
                    break;
                case PluginKind.Parser:
                    if (p instanceof VOParser) {
                        this.addParser(p);
                    }
                    break;
                case PluginKind.Sender:
                    if (p instanceof VOSender) {
                        this.addSender(p);
                    }
                    break;
                default:
                    break;
            }

        }

        return this;
    }

    public addParser(p: VOParser): VORuntime {
        this.parsers.push(p);
        return this;
    }

    public addConsumer(c: VOConsumer): VORuntime {
        this.consumers.push(c);
        return this;
    }

    public addSender(c: VOSender): VORuntime {
        this.senders.push(c);
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
    private async _getParser(options: ParserAcceptOptions): Promise<VOParser> {

        for (let index = 0; index < this.parsers.length; index++) {
            const parser = this.parsers[index];
            const accepted = await parser.accept(options);
            if (accepted) {
                return parser;
            }
        }

        this.logger.error(`Not found parser for uri: ${options.uri}`);

        return null;

    }

    /**
     * get consumers for resource
     * 
     * @param uri uri for resource
     */
    private async _getConsumers(options: ConsumerAcceptOptions): Promise<VOConsumer[]> {

        const rt = [];

        for (let index = 0; index < this.consumers.length; index++) {
            const consumer = this.consumers[index];
            const accepted = await consumer.accept(options);
            if (accepted) {
                rt.push(consumer);
            }
        }

        return rt;
    }

    private async _getSender(uri: string): Promise<VOSender> {

        for (let index = 0; index < this.senders.length; index++) {
            const sender = this.senders[index];
            const accepted = await sender.accept(uri);
            if (accepted) {
                return sender;
            }
        }

        this.logger.error(`Not found sender for uri: ${uri}`);

        return null;
    }


    private _upProcessingCount(): void {
        this.processedCount += 1;
        this.processingCount += 1;
    }

    private _downProcessingCount(): void {
        this.processingCount -= 1;
    }

    private _getProcessingCount(): number {
        return this.processingCount;
    }

    private async onQueueResource(resource: Resource): Promise<void> {
        if (this.processedCount < this.options.pageLimit) { // apply page limit 
            if (!await this.isUriQueued(resource.uri)) {
                this._upProcessingCount();
                resource.status = ResourceProcessStatus.PROCESSING;
                await this.resourceRepo.save(resource);
                this.bus.emit("onContentRequest", resource);
            }
        }
    }

    private async onContentRequest(resource: Resource): Promise<void> {

        const sender = await this._getSender(resource.uri);

        if (sender) {
            // use sender to retrieve data
            const content = await sender.retrieve(resource.uri);
            this.bus.emit("onContentReceived", resource, content);
        } else {
            // not found sender
            resource.setProcessed();
            await this.resourceRepo.save(resource);
            this._downProcessingCount();
        }

    }

    private async onContentReceived(resource: Resource, originalContent: RetrieveResponse): Promise<void> {
        const parser = await this._getParser({ uri: resource.uri, type: originalContent.type });
        const newContent = new Content();
        newContent.resource = resource;
        newContent.blob = originalContent.content;
        newContent.type = originalContent.type; // fallback type

        if (parser) {
            const { links, parsedObject, type } = await parser.parse(originalContent.content);
            newContent.type = type;
            newContent.setContent(parsedObject);
            if (links) {
                links.forEach(link => {
                    const r = new Resource();
                    r.uri = link;
                    this.bus.emit("onQueueResource", r);
                });
            }

        }

        resource.status = ResourceProcessStatus.PROCESSED;
        await this.resourceRepo.save(resource);
        this.bus.emit("onContentParsed", newContent);

    }

    private async onContentParsed(content: Content): Promise<void> {

        const cs = await this._getConsumers({ uri: content.resource.uri, type: content.type });

        cs.forEach(c => {
            c.consume(content);
        });

        this._downProcessingCount(); // this resource is process finished

    }

    private async _startCheckFinished(): Promise<void> {

        const task = setInterval(async (): Promise<void> => {
            if (this._getProcessingCount() == 0) {
                const c = await this.resourceRepo.count({ status: ResourceProcessStatus.PROCESSING });
                if (c == 0) {
                    clearInterval(task);
                    this.bus.emit("finished");
                    this.bus.removeAllListeners("finished");
                }
            }
        }, this.options.checkFinishInterval);


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
            this._startCheckFinished();
            // resolve on finished
            this.bus.addListener("finished", () => {
                resolve();
            });
            // push resource to bus
            this.bus.emit("onQueueResource", resource);
        });

    }

}

export const createVORuntime = async (options?: VORuntimeOptions): Promise<VORuntime> => {
    return new Promise((resolve, reject) => {
        new VORuntime(options, (runtime, err) => {
            if (err) {
                reject(err);
            } else {
                resolve(runtime);
            }
        });
    });
};