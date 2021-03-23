import { Resource } from './Resource';

export class Content<T = any>  {

    id: string;

    resource: Resource;

    blob: Buffer;

    content: T;

    /**
     * business type, fallback to mime type
     */
    type?: string;

    /**
     * getContent
     */
    public getContent(): T {
        if (this.content) {
            return this.content;
        }
    }

    /**
     * setContent
     */
    public setContent(c: T): void {
        this.content = c;
    }

}