<script setup lang="ts">
import { CheckIcon, ChevronUpIcon, CopyIcon, EllipsisVerticalIcon, MailCheckIcon, MailXIcon, MailIcon, LoaderIcon, UtensilsIcon } from 'lucide-vue-next'
import moment from 'moment'
import { humanize } from '~/lib/filters'
import { getDuration } from '~/lib/filters/runner'
import type { EventRunner, VolunteerCheckpoint } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { toast } from 'vue-sonner'

interface RunnerItemProps {
    rank?: number
    runner: EventRunner
    hasEventStarted?: boolean
    id?: string,
    selectedStage?: string | null
}

const emit = defineEmits(['show:runner', 'show:payment', 'updated:payment', 'fetch', 'edit'])
const props = defineProps<RunnerItemProps>()
const { axios } = useAxios()
const { can } = useAuthorization()

const showDeleteModal = ref(false)
const showTiming = ref(false)
const deleteCheckpointDataID = ref<string | null>(null)
const showDisqualificationModal = ref<boolean>(false)
const showDidNotFinishModal = ref<boolean>(false)
const showEditDialog = ref(false)
const checkpointData = ref<VolunteerCheckpoint | null>(null)

const hasPayment = computed(() => props.runner.payments.length > 0)
const activeRunner = computed(() => !['DISQUALIFIED', 'DID_NOT_FINISH'].includes(props.runner?.status?.status))
const classList = computed(() => (props.rank
    ? {
        'bg-primary/50 hover:bg-primary/50': props.rank == 1 && activeRunner.value,
        'bg-primary/30 hover:bg-primary/30': props.rank == 2 && activeRunner.value,
        'bg-primary/10 hover:bg-primary/10': props.rank == 3 && activeRunner.value,
        'bg-secondary/10': props.selectedStage === props.runner.id
    }
    : { 'bg-secondary/10': props.selectedStage === props.runner.id }))
const { copy, copied } = useClipboard()

const deleteRunner = async () => {
    await axios.delete(`/runners/${props.runner.id}`)
    emit('fetch')
    showDeleteModal.value = false
}

const deleteCheckpointEntryData = async () => {
    if (!deleteCheckpointDataID.value)
        return
    await axios.delete(`/checkpoints/${deleteCheckpointDataID.value}`)
    emit('fetch')
    deleteCheckpointDataID.value = null
}

const disqualifyRunner = async () => {
    await axios.put(`/runners/${props.runner.id}/disqualify`)
    emit('fetch')
    showDisqualificationModal.value = false
}

const didNotFinishRunner = async () => {
    await axios.put(`/runners/${props.runner.id}/did-not-finish`, {
        checkpoint_id: props.runner.volunteer_on_checkpoints[0].checkpoint_id
    })
    emit('fetch')
    showDidNotFinishModal.value = false
}

const doAttendance = async () => {
    await axios.put(`/runners/${props.runner.id}/${props.runner.stage_category.stage_id}/attendance`)
    emit('fetch')
}

const isSendingEmail = ref(false)
const sendConfirmationEmail = async () => {
    try {
        isSendingEmail.value = true
        await axios.post(`/runners/${props.runner.id}/send-confirmation`)
        toast.success('Confirmation email queued successfully')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to send confirmation email')
    } finally {
        isSendingEmail.value = false
    }
}

const isSendingBriefing = ref(false)
const sendBriefingEmail = async () => {
    try {
        isSendingBriefing.value = true
        const eventId = props.runner.event_id || props.runner.stage?.event_id
        const url = eventId
            ? `/events/${eventId}/runners/${props.runner.id}/send-briefing`
            : `/runners/${props.runner.id}/send-briefing`

        const { data } = await axios.post(url)
        toast.success(data?.message || `Event briefing queued for ${props.runner.personal.first_name}`)
        emit('fetch')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.response?.data || 'Failed to send event briefing')
    } finally {
        isSendingBriefing.value = false
    }
}

const isLunchAddon = (name?: string) => {
    if (!name) return false
    const lower = name.toLowerCase()
    return lower.includes('lunch') || lower.includes('meal') || lower.includes('food') || lower.includes('dal bhat') || lower.includes('khana')
}

const lunchAddons = computed(() => {
    return props.runner.addons?.filter(a => isLunchAddon(a.addon?.name)) || []
})

const otherAddons = computed(() => {
    return props.runner.addons?.filter(a => !isLunchAddon(a.addon?.name)) || []
})

const hasLunch = computed(() => {
    return Boolean(props.runner.want_lunch || lunchAddons.value.length > 0)
})

const lunchAddonNames = computed(() => {
    return lunchAddons.value.map(a => a.addon?.name).filter(Boolean) as string[]
})

</script>

<template>
    <ClientOnly>
        <TableRow class="relative" :class="classList" :id="id">
            <TableCell>
                <ChevronUpIcon class="inline-block vertical-align-middle" @click="showTiming = !showTiming"
                    v-if="runner.volunteer_on_checkpoints?.length > 0" />
                {{ activeRunner && rank ? rank : '' }}
            </TableCell>
            <TableCell>
                <em class="not-italic block">#BIB: {{ runner.bib }}</em>
                <strong class="block mb-1">
                    {{ runner.personal.first_name }}
                    {{ runner.personal.middle_name }}
                    {{ runner.personal.last_name }}
                </strong>
                <em class="block mb-1">
                    {{ runner.personal.email }}
                    <Button size="iconsm" modifier="outline" @click="copy(runner.personal.email)">
                        <CopyIcon class="size-2" v-if="!copied" />
                        <CheckIcon class="size-2" v-else />
                    </Button>
                </em>
                <div class="flex gap-2 mb-1 flex-wrap items-center">
                    <Badge>
                        {{ moment().diff(moment(runner.personal.date_of_birth), 'years') }}
                        {{ runner.personal?.gender?.name.charAt(0).toUpperCase() }}
                    </Badge>
                    <Badge variant="info">
                        <span class="font-normal opacity-55">Stage Category:</span>
                        {{ runner.stage_category.name }}
                    </Badge>
                    <Badge v-if="runner.briefing_sent || runner.email_sent" variant="success" class="text-xs"
                        :title="runner.briefing_sent_at || runner.email_sent_at ? `Briefed: ${moment(runner.briefing_sent_at || runner.email_sent_at).format('MMM DD, YYYY hh:mm A')}` : 'Briefed'">
                        <MailCheckIcon class="size-3 mr-1 inline" />
                        Briefed
                        <span v-if="runner.briefing_sent_at || runner.email_sent_at"
                            class="text-[10px] ml-1 opacity-75 font-normal">
                            ({{ moment(runner.briefing_sent_at || runner.email_sent_at).format('MMM DD') }})
                        </span>
                    </Badge>
                    <Badge v-else-if="runner.briefing_status === 'QUEUED'" variant="info" class="text-xs">
                        <LoaderIcon class="size-3 mr-1 inline animate-spin" />
                        Briefing Queued
                    </Badge>
                    <Badge v-else variant="outline" class="text-xs text-gray-400">
                        <MailXIcon class="size-3 mr-1 inline" />
                        Not Briefed
                    </Badge>
                </div>
                <div class="flex gap-2 items-center">
                    <span :class="['fi', 'fi-' + runner.personal.country.abbr]" />
                    {{ runner.personal?.country?.name }}
                </div>
            </TableCell>
            <TableCell>
                <ul class="text-gray-500 text-xs flex flex-col gap-1" v-if="runner.payments.length > 0">
                    <li>
                        Payment method:
                        <Badge variant="info">{{ humanize(runner.payments[0]?.method ?? '') }}</Badge>
                    </li>
                    <li>
                        Payment status:
                        <Badge variant="info">{{ humanize(runner.payments[0]?.status ?? '') }}</Badge>
                    </li>
                    <li v-if="runner.status">
                        Status:
                        <Badge variant="destructive">{{ humanize(runner.status.status ?? '') }}</Badge>
                    </li>
                </ul>
            </TableCell>
            <TableCell>
                <div class="flex flex-col gap-1 items-start">
                    <template v-if="hasLunch">
                        <Badge variant="success" class="text-xs">
                            <UtensilsIcon class="size-3 mr-1 inline" />
                            Yes
                        </Badge>
                        <span v-for="name in lunchAddonNames" :key="name" class="text-[11px] text-gray-500 font-normal">
                            {{ name }}
                        </span>
                    </template>
                    <template v-else>
                        <Badge variant="destructive" class="text-xs">No</Badge>
                    </template>
                    <div v-if="otherAddons.length > 0" class="flex flex-wrap gap-1 mt-0.5">
                        <Badge v-for="addon in otherAddons" :key="addon.id" variant="outline" class="text-[10px] text-gray-500 font-normal">
                            + {{ addon.addon?.name }}
                        </Badge>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <div class="flex gap-2 items-center justify-end">
                    <Button size="sm" @click="doAttendance"
                        v-if="runner?.runner_attendances?.length === 0 && hasEventStarted">present</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <Button size="sm" modifier="link">
                                <EllipsisVerticalIcon />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem class="text-gray-500" @click="emit('show:runner')">
                                See details
                            </DropdownMenuItem>
                            <DropdownMenuItem class="text-yellow-500" @click="emit('edit')">
                                Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem class="text-blue-500" @click="sendConfirmationEmail"
                                :disabled="isSendingEmail">
                                {{ isSendingEmail ? 'Sending...' : 'Resend confirmation email' }}
                            </DropdownMenuItem>
                            <DropdownMenuItem class="text-purple-600 dark:text-purple-400" @click="sendBriefingEmail"
                                :disabled="isSendingBriefing">
                                <MailIcon class="size-4 mr-2" />
                                {{ isSendingBriefing ? 'Sending...' : (runner.briefing_sent || runner.email_sent ?
                                'Resend event briefing' : 'Send event briefing') }}
                            </DropdownMenuItem>
                            <template v-if="runner.payments.length > 0 && runner.payments[0].status != 'COMPLETED'">
                                <DropdownMenuItem class="text-gray-500" @click="emit('show:payment')" v-if="hasPayment">
                                    See payment details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Payment Actions</DropdownMenuLabel>
                                <DropdownMenuItem class="text-green-500"
                                    @click="emit('updated:payment', 'COMPLETED', runner.payments[0].id)">
                                    Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem class="text-yellow-500"
                                    @click="emit('updated:payment', 'PENDING', runner.payments[0].id)">
                                    Pending
                                </DropdownMenuItem>
                                <DropdownMenuItem class="text-red-500"
                                    @click="emit('updated:payment', 'FAILED', runner.payments[0].id)">
                                    Failed
                                </DropdownMenuItem>
                            </template>
                            <template v-if="can('runner_delete')">
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Runner Actions</DropdownMenuLabel>
                                <template v-if="!runner.status">
                                    <DropdownMenuItem class="text-red-500" @click="showDidNotFinishModal = true">
                                        Did not finished
                                    </DropdownMenuItem>
                                    <DropdownMenuItem class="text-red-500" @click="showDisqualificationModal = true">
                                        Disqualified
                                    </DropdownMenuItem>
                                </template>
                                <DropdownMenuItem class="text-red-500" @click="showDeleteModal = true">
                                    Delete
                                </DropdownMenuItem>
                            </template>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </TableCell>
        </TableRow>
        <TableRow v-if="runner.volunteer_on_checkpoints?.length && showTiming" :class="classList" :id="id">
            <TableCell colspan="6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableCell>Checkpoint</TableCell>
                            <TableCell>Split time</TableCell>
                            <TableCell>Duration</TableCell>
                            <TableCell class="text-right">Action</TableCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="(record, index) in runner.volunteer_on_checkpoints">
                            <TableCell>
                                {{ record?.checkpoint?.name }}
                            </TableCell>
                            <TableCell>
                                {{ getDuration(record?.timer,
                                    index === runner.volunteer_on_checkpoints.length - 1
                                        ? runner.stage_category.start
                                        : runner.volunteer_on_checkpoints[index + 1].timer) }}
                            </TableCell>
                            <TableCell>
                                Time: {{ moment(record?.timer).local().format('HH:mm:ss a') }}<br />
                                Duration: {{ getDuration(record?.timer, runner.stage_category.start) }}
                            </TableCell>
                            <TableCell>
                                <div class="flex justify-end gap-2">
                                    <Button @click="deleteCheckpointDataID = record.id" size="sm"
                                        modifier="link">Delete</Button>
                                    <Button variant="secondary"
                                        @click="checkpointData = record; showEditDialog = true">Edit</Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableCell>
        </TableRow>
        <Dialog :open="showDeleteModal" @update:open="showDeleteModal = false">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Are you sure you want to delete this runner?</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button @click="showDeleteModal = false">Cancel</Button>
                    <Button @click="deleteRunner">Delete</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <AlertDialog :open="deleteCheckpointDataID != null">
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to delete this checkpoint entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                        The checkpoint entry of this runner will be deleted.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel @click="deleteCheckpointDataID = null">Cancel</AlertDialogCancel>
                    <AlertDialogAction @click="deleteCheckpointEntryData">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog :open="showDisqualificationModal" @update:open="showDisqualificationModal = false">
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to disqualify this runner?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This runner will be disqualified from the event and will not be listed on result.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel @click="showDisqualificationModal = false">Cancel</AlertDialogCancel>
                    <AlertDialogAction @click="disqualifyRunner">Yes, disqualify</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog :open="showDidNotFinishModal" @update:open="showDidNotFinishModal = false">
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to mark this runner as did not finish?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This runner will be marked as did not finish from the event and will not be listed on result.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel @click="showDidNotFinishModal = false">Cancel</AlertDialogCancel>
                    <AlertDialogAction @click="didNotFinishRunner">Yes, mark as did not finish</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <Dialog :open="showEditDialog" @update:open="showEditDialog = false; checkpointData = null">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit {{ runner.personal.first_name }}</DialogTitle>
                    <DialogDescription>Edit runner's time entry</DialogDescription>
                </DialogHeader>
                <PagesDashboardEventRunnerCheckpointForm :checkpoint="checkpointData"
                    @update="emit('fetch'); showEditDialog = false; checkpointData = null" />
            </DialogContent>
        </Dialog>
    </ClientOnly>
</template>