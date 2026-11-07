<script lang="ts" setup>
import moment from 'moment'
import { paymentStatus, type EventRunner, type PaymentStatus, type Stage, type PaymentType, paymentMethods, type Gender } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { useRoute, useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import { CommandIcon, DownloadIcon, LoaderIcon, MailIcon, PlusIcon } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'
import RunnerItem from './RunnerItem.vue'
import { showPaymentImage } from '~/lib/filters'
import { toast } from 'vue-sonner'
import bibCard from './bibCard.vue'
import { useAppStore } from '~/store/app'
import { sortRunner } from '~/lib/filters/runner'
import { useStageStore } from '~/store/stage.js'

interface RunnerListProps {
    eventId: string
}

const { fetch: fetchStages } = useStageStore()
const emit = defineEmits(['update'])
const { axios } = useAxios()
const route = useRoute()
const router = useRouter()
const props = defineProps<RunnerListProps>()
let interval: NodeJS.Timeout

const isLoading = ref(false)
const runnerDetailDialog = ref(false)
const printDialog = ref(false)
const runnerPaymentDialog = ref(false)
const showRunnerEdit = ref(false)
const isMassEmailLoading = ref(false)
const massEmailDialog = ref(false)

const runners = ref<EventRunner[]>([])
const stageID = useRouteQuery<string | null>('stage_id', null)
const paymentStatusOpt = ref<PaymentStatus | null>(null)
const paymentTypeOpt = ref<PaymentType | null>(null)
const genderOpt = ref<Gender | null>(null)
const briefingStatusOpt = ref<'briefed' | 'not_briefed' | null>(null)
const lunchOpt = ref<'with_lunch' | 'without_lunch' | null>(null)
const searchText = shallowRef('')
const stageCategoryID = ref<string | null>(null)

const isLunchAddon = (name?: string) => {
    if (!name) return false
    const lower = name.toLowerCase()
    return lower.includes('lunch') || lower.includes('meal') || lower.includes('food') || lower.includes('dal bhat') || lower.includes('khana')
}

const hasRunnerLunch = (runner: EventRunner | null) => {
    if (!runner) return false
    return Boolean(runner.want_lunch || runner.addons?.some(a => isLunchAddon(a.addon?.name)))
}

const selectedRunner = ref<EventRunner | null>(null)
const appStore = useAppStore()
const { genders, countries, company } = storeToRefs(appStore)

const addRunnerDialog = ref(false)
const isAddingRunner = ref(false)

const newRunner = reactive({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    date_of_birth: '',
    stage_id: '',
    stage_category_id: '',
    gender_id: '',
    country_id: '',
    phone_number: '9800000000',
})

const sortedCountries = computed(() => {
    if (!countries.value || !countries.value.length) return []
    return [...countries.value].sort((a, b) => {
        const isANepal = a.name?.toLowerCase() === 'nepal' || a.abbr?.toLowerCase() === 'np'
        const isBNepal = b.name?.toLowerCase() === 'nepal' || b.abbr?.toLowerCase() === 'np'
        if (isANepal && !isBNepal) return -1
        if (!isANepal && isBNepal) return 1
        return (a.name || '').localeCompare(b.name || '')
    })
})

const isNationalRunner = computed(() => {
    if (!newRunner.country_id) return true
    const selected = countries.value.find((c) => c.id === newRunner.country_id)
    if (!selected) return true
    if (company.value?.address?.country_id) {
        return newRunner.country_id === company.value.address.country_id
    }
    return selected.name?.toLowerCase() === 'nepal' || selected.abbr?.toLowerCase() === 'np'
})

const modalCategoryList = computed(() => {
    const sId = newRunner.stage_id || stageID.value
    if (!sId) return []
    return stages.value.find((s) => s.id === sId)?.stage_categories || []
})

watch(() => newRunner.stage_id, (newStageId) => {
    if (!newStageId) return
    const categories = stages.value.find((s) => s.id === newStageId)?.stage_categories || []
    if (!categories.some((c) => c.id === newRunner.stage_category_id)) {
        newRunner.stage_category_id = categories[0]?.id || ''
    }
})

const openAddRunner = async () => {
    if (!genders.value.length) await appStore.fetchGender()
    if (!countries.value.length) await appStore.fetchCountries()

    const currentStageId = stageID.value || stages.value[0]?.id || ''
    const currentCategories = stages.value.find((s) => s.id === currentStageId)?.stage_categories || []
    const defaultCatId = stageCategoryID.value || currentCategories[0]?.id || ''
    const defaultGender = genders.value?.find((g) => g.name?.toLowerCase() === 'male') || genders.value?.[0]
    const defaultCountry = sortedCountries.value.find(
        (c) => c.name?.toLowerCase() === 'nepal' || c.abbr?.toLowerCase() === 'np'
    ) || sortedCountries.value[0]

    newRunner.first_name = ''
    newRunner.middle_name = ''
    newRunner.last_name = ''
    newRunner.email = ''
    newRunner.date_of_birth = ''
    newRunner.stage_id = currentStageId
    newRunner.stage_category_id = defaultCatId
    newRunner.gender_id = defaultGender?.id || ''
    newRunner.country_id = defaultCountry?.id || ''
    newRunner.phone_number = '9800000000'

    addRunnerDialog.value = true
}

const submitAddRunner = async () => {
    if (!newRunner.first_name.trim()) {
        toast.error('First name is required')
        return
    }
    if (!newRunner.last_name.trim()) {
        toast.error('Last name is required')
        return
    }
    if (!newRunner.email.trim()) {
        toast.error('Email is required')
        return
    }
    if (!newRunner.date_of_birth) {
        toast.error('Date of birth is required')
        return
    }

    const targetStageId = newRunner.stage_id || stageID.value || stages.value[0]?.id
    const targetCategoryId = newRunner.stage_category_id || stageCategoryID.value || modalCategoryList.value[0]?.id

    if (!targetStageId) {
        toast.error('Please select a stage')
        return
    }
    if (!targetCategoryId) {
        toast.error('Please select a stage category')
        return
    }

    if (!countries.value.length) {
        await appStore.fetchCountries()
    }
    const defaultCountry = sortedCountries.value.find(
        (c) => c.name?.toLowerCase() === 'nepal' || c.abbr?.toLowerCase() === 'np'
    ) || sortedCountries.value[0]

    const targetCountryId = newRunner.country_id || defaultCountry?.id
    if (!targetCountryId) {
        toast.error('Please select a country')
        return
    }

    if (!genders.value.length) {
        await appStore.fetchGender()
    }
    const defaultGender = genders.value?.find((g) => g.name?.toLowerCase() === 'male') || genders.value?.[0]
    const targetGender = newRunner.gender_id || defaultGender?.id
    if (!targetGender) {
        toast.error('Gender is required. Please select a gender.')
        return
    }

    isAddingRunner.value = true
    try {
        const eventId = (route.params.id as string) || props.eventId
        const fullName = [newRunner.first_name, newRunner.middle_name, newRunner.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()

        const payload = {
            stage_id: targetStageId,
            stage_category_id: targetCategoryId,
            first_name: newRunner.first_name.trim(),
            middle_name: newRunner.middle_name?.trim() || null,
            last_name: newRunner.last_name.trim(),
            email: newRunner.email.trim().toLowerCase(),
            phone_number: newRunner.phone_number?.trim() || '9800000000',
            date_of_birth: newRunner.date_of_birth,
            country_id: targetCountryId,
            gender_id: targetGender,
            payment_type: isNationalRunner.value ? 'NATIONAL' : 'INTERNATIONAL',
            payment_method: 'PAY_AT_VENUE',
            description: {
                club_name: '',
                emergency_contact_name: fullName,
                emergency_contact_phone: newRunner.phone_number?.trim() || '9800000000',
                want_lunch: false
            },
            liabilities: true,
            policies: true
        }

        await axios.post(`/events/${eventId}/runner/register`, payload)
        toast.success(`Runner ${fullName} added successfully!`)
        addRunnerDialog.value = false
        emit('update')
        await fetch()
    } catch (error: any) {
        const errorMsg = error.response?.data?.error?.errors?.[0]
            || error.response?.data?.error?.message
            || error.response?.data?.message
            || 'Failed to register runner'
        toast.error(errorMsg)
    } finally {
        isAddingRunner.value = false
    }
}

const { stages } = storeToRefs(useStageStore())
const updatedRunners = computed(() => sortRunner(runners.value))
// const hasStartedRace = computed(() => stages.value.filter(stage => stage.stage_categories).filter(category => moment.utc(category.start).isAfter(moment.utc())))

onKeyStroke(['command', '/'], () => {
    nextTick(() => {
        (document.querySelector('.search-input') as HTMLInputElement)?.focus()
    })
})

const stageCategoryList = computed(() => {
    if (!stageID.value) return []
    return stages.value.find((stage) => stage.id === stageID.value)?.stage_categories || []
})

const fetch = async () => {
    const event_id = route.params.id
    if (event_id && stageID.value) {
        isLoading.value = true
        const stage_id = stageID.value
        const { data } = await axios.get(`/events/${event_id}/${stage_id}/runners`, {
            params: {
                s: searchText.value,
                payment_status: paymentStatusOpt.value,
                stage_category: stageCategoryID.value,
                payment_method: paymentTypeOpt.value,
                gender: genderOpt.value?.id,
                lunch: lunchOpt.value,
                briefing_sent: briefingStatusOpt.value === 'briefed' ? 'true' : (briefingStatusOpt.value === 'not_briefed' ? 'false' : undefined),
                email_sent: briefingStatusOpt.value === 'briefed' ? 'true' : (briefingStatusOpt.value === 'not_briefed' ? 'false' : undefined),
                show_all: true
            }
        })
        runners.value = data
        isLoading.value = false

        if (route.query.runner_id) {
            nextTick(() => {
                const el = document.getElementById(`runner-${route.query.runner_id}`)
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

                    // Remove runner_id after a few seconds so it doesn't auto-scroll on next interval refresh
                    setTimeout(() => {
                        const query = { ...route.query }
                        delete query.runner_id
                        router.replace({ query })
                    }, 3000)
                }
            })
        }
    }
}

const updatePaymentStatus = async (status: string, id: string) => {
    await axios.put(`/events/${route.params.id}/payments/${id}`, {
        status
    })
    fetch()
}

const reset = () => {
    searchText.value = ''
    paymentStatusOpt.value = null
    stageCategoryID.value = null
    paymentTypeOpt.value = null
    genderOpt.value = null
    briefingStatusOpt.value = null
    lunchOpt.value = null
    runners.value = []
    fetch()
}

const sendEventBriefing = async () => {
    isMassEmailLoading.value = true
    try {
        const payload = {
            runnerIds: runners.value.map(r => r.id),
        }
        const { data } = await axios.post(`/events/${route.params.id}/runners/mass-email`, payload)
        toast.success(data.message || 'Mass briefing email queued successfully!')
        massEmailDialog.value = false
        fetch()
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Failed to queue emails')
    } finally {
        isMassEmailLoading.value = false
    }
}

const downloadCSV = async () => {
    if (runners.value.length === 0) {
        toast.error("No runners to download")
        return
    }

    let CSVContent = "data:text/csv;charset=utf-8,"

    CSVContent += "Name,BIB,email,phone,gender,age,category,stage,country,emergency contact,emergency contact no,want lunch,addons,paid,shirt size\n"

    runners.value.forEach((runner) => {
        const age = moment().diff(runner.personal.date_of_birth, 'years')
        const lunchStatus = hasRunnerLunch(runner) ? 'Yes' : 'No'
        const addonsList = runner.addons?.map((a: any) => a.addon?.name).filter(Boolean).join('; ') || ''
        CSVContent += `"${[runner.personal.first_name, runner.personal.middle_name, runner.personal.last_name].filter(Boolean).join(" ")}",${runner.bib},${runner.personal.email},${runner.personal.phone_number},${runner.personal.gender.name},${age},"${runner?.stage_category?.name ?? ''}","${runner?.stage?.name ?? ''}","${runner?.personal?.country?.name ?? ''}","${runner?.emergency_contact_name}","${runner?.emergency_contact_no}",${lunchStatus},"${addonsList}",${runner.payments[0]?.status ?? ''},${runner?.tshirt_size?.name ?? ''},\n`
    })

    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(CSVContent))
    link.setAttribute('download', 'runners.csv')
    link.click()
}

watch([paymentStatusOpt, stageID, stageCategoryID, paymentTypeOpt, genderOpt, briefingStatusOpt, lunchOpt], fetch, { immediate: true })
watchDebounced(searchText, fetch, { debounce: 1000 })

onMounted(async () => {
    await fetchStages(props.eventId)
    if (!stageID.value && stages.value.length > 0) {
        stageID.value = stages.value[0].id
    }
    if (!genders.value.length) {
        appStore.fetchGender()
    }
    if (!countries.value.length) {
        appStore.fetchCountries()
    }
    interval = setInterval(() => {
        fetch()
    }, 15000)
})
onUnmounted(() => {
    clearInterval(interval)
})
</script>

<template>
    <div class="flex gap-4 items-start max-w-full relative">
        <div class="grow max-w-[calc(100%-284px)]">
            <div
                class="bg-gray-100 space-y-6 mb-12 border border-dashed border-gray-400 p-3 rounded-xl sticky top-[83px] z-10">
                <h2 class="text-xl text-gray-400">Filters:</h2>
                <div class="space-y-3">
                    <div class="flex items-center gap-3">
                        <Select v-model="stageID" :disabled="isLoading">
                            <SelectTrigger class="w-[160px]" size="sm">
                                Stage:
                                <SelectValue placeholder="" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="stage in stages" :value="stage.id">{{ stage.name }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select v-model="stageCategoryID" :disabled="isLoading">
                            <SelectTrigger class="w-[160px]" size="sm">
                                Category:
                                <SelectValue placeholder="" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="category in stageCategoryList" :value="category.id">
                                    {{ category.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" modifier="link" @click="stageCategoryID = null"
                            v-if="stageCategoryID">X</Button>
                        <Select v-model="paymentStatusOpt" :disabled="isLoading">
                            <SelectTrigger class="w-[160px]" size="sm">
                                Payment:
                                <SelectValue placeholder="" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="status in paymentStatus" :value="status">{{ status }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" modifier="link" @click="paymentStatusOpt = null"
                            v-if="paymentStatusOpt">X</Button>
                        <Select v-model="paymentTypeOpt" :disabled="isLoading">
                            <SelectTrigger class="w-[160px]" size="sm">
                                Payment Type:
                                <SelectValue placeholder="" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="type in paymentMethods" :value="type">{{ type }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" modifier="link" @click="paymentTypeOpt = null"
                            v-if="paymentTypeOpt">X</Button>
                        <Select v-model="genderOpt" :disabled="isLoading">
                            <SelectTrigger class="w-[160px]" size="sm">
                                Gender:
                                <SelectValue placeholder="" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="gender in genders" :value="gender">{{ gender.name }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" modifier="link" @click="genderOpt = null" v-if="genderOpt">X</Button>
                        <Select v-model="briefingStatusOpt" :disabled="isLoading">
                            <SelectTrigger class="w-[160px]" size="sm">
                                Briefing:
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="null">All</SelectItem>
                                <SelectItem value="briefed">Briefed</SelectItem>
                                <SelectItem value="not_briefed">Not Briefed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" modifier="link" @click="briefingStatusOpt = null"
                            v-if="briefingStatusOpt">X</Button>
                        <Select v-model="lunchOpt" :disabled="isLoading">
                            <SelectTrigger class="w-[140px]" size="sm">
                                Lunch:
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="null">All</SelectItem>
                                <SelectItem value="with_lunch">With Lunch</SelectItem>
                                <SelectItem value="without_lunch">No Lunch</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" modifier="link" @click="lunchOpt = null" v-if="lunchOpt">X</Button>
                    </div>
                    <InputGroup size="sm">
                        <InputGroupInput class="search-input" v-model="searchText" placeholder="Search by name or bib"
                            :disabled="isLoading" />
                        <InputGroupAddon align="inline-end" class="text-gray-300">
                            <CommandIcon /> + /
                        </InputGroupAddon>
                    </InputGroup>
                    <div class="flex justify-end gap-2 sticky top-[83px]" v-if="stageID">
                        <LoaderIcon class="animate-spin" v-if="isLoading" />
                        <Button variant="default" class="rounded-full" @click="openAddRunner">
                            <PlusIcon class="w-4 h-4 mr-1" />
                            Add Runner
                        </Button>
                        <Button variant="secondary" class="rounded-full" @click="massEmailDialog = true">
                            <MailIcon class="w-4 h-4 mr-2" />
                            Send event briefing
                        </Button>
                        <Button variant="secondary" class="rounded-full" @click="downloadCSV">
                            <DownloadIcon />
                            Download CSV
                        </Button>
                        <Button variant="destructive" class="rounded-full" @click="printDialog = true">
                            <DownloadIcon />
                            Download BIB PDF
                        </Button>
                        <Button variant="secondary" size="sm" modifier="link" @click="fetch">reload</Button>
                        <Button size="sm" modifier="link" @click="reset" :disabled="isLoading">reset all</Button>
                    </div>
                </div>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lunch</TableHead>
                        <TableHead class="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <RunnerItem v-for="(runner, index) in updatedRunners" :runner="runner" :id="`runner-${runner.id}`"
                        :class="{ 'bg-yellow-100 dark:bg-yellow-900/30': route.query.runner_id === runner.id }"
                        @show:runner="runnerDetailDialog = true; selectedRunner = runner"
                        @show:payment="runnerPaymentDialog = true; selectedRunner = runner"
                        @updated:payment="updatePaymentStatus" @fetch="fetch"
                        :rank="runner.volunteer_on_checkpoints.length > 0 ? index + 1 : 0"
                        @edit="showRunnerEdit = true; selectedRunner = runner" :hasEventStarted="true"
                        :selected-stage="stageID" />
                    <TableRow v-if="runners.length === 0">
                        <TableCell colspan="5">
                            <span class="text-center block p-3 text-gray-500 bg-accent rounded">
                                No runners found
                            </span>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
        <PagesDashboardEventRunnerStats :runners="runners" class="sticky top-[83px] z-40" />
    </div>
    <Dialog :open="runnerPaymentDialog" @update:open="selectedRunner = null; runnerPaymentDialog = false">
        <DialogContent class="max-h-[600px] overflow-y-auto">
            <DialogHeader>
                <DialogTitle class="text-lg">Payment</DialogTitle>
                <DialogDescription class="text-base">
                    Payment details for
                    <strong>
                        {{ selectedRunner?.personal.first_name }}
                        {{ selectedRunner?.personal.middle_name }}
                        {{ selectedRunner?.personal.last_name }}
                    </strong>
                </DialogDescription>
            </DialogHeader>
            <div class="space-y-4 divide-y divide-gray-200 text-sm">
                <div v-for="payment in selectedRunner?.payments" class="space-y-2 pb-4">
                    <div class="flex justify-between">
                        <span>Payment Type</span>
                        <span>{{ payment.method }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Payment Status</span>
                        <span>{{ payment.status }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Payment Amount</span>
                        <span>{{ payment.amount }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Payment Date</span>
                        <span>
                            {{ moment(payment.created_at).fromNow() }}
                        </span>
                    </div>
                    <figure class="text-xs border p-1 rounded-sm" v-if="payment?.screenshot">
                        <figcaption>Screenshot of payment</figcaption>
                        <img :src="showPaymentImage(payment?.screenshot?.file_name as string)">
                    </figure>
                </div>
                <span class="text-center block p-3 text-gray-500 bg-accent rounded"
                    v-if="selectedRunner?.payments.length === 0">
                    No payments information found for
                    <strong>{{ selectedRunner?.personal.first_name }}</strong>
                </span>
            </div>
        </DialogContent>
    </Dialog>
    <Dialog :open="runnerDetailDialog" @update:open="selectedRunner = null; runnerDetailDialog = false">
        <DialogContent class="max-h-[700px] overflow-y-auto">
            <DialogHeader>
                <DialogTitle class="text-lg">Runner Details</DialogTitle>
                <DialogDescription class="text-base">
                    Runner details for
                    <strong>
                        {{ selectedRunner?.personal.first_name }}
                        {{ selectedRunner?.personal.middle_name }}
                        {{ selectedRunner?.personal.last_name }}
                    </strong>
                </DialogDescription>
            </DialogHeader>
            <div class="space-y-6">
                <strong class="text-gray-300 uppercase tracking-widest font-medium">Personal Information</strong>
                <div class="divide-y divide-gray-200 text-sm [&_div]:py-2">
                    <div class="flex justify-between">
                        <strong>Bib</strong>
                        <span>{{ selectedRunner?.bib }}</span>
                    </div>
                    <div class="flex justify-between" v-if="selectedRunner?.personal.itra_id">
                        <strong>ITRA ID</strong>
                        <span>{{ selectedRunner?.personal.itra_id }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Name</strong>
                        <span>
                            {{ selectedRunner?.personal.first_name }}
                            {{ selectedRunner?.personal.middle_name }}
                            {{ selectedRunner?.personal.last_name }}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Gender</strong>
                        <span>{{ selectedRunner?.personal.gender.name }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Age</strong>
                        <span>{{ moment().diff(moment(selectedRunner?.personal.date_of_birth), 'years') }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Country</strong>
                        <span>{{ selectedRunner?.personal.country.name }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Phone number</strong>
                        <span>{{ selectedRunner?.personal.phone_number }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Email</strong>
                        <span>{{ selectedRunner?.personal.email }}</span>
                    </div>
                    <div class="flex justify-between" v-if="selectedRunner?.personal?.size">
                        <strong>T-shirt size</strong>
                        <span>{{ selectedRunner?.personal?.size?.name }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Stage category</strong>
                        <span>{{ selectedRunner?.stage_category?.name }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Emergency contact</strong>
                        <span>{{ selectedRunner?.emergency_contact_name }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Emergency contact</strong>
                        <span>{{ selectedRunner?.emergency_contact_no }}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <strong>Lunch</strong>
                        <Badge :variant="hasRunnerLunch(selectedRunner) ? 'success' : 'destructive'">
                            {{ hasRunnerLunch(selectedRunner) ? 'Yes' : 'No' }}
                        </Badge>
                    </div>
                    <div class="flex justify-between" v-if="selectedRunner?.addons && selectedRunner.addons.length > 0">
                        <strong>Add-ons</strong>
                        <div class="text-right space-y-1">
                            <span v-for="addon in selectedRunner.addons" :key="addon.id" class="block">
                                {{ addon.addon?.name }} <em class="text-xs text-gray-500 not-italic"
                                    v-if="addon.amount_paid">(Rs. {{ addon.amount_paid }})</em>
                            </span>
                        </div>
                    </div>
                </div>
                <strong class="text-gray-300 uppercase tracking-widest font-medium">Payment Information</strong>
                <div class="divide-y divide-gray-200 text-sm [&_div]:py-2">
                    <div class="flex justify-between">
                        <strong>Method</strong>
                        <span>{{ selectedRunner?.payments[0]?.method }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Status</strong>
                        <span>{{ selectedRunner?.payments[0]?.status }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Amount</strong>
                        <span>{{ selectedRunner?.payments[0]?.amount }}</span>
                    </div>
                    <div class="flex justify-between">
                        <strong>Date</strong>
                        <span>
                            {{ moment(selectedRunner?.payments[0]?.created_at).fromNow() }}
                        </span>
                    </div>
                    <figure class="text-xs border p-1 rounded-sm" v-if="selectedRunner?.payments[0]?.screenshot">
                        <figcaption>Screenshot of payment</figcaption>
                        <img :src="showPaymentImage(selectedRunner?.payments[0]?.screenshot?.file_name as string)">
                    </figure>
                </div>
            </div>
        </DialogContent>
    </Dialog>
    <ClientOnly>
        <bibCard v-model:show="printDialog" :stageID="stageID" :runners="runners" />
    </ClientOnly>
    <Dialog :open="showRunnerEdit" @update:open="showRunnerEdit = false; selectedRunner = null">
        <DialogContent class="sm:max-w-[900px]">
            <DialogHeader>
                <DialogTitle>Edit {{ selectedRunner?.personal.first_name }}</DialogTitle>
                <DialogDescription>You can change runners detail from here.</DialogDescription>
            </DialogHeader>
            <PagesDashboardEventRunnerForm :runner="selectedRunner" :stageList="stages"
                @updated="fetch(); showRunnerEdit = false; selectedRunner = null" />
        </DialogContent>
    </Dialog>
    <Dialog :open="massEmailDialog" @update:open="massEmailDialog = false">
        <DialogContent class="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>Send Event Briefing</DialogTitle>
                <DialogDescription>
                    You are about to send an email to <strong>{{ runners.length }}</strong> runners matching the current
                    filter.
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="bg-gray-50 border p-3 rounded-lg text-sm text-gray-700">
                    <p class="font-medium mb-2">Active Filters:</p>
                    <ul class="list-disc pl-5 space-y-1">
                        <li v-if="stageID">Stage: {{stages.find(s => s.id === stageID)?.name}}</li>
                        <li v-if="stageCategoryID">Category: {{stageCategoryList.find(c => c.id ===
                            stageCategoryID)?.name}}</li>
                        <li v-if="paymentStatusOpt">Payment Status: {{ paymentStatusOpt }}</li>
                        <li v-if="paymentTypeOpt">Payment Type: {{ paymentTypeOpt }}</li>
                        <li v-if="genderOpt">Gender: {{ genderOpt.name }}</li>
                        <li v-if="briefingStatusOpt">
                            Briefing:
                            {{ briefingStatusOpt === 'briefed' ? 'Briefed' : 'Not Briefed' }}
                        </li>
                        <li v-if="searchText">Search: "{{ searchText }}"</li>
                        <li
                            v-if="!stageID && !stageCategoryID && !paymentStatusOpt && !paymentTypeOpt && !genderOpt && !briefingStatusOpt && !searchText">
                            No specific filters applied. Sending to all runners in this view.</li>
                    </ul>
                </div>

                <div class="max-h-[200px] overflow-y-auto border rounded-lg p-3">
                    <p class="font-medium text-sm text-gray-700 mb-2">Runners List:</p>
                    <div class="flex flex-wrap gap-2">
                        <span v-for="runner in runners" :key="runner.id"
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {{ runner.personal.first_name }} {{ runner.personal.last_name }}
                        </span>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button modifier="outline" @click="massEmailDialog = false">Cancel</Button>
                <Button @click="sendEventBriefing" :disabled="isMassEmailLoading || runners.length === 0">
                    <LoaderIcon v-if="isMassEmailLoading" class="animate-spin w-4 h-4 mr-2" />
                    Confirm & Send
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <Dialog :open="addRunnerDialog" @update:open="addRunnerDialog = false">
        <DialogContent class="sm:max-w-[650px]">
            <DialogHeader>
                <DialogTitle class="text-lg">Add New Runner</DialogTitle>
                <DialogDescription>
                    Quickly add a runner with basic information. Other required fields are automatically populated with
                    default values.
                </DialogDescription>
            </DialogHeader>

            <form @submit.prevent="submitAddRunner" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="space-y-1">
                        <Label for="quick_first_name">First Name <span class="text-red-500">*</span></Label>
                        <Input id="quick_first_name" v-model="newRunner.first_name" placeholder="First name" required
                            :disabled="isAddingRunner" />
                    </div>
                    <div class="space-y-1">
                        <Label for="quick_middle_name">Middle Name</Label>
                        <Input id="quick_middle_name" v-model="newRunner.middle_name" placeholder="Middle name"
                            :disabled="isAddingRunner" />
                    </div>
                    <div class="space-y-1">
                        <Label for="quick_last_name">Last Name <span class="text-red-500">*</span></Label>
                        <Input id="quick_last_name" v-model="newRunner.last_name" placeholder="Last name" required
                            :disabled="isAddingRunner" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="space-y-1">
                        <Label for="quick_email">Email <span class="text-red-500">*</span></Label>
                        <Input id="quick_email" type="email" v-model="newRunner.email" placeholder="runner@example.com"
                            required :disabled="isAddingRunner" />
                    </div>
                    <div class="space-y-1">
                        <Label for="quick_dob">Date of Birth <span class="text-red-500">*</span></Label>
                        <Input id="quick_dob" type="date" v-model="newRunner.date_of_birth" required
                            :disabled="isAddingRunner" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3" v-if="stages.length > 1">
                    <div class="space-y-1">
                        <Label>Stage</Label>
                        <Select v-model="newRunner.stage_id" :disabled="isAddingRunner">
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="Select Stage" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="stage in stages" :key="stage.id" :value="stage.id">
                                    {{ stage.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-1">
                        <Label>Category</Label>
                        <Select v-model="newRunner.stage_category_id" :disabled="isAddingRunner">
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="Select Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="category in modalCategoryList" :key="category.id"
                                    :value="category.id">
                                    {{ category.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div class="space-y-1" v-else>
                    <Label>Category</Label>
                    <Select v-model="newRunner.stage_category_id" :disabled="isAddingRunner">
                        <SelectTrigger class="w-full">
                            <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="category in modalCategoryList" :key="category.id" :value="category.id">
                                {{ category.name }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="space-y-1">
                        <Label>Country</Label>
                        <Select v-model="newRunner.country_id" :disabled="isAddingRunner">
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="Select Country" />
                            </SelectTrigger>
                            <SelectContent class="max-h-[250px] overflow-y-auto">
                                <SelectItem v-for="country in sortedCountries" :key="country.id" :value="country.id">
                                    <span v-if="country.abbr"
                                        :class="['fi', 'fi-' + country.abbr.toLowerCase(), 'mr-2']" />
                                    {{ country.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-1">
                        <Label>Gender</Label>
                        <Select v-model="newRunner.gender_id" :disabled="isAddingRunner">
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="Select Gender" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="gender in genders" :key="gender.id" :value="gender.id">
                                    {{ gender.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-1">
                        <Label for="quick_phone">Phone Number</Label>
                        <Input id="quick_phone" type="tel" v-model="newRunner.phone_number" placeholder="9800000000"
                            :disabled="isAddingRunner" />
                    </div>
                </div>

                <div class="bg-gray-50 border rounded-lg p-3 text-xs text-gray-500 space-y-1">
                    <p class="font-medium text-gray-700">Pre-set Defaults:</p>
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span>• Payment Method: Pay At Venue</span>
                        <span>• Payment Type: {{ isNationalRunner ? 'National' : 'International' }}</span>
                        <span>• Lunch: No</span>
                        <span>• Emergency Contact: Runner Name</span>
                        <span>• Policy & Liabilities: Accepted</span>
                    </div>
                </div>

                <DialogFooter class="gap-2 sm:gap-0 pt-2">
                    <Button type="button" modifier="outline" @click="addRunnerDialog = false"
                        :disabled="isAddingRunner">
                        Cancel
                    </Button>
                    <Button type="submit" :disabled="isAddingRunner">
                        <LoaderIcon v-if="isAddingRunner" class="animate-spin w-4 h-4 mr-2" />
                        <PlusIcon v-else class="w-4 h-4 mr-1" />
                        Add Runner
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>