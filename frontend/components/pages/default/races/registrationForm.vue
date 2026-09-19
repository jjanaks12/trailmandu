<script setup lang="ts">
import { ref, computed } from "vue"
import { Form, Field, ErrorMessage, type FormContext } from "vee-validate"
import { parseDate } from "@internationalized/date"
import { storeToRefs } from "pinia"
import type { SubmissionHandler } from "vee-validate"
import { User, Mail, Phone, Calendar, Users, Flag, Target, Loader2, XIcon, InfoIcon, LoaderIcon, ShirtIcon, MountainIcon, ArrowLeft } from "lucide-vue-next"
import * as Y from 'yup'

import DatePicker from "@/components/DatePicker.vue"
import { useAppStore } from "~/store/app"
import { trailRaceRunner, trailRaceVolunteer } from "~/lib/schema/event.schema"
import type { Personal, StageCategoryPayment, TrailRace } from "~/lib/types"
import { useEventStore } from "~/store/event"
import moment from "moment"
import { showImage, showPaymentImage } from '~/lib/filters'
import { useAxios } from "~/services/axios"

interface RegistrationFormProps {
    eventId: string
    mode: "volunteer" | "runner"
    trailRace: TrailRace
}

const props = defineProps<RegistrationFormProps>()
const { countries, genders, company, shirtSizes } = storeToRefs(useAppStore())
const { saveVoluteer, saveRunner } = useEventStore()
const route = useRoute()
const { axios } = useAxios()
const pastRecord = ref<Personal | null>(null)

const hasEnteredEmail = ref(false)
const form = ref<FormContext<any> | null>(null)
const isLoading = ref(false)
const isLoadingCheckEmail = ref(false)
const showThankyouDialog = ref(false)
const showLiabilitiesDialog = ref(false)
const showPoliciesDialog = ref(false)
const formStageId = computed(() => form.value?.values?.stage_id || null)
const formStageCategoryId = computed(() => form.value?.values?.stage_category_id || null)
const formIsSeasonPass = computed(() => !!form.value?.values?.is_season_pass)

// getting list of available stages
const upcomingStages = computed(() => props.trailRace.stages
    .map(stage => stage.stage_categories
        .filter(stage_category => moment(stage_category.end as string).isAfter(moment())).length > 0 ? stage : null)
    .filter(stage => stage !== null))

const stageList = computed(() => {
    if (!upcomingStages.value.length) return []
    return form.value?.values?.is_season_pass ? upcomingStages.value : [upcomingStages.value[0]]
})
// getting stage categories of selected stage
const availabeStageCategoryList = computed(() => {
    if (form.value?.values.is_season_pass) {
        return stageList.value[0]?.stage_categories
    }
    return stageList.value.find(stage => stage.id === form.value?.values.stage_id)?.stage_categories
})
const selectedAddons = ref<string[]>([])

const toggleAddon = (addonId: string, checked: boolean) => {
    if (checked) {
        if (!selectedAddons.value.includes(addonId)) selectedAddons.value.push(addonId)
    } else {
        selectedAddons.value = selectedAddons.value.filter(id => id !== addonId)
    }
}

const availableTiers = computed(() => {
    const stageId = formStageId.value
    const tiers = props.trailRace.pricing_tiers || []

    // helper to check if tier is active today
    const isActive = (tier: any) => {
        if (!tier.is_time_based) return true
        if (!tier.start_date || !tier.end_date) return false
        const now = moment()
        return moment(tier.start_date).isSameOrBefore(now) && moment(tier.end_date).isSameOrAfter(now)
    }

    if (stageId) {
        // try to find active stage-specific tiers
        const stageTiers = tiers.filter(t => t.stage_id === stageId && isActive(t))
        if (stageTiers.length > 0) return stageTiers
    }

    // fallback to default tiers
    const defaultTiers = tiers.filter(t => !t.stage_id && isActive(t))
    if (defaultTiers.length > 0) return defaultTiers

    return []
})

const selectedTierId = ref<string | null>(null)

const activeTier = computed(() => {
    if (selectedTierId.value) {
        return availableTiers.value.find(t => String(t.id) === String(selectedTierId.value)) || null
    }
    // Auto-select first if none selected
    return availableTiers.value[0] || null
})

watch(() => availableTiers.value, (tiers) => {
    if (tiers && tiers.length > 0 && !tiers.find(t => String(t.id) === String(selectedTierId.value))) {
        selectedTierId.value = String(tiers[0].id)
        form.value?.setFieldValue('pricing_tier_id', tiers[0].id)
    }
}, { immediate: true })

watch(selectedTierId, (newId) => {
    if (newId) {
        form.value?.setFieldValue('pricing_tier_id', String(newId))
    }
})

watch(() => form.value?.values.country_id, (newCountryId) => {
    if (form.value) {
        const type = newCountryId == company.value?.address.country_id ? 'NATIONAL' : 'INTERNATIONAL'
        form.value.setFieldValue('payment_type', type)
    }
})

const applicableAddons = computed(() => {
    const addons = props.trailRace.addons || []
    const stageId = formStageId.value

    if (formIsSeasonPass.value) {
        return addons.filter(a => a.apply_to_all)
    }

    if (!stageId) return []

    return addons.filter(addon => {
        if (addon.apply_to_all) return true
        if (addon.stages && addon.stages.some(s => String(s.id) === String(stageId))) return true
        return false
    })
})

const addonsTotal = computed(() => {
    console.log(applicableAddons.value)
    return applicableAddons.value.reduce((total, addon) => {
        if (addon.is_mandatory || selectedAddons.value.includes(addon.id)) {
            return total + Number(addon.price)
        }
        return total
    }, 0)
})

const payment = computed(() => {
    const type = form.value?.values.country_id == company.value?.address.country_id ? 'NATIONAL' : 'INTERNATIONAL'

    let screenshot = null
    let description = null

    if (formIsSeasonPass.value && form.value?.values.season_pass_id) {
        const seasonPass = props.trailRace.season_passes?.find(sp => sp.id === form.value?.values.season_pass_id)
        if (seasonPass) {
            const spPayment = seasonPass.payments?.find(p => p.type === type)
            if (spPayment) {
                return {
                    amount: String(Number(spPayment.amount)),
                    type: spPayment.type,
                    description: spPayment.description,
                    screenshot: spPayment.screenshot
                } as StageCategoryPayment
            }
        }
        return {} as StageCategoryPayment
    }

    // Regular stage registration
    // Fetch old StageCategoryPayment to get the QR code / description just in case
    const stageCategory = availabeStageCategoryList.value?.find(sc => String(sc.id) === String(formStageCategoryId.value))
    const oldPayment = stageCategory?.payment?.find(p => p.type === type)

    let basePrice = 0;
    if (activeTier.value) {
        basePrice = Number(activeTier.value.price)
    }

    // fallback to old logic if no dynamic pricing tiers exist
    if (!activeTier.value && oldPayment) {
        basePrice = Number(oldPayment.amount)
    }

    if (basePrice === 0 && addonsTotal.value === 0 && !oldPayment) return {} as StageCategoryPayment

    return {
        amount: String(basePrice),
        type,
        description: oldPayment?.description,
        screenshot: oldPayment?.screenshot
    } as unknown as StageCategoryPayment
})

const onSubmit: SubmissionHandler = async (values: any) => {
    try {
        isLoading.value = true
        if (props.mode == 'volunteer')
            showThankyouDialog.value = await saveVoluteer(values, props.trailRace.id)
        else {
            const payload = { ...values, selected_addons: selectedAddons.value }
            showThankyouDialog.value = await saveRunner(payload, props.trailRace.id)
        }
    } catch (error) {
        console.log(error)
    } finally {
        isLoading.value = false
    }
}

const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
            const result = e.target?.result
            if (result) {
                form.value?.setFieldValue('payment_method', 'QR')
                form.value?.setFieldValue('payment_screenshot', result)
            }
        }
        reader.readAsDataURL(file)
    }
}

const checkEmail = async (email: string) => {
    isLoadingCheckEmail.value = true
    const { data } = await axios.get<Personal>(`/runners/get_by_email/${email}`)
    pastRecord.value = data

    if (!data) {
        nextTick(() => {
            form.value?.setFieldValue('email', email)
        })
    }
    isLoadingCheckEmail.value = false
}

const formSubmitEmailCheck = (values: any) => {
    checkEmail(values.email)
}

watch(pastRecord, () => {
    if (pastRecord.value) {
        setTimeout(() => {
            form.value?.setFieldValue('date_of_birth', moment(pastRecord.value?.date_of_birth).format('YYYY-MM-DD'))

            form.value?.setValues({
                first_name: pastRecord.value?.first_name,
                last_name: pastRecord.value?.last_name,
                email: pastRecord.value?.email,
                phone_number: pastRecord.value?.phone_number,
                gender_id: pastRecord.value?.gender_id,
                country_id: pastRecord.value?.country_id,
                description: (pastRecord.value?.runners || []).length > 0 ? {
                    club_name: pastRecord.value?.runners[0]?.club_name,
                    emergency_contact_name: pastRecord.value?.runners[0]?.emergency_contact_name,
                    emergency_contact_phone: pastRecord.value?.runners[0]?.emergency_contact_no,
                } : {}
            })
        }, 1000)
    }

    hasEnteredEmail.value = true
})

onMounted(() => {
    watch(() => route.query, (query) => {
        if (query.email && !hasEnteredEmail.value) {
            checkEmail(query.email as string)
        }
    }, { immediate: true, deep: true })

    watch(form, (f) => {
        if (f && route.query.stage_id) {
            setTimeout(() => {
                f.setFieldValue('stage_id', route.query.stage_id)
            }, 500)
        }
    }, { immediate: true })
})
</script>

<template>
    <div class="w-screen flex flex-col md:flex-row relative bg-gray-50" v-if="upcomingStages.length > 0">
        <!-- Left Fixed Panel -->
        <div class="hidden md:flex flex-col w-1/2 h-screen text-white sticky top-[81px] left-0">
            <img :src="showImage(trailRace.thumbnail?.file_name as string)" :alt="trailRace.name"
                class="absolute inset-0 w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-transparent"></div>
            <div class="relative z-10 p-12 flex flex-col h-full justify-center">
                <div>
                    <h1 class="text-5xl font-display font-bold mb-4 leading-tight">{{ trailRace.name }}</h1>
                    <p class="text-gray-200 max-w-lg text-lg">{{ trailRace.excerpt }}</p>
                </div>
            </div>
        </div>

        <!-- Right Scrollable Form -->
        <div class="w-full md:w-1/2 overflow-y-auto bg-gray-50 flex flex-col items-center justify-center py-[90px]">
            <div class="w-full max-w-2xl px-6 py-12 md:py-16">
                <!-- Back & Context -->
                <div class="w-full flex justify-between items-start mb-10">
                    <div>
                        <h2 class="text-3xl font-display font-bold text-gray-900 mb-2">Registration</h2>
                        <p class="text-gray-500 text-sm" v-if="pastRecord">Welcome back, {{ pastRecord?.first_name }}.
                            Ready for the next challenge?</p>
                        <p class="text-gray-500 text-sm" v-else>Register as a {{ mode }} to join the adventure.</p>
                    </div>
                    <NuxtLink :to="`/races/${route.params.slug as string}`"
                        class="hidden md:flex items-center gap-2 px-3 py-1.5 text-gray-500 hover:text-primary transition-colors text-sm rounded-md active:scale-95">
                        <ArrowLeft class="w-4 h-4" />
                        Back
                    </NuxtLink>
                </div>
                <Form v-if="!pastRecord && !hasEnteredEmail && !route.query.email"
                    :validation-schema="Y.object({ email: Y.string().email().required() })"
                    @submit="formSubmitEmailCheck"
                    class="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                    <div>
                        <h2>Hello there,</h2>
                        <p>First we would like to have your email</p>
                    </div>
                    <Field name="email" v-slot="{ field }" as="div">
                        <Input type="email" v-bind="field" placeholder="Enter your email" />
                        <ErrorMessage class="error__message" name="email" />
                    </Field>
                    <div class="text-right">
                        <Button type="submit" :disabled="isLoadingCheckEmail">
                            <LoaderIcon class="animate-spin" v-if="isLoadingCheckEmail" />
                            Check email
                        </Button>
                    </div>
                </Form>
                <Form ref="form" class="space-y-8"
                    :validation-schema="mode == 'runner' ? trailRaceRunner : trailRaceVolunteer"
                    v-slot="{ values, setFieldValue }" @submit="onSubmit" v-if="hasEnteredEmail">
                    <div
                        class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                        <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
                            <div class="flex items-center gap-3">
                                <div
                                    class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600">
                                    <User :size="20" />
                                </div>
                                <div>
                                    <h2 class="text-xl font-semibold text-gray-900">
                                        {{ props.mode === 'volunteer' ? 'Volunteer Information' : 'Runner Information'
                                        }}
                                    </h2>
                                    <p class="text-sm text-gray-600">Tell us about yourself</p>
                                </div>
                            </div>
                        </div>

                        <div class="p-4 md:p-8 space-y-6">
                            <!-- Name Fields -->
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Field name="first_name" as="div" v-slot="{ field }" class="space-y-2">
                                    <Label for="rf__first_name"
                                        class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <User :size="16" class="text-gray-400" />
                                        First name
                                    </Label>
                                    <Input id="rf__first_name" v-bind="field" placeholder="Enter your first name"
                                        autocomplete="given-name" class="h-12 text-base" />
                                    <ErrorMessage class="error__message" name="first_name" />
                                </Field>

                                <Field name="middle_name" as="div" v-slot="{ field }" class="space-y-2">
                                    <Label for="rf__middle_name" class="text-sm font-medium text-gray-700">
                                        Middle name <span class="text-gray-400 text-xs">(optional)</span>
                                    </Label>
                                    <Input id="rf__middle_name" v-bind="field" placeholder="Middle name"
                                        class="h-12 text-base" />
                                    <ErrorMessage class="error__message" name="middle_name" />
                                </Field>

                                <Field name="last_name" as="div" v-slot="{ field }" class="space-y-2">
                                    <Label for="rf__last_name" class="text-sm font-medium text-gray-700">
                                        Last name
                                    </Label>
                                    <Input id="rf__last_name" v-bind="field" placeholder="Enter your last name"
                                        autocomplete="family-name" class="h-12 text-base" />
                                    <ErrorMessage class="error__message" name="last_name" />
                                </Field>
                            </div>

                            <!-- Contact Fields -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field name="email" as="div" v-slot="{ field }" class="space-y-2">
                                    <Label for="rf__email"
                                        class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Mail :size="16" class="text-gray-400" />
                                        Email address
                                    </Label>
                                    <Input id="rf__email" type="email" v-bind="field"
                                        placeholder="your.email@example.com" autocomplete="email"
                                        class="h-12 text-base" />
                                    <ErrorMessage class="error__message" name="email" />
                                </Field>

                                <Field name="phone_number" as="div" v-slot="{ field }" class="space-y-2">
                                    <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Phone :size="16" class="text-gray-400" />
                                        Phone number
                                    </Label>
                                    <Input type="tel" v-bind="field" placeholder="xxxxxxxxxx" autocomplete="tel"
                                        class="h-12 text-base" />
                                    <ErrorMessage class="error__message" name="phone_number" />
                                </Field>
                            </div>

                            <!-- Date of Birth and ITRA ID -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field name="date_of_birth" as="div" v-slot="{ field }" class="space-y-2">
                                    <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Calendar :size="16" class="text-gray-400" />
                                        Date of birth
                                    </Label>
                                    <DatePicker Label="Select your birth date"
                                        :model-value="field.value ? parseDate(field.value as string) : undefined"
                                        @update:model-value="$event ? field.onChange($event.toString()) : undefined" />
                                    <ErrorMessage class="error__message" name="date_of_birth" />
                                </Field>

                                <Field name="itra_id" as="div" v-slot="{ field }" class="space-y-2"
                                    v-if="mode === 'runner'">
                                    <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Target :size="16" class="text-gray-400" />
                                        ITRA ID (Optional)
                                    </Label>
                                    <Input v-bind="field" placeholder="Enter your ITRA ID" class="h-12 text-base" />
                                    <ErrorMessage class="error__message" name="itra_id" />
                                </Field>
                            </div>

                            <!-- Demographics -->
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Field name="country_id" as="div" v-slot="{ value, handleChange }" class="space-y-2">
                                    <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Flag :size="16" class="text-gray-400" />
                                        Country
                                    </Label>
                                    <Select :model-value="String(value ?? '')" @update:model-value="(e) => {
                                        handleChange(e)
                                        const isInternational = e == company?.address.country_id
                                        setFieldValue('payment_method', isInternational ? 'PAY_AT_VENUE' : 'QR')
                                    }">
                                        <SelectTrigger class="w-full h-12">
                                            <SelectValue placeholder="Select country" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="country in countries" :key="country.id"
                                                :value="String(country.id)">
                                                {{ country.name }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <ErrorMessage class="error__message" name="country_id" />
                                </Field>

                                <Field name="gender_id" as="div" v-slot="{ value, handleChange }" class="space-y-2">
                                    <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Users :size="16" class="text-gray-400" />
                                        Gender
                                    </Label>
                                    <Select :model-value="value ? String(value) : undefined"
                                        @update:model-value="handleChange">
                                        <SelectTrigger class="w-full h-12">
                                            <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="gender in genders" :key="gender.id"
                                                :value="String(gender.id)">
                                                {{ gender.name }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <ErrorMessage class="error__message" name="gender_id" />
                                </Field>

                                <Field name="size_id" as="div" v-slot="{ value, handleChange }" class="space-y-2">
                                    <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <ShirtIcon :size="16" class="text-gray-400" />
                                        Shirt size
                                    </Label>
                                    <Select :model-value="String(value ?? '')" @update:model-value="handleChange">
                                        <SelectTrigger class="w-full h-12">
                                            <SelectValue placeholder="Size" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="s in shirtSizes" :key="s.id" :value="s.id">
                                                {{ s.name }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <ErrorMessage class="error__message" name="size_id" />
                                </Field>

                                <!-- <Field name="age_category_id" as="div" v-slot="{ value, handleChange }" class="space-y-2">
                            <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Users :size="16" class="text-gray-400" />
                                Age group
                            </Label>
                            <Select :model-value="value ? String(value) : undefined" @update:model-value="handleChange">
                                <SelectTrigger class="w-full h-12">
                                    <SelectValue placeholder="Age group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="ageCategory in age_categories" :key="ageCategory.id"
                                        :value="String(ageCategory.id)">
                                        {{ ageCategory.name }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <ErrorMessage class="error__message" name="age_category_id" />
                        </Field> -->
                            </div>
                            <div class="flex flex-col gap-4">
                                <div class="space-y-4"
                                    v-if="mode === 'runner' && upcomingStages.length > 1 && trailRace.season_passes && trailRace.season_passes.length > 0">
                                    <div class="flex items-center gap-2 mb-2">
                                        <h4 class="font-bold text-gray-900 text-sm">Season Passes</h4>
                                        <span
                                            class="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm">Best
                                            Value</span>
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Field name="season_pass_id" v-slot="{ value, handleChange }">
                                            <Label v-for="pass in trailRace.season_passes" :key="pass.id"
                                                class="block bg-primary/5 p-4 rounded-xl border relative cursor-pointer hover:bg-primary/10 transition-colors"
                                                :class="value === pass.id ? 'border-primary shadow-md' : 'border-primary/20'">
                                                <div class="flex items-center gap-3 mb-2">
                                                    <div
                                                        class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                        <MountainIcon class="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h4 class="font-bold text-gray-900 text-sm">{{ pass.name }}</h4>
                                                        <p class="text-xs text-gray-500 mb-1">
                                                            {{pass.stage_categories?.map(c => c.name).join(', ') ||
                                                                'All stages included'}}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div class="flex items-center justify-between mt-4">
                                                    <span class="font-semibold text-sm text-gray-900">Select Pass</span>
                                                    <Checkbox :model-value="value === pass.id" @update:model-value="(checked) => {
                                                        if (checked) {
                                                            handleChange(pass.id);
                                                            form?.setFieldValue('is_season_pass', true);
                                                            const initialCategories = pass.stage_categories?.map(c => c.id) || upcomingStages.map(stage => stage.stage_categories[0]?.id)
                                                            form?.setFieldValue('season_pass_categories', initialCategories)
                                                        } else {
                                                            handleChange(undefined);
                                                            form?.setFieldValue('is_season_pass', false);
                                                        }
                                                    }" />
                                                </div>
                                            </Label>
                                        </Field>
                                    </div>
                                    <ErrorMessage class="error__message" name="season_pass_id" />
                                </div>

                                <div class="flex gap-2 md:gap-4" v-if="!form?.values.is_season_pass">
                                    <Field name="stage_id" as="div" v-slot="{ value, handleChange }"
                                        :class="{ 'space-y-2': true, 'w-1/2': mode === 'runner', 'w-full': mode === 'volunteer' }">
                                        <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            <Target :size="16" class="text-gray-400" />
                                            Races
                                        </Label>
                                        <Select :model-value="value ? String(value) : undefined"
                                            @update:model-value="(val) => { handleChange(String(val)); }">
                                            <SelectTrigger
                                                class="w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed">
                                                <SelectValue placeholder="Choose your stage" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem v-for="s in stageList" :key="s.id" :value="String(s.id)">
                                                    {{ s.name }}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <ErrorMessage class="error__message" name="stage_id" />
                                    </Field>
                                    <Field name="stage_category_id" as="div" v-slot="{ value, handleChange }"
                                        :class="{ 'space-y-2': true, 'w-1/2': mode === 'runner' }"
                                        v-if="mode === 'runner'">
                                        <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            <Target :size="16" class="text-gray-400" />
                                            Distance
                                        </Label>
                                        <Select :model-value="value ? String(value) : undefined"
                                            @update:model-value="(val) => { handleChange(String(val)); }">
                                            <SelectTrigger
                                                class="w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed">
                                                <SelectValue
                                                    :placeholder="form?.values?.stage_id ? 'Choose your stage category' : 'Select a stage first'" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem v-for="sc in availabeStageCategoryList" :key="sc.id"
                                                    :value="String(sc.id)">
                                                    {{ sc.name }}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <ErrorMessage class="error__message" name="stage_category_id" />
                                    </Field>
                                </div>

                                <div v-if="availableTiers.length > 0 && mode === 'runner'" class="mt-6">
                                    <Label class="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                                        Pricing Tier
                                    </Label>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label v-for="tier in availableTiers" :key="tier.id"
                                            class="flex items-center justify-between p-4 border rounded-xl cursor-pointer bg-white transition-colors"
                                            :class="{ 'border-primary bg-primary/5': String(selectedTierId) === String(tier.id), 'hover:border-gray-300': String(selectedTierId) !== String(tier.id) }">
                                            <div class="flex items-center gap-3">
                                                <input type="radio" :value="tier.id" v-model="selectedTierId"
                                                    class="text-primary focus:ring-primary w-4 h-4" />
                                                <div class="flex flex-col">
                                                    <span class="font-semibold text-gray-900">{{ tier.name }}</span>
                                                    <span class="text-xs text-gray-500"
                                                        v-if="tier.is_time_based && tier.end_date">Until {{
                                                            moment(tier.end_date).format('MMM D, YYYY') }}</span>
                                                </div>
                                            </div>
                                            <span class="font-bold text-gray-900">Rs. {{ tier.price }}</span>
                                        </label>
                                    </div>
                                    <Field name="pricing_tier_id" type="hidden" />
                                </div>

                                <div v-if="applicableAddons.length > 0 && mode === 'runner'"
                                    class="mt-4 p-4 border rounded-xl bg-gray-50/50">
                                    <h4 class="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                                        <Target :size="16" class="text-primary" /> Extra Add-ons
                                    </h4>
                                    <div class="space-y-3">
                                        <label v-for="addon in applicableAddons" :key="addon.id"
                                            class="flex items-center justify-between p-3 border rounded-lg cursor-pointer bg-white transition-colors"
                                            :class="{ 'hover:bg-primary/5 hover:border-primary/30': !addon.is_mandatory, 'opacity-70 bg-gray-100 cursor-not-allowed': addon.is_mandatory, 'border-primary shadow-sm': selectedAddons.includes(addon.id) }">
                                            <div class="flex items-center gap-3">
                                                <Checkbox
                                                    :model-value="addon.is_mandatory || selectedAddons.includes(addon.id)"
                                                    :disabled="addon.is_mandatory"
                                                    @update:model-value="(checked) => toggleAddon(addon.id, checked === true)" />
                                                <div>
                                                    <span class="block font-medium text-sm text-gray-900">{{ addon.name
                                                    }}</span>
                                                    <span
                                                        class="text-[10px] text-primary uppercase font-bold tracking-wider"
                                                        v-if="addon.is_mandatory">Mandatory</span>
                                                </div>
                                            </div>
                                            <span class="text-sm font-semibold text-gray-900">Rs. {{ addon.price
                                            }}</span>
                                        </label>
                                    </div>
                                </div>

                            </div>
                            <template v-if="mode == 'runner'">
                                <Field name="description.club_name" as="div" v-slot="{ field }" class="space-y-2">
                                    <Label for="rf__description.club_name"
                                        class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        Club name
                                    </Label>
                                    <Input v-bind="field" id="rf__description.club_name"
                                        placeholder="Name of club you belong to" />
                                    <ErrorMessage class="error__message" name="description.club_name" />
                                </Field>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Field name="description.emergency_contact_name" as="div" v-slot="{ field }"
                                        class="space-y-2">
                                        <Label id="rf__emergency_contact_name"
                                            class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            Emergency contact name
                                        </Label>
                                        <Input v-bind="field" placeholder="In case of emergency" />
                                        <ErrorMessage class="error__message"
                                            name="description.emergency_contact_name" />
                                    </Field>
                                    <Field name="description.emergency_contact_phone" as="div" v-slot="{ field }"
                                        class="space-y-2">
                                        <Label id="rf__emergency_contact_phone"
                                            class="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            Emergency contact phone
                                        </Label>
                                        <Input v-bind="field" placeholder="In case of emergency" />
                                        <ErrorMessage class="error__message"
                                            name="description.emergency_contact_phone" />
                                    </Field>
                                </div>

                            </template>
                        </div>
                    </div>
                    <div class="bg-white text-gray-500 rounded-3xl border border-gray-200 shadow-sm p-4 md:p-8"
                        v-if="mode == 'runner' && Object.keys(payment).length > 0">
                        <h3 class="text-2xl font-light mb-2">
                            Registration fees for
                            <span class="text-primary font-bold">{{ values?.is_season_pass ? 'Season Pass' :
                                (activeTier?.name || 'Registration') }}</span>
                        </h3>
                        <div class="md:flex items-center justify-between space-y-6 md:space-y-0 md:gap-6 pb-5">
                            <div class="grow space-y-3">
                                <em class="text-gray-600 block not-italic text-2xl">
                                    NPR {{ Number(payment?.amount || 0) + addonsTotal }}
                                </em>
                                <div class="md:flex gap-4">
                                    <div class="grow mb-4 md:mb-0">
                                        <p class="mb-4">Please make payment to this QR code and upload your screenshot.
                                            We verify
                                            from the
                                            screenshot.
                                            We
                                            will
                                            contact you as soon as possible.</p>
                                        <Alert v-if="payment?.description" class="mb-4">
                                            <InfoIcon />
                                            <AlertTitle>{{ payment.description }}</AlertTitle>
                                        </Alert>
                                        <Alert variant="info">
                                            <InfoIcon />
                                            <AlertTitle>If you are having issue with QR code, you can use the following
                                                information to make payment.</AlertTitle>
                                            <AlertDescription>
                                                <dl
                                                    class="pt-4 [&>dd]:pl-4 [&>dt]:uppercase [&>dt]:text-gray-300 [&>dd]:text-gray-600 [&>dd]:mb-2">
                                                    <dt>Company name</dt>
                                                    <dd>Trailmandu Nepal Pvt.Ltd</dd>
                                                    <dt>Address</dt>
                                                    <dd>Ranibon, Nagarjun 03</dd>
                                                    <dt>Account Number</dt>
                                                    <dd>2814150093363002</dd>
                                                    <dt>Swift Code</dt>
                                                    <dd>NICENPKA</dd>
                                                </dl>
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                    <div class="md:w-2/5 shrink-0">
                                        <figure class="text-sm space-y-1 border border-gray-200 p-4 rounded-lg">
                                            <figcaption>Here is the payment QR code</figcaption>
                                            <img :src="showPaymentImage(payment?.screenshot?.file_name as string)"
                                                alt="Payment screenshot" class="w-full h-auto">
                                        </figure>
                                    </div>
                                </div>
                                <label
                                    class="flex items-center gap-2 rounded-lg overflow-hidden border border-gray-200 relative"
                                    :class="{
                                        'border-red-500 text-red-500': form?.errors?.payment_method,
                                        'border-green-500 text-green-500': !form?.errors?.payment_method
                                    }">
                                    <input type="file" @change="handleFileChange" class="hidden"
                                        accept=".jpg,.jpeg,.png" />
                                    <figure v-if="values?.payment_screenshot">
                                        <img :src="values?.payment_screenshot" alt="Payment screenshot"
                                            class="max-w-full h-auto p-2" />
                                        <Button type="button" class="absolute top-2 right-2"
                                            @click="form?.setFieldValue('payment_screenshot', '')">
                                            <XIcon class="w-6 h-6" />
                                        </Button>
                                    </figure>
                                    <div class="w-full flex flex-col gap-2 p-4" v-else>
                                        <span class="text-sm">You can upload your screenshot here...</span>
                                        <p class="text-xs">File size should be less than 2MB</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <ErrorMessage class="error__message" name="payment_method" />
                    </div>

                    <div class="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
                        <div class="flex flex-col mb-4" v-if="mode == 'runner'">
                            <Field name="liabilities" as="div" v-slot="{ value, handleChange }">
                                <Checkbox :model-value="value"
                                    @update:model-value="handleChange($event); if (!value) showLiabilitiesDialog = true;"
                                    :default-value="false" id="rf__liabilities" />
                                <label for="rf__liabilities">
                                    Yes, I agree, I am liable to my own action.
                                </label>
                                <ErrorMessage class="error__message" name="liabilities" />
                            </Field>
                            <Field name="policies" as="div" v-slot="{ value, handleChange }">
                                <Checkbox :model-value="value"
                                    @update:model-value="handleChange($event); if (!value) showPoliciesDialog = true;"
                                    :default-value="false" id="rf__policies" />
                                <label for="rf__policies">
                                    Yes, I agree to all the policies mentioned.
                                </label>
                                <ErrorMessage class="error__message" name="policies" />
                            </Field>
                        </div>
                        <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div class="text-center sm:text-left">
                                <h3 class="text-lg font-semibold text-gray-900 mb-2">Ready to register?</h3>
                                <p class="text-gray-600 text-sm mb-6">
                                    {{ props.mode === 'volunteer'
                                        ? 'Complete your volunteer registration and join our team!'
                                        : 'Submit your registration and get ready for the race!'
                                    }}
                                </p>
                            </div>

                            <Button variant="secondary" type="submit"
                                class="w-full sm:w-auto px-8 py-3 h-12 text-base font-medium " :disabled="isLoading"
                                :aria-busy="isLoading">
                                <Loader2 v-if="isLoading" :size="20" class="animate-spin mr-2" />
                                <span v-if="!isLoading">
                                    {{ props.mode === "volunteer" ? "Register as Volunteer" : "Register as Runner" }}
                                </span>
                                <span v-else>Processing Registration...</span>
                            </Button>
                        </div>
                    </div>
                </Form>
            </div>
        </div>
    </div>
    <div class="bg-gray-50 text-gray-600 text-center border border-gray-300 p-8 rounded-xl" v-else>
        looks like all the stages are completed
    </div>
    <Dialog :open="showThankyouDialog" @update:open="showThankyouDialog = false">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Thank you for registering!</DialogTitle>
                <DialogDescription>
                    You have successfully registered as a {{ mode }}.
                </DialogDescription>
            </DialogHeader>
            <p>Do not forget to check your email for the confirmation email. And if have any issues, please contact us
                at
                <a href="mailto:info@trailmandu.com" class="underline text-primary">info@trailmandu.com</a>
            </p>
            <DialogFooter>
                <Button type="button" as-child @click="showThankyouDialog = false">
                    <NuxtLink :to="`/races/${route.params.slug as string}`">Ok!</NuxtLink>
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <Dialog :open="showLiabilitiesDialog">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Liabilities</DialogTitle>
                <DialogDescription>
                    Please read the liabilities carefully.
                </DialogDescription>
            </DialogHeader>
            <div id="content" class="text-gray-700 text__holder max-h-[calc(100vh-200px)] overflow-y-auto">
                <div v-if="trailRace.liability_waiver" v-html="trailRace.liability_waiver" />
            </div>
            <DialogFooter>
                <Button type="button" @click="showLiabilitiesDialog = false">
                    Yes, I have read it and agree
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <Dialog v-model:open="showPoliciesDialog">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Policies</DialogTitle>
                <DialogDescription>
                    Please read the policies carefully.
                </DialogDescription>
            </DialogHeader>
            <div id="content" class="text-gray-700 text__holder max-h-[calc(100vh-200px)] overflow-y-auto">
                <div v-if="trailRace.policies" v-html="trailRace.policies" />
            </div>
            <DialogFooter>
                <Button type="button" @click="showPoliciesDialog = false">
                    Yes, I have read it and agree
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>