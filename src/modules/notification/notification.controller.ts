import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EmailService, NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Controller('notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService
  ) { }

  @Post("email")
  async sendEmailNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.sendNotification(createNotificationDto, this.emailService);
  }
}
