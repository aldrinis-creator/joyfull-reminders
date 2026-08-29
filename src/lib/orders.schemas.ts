import { z } from "zod";

export const createOrderSchema = z.object({
  vendorId: z.string().uuid(),
  productId: z.string().uuid(),
  familyMemberId: z.string().uuid().nullable().optional(),
  reminderId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(20).optional(),
  recipientName: z.string().trim().min(1).max(100),
  deliveryAddress: z.string().trim().min(6).max(400),
  deliveryDate: z.string().min(1).max(20),
  giftMessage: z.string().trim().max(300).nullable().optional(),
});
