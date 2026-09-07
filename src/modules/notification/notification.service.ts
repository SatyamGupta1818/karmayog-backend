import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Notification } from './interfaces/notification.interface';

@Injectable()
export class NotificationService {
  async sendNotification(notificationDTO: CreateNotificationDto, notification: Notification): Promise<void> {
    // Implementation for sending notification
    notification.send(notificationDTO.message, notificationDTO.recipientEmail, notificationDTO.mobileNumber);
  }
}


@Injectable()
export class EmailService implements Notification {
  async send(message: string, recipientEmail: string): Promise<void> {
    const subject: string = 'Notification';
    const body: string = message;

    const emailOptions: { to: string; subject: string; text: string } = {
      to: recipientEmail,
      subject: subject,
      text: body,
    };
    await this.sendEmail(emailOptions);
  }

  private async sendEmail(emailOptions: { to: string; subject: string; text: string }): Promise<void> {
    console.log(`Email Data: ${JSON.stringify(emailOptions)}`);
    console.log(`Email sent to ${emailOptions.to} with subject: ${emailOptions.subject} and body: ${emailOptions.text}`);
    console.log('Email sent successfully');
  }
}