import User from "../models/User.js";
import Address from "../models/Address.js";
import Cart from "../models/Cart.js"; //.js full time 
import Variant from "../models/Variant.js";
import Order from "../models/Order.js";
import PDFDocument from "pdfkit";
import crypto from "crypto";


class orderController {
  async getOrders(req, res) {
    try {

        const userId = req.session?.user?.id || req.user?._id;

        const orders = await Order.find({ userId })
        .select("orderNumber createdAt status paymentMethod paymentStatus grandTotal items.thumbnail items.productName")
        .sort({ createdAt: -1 });

        res.render("user/orders", {
            title: "My Orders",
            orders,
            search:null
        });

    } catch (error) {
        console.log(error);
        res.redirect("/");
    }
}

async cancelOrder(req,res){

try{

const userId = req.session?.user?.id || req.user?._id;

const { reason } = req.body || {};
const cancellationText = reason || "Cancelled by customer";

const order = await Order.findOneAndUpdate(
    {
        _id: req.params.id,
        userId,
        status: { $in: ["PENDING", "CONFIRMED"] }
    },
    {
        $set: {
            status: "CANCELLED",
            cancellationReason: cancellationText,
            "items.$[].itemStatus": "CANCELLED",
            "items.$[].cancellationReason": cancellationText
        }
    },
    { new: false }
);

if(!order){
    return res.json({
        success:false,
        message:"Order not found or cannot be cancelled now"
    });
}

for(const item of order.items){
  if (item.itemStatus !== "CANCELLED") {
    const variant = await Variant.findById(item.variantId);
    if(variant){
      variant.stock += item.quantity;
      await variant.save();
    }
  }
}

const totalToRefund = order.grandTotal - (order.refundAmount || 0);

if (order.paymentStatus === "SUCCESS" && (order.paymentMethod === "ONLINE" || order.paymentMethod === "WALLET") && totalToRefund > 0) {
    const Wallet = (await import("../models/Wallet.js")).default;
    const Transaction = (await import("../models/Transaction.js")).default;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0 });
    }

    wallet.balance += totalToRefund;
    await wallet.save();

    await Transaction.create({
        userId,
        walletId: wallet._id,
        referenceType: "REFUND",
        referenceId: order._id,
        amount: totalToRefund,
        balanceAfter: wallet.balance,
        transactionType: "CREDIT",
        status: "SUCCESS",
        description: `Refund for cancelled order ${order.orderNumber}`
    });

    await Order.updateOne(
        { _id: order._id },
        {
            $set: {
                paymentStatus: "REFUNDED",
                refundStatus: "COMPLETED",
                refundAmount: order.grandTotal
            }
        }
    );
}

return res.json({
success:true,
message:"Order cancelled successfully"
});

}catch(error){

console.error("Cancel order error:", error);

return res.status(500).json({

success:false,
message:"Something went wrong"

});

}

}

async cancelOrderItem(req,res){

try{

const userId = req.session?.user?.id || req.user?._id;

const {orderId,itemId}=req.params;
const {reason}=req.body;

const order = await Order.findOneAndUpdate(
  {
    _id: orderId,
    userId,
    status: { $nin: ["SHIPPED", "DELIVERED", "CANCELLED"] },
    items: {
      $elemMatch: {
        _id: itemId,
        itemStatus: "ACTIVE"
      }
    }
  },
  {
    $set: {
      "items.$[elem].itemStatus": "CANCELLED",
      "items.$[elem].cancellationReason": reason || "No reason provided"
    }
  },
  {
    arrayFilters: [{ "elem._id": itemId }],
    new: false
  }
);

if(!order){
    return res.json({
        success:false,
        message:"Order or item not found, or cannot be cancelled now"
    });
}

const item = order.items.id(itemId);

const variant = await Variant.findById(item.variantId);
if(variant){
    variant.stock += item.quantity;
    await variant.save();
}

const activeItems = order.items.filter(
    i => i.itemStatus === "ACTIVE" && i._id.toString() !== itemId.toString()
);
const originalSubtotal = order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
const newStatus = activeItems.length === 0 ? "CANCELLED" : order.status;

let newSubtotal = activeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
const newTaxAmount = originalSubtotal > 0 ? parseFloat((((order.taxAmount || 0) * newSubtotal) / originalSubtotal).toFixed(2)) : 0;
const newOfferDiscount = originalSubtotal > 0 ? parseFloat((((order.offerDiscount || 0) * newSubtotal) / originalSubtotal).toFixed(2)) : 0;
const newCouponDiscount = originalSubtotal > 0 ? parseFloat((((order.couponDiscount || 0) * newSubtotal) / originalSubtotal).toFixed(2)) : 0;
const newGrandTotal = Math.max(0, parseFloat((newSubtotal + newTaxAmount + order.shippingCost - newCouponDiscount - newOfferDiscount).toFixed(2)));

// Proportional refund calculation
let itemRefund = 0;

if (activeItems.length === 0) {
  // Last active item: refund the remaining balance of the grandTotal
  itemRefund = order.grandTotal - (order.refundAmount || 0);
} else {
  if (originalSubtotal > 0) {
    const totalDiscount = (order.couponDiscount || 0) + (order.offerDiscount || 0);
    const itemPriceTotal = item.price * item.quantity;
    const itemDiscount = (totalDiscount * itemPriceTotal) / originalSubtotal;
    const itemTax = ((order.taxAmount || 0) * itemPriceTotal) / originalSubtotal;
    itemRefund = itemPriceTotal - itemDiscount + itemTax;
  } else {
    itemRefund = item.price * item.quantity;
  }
  itemRefund = Math.min(itemRefund, order.grandTotal - (order.refundAmount || 0));
}
itemRefund = Math.max(0, parseFloat(itemRefund.toFixed(2)));

let newRefundAmount = (order.refundAmount || 0);
let newPaymentStatus = order.paymentStatus;
let newRefundStatus = order.refundStatus;

if (order.paymentStatus === "SUCCESS" && (order.paymentMethod === "ONLINE" || order.paymentMethod === "WALLET") && itemRefund > 0) {
    const Wallet = (await import("../models/Wallet.js")).default;
    const Transaction = (await import("../models/Transaction.js")).default;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0 });
    }

    wallet.balance += itemRefund;
    await wallet.save();

    await Transaction.create({
        userId,
        walletId: wallet._id,
        referenceType: "REFUND",
        referenceId: order._id,
        amount: itemRefund,
        balanceAfter: wallet.balance,
        transactionType: "CREDIT",
        status: "SUCCESS",
        description: `Refund for cancelled item (${item.productName}) in order ${order.orderNumber}`
    });

    newRefundAmount += itemRefund;
    if (activeItems.length === 0) {
        newPaymentStatus = "REFUNDED";
        newRefundStatus = "COMPLETED";
    }
}

await Order.updateOne(
  { _id: order._id },
  {
    $set: {
      status: newStatus,
      subtotal: newSubtotal,
      taxAmount: newTaxAmount,
      offerDiscount: newOfferDiscount,
      couponDiscount: newCouponDiscount,
      grandTotal: newGrandTotal,
      refundAmount: newRefundAmount,
      paymentStatus: newPaymentStatus,
      refundStatus: newRefundStatus
    }
  }
);

return res.json({
success:true,
message:"Product cancelled successfully"
});

}catch(error){

console.error("Cancel order item error:", error);

return res.status(500).json({

success:false,
message:"Something went wrong"

});

}

}

async returnOrderItem(req,res){

try{


const userId =
req.session?.user?.id || req.user?._id;


const {
orderId,
itemId
}=req.params;


const {
reason
}=req.body;



if(!reason || reason.trim().length < 3){

return res.json({

success:false,

message:"Return reason is required"

});

}



const order = await Order.findOne({

_id:orderId,

userId

});



if(!order){

return res.json({

success:false,

message:"Order not found"

});

}



if(order.status !== "DELIVERED"){

return res.json({

success:false,

message:"Only delivered orders can be returned"

});

}



const item = order.items.id(itemId);



if(!item){

return res.json({

success:false,

message:"Product not found"

});

}



if(item.returnStatus !== "NONE"){

return res.json({

success:false,

message:"Return already requested"

});

}



item.returnStatus="REQUESTED";

item.returnReason=reason;


order.returnStatus="REQUESTED";
order.returnReason=reason;

await order.save();



return res.json({

success:true,

message:"Return request submitted"

});



}catch(error){


console.log(error);


return res.status(500).json({

success:false,

message:"Something went wrong"

});


}

}

async downloadInvoice(req,res){

try{


const userId =
req.session?.user?.id || req.user?._id;



const order = await Order.findOne({

_id:req.params.id,

userId

})
.populate("userId");



if(!order){

return res.status(404).send(
"Order not found"
);

}



res.setHeader(
"Content-Type",
"application/pdf"
);


res.setHeader(
"Content-Disposition",
`attachment; filename=invoice-${order.orderNumber}.pdf`
);



const doc = new PDFDocument({
  margin: 50,
  size: "A4"
});

doc.pipe(res);

const brandColor = "#84CC16"; // Lime/Green accent
const darkSlate = "#0F172A"; // Very dark slate for readable text
const lightSlate = "#475569"; // Slate gray for secondary text/labels
const tableHeaderBg = "#F1F5F9"; // Cool gray header background
const borderBg = "#E2E8F0"; // Very light border line

// 1. Accent Color Banner at the top
doc.rect(0, 0, doc.page.width, 12).fill(brandColor);

// 2. Company Brand Header
doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(22).text("VELOSHOP", 50, 40);
doc.fillColor(lightSlate).font("Helvetica").fontSize(9).text("Premium Mechanical Keyboards, Mice & Accessories", 50, 65);
doc.text("support@veloshop.com | www.veloshop.com", 50, 78);

// Invoice Label on the right
doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(20).text("INVOICE", doc.page.width - 150, 40, { align: "right", width: 100 });
doc.strokeColor(borderBg).lineWidth(1).moveTo(50, 100).lineTo(doc.page.width - 50, 100).stroke();

// 3. Billing & Order Info Columns (Two-column grid)
// Left Column: Customer Details
doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(11).text("BILLED TO:", 50, 120);
doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(10).text(order.userId.fullName, 50, 135);
doc.fillColor(lightSlate).font("Helvetica").fontSize(9);
doc.text(order.addressSnapshot.addressLine1, 50, 150, { width: 230 });
doc.text(`${order.addressSnapshot.city}, ${order.addressSnapshot.state}`, 50, 165, { width: 230 });
doc.text(`${order.addressSnapshot.country} - ${order.addressSnapshot.pinCode}`, 50, 180, { width: 230 });

// Right Column: Invoice Details metadata
doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(11).text("ORDER DETAILS:", doc.page.width - 290, 120, { width: 220 });

const detailsStartY = 135;
const detailsRowHeight = 14;

const metadata = [
  { label: "Order ID:", val: order.orderNumber },
  { label: "Date:", val: order.createdAt.toDateString() },
  { label: "Payment Method:", val: order.paymentMethod },
  { label: "Payment Status:", val: order.paymentStatus }
];

metadata.forEach((item, index) => {
  const rowY = detailsStartY + (index * detailsRowHeight);
  doc.fillColor(lightSlate).font("Helvetica-Bold").fontSize(9).text(item.label, doc.page.width - 290, rowY, { width: 100 });
  doc.fillColor(darkSlate).font("Helvetica").fontSize(8.5).text(item.val, doc.page.width - 190, rowY, { width: 140, align: "left" });
});

doc.strokeColor(borderBg).lineWidth(1).moveTo(50, 205).lineTo(doc.page.width - 50, 205).stroke();

// 4. Products Table
const tableStartY = 225;

// Draw Table Header Background block
doc.rect(50, tableStartY, doc.page.width - 100, 20).fill(tableHeaderBg);

// Table Headers Text
doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(9);
doc.text("Item Description", 60, tableStartY + 6, { width: 210 });
doc.text("Price", 270, tableStartY + 6, { width: 60, align: "right" });
doc.text("Qty", 335, tableStartY + 6, { width: 35, align: "right" });
doc.text("Status", 375, tableStartY + 6, { width: 85, align: "right" });
doc.text("Total", 465, tableStartY + 6, { width: doc.page.width - 50 - 465 - 10, align: "right" });

let currentY = tableStartY + 20;

order.items.forEach((item, index) => {
  // Zebra striping background for clean visual grouping
  if (index % 2 === 1) {
    doc.rect(50, currentY, doc.page.width - 100, 20).fill("#FAFAFA");
  }

  doc.fillColor(darkSlate).font("Helvetica").fontSize(9);
  doc.text(`${index + 1}. ${item.productName}`, 60, currentY + 6, { width: 200, height: 12, ellipsis: true });
  doc.text(`INR ${Number(item.price || 0).toFixed(2)}`, 270, currentY + 6, { width: 60, align: "right" });
  doc.text(`${item.quantity}`, 335, currentY + 6, { width: 35, align: "right" });
  doc.text(`${item.itemStatus}`, 375, currentY + 6, { width: 85, align: "right" });
  
  const rowTotal = (item.price || 0) * (item.quantity || 0);
  doc.text(`INR ${Number(rowTotal).toFixed(2)}`, 465, currentY + 6, { width: doc.page.width - 50 - 465 - 10, align: "right" });

  // Light bottom border line
  doc.strokeColor(borderBg).lineWidth(0.5).moveTo(50, currentY + 20).lineTo(doc.page.width - 50, currentY + 20).stroke();
  currentY += 20;
});

// 5. Payment Summary Block (Right Aligned layout)
currentY += 15;

const summaryLabelsX = doc.page.width - 250;
const summaryValuesX = doc.page.width - 140;
const summaryRowHeight = 16;

const summaryData = [
  { label: "Subtotal:", val: `INR ${Number(order.subtotal || 0).toFixed(2)}` },
  { label: "Discount:", val: `INR ${Number((order.couponDiscount || 0) + (order.offerDiscount || 0)).toFixed(2)}` },
  { label: "Tax Amount:", val: `INR ${Number(order.taxAmount || 0).toFixed(2)}` },
  { label: "Shipping Cost:", val: `INR ${Number(order.shippingCost || 0).toFixed(2)}` }
];

summaryData.forEach((item, index) => {
  const rowY = currentY + (index * summaryRowHeight);
  doc.fillColor(lightSlate).font("Helvetica-Bold").fontSize(9).text(item.label, summaryLabelsX, rowY, { width: 100 });
  doc.fillColor(darkSlate).font("Helvetica").fontSize(9).text(item.val, summaryValuesX, rowY, { width: 100, align: "right" });
});

// Highlighted Grand Total Row
const grandTotalY = currentY + (summaryData.length * summaryRowHeight) + 5;
doc.rect(summaryLabelsX - 10, grandTotalY - 4, 180, 20).fill("#ECFDF5"); // Light green fill

doc.fillColor("#047857").font("Helvetica-Bold").fontSize(10).text("Grand Total:", summaryLabelsX, grandTotalY, { width: 100 });
doc.fillColor("#047857").font("Helvetica-Bold").fontSize(10).text(`INR ${Number(order.grandTotal || 0).toFixed(2)}`, summaryValuesX, grandTotalY, { width: 100, align: 'right' });

// 6. Footer section at page bottom
doc.strokeColor(borderBg).lineWidth(1).moveTo(50, doc.page.height - 80).lineTo(doc.page.width - 50, doc.page.height - 80).stroke();
doc.fillColor(lightSlate).font("Helvetica-Oblique").fontSize(9).text("Thank you for shopping with us!", 50, doc.page.height - 65, { align: "center", width: doc.page.width - 100 });

doc.end();



}
catch(error){

console.log(error);


res.status(500).send(
"Invoice generation failed"
);


}


}

async searchOrders(req,res){

try{


const userId =
req.session?.user?.id || req.user?._id;


const search = req.query.search || "";


const orders = await Order.find({

userId,

$or:[

{
    orderNumber:{
        $regex:search,
        $options:"i"
    }
},

{
    "items.productName":{
        $regex:search,
        $options:"i"
    }
},

{
    status:{
        $regex:search,
        $options:"i"
    }
}

]

})
.sort({
createdAt:-1
});



res.render(
"user/orders",
{
    orders,
    search
}
);



    } catch (error) {
      console.log(error);
      res.status(500).send("Search failed");
    }
  }

  async returnOrder(req, res) {
    try {
      const userId = req.session?.user?.id || req.user?._id;
      const { orderId } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length < 3) {
        return res.json({
          success: false,
          message: "Return reason is required"
        });
      }

      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        return res.json({
          success: false,
          message: "Order not found"
        });
      }

      if (order.status !== "DELIVERED") {
        return res.json({
          success: false,
          message: "Only delivered orders can be returned"
        });
      }

      const returnableItems = order.items.filter(item => item.itemStatus === "ACTIVE" && item.returnStatus === "NONE");

      if (returnableItems.length === 0) {
        return res.json({
          success: false,
          message: "No eligible items to return in this order"
        });
      }

      returnableItems.forEach(item => {
        item.returnStatus = "REQUESTED";
        item.returnReason = reason;
      });

      order.returnStatus = "REQUESTED";
      order.returnReason = reason;

      await order.save();

      return res.json({
        success: true,
        message: "Return request submitted for all items in this order"
      });
    } catch (error) {
      console.error("Return order error:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong"
      });
    }
  }
}


export default new orderController();