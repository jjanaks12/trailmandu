<script lang="ts" setup>
import type { TrailRace } from '~/lib/types'
import { useEventStore } from '~/store/event'

const route = useRoute()
const config = useRuntimeConfig()
const { getBySlug } = useEventStore()

import { useAuthStore } from '~/store/auth';

const authStore = useAuthStore()

const { data: trailRace, pending: isPending } = await useAsyncData<TrailRace | null>(`trail-race-volunteer-${route.params.slug}`, async () => {
    return await getBySlug(route.params.slug as string)
}, {
    getCachedData: (key, nuxtApp) => {
        if (authStore.isLoggedin) return undefined
        return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
    }
})

onBeforeMount(async () => {
    trailRace.value = await getBySlug(route.params.slug as string)
})

useHead(() => {
    if (!trailRace.value) return { title: 'Volunteer - Trailmandu' }

    const currentTitle = `Volunteer for ${trailRace.value.name} - Volunteer Form | Trailmandu`
    const currentDescription = trailRace.value.excerpt || `Register as a volunteer for ${trailRace.value.name}. Help support this premier trail race organized by Trailmandu.`
    const canonical = `https://trailmandu.com/races/${trailRace.value.slug}/volunteer`
    const image = trailRace.value.thumbnail?.file_name
        ? config.public.serverUrl + 'resources/images/' + trailRace.value.thumbnail.file_name
        : 'https://trailmandu.com/logo.png'

    return {
        title: currentTitle,
        link: [
            { rel: 'canonical', href: canonical }
        ],
        meta: [
            { name: 'description', content: currentDescription },
            { name: 'robots', content: 'index, follow' },
            // Open Graph
            { property: 'og:title', content: currentTitle },
            { property: 'og:description', content: currentDescription },
            { property: 'og:image', content: image },
            { property: 'og:url', content: canonical },
            { property: 'og:type', content: 'website' },
            // Twitter
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: currentTitle },
            { name: 'twitter:description', content: currentDescription },
            { name: 'twitter:image', content: image }
        ],
        script: [
            {
                type: 'application/ld+json',
                innerHTML: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'RegisterAction',
                    'name': `Volunteer for ${trailRace.value.name}`,
                    'description': currentDescription,
                    'target': {
                        '@type': 'EntryPoint',
                        'urlTemplate': canonical,
                        'inLanguage': 'en-US',
                        'actionPlatform': [
                            'http://schema.org/DesktopWebPlatform',
                            'http://schema.org/MobileWebPlatform'
                        ]
                    },
                    'object': {
                        '@type': 'SportsEvent',
                        '@id': `https://trailmandu.com/races/${trailRace.value.slug}#event`,
                        'name': trailRace.value.name,
                        'url': `https://trailmandu.com/races/${trailRace.value.slug}`
                    }
                })
            } as any
        ]
    }
})

</script>

<template>
    <section v-if="!isPending && trailRace" class="min-h-screen w-full">
        <ClientOnly>
            <PagesDefaultRacesRegistrationForm :event-id="trailRace.id" :trail-race="trailRace" mode="volunteer" />
        </ClientOnly>
    </section>
    <div v-else class="h-screen w-screen overflow-hidden flex flex-col md:flex-row relative bg-gray-50">
        <div class="hidden md:flex flex-col w-1/2 h-full relative">
            <Skeleton class="w-full h-full rounded-none" />
        </div>
        <div class="w-full md:w-1/2 h-full p-6 md:py-16 overflow-y-auto flex flex-col items-center">
            <div class="w-full max-w-2xl">
                <div class="flex justify-between items-start mb-10">
                    <div class="space-y-4">
                        <Skeleton class="h-10 w-48" />
                        <Skeleton class="h-4 w-64" />
                    </div>
                    <Skeleton class="hidden md:block h-8 w-20" />
                </div>
                <div class="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                    <div class="space-y-4">
                        <Skeleton class="h-8 w-32" />
                        <Skeleton class="h-4 w-64" />
                    </div>
                    <Skeleton class="h-12 w-full" />
                    <div class="flex justify-end pt-2">
                        <Skeleton class="h-10 w-32" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>