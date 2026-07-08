import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../utils/httpError";
import { sendCashClosingEmail } from "../services/email.service";


export const cashRouter = Router();


const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  "luisangelauquisinche@gmail.com";


// =====================================
// CAJA ACTUAL
// =====================================

cashRouter.get(
"/current",
authMiddleware,
asyncHandler(async(req,res)=>{


const user = (req as any).user;


const session =
await prisma.cashSession.findFirst({

where:{
userId:user.id,
status:"OPEN"
},

include:{
sales:true,
movements:true
},

orderBy:{
id:"desc"
}

});


res.json(session);


})
);




// =====================================
// ABRIR CAJA
// =====================================

cashRouter.post(
"/open",
authMiddleware,
asyncHandler(async(req,res)=>{


const data =
z.object({

openingAmount:
z.number()
.nonnegative()
.default(0)

})
.parse(req.body);



const user =
(req as any).user;



const existing =
await prisma.cashSession.findFirst({

where:{
userId:user.id,
status:"OPEN"
}

});


if(existing){

throw httpError(
400,
"Ya tiene una caja abierta"
);

}



const session =
await prisma.cashSession.create({

data:{

userId:user.id,

openingAmount:
data.openingAmount

}

});



res.status(201).json(session);



})
);




// =====================================
// MOVIMIENTO DE CAJA
// =====================================

cashRouter.post(
"/movement",
authMiddleware,
asyncHandler(async(req,res)=>{


const data =
z.object({

type:
z.enum([
"INCOME",
"EXPENSE"
]),

amount:
z.number()
.positive(),

description:
z.string()
.optional()

})
.parse(req.body);



const user =
(req as any).user;



const session =
await prisma.cashSession.findFirst({

where:{
userId:user.id,
status:"OPEN"
}

});



if(!session){

throw httpError(
400,
"No tiene caja abierta"
);

}



const movement =
await prisma.cashMovement.create({

data:{

cashSessionId:
session.id,

userId:
user.id,

type:data.type,

amount:data.amount,

description:data.description

}

});



res.status(201).json(movement);



})
);




// =====================================
// CERRAR CAJA
// =====================================

cashRouter.post(
"/close",
authMiddleware,
asyncHandler(async(req,res)=>{


const data =
z.object({

closingAmount:
z.number()
.nonnegative()

})
.parse(req.body);



const user =
(req as any).user;




const result =
await prisma.$transaction(async(tx)=>{


const session =
await tx.cashSession.findFirst({

where:{

userId:user.id,

status:"OPEN"

},

include:{

sales:true,

movements:true

}

});



if(!session){

throw httpError(
400,
"No tiene caja abierta"
);

}




const salesTotal =
session.sales

.filter(
(sale)=>
sale.status==="COMPLETED"
)

.reduce(
(acc,sale)=>
acc + Number(sale.total),
0
);



const movementTotal =
session.movements.reduce(

(acc,movement)=>{

return movement.type==="INCOME"

?

acc + Number(movement.amount)

:

acc - Number(movement.amount);

},

0

);



const expectedAmount =
Number(session.openingAmount)
+
salesTotal
+
movementTotal;



const difference =
data.closingAmount -
expectedAmount;




return tx.cashSession.update({

where:{
id:session.id
},

data:{

closingAmount:
data.closingAmount,

expectedAmount,

difference,

status:"CLOSED",

closedAt:
new Date()

}

});



});




// =====================================
// CORREO DE CIERRE DE CAJA
// =====================================


await sendCashClosingEmail(

ADMIN_EMAIL,

{

date:
new Date().toLocaleDateString(),

totalSales:
result.expectedAmount,

profit:
result.difference,

stock:
"Ver reporte de inventario"

}

);



res.json(result);



})
);