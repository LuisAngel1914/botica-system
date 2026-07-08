import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

import {
  sendCashClosingEmail,
  sendDailyReportEmail,
} from "../services/email.service";


export const reportRouter = Router();
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  "luisangelauquisinche@gmail.com";
// ================== UTILIDADES ==================
function getPeruDateRange(dateValue?: string) {
  const selectedDate =
    dateValue ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const start =
    new Date(`${selectedDate}T00:00:00-05:00`);
  const end =
    new Date(start);
  end.setUTCDate(
    end.getUTCDate() + 1
  );
  return {
    selectedDate,
    start,
    end
  };
}
function toNumber(value: unknown) {
  return Number(value || 0);
}



function getPurchasePrice(item:any){

  return toNumber(
    item.batch?.purchasePrice ??
    item.product?.purchasePrice ??
    0
  );

}



// ================== DASHBOARD ==================

reportRouter.get(
"/dashboard",
authMiddleware,
asyncHandler(async(req,res)=>{


const today = new Date();

today.setHours(
0,
0,
0,
0
);



const tomorrow =
new Date(today);


tomorrow.setDate(
tomorrow.getDate()+1
);



const [
productsCount,
salesToday,
lowStockProducts,
expiringBatches

]=await Promise.all([



prisma.product.count({

where:{
status:"ACTIVE"
}

}),



prisma.sale.findMany({

where:{

createdAt:{
gte:today,
lt:tomorrow
},

status:"COMPLETED"

}

}),



prisma.product.findMany({

where:{
status:"ACTIVE"
},

include:{
batches:true
}

}),



prisma.productBatch.findMany({

where:{

stock:{
gt:0
},

expirationDate:{

gte:today,

lte:
new Date(
today.getTime()+
1000*60*60*24*60
)

}

},

include:{
product:true
}

})

]);




const totalSalesToday =
salesToday.reduce(
(acc,sale)=>
acc + toNumber(sale.total),
0
);




const lowStock =
lowStockProducts

.map(p=>({

id:p.id,

name:p.name,

minStock:p.minStock,

totalStock:
p.batches.reduce(
(acc,b)=>acc+b.stock,
0
)

}))


.filter(
p=>p.totalStock <= p.minStock
);




res.json({

productsCount,

salesCountToday:
salesToday.length,

totalSalesToday,

lowStock,

expiringBatches

});


})
);



// ================== REPORTE CIERRE DE CAJA ==================

reportRouter.get(
"/cash-closing",
authMiddleware,
asyncHandler(async(req,res)=>{


const query =
z.object({

date:
z.string()
.regex(/^\d{4}-\d{2}-\d{2}$/)
.optional()

})
.parse(req.query);



const {
selectedDate,
start,
end

}=getPeruDateRange(query.date);




const [
sales,
cancelledSales,
products

]=await Promise.all([



prisma.sale.findMany({

where:{

createdAt:{
gte:start,
lt:end
},

status:{
in:[
"COMPLETED",
"CANCELLED"
]

}

},

include:{

items:{
include:{
product:true,
batch:true
}
}

}

}),




prisma.sale.findMany({

where:{

status:"CANCELLED",

cancelledAt:{
gte:start,
lt:end
}

}

}),
prisma.product.findMany({
where:{
status:"ACTIVE"
},
include:{
batches:true
}
})
]);
// ================== CALCULOS ==================

const totalSoldToday =
sales.reduce(
(acc,s)=>
acc + toNumber(s.total),
0
);



const totalCancelledToday =
cancelledSales.reduce(
(acc,s)=>
acc + toNumber(s.total),
0
);



const profitEstimated =
sales.reduce(
(accS,s)=>{

return accS +
s.items.reduce(
(accI,item)=>{

return (
accI +
(
toNumber(item.unitPrice) -
getPurchasePrice(item)
)
*
toNumber(item.quantity)
);

},
0
);

},
0
);



// ================== STOCK ==================

const soldUnits =
new Map<number,number>();


sales.forEach((sale)=>{

sale.items.forEach((item)=>{


soldUnits.set(

item.productId,

(
soldUnits.get(item.productId)
||0
)

+
toNumber(item.quantity)

);


});

});



const stockMovements =
products.map((product)=>{


const currentStock =
product.batches.reduce(
(acc,b)=>acc+b.stock,
0
);



return {

productId:product.id,

code:product.code,

name:product.name,

sold:
soldUnits.get(product.id)
||0,

finalStock:currentStock

};


});



const lowStock =
stockMovements.filter(
(product)=>
product.finalStock <= 5
);




// ================== RESPUESTA ==================

res.json({

date:selectedDate,

summary:{

totalSoldToday,

totalCancelledToday,

profitEstimated

},

stockMovements,

lowStock

});


})

);




// ==================================================
// ENVIAR REPORTE ADMINISTRATIVO POR CORREO
// ==================================================

reportRouter.post(
"/send-email",
authMiddleware,
asyncHandler(async(req,res)=>{


const today =
new Date();


const start =
new Date(today);

start.setHours(
0,
0,
0,
0
);



const end =
new Date(start);


end.setDate(
end.getDate()+1
);



const [

sales,

products

]=await Promise.all([



prisma.sale.findMany({

where:{

createdAt:{
gte:start,
lt:end
},

status:"COMPLETED"

}

}),



prisma.product.findMany({

where:{
status:"ACTIVE"
},

include:{
batches:true
}

})

]);




const totalSales =
sales.reduce(
(acc,sale)=>
acc + toNumber(sale.total),
0
);




const stock =
products.reduce(

(acc,product)=>

acc +
product.batches.reduce(
(total,batch)=>
total + batch.stock,
0
),

0

);




const lowStock =
products.filter(

(product)=>

product.batches.reduce(
(acc,batch)=>
acc + batch.stock,
0
)

<= product.minStock

).length;




await sendDailyReportEmail(

ADMIN_EMAIL,

{

date:
new Date()
.toLocaleDateString(),

totalSales,

cancelledSales:0,

stock,

lowStock,

expiring:0

}

);



res.json({

success:true,

message:
"Reporte enviado correctamente al administrador"

});


})

);