import { computed, onMounted, onUnmounted, nextTick, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import { useMediaStore } from '~/store/media'
import { useRuntimeConfig } from '#app'
import { storeToRefs } from 'pinia'
import type { LocalImageItem } from './useEmailTemplateParser'

export interface EmailTemplatePreviewOptions {
    htmlContent: Ref<string>
    activeTab: Ref<string>
    codeEditorRef: Ref<any>
    localImages?: Ref<LocalImageItem[]>
    parseTemplate: (html: string) => void
}

export function useEmailTemplatePreview(options: EmailTemplatePreviewOptions) {
    const { htmlContent, activeTab, codeEditorRef, localImages, parseTemplate } = options

    const mediaStore = useMediaStore()
    const { media } = storeToRefs(mediaStore)
    const config = useRuntimeConfig()

    const previewHtml = computed(() => {
        if (!htmlContent.value) return ''
        return htmlContent.value + `
        <style>
            #_var_tooltip {
                position: absolute;
                background: #111827;
                color: white;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                display: none;
                z-index: 99999;
                font-family: system-ui, sans-serif;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                overflow: hidden;
            }
            .tooltip-btn {
                padding: 6px 10px;
            }
            .tooltip-btn:hover {
                background: #374151;
            }
            ._preview_text_editable {
                transition: outline 0.15s ease, background-color 0.15s ease;
                border-radius: 2px;
            }
            ._preview_text_editable:hover {
                outline: 1.5px dashed #3b82f6 !important;
                cursor: text !important;
            }
            ._preview_text_editable:focus {
                outline: 2px solid #2563eb !important;
                background-color: rgba(59, 130, 246, 0.06) !important;
            }
        </style>
        <div id="_var_tooltip"></div>
        <script>
            let currentSelection = '';
            document.addEventListener('selectionchange', () => {
                const selection = window.getSelection();
                const tooltip = document.getElementById('_var_tooltip');
                currentSelection = selection ? selection.toString().trim() : '';
                if (currentSelection.length > 0) {
                    try {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        tooltip.innerHTML = '<div class="tooltip-btn" onmousedown="createVar(event)">Make Variable</div>';
                        tooltip.style.display = 'block';
                        tooltip.style.flexDirection = 'row';
                        tooltip.style.top = (rect.top + window.scrollY - 30) + 'px';
                        tooltip.style.left = (rect.left + window.scrollX + (rect.width / 2) - (tooltip.offsetWidth / 2)) + 'px';
                    } catch(e) {}
                }
            });
            
            document.addEventListener('click', (e) => {
                const tooltip = document.getElementById('_var_tooltip');
                if (e.target.tagName === 'IMG') {
                    e.preventDefault();
                    window.currentImageSrc = e.target.getAttribute('src');
                    const rect = e.target.getBoundingClientRect();
                    tooltip.style.display = 'flex';
                    tooltip.style.flexDirection = 'column';
                    tooltip.innerHTML = '<div class="tooltip-btn" onmousedown="imgAction(event, \\'variable\\')">Make Variable</div><div class="tooltip-btn" onmousedown="imgAction(event, \\'upload\\')">Change Image</div>';
                    
                    tooltip.style.top = (rect.top + window.scrollY + (rect.height / 2) - (tooltip.offsetHeight / 2)) + 'px';
                    tooltip.style.left = (rect.left + window.scrollX + (rect.width / 2) - (tooltip.offsetWidth / 2)) + 'px';
                } else if (!tooltip.contains(e.target)) {
                    if (currentSelection.length === 0) {
                        tooltip.style.display = 'none';
                    }
                }
            });

            // Prevent links from navigating away inside preview
            document.addEventListener('click', (e) => {
                const link = e.target.closest('a');
                if (link) {
                    e.preventDefault();
                }
            });

            // Initialize inline text editing on leaf text elements
            function initEditableElements() {
                const selector = 'h1, h2, h3, h4, h5, h6, p, td, th, li, a, span, b, strong, em, i, label, div';
                const candidates = document.querySelectorAll(selector);
                candidates.forEach(el => {
                    if (el.closest('#_var_tooltip')) return;

                    // Only make leaf text elements editable (no nested candidate elements)
                    const hasNestedCandidate = el.querySelectorAll(selector).length > 0;
                    if (!hasNestedCandidate && el.innerText && el.innerText.trim().length > 0) {
                        el.setAttribute('contenteditable', 'plaintext-only');
                        el.classList.add('_preview_text_editable');

                        let originalText = '';
                        let originalRawHtml = '';

                        el.addEventListener('focus', () => {
                            originalText = el.innerText;
                            originalRawHtml = el.innerHTML;
                        });

                        el.addEventListener('blur', () => {
                            const currentText = el.innerText;
                            if (originalRawHtml && (currentText !== originalText || currentText !== originalRawHtml)) {
                                window.parent.postMessage({
                                    type: 'TEXT_EDITED',
                                    oldText: originalText,
                                    oldRawHtml: originalRawHtml,
                                    newText: currentText,
                                    tagName: el.tagName.toLowerCase()
                                }, '*');
                                originalText = currentText;
                                originalRawHtml = el.innerHTML;
                            }
                        });

                        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'strong', 'em', 'b', 'i', 'label'].includes(el.tagName.toLowerCase())) {
                            el.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                e.preventDefault();
                                el.blur();
                            }
                        });
                    }
                }
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initEditableElements);
        } else {
            initEditableElements();
        }

        function createVar(e) {
            e.preventDefault();
            if (currentSelection.length > 0) {
                window.parent.postMessage({ type: 'CREATE_VAR', text: currentSelection }, '*');
            }
            document.getElementById('_var_tooltip').style.display = 'none';
        }

        function imgAction(e, action) {
            e.preventDefault();
            window.parent.postMessage({ type: 'IMAGE_ACTION', action: action, src: window.currentImageSrc }, '*');
            document.getElementById('_var_tooltip').style.display = 'none';
        }

        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'FIND_VARIABLE') {
                const needle = '{{' + e.data.varName + '}}';
                const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, td, th, li, a, span, b, strong, em, i, label, div');
                let targetEl = null;
                for (const el of elements) {
                    if (el.innerText && el.innerText.includes(needle)) {
                        targetEl = el;
                        const deeper = el.querySelectorAll('*');
                        for (const child of deeper) {
                            if (child.innerText && child.innerText.includes(needle)) {
                                targetEl = child;
                            }
                        }
                        break;
                    }
                }
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const originalOutline = targetEl.style.outline;
                    const originalBg = targetEl.style.backgroundColor;
                    const originalTransition = targetEl.style.transition;
                    targetEl.style.transition = 'all 0.3s ease';
                    targetEl.style.outline = '3px solid #f59e0b';
                    targetEl.style.backgroundColor = 'rgba(245, 158, 11, 0.25)';
                    setTimeout(() => {
                        targetEl.style.outline = originalOutline;
                        targetEl.style.backgroundColor = originalBg;
                        targetEl.style.transition = originalTransition;
                    }, 2500);
                }
            }
        });
    <` + `/script>
    `
    })

    const createVariableWithPrompt = (selectedText: string, isCodeEditor = false) => {
        if (!selectedText) {
            toast.error('Please select some text first.')
            return
        }
        const varName = prompt(`Create variable for "${selectedText}"\n\nEnter variable name (e.g. first_name):`)
        if (!varName) return

        if (isCodeEditor && codeEditorRef.value) {
            const start = codeEditorRef.value.selectionStart
            const end = codeEditorRef.value.selectionEnd
            const before = htmlContent.value.substring(0, start)
            const after = htmlContent.value.substring(end)
            htmlContent.value = before + `{{${varName}}}` + after
            parseTemplate(htmlContent.value)
            toast.success('Variable created!')
        } else {
            if (htmlContent.value.includes(selectedText)) {
                htmlContent.value = htmlContent.value.replace(selectedText, `{{${varName}}}`)
                parseTemplate(htmlContent.value)
                toast.success('Variable created!')
            } else {
                toast.error('Could not find the exact text in the HTML source. Try selecting simpler text or use the Code Editor.')
            }
        }
    }

    const handleCodeEditorVariable = () => {
        if (codeEditorRef.value) {
            const start = codeEditorRef.value.selectionStart
            const end = codeEditorRef.value.selectionEnd
            if (start !== end) {
                const selectedText = htmlContent.value.substring(start, end)
                createVariableWithPrompt(selectedText, true)
            } else {
                toast.error('Please select some text in the Code Editor first.')
            }
        }
    }

    const handleCodeEditorKeyDown = (e: KeyboardEvent) => {
        // Allow Tab key to indent with 2 spaces instead of leaving textarea
        if (e.key === 'Tab' && codeEditorRef.value) {
            e.preventDefault()
            const textarea = codeEditorRef.value
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const val = htmlContent.value
            htmlContent.value = val.substring(0, start) + '  ' + val.substring(end)
            nextTick(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 2
            })
        }
    }

    const replaceImageSrc = (oldSrc: string, newSrc: string) => {
        if (!oldSrc) return
        if (htmlContent.value.includes(`src="${oldSrc}"`)) {
            htmlContent.value = htmlContent.value.replace(`src="${oldSrc}"`, `src="${newSrc}"`)
        } else if (htmlContent.value.includes(`src='${oldSrc}'`)) {
            htmlContent.value = htmlContent.value.replace(`src='${oldSrc}'`, `src='${newSrc}'`)
        } else {
            htmlContent.value = htmlContent.value.replace(oldSrc, newSrc)
        }
        parseTemplate(htmlContent.value)
    }

    const selectImageForSrc = (src: string) => {
        media.value.show = true
        media.value.mode = 'image'
        media.value.isMultiple = false
        media.value.action = async () => {
            if (media.value.selectedImages && media.value.selectedImages.length > 0) {
                const selectedImageId = media.value.selectedImages[0]
                try {
                    const image = await mediaStore.fetchImage(selectedImageId)
                    const newUrl = `${config.public.serverUrl}resources/images/${image.file_name}`
                    replaceImageSrc(src, newUrl)
                    toast.success('Image replaced successfully!')
                } catch (error) {
                    toast.error('Failed to fetch image details')
                }
            }
            media.value.show = false
        }
    }

    const selectFromMediaLibrary = (index: number) => {
        if (localImages?.value && localImages.value[index]) {
            selectImageForSrc(localImages.value[index].src)
        }
    }

    const handleIframeMessage = (e: MessageEvent) => {
        if (!e.data) return
        if (e.data.type === 'CREATE_VAR') {
            createVariableWithPrompt(e.data.text.trim())
        } else if (e.data.type === 'IMAGE_ACTION') {
            const src = e.data.src
            if (e.data.action === 'variable') {
                const varName = prompt(`Create variable for image source\n\nEnter variable name (e.g. hero_image):`)
                if (varName) {
                    replaceImageSrc(src, `{{${varName}}}`)
                    toast.success('Image variable created!')
                }
            } else if (e.data.action === 'upload') {
                selectImageForSrc(src)
            }
        } else if (e.data.type === 'TEXT_EDITED') {
            if (activeTab.value !== 'preview') return

            const { oldText, oldRawHtml, newText, tagName } = e.data
            if (newText === undefined) return

            let updated = false
            let html = htmlContent.value

            // 1. Try exact raw HTML match (replaces exact whitespace, newlines, &nbsp; inside the element)
            if (oldRawHtml && oldRawHtml !== newText && html.includes(oldRawHtml)) {
                html = html.replace(oldRawHtml, newText)
                updated = true
            }

            // 2. Try exact oldText match
            if (!updated && oldText && oldText !== newText && html.includes(oldText)) {
                html = html.replace(oldText, newText)
                updated = true
            }

            // 3. Try flexible whitespace matching (handles newlines, tabs, multiple spaces, &nbsp;)
            if (!updated && (oldText || oldRawHtml)) {
                const textToMatch = (oldText || oldRawHtml).trim()
                if (textToMatch) {
                    const words = textToMatch
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    if (words.length > 0) {
                        const pattern = `(?:\\s|&nbsp;)*` + words.join(`(?:\\s|&nbsp;)+`) + `(?:\\s|&nbsp;)*`
                        const regex = new RegExp(pattern)
                        if (regex.test(html)) {
                            html = html.replace(regex, newText)
                            updated = true
                        }
                    }
                }
            }

            // 4. Fallback: match inside tag if tagName was provided
            if (!updated && tagName && oldText) {
                const trimmedOld = oldText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                if (trimmedOld) {
                    const tagRegex = new RegExp(`(<${tagName}[^>]*>)[\\s\\S]*?(${trimmedOld})[\\s\\S]*?(<\\/${tagName}>)`, 'i')
                    if (tagRegex.test(html)) {
                        html = html.replace(tagRegex, `$1${newText}$3`)
                        updated = true
                    }
                }
            }

            if (updated) {
                htmlContent.value = html
                parseTemplate(html)
                toast.success('Text updated in template!')
            } else {
                toast.error('Could not find the exact text in template HTML. Use the Code Editor to edit.')
            }
        }
    }

    const locateVariable = (varName: string) => {
        const placeholder = `{{${varName}}}`

        // Scroll the editor into view smoothly if needed
        if (typeof document !== 'undefined') {
            const editorEl = document.getElementById('template-editor-container')
            if (editorEl) {
                editorEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }

        if (activeTab.value === 'code') {
            codeEditorRef.value?.findText(placeholder)
        } else {
            const iframe = document.querySelector('iframe[title="Email Preview"]') as HTMLIFrameElement
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'FIND_VARIABLE',
                    varName
                }, '*')
            }
        }
    }

    onMounted(() => {
        window.addEventListener('message', handleIframeMessage)
    })

    onUnmounted(() => {
        window.removeEventListener('message', handleIframeMessage)
    })

    return {
        previewHtml,
        handleIframeMessage,
        createVariableWithPrompt,
        handleCodeEditorVariable,
        handleCodeEditorKeyDown,
        replaceImageSrc,
        selectImageForSrc,
        selectFromMediaLibrary,
        locateVariable
    }
}

