<script lang="ts" setup>
import { useAxios } from '~/services/axios'
import {
    LoaderIcon,
    RefreshCcwIcon,
    SearchIcon,
    XIcon,
    SendIcon,
    CheckCircle2Icon,
    ShieldCheckIcon,
    ZapIcon,
    MailIcon
} from 'lucide-vue-next'
import { watchDebounced } from '@vueuse/core'
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import moment from 'moment'

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
    recipient_name?: string | null
    subject: string
    status: 'SUCCESS' | 'FAILED' | 'WAITING' | 'ACTIVE' | 'DELAYED' | 'QUEUED'
    error: string | null
    created_at: string
    payload?: any
    parentId?: string | null
}

interface QuotaBucket {
    used: number
    limit: number
    remaining: number
    percentage: number
}

interface QuotaData {
    source?: string
    today: QuotaBucket
    month: QuotaBucket
    hour: { limit: number; note: string }
    domain: { name: string; status: string; verified: boolean }
    provider: string
}

const quota = ref<QuotaData | null>(null)

const page = ref(1)
const limit = ref(20)
const total = ref(0)
const statusFilter = ref<string>('failed')
const searchQuery = ref('')

const dateFilter = ref('all')
const startDate = ref('')
const endDate = ref('')

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
        const { data } = await axios.get('/queues', {
            params: {
                page: page.value,
                limit: limit.value,
                status: statusFilter.value,
                startDate: startDate.value || undefined,
                endDate: endDate.value || undefined,
                search: searchQuery.value?.trim() || undefined
            }
        })
        counts.value = data.email
        logs.value = data.logs
        total.value = data.total
        if (data.quota) {
            quota.value = data.quota
        }
    } catch (e) {
        console.error('Failed to fetch queues', e)
    } finally {
        isLoading.value = false
    }
}

watchDebounced(searchQuery, () => {
    page.value = 1
    fetchCountsAndLogs()
}, { debounce: 400 })

const applyDateFilter = () => {
    switch (dateFilter.value) {
        case 'today':
            startDate.value = moment().startOf('day').toISOString();
            endDate.value = moment().endOf('day').toISOString();
            break;
        case 'this_week':
            startDate.value = moment().startOf('week').toISOString();
            endDate.value = moment().endOf('week').toISOString();
            break;
        case 'this_month':
            startDate.value = moment().startOf('month').toISOString();
            endDate.value = moment().endOf('month').toISOString();
            break;
        case 'this_year':
            startDate.value = moment().startOf('year').toISOString();
            endDate.value = moment().endOf('year').toISOString();
            break;
        case 'all':
            startDate.value = '';
            endDate.value = '';
            break;
        case 'custom':
            // user picks from the date inputs directly
            break;
    }
    if (dateFilter.value !== 'custom') {
        page.value = 1;
        fetchCountsAndLogs();
    }
}

const handleTabChange = (status: string | number) => {
    statusFilter.value = String(status)
    page.value = 1
    fetchCountsAndLogs()
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
        toast.success('Email queued for resending!')
        await fetchCountsAndLogs()
        resendLog.value = null
    } catch (e: any) {
        console.error('Failed to resend email', e)
        toast.error(e.response?.data?.error || 'Failed to resend email. It might not have a payload stored.')
    } finally {
        isResending.value = false
    }
}

const sendImmediateDialogOpen = ref(false)
const isSendingImmediate = ref(false)
const immediateForm = ref({
    to: '',
    subject: '',
    senderEmail: 'info@trailmandu.com',
    isHtml: true,
    content: ''
})

const openSendImmediateDialog = () => {
    immediateForm.value = {
        to: '',
        subject: '',
        senderEmail: 'info@trailmandu.com',
        isHtml: true,
        content: ''
    }
    sendImmediateDialogOpen.value = true
}

const submitSendImmediate = async () => {
    if (!immediateForm.value.to || !immediateForm.value.to.trim()) {
        toast.error('Please enter a recipient email address')
        return
    }
    if (!immediateForm.value.subject || !immediateForm.value.subject.trim()) {
        toast.error('Please enter an email subject')
        return
    }
    if (!immediateForm.value.content || !immediateForm.value.content.trim()) {
        toast.error('Please enter email message content')
        return
    }

    isSendingImmediate.value = true
    try {
        await axios.post('/queues/send-immediate', {
            to: immediateForm.value.to.trim(),
            subject: immediateForm.value.subject.trim(),
            senderEmail: immediateForm.value.senderEmail?.trim() || undefined,
            html: immediateForm.value.isHtml ? immediateForm.value.content : undefined,
            text: !immediateForm.value.isHtml ? immediateForm.value.content : undefined
        })
        toast.success('Email dispatched and queued for immediate delivery!')
        sendImmediateDialogOpen.value = false
        await fetchCountsAndLogs()
    } catch (e: any) {
        toast.error(e.response?.data?.error || 'Failed to send email immediately')
    } finally {
        isSendingImmediate.value = false
    }
}

const sendJobImmediately = async (log: EmailLog) => {
    try {
        const { data } = await axios.post(`/queues/${log.id}/promote`)
        toast.success(data?.message || 'Queued email scheduled to send immediately!')
        await fetchCountsAndLogs()
    } catch (e: any) {
        const msg = e.response?.data?.error?.message || e.response?.data?.error || e.response?.data?.message || 'Failed to send email immediately'
        toast.error(msg)
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
            <div class="flex flex-col sm:flex-row items-center gap-4">
                <Select v-model="dateFilter" @update:modelValue="applyDateFilter">
                    <SelectTrigger class="w-[180px]">
                        <SelectValue placeholder="Date Filter" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="this_year">This Year</SelectItem>
                        <SelectItem value="custom">Custom Date</SelectItem>
                    </SelectContent>
                </Select>

                <div v-if="dateFilter === 'custom'" class="flex gap-2">
                    <Input type="date" v-model="startDate" />
                    <Input type="date" v-model="endDate" />
                    <Button @click="page = 1; fetchCountsAndLogs()">Apply</Button>
                </div>

                <Button modifier="outline" size="sm" @click="fetchCountsAndLogs" :disabled="isLoading">
                    <RefreshCcwIcon class="w-4 h-4 mr-2" :class="{ 'animate-spin': isLoading }" />
                    Refresh
                </Button>

                <Button size="sm" @click="openSendImmediateDialog" class="cursor-pointer bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5 shadow-sm">
                    <SendIcon class="w-4 h-4" />
                    <span>Send Email Immediately</span>
                </Button>
            </div>
        </div>

        <!-- Email Sending Quota Overview -->
        <div v-if="quota" class="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b">
                <div class="flex items-center gap-2.5">
                    <div class="p-2 bg-primary/10 text-primary rounded-lg">
                        <MailIcon class="w-5 h-5" />
                    </div>
                    <div>
                        <h2 class="text-base font-semibold text-foreground flex items-center gap-2">
                            <span>Email Sending Quota</span>
                            <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <ShieldCheckIcon class="w-3.5 h-3.5" />
                                <span>{{ quota.provider }} • {{ quota.domain.name }} ({{ quota.domain.status }})</span>
                            </span>
                        </h2>
                        <p class="text-xs text-muted-foreground mt-0.5">
                            Real-time delivery statistics & account limits (source: {{ quota.source === 'mailtrap' ? 'Mailtrap Live API' : 'Application Database' }}).
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted font-mono">
                        <ZapIcon class="w-3.5 h-3.5 text-amber-500" />
                        <span>Throughput: {{ quota.hour.limit }}/hr max</span>
                    </span>
                </div>
            </div>

            <!-- Quota Metrics Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Daily Quota -->
                <div class="p-4 rounded-lg bg-muted/40 border border-border/60 space-y-2">
                    <div class="flex items-center justify-between text-xs font-medium">
                        <span class="text-muted-foreground">Today's Daily Quota</span>
                        <span class="font-semibold text-foreground">{{ quota.today.used }} / {{ quota.today.limit }}</span>
                    </div>
                    <!-- Progress Bar -->
                    <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            class="h-full rounded-full transition-all duration-500"
                            :class="quota.today.percentage > 85 ? 'bg-red-500' : quota.today.percentage > 60 ? 'bg-amber-500' : 'bg-primary'"
                            :style="{ width: Math.max(quota.today.percentage, 2) + '%' }"
                        ></div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                        <span>{{ quota.today.percentage }}% used</span>
                        <span class="font-medium text-emerald-600">{{ quota.today.remaining }} remaining today</span>
                    </div>
                </div>

                <!-- Monthly Quota -->
                <div class="p-4 rounded-lg bg-muted/40 border border-border/60 space-y-2">
                    <div class="flex items-center justify-between text-xs font-medium">
                        <span class="text-muted-foreground">Monthly Billing Quota</span>
                        <span class="font-semibold text-foreground">{{ quota.month.used }} / {{ quota.month.limit.toLocaleString() }}</span>
                    </div>
                    <!-- Progress Bar -->
                    <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            class="h-full rounded-full transition-all duration-500"
                            :class="quota.month.percentage > 85 ? 'bg-red-500' : quota.month.percentage > 60 ? 'bg-amber-500' : 'bg-primary'"
                            :style="{ width: Math.max(quota.month.percentage, 1) + '%' }"
                        ></div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                        <span>{{ quota.month.percentage }}% used</span>
                        <span class="font-medium text-emerald-600">{{ quota.month.remaining.toLocaleString() }} remaining this month</span>
                    </div>
                </div>

                <!-- Sending Health & Domain -->
                <div class="p-4 rounded-lg bg-muted/40 border border-border/60 flex flex-col justify-between">
                    <div class="flex items-center justify-between text-xs font-medium mb-1">
                        <span class="text-muted-foreground">Sender Domain Health</span>
                        <span class="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2Icon class="w-3.5 h-3.5" />
                            <span>{{ quota.domain.status.toUpperCase() }}</span>
                        </span>
                    </div>
                    <div class="text-xs text-muted-foreground space-y-1">
                        <div class="flex items-center justify-between">
                            <span>Domain:</span>
                            <span class="font-mono text-foreground font-medium">{{ quota.domain.name }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span>SPF / DKIM / DMARC:</span>
                            <span class="text-emerald-600 font-medium">Verified (100% Pass)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <Tabs :model-value="statusFilter" @update:model-value="handleTabChange" class="w-full" v-if="!isLoading">
            <TabsList class="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 h-auto p-1 gap-2">
                <TabsTrigger value="failed" class="py-3 flex flex-col items-center justify-center gap-1">
                    <span class="text-sm font-medium text-muted-foreground">Failed</span>
                    <span class="text-2xl font-bold text-red-600">{{ counts.failed }}</span>
                </TabsTrigger>
                <TabsTrigger value="waiting" class="py-3 flex flex-col items-center justify-center gap-1">
                    <span class="text-sm font-medium text-muted-foreground">Waiting</span>
                    <span class="text-2xl font-bold">{{ counts.waiting }}</span>
                </TabsTrigger>
                <TabsTrigger value="active" class="py-3 flex flex-col items-center justify-center gap-1">
                    <span class="text-sm font-medium text-muted-foreground">Active</span>
                    <span class="text-2xl font-bold text-blue-600">{{ counts.active }}</span>
                </TabsTrigger>
                <TabsTrigger value="completed" class="py-3 flex flex-col items-center justify-center gap-1">
                    <span class="text-sm font-medium text-muted-foreground">Completed</span>
                    <span class="text-2xl font-bold text-green-600">{{ counts.completed }}</span>
                </TabsTrigger>
                <TabsTrigger value="delayed" class="py-3 flex flex-col items-center justify-center gap-1">
                    <span class="text-sm font-medium text-muted-foreground">Delayed</span>
                    <span class="text-2xl font-bold text-orange-500">{{ counts.delayed }}</span>
                </TabsTrigger>
                <TabsTrigger value="paused" class="py-3 flex flex-col items-center justify-center gap-1">
                    <span class="text-sm font-medium text-muted-foreground">Paused</span>
                    <span class="text-2xl font-bold">{{ counts.paused }}</span>
                </TabsTrigger>
            </TabsList>
        </Tabs>

        <div class="flex justify-center p-12" v-else-if="isLoading && !logs.length">
            <LoaderIcon class="w-8 h-8 animate-spin text-muted-foreground" />
        </div>

        <div class="mt-8" v-if="!isLoading || logs.length">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h2 class="text-lg font-semibold">Recent Email Logs</h2>
                <div class="relative w-full sm:w-80">
                    <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        v-model="searchQuery"
                        placeholder="Search by email or name..."
                        class="pl-9 pr-8"
                    />
                    <button
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        type="button"
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                        <XIcon class="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
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
                            <TableCell>
                                <div class="font-medium text-foreground text-sm" v-if="log.recipient_name">{{ log.recipient_name }}</div>
                                <div :class="log.recipient_name ? 'text-xs text-muted-foreground' : 'text-sm'">{{ log.recipient }}</div>
                            </TableCell>
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
                                <div class="flex items-center justify-end gap-2">
                                    <Button
                                        v-if="log.status === 'WAITING' || log.status === 'DELAYED' || log.status === 'QUEUED'"
                                        size="sm"
                                        class="cursor-pointer bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary font-medium"
                                        @click="sendJobImmediately(log)"
                                        title="Promote queue job to send immediately"
                                    >
                                        <ZapIcon class="w-3.5 h-3.5 mr-1 text-amber-500" />
                                        Send Now
                                    </Button>
                                    <Button v-if="log.payload" modifier="outline" size="sm" @click="openResendDialog(log)">
                                        Resend
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow v-if="!logs.length">
                            <TableCell colspan="5" class="h-24 text-center text-muted-foreground">
                                {{ searchQuery ? `No email logs found matching "${searchQuery}".` : 'No email logs found.' }}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            <div class="flex items-center justify-between mt-4" v-if="logs.length > 0">
                <div class="text-sm text-muted-foreground">
                    Showing {{ (page - 1) * limit + 1 }} to {{ Math.min(page * limit, total) }} of {{ total }} entries
                </div>
                <div class="flex space-x-1">
                    <Button modifier="outline" size="sm" :disabled="page <= 1"
                        @click="page--; fetchCountsAndLogs()">Prev</Button>
                    <template v-for="p in Math.ceil(total / limit)" :key="p">
                        <Button v-if="p === 1 || p === Math.ceil(total / limit) || Math.abs(page - p) <= 2" size="sm"
                            :modifier="page === p ? 'default' : 'outline'" @click="page = p; fetchCountsAndLogs()">
                            {{ p }}
                        </Button>
                        <span v-else-if="Math.abs(page - p) === 3" class="px-2 mt-1 text-muted-foreground">...</span>
                    </template>
                    <Button modifier="outline" size="sm" :disabled="page * limit >= total"
                        @click="page++; fetchCountsAndLogs()">Next</Button>
                </div>
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

        <!-- Send Email Immediately Dialog -->
        <Dialog :open="sendImmediateDialogOpen" @update:open="sendImmediateDialogOpen = false">
            <DialogContent class="max-w-xl">
                <DialogHeader>
                    <DialogTitle class="flex items-center gap-2">
                        <SendIcon class="w-5 h-5 text-primary" />
                        <span>Send Email Immediately</span>
                    </DialogTitle>
                </DialogHeader>

                <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                        <Label for="imm-to">Recipient Email <span class="text-red-500">*</span></Label>
                        <Input
                            id="imm-to"
                            v-model="immediateForm.to"
                            type="email"
                            placeholder="runner@example.com"
                            required
                        />
                    </div>

                    <div class="space-y-1.5">
                        <Label for="imm-subject">Subject <span class="text-red-500">*</span></Label>
                        <Input
                            id="imm-subject"
                            v-model="immediateForm.subject"
                            placeholder="Important notice regarding your race registration"
                            required
                        />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <Label for="imm-sender">Sender Email</Label>
                            <Input
                                id="imm-sender"
                                v-model="immediateForm.senderEmail"
                                placeholder="info@trailmandu.com"
                            />
                        </div>
                        <div class="space-y-1.5">
                            <Label>Format</Label>
                            <div class="flex rounded-md border p-1 bg-muted/40 text-xs">
                                <button
                                    type="button"
                                    @click="immediateForm.isHtml = true"
                                    :class="immediateForm.isHtml ? 'bg-white shadow-sm text-foreground font-semibold' : 'text-muted-foreground'"
                                    class="flex-1 py-1 rounded transition-all cursor-pointer"
                                >
                                    HTML
                                </button>
                                <button
                                    type="button"
                                    @click="immediateForm.isHtml = false"
                                    :class="!immediateForm.isHtml ? 'bg-white shadow-sm text-foreground font-semibold' : 'text-muted-foreground'"
                                    class="flex-1 py-1 rounded transition-all cursor-pointer"
                                >
                                    Plain Text
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <Label for="imm-content">Email Content <span class="text-red-500">*</span></Label>
                            <span class="text-xs text-muted-foreground">{{ immediateForm.isHtml ? 'Accepts HTML markup' : 'Plain text format' }}</span>
                        </div>
                        <textarea
                            id="imm-content"
                            v-model="immediateForm.content"
                            rows="7"
                            :placeholder="immediateForm.isHtml ? '<h2>Hello Runner,</h2>\n<p>Your bib number is <strong>101</strong>.</p>' : 'Hello Runner,\n\nYour bib number is 101.'"
                            class="w-full font-mono text-xs p-3 border rounded-md focus:ring-primary focus:border-primary bg-background resize-y"
                        ></textarea>
                    </div>
                </div>

                <DialogFooter class="gap-2">
                    <Button modifier="outline" @click="sendImmediateDialogOpen = false" :disabled="isSendingImmediate">
                        Cancel
                    </Button>
                    <Button @click="submitSendImmediate" :disabled="isSendingImmediate" class="cursor-pointer bg-primary text-white hover:bg-primary/90">
                        <LoaderIcon v-if="isSendingImmediate" class="w-4 h-4 mr-2 animate-spin" />
                        <SendIcon v-else class="w-4 h-4 mr-2" />
                        <span>Send Immediately</span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>
