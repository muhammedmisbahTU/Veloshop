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


const order = await Order.findById(
    req.params.id
);



if(!order){

return res.json({

success:false,

message:"Order not found"

});

}



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



if(
!transitions[order.status]
.includes(status)
){


return res.json({

success:false,

message:
`Cannot change ${order.status} to ${status}`

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
            item.itemStatus = "CANCELLED";
            item.cancelReason = "Cancelled by Administrator";
        }
    }
    order.paymentStatus = "FAILED";
    order.cancellationReason = "Cancelled by Administrator";
}

order.status=status;

// when delivered
if(status==="DELIVERED"){
    order.deliveryDate=new Date();
}

// payment update for COD or ONLINE success
if(status==="DELIVERED" && (order.paymentMethod==="COD" || order.paymentMethod==="ONLINE" || order.paymentMethod==="CARD" || order.paymentMethod==="UPI")){
    order.paymentStatus="SUCCESS";
}

await order.save();



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

      const order = await Order.findById(orderId);
      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }

      const item = order.items.id(itemId);
      if (!item) {
        return res.json({ success: false, message: "Product not found" });
      }

      const validStatuses = ["APPROVED", "REJECTED"];
      if (!validStatuses.includes(status)) {
        return res.json({ success: false, message: "Invalid status value" });
      }

      if (item.returnStatus === "APPROVED" || item.returnStatus === "COMPLETED") {
        return res.json({ success: false, message: "Return request is already approved/completed" });
      }

      item.returnStatus = status;

      if (status === "APPROVED") {
        // Increment stock when return is approved
        const Variant = (await import("../models/Variant.js")).default;
        const variant = await Variant.findById(item.variantId);
        if (variant) {
          variant.stock += item.quantity;
          await variant.save();
        }
        item.itemStatus = "RETURNED";

        // Check if all items in the order have been returned or cancelled
        const activeItems = order.items.filter(i => i.itemStatus === "ACTIVE");
        if (activeItems.length === 0) {
          order.status = "RETURNED";
        }
        order.refundStatus = "COMPLETED";

        // Process refund for returned item if paid
        if (order.paymentStatus === "SUCCESS" && (order.paymentMethod === "ONLINE" || order.paymentMethod === "WALLET")) {
          const Wallet = (await import("../models/Wallet.js")).default;
          const Transaction = (await import("../models/Transaction.js")).default;

          let wallet = await Wallet.findOne({ userId: order.userId });
          if (!wallet) {
            wallet = await Wallet.create({ userId: order.userId, balance: 0 });
          }

          const itemTotal = item.price * item.quantity;
          wallet.balance += itemTotal;
          await wallet.save();

          await Transaction.create({
            userId: order.userId,
            walletId: wallet._id,
            referenceType: "REFUND",
            referenceId: order._id,
            amount: itemTotal,
            balanceAfter: wallet.balance,
            transactionType: "CREDIT",
            status: "SUCCESS",
            description: `Refund for returned item (${item.productName}) in order ${order.orderNumber}`
          });

          order.refundAmount = (order.refundAmount || 0) + itemTotal;
          // If all items are returned/cancelled, mark overall order as REFUNDED
          if (activeItems.length === 0) {
             order.paymentStatus = "REFUNDED";
          }
        }
      } else if (status === "REJECTED") {
        order.returnRejectedReason = rejectedReason || "Rejected by administrator";
      }

      await order.save();

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