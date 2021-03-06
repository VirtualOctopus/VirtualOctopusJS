import { Resource, Content, ResourceProcessStatus } from './models/index';
import EventEmitter from "events";
import { VOParser, ParserAcceptOptions } from "./parsers/VOParser";
import log4js from "log4js";
import { VOConsumer, ConsumerAcceptOptions, VOErrorConsumer, ErrorPhase } from "./consumers/VOConsumer";
import { VOSender, RetrieveResponse } from "./senders/VOSender";
import { VOPlugin, PluginKind } from "./base/VOPlugin";
import { uniq, isArray, take } from "@newdash/newdash";
import { Store, MemoryStore } from ".";
import * as uuid from "uuid";
import { VOPackage } from './base/VOPackage';

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
  checkFinishInterval: 500,
  eventLimit: 100,
  logLevel: log4js.levels.ERROR.levelStr,
};


const { VO_LOG_LEVEL } = process.env;

export class VORuntime {

  constructor(options?: VORuntimeOptions) {

    this.logger = log4js.getLogger("VORuntime");

    this.options = Object.assign(DefaultVORuntimeOptions, options); // merge default options

    this._store = this?.options?.store ?? new MemoryStore(); // default memory store

    this.logger.level = VO_LOG_LEVEL ?? this.options.logLevel; // default log level

    this._setupBus();

  }

  private _store: Store;

  private options: VORuntimeOptions = {};

  private logger: log4js.Logger;

  private bus: EventEmitter;

  private parsers: Array<VOParser> = [];

  private consumers: Array<VOConsumer> = [];

  private error_consumers: Array<VOErrorConsumer> = [];

  private senders: Array<VOSender> = [];

  public with(p: VOPlugin | ArrayLike<VOPlugin>): VORuntime {
    if (Array.isArray(p)) { p.forEach(ap => this.with(ap)); }
    else if (p instanceof VOPlugin) {

      switch (p.getKind()) {
        case PluginKind.Consumer:
          if (p instanceof VOConsumer) { this.addConsumer(p); } break;
        case PluginKind.Parser:
          if (p instanceof VOParser) { this.addParser(p); } break;
        case PluginKind.Sender:
          if (p instanceof VOSender) { this.addSender(p); } break;
        case PluginKind.ErrorConsumer:
          if (p instanceof VOErrorConsumer) { this.addErrorConsumer(p); } break;
        case PluginKind.ResourceStore:
          if (p instanceof Store) { this._store = p; } break;
        case PluginKind.Package:
          if (p instanceof VOPackage) { this.with(p.getPlugins()); } break;
        default: break;
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

  public addErrorConsumer(c: VOErrorConsumer): VORuntime {
    this.error_consumers.push(c);
    return this;
  }


  /**
   * destroy runtime & db connection
   */
  public async destroy(): Promise<void> {
    return new Promise(res => {
      const task = setInterval(async () => {
        if ((await this._getTotalInRuntimeCount()) == 0) { // all items processed
          if (this._store) {
            await this._store.release();
          }
          clearInterval(task);
          res();
        }
      }, this.options.checkFinishInterval);
    });
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

  private async _setResourceIgnored(r: Resource): Promise<void> {
    await this._store.save(r.uri, ResourceProcessStatus.IGNORED);
  }

  private async _getProcessingCount(): Promise<number> {
    return (await this._store.query(ResourceProcessStatus.PROCESSING)).length;
  }

  private async _getLockedCount(): Promise<number> {
    return (await this._store.query(ResourceProcessStatus.LOCKED)).length;
  }

  private async _getTotalInRuntimeCount(): Promise<number> {
    return (await this._getLockedCount()) + (await this._getProcessingCount());
  }

  /**
   * onQueueResource, prepare send request
   * 
   * @param resource 
   */
  private async onQueueResource(resource: Resource): Promise<void> {

    const totalReqCount = await this._store.getRequestCount();

    if (totalReqCount < this.options.pageLimit) { // page limit 
      await this._store.setRequestCount(totalReqCount + 1);
      await this._setResourceProcessing(resource);
      this.bus.emit("onContentRequest", resource);
    } else {
      await this._setResourceIgnored(resource);
      this.logger.info(`page limit exceeded, uri: %s ignore.`, resource.uri);
    }

  }

  /**
   * onContentRequest, use sender to request resource binary
   * 
   * @param resource 
   */
  private async onContentRequest(resource: Resource): Promise<void> {

    const { uri } = resource;

    const sender = await this._getSender(uri);

    if (sender) {
      // use sender to retrieve data
      try {
        const content = await sender.retrieve(resource.uri);
        this.bus.emit("onContentReceived", resource, content);
      } catch (error) {
        // error here
        await this._consumerError(uri, error, undefined, ErrorPhase.SendRequest);
        this.logger.error(`fetch ${uri} failed: ${error}`);
        await this._setResourceProcessed(resource);
      }

    } else {
      // not found sender
      // error here
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
  private async onContentReceived(resource: Resource, { content, type }: RetrieveResponse): Promise<void> {

    const parser = await this._getParser({ uri: resource.uri, type: type });
    const newContent = new Content();

    newContent.resource = resource;
    newContent.blob = content;
    newContent.type = type; // fallback type

    if (parser) {

      try {
        const { links, parsedObject, type } = await parser.parse(content);

        newContent.type = type;
        newContent.setContent(parsedObject || {});

        if (links) {
          await this.enqueueResource(uniq(links));
        }

      } catch (error) {

        await this._consumerError(resource.uri, error, type, ErrorPhase.ParseContent);

        this.logger.error(`parse content failed for uri: '${resource.uri}', ${error}`);

      }

    }

    this.bus.emit("onContentParsed", newContent);

  }

  /**
   * dispatch error to consumer
   * 
   * @param uri 
   * @param error 
   * @param type 
   */
  private async _consumerError(uri: string, error: Error, type?: string, phase: ErrorPhase = ErrorPhase.InternalUnknown): Promise<void> {
    for (let i = 0; i < this.error_consumers.length; i++) {
      const c = this.error_consumers[i];
      try {
        if (await c.accept({ uri, type })) {
          await c.consume(error, { uri, type, phase });
        }
      } catch {
        this.logger.error("error happened in error consumer: ", c?.constructor?.name);
      }

    }
  }

  /**
   * onContentParsed, consume it
   * 
   * @param content 
   */
  private async onContentParsed(content: Content): Promise<void> {

    const { type, resource: { uri } } = content;

    const cs = await this._getConsumers({ uri, type });

    await Promise.all(
      cs.map(async c => {
        try {
          await c.consume(content);
        } catch (error) {
          await this._consumerError(uri, error, type, ErrorPhase.ConsumeData);
          this.logger.error(`consume ${uri} failed: ${error}`);
        }
      })
    );

    await this._setResourceProcessed(content.resource);

  }

  private async scheduleRunner(taskId: string): Promise<void> {

    const { eventLimit, checkFinishInterval } = this.options;

    const task = setInterval(async (): Promise<void> => {
      const totalInRuntimeCount = await this._getTotalInRuntimeCount();
      const notProcessItems = await this._store.query(ResourceProcessStatus.NEW, eventLimit);

      // some resource not be requested
      if (notProcessItems.length > 0) {

        // in processing item less than event limit
        if (totalInRuntimeCount < eventLimit) {

          await Promise.all(
            take(notProcessItems, eventLimit).map(async u => {
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
          this.bus.emit(taskId);
        }
      }

    }, checkFinishInterval);


  }

  /**
   * enqueue resource into runtime, runtime will schedule them on-demand
   * 
   * @param uri 
   */
  public async enqueueResource(uri: string | string[]): Promise<VORuntime> {

    if (isArray(uri)) {
      await Promise.all(uri.map(u => this.enqueueResource(u)));
    } else {
      const s = await this._store.status(uri);
      if (s == null) {
        await this._setResourceNew(new Resource(uri));
      }
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

    const taskId = uuid.v4(); // generate a taskId

    this.scheduleRunner(taskId);

    return new Promise(resolve => {
      // startAt function will be resolved on finished
      this.bus.once(taskId, () => { resolve(); });
    });

  }

}

export const createVORuntime = async (options?: VORuntimeOptions): Promise<VORuntime> => {
  return new Promise((resolve, reject) => {
    try {
      resolve(new VORuntime(options));
    } catch (error) {
      reject(error);
    }
  });
};