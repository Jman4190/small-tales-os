import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logBookEvent } from "@/lib/book-logger"
import {
  extractBookPhotosRelativePath,
  isAllowedBookPhotosPdfPath,
} from "@/lib/security"

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  if (!token) {
    console.error("[validate-token] Token missing")
    
    // Log token missing error
    logBookEvent(null, "token_validation_error", {
      error: "Token missing",
      timestamp: new Date().toISOString()
    })
    
    return NextResponse.json({ error: "Token missing" }, { status: 400 })
  }

  try {
    const { data: approval, error } = await supabase
      .from("book_approvals")
      .select("book_id, order_id, status, pdf_url, auto_approved")
      .eq("token", token)
      .single()

    if (error || !approval) {
      console.error("[validate-token] Error or no approval found:", error)
      
      // Log invalid token error
      logBookEvent(null, "token_validation_error", {
        error: "Invalid token",
        token: token,
        dbError: error ? error.message : null,
        timestamp: new Date().toISOString()
      })
      
      return NextResponse.json({ error: "Invalid token" }, { status: 404 })
    }

    
    // Log successful token validation
    logBookEvent(approval.book_id, "token_validated", {
      token: token,
      pdfUrl: approval.pdf_url,
      autoApproved: approval.auto_approved,
      timestamp: new Date().toISOString()
    })

    let signedPdfUrl: string | null = null

    if (approval.pdf_url) {
      const relativePath = extractBookPhotosRelativePath(approval.pdf_url)

      if (isAllowedBookPhotosPdfPath(relativePath)) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('book-photos')
          .createSignedUrl(relativePath, 3600, { download: true })

        if (signedUrlError) {
          console.error("[validate-token] Failed to create signed preview URL:", signedUrlError)
        } else {
          signedPdfUrl = signedUrlData?.signedUrl ?? null
        }
      }
    }

    return NextResponse.json({
      message: "Token valid",
      status: approval.status,
      pdfUrl: signedPdfUrl,
      autoApproved: approval.auto_approved
    })
  } catch (error) {
    console.error("[validate-token] Unexpected error:", error)
    
    // Log unexpected error
    logBookEvent(null, "token_validation_error", {
      error: error instanceof Error ? error.message : String(error),
      token: token,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
    
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    )
  }
}
