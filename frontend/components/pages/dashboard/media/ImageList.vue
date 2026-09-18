<script setup lang="ts">
import { ChevronLeftIcon, CheckIcon } from 'lucide-vue-next'
import { showImage } from '~/lib/filters';
import type { APIParam, Gallery, Image } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { useMediaStore } from '~/store/media'
import { useInfiniteScroll } from '@vueuse/core'
import { Loader2Icon } from 'lucide-vue-next'

const props = defineProps<{
    gallery: Gallery
}>()

const { media } = storeToRefs(useMediaStore())
const { axios } = useAxios()

const images = defineModel<Image[]>('images')
const isLoading = ref(false)
const scrollContainer = ref<HTMLElement | null>(null)

const params = ref<APIParam>({
    current: 1,
    per_page: 30,
    total: 0,
    total_page: 0
})

const getImagesFromSelectedGallery = async (append = false) => {
    if (!append) {
        params.value.current = 1
        if (images.value) images.value = []
    }

    if (media.value.selectedGallery) {
        const url = media.value.selectedGallery.id === 'uncategorized'
            ? `/medias/images/uncategorized`
            : `/medias/images/${media.value.selectedGallery.id}`

        const { data: { data, ...p } } = await axios.get(url, {
            params: params.value
        })

        if (append) {
            images.value = [...(images.value || []), ...data]
        } else {
            images.value = data
        }
        params.value = p
    }
}

useInfiniteScroll(scrollContainer, () => {
    if (params.value.current < params.value.total_page) {
        params.value.current++
        getImagesFromSelectedGallery(true)
    }
}, { distance: 50 })

const handleImageChange = async (e: Event) => {
    const target = e.target as HTMLInputElement
    const files = target.files
    if (!files || files.length === 0) return

    isLoading.value = true
    const base64Images: string[] = []

    for (const file of files) {
        const reader = new FileReader()
        await new Promise(resolve => {
            reader.onload = (e) => {
                base64Images.push(e.target?.result as string)
                resolve(true)
            }
            reader.readAsDataURL(file)
        })
    }

    if (media.value.selectedGallery?.id === 'uncategorized') {
        await axios.post('/medias/uncategorized/images', { images: base64Images })
    } else if (media.value.selectedGallery) {
        await axios.post(`/medias/${media.value.selectedGallery.id}/images`, { images: base64Images })
    }

    await getImagesFromSelectedGallery()
    isLoading.value = false
}

const updateSelectedImages = (imageId: string) => {
    if (media.value.isMultiple) {
        if (media.value.selectedImages.includes(imageId)) {
            media.value.selectedImages = media.value.selectedImages.filter((id) => id !== imageId)
        } else {
            media.value.selectedImages.push(imageId)
        }
    } else {
        if (media.value.selectedImages.includes(imageId)) {
            media.value.selectedImages = []
        } else {
            media.value.selectedImages = [imageId]
        }
    }
}

onMounted(getImagesFromSelectedGallery)
</script>

<template>
    <div ref="scrollContainer" class="flex-1 overflow-y-auto p-2 max-h-[calc(100vh-300px)] gallery-scrollbar">
        <div class="mb-6">
            <Button modifier="link" @click="media.selectedGallery = null">
                <ChevronLeftIcon class="w-4 h-4" />
                <span class="font-label text-sm uppercase tracking-wider">Back to Galleries</span>
            </Button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <label
                class="relative aspect-square border-2 border-dashed rounded-xl overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <input type="file" multiple @change="handleImageChange" class="hidden" :disabled="isLoading" />
                <div class="flex flex-col items-center gap-2 p-4 text-muted-foreground">
                    <span v-if="isLoading" class="animate-spin text-2xl">⏳</span>
                    <span v-else class="text-3xl">+</span>
                    <span class="text-sm font-medium">{{ isLoading ? 'Uploading...' : 'Upload Images' }}</span>
                </div>
            </label>
            <!-- Image Card 1 (Selected) -->
            <div v-for="image in images" class="relative aspect-square group cursor-pointer rounded-xl overflow-hidden"
                :class="media.selectedImages.includes(image.id) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border border-border'"
                @click="updateSelectedImages(image.id)">
                <img class="w-full h-full object-cover"
                    :class="media.selectedImages.includes(image.id) ? '' : 'transition-transform duration-300 group-hover:scale-105'"
                    :src="showImage(image.file_name)" />
                <div class="absolute"
                    :class="media.selectedImages.includes(image.id) ? 'inset-0 bg-primary/10' : 'top-2 right-2 bg-background/80 backdrop-blur-sm w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'">
                </div>
                <div v-if="media.selectedImages.includes(image.id)"
                    class="absolute top-2 right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                    <CheckIcon class="w-4 h-4" />
                </div>
            </div>
        </div>

        <div class="h-10 mt-4 flex items-center justify-center">
            <Loader2Icon v-if="params.current < params.total_page" class="animate-spin text-muted-foreground" />
        </div>
    </div>
</template>