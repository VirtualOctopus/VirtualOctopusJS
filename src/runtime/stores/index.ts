import { ResourceProcessStatus } from "../models";
import { VOPlugin, PluginKind } from "../base";

/**
 * Resource Store
 */
export abstract class Store extends VOPlugin {

    getKind(): PluginKind {
        return PluginKind.ResourceStore;
    }

    /**
     * save data
     * 
     * @param uri 
     * @param status 
     */
    abstract save(uri: string, status: ResourceProcessStatus): Promise<void>;

    /**
     * get uri status, return null if not exist
     * 
     * @param uri string
     */
    abstract status(uri: string): Promise<ResourceProcessStatus>;

    /**
     * query uri by status
     * 
     * @param status 
     */
    abstract query(status: ResourceProcessStatus): Promise<string[]>;

    private _reqCount = 0;

    /**
     * set request count, used to limit total request number
     * 
     * @param count 
     */
    async setRequestCount(count: number): Promise<void> {
        this._reqCount = count;
    }

    /**
     * get current application sended requests number
     */
    async getRequestCount(): Promise<number> {
        return this._reqCount;
    }

    /**
     * release connection/resource
     */
    abstract release(): Promise<void>;

}