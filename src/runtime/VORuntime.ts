import { Resource, Content, ResourceProcessStatus } from './models/index';
import EventEmitter from "events";
import { VOParser, ParserAcceptOptions } from "./parsers/VOParser";
import log4js from "log4js";
import { VOConsumer, ConsumerAcceptOptions } from "./consumers/VOConsumer";
import { VOSender, RetrieveResponse } from "./senders/VOSender";
import { VOPlugin, PluginKind } from "./base/VOPlugin";
import { uniq, isArray, take } from "lodash";
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

    eventLimit?: number;

}

const DefaultVORuntimeOptions: VORuntimeOptions = {
    pageLimit: Number.MAX_SAFE_INTEGER,
    checkFinishInterval: 300,
    eventLimit: 20
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

    /**
     * check the uri wether queued, return true means has been queued
     * 
     * @param uri 
     */
    private async _isUriQueued(uri: string): Promise<boolean> {
        // with status, means queued
        const s = await this._store.status(uri);
        return (s == ResourceProcessStatus.PROCESSED || s == ResourceProcessStatus.PROCESSING);
    }

    private async _setResourceNew(r: Resource): Promise<void> {
        await this._store.save(r.uri, ResourceProcessStatus.NEW);
    }

    private async _setResourceLock(r: Resource): Promise<void> {
        await this._store.save(r.uri, ResourceProcessStatus.LOCKED);
    }

    private async _setResourceProcessing(r: Resource): Promise<void> {
        await this._store.save(r.uri, ResourceProcessStatus.PROCESSING);
    }

    private async _setResourceProcessed(r: Resource): Promise<void> {
        await this._store.save(r.uri, ResourceProcessStatus.PROCESSED);
    }

    private async _getProcessingCount(): Promise<number> {
        return (await this._store.query(ResourceProcessStatus.PROCESSING)).length;
    }

    private async _getLockedCount(): Promise<number> {
        return (await this._store.query(ResourceProcessStatus.LOCKED)).length;
    }

    /**
     * onQueueResource, prepare send request
     * 
     * @param resource 
     */
    private async onQueueResource(resource: Resource): Promise<void> {

        const totalReqCount = await this._store.getRequestCount();

        if (totalReqCount < this.options.pageLimit) { // page limit 
            if (!await this._isUriQueued(resource.uri)) {
                await this._store.setRequestCount(totalReqCount + 1);
                await this._setResourceProcessing(resource);
                this.bus.emit("onContentRequest", resource);
            }
        }

    }

    /**
     * onContentRequest, use sender to request resource binary
     * 
     * @param resource 
     */
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
            this.logger.error(`not found sender for uri: ${resource.uri}`);
            await this._setResourceProcessed(resource);
        }

    }

    /**
     * onContentReceived, parse it
     * 
     * @param resource 
     * @param originalContent 
     */
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

    /**
     * onContentParsed, consume it
     * 
     * @param content 
     */
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

    private async scheduleRunner(): Promise<void> {

        const task = setInterval(async (): Promise<void> => {
            const lockedCount = await this._getLockedCount();
            const inProcessingCount = await this._getProcessingCount();
            const totalInRuntimeCount = lockedCount + inProcessingCount;
            const notProcessItems = await this._store.query(ResourceProcessStatus.NEW);

            // some resource not be requested
            if (notProcessItems.length > 0) {
                // in processing item less than event limit
                if (totalInRuntimeCount < this.options.eventLimit) {
                    await Promise.all(
                        take(notProcessItems, this.options.eventLimit).map(async u => {
                            const r = new Resource(u);
                            await this._setResourceLock(r); // lock first
                            this.bus.emit("onQueueResource", r);
                        })
                    );

                }
            }

            // all items has been requested, notProcessItems == 0
            else {

                // no items still in processing
                if (totalInRuntimeCount == 0) {
                    clearInterval(task);
                    this.bus.emit("finished");
                    this.bus.removeAllListeners("finished");
                }
            }

        }, this.options.checkFinishInterval);


    }

    /**
     * enqueue resource into runtime, runtime will schedule them ondemand
     * 
     * @param uri 
     */
    public async enqueueResource(uri: string | string[]): Promise<VORuntime> {

        if (isArray(uri)) {
            await Promise.all(uri.map(u => this.enqueueResource(u)));
        } else {
            await this._setResourceNew(new Resource(uri));
        }

        return this;

    }

    /**
     * start at entry uris, await it to wait all resource process finished
     * 
     * @param uri 
     */
    public async startAt(uri?: string | string[]): Promise<void> {


        // when start, add resource status 'NEW' from store
        await this.enqueueResource(await this._store.query(ResourceProcessStatus.NEW));

        if (uri) { await this.enqueueResource(uri); }

        this.scheduleRunner();

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