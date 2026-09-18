-- AlterTable
ALTER TABLE `email_logs` ADD COLUMN `parentId` VARCHAR(191) NULL,
    ADD COLUMN `payload` JSON NULL;

-- AddForeignKey
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `email_logs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
