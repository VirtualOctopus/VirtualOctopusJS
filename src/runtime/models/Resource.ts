
export enum ResourceProcessStatus {
    /**
     * new queued
     */
    NEW = "NEW",
    /**
     * in processing
     */
    PROCESSING = "PROCESS_ING",
    /**
     * process finished
     */
    PROCESSED = "PROCESS_ED",
    /**
     * this resource is locked, maybe ready to process
     */
    LOCKED = "LOCKED"
}

export class Resource {

    constructor(uri?: string) {
        this.uri = uri;
    }

    uri: string;

    status: ResourceProcessStatus = ResourceProcessStatus.NEW

    /**
     * setInProcessing
     */
    public setInProcessing(): void {
        this.status = ResourceProcessStatus.PROCESSING;
    }

    public setProcessed(): void {
        this.status = ResourceProcessStatus.PROCESSED;
    }

}