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
`${order.userId.name}`
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

}


export default new orderController();