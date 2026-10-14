<script lang="ts" setup>
import { CalendarIcon, MapPinIcon, MountainIcon, ZapIcon, ChevronRightIcon, MapIcon, ActivityIcon, TrophyIcon, BookOpenIcon } from 'lucide-vue-next'
import { formatDate, getGPXFile, showImage } from '~/lib/filters'
import type { TrailRace, Stage, StageCategory } from '~/lib/types'
import { useEventStore } from '~/store/event'
import moment from 'moment-timezone'
import { Autoplay, Virtual } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { getFile } from '~/lib/filters/show_image'

const route = useRoute()
const { getBySlug } = useEventStore()
const { public: { serverUrl } } = useRuntimeConfig()

definePageMeta({
    transparentHeader: true
})

const selectedStage = ref<Stage | null>(null)
const selectedStageCategory = ref<StageCategory | null>(null)

import { useAuthStore } from '~/store/auth';

const authStore = useAuthStore()

const { data: trailRace } = await useAsyncData<TrailRace | null>(`trail-race-${route.params.slug}`, async () => {
    return await getBySlug(route.params.slug as string)
}, {
    getCachedData: (key, nuxtApp) => {
        if (authStore.isLoggedin) return undefined
        return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
    }
})
const isFinished = computed(() => moment().isAfter(moment(trailRace.value?.end as string)))
const isUpcoming = computed(() => moment().isBefore(moment(trailRace.value?.start as string)))

const isSelectedStageUpcoming = computed(() => {
    if (!selectedStage.value) return isUpcoming.value;
    return selectedStage.value.stage_categories.some(cat => moment(cat.end as string).isAfter(moment()));
})

const isNextOrCurrentRace = computed(() => {
    if (!selectedStage.value) return false;
    const upcoming = trailRace.value?.stages.filter(stage =>
        stage.stage_categories.some(cat => moment(cat.end as string).isAfter(moment()))
    ) || [];
    return upcoming.length > 0 && upcoming[0].id === selectedStage.value.id;
})

const totalDistance = computed(() => {
    // if (!trailRace.value?.stages) return 0
    return (trailRace.value?.stages?.reduce((acc, stage) => acc + stage.stage_categories.reduce((t, st) => t + parseFloat(st.distance), 0), 0) || 0) / 1000
})

// const totatDistanceSelectedStage = computed(() => selectedStage.value ? selectedStage.value?.stage_categories.reduce((acc, stage) => acc + parseFloat(stage.distance), 0) / 1000 : 0)

const parsedDetails = computed(() => {
    if (!trailRace.value?.details) return []
    try {
        let parsed = typeof trailRace.value.details === 'string'
            ? JSON.parse(trailRace.value.details)
            : trailRace.value.details
        if (Array.isArray(parsed)) return parsed
        if (parsed && Array.isArray(parsed.topics)) return parsed.topics
        return []
    } catch {
        return []
    }
})

const totalElevationGain = computed(() => {
    if (!trailRace.value?.stages) return "0"
    const sum = trailRace.value.stages.reduce((acc, stage) => {
        return acc + stage.stage_categories.reduce((t, st) => {
            const elev = (st as any).elevation || 0
            return t + (parseFloat(elev) || 0)
        }, 0)
    }, 0)
    return sum.toLocaleString('en-US')
})

if (trailRace.value && trailRace.value.stages.length > 0) {
    const nextUpcoming = trailRace.value.stages.find(stage =>
        stage.stage_categories.some(cat => moment(cat.end as string).isAfter(moment()))
    )
    let initialStage = nextUpcoming ?? trailRace.value.stages[0]
    if (route.query.stage_id) {
        const foundStage = trailRace.value.stages.find(s => s.id === route.query.stage_id)
        if (foundStage) initialStage = foundStage
    }
    selectedStage.value = initialStage ?? null
    selectedStageCategory.value = selectedStage.value?.stage_categories[0] ?? null
}

onMounted(() => {
    if (route.query.stage_id && trailRace.value?.stages?.length) {
        nextTick(() => {
            // Wait for Vue to render the selectedStage section
            setTimeout(() => {
                const el = document.getElementById('stage-details')
                if (el) {
                    const yOffset = -120 // Adjust for sticky header
                    const y = el.getBoundingClientRect().top + window.scrollY + yOffset
                    window.scrollTo({ top: y, behavior: 'smooth' })
                }
            }, 100)
        })
    }
})

useHead(() => {
    const race = trailRace.value
    if (!race) return { title: 'Loading Race...' }

    const logoUrl = '/images/logo.png'
    const currentTitle = `${race.name} | Trailmandu`
    const currentDescription = race.excerpt || 'Participate in premier skyrunning events, trail running marathons, and adventure runs organized by Trailmandu.'
    const canonical = `https://trailmandu.com/races/${race.slug}`
    const image = race.thumbnail?.file_name
        ? `${serverUrl}resources/images/${race.thumbnail.file_name}`
        : logoUrl

    return {
        title: currentTitle,
        link: [
            { rel: 'canonical', href: canonical }
        ],
        meta: [
            { name: 'description', content: currentDescription },
            { name: 'keywords', content: `${race.name}, trail running nepal, skyrunning race, marathon nepal, trailmandu event` },
            { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
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
                    '@type': 'SportsEvent',
                    '@id': `${canonical}#event`,
                    'name': race.name,
                    'description': currentDescription,
                    'image': image,
                    'startDate': race.start,
                    'endDate': race.end,
                    'location': {
                        '@type': 'Place',
                        'name': 'Nepal',
                        'address': {
                            '@type': 'PostalAddress',
                            'addressCountry': 'NP'
                        }
                    },
                    'organizer': {
                        '@type': 'SportsOrganization',
                        '@id': 'https://trailmandu.com/#organization',
                        'name': 'Trailmandu',
                        'logo': {
                            '@type': 'ImageObject',
                            'url': logoUrl
                        }
                    },
                    'subEvent': race.stages?.map(stage => ({
                        '@type': 'SportsEvent',
                        '@id': `https://trailmandu.com/races/${race.slug}?stage_id=${stage.id}#stage-${stage.id}`,
                        'name': stage.name,
                        'description': stage.excerpt || stage.description,
                        'startDate': stage.start || race.start,
                        'endDate': stage.end || race.end,
                        'location': {
                            '@type': 'Place',
                            'name': stage.location || 'Nepal',
                            'address': {
                                '@type': 'PostalAddress',
                                'addressCountry': 'NP'
                            }
                        }
                    })),
                    'offers': (() => {
                        const payments = race.stages?.flatMap(s => s.stage_categories || [])
                            .flatMap(c => c.payment || []) || []
                        const prices = payments.map(p => Number(p.amount)).filter(amt => !isNaN(amt) && amt > 0)
                        if (prices.length > 0) {
                            return {
                                '@type': 'AggregateOffer',
                                'priceCurrency': payments[0]?.type || 'NPR',
                                'lowPrice': Math.min(...prices).toString(),
                                'highPrice': Math.max(...prices).toString(),
                                'offerCount': prices.length,
                                'url': canonical,
                                'availability': 'https://schema.org/InStock'
                            }
                        }
                        return {
                            '@type': 'Offer',
                            'url': canonical,
                            'availability': 'https://schema.org/InStock',
                            'price': '0',
                            'priceCurrency': 'USD'
                        }
                    })()
                })
            } as any
        ]
    }
})

const selectedStageStartTime = computed(() => {
    if (!selectedStage.value) return ''
    if (!selectedStage.value.stage_categories?.length) return ''

    const earliestCat = [...selectedStage.value.stage_categories].sort((a, b) =>
        moment(a.start).diff(moment(b.start))
    )[0]

    return moment.tz(earliestCat.start, 'Asia/Kathmandu').format('MMM D, YYYY • hh:mm A')
})

const selectStage = (stage: Stage) => {
    selectedStage.value = stage
    selectedStageCategory.value = selectedStage.value?.stage_categories[0] ?? null
}

const { y } = useWindowScroll()
const isSticky = computed(() => y.value > 450)
</script>

<template>
    <div v-if="trailRace" class="bg-background-light dark:bg-background-dark min-h-screen">
        <!-- Sticky Header Bar -->
        <div class="fixed left-0 right-0 z-40 bg-white/95 dark:bg-deep-slate/95 border-b border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-md transition-all duration-300 top-20"
            :class="isSticky ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                <div class="flex items-center gap-4 min-w-0">
                    <Badge v-if="isUpcoming" size="sm"
                        class="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest font-black text-[10px]">
                        Upcoming
                    </Badge>
                    <Badge v-else-if="!isFinished" size="sm"
                        class="bg-red-500 text-white border-none uppercase tracking-widest font-black text-[10px] animate-pulse">
                        Going on
                    </Badge>
                    <Badge v-else size="sm"
                        class="bg-slate-500/50 text-white border-none uppercase tracking-widest font-black text-[10px]">
                        Completed
                    </Badge>
                    <h2 class="text-slate-900 dark:text-white font-display font-black text-lg sm:text-xl truncate">
                        {{ trailRace.name }}
                    </h2>
                </div>

                <div class="flex items-center gap-4 shrink-0">
                    <div
                        class="hidden md:flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <div class="flex items-center gap-1.5" v-if="!isFinished">
                            <CalendarIcon class="w-4 h-4 text-primary" />
                            <span>{{ formatDate(selectedStageCategory?.start ?? trailRace.start) }} — {{
                                formatDate(selectedStageCategory?.end ?? trailRace.end) }}</span>
                        </div>
                        <div class="flex items-center gap-1.5" v-if="selectedStage">
                            <MapPinIcon class="w-4 h-4 text-primary" />
                            <span>{{ selectedStage.location }}</span>
                        </div>
                    </div>

                    <Button size="sm" as-child v-if="isSelectedStageUpcoming">
                        <NuxtLink
                            :to="$localePath({ name: 'races-slug-runner', params: { slug: route.params.slug }, query: { stage_id: selectedStage?.id } })">
                            Register
                        </NuxtLink>
                    </Button>
                    <Button size="sm" as-child v-else>
                        <NuxtLink
                            :to="$localePath({ name: 'races-slug-stage-stage_id-result', params: { slug: trailRace.slug, stage_id: selectedStage?.id } })">
                            View Results
                        </NuxtLink>
                    </Button>
                </div>
            </div>
        </div>

        <!-- Hero Section -->
        <div class="relative w-full">
            <div class="flex h-screen relative overflow-hidden">
                <Swiper class="h-full" :modules="[Autoplay, Virtual]" loop
                    :autoplay="{ delay: 8000, disableOnInteraction: false }" virtual>
                    <SwiperSlide>
                        <img :src="trailRace.thumbnail ? showImage(trailRace.thumbnail.file_name) : ''" alt=""
                            class="w-full h-full object-cover">
                    </SwiperSlide>
                    <SwiperSlide v-for="image in trailRace?.gallery?.images" :key="image.id">
                        <img :src="showImage(image.file_name)" alt="" class="w-full h-full object-cover">
                    </SwiperSlide>
                </Swiper>
                <div
                    class="container flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 absolute z-10 bottom-16 left-1/2 -translate-x-1/2">
                    <Badge v-if="isUpcoming"
                        class="bg-primary/20 text-primary border-primary/30 px-4 py-1.5 uppercase tracking-widest font-black w-fit">
                        Upcoming Event
                    </Badge>
                    <Badge v-else-if="!isFinished"
                        class="bg-red-500 text-white border-none px-4 py-1.5 uppercase tracking-widest font-black w-fit animate-pulse">
                        Going on
                    </Badge>
                    <Badge v-else
                        class="bg-slate-500/50 text-white border-none px-4 py-1.5 uppercase tracking-widest font-black w-fit">
                        Completed
                    </Badge>

                    <h1 class="text-white text-5xl md:text-7xl font-display font-black leading-tight tracking-tight">
                        {{ trailRace.name }}
                    </h1>

                    <div
                        class="flex flex-wrap items-center gap-8 text-slate-300 font-bold uppercase tracking-widest text-sm">
                        <div class="flex items-center gap-2.5" v-if="!isFinished">
                            <CalendarIcon class="w-5 h-5 text-primary" />
                            <span>{{ formatDate(selectedStageCategory?.start ?? trailRace.start) }} — {{
                                formatDate(selectedStageCategory?.end ?? trailRace.end) }}</span>
                        </div>
                        <div class="flex items-center gap-2.5" v-if="selectedStage">
                            <MapPinIcon class="w-5 h-5 text-primary" />
                            <span>{{ selectedStage.location }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col lg:flex-row gap-16">
            <!-- Left Content -->
            <div class="flex-1 flex flex-col gap-16">
                <!-- Race Overview -->
                <section>
                    <div class="flex items-center gap-4 mb-10">
                        <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <MountainIcon class="w-6 h-6 text-primary" />
                        </div>
                        <h2 class="text-3xl text-gray-800 font-display font-black tracking-tight">Race Overview</h2>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                        <div
                            class="bg-white dark:bg-deep-slate p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-3 group hover:border-primary/50 transition-colors">
                            <span class="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total
                                Distance</span>
                            <div class="flex items-baseline gap-1">
                                <span
                                    class="text-4xl font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                    {{ totalDistance.toFixed(2) }}
                                </span>
                                <span class="text-sm font-bold text-slate-400 uppercase">KM</span>
                            </div>
                        </div>
                        <div
                            class="bg-white dark:bg-deep-slate p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-3 group hover:border-primary/50 transition-colors">
                            <span class="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                Vert Gain
                            </span>
                            <div class="flex items-baseline gap-1">
                                <span
                                    class="text-4xl font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                    {{ totalElevationGain }}
                                </span>
                                <span class="text-sm font-bold text-slate-400 uppercase">M</span>
                            </div>
                        </div>
                        <div
                            class="bg-white dark:bg-deep-slate p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-3">
                            <span
                                class="text-slate-400 text-[10px] font-black uppercase tracking-widest">Difficulty</span>
                            <div class="flex gap-1 pt-2">
                                <ZapIcon v-for="i in 4" :key="i" class="w-5 h-5 fill-primary text-primary" />
                                <ZapIcon class="w-5 h-5 text-slate-200 dark:text-slate-700" />
                            </div>
                        </div>
                    </div>

                    <div class="prose prose-slate dark:prose-invert max-w-none text-lg leading-relaxed text-slate-600 dark:text-slate-400 mb-12 [&_p]:mb-4"
                        v-html="trailRace.description" />
                </section>

                <!-- Detailed Stage View -->
                <section v-if="selectedStage" id="stage-details"
                    class="border-t border-slate-100 dark:border-slate-800 pt-16">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                        <div>
                            <div class="flex items-center gap-3 mb-2">
                                <span
                                    class="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Stage Details
                                </span>
                                <span class="text-slate-400 font-bold">{{ selectedStageStartTime }}</span>
                            </div>
                            <h3 class="text-4xl text-gray-800 font-display font-black tracking-tight">{{
                                selectedStage.name }}</h3>
                        </div>
                        <div class="flex flex-col items-end gap-3">
                            <div class="flex gap-3">
                                <Badge v-if="selectedStage.difficulty === 'difficult'"
                                    class="bg-red-500/10 text-red-500 border-none font-bold uppercase tracking-tighter">
                                    TECHNICAL
                                </Badge>
                                <Badge
                                    class="bg-primary/10 text-primary border-none font-bold uppercase tracking-tighter">
                                    HIGH ALTITUDE
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <!-- <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
                        <div
                            class="bg-slate-50 dark:bg-deep-slate/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Distance</p>
                            <p class="text-2xl font-black">
                                {{ totatDistanceSelectedStage }} KM
                            </p>
                        </div>
                        <div
                            class="bg-slate-50 dark:bg-deep-slate/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vert Gain
                            </p>
                            <p class="text-2xl font-black text-emerald-500 flex items-center gap-1">
                                <ArrowUpIcon class="w-4 h-4" /> 2,150 M
                            </p>
                        </div>
                        <div
                            class="bg-slate-50 dark:bg-deep-slate/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Elevation
                                Loss</p>
                            <p class="text-2xl font-black text-rose-500 flex items-center gap-1">
                                <ArrowDownIcon class="w-4 h-4" /> 1,890 M
                            </p>
                        </div>
                        <div
                            class="bg-slate-50 dark:bg-deep-slate/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Est. Time
                            </p>
                            <p class="text-2xl font-black flex items-center gap-2 text-primary">
                                <TimerIcon class="w-4 h-4" /> 4.5 - 7h
                            </p>
                        </div>
                    </div> -->

                    <!-- Stage Categories -->
                    <div class="border border-primary p-4 rounded-xl" v-if="selectedStage.stage_categories?.length > 0">
                        <div class="prose prose-slate dark:prose-invert max-w-none text-lg leading-relaxed text-slate-600 dark:text-slate-400 mb-12 [&_p]:mb-4"
                            v-html="selectedStage.description" />
                        <h4 class="text-xs font-black uppercase tracking-widest text-gray-800 mb-8">
                            Available Categories
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                            <div v-for="cat in selectedStage.stage_categories" :key="cat.id"
                                class="bg-white dark:bg-deep-slate rounded-3xl p-8 border-primary shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-1 transition-all duration-300"
                                @click="selectedStageCategory = cat"
                                :class="selectedStageCategory?.id === cat.id ? 'border-l-8' : ''">
                                <div class="flex justify-between items-start mb-6">
                                    <h5 class="font-black text-xl text-gray-800">{{ cat.name }}</h5>
                                    <TrophyIcon class="w-5 h-5 text-primary" />
                                </div>
                                <div class="space-y-4">
                                    <div class="flex justify-between text-sm font-bold">
                                        <span class="text-slate-400">Start Time</span>
                                        <span>{{ moment.tz(cat.start, 'Asia/Kathmandu').format('hh:mm A') }}</span>
                                    </div>
                                    <div class="flex justify-between text-sm font-bold">
                                        <span class="text-slate-400">Distance</span>
                                        <span>{{ (parseFloat(cat.distance) / 1000).toFixed(2) }} KM</span>
                                    </div>
                                    <div class="flex justify-between text-sm font-bold">
                                        <span class="text-slate-400">Elevation Gain</span>
                                        <span>{{ cat.elevation }} M</span>
                                    </div>
                                    <div class="pt-4">
                                        <div
                                            class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div class="bg-primary h-full" style="width: 100%"></div>
                                        </div>
                                        <p
                                            class="text-[10px] mt-2 font-black text-slate-400 uppercase tracking-tighter text-right">
                                            Limited Entries
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Map Section -->
                        <div v-if="selectedStageCategory?.map_file" class="mb-12">
                            <Dialog>
                                <DialogTrigger as-child>
                                    <div
                                        class="relative rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl aspect-video group cursor-pointer bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center transition-colors">

                                        <ClientOnly>
                                            <Map :gpx-file="getGPXFile(selectedStageCategory.map_file.file_name)"
                                                class="absolute inset-0 w-full h-full pointer-events-none" />
                                        </ClientOnly>

                                        <div
                                            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm z-10">
                                            <MapIcon
                                                class="w-12 h-12 mb-4 text-white opacity-90 scale-90 group-hover:scale-100 transition-transform duration-500" />
                                            <Button size="lg" variant="secondary"
                                                class="pointer-events-none font-bold shadow-xl">
                                                View Full Map
                                            </Button>
                                        </div>
                                    </div>
                                </DialogTrigger>
                                <DialogContent class="w-[80%] p-0 bg-transparent border-none shadow-none">
                                    <DialogTitle class="sr-only">Race Route Map</DialogTitle>
                                    <div
                                        class="w-full h-[80vh] rounded-[2.5rem] overflow-hidden bg-white dark:bg-slate-900 shadow-2xl relative">
                                        <ClientOnly>
                                            <Map :gpx-file="getGPXFile(selectedStageCategory.map_file.file_name)"
                                                show-elevation class="w-full h-full" />
                                        </ClientOnly>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <div class="prose prose-slate dark:prose-invert max-w-none text-lg leading-relaxed text-slate-600 dark:text-slate-400 mb-12 [&_p]:mb-4"
                            v-if="selectedStageCategory" v-html="selectedStageCategory.description" />
                        <template
                            v-if="selectedStageCategory?.checkpoints && selectedStageCategory?.checkpoints.length > 0">
                            <h3 class="text-gray-800 font-black text-xl mb-4">
                                Checkpoints
                            </h3>
                            <ul class="grid md:grid-cols-2 gap-4">
                                <li v-for="(item, index) in selectedStageCategory?.checkpoints" :key="item.id"
                                    class="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                                    <div>
                                        <span class="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                            {{ `CP ${index + 1}` }}
                                        </span>
                                        <h5 class="font-black text-lg">{{ item.name }}</h5>
                                    </div>
                                </li>
                            </ul>
                        </template>
                    </div>

                    <!-- Elevation Profile SVG Placeholder (adapted from design) -->
                    <!-- <div
                        class="bg-white dark:bg-deep-slate rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 elevation-grid relative overflow-hidden group">
                        <div class="flex items-center justify-between mb-12">
                            <div class="flex items-center gap-3">
                                <ActivityIcon class="w-5 h-5 text-primary" />
                                <h4 class="font-black text-xl">Elevation Profile</h4>
                            </div>
                            <div
                                class="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <div class="flex items-center gap-2">
                                    <span class="w-3 h-3 bg-primary rounded-full"></span> Ascent
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="w-3 h-3 bg-slate-200 dark:bg-slate-700 rounded-full"></span> Descent
                                </div>
                            </div>
                        </div>
                        <div class="h-64 relative flex items-end mb-4">
                            <svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                                <path
                                    d="M0,100 L100,80 L200,85 L300,40 L400,30 L500,60 L600,10 L700,25 L800,80 L900,90 L1000,100 Z"
                                    fill="rgba(240, 103, 35, 0.1)" stroke="#f06723" stroke-width="3"></path>
                                <circle cx="600" cy="10" fill="white" r="6" stroke="#f06723" stroke-width="3"
                                    class="animate-pulse"></circle>
                            </svg>
                            <div class="absolute left-[60%] -top-12 flex flex-col items-center">
                                <div
                                    class="bg-primary text-white px-4 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap shadow-lg">
                                    2,540M • KM 18.5
                                </div>
                                <div class="w-0.5 h-16 bg-primary/40 dashed-border"></div>
                            </div>
                        </div>
                        <div
                            class="flex justify-between text-[10px] font-black text-slate-400 px-2 uppercase tracking-widest">
                            <span>Start</span>
                            <span>10 KM</span>
                            <span>20 KM</span>
                            <span>30 KM</span>
                            <span>{{ selectedStage.distance }} KM</span>
                        </div>
                    </div> -->
                </section>
                <!-- Dynamic Topics (Details) -->
                <div v-if="parsedDetails.length > 0" class="mt-12 space-y-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div v-for="topic in parsedDetails" :key="topic.id">
                        <h4 class="font-black text-2xl text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                            <span class="w-8 h-1 bg-primary rounded-full"></span>
                            {{ topic.title }}
                        </h4>
                        <div class="prose prose-slate dark:prose-invert max-w-none text-lg leading-relaxed text-slate-600 dark:text-slate-400 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:dark:text-white"
                            v-html="topic.content" />
                    </div>
                </div>
            </div>

            <!-- Sidebar -->
            <aside class="w-full lg:w-96 shrink-0">
                <div class="sticky top-32 flex flex-col gap-8">
                    <!-- Stage Selector -->
                    <div
                        class="bg-white dark:bg-deep-slate p-4 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                        <h3 class="px-6 pt-6 pb-6 text-xs font-black uppercase tracking-widest text-gray-800">
                            Race Stages
                        </h3>
                        <nav class="flex flex-col gap-2">
                            <div class="flex items-center max-w-full justify-between rounded-lg p-4"
                                v-for="(stage, index) in trailRace.stages" :key="stage.id" @click="selectStage(stage)"
                                :class="{ 'bg-primary text-white': selectedStage?.id === stage.id }">
                                <div class="max-w-[90%] flex flex-col items-start shrink">
                                    <span :class="[
                                        'text-[10px] font-black uppercase tracking-widest mb-1 transition-colors',
                                        selectedStage?.id === stage.id ? 'text-white/80' : 'text-gray-800'
                                    ]">
                                        Stage {{ index + 1 }}
                                    </span>
                                    <span
                                        class="font-black text-lg whitespace-nowrap text-ellipsis inline-block overflow-hidden">
                                        {{ stage.name }}
                                    </span>
                                </div>
                                <ChevronRightIcon v-if="selectedStage?.id !== stage.id"
                                    class="w-5 h-5 transition-transform group-hover:translate-x-1 shrink-0" />
                                <ActivityIcon v-else class="w-6 h-6 animate-pulse shrink-0" />
                            </div>
                        </nav>
                    </div>
                    <!-- Guide Book Banner -->
                    <div v-if="selectedStage?.guide_book_file?.file_name"
                        class="bg-primary/5 rounded-[2.5rem] p-6 flex flex-col items-center text-center gap-4 border border-primary/20 relative overflow-hidden shadow-lg shadow-primary/5">
                        <div class="absolute -right-6 -top-6 text-primary/10">
                            <BookOpenIcon class="w-32 h-32" />
                        </div>
                        <div class="relative z-10 flex flex-col items-center w-full">
                            <BookOpenIcon class="w-8 h-8 text-primary mb-2" />
                            <h4 class="font-black text-xl text-primary uppercase tracking-widest mb-1">Guide Book</h4>
                            <p class="text-xs text-slate-600 dark:text-slate-400 font-bold mb-4 px-4">Everything you
                                need to know
                                about {{ selectedStage.name }}</p>
                            <Button as-child modifier="outline"
                                class="w-full bg-white dark:bg-deep-slate border-primary text-primary hover:bg-primary hover:text-white shadow-sm">
                                <a :href="getFile(selectedStage.guide_book_file.file_name, 'files')" target="_blank"
                                    download>
                                    Download
                                </a>
                            </Button>
                        </div>
                    </div>

                    <!-- Registration CTA -->
                    <div
                        class="bg-secondary/10 p-10 rounded-[2.5rem] relative overflow-hidden group shadow-2xl shadow-emerald-950/20">
                        <div
                            class="absolute -right-12 -bottom-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <MountainIcon class="w-64 h-64" />
                        </div>
                        <template v-if="isNextOrCurrentRace">
                            <h4 class="text-3xl text-gray-900 font-display font-black mb-4 relative z-10 leading-tight">
                                Ready to Conquer?
                            </h4>
                            <p class="mb-10 relative z-10 leading-relaxed font-medium">
                                Early bird registration is currently open. Secure your bib for the ultimate Himalayan
                                challenge.
                            </p>
                            <Button size="xl" as-child>
                                <NuxtLink
                                    :to="$localePath({ name: 'races-slug-runner', params: { slug: route.params.slug }, query: { stage_id: selectedStage?.id } })">
                                    Register Now
                                </NuxtLink>
                            </Button>
                        </template>
                        <template v-else-if="!isSelectedStageUpcoming">
                            <h4 class="text-3xl font-display font-black mb-4 relative z-10 leading-tight">Race Results
                            </h4>
                            <p class="mb-10 relative z-10 leading-relaxed font-medium">
                                Check the official timings, stage updates, and final standings for all categories.
                            </p>
                            <Button size="xl" as-child>
                                <NuxtLink
                                    :to="$localePath({ name: 'races-slug-stage-stage_id-result', params: { slug: trailRace.slug, stage_id: selectedStage?.id } })">
                                    View Results
                                </NuxtLink>
                            </Button>
                        </template>
                        <template v-else>
                            <h4 class="text-3xl text-gray-900 font-display font-black mb-4 relative z-10 leading-tight">
                                Planning Ahead?
                            </h4>
                            <p class="mb-10 relative z-10 leading-relaxed font-medium">
                                Individual registration for this stage is not open yet, but you can secure your spot for
                                all remaining stages with a Season Pass!
                            </p>
                            <Button size="xl" as-child>
                                <NuxtLink
                                    :to="$localePath({ name: 'races-slug-runner', params: { slug: route.params.slug } })">
                                    Get Season Pass
                                </NuxtLink>
                            </Button>
                        </template>
                    </div>

                    <!-- Organizers Info (Bonus) -->
                    <div class="px-8 py-4 flex items-center gap-4 text-slate-400 opacity-60">
                        <div class="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
                        <p class="text-[10px] font-bold uppercase tracking-widest">
                            Trailmandu Global Events <br />
                            Sanctioned Race {{ formatDate(trailRace.start, 'YYYY') }}
                        </p>
                    </div>
                </div>
            </aside>
        </main>

        <!-- Sponsors Section -->
        <section v-if="trailRace?.sponsors?.length"
            class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200 dark:border-slate-800">
            <div class="text-center mb-12">
                <h2 class="text-3xl text-gray-800 dark:text-white font-display font-black tracking-tight">
                    Our Sponsors
                </h2>
                <p class="text-slate-500 mt-2">Thanks to our amazing sponsors for making this event possible.</p>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
                <a v-for="sponsor in trailRace.sponsors" :key="sponsor.id" :href="sponsor.url" target="_blank"
                    rel="noopener noreferrer"
                    class="group flex flex-col items-center gap-4 transition-transform hover:-translate-y-1">
                    <div
                        class="relative w-40 h-24 sm:w-48 sm:h-28 p-6 bg-white dark:bg-deep-slate rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden group-hover:shadow-md group-hover:border-primary/30 transition-all">
                        <img v-if="sponsor.thumbnail" :src="showImage(sponsor.thumbnail.file_name)" :alt="sponsor.name"
                            class="max-w-full max-h-full object-contain filter dark:invert dark:opacity-70 dark:group-hover:opacity-100 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" />
                        <span v-else
                            class="text-lg font-bold text-slate-400 group-hover:text-primary transition-colors text-center">
                            {{ sponsor.name }}
                        </span>
                    </div>
                    <span
                        class="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">
                        {{ sponsor.sponsorType?.name }}
                    </span>
                </a>
            </div>
        </section>

    </div>
</template>

<style scoped>
.elevation-grid {
    background-image: linear-gradient(rgba(240, 103, 35, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(240, 103, 35, 0.05) 1px, transparent 1px);
    background-size: 40px 40px;
}

.dashed-border {
    background-image: linear-gradient(to bottom, #f06723 50%, transparent 50%);
    background-position: left;
    background-size: 2px 10px;
    background-repeat: repeat-y;
}
</style>