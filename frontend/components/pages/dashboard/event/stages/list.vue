<script lang="ts" setup>
import { MapIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-vue-next'

import TrailMapStageForm from '@/components/pages/dashboard/event/stages/form.vue'
import CategoryList from '@/components/pages/dashboard/event/category/List.vue'

import { useStageStore } from '~/store/stage'
import type { Stage } from '~/lib/types'

interface TrailRaceStageListProps {
    eventId: string
}

const emit = defineEmits(['update'])
const props = defineProps<TrailRaceStageListProps>()
const { fetch, destory, restore } = useStageStore()
const { stages } = storeToRefs(useStageStore())

const showDialog = ref(false)
const editStage = ref<Stage | null>(null)
const activeTab = ref<string>('')
const showDeleted = ref(false)

watch(stages, (newStages) => {
    if (newStages.length > 0 && (!activeTab.value || !newStages.find(s => s.id === activeTab.value))) {
        activeTab.value = newStages[0].id
    }
}, { immediate: true })

onMounted(async () => {
    await fetch(props.eventId, showDeleted.value)
})

watch(showDeleted, async (newVal) => {
    await fetch(props.eventId, newVal)
})
</script>

<template>
    <!-- Page Header Section -->
    <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 mt-4 md:mt-0 gap-4">
        <div>
            <h2 class="text-3xl font-bold text-foreground font-headline">Stages</h2>
            <p class="text-muted-foreground mt-1 font-body">Manage stage details, categories, and checkpoints.</p>
        </div>
        <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
                <Switch id="show-deleted" v-model="showDeleted" />
                <Label for="show-deleted" class="text-sm cursor-pointer whitespace-nowrap">Show Deleted</Label>
            </div>
            <Button
                class="bg-gradient-to-r from-primary to-[#d95514] text-primary-foreground px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2 self-start md:self-auto"
                @click="showDialog = true">
                <PlusIcon class="w-5 h-5" />
                Add stage
            </Button>
        </div>
    </div>

    <!-- Main Layout Grid -->
    <Tabs orientation="vertical" v-model="activeTab" class="flex flex-col lg:flex-row gap-6 w-full">
        <!-- Left: Stage List (Switcher) -->
        <TabsList class="flex flex-col h-auto w-full lg:w-64 shrink-0 gap-2 bg-transparent p-0 justify-start">
            <TabsTrigger v-for="stage in stages" :key="stage.id" :value="stage.id"
                class="w-full flex-none min-h-16 text-left px-4 py-3 rounded-lg font-semibold relative overflow-hidden data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:bg-muted transition-colors justify-start z-10 after:content-[''] after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-primary after:rounded-l-lg after:opacity-0 data-[state=active]:after:opacity-100 after:transition-opacity truncate"
                :class="stage.deleted_at ? 'line-through opacity-70' : ''">
                {{ stage.name }}
                <span v-if="stage.deleted_at"
                    class="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold not-italic no-underline">Deleted</span>
            </TabsTrigger>
        </TabsList>

        <!-- Center: Stage Editor Canvas -->
        <div class="flex-1 min-w-0">
            <TabsContent v-for="stage in stages" :key="stage.id" :value="stage.id"
                class="m-0 focus-visible:outline-none">
                <div class="bg-white rounded-xl p-6 shadow-sm border relative">
                    <!-- Action Icons Top Right -->
                    <div class="absolute top-6 right-6 flex gap-2">
                        <Button v-if="stage.deleted_at" modifier="outline" size="sm" @click="async () => {
                            await restore(stage.id)
                            fetch(eventId, showDeleted)
                        }" class="h-8">
                            Restore
                        </Button>
                        <Button v-else variant="destructive" size="icon" @click="async () => {
                            await destory(stage.id)
                            fetch(eventId, showDeleted)
                        }" class="w-8 h-8">
                            <TrashIcon class="w-4 h-4" />
                        </Button>
                        <Button variant="secondary" size="icon" @click="() => {
                            showDialog = true
                            editStage = stage
                        }" class="w-8 h-8">
                            <PencilIcon class="w-4 h-4" />
                        </Button>
                    </div>

                    <h3 class="text-xl font-bold text-foreground pr-24 mb-2 font-headline">{{ stage.name }}</h3>

                    <div class="flex gap-2 mb-4">
                        <div
                            class="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary/10 text-xs font-bold uppercase tracking-wider">
                            runners {{ stage.runners?.length || 0 }}
                        </div>
                        <div
                            class="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary/10 text-xs font-bold uppercase tracking-wider">
                            volunteers {{ stage.volunteers?.length || 0 }}
                        </div>
                        <div
                            class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
                            :class="stage.has_shirt !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'">
                            {{ stage.has_shirt !== false ? 'Shirt: Yes' : 'Shirt: No' }}
                        </div>
                    </div>

                    <p class="text-muted-foreground text-sm leading-relaxed max-w-3xl font-body">
                        {{ stage.excerpt }}
                    </p>

                    <!-- Divider -->
                    <div class="h-px w-full bg-border my-8" />

                    <!-- Category List Component -->
                    <CategoryList :stage-id="stage.id" @update="emit('update')" />
                </div>
            </TabsContent>
        </div>
    </Tabs>
    <!-- Showing add / edit form for stage -->
    <Dialog :open="showDialog" @update:open="showDialog = false">
        <DialogContent class="sm:max-w-[1000px] max-h-full overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Stage form</DialogTitle>
                <DialogDescription>Fill in the details below to create or update a race for this event.
                </DialogDescription>
            </DialogHeader>
            <TrailMapStageForm :event-id="eventId" :stage="editStage" @update="() => {
                showDialog = false
                editStage = null
                fetch(eventId, showDeleted)
                emit('update')
            }" />
        </DialogContent>
    </Dialog>
</template>