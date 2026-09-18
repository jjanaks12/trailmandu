<script setup lang="ts">
import { ClipboardListIcon, MapIcon, UsersIcon, HandHeartIcon, ImagePlayIcon, FlagIcon, SettingsIcon, InfoIcon, TicketIcon, DollarSignIcon, ShieldIcon, MailIcon } from 'lucide-vue-next'

const route = useRoute()
const eventId = computed(() => route.params.id)
</script>

<template>
    <div class="w-full md:w-64 flex-shrink-0 space-y-2">
        <h3 class="font-medium text-gray-500 uppercase text-xs mb-3 px-2">Event Links</h3>
        <NuxtLink :to="`/dashboard/events/${eventId}`" exact-active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <InfoIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Info</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/detail`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <ClipboardListIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Details</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/stages`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <MapIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Stages</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/runners`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <UsersIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Runners</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/email`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <MailIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Email Template</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/volunteers`"
            active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <HandHeartIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Volunteers</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/gallery`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <ImagePlayIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Galleries</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/sponsor`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <FlagIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Sponsors</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/season-pass`"
            active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <TicketIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Season Pass</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/pricing`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <DollarSignIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Pricing</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/legal`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <ShieldIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Legal & Policies</span>
        </NuxtLink>
        <NuxtLink :to="`/dashboard/events/${eventId}/settings`" active-class="bg-primary/5 text-primary border-primary"
            class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow hover:border-primary transition-all flex items-center gap-3">
            <SettingsIcon class="w-5 h-5 text-gray-500" />
            <span class="font-medium text-gray-700">Settings</span>
        </NuxtLink>
    </div>
</template>
