-- CreateTable
CREATE TABLE `race_updates` (
    `id` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `stage_id` VARCHAR(191) NULL,
    `event_id` VARCHAR(191) NULL,
    `parent_id` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `race_updates` ADD CONSTRAINT `race_updates_stage_id_fkey` FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `race_updates` ADD CONSTRAINT `race_updates_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `race_updates` ADD CONSTRAINT `race_updates_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `race_updates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
