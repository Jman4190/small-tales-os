import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import 'react-image-crop/dist/ReactCrop.css'

interface ImageCropModalProps {
  open: boolean
  imageUrl: string
  onClose: () => void
  onCropComplete: (croppedImage: string) => void
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      1, // aspect ratio
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export function ImageCropModal({ open, imageUrl, onClose, onCropComplete }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>()
  const imgRef = useRef<HTMLImageElement>(null)

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height))
  }

  const getCroppedImg = (): string => {
    const image = imgRef.current
    if (!image || !crop) return ''

    const canvas = document.createElement('canvas')
    
    // Convert percentage values to pixels
    const pixelCrop = {
      x: (crop.x * image.width) / 100,
      y: (crop.y * image.height) / 100,
      width: (crop.width * image.width) / 100,
      height: (crop.height * image.height) / 100
    }

    // Set canvas dimensions to match the desired output size
    // Using a larger size for better quality
    const targetSize = Math.max(pixelCrop.width, pixelCrop.height, 800) // minimum 800px
    const scale = targetSize / pixelCrop.width
    
    canvas.width = pixelCrop.width * scale
    canvas.height = pixelCrop.height * scale

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('No 2d context')
    }

    // Enable smooth rendering
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    console.log('Crop details:', {
      percentageCrop: crop,
      pixelCrop,
      canvasSize: { width: canvas.width, height: canvas.height },
      imageSize: { 
        natural: { width: image.naturalWidth, height: image.naturalHeight },
        display: { width: image.width, height: image.height }
      }
    })

    // Draw the cropped portion of the image
    ctx.drawImage(
      image,
      pixelCrop.x * (image.naturalWidth / image.width), // scale crop x to natural size
      pixelCrop.y * (image.naturalHeight / image.height), // scale crop y to natural size
      pixelCrop.width * (image.naturalWidth / image.width), // scale crop width to natural size
      pixelCrop.height * (image.naturalHeight / image.height), // scale crop height to natural size
      0,
      0,
      canvas.width,
      canvas.height
    )

    // Convert to high-quality JPEG
    const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.95)
    console.log('Generated cropped image size:', Math.round(croppedImageUrl.length / 1024), 'KB')
    
    return croppedImageUrl
  }

  const handleSubmit = () => {
    const croppedImageUrl = getCroppedImg()
    if (croppedImageUrl) {
      onCropComplete(croppedImageUrl)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogTitle className="text-center text-xl font-semibold">Crop Photo</DialogTitle>
        <div className="mt-4 flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            className="max-h-[60vh]"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Image to crop"
              onLoad={onImageLoad}
              style={{ maxHeight: '60vh' }}
            />
          </ReactCrop>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Submit</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 