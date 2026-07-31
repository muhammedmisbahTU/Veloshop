export const calculateOfferPrice = (
price,
offer
)=>{


if(!offer)
{
return {
finalPrice:price,
discount:0
};
}



let discountAmount=0;



if(
offer.discountType==="PERCENTAGE"
)
{

discountAmount =
price *
offer.discountValue /
100;

}

else
{

discountAmount =
offer.discountValue;

}



const finalPrice =
Math.max(
price-discountAmount,
0
);



return {

originalPrice:price,

discount:
discountAmount,

finalPrice

};


};