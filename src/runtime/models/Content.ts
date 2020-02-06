import { BaseEntity, Entity, Column, PrimaryColumn, Generated, OneToOne, JoinColumn } from 'typeorm';
import { Resource } from './Resource';

@Entity({ name: "content" })
export class Content extends BaseEntity {

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

    /**
     * getContent
     */
    public getContent(): any {
        if (this.content) {
            return JSON.parse(this.content.toString("utf8"));
        }
    }

    /**
     * setContent
     */
    public setContent(c: any): void {
        this.content = Buffer.from(JSON.stringify(c), "utf8");
    }

}