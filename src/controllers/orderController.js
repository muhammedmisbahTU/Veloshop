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

const newStatus = activeItems.length === 0 ? "CANCELLED" : order.status;

let newSubtotal = activeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
const newGrandTotal = Math.max(0, newSubtotal + order.taxAmount + order.shippingCost - order.couponDiscount - order.offerDiscount);

// Proportional refund calculation
const originalSubtotal = order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
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
margin:50
});


doc.pipe(res);



// Header

doc
.fontSize(22)
.text("INVOICE",{
align:"center"
});


doc.moveDown();



doc
.fontSize(12)
.text(
`Order ID : ${order.orderNumber}`
);


doc.text(
`Order Date : ${order.createdAt.toDateString()}`
);


doc.text(
`Payment Method : ${order.paymentMethod}`
);


doc.text(
`Payment Status : ${order.paymentStatus}`
);



doc.moveDown();


// Customer Details

doc
.fontSize(15)
.text("Billing Details");


doc.fontSize(11);


doc.text(
`${order.userId.fullName}`
);


doc.text(
`${order.addressSnapshot.addressLine1}`
);


doc.text(
`${order.addressSnapshot.city}, ${order.addressSnapshot.state}`
);


doc.text(
`${order.addressSnapshot.country} - ${order.addressSnapshot.pinCode}`
);



doc.moveDown();


// Products

doc
.fontSize(15)
.text("Products");


doc.moveDown();



order.items.forEach((item,index)=>{


doc.fontSize(11).text(

`${index+1}. ${item.productName}`

);


doc.text(

`Quantity : ${item.quantity}`

);


doc.text(

`Price : ₹${item.price}`

);


doc.text(

`Status : ${item.itemStatus}`

);


doc.moveDown();


});



// Summary


doc
.fontSize(15)
.text("Payment Summary");


doc.fontSize(11);


doc.text(
`Subtotal : ₹${order.subtotal}`
);


doc.text(
`Discount : ₹${order.couponDiscount + order.offerDiscount}`
);


doc.text(
`Tax : ₹${order.taxAmount}`
);


doc.text(
`Shipping : ₹${order.shippingCost}`
);


doc.text(
`Grand Total : ₹${order.grandTotal}`
);



doc.moveDown();


doc
.fontSize(12)
.text(
"Thank you for shopping with us!",
{
align:"center"
}
);



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



}catch(error){

console.log(error);


res.status(500).send(
"Search failed"
);


}

}

}


export default new orderController();