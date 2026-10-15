import * as Icons from 'lucide-vue-next'

export type Leaflet = typeof import('leaflet')

type APISort<T> = {
    order: "asc" | "desc"
    field: keyof T
}

export const paymentMethods = ['PAY_AT_VENUE', 'QR'] as const
export const paymentTypes = ['NATIONAL', 'INTERNATIONAL'] as const
type AddressType = 'BILLING' | 'SHIPPING' | 'PERMANENT_ADDRESS'
type StageDifficulty = 'moderate' | 'easy' | 'difficult'
export type PaymentMethod = typeof paymentMethods[number]
export type PaymentType = typeof paymentTypes[number]
export const paymentStatus = ['PENDING', 'COMPLETED', 'FAILED'] as const
export type PaymentStatus = typeof paymentStatus[number]

export const runnerStatus = ['DID_NOT_FINISH', 'DISQUALIFIED', 'ACTIVE'] as const
export type RunnerStatus = typeof runnerStatus[number]

export type APIQuery<T> = {
    s: string
    sort?: APISort<T>
}

export type APIParam = {
    s?: string
    status?: string
    role?: string
    total_page: number
    total: number
    current: number
    per_page: number
}

export type APIRequest<T> = APIParam & {
    data: T
}

export type Gender = {
    id: string
    name: string
}

export type Menu = {
    title: string
    slug: string
    icon?: keyof typeof Icons
    path: string
    hidden?: boolean
    disabled?: boolean
    role?: string
    permissions: string | string[]
    showIcon?: boolean
    subMenu?: Menu[]
}

export type Personal = {
    id: string
    first_name?: string
    middle_name?: string
    last_name?: string
    email: string
    date_of_birth?: string
    itra_id?: string
    gender_id: string
    phone_number?: string
    created_at: Date
    updated_at?: Date
    country_id?: string
    age_category_id?: string
    size_id?: string
    image_id?: string

    age_category: AgeCategory
    avatar: Image
    country: Country
    gender: Gender
    runners: EventRunner[]
    volunteers: Volunteer[]
    checkpoints: Checkpoint[]
    size: TShirtSize
}

export type AgeCategory = {
    id: string
    name: string
    created_at: Date
    updated_at?: Date
    personal: Personal[]
}

export type Image = {
    id: string
    file_name: string
    description: string
    created_at: Date
    updated_at?: Date
    personal: Personal[]
    tags: Tag[]
    detail?: any
}

export type Tag = {
    id: string
    name: string
    created_at: Date
    updated_at?: Date
    images: Image[]
    events: TrailRace[]
}

export type Country = {
    id: string
    name: string
    abbr: string
    code: string
    created_at: Date
    updated_at?: Date
}

export type TrailRace = {
    id: string
    name: string
    slug: string
    start: string
    end: string
    excerpt: string
    description: string
    details?: any
    created_at: string
    updated_at?: string
    deleted_at?: string
    published_at?: string
    liability_waiver?: string
    policies?: string
    image_id?: string
    thumbnail?: Image
    map_file_id?: string
    map_file?: Image
    volunteers: Volunteer[]
    checkpoints: Checkpoint[]
    stages: Stage[]
    season_passes?: SeasonPass[]
    runners: EventRunner[]
    tags: Tag[]
    gallery_id?: string
    gallery?: Gallery
    pricing_tiers?: PricingTier[]
    addons?: EventAddon[]
    sponsors?: Sponsor[]
    _count?: {
        stages: number
        runners: number
    }
}

export type Checkpoint = {
    id: string
    name: string
    is_start: boolean
    is_end: boolean
    created_at: string
    updated_at: string
    deleted_at: string
    stage_id: string
    stage: Stage
    stage_category_id: string
    stage_category: StageCategory
    runners: EventRunner[]
    volunteers: Volunteer[]
    volunteer_on_checkpoints: VolunteerCheckpoint[]
}

export type Stage = {
    id: string
    name: string
    excerpt: string
    description: string
    distance: string
    difficulty: StageDifficulty
    location: string
    has_shirt?: boolean
    start: string
    end: string
    created_at: string
    updated_at: string
    deleted_at: string
    event_id: string
    event: TrailRace
    map_file_id: string
    map_file: Image
    image_id: string
    thumbnail: Image
    guide_book_file_id?: string
    guide_book_file?: Image
    runners: EventRunner[]
    volunteers: Volunteer[]
    stage_categories: StageCategory[]
}

export type EventRunner = {
    id: string
    bib: string
    created_at: string
    updated_at: string
    deleted_at: string
    emergency_contact_name: string
    emergency_contact_no: string
    want_lunch: boolean
    personal_id: string
    club_name: string
    personal: Personal
    event_id: string
    event: TrailRace
    stage_id: string
    stage: Stage
    shirt_id?: string
    tshirt_size?: TShirtSize
    checkpoints: Checkpoint[]
    payments: Payment[]
    volunteer_on_checkpoints: VolunteerCheckpoint[]
    stage_category_id: string
    stage_category: StageCategory
    rank: Rank
    status: EventRunnerStatus
    runner_attendances: RunnerAttendance[]
    season_pass_id?: string
    season_pass?: SeasonPass
}

export type RunnerAttendance = {
    id: string
    created_at: string
    updated_at: string
    deleted_at: string
    runner_id: string
    runner: EventRunner
    stage_id: string
    stage: Stage
}

export type Payment = {
    id: string
    amount: number
    method: PaymentMethod
    status: PaymentStatus
    created_at: string
    updated_at: string
    deleted_at: string
    runner_id: string
    runner: EventRunner
    stage_category_id: string
    stage_category: StageCategory
    image_id: string
    screenshot: Image
}

export type Volunteer = {
    id: string
    description: string
    created_at: string
    updated_at: string
    deleted_at: string
    personal_id: string
    personal: Personal
    checkpoints: Checkpoint[]
    stages: Stage[]
    volunteer_on_checkpoints: VolunteerCheckpoint[]
}

export type User = {
    id: string
    personal: Personal
    role: Role
}

export type Token = {
    accessToken: string
    refreshToken: string
}

export type Role = {
    id: string
    name: string
    description: string
    permissions: Permission[]
}

export type Permission = {
    id: string
    name: string
    description: string
    created_at: string
    updated_at: string
    deleted_at: string
}

type Address = {
    id: string
    street: string
    address: string
    city: string
    state: string
    zipCode: string
    country_id: string
    country: Country
    type: AddressType
}

export type Company = {
    id: string
    short_name: string
    name: string
    address: Address
    email: string
    image_id: string
    logo: Image
    phone: string
    vat_registered: boolean
    pan_no: string
    vat_no: string
    users: User[]
    social_links: SocialLink[]
}

export type SocialLink = {
    id: string
    name: string
    url: string
    icon: string
    created_at: string
    updated_at: string
    deleted_at: string
    company_id: string
    company: Company[]
    sponsors: Sponsor[]
}

export type TShirtSize = {
    id: string
    name: string
    created_at: string
    updated_at?: string
    deleted_at?: string
}

export type VolunteerCheckpoint = {
    id: string
    timer: string
    volunteer_id: string
    volunteer: Volunteer
    runner_id: string
    runner: EventRunner
    checkpoint_id: string
    checkpoint: Checkpoint
}

export type StageCategory = {
    id: string
    name: string
    excerpt: string
    description: string
    distance: string
    elevation?: string
    difficulty: string
    location: string
    start: string
    end: string
    bib_range: string
    created_at: string
    updated_at: string
    deleted_at: string
    stage_id: string
    stage: Stage
    map_file_id: string
    map_file: Image
    checkpoints: Checkpoint[]
    runners: EventRunner[]
    payment: StageCategoryPayment[]
    payments: Payment[]
}

export type Newsletter = {
    id: string
    email: string
    subscribed_at: string
    deleted_at?: string
    user_id?: string
    user?: Personal
    topics: NewsletterTopic[]
}

export type NewsletterTopic = {
    id: string
    name: string
    description?: string
    created_at: string
    updated_at: string
    deleted_at?: string
    newsletters: Newsletter[]
}

export type Sponsor = {
    id: string
    name: string
    description: string
    url: string
    thumbnail_id: string
    thumbnail: Image
    created_at: string
    updated_at: string
    deleted_at: string
    event_id: string
    event: TrailRace
    sponsor_type_id: string
    sponsorType: SponsorType
    social_link: SocialLink[]
}

export type SponsorType = {
    id: string
    name: string
    description: string
    priority: number
    created_at: string
    updated_at: string
    deleted_at: string
    sponsors: Sponsor[]
}

export type StageCategoryPayment = {
    id: string
    amount: string
    type: PaymentType
    description: string
    created_at: string
    updated_at: string
    deleted_at: string
    stage_category_id: string
    stage_category: StageCategory
    image_id: string
    screenshot: Image
}

export type SeasonPass = {
    id: string
    name: string
    created_at: string
    updated_at: string
    deleted_at: string
    event_id: string
    event: TrailRace
    payments: SeasonPassPayment[]
    stage_categories?: StageCategory[]
}

export type SeasonPassPayment = {
    id: string
    amount: string
    type: PaymentType
    description: string
    created_at: string
    updated_at: string
    deleted_at: string
    season_pass_id: string
    season_pass: SeasonPass
    image_id: string
    screenshot: Image
}

export type EventRunnerStatus = {
    id: string
    status: RunnerStatus
    runner_id: string
    runner: EventRunner
}

export type Rank = {
    id: string
    position: number
    runner_id: string
    runner: EventRunner
}

export type Gallery = {
    id: string
    name: string
    description: string
    created_at: string
    updated_at: string
    deleted_at: string
    hide_gallery: boolean
    image_order: string[] | null
    images: Image[]
    tags: Tag[]
    _count: Record<string, number>
}

export type WithCount<T> = T & {
    _count: Record<string, number>
}


type TrekStats = {
    distance: string
    duration: string
    elevation: string
    grade: string
}

export type TrekDetailTitles = 'Trip highlights' | 'Best time to visit' | 'Accommodation' | 'Food' | 'Gear' | string

// type TrekDetail = TrekStats | Record<TrekDetailTitles, Record<'key' | 'value', string | number>[]>
type TrekDetail = any

export type TrekCategory = {
    id: string
    name: string
    description: string
    created_at: string
    updated_at?: string
    deleted_at?: string
}

export type Setting = {
    id: string
    key: string
    value: string
}

export type PricingTier = {
    id: string
    name: string
    price: string | number
    is_time_based: boolean
    start_date?: string
    end_date?: string
    event_id: string
    stage_id?: string
}

export type EventAddon = {
    id: string
    name: string
    price: string | number
    is_mandatory: boolean
    apply_to_all: boolean
    event_id: string
    stages?: Stage[]
}

export type Trek = {
    id: string
    name: string
    slug: string
    excerpt: string
    description: string
    price: string
    details: TrekDetail
    published_at?: string
    created_at: string
    updated_at?: string
    deleted_at?: string
    image_id?: string
    thumbnail?: Image
    gallery_id?: string
    gallery?: Gallery
    category_id?: string
    category?: any
    tags: Tag[]
}

export type ProductCategory = {
    id: string
    name: string
    slug: string
    description?: string
    parent_id?: string
    parent?: ProductCategory
    children?: ProductCategory[]
    created_at: string
    updated_at?: string
    deleted_at?: string
}

export type Product = {
    id: string
    name: string
    slug: string
    badge?: string
    excerpt?: string
    description: string
    published_at?: string
    created_at: string
    updated_at?: string
    deleted_at?: string
    category_id: string
    category?: ProductCategory
    thumbnail_id?: string
    thumbnail?: Image
    gallery_id?: string
    gallery?: Gallery
    tags?: Tag[]
    rating?: number
    variants?: ProductVariant[]
    reviews?: any[]
    specs: ProductSpec[]
}

export type ProductSpec = {
    id: string
    label: string
    value: string
    product_id: string
    product: Product
}

export type Size = {
    id: string
    name: string
    created_at: string
    updated_at: string
    deleted_at: string
    product_id: string
    product: Product
}

export type ProductVariant = {
    id: string
    sku: string
    price: number
    original_price?: number
    stock: number
    sold: number
    returned: number
    restock_threshold: number
    product_id: string
    product: Product
    size_id: string
    size: Size
    orderItems: OrderItem[]
}

export type OrderItem = {
    id: string
    quantity: number
    unit_price: string
    order_id: string
    order: Order
    product_id: string
    product: Product
    variant_id?: string
    variant?: ProductVariant
}

export type Order = {
    id: string
    order_id: string
    order_items: OrderItem[]
}

type MediaMode = "image" | "gallery"

export type MediaState = {
    show: boolean
    mode: MediaMode
    isMultiple: boolean
    selectedImages: string[]
    selectedGalleries: string[]
    selectedGallery: Gallery | null,
    action?: Function
}

type CartVariant = ProductVariant & {
    quantity: number
}

export interface CartItem {
    id: string
    product: Product
    variants: CartVariant[]
}

export type SeoMetadata = {
    id: string
    meta_title?: string
    meta_description?: string
    meta_keywords?: string
    canonical_url?: string
    og_title?: string
    og_description?: string
    og_image_id?: string
    og_image?: Image
}

export type BlogCategory = {
    id: string
    name: string
    slug: string
    description?: string
    created_at: string
    updated_at?: string
    deleted_at?: string
}

export type BlogPost = {
    id: string
    title: string
    slug: string
    content: string
    excerpt?: string
    published_at?: string
    is_featured: boolean
    created_at: string
    updated_at?: string
    deleted_at?: string

    seo_id?: string
    seo?: SeoMetadata

    author_id: string
    author?: User

    category_id?: string
    category?: BlogCategory

    featured_image_id?: string
    featured_image?: Image

    tags?: Tag[]

    next?: { title: string, slug: string }
    prev?: { title: string, slug: string }
    recent?: BlogPost[]
    recommended?: BlogPost[]
    comments?: BlogComment[]
}

export type BlogComment = {
    id: string
    content: string
    rating?: number
    parent_id?: string
    author_name?: string
    author_email?: string
    user_id?: string
    user?: User
    post_id: string
    post?: BlogPost
    status: string
    created_at: string
    updated_at?: string
    replies?: BlogComment[]
}

export type EnquiryCategory = {
    id: string
    name: string
    slug: string
    description?: string
    created_at: string
    updated_at?: string
    deleted_at?: string
}

export type TeamMember = {
    id: string
    name: string
    positions: string[]
    social: Record<string, string> | null
    text: string | null
    links: string[] | null
    order: number
    image_id: string | null
    image?: {
        file_name: string
        [key: string]: any
    } | null
    created_at: string
    updated_at: string | null
    deleted_at: string | null
}

export type Review = Record<string, {
    rating: number,
    platform: string,
    userRatingCount: number,
    reviews: any[]
}>