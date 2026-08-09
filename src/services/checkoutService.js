import { getBestOffer } from "./offerService.js";
import { calculateOfferPrice } from "./priceService.js";

export async function calculateCheckout(cart, couponDiscount = 0) {
    let subtotal = 0;
    let offerDiscount = 0;

    for (const item of cart.items) {
        const currentPrice = item.variantId.salePrice != null ? item.variantId.salePrice : item.variantId.regularPrice;
        // Calculate offer
        const offer = await getBestOffer(item.productId, currentPrice);
        const pricing = calculateOfferPrice(currentPrice, offer);
        
        item.subtotal = item.quantity * pricing.finalPrice;
        subtotal += item.quantity * currentPrice;
        offerDiscount += item.quantity * pricing.discount;
    }

    const shipping = 0;
    const taxableAmount = Math.max(0, subtotal - offerDiscount - couponDiscount);
    const tax = parseFloat((taxableAmount * 0.18).toFixed(2));

    const grandTotal =
        subtotal
        - couponDiscount
        - offerDiscount
        + tax
        + shipping;

    return {
        subtotal,
        couponDiscount,
        offerDiscount,
        discount: couponDiscount + offerDiscount,
        shipping,
        tax,
        grandTotal: Math.max(0, grandTotal)
    };
}