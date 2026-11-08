import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface ResendPreviewTemplateProps {
  previewUrl?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://www.example.com"; // Fallback for local dev or other environments

export const ResendPreviewTemplate = ({
  previewUrl = "https://www.example.com/preview", // Default fallback link
}: ResendPreviewTemplateProps) => (
  <Html>
    <Head />
    <Preview>Your Updated Book Preview is Ready!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src={`${baseUrl}/release-placeholder.svg`} // Ensure logo path is correct
          width="150"
          height="auto"
          alt="Storybook Starter Logo"
          style={logo}
        />
        <Heading style={heading}>Your Updated Book Preview is Ready!</Heading>
        <Text style={paragraph}>
          We've made some updates to your personalized book based on your
          request or our internal review. Please take a moment to review the
          updated digital preview.
        </Text>
        <Text style={paragraph}>
          Click the button below to view your updated book. If everything looks
          good, please approve it so we can send it to print. If you have any
          concerns, please reach out to our support team.
        </Text>
        <Button style={button} href={previewUrl}>
          View Updated Preview & Approve
        </Button>
        <Text style={paragraph}>
          If the button above doesn't work, you can copy and paste this link
          into your browser:
        </Text>
        <Link href={previewUrl} style={link}>
          {previewUrl}
        </Link>
        <Text style={footer}>Storybook Starter</Text>
      </Container>
    </Body>
  </Html>
);

export default ResendPreviewTemplate;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  width: "580px",
};

const logo = {
  margin: "0 auto",
  display: "block", // Center the logo
};

const heading = {
  fontSize: "28px",
  fontWeight: "bold",
  marginTop: "48px",
  textAlign: "center" as const, // Center align heading
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const button = {
  backgroundColor: "#5E548E", // Example button color
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block", // Use inline-block for better control
  padding: "12px 20px",
  margin: "16px auto", // Center button
};

const link = {
  color: "#5E548E",
  fontSize: "14px",
  textDecoration: "underline",
  wordBreak: "break-all" as const, // Ensure long links wrap
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  marginTop: "24px",
  textAlign: "center" as const, // Center footer text
}; 