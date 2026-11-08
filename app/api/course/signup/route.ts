import { readBoundedJsonObject, BodyLimitError } from '@/lib/request-body';
import { guardPublicRequest } from '@/lib/request-security';
import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EMAIL_FROM_NOREPLY, EMAIL_REPLY_TO_SUPPORT, sendEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey
);

async function sendCourseSignupConfirmation(email: string) {
  await sendEmail({
    from: EMAIL_FROM_NOREPLY,
    to: email,
    subject: "You're on the list! 🎉 How to Build Your Solo AI Business",
    replyTo: EMAIL_REPLY_TO_SUPPORT,
    html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; color: #0F0F0F; margin-bottom: 8px;">You're on the list!</h1>
          <p style="color: #666; font-size: 16px; margin: 0;">How to Build Your Solo AI Business</p>
        </div>

        <div style="background: #F8F9FF; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0;">
            Thanks for signing up! You'll be among the first to know when the course launches.
          </p>
          <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 16px 0 0 0;">
            We're gathering <strong>100 signups</strong> to unlock the course. Once we hit that goal,
            you'll receive an email with the course link where you can purchase it for just <strong>$9.99</strong>.
          </p>
        </div>

        <div style="background: #F5F5F5; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #0F0F0F; margin: 0 0 12px 0;">What you'll learn:</h2>
          <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
            <li>Build a full-stack AI-powered SaaS from scratch</li>
            <li>Set up payments with Stripe</li>
            <li>Database & storage with Supabase</li>
            <li>AI image generation with Leonardo.ai</li>
            <li>Print-on-demand fulfillment with Gelato</li>
            <li>Marketing with AI-generated video content</li>
            <li>Incorporate and run your business</li>
          </ul>
        </div>

        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 13px; margin: 0;">
            Storybook Starter, LLC &bull;
            <a href="https://www.example.com" style="color: #5075FE; text-decoration: none;">example.com</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  const denied = await guardPublicRequest(req, 'course-signup');
  if (denied) return denied;
  try {
    const { email } = await readBoundedJsonObject(req);

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Insert the signup
    const { error: insertError } = await supabaseAdmin
      .from('course_signups')
      .insert({ email: normalizedEmail });

    if (insertError) {
      // Check for unique constraint violation (duplicate email)
      if (insertError.code === '23505') {
        // Still return the count even for duplicates
        const { count } = await supabaseAdmin
          .from('course_signups')
          .select('*', { count: 'exact', head: true });

        return NextResponse.json(
          {
            error: "You're already signed up! We'll notify you when the course launches.",
            alreadySignedUp: true,
            count: count || 0
          },
          { status: 409 }
        );
      }

      console.error('Error inserting course signup:', insertError);
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }

    // Get updated count
    const { count } = await supabaseAdmin
      .from('course_signups')
      .select('*', { count: 'exact', head: true });

    // Send confirmation email (don't await - fire and forget)
    sendCourseSignupConfirmation(normalizedEmail).catch((err) =>
      console.error('Failed to send confirmation email:', err)
    );

    return NextResponse.json({
      success: true,
      count: count || 0,
      message: "You're in! We'll email you when the course launches.",
    });
  } catch (error) {
    if (error instanceof BodyLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Course signup error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
