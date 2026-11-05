import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import { useAxios } from '~/services/axios'
import { useAuthStore } from '~/store/auth'
import type { LocalImageItem, VariableItem } from './useEmailTemplateParser'

export interface EmailTemplateTestOptions {
    eventId: string
    subject: Ref<string>
    htmlContent: Ref<string>
    variables: Ref<VariableItem[]>
    localImages: Ref<LocalImageItem[]>
    attachStageGpx: Ref<boolean>
}

export function useEmailTemplateTest(options: EmailTemplateTestOptions) {
    const { eventId, subject, htmlContent, variables, localImages, attachStageGpx } = options

    const { axios } = useAxios()
    const authStore = useAuthStore()

    const testEmailDialogOpen = ref(false)
    const testEmailRecipient = ref('')
    const testEmailStageId = ref('')
    const isSendingTestEmail = ref(false)

    const openTestEmailDialog = () => {
        if (!testEmailRecipient.value) {
            testEmailRecipient.value = authStore.user?.personal?.email || ''
        }
        testEmailDialogOpen.value = true
    }

    const sendTestEmail = async () => {
        if (!testEmailRecipient.value || !testEmailRecipient.value.trim()) {
            toast.error('Please enter a recipient email address')
            return
        }

        if (!subject.value) {
            toast.error('Please enter a subject first')
            return
        }

        if (!htmlContent.value) {
            toast.error('Please provide HTML template content')
            return
        }

        // Check if any active variables are unmapped
        if (variables.value.some(v => v.isUsed !== false && !v.mappedTo)) {
            toast.error('Please map all active variables before sending a test email')
            return
        }

        // Check if any local images are not uploaded
        if (localImages.value.some(i => !i.uploadedUrl)) {
            toast.error('Please upload or replace all local images before sending a test email')
            return
        }

        try {
            isSendingTestEmail.value = true

            const variableMap: Record<string, string> = {}
            variables.value.forEach(v => {
                variableMap[`{{${v.name}}}`] = v.mappedTo
            })

            let processedHtml = htmlContent.value
            localImages.value.forEach(img => {
                if (img.uploadedUrl) {
                    processedHtml = processedHtml.replace(img.src, img.uploadedUrl)
                }
            })

            await axios.post(`/events/${eventId}/email-template/test`, {
                testEmail: testEmailRecipient.value.trim(),
                subject: subject.value,
                htmlTemplate: processedHtml,
                variableMap,
                attachStageGpx: attachStageGpx.value,
                stageId: testEmailStageId.value || undefined
            })

            toast.success(`Test email sent to ${testEmailRecipient.value.trim()}`)
            testEmailDialogOpen.value = false
        } catch (err: any) {
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to send test email')
        } finally {
            isSendingTestEmail.value = false
        }
    }

    return {
        testEmailDialogOpen,
        testEmailRecipient,
        testEmailStageId,
        isSendingTestEmail,
        openTestEmailDialog,
        sendTestEmail
    }
}

