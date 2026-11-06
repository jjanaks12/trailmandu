<script lang="ts" setup>
import type { EventRunner } from '~/lib/types'
import { useAppStore } from '~/store/app'

type Props = {
    runners: EventRunner[]
}

const props = defineProps<Props>()
const { company } = storeToRefs(useAppStore())

const nationalRunners = computed(() => props.runners.filter((runner) => runner.personal.country.name == company.value?.address?.country.name).length)
const internationalRunners = computed(() => props.runners.filter((runner) => runner.personal.country.name != company.value?.address?.country.name).length)
const maleRunners = computed(() => props.runners.filter((runner) => runner.personal.gender.name == 'Male').length)
const femaleRunners = computed(() => props.runners.filter((runner) => runner.personal.gender.name == 'Female').length)
const presentRunners = computed(() => props.runners.filter((runner) => runner.runner_attendances.length > 0).length)
const absentRunners = computed(() => props.runners.filter((runner) => runner.runner_attendances.length == 0).length)
const briefedRunners = computed(() => props.runners.filter((runner) => runner.briefing_sent || runner.email_sent).length)
const notBriefedRunners = computed(() => props.runners.filter((runner) => !runner.briefing_sent && !runner.email_sent).length)
</script>

<template>
    <div class="w-[300px] space-y-12 border border-gray-300 p-3 rounded-xl" v-if="runners.length > 0">
        <h2 class="text-xl text-gray-400">Stats</h2>
        <div class="flex flex-col gap-6">
            <div class="text-black">
                <strong class="font-normal text-xs uppercase block opacity-35">Total</strong>
                <em class="text-5xl not-italic">{{ runners.length }}</em>
            </div>
            <Separator />
            <div class="text-blue-600">
                <strong class="font-normal text-xs uppercase block opacity-35">National</strong>
                <em class="text-5xl not-italic">{{ nationalRunners }}</em>
            </div>
            <div class="text-red-600">
                <strong class="font-normal text-xs uppercase block opacity-35">International</strong>
                <em class="text-5xl not-italic">{{ internationalRunners }}</em>
            </div>
            <Separator />
            <div class="text-indigo-600">
                <strong class="font-normal text-xs uppercase block opacity-35">Male</strong>
                <em class="text-5xl not-italic">{{ maleRunners }}</em>
            </div>
            <div class="text-pink-600">
                <strong class="font-normal text-xs uppercase block opacity-35">Female</strong>
                <em class="text-5xl not-italic">{{ femaleRunners }}</em>
            </div>
            <Separator />
            <div class="text-indigo-600">
                <strong class="font-normal text-xs uppercase block opacity-35">Present</strong>
                <em class="text-5xl not-italic">{{ presentRunners }}</em>
            </div>
            <div class="text-pink-600">
                <strong class="font-normal text-xs uppercase block opacity-35">Absent</strong>
                <em class="text-5xl not-italic">{{ absentRunners }}</em>
            </div>
            <Separator />
            <div class="text-emerald-600">
                <strong class="font-normal text-xs uppercase block opacity-35">Briefed</strong>
                <em class="text-5xl not-italic">{{ briefedRunners }}</em>
            </div>
            <div class="text-amber-600">
                <strong class="font-normal text-xs uppercase block opacity-35">Not Briefed</strong>
                <em class="text-5xl not-italic">{{ notBriefedRunners }}</em>
            </div>
        </div>
    </div>
    <Skeleton class="w-[300px] h-[500px]" v-else />
</template>