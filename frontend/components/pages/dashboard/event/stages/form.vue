<script lang="ts" setup>
import { parseDate } from '@internationalized/date'
import { LoaderIcon, SaveIcon, XIcon } from 'lucide-vue-next'
import moment from 'moment'
import { ErrorMessage, Field, Form, type FormContext } from 'vee-validate'

import { showImage } from '~/lib/filters'
import { stageSchema } from '~/lib/schema/event.schema'
import type { Stage } from '~/lib/types'
import { useStageStore } from '~/store/stage'
import { useEventStore } from '~/store/event'

interface StageFormProps {
    eventId: string
    stage?: Stage | null
}

const props = defineProps<StageFormProps>()
const emit = defineEmits(['update'])
const { save } = useStageStore()
const eventStore = useEventStore()
const { events } = storeToRefs(eventStore)

const isLoading = ref(false)
const thumbnailFile = ref('')
const form = ref<FormContext | null>(null)
const startDate = ref()
const endDate = ref()
const showFile = ref({
    thumbnail: false,
    guide_book_file: false
})
const guideBookFileName = ref('')

const formSubmit = async (values: any) => {
    isLoading.value = true
    await save(props.eventId, {
        ...values,
        has_shirt: values.has_shirt !== false
    })
    isLoading.value = false
    emit('update')
}

const imageFileHandler = (event: Event, fieldName: string) => {
    const files = (event.target as HTMLInputElement).files ?? []

    if (files?.length == 0)
        return

    const reader = new FileReader()
    const file = files[0]
    reader.onload = () => {
        thumbnailFile.value = file.name

        if (form.value)
            form.value.setFieldValue(fieldName, reader.result as string)
    }
    if (file)
        reader.readAsDataURL(file)
}

const guideBookFileHandler = (event: Event, fieldName: string) => {
    const files = (event.target as HTMLInputElement).files ?? []
    if (files?.length == 0) return
    const reader = new FileReader()
    const file = files[0]
    reader.onload = () => {
        guideBookFileName.value = file.name
        if (form.value)
            form.value.setFieldValue(fieldName, reader.result as string)
    }
    if (file) reader.readAsDataURL(file)
}

const removeFile = (fieldName: string) => {
    if (form.value) {
        form.value.resetField(fieldName)
    }
}

const init = () => {
    if (form.value) {
        form.value.setFieldValue('event_id', props.eventId)

        if (props.stage) {
            form.value.setValues({
                id: props.stage.id,
                name: props.stage.name,
                excerpt: props.stage.excerpt,
                description: props.stage.description,
                location: props.stage.location,
                difficulty: props.stage.difficulty,
                distance: props.stage.distance,
                thumbnail: props.stage.thumbnail?.file_name,
                guide_book_file: props.stage.guide_book_file?.file_name,
                has_shirt: props.stage.has_shirt !== false,
            })

            showFile.value.thumbnail = !!props.stage.thumbnail?.file_name
            showFile.value.guide_book_file = !!props.stage.guide_book_file?.file_name
        } else {
            form.value.resetForm()
            form.value.setFieldValue('event_id', props.eventId)
            form.value.setFieldValue('has_shirt', true)
            showFile.value.thumbnail = false
            showFile.value.guide_book_file = false
        }
    }
}

watch(startDate, () => {
    if (form.value)
        form.value.setFieldValue('start', `${startDate.value.year}-${startDate.value.month}-${startDate.value.day}`)
})
watch(endDate, () => {
    if (form.value)
        form.value.setFieldValue('end', `${endDate.value.year}-${endDate.value.month}-${endDate.value.day}`)
})

watch(form, () => {
    init()
})

watch(() => props.stage, () => {
    init()
}, { deep: true })

onBeforeMount(() => {
    if (form.value)
        init()
})

onMounted(async () => {
    if (events.value.length === 0) {
        await eventStore.fetch()
    }
})
</script>

<template>
    <Form @submit="formSubmit" :validation-schema="stageSchema" class="flex flex-col gap-4 relative" ref="form"
        v-slot="{ values }">
        <div class="w-full h-[480px] relative" v-if="showFile.thumbnail">
            <img :src="showImage(stage?.thumbnail.file_name as string)" class="size-full object-cover">
            <Button @click="showFile.thumbnail = false" class="absolute top-2 right-2">change image</Button>
        </div>
        <template v-else>
            <div class="w-full h-[480px]" v-if="values.thumbnail">
                <img :src="values.thumbnail" class="size-full object-cover">
                <Button @click="showFile.thumbnail = true" class="absolute top-2 right-2">cancel</Button>
            </div>
            <div class="w-full flex flex-col gap-2 relative">
                <label class="py-4 px-4 flex border border-dashed rounded-sm">
                    <input type="file" @change="imageFileHandler($event, 'thumbnail')"
                        accept=".jpg, .jpeg, .png, image/jpeg, image/png" class="hidden" />
                    <span class="text-gray-700 flex-grow">
                        {{ thumbnailFile ? thumbnailFile : 'Upload image file' }}
                    </span>
                </label>
                <Button type="button" @click="() => {
                    removeFile('thumbnail')
                    thumbnailFile = ''
                }" v-if="thumbnailFile" size="icon" modifier="outline"
                    class="absolute top-1/2 right-2 -translate-y-1/2">
                    <XIcon />
                </Button>
                <ErrorMessage class="error__message" name="thumbnail" />
            </div>
        </template>
        <Field name="event_id" v-slot="{ field }" as="div" class="flex flex-col gap-2">
            <Label for="esf__event">Event</Label>
            <Select v-bind="field" :default-value="stage?.event_id ?? eventId">
                <SelectTrigger class="w-full">
                    <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem v-for="e in events" :key="e.id" :value="e.id">
                        {{ e.name }}
                    </SelectItem>
                </SelectContent>
            </Select>
            <ErrorMessage class="error__message" name="event_id" />
        </Field>
        <Field name="id" v-slot="{ field }" as="div" class="flex flex-col gap-2">
            <Input type="hidden" v-bind="field" id="esf__id" />
        </Field>
        <Field name="name" v-slot="{ field }" as="div" class="flex flex-col gap-2">
            <Label for="esf__name">Name</Label>
            <Input v-bind="field" id="esf__name" />
            <ErrorMessage class="error__message" name="name" />
        </Field>
        <Field name="excerpt" v-slot="{ field }" as="div" class="flex flex-col gap-2">
            <Label for="esf__excerpt">Excerpt</Label>
            <Textarea v-bind="field" id="esf__excerpt" />
            <ErrorMessage class="error__message" name="excerpt" />
        </Field>
        <Field name="location" v-slot="{ field }" as="div" class="flex flex-col gap-2">
            <Label for="esf__location">Location</Label>
            <Input v-bind="field" id="esf__location" />
            <ErrorMessage class="error__message" name="location" />
        </Field>
        <Field name="guide_book_file" v-slot="{ value, field }" as="div" class="flex flex-col gap-2">
            <Label>Guide Book (PDF)</Label>
            <div class="w-full flex flex-col gap-2 relative">
                <div v-if="showFile.guide_book_file" class="flex items-center justify-between p-4 border rounded-sm">
                    <span>{{ stage?.guide_book_file?.file_name }}</span>
                    <Button type="button" @click="showFile.guide_book_file = false" size="sm" modifier="outline">Change file</Button>
                </div>
                <template v-else>
                    <label class="py-4 px-4 flex border border-dashed rounded-sm cursor-pointer">
                        <input type="file" @change="guideBookFileHandler($event, 'guide_book_file')" accept="application/pdf" class="hidden" />
                        <span class="text-gray-700 flex-grow">
                            {{ guideBookFileName ? guideBookFileName : 'Upload PDF guide book' }}
                        </span>
                    </label>
                    <Button type="button" @click="() => {
                        removeFile('guide_book_file')
                        guideBookFileName = ''
                    }" v-if="guideBookFileName" size="icon" modifier="outline" class="absolute top-1/2 right-2 -translate-y-1/2">
                        <XIcon />
                    </Button>
                </template>
            </div>
            <ErrorMessage class="error__message" name="guide_book_file" />
        </Field>
        <Field name="has_shirt" v-slot="{ value, handleChange }" as="div"
            class="flex items-center justify-between p-4 border rounded-xl bg-slate-50 dark:bg-slate-900/50">
            <div class="space-y-0.5">
                <Label for="esf__has_shirt" class="text-sm font-medium cursor-pointer">Include Shirt Size</Label>
                <p class="text-xs text-muted-foreground">Enable if this stage includes a shirt and asks runners for their shirt size during registration.</p>
            </div>
            <Switch id="esf__has_shirt" :model-value="value !== false" @update:model-value="(val: boolean) => handleChange(val)" />
        </Field>
        <Field name="description" v-slot="{ value, handleChange }" as="div" class="flex flex-col gap-2">
            <TiptapEditor :model-value="value ?? ''" @update:model-value="handleChange" :disabled="false"
                :timer="1000" />
        </Field>
        <div class="text-right">
            <Button type="submit" :disabled="isLoading">
                <LoaderIcon class="animate-spin" v-if="isLoading" />
                <SaveIcon v-else />
                Save
            </Button>
        </div>
    </Form>
</template>