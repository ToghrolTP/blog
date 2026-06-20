import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { SEO } from "./SEO";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { ShoppingCartIcon, CheckIcon, ArrowLeftIcon, LoaderIcon, WrenchIcon } from "./Icons";
import { Product } from "../types";

function ImageZoom({ src, alt }: { src: string; alt: string }) {
  const [position, setPosition] = useState('50% 50%');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setPosition(`${x}% ${y}%`);
  };

  return (
    <div 
      className="relative w-full rounded-lg overflow-hidden border border-gb-bg-soft cursor-crosshair group bg-gb-bg-dark"
      onMouseMove={handleMouseMove}
    >
      <img 
        src={src} 
        alt={alt} 
        className="w-full h-auto transition-transform duration-200 ease-out group-hover:scale-[2]"
        style={{ transformOrigin: position }}
      />
    </div>
  );
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { language, t } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    const adminSecret = localStorage.getItem('adminSecret');
    const isParamAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isAdmin = !!adminSecret || isParamAdmin;

    const headers: HeadersInit = {};
    if (adminSecret) {
      headers['Authorization'] = `Bearer ${adminSecret}`;
    }

    fetch("/api/settings")
      .then((res) => res.json())
      .then((settings) => {
        if (settings.store_maintenance && !isAdmin) {
          setIsMaintenance(true);
          setLoading(false);
          return;
        }

        fetch(`/api/products/${id}`, { headers })
          .then((res) => {
            if (res.status === 503) {
              setIsMaintenance(true);
              return null;
            }
            if (!res.ok) throw new Error("Product not found");
            return res.json();
          })
          .then((data) => {
            if (data) {
              setProduct(data);
              setActiveImage(data.thumbnailUrl || (data.photos?.length > 0 ? data.photos[0] : null));
            }
            setLoading(false);
          })
          .catch((err) => {
            console.error("Failed to fetch product:", err);
            setLoading(false);
          });
      })
      .catch((err) => {
        console.error("Failed to fetch settings:", err);
        fetch(`/api/products/${id}`, { headers })
          .then((res) => {
            if (!res.ok) throw new Error("Product not found");
            return res.json();
          })
          .then((data) => {
            setProduct(data);
            setActiveImage(data.thumbnailUrl || (data.photos?.length > 0 ? data.photos[0] : null));
            setLoading(false);
          })
          .catch((prodErr) => {
            console.error("Failed to fetch product fallback:", prodErr);
            setLoading(false);
          });
      });
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gb-fg-dark animate-pulse">
        Loading product...
      </div>
    );
  }

  if (isMaintenance) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center font-mono animate-in fade-in duration-500">
        <div className="max-w-md w-full border-2 border-gb-red/50 bg-gb-bg-soft/10 p-8 rounded-lg shadow-[4px_4px_0_0_rgba(204,36,29,0.15)] relative overflow-hidden">
          <div className="text-gb-red-light text-5xl mb-6 flex justify-center animate-pixel-float">
            <WrenchIcon size={48} />
          </div>
          
          <h1 className="text-2xl font-bold text-gb-fg mb-4 border-b border-gb-bg-soft pb-4">
            {t("store_maintenance_title")}
          </h1>
          
          <p className="text-sm text-gb-fg-dark leading-relaxed mb-6">
            {t("store_maintenance_desc")}
          </p>
          
          <div className="flex justify-center">
            <Link to={language === "fa" ? "/fa" : "/"}>
              <Button variant="ghost" className="text-xs border border-gb-bg-soft hover:border-gb-orange-light text-gb-fg-dark hover:text-gb-orange-light font-mono flex items-center gap-2 cursor-pointer transition-all duration-200">
                &larr; {language === "fa" ? "بازگشت به خانه" : "Back to Home"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12 text-gb-fg-dark">
        <SEO title="Product Not Found | Log40" />
        Product not found.
      </div>
    );
  }

  const translation = product.translations?.find((t: any) => t.language === language) 
    || product.translations?.find((t: any) => t.language === 'en')
    || { title: 'Untitled', description: '', features: [], price: 0 };

  return (
    <div className="animate-in fade-in duration-700 max-w-4xl mx-auto">
      <SEO 
        title={`${translation.title} | Log40`}
        description={translation.description}
        image={product.thumbnailUrl || undefined}
        type="product"
        alternateLanguageUrls={product.translations?.map((trans: any) => ({
          lang: trans.language,
          url: `${window.location.origin}${trans.language === 'fa' ? '/fa' : ''}/store/product/${product.id}`
        }))}
      />

      <Link
        to={language === "fa" ? "/fa/store" : "/store"}
        className="inline-flex items-center gap-2 text-gb-fg-dark hover:text-gb-fg transition-colors mb-8 font-mono text-sm"
      >
        <ArrowLeftIcon className="w-4 h-4" /> {t("back_to_store")}
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          {activeImage || product.thumbnailUrl ? (
            <ImageZoom src={(activeImage || product.thumbnailUrl)!} alt={translation.title} />
          ) : (
            <div className="relative aspect-video w-full bg-gb-bg-soft/30 rounded-lg flex items-center justify-center overflow-hidden border border-gb-bg-soft">
              <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
              <span className="text-gb-fg-dark/50 font-mono relative z-10 uppercase tracking-widest text-xl">
                {t("preview")}
              </span>
            </div>
          )}
          
          {(() => {
            const allPhotos = product.thumbnailUrl ? [product.thumbnailUrl, ...product.photos] : product.photos;
            if (!allPhotos || allPhotos.length <= 1) return null;
            return (
              <div className="grid grid-cols-4 gap-2">
                {allPhotos.map((photo, idx) => {
                  const isActive = (activeImage || product.thumbnailUrl) === photo;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setActiveImage(photo)}
                      className={`relative aspect-square rounded-md overflow-hidden border cursor-pointer transition-all ${isActive ? 'border-gb-orange-light ring-2 ring-gb-orange-light/50 opacity-100' : 'border-gb-bg-soft hover:border-gb-orange-light/80 opacity-70 hover:opacity-100'}`}
                    >
                      <img src={photo} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        <div className="flex flex-col" dir={language === "fa" ? "rtl" : "ltr"}>
          {(() => {
            return (
              <>
                <div className="flex justify-between items-start mb-4 gap-4">
                  <h1 className="text-3xl font-bold text-gb-fg product-title flex-1 min-w-0 break-words">
                    {translation.title}
                  </h1>
                  <span className="bg-gb-orange-light text-black font-extrabold font-mono px-4 py-2 rounded-sm text-lg shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] product-price shrink-0" dir={language === "fa" ? "rtl" : "ltr"}>
                    {language === "fa" ? `${new Intl.NumberFormat('fa-IR').format(translation.price)} ریال` : `$${translation.price}`}
                  </span>
                </div>

                <p className="text-gb-fg-dark text-lg leading-relaxed mb-8 product-description">
                  {translation.description}
                </p>

                {translation.features.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gb-fg mb-4">
                      {t("features")}
                    </h3>
                    <div className="space-y-3">
                      {translation.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <CheckIcon className="w-5 h-5 text-gb-aqua-light shrink-0" />
                          <span className="text-gb-fg">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {product.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="bg-gb-bg-soft text-gb-fg-dark border-transparent text-sm px-3 py-1 rounded-full"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Button 
            className="w-full mt-auto py-6 text-lg gap-3 bg-gb-orange-light text-gb-bg font-mono font-bold transition-all border-2 border-transparent hover:border-gb-orange-light/20 active:translate-y-1 active:translate-x-1 hover:-translate-y-0.5 hover:-translate-x-0.5 shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.4)] active:shadow-[0px_0px_0_0_rgba(0,0,0,0.4)] focus:ring-2 focus:ring-offset-2 focus:ring-offset-gb-bg focus:ring-gb-orange-light disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:translate-x-0 disabled:hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] disabled:active:translate-y-0 disabled:active:translate-x-0"
            disabled={isPurchasing}
            onClick={() => {
              setIsPurchasing(true);
              setTimeout(() => setIsPurchasing(false), 2000);
            }}
          >
            {isPurchasing ? (
              <LoaderIcon className="w-6 h-6 animate-spin" />
            ) : (
              <ShoppingCartIcon className="w-6 h-6" />
            )}
            {isPurchasing ? t("mounting") : t("purchase_now")}
          </Button>
        </div>
      </div>
    </div>
  );
}
