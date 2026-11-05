<script lang="ts" setup>
import { RefreshCwIcon, CalendarCheckIcon, ClockIcon, UserIcon, ArrowRightIcon } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useAxios } from '~/services/axios'
import { formatDate } from '~/lib/filters'
import type { EventRunner } from '~/lib/types'
import { useEventStore } from '~/store/event'

const { axios } = useAxios()
const eventStore = useEventStore()
const { currentRace, currentStage } = storeToRefs(eventStore)

const registrations = ref<EventRunner[]>([])
const isLoading = ref(false)

const runnersUrl = computed(() => {
    if (currentRace.value?.id) {
        if (currentStage.value?.id) {
            return `/dashboard/events/${currentRace.value.id}/runners?stage_id=${currentStage.value.id}`
        }
        return `/dashboard/events/${currentRace.value.id}/runners`
    }
    const firstWithStage = registrations.value.find(r => (r.stage?.event?.id || r.event?.id) && r.stage_id)
    if (firstWithStage) {
        const eventId = firstWithStage.stage?.event?.id || firstWithStage.event?.id
        return `/dashboard/events/${eventId}/runners?stage_id=${firstWithStage.stage_id}`
    }
    const firstRunner = registrations.value.find(r => r.stage?.event?.id || r.event?.id)
    if (firstRunner) {
        const eventId = firstRunner.stage?.event?.id || firstRunner.event?.id
        return `/dashboard/events/${eventId}/runners`
    }
    return '/dashboard/events'
})

const statusVariant = (status: any) => {
    switch (status?.status) {
        case 'ACTIVE': return 'default'
        case 'DID_NOT_FINISH': return 'secondary'
        case 'DISQUALIFIED': return 'destructive'
        default: return 'secondary'
    }
}

const statusLabel = (status: any) => {
    if (!status?.status) return 'Pending'
    return status.status.charAt(0) + status.status.slice(1).toLowerCase().replace(/_/g, ' ')
}

const fetchRegistrations = async () => {
    isLoading.value = true
    try {
        const res = await axios.get('/runners/recent', { params: { per_page: 5 } })
        registrations.value = res.data?.data ?? res.data ?? []
    } catch (err) {
        console.error('Failed to fetch recent registrations', err)
    } finally {
        isLoading.value = false
    }
}

onMounted(async () => {
    fetchRegistrations()
    try {
        await eventStore.fetchCurrentRace()
    } catch (err) {
        console.error('Failed to fetch current race', err)
    }
})
</script>

<template>
    <Card class="w-full">
        <CardHeader class="flex flex-row items-center justify-between pb-3">
            <div class="flex items-center gap-2">
                <CalendarCheckIcon class="w-5 h-5 text-primary" />
                <CardTitle class="text-base font-semibold">Recent Registrations</CardTitle>
            </div>
            <div class="flex items-center gap-2">
                <Button modifier="link" size="sm" @click="fetchRegistrations" :disabled="isLoading"
                    class="text-muted-foreground hover:text-foreground">
                    <RefreshCwIcon class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
                </Button>
                <NuxtLink :to="runnersUrl">
                    <Button modifier="link" size="sm" class="text-xs text-muted-foreground hover:text-primary gap-1"
                        :title="currentStage?.name ? `View ${currentStage.name} runners` : 'View runners'">
                        View all
                        <ArrowRightIcon class="w-3 h-3" />
                    </Button>
                </NuxtLink>
            </div>
        </CardHeader>
        <CardContent class="p-0">
            <!-- Loading skeleton -->
            <div v-if="isLoading" class="divide-y">
                <div v-for="i in 4" :key="i" class="flex items-center gap-3 px-6 py-4 animate-pulse">
                    <div class="h-8 w-8 rounded-full bg-muted shrink-0"></div>
                    <div class="flex-1 space-y-1.5">
                        <div class="h-3.5 bg-muted rounded w-1/2"></div>
                        <div class="h-3 bg-muted rounded w-1/3"></div>
                    </div>
                    <div class="h-5 bg-muted rounded w-16"></div>
                </div>
            </div>

            <!-- Empty state -->
            <div v-else-if="registrations.length === 0"
                class="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <CalendarCheckIcon class="w-8 h-8 opacity-30" />
                <p class="text-sm">No recent registrations</p>
            </div>

            <!-- Registration list -->
            <div v-else class="divide-y">
                <NuxtLink v-for="runner in registrations" :key="runner.id"
                    :to="`/dashboard/events/${runner.stage?.event?.id || runner.event?.id}/runners?stage_id=${runner.stage_id}&runner_id=${runner.id}`"
                    class="flex items-center gap-3 px-6 py-4 hover:bg-muted/50 transition-colors group">

                    <!-- Avatar / Icon -->
                    <div
                        class="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <UserIcon class="w-4 h-4 text-primary" />
                    </div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {{ runner.personal?.first_name }} {{ runner.personal?.last_name }}
                        </p>
                        <div class="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <span class="truncate">{{ runner.season_pass ? 'Season Pass' : (runner.stage?.name || 'Event Registration') }}</span>
                            <span class="shrink-0">·</span>
                            <ClockIcon class="w-3 h-3 shrink-0" />
                            <span class="shrink-0">{{ formatDate(runner.created_at) }}</span>
                        </div>
                    </div>

                    <!-- Status Badge -->
                    <Badge :variant="statusVariant(runner.status)" class="shrink-0 text-xs capitalize">
                        {{ statusLabel(runner.status) }}
                    </Badge>

                    <!-- Arrow icon for link -->
                    <ArrowRightIcon class="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />

                </NuxtLink>
            </div>
        </CardContent>
    </Card>
</template>
