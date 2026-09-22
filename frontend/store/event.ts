import type { APIRequest, TrailRace } from "~/lib/types"
import { useAxios } from "~/services/axios"
import { trailRaceRunner, trailRaceVolunteer } from "~/lib/schema/event.schema"
import type { InferType } from "yup"
import moment from "moment"

export const useEventStore = defineStore('event', () => {
    const events = ref<TrailRace[]>([])

    const currentRace = ref<TrailRace | null>(null)
    const { isLoading, params } = useModalMeta()
    const { axios } = useAxios()

    const currentStage = computed(() => {
        const validStages = currentRace.value?.stages.filter((stage) => stage.stage_categories.length > 0) || []
        if (validStages.length === 0) return undefined
        
        const futureStage = validStages.filter((stage) => 
            stage.stage_categories.some((category) => moment.utc(category.start).isAfter(moment.utc()))
        )[0]

        return futureStage || validStages[validStages.length - 1]
    })

    const fetch = async () => {
        const { data } = await axios.get<APIRequest<TrailRace[]>>('/events', {
            params: params.value
        })

        if (data) {
            const { data: d, ...p } = data
            events.value = d
            params.value = p
        }
    }

    const fetchPublic = async () => {
        isLoading.value = true
        const { data } = await axios.get<APIRequest<TrailRace[]>>('/events/public', {
            params: params.value
        })

        if (data) {
            const { data: d, ...p } = data
            events.value = d
            params.value = p
        }
        isLoading.value = false
    }

    const save = async (formData: any) => {
        const method = formData.id ? 'put' : 'post'
        const url = formData.id ? `/events/${formData.id}` : 'events'
        isLoading.value = true

        await axios[method](url, formData)
        isLoading.value = false
        fetch()
    }

    const publish = async (id: string) => {
        await axios.post(`/events/${id}/publish`)
        fetch()
    }

    const unpublish = async (id: string) => {
        await axios.post(`/events/${id}/unpublish`)
        fetch()
    }

    const get = async (id: string) => {
        const { data } = await axios<TrailRace>(`/events/${id}`)
        return data
    }

    const getBySlug = async (slug: string) => {
        const { data } = await axios<TrailRace>(`/events/by_slug/${slug}`)

        return data ?? null
    }

    const saveDescription = async (id: string, description: string) => {
        const { status } = await axios.put(`/events/${id}/update_description`, { description })

        return status === 200
    }

    const saveDetails = async (id: string, details: any) => {
        const { status } = await axios.put(`/events/${id}/update_details`, { details })

        return status === 200
    }

    const saveMap = async (id: string, description: string) => {
        const { status } = await axios.put(`/events/${id}/upload_map_file`, { description })

        return status === 200
    }

    const saveGalleryId = async (id: string, galleryId: string) => {
        const { status } = await axios.put(`/events/${id}/update_gallery_id`, { gallery_id: galleryId })
        return status === 200
    }

    const saveRunner = async (formData: InferType<typeof trailRaceRunner>, eventId: string) => {
        const { status } = await axios.post(`/events/${eventId}/runner/register`, formData)

        return status === 200
    }

    const saveVoluteer = async (values: InferType<typeof trailRaceVolunteer>, eventId: string) => {
        const { status } = await axios.post(`/events/${eventId}/volunteer/register`, { ...values, event_id: eventId })

        return status === 200
    }

    const remove = async (id: string) => {
        isLoading.value = true
        console.log(id);

        await axios.delete(`/events/${id}`)
        isLoading.value = false
        fetch()
    }

    const fetchCurrentRace = async () => {
        if (!currentRace.value) {
            const { data } = await axios.get<TrailRace>('/events/current')
            currentRace.value = data
        }
    }

    return {
        isLoading, params, events, currentRace,
        currentStage,
        fetch, fetchPublic, save, publish, unpublish, get, saveDescription, saveDetails, saveMap, saveGalleryId, getBySlug, saveRunner, saveVoluteer, remove, fetchCurrentRace
    }
})