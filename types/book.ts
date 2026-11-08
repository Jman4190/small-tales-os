// /types/book.ts
export type Step = "name" | "gender" | "image-example" | "upload" | "processing" | "completion"

export interface BookData {
  id?: string
  name: string
  gender: "boy" | "girl"
  age?: number
  remainingUploads: number
  filePath?: string
  imageUrl?: string
  status?: "processing" | "completed" | "failed"
  generated_image_url?: string
  generated_image_urls?: string[]
  original_image_url?: string
  appearance?: {
    skinTone?: string;
    hair?: string;
    eyeColor?: string;
  }
}

export interface BookStatusResponse {
  data: BookData
  error?: string
}

export interface CreateBookResponse {
  data: {
    id: string
    status: string
  }
  message: string
  error?: string
}

export interface UploadUrlResponse {
  url: string
  filePath: string
} 