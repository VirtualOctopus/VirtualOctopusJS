
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
  LOCKED = "LOCKED",
  /**
   * error or page limited
   */
  IGNORED = "IGNORED",
}

export class Resource {

  constructor(uri?: string) {
    this.uri = uri;
  }

  uri: string;

  status: ResourceProcessStatus = ResourceProcessStatus.NEW

}