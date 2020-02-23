import { ResourceProcessStatus } from "../models";

/**
 * Resource Store
 */
export abstract class Store {

    /**
     * save data
     * 
     * @param uri 
     * @param status 
     */
    abstract save(uri: string, status: ResourceProcessStatus): Promise<void>;

    /**
     * uri status, return null if not exist
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



    abstract release(): Promise<void>;

}