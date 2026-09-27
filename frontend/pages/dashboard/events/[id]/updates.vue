<script lang="ts" setup>
import { BellIcon, SendIcon, ChevronRightIcon } from 'lucide-vue-next'
import { useRaceUpdateStore } from '~/store/raceUpdate'
import { formatDate } from '~/lib/filters'
import { useEventStore } from '~/store/event'
import EventSidebar from '@/components/pages/dashboard/event/sidebar.vue'
import ClearCacheButton from '@/components/pages/dashboard/event/ClearCacheButton.vue'
import type { DateValue } from '@internationalized/date'

definePageMeta({
    layout: 'admin',
    middleware: 'auth',
    authorization: ['event_view']
})

const route = useRoute()
const eventId = computed(() => route.params.id as string)

const raceUpdateStore = useRaceUpdateStore()
const eventStore = useEventStore()

const message = ref('')
const stageId = ref('')
const postponeDates = ref(false)
const newStartDate = ref<DateValue>()
const newStartTime = ref('')
const newEndDate = ref<DateValue>()
const newEndTime = ref('')

onMounted(async () => {
    if (eventId.value) {
        await raceUpdateStore.fetch(eventId.value)
        if (!eventStore.currentRace || eventStore.currentRace.id !== eventId.value) {
            await eventStore.fetchCurrentRace() // we might need to get the specific event
            // actually eventStore has `get` method to fetch by id
            const event = await eventStore.get(eventId.value)
            if (event) eventStore.currentRace = event
        }
    }
})

const submitUpdate = async () => {
    if (!message.value.trim()) return

    const combinedStart = postponeDates.value && newStartDate.value && newStartTime.value 
        ? `${newStartDate.value.toString()}T${newStartTime.value}` 
        : undefined;
        
    const combinedEnd = postponeDates.value && newEndDate.value && newEndTime.value 
        ? `${newEndDate.value.toString()}T${newEndTime.value}` 
        : undefined;

    await raceUpdateStore.save({
        event_id: eventId.value,
        stage_id: stageId.value || undefined,
        message: message.value,
        new_start: combinedStart,
        new_end: combinedEnd
    })
    
    message.value = ''
    stageId.value = ''
    postponeDates.value = false
    newStartDate.value = undefined
    newStartTime.value = ''
    newEndDate.value = undefined
    newEndTime.value = ''
}
</script>

<template>
    <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <NuxtLink to="/dashboard/events" class="hover:text-primary transition-colors">Events</NuxtLink>
            <ChevronRightIcon class="w-4 h-4" />
            <NuxtLink :to="`/dashboard/events/${eventId}`" class="hover:text-primary transition-colors">{{
                eventStore.currentRace?.name || 'Loading...' }}</NuxtLink>
            <ChevronRightIcon class="w-4 h-4" />
            <span class="text-foreground font-semibold">Updates</span>
        </div>
        <ClearCacheButton :event-id="eventId" />
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
        <div class="flex-grow min-w-0">
            <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-primary/10 rounded-lg">
                        <BellIcon class="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 class="text-xl font-semibold">Race Updates</h2>
                        <p class="text-sm text-gray-500">Send important announcements to all registered runners for this event.</p>
                    </div>
                </div>

                <form @submit.prevent="submitUpdate" class="mb-8">
                    <div class="flex flex-col gap-4">
                        <div>
                            <label for="stage" class="block text-sm font-medium text-gray-700 mb-1">Target Stage (Optional)</label>
                            <select 
                                id="stage"
                                v-model="stageId"
                                class="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary focus:border-primary"
                            >
                                <option value="">All Stages (Entire Event)</option>
                                <option v-for="stage in eventStore.currentRace?.stages" :key="stage.id" :value="stage.id">
                                    {{ stage.name }}
                                </option>
                            </select>
                        </div>
                        <div>
                            <label for="message" class="block text-sm font-medium text-gray-700 mb-1">Update Message</label>
                            <textarea 
                                id="message"
                                v-model="message"
                                rows="4" 
                                placeholder="Enter the announcement..." 
                                class="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary focus:border-primary"
                                required
                            ></textarea>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="postpone" v-model="postponeDates" class="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4" />
                            <label for="postpone" class="text-sm font-medium text-gray-700 cursor-pointer">Also reschedule date and time for this event/stage</label>
                        </div>
                        
                        <div v-if="postponeDates" class="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <div class="flex flex-col gap-2">
                                <label class="block text-sm font-medium text-gray-700">New Start Date & Time</label>
                                <div class="flex gap-2">
                                    <div class="flex-grow">
                                        <DatePicker v-model="newStartDate" />
                                    </div>
                                    <input type="time" v-model="newStartTime" class="w-32 border border-gray-300 rounded-lg p-2 focus:ring-primary focus:border-primary" />
                                </div>
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="block text-sm font-medium text-gray-700">New End Date & Time</label>
                                <div class="flex gap-2">
                                    <div class="flex-grow">
                                        <DatePicker v-model="newEndDate" />
                                    </div>
                                    <input type="time" v-model="newEndTime" class="w-32 border border-gray-300 rounded-lg p-2 focus:ring-primary focus:border-primary" />
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-end mt-2">
                            <Button type="submit" :disabled="raceUpdateStore.isLoading || !message.trim()">
                                <SendIcon class="w-4 h-4 mr-2" />
                                Send Update
                            </Button>
                        </div>
                    </div>
                </form>

                <div>
                    <h3 class="text-lg font-semibold mb-4">Previous Updates</h3>
                    <div v-if="raceUpdateStore.isLoading && !raceUpdateStore.updates.length" class="text-center py-4 text-gray-500">
                        Loading...
                    </div>
                    <div v-else-if="!raceUpdateStore.updates.length" class="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                        No updates have been posted yet.
                    </div>
                    <div v-else class="space-y-4">
                        <div v-for="update in raceUpdateStore.updates" :key="update.id" class="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-sm font-medium text-gray-700">
                                    <template v-if="update.stage_id">Stage: {{ eventStore.currentRace?.stages?.find(s => s.id === update.stage_id)?.name }}</template>
                                    <template v-else>Entire Event</template>
                                </span>
                                <span class="text-xs text-gray-500">{{ formatDate(update.created_at) }}</span>
                            </div>
                            <p class="text-gray-800 whitespace-pre-wrap">{{ update.message }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="w-full lg:w-64 shrink-0">
            <EventSidebar />
        </div>
    </div>
</template>
