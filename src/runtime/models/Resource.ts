import { Entity, Column, BaseEntity, PrimaryColumn, Generated } from "typeorm";

export enum ResourceProcessStatus {
    NOT_PROCESS,
    PROCESSING,
    PROCESSED
}

@Entity({ name: "resource" })
export class Resource extends BaseEntity {

    @PrimaryColumn()
    @Generated("uuid")
    id: string;

    @Column({ length: 2048 })
    uri: string;

    @Column({ enum: ResourceProcessStatus })
    status: ResourceProcessStatus

}