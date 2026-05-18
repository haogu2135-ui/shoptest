import type { Order } from '../types';

export type SupportWorkflowLanguage = 'zh' | 'es' | 'en';

export type SupportOrderWorkflowAction = {
  key: string;
  label: string;
  helper: string;
  customerPrefill: string;
  adminReply: string;
};

const normalizeSupportWorkflowText = (value?: string) =>
  (value || '').replace(/\s+/g, ' ').trim();

type WorkflowCopy = {
  label: string;
  helper: string;
  customer: string;
  admin: string;
};

const templates: Record<SupportWorkflowLanguage, Record<string, WorkflowCopy[]>> = {
  zh: {
    PENDING_PAYMENT: [{
      label: '核对支付',
      helper: '适用于支付失败、重复扣款或状态未更新',
      customer: '订单 {orderRef} 当前状态为 {statusLabel}。我想确认支付是否成功，以及接下来应该如何完成下单。',
      admin: '我正在核对订单 {orderRef}（{statusLabel}）的支付状态，稍后会给您明确的下一步建议。',
    }],
    PENDING_SHIPMENT: [
      {
        label: '催发货',
        helper: '确认预计发货时间和仓库进度',
        customer: '订单 {orderRef} 当前状态为 {statusLabel}。请帮我确认预计什么时候发货，是否还需要我补充信息。',
        admin: '我正在核对订单 {orderRef}（{statusLabel}）的备货进度，会尽快确认预计发货时间和是否缺少资料。',
      },
      {
        label: '修改地址',
        helper: '发货前修改地址或联系电话',
        customer: '订单 {orderRef} 当前状态为 {statusLabel}。我想确认现在是否还能修改收货地址或联系电话。',
        admin: '我正在确认订单 {orderRef}（{statusLabel}）在发货前是否仍可修改地址或联系电话。',
      },
    ],
    SHIPPED: [
      {
        label: '查看物流',
        helper: '核查物流延迟、停滞或运输进度',
        customer: '订单 {orderRef} 当前状态为 {statusLabel}。请帮我查看最新物流进度，是否存在延误或异常。',
        admin: '我正在核对订单 {orderRef}（{statusLabel}）的最新物流进度，稍后同步清晰更新。',
      },
      {
        label: '反馈派送问题',
        helper: '派送失败或包裹未收到',
        customer: '订单 {orderRef} 当前状态为 {statusLabel}。我想反馈派送问题，并确认包裹目前的位置。',
        admin: '我正在查看订单 {orderRef}（{statusLabel}）的派送异常，会确认包裹当前位置和下一步处理方式。',
      },
    ],
    COMPLETED: [
      {
        label: '售后处理',
        helper: '退货、换货或质量问题',
        customer: '订单 {orderRef} 当前状态为 {statusLabel}。我需要售后帮助，想确认这个订单是否可以申请退换货。',
        admin: '我正在核对订单 {orderRef}（{statusLabel}）的售后资格，会尽快确认是否支持退换货。',
      },
      {
        label: '商品使用帮助',
        helper: '尺码、安装或兼容性咨询',
        customer: '订单 {orderRef} 当前状态为 {statusLabel}。我需要商品使用帮助，想确认尺码、安装或兼容性问题。',
        admin: '我正在查看订单 {orderRef}（{statusLabel}）的商品信息，会给您更准确的使用或兼容建议。',
      },
    ],
    RETURN_REQUESTED: [{
      label: '跟进退货审核',
      helper: '确认审核进度或补充资料',
      customer: '订单 {orderRef} 当前状态为 {statusLabel}。请帮我确认退货审核进度，以及是否还需要我补充信息。',
      admin: '我正在跟进订单 {orderRef}（{statusLabel}）的退货审核进度，并确认是否还缺少资料。',
    }],
    RETURN_APPROVED: [{
      label: '确认退回步骤',
      helper: '确认退货地址、寄回方式和期限',
      customer: '订单 {orderRef} 当前状态为 {statusLabel}。我想确认退货地址、寄回步骤和需要在什么时候完成寄回。',
      admin: '我正在整理订单 {orderRef}（{statusLabel}）的退回指引，会把地址、时限和步骤发给您。',
    }],
    RETURN_SHIPPED: [{
      label: '查看退款进度',
      helper: '确认退件签收和退款到账时间',
      customer: '订单 {orderRef} 当前状态为 {statusLabel}。我想确认退货是否已签收，以及退款大概什么时候完成。',
      admin: '我正在核对订单 {orderRef}（{statusLabel}）的退件签收和退款进度，稍后同步预计时间。',
    }],
    CANCELLED: [{
      label: '确认取消与退款',
      helper: '确认订单关闭及退款安排',
      customer: '订单 {orderRef} 当前状态为 {statusLabel}。请帮我确认取消是否已经完成，以及退款会如何处理。',
      admin: '我正在核对订单 {orderRef}（{statusLabel}）的取消和退款状态，稍后确认最终结果。',
    }],
  },
  es: {
    PENDING_PAYMENT: [{
      label: 'Revisar pago',
      helper: 'Para cobro fallido, duplicado o estado sin actualizar',
      customer: 'El pedido {orderRef} esta en estado {statusLabel}. Quiero confirmar si el pago entro correctamente y cual es el siguiente paso para completar la compra.',
      admin: 'Estoy revisando el pago del pedido {orderRef} ({statusLabel}) para confirmarte si entro correctamente y cual es el siguiente paso.',
    }],
    PENDING_SHIPMENT: [
      {
        label: 'Acelerar envio',
        helper: 'Para confirmar la fecha estimada de salida',
        customer: 'El pedido {orderRef} está en estado {statusLabel}. Ayúdenme a confirmar cuándo se enviará y si todavía necesitan algún dato mío.',
        admin: 'Estoy revisando la preparación del pedido {orderRef} ({statusLabel}) para confirmarte la salida estimada y si falta algún dato.',
      },
      {
        label: 'Cambiar dirección',
        helper: 'Para corregir dirección o teléfono antes del envío',
        customer: 'El pedido {orderRef} está en estado {statusLabel}. Quiero confirmar si aún puedo ajustar la dirección o el teléfono de entrega.',
        admin: 'Estoy validando si el pedido {orderRef} ({statusLabel}) todavía permite cambiar dirección o teléfono antes del envío.',
      },
    ],
    SHIPPED: [
      {
        label: 'Ver rastreo',
        helper: 'Para demoras, estancamiento o revisión del trayecto',
        customer: 'El pedido {orderRef} está en estado {statusLabel}. Ayúdenme a revisar el avance del envío y si existe alguna demora o incidencia.',
        admin: 'Estoy validando el avance del envío del pedido {orderRef} ({statusLabel}) para darte la actualización más clara.',
      },
      {
        label: 'Problema de entrega',
        helper: 'Para entrega fallida o paquete no recibido',
        customer: 'El pedido {orderRef} está en estado {statusLabel}. Quiero reportar un problema de entrega y confirmar dónde está el paquete ahora.',
        admin: 'Estoy revisando la incidencia de entrega del pedido {orderRef} ({statusLabel}) para indicarte dónde está el paquete y el siguiente paso.',
      },
    ],
    COMPLETED: [
      {
        label: 'Postventa',
        helper: 'Para devolución, cambio o problema de calidad',
        customer: 'El pedido {orderRef} está en estado {statusLabel}. Necesito ayuda postventa y quiero confirmar si aplica devolución o cambio.',
        admin: 'Estoy revisando la postventa del pedido {orderRef} ({statusLabel}) para confirmar si aplica devolución o cambio.',
      },
      {
        label: 'Uso del producto',
        helper: 'Para talla, instalación o compatibilidad',
        customer: 'El pedido {orderRef} esta en estado {statusLabel}. Necesito ayuda con uso, talla o compatibilidad del producto.',
        admin: 'Estoy revisando los detalles del producto del pedido {orderRef} ({statusLabel}) para darte una guía de uso o compatibilidad.',
      },
    ],
    RETURN_REQUESTED: [{
      label: 'Seguir revisión',
      helper: 'Para confirmar avance o datos faltantes',
      customer: 'El pedido {orderRef} está en estado {statusLabel}. Ayúdenme a confirmar el avance de la revisión de devolución y si falta algún dato.',
      admin: 'Estoy revisando la devolución del pedido {orderRef} ({statusLabel}) para confirmar el avance y si necesitamos algún dato adicional.',
    }],
    RETURN_APPROVED: [{
      label: 'Confirmar retorno',
      helper: 'Para confirmar guía, dirección y plazo de retorno',
      customer: 'El pedido {orderRef} está en estado {statusLabel}. Quiero confirmar la guía, dirección y plazo para devolver el producto.',
      admin: 'Estoy revisando los pasos de retorno del pedido {orderRef} ({statusLabel}) para compartirte la guía, dirección y plazo correctos.',
    }],
    RETURN_SHIPPED: [{
      label: 'Revisar reembolso',
      helper: 'Para validar recepcion y tiempo estimado del reembolso',
      customer: 'El pedido {orderRef} esta en estado {statusLabel}. Quiero confirmar si ya recibieron la devolucion y cuando se procesara el reembolso.',
      admin: 'Estoy revisando la recepcion y el estado del reembolso del pedido {orderRef} ({statusLabel}) para darte el tiempo estimado.',
    }],
    CANCELLED: [{
      label: 'Validar cancelacion',
      helper: 'Para confirmar cierre y reembolso si aplica',
      customer: 'El pedido {orderRef} esta en estado {statusLabel}. Ayudenme a confirmar si la cancelacion ya quedo completa y como se procesara el reembolso.',
      admin: 'Estoy revisando la cancelacion del pedido {orderRef} ({statusLabel}) y el reembolso relacionado para confirmarte el cierre correcto.',
    }],
  },
  en: {
    PENDING_PAYMENT: [{
      label: 'Check payment',
      helper: 'For failed payment, duplicate charge, or a stale payment state',
      customer: 'Order {orderRef} is currently {statusLabel}. I want to confirm whether payment went through and what the cleanest next step is to complete checkout.',
      admin: 'I am reviewing the payment state for order {orderRef} ({statusLabel}) and will come back with the clearest next step.',
    }],
    PENDING_SHIPMENT: [
      {
        label: 'Check shipment timing',
        helper: 'For estimated ship date or warehouse progress',
        customer: 'Order {orderRef} is currently {statusLabel}. Please confirm when it is expected to ship and whether you still need any information from me.',
        admin: 'I am reviewing the shipment prep for order {orderRef} ({statusLabel}) and will confirm the estimated ship timing plus any missing details.',
      },
      {
        label: 'Update address',
        helper: 'For address or phone corrections before shipment',
        customer: 'Order {orderRef} is currently {statusLabel}. I want to confirm whether I can still update the delivery address or phone number.',
        admin: 'I am checking whether order {orderRef} ({statusLabel}) still allows an address or phone update before shipment.',
      },
    ],
    SHIPPED: [
      {
        label: 'Check tracking',
        helper: 'For a delay, stall, or delivery-progress review',
        customer: 'Order {orderRef} is currently {statusLabel}. Please help me check the latest shipment progress and whether there is any delay or exception.',
        admin: 'I am checking the latest delivery progress for order {orderRef} ({statusLabel}) and will share the latest update shortly.',
      },
      {
        label: 'Report delivery issue',
        helper: 'For failed delivery or a package not received',
        customer: 'Order {orderRef} is currently {statusLabel}. I want to report a delivery issue and confirm where the package is right now.',
        admin: 'I am reviewing the delivery issue on order {orderRef} ({statusLabel}) and will confirm the current package status plus the next step.',
      },
    ],
    COMPLETED: [
      {
        label: 'After-sales help',
        helper: 'For returns, exchanges, or quality issues',
        customer: 'Order {orderRef} is currently {statusLabel}. I need after-sales help and want to confirm whether this order is eligible for a return or exchange.',
        admin: 'I am reviewing the after-sales options for order {orderRef} ({statusLabel}) and will confirm whether a return or exchange applies.',
      },
      {
        label: 'Product guidance',
        helper: 'For sizing, setup, or compatibility questions',
        customer: 'Order {orderRef} is currently {statusLabel}. I need help with sizing, setup, or compatibility for the product.',
        admin: 'I am reviewing the product details on order {orderRef} ({statusLabel}) so I can give the most relevant usage or compatibility guidance.',
      },
    ],
    RETURN_REQUESTED: [{
      label: 'Check return review',
      helper: 'For review progress or missing after-sales details',
      customer: 'Order {orderRef} is currently {statusLabel}. Please help me confirm the return review progress and whether you still need any information from me.',
      admin: 'I am reviewing the return request on order {orderRef} ({statusLabel}) and will confirm the review progress plus any missing details.',
    }],
    RETURN_APPROVED: [{
      label: 'Confirm return steps',
      helper: 'For return address, shipping steps, and deadline details',
      customer: 'Order {orderRef} is currently {statusLabel}. Please confirm the exact return steps, address, and deadline I need to follow.',
      admin: 'I am checking the approved return steps for order {orderRef} ({statusLabel}) and will share the return address, timing, and next steps.',
    }],
    RETURN_SHIPPED: [{
      label: 'Check refund progress',
      helper: 'For return receipt confirmation and refund timing',
      customer: 'Order {orderRef} is currently {statusLabel}. I want to confirm whether the return has been received and when the refund is expected to complete.',
      admin: 'I am reviewing the return receipt and refund progress for order {orderRef} ({statusLabel}) and will confirm the expected timing.',
    }],
    CANCELLED: [{
      label: 'Confirm cancellation',
      helper: 'For cancellation closure and related refund progress',
      customer: 'Order {orderRef} is currently {statusLabel}. Please confirm whether the cancellation is fully completed and how the refund will be handled.',
      admin: 'I am reviewing the cancellation and refund status for order {orderRef} ({statusLabel}) and will confirm the final resolution shortly.',
    }],
  },
};

const fallbackTemplates: Record<SupportWorkflowLanguage, WorkflowCopy> = {
  zh: {
    label: '给出下一步',
    helper: '根据订单状态给出明确可执行动作',
    customer: '我想跟进订单 {orderRef}。请帮我确认当前状态，并告诉我最合适的下一步。',
    admin: '我正在查看订单 {orderRef}（{statusLabel}）的情况，稍后会给您一个明确的下一步建议。',
  },
  es: {
    label: 'Guiar siguiente paso',
    helper: 'Deja una acción concreta según el estado del pedido.',
    customer: 'Quiero revisar el pedido {orderRef}. Ayúdenme a confirmar el estado actual y el siguiente paso más recomendable.',
    admin: 'Estoy revisando el pedido {orderRef} ({statusLabel}) para dejarte el siguiente paso recomendado.',
  },
  en: {
    label: 'Send next step',
    helper: 'Leave the customer with one clear action based on the order state.',
    customer: 'I want to review order {orderRef}. Please confirm the current status and the clearest next step for me.',
    admin: 'I am reviewing order {orderRef} ({statusLabel}) now and will share the recommended next step shortly.',
  },
};

const interpolate = (template: string, orderRef: string, statusLabel: string) =>
  template.replace(/\{orderRef\}/g, orderRef).replace(/\{statusLabel\}/g, statusLabel);

export const buildSupportOrderWorkflowActions = (
  order: Pick<Order, 'id' | 'orderNo' | 'status'>,
  languageKey: SupportWorkflowLanguage,
  statusLabel: string
): SupportOrderWorkflowAction[] => {
  const orderRef = order.orderNo || `#${order.id}`;
  const copies = templates[languageKey][order.status] || [fallbackTemplates[languageKey]];

  return copies.map((copy, index) => ({
    key: `${order.status}-${copy.label}-${index}`,
    label: copy.label,
    helper: copy.helper,
    customerPrefill: interpolate(copy.customer, orderRef, statusLabel),
    adminReply: interpolate(copy.admin, orderRef, statusLabel),
  }));
};

export const findSupportOrderWorkflowActionByMessage = (
  actions: SupportOrderWorkflowAction[],
  content?: string,
  actor: 'customer' | 'admin' = 'customer'
) => {
  const normalizedMessage = normalizeSupportWorkflowText(content);
  if (!normalizedMessage) return null;

  return actions.find((action) => {
    const candidate = actor === 'admin' ? action.adminReply : action.customerPrefill;
    return normalizeSupportWorkflowText(candidate) === normalizedMessage;
  }) || null;
};
