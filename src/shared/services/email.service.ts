import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly mailerService: MailerService) { }

    async sendOtpEmail(email: string, otp: string, name: string,): Promise<boolean> {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: 'Your Verification Code (OTP)',
                template: 'otpTemplate', // Matches email.hbs in the templates directory
                context: { name, otp, },
            });

            this.logger.log(`OTP email successfully sent to ${email}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Failed to send OTP email to ${email}`, error.stack);
            throw error;
        }
    }
}