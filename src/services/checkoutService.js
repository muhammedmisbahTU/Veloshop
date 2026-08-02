// services/checkoutService.js

export function calculateCheckout(cart, couponDiscount = 0) {
    let subtotal = 0;

    cart.items.forEach(item => {
        item.subtotal = item.quantity * item.variantId.salePrice;
        subtotal += item.subtotal;
    });

    const offerDiscount = 0;
    const shipping = 0;
    const tax = subtotal * 0.18;

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
        grandTotal
    };
}