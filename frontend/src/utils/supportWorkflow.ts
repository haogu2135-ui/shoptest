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

const buildZhActions = (orderRef: string, statusLabel: string): Record<string, SupportOrderWorkflowAction[]> => ({
  PENDING_PAYMENT: [{
    key: 'payment-check',
    label: '核对支付',
    helper: '适用于支付失败、重复扣款或状态未更新',
    customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。我想确认支付是否成功，以及接下来应该如何完成下单。`,
    adminReply: `我正在核对订单 ${orderRef}（${statusLabel}）的支付状态，稍后会给你明确的下一步建议。`,
  }],
  PENDING_SHIPMENT: [
    {
      key: 'ship-followup',
      label: '催发货',
      helper: '适用于确认预计发货时间和仓库进度',
      customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。请帮我确认预计什么时候发货，是否还需要我补充信息。`,
      adminReply: `我正在核对订单 ${orderRef}（${statusLabel}）的备货进度，会尽快确认预计发货时间和是否缺少资料。`,
    },
    {
      key: 'address-update',
      label: '修改地址',
      helper: '适用于发货前修改地址或联系电话',
      customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。我想确认现在是否还能修改收货地址或联系电话。`,
      adminReply: `我正在确认订单 ${orderRef}（${statusLabel}）在发货前是否仍可修改地址或联系电话。`,
    },
  ],
  SHIPPED: [
    {
      key: 'tracking-check',
      label: '查看物流',
      helper: '适用于物流延迟、停滞或运输进度核查',
      customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。请帮我查看最新物流进度，是否存在延误或异常。`,
      adminReply: `我正在核对订单 ${orderRef}（${statusLabel}）的最新物流进度，稍后给你同步清晰更新。`,
    },
    {
      key: 'delivery-followup',
      label: '反馈派送问题',
      helper: '适用于派送失败或包裹未收到',
      customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。我想反馈派送问题，并确认包裹目前的位置。`,
      adminReply: `我正在查看订单 ${orderRef}（${statusLabel}）的派送异常，会确认包裹当前位置和下一步处理方式。`,
    },
  ],
  COMPLETED: [
    {
      key: 'after-sales',
      label: '售后处理',
      helper: '适用于退货、换货或质量问题',
      customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。我需要售后帮助，想确认这个订单是否可以申请退换货。`,
      adminReply: `我正在核对订单 ${orderRef}（${statusLabel}）的售后资格，会尽快确认是否支持退换货。`,
    },
    {
      key: 'product-help',
      label: '商品使用帮助',
      helper: '适用于尺码、安装或兼容性咨询',
      customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。我需要商品使用帮助，想确认尺码、安装或兼容性问题。`,
      adminReply: `我正在查看订单 ${orderRef}（${statusLabel}）的商品信息，会给你更准确的使用或兼容建议。`,
    },
  ],
  RETURN_REQUESTED: [{
    key: 'return-review',
    label: '跟进退货审核',
    helper: '适用于确认审核进度或补充资料',
    customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。请帮我确认退货审核进度，以及是否还需要我补充信息。`,
    adminReply: `我正在跟进订单 ${orderRef}（${statusLabel}）的退货审核进度，并确认是否还缺少资料。`,
  }],
  RETURN_APPROVED: [{
    key: 'return-ship',
    label: '确认退回步骤',
    helper: '适用于确认退货地址、寄回方式和时限',
    customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。我想确认退货地址、寄回步骤和需要在什么时候完成寄回。`,
    adminReply: `我正在整理订单 ${orderRef}（${statusLabel}）的退回指引，会把地址、时限和步骤发给你。`,
  }],
  RETURN_SHIPPED: [{
    key: 'refund-progress',
    label: '查看退款进度',
    helper: '适用于确认退件签收和退款到账时间',
    customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。我想确认退货是否已签收，以及退款大概什么时候完成。`,
    adminReply: `我正在核对订单 ${orderRef}（${statusLabel}）的退件签收和退款进度，稍后会同步预计时间。`,
  }],
  CANCELLED: [{
    key: 'cancel-check',
    label: '确认取消与退款',
    helper: '适用于确认订单已关闭及退款安排',
    customerPrefill: `订单 ${orderRef} 当前状态为 ${statusLabel}。请帮我确认取消是否已经完成，以及退款会如何处理。`,
    adminReply: `我正在核对订单 ${orderRef}（${statusLabel}）的取消和退款状态，稍后会确认最终结果。`,
  }],
});

const buildEsActions = (orderRef: string, statusLabel: string): Record<string, SupportOrderWorkflowAction[]> => ({
  PENDING_PAYMENT: [{
    key: 'payment-check',
    label: 'Revisar pago',
    helper: 'Para cobro fallido, duplicado o estado sin actualizar',
    customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Quiero confirmar si el pago entro correctamente y cual es el siguiente paso para completar la compra.`,
    adminReply: `Estoy revisando el pago del pedido ${orderRef} (${statusLabel}) para confirmarte si entro correctamente y cual es el siguiente paso.`,
  }],
  PENDING_SHIPMENT: [
    {
      key: 'ship-followup',
      label: 'Acelerar envio',
      helper: 'Para confirmar la fecha estimada de salida',
      customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Ayudenme a confirmar cuando se enviara y si todavia necesitan algun dato mio.`,
      adminReply: `Estoy revisando la preparacion del pedido ${orderRef} (${statusLabel}) para confirmarte la salida estimada y si falta algun dato.`,
    },
    {
      key: 'address-update',
      label: 'Cambiar direccion',
      helper: 'Para corregir direccion o telefono antes del envio',
      customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Quiero confirmar si aun puedo ajustar la direccion o el telefono de entrega.`,
      adminReply: `Estoy validando si el pedido ${orderRef} (${statusLabel}) todavia permite cambiar direccion o telefono antes del envio.`,
    },
  ],
  SHIPPED: [
    {
      key: 'tracking-check',
      label: 'Ver rastreo',
      helper: 'Para demoras, estancamiento o revision del trayecto',
      customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Ayudenme a revisar el avance del envio y si existe alguna demora o incidencia.`,
      adminReply: `Estoy validando el avance del envio del pedido ${orderRef} (${statusLabel}) para darte la actualizacion mas clara.`,
    },
    {
      key: 'delivery-followup',
      label: 'Problema de entrega',
      helper: 'Para entrega fallida o paquete no recibido',
      customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Quiero reportar un problema de entrega y confirmar donde esta el paquete ahora.`,
      adminReply: `Estoy revisando la incidencia de entrega del pedido ${orderRef} (${statusLabel}) para indicarte donde esta el paquete y el siguiente paso.`,
    },
  ],
  COMPLETED: [
    {
      key: 'after-sales',
      label: 'Postventa',
      helper: 'Para devolucion, cambio o problema de calidad',
      customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Necesito ayuda postventa y quiero confirmar si aplica devolucion o cambio.`,
      adminReply: `Estoy revisando la postventa del pedido ${orderRef} (${statusLabel}) para confirmar si aplica devolucion o cambio.`,
    },
    {
      key: 'product-help',
      label: 'Uso del producto',
      helper: 'Para talla, instalacion o compatibilidad',
      customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Necesito ayuda con uso, talla o compatibilidad del producto.`,
      adminReply: `Estoy revisando los detalles del producto del pedido ${orderRef} (${statusLabel}) para darte una guia de uso o compatibilidad.`,
    },
  ],
  RETURN_REQUESTED: [{
    key: 'return-review',
    label: 'Seguir revision',
    helper: 'Para confirmar avance o datos faltantes',
    customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Ayudenme a confirmar el avance de la revision de devolucion y si falta algun dato.`,
    adminReply: `Estoy revisando la devolucion del pedido ${orderRef} (${statusLabel}) para confirmar el avance y si necesitamos algun dato adicional.`,
  }],
  RETURN_APPROVED: [{
    key: 'return-ship',
    label: 'Confirmar retorno',
    helper: 'Para confirmar guia, direccion y plazo de retorno',
    customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Quiero confirmar la guia, direccion y plazo para devolver el producto.`,
    adminReply: `Estoy revisando los pasos de retorno del pedido ${orderRef} (${statusLabel}) para compartirte la guia, direccion y plazo correctos.`,
  }],
  RETURN_SHIPPED: [{
    key: 'refund-progress',
    label: 'Revisar reembolso',
    helper: 'Para validar recepcion y tiempo estimado del reembolso',
    customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Quiero confirmar si ya recibieron la devolucion y cuando se procesara el reembolso.`,
    adminReply: `Estoy revisando la recepcion y el estado del reembolso del pedido ${orderRef} (${statusLabel}) para darte el tiempo estimado.`,
  }],
  CANCELLED: [{
    key: 'cancel-check',
    label: 'Validar cancelacion',
    helper: 'Para confirmar cierre y reembolso si aplica',
    customerPrefill: `El pedido ${orderRef} esta en estado ${statusLabel}. Ayudenme a confirmar si la cancelacion ya quedo completa y como se procesara el reembolso.`,
    adminReply: `Estoy revisando la cancelacion del pedido ${orderRef} (${statusLabel}) y el reembolso relacionado para confirmarte el cierre correcto.`,
  }],
});

const buildEnActions = (orderRef: string, statusLabel: string): Record<string, SupportOrderWorkflowAction[]> => ({
  PENDING_PAYMENT: [{
    key: 'payment-check',
    label: 'Check payment',
    helper: 'For failed payment, duplicate charge, or a stale payment state',
    customerPrefill: `Order ${orderRef} is currently ${statusLabel}. I want to confirm whether payment went through and what the cleanest next step is to complete checkout.`,
    adminReply: `I am reviewing the payment state for order ${orderRef} (${statusLabel}) and will come back with the clearest next step.`,
  }],
  PENDING_SHIPMENT: [
    {
      key: 'ship-followup',
      label: 'Check shipment timing',
      helper: 'For estimated ship date or warehouse progress',
      customerPrefill: `Order ${orderRef} is currently ${statusLabel}. Please confirm when it is expected to ship and whether you still need any information from me.`,
      adminReply: `I am reviewing the shipment prep for order ${orderRef} (${statusLabel}) and will confirm the estimated ship timing plus any missing details.`,
    },
    {
      key: 'address-update',
      label: 'Update address',
      helper: 'For address or phone corrections before shipment',
      customerPrefill: `Order ${orderRef} is currently ${statusLabel}. I want to confirm whether I can still update the delivery address or phone number.`,
      adminReply: `I am checking whether order ${orderRef} (${statusLabel}) still allows an address or phone update before shipment.`,
    },
  ],
  SHIPPED: [
    {
      key: 'tracking-check',
      label: 'Check tracking',
      helper: 'For a delay, stall, or delivery-progress review',
      customerPrefill: `Order ${orderRef} is currently ${statusLabel}. Please help me check the latest shipment progress and whether there is any delay or exception.`,
      adminReply: `I am checking the latest delivery progress for order ${orderRef} (${statusLabel}) and will share the latest update shortly.`,
    },
    {
      key: 'delivery-followup',
      label: 'Report delivery issue',
      helper: 'For failed delivery or a package not received',
      customerPrefill: `Order ${orderRef} is currently ${statusLabel}. I want to report a delivery issue and confirm where the package is right now.`,
      adminReply: `I am reviewing the delivery issue on order ${orderRef} (${statusLabel}) and will confirm the current package status plus the next step.`,
    },
  ],
  COMPLETED: [
    {
      key: 'after-sales',
      label: 'After-sales help',
      helper: 'For returns, exchanges, or quality issues',
      customerPrefill: `Order ${orderRef} is currently ${statusLabel}. I need after-sales help and want to confirm whether this order is eligible for a return or exchange.`,
      adminReply: `I am reviewing the after-sales options for order ${orderRef} (${statusLabel}) and will confirm whether a return or exchange applies.`,
    },
    {
      key: 'product-help',
      label: 'Product guidance',
      helper: 'For sizing, setup, or compatibility questions',
      customerPrefill: `Order ${orderRef} is currently ${statusLabel}. I need help with sizing, setup, or compatibility for the product.`,
      adminReply: `I am reviewing the product details on order ${orderRef} (${statusLabel}) so I can give the most relevant usage or compatibility guidance.`,
    },
  ],
  RETURN_REQUESTED: [{
    key: 'return-review',
    label: 'Check return review',
    helper: 'For review progress or missing after-sales details',
    customerPrefill: `Order ${orderRef} is currently ${statusLabel}. Please help me confirm the return review progress and whether you still need any information from me.`,
    adminReply: `I am reviewing the return request on order ${orderRef} (${statusLabel}) and will confirm the review progress plus any missing details.`,
  }],
  RETURN_APPROVED: [{
    key: 'return-ship',
    label: 'Confirm return steps',
    helper: 'For return address, shipping steps, and deadline details',
    customerPrefill: `Order ${orderRef} is currently ${statusLabel}. Please confirm the exact return steps, address, and deadline I need to follow.`,
    adminReply: `I am checking the approved return steps for order ${orderRef} (${statusLabel}) and will share the return address, timing, and next steps.`,
  }],
  RETURN_SHIPPED: [{
    key: 'refund-progress',
    label: 'Check refund progress',
    helper: 'For return receipt confirmation and refund timing',
    customerPrefill: `Order ${orderRef} is currently ${statusLabel}. I want to confirm whether the return has been received and when the refund is expected to complete.`,
    adminReply: `I am reviewing the return receipt and refund progress for order ${orderRef} (${statusLabel}) and will confirm the expected timing.`,
  }],
  CANCELLED: [{
    key: 'cancel-check',
    label: 'Confirm cancellation',
    helper: 'For cancellation closure and related refund progress',
    customerPrefill: `Order ${orderRef} is currently ${statusLabel}. Please confirm whether the cancellation is fully completed and how the refund will be handled.`,
    adminReply: `I am reviewing the cancellation and refund status for order ${orderRef} (${statusLabel}) and will confirm the final resolution shortly.`,
  }],
});

export const buildSupportOrderWorkflowActions = (
  order: Pick<Order, 'id' | 'orderNo' | 'status'>,
  languageKey: SupportWorkflowLanguage,
  statusLabel: string
): SupportOrderWorkflowAction[] => {
  const orderRef = order.orderNo || `#${order.id}`;
  const actionsByStatus = languageKey === 'zh'
    ? buildZhActions(orderRef, statusLabel)
    : languageKey === 'es'
      ? buildEsActions(orderRef, statusLabel)
      : buildEnActions(orderRef, statusLabel);

  return actionsByStatus[order.status] || (languageKey === 'zh'
    ? [{
      key: 'general',
      label: '给出下一步',
      helper: '根据订单状态，先给客户一个明确可执行的动作。',
      customerPrefill: `我想跟进订单 ${orderRef}。请帮我确认当前状态，并告诉我最合适的下一步。`,
      adminReply: `我正在查看订单 ${orderRef}（${statusLabel}）的情况，稍后会给你一个明确的下一步建议。`,
    }]
    : languageKey === 'es'
      ? [{
        key: 'general',
        label: 'Guiar siguiente paso',
        helper: 'Deja una accion concreta segun el estado del pedido.',
        customerPrefill: `Quiero revisar el pedido ${orderRef}. Ayudenme a confirmar el estado actual y el siguiente paso mas recomendable.`,
        adminReply: `Estoy revisando el pedido ${orderRef} (${statusLabel}) para dejarte el siguiente paso recomendado.`,
      }]
      : [{
        key: 'general',
        label: 'Send next step',
        helper: 'Leave the customer with one clear action based on the order state.',
        customerPrefill: `I want to review order ${orderRef}. Please confirm the current status and the clearest next step for me.`,
        adminReply: `I am reviewing order ${orderRef} (${statusLabel}) now and will share the recommended next step shortly.`,
      }]);
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
