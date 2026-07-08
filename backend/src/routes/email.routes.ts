import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  sendWelcomeEmail,
  sendSaleEmail,
  sendStockLowEmail,
  sendCashClosingEmail,
} from "../services/email.service";

export const emailRouter = Router();

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  "luisangelauquisinche@gmail.com";


// =====================================
// CORREO DE BIENVENIDA
// =====================================

emailRouter.post(
  "/welcome",
  authMiddleware,
  async (req, res) => {

    try {

      const { name } = req.body;

      await sendWelcomeEmail(
        ADMIN_EMAIL,
        name || "Administrador"
      );

      res.json({
        success: true,
        message: "Correo de bienvenida enviado correctamente",
      });

    } catch(error:any){

      res.status(500).json({
        success:false,
        message:error.message
      });

    }

  }
);


// =====================================
// CORREO DE VENTA
// =====================================

emailRouter.post(
  "/sale",
  authMiddleware,
  async (req,res)=>{

    try{

      const { data } = req.body;


      await sendSaleEmail(
        ADMIN_EMAIL,
        data
      );


      res.json({
        success:true,
        message:"Correo de venta enviado correctamente"
      });


    }catch(error:any){

      res.status(500).json({
        success:false,
        message:error.message
      });

    }

  }
);


// =====================================
// ALERTA STOCK BAJO
// =====================================

emailRouter.post(
  "/stock-low",
  authMiddleware,
  async(req,res)=>{

    try{

      const { product } = req.body;


      await sendStockLowEmail(
        ADMIN_EMAIL,
        product
      );


      res.json({
        success:true,
        message:"Alerta de stock enviada correctamente"
      });


    }catch(error:any){

      res.status(500).json({
        success:false,
        message:error.message
      });

    }

  }
);


// =====================================
// CIERRE DE CAJA
// =====================================

emailRouter.post(
  "/cash-closing",
  authMiddleware,
  async(req,res)=>{

    try{

      const { data } = req.body;


      await sendCashClosingEmail(
        ADMIN_EMAIL,
        data
      );


      res.json({
        success:true,
        message:"Cierre de caja enviado correctamente"
      });


    }catch(error:any){

      res.status(500).json({
        success:false,
        message:error.message
      });

    }

  }
);