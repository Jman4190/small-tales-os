import * as React from 'react';

interface EmailTemplateProps {
  previewUrl: string;
}

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
  previewUrl,
}) => (
  <div>
    <h2>Your Custom Book Preview is Ready!</h2>
    <p>Click the button below to review your book. If you do not respond within 48 hours then the book will be automatically approved and sent to print.</p>
    <a 
      href={previewUrl}
      style={{
        background: '#5075FE',
        color: '#FFFFFF',
        padding: '12px 24px',
        borderRadius: '4px',
        textDecoration: 'none',
        display: 'inline-block',
        marginTop: '16px'
      }}
    >
      View Book Preview
    </a>
    <p style={{ marginTop: '24px', fontSize: '14px', color: '#666' }}>
      This link will expire in 48 hours.
    </p>
  </div>
);

interface ShippingEmailTemplateProps {
  previewUrl: string;
  status: string;
  orderId: string;
  trackingNumber?: string;
  shippingProvider?: string;
  fulfillmentCountry?: string;
}

export const ShippingEmailTemplate: React.FC<Readonly<ShippingEmailTemplateProps>> = ({
  previewUrl,
  status,
  orderId,
  trackingNumber,
  shippingProvider,
  fulfillmentCountry,
}) => {
  let title = '';
  let message = '';
  let buttonText = '';
  let shippingInfo = '';

  // Add shipping details if available
  if (trackingNumber && shippingProvider) {
    shippingInfo = `It's being shipped via ${shippingProvider}${fulfillmentCountry ? ` from ${fulfillmentCountry}` : ''} with tracking number ${trackingNumber}.`;
  }

  switch (status) {
    case 'printed':
      title = `Your Book Has Been Printed!`;
      message = `Great news! Your custom book (Order #${orderId}) has been printed and is being prepared for shipping.`;
      buttonText = 'View Order Details';
      break;
    case 'shipped':
      title = `Your Book Is On Its Way!`;
      message = `Your custom book (Order #${orderId}) has been shipped. ${shippingInfo} Click below to track your package.`;
      buttonText = 'Track Your Package';
      break;
    case 'delivered':
      title = `Your Book Has Been Delivered!`;
      message = `Your custom book (Order #${orderId}) has been delivered. We hope you enjoy it!`;
      buttonText = 'View Order Details';
      break;
    default:
      title = `Order Status Update`;
      message = `There's an update on your custom book (Order #${orderId}). The current status is: ${status}.`;
      buttonText = 'View Order Details';
  }

  return (
    <div>
      <h2>{title}</h2>
      <p>{message}</p>
      <a 
        href={previewUrl}
        style={{
          background: '#5075FE',
          color: '#FFFFFF',
          padding: '12px 24px',
          borderRadius: '4px',
          textDecoration: 'none',
          display: 'inline-block',
          marginTop: '16px'
        }}
      >
        {buttonText}
      </a>
      <p style={{ marginTop: '24px', fontSize: '14px', color: '#666' }}>
        Thank you for choosing Storybook Starter!
      </p>
    </div>
  );
};
