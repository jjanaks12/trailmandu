<script setup lang="ts">
import { EllipsisVerticalIcon, SquareCheckBigIcon, SquareIcon, TrashIcon, FolderInputIcon, Loader2Icon, UploadIcon } from 'lucide-vue-next'
import type { Image } from '~/lib/types'
import { useAxios } from '~/services/axios'
import { useMediaStore } from '~/store/media'
import { toast } from 'vue-sonner'

import { useInfiniteScroll } from '@vueuse/core'

const emit = defineEmits(['refresh'])
const { axios } = useAxios()
const mediaStore = useMediaStore()
const { galleryList } = storeToRefs(mediaStore)

const selectedIds = ref<(string | null)[]>([])
const showMoveDialog = ref(false)
const isMoving = ref(false)
const selectedGalleryId = ref('')
const isNewGallery = ref(false)
const newGalleryName = ref('')
const isLoading = ref(false)
const scrollContainer = ref<HTMLElement | null>(null)

const uncategories = ref<Image[]>([])
const params = ref({
    current: 1,
    per_page: 30,
    total_page: 1,
    total: 0
})

const fetchImages = async (append = false) => {
    if (!append) {
        params.value.current = 1
        uncategories.value = []
    }
    const { data } = await axios.get('/medias/images/uncategorized', {
        params: {
            current: params.value.current,
            per_page: params.value.per_page
        }
    })

    if (append) {
        uncategories.value.push(...data.data)
    } else {
        uncategories.value = data.data
    }

    params.value.total_page = data.total_page
    params.value.total = data.total

    selectedIds.value = uncategories.value.map(() => null)
}

useInfiniteScroll(document, () => {
    if (params.value.current < params.value.total_page) {
        params.value.current++
        fetchImages(true)
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

    try {
        await axios.post('/medias/uncategorized/images', { images: base64Images })
        toast.success('Images uploaded successfully')
        fetchImages()
        emit('refresh')
    } catch (error) {
        toast.error('Failed to upload images')
    } finally {
        isLoading.value = false
    }
}

const init = () => {
    fetchImages()
}

const selectAll = () => {
    selectedIds.value = uncategories.value.map(i => i.id)
}

const deselectAll = () => {
    selectedIds.value = uncategories.value.map(() => null)
}

const hasSelected = computed(() => selectedIds.value.some(id => id !== null))

const remove = async () => {
    if (!confirm('Are you sure you want to delete these images?')) return
    try {
        await axios.delete(`/medias/uncategorized`, {
            data: {
                images: selectedIds.value.filter(id => id != null)
            }
        })
        toast.success('Images deleted successfully')
        fetchImages()
        emit('refresh')
    } catch (error) {
        toast.error('Failed to delete images')
    }
}

const handleMove = async () => {
    isMoving.value = true
    try {
        let galleryId = selectedGalleryId.value
        const imageIds = selectedIds.value.filter(id => id != null)

        if (isNewGallery.value && newGalleryName.value) {
            const { data } = await axios.post('/medias', {
                name: newGalleryName.value,
                images: imageIds,
                tags: []
            })
            galleryId = data.id
        }

        if (!galleryId) {
            toast.error('Please select or create a gallery')
            return
        }

        await axios.post('/medias/link-images', {
            images: selectedIds.value.filter(id => id != null),
            gallery_id: galleryId
        })

        toast.success('Images added successfully')
        showMoveDialog.value = false
        fetchImages()
        emit('refresh')
        deselectAll()
        isNewGallery.value = false
        newGalleryName.value = ''
        selectedGalleryId.value = ''
    } catch (error) {
        console.error(error)
        toast.error('Failed to add images')
    } finally {
        isMoving.value = false
    }
}

// Drop target for dragged image cards
const isCardDropOver = ref(false)
let cardDropCounter = 0

const onCardDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('application/x-media-image')) return
    e.preventDefault()
    cardDropCounter++
    isCardDropOver.value = true
}

const onCardDragOver = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('application/x-media-image')) return
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
}

const onCardDragLeave = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('application/x-media-image')) return
    e.preventDefault()
    cardDropCounter--
    if (cardDropCounter <= 0) {
        cardDropCounter = 0
        isCardDropOver.value = false
    }
}

const onCardDrop = async (e: DragEvent) => {
    e.preventDefault()
    cardDropCounter = 0
    isCardDropOver.value = false

    const raw = e.dataTransfer?.getData('application/x-media-image')
    if (!raw) return

    try {
        const { imageId, sourceGalleryId } = JSON.parse(raw)
        if (!sourceGalleryId) return // already uncategorized

        // Unlink from source gallery (move to uncategorized)
        await axios.post('/medias/move-images', {
            images: [imageId],
            gallery_id: '', // no target gallery
            old_gallery_id: sourceGalleryId
        })
        toast.success('Image moved to uncategorized')
        fetchImages()
        emit('refresh')
    } catch (error) {
        console.error(error)
        toast.error('Failed to move image')
    }
}

onMounted(() => {
    init()
    mediaStore.fetchGalleryList()
})
</script>

<template>
    <div ref="scrollContainer" class="relative" @dragenter="onCardDragEnter" @dragover="onCardDragOver"
        @dragleave="onCardDragLeave" @drop="onCardDrop"
        :class="{ 'ring-2 ring-primary/50 ring-offset-2 rounded-lg': isCardDropOver }">
        <div class="flex items-center justify-between py-5 px-1 mb-4 sticky top-[75px] bg-white z-10">
            <div class="grow">
                <strong class="text-xl">Uncategorised
                    <span v-if="isCardDropOver" class="ml-2 text-sm font-normal text-primary animate-pulse">Drop here to
                        unlink</span>
                </strong>
            </div>
            <div class="flex gap-2">
                <DropdownMenu :open="selectedIds.some(id => id != null)" :modal="false">
                    <DropdownMenuTrigger as-child>
                        <Button variant="secondary" size="icon" :disabled="!hasSelected">
                            <EllipsisVerticalIcon class="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="selectAll">
                            <SquareCheckBigIcon class="mr-2 size-4" />
                            Select all
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="deselectAll" :disabled="!hasSelected">
                            <SquareIcon class="mr-2 size-4" />
                            Deselect all
                        </DropdownMenuItem>
                        <DropdownMenuSeparator v-if="hasSelected" />
                        <DropdownMenuItem @click="showMoveDialog = true" v-if="hasSelected">
                            <FolderInputIcon class="mr-2 size-4" />
                            Add to gallery
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="remove" v-if="hasSelected" class="text-destructive">
                            <TrashIcon class="mr-2 size-4" />
                            Delete selected
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
        <div class="grid grid-cols-4 gap-2">
            <label
                class="relative aspect-square border-2 border-dashed rounded-xl overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <input type="file" multiple @change="handleImageChange" class="hidden" :disabled="isLoading" />
                <div class="flex flex-col items-center gap-2 p-4 text-muted-foreground">
                    <Loader2Icon v-if="isLoading" class="animate-spin size-8" />
                    <FolderInputIcon v-else class="size-8" />
                    <span class="text-sm font-medium">{{ isLoading ? 'Uploading...' : 'Upload Images' }}</span>
                </div>
            </label>
            <PagesDashboardMediaCard v-for="(image, index) in uncategories" v-model:selected="selectedIds[index]"
                :key="`uncategories_${index}`" :image="image" gallery-id="" @update="emit('refresh')" />
        </div>

        <div class="h-10 mt-4 flex items-center justify-center">
            <Loader2Icon v-if="params.current < params.total_page" class="animate-spin text-muted-foreground" />
        </div>

        <Dialog v-model:open="showMoveDialog">
            <DialogContent class="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add to Gallery</DialogTitle>
                    <DialogDescription>
                        Add the selected images to an existing gallery or create a new one.
                    </DialogDescription>
                </DialogHeader>
                <div class="grid gap-4 py-4">
                    <div class="flex flex-col gap-2">
                        <Label>Select Gallery</Label>
                        <Select v-model="selectedGalleryId" :disabled="isNewGallery">
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a gallery..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="gallery in galleryList" :key="gallery.id" :value="gallery.id">
                                    {{ gallery.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div class="flex items-center space-x-2 mt-2">
                        <Checkbox id="new-gallery" v-model="isNewGallery" />
                        <Label for="new-gallery" class="text-sm font-medium leading-none cursor-pointer">
                            Create new gallery
                        </Label>
                    </div>
                    <div v-if="isNewGallery" class="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                        <Label>Gallery Name</Label>
                        <Input v-model="newGalleryName" placeholder="Enter new gallery name..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button modifier="outline" @click="showMoveDialog = false" :disabled="isMoving">
                        Cancel
                    </Button>
                    <Button @click="handleMove"
                        :disabled="isMoving || (!selectedGalleryId && !isNewGallery) || (isNewGallery && !newGalleryName)">
                        <Loader2Icon v-if="isMoving" class="mr-2 h-4 w-4 animate-spin" />
                        Move Images
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>