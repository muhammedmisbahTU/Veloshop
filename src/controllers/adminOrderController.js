import Order from "../models/Order.js";


class AdminOrderController {


async orderList(req,res){

try{


const orders = await Order.find()

.populate(
    "userId",
    "fullName email"
)

.sort({
    createdAt:-1
});


res.render(
"admin/orders",
{
    orders
}
);



}catch(error){

console.log(
"Admin order list error:",
error
);


res.status(500).send(
"Something went wrong"
);


}


}


async orderDetails(req,res){

try{


const order = await Order.findById(req.params.id)

.populate(
    "userId",
    "fullName email phone"
);



if(!order){

return res.status(404).send(
"Order not found"
);

}



res.render(
"admin/order-details",
{
    order
}
);



}catch(error){

console.log(
"Admin order details error:",
error
);


res.status(500).send(
"Something went wrong"
);


}


}


async updateOrderStatus(req,res){

try{

const {status}=req.body;

const allowedStatus=[

"PENDING",
"CONFIRMED",
"PROCESSING",
"SHIPPED",
"DELIVERED",
"CANCELLED"

];

if(!allowedStatus.includes(status)){

return res.json({

success:false,

message:"Invalid status"

});

}

// prevent invalid movement

const transitions={

PENDING:[
"CONFIRMED",
"CANCELLED"
],

PAYMENT_FAILED:[
"CANCELLED",
"PENDING"
],

CONFIRMED:[
"PROCESSING",
"CANCELLED"
],

PROCESSING:[
"SHIPPED"
],

SHIPPED:[
"DELIVERED"
],

DELIVERED:[],

CANCELLED:[]

};

const allowedSourceStates = Object.keys(transitions).filter(k => transitions[k].includes(status));

const order = await Order.findOneAndUpdate(
  {
    _id: req.params.id,
    status: { $in: allowedSourceStates }
  },
  {
    $set: { status: status }
  },
  { new: false }
);

if(!order){

return res.json({

success:false,

message:`Cannot change order status to ${status} (invalid transition or order not found)`

});

}

if (status === "CANCELLED" && order.status !== "CANCELLED") {
    const Variant = (await import("../models/Variant.js")).default;
    for (const item of order.items) {
        if (item.itemStatus !== "CANCELLED") {
            const variant = await Variant.findById(item.variantId);
            if (variant) {
                variant.stock += item.quantity;
                await variant.save();
            }
        }
    }
    
    // Wallet refund logic for admin cancellation
    const totalToRefund = order.grandTotal - (order.refundAmount || 0);
    if (order.paymentStatus === "SUCCESS" && (order.paymentMethod === "ONLINE" || order.paymentMethod === "WALLET") && totalToRefund > 0) {
        const Wallet = (await import("../models/Wallet.js")).default;
        const Transaction = (await import("../models/Transaction.js")).default;

        let wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
            wallet = await Wallet.create({ userId: order.userId, balance: 0 });
        }

        wallet.balance += totalToRefund;
        await wallet.save();

        await Transaction.create({
            userId: order.userId,
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
                    refundAmount: order.grandTotal,
                    "items.$[].itemStatus": "CANCELLED",
                    "items.$[].cancellationReason": "Cancelled by Administrator"
                }
            }
        );
    } else {
        await Order.updateOne(
            { _id: order._id },
            {
                $set: {
                    paymentStatus: "FAILED",
                    "items.$[].itemStatus": "CANCELLED",
                    "items.$[].cancellationReason": "Cancelled by Administrator"
                }
            }
        );
    }
}

// when delivered
if(status==="DELIVERED"){
    const setFields = { deliveryDate: new Date() };
    if(order.paymentMethod==="COD" || order.paymentMethod==="ONLINE" || order.paymentMethod==="CARD" || order.paymentMethod==="UPI"){
        setFields.paymentStatus = "SUCCESS";
    }
    await Order.updateOne({ _id: order._id }, { $set: setFields });
}

return res.json({

success:true,

message:"Order status updated"

});

}catch(error){

console.log(error);

return res.status(500).json({

success:false,

message:"Something went wrong"

});

}

  }

  async updateItemReturnStatus(req, res) {
    try {
      const { orderId, itemId } = req.params;
      const { status, rejectedReason } = req.body;

      const validStatuses = ["APPROVED", "REJECTED"];
      if (!validStatuses.includes(status)) {
        return res.json({ success: false, message: "Invalid status value" });
      }

      const order = await Order.findOneAndUpdate(
        {
          _id: orderId,
          items: {
            $elemMatch: {
              _id: itemId,
              returnStatus: "REQUESTED"
            }
          }
        },
        {
          $set: {
            "items.$[elem].returnStatus": status,
            "items.$[elem].returnReason": rejectedReason || "No reason provided"
          }
        },
        {
          arrayFilters: [{ "elem._id": itemId }],
          new: false
        }
      );

      if (!order) {
        return res.json({ success: false, message: "Order or item not found, or return request is already processed" });
      }

      const item = order.items.id(itemId);

      if (status === "APPROVED") {
        const Variant = (await import("../models/Variant.js")).default;
        const variant = await Variant.findById(item.variantId);
        if (variant) {
          variant.stock += item.quantity;
          await variant.save();
        }

        await Order.updateOne(
          { _id: order._id, "items._id": itemId },
          { $set: { "items.$.itemStatus": "RETURNED" } }
        );

        const activeItems = order.items.filter(i => i.itemStatus === "ACTIVE" && i._id.toString() !== itemId.toString());
        const newOrderStatus = activeItems.length === 0 ? "RETURNED" : order.status;

        // Proportional refund calculation
        const originalSubtotal = order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        let itemRefund = 0;

        if (activeItems.length === 0) {
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

          let wallet = await Wallet.findOne({ userId: order.userId });
          if (!wallet) {
            wallet = await Wallet.create({ userId: order.userId, balance: 0 });
          }

          wallet.balance += itemRefund;
          await wallet.save();

          await Transaction.create({
            userId: order.userId,
            walletId: wallet._id,
            referenceType: "REFUND",
            referenceId: order._id,
            amount: itemRefund,
            balanceAfter: wallet.balance,
            transactionType: "CREDIT",
            status: "SUCCESS",
            description: `Refund for returned item (${item.productName}) in order ${order.orderNumber}`
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
              status: newOrderStatus,
              refundAmount: newRefundAmount,
              paymentStatus: newPaymentStatus,
              refundStatus: newRefundStatus
            }
          }
        );
      } else if (status === "REJECTED") {
        await Order.updateOne(
          { _id: order._id },
          { $set: { returnRejectedReason: rejectedReason || "Rejected by administrator" } }
        );
      }

      return res.json({
        success: true,
        message: `Product return request ${status.toLowerCase()} successfully.`
      });
    } catch (error) {
      console.error("Update item return status error:", error);
      return res.status(500).json({ success: false, message: "Something went wrong" });
    }
  }
}


export default new AdminOrderController();