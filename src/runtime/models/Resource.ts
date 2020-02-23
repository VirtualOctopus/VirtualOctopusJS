
export enum ResourceProcessStatus {
    /**
     * new queued
     */
    NEW,
    /**
     * in processing
     */
    PROCESSING,
    /**
     * process finished
     */
    PROCESSED,
    /**
     * this resource is locked, maybe ready to process
     */
    LOCKED
}

export class Resource {


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