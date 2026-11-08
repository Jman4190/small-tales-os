# Security policy

Do not disclose exploitable issues or customer information in public issues. Use **Security → Report a vulnerability** when enabled on the repository. Otherwise contact the owner privately through their GitHub profile and request a secure channel before sending sensitive details.

Include the affected version, reproduction steps using synthetic data, and expected impact. Do not access real customer records to demonstrate an issue or send live credentials in the report.

This is a reference implementation with external service requirements. No supported-version or security response-time guarantee is offered. Review database/storage access, guest authorization, administrator privileges, webhook verification, and rate limits before deployment. Writing a migration does not change production: apply and verify it separately. If a live SQL connection is unavailable, that remediation remains unverified.

Never commit environment values, service keys, webhook secrets, customer data, PDFs, or private photos. Browser-prefixed values are public. Revoke and replace exposed credentials at the provider; deleting a file does not invalidate a secret. A fresh source export does not repair a deployed database.

Diagnostic output removes sensitive structured fields and recognizable emails, phone numbers, URLs, and credential patterns. Node.js registers this protection through instrumentation; shared external log senders also sanitize their payloads. This cannot infer arbitrary personal names embedded in prose, so never interpolate customer or child details into log messages. Analytics accepts only explicit operational metrics, uses anonymous IDs, and disables automatic page capture, replay, and personal profiles. Both analytics key and host must be configured to enable it.
