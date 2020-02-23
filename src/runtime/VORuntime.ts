import { Resource, Content, ResourceProcessStatus } from './models/index';
import EventEmitter from "events";
import { VOParser, ParserAcceptOptions } from "./parsers/VOParser";
import log4js from "log4js";
import { VOConsumer, ConsumerAcceptOptions } from "./consumers/VOConsumer";
import { VOSender, RetrieveResponse } from "./senders/VOSender";
import { VOPlugin, PluginKind } from "./base/VOPlugin";
import { uniq, isArray } from "lodash";
import { Store } from "./stores";
import { MemoryStore } from "./stores/MemoryStore";

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

    /**
     * resource store
     */
    store?: Store;

    logLevel?: string;

}

const DefaultVORuntimeOptions: VORuntimeOptions = {
    pageLimit: Number.MAX_SAFE_INTEGER,
    checkFinishInterval: 300
};

export class VORuntime {

    constructor(options?: VORuntimeOptions, cb?: VORuntimeReadyCallback) {

        this.logger = log4js.getLogger("VORuntime");

        this.options = Object.assign(DefaultVORuntimeOptions, options); // merge default options

        this._store = this.options.store || new MemoryStore(); // default memory store

        this.logger.level = this.options.logLevel || process.env.VO_LOG_LEVEL || log4js.levels.ERROR.levelStr; // default log level

        this._setupBus();

        cb(this);

    }

    private _store: Store;

    private options: VORuntimeOptions = {};

    private logger: log4js.Logger;

    private processingCount = 0;

    private processedCount = 0;

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
        if (this._store) {
            return await this._store.release();
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

    /**
     * check the uri wether queued, return true means has been queued
     * 
     * @param uri 
     */
    private async _isUriQueued(uri: string): Promise<boolean> {
        // with status, means queued
        return (await this._store.status(uri)) != null;
    }

    private async _setResourceProcessing(r: Resource): Promise<void> {
        await this._store.save(r.uri, ResourceProcessStatus.PROCESSING);
        this._upProcessingCount();
    }

    private async _setResourceProcessed(r: Resource): Promise<void> {
        await this._store.save(r.uri, ResourceProcessStatus.PROCESSED);
        this._downProcessingCount();
    }


    private _getProcessingCount(): number {
        return this.processingCount;
    }

    private async onQueueResource(resource: Resource): Promise<void> {
        if (this.processedCount < this.options.pageLimit) { // apply page limit 
            if (!await this._isUriQueued(resource.uri)) {
                await this._setResourceProcessing(resource);
                this.bus.emit("onContentRequest", resource);
            }
        }
    }

    private async onContentRequest(resource: Resource): Promise<void> {

        const sender = await this._getSender(resource.uri);

        if (sender) {
            // use sender to retrieve data
            try {
                const content = await sender.retrieve(resource.uri);
                this.bus.emit("onContentReceived", resource, content);
            } catch (error) {
                this.logger.error(`fetch ${resource.uri} failed: ${error}`);
                await this._setResourceProcessed(resource);
            }

        } else {
            // not found sender
            await this._setResourceProcessed(resource);
        }

    }

    private async onContentReceived(resource: Resource, originalContent: RetrieveResponse): Promise<void> {

        const parser = await this._getParser({ uri: resource.uri, type: originalContent.type });
        const newContent = new Content();
        newContent.resource = resource;
        newContent.blob = originalContent.content;
        newContent.type = originalContent.type; // fallback type

        if (parser) {

            try {
                const { links, parsedObject, type } = await parser.parse(originalContent.content);
                newContent.type = type;
                newContent.setContent(parsedObject || {});

                if (links) {
                    uniq(links).forEach(link => {
                        const r = new Resource();
                        r.uri = link;
                        this.bus.emit("onQueueResource", r);
                    });
                }

            } catch (error) {

                this.logger.error(`parse content failed for uri: '${resource.uri}', ${error}`);

            }

        }

        this._setResourceProcessed(resource);

        this.bus.emit("onContentParsed", newContent);

    }

    private async onContentParsed(content: Content): Promise<void> {

        const cs = await this._getConsumers({ uri: content.resource.uri, type: content.type });

        cs.forEach(async c => {
            try {
                await c.consume(content);
            } catch (error) {
                this.logger.error(`consume ${content.resource.uri} failed: ${error}`);
            }
        });

    }

    private async _startCheckFinished(): Promise<void> {

        const task = setInterval(async (): Promise<void> => {
            if (this._getProcessingCount() == 0) {
                const c = await this._store.query(ResourceProcessStatus.PROCESSING);
                if (c.length == 0) {
                    clearInterval(task);
                    this.bus.emit("finished");
                    this.bus.removeAllListeners("finished");
                }
            }
        }, this.options.checkFinishInterval);


    }

    /**
     * add resource into runtime
     * 
     * @param uri 
     */
    public addResource(uri: string | string[]): void {
        if (isArray(uri)) {
            uri.forEach(u => { this.addResource(u); });
        } else {
            const r = new Resource();
            r.uri = uri;
            this.bus.emit("onQueueResource", r); // push resource to bus
        }

    }

    /**
     * start at an entry uri
     * 
     * @param uri 
     * @param cbOnFinished 
     */
    public async startAt(uri: string | string[]): Promise<void> {

        // when start, add resource status 'NEW' from store
        this.addResource(await this._store.query(ResourceProcessStatus.NEW));
        this.addResource(uri);
        this._startCheckFinished();

        return new Promise(resolve => {
            // startAt function wiil be resolved on finished
            this.bus.addListener("finished", () => {
                resolve();
            });
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