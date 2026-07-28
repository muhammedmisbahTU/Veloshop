import Order from "../models/Order.js";


class AdminOrderController {


async orderList(req,res){

try{


const orders = await Order.find()

.populate(
    "userId",
    "name email"
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
    "name email phone"
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




order.status=status;



// when delivered

if(status==="DELIVERED"){

order.deliveryDate=new Date();

}


// payment update for COD

if(
status==="DELIVERED" &&
order.paymentMethod==="COD"
){

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

}


export default new AdminOrderController();