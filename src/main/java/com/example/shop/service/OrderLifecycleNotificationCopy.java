package com.example.shop.service;

import org.springframework.context.i18n.LocaleContextHolder;

import java.util.Locale;

/**
 * Localized title/body templates for customer order lifecycle notifications (in-app + email).
 * English copy stays stable for existing commercial contracts; zh/es cover storefront languages.
 */
public final class OrderLifecycleNotificationCopy {
    public static final class Notice {
        private final String title;
        private final String message;

        public Notice(String title, String message) {
            this.title = title;
            this.message = message;
        }

        public String getTitle() {
            return title;
        }

        public String getMessage() {
            return message;
        }
    }

    private enum Language {
        EN, ZH, ES
    }

    private OrderLifecycleNotificationCopy() {
    }

    public static Locale resolveLocale() {
        try {
            Locale locale = LocaleContextHolder.getLocale();
            if (locale != null && locale.getLanguage() != null) {
                String language = locale.getLanguage().toLowerCase(Locale.ROOT);
                if (language.startsWith("zh")) {
                    return Locale.SIMPLIFIED_CHINESE;
                }
                if (language.startsWith("es")) {
                    return new Locale("es");
                }
                if (language.startsWith("en")) {
                    return Locale.ENGLISH;
                }
            }
        } catch (RuntimeException ignored) {
            // Non-request threads may lack a locale context; default to English.
            return Locale.ENGLISH;
        }
        return Locale.ENGLISH;
    }

    public static Notice paymentReceived(Locale locale, String orderNo, String amountPlain) {
        String safeOrderNo = safe(orderNo);
        Language language = languageOf(locale);
        String amountText = "";
        if (amountPlain != null && !amountPlain.trim().isEmpty()) {
            String amount = amountPlain.trim();
            if (language == Language.ZH) {
                amountText = " 金额：" + amount + "。";
            } else if (language == Language.ES) {
                amountText = " Monto: " + amount + ".";
            } else {
                amountText = " Amount: " + amount + ".";
            }
        }
        if (language == Language.ZH) {
            return new Notice("已收到付款", "订单 " + safeOrderNo + " 的付款已到账。" + amountText + " 我们将尽快为您备货发货。");
        }
        if (language == Language.ES) {
            return new Notice("Pago recibido", "Se recibió el pago del pedido " + safeOrderNo + "." + amountText + " Prepararemos el envío a continuación.");
        }
        return new Notice(
                "Payment received",
                "Payment for order " + safeOrderNo + " has been received." + amountText + " We will prepare shipment next."
        );
    }

    public static Notice orderShipped(Locale locale, String orderNo, String trackingNumber, String carrierName) {
        String safeOrderNo = safe(orderNo);
        String tracking = safe(trackingNumber);
        String carrier = carrierName == null ? "" : carrierName.trim();
        Language language = languageOf(locale);
        if (tracking.isEmpty()) {
            if (language == Language.ZH) {
                return new Notice("订单已发货", "订单 " + safeOrderNo + " 已发货。");
            }
            if (language == Language.ES) {
                return new Notice("Pedido enviado", "El pedido " + safeOrderNo + " ha sido enviado.");
            }
            return new Notice("Order shipped", "Order " + safeOrderNo + " has shipped.");
        }
        if (language == Language.ZH) {
            return new Notice(
                    "订单已发货",
                    "订单 " + safeOrderNo + " 已发货"
                            + (carrier.isEmpty() ? "" : "，承运商 " + carrier)
                            + "。运单号：" + tracking + "。"
            );
        }
        if (language == Language.ES) {
            return new Notice(
                    "Pedido enviado",
                    "El pedido " + safeOrderNo + " ha sido enviado"
                            + (carrier.isEmpty() ? "" : " por " + carrier)
                            + ". Número de guía: " + tracking + "."
            );
        }
        return new Notice(
                "Order shipped",
                "Order " + safeOrderNo + " has shipped"
                        + (carrier.isEmpty() ? "" : " via " + carrier)
                        + ". Tracking number: " + tracking + "."
        );
    }

    public static Notice orderCompleted(Locale locale, String orderNo) {
        String safeOrderNo = safe(orderNo);
        Language language = languageOf(locale);
        if (language == Language.ZH) {
            return new Notice("订单已完成", "订单 " + safeOrderNo + " 已完成。在退货窗口内，您可在订单追踪页申请退货。");
        }
        if (language == Language.ES) {
            return new Notice(
                    "Pedido completado",
                    "El pedido " + safeOrderNo + " se completó. Puedes solicitar una devolución desde el seguimiento mientras la ventana esté abierta."
            );
        }
        return new Notice(
                "Order completed",
                "Order " + safeOrderNo + " has been completed. You can request a return from order tracking while the return window is open."
        );
    }

    public static Notice orderCancelled(Locale locale, String orderNo) {
        String safeOrderNo = safe(orderNo);
        Language language = languageOf(locale);
        if (language == Language.ZH) {
            return new Notice("订单已取消", "订单 " + safeOrderNo + " 已取消。");
        }
        if (language == Language.ES) {
            return new Notice("Pedido cancelado", "El pedido " + safeOrderNo + " ha sido cancelado.");
        }
        return new Notice("Order cancelled", "Order " + safeOrderNo + " has been cancelled.");
    }

    public static Notice orderRefunded(Locale locale, String orderNo) {
        String safeOrderNo = safe(orderNo);
        Language language = languageOf(locale);
        if (language == Language.ZH) {
            return new Notice("订单已退款", "订单 " + safeOrderNo + " 的退款已完成。");
        }
        if (language == Language.ES) {
            return new Notice("Pedido reembolsado", "Se completó el reembolso del pedido " + safeOrderNo + ".");
        }
        return new Notice("Order refunded", "Refund for order " + safeOrderNo + " has been completed.");
    }

    public static Notice returnRequested(Locale locale, String orderNo) {
        String safeOrderNo = safe(orderNo);
        Language language = languageOf(locale);
        if (language == Language.ZH) {
            return new Notice("已收到退货申请", "订单 " + safeOrderNo + " 的退货申请已提交，等待审核。");
        }
        if (language == Language.ES) {
            return new Notice("Solicitud de devolución recibida", "La solicitud de devolución del pedido " + safeOrderNo + " se envió a revisión.");
        }
        return new Notice("Return request received", "Return request for order " + safeOrderNo + " has been submitted for review.");
    }

    public static Notice returnApproved(Locale locale, String orderNo) {
        String safeOrderNo = safe(orderNo);
        Language language = languageOf(locale);
        if (language == Language.ZH) {
            return new Notice("退货已批准", "订单 " + safeOrderNo + " 的退货申请已批准。请寄回商品并提交退货运单号。");
        }
        if (language == Language.ES) {
            return new Notice(
                    "Devolución aprobada",
                    "La devolución del pedido " + safeOrderNo + " fue aprobada. Envía el paquete de retorno y registra el número de guía."
            );
        }
        return new Notice(
                "Return approved",
                "Return request for order " + safeOrderNo + " has been approved. Please send the return shipment and submit the tracking number."
        );
    }

    public static Notice returnRejected(Locale locale, String orderNo) {
        String safeOrderNo = safe(orderNo);
        Language language = languageOf(locale);
        if (language == Language.ZH) {
            return new Notice("退货申请已关闭", "订单 " + safeOrderNo + " 的退货申请未通过，订单已恢复为已完成。");
        }
        if (language == Language.ES) {
            return new Notice(
                    "Solicitud de devolución cerrada",
                    "La devolución del pedido " + safeOrderNo + " no fue aprobada. El pedido volvió a completado."
            );
        }
        return new Notice(
                "Return request closed",
                "Return request for order " + safeOrderNo + " was not approved. The order is now back to completed status."
        );
    }

    public static Notice returnShipped(Locale locale, String orderNo, String trackingNumber) {
        String safeOrderNo = safe(orderNo);
        String tracking = safe(trackingNumber);
        Language language = languageOf(locale);
        if (language == Language.ZH) {
            return new Notice("已登记退货运单", "退货运单号 " + tracking + " 已保存到订单 " + safeOrderNo + "。");
        }
        if (language == Language.ES) {
            return new Notice(
                    "Guía de devolución registrada",
                    "Se guardó la guía de devolución " + tracking + " para el pedido " + safeOrderNo + "."
            );
        }
        return new Notice(
                "Return shipment submitted",
                "Return tracking number " + tracking + " was saved for order " + safeOrderNo + "."
        );
    }

    public static Notice returnCompleted(Locale locale, String orderNo) {
        String safeOrderNo = safe(orderNo);
        Language language = languageOf(locale);
        if (language == Language.ZH) {
            return new Notice("退货退款已完成", "订单 " + safeOrderNo + " 的退货退款已完成。");
        }
        if (language == Language.ES) {
            return new Notice("Devolución completada", "Se completó el reembolso por devolución del pedido " + safeOrderNo + ".");
        }
        return new Notice("Return completed", "Return refund for order " + safeOrderNo + " has been completed.");
    }

    private static Language languageOf(Locale locale) {
        if (locale == null || locale.getLanguage() == null) {
            return Language.EN;
        }
        String normalized = locale.getLanguage().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("zh")) {
            return Language.ZH;
        }
        if (normalized.startsWith("es")) {
            return Language.ES;
        }
        return Language.EN;
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
