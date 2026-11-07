<script lang="ts" setup>
import moment from 'moment'
import { abbr, showImage } from '~/lib/filters'
import type { EventRunner } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { toast } from 'vue-sonner'

interface VolunteerRunnerProps {
    runner: EventRunner
    timer?: string
    checkpointId: string
    enabled: boolean
}

const emit = defineEmits(['update', 'fetch'])
const props = defineProps<VolunteerRunnerProps>()
const { axios } = useAxios()
const isLogging = ref(false)

const showDidnotfinishedDialog = ref(false)

const fullName = computed(() => [props.runner.personal.first_name, props.runner.personal.middle_name, props.runner.personal.last_name].filter(Boolean).join(' '))

const logTimer = async () => {
    if (props.timer == undefined && !isLogging.value) {
        try {
            isLogging.value = true
            await axios.post(`/volunteers/${props.checkpointId}/log_timer/${props.runner.id}`, {
                stage_category_id: props.runner.stage_category_id
            })
            toast.success(`Recorded time for ${fullName.value || '#' + props.runner.bib}`)
            emit('update')
        } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.response?.data || 'Failed to record timer')
        } finally {
            isLogging.value = false
        }
    }
}

const didNotFinishRunner = async () => {
    try {
        await axios.put(`/runners/${props.runner.id}/did-not-finish`, {
            checkpoint_id: props.checkpointId
        })
        toast.info(`${fullName.value || '#' + props.runner.bib} marked as Did Not Finish`)
        emit('fetch')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to update runner status')
    } finally {
        showDidnotfinishedDialog.value = false
    }
}
</script>

<template>
    <div class="text-center space-y-2">
        <Avatar
            :class="{ 'size-[120px] mx-auto border-4': true, 'border-primary': timer == undefined, 'border-secondary': timer !== undefined }"
            @dblclick="logTimer">
            <AvatarImage :src="showImage(runner.personal?.avatar?.file_name)" :alt="runner.personal.first_name" />
            <AvatarFallback>{{ abbr(fullName.toUpperCase()) }}</AvatarFallback>
        </Avatar>
        <strong class="block">{{ fullName }}</strong>
        <em class="not-italic text-3xl text-black block">{{ runner.bib }}</em>
        <span class="block" v-if="timer">{{ moment.utc(timer).local().format('YYYY-MM-DD HH:mm:ss') }}</span>
        <span :class="['fi', 'fi-' + runner.personal.country.abbr.toLowerCase()]"></span><br />
        {{ runner.status }}
        <Button variant="destructive" @click="showDidnotfinishedDialog = true" v-if="!runner.status && !timer">
            Did not finished
        </Button>
    </div>
    <AlertDialog :open="showDidnotfinishedDialog">
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    Runner will be marked as did not finished and will be out of the race.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel @click="showDidnotfinishedDialog = false">No, Cancel</AlertDialogCancel>
                <AlertDialogAction @click="didNotFinishRunner">Yes, Continue</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>