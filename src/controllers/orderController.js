import User from "../models/User.js";
import Address from "../models/Address.js";
import Cart from "../models/Cart.js"; //.js full time 
import Variant from "../models/Variant.js";
import Order from "../models/Order.js";
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
            orders
        });

    } catch (error) {
        console.log(error);
        res.redirect("/");
    }
}

async cancelOrder(req,res){

try{

const userId = req.session?.user?.id || req.user?._id;


const order = await Order.findOne({
    _id:req.params.id,
    userId
});


if(!order){

return res.json({
    success:false,
    message:"Order not found"
});

}


// Only allow cancellation before shipping

if(
order.status !== "PENDING" &&
order.status !== "CONFIRMED"
){

return res.json({
    success:false,
    message:"Order cannot be cancelled now"
});

}



for(const item of order.items){


const variant = await Variant.findById(
    item.variantId
);


if(variant){

variant.stock += item.quantity;

await variant.save();

}


// update item status

item.itemStatus="CANCELLED";


}



// update order

order.status="CANCELLED";

order.cancellationReason =
"Cancelled by customer";


await order.save();



return res.json({

success:true,

message:"Order cancelled successfully"

});



}catch(error){

console.log(error);

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



const item = order.items.id(itemId);


if(!item){

return res.json({
    success:false,
    message:"Product not found"
});

}



if(item.itemStatus === "CANCELLED"){

return res.json({
    success:false,
    message:"Product already cancelled"
});

}



// prevent cancellation after shipping

if(
order.status === "SHIPPED" ||
order.status === "DELIVERED"
){

return res.json({
    success:false,
    message:"Product cannot be cancelled now"
});

}



// increase stock

const variant = await Variant.findById(
    item.variantId
);


if(variant){

variant.stock += item.quantity;

await variant.save();

}



// update item status

item.itemStatus="CANCELLED";
item.cancelReason = reason || "No reason provided";


// check remaining active products

const activeItems = order.items.filter(
    item=>item.itemStatus==="ACTIVE"
);



if(activeItems.length===0){

order.status="CANCELLED";

}



// recalculate total

let subtotal=0;


order.items.forEach(item=>{

if(item.itemStatus==="ACTIVE"){

subtotal += item.price * item.quantity;

}

});


order.subtotal=subtotal;

order.grandTotal =
subtotal +
order.taxAmount +
order.shippingCost -
order.couponDiscount -
order.offerDiscount;



await order.save();



return res.json({

success:true,

message:"Product cancelled successfully"

});



}catch(error){

console.log(error);

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

}


export default new orderController();