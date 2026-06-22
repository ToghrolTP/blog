import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { XIcon, ShoppingCartIcon, LoaderIcon } from "./Icons";
import { Button } from "./ui/Button";
import { Product } from "../types";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export function CheckoutModal({ isOpen, onClose, product }: CheckoutModalProps) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [gateway, setGateway] = useState<"zarinpal" | "crypto">("zarinpal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !user) return null;

  const translation = product.translations?.find((t) => t.language === language)
    || product.translations?.find((t) => t.language === "en")
    || { title: "Untitled", price: 0 };

  const faTranslation = product.translations?.find((t) => t.language === "fa");
  const enTranslation = product.translations?.find((t) => t.language === "en");

  const tomanPrice = faTranslation?.price ?? enTranslation?.price ?? 0;
  const usdPrice = enTranslation?.price ?? faTranslation?.price ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          gateway,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          setError("Failed to resolve redirection URL.");
        }
      } else {
        const errMsg = await res.text();
        setError(errMsg || "Checkout failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRtl = language === "fa";

  return (
    <div className="fixed inset-0 bg-[#000000]/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
      {/* Modal Container */}
      <div
        className="bg-gb-bg border-2 border-gb-bg-soft rounded p-6 md:p-8 max-w-md w-full shadow-2xl relative font-mono animate-in zoom-in-95 duration-200"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 ${isRtl ? "left-4" : "right-4"} text-gb-fg-dark hover:text-gb-red-light transition-colors cursor-pointer p-1`}
          aria-label="Close checkout"
        >
          <XIcon size={18} />
        </button>

        {/* Title */}
        <h3 className="text-xl md:text-2xl font-bold text-gb-fg mb-6 text-center border-b border-gb-bg-soft pb-4">
          {t("checkout_title") || "Checkout"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info Details */}
          <div className="bg-gb-bg-soft/10 border border-gb-bg-soft/50 rounded p-3 text-xs space-y-1">
            <span className="text-gb-fg-dark/80 block font-bold">
              {t("checkout_user_email") || "Account Email Address"}
            </span>
            <span className="text-gb-fg font-bold block truncate">{user.email}</span>
          </div>

          {/* Product Info */}
          <div className="border-b border-gb-bg-soft pb-4 flex justify-between items-center">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-gb-fg-dark/50 uppercase tracking-widest block">
                {t("checkout_product") || "Product"}
              </span>
              <span className="text-sm font-bold text-gb-fg truncate block">
                {translation.title}
              </span>
            </div>
            <span className="bg-gb-orange-light text-black font-extrabold px-2.5 py-1 rounded-sm text-xs shadow-sm shrink-0">
              {gateway === "zarinpal"
                ? `${new Intl.NumberFormat(isRtl ? "fa-IR" : "en-US").format(tomanPrice)} تومان`
                : `$${usdPrice}`}
            </span>
          </div>

          {/* Gateway Selection */}
          <div className="space-y-3">
            <label className="text-xs text-gb-fg-dark/80 font-bold block">
              {t("checkout_payment_method") || "Payment Method"}
            </label>
            <div className="grid grid-cols-1 gap-3">
              {/* Rial Card */}
              <div
                onClick={() => !isSubmitting && setGateway("zarinpal")}
                className={`border-2 rounded p-4 cursor-pointer select-none flex items-center justify-between transition-all ${
                  gateway === "zarinpal"
                    ? "border-gb-orange-light bg-gb-orange-light/5 shadow-[0_0_8px_rgba(254,128,25,0.15)]"
                    : "border-gb-bg-soft bg-transparent hover:border-gb-orange-light/30"
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gb-fg">
                    {t("checkout_pay_toman") || "Pay in Tomans (ZarinPal)"}
                  </span>
                  <span className="text-[10px] text-gb-fg-dark/50 mt-1">
                    {t("checkout_pay_toman_sub") || "Shetab Cards & Direct Gateways"}
                  </span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${gateway === "zarinpal" ? "border-gb-orange-light" : "border-gb-fg-dark/30"}`}>
                  {gateway === "zarinpal" && <div className="w-2 h-2 rounded-full bg-gb-orange-light" />}
                </div>
              </div>

              {/* Crypto Card */}
              <div
                onClick={() => !isSubmitting && setGateway("crypto")}
                className={`border-2 rounded p-4 cursor-pointer select-none flex items-center justify-between transition-all ${
                  gateway === "crypto"
                    ? "border-gb-orange-light bg-gb-orange-light/5 shadow-[0_0_8px_rgba(254,128,25,0.15)]"
                    : "border-gb-bg-soft bg-transparent hover:border-gb-orange-light/30"
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gb-fg">
                    {t("checkout_pay_crypto") || "Pay with Crypto (NOWPayments)"}
                  </span>
                  <span className="text-[10px] text-gb-fg-dark/50 mt-1">
                    {t("checkout_pay_crypto_sub") || "BTC, ETH, USDT & other coins"}
                  </span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${gateway === "crypto" ? "border-gb-orange-light" : "border-gb-fg-dark/30"}`}>
                  {gateway === "crypto" && <div className="w-2 h-2 rounded-full bg-gb-orange-light" />}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-gb-red-light/10 border border-gb-red-light/30 rounded p-3 text-xs text-gb-red-light font-bold leading-normal animate-in shake duration-200 text-start">
              <p className="mb-1 uppercase tracking-wider text-[10px] opacity-75">
                {t("checkout_error_title") || "Checkout Failed"}
              </p>
              <p>{error}</p>
              {error.includes("ZarinPal") && (
                <p className="mt-2 text-[10px] text-gb-fg-dark/70 font-normal">
                  {isRtl 
                    ? "سیستم زرین‌پال با خطا مواجه شد. در صورت تداوم می‌توانید روش پرداخت با رمزارز را امتحان کنید."
                    : "ZarinPal gateway is experiencing issues. You can try paying with Crypto (NOWPayments) instead."}
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gb-orange-light text-gb-bg font-bold border-2 border-transparent hover:border-gb-orange-light/20 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)] flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <LoaderIcon className="w-5 h-5 animate-spin" />
            ) : (
              <ShoppingCartIcon className="w-5 h-5" />
            )}
            <span>
              {isSubmitting
                ? t("checkout_verifying") || "Redirecting..."
                : t("checkout_submit") || "Proceed to Payment"}
            </span>
          </Button>
        </form>
      </div>
    </div>
  );
}
