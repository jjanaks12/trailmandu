<script setup lang="ts">
import type { Stage } from '~/lib/types'
import moment from 'moment'
import { distanceToKm, formatDate } from '~/lib/filters';

interface StatsProps {
    stage: Stage
    slug: string
}

const props = defineProps<StatsProps>()

const currentStageCategory = computed(() => props.stage?.stage_categories
    .sort((a, b) => moment.utc(a.start).diff(moment.utc(b.start)))[0])

const totalDistance = computed(() => props.stage?.stage_categories.reduce((total, category) => total + parseInt(category.distance ?? '0'), 0))
const totalElevation = computed(() => props.stage?.stage_categories.reduce((total, category) => total + parseInt(category.elevation || '0'), 0))

const difficulty = computed(() => {
    if (!props.stage?.stage_categories) return '-'
    const difficulties = [...new Set(props.stage.stage_categories.map(c => c.difficulty).filter(Boolean))]
    if (difficulties.length === 0) return '-'
    return difficulties.map(d => d!.charAt(0).toUpperCase() + d!.slice(1)).join(' / ')
})

const lastStageCategory = computed(() => {
    const categories = props.stage?.stage_categories || []
    if (categories.length === 0) return null
    return [...categories].sort((a, b) => moment.utc(b.end).diff(moment.utc(a.end)))[0]
})

const isFinished = computed(() => {
    // If the stage itself has an end date, we could use that, otherwise we use the latest category end date
    const endDate = props.stage?.end || lastStageCategory.value?.end
    if (!endDate) return false
    return moment.utc(endDate).isBefore(moment.utc())
})
</script>

<template>
    <div
        class="dark:bg-black/60 bg-white/60 backdrop-blur-[10px] -mx-4 md:mx-0 p-4 md:p-8 rounded-2xl shadow-2xl border border-white/20">
        <div class="flex flex-col md:flex-row justify-between md:items-start mb-6">
            <div class="pr-2">
                <span class="bg-primary/20 text-primary px-3 py-1 rounded text-xs font-bold uppercase tracking-wider"
                    v-if="!isFinished">
                    {{ $t('home.banner.upcoming_race') }}
                </span>
                <span
                    class="bg-green-500/20 text-green-500 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider"
                    v-else>
                    Race Completed
                </span>
                <h3 class="text-xl md:text-3xl font-display font-bold mt-2">
                    {{ stage?.name }}
                </h3>
            </div>
            <div class="text-right" v-if="!isFinished">
                <span class="text-sm opacity-60">{{ $t('home.banner.starts_in') }}</span>
                <Countdown v-if="currentStageCategory?.start" :date="currentStageCategory.start" variant="compact" />
            </div>
        </div>
        <div class="grid grid-cols-3 gap-4 mb-8">
            <div class="text-center p-4 bg-slate-100 dark:bg-slate-700/50 text-gray-600 dark:text-white rounded-xl">
                <div class="font-bold">{{ distanceToKm(totalDistance) }}</div>
                <div class="text-xs uppercase opacity-60">{{ $t('home.banner.distance') }}</div>
            </div>
            <div class="text-center p-4 bg-slate-100 dark:bg-slate-700/50 text-gray-600 dark:text-white rounded-xl">
                <div class="font-bold">{{ totalElevation ? totalElevation.toLocaleString() + 'm' : '-' }}</div>
                <div class="text-xs uppercase opacity-60">{{ $t('home.banner.elevation') }}</div>
            </div>
            <div class="text-center p-4 bg-slate-100 dark:bg-slate-700/50 text-gray-600 dark:text-white rounded-xl">
                <div class="font-bold">{{ difficulty }}</div>
                <div class="text-xs uppercase opacity-60">{{ $t('home.banner.difficulty') }}</div>
            </div>
        </div>
        <template v-if="!isFinished">
            <NuxtLink as-child :to="$localePath({ name: 'races-slug-runner', params: { slug } })">
                <Button size="xl" class="w-full">{{ $t('home.banner.register_now') }}</Button>
            </NuxtLink>
            <p v-if="lastStageCategory?.end" class="text-center text-sm mt-4 opacity-60">
                {{ $t('home.banner.race_ends_in') }}
                {{ formatDate(lastStageCategory?.end) }}
            </p>
        </template>
        <template v-else>
            <NuxtLink as-child
                :to="$localePath({ name: 'races-slug-stage-stage_id-result', params: { slug, stage_id: stage?.id } })">
                <Button size="xl" class="w-full" modifier="outline">View Results</Button>
            </NuxtLink>
        </template>
    </div>
</template>