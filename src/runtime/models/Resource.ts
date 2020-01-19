import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

export enum ResourceProcessStatus {
    NOT_PROCESS,
    PROCESSING,
    PROCESSED
}

@Entity({ name: "resource" })
export class Resource extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "uuid" })
    id: string;

    @Column({ length: 2048 })
    uri: string;

    @Column()
    status: ResourceProcessStatus

}