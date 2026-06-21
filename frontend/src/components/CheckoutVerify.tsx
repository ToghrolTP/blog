import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { SEO } from "./SEO";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { CheckCircleIcon, XCircleIcon, LoaderIcon, ArrowLeftIcon } from "./Icons";

export function CheckoutVerify() {
  const { language, t } = useLanguage();
  const [searchParams] = useSearchParams();
  
  const statusParam = searchParams.get("status");
  const orderId = searchParams.get("orderId");
  const tokenParam = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "failure">("loading");
  const [downloadToken, setDownloadToken] = useState<string | null>(tokenParam);

  useEffect(() => {
    if (statusParam === "failure" || !orderId) {
      setStatus("failure");
      return;
    }

    if (statusParam === "success") {
      if (tokenParam) {
        setDownloadToken(tokenParam);
        setStatus("success");
        return;
      }

      // No token in URL (Crypto checkout redirect success_url)
      // Poll /api/orders/{orderId}/token to check order payment completion
      let attempts = 0;
      const maxAttempts = 15; // 45 seconds max poll

      const pollToken = async () => {
        try {
          const res = await fetch(`/api/orders/${orderId}/token`);
          if (res.ok) {
            const data = await res.json();
            if (data.token) {
              setDownloadToken(data.token);
              setStatus("success");
              return;
            }
          }
        } catch (err) {
          console.error("Failed to fetch order token:", err);
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollToken, 3000);
        } else {
          setStatus("failure");
        }
      };

      pollToken();
    }
  }, [statusParam, orderId, tokenParam]);

  const isRtl = language === "fa";

  return (
    <div className="animate-in fade-in duration-500 max-w-md mx-auto py-12 font-mono" dir={isRtl ? "rtl" : "ltr"}>
      <SEO title={`${t("checkout_title") || "Checkout"} | Log40`} />

      <Card className="border-2 p-6 md:p-8 rounded text-center shadow-2xl relative overflow-hidden">
        {status === "loading" && (
          <div className="space-y-6 py-6">
            <div className="text-gb-orange-light text-5xl flex justify-center animate-spin">
              <LoaderIcon size={48} />
            </div>
            <h1 className="text-xl font-bold text-gb-fg">
              {t("checkout_verifying") || "Verifying Payment..."}
            </h1>
            <p className="text-xs text-gb-fg-dark/80">
              {isRtl 
                ? "در حال بررسی تراکنش و ایجاد لینک دانلود امن. لطفاً این صفحه را نبندید."
                : "Checking transaction status and creating secure download link. Please don't close this page."}
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6 py-4">
            <div className="text-gb-green-light text-5xl flex justify-center animate-bounce">
              <CheckCircleIcon size={54} />
            </div>
            <h1 className="text-2xl font-bold text-gb-fg border-b border-gb-bg-soft pb-4">
              {t("checkout_success_title") || "Payment Successful!"}
            </h1>
            <p className="text-sm text-gb-fg-dark leading-relaxed">
              {t("checkout_success_desc") || "Thank you for your purchase. Your digital template/book is ready for download."}
            </p>

            {downloadToken && (
              <a
                href={`/api/downloads/${orderId}?token=${downloadToken}`}
                className="block w-full"
              >
                <Button className="w-full py-4 text-base font-extrabold bg-gb-green-light text-gb-bg border-2 border-transparent hover:border-gb-green-light/20 shadow-[3px_3px_0_0_rgba(0,0,0,0.25)] hover:translate-y-[-1px] active:translate-y-[1px] transition-all">
                  {t("checkout_download_btn") || "Download File"}
                </Button>
              </a>
            )}

            <div className="pt-4 border-t border-gb-bg-soft">
              <Link to={isRtl ? "/fa/store" : "/store"}>
                <Button variant="ghost" className="text-xs text-gb-fg-dark hover:text-gb-fg flex items-center gap-2 mx-auto cursor-pointer">
                  <ArrowLeftIcon size={14} />
                  <span>{t("checkout_back_store") || "Back to Store"}</span>
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === "failure" && (
          <div className="space-y-6 py-4">
            <div className="text-gb-red-light text-5xl flex justify-center animate-pixel-shake">
              <XCircleIcon size={54} />
            </div>
            <h1 className="text-2xl font-bold text-gb-fg border-b border-gb-bg-soft pb-4">
              {t("checkout_fail_title") || "Payment Failed"}
            </h1>
            <p className="text-sm text-gb-fg-dark leading-relaxed">
              {t("checkout_fail_desc") || "The transaction was canceled or could not be verified. Please try again."}
            </p>

            <div className="pt-6 border-t border-gb-bg-soft">
              <Link to={isRtl ? "/fa/store" : "/store"}>
                <Button className="w-full py-3 bg-gb-orange-light text-gb-bg font-bold border-2 border-transparent hover:border-gb-orange-light/20 shadow-md">
                  {t("checkout_back_store") || "Back to Store"}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
