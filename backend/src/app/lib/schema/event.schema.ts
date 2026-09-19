import { PaymentType, PaymentMethod } from '@prisma/client/index-browser'
import * as Y from 'yup'

export const eventSchema = Y.object({
    name: Y.string().required().label('Name'),
    slug: Y.string().required().label('Slug'),
    start_date: Y.string().required().label('Start date'),
    end_date: Y.string().required().label('End date'),
    excerpt: Y.string().required().label('Event short description')
})

export const stageSchema = Y.object({
    event_id: Y.string().required().label('Event'),
    name: Y.string().required().label('Name'),
    excerpt: Y.string().required().label('excerpt'),
    description: Y.string().required().label('Description'),
    location: Y.string().required().label('Location'),
    thumbnail: Y.string().required().label('Thumbnail'),
    guide_book_file: Y.string().optional().label('Guide book file')
})

export const checkpointSchema = Y.object({
    stage_category_id: Y.string().required().label('Stage'),
    is_start: Y.boolean().label('Is start'),
    is_end: Y.boolean().label('Is end'),
    name: Y.string().required().label('Name'),
})

export const gallerySchema = Y.object({
    images: Y.array().of(Y.string()).min(1).required().label('Gallery')
})

export const trailRaceRunner = Y.object({
    stage_id: Y.string().when('is_season_pass', {
        is: true,
        then: schema => schema.optional(),
        otherwise: schema => schema.required()
    }).label('Stage'),
    stage_category_id: Y.string().when('is_season_pass', {
        is: true,
        then: schema => schema.optional(),
        otherwise: schema => schema.required()
    }).label('Stage'),
    season_pass_categories: Y.array().of(Y.string().required()).when('is_season_pass', {
        is: true,
        then: schema => schema.required().min(1),
        otherwise: schema => schema.optional()
    }).label('Season Pass Categories'),
    is_season_pass: Y.boolean().optional().label('Season Pass'),
    season_pass_id: Y.string().when('is_season_pass', {
        is: true,
        then: schema => schema.required(),
        otherwise: schema => schema.optional()
    }).label('Season Pass ID'),
    first_name: Y.string().required().label("First name"),
    middle_name: Y.string().nullable().label("Middle name"),
    last_name: Y.string().required().label("Last name"),
    email: Y.string().email().required().label("Email"),
    itra_id: Y.string().nullable().label("ITRA ID"),
    phone_number: Y.string().required().label("Phone number"),
    date_of_birth: Y.string().required().label("Date of birth"),
    country_id: Y.string().required().label("Country"),
    gender_id: Y.string().required().label("Gender"),
    size_id: Y.string().required().label("Shirt size"),
    /* age_category_id: Y.string().required().label("Age category"), */
    payment_type: Y.string().oneOf(Object.values(PaymentType)).required().label("Payment type"),
    payment_method: Y.string().oneOf(Object.values(PaymentMethod)).required().label("Payment method"),
    payment_screenshot: Y.string().when('payment_method', {
        is: 'QR',
        then: schema => schema.required(),
        otherwise: schema => schema
    }).label("Payment screenshot"),
    description: Y.object({
        club_name: Y.string().label('Club name'),
        emergency_contact_name: Y.string().required().label('Emergency Contact name'),
        emergency_contact_phone: Y.string().required().label('Emergency Contact number'),
        want_lunch: Y.boolean().label('Want lunch'),
    }).required().label('Description')
})

export const trailRaceVolunteer = Y.object({
    first_name: Y.string().required().label("First name"),
    middle_name: Y.string().nullable().label("Middle name"),
    last_name: Y.string().required().label("Last name"),
    email: Y.string().email().required().label("Email"),
    phone_number: Y.string().required().label("Phone number"),
    date_of_birth: Y.string().required().label("Date of birth"),
    country_id: Y.string().required().label("Country"),
    gender_id: Y.string().required().label("Gender"),
    // size_id: Y.string().required().label("Shirt size"),
    stage_id: Y.string().required().label("Stage"),
    // age_category_id: Y.string().required().label("Age category"),
    event_id: Y.string().required().label("Event"),
    // description: Y.string().label("Description")
})

export const stageCategorySchema = Y.object({
    id: Y.string().optional().label('Id'),
    name: Y.string().required().label('Name'),
    excerpt: Y.string().required().label('Excerpt'),
    description: Y.string().required().label('Short description'),
    distance: Y.string().required().label('Distance'),
    elevation: Y.string().nullable().label('Elevation Gain'),
    difficulty: Y.string().oneOf(['moderate', 'easy', 'difficult']).required().label('Difficulty'),
    location: Y.string().required().label('Location'),
    start: Y.string().required().label('Start'),
    end: Y.string().required().label('End'),
    stage_id: Y.string().required().label('Stage'),
    bib_range: Y.string().label('Bib range'),
    map: Y.string().when('id', {
        is: undefined,
        then: schema => schema.required(),
        otherwise: schema => schema
    }).label('Map file')
})

export const sponsorSchema = Y.object({
    event_id: Y.string().required().label('Event'),
    name: Y.string().required().label('Name'),
    description: Y.string().required().label('Description'),
    image: Y.string().required().label('Image'),
    type: Y.string().required().label('Sponsor type'),
    url: Y.string().required().label('URL')
})

export const sponsorTypeSchema = Y.object({
    name: Y.string().required().label('Name'),
    description: Y.string().required().label('Description'),
    priority: Y.number().integer().min(0).optional().label('Priority')
})

export const stageCategoryPaymentSchema = Y.object({
    payment_id: Y.string().optional().label('Payment'),
    stage_category_id: Y.string().required().label('Stage category'),
    amount: Y.number().required().label('Amount'),
    type: Y.string().oneOf(Object.values(PaymentType)).required().label('Type'),
    description: Y.string().nullable().optional().label('Description'),
    image: Y.string().when('payment_id', {
        is: undefined,
        then: schema => schema.required(),
        otherwise: schema => schema.notRequired()
    }).label('Image')
})

export const seasonPassSchema = Y.object({
    id: Y.string().optional().label('Id'),
    name: Y.string().required().label('Name'),
    event_id: Y.string().required().label('Event'),
    category_ids: Y.array().of(Y.string()).optional().label('Category Ids')
})

export const seasonPassPaymentSchema = Y.object({
    payment_id: Y.string().optional().label('Payment'),
    season_pass_id: Y.string().required().label('Season pass'),
    amount: Y.number().required().label('Amount'),
    type: Y.string().oneOf(Object.values(PaymentType)).required().label('Type'),
    description: Y.string().nullable().optional().label('Description'),
    image: Y.string().when('payment_id', {
        is: undefined,
        then: schema => schema.required(),
        otherwise: schema => schema.notRequired()
    }).label('Image')
})