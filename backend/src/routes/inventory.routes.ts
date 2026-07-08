import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../utils/httpError";
import { sendEmail } from "../services/email.service";

export const inventoryRouter = Router();

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  "luisangelauquisinche@gmail.com";


// =====================================
// CONSULTAR STOCK
// =====================================

inventoryRouter.get(
  "/stock",
  asyncHandler(async (req, res) => {

    const products = await prisma.product.findMany({
      include:{
        category:true,
        laboratory:true,
        batches:{
          orderBy:{
            expirationDate:"asc"
          }
        }
      },
      orderBy:{
        name:"asc"
      }
    });


    res.json(
      products.map((p:any)=>({
        ...p,
        totalStock:p.batches.reduce(
          (acc:number,b:any)=>acc+b.stock,
          0
        )
      }))
    );

  })
);



// =====================================
// MOVIMIENTOS
// =====================================

inventoryRouter.get(
  "/movements",
  authMiddleware,
  asyncHandler(async(req,res)=>{


    const movements =
      await prisma.inventoryMovement.findMany({

        include:{
          product:true,
          batch:true,
          user:true
        },

        orderBy:{
          id:"desc"
        },

        take:100

      });


    res.json(movements);

  })
);



// =====================================
// AJUSTE DE INVENTARIO
// =====================================

inventoryRouter.post(
"/adjustment",
authMiddleware,
asyncHandler(async(req,res)=>{


const data = z.object({

batchId:z.number().int(),

type:z.enum([
"MANUAL_ENTRY",
"MANUAL_EXIT"
]),

quantity:z.number().int().positive(),

reason:z.string().min(3)

}).parse(req.body);



const user = (req as any).user;



const result =
await prisma.$transaction(async(tx)=>{


const batch =
await tx.productBatch.findUnique({

where:{
id:data.batchId
},

include:{
product:true
}

});



if(!batch)
throw httpError(
404,
"Lote no encontrado"
);



const stockBefore = batch.stock;



const stockAfter =
data.type==="MANUAL_ENTRY"
?
stockBefore + data.quantity
:
stockBefore - data.quantity;



if(stockAfter < 0){

throw httpError(
400,
"El ajuste dejaría el stock en negativo"
);

}



const updatedBatch =
await tx.productBatch.update({

where:{
id:data.batchId
},

data:{
stock:stockAfter
}

});



await tx.inventoryMovement.create({

data:{

productId:batch.productId,

batchId:batch.id,

userId:user.id,

movementType:data.type,

quantity:data.quantity,

stockBefore,

stockAfter,

reason:data.reason

}

});



return {
updatedBatch,
product:batch.product
};


});



// =====================================
// ENVÍO AUTOMÁTICO DE CORREO
// SOLO INGRESOS
// =====================================


if(data.type==="MANUAL_ENTRY"){


await sendEmail(

ADMIN_EMAIL,

"📦 Nuevo ingreso de inventario - Botica L y L",

`

<div style="font-family:Arial;padding:15px">

<h2>📦 Nuevo ingreso registrado</h2>


<p>
<b>Producto:</b>
${result.product.name}
</p>


<p>
<b>Cantidad ingresada:</b>
${data.quantity}
unidades
</p>


<p>
<b>Motivo:</b>
${data.reason}
</p>


<p>
<b>Stock actualizado:</b>
${result.updatedBatch.stock}
</p>


<p>
Fecha:
${new Date().toLocaleDateString()}
</p>


</div>

`

);

}



res.json(result.updatedBatch);


})
);