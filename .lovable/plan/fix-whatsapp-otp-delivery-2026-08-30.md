# Fix WhatsApp OTP delivery

## Confirmed diagnosis

The live request at 07:29 UTC created a WhatsApp OTP challenge, but it was never consumed; the SMS requested shortly afterward was received and verified. The app currently treats most MSG91 HTTP 200 responses as success, but MSG91 reports template and recipient failures through `hasError` and nested response data. Those errors are not parsed, so the UI can say the WhatsApp code was sent when MSG91 rejected it.

The configured secrets include the MSG91 key and sending number, but no explicit WhatsApp template namespace, OTP language, or OTP-button setting. Those values must exactly match the approved `verification_otp` template.

## Implementation

1. **Correct the MSG91 request and response handling**
  - Keep `verification_otp` as the OTP template.
  - Resolve the approved template metadata from MSG91 so the namespace, language, and required components match the live template rather than relying on guesses.
  - Build the authentication-template payload with the exact body/button component mapping returned for that template.
  - Parse `hasError`, nested recipient errors, HTTP errors, and malformed responses; only return success when MSG91 supplies a valid accepted request/message identifier.
  - Log provider identifiers and sanitized rejection reasons, never the OTP itself.
2. **Make failure behavior honest and recoverable**
  - Mark a rejected WhatsApp challenge unusable and return a localized error that immediately offers SMS instead.
  - Do not show “code sent” for an unverified or rejected provider response.
  - Preserve the existing OTP expiry, hashing, attempt limits, and rate limits.
3. **Add delivery diagnostics**
  - Store the provider request/message identifier and initial provider state on the OTP challenge so a request can be traced without exposing the code.
  - Add a signature/secret-protected public MSG91 status callback that records `sent`, `delivered`, `read`, or `failed` and acknowledges quickly.
  - Keep OTP records inaccessible to browser clients.
4. **Verify end to end**
  - Send a fresh WhatsApp OTP to the existing test number `+919819576467`.
  - Confirm the provider accepts the exact approved template, then confirm the status reaches `delivered` and the received code verifies successfully.
  - Exercise a rejected-template case and confirm the app reports failure and offers SMS instead of claiming success.
  - Run focused checks, type validation, and the app build.

## Technical notes

- Update the MSG91 client/server OTP flow and add a small database migration for provider ID/status fields.
- Add the status callback under `/api/public/` with caller verification and Zod validation.
- Keep all user-facing English/Hindi strings in the existing i18n dictionaries; provider templates remain English.

refer to code below:  
curl --location --request POST

  '[https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/](https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/)'

  --header 'Content-Type: application/json'

  --header 'authkey: <authkey>'

  --data-raw '{

    "integrated_number": "917045868482",

    "content_type": "template",

    "payload": {

        "messaging_product": "whatsapp",

        "type": "template",

        "template": {

            "name": "verification_otp",

            "language": {

                "code": "en",

                "policy": "deterministic"

            },

            "namespace": "e67e5302_b6d0_403e_b3cc_8fa6e8accb01",

            "to_and_components": [

                {

                    "to": [

                        "<list_of_phone_numbers>"

                    ],

                    "components": {

                        "body_1": {

                            "type": "text",

                            "value": "value1"

                        },

                        "button_1": {

                            "subtype": "url",

                            "type": "text",

                            "value": "<{{url text variable}}>"

                        }

                    }

                }

            ]

        }

    }

}'

&nbsp;