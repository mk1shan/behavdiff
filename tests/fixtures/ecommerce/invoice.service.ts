export class InvoiceService {
  constructor(private prisma: any, private mailService: any) {}

  async createInvoice(data: any) {
    this.validateInvoice(data);
    await this.prisma.invoice.create({ data });
    await this.mailService.sendConfirmation(data.email);
  }

  private validateInvoice(data: any) {
    if (!data.amount) {
      throw new Error('Amount required');
    }
  }
}
