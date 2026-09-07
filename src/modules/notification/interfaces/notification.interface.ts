export interface Notification {
    send(message: string, recipientEmail?: string, mobileNumber?: number): Promise<void>;
}