import { z } from 'zod';

/** 스탬프 적립 전화번호 — 뒷자리 4자리 또는 전체 11자리 */
export const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\d*$/, '숫자만 입력할 수 있어요')
    .refine((v) => v.length === 4 || v.length === 11, {
      message: '뒷자리 4자리 또는 전체 11자리를 입력해 주세요',
    }),
});

export type PhoneForm = z.infer<typeof phoneSchema>;

/** 장바구니에 담기 전 필수 옵션 검증 (디저트는 온도·사이즈가 없다) */
export const optionSchema = z
  .object({
    dessert: z.boolean(),
    temp: z.enum(['hot', 'ice']).nullable(),
    size: z.enum(['regular', 'large']).nullable(),
    ice: z.enum(['normal', 'less', 'none', 'more']),
    qty: z.number().int().min(1).max(9),
  })
  .refine((v) => v.dessert || v.temp !== null, {
    path: ['temp'],
    message: '따뜻한 걸로 드릴까요, 차가운 걸로 드릴까요?',
  })
  .refine((v) => v.dessert || v.size !== null, {
    path: ['size'],
    message: '사이즈를 골라 주세요',
  });

export type OptionForm = z.infer<typeof optionSchema>;
