<script lang="ts" setup>
import { ref, watch, useTemplateRef, computed } from 'vue'
import PrindD from 'printd'
import moment from 'moment'
import type { EventRunner } from '~/lib/types'
import BIBBg25kImg from '~/assets/images/bib-25k.png'
import BIBBg10kImg from '~/assets/images/bib-10k.png'
import { DownloadIcon } from 'lucide-vue-next'
import { showImage } from '~/lib/filters'
import { useEventStore } from '~/store/event'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BibCardProps {
    runners?: EventRunner[]
    stageID?: string | null
}

const { get } = useEventStore()
const eventSettings = ref<any>({})
const currentTrailRace = ref<any>(null)

const loadEventSettings = async () => {
    if (props.runners && props.runners.length > 0) {
        const event_id = props.runners[0].event_id
        if (event_id) {
            const trailRace = await get(event_id)
            if (trailRace) {
                currentTrailRace.value = trailRace
                const parsed = typeof trailRace.details === 'string' ? JSON.parse(trailRace.details) : (trailRace.details || {})
                eventSettings.value = Array.isArray(parsed) ? {} : (parsed.settings || {})
            }
        }
    }
}

const formatBibDistance = (runner: EventRunner) => {
    let raw = runner.stage_category?.distance || runner.stage?.distance || ''
    if (!raw && runner.stage_category?.name) {
        const match = runner.stage_category.name.match(/\d+(\.\d+)?/)
        if (match) raw = match[0]
    }
    if (!raw) return ''

    const str = String(raw).trim()
    const num = parseFloat(str.replace(/[^0-9.]/g, ''))
    if (isNaN(num)) return str.toUpperCase()

    // If number >= 500 (e.g. 10000, 25000, 50000) or ends with 'm' (not 'km'), it's given in meters
    const isMeters = num >= 500 || /^\d+(\.\d+)?\s*m$/i.test(str)
    const kmValue = isMeters ? num / 1000 : num
    const roundedKm = Math.round(kmValue)

    return `${roundedKm} KM`
}

const formatBibLocation = (runner: EventRunner) => {
    return runner.stage?.location || runner.stage_category?.location || currentTrailRace.value?.location || currentTrailRace.value?.address || ''
}

const formatBibDate = (runner: EventRunner, formatStr = 'MMM DD, YYYY') => {
    const rawDate = runner.stage_category?.start || runner.stage?.start || currentTrailRace.value?.start_date || currentTrailRace.value?.created_at
    if (!rawDate) return ''
    const m = moment(rawDate)
    return m.isValid() ? m.format(formatStr || 'MMM DD, YYYY') : ''
}

const props = defineProps<BibCardProps>()

const printArea = useTemplateRef<HTMLDivElement>('printArea')
const showDialiog = defineModel('show', {
    default: false
})

interface CategoryGroup {
    id: string
    name: string
    runners: EventRunner[]
    sampleRunner: EventRunner
    maxBib: number
    padLength: number
    prefix: string
    suffix: string
    autoStart: number
}

const categories = computed<CategoryGroup[]>(() => {
    const map = new Map<string, CategoryGroup>()

    for (const runner of (props.runners || [])) {
        const catId = runner.stage_category_id || runner.stage_category?.id || 'default'
        const catName = runner.stage_category?.name || runner.stage?.name || 'Default'
        
        if (!map.has(catId)) {
            map.set(catId, {
                id: catId,
                name: catName,
                runners: [],
                sampleRunner: runner,
                maxBib: 0,
                padLength: 1,
                prefix: '',
                suffix: '',
                autoStart: 1
            })
        }
        map.get(catId)!.runners.push(runner)
    }

    for (const cat of map.values()) {
        const bibStrings = cat.runners.map(r => String(r.bib || '').trim()).filter(Boolean)
        let maxNum = 0
        let maxPad = 1
        let detectedPrefix = ''
        let detectedSuffix = ''

        for (const b of bibStrings) {
            const m = b.match(/^([^\d]*)(\d+)([^\d]*)$/)
            if (m) {
                const num = parseInt(m[2], 10)
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num
                }
                if (m[2].length > maxPad) {
                    maxPad = m[2].length
                }
                if (!detectedPrefix && m[1]) detectedPrefix = m[1]
                if (!detectedSuffix && m[3]) detectedSuffix = m[3]
            }
        }

        cat.maxBib = maxNum
        const numLength = maxNum > 0 ? String(maxNum).length : 1
        cat.padLength = Math.max(maxPad, numLength)
        cat.prefix = detectedPrefix
        cat.suffix = detectedSuffix
        cat.autoStart = maxNum > 0 ? maxNum + 1 : 1
    }

    return Array.from(map.values())
})

const extraBibsCount = ref(0)
const categoryStartBibs = ref<Record<string, number>>({})

const getStartForCat = (cat: CategoryGroup) => {
    const custom = categoryStartBibs.value[cat.id]
    if (custom != null && !isNaN(custom) && custom > 0) {
        return custom
    }
    return cat.autoStart
}

const formatBibForCat = (cat: CategoryGroup, num: number) => {
    const formattedNum = num.toString().padStart(cat.padLength, '0')
    return `${cat.prefix}${formattedNum}${cat.suffix}`
}

watch(() => props.runners, () => {
    loadEventSettings()
    const starts: Record<string, number> = {}
    for (const cat of categories.value) {
        starts[cat.id] = cat.autoStart
    }
    categoryStartBibs.value = starts
}, { immediate: true })

const jumpBibNumber = ref('')
const scrollToBib = () => {
    if (!jumpBibNumber.value) return
    const target = jumpBibNumber.value.trim()
    let el = document.getElementById(`bib-card-${target}`)
    if (!el) {
        const num = parseInt(target, 10)
        if (!isNaN(num)) {
            for (let pad = 1; pad <= 6; pad++) {
                const candidate = num.toString().padStart(pad, '0')
                el = document.getElementById(`bib-card-${candidate}`)
                if (el) break
            }
        }
    }
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
        alert(`BIB "${target}" not found in current list`)
    }
}

const displayRunners = computed(() => {
    if (!extraBibsCount.value || extraBibsCount.value <= 0) {
        return props.runners || []
    }

    const result: EventRunner[] = []

    for (const cat of categories.value) {
        // Add existing registered runners for this category
        result.push(...cat.runners)

        // Generate extra blank bibs for this category starting from (maxBib + 1)
        const start = getStartForCat(cat)
        for (let i = 0; i < extraBibsCount.value; i++) {
            const num = start + i
            const bibString = formatBibForCat(cat, num)

            result.push({
                id: `extra-${cat.id}-${num}`,
                bib: bibString,
                stage_category_id: cat.sampleRunner.stage_category_id || cat.id,
                stage_category: cat.sampleRunner.stage_category || null,
                stage_id: cat.sampleRunner.stage_id || '',
                stage: cat.sampleRunner.stage || null,
                event_id: cat.sampleRunner.event_id || '',
                event: cat.sampleRunner.event || null,
                personal: {}, // Blank name & flag for extra bibs
            } as any)
        }
    }

    return result
})

const downloadPDF = () => {
    if (!import.meta.client) return
    if (!printArea.value) return

    const p = new PrindD()
    p.print(printArea.value, [
        `
        @page { size: A5 landscape; margin: 0; }
        body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        `
    ])
}

const getBibImage = (runner: EventRunner) => {
    try {
        if (eventSettings.value?.bib_images && eventSettings.value.bib_images[runner.stage_category_id]) {
            return showImage(eventSettings.value.bib_images[runner.stage_category_id].url)
        }
    } catch (e) {
        // ignore JSON parse error
    }
    // Fallback
    return runner.stage_category?.name === '10 km' ? BIBBg10kImg : BIBBg25kImg
}
</script>

<template>
    <Dialog v-model:open="showDialiog">
        <DialogContent class="sm:max-w-[90vw] grow flex flex-col max-h-[90vh]">
            <DialogHeader class="shrink-0">
                <DialogTitle>Prepare runner BIB card</DialogTitle>
                <DialogDescription>
                    Generate runner BIB card for printing. You can see preview of the cards here.
                </DialogDescription>
            </DialogHeader>

            <div class="flex-1 min-h-0 overflow-y-auto bg-gray-100 p-4 rounded-md">
                
                <div class="flex flex-wrap items-end gap-4 mb-4 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-sm sticky top-0 z-10 border border-slate-200">
                    <div class="space-y-1.5">
                        <Label class="text-xs font-semibold">Extra Blank BIBs (per category)</Label>
                        <div class="flex items-center gap-2">
                            <Input type="number" v-model.number="extraBibsCount" min="0" class="w-28 font-mono" placeholder="0" />
                            <span class="text-xs text-muted-foreground whitespace-nowrap" v-if="extraBibsCount > 0 && categories.length > 0">
                                Total: <strong class="text-foreground">{{ extraBibsCount * categories.length }}</strong> extra ({{ extraBibsCount }} &times; {{ categories.length }} {{ categories.length === 1 ? 'category' : 'categories' }})
                            </span>
                        </div>
                    </div>

                    <!-- Single Category Start Input -->
                    <div class="space-y-1.5" v-if="extraBibsCount > 0 && categories.length === 1">
                        <Label class="text-xs font-semibold">Starting BIB Number</Label>
                        <div class="flex items-center gap-2">
                            <Input
                                type="number"
                                v-model.number="categoryStartBibs[categories[0].id]"
                                min="1"
                                class="w-32 font-mono"
                            />
                            <span class="text-xs text-muted-foreground font-mono">
                                ({{ formatBibForCat(categories[0], getStartForCat(categories[0])) }} &ndash; {{ formatBibForCat(categories[0], getStartForCat(categories[0]) + extraBibsCount - 1) }})
                            </span>
                        </div>
                    </div>

                    <!-- Multiple Categories Start Inputs -->
                    <div v-if="extraBibsCount > 0 && categories.length > 1" class="space-y-1.5">
                        <Label class="text-xs font-semibold">Starting Numbers Per Category</Label>
                        <div class="flex flex-wrap items-center gap-2">
                            <div
                                v-for="cat in categories"
                                :key="cat.id"
                                class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md"
                            >
                                <span class="text-xs font-semibold text-slate-700 whitespace-nowrap">{{ cat.name }}:</span>
                                <Input
                                    type="number"
                                    v-model.number="categoryStartBibs[cat.id]"
                                    min="1"
                                    class="w-20 h-7 text-xs font-mono px-1.5"
                                    :placeholder="String(cat.autoStart)"
                                />
                                <span class="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                                    ({{ formatBibForCat(cat, getStartForCat(cat)) }}&ndash;{{ formatBibForCat(cat, getStartForCat(cat) + extraBibsCount - 1) }})
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-1.5 ml-auto border-l pl-4 border-slate-200">
                        <Label class="text-xs font-semibold">Find BIB</Label>
                        <div class="flex items-center gap-2">
                            <Input type="text" v-model="jumpBibNumber" @keyup.enter="scrollToBib" placeholder="Number..." class="w-24" />
                            <Button variant="secondary" size="sm" @click="scrollToBib">Go</Button>
                        </div>
                    </div>
                </div>

                <div ref="printArea" v-if="displayRunners.length" class="flex flex-col items-center gap-8 py-4">
                    <!-- Physical dimensions for standard A5 landscape bib -->
                    <div v-for="runner in displayRunners" :key="runner.id" :id="`bib-card-${runner.bib}`" style="
                            width: 210mm; 
                            height: 148mm; 
                            position: relative; 
                            overflow: hidden; 
                            background: #fff;
                            container-type: inline-size;
                            page-break-after: always;
                            break-inside: avoid;
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                        ">
                        <!-- Background Image -->
                        <img :src="getBibImage(runner)"
                            style="width: 100%; height: 100%; object-fit: contain; position: absolute; top: 0; left: 0;">

                        <!-- Dynamic Layout Engine -->
                        <template v-if="eventSettings?.bib_layout">

                            <!-- Name -->
                            <div v-if="eventSettings.bib_layout.name" :style="{
                                position: 'absolute',
                                top: (eventSettings.bib_layout.name.top || 0) + '%',
                                left: (eventSettings.bib_layout.name.left || 0) + '%',
                                transform: 'translate(-50%, -50%)',
                                color: eventSettings.bib_layout.name.color || '#000000',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: eventSettings.bib_layout.name.fontWeight || 'normal',
                                fontSize: ((eventSettings.bib_layout.name.fontSize || 16) / 10) + 'cqw',
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                textTransform: 'uppercase'
                            }">
                                {{ runner.personal.first_name }}
                                {{ runner.personal.middle_name }}
                                {{ runner.personal.last_name }}
                            </div>

                            <!-- Flag -->
                            <img v-if="eventSettings.bib_layout.flag && runner.personal.country?.abbr"
                                :src="`https://flagcdn.com/${runner.personal.country.abbr.toLowerCase()}.svg`"
                                :style="{
                                    position: 'absolute',
                                    top: (eventSettings.bib_layout.flag.top || 0) + '%',
                                    left: (eventSettings.bib_layout.flag.left || 0) + '%',
                                    transform: 'translate(-50%, -50%)',
                                    width: ((eventSettings.bib_layout.flag.width || 44) / 10) + 'cqw',
                                    height: ((eventSettings.bib_layout.flag.height || 30) / 10) + 'cqw',
                                    objectFit: 'contain'
                                }" />

                            <!-- Bib Number -->
                            <div v-if="eventSettings.bib_layout.bib" :style="{
                                position: 'absolute',
                                top: (eventSettings.bib_layout.bib.top || 0) + '%',
                                left: (eventSettings.bib_layout.bib.left || 0) + '%',
                                transform: 'translate(-50%, -50%)',
                                color: eventSettings.bib_layout.bib.color || '#000000',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: eventSettings.bib_layout.bib.fontWeight || 'normal',
                                fontSize: ((eventSettings.bib_layout.bib.fontSize || 16) / 10) + 'cqw',
                                lineHeight: 1,
                                whiteSpace: 'nowrap'
                            }">
                                {{ runner.bib }}
                            </div>

                            <!-- Distance -->
                            <div v-if="eventSettings.bib_layout.distance && formatBibDistance(runner)" :style="{
                                position: 'absolute',
                                top: (eventSettings.bib_layout.distance.top || 0) + '%',
                                left: (eventSettings.bib_layout.distance.left || 0) + '%',
                                transform: 'translate(-50%, -50%)',
                                color: eventSettings.bib_layout.distance.color || '#000000',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: eventSettings.bib_layout.distance.fontWeight || 'bold',
                                fontSize: ((eventSettings.bib_layout.distance.fontSize || 36) / 10) + 'cqw',
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                textTransform: eventSettings.bib_layout.distance.textTransform || 'uppercase'
                            }">
                                {{ formatBibDistance(runner) }}
                            </div>

                            <!-- Location -->
                            <div v-if="eventSettings.bib_layout.location && formatBibLocation(runner)" :style="{
                                position: 'absolute',
                                top: (eventSettings.bib_layout.location.top || 0) + '%',
                                left: (eventSettings.bib_layout.location.left || 0) + '%',
                                transform: 'translate(-50%, -50%)',
                                color: eventSettings.bib_layout.location.color || '#333333',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: eventSettings.bib_layout.location.fontWeight || 'normal',
                                fontSize: ((eventSettings.bib_layout.location.fontSize || 26) / 10) + 'cqw',
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                textTransform: eventSettings.bib_layout.location.textTransform || 'none'
                            }">
                                {{ formatBibLocation(runner) }}
                            </div>

                            <!-- Event Date -->
                            <div v-if="eventSettings.bib_layout.date && formatBibDate(runner, eventSettings.bib_layout.date.dateFormat)" :style="{
                                position: 'absolute',
                                top: (eventSettings.bib_layout.date.top || 0) + '%',
                                left: (eventSettings.bib_layout.date.left || 0) + '%',
                                transform: 'translate(-50%, -50%)',
                                color: eventSettings.bib_layout.date.color || '#333333',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: eventSettings.bib_layout.date.fontWeight || 'normal',
                                fontSize: ((eventSettings.bib_layout.date.fontSize || 26) / 10) + 'cqw',
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                textTransform: eventSettings.bib_layout.date.textTransform || 'uppercase'
                            }">
                                {{ formatBibDate(runner, eventSettings.bib_layout.date.dateFormat) }}
                            </div>
                        </template>

                        <!-- Fallback Hardcoded Layout if no layout is defined -->
                        <div v-else
                            style="width: 100%; text-align: center; padding: 10px; top: 0; left: 50%; transform: translateX(-50%); position: absolute; font-family: Arial, sans-serif;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                                <strong
                                    style="color: #000; text-transform: uppercase; font-size: 6cqw; font-weight: 700;">
                                    {{ runner.personal.first_name }}
                                    {{ runner.personal.middle_name }}
                                    {{ runner.personal.last_name }}
                                </strong>
                                <img v-if="runner.personal.country?.abbr"
                                    :src="`https://flagcdn.com/${runner.personal.country.abbr.toLowerCase()}.svg`"
                                    style="width: 4.4cqw; height: 3.0cqw; object-fit: contain; display: inline-block;" />
                            </div>
                            <em style="color: #fff; font-size: 18cqw; font-weight: bold; font-style: normal;">{{
                                runner.bib }}</em>
                        </div>

                    </div>
                </div>
                <Alert v-else>
                    <AlertTitle>No runners found</AlertTitle>
                    <AlertDescription>
                        {{ stageID ? 'No runners found for this stage' : 'First select a stage' }}
                    </AlertDescription>
                </Alert>
            </div>

            <DialogFooter class="shrink-0 mt-4">
                <Button type="button" outline="outline" @click="showDialiog = false">
                    Cancel
                </Button>
                <Button type="button" @click="downloadPDF">
                    <DownloadIcon class="w-4 h-4 mr-2" />
                    Download PDF
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<style>
@media print {
    body {
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
}
</style>