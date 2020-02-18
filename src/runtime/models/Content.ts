import { BaseEntity, Entity, Column, PrimaryColumn, Generated, OneToOne, JoinColumn } from 'typeorm';
import { Resource } from './Resource';

export class Content<T = any> extends BaseEntity {

    id: string;

    resource: Resource;

    blob: Buffer;

    content: Buffer;

    type?: string;

    /**
     * getContent
     */
    public getContent(): T {
        if (this.content) {
            return JSON.parse(this.content.toString("utf8"));
        }
    }

    /**
     * setContent
     */
    public setContent(c: T): void {
        this.content = Buffer.from(JSON.stringify(c), "utf8");
    }

}