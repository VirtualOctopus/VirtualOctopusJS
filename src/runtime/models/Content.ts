import { BaseEntity, Entity, Column, PrimaryColumn, Generated } from 'typeorm';

@Entity({ name: "content" })
export class Content extends BaseEntity {

    @PrimaryColumn()
    @Generated("uuid")
    id: string

    @Column({ type: "blob", comment: "The content source file Blob binary" })
    blob: Buffer;

    @Column({ type: "blob", comment: "The serialized parsed content value" })
    content: Buffer;

    /**
     * getContent
     */
    public getContent(): any {
        if (this.content) {
            return JSON.parse(this.content.toString());
        }
    }

    /**
     * setContent
     */
    public setContent(c: any): void {
        this.content = Buffer.from(JSON.stringify(c), "utf8");
    }

}