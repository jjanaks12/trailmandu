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

import moment from 'moment'

const page = ref(1)
const limit = ref(20)
const total = ref(0)
const statusFilter = ref<string>('failed')

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
                endDate: endDate.value || undefined
            }
        })
        counts.value = data.email
        logs.value = data.logs
        total.value = data.total
    } catch (e) {
        console.error('Failed to fetch queues', e)
    } finally {
        isLoading.value = false
    }
}

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
    </div>
</template>
