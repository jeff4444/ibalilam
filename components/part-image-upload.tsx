'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Upload, Camera, X, Image as ImageIcon, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import Image from 'next/image'

interface PartImageUploadProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
  disabled?: boolean
}

interface UploadingImage {
  file: File
  progress: number
  preview: string
}

export function PartImageUpload({ 
  images, 
  onImagesChange, 
  maxImages = 8, 
  disabled = false 
}: PartImageUploadProps) {
  const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const remainingSlots = maxImages - images.length - uploadingImages.length
    
    if (fileArray.length > remainingSlots) {
      toast({
        title: 'Too many images',
        description: `You can only upload ${remainingSlots} more image(s).`,
        variant: 'destructive',
      })
      return
    }

    // Validate files
    const validFiles: File[] = []
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const maxSize = 10 * 1024 * 1024 // 10MB

    for (const file of fileArray) {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a supported image format. Please use JPG, PNG, or WebP.`,
          variant: 'destructive',
        })
        continue
      }

      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `${file.name} is larger than 10MB. Please compress the image.`,
          variant: 'destructive',
        })
        continue
      }

      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    // Create preview URLs and start uploads
    const newUploadingImages: UploadingImage[] = validFiles.map(file => ({
      file,
      progress: 0,
      preview: URL.createObjectURL(file)
    }))

    setUploadingImages(prev => [...prev, ...newUploadingImages])
    uploadImages(validFiles)
  }

  const uploadImages = async (files: File[]) => {
    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'You must be logged in to upload images.',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)

    try {
      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `parts/${user.id}/${fileName}`

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('part-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          throw new Error(`Failed to upload ${file.name}: ${error.message}`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('part-images')
          .getPublicUrl(filePath)

        return {
          index,
          url: urlData.publicUrl,
          fileName: file.name
        }
      })

      const results = await Promise.all(uploadPromises)
      
      // Update images array with new URLs
      const newImageUrls = results.map(result => result.url)
      onImagesChange([...images, ...newImageUrls])

      // Clear uploading images
      setUploadingImages([])

      toast({
        title: 'Images uploaded successfully',
        description: `${results.length} image(s) have been uploaded.`,
      })

    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: error.message || 'There was an error uploading your images.',
        variant: 'destructive',
      })
      
      // Clear uploading images on error
      setUploadingImages([])
    } finally {
      setIsUploading(false)
    }
  }

  const removeImage = async (index: number) => {
    if (disabled || !user?.id) return

    const imageUrl = images[index]
    if (!imageUrl) return

    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/')
      const fileName = urlParts[urlParts.length - 1]
      const filePath = `parts/${user.id}/${fileName}`

      // Delete from storage
      const { error } = await supabase.storage
        .from('part-images')
        .remove([filePath])

      if (error) {
        console.error('Error deleting image:', error)
        // Still remove from UI even if storage deletion fails
      }

      // Remove from images array
      const newImages = images.filter((_, i) => i !== index)
      onImagesChange(newImages)

      toast({
        title: 'Image removed',
        description: 'The image has been removed from your listing.',
      })

    } catch (error) {
      console.error('Error removing image:', error)
      toast({
        title: 'Error removing image',
        description: 'There was an error removing the image. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const removeUploadingImage = (index: number) => {
    const newUploadingImages = uploadingImages.filter((_, i) => i !== index)
    setUploadingImages(newUploadingImages)
  }

  const canAddMore = images.length + uploadingImages.length < maxImages

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Images
        </CardTitle>
        <CardDescription>
          Add photos of your item ({images.length + uploadingImages.length}/{maxImages} uploaded)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Progress */}
        {uploadingImages.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading images...</span>
              <span>{uploadingImages.length} remaining</span>
            </div>
            <Progress value={((images.length + uploadingImages.length) / maxImages) * 100} className="h-2" />
          </div>
        )}

        {/* Images Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Existing Images */}
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden border">
                <Image
                  src={image}
                  alt={`Item image ${index + 1}`}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover"
                />
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          {/* Uploading Images */}
          {uploadingImages.map((uploadingImage, index) => (
            <div key={`uploading-${index}`} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden border border-dashed border-blue-300 bg-blue-50">
                <Image
                  src={uploadingImage.preview}
                  alt={`Uploading ${uploadingImage.file.name}`}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-xs text-blue-600">Uploading...</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeUploadingImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Add Image Button */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-6 w-6 mb-2" />
              <span className="text-sm">Add Image</span>
            </button>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {/* Instructions */}
        <div className="text-sm text-gray-500 space-y-1">
          <p>• Upload clear photos showing the item from different angles</p>
          <p>• First image will be the main photo</p>
          <p>• Supported formats: JPG, PNG, WebP (max 10MB each)</p>
          <p>• Recommended: 3-8 images for best results</p>
        </div>

        {/* Error State */}
        {images.length === 0 && uploadingImages.length === 0 && (
          <Alert>
            <ImageIcon className="h-4 w-4" />
            <AlertDescription>
              Adding images will help customers see your item clearly and increase sales.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
