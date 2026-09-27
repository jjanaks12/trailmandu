import { useAxios } from "~/services/axios"

export const useRaceUpdateStore = defineStore('raceUpdate', () => {
    const { axios } = useAxios()
    
    const updates = ref<any[]>([])
    const isLoading = ref(false)

    const fetch = async (event_id?: string, stage_id?: string) => {
        isLoading.value = true
        try {
            const { data } = await axios.get<any[]>('/race-updates', {
                params: { event_id, stage_id }
            })
            if (data) {
                updates.value = data
            }
        } catch (e) {
            console.error(e)
        }
        isLoading.value = false
    }

    const save = async (formData: { message: string, event_id?: string, stage_id?: string, parent_id?: string, new_start?: string, new_end?: string }) => {
        isLoading.value = true
        try {
            await axios.post('/race-updates', formData)
            await fetch(formData.event_id, formData.stage_id)
        } catch (e) {
            console.error(e)
        }
        isLoading.value = false
    }

    return {
        isLoading, updates,
        fetch, save
    }
})
