export class BookingService {
  constructor(private prisma: any, private mailService: any) {}

  async createBooking(data: any) {
    this.validateBooking(data);
    await this.prisma.booking.create({ data });
    await this.mailService.sendConfirmation(data.email);
  }

  private validateBooking(data: any) {
    if (!data.startDate) {
      throw new Error('Start date required');
    }
  }
}
