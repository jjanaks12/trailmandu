-- AlterTable
ALTER TABLE `volunteer_on_checkpoints` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `updated_at` DATETIME(3) NULL;
