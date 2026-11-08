import { NextResponse } from 'next/server';
import crypto from 'crypto';

const LEONARDO_BASE_URL = "https://cloud.leonardo.ai/api/rest/v1";

// Validate environment variables
const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY;
const SLACK_SIGNING_SECRET = process.env.SIGNING_SECRET;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

// Verify required environment variables
if (!SLACK_SIGNING_SECRET) {
  console.error('❌ Missing SIGNING_SECRET environment variable');
  throw new Error('SIGNING_SECRET environment variable is required');
}

if (!SLACK_BOT_TOKEN) {
  console.error('❌ Missing SLACK_BOT_TOKEN environment variable');
  throw new Error('SLACK_BOT_TOKEN environment variable is required');
}

if (!LEONARDO_API_KEY) {
  console.error('❌ Missing LEONARDO_API_KEY environment variable');
  throw new Error('LEONARDO_API_KEY environment variable is required');
}

// Verify Slack request signature
function verifySlackRequest(timestamp: string, signature: string, rawBody: string): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.error('❌ Cannot verify request: SIGNING_SECRET is not configured');
    return false;
  }

  console.log('🔐 Verifying Slack request:', {
    timestamp,
    signature: signature.slice(0, 10) + '...',
    rawBodyLength: rawBody.length,
    hasSigningSecret: !!SLACK_SIGNING_SECRET
  });

  // Verify timestamp is within 5 minutes
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(currentTime - parseInt(timestamp));
  console.log('⏰ Time verification:', {
    currentTime,
    requestTime: parseInt(timestamp),
    difference: timeDiff,
    isValid: timeDiff <= 300
  });

  if (timeDiff > 300) {
    console.warn('❌ Request timestamp too old');
    return false;
  }

  try {
    const baseString = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
    const computedSignature = `v0=${hmac.update(baseString).digest('hex')}`;
    
    const isValid = signature === computedSignature;
    console.log('🔑 Signature verification:', {
      expected: signature.slice(0, 10) + '...',
      computed: computedSignature.slice(0, 10) + '...',
      isValid
    });
    
    return isValid;
  } catch (error) {
    console.error('❌ Error during signature verification:', error);
    return false;
  }
}

export async function POST(request: Request) {
  console.log('📥 Received POST request to /api/slack/credits');

  try {
    // Log all headers for debugging
    const headers = Object.fromEntries(request.headers.entries());
    console.log('📋 Request headers:', {
      ...headers,
      'authorization': headers.authorization ? '[REDACTED]' : undefined
    });

    // Get Slack headers
    const timestamp = request.headers.get('x-slack-request-timestamp');
    const signature = request.headers.get('x-slack-signature');
    
    if (!timestamp || !signature) {
      console.error('❌ Missing Slack headers:', { timestamp, signature });
      return NextResponse.json({ error: 'Missing required headers' }, { status: 401 });
    }

    // Clone the request to get the raw body
    const clonedRequest = request.clone();
    const rawBody = await request.text();
    console.log(`📝 Raw request body length: ${rawBody.length}`);
    
    // Verify request is from Slack
    if (!verifySlackRequest(timestamp, signature, rawBody)) {
      console.error('❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 });
    }

    // Parse form data
    const formData = await clonedRequest.formData();
    const command = Object.fromEntries(formData.entries());
    console.log('🎯 Parsed Slack command:', {
      ...command,
      token: command.token ? '[REDACTED]' : undefined
    });

    // Verify the team ID and enterprise ID if needed
    const teamId = command.team_id;
    const enterpriseId = command.enterprise_id;
    console.log('🏢 Team context:', { teamId, enterpriseId });

    // Send immediate acknowledgment
    const responseUrl = command.response_url;
    if (!responseUrl) {
      console.error('❌ Missing response_url in command data');
      throw new Error('Missing response_url');
    }

    console.log('🚀 Calling Leonardo API...');
    // Call Leonardo API to get user info
    const response = await fetch(`${LEONARDO_BASE_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${LEONARDO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Leonardo API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Leonardo API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Leonardo API response:', {
      status: 'success',
      hasUserDetails: !!data.user_details?.[0]
    });

    const userDetails = data.user_details[0];

    // Calculate remaining tokens and credits
    const webTokens = userDetails.paidTokens + userDetails.subscriptionTokens;
    const apiCredits = userDetails.apiPaidTokens + userDetails.apiSubscriptionTokens;
    console.log('💰 Calculated credits:', { webTokens, apiCredits });

    // Format message for Slack
    const message = {
      response_type: 'in_channel',
      text: `*Leonardo AI Credit Status:*\n• *Web Tokens:* ${webTokens}\n• *API Credits:* ${apiCredits}`,
    };

    console.log('📤 Sending message to Slack API...');
    // Send the response using Slack's Web API
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: command.channel_id,
        ...message
      })
    });

    const slackResponseData = await slackResponse.json();
    console.log('📬 Slack API response:', {
      ok: slackResponse.ok,
      status: slackResponse.status,
      data: slackResponseData
    });

    if (!slackResponse.ok) {
      throw new Error(`Failed to send message via Slack API: ${JSON.stringify(slackResponseData)}`);
    }

    console.log('✅ Successfully processed request');
    // Return immediate acknowledgment
    return new Response('', { status: 200 });
  } catch (error) {
    console.error('❌ Error in request handler:', error);
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Error retrieving credits information. Please try again later.'
    }, { status: 500 });
  }
}
