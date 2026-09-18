<script lang="ts" setup>
import { useAxios } from '~/services/axios'
import { LoaderIcon, RefreshCcwIcon } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

definePageMeta({
    layout: 'admin',
    middleware: 'auth',
    authorization: '*',
    role: 'Admin'
})

const { axios } = useAxios()
const isLoading = ref(true)

interface EmailLog {
    id: string
    recipient: string
    subject: string
    status: 'SUCCESS' | 'FAILED' | 'WAITING' | 'ACTIVE' | 'DELAYED' | 'QUEUED'
    error: string | null
    created_at: string
    payload?: any
    parentId?: string | null
}

const counts = ref<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
    paused: number
}>({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0
})

const logs = ref<EmailLog[]>([])

const fetchCountsAndLogs = async () => {
    isLoading.value = true
    try {
        const { data } = await axios.get('/queues')
        counts.value = data.email
        logs.value = data.logs
    } catch (e) {
        console.error('Failed to fetch queues', e)
    } finally {
        isLoading.value = false
    }
}

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
}

const getBadgeVariant = (status: string) => {
    switch (status) {
        case 'SUCCESS': return 'default'
        case 'FAILED': return 'destructive'
        case 'ACTIVE': return 'info'
        case 'WAITING': return 'secondary'
        case 'DELAYED': return 'outline'
        default: return 'outline'
    }
}

const selectedError = ref<string | null>(null)

const resendLog = ref<EmailLog | null>(null)
const newRecipientEmail = ref('')
const isResending = ref(false)

const openResendDialog = (log: EmailLog) => {
    resendLog.value = log
    newRecipientEmail.value = log.recipient
}

const submitResend = async () => {
    if (!resendLog.value) return
    isResending.value = true
    try {
        await axios.post(`/queues/${resendLog.value.id}/resend`, {
            newRecipientEmail: newRecipientEmail.value !== resendLog.value.recipient ? newRecipientEmail.value : undefined
        })
        await fetchCountsAndLogs()
        resendLog.value = null
    } catch (e: any) {
        console.error('Failed to resend email', e)
        alert(e.response?.data?.error || 'Failed to resend email. It might not have a payload stored.')
    } finally {
        isResending.value = false
    }
}

onMounted(() => {
    fetchCountsAndLogs()
})
</script>

<template>
    <div class="p-6 max-w-6xl mx-auto space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">Email Queue</h1>
                <p class="text-muted-foreground mt-1 text-sm">Real-time statistics for background email processing and
                    recent logs.</p>
            </div>
            <Button outliine="outline" size="sm" @click="fetchCountsAndLogs" :disabled="isLoading">
                <RefreshCcwIcon class="w-4 h-4 mr-2" :class="{ 'animate-spin': isLoading }" />
                Refresh
            </Button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" v-if="!isLoading">
            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground">Waiting</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{{ counts.waiting }}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground">Active</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold text-blue-600">{{ counts.active }}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold text-green-600">{{ counts.completed }}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold text-red-600">{{ counts.failed }}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground">Delayed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold text-orange-500">{{ counts.delayed }}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground">Paused</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{{ counts.paused }}</div>
                </CardContent>
            </Card>
        </div>

        <div class="flex justify-center p-12" v-else-if="isLoading && !logs.length">
            <LoaderIcon class="w-8 h-8 animate-spin text-muted-foreground" />
        </div>

        <div class="mt-8" v-if="!isLoading || logs.length">
            <h2 class="text-lg font-semibold mb-4">Recent Email Logs</h2>
            <div class="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead class="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="log in logs" :key="log.id">
                            <TableCell class="whitespace-nowrap">{{ formatDate(log.created_at) }}</TableCell>
                            <TableCell>{{ log.recipient }}</TableCell>
                            <TableCell class="max-w-xs truncate" :title="log.subject">{{ log.subject }}</TableCell>
                            <TableCell>
                                <Badge :variant="getBadgeVariant(log.status)">
                                    {{ log.status }}
                                </Badge>
                                <div v-if="log.error"
                                    class="text-xs text-red-500 mt-1 truncate max-w-[200px] cursor-pointer hover:underline"
                                    @click="selectedError = log.error" title="Click to view full error">
                                    {{ log.error }}
                                </div>
                                <div v-if="log.parentId" class="text-[10px] text-muted-foreground mt-1"
                                    :title="'Resent from: ' + log.parentId">
                                    Resent Email
                                </div>
                            </TableCell>
                            <TableCell class="text-right">
                                <Button v-if="log.payload" modifier="outline" size="sm" @click="openResendDialog(log)">
                                    Resend
                                </Button>
                            </TableCell>
                        </TableRow>
                        <TableRow v-if="!logs.length">
                            <TableCell colspan="4" class="h-24 text-center">
                                No email logs found.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>

        <Dialog :open="selectedError !== null" @update:open="selectedError = null">
            <DialogContent class="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Error Details</DialogTitle>
                </DialogHeader>
                <div
                    class="mt-4 p-4 bg-muted rounded-md overflow-auto max-h-96 text-sm font-mono whitespace-pre-wrap break-words">
                    {{ selectedError }}
                </div>
                <DialogFooter>
                    <Button @click="selectedError = null">Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog :open="resendLog !== null" @update:open="resendLog = null">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Resend Email</DialogTitle>
                </DialogHeader>
                <div class="space-y-4 py-4" v-if="resendLog">
                    <div class="space-y-2">
                        <Label>Recipient Email</Label>
                        <Input v-model="newRecipientEmail" placeholder="Enter recipient email" />
                        <p class="text-xs text-muted-foreground">You can change the email address before resending.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button modifier="outline" @click="resendLog = null" :disabled="isResending">Cancel</Button>
                    <Button @click="submitResend" :disabled="isResending">
                        <LoaderIcon v-if="isResending" class="w-4 h-4 mr-2 animate-spin" />
                        Send Now
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>
