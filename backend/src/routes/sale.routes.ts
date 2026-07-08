import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../utils/httpError";
import { sendEmail } from "../services/email.service";

export const saleRouter = Router();

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  "luisangelauquisinche@gmail.com";


const saleSchema = z.object({

  paymentMethod: z.enum([
    "CASH",
    "YAPE",
    "PLIN",
    "CARD",
    "TRANSFER",
    "MIXED"
  ]),

  discount:z.number()
  .nonnegative()
  .default(0),


  items:z.array(
    z.object({

      productId:z.number().int(),

      quantity:z.number()
      .int()
      .positive(),

    })
  ).min(1),

});



// ======================================
// LISTAR VENTAS
// ======================================

saleRouter.get(
"/",
authMiddleware,
asyncHandler(async(req,res)=>{


const sales =
await prisma.sale.findMany({

include:{
user:true,
cashSession:true,

items:{
include:{
product:true,
batch:true
}
}

},

orderBy:{
id:"desc"
},

take:100

});


res.json(sales);


})
);




// ======================================
// REGISTRAR VENTA
// ======================================


saleRouter.post(
"/",
authMiddleware,
asyncHandler(async(req,res)=>{


const data =
saleSchema.parse(req.body);


const user =
(req as any).user;



const result =
await prisma.$transaction(async(tx)=>{


const cashSession =
await tx.cashSession.findFirst({

where:{
userId:user.id,
status:"OPEN"
},

orderBy:{
id:"desc"
}

});



if(!cashSession){

throw httpError(
400,
"Debe abrir caja antes de vender"
);

}




const sale =
await tx.sale.create({

data:{

userId:user.id,

cashSessionId:
cashSession.id,

total:0,

discount:data.discount,

paymentMethod:
data.paymentMethod,

}

});



let grossTotal = 0;


const today = new Date();

today.setHours(
0,
0,
0,
0
);



for(const item of data.items){


const product =
await tx.product.findUnique({

where:{
id:item.productId
}

});



if(!product ||
product.status !== "ACTIVE"){

throw httpError(
404,
`Producto ${item.productId} no encontrado`
);

}




const batches =
await tx.productBatch.findMany({

where:{

productId:item.productId,

stock:{
gt:0
},

expirationDate:{
gt:today
}

},

orderBy:{
expirationDate:"asc"
}

});




const available =
batches.reduce(
(acc,batch)=>acc+batch.stock,
0
);



if(available < item.quantity){

throw httpError(
400,
`Stock insuficiente para ${product.name}`
);

}




let remaining =
item.quantity;



for(const batch of batches){


if(remaining<=0)
break;



const quantityToSell =
Math.min(
batch.stock,
remaining
);



const stockBefore =
batch.stock;


const stockAfter =
stockBefore - quantityToSell;


const unitPrice =
Number(
batch.salePrice ||
product.salePrice
);



const subtotal =
quantityToSell *
unitPrice;



grossTotal += subtotal;



await tx.productBatch.update({

where:{
id:batch.id
},

data:{
stock:stockAfter
}

});



await tx.saleItem.create({

data:{

saleId:sale.id,

productId:product.id,

batchId:batch.id,

quantity:quantityToSell,

unitPrice,

subtotal

}

});



await tx.inventoryMovement.create({

data:{

productId:product.id,

batchId:batch.id,

userId:user.id,

movementType:"SALE_EXIT",

quantity:quantityToSell,

stockBefore,

stockAfter,

referenceType:"sale",

referenceId:sale.id,

reason:"Salida por venta"

}

});



remaining -= quantityToSell;


}



}




const total =
Math.max(
grossTotal - data.discount,
0
);



return tx.sale.update({

where:{
id:sale.id
},

data:{
total
},

include:{

user:true,

cashSession:true,

items:{
include:{
product:true,
batch:true
}
}

}

});


});




// ======================================
// CORREO AUTOMÁTICO DE VENTA
// ======================================


await sendEmail(

ADMIN_EMAIL,

"🧾 Nueva venta registrada - Botica L y L",

`

<div style="font-family:Arial;padding:20px">

<h2>🧾 Venta registrada correctamente</h2>


<p>
<b>Usuario:</b>
${result.user.fullName}
</p>


<p>
<b>Método de pago:</b>
${result.paymentMethod}
</p>


<p>
<b>Total:</b>
S/ ${result.total}
</p>



<h3>Productos vendidos:</h3>


<ul>

${
result.items
.map(
(item:any)=>`

<li>

<b>${item.product.name}</b>

<br/>

Cantidad:
${item.quantity}

<br/>

Precio:
S/ ${item.unitPrice}

</li>

<br/>

`
)
.join("")
}

</ul>


<p>
Fecha:
${new Date().toLocaleString()}
</p>


</div>

`

);



res.status(201).json(result);



})
);




// ======================================
// CANCELAR VENTA
// ======================================

saleRouter.post(
"/:id/cancel",
authMiddleware,
asyncHandler(async(req,res)=>{

const id =
Number(req.params.id);


const data =
z.object({

reason:z.string()
.min(3)

})
.parse(req.body);



const user =
(req as any).user;



const result =
await prisma.$transaction(async(tx)=>{


const sale =
await tx.sale.findUnique({

where:{
id
},

include:{
items:true
}

});



if(!sale)
throw httpError(
404,
"Venta no encontrada"
);



if(sale.status==="CANCELLED")
throw httpError(
400,
"La venta ya está anulada"
);



for(const item of sale.items){


const batch =
await tx.productBatch.findUnique({

where:{
id:item.batchId
}

});



if(!batch)
continue;



await tx.productBatch.update({

where:{
id:batch.id
},

data:{
stock:
batch.stock + item.quantity
}

});



await tx.inventoryMovement.create({

data:{

productId:item.productId,

batchId:item.batchId,

userId:user.id,

movementType:"SALE_CANCEL",

quantity:item.quantity,

stockBefore:batch.stock,

stockAfter:
batch.stock + item.quantity,

referenceType:"sale",

referenceId:sale.id,

reason:data.reason

}

});


}




return tx.sale.update({

where:{
id
},

data:{

status:"CANCELLED",

cancelReason:data.reason,

cancelledAt:new Date()

},

include:{
items:{
include:{
product:true,
batch:true
}
}
}

});


});



res.json(result);


})
);