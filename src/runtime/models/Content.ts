import { BaseEntity, Entity, Column, PrimaryColumn, Generated, OneToOne, JoinColumn } from 'typeorm';
import { Resource } from './Resource';

@Entity({ name: "content" })
export class Content<T = any> extends BaseEntity {

    @PrimaryColumn()
    @Generated("uuid")
    id: string;

    @OneToOne(() => Resource)
    @JoinColumn()
    resource: Resource;

    @Column({ type: "blob", comment: "The content source file Blob binary" })
    blob: Buffer;

    @Column({ type: "blob", comment: "The serialized parsed content value", nullable: true })
    content: Buffer;

    @Column({ comment: "type of content" })
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