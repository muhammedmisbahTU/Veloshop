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

}


export default new orderController();