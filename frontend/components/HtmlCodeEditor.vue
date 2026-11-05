<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import hljs from 'highlight.js'
import {
    SearchIcon,
    Maximize2Icon,
    Minimize2Icon,
    ChevronUpIcon,
    ChevronDownIcon,
    WrapTextIcon,
    XIcon
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{
    modelValue: string
    placeholder?: string
    theme?: 'dark' | 'light'
    wordWrap?: boolean
}>(), {
    modelValue: '',
    placeholder: 'Enter HTML template here...',
    theme: 'dark',
    wordWrap: true
})

const emit = defineEmits<{
    (e: 'update:modelValue', val: string): void
    (e: 'input', val: string): void
    (e: 'keydown', ev: KeyboardEvent): void
}>()

const activeTheme = ref<'dark' | 'light'>(props.theme)
const isWordWrap = ref(props.wordWrap)
const isFullscreen = ref(false)
const showFind = ref(false)
const searchQuery = ref('')
const searchCaseSensitive = ref(false)
const activeMatchIndex = ref(0)

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const preRef = ref<HTMLPreElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const measureRef = ref<HTMLDivElement | null>(null)
const lineHeights = ref<number[]>([])

const rawLines = computed(() => {
    return (props.modelValue || '').split('\n')
})

const lineCount = computed(() => {
    return rawLines.value.length
})

let rafId: number | null = null
const updateLineHeights = () => {
    if (typeof window === 'undefined') return
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
        if (!isWordWrap.value || !textareaRef.value || !measureRef.value) {
            lineHeights.value = []
            return
        }
        const contentWidth = textareaRef.value.clientWidth - 32
        if (contentWidth <= 0) return

        measureRef.value.style.width = contentWidth + 'px'
        const children = measureRef.value.children
        const heights: number[] = new Array(children.length)
        for (let i = 0; i < children.length; i++) {
            heights[i] = (children[i] as HTMLElement).offsetHeight || 20
        }
        lineHeights.value = heights
    })
}

const toggleWordWrap = () => {
    isWordWrap.value = !isWordWrap.value
    nextTick(() => {
        updateLineHeights()
        syncScroll()
    })
}

interface MatchRange {
    start: number
    end: number
}

// Find matches in the raw text
const matches = computed<MatchRange[]>(() => {
    if (!searchQuery.value) return []
    const text = props.modelValue || ''
    const query = searchQuery.value
    const isCase = searchCaseSensitive.value
    const searchText = isCase ? text : text.toLowerCase()
    const target = isCase ? query : query.toLowerCase()

    const results: MatchRange[] = []
    let pos = 0
    while ((pos = searchText.indexOf(target, pos)) !== -1) {
        results.push({ start: pos, end: pos + target.length })
        pos += target.length
    }
    return results
})

const highlightedHtml = computed(() => {
    const raw = props.modelValue || ''
    if (!raw) return ''
    try {
        let code = hljs.highlight(raw, { language: 'html' }).value
        
        // Highlight search matches safely in text nodes (outside HTML tags)
        if (searchQuery.value && searchQuery.value.trim().length > 0) {
            const escapedQuery = searchQuery.value.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
            const flags = searchCaseSensitive.value ? 'g' : 'gi'
            
            // Matches text between > and <
            code = code.replace(/(>)([^<]*?)(<)/g, (full, p1, text, p3) => {
                const replaced = text.replace(new RegExp(escapedQuery, flags), (m: string) => {
                    return `<mark class="search-highlight">${m}</mark>`
                })
                return p1 + replaced + p3
            })
        }

        // Highlight handlebars variables {{variable}} with an amber badge
        code = code.replace(/\{\{([#^/]?[\s\S]*?)\}\}/g, (match) => `<span class="template-var">${match}</span>`)

        // Ensure trailing newline renders matching height in <pre>
        if (raw.endsWith('\n')) {
            code += '<br>&nbsp;'
        }
        return code
    } catch (e) {
        return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
})

const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement
    emit('update:modelValue', target.value)
    emit('input', target.value)
    syncScroll()
}

const handleScroll = () => {
    syncScroll()
}

const syncScroll = () => {
    if (!textareaRef.value) return
    const { scrollTop, scrollLeft } = textareaRef.value
    if (preRef.value) {
        preRef.value.scrollTop = scrollTop
        preRef.value.scrollLeft = scrollLeft
    }
    if (gutterRef.value) {
        gutterRef.value.scrollTop = scrollTop
    }
}

const openFind = () => {
    showFind.value = true
    nextTick(() => {
        searchInputRef.value?.focus()
        searchInputRef.value?.select()
    })
}

const closeFind = () => {
    showFind.value = false
    textareaRef.value?.focus()
}

const nextMatch = () => {
    if (matches.value.length === 0) return
    activeMatchIndex.value = (activeMatchIndex.value + 1) % matches.value.length
    scrollToMatch(matches.value[activeMatchIndex.value], false)
}

const prevMatch = () => {
    if (matches.value.length === 0) return
    activeMatchIndex.value = (activeMatchIndex.value - 1 + matches.value.length) % matches.value.length
    scrollToMatch(matches.value[activeMatchIndex.value], false)
}

const scrollToMatch = (match: MatchRange, shouldFocus = false) => {
    if (!textareaRef.value || !match) return
    
    // Check if user is currently typing in the search input
    const isSearchFocused = typeof document !== 'undefined' && document.activeElement === searchInputRef.value

    if (shouldFocus && !isSearchFocused) {
        textareaRef.value.focus()
    }
    textareaRef.value.setSelectionRange(match.start, match.end)

    // Calculate vertical offset to scroll match into view
    const textBefore = props.modelValue.substring(0, match.start)
    const lineIndex = textBefore.split('\n').length - 1

    let targetScrollTop = 0
    if (isWordWrap.value && lineHeights.value.length > lineIndex) {
        let acc = 0
        for (let i = 0; i < lineIndex; i++) {
            acc += lineHeights.value[i] || 20
        }
        targetScrollTop = Math.max(0, acc - 120)
    } else {
        targetScrollTop = Math.max(0, lineIndex * 20 - 120)
    }

    textareaRef.value.scrollTop = targetScrollTop
    syncScroll()

    // Ensure search input never loses focus when typing or navigating matches
    if (isSearchFocused && searchInputRef.value) {
        searchInputRef.value.focus()
    }
}

watch(matches, (newMatches) => {
    if (newMatches.length > 0) {
        if (activeMatchIndex.value >= newMatches.length) {
            activeMatchIndex.value = 0
        }
        scrollToMatch(newMatches[activeMatchIndex.value], false)
    } else {
        activeMatchIndex.value = 0
    }
})

const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value
    nextTick(() => {
        syncScroll()
        updateLineHeights()
    })
}

const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+F or Ctrl+F to open Find
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        openFind()
        return
    }

    // Alt+Z to toggle Word Wrap
    if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        toggleWordWrap()
        return
    }

    // Escape to close Find or exit Fullscreen
    if (e.key === 'Escape') {
        if (showFind.value) {
            e.preventDefault()
            closeFind()
            return
        }
        if (isFullscreen.value) {
            e.preventDefault()
            isFullscreen.value = false
            return
        }
    }

    // F11 to toggle fullscreen
    if (e.key === 'F11') {
        e.preventDefault()
        toggleFullscreen()
        return
    }

    emit('keydown', e)
}

// Watch modelValue changes to keep scroll and line heights in sync
watch(() => props.modelValue, () => {
    nextTick(() => {
        syncScroll()
        updateLineHeights()
    })
})

watch(isWordWrap, () => {
    nextTick(updateLineHeights)
})

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
    nextTick(() => {
        updateLineHeights()
        if (textareaRef.value && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                updateLineHeights()
                syncScroll()
            })
            resizeObserver.observe(textareaRef.value)
        }
    })
})

onUnmounted(() => {
    if (resizeObserver) {
        resizeObserver.disconnect()
    }
    if (rafId) {
        cancelAnimationFrame(rafId)
    }
})

const findText = (query: string) => {
    searchQuery.value = query
    showFind.value = true
    nextTick(() => {
        searchInputRef.value?.focus()
        searchInputRef.value?.select()
        if (matches.value.length > 0) {
            activeMatchIndex.value = 0
            scrollToMatch(matches.value[0], true)
        }
    })
}

// Expose textarea properties so parent can access selectionStart, selectionEnd, focus
defineExpose({
    get selectionStart() { return textareaRef.value?.selectionStart ?? 0 },
    set selectionStart(val: number) { if (textareaRef.value) textareaRef.value.selectionStart = val },
    get selectionEnd() { return textareaRef.value?.selectionEnd ?? 0 },
    set selectionEnd(val: number) { if (textareaRef.value) textareaRef.value.selectionEnd = val },
    focus() { textareaRef.value?.focus() },
    openFind,
    findText,
    toggleFullscreen,
    toggleWordWrap,
    isWordWrap,
    textarea: textareaRef
})
</script>

<template>
    <div
        :class="[
            `theme-${activeTheme}`,
            isWordWrap ? 'code-editor-wrap' : 'code-editor-nowrap',
            isFullscreen ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none border-0' : 'relative w-full h-[600px] rounded-lg border'
        ]"
        class="code-editor-container shadow-sm overflow-hidden flex flex-col font-mono text-xs"
    >
        <!-- Editor Header Bar -->
        <div class="code-editor-header flex items-center justify-between px-3 py-1.5 border-b select-none text-[11px] shrink-0">
            <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px]">
                    <span class="w-2 h-2 rounded-full" :class="activeTheme === 'dark' ? 'bg-amber-400' : 'bg-primary'"></span>
                    HTML Code
                </span>
                <span class="opacity-40">|</span>
                <span class="opacity-60">{{ lineCount }} lines</span>
                <span class="opacity-40">·</span>
                <span class="opacity-60">{{ modelValue.length }} chars</span>
            </div>

            <div class="flex items-center gap-2">
                <!-- Word Wrap Toggle -->
                <button
                    type="button"
                    @click="toggleWordWrap"
                    class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors border cursor-pointer flex items-center gap-1"
                    :class="[
                        isWordWrap
                            ? (activeTheme === 'dark' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-primary/10 text-primary border-primary/30')
                            : (activeTheme === 'dark' ? 'bg-[#353b45] hover:bg-[#3e4451] text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300')
                    ]"
                    :title="isWordWrap ? 'Word Wrap: On (Alt+Z)' : 'Word Wrap: Off (Alt+Z)'"
                >
                    <WrapTextIcon class="w-3.5 h-3.5" />
                    <span>{{ isWordWrap ? 'Wrap: On' : 'Wrap: Off' }}</span>
                </button>

                <!-- Find Button -->
                <button
                    type="button"
                    @click="showFind ? closeFind() : openFind()"
                    class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors border cursor-pointer flex items-center gap-1"
                    :class="[
                        showFind
                            ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                            : (activeTheme === 'dark' ? 'bg-[#353b45] hover:bg-[#3e4451] text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300')
                    ]"
                    title="Find text in code (Cmd+F / Ctrl+F)"
                >
                    <SearchIcon class="w-3.5 h-3.5" />
                    <span>Find</span>
                </button>

                <!-- Theme Switcher -->
                <button
                    type="button"
                    @click="activeTheme = activeTheme === 'dark' ? 'light' : 'dark'"
                    class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors border cursor-pointer"
                    :class="activeTheme === 'dark' ? 'bg-[#353b45] hover:bg-[#3e4451] text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'"
                    :title="`Switch to ${activeTheme === 'dark' ? 'Light' : 'Dark'} mode`"
                >
                    <span v-if="activeTheme === 'dark'">☀️ Light</span>
                    <span v-else>🌙 Dark</span>
                </button>

                <!-- Fullscreen Button -->
                <button
                    type="button"
                    @click="toggleFullscreen"
                    class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors border cursor-pointer flex items-center gap-1"
                    :class="[
                        isFullscreen
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : (activeTheme === 'dark' ? 'bg-[#353b45] hover:bg-[#3e4451] text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300')
                    ]"
                    :title="isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen (F11)'"
                >
                    <Minimize2Icon v-if="isFullscreen" class="w-3.5 h-3.5" />
                    <Maximize2Icon v-else class="w-3.5 h-3.5" />
                    <span>{{ isFullscreen ? 'Exit Full Screen' : 'Full Screen' }}</span>
                </button>
            </div>
        </div>

        <!-- Floating Find Bar -->
        <div
            v-if="showFind"
            class="find-bar absolute top-9 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-lg border shadow-lg backdrop-blur"
            :class="activeTheme === 'dark' ? 'bg-[#21252b]/95 border-gray-700 text-gray-200' : 'bg-white/95 border-gray-300 text-gray-800'"
        >
            <SearchIcon class="w-3.5 h-3.5 opacity-50 ml-1 shrink-0" />
            <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="Find in code..."
                @keydown.enter.prevent="e => e.shiftKey ? prevMatch() : nextMatch()"
                @keydown.esc.prevent="closeFind"
                class="px-2 py-1 text-xs rounded border border-transparent focus:border-primary outline-none bg-transparent w-44"
            />

            <!-- Case sensitive toggle -->
            <button
                type="button"
                @mousedown.prevent
                @click="searchCaseSensitive = !searchCaseSensitive"
                class="px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer"
                :class="searchCaseSensitive ? 'bg-primary text-white border-primary' : 'opacity-60 hover:opacity-100 border-transparent'"
                title="Match Case"
            >
                Aa
            </button>

            <!-- Match counter -->
            <span class="text-[11px] px-1 font-mono shrink-0" :class="matches.length === 0 && searchQuery ? 'text-red-400' : 'opacity-60'">
                <template v-if="matches.length > 0">
                    {{ activeMatchIndex + 1 }}/{{ matches.length }}
                </template>
                <template v-else-if="searchQuery">
                    0/0
                </template>
            </span>

            <!-- Prev / Next buttons -->
            <button
                type="button"
                @mousedown.prevent
                @click="prevMatch"
                :disabled="matches.length === 0"
                class="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                title="Previous match (Shift+Enter)"
            >
                <ChevronUpIcon class="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                @mousedown.prevent
                @click="nextMatch"
                :disabled="matches.length === 0"
                class="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                title="Next match (Enter)"
            >
                <ChevronDownIcon class="w-3.5 h-3.5" />
            </button>

            <!-- Close Find -->
            <button
                type="button"
                @click="closeFind"
                class="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer ml-0.5"
                title="Close (Esc)"
            >
                <XIcon class="w-3.5 h-3.5" />
            </button>
        </div>

        <!-- Editor Body -->
        <div class="code-editor-body relative flex-grow overflow-hidden flex">
            <!-- Line Numbers Gutter -->
            <div
                ref="gutterRef"
                class="code-editor-gutter select-none py-3 px-2 text-right border-r font-mono text-xs overflow-hidden shrink-0"
                style="width: 48px; line-height: 20px;"
            >
                <div
                    v-for="(n, i) in lineCount"
                    :key="n"
                    class="opacity-40 leading-[20px]"
                    :style="isWordWrap && lineHeights[i] ? { height: lineHeights[i] + 'px' } : { height: '20px' }"
                >
                    {{ n }}
                </div>
            </div>

            <!-- Code & Textarea Area -->
            <div class="relative flex-grow overflow-hidden h-full">
                <!-- Highlighted code (underneath) -->
                <pre
                    ref="preRef"
                    aria-hidden="true"
                    class="code-editor-pre absolute inset-0 m-0 pointer-events-none overflow-hidden"
                ><code class="hljs language-html" v-html="highlightedHtml"></code></pre>

                <!-- Editable transparent textarea (on top) -->
                <textarea
                    ref="textareaRef"
                    :value="modelValue"
                    @input="handleInput"
                    @scroll="handleScroll"
                    @keydown="handleKeyDown"
                    spellcheck="false"
                    autocapitalize="off"
                    autocomplete="off"
                    :placeholder="placeholder"
                    class="code-editor-textarea absolute inset-0 m-0 w-full h-full resize-none"
                ></textarea>
            </div>
        </div>

        <!-- Hidden container to measure wrapped line heights accurately -->
        <div
            v-if="isWordWrap"
            ref="measureRef"
            aria-hidden="true"
            class="measure-container absolute pointer-events-none opacity-0 invisible -z-50 overflow-hidden"
            style="left: -9999px; top: 0;"
        >
            <div
                v-for="(line, idx) in rawLines"
                :key="idx"
                class="measure-line"
            >{{ line ? line : '\u00A0' }}</div>
        </div>
    </div>
</template>

<style scoped>
/* Base Pre & Textarea matching */
.code-editor-pre,
.code-editor-textarea {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    font-size: 13px !important;
    line-height: 20px !important;
    tab-size: 2 !important;
    letter-spacing: 0px !important;
    word-spacing: 0px !important;
    font-weight: 400 !important;
    font-variant-ligatures: none !important;
    font-feature-settings: normal !important;
    -webkit-font-smoothing: antialiased !important;
    -moz-osx-font-smoothing: grayscale !important;
    text-rendering: auto !important;
    padding: 12px 16px !important;
    box-sizing: border-box !important;
    border: none !important;
    outline: none !important;
    scrollbar-gutter: stable;
}

/* Word wrap modes */
.code-editor-wrap .code-editor-pre,
.code-editor-wrap .code-editor-textarea {
    white-space: pre-wrap !important;
    word-break: break-word !important;
    overflow-wrap: break-word !important;
}

.code-editor-nowrap .code-editor-pre,
.code-editor-nowrap .code-editor-textarea {
    white-space: pre !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
}

.code-editor-wrap .code-editor-textarea {
    overflow-y: auto !important;
    overflow-x: hidden !important;
}

.code-editor-nowrap .code-editor-textarea {
    overflow-y: auto !important;
    overflow-x: auto !important;
}

/* Line height measurement helper */
.measure-container {
    box-sizing: border-box !important;
    padding: 0 !important;
}

.measure-line {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    font-size: 13px !important;
    line-height: 20px !important;
    tab-size: 2 !important;
    letter-spacing: 0px !important;
    word-spacing: 0px !important;
    font-weight: 400 !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
    overflow-wrap: break-word !important;
    box-sizing: border-box !important;
    min-height: 20px !important;
    padding: 0 !important;
    margin: 0 !important;
}

:deep(.code-editor-pre) code,
:deep(.code-editor-pre) span,
:deep(.code-editor-pre) mark,
.code-editor-pre :deep(code),
.code-editor-pre :deep(span),
.code-editor-pre :deep(mark) {
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    letter-spacing: inherit !important;
    word-spacing: inherit !important;
    font-weight: inherit !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    background: transparent;
}

.code-editor-textarea {
    background: transparent !important;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
}

/* Search Highlights */
:deep(.search-highlight) {
    background-color: rgba(234, 179, 8, 0.45);
    color: inherit;
    border-radius: 2px;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
}

/* Dark Theme */
.theme-dark {
    background-color: #282c34;
    color: #abb2bf;
    border-color: #3e4451;
}
.theme-dark .code-editor-header {
    background-color: #21252b;
    border-color: #181a1f;
    color: #abb2bf;
}
.theme-dark .code-editor-gutter {
    background-color: #21252b;
    border-color: #181a1f;
    color: #5c6370;
}
.theme-dark .code-editor-textarea {
    caret-color: #f06723;
}
.theme-dark .code-editor-textarea::selection {
    background-color: rgba(64, 120, 242, 0.4);
    color: transparent;
    -webkit-text-fill-color: transparent;
}
.theme-dark :deep(.hljs) {
    background: transparent;
    color: #abb2bf;
}
.theme-dark :deep(.hljs-comment),
.theme-dark :deep(.hljs-quote) {
    color: #5c6370;
    font-style: italic;
}
.theme-dark :deep(.hljs-tag) {
    color: #abb2bf;
}
.theme-dark :deep(.hljs-name) {
    color: #e06c75;
}
.theme-dark :deep(.hljs-attr) {
    color: #d19a66;
}
.theme-dark :deep(.hljs-string) {
    color: #98c379;
}
.theme-dark :deep(.hljs-meta),
.theme-dark :deep(.hljs-keyword) {
    color: #c678dd;
}
.theme-dark :deep(.template-var) {
    background-color: rgba(245, 158, 11, 0.22);
    color: #fbbf24;
    border-radius: 2px;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    outline: 1px solid rgba(245, 158, 11, 0.5);
    outline-offset: 0px;
}

/* Light Theme */
.theme-light {
    background-color: #fafafa;
    color: #383a42;
    border-color: #e5e7eb;
}
.theme-light .code-editor-header {
    background-color: #f3f4f6;
    border-color: #e5e7eb;
    color: #374151;
}
.theme-light .code-editor-gutter {
    background-color: #f3f4f6;
    border-color: #e5e7eb;
    color: #9ca3af;
}
.theme-light .code-editor-textarea {
    caret-color: #f06723;
}
.theme-light .code-editor-textarea::selection {
    background-color: rgba(64, 120, 242, 0.25);
    color: transparent;
    -webkit-text-fill-color: transparent;
}
.theme-light :deep(.hljs) {
    background: transparent;
    color: #383a42;
}
.theme-light :deep(.hljs-comment),
.theme-light :deep(.hljs-quote) {
    color: #a0a1a7;
    font-style: italic;
}
.theme-light :deep(.hljs-tag) {
    color: #383a42;
}
.theme-light :deep(.hljs-name) {
    color: #e45649;
}
.theme-light :deep(.hljs-attr) {
    color: #986801;
}
.theme-light :deep(.hljs-string) {
    color: #50a14f;
}
.theme-light :deep(.hljs-meta),
.theme-light :deep(.hljs-keyword) {
    color: #a626a4;
}
.theme-light :deep(.template-var) {
    background-color: rgba(245, 158, 11, 0.18);
    color: #b45309;
    border-radius: 2px;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    outline: 1px solid rgba(245, 158, 11, 0.4);
    outline-offset: 0px;
}
</style>
