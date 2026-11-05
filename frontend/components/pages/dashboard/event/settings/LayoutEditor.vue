<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import moment from 'moment'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export interface LayoutElement {
    id: string
    label: string
    type: 'text' | 'image'
    demoText?: string
    defaultConfig: Record<string, any>
    hasDateFormat?: boolean
}

const props = defineProps<{
    modelValue: boolean
    title: string
    imageUrl: string
    elements: LayoutElement[]
    layoutConfig: Record<string, any>
}>()

const emit = defineEmits(['update:modelValue', 'save'])

const open = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
})

// Local config to edit
const config = ref<Record<string, any>>({})

watch(() => props.modelValue, (isOpen) => {
    if (isOpen) {
        // Deep clone the config
        config.value = JSON.parse(JSON.stringify(props.layoutConfig || {}))

        // Ensure all elements have at least their default config
        props.elements.forEach(el => {
            if (!config.value[el.id]) {
                config.value[el.id] = { ...el.defaultConfig }
            } else {
                if (el.defaultConfig?.dateFormat && !config.value[el.id].dateFormat) {
                    config.value[el.id].dateFormat = el.defaultConfig.dateFormat
                }
                if (el.defaultConfig?.textTransform && !config.value[el.id].textTransform) {
                    config.value[el.id].textTransform = el.defaultConfig.textTransform
                }
            }
        })
    }
}, { immediate: true })

const selectedElement = ref<string | null>(null)
const containerRef = ref<HTMLElement | null>(null)

// Dragging state
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const initialPos = ref({ top: 0, left: 0 })

const onMouseDown = (e: MouseEvent, id: string) => {
    selectedElement.value = id
    isDragging.value = true
    dragStart.value = { x: e.clientX, y: e.clientY }
    initialPos.value = {
        top: parseFloat(config.value[id]?.top || 0),
        left: parseFloat(config.value[id]?.left || 0)
    }
    e.preventDefault() // prevent text selection while dragging
}

const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !selectedElement.value || !containerRef.value) return

    const rect = containerRef.value.getBoundingClientRect()
    const dx = e.clientX - dragStart.value.x
    const dy = e.clientY - dragStart.value.y

    // Convert pixel delta to percentage
    const deltaLeft = (dx / rect.width) * 100
    const deltaTop = (dy / rect.height) * 100

    config.value[selectedElement.value].left = Math.min(100, Math.max(0, initialPos.value.left + deltaLeft)).toFixed(2)
    config.value[selectedElement.value].top = Math.min(100, Math.max(0, initialPos.value.top + deltaTop)).toFixed(2)
}

const onMouseUp = () => {
    isDragging.value = false
}

const save = () => {
    emit('save', config.value)
    open.value = false
}

const getElementDisplay = (el: LayoutElement) => {
    if (el.id === 'date' || el.hasDateFormat) {
        const fmt = config.value[el.id]?.dateFormat || el.defaultConfig?.dateFormat || 'MMM DD, YYYY'
        const isUpper = config.value[el.id]?.textTransform === 'uppercase'
        const formatted = moment().format(fmt)
        return isUpper ? formatted.toUpperCase() : formatted
    }
    const isUpper = config.value[el.id]?.textTransform === 'uppercase'
    const text = el.demoText || el.label
    return isUpper ? text.toUpperCase() : text
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="max-w-[90vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader class="px-6 py-4 border-b shrink-0">
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription>
                    Drag elements on the preview or use the sidebar controls to adjust their position, size, and color.
                </DialogDescription>
            </DialogHeader>

            <div class="flex-1 flex overflow-hidden">
                <!-- Preview Area -->
                <div class="flex-1 bg-gray-100 p-8 overflow-auto flex items-center justify-center relative"
                    @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp">
                    <div class="relative shadow-lg bg-white overflow-hidden w-full"
                        style="aspect-ratio: 210 / 148; container-type: inline-size; width: 800px;" ref="containerRef">
                        <img :src="imageUrl" class="w-full h-full object-contain pointer-events-none" v-if="imageUrl" />
                        <div v-else class="w-full h-full flex items-center justify-center text-gray-400">No background
                            image</div>

                        <div v-for="el in elements" :key="el.id"
                            class="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move border-2 whitespace-nowrap z-10"
                            :class="selectedElement === el.id ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]' : 'border-transparent hover:border-gray-300'"
                            :style="{
                                top: (config[el.id]?.top || 0) + '%',
                                left: (config[el.id]?.left || 0) + '%',
                                fontSize: ((config[el.id]?.fontSize || 16) / 10) + 'cqw',
                                color: config[el.id]?.color || '#000000',
                                width: config[el.id]?.width ? ((config[el.id].width) / 10) + 'cqw' : 'auto',
                                height: config[el.id]?.height ? ((config[el.id].height) / 10) + 'cqw' : 'auto',
                                background: el.type === 'image' ? 'rgba(0,0,0,0.1)' : 'transparent',
                                fontWeight: config[el.id]?.fontWeight || 'normal',
                                textTransform: config[el.id]?.textTransform || (el.id === 'name' ? 'uppercase' : 'none')
                            }" @mousedown="onMouseDown($event, el.id)">
                            <template v-if="el.type === 'text'">
                                {{ getElementDisplay(el) }}
                            </template>
                            <template v-else-if="el.type === 'image'">
                                <div
                                    class="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-400 text-xs text-gray-500">
                                    {{ el.label }}</div>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- Settings Sidebar -->
                <div class="w-80 shrink-0 border-l bg-gray-50 flex flex-col overflow-y-auto">
                    <div class="p-4 border-b font-medium bg-white">
                        Elements
                    </div>

                    <div class="flex-1 p-4 space-y-6">
                        <div v-for="el in elements" :key="el.id"
                            class="p-4 bg-white border rounded-lg cursor-pointer transition-colors"
                            :class="selectedElement === el.id ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-300'"
                            @click="selectedElement = el.id">
                            <div class="font-medium mb-4">{{ el.label }} Settings</div>
                            <template v-if="config[el.id]">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="space-y-2">
                                        <Label class="text-xs">Left (%)</Label>
                                        <Input type="number" v-model="config[el.id].left" class="h-8" />
                                    </div>
                                    <div class="space-y-2">
                                        <Label class="text-xs">Top (%)</Label>
                                        <Input type="number" v-model="config[el.id].top" class="h-8" />
                                    </div>
                                    <template v-if="el.type === 'text'">
                                        <div class="space-y-2">
                                            <Label class="text-xs">Font Size (px)</Label>
                                            <Input type="number" v-model="config[el.id].fontSize" class="h-8" />
                                        </div>
                                        <div class="space-y-2">
                                            <Label class="text-xs">Color</Label>
                                            <Input type="color" v-model="config[el.id].color" class="h-8 p-1 w-full" />
                                        </div>
                                        <div class="space-y-2">
                                            <Label class="text-xs">Font Weight</Label>
                                            <select v-model="config[el.id].fontWeight"
                                                class="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                                                <option value="normal">Normal</option>
                                                <option value="bold">Bold</option>
                                            </select>
                                        </div>
                                        <div class="space-y-2">
                                            <Label class="text-xs">Text Transform</Label>
                                            <select v-model="config[el.id].textTransform"
                                                class="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                                                <option value="none">Normal</option>
                                                <option value="uppercase">UPPERCASE</option>
                                                <option value="capitalize">Capitalize</option>
                                                <option value="lowercase">lowercase</option>
                                            </select>
                                        </div>
                                        <div v-if="el.id === 'date' || el.hasDateFormat" class="space-y-2 col-span-2">
                                            <div class="flex items-center justify-between">
                                                <Label class="text-xs font-semibold text-gray-700">Date Format</Label>
                                                <span class="text-[10px] text-gray-400">Preview: {{ moment().format(config[el.id]?.dateFormat || 'MMM DD, YYYY') }}</span>
                                            </div>
                                            <select v-model="config[el.id].dateFormat"
                                                class="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                                                <option value="MMM DD, YYYY">MMM DD, YYYY (e.g. {{ moment().format('MMM DD, YYYY') }})</option>
                                                <option value="MMMM DD, YYYY">MMMM DD, YYYY (e.g. {{ moment().format('MMMM DD, YYYY') }})</option>
                                                <option value="DD MMM YYYY">DD MMM YYYY (e.g. {{ moment().format('DD MMM YYYY') }})</option>
                                                <option value="DD MMMM YYYY">DD MMMM YYYY (e.g. {{ moment().format('DD MMMM YYYY') }})</option>
                                                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. {{ moment().format('YYYY-MM-DD') }})</option>
                                                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. {{ moment().format('DD/MM/YYYY') }})</option>
                                                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. {{ moment().format('MM/DD/YYYY') }})</option>
                                                <option value="MMM YYYY">MMM YYYY (e.g. {{ moment().format('MMM YYYY') }})</option>
                                            </select>
                                        </div>
                                    </template>
                                    <template v-if="el.type === 'image'">
                                        <div class="space-y-2">
                                            <Label class="text-xs">Width (px)</Label>
                                            <Input type="number" v-model="config[el.id].width" class="h-8" />
                                        </div>
                                        <div class="space-y-2">
                                            <Label class="text-xs">Height (px)</Label>
                                            <Input type="number" v-model="config[el.id].height" class="h-8" />
                                        </div>
                                    </template>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <DialogFooter class="px-6 py-4 border-t bg-white shrink-0">
                <Button modifier="outline" @click="open = false">Cancel</Button>
                <Button @click="save">Save Layout</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
