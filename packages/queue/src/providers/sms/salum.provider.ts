import type { SMSProvider, SMSResult } from './interface';

interface SalumConfig {
    apiKey: string;
    partnerId: string;
    shortcode: string;
    apiUrl?: string;
}

interface SalumResponse {
    responses: Array<{
        'respose-code': number; // Note: API has typo "respose"
        'response-description': string;
        mobile: string;
        messageid?: number;
        networkid?: string;
    }>;
}

export class SalumSMSProvider implements SMSProvider {
    private config: SalumConfig;

    constructor(config?: Partial<SalumConfig>) {
        this.config = {
            apiKey: config?.apiKey || process.env.SALUM_API_KEY || '',
            partnerId: config?.partnerId || process.env.SALUM_PARTNER_ID || '',
            shortcode: config?.shortcode || process.env.SALUM_SHORTCODE || 'BURETI-TEA',
            apiUrl: config?.apiUrl || 'https://sms.salum.co.ke/api/services/sendsms/',
        };

        if (!this.config.apiKey || !this.config.partnerId) {
            throw new Error('Salum SMS provider requires apiKey and partnerId');
        }
    }

    getName(): string {
        return 'salum';
    }

    async send(phoneNumber: string, message: string): Promise<SMSResult> {
        try {
            // Normalize phone number to 254 format
            const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

            const requestBody = {
                apikey: this.config.apiKey,
                partnerID: this.config.partnerId,
                message: message,
                shortcode: this.config.shortcode,
                mobile: normalizedPhone,
            };

            const response = await fetch(this.config.apiUrl!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json() as SalumResponse;

            // Check if we have responses
            if (!data.responses || data.responses.length === 0) {
                return {
                    success: false,
                    error: 'No response from Salum API',
                    provider: this.getName(),
                };
            }

            const result = data.responses[0];

            // Salum uses 200 as success code
            if (result['respose-code'] === 200) {
                return {
                    success: true,
                    messageId: result.messageid?.toString(),
                    provider: this.getName(),
                };
            } else {
                return {
                    success: false,
                    error: result['response-description'] || 'Unknown error',
                    provider: this.getName(),
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: this.getName(),
            };
        }
    }

    /**
     * Normalize phone number to Kenyan format (254XXXXXXXXX)
     * Handles: 0712345678, +254712345678, 254712345678, 712345678
     */
    private normalizePhoneNumber(phone: string): string {
        // Remove any spaces, dashes, or parentheses
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');

        // Remove leading + if present
        if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }

        // If starts with 0, replace with 254
        if (cleaned.startsWith('0')) {
            cleaned = '254' + cleaned.substring(1);
        }

        // If doesn't start with 254 and is 9 digits, add 254
        if (!cleaned.startsWith('254') && cleaned.length === 9) {
            cleaned = '254' + cleaned;
        }

        return cleaned;
    }
}
