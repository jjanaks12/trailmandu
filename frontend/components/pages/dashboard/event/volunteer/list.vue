<script lang="ts" setup>
import { CheckIcon, CopyIcon } from 'lucide-vue-next'
import type { Checkpoint, Stage, Volunteer } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { useStageStore } from '~/store/stage'

interface VolunteerListProps {
    eventId: string
}

const { fetch: fetchStages } = useStageStore()
const emit = defineEmits(['update'])
const props = defineProps<VolunteerListProps>()

const { stages } = storeToRefs(useStageStore())

const selectedVolunteer = ref<Volunteer | null>(null)
const checkpoints = ref<Checkpoint[]>([])
const showDeleteModal = ref(false)
const showAssignModal = ref(false)
const selectedStage = ref('')

const { copy, copied } = useClipboard()
const { axios } = useAxios()

const stage = computed(() => stages.value.find(stage => stage.id == selectedStage.value))

const deleteVolunteer = async () => {
    await axios.delete(`/volunteers/${selectedVolunteer.value?.id}`)
    emit('update')
    showDeleteModal.value = false
    selectedVolunteer.value = null
}

onMounted(async () => {
    await fetchStages(props.eventId)
})
</script>

<template>
    <div class="bg-gray-100 space-y-6 mb-12 border border-dashed border-gray-400 p-3 rounded-xl sticky top-[83px] z-10">
        <h2 class="text-xl text-gray-400">Filters:</h2>
        <Select v-model="selectedStage">
            <SelectTrigger class="w-[160px]" size="sm">
                Stage:
                <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem v-for="stage in stages" :value="stage.id">{{ stage.name }}</SelectItem>
            </SelectContent>
        </Select>
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
                                    .map(sc => sc.checkpoints)
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
            <TableRow v-if="stage?.volunteers.length == 0">
                <TableCell colspan="4">
                    <span class="text-center block p-3 text-gray-500 bg-accent rounded">No volunteers has
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
                <DialogDescription>You can indiviually assign volunteers to the available checkpoints
                </DialogDescription>
            </DialogHeader>
            <PagesDashboardEventVolunteerAssignCheckpointForm :volunteer="selectedVolunteer" :checkpoints="checkpoints"
                @update="() => {
                    selectedVolunteer = null
                    emit('update')
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
                <Button @click="showDeleteModal = false">Cancel</Button>
                <Button @click="deleteVolunteer">Delete</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>