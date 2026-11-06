<script lang="ts" setup>
import { parseDate } from '@internationalized/date'
import { LoaderIcon, TargetIcon } from 'lucide-vue-next'
import moment from 'moment'
import { ErrorMessage, Field, Form, type FormContext } from 'vee-validate'
import type { EventRunner, Stage } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { useAppStore } from '~/store/app'

type Props = {
    runner?: EventRunner | null
    stageList: Stage[]
}

const props = defineProps<Props>()
const emit = defineEmits(['updated'])
const { axios } = useAxios()
const { genders, countries } = storeToRefs(useAppStore())

const isLoading = ref(false)
const form = useTemplateRef<FormContext>('form')

const availabeStageCategoryList = computed(() => props.stageList.find(stage => stage.id === props.runner?.stage_id)?.stage_categories)
const runnerAddons = computed(() => props.runner?.addons || [])

const handleSumit = async (values: any) => {
    if (!props.runner)
        return

    console.log(values);

    isLoading.value = true
    await axios.put(`/runners/${props.runner.id}`, values)
    isLoading.value = false
    emit('updated')
}

const init = () => {
    nextTick(() => {
        if (props.runner)
            form.value?.setValues({
                bib: props.runner.bib,
                first_name: props.runner.personal.first_name,
                middle_name: props.runner.personal.middle_name,
                last_name: props.runner.personal.last_name,
                gender_id: props.runner.personal.gender_id,
                date_of_birth: props.runner.personal.date_of_birth,
                country_id: props.runner.personal.country_id,
                phone_number: props.runner.personal.phone_number,
                email: props.runner.personal.email,
                stage_category_id: props.runner.stage_category_id,
                description: {
                    club_name: props.runner.club_name,
                    emergency_contact_name: props.runner.emergency_contact_name,
                    emergency_contact_phone: props.runner.emergency_contact_no,
                    want_lunch: props.runner.want_lunch
                }
            })
    })
}

onMounted(init)
</script>

<template>
    <Form ref="form" @submit="handleSumit" class="space-y-8">
        <Field name="bib" v-slot="{ field }" as="div" class="flex flex-col gap-2">
            <label for="bib" class="block text-sm font-medium text-gray-700">BIB#</label>
            <Input type="text" id="bib" v-bind="field" />
            <ErrorMessage class="error__message" name="bib" />
        </Field>
        <div class="grid grid-cols-3 gap-4">
            <Field name="first_name" v-slot="{ field }" as="div" class="flex flex-col gap-2">
                <label for="first_name" class="block text-sm font-medium text-gray-700">First name</label>
                <Input type="text" id="first_name" v-bind="field" />
                <ErrorMessage class="error__message" name="first_name" />
            </Field>
            <Field name="middle_name" v-slot="{ field }" as="div" class="flex flex-col gap-2">
                <label for="middle_name" class="block text-sm font-medium text-gray-700">Middle name</label>
                <Input type="text" id="middle_name" v-bind="field" />
                <ErrorMessage class="error__message" name="middle_name" />
            </Field>
            <Field name="last_name" v-slot="{ field }" as="div" class="flex flex-col gap-2">
                <label for="last_name" class="block text-sm font-medium text-gray-700">Last name</label>
                <Input type="text" id="last_name" v-bind="field" />
                <ErrorMessage class="error__message" name="last_name" />
            </Field>
        </div>
        <div class="grid grid-cols-3 gap-4">
            <Field name="gender_id" v-slot="{ value, handleChange }" as="div" class="flex flex-col gap-2">
                <label for="gender_id" class="block text-sm font-medium text-gray-700">Gender</label>
                <Select :model-value="value" @change="handleChange">
                    <SelectTrigger class="w-full">
                        <SelectValue placeholder="Select a gender" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="gender in genders" :key="gender.id" :value="gender.id">
                            {{ gender.name }}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <ErrorMessage class="error__message" name="gender_id" />
            </Field>
            <Field name="date_of_birth" v-slot="{ field }" as="div" class="flex flex-col gap-2">
                <label for="date_of_birth" class="block text-sm font-medium text-gray-700">Date of birth</label>
                <DatePicker
                    :model-value="field.value ? parseDate(moment.utc(field.value as string).format('YYYY-MM-DD')) : undefined"
                    @update:model-value="$event ? field.onChange($event.toString()) : undefined" />
                <ErrorMessage class="error__message" name="date_of_birth" />
            </Field>
            <Field name="country_id" v-slot="{ value, handleChange }" as="div" class="flex flex-col gap-2">
                <label for="country_id" class="block text-sm font-medium text-gray-700">Country</label>
                <Select :model-value="value" @change="handleChange">
                    <SelectTrigger class="w-full">
                        <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="country in countries" :key="country.id" :value="country.id">
                            {{ country.name }}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <ErrorMessage class="error__message" name="country_id" />
            </Field>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <Field name="phone_number" v-slot="{ field }" as="div" class="flex flex-col gap-2">
                <label for="phone_number" class="block text-sm font-medium text-gray-700">Phone number</label>
                <Input type="text" id="phone_number" v-bind="field" />
                <ErrorMessage class="error__message" name="phone_number" />
            </Field>
            <Field name="email" v-slot="{ field }" as="div" class="flex flex-col gap-2">
                <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                <Input type="email" id="email" v-bind="field" />
                <ErrorMessage class="error__message" name="email" />
            </Field>
        </div>
        <Field name="stage_category_id" as="div" v-slot="{ value, handleChange }" class="w-1/2 space-y-2">
            <Label class="text-sm font-medium text-gray-700 flex items-center gap-2">
                <TargetIcon :size="16" class="text-gray-400" />
                Distance
            </Label>
            <Select :model-value="value" @update:model-value="handleChange">
                <SelectTrigger class="w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed">
                    <SelectValue
                        :placeholder="form?.values?.stage_id ? 'Choose your stage catgeory' : 'Select an stage first'" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem v-for="sc in availabeStageCategoryList" :key="sc.id" :value="String(sc.id)">
                        {{ sc.name }}
                    </SelectItem>
                </SelectContent>
            </Select>
            <ErrorMessage class="error__message" name="stage_category_id" />
        </Field>
        <Field name="description.club_name" v-slot="{ field }" as="div" class="flex flex-col gap-2">
            <label for="description.club_name" class="block text-sm font-medium text-gray-700">Club name</label>
            <Input type="text" id="club_name" v-bind="field" />
            <ErrorMessage class="error__message" name="description.club_name" />
        </Field>
        <div class="grid grid-cols-2 gap-4">
            <Field name="description.emergency_contact_name" v-slot="{ field }" as="div" class="flex flex-col gap-2">
                <label for="emergency_contact_name" class="block text-sm font-medium text-gray-700">Emergency contact
                    name</label>
                <Input type="text" id="emergency_contact_name" v-bind="field" />
                <ErrorMessage class="error__message" name="emergency_contact_name" />
            </Field>
            <Field name="description.emergency_contact_phone" v-slot="{ field }" as="div" class="flex flex-col gap-2">
                <label for="emergency_contact_phone" class="block text-sm font-medium text-gray-700">Emergency contact
                    phone</label>
                <Input type="text" id="emergency_contact_phone" v-bind="field" />
                <ErrorMessage class="error__message" name="emergency_contact_phone" />
            </Field>
        </div>
        <Field name="description.want_lunch" as="div" v-slot="{ value, handleChange }" class="space-y-2">
            <Label id="rf__want_lunch" class="flex items-start gap-2">
                <Checkbox :model-value="value" @update:model-value="handleChange" :default-value="false" />
                <div class="grow flex flex-col gap-2">
                    <span class="font-medium text-gray-700">I want to order lunch after race.</span>
                    <em class="text-sm font-light not-italic text-gray-500">Lunch is provided to runners who pre-ordered and pre-paid with their registration or add-ons.</em>
                </div>
            </Label>
            <ErrorMessage class="error__message" name="description.want_lunch" />
        </Field>
        <div v-if="runnerAddons.length > 0" class="p-3 bg-gray-50 border rounded-lg text-sm space-y-1">
            <span class="font-medium text-xs text-gray-500 uppercase tracking-wider block">Registered Add-ons:</span>
            <div v-for="addon in runnerAddons" :key="addon.id" class="flex justify-between text-xs text-gray-700">
                <span>{{ addon.addon?.name }}</span>
                <span class="font-medium">Rs. {{ addon.amount_paid }}</span>
            </div>
        </div>
        <div class="text-right">
            <Button type="submit">
                <LoaderIcon v-if="isLoading" class="mr-2 animate-spin" />
                Submit
            </Button>
        </div>
    </Form>
</template>