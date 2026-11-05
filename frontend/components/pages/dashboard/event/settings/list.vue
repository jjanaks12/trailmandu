<script lang="ts" setup>
import { LoaderIcon, SaveIcon, XIcon, ImageIcon } from 'lucide-vue-next'
import { ref, onMounted, computed } from 'vue'
import { useEventStore } from '~/store/event'
import { useMediaStore } from '~/store/media'
import { useAppStore } from '~/store/app'
import { storeToRefs } from 'pinia'
import { useAxios } from '~/services/axios'
import { showImage } from '~/lib/filters'
import type { TrailRace, StageCategory } from '~/lib/types'
import { toast } from 'vue-sonner'
import LayoutEditor from './LayoutEditor.vue'
import type { LayoutElement } from './LayoutEditor.vue'

const props = defineProps({
    eventId: {
        type: String,
        required: true
    }
})

const { get } = useEventStore()
const { media } = storeToRefs(useMediaStore())
const { fetchImage } = useMediaStore()
const { setImageForPreview } = useAppStore()
const { axios } = useAxios()

const trailRace = ref<TrailRace | null>(null)
const details = ref<any>({})
const isLoading = ref(true)
const isSaving = ref(false)

const isBibLayoutEditorOpen = ref(false)
const bibEditorImageUrl = ref('')

const isCertLayoutEditorOpen = ref(false)

const bibElements = ref<LayoutElement[]>([
    { id: 'name', label: 'Runner Name', type: 'text', demoText: 'JOHN DOE', defaultConfig: { top: '70', left: '50', fontSize: '60', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase' } },
    { id: 'flag', label: 'Country Flag', type: 'image', defaultConfig: { top: '70', left: '80', width: '44', height: '30' } },
    { id: 'bib', label: 'Bib Number', type: 'text', demoText: '1234', defaultConfig: { top: '85', left: '50', fontSize: '180', color: '#ffffff', fontWeight: 'bold' } },
    { id: 'distance', label: 'Distance', type: 'text', demoText: '50 KM', defaultConfig: { top: '60', left: '25', fontSize: '36', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase' } },
    { id: 'location', label: 'Location', type: 'text', demoText: 'Kathmandu, Nepal', defaultConfig: { top: '60', left: '75', fontSize: '26', color: '#333333', fontWeight: 'normal', textTransform: 'none' } },
    { id: 'date', label: 'Event Date', type: 'text', demoText: 'Nov 05, 2026', hasDateFormat: true, defaultConfig: { top: '60', left: '50', fontSize: '26', color: '#333333', fontWeight: 'normal', dateFormat: 'MMM DD, YYYY', textTransform: 'uppercase' } }
])

const certElements = ref<LayoutElement[]>([
    { id: 'name', label: 'Runner Name', type: 'text', demoText: 'JOHN DOE', defaultConfig: { top: '50', left: '50', fontSize: '48', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase' } },
    { id: 'time', label: 'Finish Time', type: 'text', demoText: '12:34:56', defaultConfig: { top: '60', left: '50', fontSize: '32', color: '#000000', fontWeight: 'normal' } },
    { id: 'rank', label: 'Rank', type: 'text', demoText: '#1', defaultConfig: { top: '70', left: '50', fontSize: '32', color: '#000000', fontWeight: 'normal' } },
    { id: 'distance', label: 'Distance', type: 'text', demoText: '50 KM', defaultConfig: { top: '75', left: '30', fontSize: '28', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase' } },
    { id: 'location', label: 'Location', type: 'text', demoText: 'Kathmandu, Nepal', defaultConfig: { top: '75', left: '70', fontSize: '24', color: '#333333', fontWeight: 'normal', textTransform: 'none' } },
    { id: 'date', label: 'Event Date', type: 'text', demoText: 'Nov 05, 2026', hasDateFormat: true, defaultConfig: { top: '80', left: '50', fontSize: '24', color: '#333333', fontWeight: 'normal', dateFormat: 'MMM DD, YYYY', textTransform: 'none' } }
])

const stageCategories = computed(() => {
    const cats: any[] = []
    if (trailRace.value?.stages) {
        trailRace.value.stages.forEach(stage => {
            if (stage.stage_categories) {
                cats.push(...stage.stage_categories.map(c => ({
                    ...c,
                    stage_name: stage.name
                })))
            }
        })
    }
    return cats
})

onMounted(async () => {
    trailRace.value = await get(props.eventId)
    if (trailRace.value) {
        let parsed = typeof trailRace.value.details === 'string' ? JSON.parse(trailRace.value.details) : (trailRace.value.details || {})
        if (Array.isArray(parsed)) {
            parsed = { topics: parsed, settings: {} }
        }
        details.value = parsed.settings || {}
        if (!details.value.bib_images) details.value.bib_images = {}
    }
    isLoading.value = false
})

const openMediaCenterForBib = (stageCategoryId: string) => {
    media.value.show = true
    media.value.mode = 'image'
    media.value.isMultiple = false
    media.value.action = async (state: any) => {
        if (state.selectedImages.length > 0) {
            const imageId = state.selectedImages[0]
            const img = await fetchImage(imageId)
            if (img) {
                if (!details.value.bib_images) details.value.bib_images = {}
                details.value.bib_images[stageCategoryId] = {
                    id: img.id,
                    url: img.file_name
                }
            }
            media.value.show = false
        }
    }
}

const openMediaCenter = (type: 'result_image') => {
    media.value.show = true
    media.value.mode = 'image'
    media.value.isMultiple = false
    media.value.action = async (state: any) => {
        if (state.selectedImages.length > 0) {
            const imageId = state.selectedImages[0]
            const img = await fetchImage(imageId)
            if (img) {
                details.value[type] = {
                    id: img.id,
                    url: img.file_name
                }
            }
            media.value.show = false
        }
    }
}

const removeBibImage = (stageCategoryId: string) => {
    if (details.value.bib_images) {
        delete details.value.bib_images[stageCategoryId]
    }
}

const editBibLayout = () => {
    const categoriesWithImg = stageCategories.value.filter(c => details.value.bib_images?.[c.id])
    if (categoriesWithImg.length > 0) {
        bibEditorImageUrl.value = showImage(details.value.bib_images[categoriesWithImg[0].id].url)
    } else {
        bibEditorImageUrl.value = ''
    }

    if (!details.value.bib_layout) {
        details.value.bib_layout = {}
    }
    isBibLayoutEditorOpen.value = true
}

const saveBibLayout = async (layout: any) => {
    details.value.bib_layout = layout
    await save()
}

const editCertLayout = () => {
    if (!details.value.certificate_layout) {
        details.value.certificate_layout = {}
    }
    isCertLayoutEditorOpen.value = true
}

const saveCertLayout = async (layout: any) => {
    details.value.certificate_layout = layout
    await save()
}

const removeImage = (type: 'result_image') => {
    delete details.value[type]
}

const save = async () => {
    isSaving.value = true
    try {
        let currentDetails = typeof trailRace.value?.details === 'string' ? JSON.parse(trailRace.value.details) : (trailRace.value?.details || {})
        if (Array.isArray(currentDetails)) {
            currentDetails = { topics: currentDetails, settings: details.value }
        } else {
            currentDetails.settings = details.value
        }
        await axios.put(`/events/${props.eventId}/update_details`, {
            details: JSON.stringify(currentDetails)
        })
        toast.success('Settings saved successfully')
    } catch (e) {
        toast.error('Failed to save settings')
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
    <div v-if="isLoading" class="flex justify-center p-12">
        <LoaderIcon class="animate-spin w-8 h-8 text-gray-400" />
    </div>
    <div v-else class="space-y-6 max-w-4xl">
        <Card>
            <CardHeader>
                <CardTitle>Event Images Settings</CardTitle>
                <CardDescription>Configure specific assets and images for this event.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-8">
                <!-- Bib Images Per Category -->
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium">Bib Printing Images</h3>
                            <p class="text-sm text-gray-500 mb-4">Select a background image for bib printing for each
                                stage
                                category.</p>
                        </div>
                        <Button modifier="outline" size="sm" @click="editBibLayout">Edit Generic Bib Layout</Button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div v-for="category in stageCategories" :key="category.id" class="border rounded p-4">
                            <h4 class="font-medium text-sm mb-3">{{ category.stage_name }} - {{ category.name }}</h4>
                            <div v-if="details.bib_images && details.bib_images[category.id]"
                                class="relative inline-block border rounded-md p-2 bg-gray-50 group">
                                <img :src="showImage(details.bib_images[category.id].url)"
                                    class="h-32 object-contain cursor-pointer"
                                    @click="setImageForPreview(showImage(details.bib_images[category.id].url))" />
                                <Button variant="destructive" size="icon"
                                    class="absolute -top-3 -right-3 rounded-full w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    @click="removeBibImage(category.id)">
                                    <XIcon class="w-4 h-4" />
                                </Button>
                            </div>
                            <div v-else>
                                <Button modifier="outline" @click="openMediaCenterForBib(category.id)"
                                    class="gap-2 text-sm" size="sm">
                                    <ImageIcon class="w-4 h-4" />
                                    Select Image
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                <!-- Result Image -->
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-medium">Result Certificate Image</h3>
                            <p class="text-sm text-gray-500">This image will be used as the background for the runner
                                results certificate.</p>
                        </div>
                        <Button modifier="outline" size="sm" @click="editCertLayout">Edit Generic Certificate
                            Layout</Button>
                    </div>

                    <div v-if="details.result_image"
                        class="relative inline-block border rounded-md p-2 bg-gray-50 group">
                        <img :src="showImage(details.result_image.url)" class="h-48 object-contain cursor-pointer"
                            @click="setImageForPreview(showImage(details.result_image.url))" />
                        <Button variant="destructive" size="icon"
                            class="absolute -top-3 -right-3 rounded-full w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            @click="removeImage('result_image')">
                            <XIcon class="w-4 h-4" />
                        </Button>
                    </div>
                    <div v-else>
                        <Button modifier="outline" @click="openMediaCenter('result_image')" class="gap-2">
                            <ImageIcon class="w-4 h-4" />
                            Select Result Image
                        </Button>
                    </div>
                </div>
            </CardContent>
            <CardFooter class="flex justify-end border-t pt-6 bg-gray-50 rounded-b-xl">
                <Button @click="save" :disabled="isSaving" class="gap-2">
                    <LoaderIcon v-if="isSaving" class="w-4 h-4 animate-spin" />
                    <SaveIcon v-else class="w-4 h-4" />
                    Save Settings
                </Button>
            </CardFooter>
        </Card>

        <!-- Layout Editors -->
        <LayoutEditor v-if="isBibLayoutEditorOpen" v-model="isBibLayoutEditorOpen" title="Edit Bib Layout"
            :image-url="bibEditorImageUrl" :elements="bibElements" :layout-config="details.bib_layout || {}"
            @save="saveBibLayout" />

        <LayoutEditor v-if="isCertLayoutEditorOpen" v-model="isCertLayoutEditorOpen" title="Edit Certificate Layout"
            :image-url="details.result_image ? showImage(details.result_image.url) : ''" :elements="certElements"
            :layout-config="details.certificate_layout || {}" @save="saveCertLayout" />
    </div>
</template>