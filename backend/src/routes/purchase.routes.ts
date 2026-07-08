import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../utils/httpError";
import { sendEmail } from "../services/email.service";

export const purchaseRouter = Router();

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  "luisangelauquisinche@gmail.com";


const purchaseSchema = z.object({

  supplierId: z.number().int().optional().nullable(),

  invoiceNumber: z.string().optional().nullable(),

  items: z.array(
    z.object({

      productId: z.number().int(),

      batchNumber: z.string().min(1),

      expirationDate: z.string().min(10),

      quantity: z.number().int().positive(),

      unitCost: z.number().nonnegative(),

      salePrice: z.number().nonnegative().optional(),

    })
  ).min(1),

});



// ======================================
// LISTAR COMPRAS
// ======================================

purchaseRouter.get(
"/",
authMiddleware,
asyncHandler(async(req,res)=>{


const purchases =
await prisma.purchase.findMany({

include:{
supplier:true,
user:true,

items:{
include:{
product:true,
batch:true
}
}

},

orderBy:{
id:"desc"
}

});


res.json(purchases);


})
);




// ======================================
// REGISTRAR INGRESO
// ======================================

purchaseRouter.post(
"/",
authMiddleware,
asyncHandler(async(req,res)=>{


const data =
purchaseSchema.parse(req.body);



const user = (req as any).user;



const result =
await prisma.$transaction(async(tx)=>{


let total = 0;



const purchase =
await tx.purchase.create({

data:{

supplierId:data.supplierId || null,

userId:user.id,

invoiceNumber:
data.invoiceNumber || null,

total:0,

}

});





for(const item of data.items){



const product =
await tx.product.findUnique({

where:{
id:item.productId
}

});



if(!product){

throw httpError(
404,
`Producto ${item.productId} no encontrado`
);

}





const expirationDate =
new Date(item.expirationDate);



const subtotal =
item.quantity * item.unitCost;



total += subtotal;




const existingBatch =
await tx.productBatch.findFirst({

where:{

productId:item.productId,

batchNumber:item.batchNumber,

expirationDate

}

});




let batch;



if(existingBatch){


batch =
await tx.productBatch.update({

where:{
id:existingBatch.id
},

data:{

stock:
existingBatch.stock + item.quantity,

purchasePrice:
item.unitCost,

salePrice:
item.salePrice ??
Number(product.salePrice),

}

});


}else{


batch =
await tx.productBatch.create({

data:{

productId:item.productId,

batchNumber:item.batchNumber,

expirationDate,

stock:item.quantity,

purchasePrice:item.unitCost,

salePrice:
item.salePrice ??
Number(product.salePrice),

}

});


}





await tx.purchaseItem.create({

data:{

purchaseId:purchase.id,

productId:item.productId,

batchId:batch.id,

quantity:item.quantity,

unitCost:item.unitCost,

subtotal,

}

});





await tx.inventoryMovement.create({

data:{

productId:item.productId,

batchId:batch.id,

userId:user.id,

movementType:"PURCHASE_ENTRY",

quantity:item.quantity,

stockBefore:
existingBatch?.stock ?? 0,

stockAfter:
batch.stock,

referenceType:"purchase",

referenceId:purchase.id,

reason:"Ingreso por compra",

}

});



}




const updatedPurchase =
await tx.purchase.update({

where:{
id:purchase.id
},

data:{
total
},


include:{

supplier:true,

items:{
include:{
product:true,
batch:true
}
}

}

});



return updatedPurchase;



});






// ======================================
// CORREO AUTOMÁTICO
// ======================================


await sendEmail(

ADMIN_EMAIL,

"📦 Nuevo ingreso de inventario - Botica L y L",

`

<div style="font-family:Arial;padding:20px">


<h2>📦 Nuevo ingreso registrado</h2>


<p>
<b>Usuario:</b>
${user.fullName || "Administrador"}
</p>


<p>
<b>Total compra:</b>
S/ ${result.total}
</p>


<h3>Productos ingresados:</h3>


<ul>

${
result.items
.map(
(item:any)=>

`

<li>

<b>${item.product.name}</b>

<br/>

Cantidad:
${item.quantity}

<br/>

Lote:
${item.batch.batchNumber}

<br/>

Vencimiento:
${new Date(item.batch.expirationDate)
.toLocaleDateString()}

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