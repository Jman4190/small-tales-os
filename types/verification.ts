export interface ImageVerificationResponse {
    success: boolean
    passes?: boolean
    ethnicity?: string
    failureReason?: string | null
    error?: string
    appearance?: {
      skinTone: string
      hair: string
      eyeColor: string
    }
}
  