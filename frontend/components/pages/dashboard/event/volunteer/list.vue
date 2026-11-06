<script lang="ts" setup>
import { CheckIcon, CopyIcon, RefreshCwIcon, LoaderIcon } from 'lucide-vue-next'
import type { Checkpoint, Stage, Volunteer } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { useStageStore } from '~/store/stage'
import { toast } from 'vue-sonner'

interface VolunteerListProps {
    eventId: string
}

const { fetch: fetchStages } = useStageStore()
const emit = defineEmits(['update'])
const props = defineProps<VolunteerListProps>()

const { stages, isLoading: isStageLoading } = storeToRefs(useStageStore())

const selectedVolunteer = ref<Volunteer | null>(null)
const checkpoints = ref<Checkpoint[]>([])
const showDeleteModal = ref(false)
const showAssignModal = ref(false)
const selectedStage = ref('')
const isRefreshing = ref(false)
const isDeleting = ref(false)

const { copy, copied } = useClipboard()
const { axios } = useAxios()

const stage = computed(() => stages.value.find(stage => stage.id == selectedStage.value))

watch(stages, (newStages) => {
    if ((!selectedStage.value || !newStages.some(s => s.id === selectedStage.value)) && newStages.length > 0) {
        selectedStage.value = newStages[0].id
    }
}, { immediate: true })

const refreshData = async (showToast = false) => {
    isRefreshing.value = true
    try {
        await fetchStages(props.eventId)
        if ((!selectedStage.value || !stages.value.some(s => s.id === selectedStage.value)) && stages.value.length > 0) {
            selectedStage.value = stages.value[0].id
        }
        if (showToast) {
            toast.success('Volunteer list refreshed')
        }
        emit('update')
    } catch (e: any) {
        if (showToast) {
            toast.error('Failed to refresh volunteers')
        }
    } finally {
        isRefreshing.value = false
    }
}

const deleteVolunteer = async () => {
    if (!selectedVolunteer.value) return
    isDeleting.value = true
    try {
        await axios.delete(`/volunteers/${selectedVolunteer.value?.id}`)
        toast.success('Volunteer deleted successfully')
        showDeleteModal.value = false
        selectedVolunteer.value = null
        await refreshData()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to delete volunteer')
    } finally {
        isDeleting.value = false
    }
}

onMounted(async () => {
    await refreshData()
})
</script>

<template>
    <div
        class="bg-gray-100 flex flex-wrap items-center justify-between gap-4 mb-6 border border-dashed border-gray-400 p-3 rounded-xl sticky top-[83px] z-10">
        <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-500">Stage:</span>
            <Select v-model="selectedStage">
                <SelectTrigger class="w-[180px] bg-white" size="sm">
                    <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem v-for="stg in stages" :key="stg.id" :value="stg.id">{{ stg.name }}</SelectItem>
                </SelectContent>
            </Select>
            <span v-if="stage" class="text-xs text-muted-foreground">
                ({{ stage.volunteers?.length || 0 }}
                {{ (stage.volunteers?.length === 1) ? 'volunteer' : 'volunteers' }})
            </span>
        </div>
        <div class="flex items-center gap-2">
            <Button modifier="outline" size="sm" class="bg-white shadow-sm" @click="refreshData(true)"
                :disabled="isRefreshing">
                <RefreshCwIcon class="w-4 h-4 mr-2" :class="{ 'animate-spin': isRefreshing }" />
                Refresh
            </Button>
        </div>
    </div>
    <Table>
        <TableHeader>
            <TableHead>S.N.</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Checkpoints</TableHead>
            <TableHead class="text-right">Actions</TableHead>
        </TableHeader>
        <TableBody>
            <TableRow v-for="(volunteer, index) in stage.volunteers" v-if="stage">
                <TableCell>{{ index + 1 }}</TableCell>
                <TableCell class="align-top">
                    <strong class="text-lg block">
                        {{ volunteer.personal.first_name }}
                        {{ volunteer.personal.middle_name }}
                        {{ volunteer.personal.last_name }}
                    </strong>
                    <em class="block">
                        {{ volunteer.personal.email }}
                        <Button size="icon" modifier="outline" @click="copy(volunteer.personal.email)">
                            <CopyIcon class="size-4" v-if="!copied" />
                            <CheckIcon class="size-4" v-else />
                        </Button>
                    </em>
                </TableCell>
                <TableCell>
                    <ul class="list-decimal" v-if="volunteer?.checkpoints.length > 0">
                        <li v-for="checkpoint in volunteer.checkpoints">{{ checkpoint.name }}</li>
                    </ul>
                </TableCell>
                <TableCell>
                    <div class="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" modifier="outline" @click="() => {
                            if (stage) {
                                selectedVolunteer = volunteer
                                checkpoints = stage.stage_categories
                                    .map(sc => sc.checkpoints || [])
                                    .reduce((acc, curr) => ([...acc, ...curr]), [])
                                showAssignModal = true
                            }
                        }">{{ volunteer.checkpoints.length > 0 ? 'Reassign' : 'Assign to checkpoint' }}</Button>
                        <Button variant="destructive" size="sm"
                            @click="showDeleteModal = true; selectedVolunteer = volunteer">Delete</Button>
                    </div>
                </TableCell>
            </TableRow>
            <TableRow v-if="!stage">
                <TableCell colspan="4">
                    <span class="text-center block p-3 text-gray-500 bg-accent rounded">No stage selected</span>
                </TableCell>
            </TableRow>
            <TableRow v-if="stage && stage.volunteers?.length == 0">
                <TableCell colspan="4">
                    <span class="text-center block p-3 text-gray-500 bg-accent rounded">No volunteers have
                        registered</span>
                </TableCell>
            </TableRow>
        </TableBody>
    </Table>
    <Dialog :open="showAssignModal" @update:open="showAssignModal = false; selectedVolunteer = null"
        v-if="selectedVolunteer">
        <DialogContent>
            <DialogHeader>
                <DialogTitle class="text-2xl">Assign volunteers to checkpoint</DialogTitle>
                <DialogDescription>You can individually assign volunteers to the available checkpoints
                </DialogDescription>
            </DialogHeader>
            <PagesDashboardEventVolunteerAssignCheckpointForm :volunteer="selectedVolunteer" :checkpoints="checkpoints"
                @update="async () => {
                    showAssignModal = false
                    selectedVolunteer = null
                    toast.success('Volunteer checkpoints updated')
                    await refreshData()
                }" />
        </DialogContent>
    </Dialog>
    <Dialog :open="showDeleteModal" @update:open="showDeleteModal = false">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Are you sure you want to delete this volunteer?</DialogTitle>
                <DialogDescription>
                    This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button @click="showDeleteModal = false" :disabled="isDeleting">Cancel</Button>
                <Button variant="destructive" @click="deleteVolunteer" :disabled="isDeleting">
                    <LoaderIcon v-if="isDeleting" class="w-4 h-4 mr-2 animate-spin" />
                    Delete
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>