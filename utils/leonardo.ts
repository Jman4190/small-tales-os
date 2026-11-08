import { supabase } from './supabase';
import { log } from '../lib/logger';
import { notifyLeonardoFailure } from '../lib/slack';

const LEONARDO_BASE_URL = "https://cloud.leonardo.ai/api/rest/v1";
const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY;

export async function uploadImage(imagePath: string): Promise<string> {
  const logContext = { imagePath, function: 'uploadImage' };
  
  try {
    log('info', `Starting Leonardo image upload`, logContext);
    
    // Get presigned URL from Leonardo
    const initResponse = await fetch(`${LEONARDO_BASE_URL}/init-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LEONARDO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extension: 'jpg' })
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      const errorDetails = {
        status: initResponse.status,
        statusText: initResponse.statusText,
        errorText,
        ...logContext
      };
      
      log('error', `Leonardo init-image API failed`, errorDetails);
      
      // Send Slack notification for Leonardo API errors
      await notifyLeonardoFailure({
        error: `Leonardo init-image API failed`,
        failureReason: `Status: ${initResponse.status} ${initResponse.statusText}`,
        step: 'init-image',
        apiEndpoint: `${LEONARDO_BASE_URL}/init-image`,
        apiResponse: errorText,
        additionalContext: {
          imagePath,
          httpStatus: initResponse.status,
          httpStatusText: initResponse.statusText
        }
      });
      
      throw new Error(`Leonardo init-image failed: ${initResponse.status} ${initResponse.statusText} - ${errorText}`);
    }

    const presignedData = await initResponse.json();
    log('info', `Leonardo presigned response received`, { ...logContext, hasUploadData: !!presignedData.uploadInitImage });
    
    if (!presignedData.uploadInitImage?.url || !presignedData.uploadInitImage?.fields || !presignedData.uploadInitImage?.id) {
      const errorDetails = { ...logContext, response: presignedData };
      log('error', `Invalid Leonardo init-image response structure`, errorDetails);
      
      await notifyLeonardoFailure({
        error: `Leonardo API returned invalid init-image response`,
        failureReason: `Missing required fields in response`,
        step: 'init-image-validation',
        apiEndpoint: `${LEONARDO_BASE_URL}/init-image`,
        additionalContext: { 
          imagePath,
          response: presignedData 
        }
      });
      
      throw new Error("Leonardo API returned invalid init-image response");
    }
    
    const { url, fields, id: uploadedImageId } = presignedData.uploadInitImage;

    // Get image from Supabase
    const cleanPath = imagePath.replace("book-photos/", "");
    const { data: signedUrlData, error: supabaseError } = await supabase.storage
      .from("book-photos")
      .createSignedUrl(cleanPath, 3600);

    if (supabaseError || !signedUrlData?.signedUrl) {
      const errorDetails = { ...logContext, supabaseError, cleanPath };
      log('error', `Failed to get Supabase signed URL`, errorDetails);
      
      await notifyLeonardoFailure({
        error: `Supabase signed URL generation failed`,
        failureReason: supabaseError?.message || 'Unknown error',
        step: 'supabase-signed-url',
        additionalContext: { 
          imagePath,
          cleanPath, 
          bucket: 'book-photos',
          supabaseError: supabaseError?.message
        }
      });
      
      throw new Error(`Failed to get Supabase signed URL: ${supabaseError?.message || 'Unknown error'}`);
    }

    // Download from Supabase
    const fileResponse = await fetch(signedUrlData.signedUrl);
    if (!fileResponse.ok) {
      const errorDetails = {
        ...logContext,
        status: fileResponse.status,
        statusText: fileResponse.statusText,
        url: signedUrlData.signedUrl
      };
      
      log('error', `Failed to download image from Supabase`, errorDetails);
      
      await notifyLeonardoFailure({
        error: `Failed to download image from Supabase`,
        failureReason: `${fileResponse.status} ${fileResponse.statusText}`,
        step: 'supabase-download',
        additionalContext: { 
          imagePath,
          signedUrl: signedUrlData.signedUrl.substring(0, 100) + '...',
          httpStatus: fileResponse.status,
          httpStatusText: fileResponse.statusText
        }
      });
      
      throw new Error(`Failed to download image from Supabase: ${fileResponse.status} ${fileResponse.statusText}`);
    }

    // Upload to Leonardo
    const formData = new FormData();
    Object.entries(JSON.parse(fields)).forEach(([key, value]) => {
      formData.append(key, value as string);
    });

    const blob = await fileResponse.blob();
    formData.append('file', blob);

    const uploadResponse = await fetch(url, { method: 'POST', body: formData });
    if (!uploadResponse.ok && uploadResponse.status !== 204) {
      const errorText = await uploadResponse.text();
      const errorDetails = {
        ...logContext,
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        errorText
      };
      
      log('error', `Leonardo file upload failed`, errorDetails);
      
      await notifyLeonardoFailure({
        error: `Leonardo file upload failed`,
        failureReason: `${uploadResponse.status} ${uploadResponse.statusText}`,
        step: 'leonardo-upload',
        apiResponse: errorText,
        additionalContext: {
          imagePath,
          uploadedImageId,
          httpStatus: uploadResponse.status,
          httpStatusText: uploadResponse.statusText
        }
      });
      
      throw new Error(`Leonardo upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
    }

    log('info', `Successfully uploaded image to Leonardo`, { ...logContext, uploadedImageId });
    return uploadedImageId;
  } catch (error) {
    log('error', `Leonardo image upload failed`, { ...logContext, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

interface ControlNetStrengths {
  characterStrength: "High" | "Mid" | "Low";
  contentStrength: "High" | "Mid" | "Low";
  styleStrength: "Max" | "Ultra" |"High" | "Mid" | "Low";
  poseWeight: number;
}

export async function generateImage(
  characterId: string,
  contentId: string,
  styleId: string,
  poseId: string,
  prompt: string,
  strengths: ControlNetStrengths
): Promise<string> {
  const logContext = { 
    characterId, 
    contentId, 
    styleId, 
    poseId, 
    prompt: prompt.slice(0, 50) + "...", 
    strengths,
    function: 'generateImage'
  };

  try {
    log('info', `Starting Leonardo image generation`, logContext);

    const requestBody = {
      height: 1200,
      width: 1200,
      prompt,
      negative_prompt: "crooked teeth, deformed mouth, too many fingers, 6 fingers",
      modelId: "2067ae52-33fd-4a82-bb92-c2c55e7d2786",
      num_images: 1,
      presetStyle: "ILLUSTRATION",
      alchemy: true,
      controlnets: [
        {
          initImageId: characterId,
          initImageType: "UPLOADED",
          preprocessorId: 133,
          strengthType: strengths.characterStrength,
        },
        {
          initImageId: contentId,
          initImageType: "UPLOADED",
          preprocessorId: 100,
          strengthType: strengths.contentStrength,
        },
        {
          initImageId: styleId,
          initImageType: "UPLOADED",
          preprocessorId: 67,
          strengthType: strengths.styleStrength,
        },
        {
          initImageId: poseId,
          initImageType: "UPLOADED",
          preprocessorId: 21,
          weight: strengths.poseWeight,
        },
      ],
    };

    const response = await fetch(`${LEONARDO_BASE_URL}/generations`, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${LEONARDO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        errorText,
        ...logContext
      };
      
      log('error', `Leonardo generation API failed`, errorDetails);
      
      // Send Slack notification for generation failures
      await notifyLeonardoFailure({
        error: `Leonardo image generation API failed`,
        failureReason: `Status: ${response.status} ${response.statusText}`,
        step: 'image-generation',
        apiEndpoint: `${LEONARDO_BASE_URL}/generations`,
        apiResponse: errorText,
        characterId,
        prompt: prompt.slice(0, 200) + (prompt.length > 200 ? '...' : ''),
        additionalContext: {
          contentId,
          styleId,
          poseId,
          strengths,
          httpStatus: response.status,
          httpStatusText: response.statusText
        }
      });
      
      throw new Error(`Leonardo generation failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    log('info', `Leonardo generation response received`, { ...logContext, hasGenerationJob: !!data.sdGenerationJob });
    
    if (!data.sdGenerationJob?.generationId) {
      const errorDetails = { ...logContext, response: data };
      log('error', `Invalid Leonardo generation response structure`, errorDetails);
      
      await notifyLeonardoFailure({
        error: `Leonardo generation API returned invalid response`,
        failureReason: `Missing generationId in response`,
        step: 'generation-response-validation',
        apiEndpoint: `${LEONARDO_BASE_URL}/generations`,
        characterId,
        prompt: prompt.slice(0, 200) + (prompt.length > 200 ? '...' : ''),
        additionalContext: {
          response: data,
          contentId,
          styleId,
          poseId,
          strengths
        }
      });
      
      throw new Error(`Leonardo API returned invalid response: missing generationId`);
    }
    
    const generationId = data.sdGenerationJob.generationId;
    log('info', `Leonardo generation started successfully`, { ...logContext, generationId });
    return generationId;
  } catch (error) {
    log('error', `Leonardo image generation failed`, { 
      ...logContext, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

export async function retrieveGeneratedImage(generationId: string): Promise<string | null> {
  const logContext = { generationId, function: 'retrieveGeneratedImage' };
  
  try {
    log('info', `Checking Leonardo generation status`, logContext);
    
    const response = await fetch(
      `${LEONARDO_BASE_URL}/generations/${generationId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LEONARDO_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        errorText,
        ...logContext
      };
      
      log('error', `Leonardo generation status API failed`, errorDetails);
      
      // Send Slack notification for persistent API failures (but not for 404s which might be normal)
      if (response.status !== 404) {
        await notifyLeonardoFailure({
          error: `Leonardo generation status API failed`,
          failureReason: `Status: ${response.status} ${response.statusText}`,
          step: 'generation-status-check',
          apiEndpoint: `${LEONARDO_BASE_URL}/generations/${generationId}`,
          apiResponse: errorText,
          generationId,
          additionalContext: {
            httpStatus: response.status,
            httpStatusText: response.statusText
          }
        });
      }
      
      return null;
    }

    const data = await response.json();
    const status = data.generations_by_pk?.status;
    
    log('info', `Leonardo generation status retrieved`, { 
      ...logContext, 
      status, 
      hasGenerationData: !!data.generations_by_pk 
    });

    // Return null if generation is not complete
    if (status !== "COMPLETE") {
      log('info', `Leonardo generation not yet complete`, { ...logContext, status });
      return null;
    }

    const imageUrl = data.generations_by_pk?.generated_images[0]?.url;
    if (!imageUrl) {
      const errorDetails = { ...logContext, response: data };
      log('error', `No image URL in completed Leonardo generation`, errorDetails);
      
      await notifyLeonardoFailure({
        error: `Leonardo generation completed but no image URL found`,
        failureReason: `Generation marked as COMPLETE but missing image URL`,
        step: 'image-url-extraction',
        generationId,
        additionalContext: {
          response: data,
          status,
          apiEndpoint: `${LEONARDO_BASE_URL}/generations/${generationId}`
        }
      });
      
      return null;
    }

    log('info', `Successfully retrieved Leonardo generated image URL`, { 
      ...logContext, 
      imageUrl: imageUrl.slice(0, 50) + "..." 
    });
    return imageUrl;
  } catch (error) {
    log('error', `Failed to retrieve Leonardo generation`, { 
      ...logContext, 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Don't send Slack notifications for network/timeout errors during retrieval
    // as these are expected during the polling process
    return null;
  }
}

// New function for bulk URL signing
export async function retrieveMultipleSignedUrls(paths: string[]): Promise<string[]> {
  const { data, error } = await supabase
    .storage
    .from('book-images')
    .createSignedUrls(paths, 3600);

  if (error) {
    console.error('Bulk signed URLs error:', error);
    throw error;
  }

  return data
    .map(item => item.signedUrl)
    .filter((signedUrl): signedUrl is string => signedUrl !== null);
} 
