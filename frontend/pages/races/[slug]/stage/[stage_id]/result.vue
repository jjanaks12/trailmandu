<script lang="ts" setup>
import { formatDate, showImage } from '~/lib/filters'
import type { EventRunner, Stage, StageCategory, VolunteerCheckpoint } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { useAppStore } from '~/store/app'

// import KVRLogo from '~/assets/images/kvr-summit-logo.png'
import trailmanduLogo from '~/assets/images/logo.png'
import { LoaderIcon, XIcon, ArrowLeftIcon, DownloadIcon } from 'lucide-vue-next'
import { getDuration, sortRunner } from '~/lib/filters/runner'

definePageMeta({
    layout: 'simple'
})

const { genders } = storeToRefs(useAppStore())
const { axios } = useAxios()
const route = useRoute()

const runners = ref<EventRunner[]>([])
const selectGender = ref<string>('')
const selectStage = ref<StageCategory | null>(null)
const isLoading = ref(false)
const searchText = ref('')

const updatedRunners = computed(() => sortRunner(runners.value))
const filteredRunners = computed(() => updatedRunners.value
    .filter(runner => runner.runner_attendances.length > 0)
    .filter((runner) =>
        (runner.personal.first_name || '').toLowerCase().includes(searchText.value.toLowerCase())
        || (runner.personal.last_name || '').toLowerCase().includes(searchText.value.toLowerCase())
        || runner.bib.toString().includes(searchText.value))
)

const { data: stageCategoryList } = await useAsyncData<StageCategory[]>('stage-category', () => axios.get(`/events/${route.params.stage_id as string}/stage_categories`).then(res => res.data))

const { data: stage } = await useAsyncData<Stage>('stage', () => axios.get(`/events/stages/${route.params.stage_id as string}`).then(res => res.data))

const config = useRuntimeConfig()

useHead(() => {
    if (!stage.value) return { title: 'Loading Results...' }

    const currentTitle = `${stage.value.name} Results - Trailmandu`
    const currentDescription = stage.value.description || `View race results for ${stage.value.name} organized by Trailmandu.`
    const canonical = `https://trailmandu.com/races/${route.params.slug}/stage/${route.params.stage_id}/result`
    const image = stage.value.thumbnail?.file_name
        ? config.public.serverUrl + 'resources/images/' + stage.value.thumbnail.file_name
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
                    '@type': 'SportsEvent',
                    '@id': `https://trailmandu.com/races/${route.params.id}#event`,
                    'name': stage.value.name,
                    'description': currentDescription,
                    'image': image,
                    'startDate': stage.value.start || undefined,
                    'endDate': stage.value.end || undefined,
                    'organizer': {
                        '@type': 'SportsOrganization',
                        '@id': 'https://trailmandu.com/#organization',
                        'name': 'Trailmandu',
                        'url': 'https://trailmandu.com'
                    },
                    'recordedIn': {
                        '@type': 'PropertyValue',
                        'name': 'Race Results',
                        'value': `Results for stage: ${stage.value.name}`
                    }
                })
            } as any
        ]
    }
})

const getFinalDuration = (volunteerCheckpoints: VolunteerCheckpoint[]) => {
    const a = volunteerCheckpoints.find(volunteerCheckpoint => volunteerCheckpoint.checkpoint.is_end)

    if (!a) return ''
    return getDuration(a.timer, selectStage.value?.start as string)
}

const fetchRunnerResult = async () => {
    if (selectStage.value && stage.value) {
        const { data } = await axios.get(`/events/${stage.value.event_id}/${route.params.stage_id as string}/results`, {
            params: {
                gender: selectGender.value ? selectGender.value : undefined,
                stage_category: selectStage.value?.id
            }
        })
        runners.value = data
    }
}

const downloadCSV = () => {
    const headers = ['Family Name', 'First Name', 'Gender', 'Birthdate', 'Nationality', 'ITRA ID', 'Bib number', 'Time']

    const rows = filteredRunners.value.map(runner => {
        const p = runner.personal
        return [
            p?.last_name || '',
            p?.first_name || '',
            p?.gender?.name?.charAt(0) || '',
            p?.date_of_birth ? formatDate(p.date_of_birth, 'YYYY-MM-DD') : '',
            p?.country?.abbr || p?.country?.code || p?.country?.name || '',
            p?.itra_id || '',
            runner.bib || '',
            runner.volunteer_on_checkpoints ? getFinalDuration(runner.volunteer_on_checkpoints) : ''
        ]
    })

    const csvContent = [
        headers.join(','),
        ...rows.map(e => e.map(field => `"${field}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)

    const nameParts = [stage.value?.name || 'results']
    if (selectStage.value) nameParts.push(selectStage.value.name)
    if (selectGender.value) {
        const gender = genders.value.find(g => g.id === selectGender.value)
        if (gender) nameParts.push(gender.name)
    }

    link.setAttribute("download", `${nameParts.join('-')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

watch([selectGender, selectStage], fetchRunnerResult)

onMounted(fetchRunnerResult)
</script>

<template>
    <section class="result__section bg-black bg-repeat text-white pb-12 w-full min-h-screen relative z-[1]">
        <header class="pt-12 pb-20 relative">
            <Button as-child modifier="outline" variant="light" class="absolute top-4 left-4">
                <NuxtLink :to="$localePath({ name: 'races-slug', params: { slug: route.params.slug as string } })">
                    <ArrowLeftIcon class="w-4 h-4" />
                    Back to Race
                </NuxtLink>
            </Button>
            <strong class="block block--left [--block-bg:var(--color-yellow-400)] [--block-color:var(--color-black)]"
                v-if="stage">
                {{ stage?.name }}
            </strong>
            <strong
                class="block block--left [--block-bg:var(--color-blue-400)] [--block-color:var(--color-white)] translate-y-full"
                v-if="selectStage">
                {{ selectStage?.name }}
            </strong>
            <time :datetime="selectStage?.start"
                class="block block--right text-lg [--block-bg:var(--color-yellow-400)] [--block-color:var(--color-black)]"
                v-if="selectStage">
                {{ formatDate(selectStage?.start as string, 'MMM D, YYYY') }}
            </time>
            <!-- <span
                class="font-bold block block--right translate-y-full  [--block-bg:var(--color-blue-400)] [--block-color:var(--color-white)]">#KVRSUMMITCHALLENGE</span> -->
            <div class="container space-y-3">
                <h1 class="text-4xl uppercase font-bold text-center" v-if="stage?.event">{{ stage.event.name }}</h1>
                <h1 class="text-4xl uppercase font-bold text-center" v-else>{{ stage?.name }}</h1>
                <!-- <div class="logo w-[280px] mx-auto">
                    <img :src="KVRLogo" alt="Kathmandu's ultimate five summit challenge">
                </div> -->
                <div class="flex items-center justify-center gap-4 mb-4">
                    <LoaderIcon class="animate-spin" v-show="isLoading" />
                    <Input v-model="searchText" placeholder="Search" />
                    <Select v-model="selectStage">
                        <SelectTrigger>
                            Distance:
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="stageCategory in stageCategoryList" :key="stageCategory.id"
                                :value="stageCategory">{{ stageCategory.name }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="selectGender">
                        <SelectTrigger>
                            Gender:
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="gender in genders" :value="gender.id">{{ gender.name }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button @click="selectGender = ''" modifier="link" size="sm" v-if="selectGender">
                        <XIcon />
                    </Button>
                    <Button @click="downloadCSV" variant="secondary" class="flex items-center gap-2"
                        v-if="filteredRunners.length > 0">
                        <DownloadIcon class="w-4 h-4" />
                        Download CSV
                    </Button>
                </div>
            </div>
        </header>
        <div class="container overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Family Name</TableHead>
                        <TableHead>First Name</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Birthdate</TableHead>
                        <TableHead>Nationality</TableHead>
                        <TableHead>ITRA ID</TableHead>
                        <TableHead>Bib number</TableHead>
                        <TableHead>Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody class="data-body">
                    <TableRow v-for="runner in filteredRunners" :key="runner.id" class="data-row">
                        <TableCell>{{ runner.personal?.last_name || '-' }}</TableCell>
                        <TableCell>{{ runner.personal?.first_name || '-' }}</TableCell>
                        <TableCell>{{ runner.personal?.gender?.name?.charAt(0) || '-' }}</TableCell>
                        <TableCell>{{ runner.personal?.date_of_birth ? formatDate(runner.personal.date_of_birth,
                            'YYYY-MM-DD') : '-' }}</TableCell>
                        <TableCell>{{ runner.personal?.country?.abbr || runner.personal?.country?.code ||
                            runner.personal?.country?.name || '-' }}</TableCell>
                        <TableCell>{{ runner.personal?.itra_id || '-' }}</TableCell>
                        <TableCell>{{ runner.bib || '-' }}</TableCell>
                        <TableCell>{{ runner.volunteer_on_checkpoints ?
                            getFinalDuration(runner.volunteer_on_checkpoints) : '-' }}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
        <footer class="text-center py-12">
            <div class="w-[200px] mx-auto">
                <img :src="trailmanduLogo" alt="Trailmandu Nepal">
            </div>
        </footer>
    </section>
</template>

<style scoped>
@font-face {
    font-family: 'rockwell_extra_boldregular';
    src: url('/fonts/rockwell_extra_bold_regular.woff2') format('woff2'),
        url('/fonts/rockwell_extra_bold_regular.woff') format('woff');
    font-weight: normal;
    font-style: normal;
}

.result__section {
    background: url('@/assets/images/result-bg.png');

    h1 {
        color: #000;
        font: 32px/1.1 'rockwell_extra_boldregular', sans-serif;
        margin-bottom: 90px;

        @media screen and (min-width: 768px) {
            font-size: 39px;
        }
    }

    header {
        background: url('@/assets/images/result-top-bg.png') repeat-x;
        background-size: auto 280px;

        @media screen and (min-width: 768px) {
            background-size: auto 160px;
        }

        .container {
            padding-bottom: 40px;

            @media screen and (min-width: 768px) {
                padding-bottom: 0;
            }
        }
    }
}

.logo {
    position: relative;

    &::before,
    &::after {
        width: 249px;
        height: 119px;
        position: absolute;
        top: 50%;

        @media screen and (min-width: 768px) {
            content: '';
        }
    }

    &::before {
        background: url('@/assets/images/result-cloud.png');
        right: 100%;
        transform: translateY(-50%) rotateY(180deg);
    }

    &::after {
        background: url('@/assets/images/result-cloud.png');
        left: 100%;
        transform: translateY(-50%);
    }
}

.block {
    background: var(--block-bg);
    color: var(--block-color);
    font-weight: 700;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    min-height: 40px;
    position: absolute;
    bottom: 0;
    transform: translateY(-100%);

    @media screen and (min-width: 768px) {
        font-size: 16px;
    }

    @media screen and (min-width: 1440px) {
        top: 50%;
        bottom: auto;
        transform: translateY(-50%);
    }

    &::after {
        content: '';
        width: 0;
        height: 0;
        position: absolute;
        top: 0;
    }
}

.block--left {
    left: 0;

    &:after {
        left: 100%;
        border-style: solid;
        border-width: 40px 0 0 15px;
        border-color: transparent transparent transparent var(--block-bg);
    }
}

.block--right {
    right: 0;

    &:after {
        right: 100%;
        border-style: solid;
        border-width: 40px 15px 0 0;
        border-color: transparent var(--block-bg) transparent;
    }
}

.data-body {
    counter-reset: row;
}

.data-row {
    counter-increment: row;
}

.data-count::after {
    content: counter(row);
}
</style>